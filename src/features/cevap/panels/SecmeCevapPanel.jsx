import { useEffect, useRef, useState } from 'react';

import { fileToDataUrl } from '../../../api/apiClient';
import {
  addQuickChoices,
  applyMcOptionsMigration,
  loadChoicesFromOptions,
  patchActivity,
  patchChoiceObject,
  removeChoice,
  setChoiceCorrect,
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

import { CanCard, DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

function getChoiceText(choice = {}) {
  return choice.selectionChoice || choice.label || choice.text || '';
}

function ChoiceImageButton({ choice, activity, onUpdate }) {
  const inputRef = useRef(null);
  const hasImage = !!choice.imageData;
  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    fileToDataUrl(file)
      .then((dataUrl) => patchChoiceObject(activity, onUpdate, choice.id, { imageData: dataUrl }))
      .catch(() => {});
  };
  return (
    <div style={{ position: 'relative', width: 44, height: 32 }}>
      <button
        type="button"
        title={hasImage ? 'Görseli değiştir' : 'Görsel ekle'}
        onClick={() => inputRef.current?.click()}
        style={{
          width: 44,
          height: 32,
          borderRadius: 8,
          border: `1px solid ${hasImage ? '#86efac' : '#dbe7f5'}`,
          background: hasImage ? `center/cover no-repeat url(${choice.imageData})` : '#ffffff',
          cursor: 'pointer',
          fontSize: 14,
          color: '#1d4ed8',
          padding: 0,
        }}
      >
        {hasImage ? '' : '🖼'}
      </button>
      {hasImage && (
        <button
          type="button"
          title="Görseli kaldır"
          onClick={() => patchChoiceObject(activity, onUpdate, choice.id, { imageData: null })}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 16,
            height: 16,
            borderRadius: 999,
            border: 'none',
            background: '#dc2626',
            color: '#fff',
            fontSize: 10,
            lineHeight: '16px',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
    </div>
  );
}

function ValidationChecklist({ activity, summary }) {
  const choices = summary.choices;
  const checks = [
    { ok: !!String(activity.mcQuestion || '').trim(), label: 'Soru metni girildi' },
    { ok: choices.length >= 2, label: 'En az 2 seçenek var' },
    {
      ok: choices.length > 0 && choices.every((choice) => String(getChoiceText(choice)).trim() || choice.imageData),
      label: 'Her seçeneğin metni veya görseli var',
    },
    { ok: summary.correctChoices.length >= 1, label: 'En az 1 doğru seçenek işaretli' },
  ];
  const allOk = checks.every((check) => check.ok);
  return (
    <div
      style={{
        display: 'grid',
        gap: 5,
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${allOk ? '#bbf7d0' : '#fde68a'}`,
        background: allOk ? '#f0fdf4' : '#fffbeb',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: allOk ? '#166534' : '#92400e' }}>
        {allOk ? '✓ Soru yayına hazır' : 'Tamamlanması gerekenler'}
      </div>
      {checks.map((check) => (
        <div
          key={check.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: check.ok ? '#166534' : '#9a3412',
          }}
        >
          <span style={{ width: 14, textAlign: 'center', fontWeight: 900 }}>{check.ok ? '✓' : '○'}</span>
          {check.label}
        </div>
      ))}
    </div>
  );
}

export default function SecmeCevapPanel({ activity, onUpdate }) {
  const summary = getAnswerSummary(activity);
  const choices = summary.choices;
  const mcMode = activity.mcMode || 'single';
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const [openFeedbackIds, setOpenFeedbackIds] = useState(() => new Set());
  const toggleFeedback = (id) =>
    setOpenFeedbackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Eski form (mcOptions) içeriğini bir kez sahne nesnelerine göçür ve mcOptions'ı boşalt.
  // Böylece freeform modelinde nesneler tek doğru kaynak olur (runtime selectionCorrect'e bakar).
  const mcOptionsLength = (activity.mcOptions || []).length;
  useEffect(() => {
    if (mcOptionsLength > 0) applyMcOptionsMigration(activity, onUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcOptionsLength]);

  const savedQuestions = activity.savedQuestions || [];
  const [poolFilter, setPoolFilter] = useState('all');
  const filteredPool =
    poolFilter === 'all'
      ? savedQuestions
      : savedQuestions.filter((q) => (q.difficulty || 'orta') === poolFilter);
  const diffCounts = savedQuestions.reduce((acc, q) => {
    const key = q.difficulty || 'orta';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const saveCurrentQuestion = () => {
    const options = choices.map((choice) => ({
      id: choice.selectionOptionId || choice.id,
      label: getChoiceText(choice),
      isCorrect: !!choice.selectionCorrect,
      image: choice.imageData || '',
      feedback: choice.optionFeedback || '',
    }));
    const q = {
      id: `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      question: activity.mcQuestion || '',
      options,
      mcMode,
      difficulty: 'orta',
      tag: '',
    };
    patch({ savedQuestions: [...savedQuestions, q] });
  };

  const loadQuestion = (q) => {
    loadChoicesFromOptions(activity, onUpdate, q.options || [], q.mcMode || 'single', q.question || '');
  };

  const loadRandomQuestion = () => {
    if (!filteredPool.length) return;
    loadQuestion(filteredPool[Math.floor(Math.random() * filteredPool.length)]);
  };

  const patchSavedQuestion = (id, nextPatch) =>
    patch({ savedQuestions: savedQuestions.map((q) => (q.id === id ? { ...q, ...nextPatch } : q)) });

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

  const onCorrectChange = (choice, checked) => {
    // Tekli modda radyo: tıklanan seçenek doğru olur (diğerleri sıfırlanır).
    // Çoklu modda checkbox: tek tek aç/kapat.
    setChoiceCorrect(activity, onUpdate, choice.id, mcMode === 'multi' ? checked : true);
  };

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {savedQuestions.length > 0 && (
        <div
          style={{
            flex: '1 1 200px',
            minWidth: 180,
            maxWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 'min(60vh, calc(100vh - 160px))',
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#334155' }}>
              Soru Havuzu ({savedQuestions.length})
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                ['all', 'Hepsi', savedQuestions.length],
                ['kolay', 'Kolay', diffCounts.kolay || 0],
                ['orta', 'Orta', diffCounts.orta || 0],
                ['zor', 'Zor', diffCounts.zor || 0],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPoolFilter(key)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: `1px solid ${poolFilter === key ? '#1d4ed8' : '#dbe7f5'}`,
                    background: poolFilter === key ? '#eff6ff' : '#ffffff',
                    color: poolFilter === key ? '#1d4ed8' : '#64748b',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {label} {count}
                </button>
              ))}
            </div>
            <SmallButton variant="primary" onClick={loadRandomQuestion} disabled={!filteredPool.length}>
              🎲 Rastgele Yükle
            </SmallButton>
            <ToggleRow
              label="Her oturumda havuzdan rastgele soru göster"
              checked={!!activity.settings?.poolDrawRandom}
              onChange={(checked) => patch({ settings: { ...(activity.settings || {}), poolDrawRandom: checked } })}
              hint="Önizleme ve SCORM'da, açılışta havuzdan rastgele bir soru seçilir."
            />
          </div>
          {savedQuestions.map((q, idx) => {
            const diff = q.difficulty || 'orta';
            const dim = poolFilter !== 'all' && diff !== poolFilter;
            return (
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
                  opacity: dim ? 0.45 : 1,
                }}
              >
                <div style={{ fontWeight: 800, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  #{idx + 1} {q.question || 'Adsız Soru'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {q.options?.length || 0} seçenek · {(q.options || []).filter((o) => o.isCorrect).length} doğru
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '88px minmax(0,1fr)', gap: 4 }}>
                  <select
                    value={diff}
                    onChange={(event) => patchSavedQuestion(q.id, { difficulty: event.target.value })}
                    style={{ height: 28, borderRadius: 7, border: '1px solid #dbe7f5', fontSize: 10.5, padding: '0 6px', background: '#fff' }}
                  >
                    <option value="kolay">Kolay</option>
                    <option value="orta">Orta</option>
                    <option value="zor">Zor</option>
                  </select>
                  <input
                    value={q.tag || ''}
                    placeholder="Etiket / konu"
                    onChange={(event) => patchSavedQuestion(q.id, { tag: event.target.value })}
                    style={{ height: 28, borderRadius: 7, border: '1px solid #dbe7f5', fontSize: 10.5, padding: '0 8px', minWidth: 0 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <SmallButton variant="primary" onClick={() => loadQuestion(q)}>Yükle</SmallButton>
                  <SmallButton variant="secondary" onClick={() => moveSavedQuestion(idx, -1)} disabled={idx === 0}>↑</SmallButton>
                  <SmallButton variant="secondary" onClick={() => moveSavedQuestion(idx, 1)} disabled={idx === savedQuestions.length - 1}>↓</SmallButton>
                  <SmallButton variant="danger" onClick={() => deleteSavedQuestion(q.id)}>Sil</SmallButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ flex: '999 1 320px', minWidth: 0 }}>
        <PanelGrid>
          <EtkinlikTuruCard
            activity={activity}
            onUpdate={onUpdate}
            description="Sahnedeki herhangi bir öğeyi seçenek yapabilirsin: öğeye sağ tıkla → 'Seçenek yap', sonra 'Doğru işaretle'."
          />
          <CevapCard number="2" title={`Seçenekler (${choices.length})`} wide>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <Field label="Soru metni">
                  <TextArea value={activity.mcQuestion || ''} onChange={(value) => patch({ mcQuestion: value })} />
                </Field>
                <button
                  onClick={saveCurrentQuestion}
                  disabled={!choices.length}
                  style={{
                    marginLeft: 10,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #c7d9f1',
                    background: '#ffffff',
                    color: '#2563eb',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: choices.length ? 'pointer' : 'default',
                    opacity: choices.length ? 1 : 0.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Soruyu Kaydet
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.4 }}>
                Her satır sahnedeki bir seçenek nesnesidir. Metnini, görselini, doğru/yanlış
                durumunu buradan veya öğeye sağ tıklayarak ayarla.
              </div>
              {choices.map((choice, index) => {
                const letter = String.fromCharCode(65 + index);
                const feedbackOpen = openFeedbackIds.has(choice.id);
                return (
                  <div key={choice.id} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 44px auto 32px 34px', gap: 7, alignItems: 'center' }}>
                      <span style={{ height: 32, borderRadius: 8, border: '1px solid #bfdbfe', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{letter}</span>
                      <TextInput
                        value={getChoiceText(choice)}
                        placeholder="Seçenek metni"
                        onChange={(value) => patchChoiceObject(activity, onUpdate, choice.id, { label: value, selectionChoice: value })}
                      />
                      <ChoiceImageButton choice={choice} activity={activity} onUpdate={onUpdate} />
                      <input
                        type={mcMode === 'multi' ? 'checkbox' : 'radio'}
                        checked={!!choice.selectionCorrect}
                        onChange={(event) => onCorrectChange(choice, event.target.checked)}
                        title="Doğru cevap"
                        style={{ width: 18, height: 18, accentColor: '#16a34a' }}
                      />
                      <button
                        type="button"
                        title="Seçeneğe özel geri bildirim"
                        onClick={() => toggleFeedback(choice.id)}
                        style={{
                          height: 32,
                          borderRadius: 8,
                          border: `1px solid ${choice.optionFeedback ? '#bfdbfe' : '#dbe7f5'}`,
                          background: feedbackOpen || choice.optionFeedback ? '#eff6ff' : '#ffffff',
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          fontSize: 13,
                          padding: 0,
                        }}
                      >
                        💬
                      </button>
                      <SmallButton
                        variant="danger"
                        ariaLabel={`${letter} seçeneğini kaldır`}
                        onClick={() => removeChoice(activity, onUpdate, choice.id)}
                      >
                        Sil
                      </SmallButton>
                    </div>
                    {feedbackOpen && (
                      <div style={{ paddingLeft: 41 }}>
                        <TextInput
                          value={choice.optionFeedback || ''}
                          placeholder={`${letter} şıkkı seçilince gösterilecek mesaj`}
                          onChange={(value) => patchChoiceObject(activity, onUpdate, choice.id, { optionFeedback: value })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {!choices.length && (
                <div style={{ fontSize: 11, color: '#64748b', padding: '4px 0' }}>
                  Henüz seçenek yok. Aşağıdan hızlıca ekle ya da sahnedeki bir öğeye sağ tıklayıp
                  &quot;Seçenek yap&quot; de.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SmallButton variant="primary" onClick={() => addQuickChoices(activity, onUpdate, 1)}>
                  + Seçenek Ekle
                </SmallButton>
                <SmallButton variant="secondary" onClick={() => addQuickChoices(activity, onUpdate, 3)}>
                  + 3 Boş Seçenek
                </SmallButton>
              </div>
            </div>
          </CevapCard>
          <CevapCard number="3" title="Soru Yapısı">
            <Field label="Seçim türü">
              <SelectInput value={mcMode} onChange={(value) => patch({ mcMode: value })} options={[{ value: 'single', label: 'Tekli seçim' }, { value: 'multi', label: 'Çoklu seçim' }]} />
            </Field>
            <ToggleRow label="Seçenek sırasını karıştır" checked={activity.settings?.shuffleOptions} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), shuffleOptions: checked } })} />
            <ToggleRow label="Soru sırasını karıştır" checked={activity.settings?.shuffleQuestions} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), shuffleQuestions: checked } })} />
          </CevapCard>
          <CevapCard number="4" title="Doğru Seçenekler">
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {choices.map((choice, index) => {
                  const letter = String.fromCharCode(65 + index);
                  return (
                    <ChoiceButton
                      key={choice.id}
                      selected={!!choice.selectionCorrect}
                      tone={choice.selectionCorrect ? 'green' : 'blue'}
                      onClick={() => onCorrectChange(choice, !choice.selectionCorrect)}
                    >
                      {letter}. {getChoiceText(choice) || `Seçenek ${index + 1}`}
                    </ChoiceButton>
                  );
                })}
              </div>
              {!choices.length && <span style={{ color: '#64748b', fontSize: 12 }}>0 seçenek</span>}
              <MiniPreview
                label="Seçili doğru cevap"
                value={summary.correctChoices.map((choice) => getChoiceText(choice)).join(', ')}
                empty="Henüz doğru seçenek seçilmedi"
                tone={summary.correctChoices.length ? 'green' : 'slate'}
              />
              <ValidationChecklist activity={activity} summary={summary} />
            </div>
          </CevapCard>
          <DogrulamaKurallariCard number="5" activity={activity} onUpdate={onUpdate} />
          <GeriBildirimCard number="6" activity={activity} onUpdate={onUpdate} />
          <YanitKontrolCard number="7" title="Yanitlama" activity={activity} onUpdate={onUpdate} />
          <PuanlamaCard number="8" activity={activity} onUpdate={onUpdate} />
          <IpucuCard number="9" activity={activity} onUpdate={onUpdate} />
          <DenemeVeKisitlarCard number="10" activity={activity} onUpdate={onUpdate} />
          <CanCard number="11" activity={activity} onUpdate={onUpdate} />
          <ErisilebilirlikCard number="12" activity={activity} onUpdate={onUpdate} />
          <CevapCard number="13" title="Seçenek Haritası" wide>
            <MiniTable
              columns={['Seçenek', 'Metin', 'Doğru']}
              rows={choices.map((choice, index) => ({
                id: choice.id,
                cells: [String.fromCharCode(65 + index), getChoiceText(choice) || '-', choice.selectionCorrect ? '✓' : ''],
              }))}
            />
          </CevapCard>
        </PanelGrid>
      </div>
    </div>
  );
}
