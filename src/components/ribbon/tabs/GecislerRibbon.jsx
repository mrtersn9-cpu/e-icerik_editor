import {
  CompactRibbonButton,
  RibbonButton,
  RibbonGroup,
  RibbonNumberInput,
  RibbonPopoverButton,
  RibbonRow,
  RibbonSelect,
  RibbonStack,
} from '../RibbonPrimitives';

export default function GecislerRibbon({ controller }) {
  const { commands, currentSlide, galleries } = controller;
  const current = galleries.transitions.some((item) => item.value === currentSlide?.slideTransitionEffect)
    ? currentSlide?.slideTransitionEffect
    : 'fade';

  return (
    <>
      <RibbonGroup title="Önizleme" width={84}>
        <RibbonButton label="Önizle" icon="play" onClick={commands.previewTransition} tone="slate" width={62} />
      </RibbonGroup>

      <RibbonGroup title="Geçiş Stilleri" width={470}>
        <RibbonRow>
          {['none', 'fade', 'slide', 'zoom-in', 'wipe-left'].map((value) => {
            const item = galleries.transitions.find((option) => option.value === value);
            if (!item) return null;
            const icon =
              value === 'none'
                ? 'none'
                : value === 'slide'
                  ? 'slideLeft'
                  : value === 'wipe-left'
                    ? 'wipeDown'
                    : 'transition';
            return (
              <RibbonButton
                key={value}
                label={item.label}
                icon={icon}
                onClick={() => commands.patchCurrentSlide({ slideTransitionEffect: value })}
                active={current === value}
                tone="slate"
                width={70}
              />
            );
          })}
          <RibbonPopoverButton label="Diğer" icon="more" width={72} variant="large" tone="slate">
            <RibbonStack>
              {galleries.transitions.map((item) => (
                <CompactRibbonButton
                  key={item.value}
                  label={item.label}
                  icon="transition"
                  onClick={() => commands.patchCurrentSlide({ slideTransitionEffect: item.value })}
                  active={current === item.value}
                  width={146}
                />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Geçiş Ayarları" width={324}>
        <RibbonStack>
          <RibbonRow>
            <span style={{ fontSize: 10, color: '#475569', width: 46 }}>Süre</span>
            <RibbonNumberInput
              value={currentSlide?.slideTransitionDuration ?? 0.45}
              onChange={(event) => commands.patchCurrentSlide({ slideTransitionDuration: Math.max(0, Number(event.target.value) || 0) })}
              width={66}
              step={0.05}
              min={0}
            />
            <span style={{ fontSize: 10, color: '#475569', width: 52 }}>Gecikme</span>
            <RibbonNumberInput
              value={currentSlide?.slideTransitionDelay ?? 0}
              onChange={(event) => commands.patchCurrentSlide({ slideTransitionDelay: Math.max(0, Number(event.target.value) || 0) })}
              width={58}
              step={0.05}
              min={0}
            />
          </RibbonRow>
          <RibbonRow>
            <RibbonSelect
              value={currentSlide?.slideTransitionDirection || 'left'}
              onChange={(event) => commands.patchCurrentSlide({ slideTransitionDirection: event.target.value })}
              options={galleries.directions}
              width={112}
            />
            <RibbonSelect
              value={currentSlide?.slideTransitionEasing || 'easeOut'}
              onChange={(event) => commands.patchCurrentSlide({ slideTransitionEasing: event.target.value })}
              options={galleries.easings}
              width={112}
            />
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Ses" width={104}>
        <RibbonSelect
          value={currentSlide?.slideTransitionSound || 'none'}
          onChange={(event) => commands.patchCurrentSlide({ slideTransitionSound: event.target.value })}
          options={galleries.transitionSounds}
          width={74}
        />
      </RibbonGroup>

      <RibbonGroup title="Uygula" width={96}>
        <RibbonButton label="Tümüne Uygula" icon="spark" onClick={commands.applyTransitionToAllSlides} tone="purple" width={74} />
      </RibbonGroup>
    </>
  );
}
