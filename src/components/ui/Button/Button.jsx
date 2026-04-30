import React from 'react';

import styles from './Button.module.css';

export function Btn({ children, onClick, color, small = false, disabled = false, style: s = {} }) {
  const dynamicStyle = color ? { borderColor: color, color, background: `${color}22` } : {};

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles.btn} ${small ? styles.small : ''}`}
      style={{ ...dynamicStyle, ...s }}
    >
      {children}
    </button>
  );
}

export default Btn;
