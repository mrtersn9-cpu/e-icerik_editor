import styles from './ToastStack.module.css';

/**
 * Sağ üstte beliren bildirim (toast) yığını. Açık tema, token tabanlı.
 *
 * Görünürlük kontrolü (toasts.length > 0) çağıran tarafta kalır.
 *
 * Props: toasts ({ id, type?, message } dizisi), onDismiss(id) (kapatma tıklaması).
 *
 * @returns {JSX.Element}
 */
export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div className={styles.container}>
      {toasts.map((t) => {
        const typeClass = styles[t.type] || '';
        const symbol = t.type === 'success' ? '✓' : t.type === 'warning' ? '⚠' : '✕';
        return (
          <div key={t.id} className={`${styles.toast} ${typeClass}`.trim()} role="status">
            <span className={styles.icon}>{symbol}</span>
            <span className={styles.body}>{t.message}</span>
            <button onClick={() => onDismiss(t.id)} className={styles.close} aria-label="Kapat">
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
