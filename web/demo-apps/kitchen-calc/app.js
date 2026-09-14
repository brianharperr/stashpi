// Kitchen Calculator — unit conversion, recipe scaling, and USDA canning
// altitude adjustment. Fully client-side, no network access of any kind.

// ---------- Tabs ----------

const tabBtns = document.querySelectorAll('.tabBtn');
const panels = {
  convert: document.getElementById('panel-convert'),
  scale: document.getElementById('panel-scale'),
  canning: document.getElementById('panel-canning'),
};

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(panels).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== btn.dataset.tab);
    });
  });
});

// ---------- Unit converter ----------

// Base unit for volume: milliliters.
const VOLUME_UNITS = {
  tsp: { label: 'teaspoon', toBase: 4.92892159375 },
  tbsp: { label: 'tablespoon', toBase: 14.78676478125 },
  floz: { label: 'fluid oz', toBase: 29.5735295625 },
  cup: { label: 'cup', toBase: 236.5882365 },
  pint: { label: 'pint', toBase: 473.176473 },
  quart: { label: 'quart', toBase: 946.352946 },
  gallon: { label: 'gallon', toBase: 3785.411784 },
  mL: { label: 'milliliter', toBase: 1 },
  L: { label: 'liter', toBase: 1000 },
};

// Base unit for weight: grams.
const WEIGHT_UNITS = {
  oz: { label: 'ounce', toBase: 28.349523125 },
  lb: { label: 'pound', toBase: 453.59237 },
  g: { label: 'gram', toBase: 1 },
  kg: { label: 'kilogram', toBase: 1000 },
};

function populateUnitSelects(selectEl, units, defaultKey) {
  selectEl.innerHTML = '';
  Object.entries(units).forEach(([key, def]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${key} (${def.label})`;
    if (key === defaultKey) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function convert(value, units, fromKey, toKey) {
  const base = value * units[fromKey].toBase;
  return base / units[toKey].toBase;
}

function formatNumber(n) {
  if (!isFinite(n)) return '';
  const rounded = Math.round(n * 10000) / 10000;
  return rounded.toString();
}

const volIn = document.getElementById('volIn');
const volFromUnit = document.getElementById('volFromUnit');
const volToUnit = document.getElementById('volToUnit');
const volOut = document.getElementById('volOut');

populateUnitSelects(volFromUnit, VOLUME_UNITS, 'cup');
populateUnitSelects(volToUnit, VOLUME_UNITS, 'mL');

function updateVolume() {
  const v = parseFloat(volIn.value);
  if (isNaN(v)) { volOut.value = ''; return; }
  volOut.value = formatNumber(convert(v, VOLUME_UNITS, volFromUnit.value, volToUnit.value));
}
[volIn, volFromUnit, volToUnit].forEach((el) => el.addEventListener('input', updateVolume));
updateVolume();

const wtIn = document.getElementById('wtIn');
const wtFromUnit = document.getElementById('wtFromUnit');
const wtToUnit = document.getElementById('wtToUnit');
const wtOut = document.getElementById('wtOut');

populateUnitSelects(wtFromUnit, WEIGHT_UNITS, 'lb');
populateUnitSelects(wtToUnit, WEIGHT_UNITS, 'g');

function updateWeight() {
  const v = parseFloat(wtIn.value);
  if (isNaN(v)) { wtOut.value = ''; return; }
  wtOut.value = formatNumber(convert(v, WEIGHT_UNITS, wtFromUnit.value, wtToUnit.value));
}
[wtIn, wtFromUnit, wtToUnit].forEach((el) => el.addEventListener('input', updateWeight));
updateWeight();

const tempIn = document.getElementById('tempIn');
const tempFromUnit = document.getElementById('tempFromUnit');
const tempOut = document.getElementById('tempOut');
const tempToLabel = document.getElementById('tempToLabel');

function updateTemp() {
  const v = parseFloat(tempIn.value);
  if (isNaN(v)) { tempOut.value = ''; return; }
  if (tempFromUnit.value === 'F') {
    tempOut.value = formatNumber((v - 32) * 5 / 9);
    tempToLabel.textContent = '°C';
  } else {
    tempOut.value = formatNumber(v * 9 / 5 + 32);
    tempToLabel.textContent = '°F';
  }
}
[tempIn, tempFromUnit].forEach((el) => el.addEventListener('input', updateTemp));
updateTemp();

// Standard oven temperature / UK gas mark reference table.
const OVEN_TABLE = [
  { f: 225, c: 107, mark: '1/4' },
  { f: 250, c: 121, mark: '1/2' },
  { f: 275, c: 135, mark: '1' },
  { f: 300, c: 149, mark: '2' },
  { f: 325, c: 163, mark: '3' },
  { f: 350, c: 177, mark: '4' },
  { f: 375, c: 190, mark: '5' },
  { f: 400, c: 204, mark: '6' },
  { f: 425, c: 218, mark: '7' },
  { f: 450, c: 232, mark: '8' },
  { f: 475, c: 246, mark: '9' },
];

const ovenTableBody = document.querySelector('#ovenTable tbody');
OVEN_TABLE.forEach((row) => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${row.f}</td><td>${row.c}</td><td>${row.mark}</td>`;
  ovenTableBody.appendChild(tr);
});

// ---------- Recipe scaler ----------

const origServingsEl = document.getElementById('origServings');
const newServingsEl = document.getElementById('newServings');
const ratioNoteEl = document.getElementById('ratioNote');
const ingredientBody = document.getElementById('ingredientBody');
const addIngredientBtn = document.getElementById('addIngredientBtn');

const NICE_FRACTIONS = [
  [0, 1], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4],
];

