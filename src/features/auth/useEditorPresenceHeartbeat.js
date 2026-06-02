import { useEffect } from 'react';

import { apiRequest } from '../../api/apiClient';
import { createSessionLabel } from '../../hooks/useAuth';
import { requiresFreshEditorSession } from '../../utils/bootReadiness';

// EIcerikEditor'daki değerle aynı (uzak durum istekleri için zaman aşımı).
const REMOTE_STATUS_REQUEST_TIMEOUT_MS = 15000;

/**
 * Seviye 1 işbirliği için presence heartbeat'i + kick (başka cihaz girişi)
 * oturum sonlandırma akışını yöneten hook. EIcerikEditor'dan birebir taşınan
 * üç effect'i barındırır:
 *  - Uyarlanabilir aralıklı heartbeat (presence + kick algılama + reconnect).
 *  - Kick geri sayımı (30 sn).
 *  - Geri sayım bitince oturumu sonlandırma.
 *
 * State (presence/kickRequested/kickCountdown) ve forceLogoutToLogin monolitte
 * kalır; bu hook yalnız yan etkileri kapsüller ve bağımlılıkları options ile alır.
 * Setter'lar options'tan geldiği için linter onları "stable" göremez; davranışı
 * değiştirmeden dep dizilerine eklenmişlerdir (useState setter'ları sabittir).
 */
export default function useEditorPresenceHeartbeat({
  activeUserId,
  activeSessionId,
  authState,
  loginForm,
  kickRequested,
  kickCountdown,
  forceLogoutToLogin,
  setPresence,
  setKickRequested,
  setKickCountdown,
  setDbStatus,
  heartbeatFailCountRef,
  remoteReadyRef,
  offlineDraftPendingRef,
}) {
  useEffect(() => {
    if (!activeUserId || !activeSessionId) return undefined;
    let cancelled = false;
    const heartbeat = async () => {
      try {
        const result = await apiRequest('/auth/heartbeat', {
          method: 'POST',
          timeoutMs: REMOTE_STATUS_REQUEST_TIMEOUT_MS,
          body: JSON.stringify({ userId: activeUserId, sessionId: activeSessionId }),
        });
        heartbeatFailCountRef.current = 0;
        if (result?.presence) {
          setPresence({
            users: Array.isArray(result.presence.users) ? result.presence.users : [],
            locks: Array.isArray(result.presence.locks) ? result.presence.locks : [],
          });
        }
        if (result?.kickRequested) setKickRequested(true);
      } catch (error) {
        if (cancelled) return;
        if (requiresFreshEditorSession(error)) {
          forceLogoutToLogin(error.message || 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
          return;
        }
        if (error?.code === 'USER_LOCKED') {
          forceLogoutToLogin('', {
            userId: activeUserId,
            password: loginForm.password,
            sessionId: activeSessionId,
            sessionLabel: authState?.sessionLabel || createSessionLabel(),
            session: error.session || null,
            message: error.message || 'Bu kullanıcı başka bir cihazda aktif.',
          });
          return;
        }
        // Tek bir geçici hatada "SQL kesildi"ye geçme; kısa ağ dalgalanmaları
        // bağlantıyı koparmış gibi göstermesin. Ancak 2 ardışık hatadan sonra
        // gerçek bir kesinti kabul edip yeniden bağlanma akışına geç.
        heartbeatFailCountRef.current += 1;
        if (heartbeatFailCountRef.current >= 2) {
          remoteReadyRef.current = false;
          offlineDraftPendingRef.current = true;
          setDbStatus('reconnecting');
        }
      }
    };

    // Uyarlanabilir aralik: sekme onplandayken 8 sn, arka planda 25 sn.
    // Boylece presence canli kalir ama bos/arka plan sekmeler paylasimli
    // hosting'i gereksiz yormaz. Self-scheduling timeout, yavas internette
    // heartbeat'lerin ust uste binmesini de onler.
    let timer = null;
    const ACTIVE_MS = 8000;
    const IDLE_MS = 25000;
    const scheduleNext = () => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      timer = window.setTimeout(tick, hidden ? IDLE_MS : ACTIVE_MS);
    };
    const tick = async () => {
      await heartbeat();
      if (!cancelled) scheduleNext();
    };
    const onVisibility = () => {
      // Sekme tekrar gorununce hemen taze heartbeat (presence guncel kalsin).
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !cancelled) {
        if (timer) window.clearTimeout(timer);
        tick();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    scheduleNext();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [
    activeSessionId,
    activeUserId,
    authState?.sessionLabel,
    forceLogoutToLogin,
    heartbeatFailCountRef,
    loginForm.password,
    offlineDraftPendingRef,
    remoteReadyRef,
    setDbStatus,
    setKickRequested,
    setPresence,
  ]);

  // Kick countdown: when another device requests this session
  useEffect(() => {
    if (!kickRequested || !activeUserId) return undefined;
    setKickCountdown(30);
    const timer = window.setInterval(() => setKickCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [kickRequested, activeUserId, setKickCountdown]);

  useEffect(() => {
    if (kickRequested && kickCountdown === 0 && activeUserId) {
      setKickRequested(false);
      forceLogoutToLogin('Baska bir cihaz bu hesaba giris yapti. Oturumunuz sonlandirildi.');
    }
  }, [kickRequested, kickCountdown, activeUserId, forceLogoutToLogin, setKickRequested]);
}
