import { useMemo, useState } from 'react';

import { SlideThumbnail } from '../../../components/SlideStrip';
import { getActivitySlides, selectActivitySlide } from '../../../logic/activityHelpers';
import { createSlide } from '../../../logic/factories';
import { normalizeSlide } from '../../../logic/slideNormalization';
import { clamp, uid } from '../../../utils/editorHelpers';

import ActiveLayerSummary from './ActiveLayerSummary';
import ActivityStructureTree from './ActivityStructureTree';

const railItems = [
  { id: 'map', label: 'Harita', glyph: '▥' },
  { id: 'add', label: 'Ekle', glyph: '+' },
  { id: 'layers', label: 'Layer', glyph: '▤' },
  { id: 'media', label: 'Medya', glyph: '▧' },
  { id: 'warn', label: 'Uyarı', glyph: '!' },
];

function RailButton({ active, item, onClick }) {
  return (
    <button
      type="button"
      title={item.label}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        border: `1px solid ${active ? '#bfdbfe' : '#d8e2ef'}`,
        background: active ? '#eef6ff' : '#ffffff',
        color: active ? '#1d4ed8' : '#64748b',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: item.id === 'add' ? 18 : 13,
        fontWeight: 900,
      }}
    >
      {item.glyph}
    </button>
  );
}

function TinyButton({ children, disabled = false, onClick, title }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        height: 22,
        minWidth: 22,
        borderRadius: 6,
        border: '1px solid #cfe0f4',
        background: disabled ? '#f8fafc' : '#ffffff',
        color: disabled ? '#cbd5e1' : '#2563eb',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
        padding: '0 6px',
      }}
    >
      {children}
    </button>
  );
}

