import React from 'react';

import styles from './Modal.module.css';

const SIZE_WIDTH = { sm: 460, md: 620, lg: 860, xl: 1040 };

/**
 * Ortak açılır pencere (modal).
 * - size: 'sm' | 'md' (varsayılan) | 'lg' | 'xl' → genişlik
 * - width: sayı verilirse size'ı ezer (geriye dönük uyum)
 * - subtitle: başlık altı açıklama (opsiyonel)
 * - footer: alt aksiyon alanı (opsiyonel) — verilirse içerik altında ayrı bölüm
 * - onClose: arka plana tıklanınca da çağrılır
 */
export function Modal({ title, subtitle, onClose, size = 'md', width, footer, children }) {
  const w = width != null ? width : SIZE_WIDTH[size] || SIZE_WIDTH.md;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={styles.dialog} style={{ width: w }} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className={styles.header}>
            <div className={styles.titleWrap}>
              {title && <div className={styles.title}>{title}</div>}
              {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
            </div>
            {onClose && (
              <button onClick={onClose} className={styles.closeBtn} aria-label="Kapat">
                ✕
              </button>
            )}
          </div>
        )}
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
