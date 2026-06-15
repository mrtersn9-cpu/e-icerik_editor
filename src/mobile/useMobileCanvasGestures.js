import { useEffect, useRef } from 'react';

import { MOBILE_CANVAS } from './mobileCanvasConfig';

function clamp(value, lo, hi) {
  return Math.min(Math.max(value, lo), hi);
}

/**
 * StageCanvas için additive dokunma jest katmanı (yalnızca touchMode açıkken).
 * Masaüstü kod yolunu HİÇ değiştirmez; bu hook `enabled=false` iken hiçbir
 * dinleyici bağlamaz.
 *
 * Jestler:
 *   - İki parmak: pinch-to-zoom + pan (orta nokta sabit tutulmaya çalışılır)
 *   - Tek parmak (arka planda): canvas pan (scroll)
 *   - Tek parmak (arka planda, hareketsiz): tap → seçim temizle
 *   - Nesne üzerindeki tek parmak: hook karışmaz (mevcut pointer mantığı taşır)
 */
export default function useMobileCanvasGestures({
  enabled,
  viewportRef,
  getScale,
  onZoomChange,
  multiTouchRef,
}) {
  const stateRef = useRef(null);
  // En güncel callback'leri ref'te tut — dinleyiciyi yeniden bağlamamak için
  const handlersRef = useRef({ getScale, onZoomChange });
  handlersRef.current = { getScale, onZoomChange };

  useEffect(() => {
    if (!enabled) return undefined;
    const node = viewportRef.current;
    if (!node) return undefined;

    const dist = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const mid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

    const onTouchStart = (event) => {
      if (event.touches.length === 2) {
        const [a, b] = event.touches;
        if (multiTouchRef) multiTouchRef.current = true;
        stateRef.current = {
          mode: 'pinch',
          startDist: dist(a, b) || 1,
          startScale: handlersRef.current.getScale() || 1,
          startScroll: { left: node.scrollLeft, top: node.scrollTop },
          startMid: mid(a, b),
        };
        // 2 parmak: native scroll yerine pinch-zoom alıyoruz
        event.preventDefault();
      } else {
        stateRef.current = null;
      }
    };

    const onTouchMove = (event) => {
      const st = stateRef.current;
      if (!st || st.mode !== 'pinch') return;
      if (event.touches.length !== 2) return;

      event.preventDefault();
      const [a, b] = event.touches;
      const ratio = dist(a, b) / st.startDist;
      const next = clamp(st.startScale * ratio, MOBILE_CANVAS.minScale, MOBILE_CANVAS.maxScale);
      handlersRef.current.onZoomChange?.(Number(next.toFixed(3)));
      // orta noktanın hareketi kadar kaydır (zoom yaparken pozisyon sabitleme)
      const m = mid(a, b);
      node.scrollLeft = st.startScroll.left + (st.startMid.x - m.x);
      node.scrollTop = st.startScroll.top + (st.startMid.y - m.y);
    };

    const onTouchEnd = (event) => {
      if (event.touches.length < 2 && multiTouchRef) multiTouchRef.current = false;
      if (event.touches.length < 2) {
        stateRef.current = null;
      }
    };

    node.addEventListener('touchstart', onTouchStart, { passive: false });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd, { passive: false });
    node.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, viewportRef, multiTouchRef]);
}
