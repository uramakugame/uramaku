# Architecture

## Entry points

`npm start` launches `server/index.js`. Express serves `public/` at the site root and `shared/` at `/shared`. Socket.IO serves its browser client at `/socket.io/socket.io.js`. `GET /health` returns the process's room count.

The main page loads `public/js/app.js`. The tutorial loads `public/js/tutorial.js`. Both use the same action and decision panels, card renderer, artwork catalog, localization and styles. The tutorial also executes the same rules engine as multiplayer. `public/about.html` uses the shared project-information component and existing language preference; it has no game socket or account flow.

## Server responsibilities

| File | Responsibility |
| --- | --- |
| `server/index.js` | Socket registration, participant authorization, broadcasts, challenge timers, HTTP routes |
| `server/runtime-config.js` | Production database/volume path checks, PORT/HOST and browser-origin policy |
| `server/telemetry.js` | Opt-in local benchmark metrics over a parent-owned IPC channel; disabled in ordinary hosting |
| `shared/game.js` | Room state, turns, claims, counters, influence loss, Intrigue, Summon, Riot Mode and victories; Node and browser module |
| `server/game.js` | Compatibility export of `shared/game.js` for existing server imports |
| `shared/tutorial.js` | Fixed four-player scenario, bilingual lessons, permitted inputs, engine-driven opponents and checkpoints |
| `server/session.js` | Private reconnect tokens and seat restoration |
| `server/room-store.js` | SQLite initialization, schema versions, full snapshots, credentials, receipts and entry intents |
| `server/room-directory.js` | Safe public listing projection, search/pagination |
| `server/room-transitions.js` | Candidate state, phase/sequence checks, transactional save and publish after commit |
| `server/socket-input.js` | Shared client-packet validation, safe acknowledgment handling and generic error responses |
| `shared/roles.js` | Canonical role IDs and action/counter relationships, with localized role metadata |
| `shared/i18n.js` | English/Japanese terminology, printed card descriptions, rules-reference content and shared interface labels |

A browser sends a socket event. A shared input boundary checks packet shape, field types and limits before handlers run. Create/join/spectate/resume reject a connection that already holds a room membership. The server resolves the player's current room and passes the action to the game engine. Successful changes are broadcast as a public room snapshot plus a separate private snapshot for each player. The browser renders from those snapshots.

## Privacy and card identity

The room stores the full deck and hands. `publicState` hides live influence identities, roles in the reusable discard pile and the private Summon draw. `privateState` supplies the recipient's hand, discovered cards and their own pending decisions. Spectators receive public snapshots.

Knowledge is indexed by influence slot. Replacing a role invalidates knowledge for that slot. Losing a card shifts surviving slot indices. Lost influences enter the face-up eliminated-card collection. Proven claims and Summon discards enter the reusable face-down discard pile.

## Decisions and timers

`room.pending.kind` identifies the main action decision. Independent challenge penalties can coexist in `room.challengeLosses`; see the resolution section below.

| Kind | Who responds | Result |
| --- | --- | --- |
| `claim` | Opponents still holding influences | Challenge/pass; a counterable target also has immediate counter/allow choices |
| `counterOffer` | Targeted player | Claim a counter role or allow the action |
| `counterClaim` | Opponents of the counter claimant still holding influences | Challenge the counter or let it resolve |
| `lose` | Player losing influence | Select a live card, with final-card and simultaneous losses resolved automatically |
| `information` | Intrigue target | Reveal cards privately or pay to conceal eligible cards |
| `summon` | Summon claimant | Review the automatically drawn card, then discard it or replace an influence |

Action and counter claims use the host's lobby timer setting. Timers default to fifteen seconds and accept whole seconds from 10–60. Disabling the timer stores null deadlines and durations, schedules no server timeout, and leaves challenge/pass decisions open until resolved. Settings are validated atomically and locked once the match starts. Everyone passing resolves the window sooner. A timer is tied to its pending decision, so canceled or older timers cannot resolve a newer claim. Reconnecting preserves the current deadline and configured duration. Other selections await the relevant player. Loot is paused while a Summon card choice is pending.

## Persistence and upgrades

The in-memory registry is a cache of committed SQLite snapshots. `RoomTransitions` applies commands to detached candidates, checks expected turn/decision IDs, saves the snapshot and credential changes in one transaction, then publishes the result. The server acknowledges and broadcasts only after commit. Rejected commands and failed database commits never publish the candidate. Challenge expiration is its own durable transition and retains the saved absolute deadline.

