import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/tokens.css';
import './styles/utilities.css';

import { apiRequest } from './api/apiClient';
import EIcerikEditor from './EIcerikEditor';

window.__EIC_BUILD_MARK__ = 'button-packages-21-2026-04-29';

function formatBootError(error) {
  if (!error) return 'Bilinmeyen hata';
  if (typeof error === 'string') return error;
  return error.stack || error.message || JSON.stringify(error);
}

function reportBootError(title, error) {
  try {
    window.__EIC_BOOT_REPORT__?.(title, formatBootError(error));
  } catch {}
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    reportBootError('React acilis hatasi', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#eef4f8',
            color: '#172033',
            fontFamily: '"Segoe UI", Arial, sans-serif',
          }}
        >
          <div
            style={{
              width: 'min(680px, 100%)',
              borderRadius: 10,
              border: '1px solid #fecaca',
              background: '#ffffff',
              boxShadow: '0 18px 42px rgba(15, 23, 42, 0.14)',
              padding: 28,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                color: '#b91c1c',
              }}
            >
              React Hata Siniri
            </div>
            <div style={{ marginTop: 14, fontSize: 30, lineHeight: 1.1, fontWeight: 800 }}>
              Uygulama acilirken durdu
            </div>
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: '#64748b' }}>
              Bu, siyah bos ekran yerine hatayi gorebilmen icin gosterilen yedek ekran.
            </div>
            <pre
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 6,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                font: '12px/1.6 Consolas, "Courier New", monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {formatBootError(this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Yavaş bağlantılarda 8 sn çok kısaydı; 15 sn yavaş hatta cevaba izin verir.
const BOOT_DB_REQUEST_TIMEOUT_MS = 15000;

function BootGate() {
  React.useEffect(() => {
    // Login ekranını BLOKLAMA: DB sağlığını/şemasını ARKA PLANDA doğrula.
    // Kullanıcı bu sırada giriş bilgilerini girebilir; giriş sonrası çalışma
    // alanı (yerel önbellekle genelde anında) yüklenir. Doğrulama başarısız olsa
    // bile editörün kendi yeniden-bağlanma akışı devralır → algıda hızlı açılış.
    // (Yeni/boş kurulumda bu istek şema kurulumunu tetikler.)
    apiRequest(`/health?requireDatabase=1&t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      timeoutMs: BOOT_DB_REQUEST_TIMEOUT_MS,
    }).catch(() => {
      /* sessiz: arka plan doğrulaması */
    });

    // Boot overlay'ini hemen kapat → login anında görünür.
    window.__EIC_BOOT_DONE__?.();
  }, []);

  return <EIcerikEditor />;
}

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BootGate />
      </AppErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  reportBootError('Render baslatilamadi', error);
  throw error;
}
