// All calculations run entirely in this file, from math alone — no
// network requests of any kind (no fetch/XHR, no CDN scripts, no remote
// weather/astronomy APIs). This has to work with zero internet uplink.

const PRESETS = [
  { label: 'Denver, CO, USA', lat: 39.7392, lon: -104.9903 },
  { label: 'Miami, FL, USA', lat: 25.7617, lon: -80.1918 },
  { label: 'London, UK', lat: 51.5074, lon: -0.1278 },
  { label: 'Sydney, Australia', lat: -33.8688, lon: 151.2093 },
  { label: 'Nairobi, Kenya', lat: -1.2921, lon: 36.8219 },
  { label: 'Reykjavik, Iceland', lat: 64.1466, lon: -21.9426 },
];

const SYNODIC_MONTH = 29.530588853; // days
const JD_NEW_MOON_REF = 2451550.1; // known new moon: 2000-01-06 ~18:14 UTC

const dateInput = document.getElementById('dateInput');
const presetSelect = document.getElementById('presetSelect');
const latInput = document.getElementById('latInput');
const lonInput = document.getElementById('lonInput');
const sunBody = document.getElementById('sunBody');
const moonBody = document.getElementById('moonBody');
const tideBody = document.getElementById('tideBody');

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

// Standard Meeus Julian Day number for a Gregorian calendar date.
// `day` may carry a fractional part to represent a time of day (UTC).
function julianDay(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

// NOAA-style solar position: geometric mean longitude/anomaly, equation
// of center, apparent longitude, obliquity, declination, equation of
// time. Standard published algorithm, accurate to within a few minutes.
function solarPosition(julianCentury) {
  const t = julianCentury;
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const mRad = toRad(m);
  const c = Math.sin(mRad) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * mRad) * (0.019993 - 0.000101 * t)
    + Math.sin(3 * mRad) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(toRad(omega));
  const e0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr = e0 + 0.00256 * Math.cos(toRad(omega));
  const decl = Math.asin(Math.sin(toRad(obliqCorr)) * Math.sin(toRad(lambda)));
  const y = Math.pow(Math.tan(toRad(obliqCorr) / 2), 2);
  const eqTime = 4 * toDeg(
    y * Math.sin(2 * toRad(l0))
    - 2 * e * Math.sin(mRad)
    + 4 * e * y * Math.sin(mRad) * Math.cos(2 * toRad(l0))
    - 0.5 * y * y * Math.sin(4 * toRad(l0))
    - 1.25 * e * e * Math.sin(2 * mRad)
  );
  return { declination: decl, eqTimeMinutes: eqTime };
}

// Returns { sunriseMin, sunsetMin, solarNoonMin, dayLengthHours } in
// minutes-from-local-midnight, or a `note` string for polar day/night.
function sunTimes(year, month, day, lat, lon, tzOffsetHours) {
  const jd = julianDay(year, month, day + 0.5); // noon UTC of that date
  const t = (jd - 2451545.0) / 36525;
  const { declination, eqTimeMinutes } = solarPosition(t);

  const latRad = toRad(lat);
  const cosH = (Math.cos(toRad(90.833)) / (Math.cos(latRad) * Math.cos(declination)))
    - Math.tan(latRad) * Math.tan(declination);

  const solarNoonMin = 720 - 4 * lon - eqTimeMinutes + 60 * tzOffsetHours;

  if (cosH > 1) {
    return { solarNoonMin, note: 'The sun does not rise at this latitude on this date (polar night).' };
  }
  if (cosH < -1) {
    return { solarNoonMin, note: 'The sun does not set at this latitude on this date (midnight sun).' };
  }
  const haDeg = toDeg(Math.acos(cosH));
  const sunriseMin = solarNoonMin - haDeg * 4;
  const sunsetMin = solarNoonMin + haDeg * 4;
  return {
    solarNoonMin,
    sunriseMin,
    sunsetMin,
    dayLengthHours: (haDeg * 4 * 2) / 60,
  };
}

function moonAgeDays(year, month, day) {
  const jd = julianDay(year, month, day + 0.5);
  let age = (jd - JD_NEW_MOON_REF) % SYNODIC_MONTH;
  if (age < 0) age += SYNODIC_MONTH;
  return age;
}

function moonPhaseName(age) {
  const f = age / SYNODIC_MONTH;
  if (f < 1 / 16 || f >= 15 / 16) return 'New Moon';
  if (f < 3 / 16) return 'Waxing Crescent';
  if (f < 5 / 16) return 'First Quarter';
  if (f < 7 / 16) return 'Waxing Gibbous';
  if (f < 9 / 16) return 'Full Moon';
  if (f < 11 / 16) return 'Waning Gibbous';
  if (f < 13 / 16) return 'Last Quarter';
  return 'Waning Crescent';
}

function moonIllumination(age) {
  const theta = (age / SYNODIC_MONTH) * 2 * Math.PI;
  return ((1 - Math.cos(theta)) / 2) * 100;
}

