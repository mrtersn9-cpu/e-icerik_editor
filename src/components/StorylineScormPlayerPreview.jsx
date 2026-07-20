import { useEffect, useMemo, useState } from 'react';

import { normalizeActivityForRuntimeSnapshot, createPreviewHtmlSignature } from '../logic/editorState/stateNormalize';
import { buildStorylinePlayerHtml } from '../utils/scormExport';
export default function StorylineScormPlayerPreview({
  open,
  onClose,
  activity,
  activities = [],
  variables = [],
  snapshotState = null,
}) {
  const previewActivities = useMemo(() => {
    const snapshotActivities =
      Array.isArray(snapshotState?.activities) && snapshotState.activities.length
        ? snapshotState.activities
        : null;
    const source =
      snapshotActivities ||
      (Array.isArray(activities) && activities.length ? activities : activity ? [activity] : []);
    return source.filter(Boolean).map((item) => normalizeActivityForRuntimeSnapshot(item));
  }, [activities, activity, snapshotState]);
  const snapshotVariables = snapshotState?.variables || variables;
  const [selectedActivityId, setSelectedActivityId] = useState(
    () => snapshotState?.selActId || activity?.id || previewActivities[0]?.id || ''
  );

  useEffect(() => {
    if (!open) return;
    const preferredId = snapshotState?.selActId || activity?.id || previewActivities[0]?.id || '';
    if (!preferredId) return;
    if (
      selectedActivityId !== preferredId &&
      previewActivities.some((item) => item.id === preferredId)
    ) {
      setSelectedActivityId(preferredId);
      return;
    }
    if (!previewActivities.some((item) => item.id === selectedActivityId)) {
      setSelectedActivityId(preferredId);
    }
  }, [activity?.id, open, previewActivities, selectedActivityId, snapshotState?.selActId]);

  const selectedActivity =
    previewActivities.find((item) => item.id === selectedActivityId) ||
    previewActivities[0] ||
    null;
  const previewState = useMemo(
    () => ({
      activities: previewActivities,
      selActId: selectedActivity?.id || '',
      variables: snapshotVariables,
    }),
    [previewActivities, selectedActivity?.id, snapshotVariables]
  );
  const playerHtml = useMemo(
    () =>
      selectedActivity
        ? buildStorylinePlayerHtml(
            previewState,
            { packageName: selectedActivity.name || 'Önizleme' },
            { scope: 'activity', activityId: selectedActivity.id }
          )
        : '',
    [previewState, selectedActivity]
  );
  const playerHtmlSignature = useMemo(() => createPreviewHtmlSignature(playerHtml), [playerHtml]);

  if (!open) return null;

  if (!selectedActivity) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(15,23,42,.86)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e5edf8',
        }}
      >
        <div
          style={{
            width: 'min(420px, 90vw)',
            borderRadius: 16,
            background: '#ffffff',
            color: '#0f172a',
            padding: 22,
            boxShadow: '0 28px 70px rgba(0,0,0,.42)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8 }}>
            Önizleme için sahne yok
          </div>
          <button
            onClick={onClose}
            style={{
              height: 34,
              padding: '0 16px',
              borderRadius: 9,
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: '#202833',
        color: '#1f2937',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 48,
          borderBottom: '1px solid #151b24',
          background: 'linear-gradient(180deg,#f8fafc,#e5ebf3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid #b8c5d4',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f6fb5',
              fontWeight: 900,
            }}
          >
            ▶
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              SCORM ile Aynı Önizleme
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedActivity.name || 'Etkinlik'} · Aynı player HTML
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {previewActivities.length > 1 && (
            <select
              value={selectedActivity.id}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              style={{
                height: 32,
                minWidth: 220,
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12,
                fontWeight: 800,
                padding: '0 10px',
              }}
            >
              {previewActivities.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1}. {item.name || `Etkinlik ${index + 1}`}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClose}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 7,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 14, background: '#bfc8d1' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid rgba(71,85,105,.35)',
            boxShadow: '0 18px 46px rgba(15,23,42,.28)',
            background: '#101820',
          }}
        >
          <iframe
            key={`${selectedActivity.id}-${playerHtmlSignature}`}
            title="SCORM Preview"
            srcDoc={playerHtml}
            sandbox="allow-scripts allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#101820',
            }}
          />
        </div>
      </div>
    </div>
  );
}
