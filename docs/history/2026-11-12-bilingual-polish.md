# URAMAKU — bilingual UI, guide and announcement polish

Source baseline: `uramaku-overthrow-announcements-intel-polish.zip`.

## Visual changes

- Board announcements now use a **flat/matte deep plum-grey background** (`#363441`), an almost-white lavender-grey border (`#e6e4ef`) and high-contrast type. The previous red gradient has been removed.
- Fade-in was increased to 0.40 seconds, fade-out to 0.54 seconds; other announcement timing/stacking rules are preserved.
- The Game Guide has one persistent desktop-height profile (`min(930px, 100dvh - 12px)`), independent of locale and tab. On compact screens, its body scrolls instead of changing outer height.
- Tutorial uses the **same `role-cards.js` renderer as the multiplayer board** with the Standard Mode `factions-off` class so the faction insignia is hidden, including on mobile.

## Rule-guide content

- The **Actions** tab lists role actions and basic actions (Income, Earn, Purge) only. Loot and Overthrow are not listed there.
- The Treasury Mode section of **How to Play** (EN and JP) explains both Riot replacements: Earn → Loot and Purge → Overthrow (下剋上, Gekokujō), including the existing 5-coin Overthrow cost.
- The **Basic actions & income** section does not mention Treasury Mode.
- The Game Guide's full How to Play content now lives as a bilingual `guideCopy.howToHtml` entry in `shared/i18n.js`.

## Editing strings and terms

**Edit `shared/i18n.js`.** It contains a centralized dictionary of paired `en` / `jp` strings:

- `STRINGS.roles`: the canonical role names, including Swordsman / 用心棒.
- `STRINGS.actions`: every action/counter name, including Hire Blade / 刺客を雇う, Hire Guard / 護衛を雇う, Loot / 略奪 and Overthrow / 下剋上.
- `STRINGS.roleEffects`: canonical English and Japanese role-action and counter descriptions.
- `STRINGS.ui`: interface labels, common prompts, headers, buttons, rule summaries, etc.
- `STRINGS.guideCopy`: the translated How to Play panel.
- `TUTORIAL_EN_SCENES`, `TUTORIAL_EN_OUTCOMES`, `TUTORIAL_EN_DOUBLE_LOSS` and `TUTORIAL_JP`: the scripted tutorial narratives, options, outcomes and log lines.
- `PATTERNS`: translations for composed/dynamic action announcements and server game-log messages, while preserving player names.

`shared/roles.js` assembles server/client role metadata **from this dictionary**; it no longer has a separate duplicate list of English/Japanese role names, action names or effects. Stable action and role *IDs* remain unchanged, so renaming display text will not disrupt game logic.

The EN ⇄ JP button sits directly **left of Chat**, both in lobby and game room (and appears in the tutorial header). Language selection persists across game/tutorial page navigation via `localStorage`. The guide's language buttons also keep the main game language in sync.

Most strings are now dictionary-owned, including the main reference and tutorial narratives. Some legacy gameplay markup still retains English fallback phrases which are translated on render by `i18n.apply`; server notices use dictionary pattern translations when recognized. Keep new text in `i18n.js`, and migrate any remaining legacy messages through keys rather than adding more direct hardcoded user-facing copy. User-authored names and chat messages are deliberately never translated.

## Verification

- `npm test` — all regression suites passed (including new `test/localization-consistency.test.js`).
- `npm run test:economy-stress` — 280 simulated games completed with no economic invariants violated.
- Headless Chromium visual/DOM checks at 1440×900 and 390×844: no page errors; all four guide combinations share identical modal outer heights at each viewport; English Actions content fits without scrolling at 1440×900; mobile reference scrolls within fixed outer height; tutorial role-card faction emblems are not visible; both locales render in game room and tutorial; matte announcement CSS and motion timing verified.

To run locally: `npm install`, then `npm start`. Use `npm run build:css` after modifying a file under `public/css/source/` (the generated `public/css/game.css` is committed in this ZIP).
