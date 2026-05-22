import { useState, useMemo } from 'react';

import { SLIDE_TRANSITION_OPTIONS } from '../constants';
import { buildResolvedLayerNameMap } from '../logic/factories';
import { EDITOR_THEME } from '../theme';
import {
  uid,
  clamp,
  getSlideProgressSummary,
  resolveWorkflowStatusMeta,
  sanitizeSvgMarkup,
} from '../utils/editorHelpers';

// ─── SlideThumbnail ───────────────────────────────────────────────────────────

const managedAnswerLayerPreviewItems = [
  { key: 'menu', label: 'Menü', tone: '#2563eb' },
  { key: 'normal', label: 'Normal', tone: '#f59e0b' },
  { key: 'correct', label: 'Doğru', tone: '#16a34a' },
  { key: 'incorrect', label: 'Yanlış', tone: '#dc2626' },
  { key: 'cevap', label: 'Cevap', tone: '#7c3aed' },
];

function normalizeThumbnailLayerKey(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

export function SlideThumbnail({
  slide,
  isActive = false,
  width = 132,
  height = 74,
  showBadges = true,
}) {
  const stageWidth = Math.max(1, Number(slide?.stageWidth || 1920));
  const stageHeight = Math.max(1, Number(slide?.stageHeight || 1080));
  const scale = Math.min(1, width / stageWidth, height / stageHeight);
  const isTemplateSlide =
    !!slide?.sceneTemplateId ||
    (slide?.objects || []).some((item) => item?.generatedBy === 'scene-template');
  const stageArea = Math.max(1, stageWidth * stageHeight);
  const baseLayerObjects = (slide?.objects || []).filter((item) => {
    const layerId = String(item?.layerId || 'base');
    return item?.visible !== false && layerId === 'base';
  });
  const slideLayers = Array.isArray(slide?.layers) ? slide.layers : [];
  const resolvedLayerNames = buildResolvedLayerNameMap(slideLayers, slide || {});
  const managedLayerPreview = managedAnswerLayerPreviewItems
    .map((item) => {
      const layer = slideLayers.find(
        (entry) =>
          normalizeThumbnailLayerKey(resolvedLayerNames[entry?.id] || entry?.name) === item.key
      );
      if (!layer) return null;
      const count = (slide?.objects || []).filter(
        (object) => object?.visible !== false && (object.layerId || 'base') === layer.id
      ).length;
      return { ...item, count };
    })
    .filter(Boolean);
  const showManagedLayerPreview = baseLayerObjects.length === 0 && managedLayerPreview.length > 0;
  const sortedByZ = baseLayerObjects.sort((a, b) => (a?.zIndex || 1) - (b?.zIndex || 1));
  const visibleObjects = isTemplateSlide
    ? sortedByZ
        .map((item, index) => {
          const slotId = String(item?.sceneTemplateSlotId || '');
          const area = Math.max(1, (Number(item?.width) || 1) * (Number(item?.height) || 1));
          const isHugeBackdrop = item?.type === 'shape' && area / stageArea >= 0.72;
          const isTemplateControl = /:(intro|start|close)-(button|icon)/.test(slotId);
          const isButton = item?.type === 'button';
          const hasLabel = String(item?.label || '').trim().length > 0;
          const score =
            (isTemplateControl ? 600 : 0) +
            (isButton ? 420 : 0) +
            (item?.linkedHoverGroup ? 180 : 0) +
            (hasLabel ? 70 : 0) -
            (isHugeBackdrop ? 260 : 0) -
            index * 0.001;
          return { item, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 56)
        .map((entry) => entry.item)
        .sort((a, b) => (a?.zIndex || 1) - (b?.zIndex || 1))
    : sortedByZ.slice(0, 18);

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 10,
        border: `1px solid ${isActive ? '#60a5fa' : '#c7d0db'}`,
        background: slide?.backgroundColor || '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: isActive
          ? '0 10px 20px rgba(37,99,235,.12)'
          : 'inset 0 1px 0 rgba(255,255,255,.9)',
      }}
    >
      {slide?.svgMarkup && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.92,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            width: stageWidth,
            height: stageHeight,
            pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(slide.svgMarkup) }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.04)' }} />
      {showManagedLayerPreview && (
        <div
          style={{
            position: 'absolute',
            inset: 7,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 4,
            alignContent: 'center',
          }}
        >
          {managedLayerPreview.slice(0, 5).map((item) => (
            <div
              key={item.key}
              style={{
                minWidth: 0,
                minHeight: 0,
                borderRadius: 5,
                border: `1px solid ${item.tone}55`,
                background: `${item.tone}12`,
                color: item.tone,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(6, Math.min(10, width / 15)),
                fontWeight: 900,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                padding: '0 3px',
              }}
              title={`${item.label}: ${item.count} nesne`}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
      {visibleObjects.map((obj) => {
        const st = obj.style || {};
        const isImage = !!obj.imageData;
        const isVideo = obj.type === 'video';
        const isAudio = obj.type === 'audio';
        const scaledWidth = Math.max(isTemplateSlide ? 2 : 8, (Number(obj.width) || 1) * scale);
        const scaledHeight = Math.max(isTemplateSlide ? 2 : 8, (Number(obj.height) || 1) * scale);
        const slotId = String(obj.sceneTemplateSlotId || '');
        const isTemplateControl = /:(intro|start|close)-(button|icon)/.test(slotId);
        const showLabel =
          !isTemplateSlide || isTemplateControl || (scaledWidth >= 18 && scaledHeight >= 8);
        return (
          <div
            key={obj.id}
            style={{
              position: 'absolute',
              left: obj.x * scale,
              top: obj.y * scale,
              width: scaledWidth,
              height: scaledHeight,
              borderRadius: Math.max(2, (st.borderRadius || 6) * scale),
              border: `${isTemplateSlide ? 0.5 : Math.max(1, obj.type === 'hotspot' ? 2 : 1)}px ${st.borderStyle || 'solid'} ${st.borderColor || 'rgba(15,23,42,.12)'}`,
              background: isImage
                ? 'transparent'
                : isVideo
                  ? '#082f49'
                  : isAudio
                    ? '#0f172a'
                    : st.background || 'rgba(255,255,255,.85)',
              color: st.color || '#0f172a',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(
                isTemplateSlide ? 4 : 6,
                (st.fontSize || 12) * scale * (isTemplateSlide ? 0.92 : 0.72)
              ),
              fontWeight: 800,
              padding: isImage ? 0 : isTemplateSlide ? 1 : Math.max(2, 4 * scale),
              transform: `rotate(${obj.rotation || 0}deg)`,
              boxSizing: 'border-box',
            }}
          >
            {isImage ? (
              <img
                src={obj.imageData}
                alt={obj.label || obj.type}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : isVideo ? (
              <span style={{ fontSize: Math.max(7, 10 * scale), color: '#e0f2fe' }}>VIDEO</span>
            ) : isAudio ? (
              <span style={{ fontSize: Math.max(7, 10 * scale), color: '#bae6fd' }}>SES</span>
            ) : showLabel ? (
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {obj.label || obj.type}
              </span>
            ) : null}
          </div>
        );
      })}
      {showBadges && (
        <>
          <div style={{ position: 'absolute', left: 6, top: 6, display: 'flex', gap: 4 }}>
            <span
              style={{
                padding: '2px 5px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.88)',
                color: '#334155',
                fontSize: 11,
                fontWeight: 800,
                border: '1px solid rgba(148,163,184,.35)',
              }}
            >
              {slide?.objects?.length || 0} obje
            </span>
          </div>
          <div style={{ position: 'absolute', right: 4, top: 4, display: 'flex', gap: 3 }}>
            {slide?.slideTransitionEffect && slide.slideTransitionEffect !== 'none' && (
              <span
                style={{
                  padding: '1px 4px',
                  borderRadius: 999,
                  background: 'rgba(15,23,42,.68)',
                  color: '#f8fafc',
                  fontSize: 8,
                  lineHeight: 1.05,
                  fontWeight: 800,
                }}
              >
                {slide.slideTransitionEffect === 'slide' ? 'Kaydır' : 'Fade'}
              </span>
            )}
          </div>
        </>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: isActive ? '2px solid #2563eb' : '1px solid rgba(255,255,255,.35)',
          pointerEvents: 'none',
          boxSizing: 'border-box',
          borderRadius: 10,
        }}
      />
    </div>
  );
}

// ─── LayerThumbnail ───────────────────────────────────────────────────────────

export function LayerThumbnail({ activity, layer, isActive = false, getCanvasObjects }) {
  const stageWidth = Math.max(1, Number(activity?.stageWidth || 1920));
  const stageHeight = Math.max(1, Number(activity?.stageHeight || 1080));
  const thumbWidth = 42;
  const thumbHeight = 24;
  const scale = Math.min(1, thumbWidth / stageWidth, thumbHeight / stageHeight);
  const visibleObjects = getCanvasObjects(
    { ...activity, activeLayerId: layer?.id || 'base' },
    layer?.id || 'base'
  )
    .filter((item) => item?.visible !== false)
    .sort((a, b) => (a?.zIndex || 1) - (b?.zIndex || 1))
    .slice(0, 6);

  return (
    <div
      style={{
        width: thumbWidth,
        height: thumbHeight,
        flexShrink: 0,
        borderRadius: 4,
        border: `1px solid ${isActive ? '#60a5fa' : '#c7d0db'}`,
        background: activity?.backgroundColor || '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
      }}
    >
      {activity?.svgMarkup && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.92,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            width: stageWidth,
            height: stageHeight,
            pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(activity.svgMarkup) }}
        />
      )}
      {visibleObjects.map((obj) => {
        const st = obj.style || {};
        const isImage = !!obj.imageData;
        const isVideo = obj.type === 'video';
        const isAudio = obj.type === 'audio';
        return (
          <div
            key={obj.id}
            style={{
              position: 'absolute',
              left: obj.x * scale,
              top: obj.y * scale,
              width: Math.max(6, obj.width * scale),
              height: Math.max(6, obj.height * scale),
              border: `1px ${st.borderStyle || 'solid'} ${st.borderColor || '#111111'}`,
              background: isImage
                ? 'transparent'
                : isVideo
                  ? '#444444'
                  : isAudio
                    ? '#e5e5e5'
                    : st.background || '#ffffff',
              color: st.color || '#111111',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(4, (st.fontSize || 12) * scale * 0.56),
              fontWeight: 700,
              padding: isImage ? 0 : 1,
              boxSizing: 'border-box',
            }}
          >
            {isImage ? (
              <img
                src={obj.imageData}
                alt={obj.label || obj.type}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : isVideo ? (
              <span style={{ fontSize: Math.max(4, 7 * scale), color: '#ffffff' }}>V</span>
            ) : isAudio ? (
              <span style={{ fontSize: Math.max(4, 7 * scale), color: '#111111' }}>S</span>
            ) : null}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: isActive ? '2px solid #2563eb' : '1px solid rgba(255,255,255,.45)',
          pointerEvents: 'none',
          boxSizing: 'border-box',
          borderRadius: 4,
        }}
      />
    </div>
  );
}

// ─── StoryboardPanel ──────────────────────────────────────────────────────────

export function StoryboardPanel({ present, selActivityId, onSelect, onOpenContent }) {
  const currentBook = present.books.find((book) => book.id === present.selBookId) || null;
  const currentPublisher = present.publishers.find((pub) => pub.id === present.selPubId) || null;
  const activities = present.activities.filter((activity) => activity.bookId === present.selBookId);

  const isActive = (id) => selActivityId === id;

  return (
    <div
      style={{
        width: 132,
        flexShrink: 0,
        border: `1px solid ${EDITOR_THEME.shellBorder}`,
        borderRadius: EDITOR_THEME.radiusLg,
        background: EDITOR_THEME.shellBg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 10px',
          borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
          background: EDITOR_THEME.shellPanel,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: EDITOR_THEME.shellMutedSoft,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
          }}
        >
          Storyboard
        </div>
        <div
          style={{ fontSize: 12, fontWeight: 700, color: EDITOR_THEME.shellText, lineHeight: 1.3 }}
        >
          {currentBook?.name || 'Kitap secilmedi'}
        </div>
        <div style={{ fontSize: 11, color: EDITOR_THEME.shellMutedSoft, marginTop: 4 }}>
          {currentPublisher?.name || 'Yayınevi seç'}
        </div>
        <button
          onClick={onOpenContent}
          style={{
            width: '100%',
            marginTop: 10,
            border: `1px solid ${EDITOR_THEME.shellBorder}`,
            background: EDITOR_THEME.shellPanelAlt,
            color: EDITOR_THEME.shellMuted,
            borderRadius: EDITOR_THEME.radiusSm,
            padding: '6px 8px',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          İçerik Yönet
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {activities.map((activity, index) => (
          <button
            key={activity.id}
            onClick={() => onSelect(activity.id)}
            style={{
              border: `1px solid ${isActive(activity.id) ? EDITOR_THEME.shellSuccess : EDITOR_THEME.shellBorder}`,
              background: isActive(activity.id) ? 'rgba(74,222,128,.1)' : EDITOR_THEME.shellInset,
              borderRadius: EDITOR_THEME.radiusMd,
              padding: 6,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                height: 62,
                borderRadius: EDITOR_THEME.radiusSm,
                border: `1px solid ${isActive(activity.id) ? EDITOR_THEME.shellSuccess : EDITOR_THEME.shellBorderStrong}`,
                background: `linear-gradient(180deg,${EDITOR_THEME.lightPanelAlt},${EDITOR_THEME.lightBg})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: EDITOR_THEME.lightText,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Sahne {index + 1}
            </div>
            <div
              style={{
                fontSize: 11,
                color: isActive(activity.id) ? EDITOR_THEME.shellSuccess : EDITOR_THEME.shellMuted,
                marginTop: 6,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activity.name || `Slider ${index + 1}`}
            </div>
          </button>
        ))}
        {activities.length === 0 && (
          <div
            style={{
              border: `1px dashed ${EDITOR_THEME.shellBorder}`,
              borderRadius: EDITOR_THEME.radiusMd,
              padding: 12,
              fontSize: 11,
              color: EDITOR_THEME.shellMutedSoft,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Once kitap sec, sonra etkinlik ekle.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── getSlideConnectionMap ────────────────────────────────────────────────────

export function getSlideConnectionMap(activity, slides, getActivitySlideTarget) {
  const outgoing = {};
  const incoming = {};
  slides.forEach((slide) => {
    outgoing[slide.id] = [];
    incoming[slide.id] = [];
  });

  const pushConnection = (fromId, toId, reason) => {
    if (!fromId || !toId || fromId === toId) return;
    if (!outgoing[fromId].some((entry) => entry.to === toId && entry.reason === reason)) {
      outgoing[fromId].push({ to: toId, reason });
    }
    if (!incoming[toId].some((entry) => entry.from === fromId && entry.reason === reason)) {
      incoming[toId].push({ from: fromId, reason });
    }
  };

  slides.forEach((slide, index) => {
    if (slides[index + 1]) pushConnection(slide.id, slides[index + 1].id, 'sira');
    (slide.triggers || [])
      .filter((trigger) => trigger?.action === 'SliderGec')
      .forEach((trigger) => {
        const target = getActivitySlideTarget(
          { ...activity, currentSlideId: slide.id, slides },
          trigger.value || '__next__'
        );
        if (target?.id) pushConnection(slide.id, target.id, 'tetik');
      });
  });

  return { outgoing, incoming };
}

// ─── SlideStrip ───────────────────────────────────────────────────────────────

export function SlideStrip({
  activity,
  onUpdate,
  vertical = false,
  getActivitySlides,
  selectActivitySlide,
  createSlide,
  normalizeSlide,
  getActivitySlideTarget,
}) {
  const slides = getActivitySlides(activity);
  const currentSlideId = activity?.currentSlideId || slides[0]?.id;
  const [thumbZoom, setThumbZoom] = useState(1);
  const [layoutMode, setLayoutMode] = useState(vertical ? 'list' : 'grid');
  const { outgoing } = useMemo(
    () => getSlideConnectionMap(activity, slides, getActivitySlideTarget),
    [activity, slides, getActivitySlideTarget]
  );
  const effectiveLayoutMode = vertical ? 'list' : layoutMode;
  const thumbWidth = Math.max(vertical ? 126 : 118, Math.round((vertical ? 132 : 138) * thumbZoom));
  const thumbHeight = Math.max(vertical ? 70 : 68, Math.round((vertical ? 74 : 78) * thumbZoom));

  const handleSelect = (slideId) => onUpdate(selectActivitySlide(activity, slideId));
  const handleAdd = () => {
    const newSlide = createSlide(`Slider ${slides.length + 1}`, slides.length);
    onUpdate(
      selectActivitySlide(
        { ...activity, slides: [...slides, newSlide], currentSlideId: newSlide.id },
        newSlide.id
      )
    );
  };
  const handleDuplicate = (slideId) => {
    const source = slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const copy = normalizeSlide(
      {
        ...source,
        id: uid(),
        name: `${source.name || 'Slider'} Kopya`,
        sceneName: source.sceneName || source.name || 'Sahne',
      },
      slides.length
    );
    onUpdate(
      selectActivitySlide(
        { ...activity, slides: [...slides, copy], currentSlideId: copy.id },
        copy.id
      )
    );
  };
  const handleDelete = (slideId) => {
    if (slides.length <= 1) return;
    const sourceSlide = slides.find((slide) => slide.id === slideId);
    const affectedTriggerCount = slides.reduce((total, slide) => {
      const count = (slide.triggers || []).filter(
        (trigger) => trigger?.action === 'SliderGec' && trigger.value === slideId
      ).length;
      return total + count;
    }, 0);
    const confirmMessage = [
      `"${sourceSlide?.sceneName || sourceSlide?.name || 'Sahne'}" sahnesi silinsin mi?`,
      `Toplam ${affectedTriggerCount} adet sahne geçiş tetikleyicisi bu sahneyi hedefliyor.`,
      'Bu tetikleyiciler otomatik olarak onceki/ilk sahneye yonlendirilecek.',
    ].join('\n');
    if (!window.confirm(confirmMessage)) return;

    const nextSlides = slides.filter((slide) => slide.id !== slideId);
    const fallbackSlide =
      nextSlides[Math.max(0, slides.findIndex((slide) => slide.id === slideId) - 1)] ||
      nextSlides[0];
    const fallbackId = fallbackSlide?.id || nextSlides[0]?.id;
    const sanitizedSlides = nextSlides.map((slide) => ({
      ...slide,
      triggers: Array.isArray(slide.triggers)
        ? slide.triggers.map((trigger) =>
            trigger?.action === 'SliderGec' && trigger.value === slideId
              ? { ...trigger, value: fallbackId || '__next__' }
              : trigger
          )
        : [],
    }));
    onUpdate(
      selectActivitySlide(
        { ...activity, slides: sanitizedSlides, currentSlideId: fallbackId },
        fallbackId
      )
    );
  };

  if (vertical) {
    return (
      <div className="eic-slide-strip-vertical">
        <div className="eic-slide-strip-vertical-header">
          <div className="eic-slide-strip-head-row">
            <div className="eic-slide-strip-title">Sahneler</div>
            <button
              onClick={handleAdd}
              className="eic-slide-strip-add-btn"
            >
              +
            </button>
          </div>
          <select
            value={currentSlideId}
            onChange={(event) => handleSelect(event.target.value)}
            className="eic-slide-strip-select"
          >
            {slides.map((slide, index) => (
              <option
                key={slide.id}
                value={slide.id}
              >{`${index + 1} ${slide.sceneName || slide.name || 'İsimsiz Sahne'}`}</option>
            ))}
          </select>
        </div>

        <div className="eic-slide-strip-scroll">
          <div className="eic-slide-strip-list">
            {slides.map((slide, index) => {
              const isActive = slide.id === currentSlideId;
              const slideSummary = getSlideProgressSummary(slide);
              const statusMeta = resolveWorkflowStatusMeta(slideSummary.status);
              return (
                <div
                  key={slide.id}
                  style={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {index > 0 && (
                    <div
                      style={{
                        width: 1,
                        height: 20,
                        background: '#b8c4d2',
                        marginBottom: 8,
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: -4,
                          top: -1,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: '#d9e2ec',
                        }}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleSelect(slide.id)}
                    style={{
                      border: `1px solid ${isActive ? '#5aa4f6' : statusMeta.border}`,
                      background: '#ffffff',
                      padding: 6,
                      cursor: 'pointer',
                      boxShadow: isActive
                        ? '0 0 0 2px rgba(34,139,230,.12)'
                        : '0 1px 2px rgba(15,23,42,.04)',
                      borderRadius: 8,
                      width: 108,
                    }}
                  >
                    <SlideThumbnail slide={slide} isActive={isActive} width={94} height={54} />
                  </button>
                  <div
                    style={{
                      fontSize: 11,
                      color: isActive ? '#2563eb' : '#52667a',
                      marginTop: 6,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 120,
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {`${index + 1}.${slide.name || slide.sceneName || 'İsimsiz'}`}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      marginTop: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: statusMeta.color,
                        background: statusMeta.bg,
                        border: `1px solid ${statusMeta.border}`,
                        borderRadius: 999,
                        padding: '2px 6px',
                        fontWeight: 800,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#475569',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 999,
                        padding: '2px 6px',
                        fontWeight: 800,
                      }}
                    >
                      {slideSummary.quality}%
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDuplicate(slide.id);
                      }}
                      style={{
                        minWidth: 44,
                        height: 22,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                      title="Sahneyi kopyala"
                    >
                      Kopya
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(slide.id);
                      }}
                      disabled={slides.length <= 1}
                      style={{
                        minWidth: 32,
                        height: 22,
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fff5f5',
                        color: slides.length <= 1 ? '#cbd5e1' : '#dc2626',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: slides.length <= 1 ? 'default' : 'pointer',
                      }}
                      title="Sahneyi sil"
                    >
                      ×
                    </button>
                  </div>
                  {index < slides.length - 1 && (
                    <div
                      style={{
                        width: 1,
                        height: 22,
                        background: '#b8c4d2',
                        marginTop: 8,
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: -3,
                          bottom: -4,
                          width: 0,
                          height: 0,
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: '6px solid #b8c4d2',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flexShrink: 0,
        height: '100%',
        minHeight: 0,
        padding: 0,
        borderBottom: vertical ? 'none' : `1px solid ${EDITOR_THEME.shellBorder}`,
        borderRight: vertical ? `1px solid ${EDITOR_THEME.shellBorder}` : 'none',
        background: EDITOR_THEME.shellPanel,
        minWidth: vertical ? '100%' : 'auto',
        width: vertical ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '9px 10px 8px',
          borderBottom: `1px solid ${EDITOR_THEME.shellBorder}`,
          background: EDITOR_THEME.shellBg,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            marginBottom: 6,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: EDITOR_THEME.shellMuted,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Scenes
            </div>
            <div style={{ fontSize: 11, color: EDITOR_THEME.shellMutedSoft, marginTop: 1 }}>
              {slides.length} slide
            </div>
          </div>
          <button
            onClick={handleAdd}
            style={{
              height: 26,
              padding: '0 10px',
              borderRadius: 5,
              border: `1px solid ${EDITOR_THEME.shellAccentBorder}`,
              background: EDITOR_THEME.shellAccentSoft,
              color: '#a5e6ff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Scene
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!vertical && (
            <>
              <button
                onClick={() => setLayoutMode('list')}
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: `1px solid ${effectiveLayoutMode === 'list' ? EDITOR_THEME.shellAccentBorder : EDITOR_THEME.shellBorderSoft}`,
                  background:
                    effectiveLayoutMode === 'list' ? EDITOR_THEME.shellAccentSoft : 'transparent',
                  color: effectiveLayoutMode === 'list' ? '#a5e6ff' : EDITOR_THEME.shellMutedSoft,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ☰
              </button>
              <button
                onClick={() => setLayoutMode('grid')}
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: `1px solid ${effectiveLayoutMode === 'grid' ? EDITOR_THEME.shellAccentBorder : EDITOR_THEME.shellBorderSoft}`,
                  background:
                    effectiveLayoutMode === 'grid' ? EDITOR_THEME.shellAccentSoft : 'transparent',
                  color: effectiveLayoutMode === 'grid' ? '#a5e6ff' : EDITOR_THEME.shellMutedSoft,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ⊞
              </button>
            </>
          )}
          <button
            onClick={() =>
              setThumbZoom((value) => clamp(Number((value - 0.1).toFixed(2)), 0.6, 1.8))
            }
            style={{
              height: 22,
              width: 22,
              borderRadius: 4,
              border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
              background: 'transparent',
              color: EDITOR_THEME.shellMutedSoft,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            −
          </button>
          <span
            style={{
              fontSize: 11,
              color: EDITOR_THEME.shellMutedSoft,
              minWidth: 28,
              textAlign: 'center',
            }}
          >
            {Math.round(thumbZoom * 100)}%
          </span>
          <button
            onClick={() =>
              setThumbZoom((value) => clamp(Number((value + 0.1).toFixed(2)), 0.6, 1.8))
            }
            style={{
              height: 22,
              width: 22,
              borderRadius: 4,
              border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
              background: 'transparent',
              color: EDITOR_THEME.shellMutedSoft,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* ── Slide list ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '6px 6px 10px',
          touchAction: vertical ? 'pan-y' : 'pan-x pan-y',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {slides.map((slide, index) => {
            const isActive = slide.id === currentSlideId;
            const slideSummary = getSlideProgressSummary(slide);
            const statusMeta = resolveWorkflowStatusMeta(slideSummary.status);
            const outgoingLinks = outgoing[slide.id] || [];
            return (
              <div
                key={slide.id}
                onClick={() => handleSelect(slide.id)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  borderRadius: 6,
                  border: `1px solid ${isActive ? EDITOR_THEME.shellAccentBorder : statusMeta.border}`,
                  background: isActive ? EDITOR_THEME.shellAccentSoft : 'rgba(255,255,255,.03)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  borderLeft: `3px solid ${isActive ? EDITOR_THEME.shellAccent : statusMeta.color}`,
                  transition: 'background .12s, border-color .12s',
                }}
              >
                {/* Thumbnail full-width */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    background: EDITOR_THEME.shellInset,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <SlideThumbnail
                    slide={slide}
                    isActive={isActive}
                    width={thumbWidth}
                    height={thumbHeight}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      background: isActive ? EDITOR_THEME.shellAccent : 'rgba(0,0,0,.55)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 3,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 3 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(slide.id);
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        border: 'none',
                        background: 'rgba(0,0,0,.55)',
                        color: 'rgba(255,255,255,.7)',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Kopyala"
                    >
                      ⧉
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(slide.id);
                      }}
                      disabled={slides.length <= 1}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 3,
                        border: 'none',
                        background: 'rgba(0,0,0,.55)',
                        color: slides.length <= 1 ? 'rgba(255,255,255,.2)' : 'rgba(239,68,68,.9)',
                        fontSize: 12,
                        cursor: slides.length <= 1 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Sil"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Info row */}
                <div style={{ padding: '5px 7px 6px' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isActive ? '#d7f1ff' : EDITOR_THEME.shellMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 3,
                    }}
                  >
                    {slide.sceneName || slide.name || `Sahne ${index + 1}`}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: statusMeta.color,
                        background: statusMeta.bg,
                        border: `1px solid ${statusMeta.border}`,
                        padding: '1px 5px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        fontWeight: 800,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#cbd5f5',
                        background: 'rgba(255,255,255,.08)',
                        border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
                        padding: '1px 5px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        fontWeight: 800,
                      }}
                    >
                      {slideSummary.quality}% hazir
                    </span>
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: EDITOR_THEME.shellMutedSoft,
                        background: 'rgba(255,255,255,.06)',
                        border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
                        padding: '1px 5px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {slide.objects?.length || 0} nesne
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: EDITOR_THEME.shellMutedSoft,
                        background: 'rgba(255,255,255,.06)',
                        border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
                        padding: '1px 5px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {slide.timeline?.length || 0} klip
                    </span>
                    {slideSummary.triggerCount > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#fca5a5',
                          background: 'rgba(127,29,29,.24)',
                          border: '1px solid rgba(248,113,113,.36)',
                          padding: '1px 5px',
                          borderRadius: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {slideSummary.triggerCount} trigger
                      </span>
                    )}
                    {outgoingLinks.length > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#7dd3fc',
                          background: EDITOR_THEME.shellAccentSoft,
                          border: `1px solid ${EDITOR_THEME.shellAccentBorder}`,
                          padding: '1px 5px',
                          borderRadius: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {outgoingLinks.length} bağ
                      </span>
                    )}
                  </div>

                  {/* Transition controls */}
                  <div
                    style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'center' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={slide.slideTransitionEffect || 'fade'}
                      onChange={(event) => {
                        const nextSlides = slides.map((item) =>
                          item.id === slide.id
                            ? { ...item, slideTransitionEffect: event.target.value }
                            : item
                        );
                        onUpdate(
                          selectActivitySlide(
                            { ...activity, slides: nextSlides, currentSlideId: slide.id },
                            slide.id
                          )
                        );
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: 22,
                        borderRadius: 4,
                        border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
                        background: EDITOR_THEME.shellInset,
                        color: EDITOR_THEME.shellMuted,
                        fontSize: 11,
                        padding: '0 4px',
                      }}
                    >
                      {SLIDE_TRANSITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={2.5}
                      step={0.05}
                      value={slide.slideTransitionDuration ?? 0.45}
                      onChange={(event) => {
                        const nextSlides = slides.map((item) =>
                          item.id === slide.id
                            ? {
                                ...item,
                                slideTransitionDuration: Math.min(
                                  2.5,
                                  Math.max(0, Number(event.target.value) || 0)
                                ),
                              }
                            : item
                        );
                        onUpdate(
                          selectActivitySlide(
                            { ...activity, slides: nextSlides, currentSlideId: slide.id },
                            slide.id
                          )
                        );
                      }}
                      style={{
                        width: 42,
                        height: 22,
                        borderRadius: 4,
                        border: `1px solid ${EDITOR_THEME.shellBorderSoft}`,
                        background: EDITOR_THEME.shellInset,
                        color: EDITOR_THEME.shellMuted,
                        fontSize: 11,
                        padding: '0 4px',
                        textAlign: 'center',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
