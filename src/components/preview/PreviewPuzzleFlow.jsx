import { useCallback, useEffect, useMemo, useState } from 'react';

function CrosswordGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = useMemo(() => grid?.cells || [], [grid?.cells]);
  const placed = activity.puzzlePlaced || [];
  const settings = activity.puzzleSettings || {};
  const rows = grid?.rows || 10;
  const cols = grid?.cols || 10;
  const [userGrid, setUserGrid] = useState({});
  const [activeCell, setActiveCell] = useState(null);
  const [direction, setDirection] = useState('across');

  const cellSize = Math.min(28, 320 / cols);
  const totalWidth = cols * cellSize;
  const totalHeight = rows * cellSize;

  useEffect(() => {
    const initial = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r]?.[c];
        if (cell?.letter) {
          initial[`${r},${c}`] = '';
        }
      }
    }
    setUserGrid(initial);
  }, [cells, rows, cols]);

  const getNextCell = (r, c, dir) => {
    if (dir === 'across') {
      if (c + 1 < cols && cells[r]?.[c + 1]?.letter) return [r, c + 1];
    } else {
      if (r + 1 < rows && cells[r + 1]?.[c]?.letter) return [r + 1, c];
    }
    return null;
  };

  const handleKeyDown = (r, c, e) => {
    const key = e.key.toUpperCase();
    if (key === 'BACKSPACE') {
      setUserGrid((prev) => {
        const next = { ...prev };
        next[`${r},${c}`] = '';
        return next;
      });
      e.preventDefault();
      return;
    }
    if (key === 'ARROWRIGHT') { setActiveCell([r, c + 1]); e.preventDefault(); return; }
    if (key === 'ARROWLEFT') { setActiveCell([r, c - 1]); e.preventDefault(); return; }
    if (key === 'ARROWUP') { setActiveCell([r - 1, c]); e.preventDefault(); return; }
    if (key === 'ARROWDOWN') { setActiveCell([r + 1, c]); e.preventDefault(); return; }
    if (key === ' ') { setDirection((d) => (d === 'across' ? 'down' : 'across')); e.preventDefault(); return; }
    if (key.length === 1 && /[A-ZÇĞİÖŞÜ]/.test(key)) {
      setUserGrid((prev) => {
        const next = { ...prev };
        next[`${r},${c}`] = key;
        return next;
      });
      const next = getNextCell(r, c, direction);
      if (next) setActiveCell(next);
      e.preventDefault();
    }
  };

  const checkAnswer = () => {
    let correct = 0;
    let total = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r]?.[c];
        if (cell?.letter) {
          total++;
          if (userGrid[`${r},${c}`] === cell.letter) correct++;
        }
      }
    }
    onAnswer?.({ success: correct === total && total > 0, correct, total });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gap: 1,
            background: '#e2e8f0',
            border: '1px solid #cbd5e1',
            width: totalWidth + cols - 1,
            height: totalHeight + rows - 1,
          }}
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const cell = cells[r]?.[c];
              const isActive = activeCell && activeCell[0] === r && activeCell[1] === c;
              const hasLetter = cell?.letter;
              return (
                <div
                  key={`${r}-${c}`}
                  tabIndex={hasLetter ? 0 : -1}
                  onClick={() => {
                    if (hasLetter) {
                      if (activeCell && activeCell[0] === r && activeCell[1] === c) {
                        setDirection((d) => (d === 'across' ? 'down' : 'across'));
                      }
                      setActiveCell([r, c]);
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(r, c, e)}
                  style={{
                    background: hasLetter ? (isActive ? '#3b82f6' : '#fff') : '#1e293b',
                    color: isActive ? '#fff' : '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: cellSize * 0.55,
                    fontWeight: 700,
                    position: 'relative',
                    cursor: hasLetter ? 'pointer' : 'default',
                    outline: isActive ? '2px solid #2563eb' : 'none',
                    outlineOffset: '-1px',
                  }}
                >
                  {cell?.number && (
                    <span style={{ position: 'absolute', top: 1, left: 2, fontSize: cellSize * 0.28, fontWeight: 600, color: '#64748b' }}>
                      {cell.number}
                    </span>
                  )}
                  {userGrid[`${r},${c}`] || ''}
                </div>
              );
            })
          )}
        </div>
        {settings.showClues !== false && (
          <div style={{ minWidth: 180, maxWidth: 260, fontSize: 12, maxHeight: totalHeight, overflow: 'auto' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Yatay</div>
            {placed.filter((p) => p.direction === 'across').map((p) => (
              <div key={p.id} style={{ marginBottom: 2, color: '#475569' }}>
                <strong>{p.number}</strong>. {p.question}
              </div>
            ))}
            <div style={{ fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Dikey</div>
            {placed.filter((p) => p.direction === 'down').map((p) => (
              <div key={p.id} style={{ marginBottom: 2, color: '#475569' }}>
                <strong>{p.number}</strong>. {p.question}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={checkAnswer} style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Kontrol Et
      </button>
    </div>
  );
}

function WordSearchGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = grid?.cells || [];
  const rows = grid?.rows || 10;
  const cols = grid?.cols || 10;
  const [selectedCells, setSelectedCells] = useState([]);
  const [foundWords, setFoundWords] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const cellSize = Math.min(28, 320 / cols);
  const placed = activity.puzzlePlaced || [];

  const handleMouseDown = (r, c) => {
    setIsDragging(true);
    setSelectedCells([[r, c]]);
  };

  const handleMouseEnter = (r, c) => {
    if (!isDragging) return;
    if (selectedCells.length === 0) return;
    const start = selectedCells[0];
    const dr = r - start[0];
    const dc = c - start[1];
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) {
      setSelectedCells([start]);
      return;
    }
    const stepR = dr / steps;
    const stepC = dc / steps;
    if (stepR !== Math.floor(stepR) || stepC !== Math.floor(stepC)) return;
    const newCells = [];
    for (let i = 0; i <= steps; i++) {
      newCells.push([start[0] + stepR * i, start[1] + stepC * i]);
    }
    setSelectedCells(newCells);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    const word = selectedCells.map(([r, c]) => cells[r]?.[c]?.letter).join('');
    const reverseWord = word.split('').reverse().join('');
    const found = placed.find((p) => !foundWords.includes(p.id) && (p.answer === word || p.answer === reverseWord));
    if (found) {
      setFoundWords((prev) => [...prev, found.id]);
    }
    setSelectedCells([]);
  };

  const isSelected = (r, c) => selectedCells.some(([sr, sc]) => sr === r && sc === c);
  const isFound = (r, c) => {
    return placed.some((p) => {
      if (!foundWords.includes(p.id)) return false;
      const [dr, dc] = p.direction.split(',').map(Number);
      for (let i = 0; i < p.answer.length; i++) {
        if (p.startRow + dr * i === r && p.startCol + dc * i === c) return true;
      }
      return false;
    });
  };

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gap: 1,
          background: '#e2e8f0',
          border: '1px solid #cbd5e1',
          width: cols * cellSize + cols - 1,
          height: rows * cellSize + rows - 1,
          userSelect: 'none',
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const sel = isSelected(r, c);
            const found = isFound(r, c);
            return (
              <div
                key={`${r}-${c}`}
                onMouseDown={() => handleMouseDown(r, c)}
                onMouseEnter={() => handleMouseEnter(r, c)}
                style={{
                  background: found ? '#22c55e' : sel ? '#3b82f6' : '#fff',
                  color: found ? '#fff' : '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cellSize * 0.55,
                  fontWeight: 700,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {cells[r]?.[c]?.letter}
              </div>
            );
          })
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
        Bulunan: {foundWords.length} / {placed.length}
      </div>
      {foundWords.length === placed.length && placed.length > 0 && (
        <div style={{ color: '#22c55e', fontWeight: 700, marginTop: 4 }}>Tum kelimeleri buldunuz!</div>
      )}
    </div>
  );
}

function SudokuGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = useMemo(() => grid?.cells || [], [grid?.cells]);
  const [userGrid, setUserGrid] = useState({});

  useEffect(() => {
    const initial = {};
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = cells[r]?.[c]?.letter;
        if (cells[r]?.[c]?.isFixed) {
          initial[`${r},${c}`] = val;
        }
      }
    }
    setUserGrid(initial);
  }, [cells]);

  const handleChange = (r, c, value) => {
    if (cells[r]?.[c]?.isFixed) return;
    const num = value === '' ? '' : Math.max(1, Math.min(9, Number(value) || ''));
    setUserGrid((prev) => ({ ...prev, [`${r},${c}`]: num }));
  };

  const checkAnswer = () => {
    const solution = activity.puzzleSolution;
    if (!solution) return;
    let correct = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (Number(userGrid[`${r},${c}`]) === solution[r][c]) correct++;
      }
    }
    onAnswer?.({ success: correct === 81, correct, total: 81 });
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 32px)', gap: 1, background: '#1e293b', padding: 2, width: 'fit-content' }}>
        {Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 9 }, (_, c) => {
            const isFixed = cells[r]?.[c]?.isFixed;
            const isThickRight = (c + 1) % 3 === 0 && c < 8;
            const isThickBottom = (r + 1) % 3 === 0 && r < 8;
            return (
              <input
                key={`${r}-${c}`}
                type="text"
                maxLength={1}
                value={userGrid[`${r},${c}`] || ''}
                readOnly={isFixed}
                onChange={(e) => handleChange(r, c, e.target.value)}
                style={{
                  width: 32,
                  height: 32,
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                  border: 'none',
                  outline: 'none',
                  background: isFixed ? '#e2e8f0' : '#fff',
                  color: isFixed ? '#1e293b' : '#2563eb',
                  marginRight: isThickRight ? 2 : 0,
                  marginBottom: isThickBottom ? 2 : 0,
                }}
              />
            );
          })
        )}
      </div>
      <button onClick={checkAnswer} style={{ marginTop: 8, padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Kontrol Et
      </button>
    </div>
  );
}

