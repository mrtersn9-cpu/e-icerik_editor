import { generateCrossword, generateMaze, generateMemoryPairs, generateSudoku, generateWordSearch } from '../../../logic/puzzleGenerators';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, PanelGrid, SelectInput, SmallButton, TextInput, ToggleRow } from '../components/CevapControls';

import {
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
                patch({ puzzleGrid: { ...grid, cells: result.grid }, puzzlePlaced: result.placed });
              } else if (puzzleType === 'wordsearch') {
                const result = generateWordSearch(questions, grid.rows, grid.cols);
                patch({ puzzleGrid: { ...grid, cells: result.grid }, puzzlePlaced: result.placed });
              } else if (puzzleType === 'sudoku') {
                const result = generateSudoku(settings.sudokuDifficulty);
                patch({ puzzleGrid: { rows: 9, cols: 9, cells: result.grid }, puzzlePlaced: [], puzzleSolution: result.solution });
              } else if (puzzleType === 'maze') {
                const result = generateMaze(grid.rows, grid.cols);
                patch({ puzzleGrid: { ...grid, cells: result.grid }, puzzlePlaced: [] });
              } else if (puzzleType === 'memory') {
                const result = generateMemoryPairs(questions);
                patch({ puzzleGrid: { rows: 4, cols: 4, cells: [] }, puzzlePlaced: result.cards });
              }
            }}
          >
            Otomatik Oluştur
          </SmallButton>
        </div>
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
                    value={q.question}
                    placeholder="Tanim"
                    onChange={(value) => patchQuestion(q.id, { question: value })}
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
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px minmax(0,1fr) 34px',
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
                    value={q.question}
                    placeholder="Kart A"
                    onChange={(value) => patchQuestion(q.id, { question: value })}
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
      <ErisilebilirlikCard number="10" activity={activity} onUpdate={onUpdate} />
    </PanelGrid>
  );
}
