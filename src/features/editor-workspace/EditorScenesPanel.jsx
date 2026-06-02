import { useState, useRef } from 'react';

import { SlideThumbnail } from '../../components/SlideStrip';
import { uid, clamp } from '../../utils/editorHelpers';

// Sahne (slide) listesini gösteren ve sürükle-bırak ile sıralayan panel.
// Yardımcı fonksiyonlar (getActivitySlides, selectActivitySlide, createSlide,
// normalizeSlide) prop olarak dışarıdan geçirilir; davranış değişmedi.
function EditorScenesPanel({
  activity,
  onUpdateActivity,
  getActivitySlides,
  selectActivitySlide,
  createSlide,
  normalizeSlide,
}) {
  const slides = getActivitySlides(activity || {});
  const currentSlideId = activity?.currentSlideId || slides[0]?.id || '';
  const currentSlideIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === currentSlideId)
  );
  const isMainScene = currentSlideIndex === 0;
  const canMoveUp = currentSlideIndex > 0;
  const canMoveDown = currentSlideIndex >= 0 && currentSlideIndex < slides.length - 1;
  const [dragSceneId, setDragSceneId] = useState('');
  const [dragOverSceneId, setDragOverSceneId] = useState('');
  const dragSceneIdRef = useRef('');

  const handleSelectSlide = (slideId) => {
    if (!activity || !slideId) return;
    onUpdateActivity(selectActivitySlide(activity, slideId));
  };

  const handleAddSlide = () => {
    if (!activity) return;
    const newSlide = createSlide(`Sahne ${slides.length + 1}`, slides.length);
    onUpdateActivity(
      selectActivitySlide(
        { ...activity, slides: [...slides, newSlide], currentSlideId: newSlide.id },
        newSlide.id
      )
    );
  };

  const handleDuplicateSlide = (slideId) => {
    if (!activity) return;
    const source = slides.find((slide) => slide.id === slideId);
    if (!source) return;
    const copy = normalizeSlide(
      {
        ...source,
        id: uid(),
        name: `${source.name || 'Sahne'} Kopya`,
        sceneName: source.sceneName || source.name || 'Sahne',
      },
      slides.length
    );
    onUpdateActivity(
      selectActivitySlide(
        { ...activity, slides: [...slides, copy], currentSlideId: copy.id },
        copy.id
      )
    );
  };

  const handleDeleteSlide = (slideId) => {
    if (!activity || slides.length <= 1) return;
    const nextSlides = slides.filter((slide) => slide.id !== slideId);
    const fallbackSlide =
      nextSlides[Math.max(0, slides.findIndex((slide) => slide.id === slideId) - 1)] ||
      nextSlides[0];
    const fallbackId = fallbackSlide?.id || nextSlides[0]?.id || '';
    onUpdateActivity(
      selectActivitySlide(
        { ...activity, slides: nextSlides, currentSlideId: fallbackId },
        fallbackId
      )
    );
  };

  const reorderSlides = (slideId, targetIndex) => {
    if (!activity || !slideId) return;
    const fromIndex = slides.findIndex((slide) => slide.id === slideId);
    const toIndex = clamp(Number(targetIndex), 0, Math.max(0, slides.length - 1));
    if (fromIndex < 0 || fromIndex === toIndex) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    onUpdateActivity(
      selectActivitySlide({ ...activity, slides: nextSlides, currentSlideId: slideId }, slideId)
    );
  };

  const startSceneDrag = (event, slideId) => {
    dragSceneIdRef.current = slideId;
    setDragSceneId(slideId);
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', slideId);
    }
  };

  const clearSceneDrag = () => {
    dragSceneIdRef.current = '';
    setDragSceneId('');
    setDragOverSceneId('');
  };

  const handleSceneDrop = (event, targetSlideId) => {
    event?.preventDefault?.();
    const sourceSlideId =
      dragSceneIdRef.current || event?.dataTransfer?.getData?.('text/plain') || dragSceneId;
    if (!sourceSlideId || !targetSlideId || sourceSlideId === targetSlideId) {
      clearSceneDrag();
      setDragSceneId('');
      setDragOverSceneId('');
      return;
    }
    const targetIndex = slides.findIndex((item) => item.id === targetSlideId);
    if (targetIndex >= 0) reorderSlides(sourceSlideId, targetIndex);
    clearSceneDrag();
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        background: '#eef2f6',
        display: 'flex',
        flexDirection: 'column',
        color: '#334155',
      }}
    >
      <div
        style={{
          padding: '7px 8px 6px',
          borderBottom: '1px solid #d2dbe6',
          background: '#f6f8fb',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 5,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Sahneler</div>
          <div style={{ width: 16, height: 16, position: 'relative', opacity: 0.5 }}>
            <span
              style={{
                position: 'absolute',
                right: 2,
                top: 2,
                width: 9,
                height: 8,
                border: '1px solid #64748b',
                background: '#f8fafc',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 3,
                bottom: 3,
                width: 9,
                height: 8,
                border: '1px solid #64748b',
                background: '#f8fafc',
              }}
            />
          </div>
        </div>
        <select
          value={currentSlideId}
          onChange={(event) => handleSelectSlide(event.target.value)}
          style={{
            width: '100%',
            height: 24,
            border: '1px solid #c8d2dd',
            background: '#ffffff',
            color: '#425466',
            fontSize: 10,
            padding: '0 7px',
            outline: 'none',
          }}
        >
          {slides.map((item, index) => (
            <option
              key={item.id}
              value={item.id}
            >{`${index + 1} ${item.name || item.sceneName || 'İsimsiz Sahne'}`}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 3, marginTop: 5, overflowX: 'auto', paddingBottom: 1 }}>
          {slides.map((item, index) => {
            const isActiveScene = item.id === currentSlideId;
            const isDragOver =
              dragOverSceneId === item.id && dragSceneId && dragSceneId !== item.id;
            return (
              <button
                key={item.id}
                draggable
                onDragStart={(event) => startSceneDrag(event, item.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSceneId(item.id);
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={() =>
                  setDragOverSceneId((current) => (current === item.id ? '' : current))
                }
                onDrop={(event) => handleSceneDrop(event, item.id)}
                onDragEnd={clearSceneDrag}
                onClick={() => handleSelectSlide(item.id)}
                title={`${index + 1}. ${item.name || item.sceneName || 'İsimsiz Sahne'} - sürükleyip sırala`}
                style={{
                  flex: '0 0 auto',
                  minWidth: 24,
                  height: 18,
                  borderRadius: 3,
                  border: `1px solid ${isDragOver ? '#f97316' : isActiveScene ? '#60a5fa' : '#c8d2dd'}`,
                  background: isActiveScene ? '#e0f2fe' : '#ffffff',
                  color: isActiveScene ? '#075985' : '#475569',
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'grab',
                  boxShadow: isDragOver ? '0 0 0 2px rgba(249,115,22,.14)' : 'none',
                }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 22px 22px 22px',
            gap: 3,
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <button
            onClick={() => reorderSlides(currentSlideId, 0)}
            disabled={isMainScene || !activity}
            style={{
              height: 20,
              borderRadius: 3,
              border: `1px solid ${isMainScene ? '#bbf7d0' : '#bfdbfe'}`,
              background: isMainScene ? '#f0fdf4' : '#eff6ff',
              color: isMainScene ? '#15803d' : '#1d4ed8',
              fontSize: 9,
              fontWeight: 800,
              cursor: isMainScene || !activity ? 'default' : 'pointer',
              lineHeight: 1.05,
            }}
          >
            {isMainScene ? 'Ana' : 'Ana Yap'}
          </button>
          <button
            onClick={() => reorderSlides(currentSlideId, currentSlideIndex - 1)}
            disabled={!canMoveUp}
            title="Scene yukarı taşı"
            style={{
              height: 20,
              borderRadius: 3,
              border: '1px solid #c8d2dd',
              background: '#ffffff',
              color: canMoveUp ? '#475569' : '#cbd5e1',
              fontSize: 10,
              fontWeight: 900,
              cursor: canMoveUp ? 'pointer' : 'default',
            }}
          >
            ↑
          </button>
          <button
            onClick={() => reorderSlides(currentSlideId, currentSlideIndex + 1)}
            disabled={!canMoveDown}
            title="Scene aşağı taşı"
            style={{
              height: 20,
              borderRadius: 3,
              border: '1px solid #c8d2dd',
              background: '#ffffff',
              color: canMoveDown ? '#475569' : '#cbd5e1',
              fontSize: 10,
              fontWeight: 900,
              cursor: canMoveDown ? 'pointer' : 'default',
            }}
          >
            ↓
          </button>
          <button
            onClick={handleAddSlide}
            title="Slide ekle"
            style={{
              height: 20,
              borderRadius: 3,
              border: '1px solid #c8d2dd',
              background: '#ffffff',
              color: '#475569',
              fontSize: 12,
              lineHeight: 1,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 8px 22px',
          background: '#eef2f6',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            position: 'relative',
          }}
        >
          {slides.map((slide, index) => {
            const isActive = slide.id === currentSlideId;
            const isDragOver =
              dragOverSceneId === slide.id && dragSceneId && dragSceneId !== slide.id;
            return (
              <div
                key={slide.id}
                draggable
                onDragStart={(event) => startSceneDrag(event, slide.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSceneId(slide.id);
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={() =>
                  setDragOverSceneId((current) => (current === slide.id ? '' : current))
                }
                onDrop={(event) => handleSceneDrop(event, slide.id)}
                onDragEnd={clearSceneDrag}
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  minWidth: 0,
                  cursor: 'grab',
                  opacity: dragSceneId === slide.id ? 0.58 : 1,
                }}
              >
                {index > 0 && (
                  <div
                    style={{
                      width: 1,
                      height: 12,
                      marginBottom: 5,
                      background: '#9fb0c3',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: -3,
                        bottom: -4,
                        width: 0,
                        height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: '6px solid #9fb0c3',
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={() => handleSelectSlide(slide.id)}
                  style={{
                    width: 98,
                    height: 58,
                    padding: 3,
                    border: `1px solid ${isDragOver ? '#f97316' : isActive ? '#38bdf8' : '#c7d0db'}`,
                    background: '#ffffff',
                    borderRadius: 7,
                    cursor: 'pointer',
                    boxShadow: isDragOver
                      ? '0 0 0 3px rgba(249,115,22,.18), 0 4px 10px rgba(15,23,42,.12)'
                      : isActive
                        ? '0 0 0 2px rgba(14,165,233,.26), 0 5px 14px rgba(14,165,233,.18)'
                        : '0 2px 6px rgba(15,23,42,.10)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <SlideThumbnail
                    slide={slide}
                    isActive={false}
                    width={90}
                    height={51}
                    showBadges={false}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      minWidth: 16,
                      height: 14,
                      borderRadius: 4,
                      background: isActive ? '#0284c7' : 'rgba(15,23,42,.62)',
                      color: '#ffffff',
                      fontSize: 9,
                      fontWeight: 900,
                      lineHeight: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {index + 1}
                  </span>
                </button>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 132,
                    marginTop: 5,
                    fontSize: 10,
                    color: isActive ? '#0f172a' : '#475569',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: isActive ? 800 : 600,
                    lineHeight: 1.15,
                  }}
                >
                  {`1.${index + 1} ${slide.name || slide.sceneName || 'İsimsiz Sahne'}`}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    onClick={() => handleDuplicateSlide(slide.id)}
                    title="Slide kopyala"
                    style={{
                      width: 19,
                      height: 17,
                      borderRadius: 3,
                      border: '1px solid #d2dbe6',
                      background: '#ffffff',
                      color: '#64748b',
                      fontSize: 9,
                      cursor: 'pointer',
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    onClick={() => handleDeleteSlide(slide.id)}
                    disabled={slides.length <= 1}
                    title="Slide sil"
                    style={{
                      width: 19,
                      height: 17,
                      borderRadius: 3,
                      border: '1px solid #fecaca',
                      background: '#ffffff',
                      color: slides.length <= 1 ? '#cbd5e1' : '#dc2626',
                      fontSize: 11,
                      cursor: slides.length <= 1 ? 'default' : 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EditorScenesPanel;
