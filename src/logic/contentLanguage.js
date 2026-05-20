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
  const other = lang === 'en' ? CONTENT_TEXT.tr : CONTENT_TEXT.en;
  let next = String(value || '');
  Object.keys(other).forEach((key) => {
    if (!other[key] || !target[key]) return;
    next = next.split(other[key]).join(target[key]);
  });
  if (lang === 'en') next = next.split('KULLANIM KILAVUZU').join(target.activityIntro);
  if (lang === 'tr') next = next.split('USER GUIDE').join(target.activityIntro);
  return next;
}

function applyContentLanguageToActivity(activity = {}, lang = 'tr') {
  const tx = contentText(lang);
  const translate = (value) => translateGeneratedContentText(value, lang);
  const nextObjects = (activity.objects || []).map((object) => {
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
  });
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
    introScreen: activity.introScreen
      ? {
          ...activity.introScreen,
          buttonText: lang === 'en' ? 'Start' : 'Başla',
        }
      : activity.introScreen,
    resultScreens: activity.resultScreens
      ? {
          ...activity.resultScreens,
          successTitle: lang === 'en' ? 'Great!' : 'Harika!',
          successBody: lang === 'en' ? 'You found the correct answer.' : 'Doğru cevabı buldun.',
          failureTitle: lang === 'en' ? 'Try Again' : 'Tekrar Deneyelim',
          failureBody:
            lang === 'en'
              ? 'You are getting closer to the correct answer.'
              : 'Doğru cevaba biraz daha yakınsın.',
          retryText: lang === 'en' ? 'Try Again' : 'Tekrar Dene',
          continueText: lang === 'en' ? 'Continue' : 'Devam Et',
        }
      : activity.resultScreens,
    answerScreen: activity.answerScreen
      ? {
          ...activity.answerScreen,
          title: lang === 'en' ? 'Correct Answer' : 'Doğru Cevap',
          body:
            lang === 'en'
              ? 'The system prepared the correct answer automatically.'
              : 'Sistem doğru cevabı otomatik olarak hazırladı.',
          buttonText: tx.restart,
        }
      : activity.answerScreen,
    buttonPackageScreen: activity.buttonPackageScreen
      ? {
          ...activity.buttonPackageScreen,
          title: lang === 'en' ? 'Theme Package Intro' : 'Tema Paketi Tanıtımı',
          body:
            lang === 'en'
              ? 'Review the theme package and button behaviors before the activity.'
              : 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.',
          buttonText: lang === 'en' ? 'Go to Menu' : 'Menüye Geç',
          backButtonText: lang === 'en' ? 'Go Back' : 'Geri Dön',
          items: createDefaultThemePackageItems().map((item) => ({
            ...item,
            ...(lang === 'en'
              ? {
                  label:
                    {
                      guide: 'Intro',
                      start: 'Start Activity',
                      prev: 'Previous Question',
                      next: 'Next Question',
                      menu: 'Menu',
                      playpause: 'Play / Pause',
                      check: 'Check',
                      solution: 'Show Solution',
                      restart: 'Restart',
                    }[item.id] || item.label,
                  desc:
                    {
                      guide: 'Shows the opening information and quick help.',
                      start: 'Moves past the welcome step and starts the activity.',
                      prev: 'Returns to the previous question or slider.',
                      next: 'Moves to the next question or slider.',
                      menu: 'Opens guide, sound and restart options.',
                      playpause: 'Plays or pauses audio and video on the scene.',
                      check: 'Checks answers with the selected theme colors.',
                      solution: 'Shows the correct placement and hints.',
                      restart: 'Resets the activity and returns to the beginning.',
                    }[item.id] || item.desc,
                }
              : {}),
          })),
        }
      : activity.buttonPackageScreen,
  };
}
