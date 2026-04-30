import { useCallback, useState } from 'react';

import { adminApiRequest } from '../api/apiClient';
import { EDITOR_THEME } from '../theme';

const inputStyle = {
  height: 38,
  borderRadius: 10,
  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
  background: 'rgba(5,12,24,.9)',
  color: EDITOR_THEME.shellText,
  padding: '0 10px',
  minWidth: 0,
};

const ghostButtonStyle = {
  height: 34,
  borderRadius: 10,
  border: `1px solid ${EDITOR_THEME.shellBorderStrong}`,
  background: 'rgba(255,255,255,.06)',
  color: EDITOR_THEME.shellText,
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};

function AdminUserPanel({ onSelectUser, embedded = false, adminToken, onAdminTokenChange }) {
  const [open, setOpen] = useState(false);
  const [localAdminToken, setLocalAdminToken] = useState('');
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [newUser, setNewUser] = useState({ id: '', name: '', password: '', active: true });
  const [passwordReset, setPasswordReset] = useState({ userId: '', password: '' });
  const resolvedOpen = embedded || open;
  const resolvedAdminToken = adminToken ?? localAdminToken;
  const setResolvedAdminToken = onAdminTokenChange || setLocalAdminToken;

  const runAdminTask = useCallback(
    async (task, successMessage = '') => {
      if (!resolvedAdminToken.trim()) {
        setStatus('Admin token girilmeli.');
        return null;
      }
      setBusy(true);
      setStatus('');
      try {
        const result = await task(resolvedAdminToken.trim());
        if (successMessage) setStatus(successMessage);
        return result;
      } catch (error) {
        setStatus(error.message || 'Admin islemi basarisiz.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [resolvedAdminToken]
  );

  const loadUsers = useCallback(async () => {
    const result = await runAdminTask(
      (token) => adminApiRequest('/admin/users', { method: 'GET', adminToken: token }),
      'Kullanicilar guncellendi.'
    );
    if (result?.users) setUsers(result.users);
  }, [runAdminTask]);

  const createUser = useCallback(async () => {
    const result = await runAdminTask(
      (token) =>
        adminApiRequest('/admin/users', {
          method: 'POST',
          adminToken: token,
          body: JSON.stringify(newUser),
        }),
      'Kullanici olusturuldu.'
    );
    if (!result?.user) return;
    setUsers((current) =>
      [...current.filter((user) => user.id !== result.user.id), result.user].sort((a, b) =>
        a.id.localeCompare(b.id)
      )
    );
    setNewUser({ id: '', name: '', password: '', active: true });
  }, [newUser, runAdminTask]);

  const toggleUser = useCallback(
    async (user) => {
      const result = await runAdminTask(
        (token) =>
          adminApiRequest(`/admin/users/${encodeURIComponent(user.id)}`, {
            method: 'PATCH',
            adminToken: token,
            body: JSON.stringify({ active: !user.active }),
          }),
        user.active ? 'Kullanici pasife alindi.' : 'Kullanici aktif edildi.'
      );
      if (result?.user) {
        setUsers((current) =>
          current.map((item) => (item.id === result.user.id ? result.user : item))
        );
      }
    },
    [runAdminTask]
  );

  const resetPassword = useCallback(async () => {
    const result = await runAdminTask(
      (token) =>
        adminApiRequest(`/admin/users/${encodeURIComponent(passwordReset.userId)}/password`, {
          method: 'PUT',
          adminToken: token,
          body: JSON.stringify({ password: passwordReset.password }),
        }),
      'Sifre guncellendi; kullanicinin aktif oturumlari kapatildi.'
    );
    if (result?.user) {
      setUsers((current) =>
        current.map((item) => (item.id === result.user.id ? result.user : item))
      );
      setPasswordReset({ userId: '', password: '' });
    }
  }, [passwordReset, runAdminTask]);

  return (
    <div
      style={{
        borderTop: `1px solid ${EDITOR_THEME.shellBorder}`,
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          style={{ ...ghostButtonStyle, width: '100%' }}
        >
          {open ? 'Yonetimi Kapat' : 'Kullanici Yonetimi'}
        </button>
      )}

      {resolvedOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
            <input
              type="password"
              value={resolvedAdminToken}
              onChange={(event) => setResolvedAdminToken(event.target.value)}
              placeholder="Admin token"
              style={inputStyle}
            />
            <button type="button" onClick={loadUsers} disabled={busy} style={ghostButtonStyle}>
              Listele
            </button>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}
          >
            <input
              value={newUser.id}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, id: event.target.value }))
              }
              placeholder="Yeni ID"
              style={inputStyle}
            />
            <input
              value={newUser.name}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ad"
              style={inputStyle}
            />
            <input
              type="password"
              value={newUser.password}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Sifre"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={createUser}
              disabled={busy}
              style={{ ...ghostButtonStyle, background: 'rgba(14,165,233,.16)', color: '#bae6fd' }}
            >
              Olustur
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
              gap: 8,
            }}
          >
            <input
              value={passwordReset.userId}
              onChange={(event) =>
                setPasswordReset((current) => ({ ...current, userId: event.target.value }))
              }
              placeholder="ID"
              style={inputStyle}
            />
            <input
              type="password"
              value={passwordReset.password}
              onChange={(event) =>
                setPasswordReset((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Yeni sifre"
              style={inputStyle}
            />
            <button type="button" onClick={resetPassword} disabled={busy} style={ghostButtonStyle}>
              Sifre
            </button>
          </div>

          {status && (
            <div
              style={{
                fontSize: 11,
                color:
                  status.includes('basarisiz') || status.includes('girilmeli')
                    ? '#fecaca'
                    : '#bbf7d0',
                lineHeight: 1.5,
              }}
            >
              {status}
            </div>
          )}

          {users.length > 0 && (
            <div
              style={{
                maxHeight: 180,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,.08)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: EDITOR_THEME.shellText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.name}
                    </div>
                    <div style={{ fontSize: 10, color: user.active ? '#86efac' : '#fca5a5' }}>
                      {user.id} · {user.active ? 'aktif' : 'pasif'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectUser?.(user)}
                    style={{ ...ghostButtonStyle, height: 30 }}
                  >
                    Sec
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleUser(user)}
                    disabled={busy}
                    style={{ ...ghostButtonStyle, height: 30 }}
                  >
                    {user.active ? 'Pasif' : 'Aktif'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminUserPanel;
