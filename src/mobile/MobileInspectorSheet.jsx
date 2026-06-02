import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import ContextRightPanel from '../features/editor-workspace/right/ContextRightPanel';
import useBackDismissible from '../features/navigation/useBackDismissible';

import styles from './MobileInspectorSheet.module.css';

/*
 * Mobil denetleyici alt sheet. İçeriği mevcut ContextRightPanel (aynı
 * controller/inspectorProps). Üç durak: 'half' | 'full' (+ kapalı = open:false).
 * Tablet modunda sağ kenara yapışık dikey panel olur.
 */
export default function MobileInspectorSheet({
  open,
  snap,
  onSnapChange,
  onClose,
  controller,
  inspectorProps,
  registerBackDismissible,
  isTablet = false,
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef(null);

  useBackDismissible({
    id: 'mobile-inspector-sheet',
    open,
    onDismiss: onClose,
    priority: 720,
    registerBackDismissible,
  });

  // sürükleme ile yarı/tam/kapat geçişi (telefon modunda)
  const onPointerDown = useCallback(
    (event) => {
      if (isTablet) return;
      dragRef.current = { startY: event.clientY, moved: 0 };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [isTablet]
  );

  const onPointerMove = useCallback((event) => {
    if (!dragRef.current) return;
    const delta = event.clientY - dragRef.current.startY;
    dragRef.current.moved = delta;
    setDragOffset(Math.max(-40, delta));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const moved = dragRef.current.moved;
    dragRef.current = null;
    setDragOffset(0);
    if (moved > 90) {
      // aşağı sürükle: tam→yarı, yarı→kapat
      if (snap === 'full') onSnapChange('half');
      else onClose();
    } else if (moved < -90) {
      // yukarı sürükle: yarı→tam
      if (snap === 'half') onSnapChange('full');
    }
  }, [snap, onSnapChange, onClose]);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  if (!open) return null;

  const heightVh = snap === 'full' ? 90 : 48;
  const sheetStyle = isTablet
    ? undefined
    : { height: `${heightVh}vh`, transform: dragOffset ? `translateY(${dragOffset}px)` : undefined };

  return (
    <>
      {/* Yarı açıkken scrim yok → canvas dokunulabilir kalır (Canva hissi). */}
      {!isTablet && snap === 'full' && (
        <div className={styles.scrim} onClick={onClose} role="presentation" />
      )}
      <aside
        className={`${styles.sheet} ${isTablet ? styles.sheetTablet : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Özellikler"
      >
        <div
          className={styles.handleBar}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {!isTablet && <span className={styles.grip} aria-hidden="true" />}
          <div className={styles.handleRow}>
            <span className={styles.handleTitle}>Özellikler</span>
            <div className={styles.handleActions}>
              {!isTablet && (
                <button
                  type="button"
                  className={styles.snapBtn}
                  onClick={() => onSnapChange(snap === 'full' ? 'half' : 'full')}
                  aria-label={snap === 'full' ? 'Küçült' : 'Büyüt'}
                >
                  {snap === 'full' ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                </button>
              )}
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
                <X size={17} />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.content}>
          <ContextRightPanel
            controller={controller}
            inspectorProps={inspectorProps}
            registerBackDismissible={registerBackDismissible}
          />
        </div>
      </aside>
    </>
  );
}
