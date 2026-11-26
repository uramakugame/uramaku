# Run this local test build

1. Stop your previous local URAMAKU server if it is using port 3000.
2. Open Terminal in this `uramaku-browser` folder.
3. Use Node.js **26**, then run:

```bash
npm ci
npm start
```

4. Open **http://localhost:3000** and refresh every testing tab. Create a **new match** to use the new response flow immediately.
5. Use [docs/coin-position-and-state-notices.md](docs/coin-position-and-state-notices.md) for the latest changes and focused test scenarios.

This folder includes all application code, tests and approved assets. Dependencies and private runtime data are omitted. `npm ci` installs the locked dependencies; the server creates its local `data/uramaku.sqlite` when first started. No production environment variables are required locally, and `.env.example` is documentation rather than an automatically loaded file.

Your existing local game's `data` folder has not been copied, overwritten or deleted. If you intentionally copy an existing database into this build while both servers are stopped, normal persistence/reconnection remains available for the current rules; a match from an older rule-changing build may need restarting. Do not point this test build at your live Railway volume. Railway deployment status must be checked separately; local runtime data is not included in the source branch.

## Validation

**Passed for this build:** `npm test` — 101/101 test files plus the compiled stylesheet check. The previous build also passed `npm run test:economy-stress` — 280/280 randomized matches with exact card and coin conservation; the rematch update reuses the existing fresh-game engine without changing action rules.

Coverage includes immediate counters, untimed post-expiry offers, stale-click races, no counter after a target challenge, loss-first Summon/concealment, parallel unavoidable losses, real Socket.IO/SQLite restart/retry recovery, failed-save rollback, EN/JP controls, readable reveal ordering, and current-rule restart/reconnect recovery.

Run those commands to repeat the checks locally. The automated UI checks execute the shared browser controls and animation callbacks; use the playtest guide to judge the rendered timing in your own browser.

## Latest tutorial and decision controls

The tutorial now has 43 lessons across six learner turns. Lesson 27 uses Sora’s genuine Enforce: pass, then lose Kingpin because you only have 1 coin. The late Gossip reveals Sora’s Courtesan + Magistrate. After Assassinate removes Courtesan, Sora uses Summon to draw a hidden replacement. Earn, then challenge Sora’s final Extort bluff to reveal Lord and win. Every balance, draw and turn uses the normal shared engine.

Both the tutorial and multiplayer now show “Claim [Influence] ([Counter])”, “Challenge claim”, and Allow action last. A held counter receives the same gold border as held actions; bluff counters remain available. Hire Guard keeps its 5-coin cost in the rules; its counter button shows only the claim and counter name. Repeated counter sequencing explanations are trimmed, and the tutorial still inherits the lobby’s English/Japanese setting.

For visual checks, play through lesson 27, the final Summon and the final challenge in both languages. Verify that Sora’s replacement remains hidden until challenged, and that the attack and final card reveal finish before the victory cue. The full automated suite also checks both actual browser-controller paths and exact Back/replay checkpoints.

## Treasury supply and challenge minimum

The challenge timer now accepts 10–60 seconds, still defaulting to 15 or optionally disabled. There is no deployment-specific timer/settings migration.

Enable Riot Mode in the lobby to see **Coin supply per player**. The owner can choose 5, 6 or 7, defaulting to 6 in new rooms. This is the fixed shared supply, including each player's initial 1 coin. All other players can view the selection; it is locked after starting and survives reconnection/restarts.

Wealth victory is 10 / 12 / 14 coins for 2 / 3 / 4+ starting players. With 2 players and supply 5, holding all 10 coins now wins by wealth. Check the Treasury guide in both languages.

The newest checks cover every supply at 2–6 players, both faction settings, validation/owner authorization, mode toggling, exact shared totals, and SQLite recovery in both lobby and active matches. The randomized economy check now exercises 5, 6 and 7 rather than just the previous fixed supply.

## Latest visual sequence

Action animations finish before the turn border hands off and the next player receives Income. Extort shows −2/+2 first, then the next Income as a separate +1. The shared queue covers transfers, action costs, attack/block movement, card reveals, proof replacements, Summon draws/replacements/discards, opening deal and victory presentation. Reduced motion skips decorative waiting. Chat/Leave remain usable; tutorial Back/Restart cancels the old sequence.

