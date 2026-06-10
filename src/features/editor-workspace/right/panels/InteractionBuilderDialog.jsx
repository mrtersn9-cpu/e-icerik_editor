import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  OBJECT_STATE_OPTIONS,
  TRIGGER_ACTION_OPTIONS,
  TRIGGER_OPERATOR_OPTIONS,
  TRIGGER_WHEN_OPTIONS,
  VARIABLE_TYPES,
} from '../../../../constants';
import { createTriggerConditionItem, createTriggerItem } from '../../../../logic/activityFactory';
import {
  getEditorLinkedSelectionIds,
  getEditorPrimaryObjectId,
  getTriggerTargetId,
} from '../../../../logic/editorHelpers';
import { validateFormula, detectCircularDependency } from '../../../../logic/formulaEngine';
import {
  castVariableValue,
  createVariableItem,
  getDefaultVariableValue,
  normalizeVariable,
} from '../../../../logic/normalize';

import {
  ActionButton,
  ButtonGrid,
  EmptyHint,
  FieldLabel,
  InspectorRow,
  NativeSelect,
  NumberInput,
  PanelTabs,
  StatusPill,
  TextInput,
  ToggleRow,
  inspectorChrome,
} from './PanelPrimitives';
import {
  getFriendlyTriggerSourceLabel,
  getFriendlyTriggerValueLabel,
} from './triggerLabels';

const dialogTabs = [
  { id: 'triggers', label: 'Triggerlar' },
  { id: 'variables', label: 'Değişkenler' },
  { id: 'conditions', label: 'Koşullar' },
  { id: 'quick', label: 'Hızlı Aksiyonlar' },
];

const runtimeActionOptions = [
  { value: 'runtime:restart', label: 'Yeniden Başlat', group: 'runtime' },
  { value: 'runtime:toggle-mute', label: 'Sesi Aç / Kapat', group: 'runtime' },
  { value: 'runtime:toggle-play-pause', label: 'Oynat / Duraklat', group: 'runtime' },
  { value: 'runtime:show-answer', label: 'Cevabı Göster', group: 'runtime' },
  { value: 'runtime:help', label: 'Menü / Yardım', group: 'runtime' },
  { value: 'runtime:complete', label: 'Etkinliği Kapat', group: 'runtime' },
];

const actionOptions = [...TRIGGER_ACTION_OPTIONS, ...runtimeActionOptions];

// Operatörler değişken tipine göre filtrelenir: metne ">" gibi sayısal operatör sunmak
// runtime'da her zaman false döndüğü için anlamsız ve kafa karıştırıcıdır.
const OPERATORS_BY_VARIABLE_TYPE = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  text: ['eq', 'neq', 'contains'],
  boolean: ['truthy', 'falsy', 'eq', 'neq'],
};

function getOperatorOptionsForCondition(condition, variables) {
  if (!condition || condition.sourceType === 'objectState') return TRIGGER_OPERATOR_OPTIONS;
  const variable = (variables || []).find((item) => item.id === condition.sourceId);
  const allowed = OPERATORS_BY_VARIABLE_TYPE[variable?.type];
  if (!allowed) return TRIGGER_OPERATOR_OPTIONS;
  return TRIGGER_OPERATOR_OPTIONS.filter((option) => allowed.includes(option.value));
}

const triggerCategoryOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'Nesne', label: 'Nesne' },
  { value: 'Layer', label: 'Katman' },
  { value: 'Geçiş', label: 'Geçiş' },
  { value: 'Değişken', label: 'Değişken' },
  { value: 'Medya', label: 'Medya' },
  { value: 'Hazır Görev', label: 'Hazır' },
];

function optionLabel(options = [], value = '', fallback = '') {
  return options.find((item) => item.value === value)?.label || fallback || value;
}

