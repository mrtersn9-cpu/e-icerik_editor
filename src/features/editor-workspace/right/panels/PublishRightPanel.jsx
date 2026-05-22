import {
  ActionButton,
  FieldLabel,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
  TextInput,
  ToggleRow,
} from './PanelPrimitives';

const trackingOptions = [
  { value: 'slides-viewed', label: 'Slide görüntüleme' },
  { value: 'quiz-score', label: 'Puan / cevap sonucu' },
  { value: 'complete-on-finish', label: 'Bitince tamamla' },
];

export default function PublishRightPanel({ controller }) {
  const commands = controller.commands || {};
  const galleries = controller.galleries || {};
  const lms = controller.lms || {};

  return (
    <PanelShell title="SCORM 1.2 / Paket Ayarları" subtitle="Ürün kuralı: yalnızca SCORM 1.2.">
      <PanelCard title="1. Paket bilgisi" collapsible>
        <div style={{ display: 'grid', gap: 8 }}>
          <div
            style={{
              border: '1px solid #d6e3f1',
              borderRadius: 8,
              background: '#f8fbff',
              color: '#174ea6',
              fontSize: 10.5,
              fontWeight: 900,
              minHeight: 32,
              display: 'flex',
              alignItems: 'center',
              padding: '0 9px',
            }}
          >
            {(galleries.lmsStandards || []).find((item) => item.value === 'scorm12')?.label ||
              'SCORM 1.2'}
          </div>
          <FieldLabel>
            Paket adı
            <TextInput
              value={lms.packageName || ''}
              placeholder="E-içerik paketi"
              onChange={(value) => commands.patchLms?.({ packageName: value })}
            />
          </FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 7 }}>
            <FieldLabel>
              Paket kodu
              <TextInput
                value={lms.packageCode || ''}
                placeholder="SCORM-001"
                onChange={(value) => commands.patchLms?.({ packageCode: value })}
              />
            </FieldLabel>
            <FieldLabel>
              Sürüm
              <TextInput
                value={lms.version || '1.0.0'}
                onChange={(value) => commands.patchLms?.({ version: value })}
              />
            </FieldLabel>
          </div>
          <FieldLabel>
            Geçme puanı
            <NumberInput
              step={1}
              value={lms.passingScore ?? 70}
              onChange={(value) => commands.patchLms?.({ passingScore: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="2. İzleme ve geçme" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            İzleme yöntemi
            <NativeSelect
              value={lms.trackingMode || 'slides-viewed'}
              options={trackingOptions}
              onChange={(value) => commands.patchLms?.({ trackingMode: value })}
            />
          </FieldLabel>
          <ToggleRow
            label="Player chrome"
            hint="Menü, ilerleme ve temel player kontrolleri paketlenir."
            checked={lms.playerChrome !== false}
            onChange={(checked) => commands.patchLms?.({ playerChrome: checked })}
          />
          <ToggleRow
            label="Dış bağlantı uyarısı"
            hint="SCORM paketleme öncesi TTKB/KVKK/telif kontrolü."
            checked={lms.externalLinkWarning !== false}
            onChange={(checked) => commands.patchLms?.({ externalLinkWarning: checked })}
          />
        </div>
      </PanelCard>

      <PanelCard title="3. Player görünümü" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <NativeSelect
            value={lms.playerTheme || galleries.playerSkins?.[0]?.id || ''}
            options={(galleries.playerSkins || []).map((item) => ({
              value: item.id,
              label: item.name || item.label,
            }))}
            onChange={(value) => commands.patchLms?.({ playerTheme: value })}
          />
          <ActionButton onClick={() => commands.openGlossaryEditor?.()} tone="#7c3aed">
            Sözlük / Glossary
          </ActionButton>
        </div>
      </PanelCard>

      <PanelCard title="4. Dışa aktar" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={commands.scormExport}>ZIP Dışa Aktar</ActionButton>
          <ActionButton onClick={commands.secureLmsExport} tone="#16a34a">
            Güvenli LMS
          </ActionButton>
        </div>
        <div style={{ color: '#64748b', fontSize: 10.5, lineHeight: 1.55, marginTop: 8 }}>
          Harici bağlantı veya embed varsa SCORM paketleme öncesi TTKB/KVKK/telif uyarısı korunur.
        </div>
      </PanelCard>
    </PanelShell>
  );
}
