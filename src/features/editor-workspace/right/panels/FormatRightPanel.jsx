import { ARIA_ROLE_OPTIONS, OBJECT_STATE_OPTIONS, TRIGGER_ACTION_OPTIONS } from '../../../../constants';
import { createTriggerItem } from '../../../../logic/activityFactory';
import {
  getEditorLinkedSelectionIds,
  getEditorPrimaryObjectId,
  getTriggerTargetId,
} from '../../../../logic/editorHelpers';
import { SCENE_TEMPLATE_BUTTON_INTRO_ID } from '../../../../logic/sceneTemplates';

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

// Çoklu seçimde bir alanın tüm öğelerde aynı olup olmadığını saptar; farklıysa
// kullanıcıya "Karışık" gösterilir ki körlemesine ilk öğenin değeri yazılmasın.
function getMixedFieldState(objects, accessor) {
  if (!Array.isArray(objects) || objects.length <= 1) return { mixed: false };
  const first = accessor(objects[0]);
  const mixed = objects.some((item) => accessor(item) !== first);
  return { mixed, value: first };
}

function MixedBadge({ show }) {
  if (!show) return null;
  return (
    <span
      title="Seçili öğelerde farklı değerler var. Değiştirirseniz tümüne uygulanır."
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: '#b45309',
        background: '#fef3c7',
        borderRadius: 6,
        padding: '1px 5px',
        marginLeft: 6,
      }}
    >
      Karışık
    </span>
  );
}

const actionOptions = [
  { value: 'none', label: 'Bir şey yapma' },
  { value: 'runtime:restart', label: 'Yeniden Başlat' },
  { value: 'runtime:toggle-mute', label: 'Sesi Aç / Kapat' },
  { value: 'runtime:toggle-play-pause', label: 'Oynat / Duraklat' },
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
  { id: 'play-pause', label: 'Oynat / Duraklat', runtimeAction: 'toggle-play-pause' },
  { id: 'mute', label: 'Sesi Kapat', runtimeAction: 'toggle-mute' },
  { id: 'show-answer', label: 'Cevabı Göster', runtimeAction: 'show-answer' },
  { id: 'restart', label: 'Yeniden Başlat', runtimeAction: 'restart' },
  { id: 'complete', label: 'Etkinliği Kapat', runtimeAction: 'complete' },
];

