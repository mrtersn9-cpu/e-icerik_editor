import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../api/apiClient';

import { Btn, Modal, SelectInp } from './ui';

// Proje paylaşım diyaloğu: proje sahibi başka kullanıcılarla paylaşabilir/
// kaldırabilir; paylaşılan kullanıcılar listeyi görebilir ama yönetemez
// (bkz. server.mjs/index.php izin modeli: paylaşılan = görüntüle+düzenle,
// sahip = ayrıca sil + paylaşım yönetimi).
export default function ProjectShareModal({ open, onClose, currentProject, currentProjectId, activeUserId }) {
  const [shares, setShares] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const isOwner = Boolean(currentProject?.userId) && currentProject.userId === activeUserId;

  const loadData = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [sharesRes, usersRes] = await Promise.all([
        apiRequest(`/projects/${encodeURIComponent(currentProjectId)}/shares`),
        apiRequest('/users').catch(() => ({ users: [] })),
      ]);
      setShares(sharesRes?.shares || []);
      setUsers(usersRes?.users || []);
      setError('');
    } catch (err) {
      setShares([]);
      setError(err?.message || 'Paylaşım bilgisi yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (open && currentProjectId) loadData();
    if (!open) {
      setSelectedUserId('');
      setError('');
    }
  }, [open, currentProjectId, loadData]);

  if (!open) return null;

  const sharedUserIds = new Set(shares.map((share) => share.userId));
  const availableUsers = users.filter(
    (user) => user.id !== activeUserId && user.id !== currentProject?.userId && !sharedUserIds.has(user.id)
  );
  const userLabel = (userId) => users.find((user) => user.id === userId)?.name || userId;

  const handleShare = async () => {
    if (!selectedUserId || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiRequest(`/projects/${encodeURIComponent(currentProjectId)}/shares`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId }),
      });
      setShares(res?.shares || []);
      setSelectedUserId('');
      setError('');
    } catch (err) {
      setError(err?.message || 'Paylaşılamadı. Tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnshare = async (userId) => {
    setSubmitting(true);
    try {
      const res = await apiRequest(
        `/projects/${encodeURIComponent(currentProjectId)}/shares/${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
      setShares(res?.shares || []);
      setError('');
    } catch (err) {
      setError(err?.message || 'Paylaşım kaldırılamadı. Tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Projeyi Paylaş" subtitle={currentProject?.name || ''} onClose={onClose} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span aria-hidden="true">!</span>
            <span style={{ flex: 1 }}>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Hata mesajını kapat"
              style={{ border: 'none', background: 'transparent', color: '#991b1b', cursor: 'pointer', fontWeight: 800, fontSize: 13, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}

        {!isOwner && (
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Bu projeyi yalnızca sahibi ({userLabel(currentProject?.userId)}) paylaşabilir veya paylaşımı
            kaldırabilir. Aşağıda kimlerle paylaşıldığını görebilirsiniz.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Paylaşılan Kullanıcılar
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Yükleniyor...</div>
          ) : shares.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Bu proje henüz kimseyle paylaşılmadı.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shares.map((share) => (
                <div
                  key={share.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{userLabel(share.userId)}</span>
                  {isOwner && (
                    <Btn small variant="danger" onClick={() => handleUnshare(share.userId)} disabled={submitting}>
                      Kaldır
                    </Btn>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <SelectInp
                label="Kullanıcı Seç"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                options={[
                  { value: '', label: availableUsers.length ? 'Seçiniz...' : 'Paylaşılabilecek kullanıcı yok' },
                  ...availableUsers.map((user) => ({ value: user.id, label: user.name || user.id })),
                ]}
                disabled={!availableUsers.length}
              />
            </div>
            <Btn variant="primary" onClick={handleShare} disabled={!selectedUserId || submitting}>
              Paylaş
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}
