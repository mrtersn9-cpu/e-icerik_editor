import { ShapePreviewIcon } from '../../ui';
import {
  CompactRibbonButton,
  RibbonButton,
  RibbonGalleryButton,
  RibbonGroup,
  RibbonMenuGrid,
  RibbonPopoverButton,
  RibbonRow,
  RibbonStack,
} from '../RibbonPrimitives';

export default function EkleRibbon({ controller }) {
  const { commands, galleries } = controller;

  return (
    <>
      <RibbonGroup title="Metin" width={132}>
        <RibbonRow>
          <RibbonButton label="Metin" icon="text" onClick={() => commands.insertText('body')} tone="slate" />
          <RibbonButton label="Başlık" icon="heading" onClick={() => commands.insertText('heading')} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Görsel" width={270}>
        <RibbonRow>
          <RibbonButton label="Resim" icon="image" onClick={commands.insertImage} tone="slate" />
          <RibbonButton label="SVG" icon="code" onClick={commands.loadSvgBackground} tone="slate" />
          <RibbonPopoverButton label="Şekil" icon="shape" width={58} variant="large" tone="slate">
            <RibbonMenuGrid columns="repeat(6, 30px)">
              {galleries.shapes.slice(0, 36).map((shape) => (
                <RibbonGalleryButton
                  key={shape.kind}
                  title={shape.label}
                  onClick={() => commands.insertShape(shape.kind)}
                  width={28}
                  height={26}
                >
                  <ShapePreviewIcon
                    kind={shape.kind}
                    fill={shape.style?.background || 'transparent'}
                    stroke={shape.style?.borderColor || '#334155'}
                    strokeWidth={4}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </RibbonGalleryButton>
              ))}
            </RibbonMenuGrid>
          </RibbonPopoverButton>
          <RibbonButton label="İkon" icon="star" onClick={commands.insertIcon} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Medya" width={190}>
        <RibbonRow>
          <RibbonButton label="Ses" icon="audio" onClick={commands.insertAudio} tone="slate" />
          <RibbonButton label="Video" icon="video" onClick={commands.insertVideo} tone="slate" />
          <RibbonButton label="Web" icon="web" onClick={() => commands.insertObject('embed')} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Etkileşim" width={220}>
        <RibbonRow>
          <RibbonButton label="Buton" icon="button" onClick={() => commands.insertButtonPreset('btn-blue')} tone="slate" />
          <RibbonButton label="Hotspot" icon="hotspot" onClick={() => commands.insertObject('hotspot')} tone="slate" />
          <RibbonPopoverButton label="Sürükle-Bırak" icon="dragdrop" width={86} variant="large" tone="slate">
            <RibbonStack>
              <CompactRibbonButton label="Sürüklenebilir" icon="dragdrop" onClick={() => commands.insertObject('draggable')} width={126} />
              <CompactRibbonButton label="Bırakma Alanı" icon="button" onClick={() => commands.insertObject('dropzone')} width={126} />
              <CompactRibbonButton label="Cevap Merkezi" icon="score" onClick={commands.openAnswerCenter} width={126} />
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="İçerik" width={132}>
        <RibbonRow>
          <RibbonButton label="Soru" icon="question" onClick={commands.openAnswerCenter} tone="slate" />
          <RibbonButton label="Etiket" icon="tag" onClick={commands.insertLabel} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Bileşenler" width={142}>
        <RibbonRow>
          <RibbonPopoverButton label="Hazır Bileşen" icon="components" width={82} variant="large" tone="slate">
            <RibbonMenuGrid columns="repeat(2, 118px)">
              <CompactRibbonButton label="Bilgi Kutusu" icon="i" onClick={() => commands.insertComponent('info-box')} width={112} />
              <CompactRibbonButton label="Uyarı" icon="!" onClick={() => commands.insertComponent('warning-box')} width={112} />
              <CompactRibbonButton label="Kart" icon="▤" onClick={() => commands.insertComponent('card')} width={112} />
              <CompactRibbonButton label="Akordeon" icon="☰" onClick={() => commands.insertComponent('accordion')} width={112} />
              <CompactRibbonButton label="Metin Stüdyo" icon="text" onClick={commands.openTextStudio} width={112} />
            </RibbonMenuGrid>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>
    </>
  );
}
