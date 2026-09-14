// Offline scientific calculator. The expression the user builds is parsed
// and evaluated by a small recursive-descent parser below — no eval().

const FUNCS = new Set(['sin', 'cos', 'tan', 'log', 'ln', '√']);

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({ type: 'num', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'e') {
        tokens.push({ type: 'const', value: 'e' });
      } else if (FUNCS.has(word)) {
        tokens.push({ type: 'func', value: word });
      } else {
        throw new Error('bad token: ' + word);
      }
      i = j;
      continue;
    }
    if (ch === '√') { tokens.push({ type: 'func', value: '√' }); i++; continue; }
    if (ch === 'π') { tokens.push({ type: 'const', value: 'π' }); i++; continue; }
    if ('+-×÷^()'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
    throw new Error('bad char: ' + ch);
  }
  return tokens;
}

// expr    := addsub
// addsub  := muldiv (('+'|'-') muldiv)*
// muldiv  := unary (('×'|'÷') unary)*
// unary   := ('-'|'+') unary | pow
// pow     := primary ('^' unary)?
// primary := NUM | CONST | FUNC '(' expr ')' | '(' expr ')'
function parse(tokens, angleMode) {
  let pos = 0;
  const peek = () => tokens[pos];
  const expect = (type, value) => {
    const t = tokens[pos];
    if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error('unexpected token');
    }
    pos++;
    return t;
  };

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('unexpected end');
    if (t.type === 'num') { pos++; return parseFloat(t.value); }
    if (t.type === 'const') {
      pos++;
      return t.value === 'π' ? Math.PI : Math.E;
    }
    if (t.type === 'func') {
      pos++;
      expect('op', '(');
      const arg = parseAddSub();
      expect('op', ')');
      return applyFunc(t.value, arg, angleMode);
    }
    if (t.type === 'op' && t.value === '(') {
      pos++;
      const v = parseAddSub();
      expect('op', ')');
      return v;
    }
    throw new Error('unexpected token');
  }

  function parsePow() {
    const base = parsePrimary();
    const t = peek();
    if (t && t.type === 'op' && t.value === '^') {
      pos++;
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary() {
    const t = peek();
    if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
      pos++;
      const v = parseUnary();
      return t.value === '-' ? -v : v;
    }
    return parsePow();
  }

  function parseMulDiv() {
    let v = parseUnary();
    for (;;) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '×' || t.value === '÷')) {
        pos++;
        const rhs = parseUnary();
        v = t.value === '×' ? v * rhs : v / rhs;
      } else {
        break;
      }
    }
    return v;
  }

  function parseAddSub() {
    let v = parseMulDiv();
    for (;;) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        pos++;
        const rhs = parseMulDiv();
        v = t.value === '+' ? v + rhs : v - rhs;
      } else {
        break;
      }
    }
    return v;
  }

  const result = parseAddSub();
  if (pos !== tokens.length) throw new Error('trailing input');
  return result;
}

function applyFunc(name, arg, angleMode) {
  const rad = angleMode === 'deg' ? (arg * Math.PI) / 180 : arg;
  switch (name) {
    case 'sin': return Math.sin(rad);
    case 'cos': return Math.cos(rad);
    case 'tan': return Math.tan(rad);
    case 'log': return Math.log10(arg);
    case 'ln': return Math.log(arg);
    case '√': return Math.sqrt(arg);
    default: throw new Error('unknown func');
  }
}

function evaluate(exprText, angleMode) {
  if (!exprText.trim()) return 0;
  const tokens = tokenize(exprText);
  const value = parse(tokens, angleMode);
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error('non-finite result');
  }
  return value;
}

function formatNumber(n) {
  if (Object.is(n, -0)) n = 0;
  // Avoid float noise like 0.1 + 0.2 = 0.30000000000000004.
  const rounded = Math.round(n * 1e12) / 1e12;
  return String(rounded);
}

// --- UI wiring ---------------------------------------------------------

