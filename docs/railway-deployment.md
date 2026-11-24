# Railway deployment preparation — Stage E

Prepared 24 November 2026. URAMAKU is running on Railway Trial at `https://uramakugame.com`. HTTPS, health and polling-handshake checks passed; the owner confirmed gameplay, reconnection, restart persistence and public/private discovery. This guide covers the service settings and remaining checks before broader testing. Scheduled backups are intentionally disabled; spending alerts are deferred until the move to Hobby.

## Architecture and source

Use one always-on Node 26 service, the existing Express/Socket.IO transport (WebSocket with HTTP polling fallback), and one SQLite database on a persistent volume. No Redis, separate database server, accounts or matchmaking are required. SQLite schema and snapshot version remain 1; gameplay and artwork are unchanged.

The included `Dockerfile` installs the locked production dependencies, copies only runtime source and starts `node server/index.js`. It does not include local databases, credentials, backups, tests or dependency folders. CSS is already built. `PORT` is supplied at runtime; the application binds to `0.0.0.0`.

Railway's current documentation deprecates `railway.json`/`railway.toml` config-as-code for new services. This simple setup uses the Dockerfile and service settings, avoiding an additional infrastructure library. See the [current migration notice](https://docs.railway.com/config-as-code).

## First deployment

1. Run `npm ci`, `npm test` and, when resources allow, `npm run test:load` on the source you intend to publish. Review `docs/load-test-report.md` for the local measurements and limits of those measurements.
2. Put the **contents** of `uramaku-browser/` in a private GitHub repository. Keep `.gitignore`; never add `data/`, backups, `.env` or reconnect tokens. Alternatively, use Railway's authenticated CLI with the same directory as the project root. This step requires the owner's account/source connection; no credentials belong in chat or source.
3. Create a Railway Hobby project and a service from that source. Set the service root directory to the directory containing `Dockerfile` and `package.json`. Use the Dockerfile builder. Leave build/start overrides empty so the image command runs. No pre-deploy database command is needed.
4. Attach a persistent volume to this service with mount path **`/data`**, before the first successful start. Use one service instance/replica. Do not enable Serverless/sleep: WebSocket sessions, saved challenge deadlines and cleanup work need the service running.
5. Set the variables below. Railway supplies `PORT`, project identifiers and `RAILWAY_VOLUME_MOUNT_PATH`; do not invent or manually override the latter to bypass the startup check.
6. Set health-check path **`/health`**, with the default 300-second startup timeout. Set restart policy **On failure**, maximum 10 retries. Set deployment draining to 10 seconds through the variable below, and leave overlap at 0. Add a generated HTTPS public domain for the private smoke test.
7. Deploy. Verify the logs report a listening server and `/health` returns `{"ok":true,...}`. A missing volume, database integrity/schema failure or invalid production path must fail startup. Do not work around it by switching to an ephemeral database.

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Required production validation |
| `SQLITE_PATH` | `/data/uramaku.sqlite` | Must be inside the attached volume |
| `HOST` | `0.0.0.0` | Already the image default |
| `PORT` | Railway provided | Do not pin it to the local port |
| `ALLOWED_ORIGINS` | Empty initially | Browser Socket.IO requests must match the request host; production origins require HTTPS |
| `TRUST_RAILWAY_PROXY` | `1` on Railway HTTP edge | Use Railway's validated `X-Real-IP`; requires a Railway-provided project/environment marker |
| `TRUSTED_PROXY_HOPS` | `0` | Keep zero when Railway mode is enabled; reserved for a different verified fixed proxy path |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `10` | Time for graceful socket closure and SQLite checkpoint |
| `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` | `0` | One writer/instance with the volume |

`.env.example` is a reference, not an automatically loaded file. Put variables in Railway's Variables panel. The existing room/request limits are documented in `hosting-stage-d.md`; leave them unchanged for initial testing.

## Client IPs and the Railway edge

Railway terminates HTTPS before requests reach Node. By default the quota code uses the socket peer, so players behind a platform proxy can share the 128-connection/IP ceiling and creation/entry/request buckets. This can reject unrelated players under load.

