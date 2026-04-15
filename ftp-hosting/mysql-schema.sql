CREATE TABLE IF NOT EXISTS app_state (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    payload LONGTEXT NOT NULL,
    updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    payload LONGTEXT NOT NULL,
    saved_at VARCHAR(40) NOT NULL,
    created_at VARCHAR(40) NULL,
    published_version_id VARCHAR(64) NULL,
    INDEX idx_projects_saved_at (saved_at)
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
