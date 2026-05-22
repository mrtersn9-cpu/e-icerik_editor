import { ARIA_ROLE_OPTIONS, OBJECT_STATE_OPTIONS, TRIGGER_ACTION_OPTIONS } from '../../../../constants';
import { createTriggerItem } from '../../../../logic/activityFactory';
import {
  getEditorLinkedSelectionIds,
  getEditorPrimaryObjectId,
} from '../../../../logic/editorHelpers';

import {
  ActionButton,
  ButtonGrid,
  ColorInput,
  EmptyHint,
  FieldLabel,
  InspectorRow,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
  TextInput,
  ToggleRow,
} from './PanelPrimitives';

const actionOptions = [
  { value: 'none', label: 'Bir şey yapma' },
  { value: 'runtime:restart', label: 'Yeniden Başlat' },
  { value: 'runtime:toggle-mute', label: 'Sesi Aç / Kapat' },
  { value: 'runtime:toggle-play-pause', label: 'Play / Pause' },
  { value: 'runtime:show-answer', label: 'Cevabı Göster' },
  { value: 'runtime:complete', label: 'Etkinliği Kapat' },
  { value: 'runtime:help', label: 'Menü / Yardım' },
  ...TRIGGER_ACTION_OPTIONS.filter((option) =>
    [
      'KatmanaGec',
      'SliderGec',
      'SayfaGec',
      'Goster',
      'Gizle',
      'NesneToggle',
      'NesneDurumuAyarla',
      'SesCal',
      'SesDurdur',
      'VideoCal',
      'VideoDurdur',
      'DegiskenAta',
      'DegiskenArttir',
      'DegiskenAzalt',
      'URLAc',
    ].includes(option.value)
  ),
];

const buttonQuickTaskOptions = [
  { value: 'check', label: 'Cevabı kontrol et' },
  ...actionOptions,
];

const objectTypeIcons = {
  audio: '♪', button: 'B', draggable: 'D', dropzone: 'Z',
  embed: 'W', hotspot: 'H', image: 'I', shape: 'S', text: 'T', video: 'V',
};

const objectTypeLabelsLocal = {
  audio: 'Ses', button: 'Buton', draggable: 'Sürükle', dropzone: 'Bırakma',
  embed: 'Web', hotspot: 'Hotspot', image: 'Resim', shape: 'Şekil', text: 'Metin', video: 'Video',
};

const filterOptions = [
  { value: 'none', label: 'Yok' },
  { value: 'blur(4px)', label: 'Bulanık' },
  { value: 'brightness(1.2)', label: 'Parlak' },
  { value: 'contrast(1.2)', label: 'Kontrast' },
  { value: 'grayscale(1)', label: 'Gri' },
  { value: 'sepia(1)', label: 'Sepya' },
  { value: 'saturate(1.5)', label: 'Doygun' },
];

const shadowPresets = [
  { value: 'none', label: 'Yok' },
  { value: '0 2px 4px rgba(0,0,0,0.10)', label: 'Hafif' },
  { value: '0 4px 12px rgba(0,0,0,0.18)', label: 'Orta' },
  { value: '0 8px 24px rgba(0,0,0,0.22)', label: 'Derin' },
];

function currentFilterOption(value) {
  const v = String(value || '');
  return filterOptions.find((o) => o.value === v)?.value || v || 'none';
}

function currentShadowOption(value) {
  const v = String(value || '');
  return shadowPresets.find((o) => o.value === v)?.value || v || 'none';
}

const buttonTaskPresets = [
  { id: 'check', label: 'Kontrol Et', action: 'check' },
  { id: 'menu', label: 'Menü', runtimeAction: 'help' },
  { id: 'prev', label: 'Geri', action: 'SliderGec', value: '__prev__' },
  { id: 'next', label: 'İleri', action: 'SliderGec', value: '__next__' },
  { id: 'play-pause', label: 'Play / Pause', runtimeAction: 'toggle-play-pause' },
  { id: 'mute', label: 'Sesi Kapat', runtimeAction: 'toggle-mute' },
  { id: 'show-answer', label: 'Cevabı Göster', runtimeAction: 'show-answer' },
  { id: 'restart', label: 'Yeniden Başlat', runtimeAction: 'restart' },
  { id: 'complete', label: 'Etkinliği Kapat', runtimeAction: 'complete' },
];

