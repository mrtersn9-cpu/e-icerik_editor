import { createDefaultThemePackageItems } from './factories';

const CONTENT_TEXT = {
  tr: {
    check: 'KONTROL ET',
    start: 'ETKİNLİĞİ BAŞLAT',
    menu: 'MENÜ',
    prev: 'GERİ',
    next: 'İLERİ',
    playPause: 'PLAY / PAUSE',
    mute: 'SESİ KAPAT',
    soundOn: 'SESİ AÇ',
    soundOff: 'SESİ KAPAT',
    answer: 'CEVABI GÖSTER',
    solution: 'ÇÖZÜMÜ GÖSTER',
    restart: 'YENİDEN BAŞLAT',
    retry: 'TEKRARLA',
    complete: 'TAMAMLA',
    closeActivity: 'ETKİNLİĞİ KAPAT',
    home: 'ANA SAYFA',
    activityIntro: 'ETKİNLİK TANITIMI',
    checkNote:
      'Soruları cevapladıktan sonra “KONTROL ET” butonuna basarak doğru veya yanlışlarınızı görebilirsiniz.',
    closeNote: 'Sayfayı kapatır.',
    startNote: '“ETKİNLİĞİ BAŞLAT” butonuna basarak etkinliği başlatabilirsiniz.',
    prevNote: 'Bir önceki soruyu veya sliderı açar.',
    nextNote: 'Bir sonraki soruyu veya sliderı açar.',
    playPauseNote: 'Sahnedeki ses ve videoları durdurur veya kaldığı yerden başlatır.',
    guideLabel: 'ETKİNLİK TANITIMI',
    guideNote: 'Etkinlik tanıtımını açar.',
    restartNote: 'Etkinliği yeniden başlatır.',
    muteNote: 'Sesi açar veya kapatır.',
    homeNote: 'Ana sayfaya döndürür.',
    menuNote: 'Menüyü açar.',
    completeNote: 'Etkinliği bitirir.',
    retryNote: 'Etkinliği tekrar başlatır.',
    answerNote: 'Etkinliğin çözümünü gösterir.',
    correctTitle: 'DOĞRU',
    incorrectTitle: 'YANLIŞ',
    correctBody: 'Tebrikler, tüm soruları doğru cevapladınız.',
    incorrectBody: 'Üzgünüz, soruların tamamını doğru cevaplamadınız.',
    showSolution: 'ÇÖZÜMÜ GÖSTER',
    tryAgain: 'YENİDEN BAŞLA',
    readyHelp:
      'Buton sahneye eklenir ve otomatik seçilir. Menü gibi geçiş görevlerini alttaki Tıklama Görevi alanından ver.',
  },
  en: {
    check: 'CHECK',
    start: 'START ACTIVITY',
    menu: 'MENU',
    prev: 'BACK',
    next: 'NEXT',
    playPause: 'PLAY / PAUSE',
    mute: 'MUTE',
    soundOn: 'UNMUTE',
    soundOff: 'MUTE',
    answer: 'SHOW ANSWER',
    solution: 'SHOW SOLUTION',
    restart: 'RESTART',
    retry: 'RETRY',
    complete: 'COMPLETE',
    closeActivity: 'CLOSE ACTIVITY',
    home: 'HOME',
    activityIntro: 'ACTIVITY INTRO',
    checkNote:
      'After answering the questions, press “CHECK” to see your correct and incorrect answers.',
    closeNote: 'Closes the page.',
    startNote: 'Press “START ACTIVITY” to begin the activity.',
    prevNote: 'Opens the previous question or slider.',
    nextNote: 'Opens the next question or slider.',
    playPauseNote: 'Pauses or resumes audio and video on the scene.',
    guideLabel: 'ACTIVITY INTRO',
    guideNote: 'Opens the activity intro.',
    restartNote: 'Restarts the activity.',
    muteNote: 'Turns sound on or off.',
    homeNote: 'Returns to the home page.',
    menuNote: 'Opens the menu.',
    completeNote: 'Finishes the activity.',
    retryNote: 'Starts the activity again.',
    answerNote: 'Shows the solution for the activity.',
    correctTitle: 'CORRECT',
    incorrectTitle: 'INCORRECT',
    correctBody: 'Congratulations, you answered all questions correctly.',
    incorrectBody: 'Sorry, you did not answer all questions correctly.',
    showSolution: 'SHOW SOLUTION',
    tryAgain: 'TRY AGAIN',
    readyHelp:
      'The button is added to the scene and selected automatically. Assign menu and navigation tasks from the Click Task area below.',
  },
  de: {
    check: 'PRÜFEN',
    start: 'AKTIVITÄT STARTEN',
    menu: 'MENÜ',
    prev: 'ZURÜCK',
    next: 'WEITER',
    playPause: 'PLAY / PAUSE',
    mute: 'STUMM',
    soundOn: 'TON EIN',
    soundOff: 'TON AUS',
    answer: 'ANTWORT ANZEIGEN',
    solution: 'LÖSUNG ANZEIGEN',
    restart: 'NEU STARTEN',
    retry: 'WIEDERHOLEN',
    complete: 'ABSCHLIESSEN',
    closeActivity: 'AKTIVITÄT SCHLIESSEN',
    home: 'STARTSEITE',
    activityIntro: 'AKTIVITÄTSINTRO',
    checkNote:
      'Nachdem du die Fragen beantwortet hast, drücke „PRÜFEN“, um richtige und falsche Antworten zu sehen.',
    closeNote: 'Schließt die Seite.',
    startNote: 'Drücke „AKTIVITÄT STARTEN“, um die Aktivität zu beginnen.',
    prevNote: 'Öffnet die vorherige Frage oder den vorherigen Slider.',
    nextNote: 'Öffnet die nächste Frage oder den nächsten Slider.',
    playPauseNote: 'Pausiert oder startet Audio und Video auf der Szene.',
    guideLabel: 'AKTIVITÄTSINTRO',
    guideNote: 'Öffnet die Aktivitätsintro.',
    restartNote: 'Startet die Aktivität neu.',
    muteNote: 'Schaltet den Ton ein oder aus.',
    homeNote: 'Kehrt zur Startseite zurück.',
    menuNote: 'Öffnet das Menü.',
    completeNote: 'Beendet die Aktivität.',
    retryNote: 'Startet die Aktivität erneut.',
    answerNote: 'Zeigt die Lösung der Aktivität.',
    correctTitle: 'RICHTIG',
    incorrectTitle: 'FALSCH',
    correctBody: 'Glückwunsch, du hast alle Fragen richtig beantwortet.',
    incorrectBody: 'Leider hast du nicht alle Fragen richtig beantwortet.',
    showSolution: 'LÖSUNG ANZEIGEN',
    tryAgain: 'ERNEUT VERSUCHEN',
    readyHelp:
      'Der Button wird zur Szene hinzugefügt und automatisch ausgewählt. Lege Menü- und Navigationsaufgaben im Bereich Klick-Aufgabe fest.',
  },
};

