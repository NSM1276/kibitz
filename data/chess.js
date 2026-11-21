// Chess trap tasks. setup = moves auto-played (SAN) from the start position.
// line = alternating moves starting with the USER's move; opponent replies are auto-played.
// accept (optional, first user move only): list of SAN moves that also count as correct.
// mateOk: any checkmating move counts on the final step.
export default [
  {
    id: 'fools-mate', level: 1, user: 'b',
    title: { en: "Fool's Mate", de: 'Narrenmatt' },
    setup: ['f3', 'e5', 'g4'],
    line: ['Qh4#'], mateOk: true,
    prompt: { en: 'White weakened the king twice. Mate in 1.', de: 'Weiß hat den König zweimal geschwächt. Matt in 1.' },
    explain: {
      en: 'f3 and g4 opened the diagonal e1–h4. Qh4 is mate in just two moves: the fastest mate in chess.',
      de: 'f3 und g4 öffnen die Diagonale e1–h4. Dh4 ist Matt nach nur zwei Zügen: das schnellste Matt im Schach.'
    }
  },
  {
    id: 'scholars-mate', level: 1, user: 'w',
    title: { en: "Scholar's Mate", de: 'Schäfermatt' },
    setup: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'],
    line: ['Qxf7#'], mateOk: true,
    prompt: { en: 'Black attacked your queen and forgot f7. Mate in 1.', de: 'Schwarz greift deine Dame an und vergisst f7. Matt in 1.' },
    explain: {
      en: 'Queen and bishop both hit f7, which only the king defends. Qxf7 is mate: the classic beginner trap.',
      de: 'Dame und Läufer zielen auf f7, das nur der König deckt. Dxf7 ist Matt: die klassische Anfängerfalle.'
    }
  },
  {
    id: 'scholars-defence', level: 1, user: 'b',
    title: { en: "Stop Scholar's Mate", de: 'Schäfermatt verhindern' },
    setup: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5'],
    line: ['g6'], accept: ['g6', 'Qe7', 'Qf6'],
    prompt: { en: 'White threatens Qxf7#. Find a safe defence.', de: 'Weiß droht Dxf7#. Finde eine sichere Verteidigung.' },
    explain: {
      en: 'g6 blocks the queen and kicks it next move. Qe7 and Qf6 also guard f7. Nf6?? loses to Qxf7#.',
      de: 'g6 sperrt die Dame und jagt sie im nächsten Zug. De7 und Df6 decken f7 ebenfalls. Sf6?? verliert gegen Dxf7#.'
    }
  },
  {
    id: 'smothered-caro', level: 2, user: 'w',
    title: { en: 'Smothered Mate (Caro-Kann)', de: 'Ersticktes Matt (Caro-Kann)' },
    setup: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nd7', 'Qe2', 'Ngf6'],
    line: ['Nd6#'], mateOk: true,
    prompt: { en: 'The black king is boxed in by its own pieces. Mate in 1.', de: 'Der schwarze König ist von eigenen Figuren eingesperrt. Matt in 1.' },
    explain: {
      en: 'Nd6 is double trouble: the knight checks, the e-pawn is pinned by your queen, and the king has no squares. Mate.',
      de: 'Sd6: Der Springer gibt Schach, der e-Bauer ist durch die Dame gefesselt, der König hat keine Felder. Matt.'
    }
  },
  {
    id: 'petrov-queen', level: 2, user: 'w',
    title: { en: 'Petrov Queen Trap', de: 'Damenfalle im Russischen' },
    setup: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'Nxe4', 'Qe2', 'Nf6'],
    line: ['Nc6+'],
    prompt: { en: 'Black copied your moves once too often. Win the queen.', de: 'Schwarz hat einmal zu oft nachgemacht. Gewinne die Dame.' },
    explain: {
      en: 'Nc6+ is a discovered check from your queen on e2, and the knight attacks the queen on d8. Black must answer the check and loses the queen.',
      de: 'Sc6+ ist ein Abzugsschach der Dame auf e2, und der Springer greift die Dame auf d8 an. Schwarz muss das Schach parieren und verliert die Dame.'
    }
  },
  {
    id: 'legal', level: 3, user: 'w',
    title: { en: "Légal's Mate", de: 'Seekadettenmatt' },
    setup: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6'],
    line: ['Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#'], mateOk: true,
    prompt: { en: 'Your knight is pinned to the queen. Ignore the pin!', de: 'Dein Springer ist an die Dame gefesselt. Ignoriere die Fesselung!' },
    explain: {
      en: 'Give up the queen: Nxe5! If Black takes it, Bxf7+ Ke7 and Nd5 is mate with three minor pieces.',
      de: 'Opfere die Dame: Sxe5! Nimmt Schwarz sie, folgt Lxf7+ Ke7 und Sd5 matt mit drei Leichtfiguren.'
    }
  },
  {
    id: 'stafford', level: 3, user: 'b',
    title: { en: 'Stafford Gambit Trap', de: 'Stafford-Gambit-Falle' },
    setup: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'Nc6', 'Nxc6', 'dxc6', 'd3', 'Bc5', 'Bg5'],
    line: ['Nxe4', 'Bxd8', 'Bxf2+', 'Ke2', 'Bg4#'], mateOk: true,
    prompt: { en: 'White pinned your knight to the queen. Let the queen go!', de: 'Weiß fesselt deinen Springer an die Dame. Gib die Dame her!' },
    explain: {
      en: 'Nxe4! offers the queen. After Bxd8 Bxf2+ Ke2 the bishop on g4 delivers mate.',
      de: 'Sxe4! bietet die Dame an. Nach Lxd8 Lxf2+ Ke2 setzt der Läufer auf g4 matt.'
    }
  },
  {
    id: 'blackburne', level: 3, user: 'b',
    title: { en: 'Blackburne Shilling Trap', de: 'Blackburne-Shilling-Falle' },
    setup: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5'],
    line: ['Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#'], mateOk: true,
    prompt: { en: 'White grabbed your e5 pawn. Punish the greed.', de: 'Weiß hat den Bauern e5 geschlagen. Bestrafe die Gier.' },
    explain: {
      en: 'Qg5! hits the knight and g2 at once. White keeps grabbing and walks into Nf3, a smothered mate.',
      de: 'Dg5! greift Springer und g2 gleichzeitig an. Weiß nimmt weiter und läuft in Sf3, ein ersticktes Matt.'
    }
  },
  {
    id: 'englund', level: 4, user: 'b',
    title: { en: 'Englund Gambit Trap', de: 'Englund-Gambit-Falle' },
    setup: ['d4', 'e5', 'dxe5', 'Nc6', 'Nf3', 'Qe7', 'Bf4'],
    line: ['Qb4+', 'Bd2', 'Qxb2', 'Bc3', 'Bb4', 'Qd2', 'Bxc3', 'Qxc3', 'Qc1#'], mateOk: true,
    prompt: { en: 'White developed the bishop to f4. Check, then go for the rook.', de: 'Weiß hat den Läufer nach f4 entwickelt. Schach geben, dann zum Turm.' },
    explain: {
      en: 'Qb4+ forks king and b2. After Bd2 Qxb2 Bc3 Bb4! the queen trade fails: Qc1 is mate on the back rank.',
      de: 'Db4+ greift König und b2 an. Nach Ld2 Dxb2 Lc3 Lb4! klappt der Damentausch nicht: Dc1 ist Grundreihenmatt.'
    }
  },
  {
    id: 'damiano', level: 2, user: 'w',
    title: { en: 'Damiano Defence Punished', de: 'Damiano-Verteidigung bestraft' },
    setup: ['e4', 'e5', 'Nf3', 'f6'],
    line: ['Nxe5', 'fxe5', 'Qh5+', 'g6', 'Qxe5+'],
    prompt: { en: '2...f6 is a famous mistake. Sacrifice and win the rook!', de: '2...f6 ist ein berühmter Fehler. Opfere und gewinne den Turm!' },
    explain: {
      en: 'Nxe5! fxe5? Qh5+ g6 Qxe5+ forks king and rook on h8. f6 never protects e5.',
      de: 'Sxe5! fxe5? Dh5+ g6 Dxe5+ greift König und Turm h8 an. f6 schützt e5 nicht wirklich.'
    }
  },
  {
    id: 'kieninger', level: 3, user: 'b',
    title: { en: 'Kieninger Trap (Budapest)', de: 'Kieninger-Falle (Budapester)' },
    setup: ['d4', 'Nf6', 'c4', 'e5', 'dxe5', 'Ng4', 'Bf4', 'Nc6', 'Nf3', 'Bb4+', 'Nbd2', 'Qe7', 'a3'],
    line: ['Ngxe5', 'axb4', 'Nd3#'], mateOk: true,
    prompt: { en: 'White wants to grab your bishop. Let them!', de: 'Weiß will deinen Läufer schlagen. Lass ihn!' },
    explain: {
      en: 'Ngxe5! If axb4?? then Nd3 is smothered mate: the e2 pawn is pinned by your queen and cannot take.',
      de: 'Sgxe5! Nach axb4?? ist Sd3 ersticktes Matt: Der Bauer e2 ist durch deine Dame gefesselt.'
    }
  },
  {
    id: 'elephant', level: 3, user: 'b',
    title: { en: 'Elephant Trap', de: 'Elefantenfalle' },
    setup: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Nbd7', 'cxd5', 'exd5', 'Nxd5'],
    line: ['Nxd5', 'Bxd8', 'Bb4+', 'Qd2', 'Bxd2+', 'Kxd2', 'Kxd8'],
    prompt: { en: 'White grabbed d5, thinking your knight is pinned. It isn\'t!', de: 'Weiß schlägt d5 und glaubt, dein Springer sei gefesselt. Ist er nicht!' },
    explain: {
      en: 'Nxd5! gives the queen, but Bb4+ forces Qd2, Bxd2+ Kxd2 Kxd8. You end up a whole piece ahead.',
      de: 'Sxd5! gibt die Dame, aber Lb4+ erzwingt Dd2, Lxd2+ Kxd2 Kxd8. Du hast eine ganze Figur mehr.'
    }
  },
  {
    id: 'siberian', level: 4, user: 'b',
    title: { en: 'Siberian Trap', de: 'Sibirische Falle' },
    setup: ['e4', 'c5', 'd4', 'cxd4', 'c3', 'dxc3', 'Nxc3', 'Nc6', 'Nf3', 'e6', 'Bc4', 'Qc7', 'O-O', 'Nf6', 'Qe2', 'Ng4', 'h3'],
    line: ['Nd4', 'Nxd4', 'Qh2#'], mateOk: true,
    prompt: { en: 'White just played h3 to kick your knight. Ignore it!', de: 'Weiß spielt h3 und jagt deinen Springer. Ignoriere es!' },
    explain: {
      en: 'Nd4! attacks the queen. If Nxd4?? the c7–h2 diagonal opens and Qh2 is mate, protected by the knight on g4.',
      de: 'Sd4! greift die Dame an. Nach Sxd4?? öffnet sich die Diagonale c7–h2 und Dh2 ist Matt, gedeckt vom Springer g4.'
    }
  },
  {
    id: 'fishing-pole', level: 4, user: 'b',
    title: { en: 'Fishing Pole Trap', de: 'Angelruten-Falle' },
    setup: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Ng4', 'h3', 'h5', 'hxg4', 'hxg4', 'Nh2'],
    line: ['Qh4', 'Nxg4', 'Qh1#'], mateOk: true,
    prompt: { en: 'White took the bait on g4. Now use the open h-file.', de: 'Weiß hat den Köder auf g4 geschluckt. Nutze jetzt die offene h-Linie.' },
    explain: {
      en: 'Qh4! joins the rook on the open h-file. After Nxg4 Qh1 is mate: the rook on h8 protects the queen.',
      de: 'Dh4! verbindet sich mit dem Turm auf der offenen h-Linie. Nach Sxg4 ist Dh1 Matt, der Turm h8 deckt die Dame.'
    }
  },
  {
    id: 'noahs-ark', level: 4, user: 'b',
    title: { en: "Noah's Ark Trap", de: 'Arche-Noah-Falle' },
    setup: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'd6', 'd4', 'b5', 'Bb3', 'Nxd4', 'Nxd4', 'exd4', 'Qxd4'],
    line: ['c5', 'Qd5', 'Be6', 'Qc6+', 'Bd7', 'Qd5', 'c4'],
    prompt: { en: 'White\'s queen took on d4. Now trap the bishop on b3.', de: 'Die weiße Dame hat auf d4 geschlagen. Fange jetzt den Läufer auf b3.' },
    explain: {
      en: 'c5! chases the queen, Be6 and Bd7 keep it busy, then c4 locks the bishop on b3 in a cage of pawns. It is lost.',
      de: 'c5! jagt die Dame, Le6 und Ld7 halten sie beschäftigt, dann sperrt c4 den Läufer b3 im Bauernkäfig ein. Er ist verloren.'
    }
  }
];
