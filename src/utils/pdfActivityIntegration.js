import {
  getActivitySlides,
  selectActivitySlide,
} from '../logic/activityHelpers';
import {
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
  ensureStandardActivityScaffold,
} from '../logic/activityTemplateGenerators';
import { createObject } from '../logic/factories';

import { sanitizeSvgMarkup } from './editorHelpers';

export const PDF_INTEGRATION_WARN_BYTES = 2 * 1024 * 1024;
export const PDF_INTEGRATION_CONFIRM_BYTES = 5 * 1024 * 1024;

const ACTIVITY_NAME_RE = /^\s*Etkinlik\s+(\d+)\s*$/i;
const EXTERNAL_REF_RE = /\b(?:href|xlink:href|src)\s*=\s*(['"])(https?:\/\/[^'"]+)\1/gi;

function byteSize(value = '') {
  const text = String(value || '');
  if (typeof Blob !== 'undefined') return new Blob([text]).size;
  return text.length;
}

export function hashPdfIntegrationContent(value = '') {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `hash_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildPdfPageSourceId({ fileName = 'pdf', pageNumber = 0, pageHash = '' } = {}) {
  const cleanName = String(fileName || 'pdf')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `pdf:${cleanName || 'pdf'}:page:${Number(pageNumber) || 0}:${pageHash || 'hash'}`;
}

export function sanitizeSvgForPdfIntegration(markup = '') {
  const raw = String(markup || '');
  const report = {
    removedScripts: (raw.match(/<\s*script\b/gi) || []).length,
    removedEventHandlers: (raw.match(/\s+on[a-z]+\s*=/gi) || []).length,
    removedJavascriptUrls: (raw.match(/(?:javascript|vbscript|data:text\/html)\s*:/gi) || [])
      .length,
    removedForeignObjects: (raw.match(/<\s*foreignObject\b/gi) || []).length,
    externalReferences: [],
    originalBytes: byteSize(raw),
    sanitizedBytes: 0,
    warnings: [],
  };
  raw.replace(EXTERNAL_REF_RE, (_, quote, url) => {
    if (!report.externalReferences.includes(url)) report.externalReferences.push(url);
    return '';
  });
  const svgContent = sanitizeSvgMarkup(raw);
  report.sanitizedBytes = byteSize(svgContent);
  if (report.externalReferences.length) {
    report.warnings.push('SVG içinde dış HTTP/HTTPS kaynak referansı var.');
  }
  if (report.sanitizedBytes > PDF_INTEGRATION_WARN_BYTES) {
    report.warnings.push('SVG boyutu editor performansını etkileyebilir.');
  }
  if (report.removedForeignObjects > 0) {
    report.warnings.push('foreignObject riskli olduğu için temizlendi.');
  }
  return { svgContent, sanitizeReport: report };
}

export function getLargestEtkinlikNumber(activities = [], bookId = '') {
  return (Array.isArray(activities) ? activities : []).reduce((max, activity) => {
    if (bookId && activity?.bookId !== bookId) return max;
    const match = String(activity?.name || '').match(ACTIVITY_NAME_RE);
    return match ? Math.max(max, Number(match[1]) || 0) : max;
  }, 0);
}

function getActivityIntegratedSources(activity = {}) {
  const sources = [];
  if (activity.integratedPdfSource) {
    sources.push({
      source: activity.integratedPdfSource,
      activityId: activity.id,
      activityName: activity.name,
    });
  }
  getActivitySlides(activity).forEach((slide) => {
    if (slide?.integratedPdfSource) {
      sources.push({
        source: slide.integratedPdfSource,
        activityId: activity.id,
        activityName: activity.name,
      });
    }
    if (slide?.background?.source) {
      sources.push({
        source: slide.background.source,
        activityId: activity.id,
        activityName: activity.name,
      });
    }
  });
  return sources;
}

export function findDuplicatePdfIntegration(page = {}, activities = [], book = {}) {
  const bookId = String(book?.id || page.bookId || '');
  const bookName = String(book?.name || page.bookName || '');
  const pdfPageId = String(page.pdfPageId || '');
  const originalPageNumber = Number(page.originalPageNumber || page.pageNumber || 0);
  const pageHash = String(page.pageHash || '');

  for (const activity of Array.isArray(activities) ? activities : []) {
    for (const item of getActivityIntegratedSources(activity)) {
      const source = item.source || {};
      const samePageId =
        bookId &&
        pdfPageId &&
        String(source.bookId || '') === bookId &&
        String(source.pdfPageId || '') === pdfPageId;
      const sameHash =
        bookName &&
        originalPageNumber &&
        pageHash &&
        String(source.bookName || '') === bookName &&
        Number(source.originalPageNumber || 0) === originalPageNumber &&
        String(source.pageHash || '') === pageHash;
      if (samePageId || sameHash) return item;
    }
  }
  return null;
}

export function buildPdfIntegrationPlan({ pages = [], activities = [], book = {} } = {}) {
  let nextNumber = getLargestEtkinlikNumber(activities, book?.id) + 1;
  let activeGroupId = '';
  let previousCreate = null;
  const entries = [];

  pages
    .slice()
    .sort((a, b) => Number(a.pageNumber || a.originalPageNumber) - Number(b.pageNumber || b.originalPageNumber))
    .forEach((page, index) => {
      const baseEntry = {
        planId: `pdf-plan-${index + 1}`,
        pageNumber: Number(page.pageNumber || page.originalPageNumber || index + 1),
        originalPageNumber: Number(page.originalPageNumber || page.pageNumber || index + 1),
        flow: page.flow === 'continue' ? 'continue' : 'new',
        include: page.include !== false,
        deleted: page.deleted === true,
        page,
      };

      if (page.deleted === true) {
        entries.push({ ...baseEntry, status: 'excluded', reason: 'Silindi.' });
        return;
      }

      if (page.include === false) {
        entries.push({ ...baseEntry, status: 'excluded', reason: 'Hariç tutuldu.' });
        return;
      }

      const duplicate = findDuplicatePdfIntegration(page, activities, book);
      if (duplicate) {
        entries.push({
          ...baseEntry,
          status: 'duplicate',
          reason: `Daha önce ${duplicate.activityName || 'bir etkinlik'} olarak entegre edilmiş.`,
          duplicateActivityId: duplicate.activityId,
          duplicateActivityName: duplicate.activityName,
        });
        return;
      }

      const startsNewGroup = baseEntry.flow !== 'continue' || !previousCreate;
      if (startsNewGroup) activeGroupId = `pdf-group-${entries.length + 1}`;
      const entry = {
        ...baseEntry,
        status: 'create',
        activityName: `Etkinlik ${nextNumber}`,
        activityNumber: nextNumber,
        groupId: activeGroupId,
        previousPlanId: startsNewGroup ? '' : previousCreate?.planId || '',
        nextPlanId: '',
      };
      if (previousCreate && previousCreate.groupId === entry.groupId) {
        previousCreate.nextPlanId = entry.planId;
      }
      entries.push(entry);
      previousCreate = entry;
      nextNumber += 1;
    });

  const createEntries = entries.filter((entry) => entry.status === 'create');
  const groups = createEntries.reduce((acc, entry) => {
    if (!acc[entry.groupId]) acc[entry.groupId] = [];
    acc[entry.groupId].push(entry);
    return acc;
  }, {});
  Object.values(groups).forEach((group) => {
    group.forEach((entry, index) => {
      entry.groupIndex = index;
      entry.groupSize = group.length;
      entry.hasBackButton = index > 0;
      entry.hasForwardButton = index < group.length - 1;
    });
  });

  return {
    bookId: book?.id || '',
    bookName: book?.name || '',
    startNumber: getLargestEtkinlikNumber(activities, book?.id) + 1,
    entries,
    createEntries,
    createCount: createEntries.length,
    duplicateCount: entries.filter((entry) => entry.status === 'duplicate').length,
    excludedCount: entries.filter((entry) => entry.status === 'excluded').length,
    continuationGroupCount: Object.values(groups).filter((group) => group.length > 1).length,
  };
}

function findPracticeSlide(slides = []) {
  return (
    slides.find(
      (slide) =>
        ![SCENE_TEMPLATE_LAUNCH_PAGE_ID, SCENE_TEMPLATE_BUTTON_INTRO_ID].includes(
          String(slide?.sceneTemplateId || '')
        )
    ) ||
    slides[2] ||
    slides[slides.length - 1]
  );
}

function findLayerId(slide = {}, names = []) {
  const wanted = names.map((name) => String(name || '').toLocaleLowerCase('tr-TR'));
  const found = (slide.layers || []).find((layer) =>
    wanted.includes(String(layer?.name || layer?.id || '').toLocaleLowerCase('tr-TR'))
  );
  return found?.id || 'base';
}

function createNavigationButton({ label, targetActivityId, direction, layerId }) {
  const object = createObject('button');
  const isBack = direction === 'back';
  return {
    ...object,
    id: `pdf-nav-${direction}-${targetActivityId}`,
    label,
    x: isBack ? 90 : 1610,
    y: 940,
    width: 220,
    height: 64,
    layerId,
    zIndex: 9000,
    generatedBy: 'pdf-integration-nav',
    runtimeAction: 'none',
    style: {
      ...object.style,
      background: isBack ? '#475569' : '#2563eb',
      borderColor: isBack ? '#334155' : '#1d4ed8',
      color: '#ffffff',
      borderRadius: 8,
      fontSize: 20,
      fontWeight: 900,
      whiteSpace: 'nowrap',
      boxShadow: '0 10px 22px rgba(15,23,42,.18)',
    },
  };
}

function createNavigationTrigger({ buttonId, targetActivityId, name }) {
  return {
    id: `pdf-trigger-${buttonId}`,
    when: 'onClick',
    target: buttonId,
    action: 'SayfaGec',
    value: targetActivityId,
    extra: '',
    stateKey: 'visited',
    stateValue: 'true',
    name,
    conditionMode: 'all',
    conditions: [],
  };
}

export function applyPdfIntegrationToActivity(activity = {}, entry = {}, nav = {}) {
  const scaffolded = ensureStandardActivityScaffold(activity, { select: 'practice' });
  const slides = getActivitySlides(scaffolded);
  const practiceSlide = findPracticeSlide(slides);
  const source = {
    bookId: entry.page?.bookId || entry.page?.book?.id || entry.bookId || '',
    bookName: entry.page?.bookName || entry.bookName || '',
    pdfPageId: entry.page?.pdfPageId || '',
    originalPageNumber: entry.originalPageNumber,
    pageHash: entry.page?.pageHash || '',
    integratedAt: entry.page?.integratedAt || new Date().toISOString(),
  };
  const correctLayerId = findLayerId(practiceSlide, ['Correct', 'Doğru', 'dogru']);
  const objects = (practiceSlide.objects || []).filter(
    (object) => object?.generatedBy !== 'pdf-integration-nav'
  );
  const triggers = (practiceSlide.triggers || []).filter(
    (trigger) => !String(trigger?.id || '').startsWith('pdf-trigger-pdf-nav-')
  );

  if (entry.hasBackButton && nav.previousActivityId) {
    const button = createNavigationButton({
      label: 'Geri',
      targetActivityId: nav.previousActivityId,
      direction: 'back',
      layerId: 'base',
    });
    objects.push(button);
    triggers.push(
      createNavigationTrigger({
        buttonId: button.id,
        targetActivityId: nav.previousActivityId,
        name: 'PDF devam geri',
      })
    );
  }

  if (entry.hasForwardButton && nav.nextActivityId) {
    const button = createNavigationButton({
      label: 'İleri',
      targetActivityId: nav.nextActivityId,
      direction: 'forward',
      layerId: correctLayerId,
    });
    objects.push(button);
    triggers.push(
      createNavigationTrigger({
        buttonId: button.id,
        targetActivityId: nav.nextActivityId,
        name: 'PDF devam ileri',
      })
    );
  }

  const nextPracticeSlide = {
    ...practiceSlide,
    name: practiceSlide.name || 'Etkinlik 1',
    sceneName: practiceSlide.sceneName || practiceSlide.name || 'Etkinlik 1',
    svgMarkup: entry.page?.svgContent || '',
    svgName: `${entry.activityName || activity.name || 'Etkinlik'} - Sayfa ${entry.originalPageNumber}.svg`,
    background: {
      type: 'pdf-integrated-svg',
      fit: 'contain',
      position: 'center',
      opacity: 1,
      locked: true,
      source,
    },
    integratedPdfSource: source,
    pdfIntegrationSanitizeReport: entry.page?.sanitizeReport || null,
    objects,
    triggers,
  };
  const nextSlides = slides.map((slide) =>
    slide.id === practiceSlide.id ? nextPracticeSlide : slide
  );
  return selectActivitySlide(
    {
      ...scaffolded,
      name: entry.activityName || scaffolded.name,
      integratedPdfSource: source,
      pdfIntegration: {
        source,
        groupId: entry.groupId,
        groupIndex: entry.groupIndex || 0,
        groupSize: entry.groupSize || 1,
      },
      slides: nextSlides,
      startSlideId: nextSlides[0]?.id || scaffolded.startSlideId,
      currentSlideId: practiceSlide.id,
    },
    practiceSlide.id
  );
}

export function createPdfIntegratedActivitySet(plan = {}, options = {}) {
  const createBaseActivity = options.createBaseActivity;
  if (typeof createBaseActivity !== 'function') {
    throw new Error('PDF entegrasyonu için etkinlik oluşturucu bulunamadı.');
  }
  const prepared = (plan.createEntries || []).map((entry) => ({
    entry,
    activity: createBaseActivity(entry.activityName),
  }));
  const idByPlanId = Object.fromEntries(
    prepared.map(({ entry, activity }) => [entry.planId, activity.id])
  );
  const activities = prepared.map(({ entry, activity }) =>
    applyPdfIntegrationToActivity(activity, entry, {
      previousActivityId: entry.previousPlanId ? idByPlanId[entry.previousPlanId] : '',
      nextActivityId: entry.nextPlanId ? idByPlanId[entry.nextPlanId] : '',
    })
  );
  return { activities, idByPlanId };
}
