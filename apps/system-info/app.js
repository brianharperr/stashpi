// System Info — the one app in apps/ that makes a network request, and
// only ever to this same device: it reads kiwix-serve's own OPDS catalog
// endpoint (/catalog/v2/entries), which is same-origin regardless of
// which library tile the visitor came from. That stays within "no
// internet required" since it never leaves the device.

const summaryGrid = document.getElementById('summaryGrid');
const zimTableBody = document.getElementById('zimTableBody');
const zimError = document.getElementById('zimError');

function textOf(entry, tag) {
  const el = entry.getElementsByTagName(tag)[0];
  return el ? el.textContent.trim() : '';
}

function numberOf(entry, tag) {
  const n = Number(textOf(entry, tag));
  return Number.isFinite(n) ? n : 0;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function summaryItem(value, label) {
  const div = document.createElement('div');
  div.className = 'summaryItem';
  const valueEl = document.createElement('div');
  valueEl.className = 'summaryItem__value';
  valueEl.textContent = value;
  const labelEl = document.createElement('div');
  labelEl.className = 'summaryItem__label';
  labelEl.textContent = label;
  div.append(valueEl, labelEl);
  return div;
}

async function load() {
  const res = await fetch('/catalog/v2/entries?count=1000');
  if (!res.ok) throw new Error(`catalog request failed (HTTP ${res.status})`);
  const xmlText = await res.text();
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('could not parse the catalog response');

  const entries = Array.from(doc.getElementsByTagName('entry'));
  entries.sort((a, b) => textOf(a, 'title').localeCompare(textOf(b, 'title')));

  let totalArticles = 0;
  let totalMedia = 0;
  zimTableBody.innerHTML = '';
  entries.forEach((entry) => {
    const articles = numberOf(entry, 'articleCount');
    const media = numberOf(entry, 'mediaCount');
    totalArticles += articles;
    totalMedia += media;

    const tr = document.createElement('tr');
    tr.append(
      cell(textOf(entry, 'title') || '(untitled)'),
      cell(formatDate(textOf(entry, 'updated'))),
      cell(textOf(entry, 'language') || '—'),
      cell(articles.toLocaleString()),
      cell(media.toLocaleString())
    );
    zimTableBody.appendChild(tr);
  });

  summaryGrid.innerHTML = '';
  summaryGrid.append(
    summaryItem(String(entries.length), 'Libraries installed'),
    summaryItem(totalArticles.toLocaleString(), 'Total articles'),
    summaryItem(totalMedia.toLocaleString(), 'Total media files')
  );
}

load().catch((err) => {
  summaryGrid.innerHTML = '';
  zimError.textContent = `Could not load library information from this device (${err.message}). `
    + 'This tile only works when opened through StashPi’s own library server, not as a standalone file.';
  zimError.classList.remove('hidden');
});