function isSystemGeneratedButtonPairSelection(selectedObjects) {
  if (!selectedObjects || selectedObjects.length < 2) return false;
  const groupId = String(selectedObjects[0]?.linkedHoverGroup || '').trim();
  if (!groupId) return false;
  const allSameGroup = selectedObjects.every(
    (item) => String(item.linkedHoverGroup || '').trim() === groupId
  );
  if (!allSameGroup) return false;

  const buttons = selectedObjects.filter((item) => item && item.type === 'button');
  if (buttons.length < 2) return false;

  return (
    groupId.startsWith('answer-template:') ||
    groupId.startsWith('button-intro:') ||
    groupId.startsWith('ready:') ||
    buttons.some(
      (item) =>
        item.generatedBy === 'answer-template' ||
        item.sceneTemplateId === SCENE_TEMPLATE_BUTTON_INTRO_ID ||
        String(item.sceneTemplateSlotId || '').startsWith('ready-button:')
    )
  );
}

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
  const can = controller.ribbonController?.can || {};
  const clickTrigger = findClickTrigger(activity, object);
  const style = object?.style || {};
  const layers = controller.layers || [];
  const slides = controller.slides || [];
  const activities = controller.activities || [];
  const variables = controller.present?.variables || [];
  const objects = controller.objects || [];
  const resolvedNames = controller.resolvedLayerNames || {};
  const isMultiSelection = selectedObjects.length > 1 && !isSystemGeneratedButtonPairSelection(selectedObjects);

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
    target: getTriggerTargetId(activity, object.id),
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
            label: `${index + 1}. ${slide.name || slide.sceneName || 'Sahne'}`,
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
              (layer.kind === 'base' ? 'Temel Katman' : layer.name || `${index + 1}. Katman`),
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
    // Toplu seçimde de tekli seçimdeki (mantıklı olan) tüm biçim kontrollerini
    // sunarız. Alanlar, seçimdeki ilk öğenin gerçek değerlerini yansıtır; değişiklik
    // tüm seçili öğelere uygulanır (patchObject/patchStyle -> applyRibbonObjectPatch
    // zaten tüm hedeflere yazar). Etikete/alt metne/tetikleyici hedefine gibi
    // öğeye özgü alanlar toplu seçimde mantıksız olduğundan dışarıda bırakılır.
    const multi = selectedObjects[0] || {};
    const multiStyle = multi.style || {};
    const num = (val, fallback) => (Number.isFinite(Number(val)) ? Number(val) : fallback);
    const multiOpacityPct = Math.round((multi.opacity ?? multiStyle.opacity ?? 1) * 100);
    // Anahtar alanlar için "Karışık" durumu (seçili öğeler farklı değer taşıyorsa).
    const mixedLayer = getMixedFieldState(selectedObjects, (o) => o.layerId || 'base');
    const mixedColor = getMixedFieldState(selectedObjects, (o) => o.style?.color || '');
    const mixedBackground = getMixedFieldState(selectedObjects, (o) => o.style?.background || '');
    const mixedOpacity = getMixedFieldState(selectedObjects, (o) => o.opacity ?? o.style?.opacity ?? 1);
    const mixedFilter = getMixedFieldState(selectedObjects, (o) => o.style?.filter || '');
    const mixedShadow = getMixedFieldState(selectedObjects, (o) => o.style?.boxShadow || '');
    return (
      <>
        <PanelCard title="1. Genel" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            <FieldLabel>
              <span>Katman <MixedBadge show={mixedLayer.mixed} /></span>
              <NativeSelect
                value={multi.layerId || activity.activeLayerId || 'base'}
                options={layers.map((layer, index) => ({
                  value: layer.id,
                  label:
                    resolvedNames[layer.id] ||
                    (layer.kind === 'base' ? 'Temel Katman' : layer.name || `${index + 1}. Katman`),
                }))}
                onChange={(value) => patchObject({ layerId: value })}
              />
            </FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <ToggleRow label="Görünür" checked={multi.visible !== false} onChange={(checked) => patchObject({ visible: checked })} />
              <ToggleRow label="Kilitli" checked={!!multi.locked} onChange={(checked) => patchObject({ locked: checked })} />
            </div>
          </div>
        </PanelCard>

        <PanelCard title="2. Konum ve boyut" collapsible>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <FieldLabel>
              X
              <NumberInput value={Math.round(num(multi.x, 0))} onChange={(value) => patchObject({ x: value })} />
            </FieldLabel>
            <FieldLabel>
              Y
              <NumberInput value={Math.round(num(multi.y, 0))} onChange={(value) => patchObject({ y: value })} />
            </FieldLabel>
            <FieldLabel>
              Genişlik
              <NumberInput value={Math.round(num(multi.width, 1))} onChange={(value) => patchObject({ width: Math.max(1, value || 1) })} />
            </FieldLabel>
            <FieldLabel>
              Yükseklik
              <NumberInput value={Math.round(num(multi.height, 1))} onChange={(value) => patchObject({ height: Math.max(1, value || 1) })} />
            </FieldLabel>
            <FieldLabel>
              Döndürme
              <NumberInput value={Math.round(num(multi.rotation, 0))} onChange={(value) => patchObject({ rotation: value })} />
            </FieldLabel>
          </div>
        </PanelCard>

        <PanelCard title="3. Görsel stil" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <FieldLabel>
                <span>Metin rengi <MixedBadge show={mixedColor.mixed} /></span>
                <ColorInput ariaLabel="Metin rengi" value={multiStyle.color || '#111827'} onChange={(value) => patchStyle({ color: value })} />
              </FieldLabel>
              <FieldLabel>
                <span>Zemin <MixedBadge show={mixedBackground.mixed} /></span>
                <ColorInput ariaLabel="Zemin rengi" value={multiStyle.background || '#ffffff'} onChange={(value) => patchStyle({ background: value })} />
              </FieldLabel>
              <FieldLabel>
                Font
                <NumberInput value={num(multiStyle.fontSize ?? multi.fontSize, 16)} onChange={(value) => patchStyle({ fontSize: value })} />
              </FieldLabel>
              <FieldLabel>
                Radius
                <NumberInput value={num(multiStyle.borderRadius, 0)} onChange={(value) => patchStyle({ borderRadius: value })} />
              </FieldLabel>
              <FieldLabel>
                Kenar
                <NumberInput value={num(multiStyle.borderWidth, 0)} onChange={(value) => patchStyle({ borderWidth: value })} />
              </FieldLabel>
              <FieldLabel>
                Kenar rengi
                <ColorInput ariaLabel="Kenar rengi" value={multiStyle.borderColor || '#cbd5e1'} onChange={(value) => patchStyle({ borderColor: value })} />
              </FieldLabel>
            </div>
            <ButtonGrid
              actions={[
                { label: 'Kalın', onClick: () => commands.toggleTextStyle?.('bold'), disabled: !can.textStyle },
                { label: 'İtalik', onClick: () => commands.toggleTextStyle?.('italic'), disabled: !can.textStyle },
                {
                  label: can.selectionLocked ? 'Kilidi Aç' : 'Kilitle',
                  onClick: () => commands.setSelectionLocked?.(!can.selectionLocked),
                  disabled: !can.selection,
                },
              ]}
            />
          </div>
        </PanelCard>

        <PanelCard title="3.5 Görünürlük ve efektler" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            <FieldLabel>
              <span>Opaklık (%) <MixedBadge show={mixedOpacity.mixed} /></span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8, alignItems: 'center' }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={multiOpacityPct}
                  onChange={(e) => patchStyle({ opacity: Number(e.target.value) / 100 })}
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
                <NumberInput
                  min={0}
                  max={100}
                  value={multiOpacityPct}
                  onChange={(value) => patchStyle({ opacity: Math.max(0, Math.min(100, Number(value) || 0)) / 100 })}
                />
              </div>
            </FieldLabel>
            <FieldLabel>
              <span>Filtre <MixedBadge show={mixedFilter.mixed} /></span>
              <NativeSelect
                value={currentFilterOption(multiStyle.filter)}
                options={filterOptions}
                onChange={(value) => patchStyle({ filter: value === 'none' ? '' : value })}
              />
            </FieldLabel>
            <FieldLabel>
              <span>Gölge <MixedBadge show={mixedShadow.mixed} /></span>
              <NativeSelect
                value={currentShadowOption(multiStyle.boxShadow)}
                options={shadowPresets}
                onChange={(value) => patchStyle({ boxShadow: value === 'none' ? '' : value })}
              />
            </FieldLabel>
          </div>
        </PanelCard>

        <PanelCard title="4. Hizala ve düzenle" collapsible>
          <ButtonGrid
            actions={[
              { label: 'Sola Hizala', onClick: () => commands.align?.('left'), disabled: !can.align },
              { label: 'Ortala', onClick: () => commands.align?.('center'), disabled: !can.align },
              { label: 'Sağa Hizala', onClick: () => commands.align?.('right'), disabled: !can.align },
              { label: 'Üste Hizala', onClick: () => commands.align?.('top'), disabled: !can.align },
              { label: 'Ortaya Hizala', onClick: () => commands.align?.('middle'), disabled: !can.align },
              { label: 'Alta Hizala', onClick: () => commands.align?.('bottom'), disabled: !can.align },
              // Dağıtma eşiği ribbon ile aynı: en az 3 birim (grup = tek birim)
              { label: 'Yatay Dağıt', onClick: () => commands.distribute?.('horizontal'), disabled: !can.distribute },
              { label: 'Dikey Dağıt', onClick: () => commands.distribute?.('vertical'), disabled: !can.distribute },
              {
                label: can.ungroup ? 'Ayır' : 'Grupla',
                onClick: can.ungroup ? commands.ungroupSelection : commands.groupSelection,
                disabled: !can.group && !can.ungroup,
              },
            ]}
          />
        </PanelCard>

        <PanelCard title="5. Seçim özeti" collapsible>
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
            {clickTrigger && (targetOptions.length > 0 || clickTrigger.action === 'URLAc') && (
              <FieldLabel>
                {clickTrigger.action === 'URLAc' ? 'Bağlantı Adresi' : 'Hedef'}
                {clickTrigger.action === 'URLAc' ? (
                  <TextInput
                    value={clickTrigger.value || ''}
                    placeholder="https://..."
                    onChange={(value) => setClickTask(clickTrigger.action, value)}
                  />
                ) : (
                  <NativeSelect
                    value={clickTrigger.value || ''}
                    options={targetOptions}
                    onChange={(value) => setClickTask(clickTrigger.action, value)}
                  />
                )}
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

      {object.type === 'button' && (
        <PanelCard title="İkon" collapsible>
          <div style={{ display: 'grid', gap: 7 }}>
            <ButtonGrid
              actions={[
                {
                  label: object.icon?.svg ? 'İkonu Değiştir' : 'İkon Seç',
                  onClick: () => {
                    // Hazır buton ikon-yarısında (label'ı tek glif) yeni ikon eskisinin
                    // YERİNE geçmeli: iconPosition'ı 'only' yapıp glifi gizleriz.
                    const labelText = String(object.label || object.text || '').trim();
                    // Mute/Play-Pause gibi dinamik (state'e göre ikon/etiket değiştiren)
                    // butonlarda 'only' YAPMA: aksi halde çalışma anında dinamik
                    // ses/oynat-duraklat geri bildirimi (🔊︎/🔇︎) kaybolur.
                    const isDynamicButton =
                      object.runtimeAction === 'toggle-mute' ||
                      object.runtimeAction === 'toggle-play-pause' ||
                      object.sceneTemplateDemoAction === 'toggle-mute' ||
                      object.sceneTemplateDemoAction === 'toggle-play-pause' ||
                      !!object.dynamicSoundIcon;
                    const isReadyIconHalf =
                      !isDynamicButton &&
                      (String(object.sceneTemplateSlotId || '').endsWith('-icon') ||
                        String(object.soundIconMode || '') === 'icon-only' ||
                        (!!object.readyButtonPresetId &&
                          labelText.length <= 3 &&
                          !/[\p{L}\p{N}]/u.test(labelText)));
                    commands.openIconPicker?.((selection) =>
                      patchObject({
                        icon: { name: selection.iconName, svg: selection.iconSvg },
                        iconPosition: isReadyIconHalf
                          ? 'only'
                          : object.iconPosition && object.iconPosition !== 'none'
                            ? object.iconPosition
                            : 'left',
                      })
                    );
                  },
                },
                ...(object.icon?.svg
                  ? [
                      {
                        label: 'İkonu Kaldır',
                        onClick: () => patchObject({ icon: null, iconPosition: 'none' }),
                      },
                    ]
                  : []),
              ]}
            />
            {object.icon?.svg && (
              <FieldLabel>
                Konum
                <NativeSelect
                  value={object.iconPosition || 'left'}
                  options={[
                    { value: 'left', label: 'Sol (metinden önce)' },
                    { value: 'right', label: 'Sağ (metinden sonra)' },
                    { value: 'only', label: 'Yalnız ikon' },
                    { value: 'none', label: 'Gizli' },
                  ]}
                  onChange={(value) => patchObject({ iconPosition: value })}
                />
              </FieldLabel>
            )}
            {object.icon?.name && <InspectorRow label="Seçili ikon" value={object.icon.name} />}
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
                  (layer.kind === 'base' ? 'Temel Katman' : layer.name || `${index + 1}. Katman`),
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
              <ColorInput ariaLabel="Metin rengi" value={style.color || '#111827'} onChange={(value) => patchStyle({ color: value })} />
            </FieldLabel>
            <FieldLabel>
              Zemin
              <ColorInput ariaLabel="Zemin rengi" value={style.background || '#ffffff'} onChange={(value) => patchStyle({ background: value })} />
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
              <ColorInput ariaLabel="Kenar rengi" value={style.borderColor || '#cbd5e1'} onChange={(value) => patchStyle({ borderColor: value })} />
            </FieldLabel>
          </div>
          <ButtonGrid
            actions={[
              { label: 'Kalın', onClick: () => commands.toggleTextStyle?.('bold'), disabled: object.type !== 'text' },
              { label: 'İtalik', onClick: () => commands.toggleTextStyle?.('italic'), disabled: object.type !== 'text' },
              {
                label: can.ungroup ? 'Ayır' : 'Grupla',
                onClick: can.ungroup ? commands.ungroupSelection : commands.groupSelection,
                disabled: !can.group && !can.ungroup,
              },
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
            {clickTrigger && (targetOptions.length > 0 || clickTrigger.action === 'URLAc') && (
              <FieldLabel>
                {clickTrigger.action === 'URLAc' ? 'Bağlantı Adresi' : 'Hedef'}
                {clickTrigger.action === 'URLAc' ? (
                  <TextInput
                    value={clickTrigger.value || ''}
                    placeholder="https://..."
                    onChange={(value) => setClickTask(clickTrigger.action, value)}
                  />
                ) : (
                  <NativeSelect
                    value={clickTrigger.value || ''}
                    options={targetOptions}
                    onChange={(value) => setClickTask(clickTrigger.action, value)}
                  />
                )}
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
              {
                label: can.selectionLocked ? 'Kilidi Aç' : 'Kilitle',
                onClick: () => commands.setSelectionLocked?.(!can.selectionLocked),
                disabled: !can.selection,
              },
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

      <PanelCard title="7. Hizala" collapsible>
        {/* Tek öge (veya hazır buton çifti) sahneye göre hizalanır; çiftlerde Ayır görünür */}
        <ButtonGrid
          actions={[
            { label: 'Sola Hizala', onClick: () => commands.align?.('left'), disabled: !can.align },
            { label: 'Ortala', onClick: () => commands.align?.('center'), disabled: !can.align },
            { label: 'Sağa Hizala', onClick: () => commands.align?.('right'), disabled: !can.align },
            { label: 'Üste Hizala', onClick: () => commands.align?.('top'), disabled: !can.align },
            { label: 'Ortaya Hizala', onClick: () => commands.align?.('middle'), disabled: !can.align },
            { label: 'Alta Hizala', onClick: () => commands.align?.('bottom'), disabled: !can.align },
            {
              label: can.ungroup ? 'Ayır' : 'Grupla',
              onClick: can.ungroup ? commands.ungroupSelection : commands.groupSelection,
              disabled: !can.group && !can.ungroup,
            },
          ]}
        />
      </PanelCard>
    </>
  );
}

export default function FormatRightPanel({ controller }) {
  const object = controller.selectedObject;
  const selectedObjects = controller.selectedObjects || [];
  const isMultiSelection = selectedObjects.length > 1 && !isSystemGeneratedButtonPairSelection(selectedObjects);
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
