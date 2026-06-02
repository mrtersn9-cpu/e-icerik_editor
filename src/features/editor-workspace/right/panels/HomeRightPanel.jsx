import { useState } from 'react';

import {
  ButtonGrid,
  EmptyHint,
  FieldLabel,
  IconActionButton,
  InspectorRow,
  MetricGrid,
  NumberInput,
  PanelCard,
  PanelShell,
  PanelTabs,
  StatusPill,
  TextInput,
  inspectorChrome,
} from './PanelPrimitives';
import {
  getFriendlyTriggerSourceLabel,
  getFriendlyTriggerValueLabel,
} from './triggerLabels';

const objectTypeLabels = {
  audio: 'Ses',
  button: 'Buton',
  draggable: 'Sürükle',
  dropzone: 'Bırakma',
  embed: 'Web',
  hotspot: 'Hotspot',
  image: 'Resim',
  shape: 'Şekil',
  text: 'Metin',
  video: 'Video',
};

const objectTypeTones = {
  audio: '#0ea5e9',
  button: '#2563eb',
  draggable: '#f97316',
  dropzone: '#f59e0b',
  embed: '#6366f1',
  hotspot: '#8b5cf6',
  image: '#16a34a',
  shape: '#64748b',
  text: '#ef4444',
  video: '#0284c7',
};

function looksLikeRawDisplayId(value = '') {
  const text = String(value || '').trim();
  return /^[a-z0-9_-]{8,}$/i.test(text) && !/\s/.test(text);
}

function getObjectLabel(object) {
  const candidates = [object?.label, object?.name, object?.text]
    .map((value) => String(value || '').trim())
    .filter((value) => value && !looksLikeRawDisplayId(value));
  return candidates[0] || objectTypeLabels[object?.type] || object?.type || 'Nesne';
}

function getLayerObjectCount(objects, layerId) {
  return objects.filter((item) => (item.layerId || 'base') === layerId).length;
}