function getActivityContentLanguage(activity = {}) {
  return activity.contentLanguage || activity.settings?.contentLanguage || activity.lang || 'tr';
}

export { getActivityContentLanguage, contentText, translateGeneratedContentText, applyContentLanguageToActivity };

function contentText(activityOrLang = 'tr') {
  const lang =
    typeof activityOrLang === 'string'
      ? activityOrLang
      : getActivityContentLanguage(activityOrLang);
  return CONTENT_TEXT[lang] || CONTENT_TEXT.tr;
}

function translateGeneratedContentText(value = '', lang = 'tr') {
  const target = CONTENT_TEXT[lang] || CONTENT_TEXT.tr;
  let next = String(value || '');
  Object.entries(CONTENT_TEXT)
    .filter(([sourceLang]) => sourceLang !== lang)
    .flatMap(([, source]) =>
      Object.keys(source)
        .filter((key) => source[key] && target[key] && source[key] !== target[key])
        .map((key) => [source[key], target[key]])
    )
    .sort((a, b) => String(b[0]).length - String(a[0]).length)
    .forEach(([sourceText, targetText]) => {
      next = next.split(sourceText).join(targetText);
    });
  if (lang === 'en') next = next.split('KULLANIM KILAVUZU').join(target.activityIntro);
  if (lang === 'de') {
    next = next.split('KULLANIM KILAVUZU').join(target.activityIntro);
    next = next.split('USER GUIDE').join(target.activityIntro);
  }
  if (lang === 'tr') next = next.split('USER GUIDE').join(target.activityIntro);
  return next;
}

