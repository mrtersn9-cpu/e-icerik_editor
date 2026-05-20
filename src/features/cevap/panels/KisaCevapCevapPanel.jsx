import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, SelectInput, SmallButton, TextArea, TextInput, ToggleRow } from '../components/CevapControls';

import { DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function KisaCevapCevapPanel({ activity, onUpdate }) {
  const answers = activity.textEntryAcceptedAnswers || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchAnswer = (index, value) =>
    patch({ textEntryAcceptedAnswers: answers.map((answer, answerIndex) => (answerIndex === index ? value : answer)) });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Ogrenci kisa metin yaniti girer; otomatik veya manuel degerlendirilir."
      />
      <CevapCard number="2" title="Soru Yapisi">
        <Field label="Soru / prompt"><TextArea value={activity.textEntryPrompt || ''} onChange={(value) => patch({ textEntryPrompt: value })} /></Field>
        <Field label="Maksimum karakter"><TextInput type="number" min="1" value={activity.textEntryMaxLength || 250} onChange={(value) => patch({ textEntryMaxLength: Number(value) || 250 })} /></Field>
        <Field label="Yanit kutusu satir sayisi"><TextInput type="number" min="1" max="20" value={activity.textEntryRows || 3} onChange={(value) => patch({ textEntryRows: Math.max(1, Math.min(20, Number(value) || 3)) })} /></Field>
        <ToggleRow label="Sesle yazim destegi" checked={!!activity.textEntryVoiceInput} onChange={(checked) => patch({ textEntryVoiceInput: checked })} />
      </CevapCard>
      <CevapCard number="3" title="Cevap Formu - Beklenen Yanitlar">
        <div style={{ display: 'grid', gap: 8 }}>
          {answers.map((answer, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 70px 34px', gap: 8, alignItems: 'center' }}>
              <span>{index + 1}</span>
              <TextInput value={answer} onChange={(value) => patchAnswer(index, value)} />
              <TextInput type="number" min="0" value={(activity.textEntryAnswerWeights || [])[index] || 1} onChange={(value) => {
                const weights = [...(activity.textEntryAnswerWeights || [])];
                weights[index] = Math.max(0, Number(value) || 0);
                patch({ textEntryAnswerWeights: weights });
              }} />
              <SmallButton variant="danger" onClick={() => {
                const nextAnswers = answers.filter((_, answerIndex) => answerIndex !== index);
                const nextWeights = (activity.textEntryAnswerWeights || []).filter((_, answerIndex) => answerIndex !== index);
                patch({ textEntryAcceptedAnswers: nextAnswers, textEntryAnswerWeights: nextWeights });
              }}>
                Sil
              </SmallButton>
            </div>
          ))}
          <SmallButton variant="primary" onClick={() => patch({ textEntryAcceptedAnswers: [...answers, ''], textEntryAnswerWeights: [...(activity.textEntryAnswerWeights || []), 1] })}>
            + Anahtar Kelime Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="4" title="Degerlendirme Yontemi">
        <Field label="Yontem"><SelectInput value={activity.answerControl?.textEvaluation || 'keyword'} onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), textEvaluation: value } })} options={[{ value: 'keyword', label: 'Anahtar kelime tabanli' }, { value: 'manual', label: 'Manual degerlendirme' }]} /></Field>
        <ToggleRow label="Buyuk/kucuk harf duyarli" checked={activity.textEntryCaseSensitive} onChange={(checked) => patch({ textEntryCaseSensitive: checked })} />
        <Field label="Benzer ifade toleransi">
          <SelectInput
            value={activity.answerControl?.textTolerance || '20'}
            onChange={(value) => patch({ answerControl: { ...(activity.answerControl || {}), textTolerance: value } })}
            options={[
              { value: '0', label: '%0' },
              { value: '20', label: '%20' },
              { value: '40', label: '%40' },
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
      <CevapCard number="12" title="Rubrik Ozeti" wide>
        <MiniTable columns={['Anahtar Kelime', 'Agirlik', 'Durum']} rows={answers.map((answer, index) => ({ id: index, cells: [answer || '-', (activity.textEntryAnswerWeights || [])[index] || 1, answer ? 'Aktif' : 'Eksik'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
