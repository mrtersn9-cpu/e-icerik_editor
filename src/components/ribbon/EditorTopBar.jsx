import {
  Archive,
  ChevronDown,
  CircleHelp,
  Database,
  Download,
  Expand,
  FolderKanban,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  Palette,
  Redo2,
  Save,
  Settings,
  Undo2,
} from 'lucide-react';

import PresenceBar from '../../features/presence/PresenceBar';

import styles from './EditorTopBar.module.css';

function QuickAction({ icon: Icon, label, onClick, disabled = false, title }) {
  return (
    <button className={styles.quickAction} type="button" onClick={onClick} disabled={disabled} title={title || label}>
      <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function TextAction({ icon: Icon, label, onClick, disabled = false, active = false, title }) {
  return (
    <button
      className={`${styles.textAction} ${active ? styles.textActionActive : ''}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

function IconAction({ icon: Icon, label, onClick }) {
  return (
    <button className={styles.iconAction} type="button" onClick={onClick} title={label} aria-label={label}>
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}

function Breadcrumb({ label, onClick, title }) {
  return (
    <button className={styles.crumb} type="button" onClick={onClick} title={title || label}>
      {label}
    </button>
  );
}

export default function EditorTopBar({
  activeUser,
  currentProject,
  currentView,
  dbStatus,
  handleExport,
  handleImport,
  handleLogout,
  handleOpenStorylinePreview,
  history,
  importRef,
  lastSaved,
  onManualSave,
  manualSaving = false,
  redo,
  selActivity,
  onBackToActivities,
  onBackToBooks,
  onBackToPublishers,
  setAnswerDrawerOpen,
  onToggleFullscreen,
  onlineUsers = [],
  currentBookEditor = null,
  setDesignToolsOpen,
  setShowAdminManagement,
  setShowProjectManager,
  setShowReviewThreads,
  setStoryRibbonTab,
  undo,
}) {
  const isEditor = currentView === 'editor';
  const projectName = currentProject?.name || 'Proje';
  const savedLabel =
    dbStatus === 'connected'
      ? lastSaved
        ? 'Kaydedildi'
        : 'Hazır'
      : dbStatus === 'reconnecting'
        ? 'Yerel taslak'
        : dbStatus === 'auth-required'
          ? 'Oturum gerekli'
          : 'Bağlantı bekleniyor';
  const databaseLabel =
    dbStatus === 'connected'
      ? 'Veritabanı bağlı'
      : dbStatus === 'reconnecting'
        ? 'SQL kesildi'
        : dbStatus === 'auth-required'
          ? 'Oturum gerekli'
          : 'Bağlanıyor';
  const activeUserInitial =
    String(activeUser?.name || activeUser?.id || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <img src="/logo-light.svg" height={25} alt="E-İçerik Studio" />
      </div>

      <div className={styles.divider} />

      <div className={styles.project}>
        <FolderKanban size={15} aria-hidden="true" />
        <span title={projectName}>{projectName}</span>
        <small>{isEditor ? 'Düzenleme' : 'Kütüphane'}</small>
      </div>

      {isEditor && (
        <nav className={styles.breadcrumbs} aria-label="Kütüphane dönüşleri">
          <Breadcrumb label="Yayınevi" title="Yayınevi seçimine dön" onClick={onBackToPublishers} />
          <Breadcrumb label="Kitap" title="Kitap seçimine dön" onClick={onBackToBooks} />
          <Breadcrumb label="Etkinlik" title="Etkinlik listesine dön" onClick={onBackToActivities} />
        </nav>
      )}

      {isEditor && (
        <div className={styles.editorActions}>
          <QuickAction icon={Undo2} label="Geri Al" onClick={undo} disabled={!history?.past?.length} title="Geri Al (Ctrl+Z)" />
          <QuickAction icon={Redo2} label="İleri Al" onClick={redo} disabled={!history?.future?.length} title="İleri Al (Ctrl+Y)" />
          {onManualSave && (
            <QuickAction
              icon={Save}
              label={manualSaving ? 'Kaydediliyor…' : 'Kaydet'}
              onClick={onManualSave}
              disabled={manualSaving}
              title="Kaydet (veritabanına)"
            />
          )}
          <QuickAction icon={Download} label="Dışa Aktar" onClick={handleExport} />
          <QuickAction icon={LayoutGrid} label="Önizleme" onClick={handleOpenStorylinePreview} />
          <QuickAction icon={Expand} label="Tam Ekran" onClick={onToggleFullscreen} />
        </div>
      )}

      <input ref={importRef} type="file" accept=".json" onChange={handleImport} hidden />

      <div className={styles.right}>
        {(onlineUsers.length > 0 || currentBookEditor) && (
          <PresenceBar onlineUsers={onlineUsers} currentBookEditor={isEditor ? currentBookEditor : null} />
        )}
        <TextAction icon={Archive} label="Sürümler" onClick={() => setShowProjectManager(true)} />
        {isEditor && <TextAction icon={MessageSquareText} label="Yorumlar" onClick={() => setShowReviewThreads(true)} />}
        {isEditor && (
          <TextAction
            label="Cevap"
            onClick={() => setAnswerDrawerOpen(true)}
            disabled={!selActivity}
            active={!!selActivity}
            title="Cevap Kontrol Merkezi"
          />
        )}
        {isEditor && (
          <TextAction
            icon={Palette}
            label="Tasarım"
            onClick={() => setDesignToolsOpen?.(true)}
            disabled={!selActivity}
            title="Tasarım üretim araçları"
          />
        )}

        <span
          className={`${styles.database} ${dbStatus === 'connected' ? styles.databaseReady : dbStatus === 'reconnecting' ? styles.databaseWarning : ''}`}
          title={
            dbStatus === 'reconnecting'
              ? 'SQL bağlantısı kesildi. Değişiklikler bu cihazda tutuluyor ve bağlantı gelince yüklenecek.'
              : savedLabel
          }
        >
          <Database size={13} aria-hidden="true" />
          <span>{databaseLabel}</span>
        </span>

        {lastSaved && <span className={styles.saved}>{lastSaved.toLocaleTimeString('tr-TR')}</span>}

        <IconAction icon={CircleHelp} label="Yardım" onClick={() => setStoryRibbonTab('help')} />
        <IconAction icon={Settings} label="Yönetim" onClick={() => setShowAdminManagement(true)} />

        {activeUser && (
          <button className={styles.user} type="button" onClick={handleLogout} title="Kullanıcı değiştir">
            <span>{activeUserInitial}</span>
            <ChevronDown size={14} aria-hidden="true" />
            <LogOut className={styles.logoutIcon} size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
