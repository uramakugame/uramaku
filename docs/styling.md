# CSS maintenance

Edit `public/css/source/` and run `npm run build:css` to generate `public/css/game.css`. `npm run test:css` checks that the generated file matches its sources.

| Order | Source file | Scope |
| --- | --- | --- |
| 1 | `01-foundations.css` | Palette, typography, controls and initial shared card styles |
| 2 | `02-game-layout.css` | Game-room grid and decision layout |
| 3 | `03-game-components.css` | Player cards, hidden cards, counters and common components |
| 4 | `04-component-overrides.css` | Accumulated component refinements and cascade overrides |
| 5 | `05-announcements.css` | Action announcement presentation and timing |
| 6 | `06-lobby-and-interactions.css` | Lobby, turn indicators, card selection and action presentation |
| 7 | `07-treasury-and-riot.css` | Treasury status and Riot appearance |
| 8 | `08-responsive-room.css` | Shared responsive layout |
| 9 | `09-floating-chat-and-polish.css` | Floating chat, transparent panels, portrait shading and shared selection states |

| 10 | `10-turn-feedback.css` | Challenge progress, action costs and unavailable reasons, brief effects and sound controls |

The file list in `scripts/build-css.js` defines the cascade order. Existing overrides remain in that order. Changes to it can affect layouts across the game and tutorial.

`.game-*` selectors describe the shared game layout. `.t-*` selectors describe tutorial lessons and controls. `public/css/tutorial.css` supplies those lesson-specific styles. Influence-card markup comes from `public/js/components/role-cards.js` in both pages. Portraits and action art use the same asset paths.

Run `npm run build:css`, `npm run test:ui`, `npm run test:tutorial`, and `npm run test:css` after style changes. Check the corresponding browser views at narrow and wide widths.
