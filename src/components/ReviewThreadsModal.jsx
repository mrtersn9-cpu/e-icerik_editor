import { useState, useEffect, useCallback } from 'react';

import { apiRequest } from '../api/apiClient';

import { Modal } from './ui';

export default function ReviewThreadsModal({
  open,
  onClose,
  projectId,
  currentUserId,
  currentUserName = 'Kullanici',
}) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('open');
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadThreads = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/threads`);
      setThreads(data.threads || []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) loadThreads();
  }, [open, projectId, loadThreads]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = newMessage.trim();
    if (!msg || submitting) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, parentId: replyTo || null }),
      });
      setNewMessage('');
      setReplyTo(null);
      await loadThreads();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (thread) => {
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/threads/${encodeURIComponent(thread.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !thread.resolved }),
      }
    );
    await loadThreads();
  };

  const handleDelete = async (thread) => {
    if (!window.confirm('Bu yorum silinsin mi?')) return;
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/threads/${encodeURIComponent(thread.id)}`,
      {
        method: 'DELETE',
      }
    );
    await loadThreads();
  };

  if (!open) return null;

  const roots = threads.filter((t) => !t.parent_id);
  const replies = threads.filter((t) => !!t.parent_id);
  const filtered = roots.filter((t) => (tab === 'open' ? !t.resolved : t.resolved));
  const openCount = roots.filter((t) => !t.resolved).length;
  const resolvedCount = roots.filter((t) => t.resolved).length;

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: '5px 14px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        border: 'none',
        background: tab === key ? '#2563eb' : '#e2e8f0',
        color: tab === key ? '#fff' : '#475569',
      }}
    >
      {label} {count > 0 ? `(${count})` : ''}
    </button>
  );

  return (
    <Modal title="Yorumlar & Geri Bildirim" onClose={onClose} width={580}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {tabBtn('open', 'Açık', openCount)}
          {tabBtn('resolved', 'Çözüldü', resolvedCount)}
          <button
            onClick={loadThreads}
            disabled={loading}
            style={{
              marginLeft: 'auto',
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              color: '#475569',
            }}
          >
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '20px 0' }}>
              {tab === 'open' ? 'Açık yorum yok.' : 'Çözülmüş yorum yok.'}
            </div>
          )}
          {filtered.map((thread) => {
            const threadReplies = replies.filter((r) => r.parent_id === thread.id);
            return (
              <div
                key={thread.id}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${thread.resolved ? '#d1fae5' : '#e2e8f0'}`,
                  background: thread.resolved ? '#f0fdf4' : '#ffffff',
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#2563eb',
                      flexShrink: 0,
                    }}
                  >
                    {(thread.user_id || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                        {thread.user_id}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        {formatDate(thread.created_at)}
                      </span>
                      {thread.slide_ref && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#6366f1',
                            background: '#eef2ff',
                            padding: '1px 6px',
                            borderRadius: 999,
                          }}
                        >
                          {thread.slide_ref}
                        </span>
                      )}
                      {thread.resolved && (
                        <span
                          style={{
                            fontSize: 10,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '1px 6px',
                            borderRadius: 999,
                            fontWeight: 700,
                          }}
                        >
                          Çözüldü
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#334155',
                        marginTop: 4,
                        lineHeight: 1.55,
                        wordBreak: 'break-word',
                      }}
                    >
                      {thread.message}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => handleResolve(thread)}
                      title={thread.resolved ? 'Yeniden Aç' : 'Çözüldü İşaretle'}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                        border: 'none',
                        cursor: 'pointer',
                        background: thread.resolved ? '#fef3c7' : '#dcfce7',
                        color: thread.resolved ? '#92400e' : '#15803d',
                        fontWeight: 700,
                      }}
                    >
                      {thread.resolved ? '↩' : '✓'}
                    </button>
                    {thread.user_id === currentUserId && (
                      <button
                        onClick={() => handleDelete(thread)}
                        title="Sil"
                        style={{
                          padding: '3px 8px',
                          borderRadius: 8,
                          fontSize: 11,
                          border: 'none',
                          cursor: 'pointer',
                          background: '#fee2e2',
                          color: '#dc2626',
                        }}
                      >
                        ✕
                      </button>
                    )}
                    <button
                      onClick={() => setReplyTo((prev) => (prev === thread.id ? null : thread.id))}
                      title="Yanıtla"
                      style={{
                        padding: '3px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                        border: 'none',
                        cursor: 'pointer',
                        background: replyTo === thread.id ? '#dbeafe' : '#f1f5f9',
                        color: replyTo === thread.id ? '#2563eb' : '#64748b',
                      }}
                    >
                      ↩
                    </button>
                  </div>
                </div>

                {threadReplies.length > 0 && (
                  <div
                    style={{
                      marginLeft: 36,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      borderLeft: '2px solid #e2e8f0',
                      paddingLeft: 10,
                    }}
                  >
                    {threadReplies.map((reply) => (
                      <div key={reply.id} style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: '#475569' }}>{reply.user_id}</span>
                        <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 10 }}>
                          {formatDate(reply.created_at)}
                        </span>
                        <div style={{ color: '#334155', marginTop: 2, lineHeight: 1.5 }}>
                          {reply.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {replyTo === thread.id && (
                  <form
                    onSubmit={handleSubmit}
                    style={{ marginLeft: 36, marginTop: 8, display: 'flex', gap: 6 }}
                  >
                    <input
                      autoFocus
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Yanıt yaz..."
                      style={{
                        flex: 1,
                        height: 28,
                        border: '1px solid #c0ccd8',
                        borderRadius: 6,
                        fontSize: 12,
                        padding: '0 8px',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newMessage.trim()}
                      style={{
                        padding: '0 12px',
                        height: 28,
                        borderRadius: 6,
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Gönder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setNewMessage('');
                      }}
                      style={{
                        padding: '0 10px',
                        height: 28,
                        borderRadius: 6,
                        background: '#e2e8f0',
                        color: '#475569',
                        border: 'none',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      İptal
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        {!replyTo && (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Yeni Yorum</div>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Yorum veya geri bildirim yaz..."
              rows={3}
              style={{
                border: '1px solid #c0ccd8',
                borderRadius: 8,
                fontSize: 13,
                padding: '8px 10px',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting || !newMessage.trim()}
                style={{
                  padding: '7px 20px',
                  borderRadius: 20,
                  background: !newMessage.trim() ? '#e2e8f0' : '#2563eb',
                  color: !newMessage.trim() ? '#94a3b8' : '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: newMessage.trim() ? 'pointer' : 'default',
                }}
              >
                {submitting ? 'Gönderiliyor...' : 'Yorum Ekle'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
