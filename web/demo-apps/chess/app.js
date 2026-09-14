import { Chess } from './vendor/chess.js';

const PIECE_GLYPHS = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE_SCORE = 1000000;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const moveListEl = document.getElementById('moveList');
const modeSelect = document.getElementById('modeSelect');
const sideSelect = document.getElementById('sideSelect');
const difficultySelect = document.getElementById('difficultySelect');
const sideRow = document.getElementById('sideRow');
const difficultyRow = document.getElementById('difficultyRow');
const newGameBtn = document.getElementById('newGameBtn');
const undoBtn = document.getElementById('undoBtn');
const promoOverlay = document.getElementById('promoOverlay');
const promoChoices = document.getElementById('promoChoices');

let game = new Chess();
let mode = 'ai';
let humanColor = 'w';
let boardFlipped = false;
let selected = null;
let legalTargets = [];
let lastMove = null;
let aiThinking = false;

function fileRankToSquare(file, rank) {
  return 'abcdefgh'[file] + (8 - rank);
}

function squareIsDisplayedAt(row, col) {
  // row/col are 0..7 as laid out on screen (row 0 = top).
  if (!boardFlipped) {
    return fileRankToSquare(col, row);
  }
  return fileRankToSquare(7 - col, 7 - row);
}

function pieceAt(square) {
  const board = game.board();
  const file = 'abcdefgh'.indexOf(square[0]);
  const rank = 8 - parseInt(square[1], 10);
  return board[rank][file];
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = squareIsDisplayedAt(row, col);
      const isLight = (row + col) % 2 === 0;
      const sqEl = document.createElement('div');
      sqEl.className = 'sq ' + (isLight ? 'light' : 'dark');
      sqEl.dataset.square = square;

      const piece = pieceAt(square);
      if (piece) {
        sqEl.classList.add('hasPiece');
        const span = document.createElement('span');
        span.className = 'piece ' + (piece.color === 'w' ? 'white' : 'black');
        span.textContent = PIECE_GLYPHS[piece.color][piece.type];
        sqEl.appendChild(span);
      }

      if (selected === square) sqEl.classList.add('selected');
      if (legalTargets.includes(square)) sqEl.classList.add('legalTarget');
      if (lastMove && (lastMove.from === square || lastMove.to === square)) {
        sqEl.classList.add('lastMove');
      }

      sqEl.addEventListener('click', () => onSquareClick(square));
      boardEl.appendChild(sqEl);
    }
  }
}

function updateStatus() {
  statusEl.classList.remove('check', 'over');
  if (game.in_checkmate()) {
    const winner = game.turn() === 'w' ? 'Black' : 'White';
    statusEl.textContent = `Checkmate — ${winner} wins`;
    statusEl.classList.add('over');
  } else if (game.in_stalemate()) {
    statusEl.textContent = 'Stalemate — draw';
    statusEl.classList.add('over');
  } else if (game.in_draw()) {
    statusEl.textContent = 'Draw';
    statusEl.classList.add('over');
  } else {
    const turn = game.turn() === 'w' ? 'White' : 'Black';
    if (game.in_check()) {
      statusEl.textContent = `${turn} to move — check`;
      statusEl.classList.add('check');
    } else if (aiThinking) {
      statusEl.textContent = `${turn} to move — thinking…`;
    } else {
      statusEl.textContent = `${turn} to move`;
    }
  }
}

