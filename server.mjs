import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4001);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "e-icerik-editor.sqlite");
const BUILD_DIR = path.join(__dirname, "build");
const PDF_ANALYSIS_MODE = "offline";
const FIXED_USERS = [
  { id: "kullanici1", name: "Kullanici 1", password: "1234" },
  { id: "kullanici2", name: "Kullanici 2", password: "1234" },
];
const DEFAULT_USER_ID = FIXED_USERS[0].id;
const SESSION_TTL_MS = 20_000;

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
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
`);

ensureProjectColumn("created_at", "ALTER TABLE projects ADD COLUMN created_at TEXT");
ensureProjectColumn("published_version_id", "ALTER TABLE projects ADD COLUMN published_version_id TEXT");
ensureProjectColumn("user_id", "ALTER TABLE projects ADD COLUMN user_id TEXT");
db.exec(`UPDATE projects SET created_at = saved_at WHERE created_at IS NULL OR created_at = ''`);
db.prepare("UPDATE projects SET user_id = ? WHERE user_id IS NULL OR user_id = ''").run(DEFAULT_USER_ID);

function ensureProjectColumn(columnName, sql) {
  const columns = db.prepare("PRAGMA table_info(projects)").all();
  if (!columns.some(column => column.name === columnName)) {
    db.exec(sql);
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Session-Id",
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 10_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
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
  return FIXED_USERS.find(user => user.id === String(userId || "").trim()) || null;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanupExpiredSessions() {
  const threshold = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  db.prepare("DELETE FROM user_sessions WHERE last_seen_at < ?").run(threshold);
  db.prepare("DELETE FROM book_locks WHERE last_seen_at < ?").run(threshold);
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
    .prepare("SELECT id, user_id, name, saved_at, created_at, published_version_id FROM projects ORDER BY saved_at DESC")
    .all()
    .map(projectSummaryFromRow);
}

function getProject(projectId, userId) {
  const row = db
    .prepare("SELECT id, user_id, name, payload, saved_at, created_at, published_version_id FROM projects WHERE id = ?")
    .get(projectId);
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
  return Boolean(db.prepare("SELECT 1 FROM projects WHERE id = ? LIMIT 1").get(projectId));
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
    WHERE id = ?
  `).run(projectName, JSON.stringify(state || {}), timestamp, projectId);
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
    db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ?").run(versionId, projectId);
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
  db.prepare("UPDATE projects SET payload = ?, saved_at = ? WHERE id = ?").run(row.payload, savedAt, projectId);
}

function publishProjectVersion(userId, projectId, versionId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  const row = db.prepare("SELECT id FROM project_versions WHERE id = ? AND project_id = ?").get(versionId, projectId);
  if (!row) throw new Error("Version not found");
  db.prepare("UPDATE project_versions SET is_published = 0 WHERE project_id = ?").run(projectId);
  db.prepare("UPDATE project_versions SET is_published = 1 WHERE id = ?").run(versionId);
  db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ?").run(versionId, projectId);
}

function deleteProject(userId, projectId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  db.prepare("DELETE FROM project_versions WHERE project_id = ?").run(projectId);
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  db.prepare("DELETE FROM book_locks WHERE project_id = ?").run(projectId);
}

function deleteProjectVersion(userId, projectId, versionId) {
  if (!projectExists(projectId, userId)) throw new Error("Project not found");
  db.prepare("DELETE FROM project_versions WHERE id = ? AND project_id = ?").run(versionId, projectId);
  const remainingPublished = db.prepare("SELECT id FROM project_versions WHERE project_id = ? AND is_published = 1 LIMIT 1").get(projectId);
  db.prepare("UPDATE projects SET published_version_id = ? WHERE id = ?").run(remainingPublished?.id || null, projectId);
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
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(BUILD_DIR, safePath);

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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, dbPath: DB_PATH });
      return;
    }

    if (url.pathname === "/api/auth/status" && req.method === "POST") {
      const body = await readBody(req);
      const userId = String(body.userId || "").trim();
      const sessionId = String(body.sessionId || "").trim();
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
      const user = resolveFixedUser(userId);
      if (!user || user.password !== password) {
        sendJson(res, 401, { ok: false, error: "Kullanici bilgileri hatali" });
        return;
      }
      const claimed = claimUserSession(user.id, sessionId, sessionLabel);
      if (!claimed.ok) {
        sendJson(res, 409, {
          ok: false,
          code: "USER_LOCKED",
          error: "Bu kullanici baska bir cihazda acik. Cikis yapilana kadar beklenmeli.",
          session: claimed.session,
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        user: { id: user.id, name: user.name },
        session: claimed.session,
      });
      return;
    }

    if (url.pathname === "/api/auth/heartbeat" && req.method === "POST") {
      const body = await readBody(req);
      const userId = String(body.userId || "").trim();
      const sessionId = String(body.sessionId || "").trim();
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
      sendJson(res, 200, { ok: true, session: touched.session });
      return;
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const body = await readBody(req);
      const userId = String(body.userId || "").trim();
      const sessionId = String(body.sessionId || "").trim();
      const user = resolveFixedUser(userId);
      if (user && sessionId) {
        releaseUserSession(user.id, sessionId);
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    let currentUser = null;
    let currentSessionId = "";
    if (url.pathname.startsWith("/api/")) {
      currentUser = resolveFixedUser(req.headers["x-user-id"]);
      currentSessionId = String(req.headers["x-session-id"] || "").trim();
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

    if (req.method === "GET" && serveStatic(req, res)) {
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
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
