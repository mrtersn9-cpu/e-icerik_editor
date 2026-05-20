// eslint-disable-next-line no-unused-vars -- Kept for local diagnostics, but hidden from learner preview and SCORM output.
export default function DragDropDebugPanel({
  debug = {},
  activeDragId = '',
  dragPositions = {},
  dropAssignments = {},
  onClear,
}) {
  const logs = Array.isArray(debug.logs) ? debug.logs : [];
  const latestDomSummary =
    logs.find((entry) => entry?.code === 'DD_DOM_SCAN' && entry?.data)?.data || {};
  const committedState = logs
    .filter((entry) => entry?.code === 'DD_STATE_COMMIT' && entry?.data)
    .reduceRight(
      (acc, entry) => ({
        dragPositions: { ...acc.dragPositions, ...(entry.data.dragPositions || {}) },
        dropAssignments: { ...acc.dropAssignments, ...(entry.data.dropAssignments || {}) },
      }),
      { dragPositions: {}, dropAssignments: {} }
    );
  const summary = Object.keys(debug.summary || {}).length ? debug.summary : latestDomSummary;
  const live = debug.live || logs[0] || null;
  const reportedDragPositions = { ...committedState.dragPositions, ...(dragPositions || {}) };
  const reportedDropAssignments = { ...committedState.dropAssignments, ...(dropAssignments || {}) };
  const draggableMetric = summary.draggableCount ?? summary.reactDraggableDomCount ?? 0;
  const dropTargetMetric = summary.dropTargetCount ?? summary.reactDropTargetDomCount ?? 0;
  const metric = (label, value, tone = '#e2e8f0') => (
    <div
      style={{
        minWidth: 70,
        flex: '1 1 70px',
        border: '1px solid rgba(148,163,184,.24)',
        background: 'rgba(15,23,42,.72)',
        padding: '6px 7px',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, color: tone, fontWeight: 950, lineHeight: 1.15 }}>
        {value ?? 0}
      </div>
    </div>
  );
  const levelColor = (level = 'info') => {
    if (level === 'success') return '#86efac';
    if (level === 'warn') return '#fde68a';
    if (level === 'error') return '#fecaca';
    return '#bfdbfe';
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 14,
        bottom: 58,
        zIndex: 1300,
        width: 'min(440px, calc(100vw - 28px))',
        maxHeight: 'min(520px, calc(100vh - 120px))',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(2,6,23,.92)',
        color: '#e2e8f0',
        border: '1px solid rgba(148,163,184,.38)',
        boxShadow: '0 18px 48px rgba(2,6,23,.45)',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid rgba(148,163,184,.22)',
          background: 'rgba(15,23,42,.96)',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 950, color: '#f8fafc' }}>Drag-Drop Debug</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
            {summary.activeLayerId || 'base'} · ölçek {summary.scale || '-'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              const payload = JSON.stringify(
                {
                  summary,
                  live,
                  logs,
                  activeDragId,
                  dragPositions: reportedDragPositions,
                  dropAssignments: reportedDropAssignments,
                },
                null,
                2
              );
              navigator.clipboard?.writeText?.(payload).catch(() => {});
            }}
            style={{
              height: 24,
              padding: '0 8px',
              borderRadius: 5,
              border: '1px solid rgba(96,165,250,.45)',
              background: 'rgba(37,99,235,.18)',
              color: '#bfdbfe',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Kopyala
          </button>
          <button
            onClick={onClear}
            style={{
              height: 24,
              padding: '0 8px',
              borderRadius: 5,
              border: '1px solid rgba(148,163,184,.35)',
              background: 'rgba(255,255,255,.06)',
              color: '#cbd5e1',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Temizle
          </button>
        </div>
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {metric('Öğe', draggableMetric, draggableMetric ? '#93c5fd' : '#fecaca')}
          {metric('Hedef', dropTargetMetric, dropTargetMetric ? '#86efac' : '#fecaca')}
          {metric(
            'Görsel Öğe',
            summary.visualDraggableCandidateCount,
            summary.visualDraggableCandidateCount ? '#93c5fd' : '#fecaca'
          )}
          {metric(
            'Görsel Hedef',
            summary.visualDropCandidateCount,
            summary.visualDropCandidateCount ? '#86efac' : '#fecaca'
          )}
          {metric('Dropzone', summary.explicitDropzoneCount, '#fef08a')}
          {metric('Şekil Hedef', summary.inferredDropTargetCount, '#fdba74')}
          {metric('Konum', Object.keys(reportedDragPositions || {}).length, '#c4b5fd')}
          {metric('Eşleşme', Object.keys(reportedDropAssignments || {}).length, '#67e8f9')}
        </div>

        <div
          style={{
            border: '1px solid rgba(148,163,184,.22)',
            background: 'rgba(15,23,42,.58)',
            borderRadius: 6,
            padding: 8,
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}
          >
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900 }}>CANLI DURUM</span>
            <span
              style={{ fontSize: 10, color: activeDragId ? '#86efac' : '#cbd5e1', fontWeight: 900 }}
            >
              {activeDragId ? 'SÜRÜKLENİYOR' : 'BEKLEMEDE'}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: live ? levelColor(live.level) : '#cbd5e1',
              fontWeight: 800,
            }}
          >
            {live?.code || 'DD_IDLE'} · {live?.message || 'Henüz hareket yok.'}
          </div>
          {live?.data && (
            <pre
              style={{
                margin: '6px 0 0',
                maxHeight: 86,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 10,
                lineHeight: 1.35,
                color: '#cbd5e1',
                background: 'rgba(2,6,23,.52)',
                borderRadius: 5,
                padding: 6,
              }}
            >
              {JSON.stringify(live.data, null, 2)}
            </pre>
          )}
        </div>

        <div
          style={{
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingRight: 2,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ fontSize: 11, color: '#94a3b8', padding: '8px 2px' }}>
              Log yok. Bir sürüklenebilir öğeyi tutup bırakın.
            </div>
          ) : (
            logs.map((entry) => (
              <details
                key={entry.id}
                open={entry.level === 'error' || entry.level === 'warn'}
                style={{
                  border: `1px solid ${levelColor(entry.level)}55`,
                  background: 'rgba(15,23,42,.54)',
                  borderRadius: 6,
                  padding: '6px 7px',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      minWidth: 0,
                      fontSize: 11,
                      color: levelColor(entry.level),
                      fontWeight: 900,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.code} · {entry.message}
                  </span>
                  <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{entry.time}</span>
                </summary>
                {entry.data && (
                  <pre
                    style={{
                      margin: '6px 0 0',
                      maxHeight: 150,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 10,
                      lineHeight: 1.35,
                      color: '#cbd5e1',
                      background: 'rgba(2,6,23,.52)',
                      borderRadius: 5,
                      padding: 6,
                    }}
                  >
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                )}
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
