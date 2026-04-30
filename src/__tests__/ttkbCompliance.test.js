import {
  auditTtkbEditorState,
  enforceTtkbActivityCompliance,
  enforceTtkbEditorState,
} from '../utils/ttkbCompliance';

describe('TTKB editor compliance', () => {
  test('fixes dark button text in editor data instead of runtime', () => {
    const activity = enforceTtkbActivityCompliance({
      id: 'act-1',
      buttonPackageId: 'pkg-1',
      objects: [
        {
          id: 'mute',
          type: 'button',
          runtimeAction: 'toggle-mute',
          label: 'SESİ KAPAT',
          style: {
            background: 'linear-gradient(180deg,#111827,#020617)',
            color: '#000000',
          },
        },
      ],
    });

    expect(activity.objects[0].style.color).toBe('#ffffff');
    expect(activity.objects[0].buttonMotion).toBeTruthy();
  });

  test('normalizes semantic button icons and keeps SCORM 1.2', () => {
    const state = enforceTtkbEditorState({
      lmsConfig: { standard: 'scorm2004' },
      activities: [
        {
          id: 'act-1',
          buttonPackageId: 'pkg-1',
          objects: [
            {
              id: 'home',
              type: 'button',
              runtimeAction: 'home',
              label: 'ANA SAYFA',
              style: {
                background: '#2563eb',
                color: '#ffffff',
              },
            },
          ],
        },
      ],
    });

    expect(state.lmsConfig.standard).toBe('scorm12');
    expect(state.activities[0].objects[0].label).toBe('⌂ ANA SAYFA');
  });

  test('does not duplicate icons on paired scene-template label buttons', () => {
    const activity = enforceTtkbActivityCompliance({
      id: 'act-1',
      buttonPackageId: 'pkg-1',
      objects: [
        {
          id: 'menu-label',
          type: 'button',
          sceneTemplateSlotId: 'button-intro:main-menu-demo-label',
          label: '☰ MENÜ',
          style: { background: '#2563eb', color: '#ffffff' },
        },
        {
          id: 'mute-icon',
          type: 'button',
          sceneTemplateSlotId: 'button-intro:menu-demo-2-icon',
          sceneTemplateDemoAction: 'toggle-mute',
          label: '🔊',
          style: { background: '#64748b', color: '#ffffff' },
        },
      ],
    });

    expect(activity.objects[0].label).toBe('MENÜ');
    expect(activity.objects[1].soundIconMode).toBe('icon-only');
  });

  test('solidifies popup panels and passes contrast audit after enforcement', () => {
    const state = enforceTtkbEditorState({
      activities: [
        {
          id: 'act-1',
          stageWidth: 1920,
          stageHeight: 1080,
          objects: [
            {
              id: 'panel',
              type: 'shape',
              generatedBy: 'answer-template',
              shapeKind: 'roundedRect',
              layerId: 'menu',
              width: 400,
              height: 180,
              style: {
                background: 'linear-gradient(180deg,rgba(255,255,255,.28),rgba(248,250,252,.22))',
                opacity: 0.4,
              },
            },
          ],
        },
      ],
    });

    expect(state.activities[0].objects[0].style.background).toContain('rgba(255,255,255,.98)');
    expect(state.activities[0].objects[0].style.opacity).toBe(1);
    expect(auditTtkbEditorState(state).ok).toBe(true);
  });
});
