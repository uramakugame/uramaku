# Local multiplayer load measurements — Stage E

Measured 24 November 2026. The existing single-process design handled all tested local workloads. These are short local measurements, not a Railway capacity guarantee or a hosting quote. No multi-instance infrastructure or networking replacement is justified by these results.

## Method

- Node 26.13.0, Apple M3 Pro, 11 logical CPUs, 18 GiB host memory, macOS arm64. Server and generator share the machine. Railway will use a different CPU, Linux, storage and network.
- Real HTTP/Socket.IO clients: 90% WebSocket, 10% HTTP polling. Four players per room; Classic, Faction and Treasury configurations are mixed across rooms.
- Actual SQLite snapshots on local disk, WAL with synchronous FULL. Successful commands use IDs, sequences and expected room/turn/decision metadata and wait for committed state. No in-memory database shortcut.
- Existing production quotas stay enabled. An isolated one-hop proxy model gives each client a distinct synthetic source IP; this is not verification of Railway's actual proxy path. Rooms are created in bounded batches before timing starts.
- Each active room takes one decision every 300 ms plus ACK/state convergence time. This is deliberately faster than people reading and selecting cards. Setup and final shutdown are excluded from latency/CPU averages; successful match recycling during the sample is included.
- Players prepare/confirm entries, leave/rejoin waiting lobbies, browse public/private rooms, ready/start, take actions, pass/challenge, counter, choose influence losses and Summon/Intrigue decisions, chat, and disconnect/resume once per room. Completed games are replaced by new matches to keep traffic active. Bots inspect only their own private state and public room state.
- Choices use a recorded seed, while deals use the unchanged game's normal randomness. Results vary between runs; these are not deterministic balance simulations.
- Response latency is end-to-end command ACK latency on this host. CPU is the server process's CPU time divided by elapsed time (1.0 = one fully busy core); memory is server RSS, not generator memory. IPC aggregate telemetry is opt-in for benchmark child processes only and exposes no HTTP diagnostics endpoint, tokens, names or hands.
- Database timing covers each full transaction, including commit. The histogram has coarse upper bounds. Database maximum includes setup; averages/count deltas are sampled around the activity interval and can include the small boundary interval. Event-loop measurements include the monitor's 20 ms resolution, not a 20 ms per-command delay.

## Fast activity: 30 seconds per case

| Rooms | Peak connections | Commands | ACK p95 ms | ACK p99 ms | Peak RSS MiB | Mean CPU cores | Mean DB transaction ms | Games completed | Command errors / timeouts / DB failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 25 | 100 | 3,320 | 8.9 | 13.3 | 111.6 | 0.147 | 0.368 | 44 | 0/0/0 |
| 50 | 200 | 6,622 | 9.1 | 19.0 | 128.4 | 0.193 | 0.257 | 88 | 0/0/0 |
| 100 | 400 | 13,209 | 9.5 | 22.2 | 150.9 | 0.330 | 0.216 | 175 | 0/0/0 |
| 200 | 800 | 26,014 | 8.4 | 30.1 | 300.6 | 0.513 | 0.173 | 326 | 0/0/0 |

Every room reconnected successfully: 25, 50, 100 and 200 authenticated seat recoveries respectively. Every case exercised challenges, counters, chat, actual influence choices, Summon and normal game completion. Database p95 transaction histogram upper bounds were at most 1 ms across all four runs. Detailed counts, action-only percentiles, event-loop values, database/WAL sizes and JSON traffic are in `load-test-results.json`.

## Slower activity comparison

A separate **50-room / 200-player run for 60.5 seconds** used a 2-second pause between each room's decisions. It completed 8 games, processed 1,912 commands and recovered all 50 seats without command errors, timeouts or database failures. ACK p95 was 14.6 ms, peak RSS 119.1 MiB and average CPU 0.035 cores.

This remains a simplified model: people may take longer and multiple players sometimes respond at once. It is a useful lower-rate comparison, not a forecast of human behavior or a long soak test.

## Traffic and the $5–10 target

The slower 50-room run sent about **2.82 GB/hour of state JSON** at that sustained activity rate. The 300 ms stress run sent about 16.9 GB/hour for 50 rooms. Both exclude static image/script downloads, Socket.IO framing, polling overhead and TLS. Treat these as application-payload lower bounds, not billable egress measurements.

Railway's [current published rates](https://docs.railway.com/pricing), checked 24 November 2026, are a $5/month Hobby minimum, RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB and used volume space $0.15/GB-month. The $5 subscription counts toward resource usage; it is not added again to a larger usage bill. Taxes, optional services and backup storage are outside the simplified examples.

Illustrative monthly totals using those rates (decimal GB, average resource use over the month):

| Scenario | Average RAM | Average CPU | Monthly egress | Used volume | Estimated base resource total | Hobby bill floor applied |
| --- | --- | --- | --- | --- | --- | --- |
| Light initial testing | 0.25 GB | 0.05 cores | 10 GB | 0.25 GB | $4.04 | About $5 |
| Busier small beta | 0.50 GB | 0.10 cores | 40 GB | 0.25 GB | $9.04 | About $9.04 |
| Sustained higher usage | 0.50 GB | 0.25 cores | 100 GB | 0.50 GB | $15.08 | About $15.08 |

These are assumptions to budget against, not conversions from the Mac's process CPU/RSS to Railway charges. The $5–10 target is plausible for light usage; it does **not** buy a guarantee of 50 continuously active rooms all month. At the slower observed state-payload rate alone, one hour a day with 50 rooms would generate approximately 84.5 GB/month (about $4.23 egress before protocol/assets). Watch real egress as well as CPU/RAM.

The main future optimization, if deployed traffic costs warrant it, is reducing repeated snapshot payloads (static role metadata and unchanged history) or measured compression. Any such change should preserve per-player privacy, resync and existing shared UI; it is outside this preparation change. There is no evidence here requiring Redis or a separate database.

## What remains unproven

- Docker image build and live Linux startup: Docker/CLI were unavailable here. The actual Railway build must pass.
- Railway disk latency, billed CPU/memory/egress and proxy forwarding behavior. Start with a private deployment, verify the IP chain, then repeat 25/50-room activity there with owner authorization.
- Sustained 15–60 minute memory behavior, slow/mobile internet, large spectator populations, internet-scale abuse, heavy parallel browser rendering and peak asset delivery. This benchmark has four player seats per room and no spectator crowd.
- Live platform restart and volume-backup recovery. Existing automated child-process tests cover crash/restart and all saved pending decisions locally; the deployed volume still needs a smoke/recovery rehearsal.

A sensible initial launch remains one always-on service with one volume. Use actual Railway charts during the private beta before announcing a room capacity or increasing the budget.

## Reproduce

```bash
npm ci
npm run test:load
npm run test:load -- --rooms 50 --duration 60 --think-ms 2000 --output load-results/slower.json
```

Default output is `load-results/results.json`, excluded from Git. Only aggregate reviewed results are included under `docs/`. The runner creates temporary private databases, stops its server, and removes those files after each case; it never touches the normal `data/` directory or targets an external server. A small three-room smoke run is also part of `npm test`. Use `--rooms`, `--duration` and `--think-ms` to change the workload; quota changes are not needed for this local model.
