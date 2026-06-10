<?php

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// CORS: wildcard yerine config['allowed_origins'] beyaz listesi. Liste boşsa
// yalnızca aynı kökenden erişime izin verilir (CORS başlığı gönderilmez).
// '*' yalnızca listede açıkça yer alıyorsa (geliştirme tercihi) kullanılır.
$requestOrigin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
$allowedOrigins = is_array($config['allowed_origins'] ?? null) ? $config['allowed_origins'] : [];
if ($requestOrigin !== '') {
    if (in_array('*', $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: *');
    } elseif (in_array($requestOrigin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $requestOrigin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-User-Id, X-Session-Id');

// Yavaş bağlantılarda JSON yanıtlarını küçültmek için gzip (sunucu zaten
// sıkıştırmıyorsa ve istemci destekliyorsa). ob_gzhandler Accept-Encoding'i
// kendi kontrol eder; çift sıkıştırma riski yok.
if (!ini_get('zlib.output_compression') && extension_loaded('zlib') && !ob_get_level()) {
    @ob_start('ob_gzhandler');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = get_api_path();

if ($path === '/health') {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');

    $requireDatabase = in_array(strtolower((string) ($_GET['requireDatabase'] ?? '')), ['1', 'true', 'yes'], true);
    if ($requireDatabase) {
        if (has_placeholder_database_config($config)) {
            send_json(503, [
                'ok' => false,
                'api' => 'ready',
                'database' => 'unavailable',
                'databaseRequired' => true,
                'error' => 'Database configuration is incomplete',
                'code' => 'db_config_incomplete',
            ]);
        }

        if (!class_exists('PDO') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
            send_json(503, [
                'ok' => false,
                'api' => 'ready',
                'database' => 'unavailable',
                'databaseRequired' => true,
                'error' => 'Database driver is unavailable',
                'code' => 'pdo_mysql_unavailable',
            ]);
        }

        try {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $config['db_host'],
                $config['db_port'],
                $config['db_name'],
                $config['db_charset']
            );
            $healthPdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => max(1, min(15, (int) ($config['db_connect_timeout'] ?? 5))),
            ]);
            $healthPdo->query('SELECT 1');
        } catch (Throwable $error) {
            send_json(503, [
                'ok' => false,
                'api' => 'ready',
                'database' => 'unavailable',
                'databaseRequired' => true,
                'error' => 'Database connection failed',
                'code' => 'db_connection_failed',
            ]);
        }

        try {
            ensure_workspace_schema_if_required($healthPdo);
        } catch (Throwable $error) {
            send_json(503, [
                'ok' => false,
                'api' => 'ready',
                'database' => 'unavailable',
                'databaseRequired' => true,
                'error' => 'Database schema check failed',
                'code' => 'db_schema_failed',
            ]);
        }

        send_json(200, [
            'ok' => true,
            'api' => 'ready',
            'database' => 'ready',
            'databaseRequired' => true,
        ]);
    }

    send_json(200, [
        'ok' => true,
        'api' => 'ready',
        'databaseRequired' => false,
    ]);
}

if (has_placeholder_database_config($config)) {
    send_json(500, [
        'ok' => false,
        'error' => 'Database configuration is incomplete',
        'code' => 'db_config_incomplete',
    ]);
}

if (!class_exists('PDO') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
    send_json(500, [
        'ok' => false,
        'error' => 'Database driver is unavailable',
        'code' => 'pdo_mysql_unavailable',
    ]);
}

try {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $config['db_host'],
        $config['db_port'],
        $config['db_name'],
        $config['db_charset']
    );

    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => max(1, min(15, (int) ($config['db_connect_timeout'] ?? 5))),
    ]);
} catch (Throwable $error) {
    send_json(500, [
        'ok' => false,
        'error' => 'Database connection failed',
        'code' => 'db_connection_failed',
    ]);
}

