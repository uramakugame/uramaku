# Unified target responses and loss-first decisions

Local test build prepared November 25, 2026 from main commit `94e2ba0`. Nothing is pushed or deployed automatically.

## Implemented behavior

- Intrigue, Assassinate and Extort targets see Challenge, Allow action and every legal counter in the same shared panel. The roles offered are not restricted to their held cards; bluffing is preserved. Hire Guard still requires 5 coins.
- A target challenge forfeits countering that original action, including after surviving a failed challenge. Allow action waives both challenge and counter for the target; other players retain their challenge opportunity.
- A counter is declared immediately, closes the original challenge window, charges its cost once and opens a fresh counter challenge window. There is no counter queue. A caught counter bluff resumes the original action without reopening its challenge window.
- Timers only limit challenges. An undecided target has an untimed counter/allow choice after original expiry. The timer can be enabled or disabled, with 10–60-second bounds and a 15-second default.
- A third-party failed challenge waits for its loss selection/public reveal before a new counter choice or Intrigue concealment choice. A target's own failed Intrigue challenge also loses first so investigation uses surviving cards.
- **Summon waits for the challenge-loss selection before drawing its separate action card.** The proved Magistrate replacement still occurs first. There is no Summon choice or private preview while that loss is unanswered. The preview is presented after preceding public card animations finish.
- Automatic Tax, established Extort/Enforce payments and proved blocks can resolve while the challenge-loss selection is pending. Separate unavoidable losses from Hire Blade, an already allowed Assassinate, Hire Guard or unaffordable Enforce can coexist.
- Gossip exchanges current hands before replacing a proved Courtesan. Its new card stays hidden. A third-party challenger receives no private intel. Last-card and double-loss behavior, exact coin transfers before Treasury refunds, original turn order and deferred wealth settlement are preserved.
- No next-turn Income or new turn action occurs until all outstanding decisions finish. Riot Loot is unavailable while the new serial loss is resolving, just as it is during independent challenge penalties. Existing public intel sharing rules are unchanged.

## Shared UI and tutorial

Targets receive a combined panel; observers and counter claims use challenge/pass. Follow-up counter/concealment panels remain hidden/inert until the preceding card presentation finishes. Reduced motion exposes settled cards immediately. The original 160 px desktop Current Turn reserve and existing responsive scrolling are retained.

The same components serve multiplayer and the guided tutorial in English and Japanese. Three former pass-then-counter lesson pairs are merged: genuine Gossip, Hire Guard and bluff Gossip. The tutorial now has **43 lessons** across six learner turns, with genuine Enforce in lesson 27, Sora’s late Summon, and a final successful challenge against Sora’s Extort bluff. Card portraits, backs, compositions, sounds and other approved artwork are unchanged. HTML cache keys are updated so refreshing loads matching engine/controller/translation files.

## Persistence and in-flight commands

`targetResponse` and `targetChallenged` retain the target's commitment through loss continuation. A response identity survives a timeout with no new information, allowing a timely counter click to reach the same untimed offer. A reveal creates a new response identity, rejecting a choice submitted against the earlier information state. Original-claim challenge IDs cannot act on a subsequently activated counter.

All choices, deadlines, IDs, hidden draws and costs use the existing SQLite snapshot transaction and durable command receipts. Failed commits never publish a counter charge or close a window alone. Successful retries return the same result without another draw, loss or charge. No SQL migration, dependency or environment-variable change is needed.

There is one current resolution flow. Old-rule version branches and the obsolete two-step Summon Keep protocol have been removed. Normal snapshots still support same-version restarts and reconnection. Rule-changing deployments may require a new match; there is no special in-progress upgrade path.

## Local playtest checklist

1. In separate tabs, target a player with each of Intrigue, Assassinate and Extort. Confirm only the target gets counters alongside Challenge and Allow action, including counters they can bluff.
2. Counter before everyone passes. Confirm the original window ends immediately, Hire Guard pays exactly once, and the counter has its own full timer. Try an original-claim challenge from another tab at the same instant; it must not hit the counter instead.
3. Let the original timer expire without responding as target. Wait longer than its configured duration, then counter. There is no counter-selection timer; the counter's own challenge window starts only on declaration.
4. Challenge as the target. On failure, verify Extort transfers without a counter offer; Intrigue waits for the selected loss, then offers concealment of surviving cards. Genuine Assassinate still removes both influences automatically.
5. Challenge as a third player while holding two influences. The target must wait for the lost card's public reveal before choosing a counter. Afterward, that same challenger can challenge the counter using their remaining influence.
6. Challenge a genuine Summon. After proof replacement, confirm there is no extra draw yet. Select the lost influence, watch its flip/reveal, then inspect and resolve the private draw on the deck. Reload before and after each step; the card must not change or draw twice.
7. Have a target allow Assassinate before a third-party challenge fails. Resolve the two forced losses in either order; neither may erase the other or grant Income early. Repeat with Hire Blade, Hire Guard and Enforce at 0/1/2+ coins in Classic and Treasury.
8. Challenge Gossip as its opponent and as a third party. Verify exchange-before-proof-replacement, hidden replacement and no private information for the third player.
9. Repeat counter/selection stages in Japanese, reduced motion and a narrow layout. Switch language during loss/proof animations and confirm controls remain usable and the header does not expand on desktop.
10. Refresh/restart during a pending loss, untimed offer, counter challenge and Summon preview. Test an owner kick/forfeit while another player still owes a loss. Then finish a match and confirm existing metrics increment once.

## Automated validation

The release runs the full regression suite, including new engine, shared-control/presentation and real Socket.IO/SQLite recovery tests. The randomized 280-match exercise now includes immediate target counters and Allow action, along with exact card/coin conservation. Tests cover current-rule parallel mandatory losses through ordinary restarts. Final results are recorded in `LOCAL-TESTING.md`.
