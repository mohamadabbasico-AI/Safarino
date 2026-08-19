/**
 * Contrast audit, computed from the stylesheet rather than the browser.
 *
 * Measuring this live proved unreliable: a hidden or busy renderer defers
 * style recalc, so readings came back one theme behind and produced both
 * false passes and false failures. The tokens are the source of truth, so
 * the ratios are derived from them directly.
 */
const fs = require('fs');

const css = fs.readFileSync('index.html', 'utf8').split('<style>')[1].split('</style>')[0];

function hex(c) {
  c = c.trim();
  const m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const r = c.match(/rgba?\(([^)]+)\)/);
  if (r) {
    const p = r[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  }
  return null;
}
const lum = c => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const ratio = (a, b) => {
  const p = lum(a), q = lum(b);
  return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05);
};
const over = (fg, bg) => {
  const a = fg.a === undefined ? 1 : fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
};

// pull the token block for a theme (":root" for the default)
function tokens(sel) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}');
  const m = css.match(re);
  if (!m) return {};
  const out = {};
  m[1].replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_, k, v) => { out[k] = v.trim(); return ''; });
  return out;
}

const base = tokens(':root');
const themes = {
  night:  {},                          // night is the base
  pastel: tokens('[data-theme="pastel"]'),
  day:    tokens('[data-theme="day"]'),
  sunset: tokens('[data-theme="sunset"]'),
  ocean:  tokens('[data-theme="ocean"]'),
  forest: tokens('[data-theme="forest"]')
};

// text token x surface token pairs the UI actually renders
const PAIRS = [
  ['--text-muted',     '--bg-secondary', 'muted on card'],
  ['--text-muted',     '--bg-primary',   'muted on page'],
  ['--text-muted',     '--bg-tertiary',  'muted on row'],
  ['--text-secondary', '--bg-secondary', 'secondary on card'],
  ['--text-secondary', '--bg-tertiary',  'secondary on row'],
  ['--text-primary',   '--bg-secondary', 'primary on card']
];

let failures = 0;
console.log('theme    ratio   pair');
console.log('-------  ------  ------------------');
for (const [name, t] of Object.entries(themes)) {
  const get = k => hex((t[k] !== undefined ? t[k] : base[k]) || '#000');
  let worst = Infinity, worstPair = '';
  for (const [fgK, bgK, label] of PAIRS) {
    const bg = get(bgK), fg = get(fgK);
    if (!bg || !fg) continue;
    const r = ratio(over(fg, bg), bg);
    if (r < worst) { worst = r; worstPair = label; }
  }
  const ok = worst >= 4.5;
  if (!ok) failures++;
  console.log(
    name.padEnd(8) + worst.toFixed(2).padStart(6) + '  ' + worstPair + (ok ? '' : '   <-- BELOW AA')
  );
}
console.log(failures ? '\nFAIL: ' + failures + ' theme(s) below WCAG AA 4.5:1'
                     : '\nOK: all themes meet WCAG AA for body text');
process.exit(failures ? 1 : 0);
