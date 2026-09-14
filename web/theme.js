// Shared dark/light toggle, used identically on every page.
(function() {
  var t = 'dark';
  try { t = localStorage.getItem('ib-shop-theme') || 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
})();

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  function applyLabel(theme) {
    btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ib-shop-theme', next); } catch (e) { /* ignore */ }
    applyLabel(next);
  });
  applyLabel(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
});
