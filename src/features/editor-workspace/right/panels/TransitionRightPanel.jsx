import {
  ActionButton,
  FieldLabel,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
  PreviewTile,
  inspectorChrome,
} from './PanelPrimitives';

export default function TransitionRightPanel({ controller }) {
  const commands = controller.commands || {};
  const galleries = controller.galleries || {};
  const currentSlide = controller.currentSlide || {};
  const transitionSoundOptions = galleries.transitionSounds || [];

  const patchSlide = (patch) => commands.patchCurrentSlide?.(patch);

  return (
    <PanelShell title="Geçiş Ayarları" subtitle="Seçili slide geçişi ve süreleri.">
      <PanelCard title="1. Seçili geçiş" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 8 }}>
          <PreviewTile label="Önizle" active onClick={commands.previewTransition}>
            <div
              style={{
                height: 24,
                borderRadius: 6,
                background: 'linear-gradient(135deg, #dbeafe 0%, #ffffff 52%, #bfdbfe 100%)',
                border: '1px solid #bfdbfe',
              }}
            />
          </PreviewTile>
          <div style={{ display: 'grid', gap: 7 }}>
            <FieldLabel>
              Stil
              <NativeSelect
                value={currentSlide.slideTransitionEffect || 'none'}
                options={galleries.transitions || []}
                onChange={(value) => patchSlide({ slideTransitionEffect: value })}
              />
            </FieldLabel>
            <FieldLabel>
              Yumuşatma
              <NativeSelect
                value={currentSlide.slideTransitionEasing || 'easeOut'}
                options={galleries.easings || []}
                onChange={(value) => patchSlide({ slideTransitionEasing: value })}
              />
            </FieldLabel>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="2. Geçiş galerisi" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
          {(galleries.transitions || []).slice(0, 8).map((transition) => (
            <PreviewTile
              key={transition.value}
              label={transition.label}
              active={(currentSlide.slideTransitionEffect || 'none') === transition.value}
              onClick={() => patchSlide({ slideTransitionEffect: transition.value })}
              tone={transition.value === 'none' ? '#64748b' : inspectorChrome.blue}
            >
              <div
                style={{
                  height: 22,
                  borderRadius: 6,
                  border: '1px solid #dbe6f3',
                  background:
                    transition.value === 'none'
                      ? '#f8fafc'
                      : transition.value.includes('fade')
                        ? 'linear-gradient(90deg, #eff6ff, #60a5fa)'
                        : transition.value.includes('slide') || transition.value.includes('cover')
                          ? 'linear-gradient(90deg, #dbeafe 0 45%, #2563eb 45% 52%, #eff6ff 52%)'
                          : 'radial-gradient(circle at 50% 50%, #60a5fa 0 35%, #eff6ff 36% 100%)',
                }}
              />
            </PreviewTile>
          ))}
        </div>
      </PanelCard>

      <PanelCard title="3. Zamanlama" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Süre (sn)
              <NumberInput
                value={currentSlide.slideTransitionDuration ?? 0.45}
                min={0}
                step={0.05}
                onChange={(value) => patchSlide({ slideTransitionDuration: value })}
              />
            </FieldLabel>
            <FieldLabel>
              Gecikme (sn)
              <NumberInput
                value={currentSlide.slideTransitionDelay ?? 0}
                min={0}
                step={0.05}
                onChange={(value) => patchSlide({ slideTransitionDelay: value })}
              />
            </FieldLabel>
          </div>
          <FieldLabel>
            Ses
            <NativeSelect
              value={currentSlide.slideTransitionSound || 'none'}
              options={transitionSoundOptions}
              onChange={(value) => patchSlide({ slideTransitionSound: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="4. Komutlar" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={commands.previewTransition}>Önizle</ActionButton>
          <ActionButton onClick={commands.applyTransitionToAllSlides}>Tümüne Uygula</ActionButton>
        </div>
      </PanelCard>
    </PanelShell>
  );
}
