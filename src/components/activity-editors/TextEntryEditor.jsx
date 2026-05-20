import { Inp } from '../../components/ui';

export default function TextEntryEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const answers = activity.textEntryAcceptedAnswers || [''];
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
            color: '#059669',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Metin Girişi Ayarları
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Inp
            label="Soru Metni"
            value={activity.textEntryPrompt || ''}
            onChange={(e) => patch({ textEntryPrompt: e.target.value })}
            placeholder="Cevabınızı yazınız..."
          />
          <Inp
            label="Maks. Karakter"
            type="number"
            value={activity.textEntryMaxLength || 500}
            onChange={(e) => patch({ textEntryMaxLength: Math.max(1, +e.target.value || 500) })}
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!activity.textEntryCaseSensitive}
              onChange={(e) => patch({ textEntryCaseSensitive: e.target.checked })}
              style={{ accentColor: '#059669' }}
            />
            Büyük/küçük harf duyarlı
          </label>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
              Kabul Edilen Cevaplar
            </div>
            {answers.map((a, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input
                  value={a}
                  onChange={(e) => {
                    const next = [...answers];
                    next[idx] = e.target.value;
                    patch({ textEntryAcceptedAnswers: next });
                  }}
                  style={{
                    flex: 1,
                    height: 28,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 12,
                    padding: '0 8px',
                  }}
                  placeholder="Doğru cevap varyasyonu"
                />
                {answers.length > 1 && (
                  <button
                    onClick={() =>
                      patch({ textEntryAcceptedAnswers: answers.filter((_, i) => i !== idx) })
                    }
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => patch({ textEntryAcceptedAnswers: [...answers, ''] })}
              style={{
                minHeight: 28,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #6ee7b7',
                background: '#ffffff',
                color: '#059669',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              + Varyasyon Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
