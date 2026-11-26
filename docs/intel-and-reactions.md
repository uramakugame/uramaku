# Information feedback and preset reactions

The game room and guided tutorial share the same information-effect and reaction components. Approved artwork and influence-card layouts remain in use.

## Information effects

| Event | Viewer | Presentation |
| --- | --- | --- |
| New private knowledge | Investigator | Existing authorized card flip, then a muted plum glow and eye icon |
| Own card learned by another player | Owner | Glow and eye icon on that influence; no unnecessary flip |
| Previously private card made public | Everyone | Rust-colored border/ripple and broadcast icon; a flip only for viewers learning the card |
| Own card made public | Owner | Public effect plus a short localized message naming the publisher and role |

Effects last about one second, after preceding flips/card effects, and finish before the shared turn handoff/Income. Normal rerenders and language changes move the existing overlay rather than replaying it. Leaving, Back/Restart or replacing the affected card removes obsolete effects. Reduced motion uses a brief static icon/message without holding up presentation.

Only the owner’s private snapshot includes `intelKnownBy`, derived from existing investigator knowledge. It lists who knows each of the owner’s held influences, not anyone else’s hidden hand. Investigators use their existing `privateInvestigations`; uninvolved players receive no private-card effect. Public messages use already-public sharing metadata. No new private card identity is broadcast. Initial snapshots and repeated snapshots do not replay events. Proved Gossip retains its approved information/replacement order.

## Reaction bubbles

**React** sits immediately left of Open chat in the player-board controls, after the language switch. The menu contains six presets:

- Suspicious…
- Believe me.
- Bold move.
- Well played.
- Ouch.
- Thinking…

The same IDs have English and Japanese labels, chosen in each viewer’s language. Bubbles last 3.8 seconds, with one bubble per player and a four-second server-enforced seat cooldown. They follow their player card as the page scrolls/resizes and remain within the viewport. Rerenders/language changes keep the existing expiry. The popover closes on outside pointer input or Escape.

Players, including eliminated players, can react during a match or its completed screen. Spectators can see bubbles but have no reaction menu/player identity. Full chat stays in its existing window. Reactions perform no game action, make no claim, add no gameplay sound and do not wait for or block action animations. The tutorial provides a local-only preview of the same menu and bubbles without advancing a lesson.

## Networking and storage

The existing authenticated Socket.IO connection sends `reaction` with a whitelisted preset ID. The server supplies the player ID, room code and expiry, then sends it only to that room’s players/spectators. A supplied player ID cannot impersonate another player. Existing packet/IP limits apply, with a separate four-second per-seat reaction cooldown that survives a socket reconnect.

Reactions are transient socket events: they do not alter coins, cards, pending choices, chat, room revisions, SQLite snapshots or metrics, and are not replayed after reconnect/restart. There is no new database schema, dependency, environment variable or deployment-compatibility layer.

## Code and checks

- `shared/reactions.js`: stable preset IDs, localization keys and timings.
- `public/js/components/player-reactions.js`: shared controls, bubbles, placement and lifecycle.
- `public/js/components/intel-effects.js`: viewer-authorized event detection and reusable card overlays.
- `public/css/source/11-intel-and-reactions.css`: shared styling.
- `server/socket-input.js`, `server/index.js`, `server/abuse-guard.js`: validation, authenticated room delivery and quotas.

Test private Intrigue/Gossip with a third player or spectator watching. Only the involved views should identify the privately shared cards. Make one card public and check the owner, previous investigator and new observer views. Use React in several tabs; test local language choices, cooldown, chat/animation overlap and leaving during a bubble. Back/Restart should clear tutorial bubbles.
