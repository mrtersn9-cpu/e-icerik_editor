import React from 'react';

import styles from './Panel.module.css';

export function Panel({ children, title, variant = 'default', compact = false, headerAction, style }) {
  return (
    <div className={`${styles.panel} ${styles[variant] || ''} ${compact ? styles.compact : ''}`} style={style}>
      {title && (
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          {headerAction}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export default Panel;
