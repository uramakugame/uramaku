# Gossip proof privacy and full-distance attack animation

The Gossip-specific ordering/privacy behavior described below was reverted in [Gossip standard flow](2026-11-21-gossip-standard-flow.md). Other features in this historical release remain independent of that revert.

## Gossip

A truthful Gossip that is challenged now exchanges both current hands before Courtesan is discarded and replaced. Replacement invalidation immediately clears knowledge of that slot, so the new card is private and untouched cards stay known. Challenge losses retain the usual slot-shifting behavior. An internal continuation flag prevents a second exchange after the loss selection and is omitted from public snapshots. Unchallenged Gossip, including unproved bluffs, retains normal reciprocal disclosure.

Regression coverage includes both proof slots, one influence, duplicate Courtesans, identical-role and recycled-deck replacements, prior public disclosure, third-party challenges, automatic elimination, challenged bluffs and a replacement drawn for the original Intrigue claim before Gossip.

## Animation

Purge, Overthrow, Hire Blade and Assassinate send a visual copy of the initiating player card all the way to the target card's center, then fade it. The source still gives its brief directional cue. Only the viewer's already-rendered card is cloned; no additional hand data is requested or inspected. The copy uses existing shared player-card styles, is pointer-transparent and inert, and carries neither duplicate element IDs nor a player ID. Live controls stay in place.

Flights use measured viewport geometry, preserve the four action sounds and durations, and are removed on completion, cancellation or fallback timeout. Reduced motion suppresses them. Tests cover different directions and card dimensions, exact arrival coordinates, cleanup, privacy of copied content and unchanged live-card attributes.

The persistent target highlight, 2-coin Extort, 2-coin Enforce and 10-second default challenge timer are unchanged. Approved artwork is byte-for-byte unchanged.

## Validation

- All 38 test files pass; compiled CSS is current.
- 280 randomized matches finish without economy invariant violations.
- Headless Chrome exits before opening a test page in this environment, so rendered visual/audio review remains a local playtest step.