Removed rule-version branches, the saved 7-coin fallback, startup settings migration, alternate response-ID acceptance and the old separate Keep/replace Summon phase. Ordinary persistence, authentication, reconnects, command receipts and metrics remain in use. A rule-changing deployment may require restarting an active match.

See [docs/action-turn-presentation.md](docs/action-turn-presentation.md) for timings and focused visual checks.

## Intel feedback and reactions

Private reveals now finish their card flip before a plum eye/glow effect. Owners see the same private-sharing indication on their affected influence. Public sharing uses a distinct broadcast/ripple effect and tells an affected owner who made the card public. Only authorized views get private effects.

Use **React** beside Chat to display one of six bilingual preset phrases above your player card. Bubbles last 3.8 seconds and have a four-second cooldown. Reactions also have a local preview in the tutorial. They do not change game state or replay after reconnecting. Chat remains available, and the controls now place React between the language switch and Open chat.

Test with two involved players plus a third observer/spectator to inspect private/public boundaries. See [docs/intel-and-reactions.md](docs/intel-and-reactions.md) for the behavior and focused checks.

## Six-player table and Riot update

Create a new room. Check Maximum players (2–6, default 6), then test owner-only removal: enable, select one player, cancel or confirm. During a match connected and disconnected opponents still holding influences are eligible. The lobby keeps direct Kick buttons and no selection-mode toggle. Offline/Kick indicators use their prior compact styling, right-aligned next to Coins without adding a card row. Room limits cannot be reduced below occupied seats; spectators do not consume seats.

The board has six player positions (three columns by two rows), a fourth column with match information and draw/discard piles, and Latest outcome above the log. Watch a proved claim, Summon replacement/discard and opening deal: pile movements stay local and lead into the existing player-card motions. Eliminated influences stay face up on the player.

Enable Riot Mode (or Faction + Riot). Verify gold Order versus crimson Chaos, the treasury and wealth goal, distinct Loot/Overthrow icons, and quiet state-change emphasis. There is no cinematic or new timer pause. Coin animation durations remain 1.475 seconds for gain/loss and 1.175 seconds for transfers.

The browser preview tool was unavailable during this run. Automated checks exercise the real multiplayer/tutorial renderers and animation callbacks; rendered spacing and subjective timing still need local browser review.

## Loot, Income and owner-control corrections

Loot now uses your turn and is rejected off-turn or during every pending decision. Income keeps the existing 1.475-second +1 animation but no longer delays action selection; previous action effects and the turn handoff still finish first. Use Kick player in an active match to target a connected or disconnected opponent, cancel or confirm. Lobby kicks are direct as before. The two in-board information/pile areas have no outer frames; the icons and latest outcome panel are unchanged. See [patch details](docs/loot-income-and-owner-polish.md).

## Coin placement and state notifications

Coin gain/loss floats are centered on the player card again. Order/Chaos changes now use the ordinary board notification stack as well as the persistent indicator. Notices are bilingual, nonblocking, and do not replay on refresh. See [focused checks](docs/coin-position-and-state-notices.md) and the [proposed Railway development setup](docs/railway-development.md).

## Reactions-only room update

Chat is removed from both lobby and match, including server commands, snapshots and sound settings. React remains. Owner Kick appears on every other lobby player regardless of presence. During a match it appears only on offline players, with confirmation and a server-side reconnect check. No global Kick player mode remains. The public-beta footer is hidden in active/completed matches; the Home and waiting-lobby disclosures remain. Test in English and Japanese as owner, guest and spectator.


## Play again

Finish a match, then choose **Play again** as the owner in the result dialog (or close it and use the board button). Confirm everyone returns to the same waiting lobby, with the same room code, name, visibility, capacity, modes, coin supply and timer settings. All players must mark ready again. Spectators stay spectators; players who left or were kicked are absent. Offline reserved seats remain available for reconnecting or the owner's existing offline Kick control.

Start another match and check the fresh deal, round 1, hidden information, coin animations, reactions and Riot notices. Refresh or restart the local server during this second game to check reconnection. Try Play again as a guest: only the owner should have the control. An explicit owner departure passes ownership to a remaining player; a temporary disconnect does not. The new game adds a separate start/completion to metrics without adding a room creation.

Automated coverage includes all four mode combinations, owner/phase authorization, clean private-state reset, failed-write rollback, repeated clicks and delayed requests, owner succession, bilingual controls, spectators, separate match metrics and a real Socket.IO/SQLite rematch followed by crash recovery. Decision-marker changes are not included.
