# Changelog

Player-facing notes for each release. Paste the relevant section into the GitHub
Release body when you publish a tag.

## v0.1.2

### 🏹 New skill: Hunter

Track and take game at the **Hunting Grounds**, available in every settlement. Five
quarry, unlocking as you level:

| Quarry | Level | Yields |
| --- | --- | --- |
| Wild Rabbit | 1 | Raw Rabbit, Rabbit Pelt, Bones |
| Wild Boar | 12 | Raw Boar Meat, Boar Hide, Bones |
| Forest Stag | 24 | Raw Venison, Deer Hide, Bones |
| Grey Wolf | 38 | Raw Wolf Meat, Wolf Pelt, Bones |
| Cave Bear | 52 | Raw Bear Meat, Bear Hide, Bones |

Hunting is a gathering skill, not a fight — each catch is a timed action that yields
meat, bones and a hide together. Because every animal drops bones, it's now a genuine
alternative to grinding monsters for Prayer offerings.

Four new Cooking recipes come with it — **Roast Rabbit** (+7 HP) through **Bear Roast**
(+36 HP), the strongest healing food in the game and better than anything you can buy.

Pelts and hides have no use yet. They're the raw material for leatherworking, coming to
Crafting later.

### 🎒 Stack limits

Items now stack **28 to a slot**. A hundred copper takes four slots rather than one, so
a long gathering run genuinely fills your pack and a trip to the vault means something.

- The inventory header shows `12 / 25 slots · stacks of 28`
- Any pile over one stack shows how many slots it's using
- Gathering and crafting refuse to start when there's no room, rather than wasting the
  materials

**The vault is unaffected** — it stores 50 different kinds, any amount of each. That's
the point of a vault. Withdrawing a hoard larger than your pack now takes what fits and
leaves the rest, instead of refusing the whole thing.

### 📦 Inventory sections

The pack is now grouped into collapsible sections — Ore & Bars, Logs, Raw Materials,
Food, Equipment, Spirit Stones, Other — each showing how many slots it's taking up.
Click a heading to fold it away; the slot count stays visible so nothing hides its own
weight.

### ⚒ Batch crafting

Smithing, Cooking and Fletching gained a **Make ×1 / ×5 / ×10 / All** control above the
recipe list. Pick a size and the run stops itself when it's made that many — no more
turning an entire bar stockpile into swords with one click.

- The action line counts down: *"Smithing Bronze Sword… (5 left)"*
- Your choice is remembered per skill
- Changing the size mid-run retargets the current run rather than cancelling it

Defaults to **All**, so nothing changes until you choose otherwise.

### 🐛 Fixed

- **Turning in a quest no longer auto-accepts the next one.** Finishing a quest was
  silently starting the follow-up without asking — most visible on Clara and Captain
  Jeffries, whose quests track kills and actions. Worse, quests started this way had no
  time limit at all. Existing saves are repaired on load: anything wrongly started keeps
  its progress and gets a proper deadline.

---

## v0.1.1

First published build, and the first with **automatic updates** — from here on, new
releases install themselves rather than needing a fresh download.

Highlights of everything up to this point:

- **A world to travel**: Riverbend Village, the Town of Lidas, the Bandit Camp and the
  capital at Highcastle, each gated behind a real obstacle
- **Eleven skills**, including the Cleric, Monk and Ranged combat styles
- **Quests you accept**, with time limits, failure conditions and consequences for
  letting people down
- **Feats** at the Hall of Champions, bought with points earned from your total level
- **A vault** with interest, and a general store in every settlement

> **Windows only for now.** macOS builds exist but cannot auto-update without Apple
> code signing — see RELEASING.md.
