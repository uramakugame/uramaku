# Guided Standard match

The approved tutorial runs 43 bilingual lessons across six learner turns using `shared/game.js`, the same authoritative engine as multiplayer. Everyone begins with 1 coin and two influences. Turn order is **You → Mei → Akira → Sora**, skipping eliminated seats. There is no tutorial-only economy or alternate challenge resolution.

## Fixed deal and draws

| Player | Starting influences |
| --- | --- |
| You | Lord + Courtesan |
| Mei | Assassin + Swordsman |
| Akira | Assassin + Magistrate |
| Sora | Courtesan + Magistrate |

Sora's first Lord claim is a bluff. Enforce is genuine but unchallenged, so Sora keeps Magistrate. Gossip later reveals Courtesan and Magistrate, identifying the earlier Lord bluff. After losing Courtesan, Sora uses Summon to replace Magistrate with a hidden Lord. The final Kingpin claim is a bluff, but the learner cannot know that before challenging.

The five scripted draws are Magistrate, Swordsman, Kingpin, Assassin and Lord. The first four belong to the learner; the last is Sora’s Summon draw and stays hidden from the learner until the final successful challenge. The remaining deck is constructed from the unused copies, with exactly three of every role across hands, deck, reusable discard and permanent losses at every checkpoint.

## Route

| Round | You | Mei | Akira | Sora |
| --- | --- | --- | --- | --- |
| 1 | Tax; prove Lord, replace with Magistrate; Tax still pays 2 | Failed challenge loses Swordsman; bluff Intrigue against you; your genuine Gossip privately exchanges hands | Income + Earn reaches 3 | Intrigue against Akira; receives 1 concealment coin and learns Magistrate privately |
| 2 | Income reaches 5; Sora publicly shares Akira's Magistrate; Summon draws Swordsman and replaces Courtesan | Pay 3 for Assassinate against Akira | Genuine False Trail blocks Mei; then pay 3 for Assassinate against you; your 5-coin Hire Guard is challenged and proved, drawing Kingpin; Akira loses both influences | Bluff Tax reaches 6 coins |
| 3 | Extort Sora; pass Sora’s true Enforce claim; unable to pay 2, lose Kingpin and retain Magistrate | Income + Earn reaches 2; you publicly share Mei's known Assassin outside your turn; Mei publicly shares your Magistrate | Eliminated | Income reaches 7; Purge eliminates Mei |
| 4 | Income reaches 2; Summon replaces public Magistrate with hidden Assassin | Eliminated | Eliminated | Intrigue against you; your bluff Gossip reveals Courtesan + Magistrate to you and Assassin to Sora |
| 5 | Income reaches 3; pay 3 for Assassinate; Sora declines a counter and loses Courtesan | — | — | Summon replaces known Magistrate with a hidden Lord |
| 6 | Income + Earn leaves 2 coins; challenge Sora’s Extort and win | — | — | Bluff Extort to deny the next Assassinate; loses final Lord when challenged |

The learner's balances after Income on their six turns are **2, 5, 1, 2, 3, 1**. Hire Guard costs 5 during Akira's turn. Intrigue concealment pays the investigator. Publishing information consumes no action and does not end a turn. An influence replaced with Summon invalidates previous private and public knowledge.

Lesson 27 introduces Enforce’s 2-coin payment and the double-loss risk of challenging it while unable to pay. The learner passes and selects Kingpin to lose on the board; Enforce takes no coins when payment is unaffordable. Sora’s final Extort has a strategic purpose: taking the learner’s 2 coins would prevent Assassinate on the next turn. The challenge is a risk, not a deduction that Sora cannot hold Kingpin. No probability estimate is presented.

## Controls and shared presentation

- Sidebar actions and board targets use the same action and player-card components as the live room.
- Targets use the shared combined challenge/allow/counter panel; the three former pass-then-counter lesson pairs are merged. Other players and counter claims retain challenge/pass controls. The learner passes Enforce, selects Kingpin for the unaffordable-payment loss, and later challenges Sora’s final Extort. Counter buttons read “Claim [Influence] ([Counter])”; held counters share the actions bar’s gold border. Challenge reads “Challenge claim” and Allow action is the last choice.
- The learner publishes Mei's Assassin using the same bilingual Make public control as multiplayer. Only already discovered, nonpublic influences still held by a player receive that control. Public information from other investigators is also rendered correctly.
- The learner’s two Summon draws reveal the deck’s top card using the shared influence-card style. Instructions and Discard draw remain in the lesson/Current Turn panel. The former lessons 18/19 and 37/38 are merged: their replacement instructions immediately enable the held-card choice, with no Continue step in between.
- Continue advances explanations or NPC choices; it never substitutes for a learner action, target, counter, challenge, influence choice or information share.
- The timer is disabled for reading. Multiplayer's default remains 15 seconds, configurable from 10–60 or disabled.
- Back restores full checkpoints, including all coins, deck order, pending decisions, knowledge and turn metadata. Restart restores the fixed deal. Rendering and language changes never execute game rules.

All text supports English and Japanese. Artwork, portraits and shared tooltip styling are unchanged. Card effects observe viewer-authorized snapshots only. Unknown losses/proofs reveal before their discard motion; the Summon tray waits for proof and any preceding public loss presentation. Challenged new Summon claims draw their extra card only after the challenger selects the loss. See [current tutorial/deck notes](tutorial-deck-polish.md).

## Verification

The complete route is checked in the shared engine and driven through the actual browser controller using DOM adapters in both languages. Tests verify every hand/pile's card conservation, exact costs/Income, fixed turn order, public/private boundaries, the genuine Enforce penalty and double-loss warning, double Hire Guard loss, final bluff challenge victory, and replay of every checkpoint. These automated checks exercise animation scheduling and controls; rendered visual timing remains part of local playtesting.

## Prompt and language-control cleanup

The tutorial uses the language selected in the lobby and no longer displays its own EN ⇄ JP button. Both locales remain supported. Challenge prompts show the claim and response choices without the extra rules-coaching sentence. The Enforce lesson reads “so at least one claim is a bluff.” The response-flow rule is explained at the first Gossip, without repeated sequencing instructions at Hire Guard or the late bluff Gossip. Lesson 36 uses “but you can claim a counter.”
