import { useEffect, useMemo, useRef, useState } from 'react';

import { DRAG_DROP_MODES } from '../../../constants';
import { getCanvasObjects, getActivityLayers } from '../../../logic/activityHelpers';
import {
  areDragDropScopesCompatible,
  getDragDropPairKey,
  getDragDropPairsFromMatches,
  getDragDropSettings,
  normalizeDragDropMatchValue,
} from '../../../logic/dragDrop';
import { getAnswerPlacementFrames, safeClone } from '../../../logic/editorHelpers';
import { createLayer, normalizeLayerNameKey } from '../../../logic/factories';
import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import { getAnswerSummary } from '../cevapSelectors';
import {
  CevapCard,
  Field,
  MiniTable,
  ReadOnlyValue,
  SelectInput,
  SmallButton,
  TextInput,
  ToggleRow,
  fieldInputStyle,
} from '../components/CevapControls';

import {
  CanCard,
  DenemeVeKisitlarCard,
  DogrulamaKurallariCard,
  ErisilebilirlikCard,
  EtkinlikTuruCard,
  GeriBildirimCard,
  IpucuCard,
  PuanlamaCard,
  YanitKontrolCard,
} from './OrtakCevapKartlari';

const compactInputStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) minmax(90px,.55fr) minmax(80px,.45fr)',
  gap: 6,
  alignItems: 'center',
};

function getObjectLabel(object, fallback) {
  return object.label || object.name || fallback || object.id;
}

function isTechnicalObjectLabel(value = '') {
  return /^m[a-z0-9]{8,}$/i.test(String(value || '').trim());
}

function getDisplayLabel(object, fallback) {
  const label = getObjectLabel(object, fallback);
  return isTechnicalObjectLabel(label) ? fallback : label;
}

