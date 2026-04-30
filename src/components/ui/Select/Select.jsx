import React from 'react';

import styles from './Select.module.css';

export function SelectInp({ label, value, onChange, options }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <select value={value} onChange={onChange} className={styles.select}>
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
