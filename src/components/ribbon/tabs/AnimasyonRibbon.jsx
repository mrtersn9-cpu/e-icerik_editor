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

export default function AnimasyonRibbon({ controller }) {
  const { commands, can, galleries, selectedTimelineItem } = controller;
  const selectedPreset = galleries.dragAnimations.find((item) => item.id === controller.dragAnimationPreset?.id);

  return (
    <>
      <RibbonGroup title="Önizleme" width={84}>
        <RibbonButton label="Önizle" icon="play" onClick={commands.restartAnimationPreview} tone="slate" width={62} />
      </RibbonGroup>

      <RibbonGroup title="Giriş" width={282}>
        <RibbonRow>
          {['fade', 'slide', 'scale'].map((effect) => (
            <RibbonButton
              key={effect}
              label={galleries.effectLabel(effect)}
              icon="star"
              onClick={() => commands.updateSelectedTimeline({ entryEffect: effect })}
              disabled={!can.selection}
              active={selectedTimelineItem?.entryEffect === effect}
              tone="green"
              width={56}
            />
          ))}
          <RibbonPopoverButton label="Diğer" icon="more" width={62} variant="large" tone="green" disabled={!can.selection}>
            <RibbonStack>
              {['none', 'grow', 'shrink', 'fly'].map((effect) => (
                <CompactRibbonButton
                  key={effect}
                  label={galleries.effectLabel(effect)}
                  icon="star"
                  onClick={() => commands.updateSelectedTimeline({ entryEffect: effect })}
                  active={selectedTimelineItem?.entryEffect === effect}
                  width={120}
                />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Vurgu" width={276}>
        <RibbonRow>
          {galleries.dragAnimations.slice(0, 3).map((preset) => (
            <RibbonButton
              key={preset.id}
              label={preset.label}
              icon={preset.icon}
              onClick={() => commands.setDragAnimationPreset(preset.id)}
              active={selectedPreset?.id === preset.id}
              tone="amber"
              width={58}
            />
          ))}
          <RibbonPopoverButton label="Diğer" icon="more" width={66} variant="large" tone="amber">
            <RibbonStack>
              {galleries.dragAnimations.map((preset) => (
                <CompactRibbonButton
                  key={preset.id}
                  label={preset.label}
                  icon={preset.icon}
                  onClick={() => commands.setDragAnimationPreset(preset.id)}
                  active={selectedPreset?.id === preset.id}
                  width={124}
                />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Çıkış" width={282}>
        <RibbonRow>
          {['none', 'fade', 'slide'].map((effect) => (
            <RibbonButton
              key={effect}
              label={galleries.effectLabel(effect)}
              icon={effect === 'none' ? 'none' : 'spark'}
              onClick={() => commands.updateSelectedTimeline({ exitEffect: effect })}
              disabled={!can.selection}
              active={selectedTimelineItem?.exitEffect === effect}
              tone="red"
              width={54}
            />
          ))}
          <RibbonPopoverButton label="Diğer" icon="more" width={62} variant="large" tone="red" disabled={!can.selection}>
            <RibbonStack>
              {['scale', 'grow', 'shrink', 'fly'].map((effect) => (
                <CompactRibbonButton
                  key={effect}
                  label={galleries.effectLabel(effect)}
                  icon="spark"
                  onClick={() => commands.updateSelectedTimeline({ exitEffect: effect })}
                  active={selectedTimelineItem?.exitEffect === effect}
                  width={120}
                />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Hareket Yolu" width={160}>
        <RibbonRow>
          <RibbonButton label="Doğrusal" icon="pathLine" onClick={() => commands.updateSelectedTimeline({ direction: 'right' })} disabled={!can.selection} tone="slate" width={62} />
          <RibbonButton label="Kavis" icon="pathCurve" onClick={() => commands.updateSelectedTimeline({ direction: 'up' })} disabled={!can.selection} tone="slate" width={58} />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Zamanlama" width={250}>
        <RibbonStack>
          <RibbonRow>
            <span style={{ fontSize: 10, width: 54, color: '#475569' }}>Başlangıç</span>
            <RibbonSelect
              value={selectedTimelineItem?.startMode || 'with-previous'}
              onChange={(event) => commands.updateSelectedTimeline({ startMode: event.target.value })}
              options={[
                { value: 'with-previous', label: 'Önceki ile' },
                { value: 'after-previous', label: 'Öncekinden sonra' },
                { value: 'on-click', label: 'Tıklayınca' },
              ]}
              disabled={!can.selection}
              width={132}
            />
          </RibbonRow>
          <RibbonRow>
            <span style={{ fontSize: 10, width: 54, color: '#475569' }}>Süre</span>
            <RibbonNumberInput
              value={selectedTimelineItem?.duration || 2}
              onChange={(event) => commands.updateSelectedTimeline({ duration: Math.max(0.2, Number(event.target.value) || 2) })}
              disabled={!can.selection}
              width={58}
              step={0.1}
              min={0.2}
            />
            <span style={{ fontSize: 10, width: 42, color: '#475569' }}>Gecikme</span>
            <RibbonNumberInput
              value={selectedTimelineItem?.start || 0}
              onChange={(event) => commands.updateSelectedTimeline({ start: Math.max(0, Number(event.target.value) || 0) })}
              disabled={!can.selection}
              width={52}
              step={0.1}
              min={0}
            />
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Zaman Çizelgesine Ekle" width={128}>
        <RibbonButton label="Animasyonu Kopyala" icon="copy" onClick={commands.copySelectedAnimation} disabled={!can.selection} tone="slate" width={92} />
      </RibbonGroup>
    </>
  );
}
