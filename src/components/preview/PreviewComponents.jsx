import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../constants';
import { getLivesConfig } from '../../features/cevap/livesIcons';
import { getAutoAnswerSummary, getCorrectSelectionIds } from '../../logic/activityScoring';
import { ButtonPackageIntroDiagram } from '../../logic/buttonStyling';
import { runtimeText } from '../../logic/contentLanguage';
import {
  getCorrectDragMatches,
  getDragDropPairsFromMatches,
  buildDragDropPlacementsFromMatches,
  buildDragDropPlacementLayout,
  buildDragDropMatchMapFromPairs,
  areDragDropScopesCompatible,
  getDropCapacityLimit,
  isDragReusable,
  evaluateDragDropPlacements,
  createDragDropPlacement,
} from '../../logic/dragDrop';
import {
  resolvePreviewFlowTarget,
  resolvePreviewButtonLayoutStyle,
  buildResolvedLayerNameMap,
} from '../../logic/factories';
import {
  normalizeActivity,
  materializeActivitySlide,
  getActivitySlides,
  getPreviewPhaseActivity,
  getSelectionUi,
  getSelectionMarkGlyph,
  resolveWrongSelectionGlyph,
} from '../../logic/normalize';
import {
  getInitialPreviewPhase,
  buildRuntimeVariableMap,
  runPreviewTriggers,
  RuntimeObjectLayer,
} from '../../logic/previewEngine';
import {
  getFitScale,
  getCanvasObjects,
  getActivityLayers,
  isObjectTimelineActive,
} from '../../logic/timeline';
import { getPackageTheme, shuffleArray } from '../../logic/uiPrimitives';
import { sanitizeSvgMarkup } from '../../utils/editorHelpers';
import SlideTransitionView from '../editor/SlideTransitionView';
import { LayerThumbnail } from '../SlideStrip';

