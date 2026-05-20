import { generateAnswerObjectsForActivity } from '../../../logic/activityObjectGenerators';
import { changeActivityAnswerType, getAnswerTypeKey, patchActivity } from '../cevapActions';
import {
  getAnswerAccessibility,
  getAnswerControl,
  getAnswerFeedback,
  getAnswerHints,
  getAnswerScoring,
  withAnswerAccessibility,
  withAnswerControl,
  withAnswerFeedback,
  withAnswerHints,
  withAnswerScoring,
} from '../cevapSchema';
import {
  CevapCard,
  Field,
  SelectInput,
  TextArea,
  TextInput,
  ToggleRow,
} from '../components/CevapControls';

const ANSWER_TYPE_OPTIONS = [
  { value: 'selection', label: 'Çoktan Seçmeli' },
  { value: 'true-false', label: 'Doğru / Yanlış' },
  { value: 'drag-drop', label: 'Sürükle-Bırak' },
  { value: 'matching', label: 'Eşleştirme' },
  { value: 'sequence', label: 'Siralama' },
  { value: 'text-entry', label: 'Kısa Cevap' },
  { value: 'numeric', label: 'Sayısal Giriş' },
  { value: 'fill-blank', label: 'Boşluk Doldurma' },
  { value: 'survey', label: 'Anket' },
  { value: 'mixed', label: 'Karma' },
  { value: 'hotspot', label: 'Hotspot' },
  { value: 'puzzle', label: 'Bulmaca' },
];

export function EtkinlikTuruCard({
  number = '1',
  title = 'Etkinlik Turu',
  activity,
  onUpdate,
  description,
}) {
  return (
    <CevapCard number={number} title={title}>
      <Field label="Tur">
        <SelectInput
          value={getAnswerTypeKey(activity)}
          onChange={(value) => changeActivityAnswerType(activity, onUpdate, value)}
          options={ANSWER_TYPE_OPTIONS}
        />
      </Field>
      {description && (
        <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 10, lineHeight: 1.45 }}>
          {description}
        </p>
      )}
    </CevapCard>
  );
}

export function DogrulamaKurallariCard({ number, activity, onUpdate, children = null }) {
  const control = getAnswerControl(activity);
  const patch = (nextPatch) => patchActivity(activity, onUpdate, withAnswerControl(activity, nextPatch));
  return (
    <CevapCard number={number} title="Doğrulama Kuralları">
      <div style={{ display: 'grid', gap: 10 }}>
        <ToggleRow
          label="Anında geri bildirim göster"
          checked={activity.settings?.showFeedback !== false}
          onChange={(checked) =>
            patchActivity(activity, onUpdate, {
              settings: { ...(activity.settings || {}), showFeedback: checked },
            })
          }
        />
        <ToggleRow
          label="Doğru cevaptan sonra otomatik ilerle"
          checked={!!control.autoAdvanceOnCorrect}
          onChange={(checked) => patch({ autoAdvanceOnCorrect: checked })}
        />
        <ToggleRow
          label="Yanıtları kilitle"
          checked={control.lockAfterCheck}
          onChange={(checked) => patch({ lockAfterCheck: checked })}
        />
        <Field label="Kontrol sırasında düzenleme">
          <SelectInput
            value={control.editDuringCheck || 'locked'}
            onChange={(value) => patch({ editDuringCheck: value })}
            options={[
              { value: 'locked', label: 'Kilitli' },
              { value: 'editable', label: 'Düzenlenebilir' },
            ]}
          />
        </Field>
        {children}
      </div>
    </CevapCard>
  );
}

export function SahneyeUygulaCard({ activity, onUpdate, number = '99' }) {
  const handleApply = () => {
    if (!activity || !onUpdate) return;
    const newObjects = generateAnswerObjectsForActivity(activity);
    onUpdate({ ...activity, objects: newObjects });
  };

  return (
    <CevapCard number={number} title="Sahneye Uygula" wide>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.35 }}>
          Mevcut cevap ayarlarını sahne üzerindeki nesnelere dönüştürür.
          Önceki otomatik nesneler temizlenir.
        </div>
        <button
          onClick={handleApply}
          style={{
            minHeight: 30,
            padding: '0 12px',
            borderRadius: 7,
            border: 'none',
            background: '#1d4ed8',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>▶</span>
          Sahneye Uygula
        </button>
      </div>
    </CevapCard>
  );
}

