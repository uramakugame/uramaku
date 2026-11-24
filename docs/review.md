# Review and reorganization

Reviewed the server entry point, game engine, session handling, browser game, tutorial, localization, role metadata, asset catalog, card renderer, audio, stylesheet sources and builder, test files and documentation.

## Changes

- Canonical English role/action/counter IDs now run through game state, socket events, browser code, tutorial data, translation keys, CSS selectors, assets and tests.
- Role metadata now exposes its role/action/counter IDs. The engine derives its role-action lookup from those shared definitions.
- Automatic Income and the selected Earn action have distinct identifiers.
- Runtime files are grouped by server, shared definitions, browser JavaScript, CSS and assets.
- Tests are grouped by subsystem and discovered automatically by the runner. The randomized economy suite has an explicit stress-test command.
- Removed unreachable layout-preview controls that had no server event handlers.
- Current onboarding, architecture, terminology, gameplay, artwork and styling guides live under `docs/`. Dated release notes live under `docs/history/` with current terminology.
- Challenge duration has one named engine constant.
- The server rejects a repeated Start request after a match has started. A socket-level regression verifies that a running or completed room cannot be reset this way.

## Verification

The automated suite checks gameplay, privacy, counters, card replacement, Treasury invariants, reconnects, chat isolation, localization, tutorial scenes, source-level UI contracts, artwork integrity, static paths and generated styles. The economy stress command runs 280 randomized matches.

All 31 regular test files passed. All 280 randomized matches finished with consistent coin totals. Static dependency paths and JavaScript syntax were checked. Approved portrait bytes and English/Japanese printed ability text were compared with the previous build.

Live browser rendering remains unverified in this environment. The CSS cascade follows the existing source order. Match storage remains in the server process, as described in [architecture](architecture.md).