function safeObjectName(object = null, index = 0) {
  const raw = String(object?.editorName || object?.label || object?.name || object?.text || '').trim();
  if (raw && !/^[a-z0-9_-]{8,}$/i.test(raw)) return raw;
  const typeMap = {
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
  return `${typeMap[object?.type] || 'Nesne'} ${index + 1}`;
}

function safeVariableName(variable = null, index = 0) {
  const raw = String(variable?.name || '').trim();
  return raw || `Değişken ${index + 1}`;
}

function triggerContext(controller) {
  return {
    activities: controller.activities || [],
    layers: controller.layers || [],
    objects: controller.objects || [],
    resolvedLayerNames: controller.resolvedLayerNames || {},
    slides: controller.slides || [],
  };
}

function buildSourceOptions(controller) {
  const objects = controller.objects || [];
  return [
    { value: controller.selectedObject?.id || 'TiklananNesne', label: 'Seçili buton / nesne' },
    { value: 'TiklananNesne', label: 'Her tıklanan nesne' },
    { value: 'Secili Nesne', label: 'Eski seçili nesne (nesne seç)' },
    { value: '__activity__', label: 'Sahne / yükleme' },
    ...objects
      .filter((object) => object.id !== controller.selectedObject?.id)
      .map((object, index) => ({
      value: object.id,
      label: safeObjectName(object, index),
      })),
  ];
}

function buildValueOptions(action, controller, variables) {
  const objects = controller.objects || [];
  const layers = controller.layers || [];
  const slides = controller.slides || [];
  const activities = controller.activities || [];
  const resolvedNames = controller.resolvedLayerNames || {};

  if (action === 'KatmanaGec') {
    return layers.map((layer, index) => ({
      value: layer.id,
      label:
        resolvedNames[layer.id] ||
        (layer.kind === 'base' ? 'Temel Katman' : layer.name || `${index + 1}. Katman`),
    }));
  }
  if (action === 'SliderGec') {
    return [
      { value: '__next__', label: 'Sonraki sahne' },
      { value: '__prev__', label: 'Önceki sahne' },
      ...slides.map((slide, index) => ({
        value: slide.id,
        label: slide.name || slide.sceneName || `${index + 1}. Sahne`,
      })),
    ];
  }
  if (action === 'SayfaGec') {
    return [
      { value: '__next__', label: 'Sonraki etkinlik' },
      { value: '__prev__', label: 'Önceki etkinlik' },
      ...activities.map((activity, index) => ({
        value: activity.id,
        label: activity.name || activity.sceneName || `Etkinlik ${index + 1}`,
      })),
    ];
  }
  if (
    action === 'Goster' ||
    action === 'Gizle' ||
    action === 'NesneToggle' ||
    action === 'NesneDurumuAyarla' ||
    action === 'ScrollTo'
  ) {
    return objects.map((object, index) => ({
      value: object.id,
      label: safeObjectName(object, index),
    }));
  }
  if (action === 'SesCal' || action === 'SesDurdur') {
    return objects
      .filter((object) => object.type === 'audio')
      .map((object, index) => ({ value: object.id, label: safeObjectName(object, index) }));
  }
  if (action === 'VideoCal' || action === 'VideoDurdur') {
    return objects
      .filter((object) => object.type === 'video')
      .map((object, index) => ({ value: object.id, label: safeObjectName(object, index) }));
  }
  if (
    action === 'DegiskenAta' ||
    action === 'DegiskenArttir' ||
    action === 'DegiskenAzalt'
  ) {
    return variables.map((variable, index) => ({
      value: variable.id,
      label: safeVariableName(variable, index),
    }));
  }
  return [];
}

function defaultTriggerValue(action, controller, variables) {
  const options = buildValueOptions(action, controller, variables);
  if (options[0]) return options[0].value;
  if (action === 'URLAc') return 'https://';
  if (action === 'DegiskenArttir' || action === 'DegiskenAzalt') return variables[0]?.id || '';
  return '';
}

function categorizeTrigger(trigger = {}) {
  if ((trigger.when || '').startsWith('onMedia')) return 'Medya';
  if (trigger.action === 'KatmanaGec') return 'Layer';
  if (trigger.action === 'SliderGec' || trigger.action === 'SayfaGec') return 'Geçiş';
  if (String(trigger.action || '').startsWith('Degisken')) return 'Değişken';
  if (String(trigger.action || '').startsWith('runtime:')) return 'Hazır Görev';
  return 'Nesne';
}

function triggerDisplayTitle(trigger = {}, context = {}) {
  const source = getFriendlyTriggerSourceLabel(trigger, context);
  const action = optionLabel(actionOptions, trigger.action, trigger.action || 'Aksiyon yok');
  const value = getFriendlyTriggerValueLabel(trigger, context);
  return [source, action, value]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' -> ');
}