The store uses WAL with synchronous FULL, versioned schemas/snapshots, and separate hashed seat credentials, bounded command receipts and short-lived entry intents. Pending fields, private observations, deck order and drawn Summon previews are saved exactly. Socket objects and timer handles are excluded. Restored seats initially show disconnected; resuming a seat restores presence without repeating Income, payments, proof or randomness. The engagement-metrics migration uses database schema 2; room snapshots remain version 1. This response-flow update adds optional pending metadata without a SQL migration. `scripts/database-copy.js` uses SQLite's online backup API and validates a fresh destination before publishing it; it never overwrites an active database.

The served browser uses prepare/confirm entry: a server-generated credential is saved in sessionStorage before membership can commit. The prepare record lasts two minutes. Confirmation, room/seat creation and consuming that record commit together. A lost confirmation reply or refresh between the steps can resume through the same saved token. Legacy entry events remain compatible; new clients should use the prepared flow for initial-reply-loss recovery. Production browser socket handshakes require HTTPS and a matching host or configured `ALLOWED_ORIGINS`. Origin filtering applies to polling and WebSocket transports and does not replace seat authentication or quotas.

Browser commands use stable request IDs, per-seat increasing sequences, expected room and applicable turn/decision IDs. The last 512 room receipts survive restart and return prior results for identical retries. The durable per-seat sequence rejects older requests after receipt pruning. The sender retries with identical metadata and never transfers queued commands to another room. Successful read-only snapshots, searches, countdown ticks and pings do not write to SQLite. Snapshots do not expose chat; Stage E measures full-snapshot transaction/response costs locally in `docs/load-test-report.md`.

`SQLITE_PATH` defaults to `data/uramaku.sqlite` locally. Production requires an explicit absolute path whose parent exists. On Railway, the real path must also remain inside the automatically supplied `RAILWAY_VOLUME_MOUNT_PATH`, including symlink checks; a missing mount fails startup. Database initialization/restoration completes before listening. A newer unsupported schema or damaged required snapshot fails startup. `/health` checks database readiness. SIGTERM stops new admission/timers and closes the database after accepted synchronous transitions. Each accepted transition is already durable; shutdown is not the only save point. See `docs/railway-deployment.md` for deployment and outstanding platform checks.

See [Stage B](hosting-stage-b.md).

## Browser organization

`public/js/app.js` manages live state, room rendering, decisions, announcements, rules and tooltips. `public/js/tutorial.js` binds real sidebar, player-card and decision inputs to the route in `shared/tutorial.js`. Guide buttons only continue explanations and opponent events. Tutorial state changes occur during dispatch, never render. Full checkpoints restore the room, deck, knowledge, pending decision and round without replaying payments or draws. The tutorial disables the timer so lessons can be read. Shared action, challenge, counter, information and Summon markup is in `public/js/components/game-panels.js`. Shared role-card markup is in `public/js/components/role-cards.js`. Both pages install `public/js/components/role-tooltips.js`, which owns tooltip markup, hover/focus events, viewport positioning, escaping and lifecycle. Render clears stale tooltips. `public/js/components/game-feedback.js` derives response identities, availability reasons and visual/audio effects from snapshots, and decorates action cards in both pages. It compares the local player's hand and publicly or privately discovered roles available to that viewer; it never reads another hidden hand. Coin transfer effects use confirmed public log entries with unique participant names; ambiguous names omit the transfer animation. `public/js/audio.js` synthesizes cues and stores master, gameplay and deadline-warning preferences.

The action illustration catalog is in `public/js/config/action-assets.js`.

The ten source stylesheets compile in an explicit order. The tutorial uses the same game grid and cards, with its lesson-specific styling in `public/css/tutorial.css`.

## Independent challenge penalties and Gossip

`room.pending` remains the primary action/counter decision. `room.challengeLosses` holds independent failed-challenge losses, each with its own durable `decisionId`. `lossDecision(room, seat)` identifies the authorized loss without confusing it with another player's Summon or counter. `finishAfterChallengesId` retains the original acting seat after the main action completes; turn advancement and Income wait for both lanes. `pendingWealthWinnerId` preserves a threshold reached by an independent transfer without erasing a still-owed penalty. Automatic/double losses need no selection. New counter/concealment choices and Summon's extra draw use loss-first resolution; automatic effects and unavoidable losses can remain independent.

The snapshot transaction includes all lanes, already-applied effects, held Summon draw, turn anchor and any deferred wealth victory. `RoomTransitions` stamps new debt IDs and compares influence-loss requests with the acting seat's specific loss ID. Claim challenges use the primary decision ID; target counter/allow commands may use the stable response ID described below. Completing either side preserves the other's ID and saved data. Restart/retry does not repeat proof replacements, draws or payments. No SQL schema migration is required.

