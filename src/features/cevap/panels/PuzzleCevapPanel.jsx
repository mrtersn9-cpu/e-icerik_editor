import { generateCrossword, generateMaze, generateMemoryPairs, generateSudoku, generateWordSearch } from '../../../logic/puzzleGenerators';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, PanelGrid, SelectInput, SmallButton, TextInput, ToggleRow } from '../components/CevapControls';

import {
  CanCard,
  DenemeVeKisitlarCard,
  ErisilebilirlikCard,
  EtkinlikTuruCard,
  GeriBildirimCard,
  IpucuCard,
  PuanlamaCard,
  YanitKontrolCard,
} from './OrtakCevapKartlari';

const PUZZLE_TYPE_OPTIONS = [
  { value: 'crossword', label: 'Kare Bulmaca (Crossword)' },
  { value: 'wordsearch', label: 'Kelime Avi (Word Search)' },
  { value: 'sudoku', label: 'Sudoku' },
  { value: 'maze', label: 'Labirent (Maze)' },
  { value: 'memory', label: 'Hafiza Kartlari (Memory)' },
];

export default function PuzzleCevapPanel({ activity, onUpdate }) {
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const puzzleType = activity.puzzleType || 'crossword';
  const questions = activity.puzzleQuestions || [];
  const grid = activity.puzzleGrid || { rows: 10, cols: 10, cells: [] };
  const settings = activity.puzzleSettings || {};

  const patchQuestion = (id, p) => {
    patch({
      puzzleQuestions: questions.map((q) => (q.id === id ? { ...q, ...p } : q)),
    });
  };

  const addQuestion = () => {
    patch({
      puzzleQuestions: [
        ...questions,
        { id: crypto.randomUUID(), question: '', answer: '', direction: 'across' },
      ],
    });
  };

  const removeQuestion = (id) => {
    patch({ puzzleQuestions: questions.filter((q) => q.id !== id) });
  };

  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Sorulari ve cevaplari girin, sistem otomatik olarak bulmaca olusturur."
      />
      <CevapCard number="2" title="Bulmaca Turu" wide>
        <Field label="Tur">
          <SelectInput
            value={puzzleType}
            onChange={(value) => patch({ puzzleType: value })}
            options={PUZZLE_TYPE_OPTIONS}
          />
        </Field>
      </CevapCard>
      <CevapCard number="3" title={`Soru ve Cevaplar (${questions.length})`} wide>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <SmallButton
            variant="primary"
            onClick={() => {
              if (puzzleType === 'crossword') {
                const result = generateCrossword(questions, grid.rows, grid.cols);
                patch({ 
                  puzzleGrid: { ...grid, cells: result.grid }, 
                  puzzlePlaced: result.placed,
                  puzzleUnplaced: result.unplaced || [],
                  puzzleBudgetExceeded: !!result.budgetExceeded
                });
              } else if (puzzleType === 'wordsearch') {
                const result = generateWordSearch(questions, grid.rows, grid.cols);
                patch({ 
                  puzzleGrid: { ...grid, cells: result.grid }, 
                  puzzlePlaced: result.placed,
                  puzzleUnplaced: result.unplaced || [],
                  puzzleBudgetExceeded: !!result.budgetExceeded
                });
              } else if (puzzleType === 'sudoku') {
                const result = generateSudoku(settings.sudokuDifficulty);
                patch({ puzzleGrid: { rows: 9, cols: 9, cells: result.grid }, puzzlePlaced: [], puzzleSolution: result.solution, puzzleUnplaced: [], puzzleBudgetExceeded: false });
              } else if (puzzleType === 'maze') {
                const result = generateMaze(grid.rows, grid.cols);
                patch({ puzzleGrid: { ...grid, cells: result.grid }, puzzlePlaced: [], puzzleUnplaced: [], puzzleBudgetExceeded: false });
              } else if (puzzleType === 'memory') {
                const result = generateMemoryPairs(questions);
                patch({ puzzleGrid: { rows: 4, cols: 4, cells: [] }, puzzlePlaced: result.cards, puzzleUnplaced: [], puzzleBudgetExceeded: false });
              }
            }}
          >
            Otomatik Oluştur
          </SmallButton>
        </div>
        {(puzzleType === 'crossword' || puzzleType === 'wordsearch') && (activity.puzzleUnplaced?.length > 0 || activity.puzzleBudgetExceeded) && (
          <div style={{
            padding: 12,
            borderRadius: 10,
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#991b1b',
            fontSize: 12,
            marginBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️ Bulmaca Yerleşim Uyarısı</span>
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
        <div style={{ display: 'grid', gap: 8 }}>
          {puzzleType === 'crossword' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0,1fr) minmax(0,1fr) 90px 34px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 900, color: '#64748b' }}>{index + 1}</span>
                  <TextInput
                    value={q.question || q.clue || ''}
                    placeholder="Tanim"
                    onChange={(value) => patchQuestion(q.id, { question: value, clue: value })}
                  />
                  <TextInput
                    value={q.answer}
                    placeholder="Cevap"
                    onChange={(value) => patchQuestion(q.id, { answer: value })}
                  />
                  <SelectInput
                    value={q.direction || 'across'}
                    onChange={(value) => patchQuestion(q.id, { direction: value })}
                    options={[
                      { value: 'across', label: 'Yatay' },
                      { value: 'down', label: 'Dikey' },
                    ]}
                  />
                  <SmallButton variant="danger" onClick={() => removeQuestion(q.id)}>
                    Sil
                  </SmallButton>
                </div>
              ))}
            </div>
          )}
          {puzzleType === 'wordsearch' && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.4 }}>
                Kelime + isteğe bağlı ipucu. İpucu yazarsan, oyuncuya kelime yerine ipucu gösterilir
                (ipucundan kelimeyi bulur).
              </div>
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0,1fr) minmax(0,1.1fr) 34px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 900, color: '#64748b' }}>{index + 1}</span>
                  <TextInput
                    value={q.answer}
                    placeholder="Kelime"
                    onChange={(value) => patchQuestion(q.id, { answer: value })}
                  />
                  <TextInput
                    value={q.clue || q.question || ''}
                    placeholder="İpucu / tanım (isteğe bağlı)"
                    onChange={(value) => patchQuestion(q.id, { clue: value })}
                  />
                  <SmallButton variant="danger" onClick={() => removeQuestion(q.id)}>
                    Sil
                  </SmallButton>
                </div>
              ))}
            </div>
          )}
          {puzzleType === 'sudoku' && (
            <div style={{ color: '#64748b', fontSize: 12 }}>
              Sudoku otomatik olarak zorluk seviyesine gore olusturulur. Ayarlari asagidan degistirebilirsiniz.
            </div>
          )}
          {puzzleType === 'maze' && (
            <div style={{ color: '#64748b', fontSize: 12 }}>
              Labirent otomatik olarak boyuta gore olusturulur. Ayarlari asagidan degistirebilirsiniz.
            </div>
          )}
          {puzzleType === 'memory' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0,1fr) minmax(0,1fr) 34px',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 900, color: '#64748b' }}>{index + 1}</span>
                  <TextInput
                    value={q.question || q.clue || ''}
                    placeholder="Kart A"
                    onChange={(value) => patchQuestion(q.id, { question: value, clue: value })}
                  />
                  <TextInput
                    value={q.answer}
                    placeholder="Kart B"
                    onChange={(value) => patchQuestion(q.id, { answer: value })}
                  />
                  <SmallButton variant="danger" onClick={() => removeQuestion(q.id)}>
                    Sil
                  </SmallButton>
                </div>
              ))}
            </div>
          )}
          <SmallButton variant="primary" onClick={addQuestion}>
            + Soru Ekle
          </SmallButton>
        </div>
      </CevapCard>
      <CevapCard number="4" title="Izgara Ayarlari">
        <div style={{ display: 'grid', gap: 10 }}>
          {puzzleType !== 'sudoku' && (
            <>
              <Field label="Satir sayisi">
                <TextInput
                  type="number"
                  min="3"
                  max="25"
                  value={grid.rows || 10}
                  onChange={(value) => patch({ puzzleGrid: { ...grid, rows: Math.max(3, Math.min(25, Number(value) || 10)) } })}
                />
              </Field>
              <Field label="Sutun sayisi">
                <TextInput
                  type="number"
                  min="3"
                  max="25"
                  value={grid.cols || 10}
                  onChange={(value) => patch({ puzzleGrid: { ...grid, cols: Math.max(3, Math.min(25, Number(value) || 10)) } })}
                />
              </Field>
            </>
          )}
          {puzzleType === 'sudoku' && (
            <Field label="Zorluk">
              <SelectInput
                value={settings.sudokuDifficulty || 'medium'}
                onChange={(value) => patch({ puzzleSettings: { ...settings, sudokuDifficulty: value } })}
                options={[
                  { value: 'easy', label: 'Kolay' },
                  { value: 'medium', label: 'Orta' },
                  { value: 'hard', label: 'Zor' },
                ]}
              />
            </Field>
          )}
          <ToggleRow
            label="Tanimlari goster"
            checked={settings.showClues !== false}
            onChange={(checked) => patch({ puzzleSettings: { ...settings, showClues: checked } })}
          />
          <ToggleRow
            label="Numaralari goster"
            checked={settings.showNumbers !== false}
            onChange={(checked) => patch({ puzzleSettings: { ...settings, showNumbers: checked } })}
          />
          <ToggleRow
            label="Ipucu izin ver"
            checked={!!settings.allowHints}
            onChange={(checked) => patch({ puzzleSettings: { ...settings, allowHints: checked } })}
          />
        </div>
      </CevapCard>
      <GeriBildirimCard number="5" activity={activity} onUpdate={onUpdate} />
      <PuanlamaCard number="6" activity={activity} onUpdate={onUpdate} />
      <YanitKontrolCard number="7" activity={activity} onUpdate={onUpdate} />
      <IpucuCard number="8" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="9" activity={activity} onUpdate={onUpdate} />
      <CanCard number="10" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="11" activity={activity} onUpdate={onUpdate} />
    </PanelGrid>
  );
}
