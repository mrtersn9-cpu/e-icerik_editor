import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import {
  CevapCard,
  Field,
  PanelGrid,
  SmallButton,
  TextArea,
  ToggleRow,
} from '../components/CevapControls';

import { DenemeVeKisitlarCard, ErisilebilirlikCard, EtkinlikTuruCard, IpucuCard } from './OrtakCevapKartlari';

export default function FlashcardCevapPanel({ activity, onUpdate }) {
  const cards = activity.flashcards || [];
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchCard = (id, p) => patch({ flashcards: cards.map((card) => (card.id === id ? { ...card, ...p } : card)) });
  const addCard = () => patch({ flashcards: [...cards, { id: uid(), front: '', back: '' }] });
  const removeCard = (id) => patch({ flashcards: cards.filter((card) => card.id !== id) });
  const moveCard = (index, dir) => {
    const next = [...cards];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ flashcards: next });
  };
  const settings = activity.settings || {};

  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Çevirmeli bilgi kartları: öğrenci karta tıklayıp ön/arka yüzü görür, kartlar arasında gezinir."
      />
      <CevapCard number="2" title={`Kartlar (${cards.length})`} wide>
        <div style={{ display: 'grid', gap: 10 }}>
          {cards.map((card, index) => (
            <div
              key={card.id}
              style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#ffffff', display: 'grid', gap: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8' }}>Kart #{index + 1}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <SmallButton variant="secondary" onClick={() => moveCard(index, -1)} disabled={index === 0}>↑</SmallButton>
                  <SmallButton variant="secondary" onClick={() => moveCard(index, 1)} disabled={index === cards.length - 1}>↓</SmallButton>
                  <SmallButton variant="danger" onClick={() => removeCard(card.id)}>Sil</SmallButton>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                <Field label="Ön yüz">
                  <TextArea value={card.front || ''} onChange={(value) => patchCard(card.id, { front: value })} rows={2} />
                </Field>
                <Field label="Arka yüz">
                  <TextArea value={card.back || ''} onChange={(value) => patchCard(card.id, { back: value })} rows={2} />
                </Field>
              </div>
            </div>
          ))}
          {!cards.length && <span style={{ color: '#64748b', fontSize: 12 }}>Henüz kart yok.</span>}
          <SmallButton variant="primary" onClick={addCard}>+ Kart Ekle</SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Kart Ayarları">
        <ToggleRow
          label="Kartları karıştır"
          checked={!!settings.flashcardShuffle}
          onChange={(checked) => patch({ settings: { ...settings, flashcardShuffle: checked } })}
        />
        <ToggleRow
          label="İlerleme çubuğunu göster"
          checked={settings.flashcardProgress !== false}
          onChange={(checked) => patch({ settings: { ...settings, flashcardProgress: checked } })}
        />
      </CevapCard>
      <IpucuCard number="4" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="5" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="6" activity={activity} onUpdate={onUpdate} />
    </PanelGrid>
  );
}
