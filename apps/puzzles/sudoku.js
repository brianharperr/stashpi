// Sudoku engine: generation (with uniqueness-checked digging) and solving.
// Pure logic, no DOM access — app.js owns all UI/state wiring.
(function () {
  'use strict';

  const SIZE = 9;
  const BOX = 3;

  function idx(row, col) { return row * SIZE + col; }
  function rowOf(i) { return Math.floor(i / SIZE); }
  function colOf(i) { return i % SIZE; }
  function boxOf(i) {
    const r = rowOf(i), c = colOf(i);
    return Math.floor(r / BOX) * BOX + Math.floor(c / BOX);
  }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Returns true if `value` can legally sit at `i` in `grid` (0 = empty).
  function isValidPlacement(grid, i, value) {
    if (!value) return true;
    const row = rowOf(i), col = colOf(i), box = boxOf(i);
    for (let k = 0; k < SIZE; k++) {
      const rIdx = idx(row, k);
      if (rIdx !== i && grid[rIdx] === value) return false;
      const cIdx = idx(k, col);
      if (cIdx !== i && grid[cIdx] === value) return false;
    }
    const boxRow = Math.floor(row / BOX) * BOX;
    const boxCol = Math.floor(col / BOX) * BOX;
    for (let r = 0; r < BOX; r++) {
      for (let c = 0; c < BOX; c++) {
        const bIdx = idx(boxRow + r, boxCol + c);
        if (bIdx !== i && grid[bIdx] === value) return false;
      }
    }
    return true;
  }

  function candidates(grid, i) {
    if (grid[i] !== 0) return [];
    const out = [];
    for (let v = 1; v <= 9; v++) {
      if (isValidPlacement(grid, i, v)) out.push(v);
    }
    return out;
  }

  // Backtracking solve/count with MRV (fewest-candidates-first) for speed.
  // Stops as soon as `limit` solutions have been found.
  function countSolutions(grid, limit) {
    const g = grid.slice();
    let count = 0;

    function step() {
      if (count >= limit) return;
      let best = -1, bestCands = null;
      for (let i = 0; i < 81; i++) {
        if (g[i] !== 0) continue;
        const cands = candidates(g, i);
        if (cands.length === 0) return; // dead end
        if (!bestCands || cands.length < bestCands.length) {
          best = i; bestCands = cands;
          if (cands.length === 1) break;
        }
      }
      if (best === -1) { count++; return; } // filled, valid solution
      for (const v of bestCands) {
        if (count >= limit) return;
        g[best] = v;
        step();
        g[best] = 0;
      }
    }
    step();
    return count;
  }

  function solveOne(grid) {
    const g = grid.slice();
    function step() {
      let best = -1, bestCands = null;
      for (let i = 0; i < 81; i++) {
        if (g[i] !== 0) continue;
        const cands = candidates(g, i);
        if (cands.length === 0) return false;
        if (!bestCands || cands.length < bestCands.length) {
          best = i; bestCands = cands;
          if (cands.length === 1) break;
        }
      }
      if (best === -1) return true;
      for (const v of shuffled(bestCands)) {
        g[best] = v;
        if (step()) return true;
        g[best] = 0;
      }
      return false;
    }
    return step() ? g : null;
  }

  // A freshly (randomly) filled, fully solved grid.
  function generateSolved() {
    return solveOne(new Array(81).fill(0));
  }

  const DIFFICULTY_CLUES = { easy: 42, medium: 32, hard: 26 };

  // Removes cells from a solved grid one at a time, in random order, keeping
  // a removal only if the puzzle still has exactly one solution — stops once
  // the clue-count target is hit or no more cells can be safely removed.
  function digHoles(solution, targetClues) {
    const puzzle = solution.slice();
    let clues = 81;
    const order = shuffled([...Array(81).keys()]);
    for (const i of order) {
      if (clues <= targetClues) break;
      if (puzzle[i] === 0) continue;
      const saved = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clues--;
      } else {
        puzzle[i] = saved;
      }
    }
    return puzzle;
  }

  function generatePuzzle(difficulty) {
    const target = DIFFICULTY_CLUES[difficulty] || DIFFICULTY_CLUES.medium;
    const solution = generateSolved();
    const puzzle = digHoles(solution, target);
    return { puzzle, solution };
  }

  window.Sudoku = {
    SIZE,
    idx, rowOf, colOf, boxOf,
    isValidPlacement,
    countSolutions,
    generatePuzzle,
  };
})();
