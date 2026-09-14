const BPM = 110;
const BEAT_MS = 60000 / BPM;
const COMPRESSIONS_PER_CYCLE = 30;
const BREATHE_PAUSE_MS = 5000;

const GUIDANCE = {
  adult: 'Adult: push hard and fast in the center of the chest, at least '
    + '2 in (5 cm) deep, letting the chest fully recoil between '
    + 'compressions. Use two hands, interlocked. Rate 100–120/min. '
    + 'Ratio 30 compressions : 2 breaths if trained and able — '
    + 'compression-only CPR is also effective if untrained.',
  child: 'Child (1 yr to puberty): push about 2 in (5 cm) deep, one or two '
    + 'hands depending on the size of the child. Rate 100–120/min. '
    + 'Ratio 30:2 for one rescuer, 15:2 for two rescuers.',
  infant: 'Infant (under 1 yr): use two fingers on the center of the chest, '
    + 'just below the nipple line, about 1.5 in (4 cm) deep. Rate '
    + '100–120/min. Ratio 30:2 for one rescuer, 15:2 for two rescuers.',
};

const modeSelect = document.getElementById('modeSelect');
const guidanceEl = document.getElementById('guidance');
const beatEl = document.getElementById('beat');
const breatheOverlay = document.getElementById('breatheOverlay');
const countValue = document.getElementById('countValue');
const timeValue = document.getElementById('timeValue');
const startBtn = document.getElementById('startBtn');

let running = false;
let audioCtx = null;
let startTime = 0;
let beatIndex = 0;
let cycleCount = 0;
let totalCount = 0;
let breathing = false;
let beatTimer = null;
let clockTimer = null;
let breatheTimer = null;

function updateGuidance() {
  guidanceEl.textContent = GUIDANCE[modeSelect.value];
}
modeSelect.addEventListener('change', updateGuidance);
updateGuidance();

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function playClick() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 950;
  gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function pulseBeat() {
  beatEl.classList.add('pulse');
  setTimeout(() => beatEl.classList.remove('pulse'), Math.min(160, BEAT_MS * 0.4));
}

function tickClock() {
  timeValue.textContent = formatElapsed(performance.now() - startTime);
  clockTimer = requestAnimationFrame(tickClock);
}

function scheduleNextBeat() {
  if (!running || breathing) return;
  const targetTime = startTime + beatIndex * BEAT_MS;
  const delay = Math.max(0, targetTime - performance.now());
  beatTimer = setTimeout(() => {
    if (!running || breathing) return;
    beatIndex += 1;
    cycleCount += 1;
    totalCount += 1;
    countValue.textContent = String(totalCount);
    pulseBeat();
    playClick();
    if (cycleCount >= COMPRESSIONS_PER_CYCLE) {
      cycleCount = 0;
      startBreathePause();
    } else {
      scheduleNextBeat();
    }
  }, delay);
}

function startBreathePause() {
  breathing = true;
  breatheOverlay.classList.remove('hidden');
  breatheTimer = setTimeout(() => {
    breathing = false;
    breatheOverlay.classList.add('hidden');
    if (running) {
      // Re-anchor beat scheduling to now so the pause doesn't leave the
      // metronome trying to "catch up" on a burst of missed beats.
      startTime = performance.now() - beatIndex * BEAT_MS;
      startTime += BEAT_MS; // land the very next beat one interval out
      beatIndex += 1;
      scheduleNextBeat();
    }
  }, BREATHE_PAUSE_MS);
}

function start() {
  if (running) return;
  running = true;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  startTime = performance.now();
  beatIndex = 0;
  cycleCount = 0;
  totalCount = 0;
  breathing = false;
  countValue.textContent = '0';
  breatheOverlay.classList.add('hidden');
  startBtn.textContent = 'Stop';
  startBtn.classList.add('running');
  scheduleNextBeat();
  tickClock();
}

function stop() {
  running = false;
  breathing = false;
  clearTimeout(beatTimer);
  clearTimeout(breatheTimer);
  cancelAnimationFrame(clockTimer);
  breatheOverlay.classList.add('hidden');
  beatEl.classList.remove('pulse');
  startBtn.textContent = 'Start';
  startBtn.classList.remove('running');
}

startBtn.addEventListener('click', () => {
  if (running) stop(); else start();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    if (running) stop(); else start();
  }
});
