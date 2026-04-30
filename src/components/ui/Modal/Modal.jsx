import React from 'react';

import styles from './Modal.module.css';

export function Modal({ title, onClose, width = 400, children }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} style={{ width }}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Kapat">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
