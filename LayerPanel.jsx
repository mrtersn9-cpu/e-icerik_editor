import { useMemo } from 'react';
import {
  getActivityLayers,
  buildResolvedLayerNameMap,
  normalizeLayerNameKey,
} from '../../../../../logic/activityHelpers';
import { createLayer } from '../../../../../logic/factories';

function LayerPanel({ selActivity, updateActivity }) {
  const layers = useMemo(() => getActivityLayers(selActivity), [selActivity]);
  const layerNames = useMemo(
    () => buildResolvedLayerNameMap(layers, selActivity),
    [layers, selActivity]
  );

  const handleLayerUpdate = (layerId, patch) => {
    updateActivity({
      ...selActivity,
      layers: layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
    });
  };

  const handleAddLayer = () => {
    const newLayer = createLayer('', layers.length);
    updateActivity({
      ...selActivity,
      layers: [...layers, newLayer],
      activeLayerId: newLayer.id,
    });
  };

  const handleRemoveLayer = (layerId) => {
    if (layers.length <= 1) return;
    const nextLayers = layers.filter((l) => l.id !== layerId);
    updateActivity({
      ...selActivity,
      layers: nextLayers,
      activeLayerId:
        selActivity.activeLayerId === layerId ? 'base' : selActivity.activeLayerId,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Katmanlar</div>
        <button
          onClick={handleAddLayer}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 700,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          + Yeni Katman
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {layers.map((layer) => {
          const isActive = layer.id === selActivity.activeLayerId;
          const isBase = layer.id === 'base';
          const name = layerNames[layer.id] || layer.name || 'Katman';
          const isFeedbackLayer = ['correct', 'incorrect', 'try again'].includes(
            normalizeLayerNameKey(name)
          );

          return (
            <div
              key={layer.id}
              onClick={() => updateActivity({ ...selActivity, activeLayerId: layer.id })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                background: isActive ? '#dbeafe' : '#f8fafc',
                border: `1px solid ${isActive ? '#93c5fd' : '#e2e8f0'}`,
                cursor: 'pointer',
                fontSize: 12,
                color: '#1e293b',
              }}
            >
              <span style={{ opacity: layer.visible ? 1 : 0.4 }}>{isBase ? '🏠' : '📄'}</span>
              <span style={{ flex: 1, fontWeight: isActive ? 700 : 500 }}>{name}</span>
              {!isBase && !isFeedbackLayer && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveLayer(layer.id);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LayerPanel;