function renderMoveList() {
  moveListEl.innerHTML = '';
  const history = game.history({ verbose: true });
  for (let i = 0; i < history.length; i += 2) {
    const li = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = (i / 2 + 1) + '.';
    li.appendChild(num);
    const white = document.createElement('span');
    white.textContent = history[i].san;
    li.appendChild(white);
    if (history[i + 1]) {
      const black = document.createElement('span');
      black.textContent = history[i + 1].san;
      li.appendChild(black);
    }
    moveListEl.appendChild(li);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function render() {
  renderBoard();
  updateStatus();
  renderMoveList();
}

function isHumanTurn() {
  if (mode === 'two-player') return true;
  return game.turn() === humanColor;
}

function clearSelection() {
  selected = null;
  legalTargets = [];
}

function onSquareClick(square) {
  if (aiThinking || game.game_over() || !isHumanTurn()) return;

  if (selected && legalTargets.includes(square)) {
    tryMove(selected, square);
    return;
  }

  const piece = pieceAt(square);
  if (piece && piece.color === game.turn()) {
    selected = square;
    legalTargets = game.moves({ square, verbose: true }).map((m) => m.to);
  } else {
    clearSelection();
  }
  render();
}

function tryMove(from, to) {
  const candidates = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  clearSelection();

  if (!candidates.length) {
    render();
    return;
  }

  if (candidates.length > 1 && candidates[0].promotion) {
    showPromotionPicker(candidates[0].color, (promotion) => {
      commitMove(from, to, promotion);
    });
    return;
  }

  commitMove(from, to, candidates[0].promotion);
}

function commitMove(from, to, promotion) {
  const move = game.move({ from, to, promotion: promotion || 'q' });
  if (!move) {
    render();
    return;
  }
  lastMove = move;
  render();

  if (mode === 'ai' && !game.game_over() && game.turn() !== humanColor) {
    scheduleAiMove();
  }
}

function showPromotionPicker(color, onChoose) {
  promoChoices.innerHTML = '';
  for (const type of ['q', 'r', 'b', 'n']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = PIECE_GLYPHS[color][type];
    btn.addEventListener('click', () => {
      promoOverlay.classList.add('hidden');
      onChoose(type);
    });
    promoChoices.appendChild(btn);
  }
  promoOverlay.classList.remove('hidden');
}

function scheduleAiMove() {
  aiThinking = true;
  updateStatus();
  setTimeout(() => {
    const depth = parseInt(difficultySelect.value, 10) || 3;
    const move = findBestMove(game, depth);
    aiThinking = false;
    if (move) {
      lastMove = game.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    }
    render();
  }, 150);
}

// ---- minimax with alpha-beta pruning ----

function evaluate(chess) {
  if (chess.in_checkmate()) {
    return chess.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
  }
  if (chess.in_draw()) return 0;

  let score = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type];
      score += sq.color === 'w' ? val : -val;
    }
  }
  return score;
}

function orderedMoves(chess) {
  const moves = chess.moves({ verbose: true });
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  return moves;
}

function minimax(chess, depth, alpha, beta, maximizing) {
  if (depth === 0 || chess.game_over()) {
    return evaluate(chess);
  }
  const moves = orderedMoves(chess);
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
    chess.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function findBestMove(chess, depth) {
  const maximizing = chess.turn() === 'w';
  const moves = orderedMoves(chess);
  if (!moves.length) return null;

  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMoves = [];

  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    const score = minimax(chess, depth - 1, -Infinity, Infinity, !maximizing);
    chess.undo();

    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMoves = [m];
    } else if (score === bestScore) {
      bestMoves.push(m);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ---- controls ----

function newGame() {
  game = new Chess();
  clearSelection();
  lastMove = null;
  aiThinking = false;
  mode = modeSelect.value;
  humanColor = sideSelect.value;
  boardFlipped = mode === 'ai' && humanColor === 'b';
  sideRow.classList.toggle('hidden', mode !== 'ai');
  difficultyRow.classList.toggle('hidden', mode !== 'ai');
  render();
  if (mode === 'ai' && humanColor === 'b') {
    scheduleAiMove();
  }
}

modeSelect.addEventListener('change', newGame);
sideSelect.addEventListener('change', newGame);
newGameBtn.addEventListener('click', newGame);
undoBtn.addEventListener('click', () => {
  if (aiThinking) return;
  game.undo();
  if (mode === 'ai' && game.history().length > 0) {
    game.undo();
  }
  clearSelection();
  lastMove = null;
  render();
});

newGame();
