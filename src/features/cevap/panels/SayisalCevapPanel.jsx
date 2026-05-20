import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, TextArea, TextInput, ToggleRow } from '../components/CevapControls';

import { DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function SayisalCevapPanel({ activity, onUpdate }) {
  const patch = (p) => patchActivity(activity, onUpdate, p);
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Ogrenci sayisal deger girer; dogru deger ve toleransla kontrol edilir."
      />
      <CevapCard number="2" title="Soru Yapisi">
        <Field label="Soru / prompt"><TextArea value={activity.numericPrompt || ''} onChange={(value) => patch({ numericPrompt: value })} /></Field>
      </CevapCard>
      <CevapCard number="3" title="Cevap Formu - Kabul Edilen Deger">
        <Field label="Dogru deger"><TextInput type="number" value={activity.numericCorrectValue ?? 0} onChange={(value) => patch({ numericCorrectValue: Number(value) || 0 })} /></Field>
        <Field label="Tolerans"><TextInput type="number" min="0" value={activity.numericTolerance ?? 0} onChange={(value) => patch({ numericTolerance: Number(value) || 0 })} /></Field>
        <Field label="Minimum"><TextInput type="number" value={activity.numericMin ?? ''} onChange={(value) => patch({ numericMin: value === '' ? null : Number(value) })} /></Field>
        <Field label="Maksimum"><TextInput type="number" value={activity.numericMax ?? ''} onChange={(value) => patch({ numericMax: value === '' ? null : Number(value) })} /></Field>
      </CevapCard>
      <DogrulamaKurallariCard number="4" activity={activity} onUpdate={onUpdate}>
        <ToggleRow
          label="Aralik disi yaniti reddet"
          checked={activity.numericRejectOutOfRange !== false}
          onChange={(checked) => patch({ numericRejectOutOfRange: checked })}
        />
      </DogrulamaKurallariCard>
      <GeriBildirimCard number="5" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="6" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="7" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="8" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="9" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="10" title="Sayisal Cevap Ozeti" wide>
        <MiniTable
          columns={['Dogru Deger', 'Tolerans', 'Minimum', 'Maksimum']}
          rows={[{
            id: 'numeric-summary',
            cells: [
              activity.numericCorrectValue ?? 0,
              activity.numericTolerance ?? 0,
              activity.numericMin ?? '-',
              activity.numericMax ?? '-',
            ],
          }]}
        />
      </CevapCard>
    </PanelGrid>
  );
}
