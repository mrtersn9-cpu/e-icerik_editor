import { useEffect } from 'react';

import { ensureTrueFalseChoices, patchActivity, patchChoiceObject, setChoiceCorrect } from '../cevapActions';
import { getAnswerSummary } from '../cevapSelectors';
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

import { CanCard, DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

function getChoiceText(choice = {}) {
  return choice.selectionChoice || choice.label || '';
}

export default function DogruYanlisCevapPanel({ activity, onUpdate }) {
  useEffect(() => ensureTrueFalseChoices(activity, onUpdate), [activity, onUpdate]);
  const summary = getAnswerSummary(activity);
  const choices = summary.choices;
  const patch = (p) => patchActivity(activity, onUpdate, p);
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="İfadeyi yaz, ardından doğru cevabın 'Doğru' mu 'Yanlış' mı olduğunu işaretle. Şıklar sahnedeki nesnelerdir."
      />
      <CevapCard number="2" title="İfade ve Cevap" wide>
        <Field label="İfade / soru">
          <TextArea value={activity.mcQuestion || ''} onChange={(value) => patch({ mcQuestion: value })} />
        </Field>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {choices.map((choice) => (
            <label
              key={choice.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto',
                gap: 10,
                alignItems: 'center',
                border: `1px solid ${choice.selectionCorrect ? '#86efac' : '#e2e8f0'}`,
                background: choice.selectionCorrect ? '#f0fdf4' : '#ffffff',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <input
                value={getChoiceText(choice)}
                onChange={(event) =>
                  patchChoiceObject(activity, onUpdate, choice.id, {
                    label: event.target.value,
                    selectionChoice: event.target.value,
                  })
                }
                style={{ border: 'none', outline: 'none', fontSize: 13, fontWeight: 800, background: 'transparent' }}
              />
              <input
                type="radio"
                name={`tf-${activity.id || 'soru'}`}
                checked={!!choice.selectionCorrect}
                onChange={() => setChoiceCorrect(activity, onUpdate, choice.id, true)}
                title="Doğru cevap"
                style={{ width: 18, height: 18, accentColor: '#16a34a' }}
              />
            </label>
          ))}
          {!choices.length && (
            <div style={{ fontSize: 11, color: '#64748b' }}>Doğru/Yanlış seçenekleri hazırlanıyor…</div>
          )}
        </div>
      </CevapCard>
      <CevapCard number="3" title="Cevap Formu - Doğru / Yanlış">
        <div style={{ display: 'grid', gap: 10 }}>
          {choices.map((choice) => (
            <div
              key={choice.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto',
                gap: 8,
                alignItems: 'center',
                border: `1px solid ${choice.selectionCorrect ? '#86efac' : '#e2e8f0'}`,
                borderRadius: 8,
                background: choice.selectionCorrect ? '#f0fdf4' : '#ffffff',
                padding: 10,
              }}
            >
              <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 900 }}>{getChoiceText(choice) || '-'}</span>
              <ChoiceButton
                selected={!!choice.selectionCorrect}
                tone={choice.selectionCorrect ? 'green' : 'blue'}
                onClick={() => setChoiceCorrect(activity, onUpdate, choice.id, true)}
              >
                {choice.selectionCorrect ? 'Doğru cevap' : 'İşaretle'}
              </ChoiceButton>
            </div>
          ))}
          <MiniPreview
            label="Önizleme"
            value={summary.correctChoices.map((choice) => getChoiceText(choice)).join(', ') || undefined}
            empty="Henüz doğru cevap seçilmedi"
            tone={summary.correctChoices.length ? 'green' : 'slate'}
          />
        </div>
      </CevapCard>
      <CevapCard number="4" title="Yanıt Düzeni">
        <Field label="Düzen tipi">
          <SelectInput value={activity.answerControl?.trueFalseLayout || 'together'} onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), trueFalseLayout: value } })} options={[{ value: 'together', label: 'Tek kart üzerinde' }, { value: 'per-statement', label: 'İfade bazında' }]} />
        </Field>
        <Field label="Buton sıralaması">
          <SelectInput
            value={activity.answerControl?.trueFalseButtonOrder || 'normal'}
            onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), trueFalseButtonOrder: value } })}
            options={[
              { value: 'normal', label: 'Doğru - Yanlış' },
              { value: 'reversed', label: 'Yanlış - Doğru' },
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
      <CanCard number="11" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="12" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="13" title="Cevap Anahtarı Özeti" wide>
        <MiniTable columns={['Seçenek', 'Doğru Cevap']} rows={choices.map((choice) => ({ id: choice.id, cells: [getChoiceText(choice) || '-', choice.selectionCorrect ? 'Doğru' : 'Yanlış'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
