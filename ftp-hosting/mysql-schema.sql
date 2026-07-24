-- editor_users: not/bos birakilirsa uygulama ilk acilista bunu otomatik
-- olusturur ve api/.env'deki USER1_*/USER2_* degerleriyle tohumlar (bkz.
-- ftp-hosting/api/index.php: ensure_editor_users_schema). Bu dosyayi elle
-- calistirmak GEREKMEZ; yalnizca referans/manuel kurulum icin burada durur.
CREATE TABLE IF NOT EXISTS editor_users (
    id            VARCHAR(64)  NOT NULL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    active        TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_state (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    payload LONGTEXT NOT NULL,
    updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT 'kullanici1',
    name VARCHAR(255) NOT NULL,
    payload LONGTEXT NOT NULL,
    saved_at VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NULL,
    published_version_id VARCHAR(64) NULL,
    INDEX idx_projects_saved_at (saved_at),
    INDEX idx_projects_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- project_shares: bir projenin sahibi disinda hangi kullanicilarla paylasildigi
-- (bkz. POST/DELETE/GET /projects/:id/shares). Bu dosyayi elle calistirmak
-- GEREKMEZ; ensure_workspace_schema() ilk istekte otomatik olusturur.
CREATE TABLE IF NOT EXISTS project_shares (
    project_id VARCHAR(64) NOT NULL,
    shared_with_user_id VARCHAR(64) NOT NULL,
    shared_at DATETIME NOT NULL,
    PRIMARY KEY (project_id, shared_with_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_locks (
    project_id VARCHAR(64)  NOT NULL,
    book_id    VARCHAR(64)  NOT NULL,
    user_id    VARCHAR(64)  NOT NULL,
    user_name  VARCHAR(255) NOT NULL DEFAULT "",
    session_id VARCHAR(128) NOT NULL,
    locked_at  DATETIME     NOT NULL,
    PRIMARY KEY (project_id, book_id),
    INDEX idx_book_locks_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id        VARCHAR(128) NOT NULL PRIMARY KEY,
    user_id           VARCHAR(64)  NOT NULL,
    session_label     VARCHAR(255) NOT NULL DEFAULT "",
    last_seen_at      DATETIME     NOT NULL,
    kick_requested_at DATETIME     NULL,
    INDEX idx_user_sessions_user_last (user_id, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_versions (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    version_no INT UNSIGNED NOT NULL,
    label VARCHAR(255) NOT NULL,
    payload LONGTEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_project_version_no (project_id, version_no),
    INDEX idx_project_versions_project_created (project_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
