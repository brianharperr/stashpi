// All prices in USD. Everything here is a placeholder based on rough
// component costs — adjust to your real numbers before this goes live.
// Nothing in this file talks to a payment processor; see app.js's
// submitOrder() for where that would plug in later.

const HARDWARE = [
  {
    id: 'rpi3',
    name: 'Raspberry Pi 3B+',
    price: 55,
    blurb: 'Works fine for browsing. Full-text search across the big libraries (Wikipedia, Gutenberg) is noticeably slower.',
  },
  {
    id: 'rpi4',
    name: 'Raspberry Pi 4',
    price: 35,
    blurb: 'The sweet spot for most people — fast enough for concurrent users and full-text search.',
  },
  {
    id: 'rpi5',
    name: 'Raspberry Pi 5',
    price: 95,
    blurb: 'Fastest option. Best if several people will be searching at once.',
  },
];

// Grouped the same way the on-device library is ordered.
const ZIM_GROUPS = [
  {
    label: 'Core reference',
    zims: [
      { id: 'maps', name: 'Maps', gb: 77.7, description: 'Full world map, including roads and landmarks' },
      { id: 'wikipedia', name: 'Wikipedia', gb: 124.0, description: 'The free encyclopedia' },
      { id: 'mdwiki', name: 'MDWiki', gb: 10.8, description: 'Healthcare articles curated by WikiProjectMed' },
      { id: 'gutenberg', name: 'Project Gutenberg Library', gb: 253.1, description: 'All books, all languages, from the first producer of free ebooks' },
    ],
  },
  {
    label: 'Food & survival',
    zims: [
      { id: 'recipes', name: 'Recipes', gb: 0.02, description: 'Recipes submitted by computer-savvy cooks' },
      { id: 'food-preppers', name: 'Food for Preppers', gb: 0.1, description: 'Recipes and techniques for preparing and storing food' },
      { id: 'usda-canning', name: 'USDA Guide to Home Canning', gb: 0.02, description: 'Research-based recommendations for canning safely' },
    ],
  },
  {
    label: 'Medical reference',
    zims: [
      { id: 'medicines', name: 'Medicines', gb: 0.02, description: 'How medicines work, how and when to take them' },
      { id: 'medical-library', name: 'Medical Library', gb: 0.07, description: 'Field and emergency medicine references' },
    ],
  },
  {
    label: 'More reference',
    zims: [
      { id: 'wikisource', name: 'Wikisource', gb: 12.1, description: 'Library of public domain texts' },
      { id: 'wikispecies', name: 'Wikispecies', gb: 3.4, description: 'Comprehensive catalogue of species' },
      { id: 'cheatsheets', name: 'Cheat Sheets', gb: 11.4, description: 'Quick references and revision aids' },
    ],
  },
];

// A tiny chess game is always bundled at no charge and isn't shown as a
// selectable line — it's ~80KB and not worth a decision point.
const BUNDLED_EXTRA_GB = 0.001;

// OS + first-boot headroom reserved on every card, on top of whatever
// ZIMs are selected.
const OS_OVERHEAD_GB = 2;

// init-flash.sh/reflash.sh cap the ZIMDATA partition at 470GB (decimal)
// *even on bigger cards* (see MAX_ZIMDATA_BYTES in init-flash.sh) - buying
// a 1TB or 2TB card does not buy more ZIM storage than a 512GB one does.
// ext4 formatting then eats a further ~1.8% to metadata (measured by
// actually formatting a 470GB image and reading its superblock); reserve
// 3% for that plus rounding, matching init-flash.sh's own safety margin.
const MAX_ZIMDATA_GB = 470;
const ZIMDATA_USABLE_GB = MAX_ZIMDATA_GB * 0.97;

// Sorted ascending. The smallest card whose capacity covers the
// selection (after overhead) is picked automatically - but capacity
// beyond ZIMDATA_USABLE_GB is never actually usable for ZIMs (see above),
// so nothing bigger than the card that first reaches that ceiling should
// ever be *recommended* for more ZIM headroom.
const SD_CARDS = [
  { capacityGb: 128, price: 14 },
  { capacityGb: 256, price: 24 },
  { capacityGb: 512, price: 140 },
  { capacityGb: 1024, price: 78 },
  { capacityGb: 2048, price: 155 },
];

const ADDONS = [
  {
    id: 'powerbank',
    name: 'Power bank (20,000mAh)',
    price: 30,
    description: 'Runs the Pi for a full day or more off-grid.',
  },
  {
    id: 'faraday',
    name: 'Faraday bag',
    price: 25,
    description: 'Blocks RF — for EMP/solar-flare-conscious storage.',
  },
  {
    id: 'usbdrive',
    name: 'USB drive (64GB)',
    price: 12,
    description: "For the device's USB-drive file browser feature — bring your own files.",
  },
  {
    id: 'extracard',
    name: 'Spare pre-flashed SD card',
    price: null, // priced the same as the main card; computed at checkout
    description: 'A second copy of your exact build, ready to swap in.',
  },
];

// Flat fee covering download, verification, flashing, and a boot test
// before shipping, plus heatsink ($1), shipping materials ($3), and
// margin (target $100 profit per kit, based on the RPi4 1GB / 512GB
// card build: $35 + $140 + $104 = $279).
const BUILD_FEE = 104;

// Charged instead of BUILD_FEE when the customer already owns a Pi and
// only wants a pre-flashed card mailed to them (no board to test/pack).
const CARD_ONLY_BUILD_FEE = 10;

// Hardware carries a 1-year warranty against defects — see warranty.html.
const WARRANTY_YEARS = 1;
