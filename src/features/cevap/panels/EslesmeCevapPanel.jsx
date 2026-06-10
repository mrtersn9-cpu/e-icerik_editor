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

import { CanCard, DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function EslesmeCevapPanel({ activity, onUpdate }) {
  const pairs = activity.matchingPairs || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchPair = (id, p) => patch({ matchingPairs: pairs.map((pair) => (pair.id === id ? { ...pair, ...p } : pair)) });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="İki liste arasındaki öğeleri doğru eşleştirme etkinliği."
      />
      <CevapCard number="2" title={`Cevap Formu - Eşleşme Çiftleri (${pairs.length})`} wide>
        <div style={{ display: 'grid', gap: 8 }}>
          {pairs.map((pair, index) => (
            <div key={pair.id} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) minmax(0,1fr) 34px', gap: 8, alignItems: 'center' }}>
              <span style={{ height: 32, border: '1px solid #dbe7f5', borderRadius: 8, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{index + 1}</span>
              <TextInput value={pair.left} onChange={(value) => patchPair(pair.id, { left: value })} />
              <TextInput value={pair.right} onChange={(value) => patchPair(pair.id, { right: value })} />
              <SmallButton variant="danger" onClick={() => patch({ matchingPairs: pairs.filter((item) => item.id !== pair.id) })}>Sil</SmallButton>
            </div>
          ))}
          <SmallButton
            variant="primary"
            onClick={() => patch({ matchingPairs: [...pairs, { id: uid(), left: `Sol ${pairs.length + 1}`, right: `Sağ ${pairs.length + 1}` }] })}
          >
            + Öğe Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Bağlantı Kuralları">
        <ToggleRow label="Rastgele sırala" checked={activity.matchingShuffle !== false} onChange={(checked) => patch({ matchingShuffle: checked })} />
        <ToggleRow label="Birebir eşleme" checked={!!activity.matchingMutual} onChange={(checked) => patch({ matchingMutual: checked })} />
        <Field label="Eşleştirme kuralı"><SelectInput value={activity.answerControl?.matchingRule || 'one-to-one'} onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), matchingRule: value } })} options={[{ value: 'one-to-one', label: 'Bire bir eşleşme' }, { value: 'many', label: 'Çoktan bire izin ver' }]} /></Field>
        <Field label="Çizgi stili">
          <SelectInput
            value={activity.matchingLineStyle || 'solid'}
            onChange={(value) => patch({ matchingLineStyle: value })}
            options={[
              { value: 'solid', label: 'Düz' },
              { value: 'dashed', label: 'Kesikli' },
              { value: 'dotted', label: 'Noktalı' },
            ]}
          />
        </Field>
        <Field label="Çizgi kalınlığı (px)">
          <TextInput type="number" min="1" max="10" value={activity.matchingLineWidth || 2} onChange={(value) => patch({ matchingLineWidth: Math.max(1, Math.min(10, Number(value) || 2)) })} />
        </Field>
        <Field label="Bağlantı rengi">
          <TextInput value={activity.matchingLineColor || '#1d4ed8'} onChange={(value) => patch({ matchingLineColor: value })} />
        </Field>
      </CevapCard>
      <CevapCard number="4" title="Eşleştirme Önizleme" wide>
        <div style={{ display: 'grid', gap: 8 }}>
          {pairs.map((pair, index) => (
            <div
              key={pair.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <MiniPreview label={`${index + 1}. sol öğe`} value={pair.left} empty="Sol öğe boş" />
              <MiniPreview label="Seçilen sağ öğe" value={pair.right} empty="Sağ öğe boş" tone="green" />
            </div>
          ))}
          {!pairs.length && <span style={{ color: '#64748b', fontSize: 12 }}>0 eşleşme</span>}
        </div>
      </CevapCard>
      <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="6" activity={activity} onUpdate={onUpdate} />
      <GeriBildirimCard number="7" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="8" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="10" activity={activity} onUpdate={onUpdate} />
      <CanCard number="11" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="12" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="13" title="Eşleşme Haritası" wide>
        <MiniTable columns={['#', 'Sol Sütun', 'Sağ Sütun']} rows={pairs.map((pair, index) => ({ id: pair.id, cells: [index + 1, pair.left || '-', pair.right || '-'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
