import { Inp } from '../../components/ui';
import { uid } from '../../utils/editorHelpers';

export default function FillBlankEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const blanks = activity.fillBlankAnswers || [];
  const card = {
    background: '#ffffff',
    border: '1px solid #dbe7f5',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 10px 22px rgba(15,23,42,.05)',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={card}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#be185d',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Boşluk Doldurma
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, marginBottom: 10 }}>
          Cümlede boşluk yerine <code>___</code> (üç alt çizgi) kullanın.
        </div>
        <Inp
          label="Cümle"
          value={activity.fillBlankSentence || ''}
          onChange={(e) => patch({ fillBlankSentence: e.target.value })}
          placeholder="Türkiye'nin başkenti ___ şehridir."
        />
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
            Boşluk Cevapları
          </div>
          {blanks.map((blank, idx) => (
            <div
              key={blank.id}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                marginBottom: 6,
                background: '#f8fafc',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                Boşluk {idx + 1}
              </div>
              <input
                value={(blank.acceptedValues || []).join(', ')}
                onChange={(e) => {
                  const next = [...blanks];
                  next[idx] = {
                    ...blank,
                    acceptedValues: e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  };
                  patch({ fillBlankAnswers: next });
                }}
                style={{
                  width: '100%',
                  height: 28,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 12,
                  padding: '0 8px',
                }}
                placeholder="Virgülle ayırarak birden fazla cevap"
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#475569',
                  marginTop: 4,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!blank.caseSensitive}
                  onChange={(e) => {
                    const next = [...blanks];
                    next[idx] = { ...blank, caseSensitive: e.target.checked };
                    patch({ fillBlankAnswers: next });
                  }}
                  style={{ accentColor: '#be185d' }}
                />{' '}
                Harf duyarlı
              </label>
            </div>
          ))}
          <button
            onClick={() =>
              patch({
                fillBlankAnswers: [
                  ...blanks,
                  {
                    id: uid(),
                    blankIndex: blanks.length,
                    acceptedValues: [''],
                    caseSensitive: false,
                  },
                ],
              })
            }
            style={{
              minHeight: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid #f9a8d4',
              background: '#ffffff',
              color: '#be185d',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            + Boşluk Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
