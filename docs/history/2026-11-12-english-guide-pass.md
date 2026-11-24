# URAMAKU — English Game Guide Copy & Mandatory Purge Centering

Based on: `uramaku-announcement-translation-treasury-guide-polish.zip`.

## Changes

- Updated English role action and counter descriptions to the concise user-supplied wording. The original six-column Game Guide table layout (Role / Faction / Action / Effect / Counter / Effect) remains unchanged.
- Introduced `i18n.roleEffect(roleId, type, language, {boldRoles:true})`. English counter descriptions reference stable role IDs, such as `{role:courtesan}`, not literal names. The Game Guide renders dictionary-derived role names in bold; server metadata and tooltips use the same descriptions in plain text.
- Updated English basic action descriptions for Income, Earn, and Purge. Added the standalone note “Basic actions cannot be challenged.” followed by the requested mandatory-Purge message. JP wording is otherwise unchanged.
- Moved the mandatory-Purge explanation *inside* the `.game-players-panel`, centered horizontally and vertically over the player board; removed its distinctive left border while retaining its two-pixel outline and existing dismiss/click-target behavior.
- Added `test/guide-english-copy-and-purge-center.test.js` and updated tests that previously asserted old English copy. Original server action IDs, challenge resolution, payments, and game mechanics are unchanged.

## Important rules distinction

The wording says Purge is mandatory at 10+ coins at the beginning of a turn; the engine continues to determine this **after the automatic Income at turn start**, including the case where a player goes from 9 to 10 coins.

## Validation

- `npm test`: passed.
- `npm run test:economy-stress`: 280 randomized matches passed without economy invariant violations.
- An attempted headless Chromium screenshot timed out in the execution environment, so a final visual review of the popup and English guide is still recommended.
