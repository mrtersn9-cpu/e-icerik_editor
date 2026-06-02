import { Inp } from '../../components/ui';
import { uid } from '../../utils/editorHelpers';

export default function HotspotEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const allObjects = activity.objects || [];
  const hotspots = allObjects.filter((obj) => obj.type === 'hotspot');

  const card = {
    background: '#ffffff',
    border: '1px solid #dbe7f5',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 10px 22px rgba(15,23,42,.05)',
  };

  const updateHotspot = (id, field, value) => {
    patch({
      objects: allObjects.map((obj) =>
        obj.id === id ? { ...obj, [field]: value } : obj
      ),
    });
  };

  const addHotspot = () => {
    const newObj = {
      id: uid(),
      type: 'hotspot',
      x: 120 + Math.round(Math.random() * 200),
      y: 100 + Math.round(Math.random() * 120),
      width: 100,
      height: 70,
      rotation: 0,
      label: 'Yeni Alan',
      locked: false,
      visible: true,
      zIndex: 1,
      imageData: null,
      mediaUrl: '',
      mediaName: '',
      group: '',
      scope: '',
      allowMultipleTargets: false,
      capacity: 0,
      layerId: 'base',
      style: {
        fontSize: 14,
        color: '#ffffff',
        background: '#f4433666',
        borderColor: '#f44336',
        borderStyle: 'solid',
        borderRadius: 999,
      },
      stateStyles: {},
      hotspotCorrect: true,
    };
    patch({ objects: [...allObjects, newObj] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={card}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#dc2626',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Etkin Alan Ayarları
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Inp
            label="Soru Metni"
            value={activity.hotspotQuestion || ''}
            onChange={(e) => patch({ hotspotQuestion: e.target.value })}
            placeholder="Görseldeki doğru alanları işaretleyin..."
          />
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#dc2626',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Hotspot Alanları ({hotspots.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hotspots.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                textAlign: 'center',
                padding: '12px 0',
              }}
            >
              Henüz hotspot alanı yok. Aşağıdaki butonla yeni bir alan ekleyin.
            </div>
          )}
          {hotspots.map((h) => (
            <div
              key={h.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <Inp
                  label="Etiket"
                  value={h.label || ''}
                  onChange={(e) => updateHotspot(h.id, 'label', e.target.value)}
                  placeholder="Alan adı"
                  style={{ flex: 1 }}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={h.hotspotCorrect !== false}
                    onChange={(e) => updateHotspot(h.id, 'hotspotCorrect', e.target.checked)}
                    style={{ accentColor: '#dc2626' }}
                  />
                  Doğru alan
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Inp
                  label="X"
                  type="number"
                  value={h.x ?? 0}
                  onChange={(e) => updateHotspot(h.id, 'x', +e.target.value || 0)}
                />
                <Inp
                  label="Y"
                  type="number"
                  value={h.y ?? 0}
                  onChange={(e) => updateHotspot(h.id, 'y', +e.target.value || 0)}
                />
                <Inp
                  label="Genişlik"
                  type="number"
                  value={h.width ?? 100}
                  onChange={(e) => updateHotspot(h.id, 'width', Math.max(10, +e.target.value || 100))}
                />
                <Inp
                  label="Yükseklik"
                  type="number"
                  value={h.height ?? 70}
                  onChange={(e) => updateHotspot(h.id, 'height', Math.max(10, +e.target.value || 70))}
                />
              </div>
            </div>
          ))}
          <button
            onClick={addHotspot}
            style={{
              minHeight: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #fca5a5',
              background: '#ffffff',
              color: '#dc2626',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Hotspot Alanı Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