function objectTypeSummary(objects) {
  const counts = objects.reduce((acc, object) => {
    const key = object.type || 'object';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function formatAction(action) {
  const map = {
    KatmanaGec: 'Katmana geç',
    SliderGec: 'Slide değiştir',
    SayfaGec: 'Sayfaya git',
    DegiskenAta: 'Değişken ata',
    DegiskenArttir: 'Değişken artır',
    DegiskenAzalt: 'Değişken azalt',
    MedyaOynat: 'Medya oynat',
    MedyaDurdur: 'Medya durdur',
  };
  if (String(action || '').startsWith('runtime:')) return String(action).replace('runtime:', 'Çalıştırma: ');
  return map[action] || action || 'Aksiyon';
}

function MiniToolbar({ children }) {
  return <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{children}</div>;
}

function WarningList({ warnings }) {
  if (!warnings.length) {
    return <EmptyHint>Yeni kritik uyarı görünmüyor.</EmptyHint>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {warnings.map((warning) => (
        <div
          key={warning.text}
          style={{
            display: 'grid',
            gridTemplateColumns: '18px minmax(0,1fr) auto',
            gap: 6,
            alignItems: 'center',
            minHeight: 28,
            border: `1px solid ${warning.tone}26`,
            borderRadius: 7,
            background: `${warning.tone}0d`,
            padding: '4px 6px',
          }}
        >
          <span style={{ color: warning.tone, fontSize: 13, fontWeight: 950 }}>!</span>
          <span style={{ color: '#334155', fontSize: 10.5, fontWeight: 750, overflow: 'hidden' }}>
            {warning.text}
          </span>
          <StatusPill tone={warning.tone}>{warning.count || 1}</StatusPill>
        </div>
      ))}
    </div>
  );
}

function GeneralTab({ activity, controller, warnings }) {
  const commands = controller.commands || {};
  const currentSlide = controller.currentSlide || {};
  const layers = controller.layers || [];
  const objects = controller.objects || [];
  const selectedObject = controller.selectedObject || null;
  const triggers = activity.triggers || [];
  const timeline = activity.timeline || [];
  const interactiveCount = objects.filter((object) =>
    ['button', 'hotspot', 'draggable', 'dropzone', 'slider', 'input'].includes(object.type)
  ).length;
  const mediaCount = objects.filter((object) =>
    ['audio', 'video', 'image', 'embed'].includes(object.type)
  ).length;

  return (
    <>
      <PanelCard title="1. Sahne ayarları" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Ad
            <TextInput
              value={currentSlide.name || activity.name || ''}
              onChange={(value) => commands.patchCurrentSlide?.({ name: value, sceneName: value })}
            />
          </FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Genişlik
              <NumberInput
                step={1}
                value={activity.stageWidth || currentSlide.stageWidth || 1920}
                onChange={(value) => commands.patchActivity?.({ stageWidth: Math.max(1, value || 1920) })}
              />
            </FieldLabel>
            <FieldLabel>
              Yükseklik
              <NumberInput
                step={1}
                value={activity.stageHeight || currentSlide.stageHeight || 1080}
                onChange={(value) => commands.patchActivity?.({ stageHeight: Math.max(1, value || 1080) })}
              />
            </FieldLabel>
          </div>
          <InspectorRow
            label="Arka plan"
            value={activity.svgName || currentSlide.svgName || activity.backgroundColor || 'Varsayılan'}
          />
          <FieldLabel>
            Süre
            <NumberInput
              step={1}
              value={currentSlide.duration || activity.duration || 20}
              onChange={(value) => commands.patchCurrentSlide?.({ duration: Math.max(1, value || 20) })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      {selectedObject && (
        <PanelCard title="2. Seçili nesne" collapsible defaultOpen>
          <div style={{ display: 'grid', gap: 5 }}>
            <InspectorRow label="Ad" value={getObjectLabel(selectedObject)} />
            <InspectorRow
              label="Tür"
              value={objectTypeLabels[selectedObject.type] || selectedObject.type || 'Nesne'}
            />
            <InspectorRow
              label="Katman"
              value={controller.resolvedLayerNames?.[selectedObject.layerId || 'base'] || 'Temel Katman'}
            />
          </div>
        </PanelCard>
      )}

      <PanelCard title={`${selectedObject ? '3' : '2'}. Hızlı bilgiler`} collapsible defaultOpen={false}>
        <MetricGrid
          columns={2}
          items={[
            { label: 'Toplam Katman', value: layers.length, tone: '#2563eb' },
            { label: 'Etkileşimli Nesne', value: interactiveCount, tone: '#ef4444' },
            { label: 'Tetikleyici', value: triggers.length, tone: '#16a34a' },
            { label: 'Ortam Dosyası', value: mediaCount, tone: '#8b5cf6' },
            { label: 'Timeline', value: timeline.length, tone: '#0ea5e9' },
            { label: 'Sahne', value: controller.slides?.length || 0, tone: '#f59e0b' },
          ]}
        />
      </PanelCard>

      <PanelCard title={`${selectedObject ? '4' : '3'}. Etkinlik kontrolleri`} collapsible defaultOpen={false}>
        <ButtonGrid
          actions={[
            { label: 'Kaydet', onClick: commands.saveProject },
            { label: 'Önizleme', onClick: commands.openPreview },
            { label: 'Cevap Merkezi', onClick: controller.onOpenAnswerCenter },
            { label: 'SCORM ZIP', onClick: commands.scormExport, tone: '#f59e0b' },
            { label: 'Yayınla', onClick: commands.secureLmsExport, tone: '#16a34a' },
            { label: 'Akış Raporu', onClick: commands.openBranchReport, tone: '#7c3aed' },
            { label: 'Düzeni Sıfırla', onClick: commands.resetLayout, tone: '#475569' },
          ]}
        />
      </PanelCard>

      <PanelCard title={`${selectedObject ? '5' : '4'}. Hatalar / uyarılar`} collapsible defaultOpen={warnings.length > 0}>
        <WarningList warnings={warnings} />
      </PanelCard>
    </>
  );
}

function LayersTab({ activity, controller }) {
  const layers = controller.layers || [];
  const objects = controller.objects || [];
  const resolvedNames = controller.resolvedLayerNames || {};
  const activeLayerId = controller.activeLayerId || 'base';

  const patchActivity = (patch) => {
    controller.onUpdateActivity?.({ ...activity, ...patch });
  };

  const patchLayer = (layerId, patch) => {
    patchActivity({
      layers: layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    });
  };

  const selectLayer = (layerId) => {
    patchActivity({ activeLayerId: layerId, selectedObjectId: null });
    controller.onSelectionChange?.(new Set());
  };

  return (
    <>
      <PanelCard title="1. Katman özeti" collapsible>
        <MetricGrid
          columns={2}
          items={[
            { label: 'Katman', value: layers.length, tone: inspectorChrome.blue },
            { label: 'Aktif Nesne', value: getLayerObjectCount(objects, activeLayerId), tone: '#16a34a' },
          ]}
        />
      </PanelCard>

      <PanelCard title="2. Katmanlar" collapsible>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layers.map((layer, index) => {
            const layerId = layer.id || 'base';
            const active = activeLayerId === layerId;
            const layerName =
              resolvedNames[layerId] || (layer.kind === 'base' ? 'Temel Katman' : layer.name || `Katman ${index + 1}`);
            return (
              <div
                key={layerId}
                style={{
                  minHeight: 31,
                  display: 'grid',
                  gridTemplateColumns: '9px minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 7,
                  background: active ? inspectorChrome.active : 'transparent',
                  padding: '3px 4px',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: active ? inspectorChrome.blue : '#94a3b8',
                  }}
                />
                <button
                  type="button"
                  onClick={() => selectLayer(layerId)}
                  style={{
                    minWidth: 0,
                    border: 'none',
                    background: 'transparent',
                    color: active ? inspectorChrome.blue : '#26364d',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 10.5,
                    fontWeight: active ? 900 : 780,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: 0,
                  }}
                >
                  {layerName} <span style={{ color: '#94a3b8' }}>({getLayerObjectCount(objects, layerId)})</span>
                </button>
                <MiniToolbar>
                  <IconActionButton
                    title={layer.visible === false ? 'Göster' : 'Gizle'}
                    active={layer.visible !== false}
                    onClick={() => patchLayer(layerId, { visible: layer.visible === false })}
                  >
                    {layer.visible === false ? '○' : '●'}
                  </IconActionButton>
                  <IconActionButton
                    title={layer.locked ? 'Kilidi aç' : 'Kilitle'}
                    active={!!layer.locked}
                    onClick={() => patchLayer(layerId, { locked: !layer.locked })}
                  >
                    {layer.locked ? '■' : '□'}
                  </IconActionButton>
                </MiniToolbar>
              </div>
            );
          })}
        </div>
      </PanelCard>

      <PanelCard title="3. Stil ve cevap katmanı" collapsible defaultOpen={false}>
        <ButtonGrid
          actions={[
            { label: 'Stiller', onClick: () => controller.commands.setRibbonTab?.('design') },
            { label: 'Cevap Merkezi', onClick: controller.onOpenAnswerCenter },
            { label: 'Sahne Ayarları', onClick: () => controller.commands.setRibbonTab?.('scene') },
            {
              label: 'Biçim',
              onClick: () => controller.commands.setRibbonTab?.('object-format'),
              disabled: !controller.selectedObject,
            },
          ]}
        />
      </PanelCard>
    </>
  );
}

function AssetsTab({ activity, controller, warnings }) {
  const objects = controller.objects || [];
  const selectedIds = controller.selectedIds || new Set();

  const patchObject = (objectId, patch) => {
    controller.onUpdateActivity?.({
      ...activity,
      objects: objects.map((object) => (object.id === objectId ? { ...object, ...patch } : object)),
    });
  };

  const selectObject = (object) => {
    controller.onSelectionChange?.(new Set([object.id]));
    controller.onUpdateActivity?.({
      ...activity,
      activeLayerId: object.layerId || 'base',
      selectedObjectId: object.id,
    });
  };

  const typeSummary = objectTypeSummary(objects);

  return (
    <>
      <PanelCard title="1. Varlık türleri" collapsible>
        {typeSummary.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {typeSummary.map(([type, count]) => (
              <StatusPill key={type} tone={objectTypeTones[type] || inspectorChrome.muted}>
                {(objectTypeLabels[type] || type) + ' ' + count}
              </StatusPill>
            ))}
          </div>
        ) : (
          <EmptyHint>Bu sahnede henüz varlık yok.</EmptyHint>
        )}
      </PanelCard>

      <PanelCard title="2. Sahnedeki nesneler" collapsible>
        {objects.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {objects.slice(0, 12).map((object) => {
              const selected = selectedIds.has(object.id) || activity.selectedObjectId === object.id;
              const tone = objectTypeTones[object.type] || inspectorChrome.muted;
              return (
                <div
                  key={object.id}
                  style={{
                    minHeight: 31,
                    display: 'grid',
                    gridTemplateColumns: '9px minmax(0,1fr) auto',
                    gap: 6,
                    alignItems: 'center',
                    borderRadius: 7,
                    background: selected ? inspectorChrome.active : 'transparent',
                    padding: '3px 4px',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: tone }} />
                  <button
                    type="button"
                    onClick={() => selectObject(object)}
                    style={{
                      minWidth: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: selected ? inspectorChrome.blue : '#26364d',
                      textAlign: 'left',
                      fontSize: 10.5,
                      fontWeight: selected ? 900 : 780,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: 0,
                    }}
                  >
                    {getObjectLabel(object)}
                    <span style={{ color: '#94a3b8' }}> · {objectTypeLabels[object.type] || object.type}</span>
                  </button>
                  <MiniToolbar>
                    <IconActionButton
                      title={object.visible === false ? 'Göster' : 'Gizle'}
                      active={object.visible !== false}
                      onClick={() => patchObject(object.id, { visible: object.visible === false })}
                    >
                      {object.visible === false ? '○' : '●'}
                    </IconActionButton>
                    <IconActionButton
                      title={object.locked ? 'Kilidi aç' : 'Kilitle'}
                      active={!!object.locked}
                      onClick={() => patchObject(object.id, { locked: !object.locked })}
                    >
                      {object.locked ? '■' : '□'}
                    </IconActionButton>
                  </MiniToolbar>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyHint>Ekle sekmesinden metin, görsel veya etkileşim ekleyebilirsin.</EmptyHint>
        )}
      </PanelCard>

      <PanelCard title="3. Varlık uyarıları" collapsible defaultOpen={warnings.some((item) => item.scope === 'asset')}>
        <WarningList warnings={warnings.filter((item) => item.scope === 'asset')} />
      </PanelCard>
    </>
  );
}

function InteractionsTab({ activity, controller, warnings }) {
  const commands = controller.commands || {};
  const triggers = activity.triggers || [];
  const layers = controller.layers || [];
  const slides = controller.slides || [];
  const objects = controller.objects || [];
  const resolvedNames = controller.resolvedLayerNames || {};
  const triggerLabelContext = {
    activities: controller.activities || [],
    layers,
    objects,
    resolvedLayerNames: resolvedNames,
    slides,
  };

  return (
    <>
      <PanelCard title="1. Etkileşim özeti" collapsible>
        <MetricGrid
          columns={2}
          items={[
            { label: 'Tetikleyici', value: triggers.length, tone: '#16a34a' },
            {
              label: 'Drag / Drop',
              value: objects.filter((item) => ['draggable', 'dropzone'].includes(item.type)).length,
              tone: '#f97316',
            },
            { label: 'Buton', value: objects.filter((item) => item.type === 'button').length, tone: '#2563eb' },
            { label: 'Hotspot', value: objects.filter((item) => item.type === 'hotspot').length, tone: '#8b5cf6' },
          ]}
        />
      </PanelCard>

      <PanelCard title="2. Tetikleyici listesi" collapsible defaultOpen={false}>
        {triggers.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {triggers.slice(0, 10).map((trigger, index) => (
              <InspectorRow
                key={trigger.id || `${trigger.action}-${index}`}
                label={`${index + 1}. ${formatAction(trigger.action)}`}
                value={`${getFriendlyTriggerSourceLabel(trigger, triggerLabelContext)} → ${getFriendlyTriggerValueLabel(trigger, triggerLabelContext)}`}
                action={<StatusPill tone={trigger.conditions?.length ? '#f59e0b' : inspectorChrome.blue}>{trigger.conditions?.length || 0}</StatusPill>}
              />
            ))}
          </div>
        ) : (
          <EmptyHint>Bu sahnede trigger yok. Biçim sekmesinden seçili nesneye tıklama görevi eklenebilir.</EmptyHint>
        )}
      </PanelCard>

      <PanelCard title="3. Hızlı etkileşimler" collapsible defaultOpen={false}>
        <ButtonGrid
          actions={[
            { label: 'Detaylı Tetikleyici', onClick: commands.openInteractionBuilder, tone: '#1d4ed8' },
            { label: 'Cevap Merkezi', onClick: controller.onOpenAnswerCenter },
            { label: 'Buton Ekle', onClick: () => commands.insertButtonPreset?.('btn-blue') },
            { label: 'Hotspot', onClick: () => commands.insertObject?.('hotspot') },
            { label: 'Sürükle', onClick: () => commands.insertObject?.('draggable') },
            { label: 'Bırakma Alanı', onClick: () => commands.insertObject?.('dropzone') },
            {
              label: 'Tıklama Görevi',
              onClick: () => commands.setRibbonTab?.('object-format'),
              disabled: !controller.selectedObject,
            },
          ]}
        />
      </PanelCard>

      <PanelCard title="4. Etkileşim uyarıları" collapsible defaultOpen={warnings.some((item) => item.scope === 'interaction')}>
        <WarningList warnings={warnings.filter((item) => item.scope === 'interaction')} />
      </PanelCard>
    </>
  );
}

function buildWarnings(activity, objects) {
  const warnings = [];
  const triggers = activity.triggers || [];
  const mediaWithoutSource = objects.filter(
    (object) =>
      (object.type === 'audio' || object.type === 'video') &&
      !object.mediaUrl &&
      !object.audioUrl &&
      !object.videoUrl
  );
  const embedWithoutUrl = objects.filter((object) => object.type === 'embed' && !object.embedUrl);
  const hiddenLocked = objects.filter((object) => object.visible === false && object.locked);
  const missingAlt = objects.filter((object) => object.type === 'image' && !object.altText && !object.ariaLabel);

  if (!objects.length) {
    warnings.push({ text: 'Sahnede henüz nesne yok.', tone: inspectorChrome.warning, scope: 'asset' });
  }
  if (mediaWithoutSource.length || embedWithoutUrl.length) {
    warnings.push({
      text: 'Kaynağı eksik medya veya web varlığı var.',
      tone: inspectorChrome.danger,
      count: mediaWithoutSource.length + embedWithoutUrl.length,
      scope: 'asset',
    });
  }
  if (missingAlt.length) {
    warnings.push({
      text: 'Alt metni olmayan görsel var.',
      tone: '#f59e0b',
      count: missingAlt.length,
      scope: 'asset',
    });
  }
  if (!triggers.length) {
    warnings.push({ text: 'Bu sahnede tetikleyici tanımlanmamış.', tone: inspectorChrome.blue, scope: 'interaction' });
  }
  if (activity.type === 'drag-drop' && !Object.keys(activity.dragDropMatches || {}).length) {
    warnings.push({
      text: 'Sürükle-bırak eşleşmeleri tanımlanmamış.',
      tone: inspectorChrome.danger,
      scope: 'interaction',
    });
  }
  if (hiddenLocked.length) {
    warnings.push({
      text: 'Gizli ve kilitli nesneler var.',
      tone: '#f97316',
      count: hiddenLocked.length,
      scope: 'asset',
    });
  }
  return warnings;
}

const homeTabs = [
  { id: 'general', label: 'Genel' },
  { id: 'layers', label: 'Katmanlar' },
  { id: 'assets', label: 'Varlıklar' },
  { id: 'interactions', label: 'Etkileşimler' },
];

export default function HomeRightPanel({ controller }) {
  const [activeTab, setActiveTab] = useState('general');
  const activity = controller.activity || {};
  const warnings = buildWarnings(activity, controller.objects || []);

  return (
    <PanelShell title="Etkinlik Kontrol Merkezi" subtitle="Sahne, katman, varlık ve etkileşim denetimi.">
      <PanelTabs tabs={homeTabs} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'general' && (
        <GeneralTab activity={activity} controller={controller} warnings={warnings} />
      )}
      {activeTab === 'layers' && <LayersTab activity={activity} controller={controller} />}
      {activeTab === 'assets' && (
        <AssetsTab activity={activity} controller={controller} warnings={warnings} />
      )}
      {activeTab === 'interactions' && (
        <InteractionsTab activity={activity} controller={controller} warnings={warnings} />
      )}
    </PanelShell>
  );
}
