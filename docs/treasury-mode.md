# Riot Mode — URAMAKU playtest rules

This mode is **optional** and can be toggled by the room host before starting. It can be combined with the separate visible-factions option. Standard Mode continues to use unlimited coin generation.

## Starting coins and bank

- The host chooses **5, 6 or 7 coins per starting player**, with **6 as the default** for new rooms. Fixed total supply = selected amount × original number of players. The setting is locked after the match starts.
- Everyone starts with **1 coin**, drawn from that supply. Thus the treasury begins with **(selected amount − 1) × players** (5 × players at the default); the first player immediately draws passive Income from it at the start of their first turn.
- At the start of a turn, passive Income withdraws *up to* 1 coin. Earn withdraws *up to* 1 coin. Successful Tax withdraws *up to* 2 coins. They produce no new coins when funds are unavailable. Tax cannot be declared if the treasury is empty (during Chaos).
- Assassinate (3), Hire Blade (5), Purge (normally 7) and Hire Guard (5) put their payments into the treasury.
- Extort, Intrigue concealment, Loot and Enforce transfer coins **between players**. Enforce pays the player who claimed Magistrate.
- When a player loses their last influence or forfeits the match, all their remaining coins return to the treasury.

## Order and Chaos

**Chaos activates whenever the treasury is at 0 coins. Order returns immediately when coins enter the treasury.**

- **Earn** changes to **Loot**, with a distinct action icon. On your turn during Chaos, take 1 coin from an opponent as your action. It consumes your turn, cannot interrupt a pending claim/counter/information/loss/Summon decision, and cannot be challenged or countered.
- **Overthrow (下剋上 / Gekokujō) replaces Purge** during Chaos, costing 5 coins. It cannot be challenged or countered. Overthrow is a distinct action and its payment can restore Order immediately.
- Passive Income awards 0 while the treasury is empty. Other role actions and their challenges/counters work normally.

## Victory

- The traditional elimination win still works: be the last player with influence.
- **Economic victory occurs immediately** when a player reaches the coin goal through a completed income payment, action, or transfer (after any relevant claim/counter challenge resolves).
- The goal is fixed at the **original room size**, not the remaining survivors.

| Starting players | Coins to win |
| ---: | ---: |
| 2 | 10 |
| 3 | 12 |
| 4–6 | 14 |

There is **no mandatory Purge** in Riot Mode. Wealth goals depend on the original player count and do not scale with the supply setting. With 2 players and a 5-coin supply, the 10-coin wealth goal requires holding the entire supply.

Supply settings use the ordinary room snapshot for persistence and reconnection. The game does not migrate old matches through rule-changing deployments; start a fresh match after such updates.

## Standard Mode

At the beginning of each turn, **after passive Income**, if the active player holds **10 or more coins**, they must use the normal 7-coin Purge for their action. This restriction applies only in Standard Mode. Standard Mode does not enable Chaos, Loot, a finite treasury, or economic victory.

## Testing

- `npm test` — gameplay, UI, tutorial, and economy regression suites.
- `npm run test:economy-stress` — 280 additional randomized matches across Standard/Riot Modes and 2–6 players. This verifies actions resolve and the fixed supply remains conserved. It is **not** a balance or win-rate simulation.
