import {
  ActionButton,
  ButtonGrid,
  FieldLabel,
  NumberInput,
  PanelCard,
  PanelShell,
  ToggleRow,
} from './PanelPrimitives';

export default function ViewRightPanel({ controller }) {
  const commands = controller.commands || {};
  const view = controller.view || {};
  const activity = controller.activity || {};

  const patchViewOptions = (patch) => {
    commands.patchActivity?.({
      viewOptions: {
        ...(activity.viewOptions || {}),
        ...patch,
      },
    });
  };

  return (
    <PanelShell title="Görünüm Ayarları" subtitle="Canvas, panel ve yardımcı çizgi ayarları.">
      <PanelCard title="1. Yakınlaştırma" collapsible>
        <ButtonGrid
          actions={[
            { label: 'Yakınlaştır', onClick: () => commands.zoomBy?.(0.1) },
            { label: 'Uzaklaştır', onClick: () => commands.zoomBy?.(-0.1) },
            { label: 'Sığdır', onClick: commands.fitCanvas },
            { label: '1:1', onClick: () => commands.setZoom?.(1) },
          ]}
        />
      </PanelCard>

      <PanelCard title="2. Kılavuzlar ve ızgara" collapsible>
        <div style={{ display: 'grid', gap: 5 }}>
          <ToggleRow
            label="Izgara"
            checked={view.showGrid}
            onChange={() => commands.toggleViewOption?.('showGrid')}
          />
          <ToggleRow
            label="Kılavuzlar"
            checked={view.showGuides}
            onChange={() => commands.toggleViewOption?.('showGuides')}
          />
          <ToggleRow
            label="Cetveller"
            checked={view.showRulers}
            onChange={() => commands.toggleViewOption?.('showRulers')}
          />
          <ToggleRow
            label="Snap"
            hint="Nesne hareketini grid/kılavuza yaklaştırır."
            checked={view.snapEnabled}
            onChange={() => commands.toggleViewOption?.('snapEnabled')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Izgara aralığı
              <NumberInput
                step={1}
                value={activity.viewOptions?.gridSize || 20}
                onChange={(value) => patchViewOptions({ gridSize: Math.max(4, value || 20) })}
              />
            </FieldLabel>
            <FieldLabel>
              Snap aralığı
              <NumberInput
                step={1}
                value={activity.viewOptions?.snapSize || 10}
                onChange={(value) => patchViewOptions({ snapSize: Math.max(1, value || 10) })}
              />
            </FieldLabel>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="3. Panel görünürlüğü" collapsible>
        <div style={{ display: 'grid', gap: 5 }}>
          <ButtonGrid
            actions={[
              { label: 'Haritayı Göster', onClick: commands.showLeftPanel },
              { label: 'Haritayı Gizle', onClick: commands.hideLeftPanel },
              { label: 'Timeline Göster', onClick: commands.showTimeline },
              { label: 'Timeline Kompakt', onClick: commands.compactTimeline },
              { label: 'Dallanma Haritası', onClick: commands.openBranchReport, tone: '#7c3aed' },
            ]}
          />
          <ToggleRow
            label="Base Layer"
            hint="Overlay katmanda çalışırken ana sahneyi gösterir/gizler."
            checked={view.showBaseLayer !== false}
            onChange={commands.toggleBaseLayer}
          />
          <ToggleRow label="Sağ inspector" checked disabled hint="Sağ panel ribbon sekmesine göre otomatik değişir." />
        </div>
      </PanelCard>

      <PanelCard title="4. Varsayılanlara dön" collapsible>
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
