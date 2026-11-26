# Hosting preparation — Stage D: room lifecycle and abuse controls

Builds on Stage C. This increment adds disconnected-player controls, the agreed cleanup policy and bounded public-server requests/resources. It does not deploy the game or establish hosting capacity. Game mechanics, approved assets, existing challenge deadlines and the 15-second default are unchanged.

## Using the controls

During a match, disconnected players show **Offline** on their player card. The owner gets a **Kick** control on those cards, using the existing lobby button style and a localized confirmation explaining the forfeit. The same binding serves both the lobby and match and prevents the button from also selecting an attack target.

The server rechecks ownership, match status and disconnection when it executes a kick. If the player has already reconnected, the kick is rejected. Otherwise the existing forfeit engine resolves their remaining influences, coins and pending continuation; their reconnect credential is revoked in the same transaction. A failed commit publishes neither the forfeit nor the revocation. An already owed challenge loss is preserved. Existing owner kick controls in the waiting lobby remain available for connected or disconnected guests. During a match, the Kick button is shown only for an offline opponent who still holds influences; it disappears as soon as the committed elimination snapshot arrives.

Disconnecting alone never forfeits a player, transfers ownership or pauses a challenge. A public lobby with an offline owner remains hidden from discovery. Guests can leave, and the owner can return with the original tab credential. Explicit owner departure retains the previous lobby behavior; this release adds no automatic host handover.

## Cleanup policy

| Room state | Policy |
| --- | --- |
| Waiting lobby with anyone connected | Keep, regardless of inactivity |
| Waiting lobby with no connected players or spectators | Delete after five continuous minutes; any member reconnecting resets the countdown |
| Active match, including everyone disconnected | Retain indefinitely until explicit departure/forfeit completes it; challenge deadlines continue normally |
| Completed match with anyone connected | Keep, including connected spectators |
| Completed match with nobody connected | Delete on the final departure/disconnect; maintenance retries if storage is temporarily unavailable |

An internal `emptyLobbySince` snapshot field tracks abandonment, independently of the database's last-write time. On restart, an already empty lobby keeps its existing timestamp. A lobby which previously had connected users begins a fresh empty period when the server restores it with no live connections. Empty completed rooms are removed at startup; an active match is never deleted on startup because its users are offline.

Removal commits room deletion, seat-credential revocation, command-receipt deletion and removal of prepared entries for that code together. Room codes can then be reused without an old token recovering the new room. Prepared entries expire after two minutes and are swept without needing another join request. Live/retained room credentials do not expire merely because of their age; explicit leave, kick or room deletion revokes them. Session storage still covers refresh/back navigation rather than guaranteed recovery after closing a tab.

Maintenance checks every five seconds by default, so abandoned-lobby removal can lag the threshold by one check interval. Unchanged rooms do not get rewritten, active snapshots are not cloned on every maintenance tick, and expired-entry deletion writes only when needed. Failed cleanup is retried without publishing uncommitted deletion.

## Configurable limits

All values are positive whole numbers, except `TRUSTED_PROXY_HOPS`, which also accepts zero. Invalid settings fail startup instead of silently disabling protection. The defaults are conservative starting limits, not measured capacity claims.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `EMPTY_LOBBY_TTL_MS` | `300000` | Continuously empty waiting-lobby lifetime; maximum 30 days |
| `ROOM_CLEANUP_INTERVAL_MS` | `5000` | Maintenance interval; maximum 60 seconds |
| `MAX_ROOMS` | `500` | Total saved/active rooms admitted; existing rooms are preserved when this cap is lowered |
| `MAX_SPECTATORS_PER_ROOM` | `32` | Spectator seats, including reserved disconnected seats; resume does not consume another seat |
| `MAX_CONNECTIONS` | `2048` | Simultaneous admitted Socket.IO connections, including browsers not in a room |
| `MAX_CONNECTIONS_PER_IP` | `128` | Simultaneous admitted connections sharing one resolved address |
| `RATE_CREATE_PER_10_MIN` | `30` | Create requests/preparations per resolved IP per ten minutes |
| `RATE_ENTRY_PER_MIN` | `120` | Join, spectator, prepare, confirm and resume requests per resolved IP per minute |
| `RATE_BROWSE_PER_MIN` | `240` | Room-list requests per resolved IP per minute |
| `RATE_REACTIONS_PER_MIN` | `30` | Aggregate reaction budget per resolved IP is eight times this value; each player also has a four-second cooldown |
| `RATE_PACKETS_PER_SEC` | `30` | Total registered requests per socket per second, including invalid payloads |
| `RATE_IP_PACKETS_PER_SEC` | `300` | Total registered requests per resolved IP per second |
| `MAX_RATE_BUCKETS` | `10000` | Maximum in-memory request buckets; idle entries expire rather than grow indefinitely |
| `TRUSTED_PROXY_HOPS` | `0` | Explicit fixed trusted proxy hop count, from 0 to 8 |

