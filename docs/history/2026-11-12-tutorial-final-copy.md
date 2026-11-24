# URAMAKU — tutorial copy and step-9 coin display

Baseline: `uramaku-hire-blade-tooltip-cleanup.zip`.

- On opening tutorial step 9 (Akira's Assassinate challenge window), Akira now receives the turn Income and immediately pays the 3-coin Assassinate cost before the player chooses Pass or Challenge. Her displayed balance is therefore **1** rather than 4. It is charged only once and continues to work with tutorial backtracking.
- Updated step 5 to explicitly say “Sora pays Akira”.
- Step 10 states simply “Hire Guard costs 3 coins.” The tutorial and multiplayer counter payment behavior are otherwise unchanged.
- Removed the final payment-timing sentence from the step 11 result, in both EN and JP. Feedback wording no longer overexplains counter payment timing.
- Added test coverage for Akira’s displayed balance, choice-time non-duplication, backtracking, and copy consistency.

## Future physical-game note (not implemented)

Consider requiring players to place the 3-coin Hire Guard payment up front when declaring the counter in the physical version, for ease of handling physical coins. **No change to the browser's multiplayer rules or payment timing has been made.**
