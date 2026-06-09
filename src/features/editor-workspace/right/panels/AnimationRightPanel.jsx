import {
  TIMELINE_DIRECTION_OPTIONS,
  TIMELINE_EASING_OPTIONS,
  TIMELINE_EFFECT_OPTIONS,
} from '../../../../constants';

import {
  ButtonGrid,
  EmptyHint,
  FieldLabel,
  InspectorRow,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
  PreviewTile,
  TileGrid,
} from './PanelPrimitives';

function objectName(object) {
  return object?.label || object?.name || object?.type || 'Nesne seçilmedi';
}

export default function AnimationRightPanel({ controller }) {
  const commands = controller.commands || {};
  const selectedObject = controller.selectedObject;
  const selectedTimelineItem = controller.ribbonController?.selectedTimelineItem;
  const dragPreset = controller.ribbonController?.dragAnimationPreset;
  const galleries = controller.galleries || {};
  const disabled = !selectedObject;

  const updateTimeline = (patch, options) => {
    if (!disabled) commands.updateSelectedTimeline?.(patch, options);
  };

  return (
    <PanelShell
      title={selectedObject ? `Animasyon - ${objectName(selectedObject)}` : 'Animasyon - Seçili Nesne'}
      subtitle="Giriş, vurgu, çıkış ve hareket ayarları."
    >
      <PanelCard title="1. Seçili nesne" collapsible>
        {selectedObject ? (
          <>
            <InspectorRow label="Nesne" value={objectName(selectedObject)} />
            <InspectorRow label="Layer" value={controller.activeLayerName || selectedObject.layerId || 'Base Layer'} />
          </>
        ) : (
          <EmptyHint>Animasyon ayarlarını düzenlemek için sahnede bir nesne seç.</EmptyHint>
        )}
      </PanelCard>

      <PanelCard title="2. Animasyon türü" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Giriş
            <NativeSelect
              value={selectedTimelineItem?.entryEffect || 'fade'}
              options={TIMELINE_EFFECT_OPTIONS}
              onChange={(value) => updateTimeline({ entryEffect: value })}
              disabled={disabled}
            />
          </FieldLabel>
          <FieldLabel>
            Çıkış
            <NativeSelect
              value={selectedTimelineItem?.exitEffect || 'none'}
              options={TIMELINE_EFFECT_OPTIONS}
              onChange={(value) => updateTimeline({ exitEffect: value })}
              disabled={disabled}
            />
          </FieldLabel>
          <FieldLabel>
            Yön
            <NativeSelect
              value={selectedTimelineItem?.direction || 'left'}
              options={TIMELINE_DIRECTION_OPTIONS}
              onChange={(value) => updateTimeline({ direction: value })}
              disabled={disabled}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="3. Zamanlama" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Başlangıç
              <NumberInput
                value={selectedTimelineItem?.start ?? 0}
                onChange={(value) => updateTimeline({ start: Math.max(0, value || 0) }, { preview: false })}
              />
            </FieldLabel>
            <FieldLabel>
              Süre
              <NumberInput
                value={selectedTimelineItem?.duration ?? 2}
                onChange={(value) => updateTimeline({ duration: Math.max(0.2, value || 0.2) }, { preview: false })}
              />
            </FieldLabel>
          </div>
          <FieldLabel>
            Easing
            <NativeSelect
              value={selectedTimelineItem?.easing || 'easeOut'}
              options={TIMELINE_EASING_OPTIONS}
              onChange={(value) => updateTimeline({ easing: value })}
              disabled={disabled}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="4. Preset galerisi" collapsible>
        <TileGrid
          columns={2}
          actions={[
            {
              label: 'Soluk',
              icon: '★',
              disabled,
              onClick: () => updateTimeline({ entryEffect: 'fade', exitEffect: 'fade' }),
            },
            {
              label: 'Uçarak Gel',
              icon: '➜',
              disabled,
              onClick: () => updateTimeline({ entryEffect: 'slide', direction: 'left' }),
            },
            {
              label: 'Kaydır',
              icon: '↔',
              disabled,
              onClick: () => updateTimeline({ entryEffect: 'slide', direction: 'right' }),
            },
            {
              label: 'Büyüt',
              icon: '+',
              disabled,
              onClick: () => updateTimeline({ entryEffect: 'zoom' }),
            },
          ]}
        />
      </PanelCard>

      <PanelCard title="5. Oynatma önizleme" collapsible>
        <ButtonGrid
          actions={[
            { label: 'Oynat', onClick: commands.restartAnimationPreview, disabled },
            { label: 'Durdur', onClick: commands.stopAnimationPreview, disabled },
            { label: 'Kopyala', onClick: commands.copySelectedAnimation, disabled },
            { label: 'Yapıştır', onClick: commands.pasteSelectedAnimation, disabled },
            {
              label: 'Sıfırla',
              tone: '#dc2626',
              disabled,
              onClick: () => updateTimeline({ entryEffect: 'none', exitEffect: 'none' }),
            },
            { label: 'Timeline', onClick: () => commands.setRibbonTab?.('animation') },
          ]}
        />
      </PanelCard>

      <PanelCard title="6. Sürükle-bırak animasyonu" collapsible>
        {(galleries.dragAnimations || []).length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
            {(galleries.dragAnimations || []).slice(0, 8).map((preset) => (
              <PreviewTile
                key={preset.id}
                label={preset.label || preset.name}
                active={dragPreset?.id === preset.id}
                onClick={() => commands.setDragAnimationPreset?.(preset.id)}
                tone="#f59e0b"
              >
                <span style={{ color: '#f59e0b', fontSize: 18, fontWeight: 950 }}>★</span>
              </PreviewTile>
            ))}
          </div>
        ) : (
          <EmptyHint>Sürükle-bırak animasyon presetleri bulunamadı.</EmptyHint>
        )}
      </PanelCard>
    </PanelShell>
  );
}
