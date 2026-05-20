import { ActionButton, ButtonGrid, PanelCard, PanelShell } from './PanelPrimitives';

export default function ViewRightPanel({ controller }) {
  const commands = controller.commands || {};
  const view = controller.view || {};

  return (
    <PanelShell title="Görünüm Ayarları" subtitle="Canvas, panel ve yardımcı çizgi ayarları.">
      <PanelCard title="Yakınlaştırma">
        <ButtonGrid
          actions={[
            { label: 'Yakınlaştır', onClick: () => commands.zoomBy?.(0.1) },
            { label: 'Uzaklaştır', onClick: () => commands.zoomBy?.(-0.1) },
            { label: 'Sığdır', onClick: commands.fitCanvas },
            { label: '1:1', onClick: () => commands.setZoom?.(1) },
          ]}
        />
      </PanelCard>

      <PanelCard title="Yardımcılar">
        <ButtonGrid
          actions={[
            {
              label: view.showGrid ? 'Izgara Açık' : 'Izgara Kapalı',
              onClick: () => commands.toggleViewOption?.('showGrid'),
            },
            {
              label: view.showGuides ? 'Kılavuz Açık' : 'Kılavuz Kapalı',
              onClick: () => commands.toggleViewOption?.('showGuides'),
            },
            {
              label: view.showRulers ? 'Cetvel Açık' : 'Cetvel Kapalı',
              onClick: () => commands.toggleViewOption?.('showRulers'),
            },
            {
              label: view.snapEnabled ? 'Snap Açık' : 'Snap Kapalı',
              onClick: () => commands.toggleViewOption?.('snapEnabled'),
            },
          ]}
        />
      </PanelCard>

      <PanelCard title="Panel Düzeni">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={commands.expandCanvas}>Tam Ekran</ActionButton>
          <ActionButton onClick={commands.resetLayout} tone="#475569">
            Varsayılan
          </ActionButton>
        </div>
      </PanelCard>
    </PanelShell>
  );
}