try {
    if ($path === '/admin/backup' && $method === 'GET') {
        require_admin_token($config);
        send_sql_download(build_mysql_backup($pdo), 'eicerik-mysql-backup-' . gmdate('Ymd-His') . '.sql');
    }

    if ($path === '/pdf-layout/analyze' && $method === 'POST') {
        $body = read_json_body();
        send_json(200, request_pdf_ai_layout($config, $body));
    }

    if ($path === '/workspace' && $method === 'GET') {
        send_json(200, ensure_workspace($pdo));
    }

    if ($path === '/workspace/current-project' && $method === 'PUT') {
        $body = read_json_body();
        $projectId = trim((string) ($body['projectId'] ?? ''));

        if ($projectId === '' || !project_exists($pdo, $projectId)) {
            send_json(404, ['ok' => false, 'error' => 'Project not found']);
        }

        set_workspace_current_project($pdo, $projectId);
        send_json(200, ensure_workspace($pdo));
    }

    if ($path === '/state' && $method === 'GET') {
        $workspace = ensure_workspace($pdo);
        send_json(200, [
            'state' => $workspace['state'],
            'updatedAt' => $workspace['updatedAt'],
            'projectId' => $workspace['currentProject']['id'] ?? null,
            'projectName' => $workspace['currentProject']['name'] ?? null,
        ]);
    }

    if ($path === '/state' && $method === 'PUT') {
        $workspace = ensure_workspace($pdo);
        $body = read_json_body();
        $projectId = trim((string) ($body['projectId'] ?? ($workspace['currentProject']['id'] ?? '')));

        if ($projectId === '' || !project_exists($pdo, $projectId)) {
            send_json(404, ['ok' => false, 'error' => 'Project not found']);
        }

        $state = $body['state'] ?? new stdClass();
        $projectName = array_key_exists('projectName', $body) ? (string) $body['projectName'] : null;
        $project = save_project_draft($pdo, $projectId, $state, $projectName);
        set_workspace_current_project($pdo, $projectId);

        send_json(200, [
            'ok' => true,
            'updatedAt' => $project['draftUpdatedAt'],
            'project' => $project,
        ]);
    }

    if ($path === '/projects' && $method === 'GET') {
        send_json(200, ['projects' => list_projects($pdo)]);
    }

    if ($path === '/projects' && $method === 'POST') {
        $body = read_json_body();
        $name = trim((string) ($body['name'] ?? ''));
        $state = $body['state'] ?? empty_editor_state();

        $project = create_project($pdo, $name, $state);
        set_workspace_current_project($pdo, $project['id']);

        send_json(200, ensure_workspace($pdo));
    }

    if (preg_match('#^/projects/([^/]+)$#', $path, $matches) === 1 && $method === 'GET') {
        $project = get_project($pdo, urldecode($matches[1]));

        if (!$project) {
            send_json(404, ['ok' => false, 'error' => 'Project not found']);
        }

        send_json(200, [
            'project' => $project,
            'versions' => list_project_versions($pdo, $project['id']),
        ]);
    }

    if (preg_match('#^/projects/([^/]+)$#', $path, $matches) === 1 && $method === 'DELETE') {
        $projectId = urldecode($matches[1]);
        delete_project($pdo, $projectId);

        $workspace = ensure_workspace($pdo);
        send_json(200, ['ok' => true] + $workspace);
    }

    if (preg_match('#^/projects/([^/]+)/draft$#', $path, $matches) === 1 && $method === 'PUT') {
        $projectId = urldecode($matches[1]);
        $body = read_json_body();
        $project = save_project_draft(
            $pdo,
            $projectId,
            $body['state'] ?? new stdClass(),
            array_key_exists('name', $body) ? (string) $body['name'] : null
        );

        if (($body['setCurrent'] ?? true) === true) {
            set_workspace_current_project($pdo, $projectId);
        }

        send_json(200, [
            'ok' => true,
            'updatedAt' => $project['draftUpdatedAt'],
            'project' => $project,
        ]);
    }

    if (preg_match('#^/projects/([^/]+)/versions$#', $path, $matches) === 1 && $method === 'GET') {
        $projectId = urldecode($matches[1]);
        send_json(200, ['versions' => list_project_versions($pdo, $projectId)]);
    }

    if (preg_match('#^/projects/([^/]+)/versions$#', $path, $matches) === 1 && $method === 'POST') {
        $projectId = urldecode($matches[1]);
        $body = read_json_body();
        $label = trim((string) ($body['label'] ?? ''));
        $publish = !empty($body['publish']);
        $version = create_project_version($pdo, $projectId, $label, $publish, $body['state'] ?? null);

        send_json(200, [
            'ok' => true,
            'version' => $version,
            'versions' => list_project_versions($pdo, $projectId),
            'projects' => list_projects($pdo),
            'currentProject' => get_project_summary($pdo, $projectId),
        ]);
    }

    if (preg_match('#^/projects/([^/]+)/publish$#', $path, $matches) === 1 && $method === 'POST') {
        $projectId = urldecode($matches[1]);
        $body = read_json_body();
        $versionId = trim((string) ($body['versionId'] ?? ''));

        if ($versionId === '') {
            send_json(400, ['ok' => false, 'error' => 'Version id required']);
        }

        publish_project_version($pdo, $projectId, $versionId);

        send_json(200, [
            'ok' => true,
            'versions' => list_project_versions($pdo, $projectId),
            'projects' => list_projects($pdo),
            'currentProject' => get_project_summary($pdo, $projectId),
        ]);
    }

    if (preg_match('#^/projects/([^/]+)/restore$#', $path, $matches) === 1 && $method === 'POST') {
        $projectId = urldecode($matches[1]);
        $body = read_json_body();
        $versionId = trim((string) ($body['versionId'] ?? ''));

        if ($versionId === '') {
            send_json(400, ['ok' => false, 'error' => 'Version id required']);
        }

        restore_project_version($pdo, $projectId, $versionId);
        set_workspace_current_project($pdo, $projectId);
        send_json(200, ensure_workspace($pdo));
    }

    if (preg_match('#^/projects/([^/]+)/versions/([^/]+)$#', $path, $matches) === 1 && $method === 'DELETE') {
        $projectId = urldecode($matches[1]);
        $versionId = urldecode($matches[2]);
        $pdo->prepare('DELETE FROM project_versions WHERE id = :id AND project_id = :project_id')
            ->execute([':id' => $versionId, ':project_id' => $projectId]);
        $pdo->prepare('UPDATE projects SET published_version_id = NULL WHERE id = :id AND published_version_id = :vid')
            ->execute([':id' => $projectId, ':vid' => $versionId]);
        $versions = list_project_versions($pdo, $projectId);
        $project = get_project($pdo, $projectId);
        send_json(200, ['ok' => true, 'versions' => $versions, 'currentProject' => $project]);
    }

    if (preg_match('#^/projects/([^/]+)/duplicate$#', $path, $matches) === 1 && $method === 'POST') {
        $projectId = urldecode($matches[1]);
        $body = read_json_body();
        $srcProject = get_project($pdo, $projectId);
        if (!$srcProject) {
            send_json(404, ['ok' => false, 'error' => 'Kaynak proje bulunamadi']);
        }
        $newName = trim((string) ($body['name'] ?? '')) ?: ($srcProject['name'] . ' (Kopya)');
        $project = create_project($pdo, $newName, $srcProject['state']);
        set_workspace_current_project($pdo, $project['id']);
        send_json(200, ensure_workspace($pdo));
    }

    if (preg_match('#^/projects/([^/]+)/versions/([^/]+)/export$#', $path, $matches) === 1 && $method === 'GET') {
        send_json(410, ['ok' => false, 'error' => 'SCORM disa aktarma kaldirildi.']);
    }

    if ($path === '/upload' && $method === 'POST') {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            send_json(400, ['ok' => false, 'error' => 'Dosya yuklenemedi veya secilmedi.']);
        }

        $file = $_FILES['file'];
        $mimeToExt = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/gif'  => 'gif',
            'image/webp' => 'webp',
            'video/mp4'  => 'mp4',
            'video/webm' => 'webm',
            'video/ogg'  => 'ogv',
            'audio/mpeg' => 'mp3',
            'audio/mp3'  => 'mp3',
            'audio/wav'  => 'wav',
            'audio/x-wav' => 'wav',
            'audio/ogg'  => 'ogg',
        ];

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $realType = $finfo->file($file['tmp_name']);

        if (!array_key_exists($realType, $mimeToExt)) {
            send_json(400, ['ok' => false, 'error' => 'Sadece gorsel, ses veya video dosyasi yukleyebilirsiniz.']);
        }

        $extension = $mimeToExt[$realType];
        $newName = bin2hex(random_bytes(8)) . '.' . $extension;

        $uploadDir = __DIR__ . '/../static/uploads';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        // Güvenlik (defense-in-depth): yuklenen klasorde PHP/CGI yurutmeyi kapat. Uzanti
        // beyaz listesi zaten .php yazilmasini engelliyor; bu .htaccess ek koruma katmani.
        $htaccessPath = $uploadDir . '/.htaccess';
        if (!is_file($htaccessPath)) {
            @file_put_contents(
                $htaccessPath,
                "php_flag engine off\n"
                . "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .phar\n"
                . "RemoveType .php .phtml .php3 .php4 .php5 .php7 .phar\n"
                . "<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|phar|cgi|pl)$\">\n"
                . "  Require all denied\n"
                . "</FilesMatch>\n"
            );
        }

        $destination = $uploadDir . '/' . $newName;

        if (move_uploaded_file($file['tmp_name'], $destination)) {
            send_json(200, ['ok' => true, 'url' => '/static/uploads/' . $newName]);
        }

        send_json(500, ['ok' => false, 'error' => 'Dosya sunucuya kaydedilemedi.']);
    }

    if (preg_match('#^/projects/([^/]+)/export-bulk$#', $path, $matches) === 1 && $method === 'GET') {
        send_json(410, ['ok' => false, 'error' => 'SCORM toplu disa aktarma kaldirildi.']);
    }

    if (preg_match('#^/projects/([^/]+)/export$#', $path, $matches) === 1 && $method === 'GET') {
        send_json(410, ['ok' => false, 'error' => 'SCORM disa aktarma kaldirildi.']);
        exit;
    }

    if (preg_match('#^/projects/([^/]+)/books/([^/]+)/lock$#', $path, $matches) === 1 && $method === 'POST') {
        $projectId = urldecode($matches[1]);
        $bookId    = urldecode($matches[2]);
        $userId    = trim($_SERVER['HTTP_X_USER_ID']    ?? '');
        $sessionId = trim($_SERVER['HTTP_X_SESSION_ID'] ?? '');

        if ($userId === '' || $sessionId === '') {
            send_json(401, ['ok' => false, 'error' => 'Oturum bilgisi eksik.']);
        }

        // Check if book already locked by another active session
        $stmt = $pdo->prepare(
            'SELECT bl.*, us.last_seen_at AS sess_last_seen
             FROM book_locks bl
             LEFT JOIN user_sessions us ON us.session_id = bl.session_id
             WHERE bl.project_id = :pid AND bl.book_id = :bid LIMIT 1'
        );
        $stmt->execute([':pid' => $projectId, ':bid' => $bookId]);
        $existing = $stmt->fetch();

        if ($existing && $existing['session_id'] !== $sessionId) {
            $sessAlive = $existing['sess_last_seen']
                && (strtotime($existing['sess_last_seen']) > time() - 180);

            if ($sessAlive) {
                send_json(409, [
                    'ok'   => false,
                    'code' => 'BOOK_LOCKED',
                    'error' => ($existing['user_name'] ?: $existing['user_id']) . ' bu kitabi su anda duzenliyor.',
                    'lock' => [
                        'projectId' => $projectId,
                        'bookId'    => $bookId,
                        'userId'    => $existing['user_id'],
                        'userName'  => $existing['user_name'],
                        'sessionId' => $existing['session_id'],
                        'lockedAt'  => $existing['locked_at'],
                    ],
                ]);
            }
            // Stale lock — clear it
            $pdo->prepare('DELETE FROM book_locks WHERE project_id = :pid AND book_id = :bid')
                ->execute([':pid' => $projectId, ':bid' => $bookId]);
        }

        $userName = get_user_display_name($config, $userId);
        $now      = date('Y-m-d H:i:s');

        $pdo->prepare(
            'INSERT INTO book_locks (project_id, book_id, user_id, user_name, session_id, locked_at)
             VALUES (:pid, :bid, :uid, :uname, :sid, :now)
             ON DUPLICATE KEY UPDATE
               user_id = VALUES(user_id), user_name = VALUES(user_name),
               session_id = VALUES(session_id), locked_at = VALUES(locked_at)'
        )->execute([
            ':pid' => $projectId, ':bid' => $bookId,
            ':uid' => $userId, ':uname' => $userName,
            ':sid' => $sessionId, ':now' => $now,
        ]);

        send_json(200, [
            'ok'   => true,
            'lock' => [
                'projectId' => $projectId,
                'bookId'    => $bookId,
                'userId'    => $userId,
                'userName'  => $userName,
                'sessionId' => $sessionId,
                'lockedAt'  => $now,
            ],
        ]);
    }

    if (preg_match('#^/projects/([^/]+)/books/([^/]+)/unlock$#', $path, $matches) === 1 && $method === 'POST') {
        $projectId = urldecode($matches[1]);
        $bookId    = urldecode($matches[2]);
        $sessionId = trim($_SERVER['HTTP_X_SESSION_ID'] ?? '');

        $pdo->prepare(
            'DELETE FROM book_locks WHERE project_id = :pid AND book_id = :bid AND session_id = :sid'
        )->execute([':pid' => $projectId, ':bid' => $bookId, ':sid' => $sessionId]);

        send_json(200, ['ok' => true]);
    }

    if ($path === '/auth/login' && $method === 'POST') {
        $body = read_json_body();
        $userId    = trim((string) ($body['userId']    ?? ''));
        $password  = trim((string) ($body['password']  ?? ''));
        $sessionId = trim((string) ($body['sessionId'] ?? ''));
        $sessionLabel = trim((string) ($body['sessionLabel'] ?? ''));

        // Güvenlik: hardcoded varsayilan sifre yok; kullanicilar yalnizca config'ten gelir.
        $users = is_array($config['users'] ?? null) ? $config['users'] : [];

        $matchedUser = null;
        foreach ($users as $u) {
            if (($u['id'] ?? null) !== $userId) {
                continue;
            }
            $stored = (string) ($u['password'] ?? '');
            // bcrypt/argon hash ise password_verify; degilse timing-safe hash_equals
            // (duz metin sifreler icin bile zamanlama sizintisini engeller).
            $info = password_get_info($stored);
            $passwordOk = ($info['algo'] ?? null)
                ? password_verify($password, $stored)
                : hash_equals($stored, $password);
            if ($passwordOk) {
                $matchedUser = $u;
            }
            break;
        }

        if (!$matchedUser) {
            send_json(401, ['ok' => false, 'error' => 'Kullanici adi veya sifre yanlis.']);
        }

        // Check if user already has an active session from another device
        $stmt = $pdo->prepare(
            'SELECT session_id, session_label, last_seen_at, kick_requested_at FROM user_sessions
             WHERE user_id = :uid AND session_id != :sid
             AND last_seen_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)
             ORDER BY last_seen_at DESC LIMIT 1'
        );
        $stmt->execute([':uid' => $userId, ':sid' => $sessionId]);
        $existing = $stmt->fetch();

        if ($existing) {
            $forceLogin  = !empty($body['force']);
            $kickAt      = $existing['kick_requested_at'];
            $elapsed     = $kickAt ? (int)(time() - strtotime($kickAt)) : 0;
            $waitSeconds = $kickAt ? max(0, 20 - $elapsed) : 20;

            if ($forceLogin && $kickAt) {
                // Force kick: delete old session, fall through to create new one
                $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :uid AND session_id = :sid')
                    ->execute([':uid' => $userId, ':sid' => $existing['session_id']]);
            } else {
                if (!$kickAt) {
                    // First attempt — set kick request on existing session
                    $pdo->prepare(
                        'UPDATE user_sessions SET kick_requested_at = NOW()
                         WHERE user_id = :uid AND session_id = :sid'
                    )->execute([':uid' => $userId, ':sid' => $existing['session_id']]);
                    $waitSeconds = 20;
                }
                $waitMsg = $waitSeconds > 0
                    ? "Cikis istegi gonderildi. {$waitSeconds} saniye sonra zorla cikarabilirsiniz."
                    : "Artik zorla cikis yapabilirsiniz.";
                send_json(409, [
                    'ok'          => false,
                    'code'        => 'USER_LOCKED',
                    'kickPending' => true,
                    'waitSeconds' => $waitSeconds,
                    'error'       => $waitMsg,
                    'session'     => [
                        'sessionId'    => $existing['session_id'],
                        'sessionLabel' => $existing['session_label'],
                        'lastSeenAt'   => $existing['last_seen_at'],
                    ],
                ]);
            }
        }

        // Upsert session
        $now = date('Y-m-d H:i:s');
        // DELETE + INSERT yerine VALUES() ile duplicate-param sorunu önleniyor
        $pdo->prepare('DELETE FROM user_sessions WHERE session_id = :sid')
            ->execute([':sid' => $sessionId]);
        $pdo->prepare(
            'INSERT INTO user_sessions (session_id, user_id, session_label, last_seen_at, kick_requested_at)
             VALUES (:sid, :uid, :label, :now, NULL)'
        )->execute([':sid' => $sessionId, ':uid' => $userId, ':label' => $sessionLabel, ':now' => $now]);

        send_json(200, [
            'ok'   => true,
            'user' => ['id' => $matchedUser['id'], 'name' => $matchedUser['name']],
        ]);
    }

    if ($path === '/auth/heartbeat' && $method === 'POST') {
        $body      = read_json_body();
        $userId    = trim((string) ($body['userId']    ?? ''));
        $sessionId = trim((string) ($body['sessionId'] ?? ''));

        if ($userId === '' || $sessionId === '') {
            send_json(400, ['ok' => false, 'error' => 'Eksik parametre.']);
        }

        // Verify session still exists
        $stmt = $pdo->prepare(
            'SELECT session_id, kick_requested_at FROM user_sessions
             WHERE user_id = :uid AND session_id = :sid LIMIT 1'
        );
        $stmt->execute([':uid' => $userId, ':sid' => $sessionId]);
        $row = $stmt->fetch();
        if (!$row) {
            send_json(401, ['ok' => false, 'code' => 'SESSION_EXPIRED', 'error' => 'Oturum suresi doldu. Lutfen tekrar giris yapin.']);
        }

        $kickRequested = !empty($row['kick_requested_at']);

        // Update last_seen_at
        $pdo->prepare('UPDATE user_sessions SET last_seen_at = NOW() WHERE user_id = :uid AND session_id = :sid')
            ->execute([':uid' => $userId, ':sid' => $sessionId]);

        // Seviye 1 isbirligi (presence): online kullanicilar + aktif kitap
        // kilitleri. Mevcut tablolardan okunur; sema degismez. Yalniz son 3 dk
        // icinde gorulen (canli) oturumlar ve onlarin tuttugu kilitler doner.
        $presenceUsers = [];
        $usrStmt = $pdo->query(
            "SELECT user_id, session_id, last_seen_at FROM user_sessions
             WHERE last_seen_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)
             ORDER BY last_seen_at DESC"
        );
        foreach ($usrStmt as $r) {
            $presenceUsers[] = [
                'userId'     => $r['user_id'],
                'userName'   => get_user_display_name($config, $r['user_id']),
                'sessionId'  => $r['session_id'],
                'lastSeenAt' => $r['last_seen_at'],
            ];
        }
        $presenceLocks = [];
        $lockStmt = $pdo->query(
            "SELECT bl.project_id, bl.book_id, bl.user_id, bl.user_name, bl.session_id
             FROM book_locks bl
             JOIN user_sessions us ON us.session_id = bl.session_id
             WHERE us.last_seen_at > DATE_SUB(NOW(), INTERVAL 3 MINUTE)
             ORDER BY bl.locked_at DESC"
        );
        foreach ($lockStmt as $r) {
            $presenceLocks[] = [
                'projectId' => $r['project_id'],
                'bookId'    => $r['book_id'],
                'userId'    => $r['user_id'],
                'userName'  => $r['user_name'] ?: get_user_display_name($config, $r['user_id']),
                'sessionId' => $r['session_id'],
            ];
        }

        send_json(200, [
            'ok' => true,
            'kickRequested' => $kickRequested,
            'presence' => ['users' => $presenceUsers, 'locks' => $presenceLocks],
        ]);
    }

    if ($path === '/auth/logout' && $method === 'POST') {
        $body      = read_json_body();
        $userId    = trim((string) ($body['userId']    ?? ''));
        $sessionId = trim((string) ($body['sessionId'] ?? ''));

        if ($userId !== '' && $sessionId !== '') {
            $pdo->prepare('DELETE FROM user_sessions WHERE user_id = :uid AND session_id = :sid')
                ->execute([':uid' => $userId, ':sid' => $sessionId]);
        }

        send_json(200, ['ok' => true]);
    }

    send_json(404, ['ok' => false, 'error' => 'Not found']);
} catch (Throwable $error) {
    // Güvenlik: istisna detayi (dosya yolu, SQL, stack) istemciye sizdirilmaz; yalnizca
    // sunucu loguna yazilir. Istemci genel bir mesaj gorur.
    error_log('[e-icerik-api] ' . $error->getMessage() . ' @ ' . $error->getFile() . ':' . $error->getLine());
    send_json(500, ['ok' => false, 'error' => 'Sunucu hatasi olustu.']);
}

