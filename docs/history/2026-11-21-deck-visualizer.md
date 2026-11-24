# Deck visualizer and reference spacing

- Added the shared bilingual deck panel above Game Log. Desktop grid row 1 holds the deck; row 2 holds a shorter internally scrolling log aligned to Players & Influences. Game and tutorial use the same component and responsive layout.
- Added a read-only public draw-pile summary: exact remaining count, the actual top faction only when faction visibility is enabled, and an empty-pile reshuffle flag. Standard uses the red back; faction mode uses Order gold/Underworld purple. Exact roles, deck order, reusable discards and private Summon previews remain private. Empty decks do not shuffle or predict a top card during rendering.
- The count updates for opening deals, Summon/proof draws and reshuffles. The drawn Summon preview uses its own faction back, separate from the newly updated deck top. Existing draw/shuffle timing and all gameplay resolution are unchanged.
- Added 8% centered display zoom with clipping to hide the supplied card-back bleed. Existing cover scaling and 10% darkening remain. Approved asset bytes are untouched.
- Slightly narrowed Role (19% → 18%), Action (12% → 11.5%) and Counter (11% → 10.5%) columns; the description columns receive the recovered space. Both languages keep the same table layout.

Validation: 45 test files, compiled CSS validation and the 280-match economy stress check. Tests cover 2–8-player deck counts, faction-only privacy, read-only projections, separate proof/Summon draws, empty piles and lazy reshuffles, bilingual shared rendering and existing tutorial/animation behavior. Visual review remains a local playtest step; see the latest deck/bleed/reference checklist.
