import { useEffect, useMemo, useRef } from 'react';

/*
 * Seviye 1 işbirliği türetmeleri + bildirimleri.
 *
 * Girdi `presence` heartbeat yanıtından gelir:
 *   { users: [{ userId, userName, sessionId, lastSeenAt }],
 *     locks: [{ projectId, bookId, userId, userName, sessionId }] }
 *
 * Döndürür: kendisi hariç online kullanıcılar, sayıları ve "şu an bulunduğum
 * kitabı başkası mı düzenliyor" bilgisi. Yalnız değişimde (spam yapmadan)
 * çevrimiçi olma bildirimi tetikler.
 */
export default function usePresence({ presence, currentUserId, activeBookId, onNotify } = {}) {
  const onlineUsers = useMemo(() => {
    const users = Array.isArray(presence?.users) ? presence.users : [];
    const seen = new Set();
    const out = [];
    for (const u of users) {
      if (!u?.userId || u.userId === currentUserId || seen.has(u.userId)) continue;
      seen.add(u.userId);
      out.push({ userId: u.userId, userName: u.userName || u.userId });
    }
    return out;
  }, [presence, currentUserId]);

  const currentBookEditor = useMemo(() => {
    if (!activeBookId) return null;
    const locks = Array.isArray(presence?.locks) ? presence.locks : [];
    const lock = locks.find((l) => l.bookId === activeBookId && l.userId !== currentUserId);
    return lock ? { userId: lock.userId, userName: lock.userName || lock.userId } : null;
  }, [presence, activeBookId, currentUserId]);

  // Yeni biri çevrimiçi olunca bir kez bildir (çevrimdışı için sessiz kal — gürültü olmasın).
  const prevIdsRef = useRef(null);
  useEffect(() => {
    if (typeof onNotify !== 'function') return;
    const nextIds = new Set(onlineUsers.map((u) => u.userId));
    const prev = prevIdsRef.current;
    if (prev) {
      for (const u of onlineUsers) {
        if (!prev.has(u.userId)) onNotify(`${u.userName} çevrimiçi.`, 'success');
      }
    }
    prevIdsRef.current = nextIds;
  }, [onlineUsers, onNotify]);

  return { onlineUsers, othersCount: onlineUsers.length, currentBookEditor };
}
