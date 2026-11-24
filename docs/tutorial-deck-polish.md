# Tutorial wording and deck-top Summon

The guided Standard tutorial now contains 47 lessons. The former lessons 18/19 are one immediate Courtesan replacement; former lessons 37/38 are one immediate Magistrate replacement (now lesson 36 after renumbering). Each instruction highlights and enables the required card at the same time. Both replacements remain real board clicks, and Back restores the same actionable checkpoint.

The full EN/JP script has been reviewed against its actual displayed state. Tax explains that its coins arrive before Mei chooses a loss; result lessons describe payments and turns that have already completed. Hire Guard's challenge window no longer says Akira has challenged before that happens. Mei's Earn lesson distinguishes the current 1 coin from the 2 after Earn, and Sora's last Tax distinguishes 5 coins now from 7 after passing. Japanese role references match the displayed くノ一 label. Player-facing copy uses “players,” with influence/elimination qualifications only where needed.

Summon's drawn card now turns in place on top of the deck. It uses the exact shared influence markup and `.player-roles` styling context, including full-bleed portrait, gradient and role label; no portrait file was replaced. Instructions and Discard draw stay in Current Turn (the lesson panel in the tutorial). The guided replacement disables the alternate discard choice while teaching the selected card; regular matches retain both choices.

The Deck heading is removed visually, with its accessible region label retained. The larger stack uses the influence-card proportions; the remaining-card label size is unchanged. The actual saved deck count excludes the private draw, and its next faction back remains underneath it. Other players and spectators receive no face-up draw. Prior proof presentation finishes before the top-card turn begins. Draw/discard sounds, motion transfer through rerenders and reduced-motion behavior remain shared.

## Validation

Run `npm test` with Node 26. The suite includes 71 test files, CSS verification, both complete language routes, exact coins/cards/turns and checkpoint replay, immediate merged card choices, shared Current Turn controls, private deck projection, proof-before-top-flip sequencing and no rerender replay. The real polling/WebSocket test recognizes both caught-bluff losses and independent failed-challenge penalties rather than depending on which random hand was dealt. Approved artwork bytes are unchanged.

For local visual testing, replay both Summon lessons, then try keeping and discarding in a regular match. Check EN/JP and narrow layouts, a language switch during the top-card flip, and a challenged Summon while the other player chooses a loss. The tutorial should not ask for Continue when it is asking you to select a card.

Keep your existing `data/` folder, restart the server and refresh browser tabs. There is no dependency, database or gameplay-rule change.
