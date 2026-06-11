import { useRef } from 'react';

import { fileToDataUrl } from '../../../api/apiClient';
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
import {
  DEFAULT_LIVES_COUNT,
  LIVES_ICON_PRESETS,
  getLivesConfig,
} from '../livesIcons';

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

export function CanCard({ number = '12', activity, onUpdate }) {
  const fileInputRef = useRef(null);
  const lives = getLivesConfig(activity);
  // Can ayarları answerControl'a yazılır — bu anahtar SCORM runtime'ına taşınır,
  // böylece can hem editör önizlemesinde hem SCORM çıktısında çalışır.
  const patchLives = (nextPatch) => {
    const base = withAnswerControl(activity, nextPatch);
    // Kapatırken eski sürümlerden kalan settings.livesEnabled kalıntısını da
    // temizle; aksi halde answerControl silinirse kalpler geri gelebiliyordu.
    if (nextPatch.livesEnabled === false && base.settings) {
      base.settings = { ...base.settings, livesEnabled: false };
    }
    patchActivity(activity, onUpdate, base);
  };

  const handleCustomUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    fileToDataUrl(file)
      .then((dataUrl) => patchLives({ livesCustomImage: dataUrl, livesIconId: 'custom' }))
      .catch(() => {});
  };

  return (
    <CevapCard number={number} title="Can / Hak Sistemi">
      <div style={{ display: 'grid', gap: 10 }}>
        <ToggleRow
          label="Can sistemini etkinleştir"
          checked={lives.enabled}
          onChange={(checked) => patchLives({ livesEnabled: checked })}
        />
        {lives.enabled && (
          <>
            <Field label="Can sayısı">
              <TextInput
                type="number"
                min="1"
                max="99"
                value={lives.count}
                onChange={(value) =>
                  patchLives({ livesCount: Math.max(1, Math.min(99, Number(value) || DEFAULT_LIVES_COUNT)) })
                }
              />
            </Field>
            <Field label="Can simgesi">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {LIVES_ICON_PRESETS.map((preset) => {
                  const active = lives.iconId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.label}
                      onClick={() => patchLives({ livesIconId: preset.id })}
                      style={{
                        height: 34,
                        borderRadius: 8,
                        border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                        background: active ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        fontSize: 18,
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {preset.glyph}
                    </button>
                  );
                })}
                <button
                  type="button"
                  title="Kendi resmini yükle"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    border: `2px solid ${lives.iconId === 'custom' ? '#2563eb' : '#e2e8f0'}`,
                    background: lives.iconId === 'custom' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {lives.useCustom ? (
                    <img src={lives.customImage} alt="Özel can" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                  ) : (
                    '+ Resim'
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </Field>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 11,
                color: '#475569',
              }}
            >
              <span style={{ fontWeight: 800 }}>Önizleme:</span>
              {Array.from({ length: Math.min(10, lives.count) }).map((_, i) =>
                lives.useCustom ? (
                  <img key={i} src={lives.customImage} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                ) : (
                  <span key={i} style={{ fontSize: 15 }}>{lives.glyph}</span>
                )
              )}
            </div>
            <Field label="Can bitince">
              <SelectInput
                value={lives.behaviorOnZero}
                onChange={(value) => patchLives({ livesBehaviorOnZero: value })}
                options={[
                  { value: 'lock', label: 'Etkinliği kilitle' },
                  { value: 'restart', label: 'Yeniden başlat' },
                  { value: 'show-answer', label: 'Cevabı göster' },
                ]}
              />
            </Field>
            <p style={{ margin: 0, color: '#64748b', fontSize: 10, lineHeight: 1.45 }}>
              Öğrenci her yanlış cevapta bir can kaybeder. Can sayısı maksimum deneme hakkı olarak da çalışır.
            </p>
          </>
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
              { value: 'after-wrong', label: 'Yanlış cevaptan sonra' },
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
