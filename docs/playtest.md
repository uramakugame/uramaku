# Current playtest priorities

Focus on following turns before adding more visual effects. Play one Standard match and one Treasury match with 3–4 people, including someone unfamiliar with the interface. Then use a two-player room for fast edge-case checks.

## New guided tutorial

Complete the tutorial in English and Japanese. Follow the sidebar for Tax, Extort, Summon, Earn and Assassinate; choose targets and affected influences directly on the board. Check that an incorrect choice stays on the lesson with a hint. Use Back before and after Summon and paid counters, then replay: payments, draws and information must be restored exactly once. Restart should show four players with 1 coin and two hidden influences each.

Check the fixed order You → Mei → Akira → Sora until eliminations. Akira and Mei demonstrate Earn before you use it in the closing race. Sora's Intimidate blocks your Extort, and your failed challenge loses Kingpin. The first Gossip privately exchanges your hand with Mei; the late bluff Gossip exchanges your remaining Assassin with Sora's Courtesan and Lord. Akira should not see the Swordsman before attacking and challenging Hire Guard. The counter costs 5 immediately, his failed challenge costs both influences, and your proved Swordsman is exchanged.

## Following the action

At each pause, ask the newcomer whose turn it is, who is acting against whom, and whether they personally need to respond. Record the phase and what they looked for when they hesitate. Check that action announcements, sound cues and coin/card effects explain the same event and that the Current Turn panel keeps the board steady.

Exercise an action claim, everyone passing early, the default fifteen-second timeout, a custom duration and an untimed claim, a challenge, a counter, a counter challenge and influence loss. Include someone passing while other players are still deciding. Verify that passing removes their prompt and deadline warning and that play moves forward exactly once.

## Card selection and privacy

- Use Summon to keep the drawn card and replace the left influence, then repeat with the right influence. Only the replaced influence should move. Include a same-role replacement and a duplicate-role hand.
- Discard the Summon draw; the held influences should remain still. Repeat with one influence remaining.
- Successfully prove a role claim and replace it, including drawing the same role. The effect should stay on that influence.
- Use Intrigue concealment and influence-loss selection directly on the board. Other browser views must not see a private hand or Summon draw.
- In Treasury Mode, confirm Loot stays disabled throughout the Summon preview and replacement selection.

## Coins and feedback

Test the first Earn after reloading, later Earn actions, Hire Blade and Assassinate payments, Extort, Intrigue concealment and Enforce. Verify the correct amounts and recipients, that effects run once, and that a faded badge never flashes back. Coin gain/loss badges now last 1.475 seconds; transfer badges last 1.175 seconds.

Try master mute, gameplay volume, chat volume and the deadline-warning switch. Check persistence after reload and confirm the turn cue is audible even when Income or other log entries arrive in the same update. Keep another participant's browser open to check which sounds and information are local.

## Treasury transitions

Empty the treasury and confirm Riot activates, Earn becomes Loot and Purge becomes Overthrow. Return coins to the treasury and confirm the normal actions return. Check wealth victory at 11, 12, 13 and 14 coins for 2, 3, 4 and 5+ starting players. Elimination should not change the original wealth goal.

## Recovery and layout

Reload during a challenge, a Summon preview and board replacement selection. Verify the same hand and decision return, with no duplicate draw, payment or action. A challenge deadline should continue across the reload. Check both EN/JP at the desktop widths used by the group, ensuring decision buttons remain reachable without the board changing height on each phase.

## Reporting an issue

Record mode, player count, language, action/counter sequence, actual versus expected behavior, and which player/browser saw it. A short recording is especially useful for animation glitches. Include whether it happened after a reload or reconnect.

## Configurable timer and attack feedback

As host, change the challenge duration, turn the timer off and back on, then start. Guests should see the same settings but cannot edit them. Action claims and counter claims should both use the chosen duration. An untimed claim must not expire or beep; all eligible players passing should still advance it immediately.

Use Purge, Overthrow during Riot, Hire Blade and Assassinate. Verify each has its own sound and the initiating player moves toward the selected target. Challenge or counter a claimed attack and check that the initial motion does not imply a successful hit. Repeated chat/state updates and reconnects should not replay old attacks. Check gameplay mute and reduced-motion settings.

