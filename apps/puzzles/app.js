(function () {
  'use strict';

  // ---------- Tab switching ----------
  const modeTabs = document.querySelectorAll('.modeTab');
  const sudokuPane = document.getElementById('sudokuPane');
  const wsPane = document.getElementById('wordsearchPane');

  modeTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      sudokuPane.classList.toggle('hidden', mode !== 'sudoku');
      wsPane.classList.toggle('hidden', mode !== 'wordsearch');
    });
  });

  // =========================================================
  // Sudoku
  // =========================================================
  (function sudokuController() {
    const gridEl = document.getElementById('sudokuGrid');
    const statusEl = document.getElementById('sudokuStatus');
    const difficultySel = document.getElementById('sudokuDifficulty');
    const digitPad = document.getElementById('digitPad');

    let puzzle = [];
    let solution = [];
    let given = [];
    let values = [];
    let notes = [];
    let selected = -1;
    let notesMode = false;
    let solved = false;

    const cellEls = [];

    function buildGridDom() {
      gridEl.innerHTML = '';
      for (let i = 0; i < 81; i++) {
        const r = Sudoku.rowOf(i), c = Sudoku.colOf(i);
        const cell = document.createElement('div');
        cell.className = 'sudokuCell';
        if (c === 2 || c === 5) cell.classList.add('boxRight');
        if (r === 2 || r === 5) cell.classList.add('boxBottom');
        cell.dataset.index = String(i);
        cell.addEventListener('click', () => selectCell(i));
        gridEl.appendChild(cell);
        cellEls[i] = cell;
      }
    }

    function buildDigitPad() {
      digitPad.innerHTML = '';
      for (let d = 1; d <= 9; d++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = String(d);
        b.addEventListener('click', () => inputDigit(d));
        digitPad.appendChild(b);
      }
      const erase = document.createElement('button');
      erase.type = 'button';
      erase.className = 'eraseBtn';
      erase.textContent = 'Erase';
      erase.addEventListener('click', () => inputDigit(0));
      digitPad.appendChild(erase);
    }

    function newGame() {
      const { puzzle: p, solution: s } = Sudoku.generatePuzzle(difficultySel.value);
      puzzle = p;
      solution = s;
      given = p.map((v) => v !== 0);
      values = p.slice();
      notes = Array.from({ length: 81 }, () => new Set());
      selected = -1;
      solved = false;
      setStatus('');
      render();
    }

    function resetGame() {
      values = puzzle.slice();
      notes = Array.from({ length: 81 }, () => new Set());
      solved = false;
      setStatus('');
      render();
    }

    function selectCell(i) {
      if (solved) return;
      selected = i;
      render();
    }

    function inputDigit(d) {
      if (solved || selected === -1 || given[selected]) return;
      if (notesMode && d !== 0) {
        const set = notes[selected];
        if (set.has(d)) set.delete(d); else set.add(d);
      } else {
        values[selected] = d;
        notes[selected].clear();
      }
      render();
    }

    document.addEventListener('keydown', (e) => {
      if (sudokuPane.classList.contains('hidden')) return;
      if (selected === -1) return;
      if (e.key >= '1' && e.key <= '9') { inputDigit(Number(e.key)); return; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { inputDigit(0); return; }
      const r = Sudoku.rowOf(selected), c = Sudoku.colOf(selected);
      if (e.key === 'ArrowUp' && r > 0) selectCell(Sudoku.idx(r - 1, c));
      else if (e.key === 'ArrowDown' && r < 8) selectCell(Sudoku.idx(r + 1, c));
      else if (e.key === 'ArrowLeft' && c > 0) selectCell(Sudoku.idx(r, c - 1));
      else if (e.key === 'ArrowRight' && c < 8) selectCell(Sudoku.idx(r, c + 1));
    });

    document.getElementById('sudokuNotesBtn').addEventListener('click', (e) => {
      notesMode = !notesMode;
      e.target.textContent = notesMode ? 'Notes: On' : 'Notes: Off';
      e.target.setAttribute('aria-pressed', String(notesMode));
    });
    document.getElementById('sudokuNewBtn').addEventListener('click', newGame);
    document.getElementById('sudokuResetBtn').addEventListener('click', resetGame);
    document.getElementById('sudokuCheckBtn').addEventListener('click', checkGame);
    document.getElementById('sudokuSolveBtn').addEventListener('click', () => {
      values = solution.slice();
      solved = true;
      setStatus('Solved for you.', 'good');
      render();
    });

    function checkGame() {
      let wrongCount = 0;
      let filledCount = 0;
      for (let i = 0; i < 81; i++) {
        if (values[i] === 0) continue;
        filledCount++;
        if (values[i] !== solution[i]) wrongCount++;
      }
      render(wrongCount > 0 ? new Set(
        [...Array(81).keys()].filter((i) => values[i] !== 0 && values[i] !== solution[i])
      ) : null);
      if (wrongCount > 0) {
        setStatus(`${wrongCount} cell${wrongCount === 1 ? '' : 's'} incorrect.`, 'bad');
      } else if (filledCount === 81) {
        solved = true;
        setStatus('Solved! Nicely done.', 'good');
      } else {
        setStatus('Looks good so far.', 'good');
      }
    }

    function setStatus(msg, cls) {
      statusEl.textContent = msg;
      statusEl.className = 'status' + (cls ? ' ' + cls : '');
    }

    function render(wrongSet) {
      const r0 = selected === -1 ? -1 : Sudoku.rowOf(selected);
      const c0 = selected === -1 ? -1 : Sudoku.colOf(selected);
      const b0 = selected === -1 ? -1 : Sudoku.boxOf(selected);

      for (let i = 0; i < 81; i++) {
        const cell = cellEls[i];
        const v = values[i];
        const isGiven = given[i];
        const r = Sudoku.rowOf(i), c = Sudoku.colOf(i), b = Sudoku.boxOf(i);

        cell.classList.toggle('given', isGiven);
        cell.classList.toggle('userEntry', !isGiven && v !== 0);
        cell.classList.toggle('selected', i === selected);
        cell.classList.toggle('peer', selected !== -1 && i !== selected &&
          (r === r0 || c === c0 || b === b0));
        cell.classList.toggle('wrong', !!(wrongSet && wrongSet.has(i)));

        const conflict = v !== 0 && !Sudoku.isValidPlacement(values, i, v);
        cell.classList.toggle('conflict', conflict && !isGiven);

        if (v !== 0) {
          cell.textContent = String(v);
        } else if (notes[i] && notes[i].size > 0) {
          cell.innerHTML = '';
          const notesGrid = document.createElement('div');
          notesGrid.className = 'notesGrid';
          for (let n = 1; n <= 9; n++) {
            const span = document.createElement('span');
            span.textContent = notes[i].has(n) ? String(n) : '';
            notesGrid.appendChild(span);
          }
          cell.appendChild(notesGrid);
        } else {
          cell.textContent = '';
        }
      }
    }

    buildGridDom();
    buildDigitPad();
    newGame();
  })();

  // =========================================================
  // Word Search
  // =========================================================
  (function wordSearchController() {
    const gridEl = document.getElementById('wsGrid');
    const wordListEl = document.getElementById('wsWordList');
    const countEl = document.getElementById('wsCount');
    const themeSel = document.getElementById('wsTheme');
    const sizeSel = document.getElementById('wsSize');
    const newBtn = document.getElementById('wsNewBtn');

    let puzzle = null;
    let foundWords = new Set();
    let cellEls = [];
    let dragging = false;
    let startCell = null;

    function key(r, c) { return r + ',' + c; }

    function newPuzzle() {
      const size = Number(sizeSel.value);
      puzzle = WordSearch.generate(themeSel.value, size);
      foundWords = new Set();
      render();
    }

    function render() {
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;
      gridEl.style.gridTemplateRows = `repeat(${puzzle.size}, 1fr)`;
      cellEls = [];
      for (let r = 0; r < puzzle.size; r++) {
        const row = [];
        for (let c = 0; c < puzzle.size; c++) {
          const cell = document.createElement('div');
          cell.className = 'wsCell';
          cell.textContent = puzzle.grid[r][c];
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
          cell.addEventListener('mousedown', (e) => { e.preventDefault(); beginSelect(r, c); });
          cell.addEventListener('mouseenter', () => { if (dragging) updateSelect(r, c); });
          cell.addEventListener('touchstart', (e) => { e.preventDefault(); beginSelect(r, c); }, { passive: false });
          gridEl.appendChild(cell);
          row.push(cell);
        }
        cellEls.push(row);
      }

      wordListEl.innerHTML = '';
      puzzle.placements.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p.word;
        li.dataset.word = p.word;
        if (foundWords.has(p.word)) li.classList.add('foundWord');
        wordListEl.appendChild(li);
      });
      updateCount();
      applyFoundHighlights();
    }

    function onTouchMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el && el.classList.contains('wsCell')) {
        updateSelect(Number(el.dataset.r), Number(el.dataset.c));
      }
    }
    document.addEventListener('touchend', () => { if (dragging) endSelect(); });

    function beginSelect(r, c) {
      dragging = true;
      startCell = [r, c];
      clearSelecting();
      cellEls[r][c].classList.add('selecting');
    }

    function updateSelect(r, c) {
      if (!dragging) return;
      clearSelecting();
      lineCells(startCell[0], startCell[1], r, c).forEach(([rr, cc]) => {
        cellEls[rr][cc].classList.add('selecting');
      });
    }

    document.addEventListener('mouseup', () => { if (dragging) endSelect(); });

    function endSelect() {
      dragging = false;
      const selectedCells = [...gridEl.querySelectorAll('.selecting')].map((el) => [
        Number(el.dataset.r), Number(el.dataset.c),
      ]);
      clearSelecting();
      matchSelection(selectedCells);
    }

    function lineCells(r0, c0, r1, c1) {
      const dr = Math.sign(r1 - r0);
      const dc = Math.sign(c1 - c0);
      const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      // only accept straight horizontal/vertical/diagonal lines
      if (r1 !== r0 && c1 !== c0 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) {
        return [[r0, c0]];
      }
      const cells = [];
      for (let k = 0; k <= steps; k++) cells.push([r0 + dr * k, c0 + dc * k]);
      return cells;
    }

    function clearSelecting() {
      gridEl.querySelectorAll('.selecting').forEach((el) => el.classList.remove('selecting'));
    }

    function matchSelection(cells) {
      if (cells.length < 2) return;
      const forward = cells.map(([r, c]) => key(r, c)).join('|');
      const backward = cells.slice().reverse().map(([r, c]) => key(r, c)).join('|');
      for (const p of puzzle.placements) {
        if (foundWords.has(p.word)) continue;
        const pKey = p.cells.map(([r, c]) => key(r, c)).join('|');
        if (pKey === forward || pKey === backward) {
          foundWords.add(p.word);
          applyFoundHighlights();
          updateCount();
          const li = wordListEl.querySelector(`li[data-word="${p.word}"]`);
          if (li) li.classList.add('foundWord');
          return;
        }
      }
    }

    function applyFoundHighlights() {
      for (const p of puzzle.placements) {
        if (!foundWords.has(p.word)) continue;
        p.cells.forEach(([r, c]) => cellEls[r][c].classList.add('found'));
      }
    }

    function updateCount() {
      countEl.textContent = `${foundWords.size} / ${puzzle.placements.length} found`;
    }

    newBtn.addEventListener('click', newPuzzle);
    themeSel.addEventListener('change', newPuzzle);
    sizeSel.addEventListener('change', newPuzzle);
    gridEl.addEventListener('touchmove', onTouchMove, { passive: false });

    newPuzzle();
  })();
})();
