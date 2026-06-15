import {
  SLIDE_ADVANCE_OPTIONS,
  SLIDE_REVISIT_OPTIONS,
  WCAG_LEVEL_OPTIONS,
} from '../../../../constants';

import {
  ActionButton,
  ButtonGrid,
  ColorInput,
  FieldLabel,
  InspectorRow,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
  PreviewTile,
  TextAreaInput,
  TextInput,
} from './PanelPrimitives';

const sizePresets = [
  { value: '1920x1080', label: '1920 x 1080 (16:9)', width: 1920, height: 1080 },
  { value: '1280x720', label: '1280 x 720 (16:9)', width: 1280, height: 720 },
  { value: '1024x768', label: '1024 x 768 (4:3)', width: 1024, height: 768 },
  { value: 'custom', label: 'Özel', width: 0, height: 0 },
];

function findSizePreset(activity) {
  const width = Number(activity?.stageWidth || 1920);
  const height = Number(activity?.stageHeight || 1080);
  return sizePresets.find((item) => item.width === width && item.height === height)?.value || 'custom';
}

export default function SceneRightPanel({ controller }) {
  const activity = controller.activity || {};
  const currentSlide = controller.currentSlide || {};
  const commands = controller.commands || {};
  const galleries = controller.galleries || {};
  const slides = controller.slides || [];

  const patchActivity = (patch) => commands.patchActivity?.(patch);
  const patchSlide = (patch) => commands.patchCurrentSlide?.(patch);

  return (
    <PanelShell title="Sahne Ayarları" subtitle="Seçili slide, arka plan ve akış ayarları.">
      <PanelCard title="1. Sahne bilgisi" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Sahne adı
            <TextInput
              value={currentSlide.name || activity.name || ''}
              onChange={(value) => patchSlide({ name: value, sceneName: value })}
            />
          </FieldLabel>
          <FieldLabel>
            Açıklama
            <TextAreaInput
              rows={2}
              value={currentSlide.description || activity.notes || ''}
              onChange={(value) => patchSlide({ description: value })}
            />
          </FieldLabel>
          <FieldLabel>
            Başlangıç sahnesi
            <NativeSelect
              value={activity.startSlideId || currentSlide.id || ''}
              options={slides.map((slide, index) => ({
                value: slide.id,
                label: `${index + 1}. ${slide.name || slide.sceneName || 'Sahne'}`,
              }))}
              onChange={(value) => patchActivity({ startSlideId: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="2. Boyut" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Preset
            <NativeSelect
              value={findSizePreset(activity)}
              options={sizePresets}
              onChange={(value) => {
                const preset = sizePresets.find((item) => item.value === value);
                if (preset?.width) patchActivity({ stageWidth: preset.width, stageHeight: preset.height });
              }}
            />
          </FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Genişlik
              <NumberInput
                step={1}
                value={activity.stageWidth || currentSlide.stageWidth || 1920}
                onChange={(value) => patchActivity({ stageWidth: Math.max(1, value || 1920) })}
              />
            </FieldLabel>
            <FieldLabel>
              Yükseklik
              <NumberInput
                step={1}
                value={activity.stageHeight || currentSlide.stageHeight || 1080}
                onChange={(value) => patchActivity({ stageHeight: Math.max(1, value || 1080) })}
              />
            </FieldLabel>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="3. Arka plan" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 8 }}>
            <PreviewTile label="Küçük resim" active>
              <div
                style={{
                  height: 30,
                  borderRadius: 6,
                  background: activity.svgMarkup
                    ? '#dbeafe'
                    : activity.backgroundColor || currentSlide.backgroundColor || '#ffffff',
                  border: '1px solid #dbe6f3',
                }}
              />
            </PreviewTile>
            <div style={{ display: 'grid', gap: 6 }}>
              <InspectorRow label="Dosya" value={activity.svgName || currentSlide.svgName || 'Arka plan yok'} />
              <ActionButton onClick={commands.loadSvgBackground}>Resmi / SVG Değiştir</ActionButton>
            </div>
          </div>
          <FieldLabel>
            Zemin rengi
            <ColorInput
              value={activity.backgroundColor || currentSlide.backgroundColor || '#ffffff'}
              onChange={(value) => patchActivity({ backgroundColor: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="4. Süre ve akış" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Süre (sn)
            <NumberInput
              step={1}
              value={currentSlide.duration || activity.duration || 20}
              onChange={(value) => patchSlide({ duration: Math.max(1, value || 20) })}
            />
          </FieldLabel>
          <FieldLabel>
            İlerleme modu
            <NativeSelect
              value={activity.slideAdvance || 'user'}
              options={SLIDE_ADVANCE_OPTIONS}
              onChange={(value) => patchActivity({ slideAdvance: value })}
            />
          </FieldLabel>
          <FieldLabel>
            Tekrar ziyaret
            <NativeSelect
              value={activity.slideRevisit || 'resume'}
              options={SLIDE_REVISIT_OPTIONS}
              onChange={(value) => patchActivity({ slideRevisit: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="5. Şablon ve erişilebilirlik" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Sahne şablonu
            <NativeSelect
              value={currentSlide.sceneTemplateId || activity.sceneTemplateId || ''}
              options={[{ value: '', label: 'Serbest Sahne' }, ...(galleries.sceneTemplates || [])]}
              onChange={(value) => {
                if (value) commands.applySceneTemplate?.(value);
                else patchSlide({ sceneTemplateId: '' });
              }}
            />
          </FieldLabel>
          <FieldLabel>
            Master düzen
            <NativeSelect
              value={activity.slideMasterId || ''}
              options={[{ value: '', label: 'Master yok' }, ...(galleries.slideMasters || [])]}
              onChange={(value) => commands.applySlideMaster?.(value)}
            />
          </FieldLabel>
          <FieldLabel>
            Erişilebilirlik seviyesi
            <NativeSelect
              value={activity.accessibilityLevel || 'AA'}
              options={WCAG_LEVEL_OPTIONS}
              onChange={(value) => patchActivity({ accessibilityLevel: value })}
            />
          </FieldLabel>
          <ButtonGrid
            actions={[
              {
                label: 'Masteri Doldur',
                onClick: commands.applyMasterLayoutObjects,
                disabled: !activity.slideMasterId,
              },
              { label: 'Geçiş Önizle', onClick: () => commands.setRibbonTab?.('transitions') },
              { label: 'Sahne Notları', onClick: commands.openTextStudio },
            ]}
          />
        </div>
      </PanelCard>
    </PanelShell>
  );
}
