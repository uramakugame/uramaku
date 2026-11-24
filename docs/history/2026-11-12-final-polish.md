# URAMAKU — November 12, 2026 polish build

Baseline: `uramaku-hireGuard-flash-draw-ui-update.zip`.

## Changes

- **Private Intel:** The **Make public** button is rendered inside the shared role-card caption flow after the **Private intel** label. No absolute overlay or footer-padding workaround; both are readable and the button remains clickable.
- **Game announcements:** Toasts visually center over the player board (not the browser window or bottom left), respond to scroll/resize/rerender, and use a dark-crimson-to-red gradient, light text, and higher contrast.
- **Riot:** During Riot, the action bar swaps **Earn → Loot** and **Purge → Overthrow**. Japanese **Overthrow = 下剋上（げこくじょう, Gekokujō）**. These are distinct server actions (`loot`, `overthrow`) rather than just renamed/discounted actions. `purge` (Purge) is rejected during Riot; `overthrow` is rejected outside Riot. Overthrow costs **5 coins**, still eliminates one influence, cannot be challenged or countered, and deposits the cost into the Treasury (which can end Riot). Standard Purge remains **7 coins**.
- **General action card:** Removed the crossed-out 7 / 5 coins price display; the Purge / Overthrow card displays its name only. Exact costs remain available in the tooltip and bilingual Game Guide.
- **Owned roles:** Removed the checkmark pseudo-element, while preserving the held-action border treatment.
- Updated reference and documentation in both EN and JP and renamed Riot logs/announcements.

## Regression verification

- `npm test` passes, including new `test/riot-overthrow-polish.test.js` and updated Riot action and randomized-game tests.
- `npm run test:economy-stress` passes: 280 randomized matches with no treasury invariant violations.
- Browser (Playwright Chromium) tested at 1600×1050 and 390×844: Intel status and share button have nonoverlapping bounding boxes; announcements use board position; Overthrow label and no owned-role checkmarks; no JavaScript page errors.

## Run

From `uramaku-browser`, run `npm install`, then `npm start`.