## Enforce at 2 coins and shared tooltips

Try Extort against Magistrate with 0, 1 and 2 coins. A resolved Enforce takes the full 2 coins when affordable, otherwise one influence with no partial payment. Challenge a genuine Enforce with 0 or 1 coin: both influences should disappear automatically, the counter claimant receives no payment, and turns advance once. With 2 coins, payment happens immediately while the challenge influence is selected. Repeat with a last-influence challenger: they are eliminated but the Magistrate still receives 2, before any Treasury refund. Have a third player challenge to verify that the losses remain assigned to the correct players. Repeat in Treasury Mode, including elimination refunds and exact wealth victories.

During the tutorial Extort, click the sidebar and check Sora is gold before hovering. Other opponents must remain unselectable, and the instruction should name Sora. Compare tooltips in both pages and both languages: headings, action/counter sections, colors, fonts and spacing should match. Enforce must say 2 coins, and the removed challenge warning should not appear.

## Gossip challenge order and full-distance attack motion

Have the Intrigue initiator challenge genuine Gossip. Verify challenge failure → exchange current hands → replace Courtesan → choose the loss. The replacement must remain hidden after the loss, including same-role/recycled replacements. Other discovered influences remain known, and the defender learns both challenger cards before a chosen loss, then keeps only surviving-card knowledge. Repeat with a third-party challenger, both slots, duplicate Courtesans, previous public intel, final-card automatic losses and a reload. The third party must receive no private Gossip hand. Catch a bluff and verify that only the original Intrigue proceeds.

For Purge, Overthrow, Hire Blade and Assassinate, watch the visual copy reach the targeted player card and fade. Try same-row and cross-row targets, different card sizes and a narrow viewport. The board must remain clickable during the effect. Check reduced motion, canceled animation cleanup, unique sounds and no replay after a repeated state update.

## Card turns

Reveal an unknown influence through loss, Intrigue, Gossip and a public information share. Watch the hidden back turn to the permitted role. Check both slots, a private discovery of only slot 1, and a previously known card shifting after the other card is lost. Uninvolved players must keep their cards hidden. After a Gossip proof, the replacement stays undiscovered even after the challenge penalty is settled; only the old Courtesan was exchanged. Uninvolved players must not see that private reveal.

Summon should flip its private preview only for the drawer. Keeping it slides only the selected old influence down, brings the replacement down face down, then flips it in place; discarding it slides only the private preview down and leaves both held cards still. Include an identical-role replacement and a successful role proof. Check both languages, reduced motion, rapid state/language updates and repeated snapshots. The animation should clean up and leave the card’s original controls usable.


## Opening deals and exchanges

Start a new room in Standard, Treasury and faction-visible play. Watch your two cards arrive face down and turn in place; other players’ cards must stay face down with the appropriate back. Inspect Standard red, Order gold and Underworld purple designs for cropping or unwanted brightness/tint changes. Tutorial entry and Restart should use the same opening sequence; a language switch, ordinary update or reconnect should not deal again.

Keep a Summon draw into each slot and successfully prove an action and a counter claim. Check discard-down → replacement-down-face-down → flip-in-place, including same-role draws, duplicate roles and one remaining influence. The untouched slot must remain still. A publicly proved card may be visible while leaving; its replacement remains private until another effect reveals it. After proving Gossip and resolving the challenger’s loss, the replacement must remain hidden; the other exchanged influence remains known.

During each stage, let another player respond quickly, switch languages or trigger a normal state update. Motion should continue once in the correct slot, without a flash of the new face, frozen overlay or double replay. Controls must remain usable. Reload midway and confirm the final server hand returns without replaying the deal. Repeat with reduced motion enabled: the final cards should appear immediately.


## Deal, impact and counter sequencing

Start a new match in both languages. Match Start/対戦開始 should appear during the deal. Wait for the last arrival and your last opening flip, then the popup fade, before the red turn outline and first turn cue appear. Switch language or receive a normal state update midway: the outline must remain suppressed and the deal must not restart. Reduced motion should show the settled state immediately.

