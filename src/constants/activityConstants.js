// ─── Aktivite Tipleri ─────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  { id: 'selection', label: 'Seçim Etkinliği', icon: '□', desc: 'Çoktan seçmeli, doğru/yanlış' },
  { id: 'drag-drop', label: 'Sürükle-Bırak', icon: '↕', desc: 'Eşleştirme ve sıralama' },
  { id: 'hotspot', label: 'Etkin Alan', icon: '⊕', desc: 'Görsel üzerinde etkin alan' },
  { id: 'sequence', label: 'Sıralama', icon: '⇅', desc: 'Öğeleri doğru sıraya diz' },
  { id: 'matching', label: 'Eşleştirme', icon: '⇔', desc: 'Sol-sağ çift eşleştirme' },
  { id: 'text-entry', label: 'Kısa Cevap', icon: '✎', desc: 'Serbest metin yanıtı' },
  { id: 'numeric', label: 'Sayısal Cevap', icon: '#', desc: 'Sayı tabanlı yanıt' },
  { id: 'fill-blank', label: 'Boşluk Doldurma', icon: '___', desc: 'Cümle içi boşluk' },
  { id: 'survey', label: 'Anket', icon: '◩', desc: 'Puansız geri bildirim toplama' },
  { id: 'mixed', label: 'Karma', icon: '⊞', desc: 'Birden fazla soru tipi' },
  { id: 'puzzle', label: 'Bulmaca', icon: '▦', desc: 'Kare bulmaca, kelime avı, sudoku, labirent, hafıza' },
  {
    id: 'custom-interaction',
    label: 'Özel Etkileşim',
    icon: '✦',
    desc: 'Widget tabanlı özel etkileşim iskeleti',
  },
];

export const DRAG_DROP_MODES = [
  { id: 'single', label: 'Tekli', desc: 'Her sürüklenebilir kendi bırakma alanına gider (1:1)' },
  { id: 'multi-single', label: 'Çoklu Tekli', desc: 'Birden fazla öğe aynı alana bırakılabilir' },
  { id: 'group', label: 'Gruplu', desc: 'Grup etiketine göre otomatik eşleşir' },
  {
    id: 'multi-group',
    label: 'Çoklu Gruplu',
    desc: 'Bir alan aynı gruptaki tüm öğeleri kabul eder',
  },
];

export const DEFAULT_DRAG_DROP_SETTINGS = {
  isolateScopes: true,
  allowCrossScope: false,
  allowMultipleItemsPerDrop: false,
  allowMultipleTargetsPerDrag: false,
  answerPlacementLayout: 'stack',
  dragAnimationPreset: 'soft',
  snapTolerance: 20,
};

export const DEFAULT_SELECTION_UI = {
  controlShape: 'circle',
  controlMark: 'check',
  wrongMarkMode: 'opposite',
};

export const DRAGGABLE_STRONG_STYLE = {
  fontSize: 13,
  color: '#eff6ff',
  background: '#1d4ed8',
  borderColor: '#1e3a8a',
  borderStyle: 'solid',
  borderRadius: 10,
};

export const DROPZONE_STRONG_STYLE = {
  fontSize: 13,
  color: '#fff7ed',
  background: '#ea580c',
  borderColor: '#9a3412',
  borderStyle: 'solid',
  borderRadius: 10,
};

export const DEFAULT_ACTIVITY_SETTINGS = {
  completionMode: 'required',
  scorePoints: 10,
  shuffleOptions: false,
  showFeedback: true,
  allowRetry: true,
  maxAttempts: 0,
  feedbackLayerEnabled: true,
  feedbackCorrectLayer: 'Correct',
  feedbackIncorrectLayer: 'Incorrect',
  feedbackTryAgainLayer: '',
  feedbackCorrectDuration: 2,
  feedbackIncorrectDuration: 2,
  feedbackTryAgainDuration: 1.5,
  reviewQuizEnabled: false,
  showMenuScreen: true,
  showAnswerLayer: true,
  answerButtonText: 'Cevabı Göster',
  showButtonPackageIntro: true,
  guideButtonText: 'Tanıtım',
  menuButtonText: '☰ MENÜ',
  checkButtonText: 'Kontrol Et',
  solutionButtonText: 'Çözümü Göster',
  restartFlowText: 'Yeniden Başlat',
  completeButtonText: 'Tamamla',
  homeButtonText: 'Ana Sayfa',
  soundOnText: 'Sesi Aç',
  soundOffText: 'Sesi Kapat',
  guideButtonAction: 'package',
  packageBackAction: 'intro',
  menuButtonAction: 'toggle-menu',
  checkButtonAction: 'check',
  solutionButtonAction: 'answer',
  restartButtonAction: 'restart',
  completeButtonAction: 'complete',
  answerButtonAction: 'restart',
  homeButtonAction: 'intro',
  introNextPhase: 'auto',
  packageNextPhase: 'auto',
  menuNextPhase: 'play',
};

export const DEFAULT_LMS_CONFIG = {
  packageName: 'E-İçerik Paketi',
  packageCode: 'EIC-001',
  version: '1.0.0',
  standard: 'scorm12',
  trackingMode: 'completion+score',
  passingScore: 70,
  scormExportScope: 'activity',
  launchMode: 'new-window',
  resumeMode: 'resume',
  navigationMode: 'free',
  completionRule: 'required-only',
  successRule: 'passing-score',
  maxAttempts: 0,
  reportStatus: 'passed-incomplete',
  playerTheme: 'modern-dark',
  showMenu: true,
  showResources: true,
  showGlossary: false,
  showNotes: false,
  allowSearch: true,
  allowDownload: false,
  secureLearnerMode: true,
};

export const LMS_STANDARD_OPTIONS = [
  { value: 'scorm12', label: 'SCORM 1.2', desc: 'TTKB uyumlu tek LMS paket standardı' },
];
