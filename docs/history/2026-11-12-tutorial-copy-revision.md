# URAMAKU — Tutorial Copy & Lobby Layout Refinement

Built on `uramaku-four-turn-tutorial-polish.zip`. This update changes the scripted tutorial's narration and presentation; it does **not** change server-side multiplayer rules, the four-player fixture, or the four player turns needed to win.

## Tutorial writing and interaction

- Restored opening titles **Welcome to URAMAKU!** and **URAMAKUへようこそ！**. Removed the announcement of a four-turn/Purge ending. The opening encourages hovering on influence cards to inspect actions and counters.
- Added matching shared-style ability tooltips to role cards and tutorial action cards. Tooltips read role/action data from the existing EN/JP glossary and do not expose faction emblems.
- Standardized tutorial turn text and logs to **Income** rather than **passive Income** in English and Japanese.
- Separated explanations from outcomes: Tax challenge consequences, Intrigue's discovery of Lord, public sharing of that Lord, and Hire Guard's double-influence penalty are revealed in result panels only when the corresponding player decision resolves.
- Retained the proposed description of Mei's suspicious Kingpin claim while presenting its consequences conditionally, before the challenge.
- Sora's Intrigue concealment payment goes to **Akira (the Courtesan)**, not Sora; this is the existing game rule.
- Split Akira's Assassin sequence into distinct steps: **pass the original Assassin challenge window**, **claim Swordsman/Hire Guard as the target**, then **prove Swordsman against Akira's challenge**. The tutorial is now 16 teaching steps, but still four turns for the local player.
- Rewrote the closing lesson to emphasize the mechanics learned (claiming, proving, challenging, bluffing, countering, private/public information, calculated risk) rather than repeating the move list.
- Kept all copy in centralized `shared/i18n.js` EN and JP script dictionaries. The additional result-screen IDs, Japanese event-log entries, and turn income messages were updated to match.

## Lobby

- Create Room and Join Room remain together in the first row; the **EN ⇄ JP** button now occupies a separate row directly beneath them, centered with a stable compact size. Room lobby and live-game toolbars are unchanged.

## Tests

- Full `npm test` regression suite passed, including updated step-index tests and a new `test/tutorial-copy-and-lobby-layout.test.js`.
- All 280 simulated Treasury matches completed without coin-conservation violations (`npm run test:economy-stress`).
- Compiled stylesheet consistency check passed (`node scripts/build-css.js --check`).
- Manual browser-based screenshot QA not performed in this environment; visually check the tutorial hover tooltip position and mobile welcome lobby if needed.
