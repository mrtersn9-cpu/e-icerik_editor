import { useState, useCallback } from 'react';

import { DEFAULT_ACTIVITY_SETTINGS } from '../../../constants';
import { evaluateStorylineRuntimeMixed } from '../../../utils/storylineRuntimeEngine';

import { previewActionButtonStyle, FeedbackOverlay, HintBox } from './shared';
export function PreviewMixedFlow({ activity }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [values, setValues] = useState({});
  const [attempts, setAttempts] = useState(0);
  const items = activity.mixedItems || [];
  const settings = { ...DEFAULT_ACTIVITY_SETTINGS, ...(activity.settings || {}) };
  const answerControl = activity.answerControl || {};
  const maxAttempts = answerControl.maxAttempts || settings.maxAttempts || 0;

  const handleCheck = useCallback(() => {
    if (maxAttempts > 0 && attempts >= maxAttempts) return;
    const evalResult = evaluateStorylineRuntimeMixed({ slide: activity, state: { mixedAnswers: values } });
    setResult(evalResult.success ? 'success' : 'failure');
    setPhase('result');
    setAttempts((a) => a + 1);
  }, [activity, attempts, maxAttempts, values]);

  const handleRestart = () => {
    setValues({});
    setResult(null);
    setPhase('play');
  };

  if (phase === 'result') {
    const evalResult = evaluateStorylineRuntimeMixed({ slide: activity, state: { mixedAnswers: values } });
    return (
      <FeedbackOverlay
        result={result}
        activity={activity}
        onRestart={handleRestart}
        earnedPoints={evalResult.earnedPoints}
        totalPoints={evalResult.totalPoints}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto', fontSize: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Karma Etkinlik</div>
        {maxAttempts > 0 && (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Deneme: {attempts} / {maxAttempts}
          </span>
        )}
      </div>
      <HintBox activity={activity} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((item, idx) => {
          const itemVal = values[item.id] || {};
          let mixedBlankIndex = 0;
          return (
            <div
              key={item.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
                background: '#ffffff',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 900, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 999 }}>
                  Soru {idx + 1}
                </span>
                <span style={{ fontWeight: 800, color: '#1e293b' }}>{item.question}</span>
              </div>

              {item.type === 'selection' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                  {(item.options || []).map((opt) => {
                    const isMulti = item.mode === 'multi';
                    const isSelected = Array.isArray(itemVal) ? itemVal.includes(opt.id) : itemVal === opt.id;
                    const handleChange = () => {
                      if (isMulti) {
                        const current = Array.isArray(itemVal) ? itemVal : [];
                        const next = current.includes(opt.id) ? current.filter(id => id !== opt.id) : [...current, opt.id];
                        setValues({ ...values, [item.id]: next });
                      } else {
                        setValues({ ...values, [item.id]: opt.id });
                      }
                    };
                    return (
                      <label key={opt.id} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          name={`mixed-selection-${item.id}`}
                          checked={isSelected}
                          onChange={handleChange}
                          style={{ accentColor: '#2563eb' }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {item.type === 'drag-drop' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
                  {(item.pairs || []).map((pair) => {
                    const pairVal = itemVal[pair.id] || '';
                    const rightOptions = (item.pairs || []).map(p => p.right).filter(Boolean);
                    return (
                      <div key={pair.id} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14 }}>
                        <span style={{ minWidth: 100, fontWeight: 700, color: '#475569' }}>{pair.left}</span>
                        <span style={{ color: '#cbd5e1' }}>➔</span>
                        <select
                          value={pairVal}
                          onChange={(e) => {
                            const nextItemVal = { ...itemVal, [pair.id]: e.target.value };
                            setValues({ ...values, [item.id]: nextItemVal });
                          }}
                          style={{
                            height: 32,
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            padding: '0 8px',
                            background: '#fff',
                            flex: 1,
                            maxWidth: 240,
                          }}
                        >
                          <option value="">Seçiniz...</option>
                          {rightOptions.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {(item.type === 'text-entry' || item.type === 'numeric') && (
                <div style={{ paddingLeft: 8 }}>
                  <input
                    type={item.type === 'numeric' ? 'number' : 'text'}
                    value={values[item.id] || ''}
                    onChange={(e) => setValues({ ...values, [item.id]: e.target.value })}
                    placeholder="Yanıtınızı buraya girin..."
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      height: 36,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 14,
                      padding: '0 10px',
                    }}
                  />
                </div>
              )}

              {item.type === 'fill-blank' && (
                <div style={{ paddingLeft: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, lineHeight: 2.2 }}>
                    {(item.sentence || '').split(/(___)/g).filter(Boolean).map((part, pIdx) => {
                      if (part === '___') {
                        const blankIdx = mixedBlankIndex;
                        mixedBlankIndex += 1;
                        const blankVal = itemVal[blankIdx] || '';
                        return (
                          <input
                            key={pIdx}
                            value={blankVal}
                            onChange={(e) => {
                              const nextItemVal = { ...itemVal, [blankIdx]: e.target.value };
                              setValues({ ...values, [item.id]: nextItemVal });
                            }}
                            placeholder="..."
                            style={{
                              width: 100,
                              padding: '2px 6px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 13,
                              textAlign: 'center',
                            }}
                          />
                        );
                      }
                      return <span key={pIdx}>{part}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleCheck}
          disabled={maxAttempts > 0 && attempts >= maxAttempts}
          style={previewActionButtonStyle(activity, 'primary', {
            padding: '10px 20px',
            opacity: maxAttempts > 0 && attempts >= maxAttempts ? 0.5 : 1
          })}
        >
          {settings.checkButtonText || 'Kontrol Et'}
        </button>
        <button
          onClick={handleRestart}
          style={previewActionButtonStyle(activity, 'secondary', {
            padding: '10px 20px',
          })}
        >
          Temizle
        </button>
      </div>
    </div>
  );
}