function MazeGrid({ activity, onAnswer }) {
  const grid = activity.puzzleGrid;
  const cells = useMemo(() => grid?.cells || [], [grid?.cells]);
  const rows = grid?.rows || 15;
  const cols = grid?.cols || 15;
  const [playerPos, setPlayerPos] = useState({ r: 1, c: 1 });

  const cellSize = Math.min(20, 300 / cols);

  const move = useCallback(
    (dr, dc) => {
      const nr = playerPos.r + dr;
      const nc = playerPos.c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
      if (cells[nr]?.[nc]?.isBlock) return;
      const newPos = { r: nr, c: nc };
      setPlayerPos(newPos);
      if (cells[nr]?.[nc]?.isEnd) {
        onAnswer?.({ success: true, correct: 1, total: 1 });
      }
    },
    [cells, cols, onAnswer, playerPos, rows]
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp') move(-1, 0);
      if (e.key === 'ArrowDown') move(1, 0);
      if (e.key === 'ArrowLeft') move(0, -1);
      if (e.key === 'ArrowRight') move(0, 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [move]);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gap: 0,
          background: '#1e293b',
          border: '2px solid #1e293b',
          width: cols * cellSize,
          height: rows * cellSize,
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const isBlock = cells[r]?.[c]?.isBlock;
            const isStart = cells[r]?.[c]?.isStart;
            const isEnd = cells[r]?.[c]?.isEnd;
            const isPlayer = playerPos.r === r && playerPos.c === c;
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  background: isBlock ? '#1e293b' : isPlayer ? '#3b82f6' : isStart ? '#22c55e' : isEnd ? '#ef4444' : '#fff',
                  width: cellSize,
                  height: cellSize,
                }}
              />
            );
          })
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>Ok tuslari ile hareket edin. Kirmizi kareye ulasin.</div>
    </div>
  );
}

