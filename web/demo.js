// Live demo page. Mini-app tiles point at web/demo-apps/<name>/ — plain
// copies of the same static, network-free code that gets packaged into
// each app's ZIM (see apps/<name>/ and docs/DEPLOY.md); kept as separate
// copies rather than referenced in place so this web/ directory can be
// deployed on its own as a static site. Reference-library tiles have no
// live content to show (too large for a web preview) so they just
// describe what ships.

const DEMO_TILES = [
  { title: 'Maps', icon: 'globe', kind: 'content', gb: 77.7, description: 'Full world map, including roads and landmarks' },
  { title: 'Wikipedia', icon: 'wikipedia', kind: 'content', gb: 124.0, description: 'The free encyclopedia', iconIsPhoto: true },
  { title: 'MDWiki', icon: 'asclepius', kind: 'content', gb: 10.8, description: 'Healthcare articles curated by WikiProjectMed' },
  { title: 'Project Gutenberg Library', icon: 'gutenberg', kind: 'content', gb: 253.1, description: 'All books, all languages, from the first producer of free ebooks', iconIsPhoto: true },
  { title: 'Recipes', icon: 'pot', kind: 'content', gb: 0.02, description: 'Recipes submitted by computer-savvy cooks' },
  { title: 'Food for Preppers', icon: 'jar', kind: 'content', gb: 0.1, description: 'Recipes and techniques for preparing and storing food' },
  { title: 'USDA Guide to Home Canning', icon: 'jar', kind: 'content', gb: 0.02, description: 'Research-based recommendations for canning safely' },
  { title: 'Medicines', icon: 'pill', kind: 'content', gb: 0.02, description: 'How medicines work, how and when to take them' },
  { title: 'Medical Library', icon: 'asclepius', kind: 'content', gb: 0.07, description: 'Field and emergency medicine references' },
  { title: 'Wikisource', icon: 'document', kind: 'content', gb: 12.1, description: 'Library of public domain texts' },
  { title: 'Wikispecies', icon: 'bird', kind: 'content', gb: 3.4, description: 'Comprehensive catalogue of species' },
  { title: 'Cheat Sheets', icon: 'document', kind: 'content', gb: 11.4, description: 'Quick references and revision aids' },
  { title: 'Chess', icon: 'pawn', kind: 'app', app: 'chess', description: 'A lightweight chess game — play a built-in AI opponent, or pass the device between two players.' },
  { title: 'Almanac', icon: 'almanac', kind: 'app', app: 'almanac', description: 'Sunrise/sunset, moon phase, and a rough tide estimate for any date and location — all computed on-device, no internet lookup needed.' },
  { title: 'Kitchen Calculator', icon: 'kitchen-calc', kind: 'app', app: 'kitchen-calc', description: 'Unit conversion, recipe scaling, and USDA canning altitude adjustments.' },
  { title: 'Calculator', icon: 'calculator', kind: 'app', app: 'calculator', description: 'A scientific calculator — trig, logs, memory, all evaluated with a real expression parser (no eval()).' },
  { title: 'CPR Timer', icon: 'cpr-timer', kind: 'app', app: 'cpr-timer', description: 'A compression-rate metronome with breathe-pause cycling, for adult/child/infant guidance.' },
  { title: 'Puzzles', icon: 'puzzles', kind: 'app', app: 'puzzles', description: 'Sudoku (easy/medium/hard, with notes) and themed word search puzzles.' },
  { title: 'System Info', icon: 'system-info', kind: 'device-only', description: 'Live stats pulled from the device’s own library index — which libraries are installed and when each was last updated. Needs to run on the real device to show real data, so it isn’t part of this preview.' },
];

const grid = document.getElementById('demoGrid');
const overlay = document.getElementById('demoOverlay');
const demoTitle = document.getElementById('demoTitle');
const demoBody = document.getElementById('demoBody');
const demoClose = document.getElementById('demoClose');

function badgeFor(tile) {
  if (tile.kind === 'app') return { text: 'Live app', cls: 'demoTile__badge--live' };
  if (tile.kind === 'device-only') return { text: 'Device-only', cls: '' };
  return { text: `${tile.gb} GB`, cls: '' };
}

function openTile(tile) {
  demoTitle.textContent = tile.title;
  demoBody.innerHTML = '';
  if (tile.kind === 'app') {
    const iframe = document.createElement('iframe');
    iframe.src = `demo-apps/${tile.app}/index.html`;
    iframe.title = tile.title;
    demoBody.appendChild(iframe);
  } else {
    const desc = document.createElement('div');
    desc.className = 'demoBox__desc';
    const p1 = document.createElement('p');
    p1.textContent = tile.description;
    desc.appendChild(p1);
    if (tile.kind === 'content') {
      const p2 = document.createElement('p');
      p2.innerHTML = `<strong>${tile.gb} GB</strong> — included on the device, not shown in this web preview.`;
      desc.appendChild(p2);
    }
    demoBody.appendChild(desc);
  }
  overlay.classList.remove('hidden');
}

function closeDemo() {
  overlay.classList.add('hidden');
  demoBody.innerHTML = '';
}

demoClose.addEventListener('click', closeDemo);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeDemo();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeDemo();
});

DEMO_TILES.forEach((tile) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'demoTile';
  const badge = badgeFor(tile);

  const img = document.createElement('img');
  img.src = `assets/tile-icons/${tile.icon}.${tile.iconIsPhoto ? 'png' : 'svg'}`;
  img.alt = '';
  img.width = 48;
  img.height = 48;

  const title = document.createElement('div');
  title.className = 'demoTile__title';
  title.textContent = tile.title;

  const badgeEl = document.createElement('div');
  badgeEl.className = `demoTile__badge ${badge.cls}`;
  badgeEl.textContent = badge.text;

  btn.append(img, title, badgeEl);
  btn.addEventListener('click', () => openTile(tile));
  grid.appendChild(btn);
});
