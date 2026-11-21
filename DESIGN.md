# Your-turn style trainer: prototype design (2026-11-21)

**Why:** our own small paid product, with short videos recorded later from its screens (the Your Turn model).
The niches come from the reports in `D:\VideoLab\projects\brand_research\reports\` ("Карта рынка настольных игр").

## Goals (this prototype)
- A web trainer that works on phone and desktop, with 4 modules:
  - chess traps;
  - pool aiming;
  - backgammon opening moves;
  - Skat card play.
- 7–10 tasks per module.
- Each task follows one loop: the user acts → the app checks the answer → animated explanation → next task.
- Bilingual EN/DE with a toggle. The default comes from the browser language.
- Progress is saved locally in `localStorage`.

## Non-goals (for now)
- No payments and no accounts.
- No online play, no AI opponent, no publishing.
- No video rendering. Videos come later and are recorded from these screens.

## Tech decisions (my calls)
- **Plain HTML, CSS and ES modules, no build step.** It will later wrap 1:1 into a Telegram Mini App.
- **Tasks are data files** in `data/*.js`. A game module renders and checks them. Adding a task means adding data, not code.
- **Chess:** chess.js (BSD-2) handles the rules. Pieces are the cburnett set (CC BY-SA 3.0, Colin M.L. Burnett) and need attribution in the credits screen.
- **Pool:** 2D canvas with straight-line geometry. Ghost-ball contact, the object ball travels along the line of centres, and the cue ball deflects along the tangent line. The answer is correct if the object-ball path lands within pocket tolerance.
- **Backgammon:** the checker is the standard opening position. A play is checked by comparing the **resulting position** against the accepted best plays from standard opening theory.
- **Skat:** a rules engine handles follow-suit and trump membership for Grand, suit and Null games. Illegal cards are explained when tapped. Accepted answers are fixed per task.
- **Run locally** with `python -m http.server 8765` in `D:\VideoLab\trainer`.

## Files
- `index.html`
- `css/app.css`
- `js/app.js` (shell, router, i18n, progress, sounds)
- `js/games/{chess,pool,backgammon,skat}.js`
- `data/*.js`
- `vendor/`
- `assets/`
- `tests/` (node checks on the data)