function normalizeChoiceKey(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function getChoiceToken(object, fallback) {
  const label = getObjectLabel(object, fallback);
  return String(isTechnicalObjectLabel(label) ? object?.group || label : label || object?.group || '').trim();
}

function getUniqueObjectChoices(objects, fallbackPrefix) {
  const byKey = new Map();
  objects.forEach((object, index) => {
    const label = getObjectLabel(object, `${fallbackPrefix} ${index + 1}`);
    const token = getChoiceToken(object, label);
    const key = normalizeChoiceKey(label || token || object.id);
    if (!key) return;
    const current = byKey.get(key);
    if (current) {
      current.ids.push(object.id);
      current.count += 1;
      return;
    }
    byKey.set(key, {
      id: object.id,
      key,
      ids: [object.id],
      count: 1,
      label,
      token: token || label,
      object,
    });
  });
  return [...byKey.values()];
}

function assignDropInMatches(matches = {}, dropId = '', dragId = '') {
  const nextMatches = {};
  Object.entries(matches).forEach(([currentDragId, value]) => {
    const values = normalizeDragDropMatchValue(value).filter((id) => id !== dropId);
    if (!values.length || currentDragId === dragId) return;
    nextMatches[currentDragId] = values.length === 1 ? values[0] : values;
  });
  if (dragId) nextMatches[dragId] = dropId;
  return nextMatches;
}

function assignChoiceDropInMatches(matches = {}, dropId = '', dragIds = []) {
  const ids = [...new Set((dragIds || []).filter(Boolean))];
  const nextMatches = {};
  Object.entries(matches).forEach(([currentDragId, value]) => {
    if (ids.includes(currentDragId)) return;
    const values = normalizeDragDropMatchValue(value).filter((id) => id !== dropId);
    if (!values.length) return;
    nextMatches[currentDragId] = values.length === 1 ? values[0] : values;
  });
  ids.forEach((dragId) => {
    nextMatches[dragId] = dropId;
  });
  return nextMatches;
}

function isAnswerLayer(layer = {}) {
  const key = normalizeLayerNameKey(layer.name || layer.id || '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, '');
  return ['cevap', 'answer', 'cevaplayer', 'cevapkatmani', 'answerlayer'].includes(key);
}

export default function SurukleBirakCevapPanel({ activity, onUpdate }) {
  const summary = getAnswerSummary(activity);
  const settings = getDragDropSettings(activity);
  const mode = activity.dragDropMode || 'single';
  const isGroupMode = mode === 'group' || mode === 'multi-group';
  const [showAdvanced, setShowAdvanced] = useState(false);
  const draggableChoices = getUniqueObjectChoices(summary.draggables, 'Surukle');
  const activeChoiceMap = useMemo(() => {
    const entries = {};
    summary.dropzones.forEach((drop) => {
      const assignedDrag = summary.draggables.find((drag) =>
        normalizeDragDropMatchValue(summary.matches[drag.id]).includes(drop.id)
      );
      const choice = draggableChoices.find((item) => item.ids.includes(assignedDrag?.id));
      if (choice) entries[drop.id] = choice;
    });
    return entries;
  }, [draggableChoices, summary.draggables, summary.dropzones, summary.matches]);
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchSettings = (p) => patch({ dragDropSettings: { ...settings, ...p } });
  const patchObject = (id, p) =>
    patch({
      objects: (activity.objects || []).map((object) =>
        object.id === id ? { ...object, ...p } : object
      ),
    });
  const setMode = (nextMode) => patch({ dragDropMode: nextMode, dragDropMatches: {} });
  const matchCount = Object.keys(summary.matches || {}).length;
  useEffect(() => {
    if (matchCount === 0) return;
    generateLayerRef.current();
  }, [matchCount]);
  const getResolvedExplicitMatches = () => {
    let nextMatches = {};
    const usedIds = new Set();
    summary.dropzones.forEach((drop) => {
      const choice = activeChoiceMap[drop.id];
      if (!choice) return;
      const compatibleIds = choice.ids.filter((id) => {
        const drag = summary.draggables.find((item) => item.id === id);
        return drag && areDragDropScopesCompatible(activity, drag, drop);
      });
      if (isGroupMode) {
        const dragIds = compatibleIds.length ? compatibleIds : choice.ids;
        nextMatches = assignChoiceDropInMatches(nextMatches, drop.id, dragIds);
        dragIds.forEach((id) => usedIds.add(id));
        return;
      }
      const existingId = compatibleIds.find((id) =>
        normalizeDragDropMatchValue(summary.matches[id]).includes(drop.id)
      );
      const dragId =
        existingId || compatibleIds.find((id) => !usedIds.has(id)) || compatibleIds[0] || choice.id;
      if (!dragId) return;
      usedIds.add(dragId);
      nextMatches = assignDropInMatches(nextMatches, drop.id, dragId);
    });
    return nextMatches;
  };
  const clearMatches = () => patch({ dragDropMatches: {} });
  const generateAnswerLayerObjects = () => {
    const layers = getActivityLayers(activity);
    const existingAnswerLayer = layers.find(isAnswerLayer);
    const answerLayer = existingAnswerLayer || createLayer('cevap', layers.length, { autoName: false });
    const resolvedMatches = getResolvedExplicitMatches();
    const pairs = getDragDropPairsFromMatches(resolvedMatches);
    if (!pairs.length) {
      console.warn('SurukleBirakCevapPanel: Eşleşme olmadığı için cevap layerı oluşturulamadı.');
      return;
    }

    const canvasObjects = getCanvasObjects(activity, 'base');
    const dragById = Object.fromEntries(
      canvasObjects.filter((item) => item.type === 'draggable').map((item) => [item.id, item])
    );
    const dropById = Object.fromEntries(
      canvasObjects.filter((item) => item.type === 'dropzone').map((item) => [item.id, item])
    );
    const activityWithExplicitMatches = { ...activity, dragDropMatches: resolvedMatches };
    const frames = getAnswerPlacementFrames(activityWithExplicitMatches);
    const answerLayerId = answerLayer.id;
    const remainingObjects = (activity.objects || []).filter(
      (item) =>
        !(
          (item.layerId || 'base') === answerLayerId &&
          (item.generatedBy === 'answer-key' || item.generatedBy === 'answer-placement')
        )
    );
    const maxZIndex = remainingObjects.reduce(
      (max, item) => Math.max(max, Number(item.zIndex) || 0),
      0
    );
    const generatedObjects = pairs
      .map((pair, index) => {
        const drag = dragById[pair.dragId];
        const drop = dropById[pair.dropId];
        const frame = frames[getDragDropPairKey(pair.dragId, pair.dropId)];
        if (!drag || !drop) return null;
        return {
          ...safeClone(drag, {}),
          id: uid(),
          layerId: answerLayerId,
          generatedBy: 'answer-placement',
          answerStatic: true,
          disableDrag: false,
          groupId: '',
          sourceDragId: pair.dragId,
          targetDropId: pair.dropId,
          answerPairKey: getDragDropPairKey(pair.dragId, pair.dropId),
          x: frame?.x ?? drop.x ?? drag.x,
          y: frame?.y ?? drop.y ?? drag.y,
          width: frame?.width ?? drag.width,
          height: frame?.height ?? drag.height,
          locked: false,
          zIndex: maxZIndex + index + 1,
        };
      })
      .filter(Boolean);

    // Aktif katmana DOKUNMA: eşleştirme seçimi her değiştiğinde bu üretim
    // otomatik tetikleniyor; eskiden activeLayerId'yi cevap katmanına zorlayınca
    // sahneye aniden koyu yerleşim kopyaları + katman karartması geliyordu
    // ("siyah alan" şikâyeti). Cevap katmanı katman listesinden açılabilir.
    patch({
      layers: existingAnswerLayer ? layers : [...layers, answerLayer],
      dragDropMatches: resolvedMatches,
      objects: [...remainingObjects, ...generatedObjects],
    });
  };

  const generateLayerRef = useRef(generateAnswerLayerObjects);
  generateLayerRef.current = generateAnswerLayerObjects;



  const matchRows = summary.dropzones.map((drop, index) => {
    const assignedDrags = summary.draggables.filter((drag) =>
      normalizeDragDropMatchValue(summary.matches[drag.id]).includes(drop.id)
    );
    const labels = assignedDrags.map((drag) => getObjectLabel(drag, drag.id)).join(', ');
    return {
      id: drop.id,
      cells: [index + 1, getDisplayLabel(drop, `Hedef ${index + 1}`), labels || '-', labels ? '✓' : '×'],
    };
  });

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,.95fr) minmax(0,.9fr) minmax(0,1fr)',
          gap: 8,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <EtkinlikTuruCard
            activity={activity}
            onUpdate={onUpdate}
            description="Ogeleri hedef alanlara surukleyip birakma etkinligi."
          />
          <CevapCard number="4" title="Surukle-Birak Modu">
            <div style={{ display: 'grid', gap: 6 }}>
              {DRAG_DROP_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  style={{
                    minHeight: 34,
                    borderRadius: 7,
                    border: `1px solid ${mode === item.id ? '#1d4ed8' : '#dbe7f5'}`,
                    background: mode === item.id ? '#eff6ff' : '#ffffff',
                    color: '#0f172a',
                    textAlign: 'left',
                    padding: '5px 8px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#1d4ed8' }}>
                    {item.label}
                  </span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 9, color: '#64748b' }}>
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </CevapCard>
        </div>
      <CevapCard number="2" title="Cevap Yapisi" order={2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
          <ReadOnlyValue label="Sürüklenebilir öğeler" value={summary.draggables.length} />
          <ReadOnlyValue label="Bırakma alanları" value={summary.dropzones.length} />
          <ReadOnlyValue
            label="Doğru eşleşmeler"
            value={`${Object.keys(activeChoiceMap).length}/${summary.dropzones.length}`}
          />
        </div>
      </CevapCard>
      <CevapCard number="3" title="Bırakma Kuralları" order={3}>
        <div style={{ display: 'grid', gap: 7 }}>
          <ToggleRow
            label="Tek hedefe tek öğe"
            checked={!settings.allowMultipleItemsPerDrop}
            onChange={(checked) => patchSettings({ allowMultipleItemsPerDrop: !checked })}
          />
          <ToggleRow
            label="Çoklu kabul"
            checked={settings.allowMultipleItemsPerDrop}
            onChange={(checked) => patchSettings({ allowMultipleItemsPerDrop: checked })}
          />
          <ToggleRow
            label="Soru grubu izolasyonu"
            checked={settings.isolateScopes !== false}
            onChange={(checked) => patchSettings({ isolateScopes: checked })}
          />
          <ToggleRow
            label="Grup dışına izin ver"
            checked={!!settings.allowCrossScope}
            onChange={(checked) => patchSettings({ allowCrossScope: checked })}
          />
          <ToggleRow
            label="Aynı öğe çoklu hedefe gitsin"
            checked={!!settings.allowMultipleTargetsPerDrag}
            onChange={(checked) => patchSettings({ allowMultipleTargetsPerDrag: checked })}
          />
          <ToggleRow
            label="Yanlış bırakmayı geri al"
            checked={settings.returnWrongDrop !== false}
            onChange={(checked) => patchSettings({ returnWrongDrop: checked })}
          />
          <Field label="Serbest bırakma davranışı">
            <SelectInput
              value={settings.answerPlacementLayout || 'stack'}
              onChange={(value) => patchSettings({ answerPlacementLayout: value })}
              options={[
                { value: 'stack', label: 'En yakına yapıştır' },
                { value: 'row', label: 'Satır' },
                { value: 'grid', label: 'Izgara' },
              ]}
            />
          </Field>
        </div>
      </CevapCard>
      </div>
      <CevapCard number="6" title={isGroupMode ? 'Cevap Formu - Grup Eşleşmeleri' : 'Cevap Formu - Doğru Eşleşmeler'} wide order={5}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
              {isGroupMode
                ? 'Her hedefe atanacak grubu seçin'
                : 'Her hedefe doğru sürüklenebilir öğeyi seçin'}
            </span>
            <SmallButton onClick={clearMatches}>Temizle</SmallButton>
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 190, overflow: 'auto', paddingRight: 2 }}>
            {summary.dropzones.map((drop, index) => {
              const currentDragId = Object.entries(summary.matches || {}).find(
                ([, targetId]) => targetId === drop.id
              )?.[0];
              const currentDrag = summary.draggables.find((d) => d.id === currentDragId);
              const currentValue = currentDrag?.id || '';
              const compatibleChoices = summary.draggables.filter((drag) =>
                areDragDropScopesCompatible(activity, drag, drop)
              );
              return (
                <div
                  key={drop.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)',
                    gap: 8,
                    alignItems: 'center',
                    padding: '7px 9px',
                    borderRadius: 7,
                    border: `1px solid ${currentDrag ? '#bbf7d0' : '#e2e8f0'}`,
                    background: currentDrag ? '#f0fdf4' : '#ffffff',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#0f172a', overflowWrap: 'anywhere' }}>
                      {index + 1}. {getDisplayLabel(drop, `Hedef ${index + 1}`)}
                    </div>
                    {drop.scope && (
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 700 }}>
                        Kapsam: {drop.scope}
                      </div>
                    )}
                  </div>
                  <select
                    value={currentValue}
                    onChange={(e) => {
                      const dragId = e.target.value;
                      patch({ dragDropMatches: assignDropInMatches(summary.matches, drop.id, dragId) });
                    }}
                    style={{
                      ...fieldInputStyle,
                      background: '#ffffff',
                      borderColor: currentDrag ? '#86efac' : '#cbd5e1',
                    }}
                  >
                    <option value="">— Seç —</option>
                    {compatibleChoices.map((drag) => (
                      <option key={drag.id} value={drag.id}>
                        {getObjectLabel(drag, drag.id)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {!summary.dropzones.length && (
              <div style={{ color: '#64748b', fontSize: 12 }}>0 bırakma alanı</div>
            )}
          </div>
        </div>
      </CevapCard>
      <CevapCard number="7" title="Eşleşme Haritası" order={6}>
        <div style={{ maxHeight: 156, overflow: 'auto' }}>
          <MiniTable
            columns={['#', 'Hedef Alan', 'Seçilen Öğe', 'Doğru']}
            rows={matchRows}
            emptyText="0 eşleşme"
          />
        </div>
      </CevapCard>
      <CevapCard number="8" title="Gelişmiş Ayarlar" wide order={7}>
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          style={{
            width: '100%',
            minHeight: 30,
            border: '1px solid #dbe7f5',
            borderRadius: 7,
            background: '#f8fafc',
            color: '#1d4ed8',
            fontSize: 11,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {showAdvanced ? 'Gelişmiş ayarları gizle' : 'Geri bildirim, puanlama ve erişilebilirlik ayarlarını aç'}
        </button>
      </CevapCard>
      {showAdvanced && (
        <>
          <CevapCard number="9" title="Öğe ve Alan Ayarları" wide order={8}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ color: '#334155', fontSize: 11, fontWeight: 900 }}>
                  Sürüklenebilir öğeler ({summary.draggables.length})
                </div>
                {summary.draggables.map((drag, index) => (
                  <div key={drag.id} style={compactInputStyle}>
                    <ReadOnlyValue value={getObjectLabel(drag, `Sürükle ${index + 1}`)} />
                    <TextInput
                      value={drag.scope || ''}
                      placeholder="Soru grubu"
                      onChange={(value) => patchObject(drag.id, { scope: value })}
                    />
                    <TextInput
                      value={drag.group || ''}
                      placeholder="Grup"
                      onChange={(value) => patchObject(drag.id, { group: value })}
                    />
                  </div>
                ))}
                {!summary.draggables.length && (
                  <div style={{ color: '#64748b', fontSize: 11 }}>0 sürüklenebilir öğe</div>
                )}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ color: '#334155', fontSize: 11, fontWeight: 900 }}>
                  Bırakma alanları ({summary.dropzones.length})
                </div>
                {summary.dropzones.map((drop, index) => (
                  <div
                    key={drop.id}
                    style={{
                      ...compactInputStyle,
                      gridTemplateColumns: 'minmax(0,1fr) minmax(90px,.55fr) minmax(80px,.45fr) 64px',
                    }}
                  >
                    <ReadOnlyValue value={getDisplayLabel(drop, `Birak ${index + 1}`)} />
                    <TextInput
                      value={drop.scope || ''}
                      placeholder="Soru grubu"
                      onChange={(value) => patchObject(drop.id, { scope: value })}
                    />
                    <TextInput
                      value={drop.group || ''}
                      placeholder="Grup"
                      onChange={(value) => patchObject(drop.id, { group: value })}
                    />
                    <TextInput
                      type="number"
                      min="0"
                      value={drop.capacity || 0}
                      onChange={(value) => patchObject(drop.id, { capacity: Math.max(0, Number(value) || 0) })}
                    />
                  </div>
                ))}
                {!summary.dropzones.length && (
                  <div style={{ color: '#64748b', fontSize: 11 }}>0 birakma alani</div>
                )}
              </div>
              <Field label={`Yapisma toleransi: ${settings.snapTolerance || 20}px`}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.snapTolerance || 20}
                  onChange={(e) => patchSettings({ snapTolerance: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#16a34a' }}
                />
              </Field>
            </div>
          </CevapCard>
          <DogrulamaKurallariCard number="10" activity={activity} onUpdate={onUpdate} />
          <GeriBildirimCard number="11" activity={activity} onUpdate={onUpdate} />
          <PuanlamaCard number="12" activity={activity} onUpdate={onUpdate} />
          <YanitKontrolCard number="13" activity={activity} onUpdate={onUpdate} />
          <IpucuCard number="14" activity={activity} onUpdate={onUpdate} />
          <DenemeVeKisitlarCard number="15" activity={activity} onUpdate={onUpdate} />
          <CanCard number="16" activity={activity} onUpdate={onUpdate} />
          <ErisilebilirlikCard number="17" activity={activity} onUpdate={onUpdate} />
        </>
      )}
    </div>
  );
}