function objectTitle(object) {
  const candidates = [object?.editorName, object?.label, object?.name, object?.text]
    .map((value) => String(value || '').trim())
    .filter((value) => value && !/^[a-z0-9_-]{8,}$/i.test(value));
  return candidates[0] || object?.type || 'Seçili nesne';
}

function findClickTrigger(activity, object) {
  if (!activity || !object) return null;
  const linkedIds = getEditorLinkedSelectionIds(activity, object.id);
  return (activity.triggers || []).find(
    (trigger) =>
      trigger.when === 'onClick' &&
      (linkedIds.has(trigger.target) ||
        (trigger.target === 'Secili Nesne' && activity.selectedObjectId === object.id))
  );
}

export function FormatRightPanelContent({ controller }) {
  const activity = controller.activity || {};
  const object = controller.selectedObject;
  const selectedObjects = controller.selectedObjects || [];
  const commands = controller.commands || {};
  const clickTrigger = findClickTrigger(activity, object);
  const style = object?.style || {};
  const layers = controller.layers || [];
  const slides = controller.slides || [];
  const activities = controller.activities || [];
  const variables = controller.present?.variables || [];
  const objects = controller.objects || [];
  const resolvedNames = controller.resolvedLayerNames || {};
  const isMultiSelection = selectedObjects.length > 1;

  const patchObject = (patch) => {
    if (!object) return;
    commands.patchObject?.(patch);
  };

  const patchStyle = (patch) => {
    if (!object) return;
    commands.setObjectStyle?.(patch);
  };

  const buildClickTrigger = (action, value = '', label = 'tıklama görevi') => ({
    ...(clickTrigger || createTriggerItem((activity.triggers || []).length)),
    when: 'onClick',
    target: getEditorPrimaryObjectId(activity, object.id) || object.id,
    action,
    value,
    name: `${objectTitle(object)} ${label}`,
  });

  const replaceClickTrigger = (nextTrigger) => {
    const currentTriggers = activity.triggers || [];
    return clickTrigger
      ? currentTriggers.map((trigger) => (trigger.id === clickTrigger.id ? nextTrigger : trigger))
      : [...currentTriggers, nextTrigger];
  };

  const setClickTask = (action, value = '') => {
    if (!object) return;
    const currentTriggers = activity.triggers || [];
    const linkedObjectIds = getEditorLinkedSelectionIds(activity, object.id);
    const patchLinkedButtonTaskState = (item, patch) =>
      linkedObjectIds.has(item.id) ? { ...item, ...patch } : item;
    if (String(action || '').startsWith('runtime:')) {
      const runtimeAction = String(action).slice('runtime:'.length);
      const nextTrigger = buildClickTrigger(action, '', 'hazır görevi');
      controller.onUpdateActivity?.({
        ...activity,
        objects: (activity.objects || []).map((item) =>
          patchLinkedButtonTaskState(item, {
            isCheckButton: false,
            runtimeAction,
          })
        ),
        selectedObjectId: nextTrigger.target,
        triggers: replaceClickTrigger(nextTrigger),
      });
      return;
    }
    if (action === 'none') {
      controller.onUpdateActivity?.({
        ...activity,
        objects:
          object.type === 'button'
            ? (activity.objects || []).map((item) =>
                patchLinkedButtonTaskState(item, { isCheckButton: false, runtimeAction: '' })
              )
            : activity.objects,
        selectedObjectId: getEditorPrimaryObjectId(activity, object.id) || object.id,
        triggers: currentTriggers.filter((trigger) => trigger.id !== clickTrigger?.id),
      });
      return;
    }
    const fallbackValue =
      value ||
      (action === 'KatmanaGec'
        ? layers.find((layer) => layer.id !== (object.layerId || 'base'))?.id || 'base'
        : action === 'SliderGec'
          ? '__next__'
          : action === 'SayfaGec'
            ? '__next__'
            : action === 'NesneDurumuAyarla'
              ? object.id
              : action === 'URLAc'
                ? 'https://'
                : ['Goster', 'Gizle', 'NesneToggle', 'SesCal', 'SesDurdur', 'VideoCal', 'VideoDurdur'].includes(action)
                  ? object.id
                  : ['DegiskenAta', 'DegiskenArttir', 'DegiskenAzalt'].includes(action)
                    ? variables[0]?.id || ''
                    : '');
    const nextTrigger = buildClickTrigger(action, fallbackValue, 'tıklama görevi');
    controller.onUpdateActivity?.({
      ...activity,
      objects:
        object.type === 'button'
          ? (activity.objects || []).map((item) =>
              patchLinkedButtonTaskState(item, { isCheckButton: false, runtimeAction: '' })
            )
          : activity.objects,
      selectedObjectId: nextTrigger.target,
      triggers: replaceClickTrigger(nextTrigger),
    });
  };

  const applyButtonTask = (preset) => {
    if (!object || object.type !== 'button') return;
    const currentTriggers = activity.triggers || [];
    const linkedObjectIds = getEditorLinkedSelectionIds(activity, object.id);
    const nextObjectPatch = {
      isCheckButton: preset.action === 'check',
      runtimeAction: preset.runtimeAction || '',
    };
    const nextObjects = (activity.objects || []).map((item) =>
      linkedObjectIds.has(item.id) ? { ...item, ...nextObjectPatch } : item
    );
    let nextTriggers = currentTriggers.filter((trigger) => trigger.id !== clickTrigger?.id);

    if (preset.runtimeAction) {
      const nextTrigger = buildClickTrigger(`runtime:${preset.runtimeAction}`, '', preset.label);
      nextTriggers = replaceClickTrigger(nextTrigger);
    } else if (preset.action && preset.action !== 'check') {
      const nextTrigger = buildClickTrigger(preset.action, preset.value || '', preset.label);
      nextTriggers = replaceClickTrigger(nextTrigger);
    }

    controller.onUpdateActivity?.({
      ...activity,
      objects: nextObjects,
      selectedObjectId: getEditorPrimaryObjectId(activity, object.id) || object.id,
      triggers: nextTriggers,
    });
  };

  const targetOptions =
    clickTrigger?.action === 'SliderGec'
      ? [
          { value: '__next__', label: 'Sonraki slide' },
          { value: '__prev__', label: 'Önceki slide' },
          ...slides.map((slide, index) => ({
            value: slide.id,
            label: `${index + 1}. ${slide.name || slide.sceneName || 'Slide'}`,
          })),
        ]
      : clickTrigger?.action === 'SayfaGec'
        ? [
            { value: '__next__', label: 'Sonraki etkinlik' },
            { value: '__prev__', label: 'Önceki etkinlik' },
            ...activities.map((item, index) => ({
              value: item.id,
              label: item.name || item.sceneName || `Etkinlik ${index + 1}`,
            })),
          ]
        : clickTrigger?.action === 'KatmanaGec'
          ? [
          { value: '', label: 'Hedef seç' },
          ...layers.map((layer, index) => ({
            value: layer.id,
            label:
              resolvedNames[layer.id] ||
              (layer.kind === 'base' ? 'Base Layer' : layer.name || `Layer ${index + 1}`),
          })),
          ]
          : ['Goster', 'Gizle', 'NesneToggle', 'NesneDurumuAyarla', 'SesCal', 'SesDurdur', 'VideoCal', 'VideoDurdur'].includes(clickTrigger?.action)
            ? objects
                .filter((item) => {
                  if (clickTrigger.action === 'SesCal' || clickTrigger.action === 'SesDurdur') return item.type === 'audio';
                  if (clickTrigger.action === 'VideoCal' || clickTrigger.action === 'VideoDurdur') return item.type === 'video';
                  return true;
                })
                .map((item, index) => ({
                  value: item.id,
                  label: item.label || item.name || item.text || `${item.type || 'Nesne'} ${index + 1}`,
                }))
            : ['DegiskenAta', 'DegiskenArttir', 'DegiskenAzalt'].includes(clickTrigger?.action)
              ? variables.map((item, index) => ({
                  value: item.id,
                  label: item.name || `Değişken ${index + 1}`,
                }))
              : [];

  const quickClickTaskValue =
    object?.type === 'button'
      ? object.isCheckButton
        ? 'check'
        : object.runtimeAction
          ? `runtime:${object.runtimeAction}`
          : clickTrigger?.action || 'none'
      : clickTrigger?.action || 'none';
  const clickTaskSummary =
    object?.type === 'button' && object.isCheckButton
      ? 'Cevabı kontrol et'
      : buttonQuickTaskOptions.find((item) => item.value === quickClickTaskValue)?.label ||
        actionOptions.find((item) => item.value === clickTrigger?.action)?.label ||
        clickTrigger?.action ||
        'Tıklama görevi yok';

  if (isMultiSelection) {
    return (
      <>
        <PanelCard title="1. Toplu görünüm" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <FieldLabel>
                Metin rengi
                <ColorInput value="#111827" onChange={(value) => commands.setObjectStyle?.({ color: value })} />
              </FieldLabel>
              <FieldLabel>
                Zemin
                <ColorInput value="#ffffff" onChange={(value) => commands.setObjectStyle?.({ background: value })} />
              </FieldLabel>
              <FieldLabel>
                Font
                <NumberInput value={16} onChange={(value) => commands.setObjectStyle?.({ fontSize: value })} />
              </FieldLabel>
              <FieldLabel>
                Radius
                <NumberInput value={8} onChange={(value) => commands.setObjectStyle?.({ borderRadius: value })} />
              </FieldLabel>
              <FieldLabel>
                Kenar
                <NumberInput value={1} onChange={(value) => commands.setObjectStyle?.({ borderWidth: value })} />
              </FieldLabel>
              <FieldLabel>
                Kenar rengi
                <ColorInput value="#cbd5e1" onChange={(value) => commands.setObjectStyle?.({ borderColor: value })} />
              </FieldLabel>
            </div>
            <ButtonGrid
              actions={[
                { label: 'Kalın', onClick: () => commands.toggleTextStyle?.('bold') },
                { label: 'İtalik', onClick: () => commands.toggleTextStyle?.('italic') },
                { label: 'Kilitle', onClick: () => commands.setSelectionLocked?.(true) },
                { label: 'Kilidi Aç', onClick: () => commands.setSelectionLocked?.(false) },
              ]}
            />
          </div>
        </PanelCard>
        <PanelCard title="2. Hizala ve düzenle" collapsible>
          <ButtonGrid
            actions={[
              { label: 'Sola Hizala', onClick: () => commands.align?.('left') },
              { label: 'Ortala', onClick: () => commands.align?.('center') },
              { label: 'Sağa Hizala', onClick: () => commands.align?.('right') },
              { label: 'Üste Hizala', onClick: () => commands.align?.('top') },
              { label: 'Yatay Dağıt', onClick: () => commands.distribute?.('horizontal'), disabled: selectedObjects.length < 3 },
              { label: 'Dikey Dağıt', onClick: () => commands.distribute?.('vertical'), disabled: selectedObjects.length < 3 },
              { label: 'Grupla', onClick: commands.groupSelection, disabled: !controller.ribbonController?.can?.group },
              { label: 'Ayır', onClick: commands.ungroupSelection },
            ]}
          />
        </PanelCard>
        <PanelCard title="3. Seçim özeti" collapsible>
          {selectedObjects.slice(0, 10).map((item, index) => (
            <InspectorRow
              key={item.id}
              label={`${index + 1}. ${item.type || 'Nesne'}`}
              value={item.label || item.name || item.text || 'Adsız nesne'}
            />
          ))}
        </PanelCard>
      </>
    );
  }

  if (!object) {
    return (
      <>
        <PanelCard title="Nesne seçilmedi">
          <EmptyHint>Sahnede bir metin, buton, görsel veya etkileşim nesnesi seçildiğinde ayarlar burada açılır.</EmptyHint>
        </PanelCard>
        <PanelCard title="Hızlı işlemler">
          <ButtonGrid
            actions={[
              { label: 'Metin Ekle', onClick: () => commands.insertText?.('body') },
              { label: 'Buton Ekle', onClick: () => commands.insertButtonPreset?.('btn-blue') },
              { label: 'Ekle Sekmesi', onClick: () => commands.setRibbonTab?.('insert') },
              { label: 'Giriş', onClick: () => commands.setRibbonTab?.('home') },
            ]}
          />
        </PanelCard>
      </>
    );
  }

  return (
    <>
      {object.type === 'button' && (
        <PanelCard title="Tıklama Görevi" collapsible={false}>
          <div style={{ display: 'grid', gap: 7 }}>
            <FieldLabel>
              Tıklanınca
              <NativeSelect
                value={quickClickTaskValue}
                options={buttonQuickTaskOptions}
                onChange={(value) => {
                  if (value === 'check') {
                    applyButtonTask(buttonTaskPresets.find((preset) => preset.id === 'check'));
                    return;
                  }
                  setClickTask(value, clickTrigger?.value);
                }}
              />
            </FieldLabel>
            {clickTrigger && targetOptions.length > 0 && (
              <FieldLabel>
                Hedef
                <NativeSelect
                  value={clickTrigger.value || ''}
                  options={targetOptions}
                  onChange={(value) => setClickTask(clickTrigger.action, value)}
                />
              </FieldLabel>
            )}
            {clickTrigger?.action === 'NesneDurumuAyarla' && (
              <FieldLabel>
                Durum
                <NativeSelect
                  value={clickTrigger.stateKey || 'visited'}
                  options={OBJECT_STATE_OPTIONS}
                  onChange={(value) => {
                    const currentTriggers = activity.triggers || [];
                    controller.onUpdateActivity?.({
                      ...activity,
                      triggers: currentTriggers.map((trigger) =>
                        trigger.id === clickTrigger.id ? { ...trigger, stateKey: value } : trigger
                      ),
                    });
                  }}
                />
              </FieldLabel>
            )}
            {clickTrigger && ['DegiskenAta', 'DegiskenArttir', 'DegiskenAzalt'].includes(clickTrigger.action) && (
              <FieldLabel>
                Değer / artış
                <TextInput
                  value={clickTrigger.extra || ''}
                  placeholder={clickTrigger.action === 'DegiskenAta' ? 'Yeni değer' : '1'}
                  onChange={(value) => {
                    const currentTriggers = activity.triggers || [];
                    controller.onUpdateActivity?.({
                      ...activity,
                      triggers: currentTriggers.map((trigger) =>
                        trigger.id === clickTrigger.id ? { ...trigger, extra: value } : trigger
                      ),
                    });
                  }}
                />
              </FieldLabel>
            )}
            <ButtonGrid
              actions={buttonTaskPresets.map((preset) => {
                const selected =
                  (preset.action === 'check' && object.isCheckButton) ||
                  (preset.runtimeAction && object.runtimeAction === preset.runtimeAction) ||
                  (preset.action &&
                    preset.action !== 'check' &&
                    clickTrigger?.action === preset.action &&
                    clickTrigger?.value === preset.value);
                return {
                  label: selected ? `✓ ${preset.label}` : preset.label,
                  onClick: () => applyButtonTask(preset),
                };
              })}
            />
            <InspectorRow
              label="Aktif görev"
              value={clickTaskSummary}
            />
            <ActionButton onClick={commands.openInteractionBuilder}>
              Detaylı Trigger
            </ActionButton>
          </div>
        </PanelCard>
      )}

      <PanelCard title="0. Nesne kimlik" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <InspectorRow label="ID" value={object.id || '-'} />
          <InspectorRow
            label="Tip"
            value={`${objectTypeIcons[object.type] || '•'} ${objectTypeLabelsLocal[object.type] || object.type}`}
          />
        </div>
      </PanelCard>

      <PanelCard title="1. Nesne ve layer" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Ad
            <TextInput value={object.label || ''} onChange={(value) => patchObject({ label: value })} />
          </FieldLabel>
          <FieldLabel>
            Layer
            <NativeSelect
              value={object.layerId || activity.activeLayerId || 'base'}
              options={layers.map((layer, index) => ({
                value: layer.id,
                label:
                  resolvedNames[layer.id] ||
                  (layer.kind === 'base' ? 'Base Layer' : layer.name || `Layer ${index + 1}`),
              }))}
              onChange={(value) => patchObject({ layerId: value })}
            />
          </FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <ToggleRow label="Görünür" checked={object.visible !== false} onChange={(checked) => patchObject({ visible: checked })} />
            <ToggleRow label="Kilitli" checked={!!object.locked} onChange={(checked) => patchObject({ locked: checked })} />
          </div>
        </div>
      </PanelCard>

      <PanelCard title="2. Konum ve boyut" collapsible>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <FieldLabel>
            X
            <NumberInput value={object.x || 0} onChange={(value) => patchObject({ x: value })} />
          </FieldLabel>
          <FieldLabel>
            Y
            <NumberInput value={object.y || 0} onChange={(value) => patchObject({ y: value })} />
          </FieldLabel>
          <FieldLabel>
            Genişlik
            <NumberInput value={object.width || 1} onChange={(value) => patchObject({ width: Math.max(1, value || 1) })} />
          </FieldLabel>
          <FieldLabel>
            Yükseklik
            <NumberInput value={object.height || 1} onChange={(value) => patchObject({ height: Math.max(1, value || 1) })} />
          </FieldLabel>
          <FieldLabel>
            Döndürme
            <NumberInput value={object.rotation || 0} onChange={(value) => patchObject({ rotation: value })} />
          </FieldLabel>
        </div>
      </PanelCard>

      <PanelCard title="3. Görsel stil" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              Metin rengi
              <ColorInput value={style.color || '#111827'} onChange={(value) => patchStyle({ color: value })} />
            </FieldLabel>
            <FieldLabel>
              Zemin
              <ColorInput value={style.background || '#ffffff'} onChange={(value) => patchStyle({ background: value })} />
            </FieldLabel>
            <FieldLabel>
              Font
              <NumberInput value={style.fontSize || object.fontSize || 16} onChange={(value) => patchStyle({ fontSize: value })} />
            </FieldLabel>
            <FieldLabel>
              Radius
              <NumberInput value={style.borderRadius || 0} onChange={(value) => patchStyle({ borderRadius: value })} />
            </FieldLabel>
            <FieldLabel>
              Kenar
              <NumberInput value={style.borderWidth || 0} onChange={(value) => patchStyle({ borderWidth: value })} />
            </FieldLabel>
            <FieldLabel>
              Kenar rengi
              <ColorInput value={style.borderColor || '#cbd5e1'} onChange={(value) => patchStyle({ borderColor: value })} />
            </FieldLabel>
          </div>
          <ButtonGrid
            actions={[
              { label: 'Kalın', onClick: () => commands.toggleTextStyle?.('bold'), disabled: object.type !== 'text' },
              { label: 'İtalik', onClick: () => commands.toggleTextStyle?.('italic'), disabled: object.type !== 'text' },
              { label: 'Grupla', onClick: commands.groupSelection, disabled: !controller.ribbonController?.can?.group },
              { label: 'Ayır', onClick: commands.ungroupSelection },
            ]}
          />
        </div>
      </PanelCard>

      <PanelCard title="3.5 Görünürlük ve efektler" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <FieldLabel>
            Opaklık (%)
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((object.opacity ?? style.opacity ?? 1) * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  patchStyle({ opacity: val });
                }}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
              <NumberInput
                value={Math.round((object.opacity ?? style.opacity ?? 1) * 100)}
                onChange={(value) => {
                  const val = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
                  patchStyle({ opacity: val });
                }}
              />
            </div>
          </FieldLabel>
          <FieldLabel>
            Filtre
            <NativeSelect
              value={currentFilterOption(style.filter)}
              options={filterOptions}
              onChange={(value) => patchStyle({ filter: value === 'none' ? '' : value })}
            />
          </FieldLabel>
          <FieldLabel>
            Gölge
            <NativeSelect
              value={currentShadowOption(style.boxShadow)}
              options={shadowPresets}
              onChange={(value) => patchStyle({ boxShadow: value === 'none' ? '' : value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>

      {object.type !== 'button' && (
        <PanelCard title="4. Tıklama görevi" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            <FieldLabel>
              Aksiyon
              <NativeSelect
                value={clickTrigger?.action || 'none'}
                options={actionOptions}
                onChange={(value) => setClickTask(value, clickTrigger?.value)}
              />
            </FieldLabel>
            {clickTrigger && targetOptions.length > 0 && (
              <FieldLabel>
                Hedef
                <NativeSelect
                  value={clickTrigger.value || ''}
                  options={targetOptions}
                  onChange={(value) => setClickTask(clickTrigger.action, value)}
                />
              </FieldLabel>
            )}
            {clickTrigger?.action === 'NesneDurumuAyarla' && (
              <FieldLabel>
                Durum
                <NativeSelect
                  value={clickTrigger.stateKey || 'visited'}
                  options={OBJECT_STATE_OPTIONS}
                  onChange={(value) => {
                    const currentTriggers = activity.triggers || [];
                    controller.onUpdateActivity?.({
                      ...activity,
                      triggers: currentTriggers.map((trigger) =>
                        trigger.id === clickTrigger.id ? { ...trigger, stateKey: value } : trigger
                      ),
                    });
                  }}
                />
              </FieldLabel>
            )}
            {clickTrigger && ['DegiskenAta', 'DegiskenArttir', 'DegiskenAzalt'].includes(clickTrigger.action) && (
              <FieldLabel>
                Değer / artış
                <TextInput
                  value={clickTrigger.extra || ''}
                  placeholder={clickTrigger.action === 'DegiskenAta' ? 'Yeni değer' : '1'}
                  onChange={(value) => {
                    const currentTriggers = activity.triggers || [];
                    controller.onUpdateActivity?.({
                      ...activity,
                      triggers: currentTriggers.map((trigger) =>
                        trigger.id === clickTrigger.id ? { ...trigger, extra: value } : trigger
                      ),
                    });
                  }}
                />
              </FieldLabel>
            )}
            <InspectorRow
              label="Özet"
              value={
                clickTrigger
                  ? `${actionOptions.find((item) => item.value === clickTrigger.action)?.label || clickTrigger.action}`
                  : 'Tıklama görevi yok'
              }
            />
            <ActionButton onClick={commands.openInteractionBuilder}>
              Detaylı Trigger
            </ActionButton>
          </div>
        </PanelCard>
      )}

      {['audio', 'video', 'embed', 'draggable', 'dropzone', 'image'].includes(object.type) && (
        <PanelCard title="5. Tipe özel ayarlar" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            {object.type === 'image' ? (
              <>
                <InspectorRow
                  label="Kaynak"
                  value={object.imageData ? 'Yüklü görsel' : object.mediaUrl || 'Yok'}
                />
                <ButtonGrid
                  actions={[
                    {
                      label: 'Değiştir',
                      onClick: () => commands.openMediaPicker?.('image') || commands.insertImage?.(),
                    },
                  ]}
                />
              </>
            ) : null}
            {object.type === 'audio' || object.type === 'video' ? (
              <>
                <FieldLabel>
                  Medya URL
                  <TextInput
                    value={object.mediaUrl || object.audioUrl || object.videoUrl || ''}
                    onChange={(value) => patchObject({ mediaUrl: value })}
                  />
                </FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <ToggleRow label="Otomatik oynat" checked={!!object.autoPlay} onChange={(checked) => patchObject({ autoPlay: checked })} />
                  <ToggleRow label="Kontrol çubuğu" checked={!!object.showPlayerControls} onChange={(checked) => patchObject({ showPlayerControls: checked })} />
                </div>
              </>
            ) : null}
            {object.type === 'embed' ? (
              <FieldLabel>
                Web / embed URL
                <TextInput value={object.embedUrl || object.url || ''} onChange={(value) => patchObject({ embedUrl: value, url: value })} />
              </FieldLabel>
            ) : null}
            {object.type === 'draggable' || object.type === 'dropzone' ? (
              <InspectorRow
                label="Sürükle-bırak"
                value={object.type === 'draggable' ? 'Sürüklenebilir öğe' : 'Bırakma alanı'}
              />
            ) : null}
          </div>
        </PanelCard>
      )}

      <PanelCard title="6. Sıralama ve erişilebilirlik" collapsible>
        <div style={{ display: 'grid', gap: 7 }}>
          <ButtonGrid
            actions={[
              { label: 'Öne Getir', onClick: commands.bringFront },
              { label: 'Arkaya Gönder', onClick: commands.sendBack },
              { label: 'Kilitle', onClick: () => commands.setSelectionLocked?.(true) },
              { label: 'Kilidi Aç', onClick: () => commands.setSelectionLocked?.(false) },
            ]}
          />
          <FieldLabel>
            ARIA rolü
            <NativeSelect
              value={object.ariaRole || object.role || 'presentation'}
              options={ARIA_ROLE_OPTIONS}
              onChange={(value) => patchObject({ ariaRole: value, role: value })}
            />
          </FieldLabel>
          <FieldLabel>
            Alternatif metin
            <TextInput
              value={object.altText || object.ariaLabel || ''}
              onChange={(value) => patchObject({ altText: value, ariaLabel: value })}
            />
          </FieldLabel>
        </div>
      </PanelCard>
    </>
  );
}

export default function FormatRightPanel({ controller }) {
  const object = controller.selectedObject;
  const selectedObjects = controller.selectedObjects || [];
  const isMultiSelection = selectedObjects.length > 1;
  const panelKey = isMultiSelection
    ? selectedObjects.map((item) => item.id).join('|')
    : object?.id || 'empty';
  return (
    <PanelShell
      key={panelKey}
      title={isMultiSelection ? 'Toplu Biçim' : 'Seçili Nesne Ayarları'}
      subtitle={
        isMultiSelection
          ? `${selectedObjects.length} nesne seçili`
          : object
            ? objectTitle(object)
            : 'Biçim ayarları için nesne seç.'
      }
    >
      <FormatRightPanelContent controller={controller} />
    </PanelShell>
  );
}
