# Interactive tutorial and challenge copy

## Changes

- Replaced the previous tutorial with a Standard four-player match, beginning at 1 coin each and preserving You → Mei → Akira → Sora order. It has 47 teaching lessons across six rounds, one Earn demonstration, and skips eliminated seats.
- Learner actions use the sidebar, targets use player cards, and influence loss/replacement uses the held cards. Counters, Intrigue disclosure and the Summon preview use the same components as multiplayer. Guide buttons only advance explanations and opponents.
- The learner uses Tax, Intrigue, Summon, Extort and Purge, plus Authority, Gossip, Enforce and Hire Guard. The route includes a failed bluff, successful proof replacements, private information and its invalidation, immediate paid-claim costs, and Akira's double influence loss after challenging a truthful Hire Guard.
- Moved the existing rules engine into `shared/game.js` for Node and browser use; `server/game.js` exports the same API. Multiplayer action resolution is preserved. The tutorial supplies a deterministic deal, deck and NPC script to that engine.
- Challenge timers now default to 10 seconds. Hosts retain on/off and 1–60 second settings. The tutorial pauses claim windows for reading.
- Challenge prompts omit generic coaching. Applicable double-loss warnings end at “both influences.” This warning also applies to a targeted Hire Blade claim.
- Extort remains **Take 2 coins from a player.** Approved artwork is byte-for-byte unchanged.
- Both English and Japanese are included. Back and Restart restore actual match state without repeating draws or costs. Updated contributor and playtest notes describe the new source structure and route.

## Validation

- `npm test`: 36 test files pass; generated shared stylesheet is current.
- `npm run test:economy-stress`: 280 randomized matches finish with no economy invariant violations.
- The actual tutorial controller completes every lesson in English and Japanese through a lightweight DOM adapter, using sidebar/target/influence/counter/Summon clicks. Language changes and re-renders leave game state unchanged.
- All portrait, banner and other asset bytes match the previous approved build.
- Browser visual and audio playback review remains a local playtest step; the DOM adapter does not validate layout or playback.
