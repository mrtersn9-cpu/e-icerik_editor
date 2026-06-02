import { useState } from 'react';

import FindReplaceModal from '../../FindReplaceModal';
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
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);

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

      <RibbonGroup title="Pano" width={262}>
        <RibbonRow>
          <RibbonButton label="Yapıştır" icon="clipboard" onClick={commands.paste} tone="amber" />
          <RibbonStack>
            <CompactRibbonButton label="Kes" icon="cut" onClick={commands.cut} disabled={!can.selection} />
            <CompactRibbonButton label="Kopyala" icon="copy" onClick={commands.copy} disabled={!can.selection} />
            <CompactRibbonButton label="Sil" icon="trash" onClick={commands.deleteSelection} disabled={!can.selection} tone="red" />
          </RibbonStack>
          <RibbonStack>
            <CompactRibbonButton label="Biçim Kopyala" icon="brush" onClick={commands.copyObjectStyle} disabled={!can.selection} width={102} />
            <CompactRibbonButton label="Biçim Yapıştır" icon="brush" onClick={commands.pasteObjectStyle} disabled={!can.selection} width={102} />
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

      <RibbonGroup title="Seçim Araçları" width={178}>
        <RibbonRow>
          <CompactRibbonButton label="Sola" icon="alignLeft" onClick={() => commands.align('left')} disabled={!can.multiSelection} width={64} />
          <CompactRibbonButton label="Grupla" icon="group" onClick={commands.groupSelection} disabled={!can.group} width={64} />
          <RibbonPopoverButton label="Diğer" icon="more" width={58} disabled={!can.selection && !can.multiSelection}>
            <RibbonMenuGrid columns="repeat(2, 112px)">
              <CompactRibbonButton label="Ortala" icon="alignCenter" onClick={() => commands.align('center')} disabled={!can.multiSelection} width={106} />
              <CompactRibbonButton label="Sağa Hizala" icon="alignRight" onClick={() => commands.align('right')} disabled={!can.multiSelection} width={106} />
              <CompactRibbonButton label="Üste Hizala" icon="alignTop" onClick={() => commands.align('top')} disabled={!can.multiSelection} width={106} />
              <CompactRibbonButton label="Alta Hizala" icon="alignBottom" onClick={() => commands.align('bottom')} disabled={!can.multiSelection} width={106} />
              <CompactRibbonButton label="Yatay Dağıt" icon="distributeH" onClick={() => commands.distribute('horizontal')} disabled={!can.distribute} width={106} />
              <CompactRibbonButton label="Dikey Dağıt" icon="distributeV" onClick={() => commands.distribute('vertical')} disabled={!can.distribute} width={106} />
              <CompactRibbonButton label="Ayır" icon="ungroup" onClick={commands.ungroupSelection} disabled={!can.selection} width={106} />
              <CompactRibbonButton label="Kilitle" icon="lock" onClick={() => commands.setSelectionLocked(true)} disabled={!can.selection} width={106} />
              <CompactRibbonButton label="Kilidi Aç" icon="unlock" onClick={() => commands.setSelectionLocked(false)} disabled={!can.selection} width={106} />
              <CompactRibbonButton label="Öne Getir" icon="bringFront" onClick={commands.bringFront} disabled={!can.selection} width={106} />
              <CompactRibbonButton label="Arkaya Gönder" icon="sendBack" onClick={commands.sendBack} disabled={!can.selection} width={106} />
            </RibbonMenuGrid>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Düzenle" width={96}>
        <RibbonButton label="Bul / Değiştir" icon="search" onClick={() => setFindReplaceOpen(true)} tone="slate" width={78} />
      </RibbonGroup>

      <RibbonGroup title="Çeviri" width={130}>
        <RibbonStack>
          <CompactRibbonButton label="Dışa Aktar" icon="export" onClick={commands.exportTranslation} width={108} />
          <CompactRibbonButton label="İçe Aktar" icon="open" onClick={commands.importTranslation} width={108} />
        </RibbonStack>
      </RibbonGroup>

      <FindReplaceModal
        open={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        onCount={commands.countObjectText}
        onReplace={commands.replaceObjectText}
      />
    </>
  );
}
