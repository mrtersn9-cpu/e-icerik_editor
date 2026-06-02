import { generateDiceBirdDemoTemplate } from '../activity-types/custom-interaction/customInteractionTemplates';
import { getActivitySlides } from '../logic/activityHelpers';
import { ensureStandardActivityScaffold } from '../logic/activityTemplateGenerators';
import { createActivity } from '../logic/factories';
import { normalizeSlide } from '../logic/slideNormalization';

describe('custom interaction templates', () => {
  test('dice bird demo writes widget objects into the selected practice slide', () => {
    const scaffold = ensureStandardActivityScaffold(
      createActivity('Widget Demo', 'custom-interaction'),
      { select: 'practice' }
    );

    const result = generateDiceBirdDemoTemplate(scaffold);
    const slides = getActivitySlides(result);
    const practice = slides.find((slide) => slide.id === result.currentSlideId);
    const objectIds = new Set((practice?.objects || []).map((object) => object.id));
    const triggerWhens = (practice?.triggers || []).map((trigger) => trigger.when);

    expect(result.currentSlideId).toBe(practice?.id);
    expect(objectIds.has('obj_widget_dice_1')).toBe(true);
    expect(objectIds.has('obj_widget_bird_1')).toBe(true);
    expect(practice?.objects.find((object) => object.id === 'obj_widget_dice_1')?.layerId).toBe(
      'base'
    );
    expect(practice?.objects.find((object) => object.id === 'obj_widget_bird_1')?.layerId).toBe(
      'base'
    );
    expect(practice?.layers.some((layer) => layer.id === 'layer_question')).toBe(true);
    expect(triggerWhens).toEqual(expect.arrayContaining(['onWidgetEvent']));
    expect(result.objects.some((object) => object.id === 'obj_widget_dice_1')).toBe(true);
  });

  test('normalization keeps widget event triggers and layer target', () => {
    const slide = normalizeSlide({
      layers: [
        { id: 'base', kind: 'base', name: '' },
        { id: 'layer_question', kind: 'overlay', name: 'Soru' },
      ],
      objects: [{ id: 'obj_widget_bird_1', type: 'custom-widget', layerId: 'base' }],
      triggers: [
        {
          id: 'trg_bird_to_layer',
          when: 'onWidgetEvent',
          target: 'obj_widget_bird_1',
          eventName: 'flightComplete',
          action: 'KatmanaGec',
          value: 'layer_question',
        },
      ],
    });

    expect(slide.triggers[0].when).toBe('onWidgetEvent');
    expect(slide.triggers[0].value).toBe('layer_question');
  });
});