Proved Gossip is deliberately special: validate the proof, exchange current hands privately, then replace the proved Courtesan and invalidate knowledge of only that slot. The failed challenger settles their loss afterward. The replacement stays hidden even if its role is identical; other discoveries remain intact. Third parties learn no private hands. Unchallenged Gossip exchanges normally; a caught bluff still resumes the original Intrigue after its claimant's penalty.


Card turns use `public/js/components/card-flip.js` and the existing influence-card renderer for both faces. Feedback derives reveal events only from the public snapshot and the viewer’s private knowledge. Live cards carry a slot index, including hidden cards; eliminated cards carry a per-player reveal index. Both pages preserve slot order so a new discovery flips the card in its actual position. The flip layer is inert and pointer-transparent, with completion/cancellation/fallback cleanup and reduced-motion support.


Card exchanges also emit bounded presentation metadata: `cardMoveNumber` and the last 24 `cardMoves`. Each event contains its sequence number, player, affected slot and reason. A proof event includes only the role already publicly proved; a Summon event contains no card identity. Neither event exposes the replacement. This identifies the exchanged slot for every viewer, even when the new role is identical. The counter resets at match start. Initial/reconnected snapshots and a backlog of several exchanges do not replay old motion.

`public/js/components/card-motion.js` sequences an outgoing discard, a face-down arrival and the existing flip. Shared `openingDeal` feedback supplies staggered initial deals to the live room and tutorial. Both controllers capture ongoing decorative layers before rendering, then transfer them to the same player/slot only if its visible identity still matches. Ordinary decision, language or state updates do not restart the sequence. A changed identity or missing host cancels the old effect. Rejected Summon previews use a private decorative copy at their former deck-top position, leaving held cards still. These layers are inert and do not change decisions or game timing.


`public/js/components/presentation-flow.js` owns presentation sequencing for both pages. Per-container sessions suppress the opening turn outline until shared card-motion completion callbacks finish and the localized Match Start popup fades. Attack impact deadlines determine remaining loss-reveal delays across consecutive snapshots. Pending decorative jobs retain completion callbacks through rerenders; victory UI/audio waits until those jobs settle. Changing rooms clears old deadlines and callbacks. It never changes engine state or blocks a server timer. `game-feedback.playSounds` coordinates cues with that shared session; card-motion starts the separate draw/discard paper cues at each stage.


## Public draw-pile display

`publicState.drawPile` exposes only `{count, topFaction, reshufflePending}`. Count is the actual draw pile length, excluding hands, eliminated influences, reusable discards and the private Summon preview. `topFaction` is Order/Underworld only when faction visibility is enabled and a top card exists; otherwise it is null. `publicState.discardPile` exposes `{count, topFaction}` for the reusable discard pile under the same faction visibility setting. No role identity, card order or lower-card faction is sent. Reading this projection never changes the deck or decides a future shuffle. Empty piles retain the existing lazy reshuffle: the next actual draw shuffles reusable discards.

Both browser controllers call `game-panels.deck` for the same bilingual panel. The current room snapshot supplies its count and back, so draws, proof replacements, reshuffles and reconnects update consistently. On desktop, the sidebar wrapper uses `display: contents`: the deck occupies grid column 3/row 1 and the log occupies column 3/row 2, the same row as the player board. The log scrolls internally. Compact layouts stack the shared panels. The deck reuses `role-cards.hidden` and the approved back image styling; a Summon preview uses the drawn card's own faction back, independently of the updated top card.


## Departure during a challenge

Only eligible responder IDs count as passes. Departing voters cannot prematurely close a window. If a claimant or target forfeits while another player owes a challenge loss, the loss remains pending and its selection precedes turn advancement. The serializable `finishAfterLossId` continuation anchors cancellation to the original acting seat even if multiple players forfeit. When the losing challenger forfeits, that satisfies their penalty and the normal action/counter continuation proceeds if participants remain valid. Forfeit never repeats proof replacement or action payments.


## Public room discovery

Rooms have persistent `name` and `visibility` fields and default to Private. Owner-only lobby commands update these through the same commit-before-publish coordinator. They do not recreate a room, change its code, replace seats or reset gameplay. Older snapshots gain private/default metadata transactionally at startup.

`listRooms` is a read-only projection over the active registry. It returns only code, name, mode, occupied/max seats and waiting status. It excludes private, started, finished, full and owner-offline lobbies, even for exact-code searches. Reserved disconnected players still consume seats. Riot and Faction remain independent flags, including the combined mode. Search is a bounded case-insensitive name/code substring match with twenty-row pages; obsolete pages clamp after rooms disappear.

