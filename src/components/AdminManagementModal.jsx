import { useCallback, useState } from 'react';

import { adminApiRequest } from '../api/apiClient';
import { EDITOR_THEME } from '../theme';

import AdminUserPanel from './AdminUserPanel';
import { Modal } from './ui';

const tabButtonBase = {
  height: 34,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,.28)',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
};

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function eventTone(type = '') {
  if (type.includes('failed') || type.includes('denied') || type.includes('forbidden'))
    return '#f87171';
  if (type.includes('rate') || type.includes('kick') || type.includes('takeover')) return '#f59e0b';
  if (type.includes('admin')) return '#a78bfa';
  if (type.includes('success') || type.includes('logout')) return '#22c55e';
  return '#38bdf8';
}

function cleanEventDetails(event = {}) {
  const { time, type, ...details } = event;
  return details;
}

function AdminManagementModal({
  open,
  onClose,
  onSelectUser,
  adminToken = '',
  onAdminTokenChange = () => {},
}) {
  const [tab, setTab] = useState('users');
  const [events, setEvents] = useState([]);
  const [eventStatus, setEventStatus] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventFilters, setEventFilters] = useState({ type: '', userId: '', from: '', to: '' });

  const loadEvents = useCallback(async () => {
    if (!adminToken.trim()) {
      setEventStatus('Admin token girilmeli.');
      return;
    }
    const params = new URLSearchParams({ limit: '150' });
    Object.entries(eventFilters).forEach(([key, value]) => {
      const cleanValue = String(value || '').trim();
      if (cleanValue) params.set(key, cleanValue);
    });
    setLoadingEvents(true);
    setEventStatus('');
    try {
      const result = await adminApiRequest(`/admin/security-events?${params.toString()}`, {
        method: 'GET',
        adminToken: adminToken.trim(),
      });
      setEvents(result.events || []);
      setEventStatus('Guvenlik loglari guncellendi.');
    } catch (error) {
      setEventStatus(error.message || 'Guvenlik loglari okunamadi.');
    } finally {
      setLoadingEvents(false);
    }
  }, [adminToken, eventFilters]);

  if (!open) return null;

  const renderTabButton = (key, label) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{
        ...tabButtonBase,
        background: tab === key ? 'rgba(14,165,233,.18)' : 'rgba(255,255,255,.05)',
        color: tab === key ? '#bae6fd' : EDITOR_THEME.shellMuted,
      }}
    >
      {label}
    </button>
  );

  return (
    <Modal title="Yonetim" onClose={onClose} width={980}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {renderTabButton('users', 'Kullanicilar')}
          {renderTabButton('logs', 'Guvenlik Loglari')}
        </div>

        {tab === 'users' ? (
          <AdminUserPanel
            embedded
            adminToken={adminToken}
            onAdminTokenChange={onAdminTokenChange}
            onSelectUser={onSelectUser}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              borderTop: `1px solid ${EDITOR_THEME.shellBorder}`,
              paddingTop: 12,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
              <input
                type="password"
                value={adminToken}
                onChange={(event) => onAdminTokenChange(event.target.value)}
                placeholder="Admin token"
                style={{
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(5,12,24,.9)',
                  color: EDITOR_THEME.shellText,
                  padding: '0 10px',
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                onClick={loadEvents}
                disabled={loadingEvents}
                style={{
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(255,255,255,.06)',
                  color: EDITOR_THEME.shellText,
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {loadingEvents ? 'Okunuyor' : 'Yenile'}
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) auto',
                gap: 8,
              }}
            >
              <input
                value={eventFilters.type}
                onChange={(event) =>
                  setEventFilters((current) => ({ ...current, type: event.target.value }))
                }
                placeholder="Olay tipi"
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(5,12,24,.72)',
                  color: EDITOR_THEME.shellText,
                  padding: '0 10px',
                  minWidth: 0,
                  fontSize: 11,
                }}
              />
              <input
                value={eventFilters.userId}
                onChange={(event) =>
                  setEventFilters((current) => ({ ...current, userId: event.target.value }))
                }
                placeholder="Kullanici ID"
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(5,12,24,.72)',
                  color: EDITOR_THEME.shellText,
                  padding: '0 10px',
                  minWidth: 0,
                  fontSize: 11,
                }}
              />
              <input
                type="datetime-local"
                value={eventFilters.from}
                onChange={(event) =>
                  setEventFilters((current) => ({ ...current, from: event.target.value }))
                }
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(5,12,24,.72)',
                  color: EDITOR_THEME.shellText,
                  padding: '0 10px',
                  minWidth: 0,
                  fontSize: 11,
                }}
              />
              <input
                type="datetime-local"
                value={eventFilters.to}
                onChange={(event) =>
                  setEventFilters((current) => ({ ...current, to: event.target.value }))
                }
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(5,12,24,.72)',
                  color: EDITOR_THEME.shellText,
                  padding: '0 10px',
                  minWidth: 0,
                  fontSize: 11,
                }}
              />
              <button
                type="button"
                onClick={() => setEventFilters({ type: '', userId: '', from: '', to: '' })}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
                  background: 'rgba(255,255,255,.05)',
                  color: EDITOR_THEME.shellMuted,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Temizle
              </button>
            </div>

            {eventStatus && (
              <div
                style={{
                  fontSize: 11,
                  color:
                    eventStatus.includes('okunamadi') || eventStatus.includes('girilmeli')
                      ? '#fecaca'
                      : '#bbf7d0',
                }}
              >
                {eventStatus}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 470,
                overflow: 'auto',
                paddingRight: 4,
              }}
            >
              {events.length === 0 && (
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${EDITOR_THEME.shellBorder}`,
                    background: 'rgba(255,255,255,.04)',
                    color: EDITOR_THEME.shellMuted,
                    padding: 18,
                    fontSize: 12,
                  }}
                >
                  Guvenlik logu henuz yuklenmedi.
                </div>
              )}

              {events.map((event, index) => {
                const tone = eventTone(event.type);
                const details = cleanEventDetails(event);
                return (
                  <div
                    key={`${event.time || 'event'}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '150px minmax(0, 1fr)',
                      gap: 12,
                      borderRadius: 14,
                      border: `1px solid ${tone}44`,
                      background: 'rgba(255,255,255,.045)',
                      padding: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: tone,
                          fontWeight: 900,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {event.type || 'event'}
                      </div>
                      <div style={{ fontSize: 10, color: EDITOR_THEME.shellMuted, marginTop: 6 }}>
                        {formatDate(event.time)}
                      </div>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        fontSize: 11,
                        lineHeight: 1.55,
                        color: '#dbeafe',
                        fontFamily: 'Consolas, monospace',
                      }}
                    >
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default AdminManagementModal;
