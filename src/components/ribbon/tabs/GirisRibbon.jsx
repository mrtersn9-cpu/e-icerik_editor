import {
  CompactRibbonButton,
  RibbonButton,
  RibbonGroup,
  RibbonMenuGrid,
  RibbonPopoverButton,
  RibbonRow,
  RibbonStack,
} from '../RibbonPrimitives';

export default function GirisRibbon({ controller }) {
  const { commands, can, view } = controller;

  return (
    <>
      <RibbonGroup title="Dosya" width={270}>
        <RibbonRow>
          <RibbonButton label="Yeni" icon="new" onClick={commands.newProject} tone="slate" />
          <RibbonButton label="Aç" icon="open" onClick={commands.openProject} tone="slate" />
          <RibbonButton label="Kaydet" icon="save" onClick={commands.saveProject} tone="green" />
          <RibbonButton label="Dışa Aktar" icon="export" onClick={commands.exportProject} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Pano" width={178}>
        <RibbonRow>
          <RibbonButton label="Yapıştır" icon="clipboard" onClick={commands.paste} tone="amber" />
          <RibbonStack>
            <CompactRibbonButton label="Kes" icon="cut" onClick={commands.cut} disabled={!can.selection} />
            <CompactRibbonButton label="Kopyala" icon="copy" onClick={commands.copy} disabled={!can.selection} />
            <CompactRibbonButton label="Sil" icon="trash" onClick={commands.deleteSelection} disabled={!can.selection} tone="red" />
          </RibbonStack>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Geri Al / İleri Al" width={118}>
        <RibbonStack>
          <CompactRibbonButton label="Geri Al" icon="undo" onClick={commands.undo} disabled={!can.undo} width={90} />
          <CompactRibbonButton label="İleri Al" icon="redo" onClick={commands.redo} disabled={!can.redo} width={90} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Görünüm" width={206}>
        <RibbonRow>
          <RibbonButton
            label="Izgara"
            icon="grid"
            onClick={() => commands.toggleViewOption('showGrid')}
            active={view.showGrid !== false}
            tone="slate"
          />
          <RibbonButton
            label="Kılavuzlar"
            icon="guides"
            onClick={() => commands.toggleViewOption('showGuides')}
            active={!!view.showGuides}
            tone="slate"
          />
          <RibbonButton label="Sığdır" icon="fit" onClick={commands.fitCanvas} active={view.zoom === 'fit'} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Hizala" width={164}>
        <RibbonStack>
          <RibbonRow>
            <CompactRibbonButton label="Sola" icon="alignLeft" onClick={() => commands.align('left')} disabled={!can.multiSelection} width={70} />
            <CompactRibbonButton label="Orta" icon="alignCenter" onClick={() => commands.align('center')} disabled={!can.multiSelection} width={70} />
          </RibbonRow>
          <RibbonRow>
            <CompactRibbonButton label="Sağa" icon="alignRight" onClick={() => commands.align('right')} disabled={!can.multiSelection} width={70} />
            <RibbonPopoverButton label="Diğer" icon="more" width={70} disabled={!can.multiSelection}>
              <RibbonMenuGrid columns="repeat(2, 100px)">
                <CompactRibbonButton label="Üste Hizala" icon="alignTop" onClick={() => commands.align('top')} width={96} />
                <CompactRibbonButton label="Ortaya" icon="alignMiddle" onClick={() => commands.align('middle')} width={96} />
                <CompactRibbonButton label="Alta Hizala" icon="alignBottom" onClick={() => commands.align('bottom')} width={96} />
                <CompactRibbonButton label="Yatay Dağıt" icon="distributeH" onClick={() => commands.distribute('horizontal')} disabled={!can.distribute} width={96} />
                <CompactRibbonButton label="Dikey Dağıt" icon="distributeV" onClick={() => commands.distribute('vertical')} disabled={!can.distribute} width={96} />
              </RibbonMenuGrid>
            </RibbonPopoverButton>
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Düzenle" width={160}>
        <RibbonStack>
          <RibbonRow>
            <CompactRibbonButton label="Grupla" icon="group" onClick={commands.groupSelection} disabled={!can.group} width={66} />
            <CompactRibbonButton label="Ayır" icon="ungroup" onClick={commands.ungroupSelection} disabled={!can.selection} width={62} />
          </RibbonRow>
          <RibbonRow>
            <CompactRibbonButton label="Kilitle" icon="lock" onClick={() => commands.setSelectionLocked(true)} disabled={!can.selection} width={66} />
            <CompactRibbonButton label="Aç" icon="unlock" onClick={() => commands.setSelectionLocked(false)} disabled={!can.selection} width={62} />
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Sıralama" width={118}>
        <RibbonStack>
          <CompactRibbonButton label="Öne Getir" icon="bringFront" onClick={commands.bringFront} disabled={!can.selection} width={88} />
          <CompactRibbonButton label="Arkaya Gönder" icon="sendBack" onClick={commands.sendBack} disabled={!can.selection} width={88} />
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
