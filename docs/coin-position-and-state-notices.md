# Coin position and state notices — 26 November 2026

Coin gain/loss badges use the full player card’s horizontal center again, at the existing coin-row height. Their size and 1.475-second duration are unchanged. Income feedback still allows immediate action selection.

Order/Chaos transitions now also appear through the existing board notification stack: **CHAOS · Order has collapsed.** or **ORDER · Order has been restored.**, with the corresponding Japanese text. The notice lasts 2.5 seconds, uses a small gold/crimson accent, and does not capture input or hold server timers. The persistent state indicator remains. A newer state replaces the previous state notice, and reconnecting or joining an existing match does not replay historical transitions. Existing action effects finish before the notice appears.

No action-button sizing adjustment was made. The desktop sidebar divides its available height into equal fractional grid rows; a roughly 0.02 CSS-pixel difference is consistent with subpixel rounding. Rendered browser inspection is needed to attribute that measurement conclusively.

## Focused local checks

- Earn, Extort and attack costs: the floating coin badge should appear near the top center of the affected player card, while Coins remains left aligned.
- Select an action while the turn’s Income animation is still running.
- In Riot Mode, empty the treasury, then spend coins back into it. Check the CHAOS and ORDER notices, persistent indicator, and action icons.
- Repeat with Japanese and reduced motion. Refresh during Chaos: the correct state should load without replaying its notice.
- Try a quick reversal and a transition with an influence-loss decision outstanding. Controls must remain usable.

Automated verification: `npm test` covers 100 test files plus the generated CSS check. The new test exercises real game-state updates through the shared browser controller, animation callbacks, localization, initial spectator state and repeated snapshots. Rendered browser review remains part of local testing.

See [the proposed development deployment workflow](railway-development.md) for future branch-based testing. This build does not create branches, push commits or change Railway settings.
