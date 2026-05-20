import { ShapePreviewIcon } from '../../ui';
import {
  CompactRibbonButton,
  RibbonColorInput,
  RibbonGroup,
  RibbonMenuGrid,
  RibbonNumberInput,
  RibbonPopoverButton,
  RibbonRow,
  RibbonSelect,
  RibbonStack,
} from '../RibbonPrimitives';

export default function BicimRibbon({ controller }) {
  const { commands, object, can, galleries } = controller;
  const disabled = !can.selection;

  return (
    <>
      <RibbonGroup title="Metin" width={292}>
        <RibbonStack>
          <RibbonRow>
            <RibbonSelect
              value={object?.style?.fontFamily || 'Humst777 BlkCn BT'}
              onChange={(event) => commands.setObjectStyle({ fontFamily: event.target.value })}
              options={galleries.fonts.map((font) => ({ value: font, label: font }))}
              disabled={disabled}
              width={126}
            />
            <RibbonNumberInput
              value={object?.style?.fontSize || 36}
              onChange={(event) => commands.setObjectStyle({ fontSize: Number(event.target.value) || 14 })}
              disabled={disabled}
              width={48}
            />
            <RibbonColorInput
              value={controller.resolveColor(object?.style?.color, '#111111')}
              onChange={(event) => commands.setObjectStyle({ color: event.target.value })}
              disabled={disabled}
              title="Yazı rengi"
            />
          </RibbonRow>
          <RibbonRow>
            <CompactRibbonButton label="Kalın" icon="B" onClick={() => commands.toggleTextStyle('bold')} disabled={disabled} width={60} />
            <CompactRibbonButton label="İtalik" icon="I" onClick={() => commands.toggleTextStyle('italic')} disabled={disabled} width={60} />
            <CompactRibbonButton label="Altı" icon="U" onClick={() => commands.toggleTextStyle('underline')} disabled={disabled} width={58} />
            <RibbonPopoverButton label="Hizala" icon="alignLeft" width={72} disabled={disabled}>
              <RibbonMenuGrid columns="repeat(2, 84px)">
                <CompactRibbonButton label="Sol" icon="alignLeft" onClick={() => commands.setObjectStyle({ textAlign: 'left' })} width={78} />
                <CompactRibbonButton label="Orta" icon="alignCenter" onClick={() => commands.setObjectStyle({ textAlign: 'center' })} width={78} />
                <CompactRibbonButton label="Sağ" icon="alignRight" onClick={() => commands.setObjectStyle({ textAlign: 'right' })} width={78} />
                <CompactRibbonButton label="Yasla" icon="J" onClick={() => commands.setObjectStyle({ textAlign: 'justify' })} width={78} />
              </RibbonMenuGrid>
            </RibbonPopoverButton>
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Şekil Stilleri" width={270}>
        <RibbonRow>
          {galleries.shapeStyles.slice(0, 4).map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              disabled={disabled}
              onClick={() => commands.setObjectStyle(preset.style)}
              style={{
                width: 40,
                height: 36,
                padding: 4,
                border: '1px solid #cbd5e1',
                borderRadius: 5,
                background: '#ffffff',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.42 : 1,
              }}
            >
              <ShapePreviewIcon
                kind={object?.shapeKind || 'roundedRect'}
                fill={preset.style?.background || 'transparent'}
                stroke={preset.style?.borderColor || '#64748b'}
                strokeWidth={Number(preset.style?.borderWidth || 3)}
                preserveAspectRatio="xMidYMid meet"
              />
            </button>
          ))}
          <RibbonPopoverButton label="Diğer" icon="more" width={66} disabled={disabled}>
            <RibbonMenuGrid columns="repeat(3, 46px)">
              {galleries.shapeStyles.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => commands.setObjectStyle(preset.style)}
                  style={{ width: 42, height: 36, border: '1px solid #cbd5e1', borderRadius: 5, background: '#ffffff' }}
                >
                  <ShapePreviewIcon
                    kind={object?.shapeKind || 'roundedRect'}
                    fill={preset.style?.background || 'transparent'}
                    stroke={preset.style?.borderColor || '#64748b'}
                    strokeWidth={Number(preset.style?.borderWidth || 3)}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </button>
              ))}
            </RibbonMenuGrid>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Dolgu / Çizgi" width={128}>
        <RibbonStack>
          <RibbonRow>
            <RibbonColorInput
              value={controller.resolveColor(object?.style?.background, '#ffffff')}
              onChange={(event) => commands.setObjectStyle({ background: event.target.value })}
              disabled={disabled}
              title="Dolgu"
            />
            <RibbonColorInput
              value={controller.resolveColor(object?.style?.borderColor, '#94a3b8')}
              onChange={(event) => commands.setObjectStyle({ borderColor: event.target.value })}
              disabled={disabled}
              title="Çizgi"
            />
          </RibbonRow>
          <RibbonPopoverButton label="Çizgi" icon="border" width={84} disabled={disabled}>
            <RibbonStack>
              {[1, 2, 3, 4, 6, 8].map((value) => (
                <CompactRibbonButton key={value} label={`${value}px`} icon="border" onClick={() => commands.setObjectStyle({ borderWidth: value })} width={74} />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Sırala ve Hizala" width={230}>
        <RibbonStack>
          <RibbonRow>
            <CompactRibbonButton label="Öne Al" icon="bringFront" onClick={commands.bringFront} disabled={disabled} width={58} />
            <CompactRibbonButton label="Arkaya" icon="sendBack" onClick={commands.sendBack} disabled={disabled} width={58} />
            <CompactRibbonButton label="Grupla" icon="group" onClick={commands.groupSelection} disabled={!can.group} width={58} />
          </RibbonRow>
          <RibbonRow>
            <CompactRibbonButton label="Sola" icon="alignLeft" onClick={() => commands.align('left')} disabled={!can.multiSelection} width={52} />
            <CompactRibbonButton label="Orta" icon="alignCenter" onClick={() => commands.align('center')} disabled={!can.multiSelection} width={52} />
            <CompactRibbonButton label="Sağa" icon="alignRight" onClick={() => commands.align('right')} disabled={!can.multiSelection} width={52} />
            <RibbonPopoverButton label="Diğer" icon="more" width={54} disabled={!can.multiSelection}>
              <RibbonMenuGrid columns="repeat(2, 96px)">
                <CompactRibbonButton label="Üste" icon="alignTop" onClick={() => commands.align('top')} width={88} />
                <CompactRibbonButton label="Ortaya" icon="alignMiddle" onClick={() => commands.align('middle')} width={88} />
                <CompactRibbonButton label="Alta" icon="alignBottom" onClick={() => commands.align('bottom')} width={88} />
                <CompactRibbonButton label="Yatay Dağıt" icon="distributeH" onClick={() => commands.distribute('horizontal')} disabled={!can.distribute} width={88} />
                <CompactRibbonButton label="Dikey Dağıt" icon="distributeV" onClick={() => commands.distribute('vertical')} disabled={!can.distribute} width={88} />
              </RibbonMenuGrid>
            </RibbonPopoverButton>
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Boyut ve Konum" width={230}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '14px 44px 14px 44px 16px 44px',
            gap: 4,
            alignItems: 'center',
            fontSize: 10,
            color: '#475569',
          }}
        >
          <span>X</span>
          <RibbonNumberInput value={Math.round(object?.x || 0)} onChange={(event) => commands.patchObject({ x: Number(event.target.value) || 0 })} disabled={disabled} width={44} />
          <span>Y</span>
          <RibbonNumberInput value={Math.round(object?.y || 0)} onChange={(event) => commands.patchObject({ y: Number(event.target.value) || 0 })} disabled={disabled} width={44} />
          <span>R</span>
          <RibbonNumberInput value={Math.round(object?.rotation || 0)} onChange={(event) => commands.patchObject({ rotation: Number(event.target.value) || 0 })} disabled={disabled} width={44} />
          <span>G</span>
          <RibbonNumberInput value={Math.round(object?.width || 0)} onChange={(event) => commands.patchObject({ width: Math.max(20, Number(event.target.value) || 20) })} disabled={disabled} width={44} />
          <span>Y</span>
          <RibbonNumberInput value={Math.round(object?.height || 0)} onChange={(event) => commands.patchObject({ height: Math.max(20, Number(event.target.value) || 20) })} disabled={disabled} width={44} />
          <span>K</span>
          <RibbonNumberInput value={Math.round(object?.style?.borderRadius || 0)} onChange={(event) => commands.setObjectStyle({ borderRadius: Math.max(0, Number(event.target.value) || 0) })} disabled={disabled} width={44} />
        </div>
      </RibbonGroup>

      {object?.type === 'hotspot' && (
        <RibbonGroup title="Hotspot" width={120}>
          <RibbonStack>
            <CompactRibbonButton label="Başlık" icon="text" onClick={() => commands.patchObject({ hotspotPopupTitle: object.hotspotPopupTitle || 'Bilgi' })} width={94} />
            <CompactRibbonButton label="Açıklama" icon="note" onClick={() => commands.patchObject({ hotspotPopupBody: object.hotspotPopupBody || 'Açıklama metni' })} width={94} />
          </RibbonStack>
        </RibbonGroup>
      )}
    </>
  );
}