function get_api_path(): string
{
    $route = trim((string) ($_GET['route'] ?? ''));
    if ($route !== '') {
        $routePath = parse_url($route, PHP_URL_PATH) ?? '/';
        if ($routePath === '' || $routePath === false) {
            return '/';
        }
        return '/' . ltrim($routePath, '/');
    }

    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/api', PHP_URL_PATH) ?? '/api';
    $scriptName = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api'));
    $basePath = rtrim($scriptName, '/');

    if ($basePath !== '' && strpos($uriPath, $basePath) === 0) {
        $uriPath = substr($uriPath, strlen($basePath));
    }

    if ($uriPath === '' || $uriPath === false || $uriPath === '/index.php') {
        return '/';
    }

    return $uriPath;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);

    if (!is_array($data)) {
        throw new RuntimeException('Invalid JSON');
    }

    return $data;
}

function decode_json(string $payload)
{
    return json_decode($payload, true);
}

function encode_json($payload): string
{
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }

    $encoded = json_encode($payload, $flags);
    if ($encoded !== false) {
        return $encoded;
    }

    $message = function_exists('json_last_error_msg') ? json_last_error_msg() : 'JSON encode failed';
    return '{"ok":false,"error":"JSON encode failed","code":"json_encode_failed","detail":' .
        json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) .
        '}';
}

