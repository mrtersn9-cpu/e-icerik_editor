import { sanitizePdfText, extractPdfQuestionAnchors } from '../pdfParser';
import { clamp } from '../utils/editorHelpers';

import { createObject, upgradeDragDropStyle } from './factories';
import {
  detectPdfSelectionLayout,
  buildPdfSelectionLayoutFromStoryboard,
  getPdfQuestionAnchors,
  getPdfDragPoolRect,
} from './pdfUtils';

export function createPdfImageObject(imageUrl, pageWidth, pageHeight, label = 'PDF Zemin') {
  const object = createObject('image');
  return {
    ...object,
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    imageData: imageUrl,
    label,
    isPdfBackground: true,
    locked: true,
    zIndex: 0,
    style: {
      ...object.style,
      background: 'transparent',
      borderColor: 'transparent',
    },
  };
}

export function createPdfMaskObject(x, y, width, height) {
  const object = createObject('shape');
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: '',
    isPdfMask: true,
    locked: true,
    zIndex: 30,
    style: {
      ...object.style,
      background: '#ffffff',
      borderColor: '#ffffff',
      borderRadius: 8,
      color: 'transparent',
    },
  };
}

export function createPdfDropzoneObject(text, x, y, width, height, index) {
  const object = createObject('dropzone');
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: `Bosluk ${index + 1}`,
    group: text,
    locked: false,
    zIndex: 40 + index,
    style: {
      ...upgradeDragDropStyle('dropzone', object.style),
      borderRadius: 12,
    },
  };
}

export function createPdfDraggableObject(text, x, y, width, height, index) {
  const object = createObject('draggable');
  return {
    ...object,
    x,
    y,
    width,
    height,
    label: text,
    group: text,
    zIndex: 60 + index,
    style: {
      ...upgradeDragDropStyle('draggable', object.style),
      borderRadius: 16,
    },
  };
}

export function createPdfSelectionObject(
  questionId,
  choice,
  x,
  y,
  width,
  height,
  index,
  isCorrect = null,
  displayLabel = null,
  layoutMode = ''
) {
  const object = createObject('button');
  const isBinary = choice === 'd' || choice === 'y';
  const isTableChoice = layoutMode === 'table-choice';
  const label = isBinary
    ? choice === 'd'
      ? 'D'
      : 'Y'
    : isTableChoice
      ? sanitizePdfText(displayLabel || choice || '')
      : '☐';
  const bg = isBinary
    ? choice === 'd'
      ? '#dcfce7'
      : '#fef2f2'
    : isTableChoice
      ? '#eff6ff'
      : '#f8faff';
  const border = isBinary
    ? choice === 'd'
      ? '#16a34a'
      : '#dc2626'
    : isTableChoice
      ? '#2563eb'
      : '#6366f1';
  const color = isBinary
    ? choice === 'd'
      ? '#15803d'
      : '#b91c1c'
    : isTableChoice
      ? '#1d4ed8'
      : '#4338ca';
  return {
    ...object,
    x,
    y,
    width,
    height,
    label,
    selectionQuestionId: questionId,
    selectionChoice: choice,
    selectionCorrect: typeof isCorrect === 'boolean' ? isCorrect : null,
    locked: false,
    zIndex: 48 + index,
    style: {
      ...object.style,
      background: bg,
      borderColor: border,
      color,
      borderRadius: isBinary ? 6 : 4,
      fontSize: isBinary ? 14 : isTableChoice ? 12 : 22,
      fontWeight: 700,
    },
  };
}

export function buildPdfSelectionObjects(draft, page) {
  const detectedLayout = detectPdfSelectionLayout(page);
  const storyboardLayout = buildPdfSelectionLayoutFromStoryboard(draft, page);
  const detectedCount = detectedLayout?.anchors?.length || 0;
  const storyboardCount = storyboardLayout?.anchors?.length || 0;
  const layout =
    storyboardCount > detectedCount ? storyboardLayout : detectedLayout || storyboardLayout;
  if (!layout) return { objects: [], slots: [], masks: [], layout: null };

  const objects = [];
  const slots = [];
  const masks = [];
  const width = page.width || 1920;
  const height = page.height || 1080;

  const columnHeight = clamp(
    (layout.anchors[layout.anchors.length - 1]?.stageY || 0) +
      layout.rowHeight -
      Math.max(0, layout.anchors[0]?.stageY || 0) +
      layout.rowHeight * 0.22,
    layout.rowHeight,
    height
  );
  const columnTop = clamp(
    Math.max(0, (layout.anchors[0]?.stageY || 0) - layout.rowHeight * 0.18),
    0,
    height
  );
  layout.columns.forEach((column) => {
    const extraW = layout.mode === 'single-check' ? column.width * 0.45 : column.width * 0.12;
    const rx = clamp(column.left - extraW * 0.35, 0, width);
    masks.push(
      createPdfMaskObject(rx, columnTop, Math.min(width - rx, column.width + extraW), columnHeight)
    );
  });

  layout.anchors.forEach((anchor, index) => {
    const questionId = `pdf-q-${index + 1}`;
    const top = clamp(anchor.stageY - layout.rowHeight * 0.18, 0, height - layout.rowHeight);
    const correctChoice = layout.answers[questionId] || null;
    const correctColumn = layout.columns.find((column) => column.key === correctChoice) || null;
    slots.push({ id: questionId, correctChoice, correctLabel: correctColumn?.label || null });
    layout.columns.forEach((column, columnIndex) => {
      objects.push(
        createPdfSelectionObject(
          questionId,
          column.key,
          column.left,
          top,
          column.width,
          layout.rowHeight,
          index * Math.max(1, layout.columns.length) + columnIndex,
          correctChoice === column.key ? true : correctChoice ? false : null,
          column.label || column.key,
          layout.mode
        )
      );
    });
  });

  return { objects, slots, masks, layout };
}

