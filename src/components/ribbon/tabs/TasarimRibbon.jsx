import {
  BUTTON_MOTION_PROFILE_LABELS,
  BUTTON_PACKAGE_MOTION_PRESETS,
} from '../../../constants';
import {
  CompactRibbonButton,
  RibbonColorInput,
  RibbonGroup,
  RibbonPopoverButton,
  RibbonRow,
  RibbonSelect,
  RibbonStack,
  RibbonSwatch,
} from '../RibbonPrimitives';

const themeSwatches = ['#ffffff', '#eff6ff', '#f0fdf4', '#fff7ed', '#f8fafc', '#111827'];
const paletteSwatches = ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#db2777', '#334155'];
const backgroundGradients = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #11998e, #38ef7d)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #fdfcfb, #e2d1c3)',
];

export default function TasarimRibbon({ controller }) {
  const { activity, commands, galleries } = controller;

  return (
    <>
      <RibbonGroup title="Tema Renkleri" width={146}>
        <RibbonStack>
          <RibbonRow>
            {themeSwatches.map((color) => (
              <RibbonSwatch
                key={color}
                color={color}
                active={(activity?.backgroundColor || '#ffffff') === color}
                onClick={() => commands.patchActivity({ backgroundColor: color })}
              />
            ))}
          </RibbonRow>
          <RibbonColorInput
            value={controller.resolveColor(activity?.backgroundColor, '#ffffff')}
            onChange={(event) => commands.patchActivity({ backgroundColor: event.target.value })}
            title="Özel zemin rengi"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Arka Plan Stilleri" width={150}>
        <RibbonRow>
          {backgroundGradients.map((gradient) => (
            <RibbonSwatch
              key={gradient}
              color={gradient}
              active={(activity?.backgroundColor || '') === gradient}
              onClick={() => commands.patchActivity({ backgroundColor: gradient })}
            />
          ))}
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Stil Paketleri" width={156}>
        <RibbonStack>
          <RibbonSelect
            value={activity?.slideMasterId || 'blank'}
            onChange={(event) => commands.applySlideMaster(event.target.value)}
            options={galleries.slideMasters.map((item) => ({ value: item.id, label: item.name }))}
            width={142}
          />
          <RibbonPopoverButton label="Tüm Paketler" icon="more" width={112}>
            <RibbonStack>
              {galleries.slideMasters.map((item) => (
                <CompactRibbonButton key={item.id} label={item.name} icon="template" onClick={() => commands.applySlideMaster(item.id)} width={150} />
              ))}
              <CompactRibbonButton label="Düzeni Uygula" icon="components" onClick={commands.applyMasterLayoutObjects} width={150} />
            </RibbonStack>
          </RibbonPopoverButton>
          <CompactRibbonButton label="Master Editörü" icon="template" onClick={commands.openMasterEditor} width={142} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Buton Stili" width={214}>
        <RibbonStack>
          <RibbonRow>
            <RibbonSelect
              value={activity?.buttonPackageId || galleries.buttonPackages[0]?.id || ''}
              onChange={(event) => commands.applyButtonPackage(event.target.value)}
              options={galleries.buttonPackages.map((item) => ({ value: item.id, label: item.name }))}
              width={122}
            />
            {/* Boş durum sentinel'i #fefefe: beyaz seçimi de onChange tetikler. */}
            <RibbonColorInput
              value={controller.resolveColor(activity?.readyButtonTextColor, '#fefefe')}
              onChange={(event) => commands.applyReadyButtonTextColor?.(event.target.value)}
              title="Buton yazı rengi"
            />
          </RibbonRow>
          <RibbonRow>
            <RibbonSelect
              value={activity?.buttonAnimationProfileId || 'calmLift'}
              onChange={(event) => commands.applyButtonMotion(event.target.value)}
              options={Object.keys(BUTTON_PACKAGE_MOTION_PRESETS).map((profileId) => ({
                value: profileId,
                label: BUTTON_MOTION_PROFILE_LABELS[profileId] || profileId,
              }))}
              title="Buton animasyonu"
              width={122}
            />
            {activity?.readyButtonTextColor ? (
              <CompactRibbonButton
                label="Temaya Bırak"
                icon="none"
                onClick={() => commands.applyReadyButtonTextColor?.('')}
                width={86}
              />
            ) : null}
          </RibbonRow>
          <RibbonRow>
            {galleries.buttonStyles.slice(0, 2).map((style) => (
              <CompactRibbonButton key={style.id} label={style.label} icon="button" onClick={() => commands.insertButtonPreset(style.id)} width={64} />
            ))}
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Nesne Stili" width={188}>
        <RibbonRow>
          <RibbonPopoverButton label="Yazı" icon="heading" width={62} variant="large" tone="slate" disabled={!controller.can.selection}>
            <RibbonStack>
              <RibbonSelect
                value={controller.object?.style?.fontFamily || 'Humst777 BlkCn BT'}
                onChange={(event) => commands.setObjectStyle({ fontFamily: event.target.value })}
                options={galleries.fonts.map((font) => ({ value: font, label: font }))}
                disabled={!controller.can.selection}
                width={140}
              />
              <CompactRibbonButton label="Başlık Stili" icon="heading" onClick={() => commands.applyTextPreset('title')} disabled={!controller.can.selection} width={140} />
              <RibbonRow>
                {paletteSwatches.map((color) => (
                  <RibbonSwatch key={color} color={color} onClick={() => commands.setObjectStyle({ color })} />
                ))}
              </RibbonRow>
            </RibbonStack>
          </RibbonPopoverButton>
          <RibbonPopoverButton label="Çizgi" icon="border" width={62} variant="large" tone="slate" disabled={!controller.can.selection}>
            <RibbonStack>
              <RibbonColorInput
                value={controller.resolveColor(controller.object?.style?.borderColor, '#94a3b8')}
                onChange={(event) => commands.setObjectStyle({ borderColor: event.target.value })}
                disabled={!controller.can.selection}
                title="Kenar rengi"
              />
              <RibbonRow>
                {[1, 2, 3, 4, 6, 8].map((value) => (
                  <CompactRibbonButton key={value} label={`${value}px`} icon="border" onClick={() => commands.setObjectStyle({ borderWidth: value })} width={58} />
                ))}
              </RibbonRow>
            </RibbonStack>
          </RibbonPopoverButton>
          <RibbonPopoverButton label="Diğer" icon="more" width={62} variant="large" tone="slate">
            <RibbonStack>
              <RibbonRow>
                <CompactRibbonButton label="Yumuşak Gölge" icon="shadow" onClick={() => commands.setObjectStyle({ boxShadow: '0 12px 28px rgba(15,23,42,.20)' })} disabled={!controller.can.selection} width={104} />
                <CompactRibbonButton label="Gölge Yok" icon="none" onClick={() => commands.setObjectStyle({ boxShadow: 'none' })} disabled={!controller.can.selection} width={86} />
              </RibbonRow>
              <RibbonRow>
                {[0, 8, 16].map((value) => (
                  <CompactRibbonButton key={value} label={`${value}px`} icon="radius" onClick={() => commands.setObjectStyle({ borderRadius: value })} disabled={!controller.can.selection} width={58} />
                ))}
              </RibbonRow>
              <RibbonRow>
                <CompactRibbonButton label="Zemin SVG" icon="background" onClick={commands.loadSvgBackground} width={90} />
                <CompactRibbonButton label="Izgara" icon="grid" onClick={() => commands.toggleViewOption('showGrid')} active={controller.view.showGrid !== false} width={70} />
                <CompactRibbonButton label="Kılavuz" icon="guides" onClick={() => commands.toggleViewOption('showGuides')} active={!!controller.view.showGuides} width={70} />
              </RibbonRow>
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

    </>
  );
}
