import { TextEncoder } from 'util';

import { buildStorylineRuntimeDeck } from '../utils/storylineRuntime';

global.TextEncoder = TextEncoder;
// eslint-disable-next-line global-require
const { buildStorylinePlayerHtml } = require('../utils/scormExport');

// SCORM çıktı paritesi: editör önizlemesindeki geri bildirim (ses + animasyon) verisi
// dışa aktarılan pakete taşınmalı ve oynatıcı bunu çalacak koda sahip olmalı.
// (Çalışma zamanı yürütmesi bu ortamda doğrulanamaz; string düzeyinde doğrulanır.)

const stateWith = (answerFeedback) => ({
  selActId: 'act-1',
  activities: [
    {
      id: 'act-1',
      name: 'Soru',
      type: 'selection',
      mcMode: 'single',
      mcOptions: [
        { id: 'o1', label: 'Doğru', isCorrect: true },
        { id: 'o2', label: 'Yanlış', isCorrect: false },
      ],
      answerFeedback,
    },
  ],
});

describe('SCORM geri bildirim paritesi', () => {
  test('answerFeedback runtime deck slaytına taşınır (ses modu + animasyon + gecikme)', () => {
    const slides = buildStorylineRuntimeDeck(
      stateWith({
        correctSoundMode: 'custom',
        correctSoundData: 'data:audio/mp3;base64,AAAA',
        animation: 'Confetti',
        incorrectAnimation: 'Sallanma',
        feedbackDelay: 1.5,
      })
    );
    const slide = slides[0];
    expect(slide.answerFeedback).toBeTruthy();
    expect(slide.answerFeedback.correctSoundMode).toBe('custom');
    expect(slide.answerFeedback.correctSoundData).toContain('data:audio');
    expect(slide.answerFeedback.animation).toBe('Confetti');
    expect(slide.answerFeedback.incorrectAnimation).toBe('Sallanma');
    expect(slide.answerFeedback.feedbackDelay).toBe(1.5);
  });

  test('feedback verisi cevap anahtarı (isCorrect) içermez', () => {
    const slides = buildStorylineRuntimeDeck(stateWith({}));
    expect(JSON.stringify(slides[0].answerFeedback)).not.toContain('isCorrect');
  });

  test('oynatıcı HTML geri bildirim ses/animasyon fonksiyonlarını içerir', () => {
    const html = buildStorylinePlayerHtml(stateWith({}), { packageName: 'Test' });
    expect(html).toContain('function playAnswerFeedback');
    expect(html).toContain('function playFeedbackTone');
    expect(html).toContain('eicScormConfetti');
    // Kontrol Et komutu geri bildirimi tetiklemeli.
    expect(html).toContain('playAnswerFeedback(__chk)');
  });

  test('oynatıcı HTML seçeneğe özel geri bildirim ve havuz çekme fonksiyonlarını içerir', () => {
    const html = buildStorylinePlayerHtml(stateWith({}), { packageName: 'Test' });
    expect(html).toContain('function showOptionFeedbackNote');
    expect(html).toContain('function applyPoolDraw');
  });
});

const stateWithPool = (poolDrawRandom) => ({
  selActId: 'act-1',
  activities: [
    {
      id: 'act-1',
      name: 'Soru',
      type: 'selection',
      mcMode: 'single',
      settings: { poolDrawRandom },
      mcOptions: [
        { id: 'o1', label: 'Doğru', isCorrect: true },
        { id: 'o2', label: 'Yanlış', isCorrect: false },
      ],
      savedQuestions: [
        { id: 'q1', question: 'Soru 1', options: [{ id: 'a', label: 'A', isCorrect: true }], difficulty: 'orta' },
      ],
    },
  ],
});

describe('Soru havuzu SCORM taşıma (opt-in)', () => {
  test('poolDrawRandom AÇIKKEN havuz ve bayrak runtime slaytına taşınır', () => {
    const slide = buildStorylineRuntimeDeck(stateWithPool(true))[0];
    expect(slide.poolDrawRandom).toBe(true);
    expect(slide.savedQuestions).toHaveLength(1);
    expect(slide.savedQuestions[0].id).toBe('q1');
  });

  test('poolDrawRandom KAPALIYKEN havuz taşınmaz (cevap anahtarı sızmaz)', () => {
    const slide = buildStorylineRuntimeDeck(stateWithPool(false))[0];
    expect(slide.poolDrawRandom).toBe(false);
    expect(slide.savedQuestions).toHaveLength(0);
  });
});
