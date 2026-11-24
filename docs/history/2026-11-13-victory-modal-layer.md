# URAMAKU — Victory modal stacking fix (2026-11-13)

Base: `uramaku-finished-room-chat-focus-fix.zip`

- Raised `.victory-backdrop` from `z-index:3500` to `z-index:6000` in `public/css/source/04-component-overrides.css` so the match-complete dialog renders above board action announcements (`z-index:5000`). This retains the announcement position, fade timing and interactions.
- Rebuilt the generated `public/css/game.css` using `npm run build:css` rather than editing generated CSS directly.
- Added `test/victory-modal-layering.test.js` and included it in the `npm test` script to detect future stacking regressions.
- No game rules, tutorial, chat or art changes.

Verification: `npm test` passed; `npm run test:economy-stress` completed all 280 randomized matches with no economy invariant violations. Final visual browser multiplayer QA remains outstanding.
