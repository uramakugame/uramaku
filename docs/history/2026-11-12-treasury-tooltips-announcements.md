# URAMAKU — Treasury guide, announcement translation, faction tooltips, typography

Built from `uramaku-matte-announcements-bilingual-guide.zip`.

## Changes

- Added Japanese translation patterns for previously untranslated concise board announcements, including successful/failed challenges, Gossip exchanges, Authority and Intimidate responses, Hire Guard/Enforce counters, transfers, concealment, and elimination. The original English game log and server action IDs remain intact.
- The How to Play → Treasury Mode section is now a five-step numbered list in both English and Japanese. The Riot replacements are shown separately under **Basic actions (Riot)** / **基本アクション（暴動中）**, using the same `basic-rules` two-column action layout as the Actions tab. The guide's outer fixed height behavior is unchanged.
- Role-card and action-card tooltips omit the faction field entirely when the **Show hidden factions** setting is disabled. The guided tutorial uses Standard Mode tooltips without faction labels. When enabled, faction details are still visible.
- Action-card action names receive exactly `+ 2pt` across default, narrow, and desktop responsive CSS selectors. The generated combined stylesheet is rebuilt from its nine modules.
- Added `test/polish-language-guide-tooltips.test.js` to cover translation, Treasury instructions, reveal-settings tooltip behavior, and CSS size rules. Updated legacy guide-text assertions.

## Verification

- `npm test`: passed (including CSS generation check and new regression test).
- `npm run test:economy-stress`: passed, 280 completed randomized games with no coin conservation errors.
- Chromium screenshot check could not be completed in this environment (the browser process timed out); manual visual QA is recommended for the increased font size on narrow screens and the Treasury guide in both languages.

No game-rule or protocol changes were made.
