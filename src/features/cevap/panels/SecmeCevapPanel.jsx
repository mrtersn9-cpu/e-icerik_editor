import { addMcOption, patchActivity, patchMcOption, removeMcOption, setSingleCorrectOption } from '../cevapActions';
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
  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Kullanici bir veya birden fazla dogru secenegi secer."
      />
      <CevapCard number="2" title={`Secenek Listesi (${summary.options.length})`} wide>
        <div style={{ display: 'grid', gap: 8 }}>
          <Field label="Soru metni">
            <TextArea value={activity.mcQuestion || ''} onChange={(value) => patch({ mcQuestion: value })} />
          </Field>
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
                ariaLabel={`${String.fromCharCode(65 + index)} secenegini sil`}
                onClick={() => removeMcOption(activity, onUpdate, option.id)}
              >
                Sil
              </SmallButton>
            </div>
          ))}
          <SmallButton variant="primary" onClick={() => addMcOption(activity, onUpdate)}>
            + Secenek Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="3" title="Soru Yapisi">
        <Field label="Secim turu">
          <SelectInput value={activity.mcMode || 'single'} onChange={(value) => patch({ mcMode: value })} options={[{ value: 'single', label: 'Tekli secim' }, { value: 'multi', label: 'Coklu secim' }]} />
        </Field>
        <ToggleRow label="Secenek sirasini karistir" checked={activity.settings?.shuffleOptions} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), shuffleOptions: checked } })} />
        <ToggleRow label="Soru sirasini karistir" checked={activity.settings?.shuffleQuestions} onChange={(checked) => patch({ settings: { ...(activity.settings || {}), shuffleQuestions: checked } })} />
      </CevapCard>
      <CevapCard number="4" title="Cevap Formu - Dogru Secenekler">
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
                  {letter}. {option.label || `Secenek ${index + 1}`}
                </ChoiceButton>
              );
            })}
          </div>
          {!summary.options.length && <span style={{ color: '#64748b', fontSize: 12 }}>0 secenek</span>}
          <MiniPreview
            label="Secili dogru cevap"
            value={summary.correctOptions.map((option) => option.label).join(', ')}
            empty="Henuz dogru secenek secilmedi"
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
      <CevapCard number="10" title="Opsiyon Haritasi" wide>
        <MiniTable
          columns={['Secenek', 'Metin', 'Dogru', 'Puan']}
          rows={summary.options.map((option, index) => ({ id: option.id, cells: [String.fromCharCode(65 + index), option.label || '-', option.isCorrect ? '✓' : '', option.points || 1] }))}
        />
      </CevapCard>
    </PanelGrid>
  );
}
