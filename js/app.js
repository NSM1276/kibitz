// App shell: home -> game -> task. Each game module renders & checks its own tasks.
import chess from './games/chess.js';
import pool from './games/pool.js';
import backgammon from './games/backgammon.js';
import skat from './games/skat.js';
import checkers from './games/checkers.js';
import durak from './games/durak.js';

const GAMES = [chess, pool, backgammon, checkers, durak, skat];
for (const g of GAMES) (g.tasks ||= []).sort((a, b) => (a.level || 1) - (b.level || 1)); // easy -> hard (stable)
const app = document.getElementById('app');

// ---------- i18n ----------
const UI = {
  tagline: { en: 'Learn the famous moves by playing them. Then it\'s your turn.', de: 'Lerne die berühmten Züge, indem du sie spielst. Dann bist du dran.' },
  yourTurn: { en: 'Your turn', de: 'Du bist dran' },
  correct: { en: 'Correct!', de: 'Richtig!' },
  wrong: { en: 'Not quite', de: 'Nicht ganz' },
  next: { en: 'Next', de: 'Weiter' },
  retry: { en: 'Try again', de: 'Nochmal' },
  show: { en: 'Show answer', de: 'Lösung zeigen' },
  list: { en: 'All tasks', de: 'Alle Aufgaben' },
  done: { en: 'Pack complete!', de: 'Paket geschafft!' },
  credits: { en: 'Credits', de: 'Credits' },
  reset: { en: 'Reset progress', de: 'Fortschritt löschen' },
  playVs: { en: 'Play vs computer', de: 'Gegen den Computer spielen' },
  play: { en: 'Play', de: 'Spielen' },
  newGame: { en: 'New game', de: 'Neues Spiel' },
  win: { en: 'You win!', de: 'Gewonnen!' },
  lose: { en: 'Computer wins', de: 'Der Computer gewinnt' },
  draw: { en: 'Draw', de: 'Unentschieden' },
  lv: [{ en: 'Easy', de: 'Leicht' }, { en: 'Medium', de: 'Mittel' }, { en: 'Hard', de: 'Schwer' }],
  trainer: { en: 'Trainer tasks', de: 'Trainer-Aufgaben' },
};
let lang = load('lang') || ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
const t = (o) => (o == null ? '' : typeof o === 'string' ? o : (o[lang] ?? o.en ?? ''));

// ---------- storage (never required to work) ----------
function load(k) { try { return JSON.parse(localStorage.getItem('ym:' + k)); } catch { return null; } }
function save(k, v) { try { localStorage.setItem('ym:' + k, JSON.stringify(v)); } catch { /* private mode */ } }
let progress = load('progress') || {};
const isDone = (g, id) => !!(progress[g] && progress[g][id]);
function markDone(g, id) { (progress[g] ||= {})[id] = 1; save('progress', progress); }

// ---------- sound (tiny WebAudio synth, no files) ----------
let ac = null;
function tone(f, d, type = 'sine', v = 0.12, when = 0) {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02);
  } catch { /* no audio */ }
}
const sfx = {
  tap: () => tone(660, 0.05, 'triangle', 0.06),
  move: () => { tone(180, 0.06, 'square', 0.05); tone(120, 0.08, 'sine', 0.12); },
  capture: () => { tone(140, 0.12, 'square', 0.07); tone(90, 0.16, 'sine', 0.16); },
  ok: () => { tone(660, 0.12, 'triangle', 0.1); tone(990, 0.22, 'triangle', 0.1, 0.1); },
  bad: () => { tone(200, 0.18, 'sawtooth', 0.06); tone(150, 0.25, 'sawtooth', 0.05, 0.12); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, i * 0.09)),
  hit: () => { tone(900, 0.03, 'square', 0.08); tone(300, 0.07, 'sine', 0.1); },
  drop: () => { tone(220, 0.15, 'sine', 0.14); tone(110, 0.2, 'sine', 0.1, 0.05); },
};

