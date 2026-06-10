import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4001);
const DATA_DIR = path.resolve(process.env.EICERIK_DATA_DIR || path.join(__dirname, "data"));
const DB_PATH = path.join(DATA_DIR, "e-icerik-editor.sqlite");
const SECURITY_LOG_PATH = path.join(DATA_DIR, "security-events.log");
const BUILD_DIR = path.join(__dirname, "build");
const PDF_ANALYSIS_MODE = "offline";
const SEEDED_USERS = [
  { id: "kullanici1", name: process.env.EICERIK_USER1_NAME || "Kullanici 1", password: process.env.EICERIK_USER1_PASSWORD || "1234" },
  { id: "kullanici2", name: process.env.EICERIK_USER2_NAME || "Kullanici 2", password: process.env.EICERIK_USER2_PASSWORD || "1234" },
];
const DEFAULT_USER_ID = SEEDED_USERS[0].id;
const SESSION_TTL_MS = Number(process.env.EICERIK_SESSION_TTL_MS || 60_000);
const SESSION_TOKEN_TTL_MS = Number(process.env.EICERIK_SESSION_TOKEN_TTL_MS || 8 * 60 * 60_000);
const SESSION_TOKEN_SECRET = process.env.EICERIK_SESSION_TOKEN_SECRET || `dev-${DB_PATH}`;
const ADMIN_TOKEN = String(process.env.EICERIK_ADMIN_TOKEN || "").trim();
const PASSWORD_HASH_ITERATIONS = Number(process.env.EICERIK_PASSWORD_ITERATIONS || 120_000);
const LOGIN_RATE_WINDOW_MS = Number(process.env.EICERIK_LOGIN_RATE_WINDOW_MS || 5 * 60_000);
const LOGIN_RATE_MAX_ATTEMPTS = Number(process.env.EICERIK_LOGIN_RATE_MAX_ATTEMPTS || 5);
const LOGIN_RATE_LOCK_MS = Number(process.env.EICERIK_LOGIN_RATE_LOCK_MS || 10 * 60_000);
const FORCE_KICK_GRACE_MS = Number(process.env.EICERIK_FORCE_KICK_GRACE_MS || 30_000);
const loginAttemptBuckets = new Map();
const pendingKickRequests = new Map();
const SENSITIVE_LMS_KEYS = ["xapiKey", "xapiSecret", "ltiConsumerKey", "ltiSharedSecret"];
const REDACTED_SECRET_VALUE = "__REDACTED_SECRET__";
const DEFAULT_ALLOWED_ORIGINS = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const ALLOWED_ORIGINS = new Set(
  String(process.env.EICERIK_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
);
const BODY_LIMIT_BYTES = Number(process.env.EICERIK_BODY_LIMIT_BYTES || 10_000_000);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (!process.env.EICERIK_USER1_PASSWORD || !process.env.EICERIK_USER2_PASSWORD) {
  const message =
    "Varsayilan gelistirme sifreleri aktif. EICERIK_USER1_PASSWORD ve EICERIK_USER2_PASSWORD tanimlayin.";
  if (IS_PRODUCTION) {
    console.error(`Guvenlik hatasi: ${message}`);
    process.exit(1);
  }
  console.warn(`Uyari: ${message} (canli ortamda zorunlu)`);
}

if (!process.env.EICERIK_SESSION_TOKEN_SECRET) {
  const message =
    "Gelistirme session token secret'i (tahmin edilebilir) aktif. EICERIK_SESSION_TOKEN_SECRET tanimlayin.";
  if (IS_PRODUCTION) {
    console.error(`Guvenlik hatasi: ${message}`);
    process.exit(1);
  }
  console.warn(`Uyari: ${message} (canli ortamda zorunlu)`);
}

// Veri dizini ve DB dosyasi yalnizca sahibe okunur/yazilir olmali (POSIX). Windows'ta
// mode argumani yok sayilir; orada NTFS ACL'leri ile korunmali.
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
try {
  fs.chmodSync(DATA_DIR, 0o700);
} catch { /* Windows / desteklenmeyen FS: sessizce gec */ }

const db = new DatabaseSync(DB_PATH);
try {
  // SQLite verisi yalnizca sahibe okunur/yazilir (dunyaya acik olmasin).
  fs.chmodSync(DB_PATH, 0o600);
} catch { /* Windows / desteklenmeyen FS: sessizce gec */ }
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA busy_timeout = 5000;`);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    label TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    user_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    session_label TEXT,
    locked_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS book_locks (
    project_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    session_label TEXT,
    locked_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (project_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS editor_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS review_threads (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    slide_ref TEXT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

ensureProjectColumn("created_at", "ALTER TABLE projects ADD COLUMN created_at TEXT");
ensureProjectColumn("published_version_id", "ALTER TABLE projects ADD COLUMN published_version_id TEXT");
ensureProjectColumn("user_id", "ALTER TABLE projects ADD COLUMN user_id TEXT");
ensureEditorUserColumn("active", "ALTER TABLE editor_users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
ensureSeedUsers();
db.exec(`UPDATE projects SET created_at = saved_at WHERE created_at IS NULL OR created_at = ''`);
db.prepare("UPDATE projects SET user_id = ? WHERE user_id IS NULL OR user_id = ''").run(DEFAULT_USER_ID);
scrubStoredSecrets();

function ensureProjectColumn(columnName, sql) {
  const columns = db.prepare("PRAGMA table_info(projects)").all();
  if (!columns.some(column => column.name === columnName)) {
    db.exec(sql);
  }
}

function ensureEditorUserColumn(columnName, sql) {
  const columns = db.prepare("PRAGMA table_info(editor_users)").all();
  if (!columns.some(column => column.name === columnName)) {
    db.exec(sql);
  }
}

function createPasswordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(String(password || ""), salt, PASSWORD_HASH_ITERATIONS, 32, "sha256").toString("hex");
  return { hash, salt };
}

function verifyPassword(user, suppliedPassword) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const suppliedHash = pbkdf2Sync(String(suppliedPassword || ""), user.passwordSalt, PASSWORD_HASH_ITERATIONS, 32, "sha256");
  const storedHash = Buffer.from(user.passwordHash, "hex");
  return storedHash.length === suppliedHash.length && timingSafeEqual(storedHash, suppliedHash);
}

function ensureSeedUsers() {
  const now = new Date().toISOString();
  SEEDED_USERS.forEach((seedUser, index) => {
    const envPasswordProvided = Boolean(process.env[`EICERIK_USER${index + 1}_PASSWORD`]);
    const existing = db.prepare("SELECT id FROM editor_users WHERE id = ?").get(seedUser.id);
    if (existing && !envPasswordProvided) {
      db.prepare("UPDATE editor_users SET name = ?, active = 1, updated_at = ? WHERE id = ?").run(seedUser.name, now, seedUser.id);
      return;
    }
    const passwordRecord = createPasswordRecord(seedUser.password);
    db.prepare(`
      INSERT INTO editor_users (id, name, password_hash, password_salt, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt,
        active = excluded.active,
        updated_at = excluded.updated_at
    `).run(seedUser.id, seedUser.name, passwordRecord.hash, passwordRecord.salt, now, now);
  });
}

function logSecurityEvent(type, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    type,
    ...details,
  };
  try {
    fs.appendFileSync(SECURITY_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {}
}

function parseSecurityFilterTime(value = "", endOfDay = false) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return null;
  const normalized = cleanValue.includes("T") ? cleanValue : `${cleanValue}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function eventMatchesSecurityFilters(event = {}, filters = {}) {
  const type = String(filters.type || "").trim().toLowerCase();
  const userId = String(filters.userId || "").trim().toLowerCase();
  const from = parseSecurityFilterTime(filters.from);
  const to = parseSecurityFilterTime(filters.to, true);
  if (type && !String(event.type || "").toLowerCase().includes(type)) return false;
  if (userId && !String(event.userId || event.user_id || "").toLowerCase().includes(userId)) return false;
  const eventTime = Date.parse(event.time || "");
  if (from != null && (!Number.isFinite(eventTime) || eventTime < from)) return false;
  if (to != null && (!Number.isFinite(eventTime) || eventTime > to)) return false;
  return true;
}

function listSecurityEvents(limit = 100, filters = {}) {
  const resolvedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  try {
    if (!fs.existsSync(SECURITY_LOG_PATH)) return [];
    return fs.readFileSync(SECURITY_LOG_PATH, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { time: "", type: "unparsed_log_line" };
        }
      })
      .filter(event => eventMatchesSecurityFilters(event, filters))
      .slice(-resolvedLimit)
      .reverse();
  } catch {
    return [];
  }
}

