export const STORYLINE_RUNTIME_CORE_SCRIPT = `
function runtimeKey(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

function runtimeIsGeneratedAnswerTemplateObject(object = {}) {
  return (
    object?.generatedBy === 'answer-template' || object?.generatedBy === 'answer-template-popup'
  );
}

function runtimeIsLaunchTemplateControl(object = {}) {
  const slotId = String(object?.sceneTemplateSlotId || '');
  const labelKey = runtimeKey(object?.label || object?.text || '');
  return (
    slotId.endsWith(':intro-button') ||
    slotId.endsWith(':intro-icon') ||
    slotId.endsWith(':intro-icon-bg') ||
    slotId.endsWith(':intro-icon-text') ||
    slotId.endsWith(':start-button') ||
    slotId.endsWith(':start-icon') ||
    slotId.endsWith(':start-icon-bg') ||
    slotId.endsWith(':start-icon-text') ||
    labelKey.includes('etkinliktanitimi') ||
    labelKey.includes('activityintro') ||
    labelKey.includes('etkinligibaslat') ||
    labelKey.includes('startactivity')
  );
}

function runtimeButtonAction(object = {}) {
  const action = String(object?.runtimeAction || '')
    .trim()
    .toLowerCase();
  if (['none', 'off', 'disabled', 'decorative', 'demo'].includes(action)) return '';
  if (
    object?.generatedBy === 'scene-template' &&
    object?.sceneTemplateId === 'button-intro' &&
    !String(object?.sceneTemplateSlotId || '').includes('start-button') &&
    !String(object?.sceneTemplateSlotId || '').includes('start-icon') &&
    !String(object?.sceneTemplateSlotId || '').includes('close-button')
  )
    return '';
  if (action === 'restart' || action === 'yenidenbaslat') return 'restart';
  if (action === 'home' || action === 'ana-sayfa' || action === 'anasayfa') return 'home';
  if (action === 'complete' || action === 'tamamla') return 'complete';
  if (action === 'show-answer' || action === 'answer' || action === 'cevap') return 'answer';
  if (action === 'toggle-mute' || action === 'mute' || action === 'ses') return 'mute';
  if (
    action === 'toggle-play-pause' ||
    action === 'play-pause' ||
    action === 'playpause' ||
    action === 'media'
  )
    return 'playback';
  if (
    action === 'show-help' ||
    action === 'help' ||
    action === 'guide' ||
    action === 'kilavuz' ||
    action === 'menu' ||
    action === 'toggle-menu' ||
    action === 'open-menu'
  )
    return 'help';
  if (
    object?.generatedBy === 'scene-template' &&
    object?.sceneTemplateId === 'launch-page' &&
    !runtimeIsLaunchTemplateControl(object)
  )
    return '';
  if (object?.type !== 'button' && !runtimeIsGeneratedAnswerTemplateObject(object)) return '';
  const labelKey = runtimeKey(object.label || object.text || '');
  if (
    labelKey.includes('yenidenbaslat') ||
    labelKey.includes('tekrarla') ||
    labelKey.includes('tekrardene')
  )
    return 'restart';
  if (labelKey.includes('anasayfa')) return 'home';
  if (labelKey.includes('tamamla')) return 'complete';
  if (labelKey.includes('cozumugoster') || labelKey.includes('cevabigoster')) return 'answer';
  if (labelKey.includes('sesikapat') || labelKey.includes('sesiac')) return 'mute';
  if (
    labelKey.includes('playpause') ||
    labelKey.includes('oynatduraklat') ||
    labelKey.includes('baslatduraklat')
  )
    return 'playback';
  if (
    labelKey.includes('kullanimkilavuzu') ||
    labelKey.includes('kilavuz') ||
    labelKey.includes('yardim') ||
    labelKey.includes('menu')
  )
    return 'help';
  return '';
}

function runtimeFindLayerByKeys(layers = [], keys = []) {
  const wanted = new Set(keys.map((item) => runtimeKey(item)));
  return (
    (Array.isArray(layers) ? layers : []).find((layer) =>
      wanted.has(runtimeKey(layer?.name || layer?.id || ''))
    ) || null
  );
}

function pickSlideState(source = {}) {
  const keys = [
    'sceneName',
    'stageWidth',
    'stageHeight',
    'backgroundColor',
    'background',
    'svgMarkup',
    'svgName',
    'integratedPdfSource',
    'pdfIntegrationSanitizeReport',
    'layers',
    'activeLayerId',
    'nextActivityId',
    'objects',
    'selectedObjectId',
    'timeline',
    'triggers',
    'audioUrl',
    'audioName',
    'audioAutoPlay',
    'audioLoop',
    'dragDropMode',
    'dragDropSettings',
    'slideTransitionEffect',
    'slideTransitionDirection',
    'slideTransitionDuration',
    'dragDropMatches',
    'mcOptions',
    'selectionSlots',
    'selectionUi',
    'type',
    'mcQuestion',
    'savedQuestions',
    'answerControl',
    'mixedItems',
    'mixedMode',
    'puzzleType',
    'puzzleQuestions',
    'puzzleGrid',
    'puzzlePlaced',
    'puzzleUnplaced',
    'puzzleSolution',
    'puzzleBudgetExceeded',
    'puzzleSettings',
    'fillBlankQuestion',
    'fillBlankSentence',
    'fillBlankAnswers',
    'fillBlankTurkishTolerance',
    'fillBlankTrim',
    'fillBlankAcceptSynonyms',
    'fillBlankUseRegex',
    'hotspotQuestion',
    'hotspotImage',
    'hotspotImageAlt',
    'matchingPairs',
    'matchingShuffle',
    'matchingMutual',
    'matchingLineStyle',
    'matchingLineWidth',
    'matchingLineColor',
    'sequenceItems',
    'sequenceShuffle',
    'sequenceDragDrop',
    'sequenceAutoNumber',
    'sequencePreventDuplicate',
    'sequenceDirection',
    'textEntryPrompt',
    'textEntryAcceptedAnswers',
    'textEntryAnswerWeights',
    'textEntryCaseSensitive',
    'textEntryMaxLength',
    'numericPrompt',
    'numericCorrectValue',
    'numericTolerance',
    'numericMin',
    'numericMax',
    'numericRejectOutOfRange',
    'surveyQuestions',
  ];
  const picked = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source || {}, key)) picked[key] = source[key];
  });
  return picked;
}

function withStableRuntimeSlideObjectIds(objects = [], slideId = '') {
  const scopedSlideId = String(slideId || 'slide');
  const seen = {};
  const usedRuntimeIds = new Set();
  return (Array.isArray(objects) ? objects : []).map((object, index) => {
    if (!object || typeof object !== 'object') return object;
    const base = String(object.id || object.type || 'obj');
    seen[base] = (seen[base] || 0) + 1;
    let runtimeId = \`\${scopedSlideId}__\${base}__\${seen[base]}__\${index}\`;
    while (usedRuntimeIds.has(runtimeId)) {
      seen[base] += 1;
      runtimeId = \`\${scopedSlideId}__\${base}__\${seen[base]}__\${index}\`;
    }
    usedRuntimeIds.add(runtimeId);
    return {
      ...object,
      __runtimeId: runtimeId,
    };
  });
}

function normalizeRuntimeSlide(activity = {}, slide = {}, slideIndex = 0, activityIndex = 0) {
  const prefersMaterializedActivityState = !!slide?.id && slide.id === activity.currentSlideId;
  const merged = prefersMaterializedActivityState
    ? { ...pickSlideState(slide), ...pickSlideState(activity) }
    : { ...pickSlideState(activity), ...pickSlideState(slide) };
  const resolvedSlideId = slide.id || \`\${activity.id || 'activity'}__slide_\${slideIndex + 1}\`;
  const layers =
    Array.isArray(merged.layers) && merged.layers.length
      ? merged.layers
      : [{ id: 'base', name: '', kind: 'base', visible: true }];
  return {
    id: resolvedSlideId,
    activityId: activity.id || \`activity_\${activityIndex + 1}\`,
    name: slide.name || merged.sceneName || activity.name || \`Sahne \${slideIndex + 1}\`,
    activityName: activity.name || \`Etkinlik \${activityIndex + 1}\`,
    stageWidth: Math.max(1, Number(merged.stageWidth || activity.stageWidth || 1920) || 1920),
    stageHeight: Math.max(1, Number(merged.stageHeight || activity.stageHeight || 1080) || 1080),
    backgroundColor: merged.backgroundColor || '#ffffff',
    svgMarkup: merged.svgMarkup || '',
    layers,
    activeLayerId: 'base',
    nextActivityId: merged.nextActivityId || '',
    objects: withStableRuntimeSlideObjectIds(merged.objects, resolvedSlideId),
    triggers: Array.isArray(merged.triggers) ? merged.triggers : [],
    audioUrl: merged.audioUrl || '',
    audioName: merged.audioName || '',
    audioAutoPlay: merged.audioAutoPlay !== false,
    audioLoop: !!merged.audioLoop,
    dragDropMode: merged.dragDropMode || activity.dragDropMode || 'single',
    dragDropSettings: {
      ...(activity.dragDropSettings || {}),
      ...(merged.dragDropSettings || {}),
    },
    dragDropMatches:
      merged.dragDropMatches && typeof merged.dragDropMatches === 'object'
        ? merged.dragDropMatches
        : activity.dragDropMatches || {},
    mcOptions: Array.isArray(merged.mcOptions)
      ? merged.mcOptions
      : Array.isArray(activity.mcOptions)
        ? activity.mcOptions
        : [],
    selectionSlots: Array.isArray(merged.selectionSlots)
      ? merged.selectionSlots
      : Array.isArray(activity.selectionSlots)
        ? activity.selectionSlots
        : [],
    selectionUi: { ...(activity.selectionUi || {}), ...(merged.selectionUi || {}) },
    type: merged.type || activity.type || '',
    mixedItems: Array.isArray(merged.mixedItems) ? merged.mixedItems : [],
    puzzleType: merged.puzzleType || activity.puzzleType || 'crossword',
    puzzleGrid: merged.puzzleGrid || null,
    puzzlePlaced: Array.isArray(merged.puzzlePlaced) ? merged.puzzlePlaced : [],
    puzzleUnplaced: Array.isArray(merged.puzzleUnplaced) ? merged.puzzleUnplaced : [],
    puzzleBudgetExceeded: !!merged.puzzleBudgetExceeded,
    puzzleSolution: merged.puzzleSolution || null,
    puzzleSettings: { ...(activity.puzzleSettings || {}), ...(merged.puzzleSettings || {}) },
    fillBlankSentence: merged.fillBlankSentence || '',
    fillBlankAnswers: Array.isArray(merged.fillBlankAnswers) ? merged.fillBlankAnswers : [],
    fillBlankTurkishTolerance: !!merged.fillBlankTurkishTolerance,
    fillBlankTrim: merged.fillBlankTrim !== false,
    hotspotQuestion: merged.hotspotQuestion || '',
    hotspotImage: merged.hotspotImage || '',
    hotspotImageAlt: merged.hotspotImageAlt || '',
    matchingPairs: Array.isArray(merged.matchingPairs) ? merged.matchingPairs : [],
    sequenceItems: Array.isArray(merged.sequenceItems) ? merged.sequenceItems : [],
    textEntryAcceptedAnswers: Array.isArray(merged.textEntryAcceptedAnswers)
      ? merged.textEntryAcceptedAnswers
      : [],
    numericCorrectValue: merged.numericCorrectValue ?? null,
    numericTolerance: merged.numericTolerance ?? 0,
    numericMin: merged.numericMin ?? null,
    numericMax: merged.numericMax ?? null,
    surveyQuestions: Array.isArray(merged.surveyQuestions) ? merged.surveyQuestions : [],
  };
}

function getOrderedRuntimeActivities(state = {}, options = {}) {
  const activities = Array.isArray(state.activities) ? state.activities.filter(Boolean) : [];
  const explicitActivityId = options.activityId || state.selActId || '';
  const explicitScope = options.scope || state.lmsConfig?.scormExportScope || '';
  if (explicitScope !== 'book' && explicitScope !== 'project' && explicitActivityId) {
    const selected = activities.find((activity) => activity.id === explicitActivityId);
    if (selected) return [selected];
  }

  if ((explicitScope === 'book' || state.selBookId) && explicitScope !== 'project') {
    const bookId = options.bookId || state.selBookId || '';
    const books = Array.isArray(state.books) ? state.books : [];
    const book = books.find((item) => item.id === bookId);
    if (book) {
      const byId = new Map(activities.map((activity) => [activity.id, activity]));
      const ordered = Array.isArray(book.activityIds)
        ? book.activityIds.map((id) => byId.get(id)).filter(Boolean)
        : activities.filter((activity) => activity.bookId === book.id);
      if (ordered.length) return ordered;
    }
  }

  return activities;
}

function buildStorylineRuntimeDeck(state = {}, options = {}) {
  const slides = [];
  getOrderedRuntimeActivities(state, options).forEach((activity, activityIndex) => {
    const sourceSlides =
      Array.isArray(activity.slides) && activity.slides.length
        ? activity.slides
        : [
            {
              id: \`\${activity.id || 'activity'}__slide_1\`,
              name: activity.sceneName || activity.name || 'Sahne 1',
              ...pickSlideState(activity),
            },
          ];
    const orderedSlides = sourceSlides;
    orderedSlides.forEach((slide, slideIndex) => {
      slides.push(normalizeRuntimeSlide(activity, slide, slideIndex, activityIndex));
    });
  });
  return slides.length
    ? slides
    : [
        {
          id: 'empty',
          activityId: 'empty',
          name: 'İçerik',
          activityName: 'İçerik',
          stageWidth: 1920,
          stageHeight: 1080,
          backgroundColor: '#ffffff',
          svgMarkup: '',
          layers: [{ id: 'base', name: '', kind: 'base', visible: true }],
          activeLayerId: 'base',
          nextActivityId: '',
          objects: [],
          triggers: [],
        },
      ];
}

`;
