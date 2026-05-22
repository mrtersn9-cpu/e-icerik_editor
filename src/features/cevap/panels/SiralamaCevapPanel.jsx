import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import {
  CevapCard,
  Field,
  MiniPreview,
  MiniTable,
  PanelGrid,
  SelectInput,
  SmallButton,
  TextInput,
  ToggleRow,
} from '../components/CevapControls';

import { DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function SiralamaCevapPanel({ activity, onUpdate }) {
  const items = activity.sequenceItems || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const normalized = (list) => list.map((item, index) => ({ ...item, order: index + 1 }));
  const patchItem = (id, p) => patch({ sequenceItems: normalized(items.map((item) => (item.id === id ? { ...item, ...p } : item))) });
  const move = (index, direction) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ sequenceItems: normalized(next) });
  };
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Öğrenciden verilen öğeleri doğru sıraya dizmesi istenir."
      />
      <CevapCard number="2" title={`Cevap Formu - Doğru Sıra (${items.length})`} wide>
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item, index) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 32px 32px 32px', gap: 8, alignItems: 'center' }}>
              <span style={{ height: 32, borderRadius: 999, border: '1px solid #bbf7d0', color: '#15803d', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{index + 1}</span>
              <TextInput value={item.label} onChange={(value) => patchItem(item.id, { label: value })} />
              <SmallButton ariaLabel={`${index + 1}. öğeyi yukarı al`} onClick={() => move(index, -1)} disabled={index === 0}>Yukarı</SmallButton>
              <SmallButton ariaLabel={`${index + 1}. öğeyi aşağı al`} onClick={() => move(index, 1)} disabled={index === items.length - 1}>Aşağı</SmallButton>
              <SmallButton variant="danger" onClick={() => patch({ sequenceItems: normalized(items.filter((entry) => entry.id !== item.id)) })}>Sil</SmallButton>
            </div>
          ))}
          <SmallButton variant="primary" onClick={() => patch({ sequenceItems: [...items, { id: uid(), label: `Öğe ${items.length + 1}`, order: items.length + 1 }] })}>
            + Öğe Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Doğru Sıra Önizleme">
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item, index) => (
            <MiniPreview
              key={item.id}
              label={`${index + 1}. sırada`}
              value={item.label}
              empty="Öğe boş"
              tone="green"
            />
          ))}
          {!items.length && <span style={{ color: '#64748b', fontSize: 12 }}>0 öğe</span>}
        </div>
      </CevapCard>
      <CevapCard number="4" title="Sıralama Kuralları">
        <ToggleRow label="Başlangıçta karıştır" checked={activity.sequenceShuffle !== false} onChange={(checked) => patch({ sequenceShuffle: checked })} />
        <ToggleRow label="Sürükle-bırak ile sırala" checked={!!activity.sequenceDragDrop} onChange={(checked) => patch({ sequenceDragDrop: checked })} />
        <ToggleRow label="Otomatik numaralandırma" checked={activity.sequenceAutoNumber !== false} onChange={(checked) => patch({ sequenceAutoNumber: checked })} />
        <ToggleRow label="Kopya öğe kullanımını engelle" checked={!!activity.sequencePreventDuplicate} onChange={(checked) => patch({ sequencePreventDuplicate: checked })} />
        <Field label="Liste yönü"><SelectInput value={activity.sequenceDirection || 'vertical'} onChange={(value) => patch({ sequenceDirection: value })} options={[{ value: 'vertical', label: 'Dikey' }, { value: 'horizontal', label: 'Yatay' }]} /></Field>
      </CevapCard>
      <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
      <GeriBildirimCard number="6" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="7" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="8" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="10" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="10" title="Sıra Haritası" wide>
        <MiniTable columns={['Öğe', 'Doğru Sıra']} rows={items.map((item, index) => ({ id: item.id, cells: [item.label || '-', index + 1] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
