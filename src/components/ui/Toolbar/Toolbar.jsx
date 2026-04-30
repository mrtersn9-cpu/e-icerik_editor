import React from 'react';

import styles from './Toolbar.module.css';

export function Toolbar({ children, sticky = false, style }) {
  return (
    <div className={`${styles.toolbar} ${sticky ? styles.sticky : ''}`} style={style} role="toolbar">
      {children}
    </div>
  );
}

export function ToolbarGroup({ children }) {
  return <div className={styles.group}>{children}</div>;
}

export function ToolbarDivider() {
  return <div className={styles.divider} aria-hidden="true" />;
}

export default Toolbar;