function send_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo encode_json($payload);
    exit;
}

function send_sql_download(string $sql, string $filename): void
{
    $cleanName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $filename) ?: 'eicerik-backup.sql';
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $cleanName . '"');
    header('Cache-Control: no-store');
    echo $sql;
    exit;
}

function require_admin_token(array $config): void
{
    $expected = trim((string) ($config['admin_token'] ?? ''));
    if ($expected === '') {
        send_json(503, [
            'ok' => false,
            'code' => 'ADMIN_DISABLED',
            'error' => 'Admin API devre disi.',
        ]);
    }
    $provided = trim((string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''));
    if ($provided === '' || !hash_equals($expected, $provided)) {
        send_json(403, [
            'ok' => false,
            'code' => 'ADMIN_FORBIDDEN',
            'error' => 'Admin yetkisi gerekli.',
        ]);
    }
}

function quote_mysql_identifier(string $value): string
{
    return '`' . str_replace('`', '``', $value) . '`';
}

function quote_mysql_value(PDO $pdo, $value): string
{
    if ($value === null) return 'NULL';
    if (is_int($value) || is_float($value)) return (string) $value;
    return $pdo->quote((string) $value);
}

function build_mysql_backup(PDO $pdo): string
{
    $tables = ['app_state', 'projects', 'project_versions'];
    $lines = [
        '-- E-Icerik Editor MySQL backup',
        '-- Created at: ' . gmdate('c'),
        '-- Includes persistent content tables only; sessions and locks are intentionally excluded.',
        'SET NAMES utf8mb4;',
        'SET FOREIGN_KEY_CHECKS=0;',
        '',
    ];

    foreach ($tables as $tableName) {
        $quotedTable = quote_mysql_identifier($tableName);
        $schemaStmt = $pdo->query('SHOW CREATE TABLE ' . $quotedTable);
        $schemaRow = $schemaStmt ? $schemaStmt->fetch(PDO::FETCH_ASSOC) : null;
        if (!$schemaRow) {
            continue;
        }
        $createSql = $schemaRow['Create Table'] ?? array_values($schemaRow)[1] ?? '';
        if ($createSql === '') {
            continue;
        }

        $lines[] = 'DROP TABLE IF EXISTS ' . $quotedTable . ';';
        $lines[] = $createSql . ';';

        $rows = $pdo->query('SELECT * FROM ' . $quotedTable);
        if ($rows) {
            while ($row = $rows->fetch(PDO::FETCH_ASSOC)) {
                $columns = array_keys($row);
                $columnSql = implode(', ', array_map('quote_mysql_identifier', $columns));
                $valueSql = implode(', ', array_map(function ($value) use ($pdo) {
                    return quote_mysql_value($pdo, $value);
                }, array_values($row)));
                $lines[] = 'INSERT INTO ' . $quotedTable . ' (' . $columnSql . ') VALUES (' . $valueSql . ');';
            }
        }
        $lines[] = '';
    }

    $lines[] = 'SET FOREIGN_KEY_CHECKS=1;';
    $lines[] = '';
    return implode("\n", $lines);
}

function clamp_number(float $value, float $min, float $max): float
{
    return min($max, max($min, $value));
}

function extract_json_payload(string $text): ?array
{
    $raw = trim($text);
    if ($raw === '') {
        return null;
    }

    $raw = preg_replace('/^```(?:json)?\s*/i', '', $raw) ?? $raw;
    $raw = preg_replace('/\s*```$/i', '', $raw) ?? $raw;
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        return $decoded;
    }

    $start = strpos($raw, '{');
    $end = strrpos($raw, '}');
    if ($start === false || $end === false || $end <= $start) {
        return null;
    }

    $decoded = json_decode(substr($raw, $start, $end - $start + 1), true);
    return is_array($decoded) ? $decoded : null;
}

function parse_data_url(string $dataUrl): ?array
{
    if (!preg_match('/^data:(.*?);base64,(.*)$/', $dataUrl, $matches)) {
        return null;
    }

    return [
        'mimeType' => $matches[1] ?: 'image/png',
        'data' => $matches[2] ?: '',
    ];
}