After deploying the Railway-IP update, set `TRUST_RAILWAY_PROXY=1` and leave `TRUSTED_PROXY_HOPS=0`. This uses Railway's documented `X-Real-IP` header instead of assuming a fixed `X-Forwarded-For` chain. It accepts one valid IPv4/IPv6 address, normalizes IPv4-mapped addresses and falls back to the peer for missing or invalid values. Comma-separated chains and zone-qualified addresses are rejected. The flag fails startup outside a Railway-marked environment or if combined with fixed-hop mode. IPs stay in the existing bounded in-memory quota map; they are not added to database snapshots, public responses or logs.

Enable this only for ingress through Railway's HTTP edge. Do not expose a direct TCP path around the edge or enable the flag for localhost/ngrok. The generic fixed-hop option remains available for other independently verified proxy paths. Introducing an external CDN changes which network the edge sees and needs a separate review.

Railway's official [networking specifications](https://docs.railway.com/networking/public-networking/specs-and-limits) document `X-Real-IP` as the client's remote IP. A 24 November check of the public diagnostic endpoint linked by Railway support showed that the edge replaced forged `X-Real-IP` and `X-Forwarded-For` inputs; its forwarding chain contained multiple addresses. That confirms the preference for the dedicated header, but it is not an inspection of this service's incoming headers. Local unit and real polling/WebSocket tests simulate the edge and verify independent clients, same-IP limits, missing/invalid headers and disconnect release. Test from separate networks on the deployed app before expanding public traffic.

The earlier 25/50/100/200-room load results used an isolated one-hop model. They remain measurements of the original snapshot/transport workload, not a new load measurement of the Railway-header adapter or a guarantee of live-platform capacity.

After generating the final domain, optionally set `ALLOWED_ORIGINS=https://YOUR-DOMAIN` (comma-separated HTTPS origins for multiple approved domains). A cross-origin browser handshake is then refused. Origin checks supplement token authorization; native clients without an Origin header still require valid membership, commands and quotas. Health checks do not pass through the browser-origin restriction.

## Private go-live smoke test

- Use two browsers/devices over the HTTPS domain. Create a Private room, toggle Public without changing its code, find it by name/code, join and start. Confirm EN/JP, portrait/card-back assets, audio controls and mobile entry layout.
- Test both WebSocket and polling connections. Confirm ready/start, chat, challenges/counters, Summon board decisions, influence loss, Treasury mode and normal completion.
- Refresh and navigate away/back in the same tab: the original seat and private state must return. A token from another room must not recover that seat. A new tab has a separate identity; closing a tab is not guaranteed recovery.
- Restart/redeploy during a timed claim: the original deadline continues. Repeat during Summon plus a challenger penalty, Intrigue concealment and counter resolution. Reconnect all clients and check private hands/intel are still private.
- Disconnect a guest; owner Kick should forfeit their remaining influences and disappear afterward. Check empty lobby cleanup after five minutes; completed empty rooms should disappear; offline active games must survive.
- Check Railway memory/CPU/volume graphs and error logs. Use clients on different networks to test public entry after enabling Railway IP mode. A backup/restore rehearsal is optional for this beta; restart persistence on the attached volume is the required recovery check.

`/health` checks application/SQLite readiness and returns 503 during shutdown or a recorded storage write failure. Railway's deployment health check is a startup/readiness check, not ongoing uptime monitoring. It reveals only readiness and room count. Add an external uptime check later if desired.

## Startup, restart and updates

The store creates schema version 1 on a new database inside the volume. Existing compatible databases open normally; unknown newer schemas fail startup. No destructive migration is included. Room snapshots, hashed seat credentials and command receipts are committed before publication. Restored rooms mark users offline until authenticated reconnection, and an expired challenge resumes from its saved deadline rather than receiving a new timer.

SIGTERM stops maintenance/timers, closes Socket.IO and checkpoints/closes SQLite. An abrupt kill still relies on SQLite WAL recovery and committed snapshots. Railway volumes attach to one active deployment at a time, so a deploy can have a brief disconnect/downtime even with health checks. Plan for reconnect, not zero downtime. Never scale this SQLite/volume service to multiple writers.

