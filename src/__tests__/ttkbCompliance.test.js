import fs from 'fs';
import path from 'path';

import {
  auditTtkbEditorState,
  enforceTtkbActivityCompliance,
  enforceTtkbEditorState,
  findTtkbMissingSemanticIconButtons,
} from '../utils/ttkbCompliance';

const MOJIBAKE_PATTERNS = [
  '\u00c4\u00b1',
  '\u00c4\u0178',
  '\u00c5\u0178',
  '\u00c3\u00bc',
  '\u00c3\u00b6',
  '\u00c3\u00a7',
  '\u00c3\u2021',
  '\u00c4\u00b0',
  '\u00e2\u0153',
  '\u00e2\u2020',
  '\u00e2\u02dc',
  '\u00e2\u0161',
  '\u00e2\u009d',
  '\u00e2\u2013',
  '\u00e2\u2014',
  '\u011f\u0178',
  '\u00c3\u2014',
];

function collectSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(js|jsx|mjs)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('TTKB editor compliance', () => {
  test('does not expose known mojibake sequences in source strings', () => {
    const sourceRoot = path.resolve(__dirname, '..');
    const offenders = [];

    collectSourceFiles(sourceRoot).forEach((file) => {
      const text = fs.readFileSync(file, 'utf8');
      MOJIBAKE_PATTERNS.forEach((pattern) => {
        if (text.includes(pattern)) offenders.push(`${path.relative(sourceRoot, file)}: ${pattern}`);
      });
    });

    expect(offenders).toEqual([]);
  });

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

  test('accepts an adjacent linked semantic icon button instead of flagging its label partner', () => {
    const objects = [
      {
        id: 'check-icon',
        type: 'button',
        label: '✓',
        linkedHoverGroup: 'ready-check',
        linkedActionTargetId: 'check-label',
        layerId: 'base',
        x: 20,
        y: 20,
        width: 48,
        height: 44,
        style: { background: '#16a34a', color: '#ffffff' },
      },
      {
        id: 'check-label',
        type: 'button',
        label: 'KONTROL ET',
        linkedHoverGroup: 'ready-check',
        layerId: 'base',
        x: 76,
        y: 20,
        width: 160,
        height: 44,
        style: { background: '#16a34a', color: '#ffffff' },
      },
    ];

    expect(findTtkbMissingSemanticIconButtons(objects)).toEqual([]);
    expect(enforceTtkbActivityCompliance({ objects }).objects[1].label).toBe('KONTROL ET');
  });

  test('repairs a genuinely missing semantic icon and a long single-line button', () => {
    const activity = enforceTtkbActivityCompliance({
      stageWidth: 800,
      objects: [
        {
          id: 'restart',
          type: 'button',
          runtimeAction: 'restart',
          label: 'YENİDEN BAŞLAT',
          x: 20,
          width: 180,
          style: { background: '#2563eb', color: '#ffffff' },
        },
        {
          id: 'long',
          type: 'button',
          label: 'Bu uzun buton metni tek satırda kalmalıdır',
          x: 20,
          width: 120,
          style: { background: '#2563eb', color: '#ffffff', fontSize: 16 },
        },
      ],
    });

    expect(activity.objects[0].label).toBe('↻ YENİDEN BAŞLAT');
    expect(activity.objects[1].width).toBeGreaterThan(120);
    expect(activity.objects[1].style.whiteSpace).toBe('nowrap');
  });

  test('colorLocked buton rengi düşük kontrastta bile TTKB zorlamasından korunur', () => {
    const activity = enforceTtkbActivityCompliance({
      id: 'act-1',
      buttonPackageId: 'pkg-1',
      objects: [
        {
          id: 'locked-btn',
          type: 'button',
          label: 'KONTROL ET',
          style: {
            background: '#2563eb',
            color: '#3b82f6', // mavi zeminde düşük kontrast — yine de korunmalı
            colorLocked: true,
            textShadow: '0 2px 0 rgba(0,0,0,.4)',
          },
        },
      ],
    });

    expect(activity.objects[0].style.color).toBe('#3b82f6');
    expect(activity.objects[0].style.textShadow).toBe('0 2px 0 rgba(0,0,0,.4)');
  });

  test('colorLocked text/shape rengi de TTKB zorlamasından korunur', () => {
    const activity = enforceTtkbActivityCompliance({
      id: 'act-1',
      objects: [
        {
          id: 'txt',
          type: 'text',
          label: 'Başlık',
          style: { background: '#ffffff', color: '#fde047', colorLocked: true },
        },
        {
          id: 'shp',
          type: 'shape',
          shapeKind: 'roundedRect',
          label: 'Şekil',
          style: { background: '#0f172a', color: '#1e293b', colorLocked: true },
        },
      ],
    });

    expect(activity.objects[0].style.color).toBe('#fde047');
    expect(activity.objects[1].style.color).toBe('#1e293b');
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
