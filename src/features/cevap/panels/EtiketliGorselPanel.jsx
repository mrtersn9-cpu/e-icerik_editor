import { useRef, useState } from 'react';

import { fileToDataUrl } from '../../../api/apiClient';
import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, PanelGrid, SmallButton, TextArea, TextInput } from '../components/CevapControls';

import { DenemeVeKisitlarCard, ErisilebilirlikCard, EtkinlikTuruCard, IpucuCard } from './OrtakCevapKartlari';

export default function EtiketliGorselPanel({ activity, onUpdate }) {
  const markers = activity.labeledMarkers || [];
  const [selectedId, setSelectedId] = useState(null);
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchMarker = (id, p) => patch({ labeledMarkers: markers.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const addMarker = () => {
    const marker = { id: uid(), x: 50, y: 50, title: `İşaretçi ${markers.length + 1}`, body: '' };
    patch({ labeledMarkers: [...markers, marker] });
    setSelectedId(marker.id);
  };
  const removeMarker = (id) => patch({ labeledMarkers: markers.filter((m) => m.id !== id) });
  const upload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    fileToDataUrl(file).then((data) => patch({ labeledImage: data })).catch(() => {});
  };
  const onImageClick = (event) => {
    if (!selectedId || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    patchMarker(selectedId, { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Görsel yükle, üzerine bilgi işaretçileri koy; öğrenci işaretçiye tıklayınca bilgi balonu açılır."
      />
      <CevapCard number="2" title="Görsel" wide>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <SmallButton variant="primary" onClick={() => fileRef.current?.click()}>
            {activity.labeledImage ? 'Görseli Değiştir' : 'Görsel Yükle'}
          </SmallButton>
          {activity.labeledImage && (
            <SmallButton variant="danger" onClick={() => patch({ labeledImage: '' })}>Kaldır</SmallButton>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
          {selectedId && (
            <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>
              Görsele tıkla → seçili işaretçiyi oraya taşı
            </span>
          )}
        </div>
        {activity.labeledImage ? (
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img
              ref={imgRef}
              src={activity.labeledImage}
              alt=""
              onClick={onImageClick}
              style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 8, border: '1px solid #e2e8f0', cursor: selectedId ? 'crosshair' : 'default', display: 'block' }}
            />
            {markers.map((m, i) => (
              <span
                key={m.id}
                onClick={(e) => { e.stopPropagation(); setSelectedId(m.id); }}
                title={m.title}
                style={{
                  position: 'absolute',
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  transform: 'translate(-50%,-50%)',
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: selectedId === m.id ? '#1d4ed8' : '#2563eb',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  border: '2px solid #fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,.3)',
                  cursor: 'pointer',
                }}
              >
                {i + 1}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 12 }}>Önce bir görsel yükle.</div>
        )}
      </CevapCard>
      <CevapCard number="3" title={`İşaretçiler (${markers.length})`} wide>
        <div style={{ display: 'grid', gap: 10 }}>
          {markers.map((m, i) => (
            <div
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              style={{ border: `1px solid ${selectedId === m.id ? '#1d4ed8' : '#e2e8f0'}`, borderRadius: 8, padding: 10, display: 'grid', gap: 8, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8' }}>İşaretçi #{i + 1}</span>
                <SmallButton variant="danger" onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}>Sil</SmallButton>
              </div>
              <Field label="Başlık"><TextInput value={m.title || ''} onChange={(v) => patchMarker(m.id, { title: v })} /></Field>
              <Field label="Bilgi metni"><TextArea value={m.body || ''} onChange={(v) => patchMarker(m.id, { body: v })} rows={2} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="X (%)"><TextInput type="number" min="0" max="100" value={m.x} onChange={(v) => patchMarker(m.id, { x: Math.max(0, Math.min(100, Number(v) || 0)) })} /></Field>
                <Field label="Y (%)"><TextInput type="number" min="0" max="100" value={m.y} onChange={(v) => patchMarker(m.id, { y: Math.max(0, Math.min(100, Number(v) || 0)) })} /></Field>
              </div>
            </div>
          ))}
          <SmallButton variant="primary" onClick={addMarker}>+ İşaretçi Ekle</SmallButton>
        </div>
      </CevapCard>
      <IpucuCard number="4" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="5" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="6" activity={activity} onUpdate={onUpdate} />
    </PanelGrid>
  );
}
