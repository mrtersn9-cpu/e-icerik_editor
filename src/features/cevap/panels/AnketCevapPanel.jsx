import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, SelectInput, SmallButton, TextArea, TextInput, ToggleRow } from '../components/CevapControls';

import { CanCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

const DEFAULT_LIKERT_OPTIONS = ['Kesinlikle katılmıyorum', 'Katılmıyorum', 'Kararsızım', 'Katılıyorum', 'Kesinlikle katılıyorum'];

export default function AnketCevapPanel({ activity, onUpdate }) {
  const questions = activity.surveyQuestions || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchQuestion = (id, p) => patch({ surveyQuestions: questions.map((question) => (question.id === id ? { ...question, ...p } : question)) });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Cevap anahtarı olmayan görüş ve veri toplama etkinliği."
      />
      <CevapCard number="2" title={`Yanıt Formu - Anket Soruları (${questions.length})`} wide>
        <div style={{ display: 'grid', gap: 8 }}>
          {questions.map((question, index) => (
            <div key={question.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
              <Field label={`Soru ${index + 1}`}><TextArea value={question.prompt} onChange={(value) => patchQuestion(question.id, { prompt: value })} /></Field>
              <Field label="Tip">
                <SelectInput
                  value={question.type || 'likert'}
                  onChange={(value) => {
                    // Likert/seçenekli tipe geçilince ve seçenek yoksa makul varsayılan doldur.
                    const nextOptions =
                      (value === 'likert' || value === 'choice') && !(question.options || []).length
                        ? (value === 'likert' ? [...DEFAULT_LIKERT_OPTIONS] : ['Seçenek 1', 'Seçenek 2'])
                        : question.options;
                    patchQuestion(question.id, { type: value, options: nextOptions });
                  }}
                  options={[{ value: 'likert', label: 'Likert' }, { value: 'open-text', label: 'Açık metin' }, { value: 'choice', label: 'Seçenekli' }]}
                />
              </Field>
              {(question.type === 'likert' || question.type === 'choice') && (
                <Field label="Seçenekler">
                  <div style={{ display: 'grid', gap: 6 }}>
                    {(question.options || []).map((opt, optIndex) => (
                      <div key={optIndex} style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: 6 }}>
                        <TextInput
                          value={opt}
                          onChange={(value) =>
                            patchQuestion(question.id, {
                              options: (question.options || []).map((o, i) => (i === optIndex ? value : o)),
                            })
                          }
                        />
                        <SmallButton
                          variant="danger"
                          onClick={() =>
                            patchQuestion(question.id, {
                              options: (question.options || []).filter((_, i) => i !== optIndex),
                            })
                          }
                        >
                          ×
                        </SmallButton>
                      </div>
                    ))}
                    <SmallButton
                      onClick={() =>
                        patchQuestion(question.id, {
                          options: [...(question.options || []), `Seçenek ${(question.options || []).length + 1}`],
                        })
                      }
                    >
                      + Seçenek Ekle
                    </SmallButton>
                  </div>
                </Field>
              )}
              <SmallButton
                variant="danger"
                onClick={() => patch({ surveyQuestions: questions.filter((item) => item.id !== question.id) })}
              >
                Sil
              </SmallButton>
            </div>
          ))}
          <SmallButton variant="primary" onClick={() => patch({ surveyQuestions: [...questions, { id: uid(), prompt: `Soru ${questions.length + 1}`, type: 'likert', options: [...DEFAULT_LIKERT_OPTIONS] }] })}>
            + Soru Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Gizlilik ve Kayıt">
        <ToggleRow label="Anonim cevap" checked={activity.surveyAnonymous !== false} onChange={(checked) => patch({ surveyAnonymous: checked })} />
        <ToggleRow label="Geri bildirim göster" checked={activity.settings?.showFeedback !== false} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), showFeedback: checked } })} />
      </CevapCard>
      <GeriBildirimCard number="4" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="5" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="6" activity={activity} onUpdate={onUpdate} />
      <CanCard number="7" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="8" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="9" title="Anket Özeti" wide>
        <MiniTable columns={['#', 'Soru', 'Tip']} rows={questions.map((question, index) => ({ id: question.id, cells: [index + 1, question.prompt || '-', question.type || 'likert'] }))} />
      </CevapCard>
      <CevapCard number="10" title="Yanıt Dağılımı (Önizleme)" wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((q, idx) => (
            <div key={q.id}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 8 }}>
                {idx + 1}. {q.prompt || 'Soru'}
              </div>
              {q.type === 'likert' || q.type === 'choice' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(q.options || []).map((opt, optIdx) => (
                    <div key={`${optIdx}-${opt}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, width: 80, color: '#475569' }}>{opt}</span>
                      <div style={{ flex: 1, height: 14, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            // Mock dağılım: her render'da zıplamasın diye deterministik (Math.random degil)
                            width: `${25 + ((optIdx * 27 + String(opt || '').length * 13) % 60)}%`,
                            height: '100%',
                            background: '#3b82f6',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b' }}>Açık metin yanıtları grafikte gösterilemez.</div>
              )}
            </div>
          ))}
          {questions.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>Henüz soru eklenmemiş.</div>
          )}
        </div>
      </CevapCard>
    </PanelGrid>
  );
}
