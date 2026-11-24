# Railway deployment preparation — Stage E

Prepared 24 November 2026. This package does not create a Railway project or deploy the game. Complete a small private smoke test before sharing a public URL.

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
| `TRUSTED_PROXY_HOPS` | `0` until verified | See the proxy gate below |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `10` | Time for graceful socket closure and SQLite checkpoint |
| `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` | `0` | One writer/instance with the volume |

`.env.example` is a reference, not an automatically loaded file. Put variables in Railway's Variables panel. The existing room/request limits are documented in `hosting-stage-d.md`; leave them unchanged for initial testing.

## Proxy validation: required before public opening

Railway terminates HTTPS before requests reach Node. The IP quota code intentionally ignores forwarded IP headers by default. With `TRUSTED_PROXY_HOPS=0`, users behind the same platform proxy can share the 128-connection/IP ceiling and request buckets. This is safe for initial private testing but is not a finished public traffic configuration.

During the first private deployment, inspect the actual peer and `X-Forwarded-For` chain in a temporary, access-restricted diagnostic deployment/log, using clients on two different networks. Verify that Railway appends/overwrites the trusted right-hand end. Repeat with an intentionally forged left-hand value; it must not control the selected IP. Remove diagnostics before public opening. If there is exactly one trusted appending proxy, set `TRUSTED_PROXY_HOPS=1`; otherwise use the verified fixed hop count. A direct route around that proxy must remain unavailable. Adding Cloudflare or another proxy requires repeating this check.

The local load tests use an explicit one-hop model and distinct synthetic client addresses. They verify that the existing quota implementation works under that model; they cannot establish Railway's actual forwarding topology. This is an outstanding live-platform check, not a reason to disable quotas or increase them to hide a shared-IP issue.

After generating the final domain, optionally set `ALLOWED_ORIGINS=https://YOUR-DOMAIN` (comma-separated HTTPS origins for multiple approved domains). A cross-origin browser handshake is then refused. Origin checks supplement token authorization; native clients without an Origin header still require valid membership, commands and quotas. Health checks do not pass through the browser-origin restriction.

## Private go-live smoke test

- Use two browsers/devices over the HTTPS domain. Create a Private room, toggle Public without changing its code, find it by name/code, join and start. Confirm EN/JP, portrait/card-back assets, audio controls and mobile entry layout.
- Test both WebSocket and polling connections. Confirm ready/start, chat, challenges/counters, Summon board decisions, influence loss, Treasury mode and normal completion.
- Refresh and navigate away/back in the same tab: the original seat and private state must return. A token from another room must not recover that seat. A new tab has a separate identity; closing a tab is not guaranteed recovery.
- Restart/redeploy during a timed claim: the original deadline continues. Repeat during Summon plus a challenger penalty, Intrigue concealment and counter resolution. Reconnect all clients and check private hands/intel are still private.
- Disconnect a guest; owner Kick should forfeit their remaining influences and disappear afterward. Check empty lobby cleanup after five minutes; completed empty rooms should disappear; offline active games must survive.
- Create a backup, restore it to a fresh filename in a private test deployment and reconnect a test seat. Check Railway memory/CPU/volume graphs and error logs. Verify the actual proxy configuration above before opening public discovery to general traffic.

`/health` checks application/SQLite readiness and returns 503 during shutdown or a recorded storage write failure. Railway's deployment health check is a startup/readiness check, not ongoing uptime monitoring. It reveals only readiness and room count. Add an external uptime check later if desired.

## Startup, restart and updates

The store creates schema version 1 on a new database inside the volume. Existing compatible databases open normally; unknown newer schemas fail startup. No destructive migration is included. Room snapshots, hashed seat credentials and command receipts are committed before publication. Restored rooms mark users offline until authenticated reconnection, and an expired challenge resumes from its saved deadline rather than receiving a new timer.

SIGTERM stops maintenance/timers, closes Socket.IO and checkpoints/closes SQLite. An abrupt kill still relies on SQLite WAL recovery and committed snapshots. Railway volumes attach to one active deployment at a time, so a deploy can have a brief disconnect/downtime even with health checks. Plan for reconnect, not zero downtime. Never scale this SQLite/volume service to multiple writers.

Before updating, make a backup and run the tests. Deploy compatible code against the same volume/path. Roll back source only when that source understands the saved schema/snapshots. Restoring a database rolls back all games to its timestamp; announce maintenance before doing that. Do not copy an older local `data/` directory over a live volume.

## Backups and recovery

Enable daily Railway volume backups and a weekly schedule if desired. Make a manual backup before each production update. Railway backups stay within the project/environment; an independent encrypted off-volume copy is useful for disaster recovery. Volume backups, portable exports and credentials contain private game state and must never be put under `public/` or committed to Git.

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

Start on Hobby, one service and one volume, with usage notifications around the $5–10 monthly target. A hard spending cap, if chosen, can stop games; it is a budget tradeoff rather than a reliability feature. See the measured scenarios in `load-test-report.md`. Local benchmarks do not prove a Railway instance size or monthly bill; repeat 25/50-room activity against a private Railway deployment and watch its actual CPU/RAM/egress before advertising capacity.

Still required outside this package: Railway account/project, connected private source, persistent volume, generated domain, actual Docker build on Railway, live proxy validation, deployed smoke/restart/backup checks, and feedback/campaign destinations when ready. Docker/CLI are unavailable in this workspace, so the Dockerfile has been reviewed but not built here. A clean production-only dependency installation and runtime serving check passed locally, which does not substitute for the Linux container build. No live service was created and no billing was started.

## Local verification for this package

- `npm test`: 75/75 test files passed, including the small load-runner smoke test; compiled CSS is current.
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