export function DenemeVeKisitlarCard({ number = '10', activity, onUpdate }) {
  const patch = (nextPatch) => patchActivity(activity, onUpdate, nextPatch);
  const settings = activity.settings || {};
  return (
    <CevapCard number={number} title="Deneme ve Kısıtlar">
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Maksimum deneme">
          <TextInput
            type="number"
            min="0"
            value={settings.maxAttempts || 0}
            onChange={(value) => patch({ settings: { ...settings, maxAttempts: Math.max(0, Number(value) || 0) } })}
          />
        </Field>
        <ToggleRow
          label="Zaman sınırı"
          checked={!!settings.timeLimitEnabled}
          onChange={(checked) => patch({ settings: { ...settings, timeLimitEnabled: checked } })}
        />
        {settings.timeLimitEnabled && (
          <Field label="Süre (dk)">
            <TextInput
              type="number"
              min="1"
              value={settings.timeLimitMinutes || 5}
              onChange={(value) => patch({ settings: { ...settings, timeLimitMinutes: Math.max(1, Number(value) || 1) } })}
            />
          </Field>
        )}
      </div>
    </CevapCard>
  );
}

export function YanitKontrolCard({ number, activity, onUpdate, extraAction = null, title = 'Yanıt Kontrolü' }) {
  const control = getAnswerControl(activity);
  const patch = (nextPatch) => patchActivity(activity, onUpdate, withAnswerControl(activity, nextPatch));
  return (
    <CevapCard number={number} title={title}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Kontrol butonu metni">
          <TextInput
            value={control.checkButtonText}
            onChange={(value) => patch({ checkButtonText: value })}
          />
        </Field>
        <Field label="Cevabı göster butonu metni">
          <TextInput
            value={control.showAnswerText}
            onChange={(value) => patch({ showAnswerText: value })}
          />
        </Field>
        <Field label="Yeniden başlat butonu metni">
          <TextInput
            value={control.restartText}
            onChange={(value) => patch({ restartText: value })}
          />
        </Field>
        {extraAction}
        <Field label="Maksimum deneme">
          <TextInput
            type="number"
            min="0"
            value={control.maxAttempts}
            onChange={(value) => patch({ maxAttempts: Number(value) || 0 })}
          />
        </Field>
        <ToggleRow
          label="Otomatik kontrol"
          checked={control.autoCheck}
          onChange={(checked) => patch({ autoCheck: checked })}
        />
        <Field label="Deneme sınırına ulaşılınca">
          <SelectInput
            value={control.onAttemptsExhausted || 'show-answer'}
            onChange={(value) => patch({ onAttemptsExhausted: value })}
            options={[
              { value: 'show-answer', label: 'Cevabı göster' },
              { value: 'restart', label: 'Yeniden başlat' },
              { value: 'lock', label: 'Kilitle' },
            ]}
          />
        </Field>
        <Field label="Gecikme (sn)">
          <TextInput
            type="number"
            min="0"
            value={control.delaySeconds || 0}
            onChange={(value) => patch({ delaySeconds: Number(value) || 0 })}
          />
        </Field>
      </div>
    </CevapCard>
  );
}

export function GeriBildirimCard({ number, activity, onUpdate }) {
  const feedback = getAnswerFeedback(activity);
  const patch = (nextPatch) =>
    patchActivity(activity, onUpdate, withAnswerFeedback(activity, nextPatch));
  return (
    <CevapCard number={number} title="Geri Bildirim">
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Doğru yanıt">
          <TextArea
            value={feedback.correctMessage}
            onChange={(value) => patch({ correctMessage: value })}
          />
        </Field>
        <Field label="Yanlış / eksik yanıt">
          <TextArea
            value={feedback.incorrectMessage}
            onChange={(value) => patch({ incorrectMessage: value })}
          />
        </Field>
        <Field label="Eksik yanıt">
          <TextArea
            value={feedback.partialMessage}
            onChange={(value) => patch({ partialMessage: value })}
          />
        </Field>
        <Field label="Doğru ses">
          <SelectInput
            value={feedback.correctSound}
            onChange={(value) => patch({ correctSound: value })}
            options={[
              { value: 'success.mp3', label: 'success.mp3' },
              { value: 'dogru.mp3', label: 'dogru.mp3' },
              { value: 'none', label: 'Ses yok' },
            ]}
          />
        </Field>
        <Field label="Yanlış ses">
          <SelectInput
            value={feedback.incorrectSound}
            onChange={(value) => patch({ incorrectSound: value })}
            options={[
              { value: 'error.mp3', label: 'error.mp3' },
              { value: 'hata.mp3', label: 'hata.mp3' },
              { value: 'none', label: 'Ses yok' },
            ]}
          />
        </Field>
        <Field label="Başarı animasyonu">
          <SelectInput
            value={feedback.animation}
            onChange={(value) => patch({ animation: value })}
            options={[
              { value: 'Confetti', label: 'Confetti' },
              { value: 'Yesil Onay', label: 'Yesil Onay' },
              { value: 'Sallanma', label: 'Sallanma' },
              { value: 'Yok', label: 'Yok' },
            ]}
          />
        </Field>
        <Field label="Hata animasyonu">
          <SelectInput
            value={feedback.incorrectAnimation || 'Sallanma'}
            onChange={(value) => patch({ incorrectAnimation: value })}
            options={[
              { value: 'Sallanma', label: 'Sallanma' },
              { value: 'Kirmizi Carpi', label: 'Kirmizi Carpi' },
              { value: 'Hafif Titresim', label: 'Hafif Titresim' },
              { value: 'Yok', label: 'Yok' },
            ]}
          />
        </Field>
        <Field label="Hedef katman">
          <SelectInput
            value={feedback.targetLayer || 'feedback'}
            onChange={(value) => patch({ targetLayer: value })}
            options={[
              { value: 'feedback', label: 'Geri Bildirim Katmani' },
              { value: 'success', label: 'Basari Katmani' },
              { value: 'failure', label: 'Hata Katmani' },
            ]}
          />
        </Field>
        <Field label="Geri bildirim gecikmesi (sn)">
          <TextInput
            type="number"
            min="0"
            step="0.5"
            value={feedback.feedbackDelay || 0}
            onChange={(value) => patch({ feedbackDelay: Number(value) || 0 })}
          />
        </Field>
      </div>
    </CevapCard>
  );
}

