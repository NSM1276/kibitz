// Skat rules needed for "which card do you play?" tasks.
// Card code = suit + rank. Suits: C Kreuz, S Pik, H Herz, D Karo. Ranks: A T(10) K Q J 9 8 7.
// game = { type: 'suit', trump: 'H' } | { type: 'grand' } | { type: 'null' }
export const isTrump = (c, game) => game.type !== 'null' && (c[1] === 'J' || (game.type === 'suit' && c[0] === game.trump));
export const effSuit = (c, game) => (isTrump(c, game) ? 'T' : c[0]);
export function legal(hand, trick, game) {
  if (!trick.length) return hand.slice();
  const lead = effSuit(trick[0].card, game);
  const follow = hand.filter((c) => effSuit(c, game) === lead);
  return follow.length ? follow : hand.slice();
}
export const POINTS = { A: 11, T: 10, K: 4, Q: 3, J: 2, 9: 0, 8: 0, 7: 0 };
