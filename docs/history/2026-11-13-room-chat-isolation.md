# URAMAKU — Finished-room chat isolation and compose focus

## Changes

- `server/index.js`: `emitRoom` now confirms a socket's **current** `socket.data.room` and `socket.data.playerId` match the specific room/seat before emitting. Finished games retain departed player records for historical match results, but an ID reused by the same browser when creating another room no longer routes old-game updates to the new room.
- `public/js/app.js`: state events for a room other than the client's active `roomCode` are ignored, including delayed updates after leaving. Successful create/join/resume acknowledgments establish that code before the server emits the initial room state.
- `public/js/app.js`: `sendChat` no longer redraws the page or replaces the chat input. It sends the message, clears the draft and existing input, and focuses the same input element (works with Enter or clicking Send).
- `test/chat-room-isolation-and-focus.test.js`: an event-handler simulation reproduces the finished-game -> leave -> new-room -> old-room chat sequence, confirms old-room chat still reaches remaining members, tests the client stale-state guard, and checks sending preserves input focus without rendering.

## Verification

- `npm test` — passed, including all existing gameplay/UI suites and the new regression tests.
- `npm run test:economy-stress` — 280 randomized matches finished with no economy invariant violations.
- No game mechanics or localization rules changed.

## QA notes

- Browser-based manual multiplayer UI confirmation was not performed. Suggested smoke test: open two browser sessions, finish a match, leave one seat and create a new room in that same browser session; chat from the finished game must not redirect it. In the retained room, send several messages using both Enter and Send and verify that focus remains in the input.
