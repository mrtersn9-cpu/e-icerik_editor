function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ letter: null, number: null, isBlock: false }))
  );
}

function canPlaceWord(grid, word, row, col, direction) {
  const rows = grid.length;
  const cols = grid[0].length;
  const len = word.length;

  if (direction === 'across') {
    if (col + len > cols) return false;
    if (col > 0 && grid[row][col - 1].letter) return false;
    if (col + len < cols && grid[row][col + len].letter) return false;
  } else {
    if (row + len > rows) return false;
    if (row > 0 && grid[row - 1][col].letter) return false;
    if (row + len < rows && grid[row + len][col].letter) return false;
  }

  let intersections = 0;
  for (let i = 0; i < len; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    const cell = grid[r][c];

    if (cell.isBlock) return false;
    if (cell.letter) {
      if (cell.letter !== word[i]) return false;
      intersections++;
    }
    const adjacentBefore = direction === 'across'
      ? (r > 0 ? grid[r - 1][c].letter : null)
      : (c > 0 ? grid[r][c - 1].letter : null);
    const adjacentAfter = direction === 'across'
      ? (r < rows - 1 ? grid[r + 1][c].letter : null)
      : (c < cols - 1 ? grid[r][c + 1].letter : null);
    if (intersections === 0) {
      if (adjacentBefore || adjacentAfter) return false;
    }
  }

  return intersections > 0 || true;
}

function placeWord(grid, word, row, col, direction, number) {
  for (let i = 0; i < word.length; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    if (!grid[r][c].letter) {
      grid[r][c].letter = word[i];
    }
    if (i === 0) {
      grid[r][c].number = grid[r][c].number || number;
    }
  }
}

function unplaceWord(grid, word, row, col, direction) {
  for (let i = 0; i < word.length; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    const isPartOfOtherWord = checkIfPartOfOtherWord(grid, r, c, direction);
    if (!isPartOfOtherWord) {
      grid[r][c].letter = null;
    }
    if (i === 0) {
      const stillHasOtherWord = checkIfStartOfOtherWord(grid, r, c, direction);
      if (!stillHasOtherWord) {
        grid[r][c].number = null;
      }
    }
  }
}

function checkIfPartOfOtherWord(grid, row, col, excludeDirection) {
  const rows = grid.length;
  const cols = grid[0].length;
  if (excludeDirection !== 'across') {
    const left = col > 0 && grid[row][col - 1].letter;
    const right = col < cols - 1 && grid[row][col + 1].letter;
    if (left || right) return true;
  }
  if (excludeDirection !== 'down') {
    const up = row > 0 && grid[row - 1][col].letter;
    const down = row < rows - 1 && grid[row + 1][col].letter;
    if (up || down) return true;
  }
  return false;
}

function checkIfStartOfOtherWord(grid, row, col, excludeDirection) {
  const rows = grid.length;
  const cols = grid[0].length;
  if (excludeDirection !== 'across' && grid[row][col].letter) {
    const left = col === 0 || !grid[row][col - 1].letter;
    const right = col < cols - 1 && grid[row][col + 1].letter;
    if (left && right) return true;
  }
  if (excludeDirection !== 'down' && grid[row][col].letter) {
    const up = row === 0 || !grid[row - 1][col].letter;
    const down = row < rows - 1 && grid[row + 1][col].letter;
    if (up && down) return true;
  }
  return false;
}

function tryPlaceWords(grid, words, index, placed) {
  if (index >= words.length) return true;

  const word = words[index];
  const directions = [word.direction || 'across'];
  if (!word.direction) directions.push('down');

  for (const direction of directions) {
    const rows = grid.length;
    const cols = grid[0].length;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (canPlaceWord(grid, word.answer, row, col, direction)) {
          const number = placed.length + 1;
          placeWord(grid, word.answer, row, col, direction, number);
          placed.push({ ...word, direction, startRow: row, startCol: col, number });

          if (tryPlaceWords(grid, words, index + 1, placed)) return true;

          placed.pop();
          unplaceWord(grid, word.answer, row, col, direction);
        }
      }
    }
  }

  return false;
}

export function generateCrossword(questions, rows, cols) {
  const cleanQuestions = questions
    .filter((q) => q.answer && q.answer.trim())
    .map((q) => ({ ...q, answer: q.answer.trim().toUpperCase().replace(/\s/g, '') }))
    .sort((a, b) => b.answer.length - a.answer.length);

  if (!cleanQuestions.length) return { grid: createEmptyGrid(rows, cols), placed: [] };

  let bestGrid = null;
  let bestPlaced = null;
  let bestScore = -1;

  const attempts = 20;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const shuffled = attempt > 0
      ? [...cleanQuestions].sort(() => Math.random() - 0.5)
      : [...cleanQuestions];
    const grid = createEmptyGrid(rows, cols);
    const placed = [];

    const first = shuffled[0];
    const startRow = Math.floor((rows - first.answer.length) / 2);
    const startCol = Math.floor((cols - first.answer.length) / 2);
    const firstDir = first.direction || 'across';
    placeWord(grid, first.answer, startRow, startCol, firstDir, 1);
    placed.push({ ...first, direction: firstDir, startRow, startCol, number: 1 });

    const remaining = shuffled.slice(1);
    tryPlaceWords(grid, remaining, 0, placed);

    const score = placed.length + placed.reduce((sum, p) => sum + p.answer.length, 0);
    if (score > bestScore) {
      bestScore = score;
      bestGrid = grid;
      bestPlaced = placed;
    }
    if (placed.length === cleanQuestions.length) break;
  }

  return { grid: bestGrid || createEmptyGrid(rows, cols), placed: bestPlaced || [] };
}

