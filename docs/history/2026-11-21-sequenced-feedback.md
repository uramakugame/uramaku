# Sequenced opening and attack feedback

- Opening deals now show a localized Match Start/対戦開始 popup. Turn outlines and the first turn sound follow card arrival, permitted flips and the popup fade. Shared completion callbacks, including cancellation/fallback, avoid an arbitrary fixed deal timer. Both game and tutorial use the same presentation coordinator.
- Purge/Overthrow loss reveals and their badges wait for the attack's remaining duration plus 80 ms separation. Immediate final-influence outcomes and quick responses in later snapshots use the same timing. Delayed eliminated-card flip layers survive rerenders. End-of-match dialogs/audio wait for pending attack/replacement/reveal jobs.
- Hire Guard counter claims fly toward the original attacker using Hire Blade-style motion. False Trail gives only a small directional nudge. Confirmed claim transitions produce each cue once; resolution does not replay it.
- Card backs use centered cover scaling and 10% darkening in shared cards and animation faces. PNGs, approved role portraits and banner bytes are untouched.
- Added separate locally synthesized paper draw/discard sounds with volume/mute support, stage synchronization, no external download and a tone fallback.
- The proposed deck visualizer and log-height change remain under discussion and are not implemented. Gameplay resolution, settings and rules are unchanged.

Validation: 43 test files and the compiled CSS check pass. New checks cover opening completion/fade/highlight order, bilingual popup updates, deferred turn cues, immediate and cross-snapshot losses, delayed reveal preservation, Hire Guard/False Trail direction, final victory ordering/cancellation, sound envelopes/volumes, and centered/darkened card-back styling. Visual and listening review remains a local playtest step.
