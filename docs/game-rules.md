# Current gameplay rules

The printed English ability text is stored in `shared/i18n.js`. The engine is `shared/game.js`, also exported by `server/game.js`. This page summarizes the implemented interactions for developers.

## Setup and turns

A match supports 2–8 players. Each begins with two hidden influences and one coin. At the start of each turn, the active player receives one Income, then chooses an action. The final surviving player wins. Optional visible factions show Order or Underworld on hidden cards, including the top card of the draw pile. The deck display shows the remaining draw-pile count; it reveals only the top card’s faction in faction mode.

Earn gains one additional coin. Purge costs seven coins and removes an opponent's influence. In Standard Mode, holding ten or more coins after Income makes Purge mandatory. Treasury Mode uses a finite supply, Riot actions and an additional wealth victory, described in [Treasury Mode](treasury-mode.md).

## Claims and counters

Role claims can be bluffs. Living opponents may challenge within the configured time limit (fifteen seconds by default). The host can set 5–60 seconds or disable the timer before starting; an untimed claim waits for everyone to challenge or pass. Everyone passing resolves the claim sooner. A truthful claimant proves a matching card, discards it and draws a replacement. The challenger owes one influence. Independent effects and choices can proceed while that player selects the loss; the next turn waits for every required choice. Intrigue waits for its own targeted challenger to lose first, so only surviving cards are investigated. Gossip has the exchange-before-replacement order described below. A claimant caught bluffing loses one influence and the claim fails.

After an action's challenge window, its target can claim an eligible counter. Counter claims receive their own challenge window using the same timer setting. A failed challenge against an action or counter can combine with its influence-loss effect. The engine automatically resolves a simultaneous loss of both influences.

## Roles

| Role | Action | Counter |
| --- | --- | --- |
| Lord | Tax collects two coins | Authority blocks Intrigue |
| Courtesan | Intrigue investigates eligible hidden influences privately, with one coin per concealed influence paid to the investigator | Gossip privately reveals both participants' remaining influences to each other |
| Swordsman | Hire Blade costs five coins and removes an influence, with a challenge window and no counter | Hire Guard costs five coins on declaration and counters Assassinate by removing an influence from its attacker |
| Assassin | Assassinate costs three coins and removes an influence | False Trail blocks Assassinate |
| Magistrate | Summon automatically draws one private card and discards either it or a replaced influence | Enforce blocks Extort and makes its attacker pay the claimant two coins or lose an influence if unable to pay |
| Kingpin | Extort takes two coins, limited by the target's available balance | Intimidate blocks Extort |

## Card selections and information

Influence-loss, Intrigue concealment and Summon replacement choices use the player's actual influence cards on the board. A final influence loss is automatic. Summon draws automatically when its challenge resolves and reveals the private draw on top of the deck after proof presentation finishes. Instructions and the Discard draw button stay in Current Turn. Clicking a held influence immediately replaces it with the draw; Discard draw keeps the original hand. After a failed Summon challenge, the proof replacement happens first, then Summon and the challenger's influence-loss choice can be completed in either order. The next turn waits for both. Loot pauses while Summon or challenge penalties are resolving.

Discovered influences remain private until the investigator shares a discovered card publicly. Card replacement invalidates its recorded knowledge. Eliminated influences remain face up and permanently out of circulation. Reusable discards are shuffled into a new deck when the draw pile runs out.

Enforce collects the full 2 coins from the original Extort attacker or makes that attacker lose one influence. With 0 or 1 coin, no partial payment is made. If that attacker unsuccessfully challenges a truthful Magistrate claim while unable to pay 2, both influences are lost automatically: one for the challenge and one for Enforce. If the attacker can afford 2 coins, payment happens immediately and still applies if the failed challenge eliminates their last influence; Treasury refunds only their remaining coins. A third-party challenger loses only their own challenge penalty; the original attacker still separately owes the counter.

Gossip resolves as soon as its Courtesan claim is proved: privately exchange the two participants' current hands, replace the proved Courtesan, then settle the challenger's influence-loss choice. The replacement becomes hidden, including when it has the same role as the old card. Other discovered cards remain known. If the Intrigue initiator is the challenger, Gossip sees their hand before the loss; losing a card removes that card's old knowledge and shifts surviving indices normally. A third-party challenger receives no private information. This exchange also precedes an automatic final-card challenge loss. A caught Gossip bluff still cancels the counter and resumes Intrigue normally.


When the target loses their last influence by unsuccessfully challenging a genuine Kingpin, Extort still transfers up to 2 of their coins. In Treasury Mode this precedes refunding their remaining coins. Influence elimination does not erase the accepted coin transfer; victory is settled after it. A surviving target retains the normal chance to counter.


## Independent failed-challenge resolution

| Accepted claim | What may continue while the challenger selects a loss |
| --- | --- |
| Tax | Collect 2 immediately; preserve the existing instant victory when a final opponent automatically loses their last influence before payout |
| Summon | Replace the proved Magistrate, draw one Summon card, then resolve the private card choice alongside the loss |
| Extort | The target can counter or allow the action; an allowed action transfers coins immediately. Counters are never bypassed |
| Intrigue | A different target can respond concurrently. If the target is the challenger, their loss happens first |
| Assassinate / Hire Blade | A different target may respond concurrently. A targeted failed challenger loses both automatically |
| Authority / False Trail / Intimidate | Block immediately; the challenge penalty still must be settled |
| Enforce | Pay 2 immediately when affordable; otherwise resolve the separate Enforce loss. An attacking failed challenger unable to pay loses both automatically |
| Hire Guard | The attacking player owes an influence independently of a third-party challenge penalty; an attacking failed challenger loses both automatically |
| Gossip | Exchange current hands immediately after proof, replace Courtesan with a hidden card, then settle the challenge penalty |

General Earn, Purge, Loot and Overthrow have no role claim to challenge. A caught bluff continues to use the existing claimant-loss-first flow. No new action or next-turn Income occurs until all required decisions are finished. Multiple pending penalties have separate durable decision IDs; resolving one cannot clear or replay another.
