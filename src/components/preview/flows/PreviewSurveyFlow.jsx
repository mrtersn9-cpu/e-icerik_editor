import { useState, useCallback } from 'react';

import { evaluateStorylineRuntimeSurvey } from '../../../utils/storylineRuntimeEngine';

import { previewActionButtonStyle, FeedbackOverlay } from './shared';
export function PreviewSurveyFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [responses, setResponses] = useState({});
  const questions = activity.surveyQuestions || [];

  const handleCheck = useCallback(() => {
    const evalResult = evaluateStorylineRuntimeSurvey({ state: { surveyResponses: responses } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
  }, [responses]);

  const handleRestart = () => {
    setResponses({});
    setResult(null);
    setPhase('play');
  };

  const setResponse = (questionId, value) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  if (phase === 'result') {
    return (
      <FeedbackOverlay
        result={result}
        activity={activity}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Anket</div>
      </div>
      {activity.surveyAnonymous !== false && (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
          Bu anket anonimdir. Kişisel bilgileriniz kaydedilmez.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {questions.map((q, idx) => (
          <div key={q.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#334155', marginBottom: 10 }}>
              {idx + 1}. {q.prompt || 'Soru'}
            </div>
            {q.type === 'likert' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(q.options || []).map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      background: responses[q.id] === opt ? '#dbeafe' : '#fff',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="radio"
                      name={`survey-${q.id}`}
                      value={opt}
                      checked={responses[q.id] === opt}
                      onChange={() => setResponse(q.id, opt)}
                      style={{ accentColor: '#1d4ed8' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'open-text' && (
              <textarea
                value={responses[q.id] || ''}
                onChange={(e) => setResponse(q.id, e.target.value)}
                placeholder="Görüşlerinizi yazın..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            )}
            {(!q.type || q.type === 'single-choice') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(q.options || []).map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      background: responses[q.id] === opt ? '#dbeafe' : '#fff',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="radio"
                      name={`survey-${q.id}`}
                      value={opt}
                      checked={responses[q.id] === opt}
                      onChange={() => setResponse(q.id, opt)}
                      style={{ accentColor: '#1d4ed8' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleCheck} style={previewActionButtonStyle(activity, 'primary')}>
          Gönder
        </button>
        <button onClick={handleRestart} style={previewActionButtonStyle(activity, 'secondary')}>
          Temizle
        </button>
      </div>
    </div>
  );
}