function normalize_pdf_ai_layout(?array $layout, int $stageWidth = 1920, int $stageHeight = 1080): ?array
{
    if (!$layout) {
        return null;
    }

    $normalizeRect = static function ($rect, int $minSize = 18) use ($stageWidth, $stageHeight): ?array {
        if (!is_array($rect)) {
            return null;
        }
        $width = clamp_number((float) ($rect['width'] ?? 0), $minSize, $stageWidth);
        $height = clamp_number((float) ($rect['height'] ?? 0), $minSize, $stageHeight);
        $x = clamp_number((float) ($rect['x'] ?? 0), 0, max(0, $stageWidth - $width));
        $y = clamp_number((float) ($rect['y'] ?? 0), 0, max(0, $stageHeight - $height));
        return ['x' => $x, 'y' => $y, 'width' => $width, 'height' => $height];
    };

    $anchors = [];
    foreach (($layout['questionAnchors'] ?? []) as $index => $anchor) {
        if (!is_array($anchor)) {
            continue;
        }
        $width = clamp_number((float) ($anchor['width'] ?? 0), 24, $stageWidth);
        $height = clamp_number((float) ($anchor['height'] ?? 0), 20, $stageHeight);
        $anchors[] = [
            'order' => max(1, (int) round((float) ($anchor['order'] ?? ($index + 1)))),
            'text' => trim((string) ($anchor['text'] ?? '')),
            'x' => clamp_number((float) ($anchor['x'] ?? 0), 0, max(0, $stageWidth - $width)),
            'y' => clamp_number((float) ($anchor['y'] ?? 0), 0, max(0, $stageHeight - $height)),
            'width' => $width,
            'height' => $height,
        ];
    }
    usort($anchors, static fn(array $a, array $b): int => ($a['order'] <=> $b['order']) ?: ($a['y'] <=> $b['y']) ?: ($a['x'] <=> $b['x']));

    $kindHint = trim((string) ($layout['kindHint'] ?? 'unknown'));
    if (!in_array($kindHint, ['drag-drop', 'selection', 'sequence', 'reading', 'video'], true)) {
        $kindHint = 'unknown';
    }

    $cleanupRects = [];
    foreach (($layout['cleanupRects'] ?? []) as $rect) {
        $normalized = $normalizeRect($rect, 20);
        if ($normalized) {
            $cleanupRects[] = $normalized;
        }
    }

    $toUniqueList = static function ($items): array {
        if (!is_array($items)) {
            return [];
        }
        $values = [];
        foreach ($items as $item) {
            $text = trim((string) $item);
            if ($text !== '' && !in_array($text, $values, true)) {
                $values[] = $text;
            }
        }
        return $values;
    };

    return [
        'kindHint' => $kindHint,
        'dragPoolRect' => $normalizeRect($layout['dragPoolRect'] ?? null, 28),
        'questionAnchors' => $anchors,
        'cleanupRects' => $cleanupRects,
        'draggableTerms' => $toUniqueList($layout['draggableTerms'] ?? []),
        'answerTerms' => $toUniqueList($layout['answerTerms'] ?? []),
        'notes' => trim((string) ($layout['notes'] ?? '')),
    ];
}

function build_pdf_ai_prompt(array $payload): string
{
    $rawText = trim((string) ($payload['rawText'] ?? ''));
    if (strlen($rawText) > 12000) {
        $rawText = substr($rawText, 0, 12000);
    }

    $parts = [
        'Sen Turkce egitim PDF sayfasindaki yerlestirme yapisini cikaransin.',
        'Gorsel verilen sahne boyutuna gore hizalandi ve koordinatlar sol-ust origin ile donulecek.',
        'Sadece gecerli JSON don. Aciklama, markdown veya kod blogu kullanma.',
        'JSON formati:',
        '{',
        '  "kindHint": "drag-drop" | "selection" | "sequence" | "reading" | "video" | "unknown",',
        '  "dragPoolRect": {"x":0,"y":0,"width":0,"height":0} veya null,',
        '  "questionAnchors": [{"order":1,"text":"...","x":0,"y":0,"width":0,"height":0}],',
        '  "cleanupRects": [{"x":0,"y":0,"width":0,"height":0,"reason":"drag-pool|answer-key|note"}],',
        '  "draggableTerms": ["..."],',
        '  "answerTerms": ["..."],',
        '  "notes": "kisa not"',
        '}',
        'Kurallar:',
        '- questionAnchors sadece numarali soru/blank satirlari olsun.',
        '- dragPoolRect sadece sagdaki suruklenebilir kelime havuzunu kapsasin.',
        '- cleanupRects soru metnini silmesin; sadece temizlenecek havuz, cevap anahtari veya not alanlarini kapsasin.',
        '- Emin degilsen null veya bos dizi don.',
    ];

    if ($rawText !== '') {
        $parts[] = 'Ham metin yardimi: ' . $rawText;
    }

    return implode("\n", $parts);
}

function http_post_json(string $url, array $headers, array $payload, int $timeout = 45): array
{
    $body = encode_json($payload);
    $headerLines = array_merge(['Content-Type: application/json'], $headers);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_TIMEOUT => $timeout,
        ]);
        $responseBody = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($responseBody === false) {
            throw new RuntimeException($error !== '' ? $error : 'HTTP request failed');
        }
        return ['status' => $status, 'body' => (string) $responseBody];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headerLines),
            'content' => $body,
            'timeout' => $timeout,
            'ignore_errors' => true,
        ],
    ]);
    $responseBody = file_get_contents($url, false, $context);
    if ($responseBody === false) {
        throw new RuntimeException('HTTP request failed');
    }
    $status = 200;
    foreach ($http_response_header ?? [] as $header) {
        if (preg_match('#HTTP/\S+\s+(\d{3})#', $header, $matches) === 1) {
            $status = (int) $matches[1];
            break;
        }
    }

    return ['status' => $status, 'body' => (string) $responseBody];
}

function request_pdf_ai_layout(array $config, array $payload): array
{
    return [
        'ok' => true,
        'enabled' => false,
        'provider' => 'offline',
        'layout' => null,
        'warning' => 'Cloud baglantili PDF analizi kaldirildi; cevrimdisi analiz kullaniliyor.',
    ];
}

