// eslint-disable-next-line no-unused-vars
function ProductLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#1e293b" />
      <rect x="12" y="12" width="18" height="18" rx="4" fill="#2563eb" />
      <rect x="34" y="12" width="18" height="18" rx="4" fill="#3b82f6" />
      <rect x="12" y="34" width="18" height="18" rx="4" fill="#60a5fa" />
      <rect x="34" y="34" width="18" height="18" rx="4" fill="#f59e0b" />
    </svg>
  );
}

function QuickAction({ icon, label, onClick, disabled = false, title }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title || label}
      style={{
        width: 58,
        height: 38,
        border: '1px solid transparent',
        borderRadius: 6,
        background: 'transparent',
        color: disabled ? 'rgba(226,232,240,.34)' : '#e8f3ff',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1.05,
        opacity: disabled ? 0.48 : 1,
      }}
    >
      <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function IconButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 30,
        border: '1px solid transparent',
        borderRadius: 999,
        background: 'transparent',
        color: '#dbeafe',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function TopBarPillButton({ label, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 28,
        padding: '0 8px',
        borderRadius: 7,
        border: `1px solid ${active ? '#38bdf8' : 'rgba(148,163,184,.28)'}`,
        background: active ? 'rgba(14,165,233,.18)' : 'rgba(255,255,255,.07)',
        color: active ? '#e0f2fe' : '#cbd5e1',
        fontSize: 10,
        fontWeight: 850,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function TopBarCrumbButton({ label, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      style={{
        height: 25,
        padding: '0 7px',
        borderRadius: 7,
        border: '1px solid rgba(148,163,184,.26)',
        background: 'rgba(255,255,255,.06)',
        color: '#dbeafe',
        fontSize: 10,
        fontWeight: 850,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        maxWidth: 82,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
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
  redo,
  selActivity,
  selBook,
  selPub,
  onBackToActivities,
  onBackToBooks,
  onBackToPublishers,
  setAnswerDrawerOpen,
  setCanvasExpanded,
  setDesignToolsOpen,
  setShowAdminManagement,
  setShowProjectManager,
  setShowReviewThreads,
  setStoryRibbonTab,
  undo,
}) {
  const projectName =
    selBook?.name || currentProject?.name || selActivity?.name || selPub?.name || 'Proje';
  const savedLabel = lastSaved ? 'Kaydedildi' : dbStatus === 'connected' ? 'Kaydedildi' : 'Yerel';
  const savedColor = dbStatus === 'connected' || lastSaved ? '#22c55e' : '#94a3b8';

  return (
    <div
      style={{
        height: 44,
        minHeight: 44,
        background: 'linear-gradient(180deg,#07182a 0%,#06111f 100%)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px 0 8px',
        borderBottom: '1px solid rgba(148,163,184,.24)',
        gap: 12,
        flexShrink: 0,
        boxShadow: '0 5px 18px rgba(0,0,0,.34)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img src="/logo-light.svg" height={28} alt="E-İçerik Studio" style={{ display: 'block' }} />
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(226,232,240,.26)', flexShrink: 0 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 120,
          maxWidth: 220,
          overflow: 'hidden',
        }}
      >
        <span
          title={projectName}
          style={{
            fontSize: 12,
            color: '#e2e8f0',
            fontWeight: 750,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Proje: {projectName}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 850,
            color: savedColor,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13 }}>●</span>
          {savedLabel}
        </span>
      </div>

      {currentView === 'editor' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <TopBarCrumbButton
            label="Yayınevi"
            title="Yayınevi seçimine dön"
            onClick={onBackToPublishers}
          />
          <TopBarCrumbButton label="Kitap" title="Kitap seçimine dön" onClick={onBackToBooks} />
          <TopBarCrumbButton
            label="Etkinlik"
            title="Etkinlik listesine dön"
            onClick={onBackToActivities}
          />
        </div>
      )}

      {currentView === 'editor' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 'auto',
            marginRight: 'auto',
            minWidth: 288,
            justifyContent: 'center',
          }}
        >
          <QuickAction
            icon="↶"
            label="Geri Al"
            onClick={undo}
            disabled={!history?.past?.length}
            title="Geri Al (Ctrl+Z)"
          />
          <QuickAction
            icon="↷"
            label="İleri Al"
            onClick={redo}
            disabled={!history?.future?.length}
            title="İleri Al (Ctrl+Y)"
          />
          <QuickAction icon="⇧" label="Dışa Aktar" onClick={handleExport} />
          <QuickAction icon="◉" label="Önizleme" onClick={handleOpenStorylinePreview} />
          <QuickAction icon="⛶" label="Tam Ekran" onClick={() => setCanvasExpanded(true)} />
        </div>
      )}

      <input
        ref={importRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', minWidth: 0 }}>
        {currentView === 'editor' && (
          <>
            <TopBarPillButton label="Sürümler" onClick={() => setShowProjectManager(true)} />
            <TopBarPillButton label="Yorumlar" onClick={() => setShowReviewThreads(true)} />
            <TopBarPillButton label="Yönetim" onClick={() => setShowAdminManagement(true)} />
          </>
        )}

        {currentView === 'editor' && (
          <button
            type="button"
            onClick={() => setAnswerDrawerOpen(true)}
            disabled={!selActivity}
            title="Cevap Kontrol Merkezi"
            style={{
              height: 30,
              padding: '0 11px',
              borderRadius: 9,
              border: `1px solid ${selActivity ? '#38bdf8' : 'rgba(148,163,184,.3)'}`,
              background: selActivity ? 'rgba(14,165,233,.2)' : 'rgba(255,255,255,.05)',
              color: selActivity ? '#e0f2fe' : 'rgba(226,232,240,.45)',
              fontSize: 11,
              fontWeight: 900,
              cursor: selActivity ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Cevap
          </button>
        )}

        {currentView === 'editor' && (
          <button
            type="button"
            onClick={() => setDesignToolsOpen?.(true)}
            disabled={!selActivity}
            title="Tasarım üretim araçları"
            style={{
              height: 30,
              padding: '0 11px',
              borderRadius: 9,
              border: `1px solid ${selActivity ? 'rgba(124,58,237,.72)' : 'rgba(148,163,184,.3)'}`,
              background: selActivity ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.05)',
              color: selActivity ? '#ede9fe' : 'rgba(226,232,240,.45)',
              fontSize: 11,
              fontWeight: 900,
              cursor: selActivity ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            Tasarım
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <span
            style={{
              height: 22,
              padding: '0 8px',
              borderRadius: 999,
              border: `1px solid ${
                dbStatus === 'connected' ? 'rgba(34,197,94,.35)' : 'rgba(148,163,184,.28)'
              }`,
              background:
                dbStatus === 'connected' ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.05)',
              color: dbStatus === 'connected' ? '#22c55e' : '#94a3b8',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 11,
              fontWeight: 850,
            }}
          >
            {dbStatus === 'connected' ? '● SQLite' : dbStatus === 'connecting' ? '⟳ DB' : '○ Lokal'}
          </span>
          {lastSaved && (
            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 800 }}>
              ✓ {lastSaved.toLocaleTimeString('tr-TR')}
            </span>
          )}
        </div>

        <IconButton title="Yardım" onClick={() => setStoryRibbonTab('help')}>
          ?
        </IconButton>

        <IconButton title="Yönetim" onClick={() => setShowAdminManagement(true)}>
          ⚙
        </IconButton>

        {activeUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              onClick={handleLogout}
              title="Kullanıcı değiştir"
              style={{
                width: 31,
                height: 31,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,.24)',
                background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {activeUser.name.charAt(0).toUpperCase()}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Kullanıcı değiştir"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#dbeafe',
                fontSize: 16,
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ⌄
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