Only sockets actively browsing subscribe to coalesced `publicRoomsChanged` invalidations. Membership/name/mode/visibility/presence changes update the directory signature; unchanged directory data emits no listing update. Closed/disconnected browsers unsubscribe. No new polling transport, SQL search index or matchmaking service is introduced. Joining still rechecks room status and capacity inside the durable transition, including when multiple prepared joins compete for the last seat.

The browser uses the existing room-entry dialog for nickname/code entry after selecting a public lobby, and shared dialog/panel styles for the list. Search preserves its input and ignores stale replies. The existing Actions reference now separates `howToHtml` and `treasuryModeHtml` into three tabs without changing the approved descriptions.


## Room lifecycle and request controls

`server/room-lifecycle.js` maintains an internal persisted empty-lobby timestamp through `RoomTransitions`. Connected spectators count as occupants. Five continuous empty minutes expires a waiting lobby; connected lobbies have no inactivity expiry, completed empty rooms are deleted, and active offline games are retained. Startup preserves a pre-existing abandonment clock. Removal uses the same commit-before-publish path and atomically revokes credentials, receipts and prepared entries. Maintenance performs no write for unchanged rooms and does not serialize active snapshots merely to check cleanup.

The owner-only match kick command rechecks current disconnection and uses the existing forfeit engine. It revokes the target's credential in that same transaction, preserving owed penalties and normal continuations. Reconnection winning the race rejects the kick. Disconnect itself does not forfeit, transfer ownership or pause challenges. Lobby and match buttons share one bilingual binding that stops propagation to attack-target selection.

`server/abuse-guard.js` owns configurable connection/resource ceilings and bounded in-memory token buckets. The socket validation boundary checks the total request budget before parsing shapes; endpoint quotas then constrain creation/entry, directory browsing and preset reactions. Reactions are keyed to the authenticated seat across connection refreshes. IP limits use the peer by default. Explicit `TRUST_RAILWAY_PROXY=1` uses Railway's validated single `X-Real-IP` behind its HTTP edge, requires a Railway-provided environment marker and cannot be combined with `TRUSTED_PROXY_HOPS`. Missing/invalid headers fall back to the peer. Fixed-hop mode remains for other verified proxy paths. Admission, packet and capacity limits do not alter saved games or reveal private information. See [Stage D](hosting-stage-d.md) for defaults and [the deployment guide](railway-deployment.md) for the Railway adapter and live checks.


## Tutorial comeback and ordered card feedback

The current deterministic route has 43 lessons across six learner turns, starting everyone with 1 coin and using the same `shared/game.js`. Both pages use `role-cards.shareControl`; the tutorial also renders `game-feedback.visibleRoles`, combining only authorized private discoveries and public shares. Learned information never exposes an undiscovered hand.

The loss resolver settles a genuine Extort against its eliminated challenger before Treasury refunds and winner selection. A serializable `actionResolved` continuation prevents executing that coin transfer twice, and the existing durable command coordinator commits it with the influence loss and command receipt. Other actions retain their target-elimination guards; Gossip uses the exchange-before-replacement order above.

`card-motion` sequences unknown loss/proof reveal, a readable hold and discard movement. Lost cards remain in the permanent revealed area. `presentation-flow.presentSummon` defers the private deck-top reveal and Current Turn choices until existing board jobs finish; `whenSummonReady` starts its private in-place flip only after it is visible. For new claims, the draw is not taken until the challenger selects the loss, and its presentation waits for that reveal. Both controllers use the same deck preview, shared card renderer and Current Turn/board replacement controls. A rerender transfers animation layers, keeps a visible preview visible and preserves usable controls. Changing room/decision cancels obsolete callbacks. Reduced motion exposes the settled card immediately. See [challenge timing and board Summon](challenge-timing-and-board-summon.md).

### Aggregate engagement metrics

`server/engagement.js` maintains daily counters atomically with `RoomStore.save`; schema 2 adds analytics tables while keeping room snapshots at version 1. Temporary active-match metadata is not exposed, and daily aggregates survive room deletion. `server/metrics-dashboard.js` supplies opt-in HTTP Basic authentication for `/admin/metrics`, guarded by `METRICS_PASSWORD`, no-store headers and bounded failed-login limits using the existing proxy-aware IP adapter. The dashboard reuses game CSS and the shared EN/JP glossary. `server/metrics-runtime.js` keeps bounded transaction timing buckets only in memory. See [engagement-metrics.md](engagement-metrics.md).

### Unified target responses and information barriers

