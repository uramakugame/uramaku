# Challenge timing and board Summon

> The tutorial wording and preview layout in this release were refined by [the tutorial/deck follow-up](tutorial-deck-polish.md).

This update implements the approved independent failed-challenge flow and shared Summon board controls. It builds on the tutorial attack-animation fix. It does not deploy the server or change approved artwork.

## Playing the new flow

- A genuine Tax pays while the failed challenger chooses an influence. The next turn waits. If the final opponent automatically loses their last influence, the existing instant victory still ends the game before Tax payout.
- Extort's target can choose a counter or allow the action while a failed challenger selects a loss. Allowing it pays immediately; counter claims still have their normal challenge windows.
- Enforce takes the full 2 coins immediately when affordable, independently of the challenge penalty. A last-influence failed challenger is still charged before Treasury refunds or victory. With fewer than 2 coins, the separate Enforce influence loss applies; an attacking failed challenger loses both automatically. There is no partial payment.
- Summon replaces a proved Magistrate first and draws its separate card. The private draw appears beside the deck after proof animation settles. Click a held influence to keep/replace in one choice, or click Discard draw. There is no modal or Keep button.
- Summon and its failed challenger's loss can finish in either order. No next-turn Income or fresh turn action is available until both finish.
- Intrigue still waits for a targeted failed challenger to lose their influence before investigating surviving cards. A third-party challenger does not hold up the actual target's choices.
- Authority, False Trail and Intimidate block immediately; failed-challenge penalties still apply. Elimination actions retain double-loss behavior. A third-party challenge penalty and another player's required attack/counter response can coexist.
- Proved Gossip now follows **challenge fails → exchange current hands privately → replace Courtesan → settle challenger loss**. The replacement stays hidden, including same-role draws. Other discovered cards remain known. A third-party challenger receives no Gossip intel. A caught bluff does not exchange hands.

All required decisions must finish before the next turn. Multiple action/counter challenges retain independent influence-loss debts; two unavoidable losses against the same two-card hand resolve automatically. General actions remain unchallengeable.

## Implementation and recovery

The main action decision stays in `room.pending`. `room.challengeLosses` stores independent penalties. Each has its own durable decision ID. `finishAfterChallengesId` anchors the original acting seat, and a deferred wealth-victory ID prevents a transfer from deleting a still-owed penalty. SQLite commits the entire transition and command receipt before broadcasting.

Completing one choice preserves the other's ID and state. Refreshing or restarting restores the exact private draw and any unfinished penalty; retrying a successful command cannot replace, draw, charge or advance the turn twice. Forfeits and owner kicks preserve other players' penalties and use the same turn barrier. A departed voter does not leave an already-passed counter waiting forever.

Both pages use `game-panels.deck/summon`, `role-cards`, `card-motion`, and `presentation-flow`. The tray uses approved portraits and the existing private card animation. Proof presentation finishes before its private preview begins; an unanswered loss selection does not block it. Rerenders transfer in-progress animation, and reduced motion exposes the settled card immediately. EN/JP guide text and tutorial explanations reflect the new controls and order. Current Turn retains its existing 160 px desktop height.

## Updating locally

1. Preserve your existing `data/` folder (or custom `SQLITE_PATH`).
2. Replace the application files with this build; keep the saved database outside the replacement copy if needed.
3. Run `npm ci` and `npm start` with Node 26, then refresh every open browser tab.

There is no dependency or SQL schema change. Previously saved serial decisions remain supported; the update does not retroactively undo cards exchanged or information already learned in an older build. An old Summon `replace` stage appears in the new tray and can either replace a held influence or discard the draw.

## Validation

`npm test`: **70/70 test files**, including stylesheet verification. `npm run test:economy-stress`: **280/280 randomized matches** with exact card and coin conservation. Tests cover both concurrent completion orders, authorization/stale IDs, overlapping counter debts, accepted payments, automatic losses, threshold victories, caught bluffs, forfeits, EN/JP board clicks, animation queue/rerender behavior, and real Socket.IO/SQLite crash recovery before and after either choice. Approved asset bytes are unchanged.

For local playtesting, prioritize both Summon completion orders and reloads during the proof/preview, last-influence Enforce challenges at 1/2/5 coins in Classic and Treasury, and Gossip challenged by its initiator versus a third player. Try narrow layouts and a language switch while animations run. Automated DOM/animation checks do not replace judging the rendered timing in a browser.
