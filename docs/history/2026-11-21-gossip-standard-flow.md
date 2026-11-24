# Restore the normal Gossip challenge flow

The early Gossip exchange introduced by the prior Gossip privacy change was an exception to the established challenge sequence. It has been reverted in the shared engine, without rolling back later releases.

## Current resolution

1. If a Gossip claim is proved, replace the revealed Courtesan using the ordinary successful-proof logic.
2. Resolve the failed challenger’s influence loss.
3. Resume the counter through the normal loss continuation. Gossip exchanges both participants’ current remaining hands, including the defender’s replacement.

This order applies whether the Intrigue initiator or a third player challenges. Only the two participants receive the private hand information. A third-party challenger does not gain Gossip information. The usual dead-participant and match-end guards apply: no exchange with an eliminated Intrigue initiator, and no further action after the match ends. A caught Gossip bluff loses an influence, cancels that counter and allows the original Intrigue to proceed.

## Changes

Removed the early `exchangeGossip` call from `challenge` and the special continuation flag. `resolveCounter` now exchanges hands once, like other counters resolve their effects after a challenge penalty. Updated the challenge-order and authorized-reveal tests and the current architecture/rules/playtest notes. Historical notes marking the old exception are labeled as superseded. The exact printed EN/JP Gossip ability text already describes the current hand exchange and is unchanged.

Validation: 45 test files, compiled CSS validation and 280 randomized matches. Regression coverage includes both proof slots, one/duplicate/identical/recycled cards, third-party challenges, automatic last-influence losses, match end, prior private/public knowledge, explicit sharing, caught bluffs, original Intrigue proof replacements, Treasury conservation, and private UI reveals only at the correct resolution stage.
