import { Inp } from '../../components/ui';
import { generateCrossword, generateMaze, generateMemoryPairs, generateSudoku, generateWordSearch } from '../../logic/puzzleGenerators';
import { uid } from '../../utils/editorHelpers';

export default function PuzzleEditor({ activity, onUpdate }) {
  const patch = (p) => onUpdate({ ...activity, ...p });
  const questions = activity.puzzleQuestions || [];
  const settings = activity.puzzleSettings || {};
  const grid = activity.puzzleGrid || { rows: 10, cols: 10, cells: [] };
  const puzzleType = activity.puzzleType || 'crossword';

  const card = {
    background: 'var(--eic-light-panel)',
    border: '1px solid var(--eic-light-border-soft)',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  };

  const addQuestion = () => {
    patch({
      puzzleQuestions: [
        ...questions,
        { id: uid(), question: '', clue: '', answer: '', direction: 'across', row: 0, col: 0 },
      ],
    });
  };

  const updateQuestion = (idx, field, value) => {
    const next = [...questions];
    if (field === 'question' || field === 'clue') {
      next[idx] = { ...next[idx], question: value, clue: value };
    } else {
      next[idx] = { ...next[idx], [field]: value };
    }
    patch({ puzzleQuestions: next });
  };

  const removeQuestion = (idx) => {
    patch({ puzzleQuestions: questions.filter((_, i) => i !== idx) });
  };

  const compileLayout = () => {
    const qList = questions.map((q) => ({
      id: q.id || uid(),
      question: q.question || q.clue || '',
      clue: q.question || q.clue || '',
      answer: q.answer || '',
      direction: q.direction || 'across',
      row: q.row ?? 0,
      col: q.col ?? 0
    }));

    let updateData = {};
    if (puzzleType === 'crossword') {
      const result = generateCrossword(qList, grid.rows, grid.cols);
      updateData = { 
        puzzleGrid: { ...grid, cells: result.grid }, 
        puzzlePlaced: result.placed,
        puzzleUnplaced: result.unplaced || [],
        puzzleBudgetExceeded: !!result.budgetExceeded
      };
    } else if (puzzleType === 'wordsearch') {
      const result = generateWordSearch(qList, grid.rows, grid.cols);
      updateData = { 
        puzzleGrid: { ...grid, cells: result.grid }, 
        puzzlePlaced: result.placed,
        puzzleUnplaced: result.unplaced || [],
        puzzleBudgetExceeded: !!result.budgetExceeded
      };
    } else if (puzzleType === 'sudoku') {
      const result = generateSudoku(settings.sudokuDifficulty || 'medium');
      updateData = { puzzleGrid: { rows: 9, cols: 9, cells: result.grid }, puzzlePlaced: [], puzzleSolution: result.solution, puzzleUnplaced: [], puzzleBudgetExceeded: false };
    } else if (puzzleType === 'maze') {
      const result = generateMaze(grid.rows, grid.cols);
      updateData = { puzzleGrid: { ...grid, cells: result.grid }, puzzlePlaced: [], puzzleUnplaced: [], puzzleBudgetExceeded: false };
    } else if (puzzleType === 'memory') {
      const result = generateMemoryPairs(qList);
      updateData = { puzzleGrid: { rows: 4, cols: 4, cells: [] }, puzzlePlaced: result.cards, puzzleUnplaced: [], puzzleBudgetExceeded: false };
    }

    patch({
      puzzleQuestions: qList,
      ...updateData
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(puzzleType === 'crossword' || puzzleType === 'wordsearch') && (activity.puzzleUnplaced?.length > 0 || activity.puzzleBudgetExceeded) && (
        <div style={{
          padding: 12,
          borderRadius: 10,
          background: '#fef2f2',
          border: '1px solid #fee2e2',
          color: '#991b1b',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Bulmaca Yerleşim Uyarısı</span>
          </div>
          {activity.puzzleBudgetExceeded && (
            <div>Bulmaca oluşturma zaman sınırı (1000ms) aşıldı! Bazı kelimeler yerleştirilemedi.</div>
          )}
          {activity.puzzleUnplaced && activity.puzzleUnplaced.length > 0 && (
            <div>
              Izgaraya yerleşemeyen kelimeler ({activity.puzzleUnplaced.length}):{' '}
              <span style={{ fontWeight: 800 }}>
                {activity.puzzleUnplaced.map((q) => q.answer).join(', ')}
              </span>
              <div style={{ marginTop: 4, fontSize: 11, color: '#7f1d1d' }}>
                * Lütfen bu kelimeleri düzeltin, kaldırın veya daha büyük satır/sütun sayısı seçerek yerleşimi yeniden oluşturun.
                <br />
                * Yerleşemeyen kelime bulunurken <strong>Önizleme ve SCORM Paketi oluşturulamaz!</strong>
              </div>
            </div>
          )}
        </div>
      )}

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
          Bulmaca Ayarları
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>Tür</label>
              <select
                value={puzzleType}
                onChange={(e) => patch({ puzzleType: e.target.value })}
                style={{
                  width: '100%',
                  height: 32,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 12,
                  padding: '0 8px',
                  marginTop: 4,
                }}
              >
                <option value="crossword">Kare Bulmaca</option>
                <option value="wordsearch">Kelime Avı</option>
                <option value="sudoku">Sudoku</option>
                <option value="memory">Hafıza Kartı</option>
                <option value="maze">Labirent</option>
              </select>
            </div>
            {puzzleType !== 'sudoku' && (
              <>
                <Inp
                  label="Satır Sayısı"
                  type="number"
                  min={3}
                  max={30}
                  value={grid.rows || 10}
                  onChange={(e) =>
                    patch({ puzzleGrid: { ...grid, rows: Math.max(3, +e.target.value || 10) } })
                  }
                />
                <Inp
                  label="Sütun Sayısı"
                  type="number"
                  min={3}
                  max={30}
                  value={grid.cols || 10}
                  onChange={(e) =>
                    patch({ puzzleGrid: { ...grid, cols: Math.max(3, +e.target.value || 10) } })
                  }
                />
              </>
            )}
            {puzzleType === 'sudoku' && (
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>Zorluk</label>
                <select
                  value={settings.sudokuDifficulty || 'medium'}
                  onChange={(e) => patch({ puzzleSettings: { ...settings, sudokuDifficulty: e.target.value } })}
                  style={{
                    width: '100%',
                    height: 32,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 12,
                    padding: '0 8px',
                    marginTop: 4,
                  }}
                >
                  <option value="easy">Kolay</option>
                  <option value="medium">Orta</option>
                  <option value="hard">Zor</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.showClues !== false}
                onChange={(e) => patch({ puzzleSettings: { ...settings, showClues: e.target.checked } })}
                style={{ accentColor: '#7c3aed' }}
              />
              İpuçlarını göster
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.showNumbers !== false}
                onChange={(e) => patch({ puzzleSettings: { ...settings, showNumbers: e.target.checked } })}
                style={{ accentColor: '#7c3aed' }}
              />
              Numaraları göster
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!settings.allowHints}
                onChange={(e) => patch({ puzzleSettings: { ...settings, allowHints: e.target.checked } })}
                style={{ accentColor: '#7c3aed' }}
              />
              İpucu hakkı ver
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={compileLayout}
              style={{
                flex: 1,
                minHeight: 32,
                padding: '0 12px',
                borderRadius: 8,
                border: 'none',
                background: '#7c3aed',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Yerleşimi Oluştur / Güncelle
            </button>
          </div>
        </div>
      </div>

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
          Sorular ({questions.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <Inp
                  label={`Soru ${idx + 1} — İpucu`}
                  value={q.question || q.clue || ''}
                  onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
                  placeholder="Bulmaca ipucu..."
                  style={{ flex: 1 }}
                />
                <button
                  onClick={() => removeQuestion(idx)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                  title="Sil"
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Inp
                  label="Cevap"
                  value={q.answer || ''}
                  onChange={(e) => updateQuestion(idx, 'answer', e.target.value.toUpperCase())}
                  placeholder="CEVAP"
                />
                {puzzleType === 'crossword' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>Yön</label>
                    <select
                      value={q.direction || 'across'}
                      onChange={(e) => updateQuestion(idx, 'direction', e.target.value)}
                      style={{
                        width: '100%',
                        height: 32,
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        fontSize: 12,
                        padding: '0 8px',
                        marginTop: 4,
                      }}
                    >
                      <option value="across">Yatay</option>
                      <option value="down">Dikey</option>
                    </select>
                  </div>
                )}
                {/* Otomatik yerleşim modunda koordinatlar salt okunur olarak konum bilgisi verir */}
                {(q.startRow !== undefined || q.startCol !== undefined) && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
                    <span>Konum: {q.startRow},{q.startCol}</span>
                    {q.number && <span style={{ fontWeight: 800 }}>({q.number})</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={addQuestion}
            style={{
              minHeight: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #c4b5fd',
              background: '#ffffff',
              color: '#7c3aed',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Soru Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
