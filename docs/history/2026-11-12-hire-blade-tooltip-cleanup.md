# URAMAKU — Hire Blade & tutorial tooltip cleanup

This build continues from `uramaku-tutorial-copy-and-lobby-refinement.zip`.

## Changes

- Renamed the Swordsman's English action name to **Hire Blade** across the shared bilingual dictionary, game UI, Game Guide, action logs/notifications, server messages, tests, and documentation. Japanese name stays **刺客を雇う**.
- Kept the **`hireBlade`** protocol/action ID unchanged; cost and gameplay behavior are unchanged.
- Reused `shared/i18n.js` / shared role metadata for the Hire Blade name in the action-card label, Current Turn status, game log parsing, and server error/loss descriptions.
- Removed the redundant `installTutorialRoleTooltips()` implementation, its tooltip element, global listeners, and unused tutorial-only tooltip-string formatting. Kept the original `tutorialRoleTooltips()` and its existing role-card hover/focus behavior.
- Updated obsolete tests and added `test/hire-blade-tooltip-cleanup.test.js`, which checks dictionary naming and enforces exactly one original tutorial tooltip.

## Validation

- `npm test` passes, including the updated tutorial tests and EN/JP consistency checks.
- `npm run test:economy-stress` passes all 280 randomized matches (no economic invariants violated).
- No browser visual QA was completed in this environment. Verify tutorial card hover on desktop and mobile before final release.
