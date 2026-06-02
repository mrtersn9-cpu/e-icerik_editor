const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

jest.setTimeout(30000);

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function requestJson(port, method, requestPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = data;
          }
          resolve({ status: response.statusCode, body: parsed, headers: response.headers });
        });
      }
    );
    request.once('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function waitForServer(port, processRef) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12000) {
    if (processRef.exitCode !== null) {
      throw new Error(`Server exited early with code ${processRef.exitCode}`);
    }
    try {
      const response = await requestJson(port, 'GET', '/api/health');
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Server did not start in time');
}

describe('server auth and admin API', () => {
  let port;
  let dataDir;
  let serverProcess;
  let stderr = '';

  beforeAll(async () => {
    port = await getFreePort();
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-icerik-server-test-'));
    serverProcess = childProcess.spawn(process.execPath, ['server.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        EICERIK_DATA_DIR: dataDir,
        EICERIK_ADMIN_TOKEN: 'test-admin-token',
        EICERIK_SESSION_TOKEN_SECRET: 'test-session-secret',
        EICERIK_USER1_PASSWORD: 'user1-pass',
        EICERIK_USER2_PASSWORD: 'user2-pass',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProcess.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    await waitForServer(port, serverProcess);
  });

  afterAll(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      const closed = new Promise((resolve) => serverProcess.once('close', resolve));
      serverProcess.kill();
      await closed;
    }
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test('protects admin users and accepts signed bearer session tokens', async () => {
    const forbidden = await requestJson(port, 'GET', '/api/admin/users');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('ADMIN_FORBIDDEN');

    const created = await requestJson(
      port,
      'POST',
      '/api/admin/users',
      { id: 'qa-user', name: 'QA User', password: 'qa-pass', active: true },
      { 'X-Admin-Token': 'test-admin-token' }
    );
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ id: 'qa-user', name: 'QA User', active: true });
    expect(created.body.user.passwordHash).toBeUndefined();

    const login = await requestJson(port, 'POST', '/api/auth/login', {
      userId: 'qa-user',
      password: 'qa-pass',
      sessionId: 'test-session',
      sessionLabel: 'Jest',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.tokenExpiresAt).toEqual(expect.any(Number));

    const workspace = await requestJson(port, 'GET', '/api/workspace', null, {
      Authorization: `Bearer ${login.body.token}`,
    });
    expect(workspace.status).toBe(200);
    expect(workspace.body.currentProject).toBeTruthy();

    const invalidToken = await requestJson(port, 'GET', '/api/workspace', null, {
      Authorization: 'Bearer invalid.token',
      'X-User-Id': 'qa-user',
      'X-Session-Id': 'test-session',
    });
    expect(invalidToken.status).toBe(401);
    expect(invalidToken.body.code).toBe('INVALID_SESSION_TOKEN');

    const logPath = path.join(dataDir, 'security-events.log');
    expect(fs.readFileSync(logPath, 'utf8')).toContain('admin_user_created');

    const events = await requestJson(port, 'GET', '/api/admin/security-events?limit=20', null, {
      'X-Admin-Token': 'test-admin-token',
    });
    expect(events.status).toBe(200);
    expect(events.body.events.some((event) => event.type === 'admin_user_created')).toBe(true);

    const filteredEvents = await requestJson(
      port,
      'GET',
      '/api/admin/security-events?limit=20&type=admin_user_created&userId=qa-user&from=2000-01-01&to=2100-01-01',
      null,
      {
        'X-Admin-Token': 'test-admin-token',
      }
    );
    expect(filteredEvents.status).toBe(200);
    expect(filteredEvents.body.events.length).toBeGreaterThan(0);
    expect(
      filteredEvents.body.events.every(
        (event) => event.type === 'admin_user_created' && event.userId === 'qa-user'
      )
    ).toBe(true);
  });

  test('protects manual SQL backup downloads with the admin token', async () => {
    const forbidden = await requestJson(port, 'GET', '/api/admin/backup');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('ADMIN_FORBIDDEN');

    const backup = await requestJson(port, 'GET', '/api/admin/backup', null, {
      'X-Admin-Token': 'test-admin-token',
    });
    expect(backup.status).toBe(200);
    expect(backup.headers['content-disposition']).toContain('eicerik-sql-backup-');
    expect(backup.body).toContain('CREATE TABLE');
    expect(backup.body).toContain('INSERT INTO');
    expect(backup.body).toContain('projects');
    expect(backup.body).not.toContain('user_sessions');
    expect(backup.body).not.toContain('book_locks');
  });

  test('keeps production secrets out of server output during tests', () => {
    expect(stderr).not.toContain('test-admin-token');
    expect(stderr).not.toContain('test-session-secret');
  });
});
