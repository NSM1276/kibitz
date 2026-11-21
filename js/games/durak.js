// Durak (podkidnoy, 36 cards, you vs computer).
import { flipRender } from './flip.js';
const SUITS = ['S', 'C', 'D', 'H'];
const RANKS = ['6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SYM = { C: '♣', S: '♠', H: '♥', D: '♦' };
const RN = { en: { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' }, de: { T: '10', J: 'B', Q: 'D', K: 'K', A: 'A' } };
const rv = (c) => RANKS.indexOf(c[1]);
const MSG = {
  hintBtn: { en: 'Hint', de: 'Tipp' }, bito: { en: 'Discard', de: 'Ablage' }, tipTake: { en: 'Better take the cards.', de: 'Besser aufnehmen.' }, tipDone: { en: 'Nothing good to add: tap Done.', de: 'Nichts Gutes nachzulegen: tippe auf Fertig.' },
  attack: { en: 'You attack: play any card.', de: 'Du greifst an: Spiele eine beliebige Karte.' },
  addMore: { en: 'Add a card of the same rank, or tap “Done”.', de: 'Lege eine Karte gleichen Werts nach oder tippe „Fertig“.' },
  defend: { en: 'Beat the card: higher of the same suit, or a trump. Or take.', de: 'Stich die Karte: höher in derselben Farbe oder Trumpf. Oder nimm auf.' },
  cant: { en: 'That card cannot beat it.', de: 'Diese Karte sticht nicht.' },
  noRank: { en: 'Only ranks that are already on the table.', de: 'Nur Werte, die schon auf dem Tisch liegen.' },
  full: { en: 'No more cards can be added.', de: 'Mehr Karten gehen nicht.' },
  cpuTakes: { en: 'Computer takes the cards.', de: 'Der Computer nimmt auf.' },
  youTake: { en: 'You take the cards.', de: 'Du nimmst auf.' },
  beaten: { en: 'Beaten, discarded.', de: 'Geschlagen, abgeworfen.' },
  winText: { en: 'You got rid of all your cards. The computer is the durak (fool)!', de: 'Du bist alle Karten los. Der Computer ist der Durak (Dummkopf)!' },
  loseText: { en: 'You are left holding cards: you are the durak this time.', de: 'Du hast noch Karten: Diesmal bist du der Durak.' },
  drawText: { en: 'Both out of cards at the same time.', de: 'Beide gleichzeitig ohne Karten.' },
  done: { en: 'Done', de: 'Fertig' }, take: { en: 'Take', de: 'Aufnehmen' },
  trump: { en: 'Trump', de: 'Trumpf' },
};

function deck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(s + r); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }

export default {
  id: 'durak', icon: '🂡', color: '#d08a5a',
  title: { en: 'Durak', de: 'Durak' },
  playTitle: { en: 'Durak vs computer', de: 'Durak gegen Computer' },
  tagline: { en: 'The classic card game: don\'t be the fool', de: 'Der Kartenklassiker: Sei nicht der Dummkopf' },
  tasks: [],
  play(stage, ctx) {
    const L = ctx.lang;
    let alive = true;
    const timers = [];
    const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };
    const talon = deck();
    const trumpCard = talon[0];            // bottom card, drawn last
    const T = trumpCard[0];
    const hands = { me: [], cpu: [] };
    let attacker = 'me', table = [], limit = 6, phase = 'attack', taking = false, busy = false, bito = 0, tip = null;
    const beats = (a, d) => (d[0] === a[0] && rv(d) > rv(a)) || (d[0] === T && a[0] !== T);
    const val = (c) => rv(c) + (c[0] === T ? 10 : 0);
    const sortHand = (h) => h.sort((a, b) => (a[0] === T) - (b[0] === T) || SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]) || rv(a) - rv(b));
    function draw(who) { while (hands[who].length < 6 && talon.length) hands[who].push(talon.pop()); }
    draw('me'); draw('cpu');
    ctx.sfx.shuffle();
    // lowest trump starts
    const lowT = (h) => Math.min(...h.filter((c) => c[0] === T).map(rv), 99);
    attacker = lowT(hands.cpu) < lowT(hands.me) ? 'cpu' : 'me';

    const root = document.createElement('div'); root.className = 'durak';
    root.innerHTML = `<div class="dk-top"><div class="dk-cnt"></div><div class="dk-opp"></div><div class="dk-bito"></div></div><div class="dk-mid"><div class="dk-talon"></div><div class="dk-table"></div></div><div class="dk-btns"></div><div class="dk-hand"></div>`;
    stage.append(root);
    const oppEl = root.querySelector('.dk-opp'), talonEl = root.querySelector('.dk-talon'), tableEl = root.querySelector('.dk-table'), handEl = root.querySelector('.dk-hand'), btnEl = root.querySelector('.dk-btns');
    const cntEl = root.querySelector('.dk-cnt'), bitoEl = root.querySelector('.dk-bito');

    function cardEl(c, tag = 'div') {
      const el = document.createElement(tag); el.className = 'card s' + c[0]; el.dataset.k = c;
      const r = RN[L][c[1]] || c[1];
      el.innerHTML = `<span class="r">${r}</span><span class="s">${SYM[c[0]]}</span><span class="big">${SYM[c[0]]}</span>`;
      return el;
    }
    const back = (k) => { const el = document.createElement('div'); el.className = 'card back'; if (k) el.dataset.k = k; return el; };
    const rankOnTable = () => new Set(table.flatMap((p) => [p.a, p.d].filter(Boolean).map((c) => c[1])));
    const unbeaten = () => table.filter((p) => !p.d);
    const defender = () => (attacker === 'me' ? 'cpu' : 'me');

    // every change re-renders once; cards glide from where they were (FLIP), new ones fly in from the deck,
    // beaten ones sweep off to the side
    function render() {
      flipRender(root, build, {
        origin: () => talonEl.querySelector('.pile') || talonEl.querySelector('.trumpcard') || talonEl,
        discard: () => { const r = bitoEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
        onBorn: (i) => { setTimeout(() => alive && ctx.sfx.slide(), i * 70); },
        order: (el) => { const box = el.parentElement, i = [...box.children].indexOf(el); return box === oppEl ? 2 * i : box === handEl ? 2 * i + 1 : 100 + i; },
      });
    }
    function build() {
      oppEl.innerHTML = ''; hands.cpu.forEach((c) => oppEl.append(back(c)));
      cntEl.textContent = hands.cpu.length; cntEl.classList.toggle('few', hands.cpu.length <= 2 && !talon.length);
      bitoEl.innerHTML = bito ? '<i></i><i></i><i></i><b>' + bito + '</b>' : ''; bitoEl.title = t(MSG.bito);
      talonEl.innerHTML = '';
      if (talon.length) {
        const tc = cardEl(trumpCard); tc.classList.add('trumpcard'); talonEl.append(tc);
        if (talon.length > 1) { const bk = back(); bk.classList.add('pile'); bk.dataset.n = talon.length; talonEl.append(bk); }
      } else { const s = document.createElement('div'); s.className = 'dk-trumpsym s' + T; s.textContent = SYM[T]; talonEl.append(s); }
      const lab = document.createElement('div'); lab.className = 'dk-lab'; lab.textContent = `${t(MSG.trump)} ${SYM[T]} · ${talon.length}`; talonEl.append(lab);
      tableEl.innerHTML = '';
      table.forEach((p) => { const pair = document.createElement('div'); pair.className = 'dk-pair'; pair.append(cardEl(p.a)); if (p.d) { const d = cardEl(p.d); d.classList.add('cover'); pair.append(d); } tableEl.append(pair); });
      handEl.innerHTML = '';
      sortHand(hands.me).forEach((c) => {
        const el = cardEl(c, 'button');
        if (!busy && !playable(c)) el.classList.add('illegal'); else if (!busy) el.classList.add('ok');
        if (!busy && tip === c) el.classList.add('tip');
        el.onclick = () => tapCard(c); handEl.append(el);
      });
      fit();
      btnEl.innerHTML = '';
      if (tools) tools.set('hint', !busy && !taking);
      if (busy) return;
      if (attacker === 'me' && table.length && !unbeaten().length && !taking) btnEl.append(btn(MSG.done, () => endBout()));
      if (attacker === 'me' && taking) btnEl.append(btn(MSG.done, () => endBout()));
      if (attacker === 'cpu' && unbeaten().length && !taking) btnEl.append(btn(MSG.take, () => { taking = true; ctx.hint(MSG.youTake); render(); later(cpuAttack, 600); }));
    }
    const t = ctx.t;
    function btn(label, fn) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = t(label); b.onclick = fn; return b; }
    function fit() { const n = handEl.children.length, w = handEl.clientWidth - 8, cw = handEl.firstElementChild?.offsetWidth || 54, need = n * cw + (n - 1) * 6; const ov = need > w && n > 1 ? Math.ceil((need - w) / (n - 1)) + 6 : 0; [...handEl.children].forEach((c, i) => { c.style.marginLeft = i && ov ? `-${ov}px` : ''; }); }
    window.addEventListener('resize', fit);

    function canAdd() { const defCards = hands[defender()].length; return table.length < limit && unbeaten().length < defCards + 0 && (table.length === 0 || true); }
    function playable(c) {
      if (attacker === 'me') {
        if (!table.length) return true;
        return rankOnTable().has(c[1]) && table.length < limit && unbeaten().length < hands.cpu.length;
      }
      if (taking) return false;
      return unbeaten().some((p) => beats(p.a, c));
    }
    function tapCard(c) {
      if (busy) return;
      tip = null;
      if (attacker === 'me') {
        if (table.length && !rankOnTable().has(c[1])) return ctx.toast(t(MSG.noRank));
        if (table.length && !(table.length < limit && unbeaten().length < hands.cpu.length)) return ctx.toast(t(MSG.full));
        hands.me.splice(hands.me.indexOf(c), 1); table.push({ a: c, d: null }); ctx.sfx.card();
        if (taking) { render(); ctx.hint(MSG.addMore); return; }
        busy = true; render();
        later(cpuDefend, 650);
      } else {
        if (taking) return;
        const target = unbeaten().find((p) => beats(p.a, c));
        if (!target) return ctx.toast(t(MSG.cant));
        hands.me.splice(hands.me.indexOf(c), 1); target.d = c; ctx.sfx.card();
        busy = true; render();
        later(cpuAttack, 650);
      }
    }
    // ----- computer -----
    function cpuDefend() {
      const open = unbeaten();
      for (const p of open) {
        const opts = hands.cpu.filter((c) => beats(p.a, c)).sort((a, b) => val(a) - val(b));
        let pick = opts[0];
        // avoid burning a big trump early on a cheap card (easier levels give in more)
        if (pick && pick[0] === T && p.a[0] !== T && talon.length > 6 && rv(pick) >= 5 + ctx.level && rv(p.a) < 4) pick = null;
        if (!pick) { taking = true; ctx.hint(MSG.cpuTakes); busy = false; render(); return; }
        hands.cpu.splice(hands.cpu.indexOf(pick), 1); p.d = pick; ctx.sfx.card();
      }
      busy = false; render(); ctx.hint(MSG.addMore);
    }
    function cpuAttack() {
      // first card of a bout, or a throw-in while the human defends / takes
      const ranks = rankOnTable();
      const room = table.length < limit && unbeaten().length < hands.me.length + (taking ? 0 : 0);
      let opts = hands.cpu.filter((c) => !table.length || ranks.has(c[1]));
      opts.sort((a, b) => val(a) - val(b));
      if (table.length) opts = opts.filter((c) => c[0] !== T || talon.length === 0); // keep trumps for later
      if (table.length && ctx.level === 0) opts = opts.slice(0, 1);
      const c = room ? opts[0] : null;
      if (c && (table.length === 0 || val(c) < 8 || talon.length === 0)) {
        hands.cpu.splice(hands.cpu.indexOf(c), 1); table.push({ a: c, d: null }); ctx.sfx.card();
        busy = false;
        if (taking) { render(); later(cpuAttack, 450); return; }
        ctx.hint(MSG.defend); render(); return;
      }
      // nothing more to add
      endBout();
    }
    function endBout() {
      busy = true;
      const def = defender();
      if (taking) {
        hands[def].push(...table.flatMap((p) => [p.a, p.d].filter(Boolean)));
        ctx.hint(def === 'me' ? MSG.youTake : MSG.cpuTakes);
      } else { ctx.hint(MSG.beaten); bito += table.length * 2; }
      const tookIt = taking;
      table = []; taking = false;
      ctx.sfx.slide(); setTimeout(() => ctx.sfx.slide(), 220);
      draw(attacker); draw(def);
      if (!tookIt) attacker = def;
      render();
      later(() => {
        if (checkEnd()) return;
        limit = 6;
        busy = false;
        if (attacker === 'cpu') { busy = true; render(); later(cpuAttack, 500); }
        else { ctx.hint(MSG.attack); render(); }
      }, 700);
    }
    function checkEnd() {
      if (talon.length) return false;
      const m = hands.me.length === 0, c = hands.cpu.length === 0;
      if (!m && !c) return false;
      busy = true; render();
      ctx.over(m && c ? { result: 'draw', text: MSG.drawText } : m ? { result: 'win', text: MSG.winText } : { result: 'lose', text: MSG.loseText });
      return true;
    }
    // hint: the card a good player would lay now (cheapest attack, cheapest beat), or advise to take / stop
    function suggest() {
      if (attacker === 'me') {
        const ok = hands.me.filter(playable).sort((a, b) => val(a) - val(b));
        const c = ok[0];
        if (!c || (table.length && (c[0] === T || rv(c) >= 7) && talon.length)) return { say: table.length ? MSG.tipDone : null };
        return { card: c };
      }
      const p = unbeaten()[0]; if (!p) return {};
      const opts = hands.me.filter((c) => beats(p.a, c)).sort((a, b) => val(a) - val(b));
      return opts.length ? { card: opts[0] } : { say: MSG.tipTake };
    }
    let tools = null;
    tools = ctx.tools([{ id: 'hint', icon: '💡', label: MSG.hintBtn, fn: () => {
      if (busy || taking) return;
      const s = suggest(); tip = s.card || null;
      if (s.say) ctx.toast(t(s.say));
      build();
    } }]);
    stage.append(tools);
    window.__dkdbg = () => ({ busy, attacker, taking, bito, tip, table: table.length, me: hands.me.length, cpu: hands.cpu.length, talon: talon.length });
    if (attacker === 'cpu') busy = true;
    render();
    if (attacker === 'cpu') later(cpuAttack, 1300); else ctx.hint(MSG.attack);
    return () => { alive = false; timers.forEach(clearTimeout); window.removeEventListener('resize', fit); };
  },
};
