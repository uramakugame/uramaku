# Guided Standard match

The approved tutorial runs 47 bilingual lessons across seven learner turns using `shared/game.js`, the same authoritative engine as multiplayer. Everyone begins with 1 coin and two influences. Turn order is **You → Mei → Akira → Sora**, skipping eliminated seats. There is no tutorial-only economy or alternate challenge resolution.

## Fixed deal and draws

| Player | Starting influences |
| --- | --- |
| You | Lord + Courtesan |
| Mei | Assassin + Swordsman |
| Akira | Assassin + Magistrate |
| Sora | Courtesan + Kingpin |

Sora's first Lord claim is a bluff. Sora later proves Kingpin for Intimidate and replaces it with Lord, making the closing Courtesan/Lord hand consistent. Opponents do not bluff a role the learner already knows they cannot hold.

The five scripted draws are Magistrate, Swordsman, Kingpin, Lord and Assassin. The remaining deck is constructed from the unused copies, with exactly three of every role across hands, deck, reusable discard and permanent losses at every checkpoint.

## Route

| Round | You | Mei | Akira | Sora |
| --- | --- | --- | --- | --- |
| 1 | Tax; prove Lord, replace with Magistrate; Tax still pays 2 | Failed challenge loses Swordsman; bluff Intrigue against you; your genuine Gossip privately exchanges hands | Income + Earn reaches 3 | Intrigue against Akira; receives 1 concealment coin and learns Magistrate privately |
| 2 | Income reaches 5; Sora publicly shares Akira's Magistrate; Summon draws Swordsman and replaces Courtesan | Pay 3 for Assassinate against Akira | Genuine False Trail blocks Mei; then pay 3 for Assassinate against you; your 5-coin Hire Guard is challenged and proved, drawing Kingpin; Akira loses both influences | Bluff Tax reaches 6 coins |
| 3 | Extort Sora; Sora's true Intimidate blocks it; challenge fails, lose Kingpin and retain Magistrate | Income + Earn reaches 2; you publicly share Mei's known Assassin outside your turn; Mei publicly shares your Magistrate | Eliminated | Income reaches 7; Purge eliminates Mei |
| 4 | Income reaches 2; Summon replaces public Magistrate with hidden Assassin | Eliminated | Eliminated | Intrigue against you; your bluff Gossip succeeds and privately reveals both current hands |
| 5 | Income reaches 3; pay 3 for Assassinate; Sora declines a counter and loses Courtesan | — | — | Tax with known Lord |
| 6 | Income + Earn leaves 2 coins | — | — | Income + Tax reaches 7 |
| 7 | Income reaches 3; Assassinate eliminates Sora before the next Purge | — | — | Loses final Lord |

The learner's balances after Income on their seven turns are **2, 5, 1, 2, 3, 1, 3**. Hire Guard costs 5 during Akira's turn. Intrigue concealment pays the investigator. Publishing information consumes no action and does not end a turn. An influence replaced with Summon invalidates previous private and public knowledge.

This route demonstrates a blocked Extort with Intimidate rather than a successful Extort or Enforce. Those remain available in the regular guide and multiplayer rules; no extra lessons were inserted beyond the approved comeback story.

## Controls and shared presentation

- Sidebar actions and board targets use the same action and player-card components as the live room.
- Counter/challenge/pass choices use shared decision panels. The learner actually challenges Intimidate and selects Kingpin on their own player card for the resulting loss.
- The learner publishes Mei's Assassin using the same bilingual Make public control as multiplayer. Only already discovered, nonpublic influences still held by a player receive that control. Public information from other investigators is also rendered correctly.
- Both Summon draws reveal the deck’s top card using the shared influence-card style. Instructions and Discard draw remain in the lesson/Current Turn panel. The former lessons 18/19 and 37/38 are merged: their replacement instructions immediately enable the held-card choice, with no Continue step in between.
- Continue advances explanations or NPC choices; it never substitutes for a learner action, target, counter, challenge, influence choice or information share.
- The timer is disabled for reading. Multiplayer's default remains 15 seconds, configurable from 5–60 or disabled.
- Back restores full checkpoints, including all coins, deck order, pending decisions, knowledge and turn metadata. Restart restores the fixed deal. Rendering and language changes never execute game rules.

All text supports English and Japanese. Artwork, portraits and shared tooltip styling are unchanged. Card effects observe viewer-authorized snapshots only. Unknown losses/proofs reveal before their discard motion; the Summon tray waits until proof presentation finishes, without waiting for an unanswered challenger loss. See [current tutorial/deck notes](tutorial-deck-polish.md).

## Verification

The complete route is checked in the shared engine and driven through the actual browser controller using DOM adapters in both languages. Tests verify every hand/pile's card conservation, exact costs/Income, fixed turn order, public/private boundaries, the failed challenge, double Hire Guard loss, final victory, and replay of every checkpoint. These automated checks exercise animation scheduling and controls; rendered visual timing remains part of local playtesting.
