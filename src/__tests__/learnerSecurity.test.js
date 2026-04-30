import {
  createLearnerSafeStateForExport,
  sanitizeLmsRuntimeRecord,
} from '../utils/learnerSecurity';

describe('learner security helpers', () => {
  test('removes answer keys and secret LMS fields from learner exports', () => {
    const exported = createLearnerSafeStateForExport({
      lmsConfig: { xapiKey: 'key', xapiSecret: 'secret', secureLearnerMode: false },
      activities: [
        {
          id: 'act-1',
          lmsConfig: { ltiSharedSecret: 'lti-secret' },
          settings: {
            showAnswerLayer: true,
            answerButtonAction: 'answer',
            solutionButtonAction: 'solution',
          },
          mcOptions: [{ id: 'a', label: 'A', isCorrect: true }],
          objects: [{ id: 'o1', label: 'Option', selectionCorrect: true }],
          matchingPairs: [{ left: 'A', right: 'B' }],
          sequenceItems: [
            { id: 'b', label: 'Second', correctOrder: 2 },
            { id: 'a', label: 'First', correctOrder: 1 },
          ],
          fillBlankAnswers: ['answer'],
          numericCorrectValue: 42,
        },
      ],
    });

    expect(exported.lmsConfig.xapiKey).toBeUndefined();
    expect(exported.lmsConfig.xapiSecret).toBeUndefined();
    expect(exported.lmsConfig.secureLearnerMode).toBe(true);
    expect(exported.activities[0].lmsConfig.ltiSharedSecret).toBeUndefined();
    expect(exported.activities[0].settings.showAnswerLayer).toBe(false);
    expect(exported.activities[0].settings.answerButtonAction).toBe('none');
    expect(exported.activities[0].mcOptions[0].isCorrect).toBeUndefined();
    expect(exported.activities[0].objects[0].selectionCorrect).toBeUndefined();
    expect(exported.activities[0].matchingPairs).toBeUndefined();
    expect(exported.activities[0].sequenceItems.map((item) => item.id)).toEqual(['a', 'b']);
    expect(exported.activities[0].sequenceItems[0].correctOrder).toBeUndefined();
    expect(exported.activities[0].fillBlankAnswers).toBeUndefined();
    expect(exported.activities[0].numericCorrectValue).toBeUndefined();
  });

  test('sanitizes inspectable LMS runtime records', () => {
    const record = sanitizeLmsRuntimeRecord({
      action: 'SonucGonder',
      xapiKey: 'key',
      xapiSecret: 'secret',
      score: 80,
      result: { detail: [{ correct: true }] },
      scoreData: { correct: 1, incorrect: 0, total: 1, percent: 100 },
    });

    expect(record.action).toBe('SonucGonder');
    expect(record.score).toBe(80);
    expect(record.scoreData.percent).toBe(100);
    expect(record.xapiKey).toBeUndefined();
    expect(record.xapiSecret).toBeUndefined();
    expect(record.result).toBeUndefined();
  });
});
