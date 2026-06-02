import { uid } from '../../../utils/editorHelpers';
import {
  addMcOption,
  patchActivity,
  patchMcOption,
  removeMcOption,
  setSingleCorrectOption,
} from '../cevapActions';
import { getAnswerSummary } from '../cevapSelectors';
import {
  CevapCard,
  ChoiceButton,
  Field,
  MiniPreview,
  MiniTable,
  PanelGrid,
  SelectInput,
  SmallButton,
  TextArea,
  TextInput,
  ToggleRow,
} from '../components/CevapControls';

import { DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function SecmeCevapPanel({ activity, onUpdate }) {
  const summary = getAnswerSummary(activity);
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const savedQuestions = activity.savedQuestions || [];

  const saveCurrentQuestion = () => {
    const q = {
      id: uid(),
      question: activity.mcQuestion || '',
      options: (activity.mcOptions || []).map((o) => ({ ...o })),
      mcMode: activity.mcMode || 'single',
    };
    patch({ savedQuestions: [...savedQuestions, q] });
  };

  const loadQuestion = (q) => {
    patch({
      mcQuestion: q.question,
      mcOptions: (q.options || []).map((o) => ({ ...o })),
      mcMode: q.mcMode || 'single',
    });
  };

  const deleteSavedQuestion = (id) => {
    patch({ savedQuestions: savedQuestions.filter((q) => q.id !== id) });
  };

  const moveSavedQuestion = (index, direction) => {
    const next = [...savedQuestions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ savedQuestions: next });
  };

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {savedQuestions.length > 0 && (
        <div
          style={{
            width: 220,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 'calc(100vh - 140px)',
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#334155', padding: '4px 0' }}>
            Kaydedilmiş Sorular ({savedQuestions.length})
          </div>
          {savedQuestions.map((q, idx) => (
            <div
              key={q.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 10,
                background: '#ffffff',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                #{idx + 1} {q.question || 'Adsız Soru'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {q.options?.length || 0} seçenek · {(q.options || []).filter((o) => o.isCorrect).length} doğru
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <SmallButton variant="primary" onClick={() => loadQuestion(q)}>Yükle</SmallButton>
                <SmallButton variant="secondary" onClick={() => moveSavedQuestion(idx, -1)} disabled={idx === 0}>↑</SmallButton>
                <SmallButton variant="secondary" onClick={() => moveSavedQuestion(idx, 1)} disabled={idx === savedQuestions.length - 1}>↓</SmallButton>
                <SmallButton variant="danger" onClick={() => deleteSavedQuestion(q.id)}>Sil</SmallButton>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PanelGrid>
          <EtkinlikTuruCard
            activity={activity}
            onUpdate={onUpdate}
            description="Kullanıcı bir veya birden fazla doğru seçeneği seçer."
          />
          <CevapCard number="2" title={`Seçenek Listesi (${summary.options.length})`} wide>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Field label="Soru metni">
                  <TextArea value={activity.mcQuestion || ''} onChange={(value) => patch({ mcQuestion: value })} />
                </Field>
                <button
                  onClick={saveCurrentQuestion}
                  style={{
                    marginLeft: 10,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #c7d9f1',
                    background: '#ffffff',
                    color: '#2563eb',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Soruyu Kaydet
                </button>
              </div>
              {summary.options.map((option, index) => (
                <div key={option.id} style={{ display: 'grid', gridTemplateColumns: '38px minmax(0,1fr) 60px auto 34px', gap: 8, alignItems: 'center' }}>
                  <span style={{ height: 32, borderRadius: 8, border: '1px solid #bfdbfe', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{String.fromCharCode(65 + index)}</span>
                  <TextInput value={option.label} onChange={(value) => patchMcOption(activity, onUpdate, option.id, { label: value })} />
                  <TextInput type="number" min="0" value={option.points || 1} onChange={(value) => patchMcOption(activity, onUpdate, option.id, { points: Math.max(0, Number(value) || 0) })} />
                  <input
                    type={(activity.mcMode || 'single') === 'multi' ? 'checkbox' : 'radio'}
                    checked={!!option.isCorrect}
                    onChange={(event) =>
                      (activity.mcMode || 'single') === 'multi'
                        ? patchMcOption(activity, onUpdate, option.id, { isCorrect: event.target.checked })
                        : setSingleCorrectOption(activity, onUpdate, option.id)
                    }
                    style={{ width: 18, height: 18, accentColor: '#16a34a' }}
                  />
                  <SmallButton
                    variant="danger"
                    ariaLabel={`${String.fromCharCode(65 + index)} seçeneğini sil`}
                    onClick={() => removeMcOption(activity, onUpdate, option.id)}
                  >
                    Sil
                  </SmallButton>
                </div>
              ))}
              <SmallButton variant="primary" onClick={() => addMcOption(activity, onUpdate)}>
                + Seçenek Ekle
              </SmallButton>
            </div>
          </CevapCard>
          <CevapCard number="3" title="Soru Yapısı">
            <Field label="Seçim türü">
              <SelectInput value={activity.mcMode || 'single'} onChange={(value) => patch({ mcMode: value })} options={[{ value: 'single', label: 'Tekli seçim' }, { value: 'multi', label: 'Çoklu seçim' }]} />
            </Field>
            <ToggleRow label="Seçenek sırasını karıştır" checked={activity.settings?.shuffleOptions} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), shuffleOptions: checked } })} />
            <ToggleRow label="Soru sırasını karıştır" checked={activity.settings?.shuffleQuestions} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), shuffleQuestions: checked } })} />
          </CevapCard>
          <CevapCard number="4" title="Cevap Formu - Doğru Seçenekler">
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {summary.options.map((option, index) => {
                  const letter = String.fromCharCode(65 + index);
                  return (
                    <ChoiceButton
                      key={option.id}
                      selected={!!option.isCorrect}
                      tone={option.isCorrect ? 'green' : 'blue'}
                      onClick={() =>
                        (activity.mcMode || 'single') === 'multi'
                          ? patchMcOption(activity, onUpdate, option.id, { isCorrect: !option.isCorrect })
                          : setSingleCorrectOption(activity, onUpdate, option.id)
                      }
                    >
                      {letter}. {option.label || `Seçenek ${index + 1}`}
                    </ChoiceButton>
                  );
                })}
              </div>
              {!summary.options.length && <span style={{ color: '#64748b', fontSize: 12 }}>0 seçenek</span>}
              <MiniPreview
                label="Seçili doğru cevap"
                value={summary.correctOptions.map((option) => option.label).join(', ')}
                empty="Henüz doğru seçenek seçilmedi"
                tone={summary.correctOptions.length ? 'green' : 'slate'}
              />
            </div>
          </CevapCard>
          <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
          <GeriBildirimCard number="6" activity={activity} onUpdate={onUpdate} />
          <YanitKontrolCard number="7" title="Yanitlama" activity={activity} onUpdate={onUpdate} />
          <PuanlamaCard number="8" activity={activity} onUpdate={onUpdate} />
          <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
          <DenemeVeKisitlarCard number="10" activity={activity} onUpdate={onUpdate} />
          <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
          <CevapCard number="10" title="Seçenek Haritası" wide>
            <MiniTable
              columns={['Seçenek', 'Metin', 'Doğru', 'Puan']}
              rows={summary.options.map((option, index) => ({ id: option.id, cells: [String.fromCharCode(65 + index), option.label || '-', option.isCorrect ? '✓' : '', option.points || 1] }))}
            />
          </CevapCard>
        </PanelGrid>
      </div>
    </div>
  );
}
