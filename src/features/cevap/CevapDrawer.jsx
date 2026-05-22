import { useEffect } from 'react';

import CevapPanelRouter from './CevapPanelRouter';
import { getFooterMeta, getActivityTypeLabel } from './cevapSelectors';
import { SahneyeUygulaCard } from './panels/OrtakCevapKartlari';

export default function CevapDrawer({ open, activity, onUpdate, onClose, lastSaved }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const meta = getFooterMeta(activity, lastSaved);
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15,23,42,.34)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <style>
        {`
          @media (max-width: 640px) {
            .cevap-drawer-panel {
              width: 100vw !important;
              padding: 14px !important;
            }
            .cevap-drawer-footer {
              grid-template-columns: 1fr !important;
              min-height: auto !important;
              padding: 12px 14px !important;
              text-align: left !important;
            }
            .cevap-drawer-footer span {
              text-align: left !important;
            }
          }
        `}
      </style>
      <aside
        className="cevap-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Etkinlik kontrol merkezi"
        style={{
          width: 'min(720px, calc(100vw - 56px))',
          maxWidth: '100vw',
          height: '100vh',
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '-18px 0 42px rgba(15,23,42,.18)',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0,1fr) auto',
          padding: 10,
          gap: 5,
          overflow: 'hidden',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#174ea6', fontSize: 13, fontWeight: 950 }}>
              ETKİNLİK KONTROL MERKEZİ
            </div>
            <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
              {getActivityTypeLabel(activity)} cevap ayarlarını düzenleyin.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Etkinlik Kontrol Merkezi'ni kapat"
            style={{
              width: 34,
              height: 34,
              border: '1px solid #dbe7f5',
              borderRadius: 999,
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </header>
        <main style={{ minHeight: 0, overflow: 'auto', paddingRight: 1, background: '#ffffff' }}>
          <CevapPanelRouter activity={activity} onUpdate={onUpdate} />
          <SahneyeUygulaCard activity={activity} onUpdate={onUpdate} number="Uygula" />
        </main>
        <footer
          className="cevap-drawer-footer"
          style={{
            minHeight: 40,
            border: '1px solid #dbe4ef',
            borderRadius: 8,
            background: '#ffffff',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            alignItems: 'center',
            gap: 12,
            padding: '0 12px',
            color: '#334155',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span>Etkinlik ID: {meta.id}</span>
          <span style={{ textAlign: 'center' }}>Son düzenleme: {meta.lastSavedText}</span>
          <span style={{ textAlign: 'right' }}>Version: {meta.version}</span>
        </footer>
      </aside>
    </div>
  );
}
