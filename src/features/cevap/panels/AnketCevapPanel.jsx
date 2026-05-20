import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, SelectInput, SmallButton, TextArea, ToggleRow } from '../components/CevapControls';

import { ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function AnketCevapPanel({ activity, onUpdate }) {
  const questions = activity.surveyQuestions || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchQuestion = (id, p) => patch({ surveyQuestions: questions.map((question) => (question.id === id ? { ...question, ...p } : question)) });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Cevap anahtari olmayan gorus ve veri toplama etkinligi."
      />
      <CevapCard number="2" title={`Yanit Formu - Anket Sorulari (${questions.length})`} wide>
        <div style={{ display: 'grid', gap: 8 }}>
          {questions.map((question, index) => (
            <div key={question.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
              <Field label={`Soru ${index + 1}`}><TextArea value={question.prompt} onChange={(value) => patchQuestion(question.id, { prompt: value })} /></Field>
              <Field label="Tip"><SelectInput value={question.type || 'likert'} onChange={(value) => patchQuestion(question.id, { type: value })} options={[{ value: 'likert', label: 'Likert' }, { value: 'open-text', label: 'Acik metin' }, { value: 'choice', label: 'Secenekli' }]} /></Field>
              <SmallButton
                variant="danger"
                onClick={() => patch({ surveyQuestions: questions.filter((item) => item.id !== question.id) })}
              >
                Sil
              </SmallButton>
            </div>
          ))}
          <SmallButton variant="primary" onClick={() => patch({ surveyQuestions: [...questions, { id: uid(), prompt: `Soru ${questions.length + 1}`, type: 'likert', options: [] }] })}>
            + Soru Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Gizlilik ve Kayit">
        <ToggleRow label="Anonim cevap" checked={activity.surveyAnonymous !== false} onChange={(checked) => patch({ surveyAnonymous: checked })} />
        <ToggleRow label="Geri bildirim goster" checked={activity.settings?.showFeedback !== false} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), showFeedback: checked } })} />
      </CevapCard>
      <GeriBildirimCard number="4" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="5" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="6" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="7" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="8" title="Anket Ozeti" wide>
        <MiniTable columns={['#', 'Soru', 'Tip']} rows={questions.map((question, index) => ({ id: question.id, cells: [index + 1, question.prompt || '-', question.type || 'likert'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