function triggerSearchText(trigger = {}, context = {}) {
  return [
    trigger.name,
    trigger.action,
    trigger.when,
    categorizeTrigger(trigger),
    getFriendlyTriggerSourceLabel(trigger, context),
    getFriendlyTriggerValueLabel(trigger, context),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR');
}

function validateTrigger(trigger = {}, controller, variables = []) {
  const warnings = [];
  const action = trigger.action || '';
  const value = trigger.value || '';
  if ((trigger.when || 'onClick') === 'onClick' && trigger.target === 'Secili Nesne') {
    warnings.push('Kaynak eski seçili nesne; gerçek butonu seç');
  }
  if (!action) warnings.push('Aksiyon seçilmemiş');
  if (['KatmanaGec', 'SliderGec', 'SayfaGec', 'Goster', 'Gizle', 'NesneToggle', 'NesneDurumuAyarla'].includes(action) && !value) {
    warnings.push('Hedef seçilmemiş');
  }
  if (action === 'KatmanaGec' && value && !(controller.layers || []).some((layer) => layer.id === value)) {
    warnings.push('Katman bulunamadı');
  }
  if (action === 'SliderGec' && value && !['__next__', '__prev__'].includes(value) && !(controller.slides || []).some((slide) => slide.id === value)) {
    warnings.push('Slide bulunamadı');
  }
  if (action === 'SayfaGec' && value && !['__next__', '__prev__'].includes(value) && !(controller.activities || []).some((activity) => activity.id === value)) {
    warnings.push('Etkinlik bulunamadı');
  }
  if (['SesCal', 'SesDurdur'].includes(action) && value && !(controller.objects || []).some((object) => object.id === value && object.type === 'audio')) {
    warnings.push('Ses nesnesi bulunamadı');
  }
  if (['VideoCal', 'VideoDurdur'].includes(action) && value && !(controller.objects || []).some((object) => object.id === value && object.type === 'video')) {
    warnings.push('Video nesnesi bulunamadı');
  }
  if (String(action).startsWith('Degisken') && value && !variables.some((variable) => variable.id === value)) {
    warnings.push('Değişken bulunamadı');
  }
  if (action === 'DegiskenAta') {
    if (!trigger.extra) {
      warnings.push('Formül veya atama değeri boş bırakılamaz');
    } else {
      const formulaValidation = validateFormula(trigger.extra, variables);
      if (!formulaValidation.valid) {
        warnings.push(`Formül hatası: ${formulaValidation.error}`);
      }
    }
    
    const activityTriggers = controller?.activity?.triggers || [];
    const updatedTriggers = activityTriggers.map((t) => t.id === trigger.id ? trigger : t);
    if (!updatedTriggers.some(t => t.id === trigger.id)) {
      updatedTriggers.push(trigger);
    }
    
    const cycleRes = detectCircularDependency(variables, updatedTriggers);
    if (cycleRes.hasCycle) {
      warnings.push(cycleRes.message);
    }
  }
  return warnings;
}

function usageCount(activities = [], variableId = '') {
  if (!variableId) return 0;
  return activities.reduce((count, activity) => {
    const triggers = activity.triggers || [];
    return (
      count +
      triggers.filter(
        (trigger) =>
          trigger.value === variableId ||
          (trigger.conditions || []).some((condition) => condition.sourceId === variableId)
      ).length
    );
  }, 0);
}

function compactButtonStyle(active = false, tone = inspectorChrome.blue) {
  return {
    minHeight: 28,
    borderRadius: 7,
    border: `1px solid ${active ? tone : inspectorChrome.border}`,
    background: active ? `${tone}10` : '#ffffff',
    color: active ? tone : inspectorChrome.text,
    cursor: 'pointer',
    fontSize: 10.5,
    fontWeight: 850,
    textAlign: 'left',
    padding: '5px 7px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

export default function InteractionBuilderDialog({ controller, onClose, open }) {
  const [activeTab, setActiveTab] = useState('triggers');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [draggedTriggerId, setDraggedTriggerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const activity = controller.activity || {};
  const variables = (controller.present?.variables || []).map((variable, index) =>
    normalizeVariable(variable, index)
  );
  const triggers = useMemo(() => activity.triggers || [], [activity.triggers]);
  const [selectedTriggerId, setSelectedTriggerId] = useState(triggers[0]?.id || '');
  const selectedTrigger =
    triggers.find((trigger) => trigger.id === selectedTriggerId) || triggers[0] || null;
  const context = useMemo(() => triggerContext(controller), [controller]);
  const sourceOptions = useMemo(() => buildSourceOptions(controller), [controller]);
  const selectedValueOptions = buildValueOptions(selectedTrigger?.action, controller, variables);
  const selectedPrimaryObjectId = controller.selectedObject
    ? getEditorPrimaryObjectId(activity, controller.selectedObject.id)
    : '';
  const filteredTriggers = useMemo(() => {
    const needle = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return triggers.filter((trigger) => {
      const categoryMatch = categoryFilter === 'all' || categorizeTrigger(trigger) === categoryFilter;
      const searchMatch = !needle || triggerSearchText(trigger, context).includes(needle);
      return categoryMatch && searchMatch;
    });
  }, [categoryFilter, context, searchQuery, triggers]);

  if (!open) return null;

  const patchActivity = (patch) => {
    controller.onUpdateActivity?.({ ...activity, ...patch });
  };

  const setTriggers = (nextTriggers) => {
    patchActivity({ triggers: nextTriggers });
  };

  const patchTrigger = (triggerId, patch) => {
    setTriggers(
      triggers.map((trigger) => (trigger.id === triggerId ? { ...trigger, ...patch } : trigger))
    );
  };

  const addTrigger = (patch = {}) => {
    const base = createTriggerItem(triggers.length);
    const nextTrigger = {
      ...base,
      target: getTriggerTargetId(activity, controller.selectedObject?.id),
      ...patch,
    };
    if (!nextTrigger.value) {
      nextTrigger.value = defaultTriggerValue(nextTrigger.action, controller, variables);
    }
    const isManualClickTask =
      (nextTrigger.when || 'onClick') === 'onClick' &&
      nextTrigger.target &&
      !['TiklananNesne', 'Secili Nesne', 'selected', '__activity__', 'Sahne'].includes(
        nextTrigger.target
      ) &&
      !String(nextTrigger.action || '').startsWith('runtime:');
    const linkedIds = isManualClickTask
      ? getEditorLinkedSelectionIds(activity, nextTrigger.target)
      : new Set();
    patchActivity({
      triggers: [...triggers, nextTrigger],
      ...(linkedIds.size
        ? {
            selectedObjectId: nextTrigger.target,
            objects: (activity.objects || []).map((item) =>
              linkedIds.has(item.id) ? { ...item, isCheckButton: false, runtimeAction: '' } : item
            ),
          }
        : {}),
    });
    setSelectedTriggerId(nextTrigger.id);
    setActiveTab('triggers');
  };

  const duplicateTrigger = (trigger) => {
    if (!trigger) return;
    const nextTrigger = {
      ...trigger,
      id: createTriggerItem(triggers.length).id,
      name: `${trigger.name || 'Trigger'} Kopya`,
      conditions: (trigger.conditions || []).map((condition, index) => ({
        ...condition,
        id: createTriggerConditionItem(index).id,
      })),
    };
    setTriggers([...triggers, nextTrigger]);
    setSelectedTriggerId(nextTrigger.id);
  };

  const removeTrigger = (triggerId) => {
    const nextTriggers = triggers.filter((trigger) => trigger.id !== triggerId);
    setTriggers(nextTriggers);
    setSelectedTriggerId(nextTriggers[0]?.id || '');
  };

  const moveTrigger = (triggerId, direction) => {
    const index = triggers.findIndex((trigger) => trigger.id === triggerId);
    const nextIndex = Math.max(0, Math.min(triggers.length - 1, index + direction));
    if (index < 0 || index === nextIndex) return;
    const nextTriggers = [...triggers];
    const [item] = nextTriggers.splice(index, 1);
    nextTriggers.splice(nextIndex, 0, item);
    setTriggers(nextTriggers);
  };

  const moveTriggerBefore = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = triggers.findIndex((trigger) => trigger.id === sourceId);
    const targetIndex = triggers.findIndex((trigger) => trigger.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextTriggers = [...triggers];
    const [item] = nextTriggers.splice(sourceIndex, 1);
    nextTriggers.splice(targetIndex, 0, item);
    setTriggers(nextTriggers);
  };

  const patchSelectedConditions = (updater) => {
    if (!selectedTrigger) return;
    const current = selectedTrigger.conditions || [];
    const nextConditions = typeof updater === 'function' ? updater(current) : updater;
    patchTrigger(selectedTrigger.id, { conditions: nextConditions });
  };

  const setVariables = (nextVariables) => {
    controller.onVariablesChange?.(nextVariables.map((variable, index) => normalizeVariable(variable, index)));
  };

  const addVariable = () => {
    const nextVariable = normalizeVariable(createVariableItem(variables.length), variables.length);
    setVariables([...variables, nextVariable]);
  };

  const quickActions = [
    {
      label: 'Seçili nesne: sonraki slide',
      disabled: !controller.selectedObject,
      onClick: () =>
        addTrigger({
          action: 'SliderGec',
          target: selectedPrimaryObjectId || controller.selectedObject?.id,
          value: '__next__',
          name: `${safeObjectName(controller.selectedObject)} sonraki slide`,
        }),
    },
    {
      label: 'Seçili nesne: cevap katmanı',
      disabled: !controller.selectedObject || !(controller.layers || []).length,
      onClick: () =>
        addTrigger({
          action: 'KatmanaGec',
          target: selectedPrimaryObjectId || controller.selectedObject?.id,
          value:
            (controller.layers || []).find((layer) =>
              String(layer.name || layer.id || '').toLowerCase().includes('cevap')
            )?.id ||
            (controller.layers || [])[0]?.id ||
            'base',
          name: `${safeObjectName(controller.selectedObject)} cevap katmanı`,
        }),
    },
    {
      label: 'Sahne açılınca değişken ata',
      disabled: !variables.length,
      onClick: () =>
        addTrigger({
          action: 'DegiskenAta',
          target: '__activity__',
          when: 'onLoad',
          value: variables[0]?.id || '',
          extra: variables[0]?.type === 'number' ? '1' : 'true',
          name: 'Sahne açılınca değişken ata',
        }),
    },
    {
      label: 'Medya bitince sonraki slide',
      disabled: !(controller.objects || []).some((object) => object.type === 'audio' || object.type === 'video'),
      onClick: () =>
        addTrigger({
          action: 'SliderGec',
          target:
            (controller.objects || []).find((object) => object.type === 'audio' || object.type === 'video')?.id ||
            'Secili Nesne',
          when: 'onMediaEnd',
          value: '__next__',
          name: 'Medya bitince sonraki slide',
        }),
    },
  ];

  // Portal ile document.body'ye render edilir — böylece sağ-panel ağacının
  // stacking context'inde kalıp StageCanvas overlay'inin (zIndex ~99999000)
  // ALTINDA gizlenmez. Çok yüksek zIndex ile her zaman üstte ve tıklanabilir.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        background: 'rgba(15,23,42,.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
    >
      <div
        style={{
          width: 'min(980px, 96vw)',
          height: 'min(720px, 90vh)',
          border: `1px solid ${inspectorChrome.border}`,
          borderRadius: 10,
          background: '#ffffff',
          boxShadow: '0 22px 58px rgba(15,23,42,.22)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: '46px 1fr',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 14px',
            borderBottom: `1px solid ${inspectorChrome.border}`,
            background: '#f8fbff',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: inspectorChrome.blueDark, fontSize: 12, fontWeight: 950 }}>
              ETKİLEŞİM OLUŞTURUCU
            </div>
            <div style={{ color: inspectorChrome.muted, fontSize: 10.5, fontWeight: 700 }}>
              Trigger, değişken ve koşulları tek akışta düzenle.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `1px solid ${inspectorChrome.border}`,
              background: '#ffffff',
              color: inspectorChrome.text,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            X
          </button>
        </div>

        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)' }}>
          <div
            style={{
              minHeight: 0,
              borderRight: `1px solid ${inspectorChrome.border}`,
              background: '#fbfdff',
              padding: 10,
              overflowY: 'auto',
            }}
          >
            <PanelTabs tabs={dialogTabs} active={activeTab} onChange={setActiveTab} />
            <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
              <ButtonGrid
                columns={2}
                actions={[
                  { label: 'Yeni Trigger', onClick: () => addTrigger() },
                  {
                    label: 'Değişken Ekle',
                    onClick: () => {
                      addVariable();
                      setActiveTab('variables');
                    },
                  },
                ]}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <StatusPill tone="#16a34a">{triggers.length} trigger</StatusPill>
                <StatusPill tone="#7c3aed">{variables.length} değişken</StatusPill>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
              <TextInput
                value={searchQuery}
                placeholder="Trigger ara..."
                onChange={setSearchQuery}
              />
              <NativeSelect
                value={categoryFilter}
                options={triggerCategoryOptions}
                onChange={setCategoryFilter}
              />
              {filteredTriggers.slice(0, 80).map((trigger, index) => {
                const selected = selectedTrigger?.id === trigger.id;
                const warnings = validateTrigger(trigger, controller, variables);
                return (
                  <button
                    key={trigger.id}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedTriggerId(trigger.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveTriggerBefore(draggedTriggerId, trigger.id);
                      setDraggedTriggerId('');
                    }}
                    onDragEnd={() => setDraggedTriggerId('')}
                    onClick={() => {
                      setSelectedTriggerId(trigger.id);
                      if (activeTab === 'variables') setActiveTab('triggers');
                    }}
                    style={{
                      ...compactButtonStyle(selected, warnings.length ? inspectorChrome.warning : inspectorChrome.blue),
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 6,
                      alignItems: 'center',
                    }}
                    title={triggerDisplayTitle(trigger, context)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {index + 1}. {triggerDisplayTitle(trigger, context)}
                    </span>
                    {warnings.length ? <StatusPill tone={inspectorChrome.warning}>{warnings.length}</StatusPill> : null}
                  </button>
                );
              })}
              {!filteredTriggers.length ? <EmptyHint>Bu filtrede trigger yok.</EmptyHint> : null}
            </div>
          </div>

          <div style={{ minHeight: 0, overflowY: 'auto', padding: 12 }}>
            {activeTab === 'triggers' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {selectedTrigger ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                      <FieldLabel>
                        Trigger adı
                        <TextInput
                          value={selectedTrigger.name || ''}
                          onChange={(value) => patchTrigger(selectedTrigger.id, { name: value })}
                        />
                      </FieldLabel>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'end' }}>
                        <ActionButton onClick={() => moveTrigger(selectedTrigger.id, -1)}>Yukarı</ActionButton>
                        <ActionButton onClick={() => moveTrigger(selectedTrigger.id, 1)}>Aşağı</ActionButton>
                        <ActionButton onClick={() => duplicateTrigger(selectedTrigger)}>Kopyala</ActionButton>
                        <ActionButton tone="#dc2626" onClick={() => removeTrigger(selectedTrigger.id)}>
                          Sil
                        </ActionButton>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
                      <FieldLabel>
                        Ne zaman
                        <NativeSelect
                          value={selectedTrigger.when || 'onClick'}
                          options={TRIGGER_WHEN_OPTIONS}
                          onChange={(value) => patchTrigger(selectedTrigger.id, { when: value })}
                        />
                      </FieldLabel>
                      <FieldLabel>
                        Kaynak
                        <NativeSelect
                          value={selectedTrigger.target || 'Secili Nesne'}
                          options={sourceOptions}
                          onChange={(value) => patchTrigger(selectedTrigger.id, { target: value })}
                        />
                      </FieldLabel>
                      <FieldLabel>
                        Aksiyon
                        <NativeSelect
                          value={selectedTrigger.action || 'SayfaGec'}
                          options={actionOptions}
                          onChange={(value) =>
                            patchTrigger(selectedTrigger.id, {
                              action: value,
                              value: defaultTriggerValue(value, controller, variables),
                              extra:
                                value === 'DegiskenArttir' || value === 'DegiskenAzalt'
                                  ? '1'
                                  : selectedTrigger.extra || '',
                            })
                          }
                        />
                      </FieldLabel>
                      {selectedValueOptions.length ? (
                        <FieldLabel>
                          Hedef / değer
                          <NativeSelect
                            value={selectedTrigger.value || ''}
                            options={selectedValueOptions}
                            onChange={(value) => patchTrigger(selectedTrigger.id, { value })}
                          />
                        </FieldLabel>
                      ) : (
                        <FieldLabel>
                          Hedef / değer
                          <TextInput
                            value={selectedTrigger.value || ''}
                            placeholder={selectedTrigger.action === 'URLAc' ? 'https://' : 'Değer'}
                            onChange={(value) => patchTrigger(selectedTrigger.id, { value })}
                          />
                        </FieldLabel>
                      )}
                    </div>
                    {(selectedTrigger.action === 'DegiskenAta' ||
                      selectedTrigger.action === 'DegiskenArttir' ||
                      selectedTrigger.action === 'DegiskenAzalt') && (
                      <FieldLabel>
                        Değer / artış
                        <TextInput
                          value={selectedTrigger.extra || ''}
                          placeholder={selectedTrigger.action === 'DegiskenAta' ? 'Yeni değer' : '1'}
                          onChange={(value) => patchTrigger(selectedTrigger.id, { extra: value })}
                        />
                      </FieldLabel>
                    )}
                    {selectedTrigger.action === 'NesneDurumuAyarla' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <FieldLabel>
                          Durum
                          <NativeSelect
                            value={selectedTrigger.stateKey || 'visited'}
                            options={OBJECT_STATE_OPTIONS}
                            onChange={(value) => patchTrigger(selectedTrigger.id, { stateKey: value })}
                          />
                        </FieldLabel>
                        <ToggleRow
                          label="Durum değeri"
                          checked={String(selectedTrigger.stateValue ?? 'true') === 'true'}
                          onChange={(checked) => patchTrigger(selectedTrigger.id, { stateValue: String(checked) })}
                        />
                      </div>
                    )}
                    <InspectorRow
                      label="Okunur özet"
                      value={`${getFriendlyTriggerSourceLabel(selectedTrigger, context)} -> ${optionLabel(actionOptions, selectedTrigger.action, selectedTrigger.action)} -> ${getFriendlyTriggerValueLabel(selectedTrigger, context)}`}
                    />
                    {validateTrigger(selectedTrigger, controller, variables).length ? (
                      <div style={{ display: 'grid', gap: 5 }}>
                        {validateTrigger(selectedTrigger, controller, variables).map((warning) => (
                          <InspectorRow
                            key={warning}
                            label="Uyarı"
                            value={warning}
                            tone={inspectorChrome.warning}
                          />
                        ))}
                      </div>
                    ) : null}
                    {(selectedTrigger.conditions || []).length ? (
                      <div style={{ display: 'grid', gap: 5 }}>
                        {(selectedTrigger.conditions || []).map((condition, index) => (
                          <InspectorRow
                            key={condition.id || index}
                            label={`Koşul ${index + 1}`}
                            value={`${condition.sourceType === 'objectState' ? 'Nesne durumu' : 'Değişken'} ${condition.operator || 'eq'} ${condition.value || ''}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyHint>Trigger seç veya yeni trigger oluştur.</EmptyHint>
                )}
              </div>
            )}

            {activeTab === 'variables' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {variables.map((variable, index) => (
                  <div
                    key={variable.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.1fr) 110px minmax(0,1fr) 64px auto',
                      gap: 6,
                      alignItems: 'center',
                      borderBottom: `1px solid ${inspectorChrome.borderSoft}`,
                      padding: '5px 0',
                    }}
                  >
                    <TextInput
                      value={variable.name || ''}
                      onChange={(value) =>
                        setVariables(
                          variables.map((item) =>
                            item.id === variable.id ? { ...item, name: value } : item
                          )
                        )
                      }
                    />
                    <NativeSelect
                      value={variable.type || 'text'}
                      options={VARIABLE_TYPES}
                      onChange={(value) =>
                        setVariables(
                          variables.map((item) =>
                            item.id === variable.id
                              ? {
                                  ...item,
                                  type: value,
                                  value: castVariableValue(
                                    value,
                                    item.value ?? getDefaultVariableValue(value)
                                  ),
                                }
                              : item
                          )
                        )
                      }
                    />
                    {variable.type === 'boolean' ? (
                      <NativeSelect
                        value={String(!!variable.value)}
                        options={[
                          { value: 'false', label: 'False' },
                          { value: 'true', label: 'True' },
                        ]}
                        onChange={(value) =>
                          setVariables(
                            variables.map((item) =>
                              item.id === variable.id ? { ...item, value: value === 'true' } : item
                            )
                          )
                        }
                      />
                    ) : variable.type === 'number' ? (
                      <NumberInput
                        value={variable.value}
                        onChange={(value) =>
                          setVariables(
                            variables.map((item) =>
                              item.id === variable.id ? { ...item, value } : item
                            )
                          )
                        }
                      />
                    ) : (
                      <TextInput
                        value={variable.value || ''}
                        onChange={(value) =>
                          setVariables(
                            variables.map((item) =>
                              item.id === variable.id ? { ...item, value } : item
                            )
                          )
                        }
                      />
                    )}
                    <StatusPill tone="#7c3aed">{usageCount(controller.activities, variable.id)}</StatusPill>
                    <ActionButton
                      tone="#dc2626"
                      onClick={() => setVariables(variables.filter((item) => item.id !== variable.id))}
                    >
                      Sil
                    </ActionButton>
                  </div>
                ))}
                {!variables.length ? <EmptyHint>Proje değişkeni yok.</EmptyHint> : null}
                <ActionButton onClick={addVariable}>Yeni Değişken</ActionButton>
              </div>
            )}

            {activeTab === 'conditions' && (
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedTrigger ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                      <FieldLabel>
                        Koşul modu
                        <NativeSelect
                          value={selectedTrigger.conditionMode || 'all'}
                          options={[
                            { value: 'all', label: 'Tüm koşullar sağlanmalı' },
                            { value: 'any', label: 'Herhangi biri yeterli' },
                          ]}
                          onChange={(value) => patchTrigger(selectedTrigger.id, { conditionMode: value })}
                        />
                      </FieldLabel>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <ActionButton
                          onClick={() =>
                            patchSelectedConditions((conditions) => [
                              ...conditions,
                              createTriggerConditionItem(conditions.length),
                            ])
                          }
                        >
                          Koşul Ekle
                        </ActionButton>
                      </div>
                    </div>
                    {(selectedTrigger.conditions || []).map((condition) => {
                      const sourceOptionsForCondition =
                        condition.sourceType === 'objectState'
                          ? (controller.objects || []).map((object, index) => ({
                              value: object.id,
                              label: safeObjectName(object, index),
                            }))
                          : variables.map((variable, index) => ({
                              value: variable.id,
                              label: safeVariableName(variable, index),
                            }));
                      return (
                        <div
                          key={condition.id}
                          style={{
                            border: `1px solid ${inspectorChrome.border}`,
                            borderRadius: 8,
                            padding: 8,
                            display: 'grid',
                            gap: 7,
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                            <NativeSelect
                              value={condition.sourceType || 'variable'}
                              options={[
                                { value: 'variable', label: 'Değişken' },
                                { value: 'objectState', label: 'Nesne durumu' },
                              ]}
                              onChange={(value) =>
                                patchSelectedConditions((conditions) =>
                                  conditions.map((item) =>
                                    item.id === condition.id
                                      ? { ...item, sourceType: value, sourceId: '' }
                                      : item
                                  )
                                )
                              }
                            />
                            <ActionButton
                              tone="#dc2626"
                              onClick={() =>
                                patchSelectedConditions((conditions) =>
                                  conditions.filter((item) => item.id !== condition.id)
                                )
                              }
                            >
                              Sil
                            </ActionButton>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                            <FieldLabel>
                              Kaynak
                              <NativeSelect
                                value={condition.sourceId || ''}
                                options={sourceOptionsForCondition.length ? sourceOptionsForCondition : [{ value: '', label: 'Kaynak yok' }]}
                                onChange={(value) =>
                                  patchSelectedConditions((conditions) =>
                                    conditions.map((item) =>
                                      item.id === condition.id ? { ...item, sourceId: value } : item
                                    )
                                  )
                                }
                              />
                            </FieldLabel>
                            {condition.sourceType === 'objectState' ? (
                              <FieldLabel>
                                Durum
                                <NativeSelect
                                  value={condition.stateKey || 'visited'}
                                  options={OBJECT_STATE_OPTIONS}
                                  onChange={(value) =>
                                    patchSelectedConditions((conditions) =>
                                      conditions.map((item) =>
                                        item.id === condition.id ? { ...item, stateKey: value } : item
                                      )
                                    )
                                  }
                                />
                              </FieldLabel>
                            ) : (
                              <span />
                            )}
                            <FieldLabel>
                              Operatör
                              <NativeSelect
                                value={condition.operator || 'eq'}
                                options={getOperatorOptionsForCondition(condition, variables)}
                                onChange={(value) =>
                                  patchSelectedConditions((conditions) =>
                                    conditions.map((item) =>
                                      item.id === condition.id ? { ...item, operator: value } : item
                                    )
                                  )
                                }
                              />
                            </FieldLabel>
                            {!['truthy', 'falsy'].includes(condition.operator || 'eq') && (
                              <FieldLabel>
                                Karşılaştırma
                                <TextInput
                                  value={condition.value || ''}
                                  onChange={(value) =>
                                    patchSelectedConditions((conditions) =>
                                      conditions.map((item) =>
                                        item.id === condition.id ? { ...item, value } : item
                                      )
                                    )
                                  }
                                />
                              </FieldLabel>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!(selectedTrigger.conditions || []).length ? (
                      <EmptyHint>Koşul yok; trigger her zaman çalışır.</EmptyHint>
                    ) : null}
                  </>
                ) : (
                  <EmptyHint>Koşul düzenlemek için trigger seç.</EmptyHint>
                )}
              </div>
            )}

            {activeTab === 'quick' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <ButtonGrid actions={quickActions} />
                <ButtonGrid
                  actions={[
                    { label: 'Cevap Merkezi', onClick: controller.onOpenAnswerCenter },
                    { label: 'Hazır Kontrol Et', onClick: () => controller.commands?.insertReadyButton?.('check') },
                    { label: 'Hazır Menü', onClick: () => controller.commands?.insertReadyButton?.('menu') },
                    { label: 'Hotspot Ekle', onClick: () => controller.commands?.insertObject?.('hotspot') },
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