function MemoryGrid({ activity, onAnswer }) {
  const cards = activity.puzzlePlaced || [];
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);

  const handleFlip = (index) => {
    if (flipped.length >= 2 || flipped.includes(index) || matched.includes(index)) return;
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);
    setMoves((m) => m + 1);
    if (newFlipped.length === 2) {
      const c1 = cards[newFlipped[0]];
      const c2 = cards[newFlipped[1]];
      if (c1.pairId === c2.pairId && newFlipped[0] !== newFlipped[1]) {
        setTimeout(() => {
          setMatched((prev) => [...prev, ...newFlipped]);
          setFlipped([]);
        }, 600);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  useEffect(() => {
    if (matched.length === cards.length && cards.length > 0) {
      onAnswer?.({ success: true, correct: cards.length / 2, total: cards.length / 2, moves });
    }
  }, [cards.length, matched.length, moves, onAnswer]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 72px)', gap: 8 }}>
        {cards.map((card, index) => {
          const isFlipped = flipped.includes(index);
          const isMatched = matched.includes(index);
          return (
            <div
              key={card.id}
              onClick={() => handleFlip(index)}
              style={{
                width: 72,
                height: 72,
                background: isMatched ? '#22c55e' : isFlipped ? '#3b82f6' : '#64748b',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 8,
                cursor: isMatched ? 'default' : 'pointer',
                textAlign: 'center',
                padding: 4,
                transition: 'background 0.3s',
              }}
            >
              {isFlipped || isMatched ? card.text : '?'}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>Hamle: {moves}</div>
    </div>
  );
}

export default function PreviewPuzzleFlow({ activity, onAnswer }) {
  const puzzleType = activity.puzzleType || 'crossword';

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>
        {puzzleType === 'crossword' && 'Kare Bulmaca'}
        {puzzleType === 'wordsearch' && 'Kelime Avi'}
        {puzzleType === 'sudoku' && 'Sudoku'}
        {puzzleType === 'maze' && 'Labirent'}
        {puzzleType === 'memory' && 'Hafiza Kartlari'}
      </div>
      {puzzleType === 'crossword' && <CrosswordGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'wordsearch' && <WordSearchGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'sudoku' && <SudokuGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'maze' && <MazeGrid activity={activity} onAnswer={onAnswer} />}
      {puzzleType === 'memory' && <MemoryGrid activity={activity} onAnswer={onAnswer} />}
    </div>
  );
}
