import React from 'react';

import styles from './Skeleton.module.css';

export function Skeleton({ variant = 'rect', width, height, style }) {
  return (
    <div
      className={`${styles.skeleton} ${styles[variant] || ''}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

export default Skeleton;
