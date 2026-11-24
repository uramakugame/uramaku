# URAMAKU

Multiplayer hidden-role card game with English and Japanese localization, a guided tutorial, optional visible factions, and Treasury Mode.

## Run locally

Use Node.js 26 (the tested version is recorded in `.nvmrc`). From this directory, install the locked dependencies and start the server.

```bash
npm ci
npm start
```

Open http://localhost:3000. Create a room, browse public lobbies, or join a four-character code from another browser or tab. Mark every player ready, then start the match. The host can change faction, Treasury and challenge-timer settings in the lobby. The timer starts at 15 seconds and can be set to 5–60 seconds or disabled.

The server now saves rooms and reconnect credentials in SQLite at `data/uramaku.sqlite` by default. Restarting it restores the saved hands, deck, turn and pending decision. Keep the `data/` directory when updating the application. A browser tab's private token restores its original seat; language and sound preferences stay in browser storage. Recovery after closing the tab is not guaranteed. No database installation is needed with Node 26.

After replacing an older installation, restart the server and reload the browser tabs to load the English identifiers and new asset paths.

## Project map

| Directory | Contents |
| --- | --- |
| `server/` | HTTP/Socket.IO entry point, SQLite store, durable transitions, lifecycle, abuse guards and reconnect sessions |
| `shared/` | Shared game engine, bilingual terminology, rules reference and deterministic tutorial route |
| `public/js/` | Browser game, tutorial and audio code |
| `public/js/components/` | Shared action/decision panels, influence cards, card dealing/exchanges, flips, tooltips and feedback |
| `public/js/config/` | Action artwork catalog used by both pages |
| `public/css/source/` | Ten ordered CSS source modules |
| `public/css/` | Generated game stylesheet and tutorial-specific styles |
| `public/assets/` | Role portraits, three approved card backs, interface icons, logo and lobby banner |
| `test/` | Tests grouped by gameplay, economy, integration, localization, tutorial, UI and assets |
| `scripts/` | Stylesheet builder, regression/load runners and safe SQLite backup/restore |
| `docs/` | Architecture, terminology, current rules, artwork notes and historical release notes |

## Where to make a change

| Task | Start here |
| --- | --- |
| Change a role's name or printed ability text | `shared/i18n.js` |
| Change role/action relationships | `shared/roles.js` |
| Change gameplay resolution | `shared/game.js` (also exported by `server/game.js`) |
| Change socket events or room management | `server/index.js` |
| Change room UI or decisions | `public/js/app.js` |
| Change beta, artwork, Kickstarter or About information | `public/js/components/project-info.js` and `shared/i18n.js` |
| Change deployment validation or browser origins | `server/runtime-config.js` |
| Change action availability explanations, decision cues or animations | `public/js/components/game-feedback.js` |
| Change sound cues or volume controls | `public/js/audio.js` |
| Change role-card markup | `public/js/components/role-cards.js` |
| Change opening/attack/reveal sequencing | `public/js/components/presentation-flow.js` |
| Change deal/discard/arrival animation | `public/js/components/card-motion.js` and `public/js/components/game-feedback.js` |
| Change card-turn animation | `public/js/components/card-flip.js` and `public/css/source/10-turn-feedback.css` |
| Change role/action tooltip layout or events | `public/js/components/role-tooltips.js` |
| Change the guided tutorial's behavior | `public/js/tutorial.js` |
| Change the tutorial's story, route or scripted opponents | `shared/tutorial.js` |
| Change deck panel and its count/back display | `public/js/components/game-panels.js` (`deck`), `shared/game.js` (`publicState`) |
| Change shared action/decision markup | `public/js/components/game-panels.js` |
| Replace a character portrait | `public/assets/portraits/`, then update `artwork-manifest.json` |
| Replace a card back | `public/assets/card-backs/`, then update its `artwork-manifest.json` |
| Change action artwork | `public/js/config/action-assets.js` |
| Change Actions reference column widths | `public/css/source/03-game-components.css` |
| Change shared visual styles | `public/css/source/`, then run `npm run build:css` |

