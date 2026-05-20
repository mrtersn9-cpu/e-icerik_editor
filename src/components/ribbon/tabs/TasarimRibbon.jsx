import {
  CompactRibbonButton,
  RibbonButton,
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
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Yazı Tipleri" width={124}>
        <RibbonStack>
          <RibbonSelect
            value={controller.object?.style?.fontFamily || 'Humst777 BlkCn BT'}
            onChange={(event) => commands.setObjectStyle({ fontFamily: event.target.value })}
            options={galleries.fonts.map((font) => ({ value: font, label: font }))}
            disabled={!controller.can.selection}
            width={102}
          />
          <CompactRibbonButton label="Başlık Stili" icon="heading" onClick={() => commands.applyTextPreset('title')} disabled={!controller.can.selection} width={102} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Buton Stili" width={166}>
        <RibbonStack>
          <RibbonSelect
            value={activity?.buttonPackageId || galleries.buttonPackages[0]?.id || ''}
            onChange={(event) => commands.applyButtonPackage(event.target.value)}
            options={galleries.buttonPackages.map((item) => ({ value: item.id, label: item.name }))}
            width={122}
          />
          <RibbonRow>
            {galleries.buttonStyles.slice(0, 2).map((style) => (
              <CompactRibbonButton key={style.id} label={style.label} icon="button" onClick={() => commands.insertButtonPreset(style.id)} width={64} />
            ))}
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Kenarlık" width={94}>
        <RibbonStack>
          <RibbonColorInput
            value={controller.resolveColor(controller.object?.style?.borderColor, '#94a3b8')}
            onChange={(event) => commands.setObjectStyle({ borderColor: event.target.value })}
            disabled={!controller.can.selection}
            title="Kenar rengi"
          />
          <RibbonPopoverButton label="Kalınlık" icon="border" width={72} disabled={!controller.can.selection}>
            <RibbonStack>
              {[1, 2, 3, 4, 6, 8].map((value) => (
                <CompactRibbonButton key={value} label={`${value}px`} icon="border" onClick={() => commands.setObjectStyle({ borderWidth: value })} width={76} />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Gölge" width={82}>
        <RibbonStack>
          <CompactRibbonButton label="Yumuşak" icon="shadow" onClick={() => commands.setObjectStyle({ boxShadow: '0 12px 28px rgba(15,23,42,.20)' })} disabled={!controller.can.selection} width={64} />
          <CompactRibbonButton label="Yok" icon="none" onClick={() => commands.setObjectStyle({ boxShadow: 'none' })} disabled={!controller.can.selection} width={64} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Köşe Yarıçapı" width={92}>
        <RibbonStack>
          {[0, 8, 16].map((value) => (
            <CompactRibbonButton key={value} label={`${value}px`} icon="radius" onClick={() => commands.setObjectStyle({ borderRadius: value })} disabled={!controller.can.selection} width={68} />
          ))}
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Arka Plan" width={84}>
        <RibbonButton label="Zemin" icon="background" onClick={commands.loadSvgBackground} tone="slate" width={62} />
      </RibbonGroup>

      <RibbonGroup title="Izgara Dokusu" width={92}>
        <RibbonStack>
          <CompactRibbonButton label="Izgara" icon="grid" onClick={() => commands.toggleViewOption('showGrid')} active={controller.view.showGrid !== false} width={70} />
          <CompactRibbonButton label="Kılavuz" icon="guides" onClick={() => commands.toggleViewOption('showGuides')} active={!!controller.view.showGuides} width={70} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Renk Paleti" width={130}>
        <RibbonRow>
          {paletteSwatches.map((color) => (
            <RibbonSwatch key={color} color={color} onClick={() => commands.setObjectStyle({ color })} />
          ))}
        </RibbonRow>
      </RibbonGroup>
    </>
  );
}