Before updating, run the tests and deploy compatible code against the same volume/path. The attached volume preserves games during ordinary updates and redeployments. A manual backup is optional when preserving unfinished matches through a risky state/schema change matters. Roll back source only when that source understands the saved schema/snapshots. Restoring a database rolls back all games to its timestamp; announce maintenance before doing that. Do not copy an older local `data/` directory over a live volume.

## Backups and recovery

Scheduled backups are not required for this beta. The owner accepts losing unfinished matches if the database is damaged; persistent storage covers ordinary code updates/redeployments. The optional manual tools below remain available for a future state/schema change. Backups contain private game state and must never be put under `public/` or committed to Git. Railway volume backups stay within the project/environment; wiping a volume also deletes its associated backups.

For a portable consistent SQLite export, execute **inside the running service/container that has the volume**, using Railway SSH or its supported shell access:

```bash
npm run db:backup -- --to /data/backups/uramaku-2026-11-24.sqlite
```

Use a fresh dated filename each time. The helper uses SQLite's online backup API, includes committed WAL changes, checks integrity/schema/snapshots, creates the result with mode 0600 and refuses to overwrite an existing file. It does not copy a live database using ordinary file-copy operations. Download through authenticated volume tooling and keep the copy private. Do not set a Railway pre-deploy command for this: the volume is mounted at service startup, not pre-deploy time.

Recovery rehearsal, or a real restore during maintenance:

```bash
npm run db:restore -- --from /data/backups/uramaku-2026-11-24.sqlite --to /data/uramaku-restored-2026-11-24.sqlite
```

This validates and writes a **new** independent database; it never overwrites the open one. Stop access to the old service, set `SQLITE_PATH` to the new absolute filename, then deploy once against the same volume. Verify health and a test room before reopening traffic. Old WAL/SHM files must not be renamed or reused with the new database. Keep the original database for rollback until the restore is verified. Alternatively restore a Railway volume backup through its dashboard and complete the staged deploy. Treat that as maintenance with data loss since the backup timestamp.

## Budget and launch gates

Continue testing on the current Trial and monitor its remaining credits. Move to Hobby for ongoing hosting with the $5–10 monthly target; configure the proposed $8 Compute email alert when that control is available on the paid workspace. The alert is not a spending cap. A separate hard cap, if chosen, stops workloads when reached. See the measured scenarios in `load-test-report.md`. Local benchmarks do not prove a Railway instance size or monthly bill; repeat owner-authorized 25/50-room activity against a private Railway deployment and watch its actual CPU/RAM/egress before advertising capacity.

The live service is configured with a persistent `/data` volume and the custom domain above. The next code update adds the explicit Railway-IP option; enable it after that update is deployed. Remaining owner checks: one instance, Serverless disabled, On-failure restart policy, private testing from different networks, and actual resource use under a longer load. Spending alerts/Hobby remain deferred; campaign and feedback links remain placeholders. This patch does not change Railway settings or publish a deployment itself.

## Local verification for this package

- `npm test`: 77/77 test files passed, including the Railway-IP unit/wire checks and the small load-runner smoke test; compiled CSS is current.
- `npm run test:economy-stress`: 280/280 randomized matches completed without economy invariant failures.
- 25/50/100/200-room real Socket.IO load runs and the slower 50-room comparison completed without command errors, timeouts or database failures. See the aggregate report for exact workload and limits.
- Production-only `npm ci --omit=dev --ignore-scripts` install: startup, persistent SQLite, health, Home/About/tutorial and Socket.IO browser-client serving passed. The dev-only load client was absent.
- All 19 approved artwork files are byte-identical to the previous build. The existing shared game engine, role definitions and tutorial route are unchanged.
- UI checks use DOM adapters; a rendered desktop/phone review is still needed for layout feedback.

## Official references checked 24 November 2026

- [Express deployment](https://railway.com/guides/express)
- [Volumes and automatic mount variables](https://docs.railway.com/volumes)
- [Volume constraints](https://docs.railway.com/volumes/reference)
- [Volume backups](https://docs.railway.com/volumes/backups)
- [Health checks](https://docs.railway.com/deployments/healthchecks)
- [Variables](https://docs.railway.com/variables/reference)
- [Config-as-code migration](https://docs.railway.com/config-as-code)
- [Pricing](https://docs.railway.com/pricing)
- [Node SQLite online backup](https://nodejs.org/api/sqlite.html)
