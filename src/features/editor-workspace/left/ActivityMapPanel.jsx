import { useMemo, useState } from 'react';

import { getActivitySlides, selectActivitySlide } from '../../../logic/activityHelpers';
import { buildResolvedLayerNameMap, createLayer, createSlide } from '../../../logic/factories';
import { normalizeSlide } from '../../../logic/slideNormalization';
import { clamp, uid } from '../../../utils/editorHelpers';

import {
  InlineRename,
  MiniIcon,
  mapChrome,
} from './ActivityMapPrimitives';
import ActivityStructureTree, { getSlideDisplayName } from './ActivityStructureTree';

const railItems = [
  { id: 'map', label: 'Harita', icon: 'menu' },
  { id: 'add', label: 'Yeni sahne', icon: 'add' },
];

const layerAliases = {
  base: 'Ana',
  correct: 'Doğru',
  incorrect: 'Yanlış',
  cevap: 'Cevap',
  menu: 'Menü',
  normal: 'Normal',
  explanation: 'Açıklama',
};

function RailButton({ active, item, onClick }) {
  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        border: `1px solid ${active ? '#bfdbfe' : '#d8e2ef'}`,
        background: active ? '#eaf2ff' : '#ffffff',
        color: active ? mapChrome.blue : mapChrome.muted,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <MiniIcon icon={item.icon} size={15} />
    </button>
  );
}

function normalizeLayers(activity = {}) {
  const layers =
    Array.isArray(activity.layers) && activity.layers.length
      ? activity.layers
      : [createLayer('', 0, { kind: 'base' })];
  return layers.map((layer, index) => ({
    ...layer,
    id: index === 0 || layer.kind === 'base' ? 'base' : layer.id || uid(),
    kind: index === 0 || layer.kind === 'base' ? 'base' : 'overlay',
    visible: layer.visible !== false,
  }));
}

function normalizeLayerName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getLayerDisplayName(layer, resolvedNames = {}) {
  const layerId = layer?.id || 'base';
  const rawName = String(layer?.name || '').trim();
  const resolvedName = String(resolvedNames[layerId] || rawName || '').trim();
  if (layerId === 'base' || layer?.kind === 'base') return layerAliases.base;
  const key = normalizeLayerName(resolvedName);
  return layerAliases[key] || resolvedName || 'Katman';
}

