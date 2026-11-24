# Canonical game names

Use the identifiers below throughout engine state, socket payloads, browser code, tests and portrait filenames. English display names and Japanese translations live in `shared/i18n.js`. Role relationships live in `shared/roles.js`.

| Role | Role ID | Japanese | Action | Action ID | Counter | Counter ID |
| --- | --- | --- | --- | --- | --- | --- |
| Lord | `lord` | 大名 | Tax | `tax` | Authority | `authority` |
| Courtesan | `courtesan` | 花魁 | Intrigue | `intrigue` | Gossip | `gossip` |
| Swordsman | `swordsman` | 用心棒 | Hire Blade | `hireBlade` | Hire Guard | `hireGuard` |
| Assassin | `assassin` | くノ一 | Assassinate | `assassinate` | False Trail | `falseTrail` |
| Magistrate | `magistrate` | 奉行 | Summon | `summon` | Enforce | `enforce` |
| Kingpin | `kingpin` | 親分 | Extort | `extort` | Intimidate | `intimidate` |

| General action | ID | Availability |
| --- | --- | --- |
| Earn | `earn` | Normal play |
| Purge | `purge` | Normal play |
| Loot | `loot` | Riot |
| Overthrow | `overthrow` | Riot |

Income is the automatic payment at the beginning of a turn. Earn is the player's selected action. Their names and identifiers describe separate events.

Role portrait paths follow `/assets/portraits/<roleId>.jpg`. JavaScript identifiers use lower camel case. CSS files and ordinary filenames use kebab case. Japanese appears in localized content and display labels.

The action socket event carries `{action, targetId}`. A counter event carries the claiming role's ID in `{counter}`. Intrigue concealment uses `intrigueReveal`. Public disclosure from a discovered card uses `sharePrivateIntel`.