// ---------- helpers ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
function toast(msg, ms = 1800) {
  const el = h('div', { class: 'toast' }, msg); document.body.append(el);
  setTimeout(() => el.remove(), ms);
}
const langBtn = () => h('button', { class: 'lang', onclick: () => { lang = lang === 'en' ? 'de' : 'en'; save('lang', lang); route(); } }, lang === 'en' ? 'DE' : 'EN');

// ---------- routing via hash: #/ , #/g/chess , #/g/chess/3 ----------
let cleanup = null;
function route() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.documentElement.lang = lang;
  const p = location.hash.replace(/^#\/?/, '').split('/');
  app.innerHTML = '';
  if (p[0] === 'g' && GAMES.find((g) => g.id === p[1])) {
    const g = GAMES.find((x) => x.id === p[1]);
    if (p[2] !== undefined && g.tasks[+p[2]]) return taskScreen(g, +p[2]);
    return gameScreen(g);
  }
  if (p[0] === 'p' && GAMES.find((g) => g.id === p[1] && g.play)) return playScreen(GAMES.find((g) => g.id === p[1]));
  if (p[0] === 'credits') return creditsScreen();
  homeScreen();
}
window.addEventListener('hashchange', route);

function homeScreen() {
  app.append(
    h('div', { class: 'top' }, h('h1', {}, ''), langBtn()),
    h('div', { class: 'hero' }, h('div', { class: 'brand' }, 'Kib', h('span', {}, 'itz')), h('p', {}, t(UI.tagline))),
    h('div', { class: 'games' }, GAMES.map((g) => {
      const n = g.tasks.length, d = g.tasks.filter((x) => isDone(g.id, x.id)).length;
      return h('button', { class: 'gcard g-' + g.id, style: `--gc:${g.color}`, onclick: () => go(n ? `g/${g.id}` : `p/${g.id}`) },
        h('div', { class: 'gicon' }, g.icon),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'gt' }, t(g.title)), h('div', { class: 'gs' }, t(g.tagline)),
          n ? h('div', { class: 'bar' }, h('i', { style: `width:${(100 * d) / n}%` })) : null),
        h('div', { class: 'gp' }, n ? `${d}/${n}` : '▶'));
    })),
    h('div', { class: 'foot' }, h('a', { href: '#/credits' }, t(UI.credits)), ' · ',
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); progress = {}; save('progress', progress); route(); } }, t(UI.reset))),
  );
}

function gameScreen(g) {
  app.append(
    h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go('') }, '←'), h('h1', {}, `${g.icon} ${t(g.title)}`), langBtn()),
    g.play ? h('button', { class: 'btn primary playbig', onclick: () => go(`p/${g.id}`) }, '▶ ' + t(UI.playVs)) : null,
    h('div', { class: 'tlist' }, g.tasks.map((x, i) =>
      h('button', { class: 'titem' + (isDone(g.id, x.id) ? ' done' : ''), onclick: () => go(`g/${g.id}/${i}`) },
        h('div', { class: 'num' }, isDone(g.id, x.id) ? '✓' : String(i + 1)),
        h('div', {}, h('div', { class: 'tt' }, t(x.title))),
        h('div', { class: 'lv' }, '●'.repeat(x.level || 1))))),
  );
}

function creditsScreen() {
  app.append(
    h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go('') }, '←'), h('h1', {}, t(UI.credits)), langBtn()),
    h('div', { class: 'prompt' }, h('div', { class: 'pt', style: 'font-weight:500;font-size:14px' },
      'Chess pieces: "cburnett" set by Colin M.L. Burnett, CC BY-SA 3.0. ',
      'Chess rules: chess.js by Jeff Hlywa, BSD-2-Clause. ',
      'Everything else: original.')),
  );
}

