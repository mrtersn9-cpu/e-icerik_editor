import React from 'react';

import styles from './Select.module.css';

/**
 * Ortak açılır liste.
 * - options: [{ value, label }]
 * - style / className → doğrudan select'e uygulanır.
 * - geri kalan props (disabled, name…) geçer.
 */
export function SelectInp({ label, value, onChange, options, style, className = '', ...rest }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <select
        value={value}
        onChange={onChange}
        className={`${styles.select} ${className}`.trim()}
        style={style}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SelectInp;
