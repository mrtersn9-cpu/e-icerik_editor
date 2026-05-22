import { ActionButton, InspectorRow, PanelCard, PanelShell, TileGrid } from './PanelPrimitives';

export default function HelpRightPanel({ controller }) {
  const commands = controller.commands || {};
  return (
    <PanelShell title="Yardım" subtitle="Kısa rehber, denetim ve destek aksiyonları.">
      <PanelCard title="1. Destek konuları" collapsible>
        <TileGrid
          actions={[
            {
              label: 'Başlangıç',
              description: 'Sahne, nesne ve cevap akışını özetle',
              icon: '?',
              onClick: () => commands.showHelpToast?.('Sol haritadan sahneyi seç, Ekle sekmesinden nesne ekle.'),
            },
            {
              label: 'Kısayollar',
              description: 'Ctrl+Z/Y, Del, Ctrl+D',
              icon: '⌘',
              onClick: () => commands.showHelpToast?.('Klavye: Ctrl+Z/Y, Del, Ctrl+D.'),
            },
            {
              label: 'Sözlük',
              description: 'Glossary terimlerini düzenle',
              icon: 'S',
              onClick: () => commands.openGlossaryEditor?.(),
            },
            {
              label: 'Değişkenler',
              description: 'Proje değişkenlerini aç',
              icon: 'V',
              onClick: () => commands.openVariablesManager?.(),
            },
            {
              label: 'Erişilebilirlik',
              description: 'Alt metin ve WCAG ayarları',
              icon: 'A',
              onClick: () => commands.openAccessibilitySettings?.(),
            },
            {
              label: 'Önizleme',
              description: 'Learner ekranını aç',
              icon: '▶',
              onClick: () => commands.openPreview?.(),
            },
          ]}
        />
      </PanelCard>

      <PanelCard title="2. Hızlı ipuçları" collapsible>
        <InspectorRow label="Cevap Merkezi" value="Üst bardaki Cevap butonu ana düzenleme alanıdır." />
        <InspectorRow label="Biçim" value="Nesne seçilince bağlamsal biçim ayarları açılır." />
        <InspectorRow label="SCORM" value="Paket standardı yalnızca SCORM 1.2 olarak korunur." />
      </PanelCard>

      <PanelCard title="3. Bu ekranda ne yapabilirim?" collapsible>
        <div style={{ color: '#475569', fontSize: 10.5, lineHeight: 1.55 }}>
          Üst ribbon sekmesi sağ panelin bağlamını değiştirir. Sol panel etkinlik haritası ve layer
          özetidir; sağ panel ise seçili ribbon için hızlı ayar ve denetim alanıdır.
        </div>
      </PanelCard>

      <PanelCard title="4. Denetim" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={() => commands.resetLayout?.()} tone="#475569">
            Düzeni Sıfırla
          </ActionButton>
          <ActionButton onClick={() => commands.setRibbonTab?.('view')}>
            Görünüm Ayarı
          </ActionButton>
        </div>
      </PanelCard>

      <PanelCard title="5. TTKB notu" collapsible>
        <div style={{ color: '#475569', fontSize: 10.5, lineHeight: 1.55 }}>
          Preview veya SCORM çıktısını etkileyen değişikliklerde TTKB geçişi yapılır; bu panel yalnızca
          editor içi yardım akışıdır.
        </div>
      </PanelCard>
    </PanelShell>
  );
}
