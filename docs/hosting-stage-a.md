# Public multiplayer preparation — Stage A

Implemented November 21, 2026. This is the first correctness/validation increment of the approved public multiplayer and hosting plan.

## Changes

- Challenge pass completion checks the identities of eligible living responders; a passed player who forfeits cannot make another player lose their response opportunity.
- An already owed challenge influence loss survives a claimant or target forfeiting. Finish that loss before canceling the affected continuation and advancing from the original acting seat. Multiple departures preserve that anchor.
- A challenger forfeiting satisfies their own penalty; a genuine Tax or Gossip can still proceed when its participants are valid.
- A connection already in a room must leave before creating, joining, spectating or resuming another seat. Repeated entry no longer creates ghost memberships.
- Every client event uses shared payload validation. Nicknames (18), messages (300), room codes, tokens, booleans, durations and card slots are checked before handlers run. Null/array/scalar packets are rejected. Nicknames/messages are not coerced from arbitrary objects or silently truncated by the server boundary.
- Optional acknowledgments are checked before use. Unexpected handler exceptions receive a generic error without returning exception details. New errors have English/Japanese translations.
- Starting a match requires all seats to be connected as well as ready.
- Node 26 is specified; `.nvmrc` records the tested 26.13.0 version. Runtime dependencies and the dependency tree are locked. Express is updated from 4.21.2 to 4.22.3 within the existing major version to resolve dependency advisories. Socket.IO remains 4.8.1.

Approved artwork, layouts, card animations, role names, action costs and normal challenge/counter resolution remain in place. Extort and Enforce stay at two coins. Gossip still resolves after proof replacement and the failed-challenger penalty. Challenge timers still default to ten seconds and continue during disconnects.

## Verification

Use `npm ci`, then `npm test` and `npm run test:economy-stress`. The test suite includes real Socket.IO clients over polling and WebSocket in a child server on an ephemeral loopback port, in addition to deterministic engine/handler and shared UI/tutorial tests. `socket.io-client` is a development dependency used only by these network tests.

The new regression cases cover eligible responder identity, claimant/target/challenger/unrelated forfeits, multiple departures during an owed penalty, Classic and Treasury conservation, counter continuations, input limits, safe errors/acknowledgments, duplicate membership, authenticated refresh and disconnected ready seats. Real network coverage includes joining, readiness, starting, Tax, challenge selection, chat, malformed packets and reconnection. This is correctness coverage, not a capacity benchmark.

## Recorded results

| Check | Result |
| --- | --- |
| Clean locked install (`npm ci`, cached packages) | Passed |
| `npm test` | 49/49 test files passed; compiled CSS current |
| Randomized engine matches | 280/280 completed; no economy invariant violations |
| Actual Socket.IO transports | Polling and WebSocket integration passed |
| Dependency audit | Zero known vulnerabilities reported at verification time |
| Approved art and styles | Exact original bytes preserved |

The new departure regression also fails against the original engine and passes against this version. These checks do not establish public hosting capacity, persistence or restart recovery.

## Still pending

1. SQLite snapshots, hashed persistent credentials, command receipts and commit-before-ack/broadcast recovery.
2. Private-by-default room names/visibility and public discovery using shared bilingual UI.
3. Disconnected-player owner kick controls and room cleanup. Waiting lobbies are abandoned only when no players or spectators have been connected for five continuous minutes; a completed room is removable when no connected users remain. Quiet connected lobbies stay open. Active offline matches remain recoverable.
4. Real 25/50/100/200-room load measurements, deployment readiness/draining, migrations, backups and Railway documentation.

No deployment has been made. This build still stores rooms and reconnect credentials in memory; a server restart still clears them until the persistence increment is complete.
