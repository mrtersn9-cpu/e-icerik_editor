import React from 'react';

import styles from './Input.module.css';

/**
 * Ortak metin girişi.
 * - type='textarea' → çok satırlı alan.
 * - style / className → sarmalayıcı yerine doğrudan input/textarea'ya uygulanır.
 * - geri kalan props (name, min, max, step, onKeyDown, disabled, autoFocus…) geçer.
 */
export function Inp({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  rows,
  style,
  className = '',
  ...rest
}) {
  const controlClass = type === 'textarea' ? styles.textarea : styles.input;
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          rows={rows || 3}
          placeholder={placeholder}
          className={`${controlClass} ${className}`.trim()}
          style={style}
          {...rest}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${controlClass} ${className}`.trim()}
          style={style}
          {...rest}
        />
      )}
    </div>
  );
}

export default Inp;
