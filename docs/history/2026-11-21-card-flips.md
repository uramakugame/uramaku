# Shared card-turn animation

The Gossip-specific ordering/privacy behavior described below was reverted in [Gossip standard flow](2026-11-21-gossip-standard-flow.md). Other features in this historical release remain independent of that revert.

- Added a 650 ms 3D turn with two faces, perspective and hidden backs. Both faces reuse `role-cards.js`, the approved portraits and existing card-back styling. The same component is loaded by multiplayer and the tutorial.
- New private/public discoveries and previously hidden eliminated influences flip to their permitted face. Only the Summon drawer sees the preview flip. Replacements turn only the affected influence, including identical-role replacements and successful role proofs.
- Reveal detection uses public information and this viewer's private knowledge. Already-known cards, repeated snapshots and initial/reconnected histories do not create new reveal events. A Gossip proof's replacement stays private.
- Live influence cards now retain slot metadata and display order, so learning slot 1 does not move it into the first card's position. Eliminated cards receive a per-player reveal index for precise targeting.
- The decorative flip layer is inert and pointer-transparent. Existing card controls remain in the original DOM. Completion, cancellation and a fallback timer restore the visible face; reduced motion suppresses the turn.
- Gameplay rules, server logic, localized role text, sounds and approved artwork are unchanged.

Validation: 39 test files pass and generated CSS is current. New checks cover authorized/private reveals, Gossip proof privacy, public sharing, slot shifts, Summon, identical-role and single-slot replacements, real EN/JP browser-component execution through the DOM adapter, 3D faces, cancellation, repeated animation cleanup and reduced motion. Rendered visual review remains a local playtest step.
