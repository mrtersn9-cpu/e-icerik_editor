import {
  ActionButton,
  FieldLabel,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
} from './PanelPrimitives';

export default function TransitionRightPanel({ controller }) {
  const commands = controller.commands || {};
  const galleries = controller.galleries || {};
  const currentSlide = controller.currentSlide || {};

  const patchSlide = (patch) => commands.patchCurrentSlide?.(patch);

  return (
    <PanelShell title="Geçiş Ayarları" subtitle="Seçili slide geçişi ve süreleri.">
      <PanelCard title="Geçiş">
        <div style={{ display: 'grid', gap: 8 }}>
          <FieldLabel>
            Stil
            <NativeSelect
              value={currentSlide.slideTransitionEffect || 'none'}
              options={galleries.transitions || []}
              onChange={(value) => patchSlide({ slideTransitionEffect: value })}
            />
          </FieldLabel>
          <FieldLabel>
            Easing
            <NativeSelect
              value={currentSlide.slideTransitionEasing || 'easeOut'}
              options={galleries.easings || []}
              onChange={(value) => patchSlide({ slideTransitionEasing: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="Zamanlama">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FieldLabel>
            Süre
            <NumberInput
              value={currentSlide.slideTransitionDuration ?? 0.45}
              onChange={(value) => patchSlide({ slideTransitionDuration: value })}
            />
          </FieldLabel>
          <FieldLabel>
            Gecikme
            <NumberInput
              value={currentSlide.slideTransitionDelay ?? 0}
              onChange={(value) => patchSlide({ slideTransitionDelay: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="Komutlar">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={commands.previewTransition}>Önizle</ActionButton>
          <ActionButton onClick={commands.applyTransitionToAllSlides}>Tümüne Uygula</ActionButton>
        </div>
      </PanelCard>
    </PanelShell>
  );
}
