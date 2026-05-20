import { useMemo } from 'react';

import { LayerThumbnail } from '../../../components/SlideStrip';
import { getActivityLayers, getCanvasObjects } from '../../../logic/activityHelpers';
import { getEditorGroupedObjectEntries } from '../../../logic/editorHelpers';
import { buildResolvedLayerNameMap, createLayer } from '../../../logic/factories';

const objectTone = {
  audio: '#0ea5e9',
  button: '#2563eb',
  draggable: '#f97316',
  dropzone: '#f59e0b',
  hotspot: '#8b5cf6',
  image: '#16a34a',
  shape: '#64748b',
  text: '#ef4444',
  video: '#0284c7',
};

function IconButton({ children, disabled = false, onClick, title }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width: 21,
        height: 21,
        borderRadius: 6,
        border: '1px solid #d8e2ef',
        background: disabled ? '#f8fafc' : '#ffffff',
        color: disabled ? '#cbd5e1' : '#64748b',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

export default function ActiveLayerSummary({
  activity,
  onSelectionChange,
  onUpdateActivity,
  selectedIds = new Set(),
}) {
  const layers = useMemo(() => getActivityLayers(activity || {}), [activity]);
  const resolvedLayerNames = useMemo(
    () => buildResolvedLayerNameMap(layers, activity || {}),
    [activity, layers]
  );
  const activeLayerId = activity?.activeLayerId || 'base';
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) || layers[0] || null;
  const activeLayerObjects = useMemo(
    () => (activity?.objects || []).filter((item) => (item.layerId || 'base') === activeLayerId),
    [activity, activeLayerId]
  );
  const entries = useMemo(
    () =>
      getEditorGroupedObjectEntries(
        activity || {},
        [...activeLayerObjects].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
      ),
    [activity, activeLayerObjects]
  );

  const patchActivity = (patch) => {
    if (!activity) return;
    onUpdateActivity?.({ ...activity, ...patch });
  };

  const patchObjectGroup = (ids = [], patch = {}) => {
    if (!activity) return;
    const targetIds = new Set(ids);
    patchActivity({
      objects: (activity.objects || []).map((item) =>
        targetIds.has(item.id) ? { ...item, ...patch } : item
      ),
    });
  };

  const selectLayer = (layerId) => {
    patchActivity({ activeLayerId: layerId, selectedObjectId: null });
    onSelectionChange?.(new Set());
  };

  const selectObjects = (ids, primaryId) => {
    onSelectionChange?.(new Set(ids));
    patchActivity({
      activeLayerId:
        (activity.objects || []).find((item) => item.id === primaryId)?.layerId || 'base',
      selectedObjectId: primaryId,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderTop: '1px solid #e5edf6',
          paddingTop: 9,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: '#64748b',
              letterSpacing: 0.45,
              textTransform: 'uppercase',
            }}
          >
            Aktif Layer Özeti
          </div>
          <div style={{ fontSize: 10.5, color: '#334155', marginTop: 2, fontWeight: 800 }}>
            {resolvedLayerNames[activeLayerId] || activeLayer?.name || 'Layer'}
          </div>
        </div>
        <IconButton
          title="Yeni layer ekle"
          onClick={() => {
            const newLayer = createLayer('', layers.length);
            patchActivity({ layers: [...layers, newLayer], activeLayerId: newLayer.id });
          }}
        >
          +
        </IconButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {layers.map((layer) => {
          const layerId = layer.id || 'base';
          const isActive = layerId === activeLayerId;
          const layerObjects = (activity?.objects || []).filter(
            (item) => (item.layerId || 'base') === layerId
          );
          return (
            <button
              key={layerId}
              type="button"
              onClick={() => selectLayer(layerId)}
              style={{
                width: '100%',
                minHeight: 30,
                border: `1px solid ${isActive ? '#bfdbfe' : 'transparent'}`,
                background: isActive ? '#eef6ff' : 'transparent',
                borderRadius: 7,
                display: 'grid',
                gridTemplateColumns: '42px 1fr auto',
                alignItems: 'center',
                gap: 7,
                padding: '3px 5px',
                cursor: 'pointer',
                color: '#26364d',
                textAlign: 'left',
              }}
            >
              <LayerThumbnail
                activity={activity}
                layer={layer}
                isActive={isActive}
                getCanvasObjects={getCanvasObjects}
              />
              <span
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 10.5,
                  fontWeight: 850,
                }}
              >
                {resolvedLayerNames[layerId] || layer.name || 'Layer'}
              </span>
              <span style={{ color: '#64748b', fontSize: 10, fontWeight: 800 }}>
                {layerObjects.length}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(({ ids, object, primaryId }) => {
          const isSelected = ids.some((id) => selectedIds.has(id)) || activity?.selectedObjectId === primaryId;
          const tone = objectTone[object.type] || '#64748b';
          return (
            <div
              key={primaryId}
              style={{
                display: 'grid',
                gridTemplateColumns: '12px 1fr 21px 21px',
                alignItems: 'center',
                gap: 6,
                minHeight: 25,
                padding: '2px 4px',
                borderRadius: 6,
                background: isSelected ? '#eaf2ff' : 'transparent',
                color: '#1f2a3d',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: tone,
                  boxShadow: `0 0 0 2px ${tone}18`,
                }}
              />
              <button
                type="button"
                onClick={() => selectObjects(ids, primaryId)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  minWidth: 0,
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    color: object.visible === false ? '#94a3b8' : '#26364d',
                    fontSize: 10.5,
                    fontWeight: isSelected ? 900 : 760,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {object.label || object.type}
                  {ids.length > 1 ? ` (${ids.length})` : ''}
                </div>
              </button>
              <IconButton
                title={object.visible === false ? 'Göster' : 'Gizle'}
                onClick={() => patchObjectGroup(ids, { visible: object.visible === false })}
              >
                {object.visible === false ? '○' : '◉'}
              </IconButton>
              <IconButton
                title={object.locked ? 'Kilidi aç' : 'Kilitle'}
                onClick={() => patchObjectGroup(ids, { locked: !object.locked })}
              >
                {object.locked ? '●' : '○'}
              </IconButton>
            </div>
          );
        })}

        {!entries.length && (
          <div
            style={{
              border: '1px dashed #d7e2ef',
              borderRadius: 8,
              padding: '10px 8px',
              color: '#64748b',
              fontSize: 10.5,
              lineHeight: 1.45,
              textAlign: 'center',
              background: '#fbfdff',
            }}
          >
            Bu layer içinde nesne yok.
          </div>
        )}
      </div>
    </div>
  );
}
