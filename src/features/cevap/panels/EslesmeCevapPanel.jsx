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

export default function EslesmeCevapPanel({ activity, onUpdate }) {
  const pairs = activity.matchingPairs || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchPair = (id, p) => patch({ matchingPairs: pairs.map((pair) => (pair.id === id ? { ...pair, ...p } : pair)) });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Iki liste arasindaki ogeleri dogru eslestirme etkinligi."
      />
      <CevapCard number="2" title={`Cevap Formu - Eslesme Ciftleri (${pairs.length})`} wide>
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
            onClick={() => patch({ matchingPairs: [...pairs, { id: uid(), left: `Sol ${pairs.length + 1}`, right: `Sag ${pairs.length + 1}` }] })}
          >
            + Oge Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Baglanti Kurallari">
        <ToggleRow label="Rastgele sirala" checked={activity.matchingShuffle !== false} onChange={(checked) => patch({ matchingShuffle: checked })} />
        <ToggleRow label="Birbir esleme" checked={!!activity.matchingMutual} onChange={(checked) => patch({ matchingMutual: checked })} />
        <Field label="Eslestirme kurali"><SelectInput value={activity.answerControl?.matchingRule || 'one-to-one'} onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), matchingRule: value } })} options={[{ value: 'one-to-one', label: 'Bire bir eslesme' }, { value: 'many', label: 'Coktan bire izin ver' }]} /></Field>
        <Field label="Cizgi stili">
          <SelectInput
            value={activity.matchingLineStyle || 'solid'}
            onChange={(value) => patch({ matchingLineStyle: value })}
            options={[
              { value: 'solid', label: 'Duz' },
              { value: 'dashed', label: 'Kesikli' },
              { value: 'dotted', label: 'Noktali' },
            ]}
          />
        </Field>
        <Field label="Cizgi kalinligi (px)">
          <TextInput type="number" min="1" max="10" value={activity.matchingLineWidth || 2} onChange={(value) => patch({ matchingLineWidth: Math.max(1, Math.min(10, Number(value) || 2)) })} />
        </Field>
        <Field label="Baglanti rengi">
          <TextInput value={activity.matchingLineColor || '#1d4ed8'} onChange={(value) => patch({ matchingLineColor: value })} />
        </Field>
      </CevapCard>
      <CevapCard number="4" title="Eslestirme Onizleme" wide>
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
              <MiniPreview label={`${index + 1}. sol oge`} value={pair.left} empty="Sol oge bos" />
              <MiniPreview label="Secilen sag oge" value={pair.right} empty="Sag oge bos" tone="green" />
            </div>
          ))}
          {!pairs.length && <span style={{ color: '#64748b', fontSize: 12 }}>0 eslesme</span>}
        </div>
      </CevapCard>
      <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="6" activity={activity} onUpdate={onUpdate} />
      <GeriBildirimCard number="7" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="8" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="10" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="10" title="Eslesme Haritasi" wide>
        <MiniTable columns={['#', 'Sol Sutun', 'Sag Sutun']} rows={pairs.map((pair, index) => ({ id: pair.id, cells: [index + 1, pair.left || '-', pair.right || '-'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