// Can/hak göstergesi — kalan can = livesCount - attempts. Dolu canlar seçilen
// simge/resimle, biten canlar soluk gösterilir. Önizleme ve SCORM aynı veriyi kullanır.
function LivesBar({ activity, attempts = 0 }) {
  const lives = getLivesConfig(activity);
  if (!lives.enabled) return null;
  const remaining = Math.max(0, lives.count - attempts);
  return (
    <div
      role="status"
      aria-label={`Kalan can: ${remaining} / ${lives.count}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, lineHeight: 1 }}
    >
      {Array.from({ length: lives.count }).map((_, i) => {
        const filled = i < remaining;
        return lives.useCustom ? (
          <img
            key={i}
            src={lives.customImage}
            alt=""
            style={{ width: 20, height: 20, objectFit: 'contain', opacity: filled ? 1 : 0.25, filter: filled ? 'none' : 'grayscale(1)' }}
          />
        ) : (
          <span key={i} style={{ fontSize: 18, opacity: filled ? 1 : 0.25, filter: filled ? 'none' : 'grayscale(1)' }}>
            {lives.glyph}
          </span>
        );
      })}
    </div>
  );
}

function PreviewDragDrop({ activity }) {
  const stageRef = useRef(null);
  const dragging = useRef(null);
  const activeHandlersRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [matched, setMatched] = useState({});
  const [hoveredDropId, setHoveredDropId] = useState(null);
  const canvasObjects = getCanvasObjects(activity);
  const drags = canvasObjects.filter((o) => o.type === 'draggable');
  const drops = canvasObjects.filter((o) => o.type === 'dropzone');
  const scale = useMemo(() => {
    const sw = activity.stageWidth || 1920,
      sh = activity.stageHeight || 1080;
    return Math.min(1, 960 / sw, 540 / sh);
  }, [activity.stageWidth, activity.stageHeight]);
  const toStage = useCallback(
    (cx, cy) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
    },
    [scale]
  );

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (activeHandlersRef.current) {
        window.removeEventListener('pointermove', activeHandlersRef.current.move);
        window.removeEventListener('pointerup', activeHandlersRef.current.up);
        activeHandlersRef.current = null;
      }
    };
  }, []);

  const handleDown = useCallback(
    (e, id) => {
      if (matched[id]) return;
      e.preventDefault();
      e.currentTarget?.setPointerCapture?.(e.pointerId);
      const startPt = toStage(e.clientX, e.clientY);
      // Get current pos at drag start - don't use stale state closure
      setPositions((prev) => {
        const cp =
          prev[id] ||
          (() => {
            const d = drags.find((x) => x.id === id);
            return d ? { x: d.x, y: d.y } : { x: 0, y: 0 };
          })();
        dragging.current = {
          id,
          ox: startPt.x - cp.x,
          oy: startPt.y - cp.y,
          startPos: cp,
          currentPos: cp,
        };
        return prev;
      });

      const onMove = (me) => {
        if (!dragging.current) return;
        const pt = toStage(me.clientX, me.clientY);
        const { id: dragId, ox, oy } = dragging.current;
        const nx = pt.x - ox,
          ny = pt.y - oy;
        dragging.current.currentPos = { x: nx, y: ny };
        setPositions((prev) => ({ ...prev, [dragId]: { x: nx, y: ny } }));
        // Highlight hovered drop zone
        const d = drags.find((x) => x.id === dragId);
        const cx = nx + (d?.width || 0) / 2,
          cy = ny + (d?.height || 0) / 2;
        const hovered = drops.find(
          (dz) => cx >= dz.x && cx <= dz.x + dz.width && cy >= dz.y && cy <= dz.y + dz.height
        );
        setHoveredDropId(hovered?.id || null);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        activeHandlersRef.current = null;
        if (!dragging.current) return;
        const { id: dragId, startPos, currentPos } = dragging.current;
        const p = currentPos || startPos;
        const d = drags.find((x) => x.id === dragId);
        let matchedDz = null;
        for (const dz of drops) {
          const cx = p.x + (d?.width || 0) / 2,
            cy = p.y + (d?.height || 0) / 2;
          if (cx >= dz.x && cx <= dz.x + dz.width && cy >= dz.y && cy <= dz.y + dz.height) {
            const ok = !d?.group || d.group === dz.group;
            if (ok) matchedDz = dz;
            break;
          }
        }
        if (matchedDz) {
          setMatched((prev) => ({ ...prev, [dragId]: matchedDz.id }));
          setPositions((prev) => ({
            ...prev,
            [dragId]: {
              x: matchedDz.x + (matchedDz.width - (d?.width || 0)) / 2,
              y: matchedDz.y + (matchedDz.height - (d?.height || 0)) / 2,
            },
          }));
        } else {
          // Return to original position on wrong/no drop
          setPositions((prev) => ({ ...prev, [dragId]: startPos }));
        }
        dragging.current = null;
        setHoveredDropId(null);
      };

      activeHandlersRef.current = { move: onMove, up: onUp };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [matched, drags, drops, toStage]
  );

  const allMatched = drags.length > 0 && drags.every((d) => matched[d.id]);
  const vw = Math.round((activity.stageWidth || 1920) * scale);
  const vh = Math.round((activity.stageHeight || 1080) * scale);
  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={stageRef}
        style={{
          width: vw,
          height: vh,
          position: 'relative',
          background: activity.backgroundColor || '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        {activity.svgMarkup && (
          <div
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
          />
        )}
        {drops.map((dz) => {
          const isMatched = Object.values(matched).includes(dz.id);
          const isHovered = !isMatched && hoveredDropId === dz.id;
          return (
            <div
              key={dz.id}
              style={{
                position: 'absolute',
                left: dz.x * scale,
                top: dz.y * scale,
                width: dz.width * scale,
                height: dz.height * scale,
                border: `2px dashed ${isMatched ? '#4ade80' : isHovered ? '#a78bfa' : dz.style?.borderColor || '#f97316'}`,
                background: isMatched
                  ? 'rgba(74,222,128,.15)'
                  : isHovered
                    ? 'rgba(167,139,250,.15)'
                    : dz.style?.background || '#fed7aa',
                borderRadius: (dz.style?.borderRadius || 8) * scale,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11 * scale,
                color: isMatched ? '#22c55e' : isHovered ? '#7c3aed' : dz.style?.color || '#9a3412',
                fontWeight: 700,
                transition: 'border-color .12s, background .12s',
                zIndex: 1,
              }}
            >
              {!isMatched && (dz.label || 'Bırak')}
            </div>
          );
        })}
        {drags.map((d) => {
          const p = positions[d.id] || { x: d.x, y: d.y };
          const m = matched[d.id];
          const isDragging = dragging.current?.id === d.id;
          return (
            <div
              key={d.id}
              onPointerDown={(e) => handleDown(e, d.id)}
              style={{
                position: 'absolute',
                left: p.x * scale,
                top: p.y * scale,
                width: d.width * scale,
                height: d.height * scale,
                background: m ? 'rgba(74,222,128,.25)' : d.style?.background || '#dbeafe',
                border: `2px solid ${m ? '#4ade80' : d.style?.borderColor || '#2563eb'}`,
                borderRadius: (d.style?.borderRadius || 8) * scale,
                cursor: m ? 'default' : isDragging ? 'grabbing' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13 * scale,
                color: m ? '#15803d' : d.style?.color || '#1e40af',
                fontWeight: 700,
                userSelect: 'none',
                zIndex: isDragging ? 100 : 2,
                transition: isDragging ? 'none' : 'left .18s, top .18s',
                touchAction: 'none',
                boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.25)' : 'none',
              }}
            >
              {d.label || 'Sürükle'}
            </div>
          );
        })}
      </div>
      {allMatched && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 16,
            padding: '10px 24px',
            borderRadius: 10,
            background: '#4CAF50dd',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          ✓ Tebrikler! Tümü doğru yerleştirildi.
        </div>
      )}
    </div>
  );
}

function PreviewSelection({ activity }) {
  const [sel, setSel] = useState([]);
  const [done, setDone] = useState(false);
  const previewTx = runtimeText(activity);
  const opts = useMemo(
    () => (Array.isArray(activity.mcOptions) ? activity.mcOptions : []),
    [activity.mcOptions]
  );
  const multi = activity.mcMode === 'multi';
  const toggle = (id) => {
    if (done) return;
    setSel(multi ? (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]) : [id]);
  };
  const correct =
    done &&
    (() => {
      const c = opts.filter((o) => o.isCorrect).map((o) => o.id);
      return multi
        ? c.length === sel.length && c.every((x) => sel.includes(x))
        : sel.length === 1 && c.includes(sel[0]);
    })();
  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#E0E0E0', marginBottom: 16 }}>
        {activity.mcQuestion || 'Soru metni girilmemiş'}
      </h2>
      <p style={{ fontSize: 12, color: '#78909C', marginBottom: 20 }}>
        {multi ? 'Birden fazla seçenek işaretleyebilirsiniz' : 'Tek seçenek işaretleyiniz'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opts.map((o) => {
          const s = sel.includes(o.id),
            crt = done && o.isCorrect,
            wrg = done && s && !o.isCorrect;
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: `2px solid ${crt ? '#4CAF50' : wrg ? '#f44336' : s ? '#7C4DFF' : '#333'}`,
                background: crt ? '#4CAF5022' : wrg ? '#f4433622' : s ? '#7C4DFF22' : '#1a1a30',
                color: '#E0E0E0',
                textAlign: 'left',
                cursor: done ? 'default' : 'pointer',
                fontSize: 13,
                transition: 'all .15s',
              }}
            >
              {o.label || 'Seçenek'}
            </button>
          );
        })}
      </div>
      {!done ? (
        <button
          onClick={() => setDone(true)}
          style={{
            marginTop: 20,
            padding: '10px 32px',
            borderRadius: 8,
            border: 'none',
            background: '#7C4DFF',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {previewTx.checkLabel}
        </button>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: '12px 20px',
            borderRadius: 10,
            background: correct ? '#4CAF5033' : '#f4433633',
            color: correct ? '#4CAF50' : '#f44336',
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          {correct ? `✓ ${previewTx.correctShort}!` : `× ${previewTx.incorrectShort}!`}
          {!correct && (
            <button
              onClick={() => {
                setDone(false);
                setSel([]);
              }}
              style={{
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid #f44336',
                background: 'transparent',
                color: '#f44336',
                cursor: 'pointer',
              }}
            >
              {previewTx.retryShort}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewDebugOverlay({ theme, data, onClose }) {
  if (!data) return null;
  const pretty = (value) => {
    if (value === null || value === undefined) return 'yok';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  const rows = [
    ['Aşama', data.phase],
    ['Etkinlik', data.activityName],
    ['Slider', data.slideName || data.slideId],
    ['Katman', data.activeLayerId],
    ['Deneme', data.attempts],
    ['Seçimler', data.selectionLabels],
    ['Eşleşmeler', data.matchLabels],
    ['Gizli Nesneler', data.hiddenObjectIds],
    ['Nesne State', data.objectStates],
    ['Değişkenler', data.variables],
  ];
  return (
    <div
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'min(72vh, 760px)',
        overflow: 'auto',
        zIndex: 60,
        borderRadius: 22,
        border: `1px solid ${theme.border}55`,
        background: 'rgba(15,23,42,.92)',
        color: '#e2e8f0',
        boxShadow: '0 30px 80px rgba(15,23,42,.42), inset 0 1px 0 rgba(255,255,255,.06)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(148,163,184,.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          position: 'sticky',
          top: 0,
          background: 'rgba(15,23,42,.96)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              color: '#67e8f9',
            }}
          >
            Debug Overlay
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Preview state ve runtime degiskenleri
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,.24)',
            background: 'rgba(255,255,255,.06)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(148,163,184,.12)',
              background: 'rgba(255,255,255,.03)',
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: '#7dd3fc',
                marginBottom: 6,
              }}
            >
              {label}
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Consolas, monospace',
                fontSize: 11,
                lineHeight: 1.55,
                color: '#e2e8f0',
              }}
            >
              {pretty(value)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualLayerPreview({
  activity,
  activities,
  variableDefinitions = [],
  runtimeVariables = {},
  setRuntimeVariables,
  previewViewport = null,
  developerHintMode = false,
  onActiveLayerChange = () => {},
  onDebugDataChange = () => {},
}) {
  const [activeLayerId, setActiveLayerId] = useState(activity.activeLayerId || 'base');
  const [hiddenObjectIds, setHiddenObjectIds] = useState(() => new Set());
  const [objectStates, setObjectStates] = useState({});
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const theme = getPackageTheme(activity.buttonPackageId);
  const resolvedLayerNames = useMemo(
    () => buildResolvedLayerNameMap(getActivityLayers(activity), activity),
    [activity]
  );
  const orderedLayers = useMemo(() => {
    const layers = getActivityLayers(activity);
    return [
      ...layers.filter((layer) => layer.kind !== 'base'),
      ...layers.filter((layer) => layer.kind === 'base'),
    ];
  }, [activity]);
  const viewportWidth = previewViewport?.width || windowWidth;
  const viewportHeight =
    previewViewport?.height || (typeof window !== 'undefined' ? window.innerHeight : 860);
  const compactLayout = viewportWidth <= 980;
  const stageScale = useMemo(
    () =>
      getFitScale(
        activity.stageWidth || 1920,
        activity.stageHeight || 1080,
        Math.max(320, viewportWidth - (compactLayout ? 28 : 336)),
        Math.max(320, viewportHeight - (compactLayout ? 180 : 96))
      ),
    [activity.stageHeight, activity.stageWidth, compactLayout, viewportHeight, viewportWidth]
  );
  const stageWidth = Math.round((activity.stageWidth || 1920) * stageScale);
  const stageHeight = Math.round((activity.stageHeight || 1080) * stageScale);
  const activeLayer =
    orderedLayers.find((layer) => layer.id === activeLayerId) ||
    orderedLayers[orderedLayers.length - 1] ||
    null;
  const stageSelectionObjects = useMemo(
    () =>
      getCanvasObjects(activity, activeLayerId, hiddenObjectIds).filter(
        (object) => object.visible !== false && !!object.selectionQuestionId
      ),
    [activity, activeLayerId, hiddenObjectIds]
  );
  const stageSelectionChoicesByQuestion = useMemo(
    () =>
      Object.fromEntries(
        [
          ...new Set(
            stageSelectionObjects.map((object) => object.selectionQuestionId).filter(Boolean)
          ),
        ].map((questionId) => [
          questionId,
          stageSelectionObjects.filter((object) => object.selectionQuestionId === questionId),
        ])
      ),
    [stageSelectionObjects]
  );
  const selectedObjectIds = useMemo(
    () =>
      Object.entries(objectStates || {})
        .filter(([, value]) => value?.selected)
        .map(([id]) => id),
    [objectStates]
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setActiveLayerId(activity.activeLayerId || 'base');
    setHiddenObjectIds(new Set());
    setObjectStates({});
  }, [activity.activeLayerId, activity.id, activity.currentSlideId]);

  useEffect(() => {
    onActiveLayerChange(activeLayerId);
  }, [activeLayerId, onActiveLayerChange]);

  useEffect(() => {
    onDebugDataChange({
      activeLayerId,
      activeLayerName: activeLayer?.name || 'Ana Katman',
      hiddenObjectIds: [...hiddenObjectIds],
      objectStates,
      variables: runtimeVariables,
    });
  }, [
    activeLayer,
    activeLayerId,
    hiddenObjectIds,
    objectStates,
    onDebugDataChange,
    runtimeVariables,
  ]);

  const setLayer = useCallback(
    (layerId) => {
      if (!orderedLayers.some((layer) => layer.id === layerId)) return;
      setActiveLayerId(layerId);
    },
    [orderedLayers]
  );

  const runObjectTriggers = useCallback(
    (objectId, when = 'onClick') => {
      const nextObjectStates = {
        ...objectStates,
        [objectId]: {
          ...(objectStates?.[objectId] || {}),
          visited: when !== 'onLoad' ? true : objectStates?.[objectId]?.visited || false,
          selected: when === 'onClick' ? true : objectStates?.[objectId]?.selected || false,
        },
      };
      setObjectStates(nextObjectStates);
      runPreviewTriggers({
        activity,
        activities,
        objectId,
        when,
        setActiveLayerId: setLayer,
        hiddenObjectIds,
        setHiddenObjectIds,
        variables: runtimeVariables,
        setVariables: setRuntimeVariables,
        variableDefinitions,
        objectStates: nextObjectStates,
        setObjectStates,
      });
    },
    [
      activity,
      activities,
      hiddenObjectIds,
      objectStates,
      runtimeVariables,
      setRuntimeVariables,
      setLayer,
      variableDefinitions,
    ]
  );

  useEffect(() => {
    runPreviewTriggers({
      activity,
      activities,
      objectId: '__activity__',
      when: 'onLoad',
      setActiveLayerId: setLayer,
      hiddenObjectIds: new Set(),
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: {},
      setObjectStates,
    });
  }, [
    activity,
    activity.id,
    activity.currentSlideId,
    activities,
    runtimeVariables,
    setRuntimeVariables,
    setLayer,
    variableDefinitions,
  ]);

  const toggleStageSelection = useCallback(
    (objectId) => {
      const selectedObject = stageSelectionObjects.find((object) => object.id === objectId);
      if (!selectedObject) return;
      const siblingIds = (
        stageSelectionChoicesByQuestion[selectedObject.selectionQuestionId] || []
      ).map((object) => object.id);
      setObjectStates((prev) => {
        const next = { ...prev };
        siblingIds.forEach((id) => {
          const currentlySelected = !!prev?.[id]?.selected;
          const shouldToggleOff = siblingIds.length === 1 && id === objectId && currentlySelected;
          next[id] = {
            ...(next[id] || {}),
            selected: shouldToggleOff ? false : id === objectId,
            visited: true,
          };
        });
        return next;
      });
    },
    [stageSelectionChoicesByQuestion, stageSelectionObjects]
  );

  const legacySelectionMode = activity.type === 'selection' && stageSelectionObjects.length === 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: compactLayout ? 'column' : 'row',
        gap: 14,
        minHeight: 0,
      }}
    >
      <div
        style={{
          width: compactLayout ? '100%' : 286,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            borderRadius: 22,
            border: `1px solid ${theme.border}22`,
            background: 'rgba(15,23,42,.78)',
            padding: 14,
            color: '#e2e8f0',
            boxShadow: '0 18px 40px rgba(15,23,42,.2)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              color: '#7dd3fc',
            }}
          >
            Slide Layers
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6, lineHeight: 1.6 }}>
            Otomatik tanıtım ve doğru/yanlış ekranları kaldırıldı. Görünen alan her zaman{' '}
            <strong>ana katman + seçtiğin katman</strong>.
          </div>
        </div>

        <div
          style={{
            flex: compactLayout ? '0 0 auto' : 1,
            minHeight: 0,
            borderRadius: 22,
            border: `1px solid ${theme.border}22`,
            background: 'rgba(255,255,255,.96)',
            overflow: 'hidden',
            boxShadow: '0 18px 42px rgba(15,23,42,.12)',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(148,163,184,.2)',
              background: 'linear-gradient(180deg,#f8fafc,#eef2ff)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: '#475569',
              }}
            >
              Layer Listesi
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Articulate mantığıyla görünür katmanları test et.
            </div>
          </div>
          <div
            style={{
              maxHeight: compactLayout ? 280 : '100%',
              overflowY: 'auto',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {orderedLayers.map((layer, index) => {
              const isActive = layer.id === activeLayerId;
              const layerObjects = (activity.objects || []).filter(
                (object) => (object.layerId || 'base') === layer.id
              );
              const isBase = layer.kind === 'base';
              return (
                <button
                  key={layer.id}
                  onClick={() => setLayer(layer.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    padding: 8,
                    borderRadius: 14,
                    border: `1px solid ${isActive ? '#60a5fa' : '#dbe2ea'}`,
                    background: isActive
                      ? 'linear-gradient(180deg,#dbeafe,#ffffff)'
                      : 'linear-gradient(180deg,#ffffff,#f8fafc)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <LayerThumbnail activity={activity} layer={layer} isActive={isActive} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                    >
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: isBase ? '#e2e8f0' : '#dbeafe',
                          color: isBase ? '#475569' : '#1d4ed8',
                          fontSize: 9,
                          fontWeight: 900,
                        }}
                      >
                        {isBase ? 'Temel Katman' : 'Katman'}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {resolvedLayerNames[layer.id] ||
                          (isBase ? 'Temel Katman' : `${index + 1}. Katman`)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                      {layerObjects.length} nesne
                    </div>
                  </div>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      border: `1px solid ${isActive ? '#60a5fa' : '#cbd5e1'}`,
                      background: isActive ? '#dbeafe' : '#ffffff',
                      color: isActive ? '#2563eb' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {isActive ? '●' : '○'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {legacySelectionMode && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 18,
              border: '1px solid rgba(251,191,36,.35)',
              background: 'rgba(254,243,199,.92)',
              color: '#92400e',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Bu sahne eski otomatik seçim yapısını kullanıyor. Yeni sistemde seçim alanlarını
            doğrudan sahne nesnesi olarak kurup katman geçişlerini <strong>Etkileşim</strong>{' '}
            sekmesindeki <strong>Katmana Geç</strong> trigger'larıyla yöneteceğiz.
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 26,
            background: 'linear-gradient(180deg,#081120 0%,#0f172a 100%)',
            border: `1px solid ${theme.border}22`,
            padding: compactLayout ? 14 : 20,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              width: stageWidth,
              height: stageHeight,
              position: 'relative',
              background: activity.backgroundColor || '#ffffff',
              borderRadius: 22,
              overflow: 'hidden',
              margin: '0 auto',
              border: `1px solid ${theme.border}22`,
              boxShadow: '0 22px 60px rgba(15,23,42,.2)',
            }}
          >
            {activity.svgMarkup && (
              <div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
              />
            )}
            <RuntimeObjectLayer
              activity={activity}
              activeLayerId={activeLayerId}
              hiddenObjectIds={hiddenObjectIds}
              objectStates={objectStates}
              onRunTriggers={runObjectTriggers}
              onSelectionChoice={toggleStageSelection}
              selectedObjectIds={selectedObjectIds}
              hintObjectIds={
                developerHintMode
                  ? stageSelectionObjects
                      .filter((object) => object.selectionCorrect)
                      .map((object) => object.id)
                  : []
              }
              scale={stageScale}
              includeDragDrop
              currentTime={0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPlayer({ activity, activities, variables = [] }) {
  const [currentId, setCurrentId] = useState(activity?.id || null);
  const [runtimeVariables, setRuntimeVariables] = useState(() =>
    buildRuntimeVariableMap(variables)
  );
  const [debugOpen, setDebugOpen] = useState(false);
  const [developerHintMode, setDeveloperHintMode] = useState(false);
  const [flowPhase, setFlowPhase] = useState(activity?.activeLayerId || 'base');
  const [flowDebugData, setFlowDebugData] = useState(null);
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const normalizedActivities = useMemo(
    () => activities.map((item) => normalizeActivity(item)),
    [activities]
  );
  const [activitySlideMap, setActivitySlideMap] = useState(() =>
    Object.fromEntries(normalizedActivities.map((item) => [item.id, item.currentSlideId]))
  );

  useEffect(() => {
    setCurrentId(activity?.id || null);
  }, [activity?.id]);

  useEffect(() => {
    if (!activity?.id) return;
    const normalized = normalizeActivity(activity);
    setActivitySlideMap((prev) => ({
      ...prev,
      [normalized.id]: normalized.currentSlideId,
    }));
  }, [activity, activity?.id, activity?.currentSlideId]);

  useEffect(() => {
    setRuntimeVariables(buildRuntimeVariableMap(variables));
  }, [variables]);

  useEffect(() => {
    setActivitySlideMap((prev) => {
      const next = { ...prev };
      normalizedActivities.forEach((item) => {
        if (!next[item.id]) next[item.id] = item.currentSlideId;
      });
      return next;
    });
  }, [normalizedActivities]);

  const currentRawActivity = useMemo(
    () =>
      normalizedActivities.find((item) => item.id === currentId) ||
      normalizeActivity(activity || {}),
    [normalizedActivities, activity, currentId]
  );
  const currentSlideId =
    activitySlideMap[currentRawActivity?.id] || currentRawActivity?.currentSlideId;
  const currentActivity = useMemo(
    () =>
      currentRawActivity ? materializeActivitySlide(currentRawActivity, currentSlideId) : null,
    [currentRawActivity, currentSlideId]
  );
  const currentTheme = useMemo(
    () => getPackageTheme(currentActivity?.buttonPackageId),
    [currentActivity?.buttonPackageId]
  );

  useEffect(() => {
    setFlowDebugData(null);
    setPreviewResetKey((value) => value + 1);
  }, [currentActivity?.id, currentSlideId]);

  const devicePresets = [
    { id: 'desktop', label: 'Masaüstü', icon: '▭', width: '100%', height: '100%', radius: 16 },
    { id: 'tablet', label: 'Tablet', icon: '▯', width: 900, height: 680, radius: 24 },
    { id: 'mobile', label: 'Mobil', icon: '▮', width: 430, height: 760, radius: 36 },
  ];
  const [devicePreset, setDevicePreset] = useState('desktop');
  const debugData = {
    activityName: currentActivity.name,
    activityId: currentActivity.id,
    slideId: currentSlideId,
    slideName:
      getActivitySlides(currentRawActivity).find((slide) => slide.id === currentSlideId)?.name ||
      currentSlideId,
    phase: flowDebugData?.activeLayerName || flowPhase,
    variables: runtimeVariables,
    ...flowDebugData,
  };
  const toolbarBtn = (active) => ({
    minHeight: 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? currentTheme.border : 'rgba(255,255,255,.14)'}`,
    background: active ? currentTheme.button : 'rgba(255,255,255,.06)',
    color: active ? currentTheme.text : 'rgba(255,255,255,.82)',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: active ? `0 10px 24px ${currentTheme.border}33` : 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  const currentDevicePreset =
    devicePresets.find((item) => item.id === devicePreset) || devicePresets[0];
  const previewViewport = useMemo(
    () =>
      currentDevicePreset.id === 'desktop'
        ? { width: 1200, height: 760 }
        : {
            width:
              (typeof currentDevicePreset.width === 'number' ? currentDevicePreset.width : 900) -
              16,
            height:
              (typeof currentDevicePreset.height === 'number' ? currentDevicePreset.height : 680) -
              16,
          },
    [currentDevicePreset]
  );

  if (!currentActivity) return null;

  const flow = (
    <ManualLayerPreview
      key={`${currentActivity.id}-${currentSlideId}-${previewResetKey}`}
      activity={currentActivity}
      activities={normalizedActivities}
      variableDefinitions={variables}
      runtimeVariables={runtimeVariables}
      setRuntimeVariables={setRuntimeVariables}
      developerHintMode={developerHintMode}
      onActiveLayerChange={setFlowPhase}
      onDebugDataChange={setFlowDebugData}
      previewViewport={previewViewport}
    />
  );

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <div
        style={{
          width: '100%',
          margin: '0 auto',
          padding: 14,
          borderRadius: 22,
          background: 'rgba(15,23,42,.78)',
          border: `1px solid ${currentTheme.border}33`,
          boxShadow: '0 20px 50px rgba(15,23,42,.28)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: '#7dd3fc',
            }}
          >
            Preview Kontrolleri
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1' }}>
            Cihaz seçin ve katman tabanlı sahneyi test edin.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.2)',
            padding: 4,
            borderRadius: 12,
          }}
        >
          {devicePresets.map((item) => (
            <button
              key={item.id}
              onClick={() => setDevicePreset(item.id)}
              style={{
                ...toolbarBtn(devicePreset === item.id),
                minHeight: 28,
                padding: '0 10px',
                fontSize: 10,
                border: 'none',
                boxShadow: 'none',
              }}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <span
            style={{
              padding: '0 12px',
              minHeight: 34,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.06)',
              color: 'rgba(255,255,255,.82)',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Aktif Katman: {flowDebugData?.activeLayerName || flowPhase || 'Ana Katman'}
          </span>
          <button
            onClick={() => setPreviewResetKey((value) => value + 1)}
            style={toolbarBtn(false)}
          >
            Sıfırla
          </button>
          <button
            onClick={() => setDeveloperHintMode((value) => !value)}
            style={toolbarBtn(developerHintMode)}
          >
            {developerHintMode ? 'İpucu Açık' : 'İpucu Modu'}
          </button>
          <button onClick={() => setDebugOpen((value) => !value)} style={toolbarBtn(debugOpen)}>
            {debugOpen ? 'Debug Acik' : 'Debug'}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          padding: '0 8px 8px',
        }}
      >
        <div
          style={{
            width: currentDevicePreset.width,
            height: currentDevicePreset.height,
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: currentDevicePreset.radius,
            background: 'linear-gradient(180deg,#081120 0%,#0f172a 100%)',
            overflow: 'hidden',
            boxShadow: devicePreset === 'desktop' ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: devicePreset === 'desktop' ? 'none' : '8px solid #0f172a',
          }}
        >
          {devicePreset !== 'desktop' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: devicePreset === 'mobile' ? 120 : 0,
                height: 24,
                background: '#0f172a',
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                zIndex: 50,
              }}
            />
          )}
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            {flow}
          </div>
        </div>
      </div>

      {debugOpen && (
        <PreviewDebugOverlay
          theme={currentTheme}
          data={debugData}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </div>
  );
}

