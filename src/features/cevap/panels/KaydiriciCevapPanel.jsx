import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, SelectInput, TextArea, TextInput, ToggleRow } from '../components/CevapControls';

import { CanCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

const MODE_OPTIONS = [
  { value: 'slider', label: 'Kaydırıcı (yatay çubuk)' },
  { value: 'dial', label: 'Kadran (yuvarlak)' },
];

export default function KaydiriciCevapPanel({ activity, onUpdate }) {
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const graded = activity.sliderGraded !== false;
  const min = activity.sliderMin != null ? Number(activity.sliderMin) : 0;
  const max = activity.sliderMax != null ? Number(activity.sliderMax) : 100;
  const correct = activity.sliderCorrectValue != null ? Number(activity.sliderCorrectValue) : 50;
  const rangeInvalid = Number.isFinite(min) && Number.isFinite(max) && min >= max;
  const correctOutOfRange = graded && Number.isFinite(correct) && (correct < min || correct > max);

  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Öğrenci kaydırıcı veya kadranla bir değer seçer; tolerans dahilinde doğru değer kontrol edilir."
      />
      <CevapCard number="2" title="Soru Yapısı">
        <Field label="Soru / prompt"><TextArea value={activity.sliderPrompt || ''} onChange={(value) => patch({ sliderPrompt: value })} /></Field>
        <Field label="Görünüm"><SelectInput value={activity.sliderMode || 'slider'} onChange={(value) => patch({ sliderMode: value })} options={MODE_OPTIONS} /></Field>
        <Field label="Birim etiketi (örn. %, °, kg)" hint="Boş bırakılabilir."><TextInput value={activity.sliderUnit || ''} onChange={(value) => patch({ sliderUnit: value })} /></Field>
      </CevapCard>
      <CevapCard number="3" title="Aralık ve Adım">
        <Field label="Minimum"><TextInput type="number" value={activity.sliderMin ?? 0} onChange={(value) => patch({ sliderMin: Number(value) || 0 })} /></Field>
        <Field label="Maksimum"><TextInput type="number" value={activity.sliderMax ?? 100} onChange={(value) => patch({ sliderMax: Number(value) || 0 })} /></Field>
        <Field label="Adım (step)"><TextInput type="number" min="0" value={activity.sliderStep ?? 1} onChange={(value) => patch({ sliderStep: Number(value) || 1 })} /></Field>
        {rangeInvalid && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Minimum, maksimumdan küçük olmalı.</div>
        )}
      </CevapCard>
      <CevapCard number="4" title="Cevap Formu - Doğru Değer">
        <ToggleRow
          label="Notlandır (doğru değer kontrol edilsin)"
          checked={graded}
          onChange={(checked) => patch({ sliderGraded: checked })}
          hint="Kapalıyken bilgilendirme/keşif amaçlı; her yanıt kabul edilir."
        />
        {graded && (
          <>
            <Field label="Doğru değer"><TextInput type="number" value={activity.sliderCorrectValue ?? 50} onChange={(value) => patch({ sliderCorrectValue: Number(value) || 0 })} /></Field>
            <Field label="Tolerans (±)" hint="0 ise tam değer gerekir."><TextInput type="number" min="0" value={activity.sliderTolerance ?? 0} onChange={(value) => patch({ sliderTolerance: Number(value) || 0 })} /></Field>
            {correctOutOfRange && (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Doğru değer min-max aralığı dışında.</div>
            )}
          </>
        )}
      </CevapCard>
      <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
      <GeriBildirimCard number="6" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="7" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="8" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
      <CanCard number="10" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="12" title="Kaydırıcı Özeti" wide>
        <MiniTable
          columns={['Görünüm', 'Aralık', 'Adım', 'Doğru Değer', 'Tolerans']}
          rows={[{
            id: 'slider-summary',
            cells: [
              (activity.sliderMode || 'slider') === 'dial' ? 'Kadran' : 'Kaydırıcı',
              `${min} – ${max}${activity.sliderUnit ? ' ' + activity.sliderUnit : ''}`,
              activity.sliderStep ?? 1,
              graded ? (activity.sliderCorrectValue ?? 50) : 'Notsuz',
              graded ? (activity.sliderTolerance ?? 0) : '-',
            ],
          }]}
        />
      </CevapCard>
    </PanelGrid>
  );
}