function ensure_workspace_schema(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_state (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            payload LONGTEXT NOT NULL,
            updated_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS projects (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            payload LONGTEXT NOT NULL,
            saved_at VARCHAR(40) NOT NULL,
            created_at VARCHAR(40) NULL,
            published_version_id VARCHAR(64) NULL,
            INDEX idx_projects_saved_at (saved_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS book_locks (
            project_id VARCHAR(64)  NOT NULL,
            book_id    VARCHAR(64)  NOT NULL,
            user_id    VARCHAR(64)  NOT NULL,
            user_name  VARCHAR(255) NOT NULL DEFAULT "",
            session_id VARCHAR(128) NOT NULL,
            locked_at  DATETIME     NOT NULL,
            PRIMARY KEY (project_id, book_id),
            INDEX idx_book_locks_session (session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS user_sessions (
            session_id        VARCHAR(128) NOT NULL PRIMARY KEY,
            user_id           VARCHAR(64)  NOT NULL,
            session_label     VARCHAR(255) NOT NULL DEFAULT "",
            last_seen_at      DATETIME     NOT NULL,
            kick_requested_at DATETIME     NULL,
            INDEX idx_user_sessions_user_last (user_id, last_seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    ensure_user_sessions_column(
        $pdo, 'kick_requested_at',
        'ALTER TABLE user_sessions ADD COLUMN kick_requested_at DATETIME NULL'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS project_versions (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            version_no INT UNSIGNED NOT NULL,
            label VARCHAR(255) NOT NULL,
            payload LONGTEXT NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            is_published TINYINT(1) NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_project_version_no (project_id, version_no),
            INDEX idx_project_versions_project_created (project_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $hasLegacyState = column_exists($pdo, 'projects', 'state');
    $hasLegacyDraftUpdatedAt = column_exists($pdo, 'projects', 'draft_updated_at');

    ensure_projects_column($pdo, 'payload', 'ALTER TABLE projects ADD COLUMN payload LONGTEXT NULL AFTER name');
    ensure_projects_column($pdo, 'saved_at', 'ALTER TABLE projects ADD COLUMN saved_at VARCHAR(40) NULL AFTER payload');
    ensure_projects_column($pdo, 'created_at', 'ALTER TABLE projects ADD COLUMN created_at VARCHAR(40) NULL AFTER saved_at');
    ensure_projects_column($pdo, 'published_version_id', 'ALTER TABLE projects ADD COLUMN published_version_id VARCHAR(64) NULL AFTER created_at');

    if ($hasLegacyState) {
        $pdo->exec('UPDATE projects SET payload = state WHERE (payload IS NULL OR payload = "") AND state IS NOT NULL AND state != ""');
    }
    if ($hasLegacyDraftUpdatedAt) {
        $pdo->exec('UPDATE projects SET saved_at = draft_updated_at WHERE (saved_at IS NULL OR saved_at = "") AND draft_updated_at IS NOT NULL AND draft_updated_at != ""');
    }
    $emptyState = encode_json(empty_editor_state());
    $stmt = $pdo->prepare('UPDATE projects SET payload = :payload WHERE payload IS NULL OR payload = ""');
    $stmt->execute([':payload' => $emptyState]);
    $pdo->exec('UPDATE projects SET saved_at = UTC_TIMESTAMP() WHERE saved_at IS NULL OR saved_at = ""');
    $pdo->exec('UPDATE projects SET created_at = saved_at WHERE created_at IS NULL OR created_at = ""');
}

function ensure_workspace_schema_if_required(PDO $pdo): void
{
    if (!workspace_schema_is_current($pdo)) {
        ensure_workspace_schema($pdo);
    }
}

function workspace_schema_is_current(PDO $pdo): bool
{
    $requiredColumns = [
        'app_state' => ['id', 'payload', 'updated_at'],
        'projects' => ['id', 'name', 'payload', 'saved_at', 'created_at', 'published_version_id'],
        'book_locks' => ['project_id', 'book_id', 'user_id', 'user_name', 'session_id', 'locked_at'],
        'user_sessions' => ['session_id', 'user_id', 'session_label', 'last_seen_at', 'kick_requested_at'],
        'project_versions' => ['id', 'project_id', 'version_no', 'label', 'payload', 'created_at', 'is_published'],
    ];

    try {
        $stmt = $pdo->query(
            "SELECT TABLE_NAME, COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME IN ('app_state', 'projects', 'book_locks', 'user_sessions', 'project_versions')"
        );
        $foundColumns = [];
        foreach ($stmt as $row) {
            $tableName = (string) ($row['TABLE_NAME'] ?? '');
            $columnName = (string) ($row['COLUMN_NAME'] ?? '');
            if ($tableName !== '' && $columnName !== '') {
                $foundColumns[$tableName][$columnName] = true;
            }
        }

        foreach ($requiredColumns as $tableName => $columns) {
            foreach ($columns as $columnName) {
                if (empty($foundColumns[$tableName][$columnName])) {
                    return false;
                }
            }
        }
    } catch (Throwable $error) {
        return false;
    }

    return true;
}

function has_placeholder_database_config(array $config): bool
{
    $required = ['db_host', 'db_name', 'db_user', 'db_pass'];
    foreach ($required as $key) {
        if (!array_key_exists($key, $config) || trim((string) $config[$key]) === '') {
            return true;
        }
    }

    $placeholderValues = [
        'veritabani_adi',
        'veritabani_kullanici',
        'veritabani_sifre',
    ];

    foreach (['db_name', 'db_user', 'db_pass'] as $key) {
        if (in_array(trim((string) $config[$key]), $placeholderValues, true)) {
            return true;
        }
    }

    return false;
}

function column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $tableName)) {
        throw new InvalidArgumentException('Invalid table name');
    }
    $stmt = $pdo->prepare("SHOW COLUMNS FROM `$tableName` LIKE :column_name");
    $stmt->execute([':column_name' => $columnName]);
    return (bool) $stmt->fetch();
}

function ensure_projects_column(PDO $pdo, string $columnName, string $sql): void
{
    if (!column_exists($pdo, 'projects', $columnName)) {
        $pdo->exec($sql);
    }
}

function get_user_display_name(array $config, string $userId): string
{
    foreach ($config['users'] ?? [] as $u) {
        if (($u['id'] ?? '') === $userId) {
            return $u['name'] ?? $userId;
        }
    }
    $defaults = ['kullanici1' => 'Kullanici 1', 'kullanici2' => 'Kullanici 2'];
    return $defaults[$userId] ?? $userId;
}

function ensure_user_sessions_column(PDO $pdo, string $columnName, string $sql): void
{
    try {
        $stmt = $pdo->prepare('SHOW COLUMNS FROM user_sessions LIKE :column_name');
        $stmt->execute([':column_name' => $columnName]);
        if (!$stmt->fetch()) {
            $pdo->exec($sql);
        }
    } catch (Throwable $e) {
        // Table may not exist yet — silently skip
    }
}

function empty_editor_state(): array
{
    return [
        'publishers' => [],
        'books' => [],
        'activities' => [],
        'selPubId' => null,
        'selBookId' => null,
        'selActId' => null,
        'lmsConfig' => [
            'scormVersion' => '1.2',
            'packageName' => 'E-Icerik Paketi',
            'packageCode' => 'EIC-001',
            'version' => '1.0.0',
        ],
    ];
}

function is_editor_state($payload): bool
{
    return is_array($payload) && (
        array_key_exists('publishers', $payload) ||
        array_key_exists('books', $payload) ||
        array_key_exists('activities', $payload)
    );
}

function is_workspace_meta($payload): bool
{
    return is_array($payload) && array_key_exists('currentProjectId', $payload);
}

function get_app_state(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT payload, updated_at FROM app_state WHERE id = 1 LIMIT 1');
    $row = $stmt->fetch();

    if (!$row) {
        return ['payload' => null, 'updatedAt' => null];
    }

    return [
        'payload' => decode_json($row['payload']),
        'updatedAt' => $row['updated_at'],
    ];
}

function save_workspace_meta(PDO $pdo, string $currentProjectId): string
{
    $updatedAt = gmdate('c');
    $stmt = $pdo->prepare(
        'INSERT INTO app_state (id, payload, updated_at)
         VALUES (1, :payload, :updated_at)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)'
    );
    $stmt->execute([
        ':payload' => encode_json([
            'workspaceVersion' => 1,
            'currentProjectId' => $currentProjectId,
        ]),
        ':updated_at' => $updatedAt,
    ]);

    return $updatedAt;
}

function set_workspace_current_project(PDO $pdo, string $currentProjectId): void
{
    save_workspace_meta($pdo, $currentProjectId);
}

function ensure_workspace(PDO $pdo): array
{
    $appState = get_app_state($pdo);
    $payload = $appState['payload'];

    if (is_editor_state($payload)) {
        $project = create_project($pdo, 'Varsayilan Proje', $payload);
        save_workspace_meta($pdo, $project['id']);
        return build_workspace($pdo, $project['id']);
    }

    $currentProjectId = null;
    if (is_workspace_meta($payload)) {
        $currentProjectId = trim((string) ($payload['currentProjectId'] ?? ''));
    }

    if ($currentProjectId !== '' && project_exists($pdo, $currentProjectId)) {
        return build_workspace($pdo, $currentProjectId);
    }

    $projects = list_projects($pdo);
    if (count($projects) > 0) {
        $currentProjectId = $projects[0]['id'];
        save_workspace_meta($pdo, $currentProjectId);
        return build_workspace($pdo, $currentProjectId);
    }

    $project = create_project($pdo, 'Varsayilan Proje', empty_editor_state());
    save_workspace_meta($pdo, $project['id']);
    return build_workspace($pdo, $project['id']);
}

function build_workspace(PDO $pdo, string $currentProjectId): array
{
    $currentProject = get_project($pdo, $currentProjectId);

    if (!$currentProject) {
        throw new RuntimeException('Current project not found');
    }

    return [
        'currentProject' => project_summary_from_project($currentProject),
        'projects' => list_projects($pdo),
        'versions' => list_project_versions($pdo, $currentProjectId),
        'state' => $currentProject['state'],
        'updatedAt' => $currentProject['draftUpdatedAt'],
    ];
}

function list_projects(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT id, name, saved_at, created_at, published_version_id FROM projects ORDER BY saved_at DESC');
    $projects = [];

    foreach ($stmt as $row) {
        $projects[] = project_summary_from_row($row);
    }

    return $projects;
}

function project_exists(PDO $pdo, string $projectId): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM projects WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $projectId]);
    return (bool) $stmt->fetchColumn();
}

function get_project(PDO $pdo, string $projectId): ?array
{
    $stmt = $pdo->prepare('SELECT id, name, payload, saved_at, created_at, published_version_id FROM projects WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $projectId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'state' => decode_json($row['payload']) ?? empty_editor_state(),
        'draftUpdatedAt' => $row['saved_at'],
        'createdAt' => $row['created_at'] ?: $row['saved_at'],
        'publishedVersionId' => $row['published_version_id'] ?: null,
    ];
}

function get_project_summary(PDO $pdo, string $projectId): ?array
{
    $project = get_project($pdo, $projectId);
    return $project ? project_summary_from_project($project) : null;
}

function project_summary_from_project(array $project): array
{
    return [
        'id' => $project['id'],
        'name' => $project['name'],
        'draftUpdatedAt' => $project['draftUpdatedAt'],
        'createdAt' => $project['createdAt'],
        'publishedVersionId' => $project['publishedVersionId'],
    ];
}

function project_summary_from_row(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'draftUpdatedAt' => $row['saved_at'],
        'createdAt' => $row['created_at'] ?: $row['saved_at'],
        'publishedVersionId' => $row['published_version_id'] ?: null,
    ];
}

function create_project(PDO $pdo, string $name, $state): array
{
    $projectId = bin2hex(random_bytes(16));
    $projectName = trim($name) !== '' ? trim($name) : 'Yeni Proje';
    $timestamp = gmdate('c');

    $stmt = $pdo->prepare(
        'INSERT INTO projects (id, name, payload, saved_at, created_at, published_version_id)
         VALUES (:id, :name, :payload, :saved_at, :created_at, NULL)'
    );
    $stmt->execute([
        ':id' => $projectId,
        ':name' => $projectName,
        ':payload' => encode_json($state),
        ':saved_at' => $timestamp,
        ':created_at' => $timestamp,
    ]);

    return get_project($pdo, $projectId);
}

function save_project_draft(PDO $pdo, string $projectId, $state, ?string $name = null): array
{
    $project = get_project($pdo, $projectId);
    if (!$project) {
        throw new RuntimeException('Project not found');
    }

    $timestamp = gmdate('c');
    $projectName = $name !== null && trim($name) !== '' ? trim($name) : $project['name'];

    $stmt = $pdo->prepare(
        'UPDATE projects
         SET name = :name, payload = :payload, saved_at = :saved_at
         WHERE id = :id'
    );
    $stmt->execute([
        ':id' => $projectId,
        ':name' => $projectName,
        ':payload' => encode_json($state),
        ':saved_at' => $timestamp,
    ]);

    return get_project($pdo, $projectId);
}

function list_project_versions(PDO $pdo, string $projectId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, project_id, version_no, label, created_at, is_published
         FROM project_versions
         WHERE project_id = :project_id
         ORDER BY version_no DESC'
    );
    $stmt->execute([':project_id' => $projectId]);

    $versions = [];
    foreach ($stmt as $row) {
        $versions[] = [
            'id' => $row['id'],
            'projectId' => $row['project_id'],
            'versionNo' => (int) $row['version_no'],
            'label' => $row['label'],
            'createdAt' => $row['created_at'],
            'isPublished' => (bool) $row['is_published'],
        ];
    }

    return $versions;
}

function create_project_version(PDO $pdo, string $projectId, string $label, bool $publish = false, $stateOverride = null): array
{
    $project = get_project($pdo, $projectId);
    if (!$project) {
        throw new RuntimeException('Project not found');
    }

    $stmt = $pdo->prepare('SELECT COALESCE(MAX(version_no), 0) FROM project_versions WHERE project_id = :project_id');
    $stmt->execute([':project_id' => $projectId]);
    $nextVersionNo = (int) $stmt->fetchColumn() + 1;

    $versionId = bin2hex(random_bytes(16));
    $createdAt = gmdate('c');
    $versionLabel = trim($label) !== '' ? trim($label) : ('Sürüm ' . $nextVersionNo);
    $payload = $stateOverride ?? $project['state'];

    if ($publish) {
        $clearStmt = $pdo->prepare('UPDATE project_versions SET is_published = 0 WHERE project_id = :project_id');
        $clearStmt->execute([':project_id' => $projectId]);
    }

    $insertStmt = $pdo->prepare(
        'INSERT INTO project_versions (id, project_id, version_no, label, payload, created_at, is_published)
         VALUES (:id, :project_id, :version_no, :label, :payload, :created_at, :is_published)'
    );
    $insertStmt->execute([
        ':id' => $versionId,
        ':project_id' => $projectId,
        ':version_no' => $nextVersionNo,
        ':label' => $versionLabel,
        ':payload' => encode_json($payload),
        ':created_at' => $createdAt,
        ':is_published' => $publish ? 1 : 0,
    ]);

    if ($publish) {
        $projectStmt = $pdo->prepare('UPDATE projects SET published_version_id = :version_id WHERE id = :id');
        $projectStmt->execute([
            ':id' => $projectId,
            ':version_id' => $versionId,
        ]);
    }

    return [
        'id' => $versionId,
        'projectId' => $projectId,
        'versionNo' => $nextVersionNo,
        'label' => $versionLabel,
        'createdAt' => $createdAt,
        'isPublished' => $publish,
    ];
}

function restore_project_version(PDO $pdo, string $projectId, string $versionId): void
{
    $stmt = $pdo->prepare(
        'SELECT id, payload
         FROM project_versions
         WHERE id = :id AND project_id = :project_id
         LIMIT 1'
    );
    $stmt->execute([
        ':id' => $versionId,
        ':project_id' => $projectId,
    ]);
    $version = $stmt->fetch();

    if (!$version) {
        throw new RuntimeException('Version not found');
    }

    $savedAt = gmdate('c');
    $updateStmt = $pdo->prepare(
        'UPDATE projects
         SET payload = :payload, saved_at = :saved_at
         WHERE id = :id'
    );
    $updateStmt->execute([
        ':id' => $projectId,
        ':payload' => $version['payload'],
        ':saved_at' => $savedAt,
    ]);
}

function publish_project_version(PDO $pdo, string $projectId, string $versionId): void
{
    $stmt = $pdo->prepare(
        'SELECT id
         FROM project_versions
         WHERE id = :id AND project_id = :project_id
         LIMIT 1'
    );
    $stmt->execute([
        ':id' => $versionId,
        ':project_id' => $projectId,
    ]);
    $version = $stmt->fetch();

    if (!$version) {
        throw new RuntimeException('Version not found');
    }

    $clearStmt = $pdo->prepare('UPDATE project_versions SET is_published = 0 WHERE project_id = :project_id');
    $clearStmt->execute([':project_id' => $projectId]);

    $publishStmt = $pdo->prepare('UPDATE project_versions SET is_published = 1 WHERE id = :id');
    $publishStmt->execute([':id' => $versionId]);

    $projectStmt = $pdo->prepare('UPDATE projects SET published_version_id = :version_id WHERE id = :id');
    $projectStmt->execute([
        ':id' => $projectId,
        ':version_id' => $versionId,
    ]);
}

function delete_project(PDO $pdo, string $projectId): void
{
    $deleteVersions = $pdo->prepare('DELETE FROM project_versions WHERE project_id = :project_id');
    $deleteVersions->execute([':project_id' => $projectId]);

    $deleteProject = $pdo->prepare('DELETE FROM projects WHERE id = :id');
    $deleteProject->execute([':id' => $projectId]);
}

function prepare_scorm_export(array $project): array
{
    $state = normalize_scorm_state($project['state'] ?? []);
    $assets = [];
    $assetMap = [];
    $state = rewrite_scorm_assets($state, $assets, $assetMap);

    return [
        'state' => $state,
        'assets' => $assets,
        'assetFiles' => array_values(array_map(static fn(array $asset): string => $asset['target'], $assets)),
    ];
}

function normalize_scorm_state($state): array
{
    if (!is_array($state)) {
        return empty_editor_state();
    }

    return array_merge(
        empty_editor_state(),
        $state,
        [
            'activities' => array_values(array_filter($state['activities'] ?? [], static fn($activity): bool => is_array($activity))),
            'lmsConfig' => array_merge(
                [
                    'packageName' => 'E-Icerik Paketi',
                    'packageCode' => 'EIC-001',
                    'version' => '1.0.0',
                    'standard' => 'scorm12',
                    'passingScore' => 70,
                ],
                is_array($state['lmsConfig'] ?? null) ? $state['lmsConfig'] : []
            ),
        ]
    );
}

function rewrite_scorm_assets($value, array &$assets, array &$assetMap)
{
    if (is_array($value)) {
        foreach ($value as $key => $item) {
            $value[$key] = rewrite_scorm_assets($item, $assets, $assetMap);
        }

        return $value;
    }

    if (!is_string($value)) {
        return $value;
    }

    $trimmed = trim($value);
    if (
        $trimmed === '' ||
        str_starts_with($trimmed, 'data:') ||
        str_starts_with($trimmed, 'http://') ||
        str_starts_with($trimmed, 'https://') ||
        str_starts_with($trimmed, '//') ||
        str_starts_with($trimmed, '#')
    ) {
        return $value;
    }

    $path = parse_url($trimmed, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return $value;
    }

    $normalizedPath = ltrim(str_replace('\\', '/', $path), '/');
    if (
        !str_starts_with($normalizedPath, 'static/uploads/') &&
        !str_starts_with($normalizedPath, 'uploads/')
    ) {
        return $value;
    }

    $fullPath = realpath(dirname(__DIR__) . '/' . $normalizedPath);
    if (!$fullPath || !is_file($fullPath)) {
        return $value;
    }

    if (isset($assetMap[$fullPath])) {
        return $assetMap[$fullPath];
    }

    $targetName = 'assets/' . substr(sha1($fullPath), 0, 10) . '-' . preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($fullPath));
    $assets[] = [
        'source' => $fullPath,
        'target' => $targetName,
    ];
    $assetMap[$fullPath] = $targetName;

    return $targetName;
}