export function PuanlamaCard({ number, activity, onUpdate }) {
  const scoring = getAnswerScoring(activity);
  const patch = (nextPatch) => patchActivity(activity, onUpdate, withAnswerScoring(activity, nextPatch));
  return (
    <CevapCard number={number} title="Puanlama">
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Tam puan">
          <TextInput
            type="number"
            min="0"
            value={scoring.fullScore}
            onChange={(value) => patch({ fullScore: Number(value) || 0 })}
          />
        </Field>
        <ToggleRow
          label="Kısmi puanlama"
          checked={scoring.partialScore}
          onChange={(checked) => patch({ partialScore: checked })}
        />
        <Field label="Başarı eşiği (%)">
          <TextInput
            type="number"
            min="0"
            max="100"
            value={scoring.passingScore}
            onChange={(value) => patch({ passingScore: Number(value) || 0 })}
          />
        </Field>
        <Field label="Yanlış cevap cezası">
          <TextInput
            type="number"
            min="0"
            value={scoring.penalty}
            onChange={(value) => patch({ penalty: Number(value) || 0 })}
          />
        </Field>
      </div>
    </CevapCard>
  );
}

export function IpucuCard({ number, activity, onUpdate }) {
  const hints = getAnswerHints(activity);
  const patch = (nextPatch) => patchActivity(activity, onUpdate, withAnswerHints(activity, nextPatch));
  return (
    <CevapCard number={number} title="İpucu ve Açıklama">
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="İpucu metni">
          <TextArea value={hints.hintText} onChange={(value) => patch({ hintText: value })} />
        </Field>
        <Field label="İpucu gosterimi">
          <SelectInput
            value={hints.hintTiming}
            onChange={(value) => patch({ hintTiming: value })}
            options={[
              { value: 'manual', label: 'Butona tiklandiginda' },
              { value: 'after-wrong', label: 'Yanlis cevaptan sonra' },
              { value: 'always', label: 'Her zaman' },
            ]}
          />
        </Field>
        <Field label="Açıklama metni">
          <TextArea
            value={hints.explanationText}
            onChange={(value) => patch({ explanationText: value })}
          />
        </Field>
      </div>
    </CevapCard>
  );
}

export function ErisilebilirlikCard({ number, activity, onUpdate }) {
  const accessibility = getAnswerAccessibility(activity);
  const patch = (nextPatch) =>
    patchActivity(activity, onUpdate, withAnswerAccessibility(activity, nextPatch));
  return (
    <CevapCard number={number} title="Erişilebilirlik">
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Ekran okuyucu etiketi">
          <TextInput
            value={accessibility.label}
            onChange={(value) => patch({ label: value })}
            placeholder="Etkinlik cevap kontrolu"
          />
        </Field>
        <Field label="Ekran okuyucu cümlesi">
          <TextArea
            value={accessibility.screenReaderText}
            onChange={(value) => patch({ screenReaderText: value })}
          />
        </Field>
        <ToggleRow
          label="Klavye modu"
          checked={accessibility.keyboardMode}
          onChange={(checked) => patch({ keyboardMode: checked })}
        />
        <ToggleRow
          label="Yüksek kontrast uyumu"
          checked={accessibility.highContrast}
          onChange={(checked) => patch({ highContrast: checked })}
        />
      </div>
    </CevapCard>
  );
}
