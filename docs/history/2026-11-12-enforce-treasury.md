# URAMAKU — Magistrate Enforce treasury update

Baseline: `uramaku-english-guide-copy-centered-purge.zip`. This build changes only the Enforce payment destination and the scripted tutorial balance/copy required by that change. Internal action IDs and all other gameplay rules are unchanged.

## Enforce

- The English guide and tooltip now read **"Kingpin must pay 2 coins to treasury or lose influence."** The Kingpin role name continues to resolve from the `shared/i18n.js` glossary, with bold rendering in the Game Guide.
- A successfully established Magistrate Enforce counter **automatically** collects 2 coins from the attacking Kingpin into the treasury, not Magistrate's wallet. In Standard Mode the Kingpin simply pays the 2 coins out of their wallet; in Treasury Mode the coins are returned to the shared treasury and can end Riot.
- If the original Kingpin has fewer than 2 coins, **no coins are paid**. The Kingpin loses one influence but retains their remaining coins. If eliminated entirely in Treasury Mode, the preexisting *eliminated player returns remaining coins* rule still applies.
- Role bluff/challenge timing remains unchanged. A genuine Enforce challenged by its original attacker who cannot pay creates the existing double-influence-loss outcome; an unrelated third-party challenger no longer inherits that special penalty.
- Revised EN/JP role effects, Enforce game-log translations, and relevant tests.

## Tutorial

- The guided player starts at **3 coins** (other players' scripted initial coin balances unchanged; this does not change the real game's initial one coin).
- Guided coin path: start 3 → Income 4 → Tax 6 → Hire Guard 3 → Enforce still 3 → two turns of Income + Earn = 7 → Purge costs 7.
- Magistrate's Enforce lesson states that Sora automatically pays 2 coins to **treasury**, without sending anything to the tutorial player. Updated the result, logs, summary, and Japanese script accordingly.

## Tests

- `npm test` passed: existing regression suite plus new `test/enforce-to-treasury.test.js`.
- `npm run test:economy-stress` passed: 280 randomized matches with conserved Treasury Mode coin supply.
- New tests cover 1-coin retention, exact 2-coin threshold, third-party challenge, bilingual guide glossary/logs, and tutorial's correct 3→7 coin path.

Full manual multiplayer browser QA remains recommended before release.
