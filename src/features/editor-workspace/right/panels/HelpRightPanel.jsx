import { ActionButton, PanelCard, PanelShell } from './PanelPrimitives';

export default function HelpRightPanel({ controller }) {
  const commands = controller.commands || {};
  return (
    <PanelShell title="Yardım Paneli" subtitle="Kısa yollar ve denetim komutları.">
      <PanelCard title="Destek Konuları">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={() => commands.showHelpToast?.('Klavye: Ctrl+Z/Y, Del, Ctrl+D.')}>
            Kısayollar
          </ActionButton>
          <ActionButton onClick={() => commands.openAccessibilitySettings?.()}>
            Erişilebilirlik
          </ActionButton>
          <ActionButton onClick={() => commands.openPreview?.()}>
            Önizleme
          </ActionButton>
          <ActionButton onClick={() => commands.resetLayout?.()}>
            Düzeni Sıfırla
          </ActionButton>
        </div>
      </PanelCard>
      <PanelCard title="TTKB Notu">
        <div style={{ color: '#475569', fontSize: 10.5, lineHeight: 1.55 }}>
          Preview veya SCORM çıktısını etkileyen değişikliklerde TTKB geçişi yapılır; bu panel yalnızca
          editor içi yardım akışıdır.
        </div>
      </PanelCard>
    </PanelShell>
  );
}