Request quotas use token buckets: they allow an initial burst of the stated count and refill steadily over the period. Limits count attempts, including rejected requests and retries. Refreshing cannot reset the per-seat reaction cooldown or IP entry/create quotas. Request counters are intentionally in memory and reset on a server restart; game state and room cleanup timestamps persist. No database write is needed for a rate rejection. Packet size is capped at 16 KiB; existing field lengths and authorization remain enforced.

Room and spectator capacity are checked again when membership commits, not just when an entry is prepared. Lowering a cap never deletes existing active rooms, expels existing spectators or prevents token recovery. The existing global maximum of 2,048 pending entry records and 512 command receipts per room remains in place.

### Proxies

By default only the actual socket peer address is used; a caller's `X-Forwarded-For` does not bypass limits. Set `TRUSTED_PROXY_HOPS` only when **all** application access follows a known fixed proxy path that correctly overwrites/appends this header. It selects an address counting from the trusted right-hand end; malformed chains fall back to the peer. Do not expose a direct route around that configured proxy path. The exact Railway proxy configuration will be checked in the deployment preparation stage. Localhost/ngrok tests work with zero; users behind that proxy share its IP quotas.

No accounts, external rate-limit service, Redis, matchmaking or additional database service is introduced. These controls bound application requests/resources; they do not replace upstream protection against large network floods.

## Updating locally

1. Stop the old process and replace the application code with this build.
2. **Keep the existing `data/` directory**, or retain the same `SQLITE_PATH` if customized. The ZIP contains no database or credentials.
3. Use the existing Node 26 setup, run `npm ci`, then `npm start`.
4. Refresh open browser tabs to load the new UI. Existing saved turns and challenge settings remain as configured.

SQLite schema/snapshot version 1 stays compatible. The internal lifecycle field is added through the existing transactional startup normalization. No separate migration command or dependency changes are needed.

## Verification

- `npm test`: 63/63 test files passed, including the generated CSS check.
- `npm run test:economy-stress`: 280/280 randomized matches completed without economy invariant violations.
- New deterministic checks cover continuous-empty timing, spectator presence, reconnect resets, no idle database writes, cleanup rollback/cascades, token revocation, pending-loss continuation, kick authorization and reconnect races.
- Real Socket.IO child-process checks cover restart retention, original abandonment deadlines, completed-room cleanup, exact retained deck/decision state, rate rejection, competing prepared creates, spectator/connection caps and forged forwarding headers.
- UI adapters exercise EN/JP confirmations, cancellation, escaped names and stopping target-click/keyboard propagation. These checks do not claim a rendered-browser visual review.
- Existing challenge/counter, private-information, tutorial, multi-room crash recovery and approved artwork checks pass. Approved asset bytes match Stage C.

For manual testing, disconnect a guest during a claim, reconnect before kicking, then disconnect and kick them. Confirm that the turn resumes and the kicked tab cannot recover its seat. Test EN/JP and try clicking Kick while selecting an attack target. Leave one spectator connected to an otherwise empty lobby to confirm it remains. Close every lobby member for five minutes, then test the old code. Repeat with an active match to confirm it survives.

## Next increment

Stage E will measure 25/50/100/200-room activity and prepare Railway environment, persistent-volume, health/startup, backup and recovery documentation. Production rate/resource values can then be adjusted using measured workload and the actual proxy path. No Railway capacity, monthly cost or live deployment is asserted by this build.