function TimelinePreviewControls({
  duration = 0,
  currentTime = 0,
  isPlaying = false,
  onToggle,
  onReset,
  onSeek,
  theme,
}) {
  if (duration <= 0) return null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 18,
        background: theme.panel,
        border: `1px solid ${theme.border}44`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          border: `1px solid ${theme.border}`,
          background: theme.button,
          color: theme.text,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {isPlaying ? 'Duraklat' : 'Oynat'}
      </button>
      <button
        onClick={onReset}
        style={{
          padding: '8px 12px',
          borderRadius: 999,
          border: `1px solid ${theme.border}55`,
          background: theme.panel,
          color: theme.text,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        Basa Don
      </button>
      <div style={{ minWidth: 92, fontSize: 11, color: theme.text, fontWeight: 700 }}>
        {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
      </div>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={Math.min(currentTime, duration)}
        onChange={(e) => onSeek?.(Number(e.target.value))}
        style={{ flex: 1, minWidth: 180, accentColor: theme.border }}
      />
    </div>
  );
}

function PreviewSelectionFlow({
  activity,
  activities,
  hasNextActivity = false,
  hasNextStep = false,
  nextStepLabel = 'Sonraki Soru',
  onNextActivity,
  onNextStep,
  onGoToActivity,
  onGoToSlide,
  variableDefinitions = [],
  runtimeVariables = {},
  setRuntimeVariables,
  previewCommand = null,
  developerHintMode = false,
  onPhaseChange = () => {},
  onDebugDataChange = () => {},
  previewViewport = null,
}) {
  const [sel, setSel] = useState([]);
  const [submittedSelection, setSubmittedSelection] = useState([]);
  const [phase, setPhase] = useState(getInitialPreviewPhase(activity));
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [activeLayerId, setActiveLayerId] = useState(activity.activeLayerId || 'base');
  const [hiddenObjectIds, setHiddenObjectIds] = useState(() => new Set());
  const [objectStates, setObjectStates] = useState({});
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const opts = useMemo(
    () => (Array.isArray(activity.mcOptions) ? activity.mcOptions : []),
    [activity.mcOptions]
  );
  const multi = activity.mcMode === 'multi';
  const selectionUi = getSelectionUi(activity);
  const selectedMarkGlyph = getSelectionMarkGlyph(selectionUi.controlMark);
  const wrongMarkGlyph = resolveWrongSelectionGlyph(selectionUi, selectionUi.controlMark);
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  // Önizleme fallback metinleri etkinliğin üretim diline göre.
  const previewTx = runtimeText(activity);
  const answerControl = activity.answerControl || {};
  const intro = activity.introScreen || {};
  const packageScreen = activity.buttonPackageScreen || {};
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const resultScreens = activity.resultScreens || {};
  const results = resultScreens;
  const answerScreen = activity.answerScreen || {};
  const theme = getPackageTheme(activity.buttonPackageId);
  const packageTitle =
    !packageScreen.title || /buton paketi/i.test(packageScreen.title)
      ? 'Tema Paketi Tanıtımı'
      : packageScreen.title;
  const packageBody =
    !packageScreen.body || /buton.*davran/i.test(packageScreen.body)
      ? 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.'
      : packageScreen.body;
  const isBookPreview = activity.type === 'book-preview';
  const autoAnswer = getAutoAnswerSummary(activity);
  const runtimePreviewTime = 0;
  const stageSelectionObjects = useMemo(
    () =>
      getCanvasObjects(activity, activeLayerId, hiddenObjectIds)
        .filter((obj) => obj.visible !== false)
        .filter((obj) => !!obj.selectionQuestionId)
        .filter((obj) => isObjectTimelineActive(activity, obj.id, runtimePreviewTime)),
    [activity, activeLayerId, hiddenObjectIds, runtimePreviewTime]
  );
  const stageSelectionGroups = useMemo(
    () => [...new Set(stageSelectionObjects.map((obj) => obj.selectionQuestionId).filter(Boolean))],
    [stageSelectionObjects]
  );
  const stageSelectionChoicesByQuestion = useMemo(
    () =>
      Object.fromEntries(
        stageSelectionGroups.map((questionId) => [
          questionId,
          stageSelectionObjects.filter((obj) => obj.selectionQuestionId === questionId),
        ])
      ),
    [stageSelectionGroups, stageSelectionObjects]
  );
  const usesStageSelection = stageSelectionObjects.length > 0;
  const hasSelectionAnswerKey =
    !usesStageSelection ||
    stageSelectionGroups.every((questionId) =>
      stageSelectionObjects.some(
        (obj) => obj.selectionQuestionId === questionId && typeof obj.selectionCorrect === 'boolean'
      )
    );
  const previousActivityIdRef = useRef(activity?.id || null);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const viewportWidth = previewViewport?.width || windowWidth;
  const viewportHeight =
    previewViewport?.height || (typeof window !== 'undefined' ? window.innerHeight : 860);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    const sameActivity = previousActivityIdRef.current === activity.id;
    previousActivityIdRef.current = activity.id;
    setSel([]);
    setSubmittedSelection([]);
    setResult(null);
    setAttempts(0);
    setChecking(false);
    setPhase(sameActivity ? 'play' : getInitialPreviewPhase(activity));
    setActiveLayerId(activity.activeLayerId || 'base');
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
  }, [activity, activity.id, activity.currentSlideId]);
  useEffect(() => {
    setTimelinePlaying(false);
  }, [phase, activity.id, checking]);
  useEffect(() => {
    if (!previewCommand || previewCommand.activityId !== activity.id) return;
    const targetPhase =
      previewCommand.action === 'reset'
        ? getInitialPreviewPhase(activity)
        : previewCommand.phase || 'play';
    setSel([]);
    setSubmittedSelection([]);
    setResult(null);
    setAttempts(0);
    setChecking(false);
    setActiveLayerId(activity.activeLayerId || 'base');
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
    setPhase(targetPhase);
  }, [activity, activity.activeLayerId, activity.id, activity.currentSlideId, previewCommand]);
  const viewOptions = useMemo(() => {
    let source = opts.map((o) => ({ ...o }));
    if (settings.shuffleOptions || activity.settings?.shuffleQuestions) {
      source = shuffleArray(source);
    }
    if (answerControl.trueFalseButtonOrder === 'reversed') {
      source = [...source].reverse();
    }
    return source;
  }, [opts, settings.shuffleOptions, activity.settings?.shuffleQuestions, answerControl.trueFalseButtonOrder]);
  const selectedLabels = usesStageSelection
    ? sel.map((id) => stageSelectionObjects.find((obj) => obj.id === id)?.label || id)
    : viewOptions
        .filter((option) => sel.includes(option.id))
        .map((option) => option.label || option.id);
  const stageSelectionFeedbackById = useMemo(() => {
    if (!usesStageSelection || !(checking || result !== null)) return {};
    return Object.fromEntries(
      stageSelectionObjects
        .map((obj) => {
          if (!submittedSelection.includes(obj.id)) return [obj.id, null];
          return [obj.id, obj.selectionCorrect ? 'correct' : 'wrong'];
        })
        .filter(([, value]) => !!value)
    );
  }, [checking, result, stageSelectionObjects, submittedSelection, usesStageSelection]);
  useEffect(() => {
    onDebugDataChange?.({
      phase,
      attempts,
      activeLayerId,
      timelineTime,
      timelinePlaying,
      selectionLabels: selectedLabels,
      result,
      checking,
      hiddenObjectIds: [...hiddenObjectIds],
      objectStates,
      usesStageSelection,
      hasSelectionAnswerKey,
    });
  }, [
    activeLayerId,
    attempts,
    checking,
    hasSelectionAnswerKey,
    hiddenObjectIds,
    objectStates,
    onDebugDataChange,
    phase,
    result,
    selectedLabels,
    timelinePlaying,
    timelineTime,
    usesStageSelection,
  ]);
  const toggle = (id) => {
    if (phase !== 'play') return;
    if (result) setResult(null);
    setSel(multi ? (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]) : [id]);
  };
  const toggleStageSelection = useCallback(
    (objectId) => {
      if (phase !== 'play') return;
      const selectedObject = stageSelectionObjects.find((obj) => obj.id === objectId);
      if (!selectedObject) return;
      const siblingIds = (
        stageSelectionChoicesByQuestion[selectedObject.selectionQuestionId] || []
      ).map((obj) => obj.id);
      if (result) setResult(null);
      setSel((prev) => {
        if (siblingIds.length === 1 && prev.includes(objectId)) {
          return prev.filter((id) => id !== objectId);
        }
        const next = prev.filter((id) => !siblingIds.includes(id));
        next.push(objectId);
        return next;
      });
      setObjectStates((prev) => {
        const next = { ...prev };
        siblingIds.forEach((id) => {
          const active =
            siblingIds.length === 1 && prev?.[id]?.selected && id === objectId
              ? false
              : id === objectId;
          next[id] = { ...(next[id] || {}), selected: active };
        });
        return next;
      });
    },
    [phase, result, stageSelectionChoicesByQuestion, stageSelectionObjects]
  );
  const isCorrectAnswer = () => {
    if (usesStageSelection) {
      return stageSelectionGroups.every((questionId) => {
        const choices = stageSelectionChoicesByQuestion[questionId] || [];
        const selectedId = sel.find((id) => choices.some((obj) => obj.id === id));
        const selectedObject = choices.find((obj) => obj.id === selectedId);
        const expectedChoice =
          activity.selectionSlots?.find((slot) => slot.id === questionId)?.correctChoice ?? null;
        if (choices.length <= 1) {
          return expectedChoice ? !!selectedObject?.selectionCorrect : !selectedObject;
        }
        if (!selectedId) return false;
        return !!selectedObject?.selectionCorrect;
      });
    }
    const c = getCorrectSelectionIds(activity);
    return multi
      ? c.length === sel.length && c.every((x) => sel.includes(x))
      : sel.length === 1 && c.includes(sel[0]);
  };
  const allStageQuestionsAnswered =
    !usesStageSelection ||
    stageSelectionGroups.every((questionId) => {
      const choices = stageSelectionChoicesByQuestion[questionId] || [];
      if (choices.length <= 1) return true;
      return sel.some((id) => choices.some((obj) => obj.id === id));
    });
  // Can etkinse deneme sınırı = can sayısı (can = denemenin görsel katmanı).
  const selectionLives = getLivesConfig(activity);
  const selectionEffectiveMaxAttempts = selectionLives.enabled
    ? selectionLives.count
    : (answerControl.maxAttempts || settings.maxAttempts);
  const canRetry =
    settings.allowRetry !== false &&
    (selectionEffectiveMaxAttempts === 0 || attempts < selectionEffectiveMaxAttempts);
  const isSuccess = result === 'success';
  const nextAfterIntroAuto =
    settings.showButtonPackageIntro !== false && packageScreen.enabled !== false
      ? 'package'
      : settings.showMenuScreen !== false && menuScreen.enabled !== false
        ? 'menu'
        : 'play';
  const nextAfterPackageAuto =
    settings.showMenuScreen !== false && menuScreen.enabled !== false ? 'menu' : 'play';
  const nextAfterIntro = resolvePreviewFlowTarget(
    settings.introNextPhase,
    ['package', 'menu', 'play'],
    nextAfterIntroAuto
  );
  const nextAfterPackage = resolvePreviewFlowTarget(
    settings.packageNextPhase,
    ['intro', 'menu', 'play'],
    nextAfterPackageAuto
  );
  const nextAfterMenu = resolvePreviewFlowTarget(
    settings.menuNextPhase,
    ['intro', 'package', 'play'],
    'play'
  );

  const runSelectionCheck = () => {
    const ok = isCorrectAnswer();
    setSubmittedSelection([...sel]);
    setResult(ok ? 'success' : 'failure');
    setChecking(true);
    setTimelinePlaying(false);
    setTimeout(() => {
      setChecking(false);
      setAttempts((p) => p + 1);
    }, 850);
  };

  const restartSelectionFlow = (targetPhase = getInitialPreviewPhase(activity)) => {
    setPhase(targetPhase);
    setResult(null);
    setSel([]);
    setSubmittedSelection([]);
    setAttempts(0);
    setTimelineTime(0);
    setTimelinePlaying(false);
  };

  const handleSelectionAction = (action, fallbackAction = 'play') => {
    const resolved = action || fallbackAction;
    switch (resolved) {
      case 'check':
        runSelectionCheck();
        return;
      case 'answer':
        setPhase('answer');
        return;
      case 'restart':
        restartSelectionFlow();
        return;
      case 'complete':
        if (hasNextStep) onNextStep?.();
        else restartSelectionFlow();
        return;
      case 'intro':
      case 'package':
      case 'menu':
      case 'play':
      case 'result':
        setPhase(resolved);
        return;
      case 'none':
        return;
      default:
        setPhase(fallbackAction);
    }
  };

  const getScreenStyle = (screenKey) => {
    const map = {
      intro: intro,
      package: packageScreen,
      menu: menuScreen,
      play: playScreen,
      success: results,
      failure: results,
      answer: answerScreen,
    };
    return map[screenKey]?.style || {};
  };
  const primaryBtn = {
    padding: '13px 28px',
    borderRadius: theme.radius || 999,
    border: `1px solid ${theme.border}`,
    background: theme.button,
    color: theme.text,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: `0 12px 24px ${theme.border}33`,
    letterSpacing: 0.3,
    transition: 'opacity .15s, transform .1s',
  };
  const ghostBtn = {
    ...primaryBtn,
    background: '#ffffff',
    color: '#123a56',
    border: `1px solid ${theme.border}55`,
    boxShadow: '0 8px 16px rgba(20,58,86,.06)',
  };
  const screenBtn = (screenKey) => {
    const s = getScreenStyle(screenKey);
    if (
      !s.buttonBackground &&
      !s.buttonColor &&
      !s.buttonBorderColor &&
      !s.buttonBorderRadius &&
      !s.buttonFontSize &&
      !s.buttonPaddingX &&
      !s.buttonPaddingY
    )
      return primaryBtn;
    return {
      ...primaryBtn,
      ...(s.buttonBackground && { background: s.buttonBackground }),
      ...(s.buttonColor && { color: s.buttonColor }),
      ...(s.buttonBorderColor && {
        border: `1px solid ${s.buttonBorderColor}44`,
        boxShadow: `0 8px 32px ${s.buttonBorderColor}44`,
      }),
      ...(s.buttonBorderRadius != null &&
        s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }),
      ...(s.buttonFontSize && { fontSize: s.buttonFontSize }),
      ...((s.buttonPaddingX || s.buttonPaddingY) && {
        padding: `${s.buttonPaddingY || 13}px ${s.buttonPaddingX || 28}px`,
      }),
    };
  };
  const screenGhostBtn = (screenKey) => {
    const s = getScreenStyle(screenKey);
    return {
      ...ghostBtn,
      ...(s.buttonBackground && { background: s.buttonBackground }),
      ...(s.buttonColor && { color: s.buttonColor }),
      ...(s.buttonBorderRadius != null &&
        s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }),
    };
  };
  const stageScale = useMemo(() => {
    const maxWidth = Math.max(320, viewportWidth - (viewportWidth <= 768 ? 24 : 56));
    const maxHeight = Math.max(
      viewportWidth <= 768 ? 300 : 620,
      viewportHeight - (isBookPreview ? 110 : 150)
    );
    return Math.min(
      1,
      maxWidth / (activity.stageWidth || 1920),
      maxHeight / (activity.stageHeight || 1080)
    );
  }, [activity.stageHeight, activity.stageWidth, isBookPreview, viewportHeight, viewportWidth]);
  const stageWidth = Math.round((activity.stageWidth || 1920) * stageScale);
  const stageHeight = Math.round((activity.stageHeight || 1080) * stageScale);
  const hasRuntimeStage =
    !!activity.svgMarkup ||
    getCanvasObjects(activity, activeLayerId, hiddenObjectIds).some(
      (obj) => obj.visible !== false && obj.type !== 'draggable' && obj.type !== 'dropzone'
    );
  const previewPhaseActivities = useMemo(
    () =>
      isBookPreview
        ? {
            intro: getPreviewPhaseActivity(activity, 'intro'),
            package: getPreviewPhaseActivity(activity, 'package'),
            menu: getPreviewPhaseActivity(activity, 'menu'),
          }
        : { intro: null, package: null, menu: null },
    [activity, isBookPreview]
  );
  const runObjectTriggers = useCallback(
    (objectId, when = 'onClick') => {
      const nextObjectStates = {
        ...objectStates,
        [objectId]: {
          ...(objectStates?.[objectId] || {}),
          visited: when !== 'onLoad' ? true : objectStates?.[objectId]?.visited || false,
          selected:
            when === 'onClick' || when === 'onDrop'
              ? true
              : objectStates?.[objectId]?.selected || false,
        },
      };
      setObjectStates(nextObjectStates);
      runPreviewTriggers({
        activity,
        activities,
        objectId,
        when,
        onNextActivity,
        onGoToActivity,
        onGoToSlide,
        setActiveLayerId,
        hiddenObjectIds,
        setHiddenObjectIds,
        variables: runtimeVariables,
        setVariables: setRuntimeVariables,
        variableDefinitions,
        objectStates: nextObjectStates,
        setObjectStates,
      });
    },
    [
      activity,
      activities,
      hiddenObjectIds,
      objectStates,
      onGoToActivity,
      onGoToSlide,
      onNextActivity,
      runtimeVariables,
      setRuntimeVariables,
      variableDefinitions,
    ]
  );
  useEffect(() => {
    runPreviewTriggers({
      activity,
      activities,
      objectId: '__activity__',
      when: 'onLoad',
      onNextActivity,
      onGoToActivity,
      onGoToSlide,
      setActiveLayerId,
      hiddenObjectIds: new Set(),
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: {},
      setObjectStates,
    });
  }, [
    activities,
    activity,
    activity.id,
    activity.currentSlideId,
    onGoToActivity,
    onGoToSlide,
    onNextActivity,
    runtimeVariables,
    setActiveLayerId,
    setRuntimeVariables,
    variableDefinitions,
  ]);
  const renderShell = (screen, _badge, content) => {
    const cs = getScreenStyle(screen);
    return (
      <div style={{ width: '100%', height: '100%', margin: '0 auto' }}>
        <style>{`@keyframes sel-spin{to{transform:rotate(360deg)}}`}</style>
        <SlideTransitionView
          transitionKey={`${activity.id}-${activity.currentSlideId}-${screen}`}
          effect={activity.slideTransitionEffect || 'fade'}
          direction={activity.slideTransitionDirection || 'left'}
          duration={activity.slideTransitionDuration ?? 0.45}
        >
          <div
            style={{
              background: cs.background || 'linear-gradient(180deg,#ffffff 0,#fbfcfd 100%)',
              borderRadius: cs.borderRadius || 28,
              border: '1px solid #e4eff5',
              boxShadow: '0 26px 60px rgba(20,58,86,.12)',
              overflow: 'hidden',
              position: 'relative',
              height: '100%',
              minHeight: 0,
            }}
          >
            {activity.svgMarkup && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.06,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
              />
            )}
            <div
              style={{
                padding: isBookPreview
                  ? '12px 14px 14px'
                  : cs.padding
                    ? `${cs.padding}px`
                    : '20px 18px',
                position: 'relative',
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: isBookPreview ? 'flex-start' : 'center',
              }}
            >
              {content}
            </div>
          </div>
        </SlideTransitionView>
      </div>
    );
  };

  const renderBookPreviewPhase = (phaseKey, badge, actions = null) => {
    const phaseActivity = previewPhaseActivities[phaseKey];
    if (!phaseActivity) return null;

    const phaseScale = getFitScale(
      phaseActivity.stageWidth || 1920,
      phaseActivity.stageHeight || 1080,
      Math.max(320, viewportWidth - 48),
      Math.max(viewportWidth <= 768 ? 280 : 640, viewportHeight - 150)
    );
    const phaseStageWidth = Math.round((phaseActivity.stageWidth || 1920) * phaseScale);
    const phaseStageHeight = Math.round((phaseActivity.stageHeight || 1080) * phaseScale);

    return renderShell(
      'intro',
      badge,
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: phaseStageWidth,
              height: phaseStageHeight,
              position: 'relative',
              background: phaseActivity.backgroundColor || '#ffffff',
              borderRadius: 24,
              overflow: 'hidden',
              border: `1px solid ${theme.border}20`,
              boxShadow: '0 24px 60px rgba(15,23,42,.24)',
            }}
          >
            {phaseActivity.svgMarkup && (
              <div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(phaseActivity.svgMarkup) }}
              />
            )}
            <RuntimeObjectLayer
              activity={phaseActivity}
              activeLayerId={phaseActivity.activeLayerId || 'base'}
              hiddenObjectIds={new Set()}
              objectStates={{}}
              onRunTriggers={() => {}}
              scale={phaseScale}
              currentTime={0}
            />
          </div>
        </div>
        {actions ? (
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(getScreenStyle(phaseKey), {
                justifyContent: 'center',
                gap: 12,
              }),
              flexShrink: 0,
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    );
  };

  if (isBookPreview && phase === 'intro') {
    return renderBookPreviewPhase(
      'intro',
      'Tanıtım',
      <>
        {settings.showButtonPackageIntro !== false && packageScreen.enabled !== false && (
          <button
            onClick={() =>
              handleSelectionAction(settings.guideButtonAction || 'package', 'package')
            }
            style={screenGhostBtn('intro')}
          >
            {settings.guideButtonText || 'Tanıtım'}
          </button>
        )}
        <button onClick={() => setPhase(nextAfterIntro)} style={screenBtn('intro')}>
          {intro.buttonText || 'Etkinliği Başlat'}
        </button>
      </>
    );
  }

  if (isBookPreview && phase === 'package') {
    return renderBookPreviewPhase(
      'package',
      'Tema Paketi',
      <>
        <button
          onClick={() => handleSelectionAction(settings.packageBackAction || 'intro', 'intro')}
          style={screenGhostBtn('package')}
        >
          {packageScreen.backButtonText || 'Geri Dön'}
        </button>
        <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn('package')}>
          {packageScreen.buttonText || 'Menüye Geç'}
        </button>
      </>
    );
  }

  if (isBookPreview && phase === 'menu') {
    return renderBookPreviewPhase(
      'menu',
      'Menü',
      <button onClick={() => setPhase(nextAfterMenu)} style={screenBtn('menu')}>
        {menuScreen.buttonText || 'Etkinliğe Geç'}
      </button>
    );
  }

  if (phase === 'intro') {
    const _cs = getScreenStyle('intro');
    return renderShell(
      'intro',
      'Tanıtım',
      <div style={{ color: _cs.textColor || '#123a56', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 44, marginBottom: 20, lineHeight: 1 }}>▶</div>
          <div
            style={{
              fontSize: _cs.titleFontSize || 30,
              fontWeight: _cs.titleFontWeight || 800,
              marginBottom: 14,
              letterSpacing: -0.5,
            }}
          >
            {intro.title || `${activity.name} Etkinliğine Hoş Geldin`}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>
            {intro.body || 'Hazır olduğunda etkinliği başlat.'}
          </div>
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: 'center', gap: 12 }),
            }}
          >
            <button onClick={() => setPhase(nextAfterIntro)} style={screenBtn('intro')}>
              {intro.buttonText || 'Başla'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'package') {
    const _cs = getScreenStyle('package');
    return renderShell(
      'intro',
      'Tema Paketi',
      <div style={{ color: _cs.textColor || '#123a56' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div
            style={{
              fontSize: _cs.titleFontSize || 26,
              fontWeight: _cs.titleFontWeight || 800,
              marginBottom: 8,
              textAlign: 'center',
              letterSpacing: -0.4,
            }}
          >
            {packageTitle}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              opacity: 0.78,
              marginBottom: 24,
              textAlign: 'center',
            }}
          >
            {packageBody}
          </div>
          <ButtonPackageIntroDiagram pkgId={activity.buttonPackageId} config={packageScreen} />
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: 'center', gap: 12 }),
              marginTop: 28,
            }}
          >
            <button
              onClick={() => handleSelectionAction(settings.packageBackAction || 'intro', 'intro')}
              style={screenGhostBtn('package')}
            >
              {packageScreen.backButtonText || 'Geri Dön'}
            </button>
            <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn('package')}>
              {packageScreen.buttonText || 'Menüye Geç'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'menu') {
    const _cs = getScreenStyle('menu');
    return renderShell(
      'intro',
      'Menü',
      <div style={{ color: _cs.textColor || '#123a56', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div
            style={{
              fontSize: _cs.titleFontSize || 30,
              fontWeight: _cs.titleFontWeight || 800,
              marginBottom: 12,
              letterSpacing: -0.5,
            }}
          >
            {menuScreen.title}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>
            {menuScreen.body}
          </div>
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: 'center', gap: 12 }),
            }}
          >
            <button onClick={() => setPhase(nextAfterMenu)} style={screenBtn('menu')}>
              {menuScreen.buttonText || 'Etkinliğe Geç'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const _rsKey = isSuccess ? 'success' : 'failure';
    const _cs = getScreenStyle(_rsKey);
    return renderShell(
      _rsKey,
      isSuccess ? `✓ ${previewTx.correctShort}` : `× ${previewTx.incorrectShort}`,
      <div style={{ color: _cs.textColor || '#123a56', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>
            {isSuccess ? '✓' : '×'}
          </div>
          <div
            style={{
              fontSize: _cs.titleFontSize || 34,
              fontWeight: _cs.titleFontWeight || 800,
              marginBottom: 12,
              letterSpacing: -0.6,
            }}
          >
            {isSuccess
              ? resultScreens.successTitle || previewTx.successTitleShort
              : resultScreens.failureTitle || previewTx.retryHint}
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.78, marginBottom: 32 }}>
            {isSuccess
              ? resultScreens.successBody || previewTx.successBodyShort
              : resultScreens.failureBody || previewTx.failureBodyShort}
          </div>
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: 'center', gap: 12 }),
            }}
          >
            {!isSuccess && canRetry && (
              <button onClick={() => restartSelectionFlow('play')} style={screenBtn(_rsKey)}>
                {resultScreens.retryText || `↻ ${previewTx.tryAgainShort}`}
              </button>
            )}
            {!isSuccess && settings.showAnswerLayer !== false && (
              <button
                onClick={() =>
                  handleSelectionAction(settings.answerButtonAction || 'answer', 'answer')
                }
                style={screenGhostBtn(_rsKey)}
              >
                {settings.answerButtonText || previewTx.showAnswerShort}
              </button>
            )}
            {isSuccess && hasNextStep && (
              <button
                onClick={() =>
                  handleSelectionAction(settings.completeButtonAction || 'complete', 'complete')
                }
                style={screenBtn(_rsKey)}
              >
                {nextStepLabel}
              </button>
            )}
            <button
              onClick={() =>
                handleSelectionAction(settings.restartButtonAction || 'restart', 'restart')
              }
              style={screenGhostBtn(_rsKey)}
            >
              {resultScreens.continueText || previewTx.restartLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'answer') {
    const _cs = getScreenStyle('answer');
    return renderShell(
      'failure',
      previewTx.correctAnswerTitle,
      <div style={{ color: _cs.textColor || '#123a56' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div
            style={{
              fontSize: _cs.titleFontSize || 26,
              fontWeight: _cs.titleFontWeight || 800,
              marginBottom: 6,
              letterSpacing: -0.4,
            }}
          >
            {answerScreen.title || previewTx.correctAnswerTitle}
          </div>
          {answerScreen.body && (
            <div style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.72, marginBottom: 20 }}>
              {answerScreen.body}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {usesStageSelection
              ? autoAnswer.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 18,
                      border: '1px solid #d6e7f2',
                      background: '#eaf4fb',
                      color: '#123a56',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {line}
                  </div>
                ))
              : viewOptions
                  .filter((o) => o.isCorrect)
                  .map((o) => (
                    <div
                      key={o.id}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 18,
                        border: '1px solid #d6e7f2',
                        background: '#eaf4fb',
                        color: '#123a56',
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {o.label}
                    </div>
                  ))}
          </div>
          {!usesStageSelection && submittedSelection.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                gap: 10,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'rgba(22,163,74,.16)',
                  border: '1px solid rgba(74,222,128,.4)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8, color: '#86efac' }}>
                  Öğrencinin doğru cevapları
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewOptions.filter((o) => submittedSelection.includes(o.id) && o.isCorrect)
                    .length ? (
                    viewOptions
                      .filter((o) => submittedSelection.includes(o.id) && o.isCorrect)
                      .map((o) => (
                        <div
                          key={o.id}
                          style={{
                            fontSize: 13,
                            color: '#f0fdf4',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span style={{ color: '#86efac' }}>✓</span>
                          {o.label}
                        </div>
                      ))
                  ) : (
                    <div style={{ fontSize: 12, color: '#d1fae5' }}>Doğru cevap yok.</div>
                  )}
                </div>
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'rgba(185,28,28,.16)',
                  border: '1px solid rgba(248,113,113,.4)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 8, color: '#fca5a5' }}>
                  Öğrencinin yanlış cevapları
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewOptions.filter((o) => submittedSelection.includes(o.id) && !o.isCorrect)
                    .length ? (
                    viewOptions
                      .filter((o) => submittedSelection.includes(o.id) && !o.isCorrect)
                      .map((o) => (
                        <div
                          key={o.id}
                          style={{
                            fontSize: 13,
                            color: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span style={{ color: '#fca5a5' }}>×</span>
                          {o.label}
                        </div>
                      ))
                  ) : (
                    <div style={{ fontSize: 12, color: '#fee2e2' }}>Yanlış cevap yok.</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(_cs, { justifyContent: 'center', gap: 12 }),
            }}
          >
            <button
              onClick={() =>
                handleSelectionAction(settings.answerButtonAction || 'restart', 'restart')
              }
              style={screenGhostBtn('answer')}
            >
              {answerScreen.buttonText || 'Yeniden Başlat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  {
    const _cs = getScreenStyle('play');
    return renderShell(
      'play',
      'Etkinlik',
      <div style={{ color: _cs.textColor || '#123a56' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {hasRuntimeStage && (
            <div
              style={{
                marginBottom: 28,
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid #ddeaf2',
                boxShadow: '0 14px 32px rgba(20,58,86,.08)',
              }}
            >
              <div
                style={{
                  width: stageWidth,
                  height: stageHeight,
                  position: 'relative',
                  background: activity.backgroundColor || '#fff',
                  overflow: 'hidden',
                  margin: '0 auto',
                }}
              >
                {activity.svgMarkup && (
                  <div
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
                  />
                )}
                <RuntimeObjectLayer
                  activity={activity}
                  activeLayerId={activeLayerId}
                  hiddenObjectIds={hiddenObjectIds}
                  objectStates={objectStates}
                  onRunTriggers={runObjectTriggers}
                  onSelectionChoice={toggleStageSelection}
                  selectedObjectIds={sel}
                  hintObjectIds={
                    developerHintMode
                      ? stageSelectionObjects
                          .filter((obj) => obj.selectionCorrect)
                          .map((obj) => obj.id)
                      : []
                  }
                  selectionFeedbackById={stageSelectionFeedbackById}
                  scale={stageScale}
                  currentTime={runtimePreviewTime}
                />
              </div>
            </div>
          )}
          {(playScreen.title || activity.mcQuestion) && (
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 10,
                letterSpacing: -0.4,
                lineHeight: 1.35,
              }}
            >
              {playScreen.title || activity.mcQuestion}
            </h2>
          )}
          <p style={{ fontSize: 13, opacity: 0.62, marginBottom: 20, lineHeight: 1.6 }}>
            {usesStageSelection
              ? 'Sahnedeki kutucuklardan seçim yapın.'
              : playScreen.body ||
                (multi ? 'Birden fazla seçenek işaretleyebilirsiniz.' : 'Tek seçenek seçiniz.')}
          </p>
          {!usesStageSelection && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {viewOptions.map((o, idx) => {
                const selected = sel.includes(o.id);
                const isCorrectOpt = !!o.isCorrect;
                const showCheckedState = checking || result !== null;
                const isWrongSelected = showCheckedState && selected && !isCorrectOpt;
                const isCorrectOption = showCheckedState && isCorrectOpt;
                const showHintOption = developerHintMode && !showCheckedState && isCorrectOpt;
                let borderCol = selected ? '#6b93d0' : '#d7e5f0';
                let bgCol = selected ? '#eef3fb' : '#ffffff';
                let badgeBg = selected ? 'rgba(107,147,208,.2)' : '#f0f5fb';
                if (showHintOption) {
                  borderCol = '#4ade80';
                  bgCol = 'rgba(74,222,128,.1)';
                  badgeBg = 'rgba(74,222,128,.22)';
                }
                if (isCorrectOption) {
                  borderCol = '#62cf52';
                  bgCol = '#f1ffed';
                  badgeBg = 'rgba(98,207,82,.25)';
                }
                if (isWrongSelected) {
                  borderCol = '#f26c6c';
                  bgCol = '#fff4f4';
                  badgeBg = 'rgba(242,108,108,.25)';
                }
                return (
                  <button
                    key={o.id}
                    onClick={() => !checking && toggle(o.id)}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 22,
                      border: `2px solid ${borderCol}`,
                      background: bgCol,
                      color: '#123a56',
                      textAlign: 'left',
                      cursor: checking ? 'default' : 'pointer',
                      fontSize: 14,
                      fontWeight: 700,
                      transition: 'all .2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      transform: checking && isCorrectOption ? 'scale(1.02)' : 'none',
                      boxShadow: '0 10px 24px rgba(20,58,86,.06)',
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: selectionUi.controlShape === 'circle' ? 999 : 8,
                        background: badgeBg,
                        border: `1.5px solid ${borderCol}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {showCheckedState
                        ? isCorrectOption
                          ? selectedMarkGlyph
                          : isWrongSelected
                            ? wrongMarkGlyph
                            : ''
                        : selected
                          ? selectedMarkGlyph
                          : ''}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{o.label || 'Seçenek'}</span>
                      <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                        Seçenek {idx + 1}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {developerHintMode && (
            <div
              style={{
                marginTop: 18,
                padding: '12px 14px',
                borderRadius: 16,
                border: '1px solid rgba(74,222,128,.34)',
                background: 'rgba(22,163,74,.1)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#166534',
                  marginBottom: 8,
                  letterSpacing: 0.45,
                  textTransform: 'uppercase',
                }}
              >
                Geliştirici İpucu
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(usesStageSelection
                  ? autoAnswer
                  : viewOptions.filter((o) => o.isCorrect).map((o) => o.label || previewTx.correctOptionLabel)
                ).map((line, index) => (
                  <div
                    key={`${line}-${index}`}
                    style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 28,
              flexWrap: 'wrap',
            }}
          >
            <LivesBar activity={activity} attempts={attempts} />
            {checking ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '2px solid #6b93d0',
                    borderTopColor: 'transparent',
                    animation: 'sel-spin 0.6s linear infinite',
                  }}
                />
                <span style={{ fontSize: 13, opacity: 0.7 }}>Kontrol ediliyor...</span>
              </div>
            ) : result ? (
              <button onClick={() => setPhase('result')} style={screenBtn('play')}>
                {resultScreens.continueText || 'Sonucu Gör'} →
              </button>
            ) : (
              <button
                onClick={() => {
                  const ok = isCorrectAnswer();
                  setSubmittedSelection([...sel]);
                  setResult(ok ? 'success' : 'failure');
                  setChecking(true);
                  setTimelinePlaying(false);
                  setTimeout(() => {
                    setChecking(false);
                    setAttempts((p) => p + 1);
                  }, 1600);
                }}
                disabled={
                  usesStageSelection
                    ? !allStageQuestionsAnswered || !hasSelectionAnswerKey
                    : !sel.length
                }
                style={{
                  ...screenBtn('play'),
                  opacity: (
                    usesStageSelection
                      ? allStageQuestionsAnswered && hasSelectionAnswerKey
                      : !!sel.length
                  )
                    ? 1
                    : 0.4,
                  cursor: (
                    usesStageSelection
                      ? allStageQuestionsAnswered && hasSelectionAnswerKey
                      : !!sel.length
                  )
                    ? 'pointer'
                    : 'default',
                }}
              >
                {settings.checkButtonText || 'Kontrol Et'} →
              </button>
            )}
            {usesStageSelection && !hasSelectionAnswerKey && (
              <div style={{ fontSize: 12, color: '#fbbf24' }}>! Cevap anahtarı okunamadı.</div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

function PreviewDragDropFlow({
  activity,
  activities,
  hasNextActivity = false,
  hasNextStep = false,
  nextStepLabel = 'Sonraki Soru',
  onNextActivity,
  onNextStep,
  onGoToActivity,
  onGoToSlide,
  variableDefinitions = [],
  runtimeVariables = {},
  setRuntimeVariables,
  previewCommand = null,
  developerHintMode = false,
  onPhaseChange = () => {},
  onDebugDataChange = () => {},
  previewViewport = null,
}) {
  const [phase, setPhase] = useState(getInitialPreviewPhase(activity));
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // { [placementId]: boolean }
  const [submittedPlacements, setSubmittedPlacements] = useState([]);
  const [, setGuideSourcePhase] = useState('intro');
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const stageRef = useRef(null);
  const dragging = useRef(null);
  const activeHandlersRef = useRef(null);
  const [placements, setPlacements] = useState([]);
  const [dragPreview, setDragPreview] = useState(null);
  const [hoveredDropId, setHoveredDropId] = useState(null);
  const [activeLayerId, setActiveLayerId] = useState(activity.activeLayerId || 'base');
  const [hiddenObjectIds, setHiddenObjectIds] = useState(() => new Set());
  const [objectStates, setObjectStates] = useState({});
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  // Önizleme fallback metinleri etkinliğin üretim diline göre.
  const previewTx = runtimeText(activity);
  const intro = activity.introScreen || {};
  const packageScreen = activity.buttonPackageScreen || {};
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const resultScreens = activity.resultScreens || {};
  const results = resultScreens;
  const answerScreen = activity.answerScreen || {};
  const theme = getPackageTheme(activity.buttonPackageId);
  const packageTitle =
    !packageScreen.title || /buton paketi/i.test(packageScreen.title)
      ? 'Tema Paketi Tanıtımı'
      : packageScreen.title;
  const packageBody =
    !packageScreen.body || /buton.*davran/i.test(packageScreen.body)
      ? 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.'
      : packageScreen.body;
  const runtimePreviewTime = 0;
  const canvasObjects = getCanvasObjects(activity, activeLayerId, hiddenObjectIds).filter(
    (object) => isObjectTimelineActive(activity, object.id, runtimePreviewTime)
  );
  const drags = canvasObjects.filter((o) => o.type === 'draggable');
  const drops = canvasObjects.filter((o) => o.type === 'dropzone');
  const runtimeActivity = useMemo(
    () => ({ ...activity, activeLayerId }),
    [activity, activeLayerId]
  );
  const correctMatches = getCorrectDragMatches(runtimeActivity);
  const correctPairs = getDragDropPairsFromMatches(correctMatches);
  const autoAnswer = getAutoAnswerSummary(runtimeActivity);
  const previousActivityIdRef = useRef(activity?.id || null);
  const dropById = useMemo(() => Object.fromEntries(drops.map((item) => [item.id, item])), [drops]);
  const placementsRef = useRef([]);
  const placementFrames = useMemo(
    () => buildDragDropPlacementLayout(runtimeActivity, placements, activeLayerId),
    [activeLayerId, placements, runtimeActivity]
  );
  const correctPlacements = useMemo(
    () => buildDragDropPlacementsFromMatches(correctMatches),
    [correctMatches]
  );
  const correctPlacementFrames = useMemo(
    () => buildDragDropPlacementLayout(runtimeActivity, correctPlacements, activeLayerId),
    [activeLayerId, correctPlacements, runtimeActivity]
  );
  const matched = useMemo(
    () =>
      buildDragDropMatchMapFromPairs(
        placements.map((entry) => ({ dragId: entry.dragId, dropId: entry.dropId })),
        true
      ),
    [placements]
  );
  const submittedMatches = useMemo(
    () =>
      buildDragDropMatchMapFromPairs(
        submittedPlacements.map((entry) => ({ dragId: entry.dragId, dropId: entry.dropId })),
        true
      ),
    [submittedPlacements]
  );
  const canDropOnZone = useCallback(
    (drag, drop, sourcePlacements = placementsRef.current, ignorePlacementId = null) => {
      if (!drag || !drop) return false;
      if (!areDragDropScopesCompatible(runtimeActivity, drag, drop)) return false;
      const activePlacements = (sourcePlacements || []).filter(
        (entry) => entry.id !== ignorePlacementId
      );
      const capacity = getDropCapacityLimit(runtimeActivity, drop);
      const currentDropCount = activePlacements.filter((entry) => entry.dropId === drop.id).length;
      if (capacity !== 0 && currentDropCount >= capacity) return false;
      if (activePlacements.some((entry) => entry.dragId === drag.id && entry.dropId === drop.id))
        return false;
      if (
        !isDragReusable(runtimeActivity, drag) &&
        activePlacements.some((entry) => entry.dragId === drag.id)
      )
        return false;
      return true;
    },
    [runtimeActivity]
  );

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      if (activeHandlersRef.current) {
        window.removeEventListener('pointermove', activeHandlersRef.current.move);
        window.removeEventListener('pointerup', activeHandlersRef.current.up);
        activeHandlersRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const viewportWidth = previewViewport?.width || windowWidth;
  const viewportHeight =
    previewViewport?.height || (typeof window !== 'undefined' ? window.innerHeight : 860);
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);
  useEffect(() => {
    const sameActivity = previousActivityIdRef.current === activity.id;
    previousActivityIdRef.current = activity.id;
    setPhase(sameActivity ? 'play' : getInitialPreviewPhase(activity));
    setAttempts(0);
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedPlacements([]);
    setGuideSourcePhase(sameActivity ? 'play' : 'intro');
    setMenuOpen(false);
    setAudioMuted(false);
    setPlacements([]);
    setDragPreview(null);
    setHoveredDropId(null);
    setActiveLayerId(activity.activeLayerId || 'base');
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
  }, [activity, activity.id, activity.currentSlideId]);
  useEffect(() => {
    setTimelinePlaying(false);
  }, [phase, activity.id]);
  useEffect(() => {
    if (!previewCommand || previewCommand.activityId !== activity.id) return;
    const targetPhase =
      previewCommand.action === 'reset'
        ? getInitialPreviewPhase(activity)
        : previewCommand.phase || 'play';
    if (previewCommand.action !== 'reset' && previewCommand.phase === 'menu') {
      setPhase('play');
      setMenuOpen(true);
      return;
    }
    setPhase(targetPhase);
    setAttempts(0);
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedPlacements([]);
    setGuideSourcePhase(targetPhase === 'play' ? 'play' : 'intro');
    setMenuOpen(false);
    setAudioMuted(false);
    setPlacements([]);
    setDragPreview(null);
    setHoveredDropId(null);
    setActiveLayerId(activity.activeLayerId || 'base');
    setHiddenObjectIds(new Set());
    setObjectStates({});
    setTimelineTime(0);
    setTimelinePlaying(false);
  }, [activity, activity.activeLayerId, activity.id, activity.currentSlideId, previewCommand]);
  const scale = useMemo(() => {
    const sw = activity.stageWidth || 1920;
    const sh = activity.stageHeight || 1080;
    const maxWidth = Math.max(320, viewportWidth - (viewportWidth <= 768 ? 24 : 48));
    const maxHeight = Math.max(
      viewportWidth <= 768 ? 360 : 660,
      viewportHeight - (viewportWidth <= 768 ? 120 : 140)
    );
    return Math.min(1, maxWidth / sw, maxHeight / sh);
  }, [activity.stageHeight, activity.stageWidth, viewportHeight, viewportWidth]);
  const toStage = useCallback(
    (cx, cy) => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
    },
    [scale]
  );
  const runObjectTriggers = useCallback(
    (objectId, when = 'onClick') => {
      const nextObjectStates = {
        ...objectStates,
        [objectId]: {
          ...(objectStates?.[objectId] || {}),
          visited: when !== 'onLoad' ? true : objectStates?.[objectId]?.visited || false,
          selected:
            when === 'onClick' || when === 'onDrop'
              ? true
              : objectStates?.[objectId]?.selected || false,
        },
      };
      setObjectStates(nextObjectStates);
      runPreviewTriggers({
        activity,
        activities,
        objectId,
        when,
        onNextActivity,
        onGoToActivity,
        onGoToSlide,
        setActiveLayerId,
        hiddenObjectIds,
        setHiddenObjectIds,
        variables: runtimeVariables,
        setVariables: setRuntimeVariables,
        variableDefinitions,
        objectStates: nextObjectStates,
        setObjectStates,
      });
    },
    [
      activity,
      activities,
      hiddenObjectIds,
      objectStates,
      onGoToActivity,
      onGoToSlide,
      onNextActivity,
      runtimeVariables,
      setRuntimeVariables,
      variableDefinitions,
    ]
  );
  useEffect(() => {
    runPreviewTriggers({
      activity,
      activities,
      objectId: '__activity__',
      when: 'onLoad',
      onNextActivity,
      onGoToActivity,
      onGoToSlide,
      setActiveLayerId,
      hiddenObjectIds: new Set(),
      setHiddenObjectIds,
      variables: runtimeVariables,
      setVariables: setRuntimeVariables,
      variableDefinitions,
      objectStates: {},
      setObjectStates,
    });
  }, [
    activities,
    activity,
    activity.id,
    activity.currentSlideId,
    onGoToActivity,
    onGoToSlide,
    onNextActivity,
    runtimeVariables,
    setActiveLayerId,
    setRuntimeVariables,
    variableDefinitions,
  ]);

  const handleDown = useCallback(
    (e, dragId, placementId = null) => {
      if (phase !== 'play') return;
      if (status || checkResult) {
        setStatus(null);
        setCheckResult(null);
        setSubmittedPlacements([]);
      }
      e.preventDefault();
      e.currentTarget?.setPointerCapture?.(e.pointerId);
      const drag = drags.find((item) => item.id === dragId);
      if (!drag) return;
      const startPt = toStage(e.clientX, e.clientY);
      const sourcePlacement = placementId
        ? placementsRef.current.find((entry) => entry.id === placementId) || null
        : null;
      const baseFrame =
        placementId && placementFrames[placementId]
          ? placementFrames[placementId]
          : { x: drag.x, y: drag.y, width: drag.width, height: drag.height };
      const cp = { x: baseFrame.x, y: baseFrame.y };
      if (placementId) {
        setPlacements((prev) => prev.filter((entry) => entry.id !== placementId));
      }
      dragging.current = {
        dragId,
        placementId,
        ox: startPt.x - cp.x,
        oy: startPt.y - cp.y,
        startPos: cp,
        currentPos: cp,
        originalPlacement: sourcePlacement,
      };
      setDragPreview({
        dragId,
        placementId,
        x: cp.x,
        y: cp.y,
        width: drag.width,
        height: drag.height,
      });

      const onMove = (me) => {
        if (!dragging.current) return;
        const pt = toStage(me.clientX, me.clientY);
        const { dragId: activeDragId, ox, oy, placementId: activePlacementId } = dragging.current;
        const nx = pt.x - ox,
          ny = pt.y - oy;
        dragging.current.currentPos = { x: nx, y: ny };
        setDragPreview((prev) => (prev ? { ...prev, x: nx, y: ny } : prev));
        const d = drags.find((x) => x.id === activeDragId);
        const cx = nx + (d?.width || 0) / 2;
        const cy = ny + (d?.height || 0) / 2;
        const visiblePlacements = placementsRef.current.filter(
          (entry) => entry.id !== activePlacementId
        );
        const hovered = drops.find(
          (dz) =>
            cx >= dz.x &&
            cx <= dz.x + dz.width &&
            cy >= dz.y &&
            cy <= dz.y + dz.height &&
            canDropOnZone(d, dz, visiblePlacements, activePlacementId)
        );
        setHoveredDropId(hovered?.id || null);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        activeHandlersRef.current = null;
        if (!dragging.current) return;
        const {
          dragId: activeDragId,
          startPos,
          currentPos,
          placementId: activePlacementId,
          originalPlacement,
        } = dragging.current;
        const p = currentPos || startPos;
        const d = drags.find((x) => x.id === activeDragId);
        const visiblePlacements = placementsRef.current.filter(
          (entry) => entry.id !== activePlacementId
        );
        let matchedDz = null;
        for (const dz of drops) {
          const cx = p.x + (d?.width || 0) / 2,
            cy = p.y + (d?.height || 0) / 2;
          if (
            cx >= dz.x &&
            cx <= dz.x + dz.width &&
            cy >= dz.y &&
            cy <= dz.y + dz.height &&
            canDropOnZone(d, dz, visiblePlacements, activePlacementId)
          ) {
            matchedDz = dz;
            break;
          }
        }
        if (matchedDz) {
          const nextPlacement = originalPlacement
            ? { ...originalPlacement, dropId: matchedDz.id }
            : createDragDropPlacement(activeDragId, matchedDz.id);
          setPlacements((prev) => [
            ...prev.filter((entry) => entry.id !== activePlacementId),
            nextPlacement,
          ]);
          runObjectTriggers(activeDragId, 'onDrop');
          runObjectTriggers(matchedDz.id, 'onDrop');
        } else {
          if (originalPlacement) {
            setPlacements((prev) => [...prev, originalPlacement]);
          }
        }
        dragging.current = null;
        setDragPreview(null);
        setHoveredDropId(null);
      };

      activeHandlersRef.current = { move: onMove, up: onUp };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [
      phase,
      status,
      checkResult,
      drags,
      drops,
      toStage,
      runObjectTriggers,
      placementFrames,
      canDropOnZone,
    ]
  );
  const getScreenStyle = (screenKey) => {
    const map = {
      intro: intro,
      package: packageScreen,
      menu: menuScreen,
      play: playScreen,
      success: results,
      failure: results,
      answer: answerScreen,
    };
    return map[screenKey]?.style || {};
  };
  const primaryBtn = {
    padding: '13px 28px',
    borderRadius: theme.radius || 999,
    border: `1px solid ${theme.border}`,
    background: theme.button,
    color: theme.text,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: `0 12px 24px ${theme.border}33`,
    letterSpacing: 0.3,
    transition: 'opacity .15s',
  };
  const ghostBtn = {
    ...primaryBtn,
    background: '#ffffff',
    color: '#123a56',
    border: `1px solid ${theme.border}55`,
    boxShadow: '0 8px 16px rgba(20,58,86,.06)',
  };
  const screenBtn = (screenKey) => {
    const s = getScreenStyle(screenKey);
    if (
      !s.buttonBackground &&
      !s.buttonColor &&
      !s.buttonBorderColor &&
      !s.buttonBorderRadius &&
      !s.buttonFontSize &&
      !s.buttonPaddingX &&
      !s.buttonPaddingY
    )
      return primaryBtn;
    return {
      ...primaryBtn,
      ...(s.buttonBackground && { background: s.buttonBackground }),
      ...(s.buttonColor && { color: s.buttonColor }),
      ...(s.buttonBorderColor && {
        border: `1px solid ${s.buttonBorderColor}44`,
        boxShadow: `0 8px 32px ${s.buttonBorderColor}44`,
      }),
      ...(s.buttonBorderRadius != null &&
        s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }),
      ...(s.buttonFontSize && { fontSize: s.buttonFontSize }),
      ...((s.buttonPaddingX || s.buttonPaddingY) && {
        padding: `${s.buttonPaddingY || 13}px ${s.buttonPaddingX || 28}px`,
      }),
    };
  };
  const screenGhostBtn = (screenKey) => {
    const s = getScreenStyle(screenKey);
    return {
      ...ghostBtn,
      ...(s.buttonBackground && { background: s.buttonBackground }),
      ...(s.buttonColor && { color: s.buttonColor }),
      ...(s.buttonBorderRadius != null &&
        s.buttonBorderRadius !== 0 && { borderRadius: s.buttonBorderRadius }),
    };
  };
  const vw = Math.round((activity.stageWidth || 1920) * scale);
  const vh = Math.round((activity.stageHeight || 1080) * scale);
  const matchedLabels = placements.map(
    (entry) =>
      `${drags.find((drag) => drag.id === entry.dragId)?.label || 'Surukle'} -> ${dropById[entry.dropId]?.label || entry.dropId}`
  );
  useEffect(() => {
    onDebugDataChange?.({
      phase,
      attempts,
      activeLayerId,
      timelineTime,
      timelinePlaying,
      matchLabels: matchedLabels,
      matchedMap: matched,
      status,
      checking,
      hiddenObjectIds: [...hiddenObjectIds],
      objectStates,
      submittedMatchMap: submittedMatches,
      submittedPlacements,
    });
  }, [
    activeLayerId,
    attempts,
    checking,
    hiddenObjectIds,
    matched,
    matchedLabels,
    objectStates,
    onDebugDataChange,
    phase,
    status,
    submittedMatches,
    submittedPlacements,
    timelinePlaying,
    timelineTime,
  ]);

  const renderStage = (forceCorrect = false, showEvaluation = true) => {
    const shownPlacements = forceCorrect ? correctPlacements : placements;
    const shownPlacementFrames = forceCorrect ? correctPlacementFrames : placementFrames;
    const matchedDropIds = new Set(shownPlacements.map((entry) => entry.dropId));
    const correctDropIds = new Set(correctPairs.map((pair) => pair.dropId));
    return (
      <div
        ref={forceCorrect ? null : stageRef}
        style={{
          width: vw,
          height: vh,
          position: 'relative',
          background: activity.backgroundColor || '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          margin: '0 auto',
          border: `1px solid ${theme.border}18`,
          boxShadow: '0 16px 48px rgba(0,0,0,.28)',
          touchAction: 'none',
        }}
      >
        {activity.svgMarkup && (
          <div
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
          />
        )}
        {drops.map((dz) => {
          const isMatched = matchedDropIds.has(dz.id);
          const isHovered = !forceCorrect && hoveredDropId === dz.id;
          const dropPlacements = shownPlacements.filter((entry) => entry.dropId === dz.id);
          const isCheckedCorrect =
            checking && dropPlacements.some((entry) => checkResult?.[entry.id] === true);
          const isCheckedWrong =
            checking && dropPlacements.some((entry) => checkResult?.[entry.id] === false);
          const isHinted =
            developerHintMode &&
            !forceCorrect &&
            !checking &&
            checkResult === null &&
            correctDropIds.has(dz.id);
          const borderColor = isCheckedCorrect
            ? '#14532d'
            : isCheckedWrong
              ? '#7f1d1d'
              : isHovered
                ? theme.border
                : dz.style?.borderColor || '#f97316';
          const background = isCheckedCorrect
            ? '#166534'
            : isCheckedWrong
              ? '#991b1b'
              : dz.style?.background || '#fed7aa';
          const textColor =
            isCheckedCorrect || isCheckedWrong ? '#ffffff' : dz.style?.color || '#9a3412';
          return (
            <div
              key={dz.id}
              style={{
                position: 'absolute',
                left: dz.x * scale,
                top: dz.y * scale,
                width: dz.width * scale,
                height: dz.height * scale,
                border: `2px solid ${borderColor}`,
                background,
                borderRadius: (dz.style?.borderRadius || 10) * scale,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, 11 * scale),
                color: textColor,
                transition: 'border-color .12s, background .12s',
                zIndex: 1,
                fontWeight: 700,
                boxShadow: isHinted
                  ? '0 0 0 2px rgba(74,222,128,.82) inset, 0 0 0 6px rgba(74,222,128,.16)'
                  : 'none',
              }}
            >
              {!isMatched && (dz.label || 'Bırak')}
            </div>
          );
        })}
        {drags.map((d) => {
          const sourcePlacements = shownPlacements.filter((entry) => entry.dragId === d.id);
          const reusable = isDragReusable(runtimeActivity, d);
          const showSource = !forceCorrect && (reusable || sourcePlacements.length === 0);
          const isHinted =
            developerHintMode &&
            !forceCorrect &&
            !checking &&
            checkResult === null &&
            correctPairs.some((pair) => pair.dragId === d.id);
          if (!showSource) return null;
          return (
            <div
              key={`source-${d.id}`}
              onPointerDown={checking ? undefined : (e) => handleDown(e, d.id)}
              style={{
                position: 'absolute',
                left: d.x * scale,
                top: d.y * scale,
                width: d.width * scale,
                height: d.height * scale,
                background: d.style?.background || '#1d4ed8',
                border: `2px solid ${d.style?.borderColor || '#1e3a8a'}`,
                borderRadius: (d.style?.borderRadius || 10) * scale,
                cursor: checking ? 'default' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, 13 * scale),
                color: d.style?.color || '#eff6ff',
                fontWeight: 700,
                userSelect: 'none',
                zIndex: 3,
                transition: 'box-shadow .18s, border-color .18s',
                touchAction: 'none',
                boxShadow: isHinted
                  ? '0 0 0 2px rgba(74,222,128,.82), 0 0 0 6px rgba(74,222,128,.16)'
                  : '0 6px 18px rgba(15,23,42,.16)',
                padding: `0 ${Math.max(8, 12 * scale)}px`,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {d.label || 'Sürükle'}
              </span>
            </div>
          );
        })}
        {shownPlacements.map((entry) => {
          const frame = shownPlacementFrames[entry.id];
          if (!frame) return null;
          const drag = frame.drag;
          const showCheckedState = showEvaluation && (checking || checkResult !== null);
          const placementOk = checkResult ? checkResult[entry.id] : null;
          const isCheckCorrect = showCheckedState && placementOk === true;
          const isCheckWrong = showCheckedState && placementOk === false;
          return (
            <div
              key={entry.id}
              onPointerDown={
                forceCorrect || checking ? undefined : (e) => handleDown(e, entry.dragId, entry.id)
              }
              style={{
                position: 'absolute',
                left: frame.x * scale,
                top: frame.y * scale,
                width: frame.width * scale,
                height: frame.height * scale,
                background: isCheckCorrect
                  ? '#166534'
                  : isCheckWrong
                    ? '#991b1b'
                    : drag.style?.background || '#1d4ed8',
                border: `2px solid ${isCheckCorrect ? '#14532d' : isCheckWrong ? '#7f1d1d' : drag.style?.borderColor || '#1e3a8a'}`,
                borderRadius:
                  (frame.drop?.style?.borderRadius || drag.style?.borderRadius || 10) * scale,
                cursor: forceCorrect || checking ? 'default' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, 13 * scale),
                color: isCheckCorrect || isCheckWrong ? '#ffffff' : drag.style?.color || '#eff6ff',
                fontWeight: 700,
                userSelect: 'none',
                zIndex: 4,
                transition: 'left .18s, top .18s, background .2s, border-color .2s',
                touchAction: 'none',
                boxShadow: isCheckCorrect
                  ? '0 8px 22px rgba(22,101,52,.38)'
                  : isCheckWrong
                    ? '0 8px 22px rgba(153,27,27,.34)'
                    : '0 6px 18px rgba(15,23,42,.16)',
                padding: `0 ${Math.max(8, 12 * scale)}px`,
                gap: Math.max(6, 8 * scale),
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {drag.label || 'Sürükle'}
              </span>
              {(isCheckCorrect || isCheckWrong) && (
                <span
                  style={{
                    width: Math.max(20, 24 * scale),
                    height: Math.max(20, 24 * scale),
                    borderRadius: '50%',
                    background: isCheckCorrect ? '#ffffff' : '#fee2e2',
                    color: isCheckCorrect ? '#166534' : '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.max(11, 13 * scale),
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {isCheckCorrect ? '✓' : '×'}
                </span>
              )}
            </div>
          );
        })}
        {!forceCorrect &&
          dragPreview &&
          (() => {
            const drag = drags.find((item) => item.id === dragPreview.dragId);
            if (!drag) return null;
            return (
              <div
                style={{
                  position: 'absolute',
                  left: dragPreview.x * scale,
                  top: dragPreview.y * scale,
                  width: dragPreview.width * scale,
                  height: dragPreview.height * scale,
                  background: drag.style?.background || '#1d4ed8',
                  border: `2px solid ${drag.style?.borderColor || '#1e3a8a'}`,
                  borderRadius: (drag.style?.borderRadius || 10) * scale,
                  cursor: 'grabbing',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: Math.max(10, 13 * scale),
                  color: drag.style?.color || '#eff6ff',
                  fontWeight: 700,
                  userSelect: 'none',
                  zIndex: 100,
                  transition: 'none',
                  touchAction: 'none',
                  boxShadow: '0 12px 32px rgba(0,0,0,.4)',
                  padding: `0 ${Math.max(8, 12 * scale)}px`,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {drag.label || 'Sürükle'}
                </span>
              </div>
            );
          })()}
        <RuntimeObjectLayer
          activity={activity}
          activeLayerId={activeLayerId}
          hiddenObjectIds={hiddenObjectIds}
          objectStates={objectStates}
          onRunTriggers={runObjectTriggers}
          scale={scale}
          currentTime={runtimePreviewTime}
        />
      </div>
    );
  };

  const accent = theme.accent || theme.border;
  const accentDark = theme.accentDark || theme.border;
  const successGreen = theme.successTone || '#15803d';
  const dangerRed = theme.dangerTone || '#b91c1c';
  const shellHeight = '100%';
  const packageBackText = packageScreen.backButtonText || 'Geri Dön';
  const nextAfterIntroAuto =
    settings.showButtonPackageIntro !== false && packageScreen.enabled !== false
      ? 'package'
      : settings.showMenuScreen !== false && menuScreen.enabled !== false
        ? 'menu'
        : 'play';
  const nextAfterPackageAuto =
    settings.showMenuScreen !== false && menuScreen.enabled !== false ? 'menu' : 'play';
  const nextAfterIntro = resolvePreviewFlowTarget(
    settings.introNextPhase,
    ['package', 'menu', 'play'],
    nextAfterIntroAuto
  );
  const nextAfterPackage = resolvePreviewFlowTarget(
    settings.packageNextPhase,
    ['intro', 'menu', 'play'],
    nextAfterPackageAuto
  );
  const openGuide = (source = 'intro') => {
    setGuideSourcePhase(source);
    setMenuOpen(false);
    setPhase('package');
  };

  const resetFlow = (targetPhase = getInitialPreviewPhase(activity)) => {
    setPhase(targetPhase);
    setAttempts(0);
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedPlacements([]);
    setPlacements([]);
    setDragPreview(null);
    setHoveredDropId(null);
    setTimelineTime(0);
    setTimelinePlaying(false);
    setMenuOpen(false);
    setGuideSourcePhase(targetPhase === 'play' ? 'play' : 'intro');
  };

  const retryCurrentPlacement = () => {
    setPhase('play');
    setStatus(null);
    setChecking(false);
    setCheckResult(null);
    setSubmittedPlacements([]);
    setMenuOpen(false);
  };

  const revealSolution = () => {
    setPlacements(correctPlacements);
    setStatus(null);
    setChecking(false);
    setCheckResult(Object.fromEntries(correctPlacements.map((entry) => [entry.id, true])));
    setSubmittedPlacements(correctPlacements);
    setMenuOpen(false);
    setPhase('answer');
  };

  const finishSuccess = () => {
    if (hasNextStep) {
      onNextStep?.();
      return;
    }
    resetFlow('intro');
  };

  const runDragDropAction = (action, fallbackAction = 'play') => {
    const resolved = action || fallbackAction;
    switch (resolved) {
      case 'toggle-menu':
        setMenuOpen((value) => !value);
        return;
      case 'check':
        evaluateMatches();
        return;
      case 'answer':
        revealSolution();
        return;
      case 'restart':
        resetFlow();
        return;
      case 'complete':
        finishSuccess();
        return;
      case 'package':
        openGuide(phase === 'play' ? 'play' : 'intro');
        return;
      case 'intro':
      case 'menu':
      case 'play':
        resetFlow(resolved);
        return;
      case 'result':
        setMenuOpen(false);
        setPhase('result');
        return;
      case 'none':
        setMenuOpen(false);
        return;
      default:
        if (['intro', 'menu', 'play'].includes(fallbackAction)) resetFlow(fallbackAction);
        else if (fallbackAction === 'package') openGuide(phase === 'play' ? 'play' : 'intro');
    }
  };

  const evaluateMatches = () => {
    const evaluation = evaluateDragDropPlacements(runtimeActivity, placements, correctMatches);
    setSubmittedPlacements([...placements]);
    setCheckResult(evaluation.placementResult);
    setStatus(evaluation.success ? 'success' : 'failure');
    setChecking(true);
    setMenuOpen(false);
    setTimelinePlaying(false);
    setTimeout(() => {
      setChecking(false);
      setAttempts((p) => p + 1);
      setPhase('result');
    }, 650);
  };

  const renderShell = (screen, _badge, content, overlay = null) => {
    const cs = getScreenStyle(screen);
    return (
      <div style={{ width: '100%', height: shellHeight, margin: '0 auto', position: 'relative' }}>
        <style>{`@keyframes dd-spin{to{transform:rotate(360deg)}}@keyframes dd-banner-up{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <SlideTransitionView
          transitionKey={`${activity.id}-${activity.currentSlideId}-${screen}`}
          effect={activity.slideTransitionEffect || 'fade'}
          direction={activity.slideTransitionDirection || 'left'}
          duration={activity.slideTransitionDuration ?? 0.45}
        >
          <div
            style={{
              height: '100%',
              borderRadius: cs.borderRadius || 32,
              overflow: 'hidden',
              position: 'relative',
              background: cs.background || 'linear-gradient(180deg,#ffffff 0,#fbfcfd 100%)',
              border: '1px solid #e4eff5',
              boxShadow: '0 26px 60px rgba(20,58,86,.12)',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: cs.padding ? `${cs.padding}px` : '12px 16px',
              }}
            >
              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{content}</div>
            </div>
            {overlay}
          </div>
        </SlideTransitionView>
      </div>
    );
  };

  const renderGuideScreen = () => (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        style={{
          width: 'min(1120px, 100%)',
          background: '#ffffff',
          borderRadius: 28,
          padding: '18px 18px 16px',
          boxShadow: '0 24px 70px rgba(15,23,42,.20)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 420px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
              {packageTitle}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: '#475569' }}>{packageBody}</div>
          </div>
          <button
            onClick={() => runDragDropAction(settings.packageBackAction || 'intro', 'intro')}
            style={{
              ...ghostBtn,
              color: '#334155',
              borderColor: '#cbd5e1',
              background: '#ffffff',
              boxShadow: 'none',
            }}
          >
            ← {packageBackText}
          </button>
        </div>
        <ButtonPackageIntroDiagram pkgId={activity.buttonPackageId} config={packageScreen} />
        <div
          style={{
            ...resolvePreviewButtonLayoutStyle(getScreenStyle('package'), {
              justifyContent: 'center',
              gap: 10,
            }),
          }}
        >
          <button
            onClick={() => runDragDropAction(settings.packageBackAction || 'intro', 'intro')}
            style={screenGhostBtn('package')}
          >
            {packageBackText}
          </button>
          <button onClick={() => setPhase(nextAfterPackage)} style={screenBtn('package')}>
            {packageScreen.buttonText || 'Etkinliğe Geç'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderMenuPopup = () => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom: 56,
        width: 270,
        background: '#ffffff',
        borderRadius: 22,
        border: `1px solid ${accent}33`,
        boxShadow: '0 22px 60px rgba(15,23,42,.22)',
        padding: 12,
        zIndex: 8,
      }}
    >
      {[
        {
          id: 'guide',
          icon: '?',
          label: settings.guideButtonText || 'Tanıtım',
          action: () => runDragDropAction(settings.guideButtonAction || 'package', 'package'),
        },
        {
          id: 'restart',
          icon: '\u21ba',
          label: settings.restartFlowText || previewTx.restartLabel,
          action: () => runDragDropAction(settings.restartButtonAction || 'restart', 'restart'),
        },
        {
          id: 'sound',
          icon: audioMuted ? 'S' : 'A',
          label: audioMuted
            ? settings.soundOnText || 'Sesi Aç'
            : settings.soundOffText || 'Sesi Kapat',
          action: () => setAudioMuted((value) => !value),
        },
        {
          id: 'home',
          icon: 'H',
          label: settings.homeButtonText || 'Ana Sayfa',
          action: () => runDragDropAction(settings.homeButtonAction || 'intro', 'intro'),
        },
      ].map((item) => (
        <button
          key={item.id}
          onClick={item.action}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 14,
            border: 'none',
            background: 'transparent',
            color: '#475569',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: `${accent}18`,
              color: accentDark,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );

  const renderResultPopup = () => {
    const success = status === 'success';
    const bannerTheme = success
      ? {
          bg: 'rgba(220,252,231,.96)',
          border: 'rgba(34,197,94,.34)',
          title: successGreen,
          body: '#166534',
          iconBg: '#bbf7d0',
        }
      : {
          bg: 'rgba(254,226,226,.96)',
          border: 'rgba(239,68,68,.32)',
          title: dangerRed,
          body: '#991b1b',
          iconBg: '#fecaca',
        };
    const bodyText = success
      ? resultScreens.successBody || 'Do\u011fru cevab\u0131 buldun.'
      : resultScreens.failureBody ||
        'Baz\u0131 e\u015fle\u015ftirmeler yanl\u0131\u015f g\u00f6r\u00fcn\u00fcyor. \u0130stersen yeniden deneyebilir veya \u00e7\u00f6z\u00fcm\u00fc g\u00f6rebilirsin.';

    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            padding: '16px 22px',
            borderRadius: 24,
            background: bannerTheme.bg,
            border: `1px solid ${bannerTheme.border}`,
            boxShadow: '0 22px 50px rgba(15,23,42,.22)',
            backdropFilter: 'blur(10px)',
            animation: 'dd-banner-up .28s ease-out',
            pointerEvents: 'auto',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minWidth: 0,
              flex: '1 1 340px',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: bannerTheme.iconBg,
                color: bannerTheme.title,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {success ? '\u2713' : '\u2715'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{ fontSize: 18, fontWeight: 900, color: bannerTheme.title, marginBottom: 2 }}
              >
                {success ? 'DO\u011eRU' : 'YANLI\u015e'}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: bannerTheme.body,
                  wordBreak: 'break-word',
                }}
              >
                {bodyText}
              </div>
            </div>
          </div>
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(getScreenStyle(success ? 'success' : 'failure'), {
                justifyContent: 'flex-end',
                gap: 10,
              }),
              flex: '0 1 auto',
            }}
          >
            {success ? (
              <>
                <button
                  onClick={() =>
                    runDragDropAction(settings.completeButtonAction || 'complete', 'complete')
                  }
                  style={{ ...primaryBtn, background: successGreen, borderColor: successGreen }}
                >
                  {settings.completeButtonText || 'Tamamla'}
                </button>
                <button
                  onClick={() =>
                    runDragDropAction(settings.restartButtonAction || 'restart', 'restart')
                  }
                  style={{
                    ...ghostBtn,
                    color: '#166534',
                    borderColor: 'rgba(34,197,94,.3)',
                    background: 'rgba(255,255,255,.72)',
                  }}
                >
                  {settings.restartFlowText || previewTx.restartLabel}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={retryCurrentPlacement}
                  style={{ ...primaryBtn, background: accent, borderColor: accent }}
                >
                  {resultScreens.retryText || previewTx.tryAgainShort}
                </button>
                <button
                  onClick={() =>
                    runDragDropAction(settings.solutionButtonAction || 'answer', 'answer')
                  }
                  style={{
                    ...ghostBtn,
                    color: '#991b1b',
                    borderColor: 'rgba(239,68,68,.28)',
                    background: 'rgba(255,255,255,.72)',
                  }}
                >
                  {settings.solutionButtonText || previewTx.showSolutionLabel}
                </button>
                <button
                  onClick={() =>
                    runDragDropAction(settings.restartButtonAction || 'restart', 'restart')
                  }
                  style={{
                    ...ghostBtn,
                    color: '#334155',
                    borderColor: '#cbd5e1',
                    background: 'rgba(255,255,255,.78)',
                  }}
                >
                  {settings.restartFlowText || previewTx.restartLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPlayLayout = (forceCorrect = false, showEvaluation = true, extraBanner = null) => (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      {extraBanner}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderStage(forceCorrect, showEvaluation)}
      </div>
      {developerHintMode && !forceCorrect && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 16,
            border: '1px solid rgba(74,222,128,.34)',
            background: 'rgba(22,163,74,.12)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#166534',
              marginBottom: 8,
              letterSpacing: 0.45,
              textTransform: 'uppercase',
            }}
          >
            Geliştirici İpucu
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {autoAnswer.map((line, index) => (
              <div
                key={`${line}-${index}`}
                style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        style={{
          ...resolvePreviewButtonLayoutStyle(getScreenStyle('play'), {
            justifyContent: 'space-between',
            gap: 14,
          }),
          alignItems: 'flex-end',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div style={{ position: 'relative' }}>
          <button
            onClick={() =>
              runDragDropAction(settings.menuButtonAction || 'toggle-menu', 'toggle-menu')
            }
            style={{
              padding: '13px 22px',
              borderRadius: 999,
              border: `1px solid ${accentDark}`,
              background: accent,
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 14px 30px rgba(214,31,105,.28)',
            }}
          >
            {settings.menuButtonText || '☰ MENÜ'}
          </button>
          {menuOpen && phase === 'play' && renderMenuPopup()}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <LivesBar activity={activity} attempts={attempts} />
          {checking ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.16)',
                color: '#ffffff',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid #ffffff',
                  borderTopColor: 'transparent',
                  animation: 'dd-spin 0.6s linear infinite',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Kontrol ediliyor...</span>
            </div>
          ) : (
            <button
              onClick={() => runDragDropAction(settings.checkButtonAction || 'check', 'check')}
              style={{
                padding: '13px 22px',
                borderRadius: theme.radius || 999,
                border: `1px solid ${accent}`,
                background: theme.button,
                color: theme.text,
                fontSize: 14,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: `0 12px 28px ${accent}2a`,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,.9)',
                  color: accent,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                ✓
              </span>
              {settings.checkButtonText || 'Kontrol Et'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (phase === 'intro') {
    return renderShell(
      'intro',
      'Karşılama',
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
        }}
      >
        <div
          style={{
            width: 'min(1040px, 100%)',
            background: '#ffffff',
            borderRadius: 34,
            padding: '42px 44px',
            position: 'relative',
            boxShadow: '0 28px 90px rgba(15,23,42,.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 70,
              bottom: 70,
              width: 28,
              background: `linear-gradient(180deg,${accent},${accentDark})`,
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 70,
              bottom: 70,
              width: 28,
              background: `linear-gradient(180deg,${accent},${accentDark})`,
              borderTopLeftRadius: 24,
              borderBottomLeftRadius: 24,
            }}
          />
          <div style={{ textAlign: 'center', color: '#0f172a', maxWidth: 780, margin: '0 auto' }}>
            <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 10 }}>
              {intro.title || activity.name || 'Etkinliğe Hoş Geldin'}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.75, color: '#64748b', marginBottom: 30 }}>
              {intro.body ||
                'Hazır olduğunda etkinliği başlatabilir veya önce etkinlik tanıtımını inceleyebilirsin.'}
            </div>
            <div
              style={{
                ...resolvePreviewButtonLayoutStyle(getScreenStyle('intro'), {
                  justifyContent: 'center',
                  gap: 18,
                }),
              }}
            >
              <button
                onClick={() =>
                  runDragDropAction(settings.guideButtonAction || 'package', 'package')
                }
                style={{
                  minWidth: 280,
                  padding: '18px 28px',
                  borderRadius: 999,
                  border: `2px solid ${accent}`,
                  background: '#fff1f7',
                  color: accentDark,
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                ? {settings.guideButtonText || 'Tanıtım'}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setPhase(nextAfterIntro);
                }}
                style={{
                  minWidth: 280,
                  padding: '18px 28px',
                  borderRadius: 999,
                  border: `2px solid ${accentDark}`,
                  background: accent,
                  color: '#ffffff',
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 18px 40px rgba(214,31,105,.28)',
                }}
              >
                {intro.buttonText || 'Etkinliği Başlat'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'package') {
    return renderShell('intro', 'Kılavuz', renderGuideScreen());
  }

  if (phase === 'answer') {
    return renderShell(
      'play',
      'Çözüm',
      renderPlayLayout(
        true,
        false,
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 16,
            background: '#eaf4fb',
            border: '1px solid #d6e7f2',
            color: '#123a56',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {answerScreen.title || previewTx.correctAnswerTitle}: öğeler doğru yerlerine yerleştirildi.
          </div>
          {answerScreen.body ? (
            <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.78 }}>{answerScreen.body}</div>
          ) : null}
          <div
            style={{
              ...resolvePreviewButtonLayoutStyle(getScreenStyle('answer'), {
                justifyContent: 'center',
                gap: 12,
              }),
            }}
          >
            <button
              onClick={() => runDragDropAction(settings.answerButtonAction || 'restart', 'restart')}
              style={screenGhostBtn('answer')}
            >
              {answerScreen.buttonText || 'Yeniden Başlat'}
            </button>
          </div>
        </div>
      )
    );
  }

  const showResultOverlay = phase === 'result' && !!status;
  return renderShell(
    'play',
    'Etkinlik',
    renderPlayLayout(false, true),
    showResultOverlay ? renderResultPopup() : null
  );

}

export {
  PreviewDragDrop,
  PreviewSelection,
  PreviewDebugOverlay,
  ManualLayerPreview,
  PreviewPlayer,
  TimelinePreviewControls,
  PreviewSelectionFlow,
  PreviewDragDropFlow,
};
