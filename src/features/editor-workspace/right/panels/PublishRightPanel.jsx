import { ActionButton, FieldLabel, NativeSelect, NumberInput, PanelCard, PanelShell } from './PanelPrimitives';

export default function PublishRightPanel({ controller }) {
  const commands = controller.commands || {};
  const galleries = controller.galleries || {};
  const lms = controller.lms || {};

  return (
    <PanelShell title="SCORM 1.2 / Paket Ayarları" subtitle="Ürün kuralı: yalnızca SCORM 1.2.">
      <PanelCard title="Paket Bilgisi">
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
            Geçme puanı
            <NumberInput
              step={1}
              value={lms.passingScore ?? 70}
              onChange={(value) => commands.patchLms?.({ passingScore: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="Player">
        <NativeSelect
          value={lms.playerSkin || galleries.playerSkins?.[0]?.id || ''}
          options={(galleries.playerSkins || []).map((item) => ({
            value: item.id,
            label: item.name || item.label,
          }))}
          onChange={(value) => commands.patchLms?.({ playerSkin: value })}
        />
      </PanelCard>

      <PanelCard title="Dışa Aktar">
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
