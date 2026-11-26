# Private engagement dashboard

The application records daily aggregate counters in the existing SQLite database on the persistent volume. No analytics service, paid dependency, account system or external database is needed. Gameplay, portraits and public UI are unchanged.

## Enable after deploying the code

1. Generate a fresh password in a password manager (at least 24 characters; 32 or more random characters recommended). Do not use a player reconnect token or commit the password to Git.
2. In the **uramaku service → Variables**, set `METRICS_PASSWORD` to that password. It must be 24–256 characters without line breaks. Apply the pending Railway changes with **Deploy**.
3. Visit **https://uramakugame.com/admin/metrics**. The browser presents its native sign-in dialog. Username: **admin**. Password: the value you configured.
4. Select 7, 30 or 90 days, or All time. Refresh manually when you want current figures. EN ⇄ JP uses the game's shared language preference.

The dashboard and its data/assets return 404 while the password is unset. Tracking still runs. With a password configured, HTML, scripts, styles and JSON all require authentication. Use HTTPS on the live site. The password is checked on the server, never embedded in HTML/JavaScript, stored in app browser storage, written to SQLite, or placed in URLs. The browser may retain HTTP Basic credentials until its session closes; use a private browser window on a shared computer. Rotate the Railway variable and deploy to revoke the old password.

Failed authentication is limited to 10 attempts per network per minute with bounded in-memory buckets. The existing explicit Railway proxy setting identifies the network. A brief lockout can also affect the administrator on that network. Protected responses use `no-store`, deny framing, restrict scripts and suppress referrers. JSON returns aggregate numbers only. There is no public dashboard link or mutation endpoint.

## Definitions

| Figure | Definition |
| --- | --- |
| Rooms created | Successful room creation, including lobbies that never start. |
| Matches started | A committed transition from waiting lobby to playing. Mode and starting player count are captured here, after lobby settings are finalized. |
| Mode breakdown | Classic, Faction, Treasury, Faction + Riot; mutually exclusive. |
| Matches completed | A tracked match reaches the engine's finished status. Elimination and wealth victories count, including endings caused by forfeits or owner kicks. |
| Completion rate | Of matches **started in the selected date range**, the proportion finished so far. An ongoing game is not automatically classified as abandoned. |
| Player seat joins | New player seats successfully enter a room. Refresh, back-navigation and reconnecting to the same seat do not add joins. Repeat visits/new seats or tabs may count again. This is **not unique people**. |
| Player participations | Starting player counts summed over matches; a player in three matches contributes three participations. |
| Average players | Player participations / starts. |
| Average completed duration | Wall-clock start-to-finish time, including challenge timers, idle periods, disconnects and server downtime. |
| Average completed turns | Engine turn number when a tracked match finishes. |
| Public/private starts | Room visibility at match start. Changing visibility in a lobby does not count as a new match. |
| Spectator seat joins | New spectator seats, with the same reconnect exclusions as player seats. |
| Lobbies closed without a match | Lobby deletion before play, whether through explicit departure or the existing empty-lobby expiration. |
| Current figures | Connected player/spectator seats, browser Socket.IO connections, waiting lobbies and playing matches; not retained historically. Browser connections include visitors who have not joined a seat. |

Days are UTC calendar days. A 7-day range means today and the previous six days. Starts and completions are displayed on their respective dates, so completions in a period can exceed starts in that period. The completion-rate denominator instead uses the start-date cohort. All-time totals include all recorded days; the all-time daily table displays only the latest 90 days.

Tracking begins when this update is installed, even before the dashboard password is set. Do not interpret zero as proof of no earlier traffic. Deleted historical rooms cannot be reconstructed. Existing waiting lobbies can contribute future starts; matches already playing when the update is installed are excluded from start/completion/duration measures because their start time was not recorded. Tutorial activity, homepage visits, unique visitors and returning-person counts are not collected. Those would need a separate explicitly designed visitor measurement feature.

## Storage, correctness and performance

Schema version 2 adds `engagement_meta`, `engagement_daily` and `engagement_active`. **Room snapshot format stays version 1**, so the additive startup migration never rewrites cards, decks, tokens or pending decisions. The backup validator accepts both database versions; a version-1 file migrates on startup. Older application builds reject a version-2 database rather than silently using an unsupported schema.

Daily counters are updated **inside the same transaction as the room transition**. A rolled-back/invalid action does not increment them. Durable command receipts prevent duplicate counts on retries. Reconnect presence changes and restored snapshots do not count as new entries. Completion is captured before a finished room can be cleaned up. Aggregate counters have no room foreign key and survive deletion; only temporary start-time/mode metadata references an active room and is cleared on completion/deletion. No player names, IDs, IPs, tokens, chats, influences or per-person event history are retained in the analytics tables. The existing game persistence remains unchanged.

No extra transaction is opened for a metric. Most ordinary turns add no analytics writes. The dashboard is read-only, has no background polling, and restricts date ranges. Counters grow by daily metric/mode groups, rather than by action or person. The process retains only bounded database timing buckets.

## Investigating latency

The dashboard's write timings measure SQLite transaction work plus disk commit, not network round trips. Mean, approximate p95 upper bucket, failure count and sample count reset on server restart; the engagement totals persist. A p95 upper bucket of 5 ms means at least 95% of measured transactions took no more than 5 ms; it is not an exact percentile. Values over the largest bucket are displayed as >1,000 ms. Timings include all application database transactions, including entries, presence and migrations.

Railway's Trial status alone does not establish the cause of latency. Compare server CPU/memory and request timing with these transaction timings; inspect the current service region and the browser's Socket.IO WebSocket transport. Challenge timer waits and deliberate attack/draw animation sequencing can feel like latency without a slow command response. Do not switch off durable commits or change approved animations simply to hide a delay.

No production configuration or hosting plan is changed by this source update.

## Validation for this update

The complete automated suite passed **80/80 test files**, plus the compiled stylesheet check. Added coverage includes all four mode buckets, UTC completion cohorts, failed/duplicate commands, rolled-back completions, room-code reuse, room deletion, real process restart, an existing version-1 database with a pending hidden claim, password authentication and protected assets, login throttling, malformed ranges, private-data exclusion, and EN/JP rendering/error states.

A sequential local comparison used the deployed source (`e014f08`) and this update on the same Mac, with the existing isolated load runner: **50 rooms / 200 seats**, 15-second activity samples, approximately one decision per room every 300 ms, 90% WebSocket and 10% polling, SQLite WAL/FULL. Production was not contacted or load-tested.

| Measure | Deployed source | With engagement metrics |
| --- | ---: | ---: |
| Commands | 3,107 | 3,048 |
| Completed games during sample | 31 | 29 |
| Successful seat reconnects | 50 | 50 |
| Command ACK p95 | 11.33 ms | 11.19 ms |
| Mean database transaction | 0.270 ms | 0.294 ms |
| Peak server RSS | 122.6 MiB | 123.7 MiB |
| Command errors / timeouts / database failures | 0 / 0 / 0 | 0 / 0 / 0 |

This short, single-host comparison found no material regression in command latency. Match paths and scheduling vary, so the slight p95 difference is not evidence of a speed improvement. Local disk/network results do not predict Railway latency or capacity. The benchmark measures the always-on counters; it does not simulate concurrent administrators refreshing the dashboard. Existing 25/100/200-room reports remain historical and were not rerun for this feature.