function build_scorm_player_html(array $project, array $state): string
{
    $templatePath = dirname(__DIR__) . '/scorm/player-template.html';
    if (!is_file($templatePath)) {
        throw new RuntimeException('SCORM player template not found.');
    }

    $template = file_get_contents($templatePath);
    if ($template === false) {
        throw new RuntimeException('SCORM player template could not be read.');
    }

    $lmsConfig = is_array($state['lmsConfig'] ?? null) ? $state['lmsConfig'] : [];
    $bootstrap = [
        'project' => [
            'id' => $project['id'] ?? '',
            'name' => $project['name'] ?? 'SCORM Paket',
        ],
        'state' => $state,
        'generatedAt' => gmdate('c'),
    ];

    $bootstrapJson = json_encode(
        $bootstrap,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
    );

    if ($bootstrapJson === false) {
        throw new RuntimeException('SCORM payload could not be encoded.');
    }

    return strtr($template, [
        '__PROJECT_TITLE__' => htmlspecialchars((string) ($project['name'] ?? 'SCORM Paket'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
        '__BOOTSTRAP_JSON__' => $bootstrapJson,
        '__SCORM_STANDARD__' => htmlspecialchars(normalize_scorm_standard((string) ($lmsConfig['standard'] ?? 'scorm12')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
        '__PASSING_SCORE__' => (string) max(0, min(100, (int) ($lmsConfig['passingScore'] ?? 70))),
    ]);
}

function build_scorm_manifest(array $project, array $assetFiles = [], ?array $state = null): string
{
    $state = normalize_scorm_state($state ?? ($project['state'] ?? []));
    $lmsConfig = is_array($state['lmsConfig'] ?? null) ? $state['lmsConfig'] : [];
    $standard = normalize_scorm_standard((string) ($lmsConfig['standard'] ?? 'scorm12'));
    $identifier = 'MANIFEST-' . scorm_slug((string) ($project['id'] ?? 'project'));
    $resourceId = 'RES-' . substr(sha1((string) ($project['id'] ?? 'project')), 0, 8);
    $organizationId = 'ORG-' . substr(sha1((string) ($project['name'] ?? 'project')), 0, 8);
    $title = xml_escape((string) ($lmsConfig['packageName'] ?? $project['name'] ?? 'SCORM Paket'));
    $version = xml_escape((string) ($lmsConfig['version'] ?? '1.0.0'));
    $resourceFiles = array_unique(['index.html', 'README.txt', ...$assetFiles]);
    $resourceEntries = implode("\n", array_map(
        static fn(string $file): string => '      <file href="' . xml_escape($file) . '"/>',
        $resourceFiles
    ));

    if ($standard === 'scorm2004') {
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{$identifier}" version="{$version}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
  http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
  http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
  http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="{$organizationId}">
    <organization identifier="{$organizationId}">
      <title>{$title}</title>
      <item identifier="ITEM-1" identifierref="{$resourceId}">
        <title>{$title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="{$resourceId}" type="webcontent" adlcp:scormType="sco" href="index.html">
{$resourceEntries}
    </resource>
  </resources>
</manifest>
XML;
    }

    return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{$identifier}" version="{$version}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
  http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="{$organizationId}">
    <organization identifier="{$organizationId}">
      <title>{$title}</title>
      <item identifier="ITEM-1" identifierref="{$resourceId}" isvisible="true">
        <title>{$title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="{$resourceId}" type="webcontent" adlcp:scormtype="sco" href="index.html">
{$resourceEntries}
    </resource>
  </resources>
</manifest>
XML;
}

function build_scorm_readme(array $project, ?array $state = null): string
{
    $state = normalize_scorm_state($state ?? ($project['state'] ?? []));
    $lmsConfig = is_array($state['lmsConfig'] ?? null) ? $state['lmsConfig'] : [];

    return implode("\r\n", [
        'SCORM export package',
        '--------------------',
        'Project: ' . ($project['name'] ?? 'SCORM Paket'),
        'Code: ' . (string) ($lmsConfig['packageCode'] ?? 'EIC-001'),
        'Version: ' . (string) ($lmsConfig['version'] ?? '1.0.0'),
        'Standard: ' . strtoupper(normalize_scorm_standard((string) ($lmsConfig['standard'] ?? 'scorm12'))),
        'Activities: ' . count($state['activities'] ?? []),
        'Generated: ' . gmdate('Y-m-d H:i:s') . ' UTC',
        '',
        'This package launches the student-facing player from index.html.',
        'Upload the ZIP file directly to your LMS as a SCORM package.',
    ]);
}

function normalize_scorm_standard(string $standard): string
{
    $normalized = strtolower(trim($standard));
    return str_contains($normalized, '2004') ? 'scorm2004' : 'scorm12';
}

function scorm_slug(string $value): string
{
    $slug = preg_replace('/[^a-zA-Z0-9]+/', '-', strtolower(trim($value)));
    return trim((string) $slug, '-') ?: 'project';
}

function xml_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1 | ENT_SUBSTITUTE, 'UTF-8');
}