// Illuminated-region path for a moon-phase glyph, radius `r`, drawn
// inside a (2r x 2r) box. phase: 0 = new, 0.5 = full, 1 = new (wrap).
// Standard two-arc construction: an outer semicircle fixed by
// waxing/waning, and an inner terminator ellipse (rx = r*|cos(theta)|)
// whose sweep flips depending on which side of the half-cycle we're in.
function moonPhasePath(phase, r) {
  const theta = phase * 2 * Math.PI;
  const cosTheta = Math.cos(theta);
  const rx = Math.abs(r * cosTheta);
  const top = `${r},0`;
  const bottom = `${r},${2 * r}`;
  let sweep1;
  let sweep2;
  if (phase < 0.5) {
    sweep1 = 1;
    sweep2 = cosTheta > 0 ? 1 : 0;
  } else {
    sweep1 = 0;
    sweep2 = cosTheta > 0 ? 0 : 1;
  }
  return `M ${top} A ${r},${r} 0 0 ${sweep1} ${bottom} A ${rx},${r} 0 0 ${sweep2} ${top} Z`;
}

function minutesToClock(minutes) {
  let m = Math.round(minutes) % 1440;
  let dayOffset = 0;
  if (m < 0) { m += 1440; dayOffset = -1; }
  if (Math.round(minutes) >= 1440) dayOffset = Math.floor(minutes / 1440);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const clock = `${h12}:${String(mm).padStart(2, '0')} ${period}`;
  if (dayOffset === -1) return `${clock} (prev. day)`;
  if (dayOffset === 1) return `${clock} (next day)`;
  if (dayOffset > 1) return `${clock} (+${dayOffset}d)`;
  return clock;
}

function hoursToDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function row(label, value) {
  return `<div class="resultRow"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function currentDateParts() {
  const val = dateInput.value; // "YYYY-MM-DD"
  const [y, mo, d] = val.split('-').map(Number);
  return { y, mo, d };
}

function render() {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const { y, mo, d } = currentDateParts();
  const validDate = Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d);
  const tzOffsetHours = -new Date().getTimezoneOffset() / 60;

  if (!validDate) {
    sunBody.innerHTML = '<div class="placeholder">Enter a date to calculate.</div>';
    moonBody.innerHTML = '<div class="placeholder">Enter a date to calculate.</div>';
    tideBody.innerHTML = '<div class="placeholder">Enter a date to estimate.</div>';
    return;
  }

  const age = moonAgeDays(y, mo, d);
  const phaseName = moonPhaseName(age);
  const illum = moonIllumination(age);
  const r = 44;
  const pathD = moonPhasePath(age / SYNODIC_MONTH, r);
  moonBody.innerHTML = `
    <div class="moonWrap">
      <svg width="${2 * r}" height="${2 * r}" viewBox="0 0 ${2 * r} ${2 * r}">
        <circle cx="${r}" cy="${r}" r="${r - 1}" fill="var(--surface-raised)" stroke="var(--line)" />
        <path d="${pathD}" fill="var(--ink)" />
      </svg>
      <div class="moonInfo">
        ${row('Phase', phaseName)}
        ${row('Illumination', `${illum.toFixed(0)}%`)}
        ${row('Age', `${age.toFixed(1)} days`)}
      </div>
    </div>
  `;

  if (!hasLocation) {
    sunBody.innerHTML = '<div class="placeholder">Enter a latitude and longitude to calculate.</div>';
    tideBody.innerHTML = '<div class="placeholder">Enter a latitude and longitude to estimate.</div>';
    return;
  }

  const sun = sunTimes(y, mo, d, lat, lon, tzOffsetHours);
  if (sun.note) {
    sunBody.innerHTML = `<div class="warn">${sun.note}</div>${row('Solar noon', minutesToClock(sun.solarNoonMin))}`;
  } else {
    sunBody.innerHTML = [
      row('Sunrise', minutesToClock(sun.sunriseMin)),
      row('Solar noon', minutesToClock(sun.solarNoonMin)),
      row('Sunset', minutesToClock(sun.sunsetMin)),
      row('Day length', hoursToDuration(sun.dayLengthHours)),
    ].join('');
  }

  // Rough tide estimate: the moon transits (culminates) at approximately
  // local solar noon at new/full moon, drifting ~50.47 min later per day
  // of lunar age after that. High tides cluster near transit and its
  // antipode (~12h25m later); lows fall roughly halfway between.
  const transitMin = sun.solarNoonMin + age * 50.47;
  const SEMIDIURNAL = 745; // ~12h25m in minutes
  const high1 = transitMin;
  const high2 = transitMin + SEMIDIURNAL;
  const low1 = transitMin + SEMIDIURNAL / 2;
  const low2 = transitMin + 1.5 * SEMIDIURNAL;
  tideBody.innerHTML = [
    row('High tide (approx.)', `~${minutesToClock(high1)}`),
    row('Low tide (approx.)', `~${minutesToClock(low1)}`),
    row('High tide (approx.)', `~${minutesToClock(high2)}`),
    row('Low tide (approx.)', `~${minutesToClock(low2)}`),
  ].join('');
}

function populatePresets() {
  PRESETS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${p.label} (${p.lat.toFixed(2)}, ${p.lon.toFixed(2)})`;
    presetSelect.appendChild(opt);
  });
}

presetSelect.addEventListener('change', () => {
  const idx = presetSelect.value;
  if (idx === '') return;
  const p = PRESETS[Number(idx)];
  latInput.value = p.lat;
  lonInput.value = p.lon;
  render();
});

[latInput, lonInput, dateInput].forEach((el) => el.addEventListener('input', render));

function init() {
  const today = new Date();
  const y = today.getFullYear();
  const mo = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${y}-${mo}-${d}`;
  populatePresets();
  render();
}

init();
