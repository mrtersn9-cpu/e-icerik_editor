import { useState } from 'react';
import GirisModule from './modules/giris';

const TABS = [
  { id: 'giris', label: 'Giriş', icon: '🏠' },
  { id: 'ekle', label: 'Ekle', icon: '➕' },
  { id: 'tasarim', label: 'Tasarım', icon: '🎨' },
  { id: 'animasyon', label: 'Animasyon', icon: '✨' },
];

function RightPanelShell(props) {
  const { selActivity } = props;
  const [activeTabId, setActiveTabId] = useState('giris');

  if (!selActivity) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#94a3b8',
          fontSize: 13,
          fontWeight: 600,
          borderLeft: '1px solid #e2e8f0',
        }}
      >
        Düzenlemek için bir etkinlik seçin.
      </div>
    );
  }

  const ActiveModule = activeTabId === 'giris' ? GirisModule : null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        color: '#0f172a',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              disabled={tab.id !== 'giris'} // Şimdilik sadece Giriş modülü aktif
              title={tab.label}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${isActive ? '#bfdbfe' : 'transparent'}`,
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#2563eb' : tab.id !== 'giris' ? '#94a3b8' : '#334155',
                fontSize: 11,
                fontWeight: 700,
                cursor: tab.id !== 'giris' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {ActiveModule ? (
          <ActiveModule {...props} />
        ) : (
          <div style={{ padding: 20, fontSize: 12, color: '#64748b' }}>
            Bu bölüm yapım aşamasındadır.
          </div>
        )}
      </div>
    </div>
  );
}

export default RightPanelShell;