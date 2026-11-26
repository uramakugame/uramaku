# URAMAKU

Multiplayer hidden-role card game with English and Japanese localization, a guided tutorial, optional visible factions, and Riot Mode.

## Run locally

Use Node.js 26 (the tested version is recorded in `.nvmrc`). From this directory, install the locked dependencies and start the server.

```bash
npm ci
npm start
```

Open http://localhost:3000. Create a room, browse public lobbies, or join a four-character code from another browser or tab. Mark every player ready, then start the match. The host can change faction, Riot Mode, room capacity and challenge-timer settings in the lobby. Treasury’s fixed supply can be 5, 6 or 7 coins per starting player (default 6), including each player’s initial 1 coin. The timer starts at 15 seconds and can be set to 10–60 seconds or disabled.

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

This build includes Stage A correctness fixes, Stage B durable game state/reconnection, Stage C public room discovery, and Stage D disconnected-player controls, cleanup and abuse limits. Rooms start Private. The owner can name a lobby and change its visibility; public lobbies with available seats appear under **Browse rooms** on Home. Private invitation codes and spectator entry still work. The lobby language toggle sits beside Leave room, and Riot rules have their own guide tab.

Earlier updates added the approved tutorial, reveal-before-discard sequencing, Extort payment after a final-influence failed challenge, and card sequencing. The current update adds independent failed-challenge penalties, immediate Enforce settlement, exchange-before-replacement Gossip and private Summon decisions on the board. The tutorial/deck follow-up merges the two replacement lesson pairs, aligns EN/JP wording with the displayed state, and puts the private flip on top of the deck with choices in Current Turn. See [tutorial and deck polish](docs/tutorial-deck-polish.md), [challenge timing and board Summon](docs/challenge-timing-and-board-summon.md) and the earlier [tutorial and card sequencing](docs/tutorial-and-card-sequencing.md).

Keep `data/` for ordinary persistence and metrics. Use a fresh room to test rule-changing releases: there is no version-specific recovery or migration for an in-progress match. New rooms default to a 15-second challenge timer and a Treasury supply of 6 coins per player.

During a match, the owner can kick an offline guest through the existing forfeit flow. Waiting lobbies expire only after five minutes with no connected players or spectators. Completed rooms are removed when nobody is connected; active offline games remain saved. Disconnects do not transfer ownership.

Stage E adds a Dockerfile, persistent-volume/origin checks, local load measurements and optional SQLite backup/restore commands. The game is running on Railway Trial at https://uramakugame.com; the owner verified gameplay, public/private discovery, reconnection and restart persistence. The Railway-IP follow-up supports the edge's documented `X-Real-IP` through explicit `TRUST_RAILWAY_PROXY=1`; deploy this code before enabling the flag, with `TRUSTED_PROXY_HOPS=0`. See the [Railway deployment guide](docs/railway-deployment.md) for deployment and remaining live checks. Scheduled backups are intentionally skipped; spending alerts are deferred until Hobby. [Stage D lifecycle and limits](docs/hosting-stage-d.md), [Stage C](docs/hosting-stage-c.md), [Stage B](docs/hosting-stage-b.md) and [Stage A](docs/hosting-stage-a.md) remain as release history.

## Read next

- [Architecture and state flow](docs/architecture.md)
- [Railway deployment, volume and backup guide](docs/railway-deployment.md)
- [Load tests and hosting cost scenarios](docs/load-test-report.md)
- [Canonical names and identifiers](docs/nomenclature.md)
- [Current gameplay rules](docs/game-rules.md)
- [Riot Mode](docs/treasury-mode.md)
- [CSS maintenance](docs/styling.md)
- [Artwork and source provenance](docs/artwork.md)
- [Review and reorganization notes](docs/review.md)
- [Guided tutorial route and controls](docs/tutorial.md)
- [Current playtest priorities](docs/playtest.md)
- [Elimination action feedback](docs/attack-feedback.md)
- [Historical release notes](docs/history/README.md)

## Private engagement metrics

Room creation, match starts/completions, four mode combinations and player participation are recorded as daily aggregates in SQLite. The optional password-protected EN/JP dashboard lives at `/admin/metrics`; set `METRICS_PASSWORD` in the Railway service to enable it. See [engagement-metrics](docs/engagement-metrics.md) for setup, exact definitions, privacy, migration and timing diagnostics.

## Unified response update — local test build

Targets of Intrigue, Assassinate and Extort can immediately challenge, allow, or counter. A target challenge forfeits their counter; a counter closes the original window and starts its own. Counter selection after expiry is untimed. Challenge-loss reveals precede new counter/concealment decisions and the extra Summon draw. The shared bilingual tutorial now has 43 lessons. See [the change and test guide](docs/unified-target-responses.md) and [LOCAL-TESTING.md](LOCAL-TESTING.md). Existing mid-action snapshots retain their old flow until the next action. This folder has not been deployed.

## Turn presentation and wealth targets

Riot wealth victory is **10 / 12 / 14 coins for 2 / 3 / 4+ starting players**. The shared presentation queue shows action effects first, a 520 ms turn-border handoff second, and the next player’s Income last. Action controls become available as Income starts; its animation is nonblocking; reactions and leaving remain usable. See [turn presentation](docs/action-turn-presentation.md).

## Information feedback and reactions

Private knowledge uses an eye/glow effect after its authorized reveal; making a card public uses a broadcast/ripple effect and an owner notice. React offers six short bilingual preset bubbles, with a four-second cooldown and no gameplay/SQLite changes. Both features share components with the tutorial. See [intel and reactions](docs/intel-and-reactions.md).

The latest build caps matches at six players, with an owner-selected 2–6 lobby capacity (default 6). Six player cards share the existing board footprint with in-board match information and draw/discard piles. Free-form chat is disabled. Owner Kick buttons appear directly beside offline players and require confirmation; connected players cannot be kicked. The match has no public-beta footer. Riot Mode replaces the former mode name, with quiet Order/Chaos state cues and distinct Loot/Overthrow icons. See [local changes and playtest](docs/six-player-table-and-riot.md).
