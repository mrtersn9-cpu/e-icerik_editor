import React from 'react';

import styles from './Input.module.css';

export function Inp({ label, value, onChange, type = 'text', placeholder = '', rows }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          rows={rows || 3}
          placeholder={placeholder}
          className={styles.textarea}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={styles.input}
        />
      )}
    </div>
  );
}

export default Inp;
