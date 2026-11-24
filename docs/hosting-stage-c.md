# Hosting preparation — Stage C: public rooms

Implemented November 21, 2026. Builds on the durable Stage B server. This adds public lobbies on the server you run; it does not deploy the application to Railway.

## Using public rooms

1. Create a room as before. New rooms are Private and start with a 15-second challenge timer.
2. In the lobby, edit Room name and choose Save name. Set Visibility to Public to publish the lobby immediately. Only the owner can change these controls before a match starts.
3. From Home in another tab/device on the same running server, choose Browse rooms. Search by name or code, then Join and choose a nickname using the existing entry dialog.
4. Switching back to Private hides the lobby without changing its code, seats, settings or connection state. Private code invitations and the existing spectator option remain available.

The room list shows name/code, Classic/Faction/Treasury/Treasury + Faction, player count out of eight, waiting status and Join. Initially it includes only waiting public rooms with an available seat and a connected owner. Offline reserved seats remain occupied. A restored public lobby reappears when its owner reconnects. There is no matchmaking or automatic joining.

Names and visibility persist in the existing SQLite snapshot. Search returns a strict public field allowlist and never hands, deck order, private investigations or reconnect credentials. Queries are bounded and paginated and do not write to the database. Final membership still checks capacity transactionally, so two prepared joins cannot both take the final seat.

The browser uses coalesced live updates and debounced search, ignores out-of-order replies, and unsubscribes on close/disconnect. User-entered names/codes are escaped. The interface uses the existing warm panel/dialog styles and supports EN/JP.

## Other requested changes

- The lobby EN ⇄ JP toggle now appears immediately to the left of Leave room. Its former roster position is removed; the match layout is unchanged.
- Challenge duration accepts whole seconds from 5 through 60, defaulting to 15 in new rooms. The on/off setting remains. Server validation, engine defaults, input attributes, countdown fallback and English/Japanese help all match.
- Existing valid saved durations remain as configured. Legacy durations below 5 are normalized to 5; missing/invalid settings use the new default. An active pending challenge retains its original deadline/duration.
- Actions, How to Play and Treasury Mode are separate guide tabs. Existing Treasury/Riot explanations are moved verbatim to Treasury Mode in both languages; action descriptions and portraits are unchanged.

## Updating and testing

Use Node 26 and `npm ci`, then `npm start`. Keep the existing `data/` directory when replacing code. Startup adds missing private room metadata and normalizes old timer settings without changing saved cards, coins or turns. The SQLite schema remains compatible with Stage B snapshots.

Run `npm test` and `npm run test:economy-stress`. Discovery tests cover private defaults, owner authorization, persistence/restart, literal name/code searches, all mode combinations, full/started/offline-owner filtering, reserved seats, concurrent final-seat joins, safe listing fields and zero database writes during browsing. UI tests exercise bilingual escaped rows, debounced requests, stale-reply protection, reconnect/join handoff, cleanup and the three guide tabs. Existing gameplay/tutorial/asset and crash-recovery tests still run. These tests do not establish Railway capacity.

## Recorded results

| Check | Result |
| --- | --- |
| Automated suite | 57/57 test files passed; compiled CSS current |
| Randomized matches | 280/280 completed; no economy invariant violations |
| Public directory | Authorization, filtering, search, pagination, modes, notifications, reserved seats and final-seat contention passed |
| Persistence | Names/visibility survive process restart; old snapshots gain private metadata and safe timer defaults |
| Guide content | Original EN/JP descriptions preserved verbatim across the separate tabs |
| Approved artwork | Original asset bytes preserved |

## Still pending

Disconnected-player owner kick controls during matches, the approved abandoned/completed-room cleanup, abuse/resource limits, real 25/50/100/200-room load measurements, and final Railway deployment/backup preparation. No paid hosting or internet publication has occurred. Approved artwork and role/action balance are preserved.
