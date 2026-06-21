import React from 'react';

import styles from './Button.module.css';

/**
 * Ortak buton.
 * - variant: 'secondary' (varsayılan) | 'primary' | 'danger' | 'ghost'
 * - small:   küçük boyut
 * - color:   (geriye dönük uyum) verilirse çerçeve/yazı o renge boyanır
 * - geri kalan tüm props (title, type, aria-*, onMouseEnter…) butona geçer.
 */
export function Btn({
  children,
  onClick,
  color,
  variant = 'secondary',
  small = false,
  disabled = false,
  style: s = {},
  className = '',
  type = 'button',
  ...rest
}) {
  // Eski çağrılar `color` ile renk veriyordu: çerçeveli + tonlu görünüm.
  const dynamicStyle = color ? { borderColor: color, color, background: `${color}1a` } : {};
  const variantClass = !color && variant !== 'secondary' ? styles[variant] : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.btn} ${variantClass} ${small ? styles.small : ''} ${className}`.trim()}
      style={{ ...dynamicStyle, ...s }}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Btn;
