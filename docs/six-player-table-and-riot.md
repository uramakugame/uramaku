# Six-player table, owner controls and Riot presentation

## Room capacity and removal

Matches now support 2–6 players, with three copies of each of the six influences (18 cards). Six players leave six cards in the draw pile after the deal. The owner can set Maximum players to 2, 3, 4, 5 or 6 in the lobby; new rooms default to 6. This changes capacity, not the minimum required to start. A limit cannot be lower than occupied player seats, including reserved offline seats. Spectators do not count. Settings lock after starting and persist through normal restart/reconnect. Both preparation and confirmation validate capacity, preventing final-seat races.

Kick player enables a single-target owner selection mode during an active match. Cancel kick exits without changing the match. Selecting a connected or disconnected opponent still holding influences opens the existing bilingual confirmation; one removal can be in flight at a time. The lobby retains its direct per-player Kick buttons without a selection-mode toggle. Confirmed match removal uses the existing forfeit and credential-revocation flow, marks the target offline, and removes any live socket binding. Owner and already-eliminated seats cannot be targeted. Offline text and Kick retain their prior compact styling and are right-aligned next to Coins as overlays, without extra card rows.

## Board and controls

The overall desktop board footprint and influence-card sizing remain shared with the existing room design. Player positions occupy three columns over two rows; player four begins the second row. The fourth column holds borderless match information with restrained typography and a faded accent rule above the borderless card-pile area. Fewer-player matches retain both rows and the dedicated information locations. At compact sizes the board retains readable columns in its existing scroll area; actions and sidebar stack.

The draw deck and reusable discard pile are side by side at influence-card size. Both show real counts. Discards stay face down and reveal no Summon identities. Eliminated influences stay visible on their player card and are excluded from reusable discards. Faction mode shows the actual top draw and discard cards' faction backs without revealing roles; games without factions use the standard back. Summon retains the private deck-top preview and controls in Current Turn.

Latest outcome replaces the former top-right deck panel. It summarizes public resolved events and coin transfers; a new Income or pending declaration does not immediately replace the previous result. It reads no private investigation or hidden influence data. Full event history remains in Game Log.

Controls read: language switch → React → Open chat. Owner removal is another owner-only control. Preset reactions, full chat, existing artwork, typography and EN/JP remain shared with the tutorial.

## Local card-pile movements

The existing player-card motions and easing stay in use:

- Deal/replacement: a face-down card lifts upward from the deck (280 ms), then the existing face-down player arrival (400 ms) and authorized flip play.
- Exchange: the outgoing player influence moves down (280 ms), then a face-down card with the outgoing influence’s faction back drops into the reusable discard pile (280 ms), followed by the replacement draw/arrival.
- Rejected Summon preview: the existing downward preview discard (350 ms), then a face-down discard-pile landing (280 ms).
- A new Summon preview still flips on the deck; keeping it performs the exchange sequence in the selected player slot.
- Unknown influence loss still reveals first, pauses for readability and finishes its existing loss motion. It does not enter the reusable discard pile.

These are separate local movements, not flights across the board. Initial deal stagger, draw/discard sound cues, untouched second influence, hidden opponent replacements, animation cleanup, normal rerenders, reduced motion and the action → handoff → Income sequence remain supported. A reshuffle gives the pile locations a brief shared emphasis.

## Riot Mode

The displayed mode name is Riot Mode / 動乱モード. Combined Faction + Riot remains available. Treasury still refers to the shared coins, retaining the existing Japanese term 宝庫. The official introduction is:

> Compete for a finite supply of wealth. When the treasury runs dry, order collapses, looting begins, and overthrowing your rivals becomes easier.

The information cell shows ORDER / 秩序 while coins remain, or CHAOS / 混乱 at zero, plus the current treasury and existing wealth requirement. Muted gold and deep crimson are accompanied by text, not used alone. Loot and Overthrow have new dark crimson UI icons; normal Earn/Purge icons and all approved portraits/card backs are unchanged.

A treasury crossing records one bounded, monotonic public presentation event inside the existing successful transaction. A 700 ms local border/action accent and a small 2.2-second notice follow existing effects, without holding the queue or locking/covering a choice. Rapid reversals in one update produce one concise arrow sequence ending at the actual latest state. Victory takes priority. First load, refresh, reconnect and spectator entry initialize the right state without replaying historical notices. Reduced motion keeps a static notice without decorative animation. Public logs present the explanatory action/coin line before its state consequence.

Existing `treasuryMode`, `treasuryCoins`, `riot` and metrics mode IDs stay internal, so there is no renaming migration or new deployment-compatibility framework. Costs, counter rules, wealth goals, treasury supply settings and timer deadlines remain unchanged. Loot is now strictly a normal turn action and cannot interrupt decisions. Wealth remains 10 / 12 / 14 for 2 / 3 / 4+ starting players; supply remains 5/6/7 per player, default 6.

## Local review

1. Test new rooms with capacities 2 and 6, owner versus guest/spectator, and two joins racing for the final seat. Try lowering capacity below joined seats.
2. Toggle Kick player during a match, cancel confirmation, confirm once against a connected and a disconnected opponent, and inspect an eliminated offline player. In the lobby use the direct per-player Kick buttons. Card dimensions should stay steady.
3. Inspect the six-player board at desktop and compact widths in English/Japanese. Check piles, counts, outcome readability and the reaction menu.
4. Watch opening deal, identical-role proof replacement, Summon keep/discard, spectator replacements and a lazy reshuffle. Only the affected influence should move; hidden cards remain hidden.
5. Empty and refill the treasury, including an Overthrow payment and an elimination refund. Check state labels, icons, normal action availability, rapid reversals, active challenge prompts and reduced motion.
6. Refresh/reconnect or join as spectator during Chaos. Inspect the correct state without an old animation. Existing private intel effects, counters, last-influence Extort payments and ordinary restart recovery should still work.

Run `npm test` and `npm run test:economy-stress`. UI automation covers both real controllers and animation stages; browser spacing and subjective animation pacing should also be reviewed locally. This source build has not been pushed or deployed, and contains no private database or runtime credentials.