function playScreen(g) {
  const key = 'lv:' + g.id;
  let level = load(key) ?? 1;
  const stage = h('div', { class: 'stage' });
  const hint = h('div', { class: 'hint' });
  const fb = h('div');
  const lvBar = h('div', { class: 'lvbar' });
  const back = g.tasks.length ? `g/${g.id}` : '';
  app.append(
    h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go(back) }, '←'), h('h1', {}, `${g.icon} ${t(g.playTitle || g.title)}`), langBtn()),
    lvBar, stage, hint, fb,
  );
  let stop = null;
  function start() {
    if (stop) { try { stop(); } catch {} }
    stage.innerHTML = ''; fb.innerHTML = ''; hint.textContent = '';
    lvBar.innerHTML = '';
    UI.lv.forEach((name, i) => lvBar.append(h('button', { class: 'lvchip' + (i === level ? ' on' : ''), onclick: () => { level = i; save(key, i); start(); } }, t(name))));
    lvBar.append(h('button', { class: 'lvchip new', onclick: () => start() }, '↻ ' + t(UI.newGame)));
    const ctx = {
      lang, t, sfx, toast, level,
      hint: (msg) => { hint.textContent = msg ? t(msg) : ''; },
      over: ({ result, text }) => {
        const ok = result === 'win';
        ok ? sfx.win() : result === 'lose' ? sfx.bad() : sfx.ok();
        fb.innerHTML = '';
        fb.append(h('div', { class: 'feedback ' + (ok ? 'ok' : result === 'lose' ? 'bad' : '') },
          h('div', { class: 'fh' }, t(UI[result])), text ? h('div', { class: 'fx' }, t(text)) : null,
          h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', onclick: () => start() }, t(UI.newGame)))));
        fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    };
    stop = g.play(stage, ctx) || null;
  }
  start();
  cleanup = () => { if (stop) stop(); };
}

function go(path) { location.hash = '#/' + path; }

function taskScreen(g, i) {
  const task = g.tasks[i];
  const fb = h('div');
  const hint = h('div', { class: 'hint' });
  const stage = h('div', { class: 'stage' });
  app.append(
    h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go(`g/${g.id}`) }, '←'),
      h('h1', {}, t(task.title)), h('span', { class: 'count' }, `${i + 1}/${g.tasks.length}`), langBtn()),
    h('div', { class: 'prompt' }, h('div', { class: 'yt' }, t(UI.yourTurn)), h('div', { class: 'pt' }, t(task.prompt))),
    stage, hint, fb,
  );
  let finished = false;
  const ctx = {
    lang, t, sfx, toast,
    hint: (msg) => { hint.textContent = msg ? t(msg) : ''; },
    // result({ok, text, canRetry})
    result: ({ ok, text, retry = true, reveal = null }) => {
      if (finished && ok) return;
      fb.innerHTML = '';
      if (ok) { finished = true; markDone(g.id, task.id); }
      ok ? sfx.ok() : sfx.bad();
      const last = i + 1 >= g.tasks.length;
      const btns = h('div', { class: 'toolbar' });
      if (!ok && retry) btns.append(h('button', { class: 'btn', onclick: () => route() }, t(UI.retry)));
      if (!ok && reveal) btns.append(h('button', { class: 'btn', onclick: () => { fb.innerHTML = ''; reveal(); } }, t(UI.show)));
      if (ok) btns.append(last
        ? h('button', { class: 'btn primary', onclick: () => go(`g/${g.id}`) }, t(UI.list))
        : h('button', { class: 'btn primary', onclick: () => go(`g/${g.id}/${i + 1}`) }, t(UI.next)));
      fb.append(h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') },
        h('div', { class: 'fh' }, ok ? (last ? '🏆 ' + t(UI.done) : '✓ ' + t(UI.correct)) : '✗ ' + t(UI.wrong)),
        h('div', { class: 'fx' }, t(text)), btns));
      if (ok && last) sfx.win();
      fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
  };
  cleanup = g.mount(stage, task, ctx) || null;
}

route();
