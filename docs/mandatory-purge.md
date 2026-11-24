# Standard Mode mandatory Purge — automatic prompt

At the start of each Standard Mode turn, passive Income is applied before checking the 10-coin compulsory Purge threshold. If the active player has 10 or more coins, the client immediately enters Purge target selection without requiring the player to click the Purge action.

A dismissible pop-out explains the rule and tells the player to choose an opponent on the board. Closing this explanation does not cancel target selection. The player cannot cancel mandatory target selection or use another action; the server independently rejects non-Purge actions for that turn.

A monotonic `turnNumber` lets the client show a fresh explanation once per compulsory turn, including when reconnecting. The selection itself requires one board-card click. The usual 7-coin, unchallengeable Purge rule applies.

This is **Standard Mode only**. Treasury Mode has no mandatory Purge. The Hidden status labels on opponents' face-down cards are unchanged.

Run `npm test` for the `mandatory-purge-auto-target.test.js` regression suite alongside all existing tests.