export function generateWordSearch(words, rows, cols) {
  const cleanWords = words
    .filter((w) => w.answer && w.answer.trim())
    .map((w) => ({ ...w, answer: w.answer.trim().toUpperCase().replace(/\s/g, '') }));

  const grid = createEmptyGrid(rows, cols);
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: -1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: -1, dc: -1 },
    { dr: 1, dc: -1 },
    { dr: -1, dc: 1 },
  ];

  const placed = [];
  for (const word of cleanWords) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const maxRow = dir.dr > 0 ? rows - word.answer.length : dir.dr < 0 ? word.answer.length - 1 : rows - 1;
      const minRow = dir.dr < 0 ? word.answer.length - 1 : 0;
      const maxCol = dir.dc > 0 ? cols - word.answer.length : dir.dc < 0 ? word.answer.length - 1 : cols - 1;
      const minCol = dir.dc < 0 ? word.answer.length - 1 : 0;
      const row = Math.floor(Math.random() * (maxRow - minRow + 1)) + minRow;
      const col = Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol;

      let canPlace = true;
      for (let i = 0; i < word.answer.length; i++) {
        const r = row + dir.dr * i;
        const c = col + dir.dc * i;
        if (grid[r][c].letter && grid[r][c].letter !== word.answer[i]) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        for (let i = 0; i < word.answer.length; i++) {
          const r = row + dir.dr * i;
          const c = col + dir.dc * i;
          grid[r][c].letter = word.answer[i];
          grid[r][c].isWordSearch = true;
        }
        placed.push({ ...word, startRow: row, startCol: col, direction: `${dir.dr},${dir.dc}` });
        break;
      }
    }
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].letter) {
        grid[r][c].letter = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }

  return { grid, placed };
}

function isValidSudoku(grid, row, col, num) {
  for (let c = 0; c < 9; c++) if (grid[row][c] === num) return false;
  for (let r = 0; r < 9; r++) if (grid[r][col] === num) return false;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function solveSudoku(grid, row = 0, col = 0) {
  if (row === 9) return true;
  if (col === 9) return solveSudoku(grid, row + 1, 0);
  if (grid[row][col] !== 0) return solveSudoku(grid, row, col + 1);

  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  for (const num of nums) {
    if (isValidSudoku(grid, row, col, num)) {
      grid[row][col] = num;
      if (solveSudoku(grid, row, col + 1)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

export function generateSudoku(difficulty = 'medium') {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(grid);

  const fullGrid = grid.map((row) => [...row]);

  const removeCounts = { easy: 30, medium: 45, hard: 55 };
  const toRemove = removeCounts[difficulty] || 45;
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      cells.push({ r, c });
    }
  }
  cells.sort(() => Math.random() - 0.5);

  for (let i = 0; i < toRemove && i < cells.length; i++) {
    grid[cells[i].r][cells[i].c] = 0;
  }

  const result = createEmptyGrid(9, 9);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      result[r][c].letter = grid[r][c] || null;
      result[r][c].isFixed = grid[r][c] !== 0;
    }
  }

  return { grid: result, solution: fullGrid };
}

export function generateMaze(rows, cols) {
  const result = createEmptyGrid(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[r][c].isBlock = true;
    }
  }

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [{ r: 1, c: 1 }];
  visited[1][1] = true;
  result[1][1].isBlock = false;

  const dirs = [
    { r: -2, c: 0 },
    { r: 2, c: 0 },
    { r: 0, c: -2 },
    { r: 0, c: 2 },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [];
    for (const d of dirs) {
      const nr = current.r + d.r;
      const nc = current.c + d.c;
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && !visited[nr][nc]) {
        neighbors.push({ r: nr, c: nc, wr: current.r + d.r / 2, wc: current.c + d.c / 2 });
      }
    }

    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      result[next.wr][next.wc].isBlock = false;
      result[next.r][next.c].isBlock = false;
      visited[next.r][next.c] = true;
      stack.push({ r: next.r, c: next.c });
    } else {
      stack.pop();
    }
  }

  result[1][1].isStart = true;
  result[rows - 2][cols - 2].isEnd = true;

  return { grid: result };
}

export function generateMemoryPairs(pairs) {
  const cleanPairs = pairs
    .filter((p) => p.question && p.answer)
    .map((p) => ({ id: p.id, question: p.question.trim(), answer: p.answer.trim() }));

  const cards = [];
  cleanPairs.forEach((p) => {
    cards.push({ id: p.id + '_a', pairId: p.id, text: p.question });
    cards.push({ id: p.id + '_b', pairId: p.id, text: p.answer });
  });

  return { cards: cards.sort(() => Math.random() - 0.5) };
}
