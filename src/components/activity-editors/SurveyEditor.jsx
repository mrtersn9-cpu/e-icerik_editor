import { uid } from '../../utils/editorHelpers';

export default function SurveyEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const questions = activity.surveyQuestions || [];
  const card = {
    background: '#ffffff',
    border: '1px solid #dbe7f5',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 10px 22px rgba(15,23,42,.05)',
  };
  const addQ = (type) =>
    patch({
      surveyQuestions: [
        ...questions,
        {
          id: uid(),
          prompt: '',
          type,
          options: type === 'likert' ? ['Çok kötü', 'Kötü', 'Orta', 'İyi', 'Çok iyi'] : [],
        },
      ],
    });
  const removeQ = (id) => patch({ surveyQuestions: questions.filter((q) => q.id !== id) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={card}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#7c3aed',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Anket Soruları
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, marginBottom: 10 }}>
          Anket puansızdır. Geri bildirim ve memnuniyet ölçümü için kullanın.
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#475569',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <input
            type="checkbox"
            checked={activity.surveyAnonymous !== false}
            onChange={(e) => patch({ surveyAnonymous: e.target.checked })}
            style={{ accentColor: '#7c3aed' }}
          />{' '}
          Anonim
        </label>
        {questions.map((q, idx) => (
          <div
            key={q.id}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              marginBottom: 8,
              background: '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>
                Soru {idx + 1} —{' '}
                {q.type === 'likert'
                  ? 'Likert'
                  : q.type === 'open-text'
                    ? 'Açık Metin'
                    : q.type === 'rating'
                      ? 'Puan'
                      : 'Çoktan Seçmeli'}
              </span>
              <button
                onClick={() => removeQ(q.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ×
              </button>
            </div>
            <input
              value={q.prompt}
              onChange={(e) =>
                patch({
                  surveyQuestions: questions.map((sq) =>
                    sq.id === q.id ? { ...sq, prompt: e.target.value } : sq
                  ),
                })
              }
              style={{
                width: '100%',
                height: 28,
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 12,
                padding: '0 8px',
                marginBottom: 4,
              }}
              placeholder="Soru metni..."
            />
            {q.type === 'likert' && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Ölçek: {(q.options || []).join(' → ')}
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button
            onClick={() => addQ('likert')}
            style={{
              minHeight: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid #c4b5fd',
              background: '#ffffff',
              color: '#7c3aed',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Likert
          </button>
          <button
            onClick={() => addQ('open-text')}
            style={{
              minHeight: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid #c4b5fd',
              background: '#ffffff',
              color: '#7c3aed',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Açık Metin
          </button>
          <button
            onClick={() => addQ('rating')}
            style={{
              minHeight: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid #c4b5fd',
              background: '#ffffff',
              color: '#7c3aed',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Puan
          </button>
        </div>
      </div>
    </div>
  );
}
