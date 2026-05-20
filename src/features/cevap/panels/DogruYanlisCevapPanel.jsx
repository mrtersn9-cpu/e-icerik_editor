import { useEffect } from 'react';

import { ensureTrueFalseOptions, patchActivity, patchMcOption, setSingleCorrectOption } from '../cevapActions';
import {
  CevapCard,
  ChoiceButton,
  Field,
  MiniPreview,
  MiniTable,
  PanelGrid,
  SelectInput,
  TextArea,
} from '../components/CevapControls';

import { DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function DogruYanlisCevapPanel({ activity, onUpdate }) {
  useEffect(() => ensureTrueFalseOptions(activity, onUpdate), [activity, onUpdate]);
  const options = activity.mcOptions || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Ogrencinin her ifade icin dogru ya da yanlis secmesini saglar."
      />
      <CevapCard number="2" title={`Ifade Listesi (${options.length})`} wide>
        <Field label="Ifade / soru">
          <TextArea value={activity.mcQuestion || ''} onChange={(value) => patch({ mcQuestion: value })} />
        </Field>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {options.map((option) => (
            <label key={option.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
              <input value={option.label} onChange={(event) => patchMcOption(activity, onUpdate, option.id, { label: event.target.value })} style={{ border: 'none', outline: 'none', fontSize: 13, fontWeight: 800 }} />
              <input type="radio" checked={!!option.isCorrect} onChange={() => setSingleCorrectOption(activity, onUpdate, option.id)} style={{ width: 18, height: 18, accentColor: '#16a34a' }} />
            </label>
          ))}
        </div>
      </CevapCard>
      <CevapCard number="3" title="Cevap Formu - Dogru / Yanlis">
        <div style={{ display: 'grid', gap: 10 }}>
          {options.map((option) => (
            <div
              key={option.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto',
                gap: 8,
                alignItems: 'center',
                border: `1px solid ${option.isCorrect ? '#86efac' : '#e2e8f0'}`,
                borderRadius: 8,
                background: option.isCorrect ? '#f0fdf4' : '#ffffff',
                padding: 10,
              }}
            >
              <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 900 }}>
                {option.label || '-'}
              </span>
              <ChoiceButton
                selected={!!option.isCorrect}
                tone={option.isCorrect ? 'green' : 'blue'}
                onClick={() => setSingleCorrectOption(activity, onUpdate, option.id)}
              >
                Dogru cevap
              </ChoiceButton>
            </div>
          ))}
          <MiniPreview
            label="Onizleme"
            value={options.find((option) => option.isCorrect)?.label}
            empty="Henuz dogru/yanlis secimi yok"
            tone={options.some((option) => option.isCorrect) ? 'green' : 'slate'}
          />
        </div>
      </CevapCard>
      <CevapCard number="4" title="Yanit Duzeni">
        <Field label="Duzen tipi">
          <SelectInput value={activity.answerControl?.trueFalseLayout || 'together'} onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), trueFalseLayout: value } })} options={[{ value: 'together', label: 'Tek kart uzerinde' }, { value: 'per-statement', label: 'Ifade bazinda' }]} />
        </Field>
        <Field label="Buton siralamasi">
          <SelectInput
            value={activity.answerControl?.trueFalseButtonOrder || 'normal'}
            onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), trueFalseButtonOrder: value } })}
            options={[
              { value: 'normal', label: 'Dogru - Yanlis' },
              { value: 'reversed', label: 'Yanlis - Dogru' },
            ]}
          />
        </Field>
      </CevapCard>
      <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
      <GeriBildirimCard number="6" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="7" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="8" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="10" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="10" title="Cevap Anahtari Ozeti" wide>
        <MiniTable columns={['Ifade', 'Dogru Cevap']} rows={options.map((option) => ({ id: option.id, cells: [option.label || '-', option.isCorrect ? 'Dogru' : 'Yanlis'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
