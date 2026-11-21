import tasks from '../../data/skat.js';
import { legal, effSuit, isTrump } from './skatlogic.js';

const SUIT = { C: '♣', S: '♠', H: '♥', D: '♦' };
const SUITNAME = { en: { C: 'clubs', S: 'spades', H: 'hearts', D: 'diamonds' }, de: { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' } };
const RANK = { en: { A: 'A', T: '10', K: 'K', Q: 'Q', J: 'J' }, de: { A: 'A', T: '10', K: 'K', Q: 'D', J: 'B' } };
const ROLE = { en: { partner: 'Partner', declarer: 'Declarer', defender: 'Opponent', me: 'You' }, de: { partner: 'Partner', declarer: 'Alleinspieler', defender: 'Gegner', me: 'Du' } };
const MSG = {
  game: (g, L) => g.type === 'grand' ? 'Grand' : g.type === 'null' ? 'Null' : (L === 'de' ? `${SUITNAME.de[g.trump]}-Spiel ${SUIT[g.trump]}` : `${SUITNAME.en[g.trump][0].toUpperCase() + SUITNAME.en[g.trump].slice(1)} game ${SUIT[g.trump]}`),
  role: { en: { defender: 'You defend', declarer: 'You are declarer' }, de: { defender: 'Du bist Gegenspieler', declarer: 'Du bist Alleinspieler' } },
  pick: { en: 'Tap a card in your hand.', de: 'Tippe eine Karte auf deiner Hand.' },
};

export default {
  id: 'skat', icon: '🃏', color: '#f06292',
  title: { en: 'Skat Card Play', de: 'Skat: Welche Karte?' },
  tagline: { en: 'Which card would you play? Rules and tactics', de: 'Welche Karte spielst du? Regeln und Taktik' },
  tasks,
  mount(stage, task, ctx) {
    const L = ctx.lang;
    const g = task.game;
    const root = document.createElement('div'); root.className = 'skat';
    const seats = task.seats || Object.fromEntries(task.trick.map((x) => [x.who, x.role]));
    if (!seats.left) seats.left = task.me === 'declarer' ? 'defender' : '?';
    if (!seats.right) seats.right = task.me === 'declarer' ? 'defender' : '?';
    root.innerHTML = `<div class="info"><span class="chip">${MSG.game(g, L)}</span><span class="chip">${MSG.role[L][task.me]}</span></div>
      <div class="table"><div class="seat left">◀ ${ROLE[L][seats.left] || ''}</div><div class="seat right">${ROLE[L][seats.right] || ''} ▶</div><div class="trick"></div></div>
      <div class="hand"></div>`;
    stage.append(root);
    const trickEl = root.querySelector('.trick'), handEl = root.querySelector('.hand');
    const SLOT = { left: 'left:6%;top:42px', right: 'right:6%;top:42px', me: 'left:calc(50% - 27px);top:96px' };

    function cardEl(c, tag = 'button') {
      const el = document.createElement(tag); el.className = 'card s' + c[0];
      const r = RANK[L][c[1]] || c[1];
      el.innerHTML = `<span class="r">${r}</span><span class="s">${SUIT[c[0]]}</span><span class="big">${SUIT[c[0]]}</span>`;
      el.title = (L === 'de' ? SUITNAME.de[c[0]] + ' ' : '') + r + (L === 'en' ? ' of ' + SUITNAME.en[c[0]] : '');
      return el;
    }
    // trick already on the table (animated in one by one)
    task.trick.forEach((x, i) => {
      const el = cardEl(x.card, 'div'); el.style.cssText = SLOT[x.who] + ';opacity:0;transform:scale(.8);transition:all .3s';
      const who = document.createElement('div'); who.className = 'who'; who.textContent = ROLE[L][x.role]; el.append(who);
      trickEl.append(el);
      setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'none'; ctx.sfx.slide(); }, 250 + i * 380);
    });

    const legalCards = legal(task.hand, task.trick, g);
    let done = false;
    task.hand.forEach((c) => {
      const el = cardEl(c);
      if (!legalCards.includes(c)) el.classList.add('illegal');
      el.onclick = () => play(c, el);
      handEl.append(el);
    });
    // fan the hand so it always fits on one row
    const fit = () => { const n = handEl.children.length, w = handEl.clientWidth - 8, need = n * 54 + (n - 1) * 6; const ov = need > w ? Math.ceil((need - w) / (n - 1)) + 6 : 0; [...handEl.children].forEach((c, i) => { c.style.marginLeft = i && ov ? `-${ov}px` : ''; }); };
    fit(); window.addEventListener('resize', fit);
    ctx.hint(MSG.pick);

    function illegalWhy(c) {
      const lead = task.trick[0].card, ls = effSuit(lead, g);
      const leadName = ls === 'T' ? (L === 'de' ? 'Trumpf' : 'trumps') : SUITNAME[L][ls];
      let m = L === 'de' ? `Nicht erlaubt: Du musst ${leadName} bedienen.` : `Not allowed: you must follow ${leadName}.`;
      if (c[1] === 'J' && g.type !== 'null' && c[0] === lead[0] && ls !== 'T') m += L === 'de' ? ' Der Bube zählt als Trumpf, nicht als ' + SUITNAME.de[c[0]] + '.' : ` The Jack counts as a trump, not as ${SUITNAME.en[c[0]]}.`;
      else if (isTrump(c, g) && ls !== 'T') m += L === 'de' ? ' Stechen darfst du nur, wenn du nicht bedienen kannst.' : ' You may only trump when you cannot follow suit.';
      return m;
    }

    function play(c, el) {
      if (done) return;
      if (!legalCards.includes(c)) { ctx.sfx.bad(); ctx.toast(illegalWhy(c), 2600); return; }
      done = true;
      const r0 = el.getBoundingClientRect(), tr = trickEl.getBoundingClientRect();
      const fly = cardEl(c, 'div'); fly.style.cssText = SLOT.me + ';transition:transform .35s cubic-bezier(.3,.8,.3,1)';
      const me = document.createElement('div'); me.className = 'who'; me.textContent = ROLE[L].me; fly.append(me);
      trickEl.append(fly);
      const fr = fly.getBoundingClientRect();
      fly.style.transform = `translate(${r0.left - fr.left}px, ${r0.top - fr.top}px)`;
      el.classList.add('played');
      requestAnimationFrame(() => requestAnimationFrame(() => { fly.style.transform = 'none'; }));
      void tr; ctx.sfx.card(); ctx.hint('');
      setTimeout(() => {
        const ok = task.accept.includes(c);
        const why = !ok && task.why && task.why[c];
        window.removeEventListener('resize', fit);
        ctx.result({ ok, text: ok ? task.explain : { en: `${why ? why.en + ' ' : ''}${task.explain.en}`, de: `${why ? why.de + ' ' : ''}${task.explain.de}` } });
      }, 450);
    }
    return () => window.removeEventListener('resize', fit);
  },
};
