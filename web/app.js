// Storefront logic: renders the configurator from config.js, computes
// pricing, and handles the (currently backend-less) checkout request.
// See submitOrder() at the bottom for where real payment/order
// processing would plug in.

const state = {
  mode: 'kit', // 'kit' (Pi + card) or 'cardonly' (bring your own Pi)
  hardware: null,
  zims: new Set(),
  cardOverride: 'auto', // 'auto' or a capacityGb number
  addons: {}, // id -> qty
};

function byId(id) { return document.getElementById(id); }

function money(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function allZims() {
  return ZIM_GROUPS.flatMap((g) => g.zims);
}

function selectedGb() {
  const zims = allZims();
  let gb = BUNDLED_EXTRA_GB;
  for (const id of state.zims) {
    const z = zims.find((z) => z.id === id);
    if (z) gb += z.gb;
  }
  return gb;
}

function neededGb() {
  return selectedGb() + OS_OVERHEAD_GB;
}

// True once the ZIM selection alone (not counting OS overhead) would
// never fit on real hardware, no matter which card is picked - ZIMDATA
// is hard-capped at ZIMDATA_USABLE_GB regardless of card size, so a
// bigger card cannot rescue a selection past that ceiling.
function exceedsZimdataCap() {
  return selectedGb() > ZIMDATA_USABLE_GB;
}

function recommendedCard() {
  if (exceedsZimdataCap()) return null;
  const need = neededGb();
  return SD_CARDS.find((c) => c.capacityGb >= need) || null;
}

function selectedCard() {
  // A manual override must not bypass the ZIMDATA cap: no card, however
  // large its capacityGb, actually holds more than ZIMDATA_USABLE_GB of
  // ZIMs (see MAX_ZIMDATA_GB above).
  if (exceedsZimdataCap()) return null;
  if (state.cardOverride === 'auto') return recommendedCard();
  return SD_CARDS.find((c) => c.capacityGb === state.cardOverride) || recommendedCard();
}

// ---- rendering ----

function renderHardware() {
  const cardOnly = state.mode === 'cardonly';

  byId('hwHint').textContent = cardOnly
    ? "tell us which model you already own — we flash a matching image"
    : "you're paying for the hardware and the card";

  const grid = byId('hwGrid');
  grid.innerHTML = '';
  for (const hw of HARDWARE) {
    const label = document.createElement('label');
    label.className = 'hwCard';
    label.innerHTML = `
      <input type="radio" name="hardware" value="${hw.id}">
      <span class="hwCard__price">${cardOnly ? 'you own it' : money(hw.price)}</span>
      <span class="hwCard__name">${hw.name}</span>
      <span class="hwCard__blurb">${hw.blurb}</span>
    `;
    const input = label.querySelector('input');
    input.checked = state.hardware === hw.id;
    input.addEventListener('change', () => {
      state.hardware = hw.id;
      renderAll();
    });
    grid.appendChild(label);
  }
}

function renderMode() {
  const inputs = document.querySelectorAll('input[name="purchaseMode"]');
  for (const input of inputs) {
    input.checked = input.value === state.mode;
  }
}

function renderZims() {
  const container = byId('zimGroups');
  container.innerHTML = '';
  for (const group of ZIM_GROUPS) {
    const groupEl = document.createElement('div');
    groupEl.className = 'zimGroup';
    const label = document.createElement('div');
    label.className = 'zimGroup__label';
    label.textContent = group.label;
    groupEl.appendChild(label);

    for (const zim of group.zims) {
      const row = document.createElement('label');
      row.className = 'zimRow';
      row.innerHTML = `
        <input type="checkbox">
        <span>
          <span class="zimRow__name">${zim.name}</span><br>
          <span class="zimRow__desc">${zim.description}</span>
        </span>
        <span class="zimRow__meta">
          <span class="zimRow__gb">${zim.gb.toFixed(zim.gb < 1 ? 3 : 1)} GB</span>
        </span>
      `;
      const input = row.querySelector('input');
      input.checked = state.zims.has(zim.id);
      input.addEventListener('change', () => {
        if (input.checked) state.zims.add(zim.id);
        else state.zims.delete(zim.id);
        renderAll();
      });
      groupEl.appendChild(row);
    }
    container.appendChild(groupEl);
  }
}

function renderStorage() {
  byId('totalGbLabel').textContent = `${selectedGb().toFixed(1)} GB selected`;

  const select = byId('cardOverride');
  const rec = recommendedCard();
  select.innerHTML = '';
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = rec
    ? `Auto — ${rec.capacityGb}GB (recommended)`
    : 'Auto — selection too large for any card';
  select.appendChild(autoOpt);
  for (const c of SD_CARDS) {
    const opt = document.createElement('option');
    opt.value = c.capacityGb;
    opt.textContent = `${c.capacityGb}GB — ${money(c.price)}`;
    select.appendChild(opt);
  }
  select.value = state.cardOverride;

  const card = selectedCard();
  const note = byId('cardNote');
  if (exceedsZimdataCap()) {
    note.textContent = `Your selection (${selectedGb().toFixed(1)}GB) exceeds the ${ZIMDATA_USABLE_GB.toFixed(0)}GB ZIM library cap our flashing tools enforce on every card, however large — a bigger card will not help. Remove some libraries or contact us about a multi-card build.`;
  } else if (!card) {
    note.textContent = `Your selection (${neededGb().toFixed(1)}GB incl. overhead) exceeds the largest card we offer. Remove some libraries or contact us about a multi-card build.`;
  } else if (card.capacityGb < neededGb()) {
    note.textContent = `Warning: the selected card (${card.capacityGb}GB) is smaller than your selection needs (${neededGb().toFixed(1)}GB). Pick a bigger card or remove some libraries.`;
  } else if (card.capacityGb > 512) {
    note.textContent = `Includes ${OS_OVERHEAD_GB}GB reserved for the OS and first-boot headroom. Note: ZIM storage tops out at ${ZIMDATA_USABLE_GB.toFixed(0)}GB regardless of card size, so this card buys extra margin, not extra library capacity, over a 512GB card.`;
  } else {
    note.textContent = `Includes ${OS_OVERHEAD_GB}GB reserved for the OS and first-boot headroom.`;
  }
}

function renderAddons() {
  const container = byId('addonList');
  container.innerHTML = '';
  for (const addon of ADDONS) {
    const row = document.createElement('div');
    row.className = 'addonRow';
    const price = addonPrice(addon);
    row.innerHTML = `
      <input type="checkbox" id="addon-${addon.id}">
      <span>
        <span class="addonRow__name">${addon.name}</span><br>
        <span class="addonRow__desc">${addon.description}</span>
      </span>
      <span class="addonRow__price">${price == null ? '' : money(price)}</span>
    `;
    const input = row.querySelector('input');
    input.checked = !!state.addons[addon.id];
    input.addEventListener('change', () => {
      if (input.checked) state.addons[addon.id] = 1;
      else delete state.addons[addon.id];
      renderAll();
    });
    container.appendChild(row);
  }
}

function addonPrice(addon) {
  if (addon.id === 'extracard') {
    const card = selectedCard();
    return card ? card.price : null;
  }
  return addon.price;
}

function computeTotal() {
  let total = 0;
  const lines = [];
  const cardOnly = state.mode === 'cardonly';

  // In card-only mode this still records *which* board they own, since
  // each Pi model needs a differently-built image — it's just not billed.
  const hw = HARDWARE.find((h) => h.id === state.hardware);

  if (hw && !cardOnly) {
    lines.push({ label: hw.name, amount: hw.price });
    total += hw.price;
  } else if (hw && cardOnly) {
    lines.push({ label: `${hw.name} (bring your own)`, amount: 0, dim: true });
  }

  const card = selectedCard();
  if (card && hw) {
    lines.push({ label: `${card.capacityGb}GB microSD card`, amount: card.price });
    total += card.price;
  }

  if (hw) {
    const fee = cardOnly ? CARD_ONLY_BUILD_FEE : BUILD_FEE;
    lines.push({ label: cardOnly ? 'Flash & verify service' : 'Build & flash service', amount: fee, dim: true });
    total += fee;
  }

  for (const addon of ADDONS) {
    if (!state.addons[addon.id]) continue;
    const price = addonPrice(addon);
    if (price == null) continue;
    lines.push({ label: addon.name, amount: price });
    total += price;
  }

  return { lines, total, hw, card, cardOnly };
}

function renderCart() {
  const { lines, total, hw, card } = computeTotal();
  const linesEl = byId('cartLines');
  const warningEl = byId('cartWarning');
  const checkoutBtn = byId('checkoutBtn');

  if (!hw) {
    linesEl.innerHTML = '<div class="cart__empty">Pick your hardware to get started.</div>';
  } else {
    linesEl.innerHTML = lines
      .map((l) => `<div class="cart__line${l.dim ? ' cart__line--dim' : ''}"><span>${l.label}</span><span>${money(l.amount)}</span></div>`)
      .join('');
  }
  byId('cartTotal').textContent = money(total);

  const cardTooSmall = card && card.capacityGb < neededGb();
  const noCard = !card;
  if (hw && (cardTooSmall || noCard)) {
    warningEl.classList.remove('hidden');
    warningEl.textContent = exceedsZimdataCap()
      ? `Your library selection exceeds the ${ZIMDATA_USABLE_GB.toFixed(0)}GB ZIM cap our flashing tools enforce on every card - no card size fixes this.`
      : noCard
        ? 'Your library selection is too large for any card we offer.'
        : 'The selected card is smaller than your library selection needs.';
    checkoutBtn.disabled = true;
  } else {
    warningEl.classList.add('hidden');
    checkoutBtn.disabled = !hw;
  }
}

function renderAll() {
  renderMode();
  renderHardware();
  renderZims();
  renderStorage();
  renderAddons();
  renderCart();
}

// ---- checkout ----

function buildOrderSummary() {
  const { lines, total, hw, cardOnly } = computeTotal();
  const zimNames = allZims()
    .filter((z) => state.zims.has(z.id))
    .map((z) => z.name);
  return { lines, total, zimNames, card: selectedCard(), hw, cardOnly };
}

function submitOrder(customer) {
  // No backend wired up yet. This constructs a mailto: link so an order
  // request actually goes somewhere real today; swap this for a fetch()
  // POST to your own order-intake endpoint (and real payment, e.g.
  // Stripe Checkout) when you're ready to take live orders.
  const ORDERS_EMAIL = 'orders@yourdomain.example'; // <-- change this

  const summary = buildOrderSummary();
  const orderRef = 'SP-' + Date.now().toString(36).toUpperCase();

  const bodyLines = [
    `Order reference: ${orderRef}`,
    '',
    `Name: ${customer.name}`,
    `Email: ${customer.email}`,
    `Shipping address: ${customer.address}`,
    customer.notes ? `Notes: ${customer.notes}` : null,
    '',
    `Order type: ${summary.cardOnly ? 'Card only (customer supplies their own ' + (summary.hw ? summary.hw.name : 'Pi') + ')' : 'Full kit'}`,
    'Configuration:',
    ...summary.lines.map((l) => `  - ${l.label}: $${l.amount}`),
    `Libraries included: ${summary.zimNames.join(', ') || '(none selected)'}`,
    '',
    `Total: $${summary.total}`,
  ].filter(Boolean);

  const subject = encodeURIComponent(`StashPi order request ${orderRef}`);
  const body = encodeURIComponent(bodyLines.join('\n'));
  const mailtoUrl = `mailto:${ORDERS_EMAIL}?subject=${subject}&body=${body}`;

  window.open(mailtoUrl, '_blank');

  return orderRef;
}

// ---- checkout overlay wiring ----

function openCheckout() {
  byId('checkoutOverlay').classList.remove('hidden');
  byId('checkoutForm').classList.remove('hidden');
  byId('checkoutConfirm').classList.add('hidden');
}

function closeCheckout() {
  byId('checkoutOverlay').classList.add('hidden');
}

byId('checkoutBtn').addEventListener('click', openCheckout);
byId('cancelCheckout').addEventListener('click', closeCheckout);
byId('closeConfirm').addEventListener('click', closeCheckout);
byId('checkoutOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'checkoutOverlay') closeCheckout();
});

