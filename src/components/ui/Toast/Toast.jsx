import React, { useEffect, useState } from 'react';

import styles from './Toast.module.css';

const ICONS = {
  success: '✓',
  error: '×',
  warning: '!',
  info: 'i',
};

function ToastItem({ id, message, type = 'info', duration = 4000, onRemove }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onRemove(id), 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  return (
    <div className={`${styles.toast} ${styles[type] || ''} ${leaving ? styles.leaving : ''}`} role="alert">
      <span className={styles.icon}>{ICONS[type] || ICONS.info}</span>
      <span className={styles.body}>{message}</span>
      <button className={styles.close} onClick={() => { setLeaving(true); setTimeout(() => onRemove(id), 200); }} aria-label="Kapat">
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ toasts, onRemove }) {
  return (
    <div className={styles.container} aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onRemove={onRemove} />
      ))}
    </div>
  );
}

export default ToastProvider;