function applyContentLanguageToActivity(activity = {}, lang = 'tr') {
  const tx = contentText(lang);
  const translate = (value) => translateGeneratedContentText(value, lang);
  const screenText = {
    tr: {
      startShort: 'Başla',
      successTitle: 'Harika!',
      successBody: 'Doğru cevabı buldun.',
      failureTitle: 'Tekrar Deneyelim',
      failureBody: 'Doğru cevaba biraz daha yakınsın.',
      retryText: 'Tekrar Dene',
      continueText: 'Devam Et',
      correctAnswer: 'Doğru Cevap',
      answerBody: 'Sistem doğru cevabı otomatik olarak hazırladı.',
      packageIntro: 'Tema Paketi Tanıtımı',
      packageBody: 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.',
      goToMenu: 'Menüye Geç',
      goBack: 'Geri Dön',
    },
    en: {
      startShort: 'Start',
      successTitle: 'Great!',
      successBody: 'You found the correct answer.',
      failureTitle: 'Try Again',
      failureBody: 'You are getting closer to the correct answer.',
      retryText: 'Try Again',
      continueText: 'Continue',
      correctAnswer: 'Correct Answer',
      answerBody: 'The system prepared the correct answer automatically.',
      packageIntro: 'Theme Package Intro',
      packageBody: 'Review the theme package and button behaviors before the activity.',
      goToMenu: 'Go to Menu',
      goBack: 'Go Back',
    },
    de: {
      startShort: 'Start',
      successTitle: 'Sehr gut!',
      successBody: 'Du hast die richtige Antwort gefunden.',
      failureTitle: 'Erneut versuchen',
      failureBody: 'Du bist der richtigen Antwort schon näher.',
      retryText: 'Erneut versuchen',
      continueText: 'Weiter',
      correctAnswer: 'Richtige Antwort',
      answerBody: 'Das System hat die richtige Antwort automatisch vorbereitet.',
      packageIntro: 'Einführung in das Designpaket',
      packageBody: 'Prüfe zuerst das Designpaket und das Verhalten der Buttons.',
      goToMenu: 'Zum Menü',
      goBack: 'Zurück',
    },
  }[lang] || {};
  const translateObject = (object) => {
    if (!object || typeof object !== 'object') return object;
    const shouldTranslate =
      object.generatedBy ||
      object.type === 'button' ||
      object.sceneTemplateId ||
      object.isCheckButton ||
      object.runtimeAction;
    if (!shouldTranslate) return object;
    return {
      ...object,
      label: translate(object.label || ''),
      text: object.text ? translate(object.text) : object.text,
      soundOnLabel: object.soundOnLabel ? tx.soundOn : object.soundOnLabel,
      soundOffLabel: object.soundOffLabel ? tx.soundOff : object.soundOffLabel,
      accessibility: object.accessibility
        ? { ...object.accessibility, lang }
        : object.accessibility,
    };
  };
  const nextObjects = (activity.objects || []).map(translateObject);
  const nextSlides = Array.isArray(activity.slides)
    ? activity.slides.map((slide) => ({
        ...slide,
        contentLanguage: lang,
        settings: {
          ...(slide.settings || {}),
          contentLanguage: lang,
        },
        objects:
          slide.id && slide.id === activity.currentSlideId
            ? nextObjects
            : Array.isArray(slide.objects)
              ? slide.objects.map(translateObject)
              : slide.objects,
      }))
    : activity.slides;
  return {
    ...activity,
    contentLanguage: lang,
    settings: {
      ...(activity.settings || {}),
      contentLanguage: lang,
      checkButtonText: tx.check,
      menuButtonText: `☰ ${tx.menu}`,
      solutionButtonText: tx.solution,
      restartFlowText: tx.restart,
      completeButtonText: tx.complete,
      homeButtonText: tx.home,
      soundOnText: tx.soundOn,
      soundOffText: tx.soundOff,
      answerButtonText: tx.answer,
    },
    objects: nextObjects,
    slides: nextSlides,
    introScreen: activity.introScreen
      ? {
          ...activity.introScreen,
          buttonText: screenText.startShort,
        }
      : activity.introScreen,
    resultScreens: activity.resultScreens
      ? {
          ...activity.resultScreens,
          successTitle: screenText.successTitle,
          successBody: screenText.successBody,
          failureTitle: screenText.failureTitle,
          failureBody: screenText.failureBody,
          retryText: screenText.retryText,
          continueText: screenText.continueText,
        }
      : activity.resultScreens,
    answerScreen: activity.answerScreen
      ? {
          ...activity.answerScreen,
          title: screenText.correctAnswer,
          body: screenText.answerBody,
          buttonText: tx.restart,
        }
      : activity.answerScreen,
    buttonPackageScreen: activity.buttonPackageScreen
      ? {
          ...activity.buttonPackageScreen,
          title: screenText.packageIntro,
          body: screenText.packageBody,
          buttonText: screenText.goToMenu,
          backButtonText: screenText.goBack,
          items: createDefaultThemePackageItems().map((item) => ({
            ...item,
            label:
              {
                tr: {},
                en: {
                  guide: 'Intro',
                  start: 'Start Activity',
                  prev: 'Previous Question',
                  next: 'Next Question',
                  menu: 'Menu',
                  playpause: 'Play / Pause',
                  check: 'Check',
                  solution: 'Show Solution',
                  restart: 'Restart',
                },
                de: {
                  guide: 'Intro',
                  start: 'Aktivität starten',
                  prev: 'Vorherige Frage',
                  next: 'Nächste Frage',
                  menu: 'Menü',
                  playpause: 'Play / Pause',
                  check: 'Prüfen',
                  solution: 'Lösung anzeigen',
                  restart: 'Neu starten',
                },
              }[lang]?.[item.id] || item.label,
            desc:
              {
                tr: {},
                en: {
                  guide: 'Shows the opening information and quick help.',
                  start: 'Moves past the welcome step and starts the activity.',
                  prev: 'Returns to the previous question or slider.',
                  next: 'Moves to the next question or slider.',
                  menu: 'Opens guide, sound and restart options.',
                  playpause: 'Plays or pauses audio and video on the scene.',
                  check: 'Checks answers with the selected theme colors.',
                  solution: 'Shows the correct placement and hints.',
                  restart: 'Resets the activity and returns to the beginning.',
                },
                de: {
                  guide: 'Zeigt die Einführung und eine kurze Hilfe.',
                  start: 'Überspringt die Begrüßung und startet die Aktivität.',
                  prev: 'Kehrt zur vorherigen Frage oder zum vorherigen Slider zurück.',
                  next: 'Wechselt zur nächsten Frage oder zum nächsten Slider.',
                  menu: 'Öffnet Hilfe, Ton und Neustartoptionen.',
                  playpause: 'Startet oder pausiert Audio und Video auf der Szene.',
                  check: 'Prüft Antworten mit den gewählten Designfarben.',
                  solution: 'Zeigt die richtige Platzierung und Hinweise.',
                  restart: 'Setzt die Aktivität zurück und beginnt von vorn.',
                },
              }[lang]?.[item.id] || item.desc,
          })),
        }
      : activity.buttonPackageScreen,
  };
}
