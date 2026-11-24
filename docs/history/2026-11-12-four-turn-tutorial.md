# URAMAKU — Four-turn tutorial and presentation update

Source baseline: `uramaku-enforce-treasury-tutorial-3coins.zip`.

## Four-turn standard-mode tutorial

- All four players start with **one coin**, just as in the actual Standard game.
- User begins holding **Lord** and **Swordsman**. Following a successful Lord proof, Lord is replaced by Magistrate. After proving Swordsman on Hire Guard, Swordsman is replaced by Courtesan. The user **never holds Kingpin**, so their Extort is a real bluff.
- Mei loses one influence for challenging genuine Tax, then bluffs Kingpin on her turn; the player's successful challenge eliminates her.
- Akira uses genuine Courtesan Intrigue on Sora. Sora pays **Akira one coin** to hide one influence; Akira discovers Sora's Lord and later makes it public.
- Sora gains passive Income and Earn, then the player bluffs Kingpin to Extort two coins. Sora passes, so the bluff succeeds.
- Akira can afford a genuine Assassinate on the player. The player claims genuine Swordsman Hire Guard, Akira challenges it and loses both influences. Three coins are paid to treasury **after the Hire Guard claim is proven**.
- Sora Earns, the player Earns, and Sora then spends three coins to **bluff Assassin**. The tutorial teaches why a failed challenge could lose two influences, but why challenging is a calculated risk if a single Purge must finish the game. The player challenges, and Sora loses one influence.
- On the player's fourth turn, passive Income brings them from six to seven coins and Purge eliminates Sora's final influence. The tutorial ends with the player victorious.
- Coin progression for the player: **1 → 4 (Tax) → 7 (bluffed Extort) → 4 (Hire Guard) → 6 (Earn) → 7 (fourth-turn Income) → 0 (Purge)**. Opponent passive incomes and their paid actions are also reflected in the script.
- The complete EN/JP story, response labels, narration, outcomes and logs are editable in `shared/i18n.js`. The guided game uses the same shared role cards and action portraits as the live room.
- Removed the old optional double-loss preview lesson so it does not interrupt the shorter four-turn story. A warning about double losses remains in Sora's Assassinate explanation.

## Visual refinements

- Removed all text from the tutorial's small room-code/sidebar panel and retained the empty footprint.
- Reduced the vertical gap between the two basic-action notes in the Game Guide.
- Removed the visible text shadow and text stroke from board announcements (the matte banner and pale border remain).
- Moved the EN/JP language toggle to the **end** of both the landing lobby's action group and the room lobby's roster tools, and centered their controls.

## Verification

- `npm test` — passes, including a complete scripted tutorial coin/influence test and new layout/locale consistency checks.
- `npm run test:economy-stress` — 280 completed randomized Treasury matches without coin invariants violated.
- Browser visual check **not completed**: this environment's Chromium blocks local/file/data URL navigation and dynamic stylesheet injection (`ERR_BLOCKED_BY_ADMINISTRATOR`). Manual desktop/mobile visual review is still recommended.

No multiplayer gameplay mechanics, role effects, costs, or counters were changed.
