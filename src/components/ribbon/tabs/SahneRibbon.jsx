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

export default function SahneRibbon({ controller }) {
  const { activity, currentSlide, commands, galleries } = controller;

  return (
    <>
      <RibbonGroup title="Sahne İşlemleri" width={210}>
        <RibbonRow>
          <RibbonButton label="Yeni Sahne" icon="new" onClick={commands.addSlide} tone="slate" />
          <RibbonButton label="Çoğalt" icon="copy" onClick={commands.duplicateSlide} disabled={!currentSlide} tone="slate" />
          <RibbonButton label="Sil" icon="trash" onClick={commands.deleteSlide} disabled={!currentSlide} tone="red" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Düzenle" width={152}>
        <RibbonStack>
          <RibbonRow>
            <CompactRibbonButton label="Taşı" icon="bringFront" onClick={() => commands.moveSlide(-1)} disabled={!currentSlide} width={68} />
            <CompactRibbonButton label="Aşağı" icon="sendBack" onClick={() => commands.moveSlide(1)} disabled={!currentSlide} width={58} />
          </RibbonRow>
          <CompactRibbonButton label="Ana Yap" icon="star" onClick={commands.makeSlideFirst} disabled={!currentSlide} width={128} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Şablonlar" width={154}>
        <RibbonStack>
          <RibbonPopoverButton label="Sahne Şablonları" icon="template" width={126}>
            <RibbonStack>
              {galleries.sceneTemplates.map((item) => (
                <CompactRibbonButton
                  key={item.id}
                  label={item.label}
                  icon="template"
                  onClick={() => commands.applySceneTemplate(item.id)}
                  width={160}
                />
              ))}
              <CompactRibbonButton label="Şablonu Temizle" icon="none" onClick={() => commands.applySceneTemplate('')} width={160} tone="red" />
            </RibbonStack>
          </RibbonPopoverButton>
          <CompactRibbonButton label="Sahne Ayarı" icon="settings" onClick={commands.openScenePanel} width={126} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Sahne Boyutu" width={224}>
        <RibbonStack>
          <RibbonRow>
            <RibbonNumberInput value={activity?.stageWidth || 1920} onChange={(event) => commands.patchActivity({ stageWidth: Number(event.target.value) || 1920 })} width={72} />
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>×</span>
            <RibbonNumberInput value={activity?.stageHeight || 1080} onChange={(event) => commands.patchActivity({ stageHeight: Number(event.target.value) || 1080 })} width={72} />
          </RibbonRow>
          <RibbonRow>
            <CompactRibbonButton label="16:9" icon="size" onClick={() => commands.patchActivity({ stageWidth: 1920, stageHeight: 1080 })} width={64} />
            <CompactRibbonButton label="4:3" icon="size" onClick={() => commands.patchActivity({ stageWidth: 1024, stageHeight: 768 })} width={64} />
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Arka Plan" width={178}>
        <RibbonStack>
          <RibbonRow>
            <input
              type="color"
              value={controller.resolveColor(activity?.backgroundColor, '#ffffff')}
              onChange={(event) => commands.patchActivity({ backgroundColor: event.target.value })}
              title="Arka plan rengi"
              style={{ width: 28, height: 24, border: '1px solid #cbd7e6', borderRadius: 5 }}
            />
            <CompactRibbonButton label="SVG Yükle" icon="background" onClick={commands.loadSvgBackground} width={92} />
          </RibbonRow>
          <RibbonSelect
            value={activity?.slideMasterId || 'blank'}
            onChange={(event) => commands.applySlideMaster(event.target.value)}
            options={galleries.slideMasters.map((item) => ({ value: item.id, label: item.name }))}
            width={132}
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Zamanlama" width={132}>
        <RibbonStack>
          <RibbonNumberInput
            value={currentSlide?.duration || activity?.duration || 20}
            onChange={(event) => commands.patchCurrentSlide({ duration: Math.max(1, Number(event.target.value) || 20) })}
            width={86}
            min={1}
            step={1}
          />
          <CompactRibbonButton label="Geçiş Önizle" icon="play" onClick={() => commands.setRibbonTab('transitions')} width={94} />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Notlar" width={96}>
        <RibbonButton label="Sahne Notları" icon="note" onClick={commands.openScenePanel} tone="slate" width={72} />
      </RibbonGroup>
    </>
  );
}
