# Proposed Railway development environment

This guide describes the intended development setup. The source is published on `development`; verify the Railway environment and deployment independently.

| Git branch | Railway environment | Address | Data |
| --- | --- | --- | --- |
| `main` | Existing production | `uramakugame.com` | Existing production volume |
| `development` | New development | Separate Railway-generated URL | Separate test volume |

Both environments run the same application. No game-code environment switch or compatibility layer is needed. Testing in development must not write to the production database or engagement counts.

## Git access and first branch

Use authenticated Git in the project workspace. A GitHub connector is not required for command-line commits and pushes. Confirm repository write authentication before the first push; never put an access token, private key or password in chat or source files.

Before creating `development`, compare the current reviewed build with the latest remote `main` and preserve existing local edits. Start the development branch from the agreed production baseline and commit the reviewed changes there. Do not force-push or overwrite remote work. Keep runtime `data/`, credentials, dependencies and output ZIPs out of Git.

## Railway setup

1. In the existing project’s environment menu, choose **New Environment → Duplicate Environment**, based on production. Name the new environment `development`. Railway stages the copied configuration before deployment.
2. Verify that the environment selector says **development** before changing the service.
3. In its service settings, select the same GitHub repository and set the deployment trigger branch to `development`. Keep production tracking `main`.
4. Verify that development has its own volume mounted at `/data`. Start with a fresh test database. Never mount or restore the production volume into this service. `SQLITE_PATH=/data/uramaku.sqlite` may stay the same because the environments have separate storage.
5. Review copied variables. Keep `NODE_ENV=production`, `HOST=0.0.0.0`, Railway proxy configuration and the current deployment settings. Keep Railway’s injected `PORT`. Set a separate dashboard password, or leave `METRICS_PASSWORD` unset to disable the test dashboard.
6. Generate a separate Railway public domain for development. Use that origin in `ALLOWED_ORIGINS` if the variable is configured. Production retains `uramakugame.com`; no Namecheap changes are necessary for a Railway test URL.
7. Check the existing startup command, `/health` healthcheck and single-instance configuration, then review and apply the staged changes in **development**.
8. Test a room, refresh/reconnect and restart recovery on the new URL. Development rooms and metrics must remain separate from production.

## Normal iteration

After setup and authorization for development pushes: edit → run relevant tests → commit/push to `development` → Railway auto-deploys → test at the development URL. Merge reviewed changes into `main` when ready to release publicly. Protecting `main` with a pull-request requirement is an optional safeguard.

A second running service adds billable resource usage. Watch usage before deciding whether it should remain running between testing sessions. No exact cost has been assumed.

## Official references checked 26 November 2026

- [Railway environments and duplication](https://docs.railway.com/environments)
- [GitHub branch triggers and autodeploy requirements](https://docs.railway.com/deployments/github-autodeploys)
- [Persistent volume constraints](https://docs.railway.com/volumes/reference)
