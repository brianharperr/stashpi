// Word search engine: themed word lists + grid generation. Pure logic,
// no DOM access — app.js owns all UI/state wiring.
(function () {
  'use strict';

  const THEMES = {
    camping: ['TENT', 'COMPASS', 'CANTEEN', 'FIREWOOD', 'TRAIL', 'LANTERN',
      'BACKPACK', 'KNIFE', 'SHELTER', 'WHISTLE', 'MATCHES', 'ROPE'],
    wildlife: ['EAGLE', 'COYOTE', 'RACCOON', 'BEAVER', 'SQUIRREL', 'DEER',
      'HAWK', 'OWL', 'FOX', 'BADGER', 'OTTER', 'WOLF'],
    kitchen: ['SKILLET', 'LADLE', 'CANNING', 'MASON', 'KETTLE', 'WHISK',
      'CUTTING', 'PANTRY', 'SIMMER', 'PRESERVE', 'SPATULA', 'OVEN'],
  };

  const DIRECTIONS = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randLetter() {
    return String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }

  function cellsFor(word, startR, startC, dr, dc) {
    const cells = [];
    for (let k = 0; k < word.length; k++) {
      cells.push([startR + dr * k, startC + dc * k]);
    }
    return cells;
  }

  function inBounds(r, c, size) {
    return r >= 0 && r < size && c >= 0 && c < size;
  }

  function canPlace(grid, word, cells) {
    for (let k = 0; k < cells.length; k++) {
      const [r, c] = cells[k];
      const existing = grid[r][c];
      if (existing !== null && existing !== word[k]) return false;
    }
    return true;
  }

  function tryPlaceWord(grid, word, size, maxAttempts) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const [dr, dc] = dir;
      const endR = dr * (word.length - 1);
      const endC = dc * (word.length - 1);
      const minR = Math.max(0, -endR);
      const maxR = Math.min(size - 1, size - 1 - endR);
      const minC = Math.max(0, -endC);
      const maxC = Math.min(size - 1, size - 1 - endC);
      if (minR > maxR || minC > maxC) continue;
      const startR = minR + Math.floor(Math.random() * (maxR - minR + 1));
      const startC = minC + Math.floor(Math.random() * (maxC - minC + 1));
      const cells = cellsFor(word, startR, startC, dr, dc);
      if (!cells.every(([r, c]) => inBounds(r, c, size))) continue;
      if (!canPlace(grid, word, cells)) continue;
      cells.forEach(([r, c], k) => { grid[r][c] = word[k]; });
      return cells;
    }
    return null;
  }

  function generate(themeKey, size) {
    const words = shuffled(THEMES[themeKey] || THEMES.camping)
      .sort((a, b) => b.length - a.length);
    const grid = Array.from({ length: size }, () => new Array(size).fill(null));
    const placements = [];

    for (const word of words) {
      const cells = tryPlaceWord(grid, word, size, 300);
      if (cells) placements.push({ word, cells });
      // words that can't be placed (shouldn't normally happen at these
      // sizes) are simply skipped rather than failing the whole puzzle.
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) grid[r][c] = randLetter();
      }
    }

    return { size, grid, placements };
  }

  window.WordSearch = { THEMES, generate };
})();
