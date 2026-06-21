import { useState } from 'react';

import { uid } from '../../../utils/editorHelpers';
import { normalizeShortcutCombo, shortcutComboFromEvent } from '../../../utils/storylineRuntimeEngine';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, SmallButton, TextArea, TextInput } from '../components/CevapControls';

import { CanCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function KisayolTusuCevapPanel({ activity, onUpdate }) {
  const answers = activity.shortcutAnswers || [];
  const [capturingId, setCapturingId] = useState(null);
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchAnswer = (id, combo) => patch({ shortcutAnswers: answers.map((a) => (a.id === id ? { ...a, combo } : a)) });
  const addAnswer = () => patch({ shortcutAnswers: [...answers, { id: uid(), combo: '' }] });
  const removeAnswer = (id) => patch({ shortcutAnswers: answers.filter((a) => a.id !== id) });

  const onCaptureKey = (id, event) => {
    event.preventDefault();
    const combo = shortcutComboFromEvent(event.nativeEvent || event);
    if (!combo) return; // yalnız değiştirici basıldı, tuş bekle
    patchAnswer(id, combo);
    setCapturingId(null);
  };

  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Öğrenci doğru klavye kısayolunu basar (örn. Ctrl+S). Birden fazla kabul edilen kombinasyon tanımlayabilirsiniz."
      />
      <CevapCard number="2" title="Soru Yapısı">
        <Field label="Soru / prompt"><TextArea value={activity.shortcutPrompt || ''} onChange={(value) => patch({ shortcutPrompt: value })} /></Field>
      </CevapCard>
      <CevapCard number="3" title={`Kabul Edilen Kısayollar (${answers.length})`} wide>
        <div style={{ display: 'grid', gap: 10 }}>
          {answers.map((a, i) => (
            <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8' }}>Kısayol #{i + 1}</span>
                <SmallButton variant="danger" onClick={() => removeAnswer(a.id)}>Sil</SmallButton>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Field label="Kombinasyon (örn. Ctrl+Shift+P)">
                  <TextInput value={a.combo || ''} onChange={(value) => patchAnswer(a.id, value)} placeholder="Ctrl+S" />
                </Field>
                <button
                  type="button"
                  onClick={() => setCapturingId(a.id)}
                  onKeyDown={(e) => capturingId === a.id && onCaptureKey(a.id, e)}
                  onBlur={() => setCapturingId((c) => (c === a.id ? null : c))}
                  style={{
                    marginTop: 18,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `2px solid ${capturingId === a.id ? '#1d4ed8' : '#cbd5e1'}`,
                    background: capturingId === a.id ? '#eff6ff' : '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1e293b',
                    cursor: 'pointer',
                  }}
                >
                  {capturingId === a.id ? 'Tuşa bas…' : 'Tuşla yakala'}
                </button>
                {a.combo && (
                  <span style={{ marginTop: 18, fontSize: 11, color: '#64748b' }}>
                    Kanonik: <strong>{normalizeShortcutCombo(a.combo)}</strong>
                  </span>
                )}
              </div>
            </div>
          ))}
          <SmallButton variant="primary" onClick={addAnswer}>+ Kısayol Ekle</SmallButton>
          {!answers.length && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>En az bir kabul edilen kısayol ekleyin.</div>}
        </div>
      </CevapCard>
      <DogrulamaKurallariCard number="4" activity={activity} onUpdate={onUpdate} />
      <GeriBildirimCard number="5" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="6" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="7" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="8" activity={activity} onUpdate={onUpdate} />
      <CanCard number="9" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="10" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="11" title="Kısayol Özeti" wide>
        <MiniTable
          columns={['#', 'Kombinasyon', 'Kanonik']}
          rows={answers.map((a, i) => ({
            id: a.id,
            cells: [i + 1, a.combo || '—', normalizeShortcutCombo(a.combo) || '—'],
          }))}
        />
      </CevapCard>
    </PanelGrid>
  );
}