export function applyPdfCleaningMasks(kind, page) {
  if (kind === 'drag-drop') {
    return [];
  }
  return [];
}

export function buildPdfDragDropObjects(draft, page) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const terms = (draft.draggableTerms || []).map((term) => sanitizePdfText(term)).filter(Boolean);
  const answers = (draft.answerTerms || []).map((term) => sanitizePdfText(term)).filter(Boolean);
  const anchors = getPdfQuestionAnchors(page).length
    ? getPdfQuestionAnchors(page)
    : extractPdfQuestionAnchors(lines, page.height || 768);
  const preferredDropTerms =
    answers.length >= Math.min(terms.length, anchors.length) ? answers : terms;
  const dropTerms = preferredDropTerms.slice(0, anchors.length);
  if (!terms.length || !anchors.length || !dropTerms.length) return { objects: [], matches: {} };

  const width = page.width || 1365;
  const height = page.height || 768;
  const poolRect = getPdfDragPoolRect(page);
  const dragGap = 10;
  const dragHeight = clamp(Math.round(height * 0.045), 34, 46);
  const objects = [];
  const matches = {};
  const dropzones = [];

  dropTerms.forEach((answer, index) => {
    const anchor = anchors[index];
    if (!anchor) return;
    const dropHeight = clamp(Math.round(height * 0.043), 32, 42);
    const dropWidth = clamp(
      Math.max(220, Math.round(answer.length * 10.5)),
      220,
      Math.round(width * 0.28)
    );
    const preferredX = anchor.x + (anchor.width || 0) + 12;
    const minX = Math.max(110, width * 0.16);
    const maxX = Math.max(minX, poolRect ? poolRect.x - dropWidth - 24 : width * 0.55);
    const targetX = clamp(preferredX, minX, maxX);
    const preferredY = anchor.stageY;
    const minY = Math.max(24, anchor.stageY - 4);
    const maxY = Math.max(minY, anchor.stageY + anchor.height);

    const dropzone = createPdfDropzoneObject(
      answer,
      targetX,
      clamp(preferredY, minY, maxY),
      dropWidth,
      dropHeight,
      index
    );
    objects.push(dropzone);
    dropzones.push(dropzone);
  });

  const longTerms = terms.some((term) => term.length > 24);
  const columns = poolRect && !longTerms && terms.length >= 6 ? 2 : 1;
  const dragWidth = poolRect
    ? clamp(
        Math.round(columns === 1 ? poolRect.width - 18 : (poolRect.width - 24 - dragGap) / 2),
        200,
        420
      )
    : clamp(Math.round(width * 0.18), 180, 320);
  const dragStartX = poolRect ? poolRect.x + 9 : width * 0.72;
  const dragStartY = poolRect ? poolRect.y + 8 : height * 0.24;

  terms.forEach((term, index) => {
    const column = columns === 1 ? 0 : index % columns;
    const row = columns === 1 ? index : Math.floor(index / columns);
    const x = poolRect
      ? dragStartX + column * (dragWidth + dragGap)
      : width * (0.72 + column * 0.12);
    const y = poolRect
      ? dragStartY + row * (dragHeight + 8)
      : height * 0.24 + row * (dragHeight + 12);

    const draggable = createPdfDraggableObject(term, x, y, dragWidth, dragHeight, index);
    objects.push(draggable);

    const dropzone = dropzones.find((item) => item.group === term) || dropzones[index] || null;
    if (dropzone) matches[draggable.id] = dropzone.id;
  });

  return { objects, matches };
}
