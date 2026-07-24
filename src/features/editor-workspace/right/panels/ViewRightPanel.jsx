import {
  ActionButton,
  ButtonGrid,
  FieldLabel,
  NumberInput,
  PanelCard,
  PanelShell,
  ToggleRow,
} from './PanelPrimitives';

// Akıllı hizalama ayarları için varsayılanlar — snapGuides.js'teki
// DEFAULT_SMART_GUIDE_SETTINGS ile birebir aynı tutulmalı.
const DEFAULT_SMART_GUIDES = {
  enabled: true,
  snapEnabled: true,
  objectGuides: true,
  centerGuides: true,
  marginGuides: true,
  spacingGuides: true,
  showSafeAreaAlways: false,
  snapTolerance: 6,
  spacingTolerance: 6,
  safeMargin: 40,
};

export default function ViewRightPanel({ controller }) {
  const commands = controller.commands || {};
  const view = controller.view || {};
  const activity = controller.activity || {};
  const smartGuides = { ...DEFAULT_SMART_GUIDES, ...(activity.viewOptions?.smartGuides || {}) };

  const patchViewOptions = (patch) => {
    commands.patchActivity?.({
      viewOptions: {
        ...(activity.viewOptions || {}),
        ...patch,
      },
    });
  };

  const patchSmartGuides = (patch) => {
    patchViewOptions({ smartGuides: { ...smartGuides, ...patch } });
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
            label="Yapışma"
            hint="Nesne hareketini ızgaraya/kılavuza yaklaştırır."
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

      <PanelCard title="3. Akıllı hizalama ve snap" collapsible>
        <div style={{ display: 'grid', gap: 5 }}>
          <ToggleRow
            label="Akıllı hizalama"
            hint="Sürükleme/boyutlandırmada hizalama çizgilerini gösterir (genel açma/kapama)."
            checked={smartGuides.enabled}
            onChange={() => patchSmartGuides({ enabled: !smartGuides.enabled })}
          />
          <ToggleRow
            label="Snap"
            hint="Çizgiler görünse de kapalıysa öge tam hizaya kaymaz, yalnız referans gösterir."
            checked={smartGuides.snapEnabled}
            onChange={() => patchSmartGuides({ snapEnabled: !smartGuides.snapEnabled })}
          />
          <ToggleRow
            label="Diğer ögelere hizalama"
            checked={smartGuides.objectGuides}
            onChange={() => patchSmartGuides({ objectGuides: !smartGuides.objectGuides })}
          />
          <ToggleRow
            label="Sayfa merkez çizgileri"
            checked={smartGuides.centerGuides}
            onChange={() => patchSmartGuides({ centerGuides: !smartGuides.centerGuides })}
          />
          <ToggleRow
            label="Güvenli alan çizgileri"
            checked={smartGuides.marginGuides}
            onChange={() => patchSmartGuides({ marginGuides: !smartGuides.marginGuides })}
          />
          <ToggleRow
            label="Eşit boşluk çizgileri"
            hint="3+ öge eşit aralıklandığında mesafe etiketiyle gösterir."
            checked={smartGuides.spacingGuides}
            onChange={() => patchSmartGuides({ spacingGuides: !smartGuides.spacingGuides })}
          />
          <ToggleRow
            label="Güvenli alanı her zaman göster"
            hint="Margin çizgilerini yaklaşma şartı olmadan sürekli gösterir."
            checked={smartGuides.showSafeAreaAlways}
            onChange={() => patchSmartGuides({ showSafeAreaAlways: !smartGuides.showSafeAreaAlways })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Snap toleransı (px)
              <NumberInput
                step={1}
                value={smartGuides.snapTolerance}
                onChange={(value) => patchSmartGuides({ snapTolerance: Math.max(1, value || 6) })}
              />
            </FieldLabel>
            <FieldLabel>
              Boşluk toleransı (px)
              <NumberInput
                step={1}
                value={smartGuides.spacingTolerance}
                onChange={(value) => patchSmartGuides({ spacingTolerance: Math.max(1, value || 6) })}
              />
            </FieldLabel>
          </div>
          <FieldLabel>
            Güvenli alan margin'i (px)
            <NumberInput
              step={1}
              value={smartGuides.safeMargin}
              onChange={(value) => patchSmartGuides({ safeMargin: Math.max(0, value || 40) })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="4. Panel görünürlüğü" collapsible>
        <div style={{ display: 'grid', gap: 5 }}>
          <ButtonGrid
            actions={[
              { label: 'Haritayı Göster', onClick: commands.showLeftPanel },
              { label: 'Haritayı Gizle', onClick: commands.hideLeftPanel },
              { label: 'Zaman Çizelgesi', onClick: commands.showTimeline },
              { label: 'Zaman Çizelgesi (Kompakt)', onClick: commands.compactTimeline },
              { label: 'Dallanma Haritası', onClick: commands.openBranchReport, tone: '#7c3aed' },
            ]}
          />
          <ToggleRow
            label="Temel Katman"
            hint="Üst katmanda çalışırken ana sahneyi gösterir/gizler."
            checked={view.showBaseLayer !== false}
            onChange={commands.toggleBaseLayer}
          />
          <div
            style={{
              fontSize: 11,
              color: '#64748b',
              padding: '6px 2px',
              lineHeight: 1.4,
            }}
          >
            Sağ panel, seçili ribbon sekmesine göre otomatik değişir.
          </div>
        </div>
      </PanelCard>

      <PanelCard title="5. Varsayılanlara dön" collapsible>
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
