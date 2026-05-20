import { useState } from 'react';

import { getActivitySlides } from '../../../logic/activityHelpers';

function TreeIcon({ children, tone = '#64748b' }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        border: '1px solid #d7e2ef',
        background: '#ffffff',
        color: tone,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 900,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

export default function ActivityStructureTree({
  activity,
  activities = [],
  currentBook,
  onSelectActivity,
  onSelectSlide,
}) {
  const [expanded, setExpanded] = useState(() => new Set(['book', activity?.id].filter(Boolean)));
  const bookActivities = activities.filter((item) =>
    currentBook?.id ? item.bookId === currentBook.id : item.id === activity?.id
  );

  const toggle = (id) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: '#64748b',
          letterSpacing: 0.45,
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        Etkinlik Yapısı
      </div>
      <button
        type="button"
        onClick={() => toggle('book')}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#172033',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 24,
          padding: '2px 3px',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 11,
          fontWeight: 850,
        }}
      >
        <span style={{ width: 12, color: '#64748b' }}>{expanded.has('book') ? '▾' : '▸'}</span>
        <TreeIcon tone="#2563eb">⌂</TreeIcon>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentBook?.name || 'Kitap'}
        </span>
      </button>

      {expanded.has('book') &&
        bookActivities.map((item) => {
          const slides = getActivitySlides(item);
          const isActiveActivity = item.id === activity?.id;
          const isOpen = expanded.has(item.id) || isActiveActivity;
          return (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof onSelectActivity === 'function') onSelectActivity(item.id);
                  toggle(item.id);
                }}
                style={{
                  border: 'none',
                  background: isActiveActivity ? '#eaf2ff' : 'transparent',
                  color: isActiveActivity ? '#174ea6' : '#172033',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  minHeight: 25,
                  padding: '2px 4px 2px 13px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 850,
                }}
              >
                <span style={{ width: 12, color: '#64748b' }}>{isOpen ? '▾' : '▸'}</span>
                <TreeIcon tone={isActiveActivity ? '#16a34a' : '#64748b'}>●</TreeIcon>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name || 'Etkinlik'}
                </span>
              </button>

              {isOpen &&
                slides.map((slide, index) => {
                  const isCurrent = isActiveActivity && slide.id === activity?.currentSlideId;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => isActiveActivity && onSelectSlide?.(slide.id)}
                      disabled={!isActiveActivity}
                      style={{
                        border: 'none',
                        background: isCurrent ? '#dbeafe' : 'transparent',
                        color: isCurrent ? '#1d4ed8' : '#334155',
                        display: 'grid',
                        gridTemplateColumns: '18px 1fr',
                        alignItems: 'center',
                        gap: 7,
                        minHeight: 23,
                        padding: '2px 5px 2px 43px',
                        borderRadius: 6,
                        cursor: isActiveActivity ? 'pointer' : 'default',
                        textAlign: 'left',
                        opacity: isActiveActivity ? 1 : 0.55,
                      }}
                    >
                      <TreeIcon tone={isCurrent ? '#1d4ed8' : '#64748b'}>{index + 1}</TreeIcon>
                      <span
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 10.5,
                          fontWeight: isCurrent ? 850 : 700,
                        }}
                      >
                        {slide.name || slide.sceneName || `Slide ${index + 1}`}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
    </div>
  );
}
