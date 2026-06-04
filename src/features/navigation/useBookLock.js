import { useCallback } from 'react';

import { apiRequest } from '../../api/apiClient';
import { formatBookLockMessage } from '../../utils/editorHelpers';

// EIcerikEditor'daki değerle aynı (kitap kilit istekleri için zaman aşımı).
const BOOK_LOCK_REQUEST_TIMEOUT_MS = 12000;

/**
 * Kitap kilidi alma/bırakma mantığını yöneten hook (Seviye 1 işbirliği:
 * aynı kitabı iki kişinin aynı anda düzenlemesini engeller).
 *
 * EIcerikEditor'dan birebir taşınmıştır. Kilit state'i (setBookLockInfo/
 * setBookLockWarning) ve showToast monolitte kalır, options ile geçirilir.
 * Setter'lar options'tan geldiği için dep dizilerine eklenmiştir (stable;
 * davranış aynı).
 *
 * @returns {{ acquireBookLock: Function, releaseBookLock: Function }}
 */
export default function useBookLock({
  activeUserId,
  activeSessionId,
  setBookLockInfo,
  setBookLockWarning,
  showToast,
}) {
  const releaseBookLock = useCallback(
    async (projectId, bookId) => {
      const resolvedProjectId = String(projectId || '').trim();
      const resolvedBookId = String(bookId || '').trim();
      if (!resolvedProjectId || !resolvedBookId || !activeUserId || !activeSessionId) return;
      try {
        await apiRequest(`/projects/${resolvedProjectId}/books/${resolvedBookId}/unlock`, {
          method: 'POST',
          timeoutMs: BOOK_LOCK_REQUEST_TIMEOUT_MS,
        });
      } catch {}
      setBookLockInfo((current) =>
        current?.projectId === resolvedProjectId && current?.bookId === resolvedBookId
          ? null
          : current
      );
    },
    [activeSessionId, activeUserId, setBookLockInfo]
  );

  const acquireBookLock = useCallback(
    async (projectId, bookId) => {
      const resolvedProjectId = String(projectId || '').trim();
      const resolvedBookId = String(bookId || '').trim();
      if (!resolvedProjectId || !resolvedBookId) return false;
      try {
        const response = await apiRequest(
          `/projects/${resolvedProjectId}/books/${resolvedBookId}/lock`,
          { method: 'POST', timeoutMs: BOOK_LOCK_REQUEST_TIMEOUT_MS }
        );
        setBookLockInfo(response?.lock || { projectId: resolvedProjectId, bookId: resolvedBookId });
        setBookLockWarning('');
        return true;
      } catch (error) {
        if (error?.code === 'BOOK_LOCKED') {
          const message = formatBookLockMessage(error.lock, error.message || 'Bu kitap kilitli.');
          setBookLockWarning(message);
          showToast(message, 'warning');
          return false;
        }
        throw error;
      }
    },
    [setBookLockInfo, setBookLockWarning, showToast]
  );

  return { acquireBookLock, releaseBookLock };
}
