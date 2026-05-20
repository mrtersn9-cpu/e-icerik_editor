import { uid } from '../utils/editorHelpers';
import { isGeneratedAnswerTemplateObject } from '../utils/storylineRuntime';

import { getActivityDragDropDefaults } from './dragDrop';
import { createObject, upgradeDragDropStyle } from './factories';

function isGeneratedSceneTemplateObject(item = {}) {
  return item?.generatedBy === 'scene-template';
}


function createObjectFromActivity(activity = {}, type = 'text') {
  const object = createObject(type);
  if (type !== 'draggable' && type !== 'dropzone') return object;
  const family = getActivityDragDropDefaults(activity)[type];
  return {
    ...object,
    width: family.width,
    height: family.height,
    style: { ...family.style },
  };
}

function updateActivityObject(activity = {}, objectId = '', patch = {}, options = {}) {
  const objects = Array.isArray(activity?.objects) ? activity.objects : [];
  const target = objects.find((item) => item.id === objectId);
  if (!target) return activity;

  const shouldSyncFamily =
    !!options.syncDragDropFamily && (target.type === 'draggable' || target.type === 'dropzone');
  let nextActivity = activity;

  if (shouldSyncFamily) {
    const familyDefaults = getActivityDragDropDefaults(activity)[target.type];
    const familyPatch = {};

    if (Object.prototype.hasOwnProperty.call(patch, 'width')) {
      familyPatch.width = Math.max(20, Number(patch.width) || familyDefaults.width);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'height')) {
      familyPatch.height = Math.max(20, Number(patch.height) || familyDefaults.height);
    }
    if (patch.style) {
      familyPatch.style = upgradeDragDropStyle(target.type, {
        ...familyDefaults.style,
        ...patch.style,
      });
    }

    if (Object.keys(familyPatch).length) {
      const nextDefaults = {
        ...familyDefaults,
        ...familyPatch,
        style: familyPatch.style ? { ...familyPatch.style } : familyDefaults.style,
      };
      nextActivity = {
        ...activity,
        dragDropDefaults: {
          ...getActivityDragDropDefaults(activity),
          [target.type]: nextDefaults,
        },
        objects: objects.map((item) =>
          item.type === target.type
            ? {
                ...item,
                ...(Object.prototype.hasOwnProperty.call(familyPatch, 'width')
                  ? { width: nextDefaults.width }
                  : {}),
                ...(Object.prototype.hasOwnProperty.call(familyPatch, 'height')
                  ? { height: nextDefaults.height }
                  : {}),
                ...(familyPatch.style ? { style: { ...nextDefaults.style } } : {}),
              }
            : item
        ),
      };
    }
  }

  const objectPatch = { ...patch };
  if (shouldSyncFamily) {
    delete objectPatch.width;
    delete objectPatch.height;
    delete objectPatch.style;
  }

  if (!Object.keys(objectPatch).length) return nextActivity;

  return {
    ...nextActivity,
    objects: (nextActivity.objects || []).map((item) => {
      if (item.id !== objectId) return item;
      const nextItem = { ...item, ...objectPatch };
      if (!options.preserveGeneratedBy && isGeneratedAnswerTemplateObject(item)) {
        delete nextItem.generatedBy;
        nextItem.userEditedTemplate = true;
      }
      if (!options.preserveGeneratedBy && isGeneratedSceneTemplateObject(item)) {
        nextItem.userEditedSceneTemplate = true;
      }
      return nextItem;
    }),
  };
}

function createTriggerItem(index = 0) {
  return {
    id: uid(),
    when: 'onClick',
    target: 'Secili Nesne',
    action: 'SayfaGec',
    value: '__next__',
    extra: '',
    stateKey: 'visited',
    stateValue: 'true',
    name: `Tetik ${index + 1}`,
    conditionMode: 'all',
    conditions: [],
  };
}

function createTriggerConditionItem(index = 0) {
  return {
    id: uid(),
    sourceType: 'variable',
    sourceId: '',
    stateKey: 'visited',
    operator: 'eq',
    value: '',
    name: `Kosul ${index + 1}`,
  };
}

export {
  isGeneratedSceneTemplateObject,
  createObjectFromActivity,
  updateActivityObject,
  createTriggerItem,
  createTriggerConditionItem,
};
