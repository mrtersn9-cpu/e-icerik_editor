import React from 'react';

import styles from './EmptyState.module.css';

export function EmptyState({ icon = '📭', title, body, children }) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon}>{icon}</div>
      {title && <div className={styles.title}>{title}</div>}
      {body && <div className={styles.body}>{body}</div>}
      {children && <div className={styles.action}>{children}</div>}
    </div>
  );
}

export default EmptyState;