const BACKUP_TABLES = ["app_state", "projects", "project_versions", "editor_users", "review_threads"];

function quoteSqlIdentifier(value = "") {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteSqlValue(value) {
  if (value == null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSqliteBackup() {
  const now = new Date().toISOString();
  const lines = [
    "-- E-Icerik Editor SQLite backup",
    `-- Created at: ${now}`,
    "-- Includes persistent content tables only; sessions and locks are intentionally excluded.",
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    "",
  ];

  BACKUP_TABLES.forEach((tableName) => {
    const schema = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName)?.sql;
    if (!schema) return;
    const columns = db.prepare(`PRAGMA table_info(${quoteSqlIdentifier(tableName)})`).all();
    const columnNames = columns.map((column) => column.name).filter(Boolean);
    lines.push(`DROP TABLE IF EXISTS ${quoteSqlIdentifier(tableName)};`);
    lines.push(`${schema};`);
    if (columnNames.length) {
      const rows = db.prepare(`SELECT * FROM ${quoteSqlIdentifier(tableName)}`).all();
      rows.forEach((row) => {
        const columnSql = columnNames.map(quoteSqlIdentifier).join(", ");
        const valueSql = columnNames.map((column) => quoteSqlValue(row[column])).join(", ");
        lines.push(
          `INSERT INTO ${quoteSqlIdentifier(tableName)} (${columnSql}) VALUES (${valueSql});`
        );
      });
    }
    lines.push("");
  });

  lines.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");
  return lines.join("\n");
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function getLoginRateKey(req, userId) {
  return `${getRequestIp(req)}:${String(userId || "unknown").trim() || "unknown"}`;
}

function getLoginRateStatus(req, userId) {
  const key = getLoginRateKey(req, userId);
  const now = Date.now();
  const bucket = loginAttemptBuckets.get(key);
  if (!bucket) return { limited: false, key, waitSeconds: 0 };
  if (bucket.lockUntil && bucket.lockUntil > now) {
    return { limited: true, key, waitSeconds: Math.ceil((bucket.lockUntil - now) / 1000) };
  }
  if (bucket.windowStart + LOGIN_RATE_WINDOW_MS <= now) {
    loginAttemptBuckets.delete(key);
    return { limited: false, key, waitSeconds: 0 };
  }
  return { limited: false, key, waitSeconds: 0 };
}

function recordFailedLogin(rateKey) {
  const now = Date.now();
  const current = loginAttemptBuckets.get(rateKey);
  const bucket = current && current.windowStart + LOGIN_RATE_WINDOW_MS > now
    ? current
    : { count: 0, windowStart: now, lockUntil: 0 };
  bucket.count += 1;
  if (bucket.count >= LOGIN_RATE_MAX_ATTEMPTS) {
    bucket.lockUntil = now + LOGIN_RATE_LOCK_MS;
  }
  loginAttemptBuckets.set(rateKey, bucket);
  return bucket.lockUntil > now ? Math.ceil((bucket.lockUntil - now) / 1000) : 0;
}

function clearLoginFailures(req, userId) {
  loginAttemptBuckets.delete(getLoginRateKey(req, userId));
}

function base64UrlJson(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signTokenPayload(payloadPart) {
  return createHmac("sha256", SESSION_TOKEN_SECRET).update(payloadPart).digest("base64url");
}

function createSessionToken(userId, sessionId) {
  const expiresAt = Date.now() + SESSION_TOKEN_TTL_MS;
  const payloadPart = base64UrlJson({ userId, sessionId, exp: expiresAt });
  return {
    token: `${payloadPart}.${signTokenPayload(payloadPart)}`,
    expiresAt,
  };
}

function verifySessionToken(token = "") {
  const [payloadPart, signature] = String(token || "").split(".");
  if (!payloadPart || !signature) return null;
  try {
    const expected = signTokenPayload(payloadPart);
    const supplied = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");
    if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (!payload?.userId || !payload?.sessionId || Number(payload.exp || 0) <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function resolveRequestSession(req) {
  const token = getBearerToken(req);
  if (token) {
    const payload = verifySessionToken(token);
    if (!payload) return { userId: "", sessionId: "", tokenInvalid: true };
    return { userId: payload.userId, sessionId: payload.sessionId, tokenValid: true };
  }
  return {
    userId: req.headers["x-user-id"],
    sessionId: req.headers["x-session-id"],
    tokenValid: false,
  };
}

function createKickRequest(userId, requesterSessionId, sessionLabel = "") {
  const current = pendingKickRequests.get(userId);
  const now = Date.now();
  if (current && current.requesterSessionId === requesterSessionId && current.expiresAt > now) {
    return current;
  }
  const request = {
    requesterSessionId,
    sessionLabel,
    requestedAt: now,
    expiresAt: now + Math.max(FORCE_KICK_GRACE_MS * 3, FORCE_KICK_GRACE_MS + 30_000),
  };
  pendingKickRequests.set(userId, request);
  return request;
}

function getActiveKickRequest(userId) {
  const request = pendingKickRequests.get(userId);
  if (!request) return null;
  if (request.expiresAt <= Date.now()) {
    pendingKickRequests.delete(userId);
    return null;
  }
  return request;
}

function getKickWaitSeconds(request) {
  if (!request) return 0;
  return Math.max(0, Math.ceil((request.requestedAt + FORCE_KICK_GRACE_MS - Date.now()) / 1000));
}

function resolveCorsOrigin(req) {
  const origin = String(req?.headers?.origin || "").trim();
  if (!origin) return "";
  return ALLOWED_ORIGINS.has(origin) ? origin : "";
}

function securityHeaders(res, contentType) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...(res.__corsOrigin ? {
      "Access-Control-Allow-Origin": res.__corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token, X-User-Id, X-Session-Id",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    } : {}),
  };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, securityHeaders(res, "application/json; charset=utf-8"));
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, securityHeaders(res, contentType));
  res.end(text);
}

function sendDownload(res, statusCode, data, filename, contentType = "application/octet-stream") {
  res.writeHead(statusCode, {
    ...securityHeaders(res, contentType),
    "Content-Disposition": `attachment; filename="${String(filename || "backup.sql").replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function sendError(res, statusCode, message, code = "") {
  sendJson(res, statusCode, { ok: false, error: message, ...(code ? { code } : {}) });
}

function ensureAllowedOrigin(req, res) {
  res.__corsOrigin = resolveCorsOrigin(req);
  if (req.headers.origin && !res.__corsOrigin) {
    logSecurityEvent("origin_denied", {
      origin: String(req.headers.origin || ""),
      path: String(req.url || ""),
      ip: getRequestIp(req),
    });
    sendError(res, 403, "Origin not allowed", "ORIGIN_NOT_ALLOWED");
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (Buffer.byteLength(data, "utf8") > BODY_LIMIT_BYTES) {
        const error = new Error("Body too large");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      const contentType = String(req.headers["content-type"] || "");
      if (contentType && !contentType.includes("application/json")) {
        reject(new Error("Unsupported Content-Type, expected application/json"));
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (err) {
        const error = new SyntaxError("Invalid JSON");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function emptyEditorState() {
  return {
    publishers: [],
    books: [],
    activities: [],
    selPubId: null,
    selBookId: null,
    selActId: null,
    lmsConfig: {
      scormVersion: "1.2",
      packageName: "E-Icerik Paketi",
      packageCode: "EIC-001",
      version: "1.0.0",
    },
  };
}

function isEditorState(payload) {
  return payload && typeof payload === "object" && (
    Object.prototype.hasOwnProperty.call(payload, "publishers") ||
    Object.prototype.hasOwnProperty.call(payload, "books") ||
    Object.prototype.hasOwnProperty.call(payload, "activities")
  );
}

function isWorkspaceMeta(payload) {
  return payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "currentProjectId");
}

function parseJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function scrubLmsConfig(config = null) {
  if (!config || typeof config !== "object") return { value: config, changed: false };
  let changed = false;
  const next = { ...config };
  SENSITIVE_LMS_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key) && next[key] !== "") {
      next[key] = "";
      changed = true;
    }
    if (next[key] === REDACTED_SECRET_VALUE) {
      next[key] = "";
      changed = true;
    }
  });
  return { value: next, changed };
}

function scrubEditorPayloadSecrets(payload = null) {
  if (!payload || typeof payload !== "object") return { value: payload, changed: false };
  let changed = false;
  const next = Array.isArray(payload) ? [...payload] : { ...payload };

  if (next.lmsConfig && typeof next.lmsConfig === "object") {
    const scrubbed = scrubLmsConfig(next.lmsConfig);
    if (scrubbed.changed) {
      next.lmsConfig = scrubbed.value;
      changed = true;
    }
  }

  if (Array.isArray(next.activities)) {
    next.activities = next.activities.map((activity) => {
      if (!activity?.lmsConfig || typeof activity.lmsConfig !== "object") return activity;
      const scrubbed = scrubLmsConfig(activity.lmsConfig);
      if (!scrubbed.changed) return activity;
      changed = true;
      return { ...activity, lmsConfig: scrubbed.value };
    });
  }

  if (next.workspaceVersion === 2 && next.users && typeof next.users === "object") {
    const scrubbedUsers = {};
    Object.entries(next.users).forEach(([userId, userPayload]) => {
      const scrubbed = scrubEditorPayloadSecrets(userPayload);
      scrubbedUsers[userId] = scrubbed.value;
      if (scrubbed.changed) changed = true;
    });
    next.users = scrubbedUsers;
  }

  return { value: next, changed };
}

function scrubStoredSecrets() {
  let scrubbedCount = 0;
  const appState = db.prepare("SELECT id, payload FROM app_state WHERE id = 1").get();
  if (appState?.payload) {
    const parsed = parseJson(appState.payload, null);
    const scrubbed = scrubEditorPayloadSecrets(parsed);
    if (scrubbed.changed) {
      db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(scrubbed.value), new Date().toISOString());
      scrubbedCount += 1;
    }
  }

  db.prepare("SELECT id, payload FROM projects").all().forEach((row) => {
    const parsed = parseJson(row.payload, null);
    const scrubbed = scrubEditorPayloadSecrets(parsed);
    if (scrubbed.changed) {
      db.prepare("UPDATE projects SET payload = ? WHERE id = ?").run(JSON.stringify(scrubbed.value), row.id);
      scrubbedCount += 1;
    }
  });

  db.prepare("SELECT id, payload FROM project_versions").all().forEach((row) => {
    const parsed = parseJson(row.payload, null);
    const scrubbed = scrubEditorPayloadSecrets(parsed);
    if (scrubbed.changed) {
      db.prepare("UPDATE project_versions SET payload = ? WHERE id = ?").run(JSON.stringify(scrubbed.value), row.id);
      scrubbedCount += 1;
    }
  });

  if (scrubbedCount) {
    console.log(`Guvenlik migrasyonu: ${scrubbedCount} kayittan LMS/xAPI gizli alanlari temizlendi.`);
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
}

function extractJsonObject(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const direct = parseJson(fenced, null);
  if (direct && typeof direct === "object") return direct;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return parseJson(fenced.slice(start, end + 1), null);
}

function parseDataUrl(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1] || "image/png", data: match[2] || "" };
}

function normalizePdfAiLayout(layout = {}, stageWidth = 1920, stageHeight = 1080) {
  const normalizeRect = (rect, minSize = 18) => {
    if (!rect || typeof rect !== "object") return null;
    const width = clampNumber(rect.width, minSize, stageWidth);
    const height = clampNumber(rect.height, minSize, stageHeight);
    const x = clampNumber(rect.x, 0, Math.max(0, stageWidth - width));
    const y = clampNumber(rect.y, 0, Math.max(0, stageHeight - height));
    return { x, y, width, height };
  };
  const anchors = Array.isArray(layout.questionAnchors)
    ? layout.questionAnchors
        .map((anchor, index) => {
          const width = clampNumber(anchor?.width, 24, stageWidth);
          const height = clampNumber(anchor?.height, 20, stageHeight);
          const x = clampNumber(anchor?.x, 0, Math.max(0, stageWidth - width));
          const y = clampNumber(anchor?.y, 0, Math.max(0, stageHeight - height));
          return {
            order: Math.max(1, Math.round(Number(anchor?.order || index + 1))),
            text: String(anchor?.text || "").trim(),
            x,
            y,
            width,
            height,
          };
        })
        .filter((anchor) => anchor.width >= 24 && anchor.height >= 20)
        .sort((a, b) => a.order - b.order || a.y - b.y || a.x - b.x)
    : [];

  return {
    kindHint: ["drag-drop", "selection", "sequence", "reading", "video"].includes(layout?.kindHint)
      ? layout.kindHint
      : "unknown",
    dragPoolRect: normalizeRect(layout?.dragPoolRect, 28),
    cleanupRects: Array.isArray(layout?.cleanupRects)
      ? layout.cleanupRects.map((rect) => normalizeRect(rect, 20)).filter(Boolean)
      : [],
    questionAnchors: anchors,
    draggableTerms: Array.isArray(layout?.draggableTerms)
      ? [...new Set(layout.draggableTerms.map((term) => String(term || "").trim()).filter(Boolean))]
      : [],
    answerTerms: Array.isArray(layout?.answerTerms)
      ? [...new Set(layout.answerTerms.map((term) => String(term || "").trim()).filter(Boolean))]
      : [],
    notes: String(layout?.notes || "").trim(),
  };
}

function buildPdfAiPrompt(payload = {}) {
  const rawText = String(payload.rawText || "").replace(/\s+/g, " ").trim().slice(0, 12000);
  return [
    `Sen Turkce egitim PDF sayfasindaki yerlestirme yapisini cikaransin.`,
    `Gorsel zaten ${payload.stageWidth || 1920}x${payload.stageHeight || 1080} sahne boyutuna gore hizalanmistir.`,
    `Sadece gecerli JSON don. Aciklama, markdown veya kod blogu yazma.`,
    `Beklenen JSON formati:`,
    `{`,
    `  "kindHint": "drag-drop" | "selection" | "sequence" | "reading" | "video" | "unknown",`,
    `  "dragPoolRect": {"x":0,"y":0,"width":0,"height":0} veya null,`,
    `  "questionAnchors": [{"order":1,"text":"...","x":0,"y":0,"width":0,"height":0}],`,
    `  "cleanupRects": [{"x":0,"y":0,"width":0,"height":0,"reason":"drag-pool|answer-key|note"}],`,
    `  "draggableTerms": ["..."],`,
    `  "answerTerms": ["..."],`,
    `  "notes": "kisa not"`,
    `}`,
    `Kurallar:`,
    `- Koordinatlar sol-ust origin ile verilecek.`,
    `- questionAnchors sadece numarali soru satirlari/blank satirlari olsun; sagdaki kelime havuzunu dahil etme.`,
    `- dragPoolRect sadece 'Suruklenebilir Ogeler' listesini kapsasin.`,
    `- cleanupRects soru metnini silmesin; sadece sag havuz, dogru eslestirme alani ve ogretmen notlari gibi temizlenecek bolgeleri kapsasin.`,
    `- Emin degilsen null veya bos dizi don; uydurma yapma.`,
    rawText ? `Ham metin yardimi: ${rawText}` : "",
  ].filter(Boolean).join("\n");
}

async function requestPdfAiLayout() {
  return {
    ok: true,
    enabled: false,
    provider: PDF_ANALYSIS_MODE,
    layout: null,
    warning: "Cloud baglantili PDF analizi kaldirildi; cevrimdisi analiz kullaniliyor.",
  };
}

function projectSummaryFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id || DEFAULT_USER_ID,
    name: row.name,
    draftUpdatedAt: row.saved_at,
    createdAt: row.created_at || row.saved_at,
    publishedVersionId: row.published_version_id || null,
  };
}

function getAppState() {
  const row = db.prepare("SELECT payload, updated_at FROM app_state WHERE id = 1").get();
  if (!row) return { payload: null, updatedAt: null };
  return { payload: parseJson(row.payload), updatedAt: row.updated_at };
}

function resolveFixedUser(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  const row = db.prepare("SELECT id, name, password_hash, password_salt, active FROM editor_users WHERE id = ?").get(id);
  if (!row || Number(row.active) !== 1) return null;
  return row ? {
    id: row.id,
    name: row.name,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
  } : null;
}

function normalizeAdminUserId(userId) {
  const id = String(userId || "").trim();
  return /^[A-Za-z0-9_.@-]{2,64}$/.test(id) ? id : "";
}

function normalizeUserName(name, fallback = "") {
  const value = String(name ?? "").trim();
  return (value || fallback || "Kullanici").slice(0, 120);
}

function getEditorUserRecord(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  const row = db.prepare(`
    SELECT id, name, active, created_at, updated_at
    FROM editor_users
    WHERE id = ?
  `).get(id);
  return row ? {
    id: row.id,
    name: row.name,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null;
}

function listEditorUsers() {
  return db.prepare(`
    SELECT id, name, active, created_at, updated_at
    FROM editor_users
    ORDER BY id COLLATE NOCASE
  `).all().map(row => ({
    id: row.id,
    name: row.name,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function revokeUserSessions(userId) {
  db.prepare("DELETE FROM user_sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM book_locks WHERE user_id = ?").run(userId);
  pendingKickRequests.delete(userId);
}

function constantTimeStringEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAdminRequestAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  return constantTimeStringEquals(req.headers["x-admin-token"], ADMIN_TOKEN);
}

function decodePathSegment(segment) {
  try {
    return decodeURIComponent(String(segment || ""));
  } catch {
    return "";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function cleanupExpiredSessions() {
  const threshold = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  db.prepare("DELETE FROM user_sessions WHERE last_seen_at < ?").run(threshold);
  db.prepare("DELETE FROM book_locks WHERE last_seen_at < ?").run(threshold);
  [...pendingKickRequests.keys()].forEach((userId) => {
    if (!db.prepare("SELECT 1 FROM user_sessions WHERE user_id = ? LIMIT 1").get(userId)) {
      pendingKickRequests.delete(userId);
    }
  });
}

function getUserSession(userId) {
  cleanupExpiredSessions();
  return db.prepare(`
    SELECT user_id, session_id, session_label, locked_at, last_seen_at
    FROM user_sessions
    WHERE user_id = ?
  `).get(userId) || null;
}

function buildSessionPayload(row) {
  if (!row) return null;
  const user = resolveFixedUser(row.user_id);
  return {
    userId: row.user_id,
    userName: user?.name || row.user_id,
    sessionId: row.session_id,
    sessionLabel: row.session_label || "",
    lockedAt: row.locked_at,
    lastSeenAt: row.last_seen_at,
  };
}

// Seviye 1 isbirligi (presence): kim online + hangi kitabi kim duzenliyor.
// Mevcut user_sessions/book_locks tablolarindan okunur; sema degismez.
function buildPresencePayload() {
  cleanupExpiredSessions();
  const users = db
    .prepare(
      `SELECT user_id, session_id, session_label, last_seen_at
       FROM user_sessions ORDER BY last_seen_at DESC`
    )
    .all()
    .map((row) => {
      const u = resolveFixedUser(row.user_id);
      return {
        userId: row.user_id,
        userName: u?.name || row.user_id,
        sessionId: row.session_id,
        lastSeenAt: row.last_seen_at,
      };
    });
  const locks = db
    .prepare(
      `SELECT project_id, book_id, user_id, session_id, locked_at
       FROM book_locks ORDER BY locked_at DESC`
    )
    .all()
    .map((row) => {
      const u = resolveFixedUser(row.user_id);
      return {
        projectId: row.project_id,
        bookId: row.book_id,
        userId: row.user_id,
        userName: u?.name || row.user_id,
        sessionId: row.session_id,
      };
    });
  return { users, locks };
}

function claimUserSession(userId, sessionId, sessionLabel = "") {
  const cleanSessionId = String(sessionId || "").trim();
  if (!cleanSessionId) {
    throw new Error("Session id required");
  }

  cleanupExpiredSessions();
  const current = getUserSession(userId);
  if (current && current.session_id !== cleanSessionId) {
    return {
      ok: false,
      reason: "locked",
      session: buildSessionPayload(current),
    };
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO user_sessions (user_id, session_id, session_label, locked_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      session_id = excluded.session_id,
      session_label = excluded.session_label,
      locked_at = CASE
        WHEN user_sessions.session_id = excluded.session_id THEN user_sessions.locked_at
        ELSE excluded.locked_at
      END,
      last_seen_at = excluded.last_seen_at
  `).run(userId, cleanSessionId, String(sessionLabel || "").trim(), timestamp, timestamp);

  return {
    ok: true,
    session: buildSessionPayload(getUserSession(userId)),
  };
}

function touchUserSession(userId, sessionId) {
  const current = getUserSession(userId);
  const cleanSessionId = String(sessionId || "").trim();
  if (!current) {
    return { ok: false, reason: "missing" };
  }
  if (current.session_id !== cleanSessionId) {
    return {
      ok: false,
      reason: "locked",
      session: buildSessionPayload(current),
    };
  }

  const timestamp = nowIso();
  db.prepare("UPDATE user_sessions SET last_seen_at = ? WHERE user_id = ? AND session_id = ?").run(timestamp, userId, cleanSessionId);
  return {
    ok: true,
    session: buildSessionPayload(getUserSession(userId)),
  };
}

function releaseUserSession(userId, sessionId) {
  db.prepare("DELETE FROM user_sessions WHERE user_id = ? AND session_id = ?").run(userId, String(sessionId || "").trim());
  db.prepare("DELETE FROM book_locks WHERE user_id = ? AND session_id = ?").run(userId, String(sessionId || "").trim());
  pendingKickRequests.delete(userId);
}

function buildBookLockPayload(row) {
  if (!row) return null;
  const user = resolveFixedUser(row.user_id);
  return {
    projectId: row.project_id,
    bookId: row.book_id,
    userId: row.user_id,
    userName: user?.name || row.user_id,
    sessionId: row.session_id,
    sessionLabel: row.session_label || "",
    lockedAt: row.locked_at,
    lastSeenAt: row.last_seen_at,
  };
}

function getBookLock(projectId, bookId) {
  cleanupExpiredSessions();
  return db.prepare(`
    SELECT project_id, book_id, user_id, session_id, session_label, locked_at, last_seen_at
    FROM book_locks
    WHERE project_id = ? AND book_id = ?
  `).get(projectId, bookId) || null;
}

function claimBookLock(userId, sessionId, projectId, bookId, sessionLabel = "") {
  const cleanProjectId = String(projectId || "").trim();
  const cleanBookId = String(bookId || "").trim();
  const cleanSessionId = String(sessionId || "").trim();
  if (!cleanProjectId || !cleanBookId || !cleanSessionId) {
    throw new Error("Book lock bilgisi eksik");
  }

  const current = getBookLock(cleanProjectId, cleanBookId);
  if (current && current.session_id !== cleanSessionId) {
    return { ok: false, reason: "locked", lock: buildBookLockPayload(current) };
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO book_locks (project_id, book_id, user_id, session_id, session_label, locked_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, book_id) DO UPDATE SET
      user_id = excluded.user_id,
      session_id = excluded.session_id,
      session_label = excluded.session_label,
      locked_at = CASE
        WHEN book_locks.session_id = excluded.session_id THEN book_locks.locked_at
        ELSE excluded.locked_at
      END,
      last_seen_at = excluded.last_seen_at
  `).run(cleanProjectId, cleanBookId, userId, cleanSessionId, String(sessionLabel || "").trim(), timestamp, timestamp);

  return { ok: true, lock: buildBookLockPayload(getBookLock(cleanProjectId, cleanBookId)) };
}

function touchBookLocksBySession(userId, sessionId) {
  const timestamp = nowIso();
  db.prepare("UPDATE book_locks SET last_seen_at = ? WHERE user_id = ? AND session_id = ?").run(timestamp, userId, String(sessionId || "").trim());
}

function ensureBookLockOwner(userId, sessionId, projectId, bookId) {
  const current = getBookLock(projectId, bookId);
  const cleanSessionId = String(sessionId || "").trim();
  if (!current) {
    return { ok: false, reason: "missing" };
  }
  if (current.session_id !== cleanSessionId || current.user_id !== userId) {
    return { ok: false, reason: "locked", lock: buildBookLockPayload(current) };
  }
  const timestamp = nowIso();
  db.prepare("UPDATE book_locks SET last_seen_at = ? WHERE project_id = ? AND book_id = ?").run(timestamp, projectId, bookId);
  return { ok: true, lock: buildBookLockPayload(getBookLock(projectId, bookId)) };
}

function releaseBookLock(userId, sessionId, projectId, bookId) {
  db.prepare(`
    DELETE FROM book_locks
    WHERE project_id = ? AND book_id = ? AND user_id = ? AND session_id = ?
  `).run(String(projectId || "").trim(), String(bookId || "").trim(), userId, String(sessionId || "").trim());
}

function sanitizeWorkspaceRegistry(payload) {
  if (payload && typeof payload === "object" && payload.workspaceVersion === 2 && payload.users && typeof payload.users === "object") {
    return Object.entries(payload.users).reduce((acc, [userId, userPayload]) => {
      acc[userId] = {
        currentProjectId: String(userPayload?.currentProjectId || "").trim(),
      };
      return acc;
    }, {});
  }

  if (isWorkspaceMeta(payload)) {
    return {
      [DEFAULT_USER_ID]: {
        currentProjectId: String(payload.currentProjectId || "").trim(),
      },
    };
  }

  return {};
}

function saveWorkspaceRegistry(users) {
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(JSON.stringify({ workspaceVersion: 2, users }), updatedAt);
  return updatedAt;
}

function saveWorkspaceMeta(userId, currentProjectId) {
  const appState = getAppState();
  const users = sanitizeWorkspaceRegistry(appState.payload);
  users[userId] = {
    currentProjectId: String(currentProjectId || "").trim(),
  };
  return saveWorkspaceRegistry(users);
}

function getWorkspaceMeta(userId) {
  const appState = getAppState();
  const users = sanitizeWorkspaceRegistry(appState.payload);
  return {
    currentProjectId: String(users[userId]?.currentProjectId || "").trim(),
    updatedAt: appState.updatedAt,
    legacyState: isEditorState(appState.payload) ? appState.payload : null,
  };
}

function listProjects(userId) {
  return db
    .prepare("SELECT id, user_id, name, saved_at, created_at, published_version_id FROM projects WHERE user_id = ? ORDER BY saved_at DESC")
    .all(userId)
    .map(projectSummaryFromRow);
}

function getProject(projectId, userId) {
  const row = db
    .prepare("SELECT id, user_id, name, payload, saved_at, created_at, published_version_id FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || DEFAULT_USER_ID,
    name: row.name,
    state: parseJson(row.payload, emptyEditorState()) || emptyEditorState(),
    draftUpdatedAt: row.saved_at,
    createdAt: row.created_at || row.saved_at,
    publishedVersionId: row.published_version_id || null,
  };
}

function getProjectSummary(projectId, userId) {
  const project = getProject(projectId, userId);
  return project ? {
    id: project.id,
    userId: project.userId,
    name: project.name,
    draftUpdatedAt: project.draftUpdatedAt,
    createdAt: project.createdAt,
    publishedVersionId: project.publishedVersionId,
  } : null;
}

function projectExists(projectId, userId) {
  return Boolean(db.prepare("SELECT 1 FROM projects WHERE id = ? AND user_id = ? LIMIT 1").get(projectId, userId));
}

function createProject(userId, name, state) {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const projectName = String(name || "").trim() || "Yeni Proje";
  db.prepare(`
    INSERT INTO projects (id, user_id, name, payload, saved_at, created_at, published_version_id)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
  `).run(id, userId, projectName, JSON.stringify(state || emptyEditorState()), timestamp, timestamp);
  return getProject(id, userId);
}

function saveProjectDraft(userId, projectId, state, name = null) {
  const project = getProject(projectId, userId);
  if (!project) throw new Error("Project not found");
  const timestamp = new Date().toISOString();
  const projectName = name && String(name).trim() ? String(name).trim() : project.name;
  db.prepare(`
    UPDATE projects
    SET name = ?, payload = ?, saved_at = ?
    WHERE id = ? AND user_id = ?
  `).run(projectName, JSON.stringify(state || {}), timestamp, projectId, userId);
  return getProject(projectId, userId);
}

function listProjectVersions(userId, projectId) {
  if (!projectExists(projectId, userId)) return [];
  return db.prepare(`
    SELECT id, project_id, version_no, label, created_at, is_published
    FROM project_versions
    WHERE project_id = ?
    ORDER BY version_no DESC
  `).all(projectId).map(row => ({
    id: row.id,
    projectId: row.project_id,
    versionNo: row.version_no,
    label: row.label,
    createdAt: row.created_at,
    isPublished: Boolean(row.is_published),
  }));
}

function createProjectVersion(userId, projectId, label, publish = false, stateOverride = null) {
  const project = getProject(projectId, userId);
  if (!project) throw new Error("Project not found");

  const maxRow = db.prepare("SELECT COALESCE(MAX(version_no), 0) AS maxVersion FROM project_versions WHERE project_id = ?").get(projectId);
  const versionNo = Number(maxRow?.maxVersion || 0) + 1;
  const versionId = randomUUID();
  const createdAt = new Date().toISOString();
  const versionLabel = String(label || "").trim() || `Sürüm ${versionNo}`;
  const payload = stateOverride ?? project.state;

  if (publish) {
    db.prepare("UPDATE project_versions SET is_published = 0 WHERE project_id = ?").run(projectId);
  }

  db.prepare(`
    INSERT INTO project_versions (id, project_id, version_no, label, payload, created_at, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(versionId, projectId, versionNo, versionLabel, JSON.stringify(payload), createdAt, publish ? 1 : 0);

  if (publish) {
    db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ? AND user_id = ?").run(versionId, projectId, userId);
  }

  return {
    id: versionId,
    projectId,
    versionNo,
    label: versionLabel,
    createdAt,
    isPublished: publish,
  };
}

function restoreProjectVersion(userId, projectId, versionId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  const row = db.prepare("SELECT payload FROM project_versions WHERE id = ? AND project_id = ?").get(versionId, projectId);
  if (!row) throw new Error("Version not found");
  const savedAt = new Date().toISOString();
  db.prepare("UPDATE projects SET payload = ?, saved_at = ? WHERE id = ? AND user_id = ?").run(row.payload, savedAt, projectId, userId);
}

function publishProjectVersion(userId, projectId, versionId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  const row = db.prepare("SELECT id FROM project_versions WHERE id = ? AND project_id = ?").get(versionId, projectId);
  if (!row) throw new Error("Version not found");
  db.prepare("UPDATE project_versions SET is_published = 0 WHERE project_id = ?").run(projectId);
  db.prepare("UPDATE project_versions SET is_published = 1 WHERE id = ?").run(versionId);
  db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ? AND user_id = ?").run(versionId, projectId, userId);
}

function deleteProject(userId, projectId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  db.prepare("DELETE FROM project_versions WHERE project_id = ?").run(projectId);
  db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(projectId, userId);
  db.prepare("DELETE FROM book_locks WHERE project_id = ?").run(projectId);
}

function deleteProjectVersion(userId, projectId, versionId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  db.prepare("DELETE FROM project_versions WHERE id = ? AND project_id = ?").run(versionId, projectId);
  const remainingPublished = db.prepare("SELECT id FROM project_versions WHERE project_id = ? AND is_published = 1 LIMIT 1").get(projectId);
  db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ? AND user_id = ?").run(remainingPublished?.id || null, projectId, userId);
}

function duplicateProject(userId, projectId) {
  const project = getProject(projectId, userId);
  if (!project) throw new Error("Project not found");
  const duplicateName = `${project.name} Kopya`;
  return createProject(userId, duplicateName, project.state);
}

function buildWorkspace(userId, currentProjectId) {
  const currentProject = getProject(currentProjectId, userId);
  if (!currentProject) throw new Error("Current project not found");
  return {
    currentProject: getProjectSummary(currentProjectId, userId),
    projects: listProjects(userId),
    versions: listProjectVersions(userId, currentProjectId),
    state: currentProject.state,
    updatedAt: currentProject.draftUpdatedAt,
  };
}

function ensureWorkspace(userId) {
  const workspaceMeta = getWorkspaceMeta(userId);

  if (workspaceMeta.legacyState) {
    const project = createProject(userId, "Varsayilan Proje", workspaceMeta.legacyState);
    saveWorkspaceMeta(userId, project.id);
    return buildWorkspace(userId, project.id);
  }

  const currentProjectId = workspaceMeta.currentProjectId;
  if (currentProjectId && projectExists(currentProjectId, userId)) {
    return buildWorkspace(userId, currentProjectId);
  }

  const projects = listProjects(userId);
  if (projects.length > 0) {
    saveWorkspaceMeta(userId, projects[0].id);
    return buildWorkspace(userId, projects[0].id);
  }

  const project = createProject(userId, "Varsayilan Proje", emptyEditorState());
  saveWorkspaceMeta(userId, project.id);
  return buildWorkspace(userId, project.id);
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requestPath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    sendError(res, 400, "Invalid path");
    return true;
  }
  const safePath = path.normalize(decodedPath).replace(/^[/\\]+/, "");
  const filePath = path.resolve(BUILD_DIR, safePath);
  const buildRoot = path.resolve(BUILD_DIR);

  if (filePath !== buildRoot && !filePath.startsWith(`${buildRoot}${path.sep}`)) {
    sendError(res, 403, "Forbidden");
    return true;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".js" ? "application/javascript; charset=utf-8" :
      ext === ".css" ? "text/css; charset=utf-8" :
      ext === ".json" ? "application/json; charset=utf-8" :
      ext === ".svg" ? "image/svg+xml" :
      "application/octet-stream";

    sendText(res, 200, fs.readFileSync(filePath), contentType);
    return true;
  }

  const fallbackFile = path.join(BUILD_DIR, "index.html");
  if (fs.existsSync(fallbackFile)) {
    sendText(res, 200, fs.readFileSync(fallbackFile), "text/html; charset=utf-8");
    return true;
  }

  return false;
}

async function handleAdminRequest(req, res, url) {
  if (!ADMIN_TOKEN) {
    logSecurityEvent("admin_disabled_request", { path: url.pathname, ip: getRequestIp(req) });
    sendJson(res, 503, { ok: false, code: "ADMIN_DISABLED", error: "Admin API devre disi" });
    return;
  }

  if (!isAdminRequestAuthorized(req)) {
    logSecurityEvent("admin_auth_failed", { path: url.pathname, ip: getRequestIp(req) });
    sendJson(res, 403, { ok: false, code: "ADMIN_FORBIDDEN", error: "Admin yetkisi gerekli" });
    return;
  }

  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    sendJson(res, 200, { ok: true, users: listEditorUsers() });
    return;
  }

  if (url.pathname === "/api/admin/security-events" && req.method === "GET") {
    const limit = Number(url.searchParams.get("limit") || 100);
    const filters = {
      type: url.searchParams.get("type") || "",
      userId: url.searchParams.get("userId") || "",
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
    };
    sendJson(res, 200, { ok: true, events: listSecurityEvents(limit, filters) });
    return;
  }

  if (url.pathname === "/api/admin/backup" && req.method === "GET") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    logSecurityEvent("admin_backup_downloaded", { ip: getRequestIp(req) });
    sendDownload(
      res,
      200,
      buildSqliteBackup(),
      `eicerik-sql-backup-${stamp}.sql`,
      "application/sql; charset=utf-8"
    );
    return;
  }

  if (url.pathname === "/api/admin/users" && req.method === "POST") {
    const body = await readBody(req);
    const userId = normalizeAdminUserId(body.id);
    const password = String(body.password || "");
    if (!userId) {
      sendJson(res, 400, { ok: false, code: "INVALID_USER_ID", error: "Gecerli bir kullanici id girin" });
      return;
    }
    if (password.length < 4) {
      sendJson(res, 400, { ok: false, code: "INVALID_PASSWORD", error: "Sifre en az 4 karakter olmali" });
      return;
    }
    if (getEditorUserRecord(userId)) {
      sendJson(res, 409, { ok: false, code: "USER_EXISTS", error: "Kullanici zaten var" });
      return;
    }

    const now = nowIso();
    const passwordRecord = createPasswordRecord(password);
    const active = body.active === false ? 0 : 1;
    const name = normalizeUserName(body.name, userId);
    db.prepare(`
      INSERT INTO editor_users (id, name, password_hash, password_salt, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, passwordRecord.hash, passwordRecord.salt, active, now, now);
    logSecurityEvent("admin_user_created", { userId, active: Boolean(active), ip: getRequestIp(req) });
    sendJson(res, 201, { ok: true, user: getEditorUserRecord(userId) });
    return;
  }

  const passwordMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
  if (passwordMatch && req.method === "PUT") {
    const userId = normalizeAdminUserId(decodePathSegment(passwordMatch[1]));
    const existing = getEditorUserRecord(userId);
    const body = await readBody(req);
    const password = String(body.password || "");
    if (!existing) {
      sendJson(res, 404, { ok: false, code: "USER_NOT_FOUND", error: "Kullanici bulunamadi" });
      return;
    }
    if (password.length < 4) {
      sendJson(res, 400, { ok: false, code: "INVALID_PASSWORD", error: "Sifre en az 4 karakter olmali" });
      return;
    }
    const passwordRecord = createPasswordRecord(password);
    db.prepare(`
      UPDATE editor_users
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(passwordRecord.hash, passwordRecord.salt, nowIso(), userId);
    revokeUserSessions(userId);
    logSecurityEvent("admin_password_changed", { userId, ip: getRequestIp(req) });
    sendJson(res, 200, { ok: true, user: getEditorUserRecord(userId) });
    return;
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && req.method === "PATCH") {
    const userId = normalizeAdminUserId(decodePathSegment(userMatch[1]));
    const existing = getEditorUserRecord(userId);
    if (!existing) {
      sendJson(res, 404, { ok: false, code: "USER_NOT_FOUND", error: "Kullanici bulunamadi" });
      return;
    }
    const body = await readBody(req);
    const nextName = Object.hasOwn(body, "name") ? normalizeUserName(body.name, existing.name) : existing.name;
    const nextActive = Object.hasOwn(body, "active") ? (body.active === false ? 0 : 1) : (existing.active ? 1 : 0);
    db.prepare(`
      UPDATE editor_users
      SET name = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(nextName, nextActive, nowIso(), userId);
    if (!nextActive) revokeUserSessions(userId);
    logSecurityEvent("admin_user_updated", { userId, active: Boolean(nextActive), ip: getRequestIp(req) });
    sendJson(res, 200, { ok: true, user: getEditorUserRecord(userId) });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Admin endpoint not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!ensureAllowedOrigin(req, res)) return;

    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/health") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "Sat, 26 Jul 1997 05:00:00 GMT");

      const requireDatabase = ["1", "true", "yes"].includes(
        String(url.searchParams.get("requireDatabase") || "").toLowerCase()
      );
      if (!requireDatabase) {
        sendJson(res, 200, { ok: true, api: "ready", databaseRequired: false });
        return;
      }
      try {
        db.prepare("SELECT 1 AS ok").get();
        sendJson(res, 200, {
          ok: true,
          api: "ready",
          database: "ready",
          databaseRequired: true,
        });
      } catch {
        sendJson(res, 503, {
          ok: false,
          api: "ready",
          database: "unavailable",
          databaseRequired: true,
          code: "db_connection_failed",
          error: "Database connection failed",
        });
      }
      return;
    }

    if (url.pathname === "/api/auth/status" && req.method === "POST") {
      const body = await readBody(req);
      const requestSession = resolveRequestSession(req);
      if (requestSession.tokenInvalid) {
        sendJson(res, 401, { ok: false, code: "INVALID_SESSION_TOKEN", error: "Oturum token gecersiz" });
        return;
      }
      const userId = String(body.userId || requestSession.userId || "").trim();
      const sessionId = String(body.sessionId || requestSession.sessionId || "").trim();
      const user = resolveFixedUser(userId);
      if (!user) {
        sendJson(res, 404, { ok: false, error: "Kullanici bulunamadi" });
        return;
      }
      const session = getUserSession(user.id);
      if (!session) {
        sendJson(res, 200, { ok: true, locked: false, session: null });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        locked: session.session_id !== sessionId,
        session: buildSessionPayload(session),
      });
      return;
    }

    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      const body = await readBody(req);
      const userId = String(body.userId || "").trim();
      const password = String(body.password || "");
      const sessionId = String(body.sessionId || "").trim();
      const sessionLabel = String(body.sessionLabel || "").trim();
      const force = body.force === true;
      const rateStatus = getLoginRateStatus(req, userId);
      if (rateStatus.limited) {
        logSecurityEvent("login_rate_limited", { userId, ip: getRequestIp(req), waitSeconds: rateStatus.waitSeconds });
        sendJson(res, 429, {
          ok: false,
          code: "LOGIN_RATE_LIMITED",
          error: `Cok fazla hatali giris denemesi. ${rateStatus.waitSeconds} saniye sonra tekrar deneyin.`,
          waitSeconds: rateStatus.waitSeconds,
        });
        return;
      }
      const user = resolveFixedUser(userId);
      if (!user || !verifyPassword(user, password)) {
        const waitSeconds = recordFailedLogin(rateStatus.key);
        logSecurityEvent(waitSeconds ? "login_rate_limited" : "login_failed", {
          userId,
          ip: getRequestIp(req),
          ...(waitSeconds ? { waitSeconds } : {}),
        });
        sendJson(res, waitSeconds ? 429 : 401, {
          ok: false,
          code: waitSeconds ? "LOGIN_RATE_LIMITED" : "INVALID_LOGIN",
          error: waitSeconds
            ? `Cok fazla hatali giris denemesi. ${waitSeconds} saniye sonra tekrar deneyin.`
            : "Kullanici bilgileri hatali",
          ...(waitSeconds ? { waitSeconds } : {}),
        });
        return;
      }

      clearLoginFailures(req, user.id);
      const currentSession = getUserSession(user.id);
      if (currentSession && currentSession.session_id !== sessionId) {
        const kickRequest = createKickRequest(user.id, sessionId, sessionLabel);
        const waitSeconds = getKickWaitSeconds(kickRequest);
        if (!force || waitSeconds > 0) {
          logSecurityEvent("session_kick_requested", {
            userId: user.id,
            ip: getRequestIp(req),
            waitSeconds,
          });
          sendJson(res, 409, {
            ok: false,
            code: "USER_LOCKED",
            error: force && waitSeconds > 0
              ? `Cikis istegi gonderildi. ${waitSeconds} saniye sonra zorla devralabilirsiniz.`
              : "Bu kullanici baska bir cihazda acik. Diger oturuma cikis istegi gonderildi.",
            session: buildSessionPayload(currentSession),
            kickPending: true,
            waitSeconds,
          });
          return;
        }
        releaseUserSession(user.id, currentSession.session_id);
        logSecurityEvent("session_force_takeover", { userId: user.id, ip: getRequestIp(req) });
      }

      const claimed = claimUserSession(user.id, sessionId, sessionLabel);
      if (!claimed.ok) {
        const kickRequest = createKickRequest(user.id, sessionId, sessionLabel);
        logSecurityEvent("session_kick_requested", {
          userId: user.id,
          ip: getRequestIp(req),
          waitSeconds: getKickWaitSeconds(kickRequest),
        });
        sendJson(res, 409, {
          ok: false,
          code: "USER_LOCKED",
          error: "Bu kullanici baska bir cihazda acik. Diger oturuma cikis istegi gonderildi.",
          session: claimed.session,
          kickPending: true,
          waitSeconds: getKickWaitSeconds(kickRequest),
        });
        return;
      }
      pendingKickRequests.delete(user.id);
      const sessionToken = createSessionToken(user.id, sessionId);
      logSecurityEvent("login_success", { userId: user.id, ip: getRequestIp(req) });
      sendJson(res, 200, {
        ok: true,
        user: { id: user.id, name: user.name },
        session: claimed.session,
        token: sessionToken.token,
        tokenExpiresAt: sessionToken.expiresAt,
      });
      return;
    }

    if (url.pathname === "/api/auth/heartbeat" && req.method === "POST") {
      const body = await readBody(req);
      const requestSession = resolveRequestSession(req);
      if (requestSession.tokenInvalid) {
        sendJson(res, 401, { ok: false, code: "INVALID_SESSION_TOKEN", error: "Oturum token gecersiz" });
        return;
      }
      const userId = String(body.userId || requestSession.userId || "").trim();
      const sessionId = String(body.sessionId || requestSession.sessionId || "").trim();
      const user = resolveFixedUser(userId);
      if (!user) {
        sendJson(res, 404, { ok: false, error: "Kullanici bulunamadi" });
        return;
      }
      const touched = touchUserSession(user.id, sessionId);
      if (!touched.ok) {
        sendJson(res, 409, {
          ok: false,
          code: touched.reason === "missing" ? "SESSION_EXPIRED" : "USER_LOCKED",
          error: touched.reason === "missing"
            ? "Oturum suresi doldu. Yeniden giris yapin."
            : "Bu kullanici baska bir cihazda aktif gorunuyor.",
          session: touched.session || null,
        });
        return;
      }
      touchBookLocksBySession(user.id, sessionId);
      const kickRequest = getActiveKickRequest(user.id);
      const kickRequested = !!kickRequest && kickRequest.requesterSessionId !== sessionId;
      sendJson(res, 200, {
        ok: true,
        session: touched.session,
        kickRequested,
        ...(kickRequested ? { waitSeconds: getKickWaitSeconds(kickRequest) } : {}),
        presence: buildPresencePayload(),
      });
      return;
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const body = await readBody(req);
      const requestSession = resolveRequestSession(req);
      if (requestSession.tokenInvalid) {
        sendJson(res, 401, { ok: false, code: "INVALID_SESSION_TOKEN", error: "Oturum token gecersiz" });
        return;
      }
      const userId = String(body.userId || requestSession.userId || "").trim();
      const sessionId = String(body.sessionId || requestSession.sessionId || "").trim();
      const user = resolveFixedUser(userId);
      if (user && sessionId) {
        releaseUserSession(user.id, sessionId);
        logSecurityEvent("logout", { userId: user.id, ip: getRequestIp(req) });
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/api/admin/")) {
      await handleAdminRequest(req, res, url);
      return;
    }

    let currentUser = null;
    let currentSessionId = "";
    if (url.pathname.startsWith("/api/")) {
      const requestSession = resolveRequestSession(req);
      currentUser = resolveFixedUser(requestSession.userId);
      currentSessionId = String(requestSession.sessionId || "").trim();
      if (requestSession.tokenInvalid) {
        sendJson(res, 401, { ok: false, code: "INVALID_SESSION_TOKEN", error: "Oturum token gecersiz" });
        return;
      }
      if (!currentUser || !currentSessionId) {
        sendJson(res, 401, { ok: false, error: "Kullanici secimi gerekli" });
        return;
      }
      const touched = touchUserSession(currentUser.id, currentSessionId);
      if (!touched.ok) {
        sendJson(res, 409, {
          ok: false,
          code: touched.reason === "missing" ? "SESSION_EXPIRED" : "USER_LOCKED",
          error: touched.reason === "missing"
            ? "Oturum suresi doldu. Yeniden giris yapin."
            : "Bu kullanici baska bir cihazda aktif.",
          session: touched.session || null,
        });
        return;
      }
    }

    if (url.pathname === "/api/pdf-layout/analyze" && req.method === "POST") {
      const body = await readBody(req);
      const result = await requestPdfAiLayout(body || {});
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === "/api/workspace" && req.method === "GET") {
      sendJson(res, 200, ensureWorkspace(currentUser.id));
      return;
    }

    if (url.pathname === "/api/workspace/current-project" && req.method === "PUT") {
      const body = await readBody(req);
      const projectId = String(body.projectId || "").trim();
      if (!projectId || !projectExists(projectId, currentUser.id)) {
        sendJson(res, 404, { ok: false, error: "Project not found" });
        return;
      }
      saveWorkspaceMeta(currentUser.id, projectId);
      sendJson(res, 200, ensureWorkspace(currentUser.id));
      return;
    }

    if (url.pathname === "/api/state" && req.method === "GET") {
      const workspace = ensureWorkspace(currentUser.id);
      sendJson(res, 200, {
        state: workspace.state,
        updatedAt: workspace.updatedAt,
        projectId: workspace.currentProject?.id || null,
        projectName: workspace.currentProject?.name || null,
      });
      return;
    }

    if (url.pathname === "/api/state" && req.method === "PUT") {
      const workspace = ensureWorkspace(currentUser.id);
      const body = await readBody(req);
      const projectId = String(body.projectId || workspace.currentProject?.id || "").trim();
      if (!projectId || !projectExists(projectId, currentUser.id)) {
        sendJson(res, 404, { ok: false, error: "Project not found" });
        return;
      }
      const project = saveProjectDraft(currentUser.id, projectId, body.state || {}, body.projectName);
      saveWorkspaceMeta(currentUser.id, projectId);
      sendJson(res, 200, { ok: true, updatedAt: project.draftUpdatedAt, project });
      return;
    }

    if (url.pathname === "/api/projects" && req.method === "GET") {
      sendJson(res, 200, { projects: listProjects(currentUser.id) });
      return;
    }

    if (url.pathname === "/api/projects" && req.method === "POST") {
      const body = await readBody(req);
      const project = createProject(currentUser.id, body.name, body.state || emptyEditorState());
      saveWorkspaceMeta(currentUser.id, project.id);
      sendJson(res, 200, ensureWorkspace(currentUser.id));
      return;
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && req.method === "GET") {
      const projectId = decodeURIComponent(projectMatch[1]);
      const project = getProject(projectId, currentUser.id);
      if (!project) {
        sendJson(res, 404, { ok: false, error: "Project not found" });
        return;
      }
      sendJson(res, 200, { project, versions: listProjectVersions(currentUser.id, projectId) });
      return;
    }

    if (projectMatch && req.method === "DELETE") {
      const projectId = decodeURIComponent(projectMatch[1]);
      deleteProject(currentUser.id, projectId);
      sendJson(res, 200, { ok: true, ...ensureWorkspace(currentUser.id) });
      return;
    }

    const draftMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/draft$/);
    if (draftMatch && req.method === "PUT") {
      const projectId = decodeURIComponent(draftMatch[1]);
      const body = await readBody(req);
      const lockBookId = String(body.lockBookId || "").trim();
      if (lockBookId) {
        const bookLock = ensureBookLockOwner(currentUser.id, currentSessionId, projectId, lockBookId);
        if (!bookLock.ok) {
          sendJson(res, 409, {
            ok: false,
            code: bookLock.reason === "missing" ? "BOOK_LOCK_REQUIRED" : "BOOK_LOCKED",
            error: bookLock.reason === "missing"
              ? "Bu kitabi duzenlemek icin once kitabi kilitle."
              : "Bu kitap baska bir kullanici tarafindan duzenleniyor.",
            lock: bookLock.lock || null,
          });
          return;
        }
      }
      const project = saveProjectDraft(currentUser.id, projectId, body.state || {}, body.name);
      if (body.setCurrent !== false) {
        saveWorkspaceMeta(currentUser.id, projectId);
      }
      sendJson(res, 200, { ok: true, updatedAt: project.draftUpdatedAt, project });
      return;
    }

    const bookLockMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/books\/([^/]+)\/lock$/);
    if (bookLockMatch && req.method === "POST") {
      const projectId = decodeURIComponent(bookLockMatch[1]);
      const bookId = decodeURIComponent(bookLockMatch[2]);
      const claimed = claimBookLock(currentUser.id, currentSessionId, projectId, bookId, currentUser.name);
      if (!claimed.ok) {
        sendJson(res, 409, {
          ok: false,
          code: "BOOK_LOCKED",
          error: "Bu kitap su anda baska bir kullanici tarafindan duzenleniyor.",
          lock: claimed.lock,
        });
        return;
      }
      sendJson(res, 200, { ok: true, lock: claimed.lock });
      return;
    }

    const bookUnlockMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/books\/([^/]+)\/unlock$/);
    if (bookUnlockMatch && req.method === "POST") {
      const projectId = decodeURIComponent(bookUnlockMatch[1]);
      const bookId = decodeURIComponent(bookUnlockMatch[2]);
      releaseBookLock(currentUser.id, currentSessionId, projectId, bookId);
      sendJson(res, 200, { ok: true });
      return;
    }

    const versionsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/versions$/);
    if (versionsMatch && req.method === "GET") {
      const projectId = decodeURIComponent(versionsMatch[1]);
      sendJson(res, 200, { versions: listProjectVersions(currentUser.id, projectId) });
      return;
    }

    if (versionsMatch && req.method === "POST") {
      const projectId = decodeURIComponent(versionsMatch[1]);
      const body = await readBody(req);
      const version = createProjectVersion(currentUser.id, projectId, body.label, Boolean(body.publish), body.state ?? null);
      sendJson(res, 200, {
        ok: true,
        version,
        versions: listProjectVersions(currentUser.id, projectId),
        projects: listProjects(currentUser.id),
        currentProject: getProjectSummary(projectId, currentUser.id),
      });
      return;
    }

    const versionDeleteMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/versions\/([^/]+)$/);
    if (versionDeleteMatch && req.method === "DELETE") {
      const projectId = decodeURIComponent(versionDeleteMatch[1]);
      const versionId = decodeURIComponent(versionDeleteMatch[2]);
      deleteProjectVersion(currentUser.id, projectId, versionId);
      sendJson(res, 200, {
        ok: true,
        versions: listProjectVersions(currentUser.id, projectId),
        currentProject: getProjectSummary(projectId, currentUser.id),
      });
      return;
    }

    const publishMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/publish$/);
    if (publishMatch && req.method === "POST") {
      const projectId = decodeURIComponent(publishMatch[1]);
      const body = await readBody(req);
      const versionId = String(body.versionId || "").trim();
      if (!versionId) {
        sendJson(res, 400, { ok: false, error: "Version id required" });
        return;
      }
      publishProjectVersion(currentUser.id, projectId, versionId);
      sendJson(res, 200, {
        ok: true,
        versions: listProjectVersions(currentUser.id, projectId),
        projects: listProjects(currentUser.id),
        currentProject: getProjectSummary(projectId, currentUser.id),
      });
      return;
    }

    const restoreMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/restore$/);
    if (restoreMatch && req.method === "POST") {
      const projectId = decodeURIComponent(restoreMatch[1]);
      const body = await readBody(req);
      const versionId = String(body.versionId || "").trim();
      if (!versionId) {
        sendJson(res, 400, { ok: false, error: "Version id required" });
        return;
      }
      restoreProjectVersion(currentUser.id, projectId, versionId);
      saveWorkspaceMeta(currentUser.id, projectId);
      sendJson(res, 200, ensureWorkspace(currentUser.id));
      return;
    }

    const duplicateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/duplicate$/);
    if (duplicateMatch && req.method === "POST") {
      const projectId = decodeURIComponent(duplicateMatch[1]);
      const project = duplicateProject(currentUser.id, projectId);
      saveWorkspaceMeta(currentUser.id, project.id);
      sendJson(res, 200, ensureWorkspace(currentUser.id));
      return;
    }

    // ─── Review Threads ─────────────────────────────────────────────────────────
    // Güvenlik: tüm thread işlemleri yalnızca ilgili projenin SAHİBİ tarafından
    // yapılabilir. Aksi halde başka kullanıcının projesinin yorumlarına erişim
    // (IDOR) mümkün olurdu. projectExists(projectId, userId) sahiplik kontrolüdür.
    const threadsListMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/threads$/);
    if (threadsListMatch && req.method === "GET") {
      const projectId = decodeURIComponent(threadsListMatch[1]);
      if (!projectExists(projectId, currentUser.id)) { sendJson(res, 403, { ok: false, error: "Forbidden" }); return; }
      const slideRef = url.searchParams.get("slideRef") || null;
      const rows = slideRef
        ? db.prepare("SELECT * FROM review_threads WHERE project_id = ? AND slide_ref = ? ORDER BY created_at ASC").all(projectId, slideRef)
        : db.prepare("SELECT * FROM review_threads WHERE project_id = ? ORDER BY created_at ASC").all(projectId);
      sendJson(res, 200, { ok: true, threads: rows });
      return;
    }

    if (threadsListMatch && req.method === "POST") {
      const projectId = decodeURIComponent(threadsListMatch[1]);
      if (!projectExists(projectId, currentUser.id)) { sendJson(res, 403, { ok: false, error: "Forbidden" }); return; }
      const body = await readBody(req);
      const message = String(body.message || "").trim();
      if (!message) { sendJson(res, 400, { ok: false, error: "Message required" }); return; }
      const threadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const now = new Date().toISOString();
      db.prepare("INSERT INTO review_threads (id, project_id, slide_ref, user_id, message, resolved, parent_id, created_at) VALUES (?,?,?,?,?,0,?,?)")
        .run(threadId, projectId, body.slideRef || null, currentUser.id, message, body.parentId || null, now);
      const thread = db.prepare("SELECT * FROM review_threads WHERE id = ?").get(threadId);
      sendJson(res, 200, { ok: true, thread });
      return;
    }

    const threadMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/threads\/([^/]+)$/);
    if (threadMatch && req.method === "PATCH") {
      const projectId = decodeURIComponent(threadMatch[1]);
      if (!projectExists(projectId, currentUser.id)) { sendJson(res, 403, { ok: false, error: "Forbidden" }); return; }
      const tId = decodeURIComponent(threadMatch[2]);
      // Thread gerçekten bu projeye mi ait — başka projenin thread id'siyle güncelleme engellenir.
      const thread = db.prepare("SELECT * FROM review_threads WHERE id = ? AND project_id = ?").get(tId, projectId);
      if (!thread) { sendJson(res, 404, { ok: false, error: "Thread not found" }); return; }
      const body = await readBody(req);
      const resolvedVal = typeof body.resolved === "boolean" ? (body.resolved ? 1 : 0) : thread.resolved;
      const messageVal = body.message !== undefined ? String(body.message).trim() : thread.message;
      db.prepare("UPDATE review_threads SET resolved = ?, message = ? WHERE id = ? AND project_id = ?").run(resolvedVal, messageVal, tId, projectId);
      const updated = db.prepare("SELECT * FROM review_threads WHERE id = ?").get(tId);
      sendJson(res, 200, { ok: true, thread: updated });
      return;
    }

    if (threadMatch && req.method === "DELETE") {
      const projectId = decodeURIComponent(threadMatch[1]);
      if (!projectExists(projectId, currentUser.id)) { sendJson(res, 403, { ok: false, error: "Forbidden" }); return; }
      const tId = decodeURIComponent(threadMatch[2]);
      db.prepare("DELETE FROM review_threads WHERE (id = ? OR parent_id = ?) AND project_id = ?").run(tId, tId, projectId);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && serveStatic(req, res)) {
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500) {
      sendJson(res, error.statusCode, { ok: false, error: error.message || "Invalid request" });
      return;
    }
    if (error instanceof SyntaxError || error.statusCode === 400) {
      sendJson(res, 400, { ok: false, error: error.message || "Invalid request payload" });
      return;
    }
    sendJson(res, 500, { ok: false, error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`E-Icerik DB API listening on http://localhost:${PORT}`);
  console.log(`SQLite file: ${DB_PATH}`);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`API portu dolu: ${PORT}. Local gelistirmede 'npm start' artik bos port seciyor; elle calistiriyorsan farkli bir PORT ver.`);
    process.exit(1);
  }
  console.error("Sunucu hatasi:", error);
  process.exit(1);
});
