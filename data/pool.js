// Pool aiming tasks. Table playing surface W x H (portrait). Positions are generated from the
// object ball, the target pocket and the cut angle, so every task is solvable by construction.
// assist: 'ghost' = shows the ghost ball while aiming, 'line' = shows the aim line, 'none' = cue only.
const frac = (deg) => Math.round((1 - Math.sin((deg * Math.PI) / 180)) * 100);
const cutText = (deg) => ({
  en: deg === 0
    ? 'Straight shot: hit the object ball dead centre and follow the line to the pocket.'
    : `Cut angle ${deg}°. Aim at the ghost ball: the spot where the cue ball must be at contact, one ball-width behind the object ball on the pocket line. That is a ${frac(deg)}% ball hit${deg === 30 ? ': the classic half-ball hit, centre of the cue ball at the edge of the object ball' : ''}.`,
  de: deg === 0
    ? 'Gerader Stoß: Triff die Objektkugel genau mittig und folge der Linie zur Tasche.'
    : `Schnittwinkel ${deg}°. Ziele auf die Geisterkugel: dort muss die Weiße beim Kontakt liegen, eine Kugelbreite hinter der Objektkugel auf der Taschenlinie. Das ist ein ${frac(deg)}%-Treffer${deg === 30 ? ': der klassische Halbkugel-Treffer, Mitte der Weißen auf den Rand der Objektkugel' : ''}.`,
});

export default [
  { id: 'straight', level: 1, pocket: 'tl', ob: [95, 150], cut: 0, cueDist: 260, ball: 1, assist: 'ghost', tol: 34,
    title: { en: 'Straight In', de: 'Gerade rein' },
    prompt: { en: 'Drag to aim, then shoot. Sink the yellow 1 in the top-left pocket.', de: 'Ziehen zum Zielen, dann stoßen. Versenke die gelbe 1 oben links.' } },
  { id: 'cut15', level: 1, pocket: 'tl', ob: [110, 170], cut: 15, cueDist: 240, ball: 2, assist: 'ghost', tol: 32,
    title: { en: 'Small Cut (15°)', de: 'Kleiner Schnitt (15°)' },
    prompt: { en: 'Don\'t aim at the ball. Aim at the ghost ball behind it.', de: 'Ziele nicht auf die Kugel, sondern auf die Geisterkugel dahinter.' } },
  { id: 'half-ball', level: 2, pocket: 'tr', ob: [230, 160], cut: -30, cueDist: 230, ball: 3, assist: 'line', tol: 30,
    title: { en: 'Half-Ball Hit (30°)', de: 'Halbkugel-Treffer (30°)' },
    prompt: { en: 'A 30° cut into the top-right pocket. Where do you aim?', de: 'Ein 30°-Schnitt in die Tasche oben rechts. Wohin zielst du?' } },
  { id: 'side', level: 2, pocket: 'ml', ob: [80, 360], cut: 20, cueDist: 220, ball: 4, assist: 'line', tol: 20,
    title: { en: 'Side Pocket', de: 'Mitteltasche' },
    prompt: { en: 'Side pockets are narrow. Sink the 4 in the left side pocket.', de: 'Mitteltaschen sind eng. Versenke die 4 links in der Mitte.' } },
  { id: 'cut45', level: 3, pocket: 'tl', ob: [140, 190], cut: 45, cueDist: 200, ball: 5, assist: 'line',
    title: { en: 'Big Cut (45°)', de: 'Großer Schnitt (45°)' },
    prompt: { en: 'Only a quarter of the ball. Cut the 5 into the top-left.', de: 'Nur ein Viertel der Kugel. Schneide die 5 oben links rein.' } },
  { id: 'long', level: 3, pocket: 'bl', ob: [70, 560], cut: -12, cueDist: 330, ball: 6, assist: 'none',
    title: { en: 'Long Pot', de: 'Langer Stoß' },
    prompt: { en: 'No helpers now. A long pot into the bottom-left pocket.', de: 'Jetzt ohne Hilfe. Ein langer Stoß in die Tasche unten links.' } },
  { id: 'cut45b', level: 4, pocket: 'br', ob: [250, 520], cut: 45, cueDist: 210, ball: 7, assist: 'none',
    title: { en: 'Cut Without Helpers', de: 'Schnitt ohne Hilfe' },
    prompt: { en: 'A 45° cut into the bottom-right. Trust the ghost ball.', de: 'Ein 45°-Schnitt unten rechts. Vertrau der Geisterkugel.' } },
  { id: 'thin', level: 4, pocket: 'tr', ob: [250, 130], cut: 60, cueDist: 200, ball: 8, assist: 'none', tol: 28,
    title: { en: 'Thin Cut (60°)', de: 'Dünner Schnitt (60°)' },
    prompt: { en: 'The black 8, thin cut into the top-right. Barely touch it.', de: 'Die schwarze 8, dünn in die Tasche oben rechts. Kaum berühren.' } },
  { id: 'cut20', level: 2, pocket: 'br', ob: [255, 545], cut: -20, cueDist: 250, ball: 9, assist: 'ghost', tol: 30,
    title: { en: 'Cut to the Corner (20°)', de: 'Schnitt in die Ecke (20°)' },
    prompt: { en: 'The striped 9 into the bottom-right pocket.', de: 'Die halbe 9 in die Tasche unten rechts.' } },
  { id: 'side-cut', level: 3, pocket: 'mr', ob: [255, 300], cut: -35, cueDist: 210, ball: 10, assist: 'line',
    title: { en: 'Side Pocket Cut (35°)', de: 'Schnitt in die Mitte (35°)' },
    prompt: { en: 'Cut the 10 into the right side pocket. The angle makes it narrower.', de: 'Schneide die 10 rechts in die Mitteltasche. Der Winkel macht sie enger.' } },
  { id: 'cut30b', level: 3, pocket: 'bl', ob: [90, 520], cut: 30, cueDist: 230, ball: 11, assist: 'none',
    title: { en: 'Half-Ball, No Helpers', de: 'Halbkugel ohne Hilfe' },
    prompt: { en: 'Another half-ball hit, now with no aiming line. Bottom-left pocket.', de: 'Wieder ein Halbkugel-Treffer, jetzt ohne Ziellinie. Tasche unten links.' } },
  { id: 'thin-long', level: 4, pocket: 'tl', ob: [140, 140], cut: 50, cueDist: 300, ball: 12, assist: 'none', tol: 34,
    title: { en: 'Long Thin Cut (50°)', de: 'Langer dünner Schnitt (50°)' },
    prompt: { en: 'The hardest one: a long, thin cut into the top-left.', de: 'Die schwerste: ein langer, dünner Schnitt oben links.' } },
].map((x) => ({ ...x, explain: cutText(Math.abs(x.cut)) }));
