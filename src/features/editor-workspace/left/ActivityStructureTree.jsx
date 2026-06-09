import { useMemo, useState } from 'react';

import { SlideThumbnail } from '../../../components/SlideStrip';
import { getActivitySlides } from '../../../logic/activityHelpers';

import { IconButton, InlineRename, SectionHeader, mapChrome } from './ActivityMapPrimitives';

function safeLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const lower = text.toLocaleLowerCase('tr-TR');
  if (['undefined', 'null', 'nan'].includes(lower)) return '';
  if (/^\d+$/.test(text)) return '';
  if (/^[a-z0-9_-]{8,}$/i.test(text) && !/\s/.test(text)) return '';
  if (/^slider\s*\d+$/i.test(text)) return '';
  if (text.length <= 2) return '';
  return text;
}

export function getSlideDisplayName(slide, index = 0) {
  return safeLabel(slide?.sceneName) || safeLabel(slide?.name) || `Slide ${index + 1}`;
}

export default function ActivityStructureTree({
  activity,
  onAddSlide,
  onCopySlide,
  onDeleteSlide,
  onDuplicateSlide,
  onMoveSlide,
  onPasteSlide,
  onRenameActivity,
  onRenameSlide,
  onSelectSlide,
  query = '',
}) {
  const [editingActivityKey, setEditingActivityKey] = useState(0);
  const [editingSlideId, setEditingSlideId] = useState('');
  const [editingSlideKey, setEditingSlideKey] = useState(0);
  const slides = getActivitySlides(activity || {});
  const currentSlideId = activity?.currentSlideId || slides[0]?.id || '';
  const currentSlideIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === currentSlideId)
  );
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
  const filteredSlides = useMemo(
    () =>
      slides.filter((slide, index) => {
        if (!normalizedQuery) return true;
        return getSlideDisplayName(slide, index)
          .toLocaleLowerCase('tr-TR')
          .includes(normalizedQuery);
      }),
    [normalizedQuery, slides]
  );
  const activityLabel =
    safeLabel(activity?.name) ||
    safeLabel(activity?.sceneName) ||
    (slides.length
      ? getSlideDisplayName(slides.find((slide) => slide.id === currentSlideId) || slides[0], 0)
      : '') ||
    'Etkinlik';

  return (
    <section
      style={{
        border: `1px solid ${mapChrome.border}`,
        borderRadius: 9,
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        padding: 9,
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      <SectionHeader
        title="Sahneler"
        action={
          <div
            style={{
              display: 'inline-flex',
              gap: 3,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <IconButton icon="add" label="Yeni sahne" onClick={onAddSlide} />
            <IconButton icon="copy" label="Sahne çoğalt" onClick={onDuplicateSlide} />
            <IconButton icon="copy" label="Sahneyi kopyala" onClick={onCopySlide} />
            <IconButton icon="add" label="Sahneyi yapıştır" onClick={onPasteSlide} />
            <IconButton
              disabled={currentSlideIndex <= 0}
              icon="up"
              label="Yukarı taşı"
              onClick={() => onMoveSlide?.(-1)}
            />
            <IconButton
              disabled={currentSlideIndex >= slides.length - 1}
              icon="down"
              label="Aşağı taşı"
              onClick={() => onMoveSlide?.(1)}
            />
            <IconButton
              disabled={slides.length <= 1}
              icon="delete"
              label="Sahne sil"
              onClick={() => onDeleteSlide?.()}
              tone={mapChrome.danger}
            />
          </div>
        }
      />

      {activityLabel ? (
        <div
          onDoubleClick={() => setEditingActivityKey((value) => value + 1)}
          style={{
            minHeight: 24,
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr)',
            alignItems: 'center',
            border: `1px solid ${mapChrome.borderSoft}`,
            borderRadius: 7,
            background: '#fbfdff',
            padding: '3px 7px',
          }}
        >
          <InlineRename
            displayValue={activityLabel}
            editKey={editingActivityKey}
            onCommit={(value) => {
              if (value) onRenameActivity?.(value);
            }}
            placeholder="Etkinlik"
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filteredSlides.map((slide) => {
          const index = slides.findIndex((item) => item.id === slide.id);
          const isCurrent = slide.id === currentSlideId;
          const displayName = getSlideDisplayName(slide, index);
          return (
            <div
              key={slide.id}
              data-slide-tree-item="true"
              role="button"
              tabIndex={0}
              onClick={() => onSelectSlide?.(slide.id)}
              onDoubleClick={() => {
                setEditingSlideId(slide.id);
                setEditingSlideKey((value) => value + 1);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectSlide?.(slide.id);
                }
                if (event.key === 'F2') {
                  event.preventDefault();
                  setEditingSlideId(slide.id);
                  setEditingSlideKey((value) => value + 1);
                }
                if (event.key === 'Delete' || event.key === 'Backspace') {
                  // Slayt ağacına odaklıyken Delete bu slaytı siler; global canvas
                  // silme işleyicisine düşmemesi için propagasyonu durdururuz.
                  event.preventDefault();
                  event.stopPropagation();
                  if (slides.length > 1) onDeleteSlide?.(slide.id);
                }
              }}
              style={{
                width: '100%',
                border: `1px solid ${isCurrent ? '#4f46e5' : mapChrome.borderSoft}`,
                borderRadius: 8,
                background: isCurrent ? '#eef2ff' : '#ffffff',
                color: mapChrome.text,
                cursor: 'pointer',
                padding: 5,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                textAlign: 'left',
                boxShadow: isCurrent ? '0 0 0 1px rgba(79,70,229,.16)' : 'none',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  alignSelf: 'center',
                  width: 128,
                  maxWidth: '100%',
                }}
              >
                <SlideThumbnail
                  slide={slide}
                  isActive={isCurrent}
                  width={128}
                  height={72}
                  showBadges={false}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: 5,
                    top: 5,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 5,
                    background: isCurrent ? '#4f46e5' : '#94a3b8',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 950,
                    lineHeight: 1,
                  }}
                >
                  {index + 1}
                </span>
              </div>
              <InlineRename
                active={isCurrent}
                displayValue={displayName}
                editKey={editingSlideId === slide.id ? editingSlideKey : 0}
                onCommit={(value) => {
                  if (value) onRenameSlide?.(slide.id, value);
                  setEditingSlideId('');
                }}
                onCancel={() => setEditingSlideId('')}
                placeholder={`Slide ${index + 1}`}
              />
            </div>
          );
        })}

        {!filteredSlides.length && (
          <div
            style={{
              border: `1px dashed ${mapChrome.border}`,
              borderRadius: 7,
              background: mapChrome.panelSoft,
              color: mapChrome.muted,
              fontSize: 11,
              fontWeight: 760,
              padding: '10px 8px',
              textAlign: 'center',
            }}
          >
            Arama ile eşleşen slide yok.
          </div>
        )}
      </div>
    </section>
  );
}