## Verify changes

```bash
npm test
npm run test:economy-stress
npm run test:load
```

`npm test` discovers every regular test file in the grouped test directories and checks the generated stylesheet. The separate economy stress test runs 280 randomized matches. Focused commands include `test:gameplay`, `test:integration`, `test:ui`, `test:tutorial`, `test:localization`, `test:assets`, and `test:economy`.

`test:load` starts an isolated local server and real Socket.IO clients for 25/50/100/200 four-player rooms, with SQLite on disk and normal request limits. It takes several minutes and saves aggregate results in `load-results/`; it never targets a public server. See [load measurements](docs/load-test-report.md) for the method and limits.

## Home and project information

Home now has a compact wordmark, Public beta badge, visible AI artwork disclosure and a planned Kickstarter physical-edition section. About/artwork/development information works at `/about.html`; Kickstarter and feedback links are explicitly marked inactive placeholders. New copy and components are shared and bilingual. Approved artwork files are unchanged. See [homepage review notes](docs/public-beta-homepage.md).

## Public multiplayer preparation

This build includes Stage A correctness fixes, Stage B durable game state/reconnection, Stage C public room discovery, and Stage D disconnected-player controls, cleanup and abuse limits. Rooms start Private. The owner can name a lobby and change its visibility; public lobbies with available seats appear under **Browse rooms** on Home. Private invitation codes and spectator entry still work. The lobby language toggle sits beside Leave room, and Treasury rules now have their own guide tab.

The latest update also adds the approved 47-step tutorial, reveal-before-discard sequencing, Extort payment after a final-influence failed challenge, and card sequencing. The current update adds independent failed-challenge penalties, immediate Enforce settlement, exchange-before-replacement Gossip and private Summon decisions on the board. The tutorial/deck follow-up merges the two replacement lesson pairs, aligns EN/JP wording with the displayed state, and puts the private flip on top of the deck with choices in Current Turn. See [tutorial and deck polish](docs/tutorial-deck-polish.md), [challenge timing and board Summon](docs/challenge-timing-and-board-summon.md) and the earlier [tutorial and card sequencing](docs/tutorial-and-card-sequencing.md).

For an existing installation, preserve `data/` while updating source files. Saved settings from 5–60 seconds stay unchanged; older settings below 5 become 5. New rooms default to 15 seconds. An already-running challenge keeps its saved deadline.

During a match, the owner can kick a disconnected guest through the existing forfeit flow. Waiting lobbies expire only after five minutes with no connected players or spectators. Completed rooms are removed when nobody is connected; active offline games remain saved. Disconnects do not transfer ownership.

Stage E adds a Dockerfile, persistent-volume/origin checks, local load measurements and consistent SQLite backup/restore commands. See the [Railway deployment guide](docs/railway-deployment.md) before uploading source or starting a service. The package has not been deployed; the first Railway Docker build, actual proxy path and live smoke/recovery checks still need verification on the platform. [Stage D lifecycle and limits](docs/hosting-stage-d.md), [Stage C](docs/hosting-stage-c.md), [Stage B](docs/hosting-stage-b.md) and [Stage A](docs/hosting-stage-a.md) remain as release history.

## Read next

- [Architecture and state flow](docs/architecture.md)
- [Railway deployment, volume and backup guide](docs/railway-deployment.md)
- [Load tests and hosting cost scenarios](docs/load-test-report.md)
- [Canonical names and identifiers](docs/nomenclature.md)
- [Current gameplay rules](docs/game-rules.md)
- [Treasury Mode](docs/treasury-mode.md)
- [CSS maintenance](docs/styling.md)
- [Artwork and source provenance](docs/artwork.md)
- [Review and reorganization notes](docs/review.md)
- [Guided tutorial route and controls](docs/tutorial.md)
- [Current playtest priorities](docs/playtest.md)
- [Elimination action feedback](docs/attack-feedback.md)
- [Historical release notes](docs/history/README.md)