// Rounds a quantity to a whole number plus a nice fraction (quarters,
// thirds, halves) when it's close to one, otherwise falls back to a
// two-decimal number — recipe quantities read better as "1 1/2" than "1.5".
function formatQty(value) {
  if (!isFinite(value) || value < 0) return '0';
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  let best = NICE_FRACTIONS[0];
  let bestDiff = Infinity;
  for (const pair of NICE_FRACTIONS) {
    const diff = Math.abs(frac - pair[0] / pair[1]);
    if (diff < bestDiff) { bestDiff = diff; best = pair; }
  }
  if (bestDiff < 0.03) {
    const [n, d] = best;
    if (n === 0) return whole === 0 ? '0' : `${whole}`;
    return whole > 0 ? `${whole} ${n}/${d}` : `${n}/${d}`;
  }
  return (Math.round(value * 100) / 100).toString();
}

function addIngredientRow(qty = '', unit = '', name = '') {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" class="qtyIn" value="${qty}" step="any" min="0"></td>
    <td><input type="text" class="unitIn" value="${unit}"></td>
    <td><input type="text" class="nameIn" value="${name}"></td>
    <td class="scaledCell"></td>
    <td><button type="button" class="rmBtn">&times;</button></td>
  `;
  ingredientBody.appendChild(tr);
  tr.querySelectorAll('input').forEach((el) => el.addEventListener('input', updateScaling));
  tr.querySelector('.rmBtn').addEventListener('click', () => {
    tr.remove();
    updateScaling();
  });
}

addIngredientBtn.addEventListener('click', () => addIngredientRow());

function updateScaling() {
  const orig = parseFloat(origServingsEl.value);
  const desired = parseFloat(newServingsEl.value);
  if (!orig || orig <= 0 || !desired || desired <= 0) {
    ratioNoteEl.textContent = '';
    return;
  }
  const ratio = desired / orig;
  ratioNoteEl.textContent = `× ${formatNumber(ratio)}`;
  ingredientBody.querySelectorAll('tr').forEach((tr) => {
    const qty = parseFloat(tr.querySelector('.qtyIn').value);
    const unit = tr.querySelector('.unitIn').value;
    const cell = tr.querySelector('.scaledCell');
    if (isNaN(qty)) { cell.textContent = ''; return; }
    cell.textContent = `${formatQty(qty * ratio)} ${unit}`.trim();
  });
}

[origServingsEl, newServingsEl].forEach((el) => el.addEventListener('input', updateScaling));

// Seed a starting example so the scaler isn't an empty table on first load.
addIngredientRow(2, 'cups', 'flour');
addIngredientRow(1, 'cup', 'sugar');
addIngredientRow(0.5, 'tsp', 'salt');
addIngredientRow(2, '', 'eggs');
updateScaling();

// ---------- Canning altitude adjustment ----------

const canningMethod = document.getElementById('canningMethod');
const canningAltitude = document.getElementById('canningAltitude');
const bwbRow = document.getElementById('bwbRow');
const bwbBaseTime = document.getElementById('bwbBaseTime');
const canningResult = document.getElementById('canningResult');

// USDA National Center for Home Food Preservation altitude adjustment
// tables. Boiling-water bath adjusts processing *time*; pressure canning
// adjusts the *pressure* the gauge is held at instead.
function bwbTimeAddition(altitudeFt) {
  if (altitudeFt <= 1000) return 0;
  if (altitudeFt <= 3000) return 5;
  if (altitudeFt <= 6000) return 10;
  if (altitudeFt <= 8000) return 15;
  return 20;
}

function weightedGaugePressure(altitudeFt) {
  return altitudeFt <= 1000 ? 10 : 15;
}

function dialGaugePressure(altitudeFt) {
  if (altitudeFt <= 2000) return 11;
  if (altitudeFt <= 4000) return 12;
  if (altitudeFt <= 6000) return 13;
  if (altitudeFt <= 8000) return 14;
  return 15;
}

function updateCanningMethodUI() {
  bwbRow.classList.toggle('hidden', canningMethod.value !== 'bwb');
}

canningMethod.addEventListener('change', () => {
  updateCanningMethodUI();
  updateCanningResult();
});
updateCanningMethodUI();

function updateCanningResult() {
  const method = canningMethod.value;
  const altitude = parseFloat(canningAltitude.value);
  if (isNaN(altitude) || altitude < 0) {
    canningResult.innerHTML = '';
    return;
  }

  if (method === 'bwb') {
    const baseTime = parseFloat(bwbBaseTime.value);
    if (isNaN(baseTime) || baseTime <= 0) { canningResult.innerHTML = ''; return; }
    const addition = bwbTimeAddition(altitude);
    const adjusted = baseTime + addition;
    canningResult.innerHTML =
      `Adjusted processing time: <strong>${adjusted} min</strong>` +
      (addition > 0 ? ` (base ${baseTime} min + ${addition} min for altitude)` : ' (no adjustment needed below 1,000 ft)') +
      `<span class="note">Boiling-water bath: keep the same processing time at any altitude below 1,001 ft; add time above that, per USDA tables.</span>`;
  } else if (method === 'weighted') {
    const psi = weightedGaugePressure(altitude);
    canningResult.innerHTML =
      `Use <strong>${psi} lb</strong> weighted gauge pressure.` +
      `<span class="note">Weighted gauges only have two settings: 10 lb at or below 1,000 ft, 15 lb above 1,000 ft.</span>`;
  } else {
    const psi = dialGaugePressure(altitude);
    canningResult.innerHTML =
      `Use <strong>${psi} lb</strong> dial gauge pressure.` +
      `<span class="note">Dial gauges must be checked for accuracy yearly (many county extension offices do this for free).</span>`;
  }
}

[canningAltitude, bwbBaseTime].forEach((el) => el.addEventListener('input', updateCanningResult));
updateCanningResult();
