import {
  CompactRibbonButton,
  RibbonButton,
  RibbonGroup,
  RibbonPopoverButton,
  RibbonRow,
  RibbonStack,
} from '../RibbonPrimitives';

export default function GorunumRibbon({ controller }) {
  const { commands, view } = controller;

  return (
    <>
      <RibbonGroup title="Yakınlaştır" width={210}>
        <RibbonRow>
          <RibbonButton label="Yakınlaştır" icon="zoomIn" onClick={() => commands.zoomBy(0.1)} tone="slate" />
          <RibbonButton label="Uzaklaştır" icon="zoomOut" onClick={() => commands.zoomBy(-0.1)} tone="slate" />
          <RibbonButton label="Sığdır" icon="fit" onClick={commands.fitCanvas} active={view.zoom === 'fit'} tone="slate" />
          <RibbonButton label="1:1" icon="oneToOne" onClick={() => commands.setZoom(1)} active={view.zoom === 1} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Kılavuzlar ve Yardımcılar" width={284}>
        <RibbonRow>
          <RibbonButton label="Izgara" icon="grid" onClick={() => commands.toggleViewOption('showGrid')} active={view.showGrid !== false} tone="slate" />
          <RibbonButton label="Kılavuzlar" icon="guides" onClick={() => commands.toggleViewOption('showGuides')} active={!!view.showGuides} tone="slate" />
          <RibbonButton label="Cetveller" icon="ruler" onClick={() => commands.toggleViewOption('showRulers')} active={!!view.showRulers} tone="slate" />
          <RibbonButton label="Yapışma" icon="snap" onClick={() => commands.toggleViewOption('snapEnabled')} active={view.snapEnabled !== false} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Pencere" width={170}>
        <RibbonRow>
          <RibbonPopoverButton label="Paneller" icon="panel" width={82} variant="large" tone="slate">
            <RibbonStack>
              <CompactRibbonButton label="Haritayı Göster" icon="panel" onClick={commands.showLeftPanel} width={132} />
              <CompactRibbonButton label="Haritayı Gizle" icon="panel" onClick={commands.hideLeftPanel} width={132} />
              <CompactRibbonButton label="Zaman Çizelgesi" icon="ruler" onClick={commands.showTimeline} width={132} />
              <CompactRibbonButton label="Zaman Çizelgesi (Kompakt)" icon="ruler" onClick={commands.compactTimeline} width={132} />
              <CompactRibbonButton label="Arayüz Küçült" icon="zoomOut" onClick={() => commands.scaleUi(-1)} width={132} />
              <CompactRibbonButton label="Arayüz Büyüt" icon="zoomIn" onClick={() => commands.scaleUi(1)} width={132} />
              <CompactRibbonButton label="Düzeni Sıfırla" icon="undo" onClick={commands.resetLayout} width={132} />
            </RibbonStack>
          </RibbonPopoverButton>
          <RibbonButton label="Tam Ekran" icon="fullscreen" onClick={commands.expandCanvas} tone="slate" width={70} />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Önizleme" width={116}>
        <RibbonButton label="Cihaz Önizleme" icon="device" onClick={commands.openPreview} tone="slate" width={86} />
      </RibbonGroup>

    </>
  );
}
