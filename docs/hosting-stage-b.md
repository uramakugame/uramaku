# Hosting preparation — Stage B: persistence and restart recovery

Implemented November 21, 2026. Builds on Stage A; approved artwork and gameplay remain unchanged.

## Run locally

Use Node 26, then `npm ci` and `npm start`. SQLite initializes automatically at `data/uramaku.sqlite`. There is no separate database service or account setup. Stop/restart the process and refresh the same browser tab to recover the room. Preserve the data directory between application updates.

To select a location, set `SQLITE_PATH=/absolute/path/uramaku.sqlite` before starting the application. `:memory:` is available for isolated tests. Production rejects a missing, relative or in-memory path and requires its parent directory to exist. Railway will need a persistent volume mounted at runtime (for example `/data`, with `SQLITE_PATH=/data/uramaku.sqlite`); no Railway deployment is included in this stage.

## What is durable

Room code, host, settings/readiness, player IDs, coins, hands, deck/discards, eliminated cards, turn number/order, pending decisions/continuations, private investigations, Summon preview, chat and presentation event counters. Reconnect credentials are persisted only as SHA-256 hashes, separately from snapshots. A name never authorizes resuming a seat. Explicit leave/kick and room deletion revoke credentials. General token/room expiration and completed-room cleanup belong to Stage D.

The existing public/private projections still determine what each player or spectator receives. Files remain outside the served public directory. Database files and backups contain hidden game state and should stay private; local database files are created with restricted permissions. Do not upload a live database as part of the source ZIP.

## Ordering and failure behavior

1. Validate/authenticate the command and its expected room/turn/decision.
2. Apply it to an isolated candidate.
3. Commit the full snapshot, credential changes and command receipt in one SQLite transaction.
4. Publish the committed candidate, reconcile the timer, acknowledge and broadcast.

A failed commit leaves live gameplay unchanged. SQLite uses WAL and synchronous FULL. A retry after commit but before a received acknowledgment returns the previous result instead of charging/drawing again. Receipts are bounded to 512 per room; the per-seat accepted sequence also prevents replay after pruning. Old pending/turn requests are rejected. The browser serializes outgoing room commands, retries identical packets, and keeps them scoped to their original room.

Challenge expiration is independently committed. Absolute deadlines continue across disconnects and downtime: startup schedules the saved remainder or expires an elapsed window once. Other pending decisions remain for the correct participant; there are no automatic loss/card/counter choices. Proof replacement remains before failed-challenger loss and normal action/counter continuation, including Gossip.

The in-memory registry holds only published state. Presence is restored as disconnected and becomes connected when authenticated clients return. A server outage never forfeits every seat, starts a new match, redraws cards or resets Income. Lobby start still requires everyone connected and ready.

## Initial entry and browser storage

The browser first requests a server-generated prepared credential, saves it in sessionStorage, then confirms entry. The two-minute prepared record is durable but does not occupy a player seat. Confirmation consumes it atomically with membership. Lost replies, or a refresh/server restart between those steps, can recover through the saved credential. The browser retries confirmation without creating duplicate seats. Guaranteed recovery after closing a tab is outside the approved scope. Explicit Leave room intentionally forfeits/revokes the seat.

Legacy create/join/spectate events remain for compatibility; clients wanting first-reply-loss recovery should use prepare/confirm. Gameplay deduplication applies to requests carrying the ID/sequence metadata emitted by the current browser.

## Storage implementation and recovery

Node 26's built-in `node:sqlite` API avoids a native add-on installation and external database process. The [official Node documentation](https://nodejs.org/api/sqlite.html) currently labels that API a release candidate; the adapter is isolated and the tested Node release is pinned. Only one application instance should use this database. Synchronous commit latency, full snapshot/chat write costs and capacity still require the planned load tests.

Schema and snapshot version 1 are initialized transactionally. A database from a newer application version is rejected. Initialization, snapshot restoration and overdue decision recovery finish before the HTTP server starts; health is unsuccessful when the database is unavailable or a write fails. SIGTERM stops accepting commands and closes SQLite; abrupt SIGKILL recovery relies on already committed transactions.

Before manually copying a database for backup, stop the application cleanly and preserve the database location. For online backups use SQLite's backup facilities; copying only the main live file can omit WAL state. Automated backups, migration rollback documentation and Railway volume configuration will be completed in deployment preparation.

## Verification

Run `npm test` and `npm run test:economy-stress`. New tests cover transaction rollback, commit-before-broadcast, token hashes, atomic entry, expired prepares, lost confirmation replies, rejected/stale requests, pruning-safe sequences and browser retry cleanup. Real process tests kill/restart the server with thirteen simultaneous rooms, restore each pending phase and private/deck state, continue those decisions against uninterrupted engine results, recover a pre-confirmation entry, retry a lost-ACK action, and expire an elapsed challenge exactly once across repeated restarts. These are correctness tests, not a capacity estimate.

## Recorded results

| Check | Result |
| --- | --- |
| Automated suite | 53/53 test files passed; compiled CSS current |
| Randomized matches | 280/280 completed; no economy invariant violations |
| Real process recovery | 13 simultaneous saved rooms; all pending phases restored and continued |
| Failure paths | Rollback, lost ACK retry, expired deadline, initial-entry recovery and credential revocation passed |
| Dependency audit | Zero known vulnerabilities reported at verification time |
| Approved artwork/CSS | Original bytes preserved |

The tests include graceful shutdown and abrupt SIGKILL; no Railway capacity claim or paid deployment is part of these results.

## Still pending

- Public/private visibility controls, room names and searchable discovery.
- Active-match owner kick controls for disconnected players and approved lobby/completed-room cleanup.
- Abuse limits, 25/50/100/200-room load measurements, final Railway deployment configuration and backup/restore tooling.

No accounts, additional game modes, balance changes, replacement artwork or multi-instance infrastructure were added.
