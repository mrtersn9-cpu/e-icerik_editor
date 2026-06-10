import { patchActivity } from '../cevapActions';
import { CevapCard, MiniTable, PanelGrid } from '../components/CevapControls';

import { CanCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function HotspotCevapPanel({ activity, onUpdate }) {
  const hotspots = (activity.objects || []).filter((object) => object.type === 'hotspot');
  const patchHotspot = (id, p) =>
    patchActivity(activity, onUpdate, {
      objects: (activity.objects || []).map((object) => (object.id === id ? { ...object, ...p } : object)),
    });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Görsel üzerindeki etkin alanlar doğru cevap olarak işaretlenir."
      />
      <CevapCard number="2" title={`Cevap Formu - Doğru Hotspotlar (${hotspots.length})`} wide>
        <div style={{ display: 'grid', gap: 8 }}>
          {hotspots.map((hotspot, index) => (
            <label
              key={hotspot.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '34px minmax(0,1fr) auto',
                gap: 8,
                alignItems: 'center',
                border: `1px solid ${hotspot.hotspotCorrect !== false ? '#86efac' : '#e2e8f0'}`,
                borderRadius: 8,
                background: hotspot.hotspotCorrect !== false ? '#f0fdf4' : '#ffffff',
                padding: 10,
                cursor: 'pointer',
              }}
            >
              <span>{index + 1}</span>
              <span style={{ color: '#334155', fontWeight: 800 }}>{hotspot.label || hotspot.id}</span>
              <input type="checkbox" checked={hotspot.hotspotCorrect !== false} onChange={(event) => patchHotspot(hotspot.id, { hotspotCorrect: event.target.checked })} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
            </label>
          ))}
          {!hotspots.length && (
            <div style={{ color: '#64748b', fontSize: 12 }}>
              <div>Henüz hotspot alanı yok.</div>
              <button
                onClick={() => {
                  const newObj = {
                    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
                    type: 'hotspot',
                    x: 200,
                    y: 150,
                    width: 120,
                    height: 80,
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
                  patchActivity(activity, onUpdate, {
                    objects: [...(activity.objects || []), newObj],
                  });
                }}
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #fca5a5',
                  background: '#ffffff',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Varsayılan Hotspot Ekle
              </button>
            </div>
          )}
          {hotspots.length > 0 && !hotspots.some((hotspot) => hotspot.hotspotCorrect !== false) && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
              En az bir hotspot doğru olarak işaretlenmeli; aksi halde etkinlik puanlanamaz.
            </div>
          )}
        </div>
      </CevapCard>
      <GeriBildirimCard number="3" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="4" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="5" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="6" activity={activity} onUpdate={onUpdate} />
      <CanCard number="7" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="8" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="9" title="Hotspot Haritası" wide>
        <MiniTable columns={['#', 'Hotspot', 'Doğru']} rows={hotspots.map((hotspot, index) => ({ id: hotspot.id, cells: [index + 1, hotspot.label || hotspot.id, hotspot.hotspotCorrect !== false ? '✓' : ''] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
