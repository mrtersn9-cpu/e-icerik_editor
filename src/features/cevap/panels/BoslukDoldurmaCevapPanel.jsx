import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, MiniTable, PanelGrid, SmallButton, TextArea, TextInput, ToggleRow } from '../components/CevapControls';

import { CanCard, DenemeVeKisitlarCard, DogrulamaKurallariCard, ErisilebilirlikCard, EtkinlikTuruCard, GeriBildirimCard, IpucuCard, PuanlamaCard, YanitKontrolCard } from './OrtakCevapKartlari';

export default function BoslukDoldurmaCevapPanel({ activity, onUpdate }) {
  const answers = activity.fillBlankAnswers || [];
  const isWordBank = activity.type === 'word-bank';
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchBlank = (id, p) => patch({ fillBlankAnswers: answers.map((answer) => (answer.id === id ? { ...answer, ...p } : answer)) });
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description={isWordBank
          ? 'Kelime bankası: cümlede ___ ile boşluk bırak; öğrenci hazır kelime çiplerini boşluklara sürükler.'
          : 'Ogrenciler metindeki bosluklari uygun yanitlarla doldurur.'}
      />
      <CevapCard number="2" title={`Bosluk Listesi (${answers.length})`}>
        <Field label={isWordBank ? 'Cümle (boşluk için ___ kullan)' : 'Cumle'}><TextArea value={activity.fillBlankSentence || ''} onChange={(value) => patch({ fillBlankSentence: value })} /></Field>
        {isWordBank && (
          <Field label="Çeldirici kelimeler (virgülle, isteğe bağlı)">
            <TextInput
              value={activity.wordBankExtra || ''}
              placeholder="örn: kalem, defter, silgi"
              onChange={(value) => patch({ wordBankExtra: value })}
            />
          </Field>
        )}
        <div style={{ marginTop: 10 }}>
          <SmallButton
            variant="primary"
            onClick={() => patch({ fillBlankAnswers: [...answers, { id: uid(), blankIndex: answers.length, acceptedValues: [''], caseSensitive: false, feedback: '', points: 1 }] })}
          >
            + Bosluk Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Cevap Formu - Kabul Edilen Yanitlar" wide>
        <div style={{ display: 'grid', gap: 10 }}>
          {answers.map((answer, index) => (
            <div key={answer.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
              <Field label={`${index + 1}. bosluk`}>
                <TextInput value={(answer.acceptedValues || []).join(', ')} onChange={(value) => patchBlank(answer.id, { acceptedValues: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Geri bildirim">
                <TextInput value={answer.feedback || ''} placeholder="Bu bosluk icin ozel mesaj" onChange={(value) => patchBlank(answer.id, { feedback: value })} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <ToggleRow label="Büyük/küçük harf duyarlı" checked={answer.caseSensitive} onChange={(checked) => patchBlank(answer.id, { caseSensitive: checked })} />
                <Field label="Puan">
                  <TextInput type="number" min="0" value={answer.points || 1} onChange={(value) => patchBlank(answer.id, { points: Math.max(0, Number(value) || 0) })} />
                </Field>
              </div>
              <SmallButton
                variant="danger"
                onClick={() => patch({ fillBlankAnswers: answers.filter((item) => item.id !== answer.id) })}
              >
                Sil
              </SmallButton>
            </div>
          ))}
          {answers.some((answer) => !(answer.acceptedValues || []).some((v) => String(v || '').trim())) && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
              En az bir boşlukta kabul edilen yanıt boş; öğrenci bu boşluğu doğru yapamaz.
            </div>
          )}
        </div>
      </CevapCard>
      <DogrulamaKurallariCard number="4" activity={activity} onUpdate={onUpdate}>
        <ToggleRow
          label="Bosluklari temizle (bas/son)"
          checked={activity.fillBlankTrim !== false}
          onChange={(checked) => patch({ fillBlankTrim: checked })}
        />
        <ToggleRow
          label="Eş anlamlıları kabul et"
          checked={!!activity.fillBlankAcceptSynonyms}
          onChange={(checked) => patch({ fillBlankAcceptSynonyms: checked })}
        />
        <ToggleRow
          label="Regex kullanımı"
          checked={!!activity.fillBlankUseRegex}
          onChange={(checked) => patch({ fillBlankUseRegex: checked })}
        />
        <ToggleRow
          label="Türkçe karakter toleransı"
          checked={!!activity.fillBlankTurkishTolerance}
          onChange={(checked) => patch({ fillBlankTurkishTolerance: checked })}
        />
      </DogrulamaKurallariCard>
      <GeriBildirimCard number="5" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="6" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="7" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="8" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="9" activity={activity} onUpdate={onUpdate} />
      <CanCard number="10" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
      <CevapCard number="12" title="Yanıt Eşleme Özeti" wide>
        <MiniTable columns={['#', 'Varsayılan Yanıt', 'Kabul Edilen Yanıtlar', 'Puan', 'Durum']} rows={answers.map((answer, index) => ({ id: answer.id, cells: [index + 1, answer.acceptedValues?.[0] || '-', (answer.acceptedValues || []).join(', '), answer.points || 1, 'Aktif'] }))} />
      </CevapCard>
    </PanelGrid>
  );
}