const exprLine = document.getElementById('exprLine');
const resultLine = document.getElementById('resultLine');
const angleModeToggle = document.getElementById('angleModeToggle');
const angleModeLabel = document.getElementById('angleModeLabel');
const memFlag = document.getElementById('memFlag');

let expr = '';
let memory = 0;
let hasMemory = false;
let lastWasEquals = false;

function angleMode() {
  return angleModeToggle.checked ? 'rad' : 'deg';
}

function render() {
  exprLine.textContent = expr || ' ';
  try {
    resultLine.textContent = expr ? formatNumber(evaluate(expr, angleMode())) : '0';
    resultLine.classList.remove('error');
  } catch {
    resultLine.textContent = expr ? '...' : '0';
    resultLine.classList.remove('error');
  }
  memFlag.classList.toggle('hidden', !hasMemory);
}

function setExprToNumber(n) {
  expr = formatNumber(n);
  lastWasEquals = false;
}

function transformCurrent(fn) {
  try {
    const v = evaluate(expr, angleMode());
    setExprToNumber(fn(v));
  } catch {
    exprLine.textContent = expr || ' ';
    resultLine.textContent = 'Error';
    resultLine.classList.add('error');
    memFlag.classList.toggle('hidden', !hasMemory);
    return;
  }
  render();
}

function handleAction(action, value) {
  if (lastWasEquals && (action === 'digit' || action === 'const')) {
    // Starting a fresh number right after "=" begins a new expression.
    expr = '';
  }
  lastWasEquals = false;

  switch (action) {
    case 'digit':
      expr += value;
      break;
    case 'insert':
      expr += value;
      break;
    case 'paren':
      expr += value;
      break;
    case 'const':
      expr += value;
      break;
    case 'func':
      expr += value + '(';
      break;
    case 'backspace':
      expr = expr.slice(0, -1);
      break;
    case 'clear':
      expr = '';
      break;
    case 'equals': {
      try {
        const v = evaluate(expr, angleMode());
        expr = formatNumber(v);
        lastWasEquals = true;
      } catch {
        resultLine.textContent = 'Error';
        resultLine.classList.add('error');
        exprLine.textContent = expr;
        return;
      }
      break;
    }
    case 'percent':
      transformCurrent((v) => v / 100);
      return;
    case 'square':
      transformCurrent((v) => v * v);
      return;
    case 'reciprocal':
      transformCurrent((v) => {
        if (v === 0) throw new Error('div by zero');
        return 1 / v;
      });
      return;
    case 'negate':
      transformCurrent((v) => -v);
      return;
    case 'mplus':
      try { memory += evaluate(expr, angleMode()); hasMemory = true; } catch { /* ignore */ }
      break;
    case 'mminus':
      try { memory -= evaluate(expr, angleMode()); hasMemory = true; } catch { /* ignore */ }
      break;
    case 'mr':
      if (hasMemory) expr += formatNumber(memory);
      break;
    case 'mc':
      memory = 0;
      hasMemory = false;
      break;
    default:
      break;
  }
  render();
}

document.querySelectorAll('.key').forEach((btn) => {
  btn.addEventListener('click', () => {
    handleAction(btn.dataset.action, btn.dataset.value);
  });
});

angleModeToggle.addEventListener('change', () => {
  angleModeLabel.textContent = angleModeToggle.checked ? 'Rad' : 'Deg';
  render();
});

const KEY_TO_OP = { '*': '×', '/': '÷' };

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (/^[0-9.]$/.test(k)) { handleAction('digit', k); return; }
  if (k === '+' || k === '-') { handleAction('insert', k); return; }
  if (k === '*' || k === '/') { handleAction('insert', KEY_TO_OP[k]); return; }
  if (k === '^') { handleAction('insert', '^'); return; }
  if (k === '(' || k === ')') { handleAction('paren', k); return; }
  if (k === 'Enter' || k === '=') { e.preventDefault(); handleAction('equals'); return; }
  if (k === 'Backspace') { handleAction('backspace'); return; }
  if (k === 'Escape') { handleAction('clear'); return; }
});

render();