byId('orderForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const customer = {
    name: byId('custName').value.trim(),
    email: byId('custEmail').value.trim(),
    address: byId('custAddress').value.trim(),
    notes: byId('custNotes').value.trim(),
  };
  const orderRef = submitOrder(customer);
  byId('orderRef').textContent = orderRef;
  byId('checkoutForm').classList.add('hidden');
  byId('checkoutConfirm').classList.remove('hidden');
});

byId('selectAllZims').addEventListener('click', () => {
  for (const z of allZims()) state.zims.add(z.id);
  renderAll();
});
byId('selectNoneZims').addEventListener('click', () => {
  state.zims.clear();
  renderAll();
});

byId('cardOverride').addEventListener('change', (e) => {
  state.cardOverride = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
  renderAll();
});

for (const input of document.querySelectorAll('input[name="purchaseMode"]')) {
  input.addEventListener('change', (e) => {
    state.mode = e.target.value;
    renderAll();
  });
}

// ---- theme toggle ----

function applyThemeLabel(theme) {
  byId('themeToggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}
byId('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('ib-shop-theme', next); } catch (e) { /* ignore */ }
  applyThemeLabel(next);
});
applyThemeLabel(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

// ---- init ----

state.hardware = HARDWARE[1] ? HARDWARE[1].id : HARDWARE[0].id; // default to the "sweet spot" option
renderAll();