Use Purge and Riot Overthrow against two influences, choosing a loss as quickly as possible. Repeat against one remaining influence and on the final opponent. The attack should finish before the lost card turns, with a short pause; the loss badge must also wait. A state update during the delay must not expose the role early. A victory overlay or ending sound should follow the pending visual sequence. Check that no gameplay response is blocked by decorative layers.

Claim Hire Guard as a defender: its card copy should travel toward the original attacker. Claim False Trail: the defender should make only a small nudge toward the attacker. Challenge or pass each counter and check there is no repeated flight at resolution.

Check all three backs fill the slots, stay centered and appear about 10% darker in both resting cards and animation faces. Listen for different paper-like draw/discard cues at the appropriate stage, including a discarded Summon preview and proof replacement. Try mute and independent gameplay/chat volumes; verify no duplicate draw/discard sound after a rerender.


## Deck visualizer, bleed and reference widths

Start Standard and faction-visible games with different seat counts. The starting deck count should be `18 − 2 × players` (14 for two players, 2 for eight). Confirm the deck sits above the shortened log, with the log's top/bottom aligned to the player board on desktop. Narrow the window and switch EN/JP: the panels should stack without stretching Current Turn. Long log histories must scroll inside the log.

In faction mode, note the top back before using Summon or proving a role. The drawn card should have that faction; the deck then shows the next card's back and one fewer card. During a challenged truthful Summon, proof and preview consume one card each at their respective resolution points. Keeping or discarding the preview should not change the count again. Standard views must show only red backs. Reload and compare two browsers/spectators for matching counts and faction visibility.

Exhaust the pile with reusable discards available: show 0 and the reshuffle note, then refresh the count/back after the next draw shuffles them. A completely empty draw and discard supply should show the empty note. No future faction should be guessed while the pile is empty. Permanently lost influences do not replenish the pile.

Inspect resting backs, opening deals, flips, replacements and the deck image for the former top/bottom bleed. Centering and 10% darkening should remain consistent. Open Actions in both languages and verify the slightly narrower role/action/counter columns still wrap names clearly while the descriptions have more room.


## Public lobby checks (Stage C)

- Create a new room and confirm it is Private with a 15-second timer. It should not appear in Browse rooms from another tab.
- Set a name, switch to Public, search the list by name/code, and join using the existing nickname dialog. Test both English and Japanese.
- Switch back to Private and confirm the list removes it while existing players remain connected and its code still works.
- Restart the server and reconnect the owner; the saved public name/visibility should reappear without changing seats.
- Confirm lobby EN ⇄ JP sits immediately left of Leave room. Check the 5–60 timer bounds and disabled timer. Existing valid saved durations should remain configured.
- Open Actions | How to play and switch between Actions, How to Play and Treasury Mode. Treasury/Riot explanations should appear only in their own tab.

Cleanup and active-match disconnected-player kick controls are implemented in Stage D; verify an offline kick preserves any other player’s pending penalty.


## Parallel decisions and board Summon

- Challenge a genuine Summon while holding two influences. See the proved Magistrate get replaced before the drawer's private top card flips in place on the deck. The drawer must be able to click a held influence or Discard draw while the challenger still chooses their loss. Complete each side first in separate tests: no next-turn Income until both finish.
- Repeat using identical-role draws, a one-card Summon hand, EN/JP, reduced motion and a language switch during proof/arrival. The preview must not replay, cover the board or change Current Turn height. Instructions and Discard draw must remain in Current Turn, with no Deck heading or duplicate card design.
- Refresh and restart the server with both decisions open, then with either one completed. Each saved card, choice, balance, pending ID and original turn anchor should be restored.
- Challenge true Tax, Intimidate, Authority or False Trail: see the payout/block immediately, then choose the loss. Final-opponent automatic Tax victory keeps its previous behavior.
- Challenge Extort and try both allowing it and claiming a counter before choosing the owed loss. Defenses remain available; accepted coin transfers happen once. With a third-party challenge, have the target respond independently. Repeat a counter challenge while an earlier penalty is still open.
- For Intrigue, challenge as the target and verify your influence loss happens first; challenge as a third player and verify the actual target may respond while you select your loss.
- Test an owner kick/forfeit during each lane; other players' required choices survive. A departing voter must not leave a fully passed counter waiting forever with the timer disabled.