A targeted `declineCounter` during a claim records `targetResponse: allow`; `challenge` records `targetChallenged`, preventing a later counter. `chooseCounter` can immediately replace a counterable action claim with its counter claim. The counter's deadline is fresh; an expired original claim leaves `counterOffer` untimed. The target menu uses explicit Allow action; third parties use Pass.

`parallelContinuation` limits independent penalties to final automatic effects and unavoidable attack losses. An undecided target, Intrigue concealment and Summon's extra draw wait behind the main loss decision. `responseDecisionId` survives a timeout with no information change, but is refreshed after a loss reveal; stale target clicks cannot cross that information boundary. Claim/challenge IDs remain distinct across counter activation, so an old challenge cannot hit a newer counter. All IDs and continuations commit in the existing snapshot transaction and receipt system.

There is no rule-version migration or pre-update continuation branch. Shared `presentation-flow.presentDecision` waits for prior card jobs before exposing untimed counter/concealment controls. The existing Summon presentation gate now also waits for the loss reveal. Source/version details and local playtest cases are in [unified-target-responses.md](unified-target-responses.md).

### Presentation sequence

`game-feedback.timeline` separates a completed action from the next Income using confirmed public snapshots. `presentation-flow.enqueue` serializes each browser’s room updates. Every action effect registers completion, including coin badges/transfers, card reveals/replacements/discards, flights and blocks. The next turn’s border handoff is followed by Income, then input release. Only client presentation is queued; server decisions, challenge deadlines, SQLite writes and normal reconnection use the existing engine. No hidden role is inspected to build a frame. See [turn presentation](action-turn-presentation.md).

### Information feedback and reaction events

`intel-effects.events` compares only the viewer’s authorized public/private snapshots. `privateState.intelKnownBy` derives each own card’s investigator IDs from existing server knowledge; it is never included in the public snapshot. `intel-effects.animate/sync` shares lifecycle and completion with the existing presentation coordinator. Public sharing records its publisher as public metadata.

`shared/reactions.js` defines six preset IDs. `player-reactions.js` shares menu/bubble behavior between live rooms and a local tutorial preview. The authenticated `reaction` socket handler supplies identity/expiry and broadcasts within the room; it bypasses game transitions and database writes. `AbuseGuard` enforces one reaction per four seconds per seat plus existing packet/IP limits. Bubbles expire locally, are repositioned on scroll/resize and are cleared on room changes. See [intel and reactions](intel-and-reactions.md).

Room capacity is a host-only lobby setting, 2–6 (default 6). Validation covers packet shape, occupied-seat count, preparation/confirmation races, match start and read-only discovery. The ordinary snapshot persists `maxPlayers`; spectators do not use seats. `treasuryMode` and `riot` remain stable internal identifiers for Riot Mode and Chaos, including stored metrics IDs. Treasury crossings append bounded, monotonic public state events inside the existing game transaction. The client consumes only new events; they never advance rules or timer deadlines. The shared table/outcome renderers live in `game-panels.js`; `riot-state.js` owns passive, cancelable state emphasis. No dependency or database migration was added.

Income coin badges register as cancelable nonblocking decorations in `presentation-flow.hold`; action results and turn handoff still wait for their effects. Loot uses the same `activeTurn` server guard as other actions, without an off-turn exception. Direct owner Kick buttons are available for online and offline players in the lobby, and only offline players during an active match. There is no global kick selection mode. Match kicks revoke credentials and live socket bindings, forfeit through the existing engine, and mark presence offline atomically.


### Same-room rematches

The owner-only `rematch` command accepts finished rooms and runs `server/rematch.js` through the existing durable transition coordinator. It rebuilds the room from `createGame` defaults, retaining room metadata/settings, participants with valid seat credentials, spectators and per-seat command sequences. All gameplay and private information are reset; ready flags are false. Reconnect credentials remain valid, and revoked seats are not revived. A subsequent Start uses the ordinary shuffle, deal and validation.

Each prepared match has a persisted, public `matchNumber`. Room commands carry `expectedMatch`; stale requests cannot apply to a later game with the same code and turn number. Receipts remain idempotent across rematches, so retrying a committed old command cannot reset another game. The browser clears old presentation jobs, announcements, decisions and reaction bubbles at the match boundary, and ignores delayed prior-match snapshots/events. Riot transition IDs can restart without suppressing new announcements. No additional database schema is required.

Explicit owner departure prefers a connected successor in the lobby or completed room. If an owner leaves during play, ownership is reassigned once the match finishes. A temporary disconnect retains the owner's credential and ownership. Engagement aggregates count each new Start/completion separately while preserving the original room-creation and seat-join counts.
