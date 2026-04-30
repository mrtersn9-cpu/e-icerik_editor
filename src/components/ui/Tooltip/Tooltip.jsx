import React, { useState } from 'react';

import styles from './Tooltip.module.css';

export function Tooltip({ children, text, placement = 'top' }) {
  const [visible, setVisible] = useState(false);

  if (!text) return children;

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`${styles.tooltip} ${styles[placement]}`} role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