function WorkspaceWarnings({ activity }) {
  const warnings = useMemo(() => {
    if (!activity) return [];
    const list = [];
    const objects = activity.objects || [];
    const correctLayer = objects.some((item) => /correct/i.test(item.layerId || item.label || ''));
    const triggers = activity.triggers || [];

    if (objects.some((item) => item.visible === false && item.locked)) {
      list.push({ tone: '#f59e0b', text: 'Gizli ve kilitli nesneler var.' });
    }
    if (activity.type === 'drag-drop' && !Object.keys(activity.dragDropMatches || {}).length) {
      list.push({ tone: '#2563eb', text: 'Sürükle-bırak eşleşmeleri tanımlanmamış.' });
    }
    if (!triggers.length) {
      list.push({ tone: '#2563eb', text: 'Bu sahnede trigger tanımlanmamış.' });
    }
    if (!correctLayer && ['selection', 'drag-drop', 'mixed'].includes(activity.type)) {
      list.push({ tone: '#f97316', text: 'Correct layer boş görünüyor.' });
    }
    return list.slice(0, 3);
  }, [activity]);

  return (
    <div style={{ borderTop: '1px solid #e5edf6', paddingTop: 9 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: '#64748b',
          letterSpacing: 0.45,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Hatalar / Uyarılar
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {warnings.map((item) => (
          <div
            key={item.text}
            style={{
              display: 'grid',
              gridTemplateColumns: '16px 1fr auto',
              alignItems: 'center',
              gap: 6,
              color: '#334155',
              fontSize: 10.5,
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: item.tone, fontWeight: 900 }}>!</span>
            <span>{item.text}</span>
            <span
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: `${item.tone}18`,
                color: item.tone,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              1
            </span>
          </div>
        ))}
        {!warnings.length && (
          <div style={{ color: '#16a34a', fontSize: 10.5, fontWeight: 800 }}>
            Kritik uyarı görünmüyor.
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivityMapPanel({
  activity,
  activities,
  currentBook,
  onSelectActivity,
  onSelectionChange,
  onUpdateActivity,
  selectedIds,
}) {
  const [activeRail, setActiveRail] = useState('map');
  const [query, setQuery] = useState('');
  const slides = getActivitySlides(activity || {});
  const currentSlideId = activity?.currentSlideId || slides[0]?.id || '';
  const currentSlideIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === currentSlideId)
  );

  const selectSlide = (slideId) => {
    if (!activity || !slideId) return;
    onUpdateActivity?.(selectActivitySlide(activity, slideId));
  };

  const addSlide = () => {
    if (!activity) return;
    const nextSlide = createSlide(`Slider ${slides.length + 1}`, slides.length);
    onUpdateActivity?.(
      selectActivitySlide(
        { ...activity, slides: [...slides, nextSlide], currentSlideId: nextSlide.id },
        nextSlide.id
      )
    );
  };

  const duplicateSlide = () => {
    if (!activity) return;
    const source = slides[currentSlideIndex] || slides[0];
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
    onUpdateActivity?.(
      selectActivitySlide(
        { ...activity, slides: [...slides, copy], currentSlideId: copy.id },
        copy.id
      )
    );
  };

  const deleteSlide = () => {
    if (!activity || slides.length <= 1) return;
    const nextSlides = slides
      .filter((slide) => slide.id !== currentSlideId)
      .map((slide, index) => normalizeSlide(slide, index));
    onUpdateActivity?.(selectActivitySlide({ ...activity, slides: nextSlides }, nextSlides[0]?.id));
  };

  const moveSlide = (direction) => {
    if (!activity) return;
    const nextIndex = clamp(currentSlideIndex + direction, 0, slides.length - 1);
    if (nextIndex === currentSlideIndex) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(currentSlideIndex, 1);
    nextSlides.splice(nextIndex, 0, moved);
    onUpdateActivity?.(
      selectActivitySlide(
        { ...activity, slides: nextSlides.map((slide, index) => normalizeSlide(slide, index)) },
        currentSlideId
      )
    );
  };

  const filteredSlides = slides.filter((slide) => {
    const haystack = `${slide.name || ''} ${slide.sceneName || ''}`.toLocaleLowerCase('tr-TR');
    return !query.trim() || haystack.includes(query.trim().toLocaleLowerCase('tr-TR'));
  });

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '42px minmax(0, 1fr)',
        background: '#f7faff',
        color: '#172033',
      }}
    >
      <div
        style={{
          borderRight: '1px solid #d8e2ef',
          background: '#f2f6fb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '10px 5px',
        }}
      >
        {railItems.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            active={activeRail === item.id}
            onClick={() => {
              setActiveRail(item.id);
              if (item.id === 'add') addSlide();
            }}
          />
        ))}
      </div>

      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
        }}
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #e5edf6' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 9,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: '#172033',
                letterSpacing: 0.2,
              }}
            >
              ETKİNLİK HARİTASI
            </div>
            <TinyButton title="Yeni slide" onClick={addSlide}>
              +
            </TinyButton>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara (etkinlik, katman...)"
            style={{
              width: '100%',
              height: 28,
              border: '1px solid #d8e2ef',
              borderRadius: 7,
              background: '#ffffff',
              color: '#172033',
              fontSize: 10.5,
              padding: '0 9px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <ActivityStructureTree
            activity={activity}
            activities={activities}
            currentBook={currentBook}
            onSelectActivity={onSelectActivity}
            onSelectSlide={selectSlide}
          />

          <div style={{ borderTop: '1px solid #e5edf6', paddingTop: 9 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 7,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#64748b',
                  letterSpacing: 0.45,
                  textTransform: 'uppercase',
                }}
              >
                Slide Listesi
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <TinyButton disabled={currentSlideIndex <= 0} onClick={() => moveSlide(-1)}>
                  ↑
                </TinyButton>
                <TinyButton
                  disabled={currentSlideIndex >= slides.length - 1}
                  onClick={() => moveSlide(1)}
                >
                  ↓
                </TinyButton>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredSlides.map((slide, index) => {
                const realIndex = slides.findIndex((item) => item.id === slide.id);
                const isActive = slide.id === currentSlideId;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => selectSlide(slide.id)}
                    style={{
                      width: '100%',
                      border: `1px solid ${isActive ? '#38bdf8' : '#d8e2ef'}`,
                      background: isActive ? '#eefbff' : '#ffffff',
                      borderRadius: 8,
                      padding: 5,
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr',
                      gap: 8,
                      alignItems: 'center',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isActive ? '0 0 0 2px rgba(56,189,248,.16)' : 'none',
                    }}
                  >
                    <SlideThumbnail slide={slide} width={68} height={38} showBadges={false} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          color: '#172033',
                          fontSize: 10.5,
                          fontWeight: 900,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Slide {realIndex + 1}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          color: '#64748b',
                          fontSize: 10,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}
                      >
                        {slide.name || slide.sceneName || `Slider ${index + 1}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 7 }}>
              <TinyButton onClick={duplicateSlide}>Çoğalt</TinyButton>
              <TinyButton disabled={slides.length <= 1} onClick={deleteSlide}>
                Sil
              </TinyButton>
            </div>
          </div>

          <ActiveLayerSummary
            activity={activity}
            onSelectionChange={onSelectionChange}
            onUpdateActivity={onUpdateActivity}
            selectedIds={selectedIds}
          />

          <WorkspaceWarnings activity={activity} />
        </div>
      </div>
    </div>
  );
}
