import { useCallback, useEffect, useRef } from 'react';

import { PANEL_LIMITS } from '../../constants';
import useEditorStore from '../../store/useEditorStore';
import { clamp } from '../../utils/editorHelpers';

/**
 * Panel ve zaman çizelgesi yeniden boyutlandırma mantığını yöneten hook.
 *
 * Tüm boyut state'ini ve setter'larını doğrudan editör store'undan okur;
 * dışarıdan bağımlılık almaz. EIcerikEditor'dan birebir taşınmıştır —
 * davranış (clamp sınırları, imleç/seçim stilleri, sıfırlama değerleri)
 * orijinaliyle aynıdır.
 *
 * startLayoutResize(type, e): sürüklemeyi başlatır ('timeline' | 'left-panel' | 'right-panel').
 * resetLayout(): panel/zoom/zaman çizelgesi boyutlarını varsayılana döndürür.
 *
 * @returns {{ startLayoutResize: Function, resetLayout: Function }}
 */
export default function useLayoutResize() {
  // Sürükleme oturumu: tip + başlangıç fare konumu + başlangıç boyut değeri.
  const resizeSessionRef = useRef(null);

  // Aktif boyut değerleri — startLayoutResize başlangıç değerini bunlardan alır.
  const timelineHeight = useEditorStore((state) => state.timelineHeight);
  const leftPanelWidth = useEditorStore((state) => state.leftPanelWidth);
  const rightPanelWidth = useEditorStore((state) => state.rightPanelWidth);

  // Boyut setter'ları — doğrudan store'dan.
  const setTimelineHeight = useEditorStore((state) => state.setTimelineHeight);
  const setLeftPanelWidth = useEditorStore((state) => state.setLeftPanelWidth);
  const setRightPanelWidth = useEditorStore((state) => state.setRightPanelWidth);

  // resetLayout'un dokunduğu diğer görünüm setter'ları.
  const setPanelScale = useEditorStore((state) => state.setPanelScale);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setTimelineCurrentTime = useEditorStore((state) => state.setTimelineCurrentTime);
  const setTimelinePlaying = useEditorStore((state) => state.setTimelinePlaying);
  const setIsSlidePanelCollapsed = useEditorStore((state) => state.setIsSlidePanelCollapsed);

  // pointermove/pointerup: sürükleme sırasında ilgili boyutu clamp'leyerek günceller.
  useEffect(() => {
    const handlePointerMove = (e) => {
      const session = resizeSessionRef.current;
      if (!session) return;
      if (session.type === 'timeline') {
        setTimelineHeight(clamp(session.startValue + (session.startY - e.clientY), 180, 460));
      } else if (session.type === 'right-panel') {
        setRightPanelWidth(
          clamp(
            session.startValue + (session.startX - e.clientX),
            PANEL_LIMITS.right.min,
            PANEL_LIMITS.right.max
          )
        );
      } else if (session.type === 'left-panel') {
        setLeftPanelWidth(
          clamp(
            session.startValue + (e.clientX - session.startX),
            PANEL_LIMITS.left.min,
            PANEL_LIMITS.left.max
          )
        );
      }
    };

    const handlePointerUp = () => {
      if (!resizeSessionRef.current) return;
      resizeSessionRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [setLeftPanelWidth, setRightPanelWidth, setTimelineHeight]);

  const startLayoutResize = useCallback(
    (type, e) => {
      e.preventDefault();
      resizeSessionRef.current = {
        type,
        startX: e.clientX,
        startY: e.clientY,
        startValue:
          type === 'timeline'
            ? timelineHeight
            : type === 'right-panel'
              ? rightPanelWidth
              : leftPanelWidth,
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = type === 'timeline' ? 'row-resize' : 'col-resize';
    },
    [leftPanelWidth, rightPanelWidth, timelineHeight]
  );

  const resetLayout = useCallback(() => {
    setPanelScale(1);
    setZoom('fit');
    setTimelineHeight(220);
    setTimelineCurrentTime(0);
    setTimelinePlaying(false);
    setIsSlidePanelCollapsed(false);
    setLeftPanelWidth(PANEL_LIMITS.left.default);
    setRightPanelWidth(PANEL_LIMITS.right.default);
  }, [
    setIsSlidePanelCollapsed,
    setLeftPanelWidth,
    setPanelScale,
    setRightPanelWidth,
    setTimelineCurrentTime,
    setTimelineHeight,
    setTimelinePlaying,
    setZoom,
  ]);

  return { startLayoutResize, resetLayout };
}
