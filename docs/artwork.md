# Current character portraits and card text

The six shared portraits are cropped from All_Cards_Warmer.png, supplied by the user on November 20, 2026. Each artwork crop is 620 × 670 pixels and is encoded as a quality-90 JPEG. The crop removes the sheet gutters and printed title/rules area for the game's localized labels.

The artwork manifest records the sheet hash, crop bounds, dimensions and output hash for each role. Player cards, action cards, the rules reference, discovered influences and the tutorial use these shared portraits. docs/assets/card-artwork-preview.png contains the full supplied warmer sheet.

The Home page and lobby use the supplied URAMAKU six-character rooftop banner(1).png at public/assets/images/lobby-banner.png. Its native size is 1774 × 887, and the banner frame follows its intrinsic 2:1 ratio. The same image supplies the existing faded game-room background. The manifest records the source hash and dimensions.

English action and counter names and descriptions in shared/i18n.js reproduce the printed card text. Japanese descriptions translate that wording. Shared role definitions supply the descriptions to tooltips and the rules table.


## Approved card backs

The three final backs supplied on November 21, 2026 are copied byte-for-byte to `public/assets/card-backs/`. Each PNG is 825 × 1125 pixels (11:15). Their manifest records dimensions and SHA-256 hashes. The source PNG files remain byte-identical to the approved artwork. Display styling follows the latest request: centered cover scaling, a further 8% zoom to hide the supplied bleed edges, and 10% darkening.

| Asset | Use |
| --- | --- |
| `standard.png` | Red logo; Standard/Treasury games and any view with faction visibility off |
| `order.png` | Gold logo; hidden Order influences when faction visibility is on |
| `underworld.png` | Purple logo; hidden Underworld influences when faction visibility is on |

The shared role-card renderer supplies these backs everywhere, including initial deals, Summon previews, replacements and 3D flips. Images use `object-fit: cover` and a centered position to fill the existing card bounds without stretching. Some outer edges may fall outside the slot to preserve the image ratio. `scale(1.08)` further zooms the image from its center, with the artwork wrapper clipping overflow so the supplied bleed edges do not show. `brightness(.9)` applies the requested 10% darkening uniformly, including deck and animation faces. Former decorative overlays remain suppressed. Approved portraits and the Home/lobby banner remain unchanged.
