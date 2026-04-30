import { EDITOR_THEME } from '../theme';

// ─── Aktivite Tipleri ─────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  { id: 'selection', label: 'Secim Etkinligi', icon: '□', desc: 'Coktan secmeli, dogru/yanlis' },
  { id: 'drag-drop', label: 'Surukle & Birak', icon: '↕', desc: 'Eslesme ve siralama' },
  { id: 'hotspot', label: 'Hotspot', icon: '⊕', desc: 'Gorsel uzerinde etkin alan' },
  { id: 'sequence', label: 'Siralama', icon: '⇅', desc: 'Ogeleri dogru siraya diz' },
  { id: 'matching', label: 'Eslestirme', icon: '⇔', desc: 'Sol-sag cift eslestirme' },
  { id: 'text-entry', label: 'Metin Girisi', icon: '✎', desc: 'Serbest metin cevap' },
  { id: 'numeric', label: 'Sayisal Giris', icon: '#', desc: 'Sayi tabanlı cevap' },
  { id: 'fill-blank', label: 'Bosluk Doldurma', icon: '___', desc: 'Cumle ici bosluk' },
  { id: 'survey', label: 'Anket', icon: '◩', desc: 'Puansiz geri bildirim toplama' },
  { id: 'mixed', label: 'Karma', icon: '⊞', desc: 'Birden fazla soru tipi' },
];

export const DRAG_DROP_MODES = [
  { id: 'single', label: 'Tekli', desc: 'Her suruklenebilir kendi birakma alanina gider (1:1)' },
  { id: 'multi-single', label: 'Coklu Tekli', desc: 'Birden fazla oge ayni alana birakilabilir' },
  { id: 'group', label: 'Gruplu', desc: 'Grup etiketine gore otomatik eslesir' },
  {
    id: 'multi-group',
    label: 'Coklu Gruplu',
    desc: 'Bir alan ayni gruptaki tum ogeleri kabul eder',
  },
];

export const DEFAULT_DRAG_DROP_SETTINGS = {
  isolateScopes: true,
  allowCrossScope: false,
  allowMultipleItemsPerDrop: false,
  allowMultipleTargetsPerDrag: false,
  answerPlacementLayout: 'stack',
  dragAnimationPreset: 'soft',
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
  answerButtonText: 'Cevabi Goster',
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
  packageName: 'E-Icerik Paketi',
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
