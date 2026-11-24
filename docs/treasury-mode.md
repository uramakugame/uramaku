# Treasury Mode — URAMAKU playtest rules

This mode is **optional** and can be toggled by the room host before starting. It can be combined with the separate visible-factions option. Standard Mode continues to use unlimited coin generation.

## Starting coins and bank

- Fixed total coin supply: **7 × the original number of players**.
- Everyone starts with **1 coin**, drawn from that supply. Thus the treasury begins with **6 × players**; the first player immediately draws passive Income from it at the start of their first turn.
- At the start of a turn, passive Income withdraws *up to* 1 coin. Earn withdraws *up to* 1 coin. Successful Tax withdraws *up to* 2 coins. They produce no new coins when funds are unavailable. Tax cannot be declared if the treasury is empty (during Riot).
- Assassinate (3), Hire Blade (5), Purge (normally 7) and Hire Guard (5) put their payments into the treasury.
- Extort, Intrigue concealment, Loot and Enforce transfer coins **between players**. Enforce pays the player who claimed Magistrate.
- When a player loses their last influence or forfeits the match, all their remaining coins return to the treasury.

## Riot

**Riot activates whenever the treasury is at 0 coins, and ends immediately when coins enter the treasury.**

- **Earn** changes to **Loot**, with a distinct action icon. Any player still holding influences can take 1 coin from an opponent **during Riot, except while Summon is resolving**. Using Loot before declaring another action on your own turn uses your turn action. Loot used off-turn or during another eligible decision leaves the turn and that decision in progress. Summon draws and card replacement pause Loot for every player until the choice resolves. Loot cannot be challenged or countered.
- **Overthrow (下剋上 / Gekokujō) replaces Purge** during Riot, costing 5 coins. It cannot be challenged or countered. Overthrow is a distinct action and its payment can end Riot immediately.
- Passive Income awards 0 while the treasury is empty. Other role actions and their challenges/counters work normally.

## Victory

- The traditional elimination win still works: be the last player with influence.
- **Economic victory occurs immediately** when a player reaches the coin goal through a completed income payment, action, or transfer (after any relevant claim/counter challenge resolves).
- The goal is fixed at the **original room size**, not the remaining survivors.

| Starting players | Coins to win |
| ---: | ---: |
| 2 | 11 |
| 3 | 12 |
| 4 | 13 |
| 5 | 14 |
| 6 | 14 |
| 7 | 14 |
| 8 | 14 |

There is **no mandatory Purge** in Treasury Mode.

## Standard Mode

At the beginning of each turn, **after passive Income**, if the active player holds **10 or more coins**, they must use the normal 7-coin Purge for their action. This restriction applies only in Standard Mode. Standard Mode does not enable Riot, Loot, a finite treasury, or economic victory.

## Testing

- `npm test` — gameplay, UI, tutorial, and economy regression suites.
- `npm run test:economy-stress` — 280 additional randomized matches across Standard/Treasury modes and 2–8 players. This verifies actions resolve and the fixed supply remains conserved. It is **not** a balance or win-rate simulation.