function LayerAction({ active = false, disabled = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      style={{
        width: 18,
        height: 18,
        minWidth: 18,
        border: 'none',
        borderRadius: 5,
        background: active ? '#eaf2ff' : 'transparent',
        color: disabled ? '#cbd5e1' : active ? mapChrome.blue : '#64748b',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      {icon ? <MiniIcon icon={icon} size={12} /> : null}
    </button>
  );
}

function DeleteLayerButton({ disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Katmanı sil"
      title="Katmanı sil"
      onClick={disabled ? undefined : onClick}
      style={{
        width: 18,
        height: 18,
        minWidth: 18,
        border: 'none',
        borderRadius: 5,
        background: 'transparent',
        color: disabled ? '#cbd5e1' : '#94a3b8',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      ×
    </button>
  );
}

export function LayerManager({ activity, onSelectionChange, onUpdateActivity }) {
  const [editingLayerId, setEditingLayerId] = useState('');
  const [editingLayerKey, setEditingLayerKey] = useState(0);
  const layers = normalizeLayers(activity || {});
  const objects = useMemo(
    () => (Array.isArray(activity?.objects) ? activity.objects : []),
    [activity?.objects]
  );
  const activeLayerId = activity?.activeLayerId || 'base';
  const resolvedNames = buildResolvedLayerNameMap(layers, activity || {});

  const patchActivity = (patch) => {
    if (!activity) return;
    onUpdateActivity?.({ ...activity, ...patch });
  };

  const patchLayer = (layerId, patch) => {
    patchActivity({
      layers: layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    });
  };

  const addLayer = () => {
    const nextLayer = createLayer('', layers.length, { autoName: true });
    patchActivity({
      layers: [...layers, nextLayer],
      activeLayerId: nextLayer.id,
      selectedObjectId: null,
    });
    onSelectionChange?.(new Set());
  };

  const deleteLayer = (layerId) => {
    if (layerId === 'base' || layers.length <= 1) return;
    const nextLayers = layers.filter((layer) => layer.id !== layerId);
    // Katman silinince içindeki nesneler de silinir (Storyline davranışı).
    // Eskiden base'e taşınıyordu; bu yüzden silinen katmanın dim (karartma)
    // şekli ve içeriği base'e düşüp sahnede kalıyor / sahneyi karartıyordu.
    const nextObjects = objects.filter((object) => (object.layerId || 'base') !== layerId);
    const deletedIds = new Set(
      objects.filter((o) => (o.layerId || 'base') === layerId).map((o) => o.id)
    );
    const nextTriggers = (activity.triggers || [])
      .filter((trigger) => !deletedIds.has(trigger.target) && !deletedIds.has(trigger.value))
      .map((trigger) =>
        trigger.action === 'KatmanaGec' && trigger.value === layerId
          ? { ...trigger, value: 'base' }
          : trigger
      );
    patchActivity({
      activeLayerId: activeLayerId === layerId ? 'base' : activeLayerId,
      layers: nextLayers,
      objects: nextObjects,
      selectedObjectId:
        objects.find((object) => object.id === activity.selectedObjectId)?.layerId === layerId
          ? null
          : activity.selectedObjectId,
      triggers: nextTriggers,
    });
    if (activeLayerId === layerId) onSelectionChange?.(new Set());
  };

  const selectLayer = (layerId) => {
    patchActivity({ activeLayerId: layerId, selectedObjectId: null });
    onSelectionChange?.(new Set());
  };

  return (
    <section
      style={{
        border: `1px solid ${mapChrome.border}`,
        borderRadius: 8,
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(15,23,42,.04)',
        padding: 7,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            minHeight: 20,
          }}
        >
          <span
            style={{
              color: mapChrome.muted,
              fontSize: 10,
              fontWeight: 950,
              letterSpacing: 0.25,
              textTransform: 'uppercase',
            }}
          >
            Katmanlar
          </span>
          <LayerAction icon="add" label="Yeni katman" onClick={addLayer} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            borderTop: `1px solid ${mapChrome.borderSoft}`,
            paddingTop: 4,
          }}
        >
          {layers.map((layer) => {
            const layerId = layer.id || 'base';
            const isBase = layerId === 'base' || layer.kind === 'base';
            const active = activeLayerId === layerId;
            const displayName = getLayerDisplayName(layer, resolvedNames);
            const objectCount = objects.filter(
              (object) => (object.layerId || 'base') === layerId
            ).length;
            return (
              <div
                key={layerId}
                onClick={() => selectLayer(layerId)}
                onDoubleClick={() => {
                  if (!isBase) {
                    setEditingLayerId(layerId);
                    setEditingLayerKey((value) => value + 1);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectLayer(layerId);
                  }
                  if (event.key === 'F2' && !isBase) {
                    event.preventDefault();
                    setEditingLayerId(layerId);
                    setEditingLayerKey((value) => value + 1);
                  }
                  if (event.key === 'Delete' || event.key === 'Backspace') {
                    // Katman listesine odaklıyken Delete bu katmanı siler (base ve
                    // son katman korunur); global canvas silme işleyicisine düşmesin.
                    event.preventDefault();
                    event.stopPropagation();
                    if (!isBase && layers.length > 1) deleteLayer(layerId);
                  }
                }}
                style={{
                  minHeight: 25,
                  display: 'grid',
                  gridTemplateColumns: '18px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 6,
                  background: active ? '#eaf2ff' : 'transparent',
                  border: `1px solid ${active ? '#bfdbfe' : 'transparent'}`,
                  color: active ? mapChrome.blueDark : mapChrome.text,
                  cursor: 'pointer',
                  padding: '2px 3px',
                }}
              >
                <LayerAction
                  active={layer.visible !== false}
                  icon={layer.visible === false ? 'eyeOff' : 'eye'}
                  label={layer.visible === false ? 'Göster' : 'Gizle'}
                  onClick={(event) => {
                    event.stopPropagation();
                    patchLayer(layerId, { visible: layer.visible === false });
                  }}
                />
                <InlineRename
                  active={active}
                  displayValue={displayName}
                  editKey={editingLayerId === layerId ? editingLayerKey : 0}
                  onCancel={() => setEditingLayerId('')}
                  onCommit={(value) => {
                    setEditingLayerId('');
                    if (isBase) return;
                    patchLayer(layerId, value ? { name: value, autoName: false } : { name: '', autoName: true });
                  }}
                  placeholder="Katman"
                  readOnly={isBase}
                />
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 2,
                    minWidth: 54,
                  }}
                >
                  <span
                    title={`${objectCount} nesne`}
                    style={{
                      minWidth: 20,
                      height: 17,
                      padding: '0 5px',
                      borderRadius: 999,
                      background: active ? '#dbeafe' : '#f1f5f9',
                      color: active ? mapChrome.blue : mapChrome.muted,
                      fontSize: 9,
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    {objectCount}
                  </span>
                  <LayerAction
                    active={!!layer.locked}
                    icon={layer.locked ? 'lock' : 'unlock'}
                    label={layer.locked ? 'Kilidi aç' : 'Kilitle'}
                    onClick={(event) => {
                      event.stopPropagation();
                      patchLayer(layerId, { locked: !layer.locked });
                    }}
                  />
                  {isBase ? (
                    <span
                      aria-hidden="true"
                      style={{ width: 18, height: 18, display: 'inline-block' }}
                    />
                  ) : (
                    <DeleteLayerButton
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteLayer(layerId);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
    </section>
  );
}

export default function ActivityMapPanel({
  activity,
  onCopySlide,
  onPasteSlide,
  onSelectionChange,
  onUpdateActivity,
}) {
  const [query, setQuery] = useState('');
  const slides = getActivitySlides(activity || {});
  const currentSlideId = activity?.currentSlideId || slides[0]?.id || '';
  const currentSlideIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === currentSlideId)
  );

  const selectSlide = (slideId) => {
    if (!activity || !slideId) return;
    onSelectionChange?.(new Set());
    onUpdateActivity?.(selectActivitySlide(activity, slideId));
  };

  const addSlide = () => {
    if (!activity) return;
    const nextName = `Sahne ${slides.length + 1}`;
    const nextSlide = normalizeSlide(
      { ...createSlide(nextName, slides.length), name: nextName, sceneName: nextName },
      slides.length
    );
    onSelectionChange?.(new Set());
    onUpdateActivity?.(
      selectActivitySlide(
        { ...activity, slides: [...slides, nextSlide], currentSlideId: nextSlide.id },
        nextSlide.id
      )
    );
  };

  const duplicateSlide = () => {
    if (!activity) return;
    const source = slides[currentSlideIndex] || slides[0];
    if (!source) return;
    const copyName = `${getSlideDisplayName(source, currentSlideIndex)} Kopya`;
    const copy = normalizeSlide(
      {
        ...source,
        id: uid(),
        name: copyName,
        sceneName: copyName,
      },
      slides.length
    );
    onSelectionChange?.(new Set());
    onUpdateActivity?.(
      selectActivitySlide(
        { ...activity, slides: [...slides, copy], currentSlideId: copy.id },
        copy.id
      )
    );
  };

  const deleteSlide = (slideId = currentSlideId) => {
    if (!activity || slides.length <= 1) return;
    const removeId = slideId || currentSlideId;
    const removedIndex = slides.findIndex((slide) => slide.id === removeId);
    if (removedIndex < 0) return;
    const nextSlides = slides
      .filter((slide) => slide.id !== removeId)
      .map((slide, index) => normalizeSlide(slide, index));
    // Silinen geçerli slayt değilse seçimi koru; geçerliyse komşusunu seç.
    const nextSelectedId =
      removeId === currentSlideId
        ? nextSlides[clamp(removedIndex, 0, nextSlides.length - 1)]?.id
        : currentSlideId;
    onSelectionChange?.(new Set());
    onUpdateActivity?.(selectActivitySlide({ ...activity, slides: nextSlides }, nextSelectedId));
  };

  const moveSlide = (direction) => {
    if (!activity) return;
    const nextIndex = clamp(currentSlideIndex + direction, 0, slides.length - 1);
    if (nextIndex === currentSlideIndex) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(currentSlideIndex, 1);
    nextSlides.splice(nextIndex, 0, moved);
    onUpdateActivity?.(
      selectActivitySlide(
        { ...activity, slides: nextSlides.map((slide, index) => normalizeSlide(slide, index)) },
        currentSlideId
      )
    );
  };

  const renameActivity = (nextName) => {
    const cleanName = String(nextName || '').trim();
    if (!activity || !cleanName) return;
    onUpdateActivity?.({ ...activity, name: cleanName });
  };

  const renameSlide = (slideId, nextName) => {
    const cleanName = String(nextName || '').trim();
    if (!activity || !slideId || !cleanName) return;
    const nextSlides = slides.map((slide, index) =>
      normalizeSlide(
        slide.id === slideId ? { ...slide, name: cleanName, sceneName: cleanName } : slide,
        index
      )
    );
    onUpdateActivity?.(
      selectActivitySlide({ ...activity, slides: nextSlides, currentSlideId: slideId }, slideId)
    );
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr)',
        background: '#f7f9fc',
        color: mapChrome.text,
      }}
    >
      <div
        style={{
          borderRight: `1px solid ${mapChrome.border}`,
          background: '#eef3f8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '10px 5px',
        }}
      >
        {railItems.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            active={item.id === 'map'}
            onClick={() => {
              if (item.id === 'add') addSlide();
            }}
          />
        ))}
      </div>

      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: mapChrome.panel,
        }}
      >
        <div
          style={{
            padding: '12px 12px 10px',
            borderBottom: `1px solid ${mapChrome.borderSoft}`,
            background: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                minWidth: 0,
                color: mapChrome.text,
                fontSize: 12.5,
                fontWeight: 950,
                letterSpacing: 0.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              ETKİNLİK HARİTASI
            </div>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara (sahne...)"
            style={{
              width: '100%',
              height: 31,
              border: `1px solid ${mapChrome.border}`,
              borderRadius: 7,
              background: '#ffffff',
              color: mapChrome.text,
              fontSize: 12,
              fontWeight: 650,
              padding: '0 10px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <ActivityStructureTree
            activity={activity}
            onAddSlide={addSlide}
            onCopySlide={onCopySlide}
            onDeleteSlide={deleteSlide}
            onDuplicateSlide={duplicateSlide}
            onMoveSlide={moveSlide}
            onPasteSlide={onPasteSlide}
            onRenameActivity={renameActivity}
            onRenameSlide={renameSlide}
            onSelectSlide={selectSlide}
            query={query}
          />

          <LayerManager
            activity={activity}
            onSelectionChange={onSelectionChange}
            onUpdateActivity={onUpdateActivity}
          />
        </div>
      </div>
    </div>
  );
}
