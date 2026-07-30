# Changelog

Player-facing notes for each release. Paste the relevant section into the GitHub
Release body when you publish a tag.

## v0.1.5

### 🎒 Items stack 999 to a slot

Stacks were 28. A hundred copper took four slots; now it takes one, and so does a thousand.

What limits a gathering run is the **variety** you're carrying rather than the amount of any
one thing — you'll fill your pack by mining five kinds of ore, not by mining a lot of copper.
The inventory header reads `stacks of 999`, and in practice you will not see a pile split
across slots again.

**The vault is unchanged** — it still stores 50 different kinds, any amount of each.

### 🏦 The vault does what you tell it

Three things the vault should always have done:

- **Withdraw and deposit any amount.** Every tile has an amount field. Type a number and hit
  Withdraw — or press Enter — and you get exactly that many. Leave it blank and it behaves
  as before: everything, or as much as your pack will hold. Gold gets the same treatment
  alongside the Deposit 100 / all buttons.
- **Deposit from your pack.** Standing at the vault, every item in the inventory panel on
  the right grows a **Deposit** button, so you can store things from the panel you're
  already looking at instead of hunting for the same item in the vault's own list. The
  button only appears at the vault. Spare weapons and armour can be deposited from there
  too — equipping is still Loadout-only.
- **Rearrange the vault.** Drag a tile to move it, and the order sticks — it's saved with
  everything else. If dragging isn't convenient, click a tile and use the arrow keys. A fresh
  deposit lands at the end, and withdrawing something to zero closes its gap without
  disturbing the rest.

The vault's tiles are a little larger than they were, to make room for the amount field
without squeezing the name.

### 🐛 Fixed

- **The cleric sprite was grainy.** Hers were the largest source frames of any sheet and were
  being shrunk by nearly two thirds on the fly, which threw away most of the shading on her
  robes. She's now resampled properly and drawn near full size.

---

## v0.1.6

### 🗺 The next town no longer looks off-limits

A town with an uncleared road showed a **padlock**, the word **"Blocked"** in red, and a dashed
border — exactly the same treatment as places you genuinely haven't discovered. It read as
"you can't go here", when clicking it is precisely how you get there.

Those are now two different things:

| | Looks like |
| --- | --- |
| **A road you can force** | The town's own icon with a ⚔️ or ❓ badge, a solid highlighted border, and **"Fight your way in →"** / **"Answer the gate captain →"** |
| **Somewhere undiscovered** | Padlock, dashed border, a muted "Undiscovered" |

The status line now says what clicking will do rather than describing the obstacle, and every
travellable card ends in an arrow. Nothing about how travel works has changed — only how it
reads.

### 🏹 Hunter reads as a gathering skill now

Nothing said it wasn't combat. Animals with levels, listed in cards laid out exactly like the
Battlegrounds' monster roster, at a place called the Hunting Grounds.

- The Hunting Grounds now open with a line saying what hunting is: **a gathering trade, not a
  fight** — timed catches, nothing fights back, no way to lose
- Quarry cards read **"Needs Hunter 12 · 20 xp · 3.2s per catch"** instead of a bare
  "Lv 12 · 20 xp", which on the Battlegrounds means the *monster's* combat level. The time per
  catch is there for the same reason: a duration is something a gathering action has and an
  opponent never does
- The hub card says **"Gathering, not combat"** outright, so it's clear before you click in

### 🐛 Fixed

- **"Ask Around" didn't tell you what you got.** The gift message appeared for a fraction of a
  second and was then replaced by a bare "try again in 60s" — the dialogue panel redraws every
  second to move its countdowns, and the redraw wiped it. The panel now keeps the gift on
  screen for the whole cooldown: *"Ned the Blacksmith gave you 4× Copper Ore — ask again in
  56s."* The reward is the interesting half of that sentence, so it leads.

- **Gear was being destroyed by equipping with a full pack.** Swapping weapons, armour or
  clothing while carrying 25 slots' worth of goods deleted the item coming off — permanently,
  with only a passing "inventory full" toast to mark it. Unequipping did the same. Weapons
  were the most painful case, since a tiered sword is a lot of ore.

  Swaps now work in the first place: the incoming item leaves the pack before the outgoing
  one returns, so a straight swap fits even at 25/25 (the pack ends up no fuller than it
  started). Where there genuinely is no room — unequipping outright, or swapping to something
  that shared a stack so no slot came free — the change is **refused and the item stays
  equipped**, with a message saying so. Nothing is thrown away either way.

---

## v0.1.4

### ⚔ Melee has a face too, and a name

Regular combat is no longer the odd one out. Fight with a sword or with bare fists and a
pixel-art warrior stands in the scene, with an eight-frame lunging slash and a shield block.
Every attack style now has its own sprite.

**Combat is now called Melee**, to sit alongside Ranger, Cleric, Monk and Gunslinger. It's
the same skill — your level and xp are untouched.

### 🐛 Fixed

- **The Auto Eat toggle drew its switch over its own label.** A stylesheet edit had left a
  stray fragment behind that silently deleted the rule laying that control out, so it had
  been broken since the Loadout change.

### 🔮 Raising a familiar now trains Summoning

Deepening a bond pays experience as well as costing gold. The first rank of a Spirit Wolf is
worth 90 xp — about six summons — and the last is worth nearly 2,000; taking all three
familiars to rank 10 earns roughly 40,000 xp on its own. The reward grows more slowly than
the price, so late ranks are still bought mainly with gold. Each card shows the xp it pays
before you commit.

### 🔫 New class: Gunslinger

A fifth attack style, and it comes out of the forge rather than the timberland or the
temple. **Once you can work iron, you can make guns.**

| Made at the Smithy | Needs | From |
| --- | --- | --- |
| **Dual Revolvers** (+5 damage) | Smithing 12 | 4 iron bars |
| **Bullets** (batch of 10) | Smithing 12 | 1 iron bar |

Both unlock at the same level as the iron sword, so the moment iron opens up, so does the
gunslinger. Equip the revolvers from your Loadout and you fight with **Gunslinger**,
spending a bullet per shot the way a ranger spends an arrow — and you look the part, with a
full sprite sheet of dual shots, hip-fire bursts, trick shots and a charged blast.

Gunslinger is its own skill, trained by fighting with the revolvers, and the revolvers
don't tier up with the swords: a gunslinger's damage comes from the skill and the bullets,
not the barrel.

### 🐛 Fixed

- **Smithing ignored batch sizes.** Any recipe meant to produce several items at once made
  exactly one. Nothing shipped had a batch until now, so bullets were the first to hit it.

### 🧑‍🌾 Six new townsfolk, eighteen new quests

The world had four people worth talking to outside the village. Now every settlement has
a proper population — twelve NPCs and 43 quests between them:

| Where | Who | Found at |
| --- | --- | --- |
| Riverbend Village | Maerin the Trapper | Hunting Grounds |
| Town of Lidas | Foreman Dunn | Mining Site |
| Town of Lidas | Vance the Fletcher | Fletcher's Bench |
| Town of Lidas | Sister Aveline | Temple |
| Highcastle | Master Armourer Sable | Smithy |
| Highcastle | Grandmaster Oren | Monastery |

Lidas went from one quest-giver to four, and Highcastle from one to three. Every new
questline is completable without leaving its own settlement.

The Bandit Camp stays empty on purpose — it's a gauntlet, not a town.

### 🛡 Gear is changed in the Loadout, not mid-fight

You could previously swap weapon — and therefore **class** — in the middle of a fight, from
the attack-style buttons on the combat panel or the Equip buttons in your pack. Both are
gone.

- The attack-style row on the Battlegrounds is now a **read-only badge** showing which
  style your gear puts you in
- The Loadout screen has a new **Available Gear** section listing every weapon, piece of
  armor and item of clothing you're carrying, grouped by slot

Eating is untouched — you can still eat from your pack anywhere, including mid-fight.

### 🎯 Ranger and Cleric are real skills now

Every attack style trains a skill of its own, earned by fighting in the Battlegrounds
rather than at any building:

| Style | Trains |
| --- | --- |
| Melee | Combat |
| Ranger | **Ranger** (new) |
| Cleric | **Cleric** (new) |
| Monk | Monk |

**Ranged is now called Ranger**, and it's a listed skill rather than a hidden number on
the combat panel. Your existing Ranged level carries over untouched.

**Cleric spells now unlock from your Cleric level**, not Prayer — casting is what teaches
you to cast. Prayer goes back to being purely about blessings. If you'd already unlocked
spells through Prayer you keep them: existing saves seed Cleric from Prayer on load, so
nothing you'd earned disappears.

The combat panel shows the level and xp of whichever style you're using, so Ranger, Cleric
and Monk progress is visible while you fight instead of ticking up unseen.

### 📊 Skills tab

A new **Skills** button in the top bar lists all thirteen skills with their level and
progress to the next, plus your Character Level and how many skills you've trained.

### 📈 The level cap is now 999

Every skill runs to **999** instead of stopping at 99.

**Levels 1–99 are completely unchanged** — same xp for every level, so no existing save
shifts and every recipe, spell and monster requirement keeps the difficulty it was tuned
for. Only the ceiling moved.

Past 99 the cost per level stops doubling every 7 levels (which is why 99 was the old
ceiling — the next few levels would have run into numbers too large to count) and grows
more gently instead. Level 100 costs 1.4M xp; level 999 costs 43M, and reaching it takes
17.3 billion in total. This is a very long road at current xp rates.

### 🥋 Your character has a face

Your stick figure is gone. Equip the **Monk's Gauntlets** or a **Prayer Book** and a proper
pixel-art character stands in every scene, mining, smithing, cooking and fighting in your
place. Equip anything else and the old figure comes back.

The **monk** works through his whole repertoire:

- guard, then an open-handed palm thrust
- step in, knee up, a high kick, then a flying kick
- a flurry of fists that never pauses
- crouch to gather, leap, and a palm strike that throws an energy blast

The **cleric** has her own:

- a staff thrust and follow-through
- holy magic building in both hands until a sigil rings her feet
- hands raised, healing crosses gathering overhead

Every animation takes its turn for now, so you see all of it. Tying particular moves to
particular techniques and spells is for a later version.

---

## v0.1.3

### 🔮 Familiars can be raised

Your summons now have **ranks, 1 to 10**. Raise one at the Summoning Circle by
offering gold and materials it has an affinity for, and it gets meaningfully stronger:

| Familiar | Rank 1 | Rank 10 | Offering |
| --- | --- | --- | --- |
| Spirit Wolf | 1–3 damage | 10–12 damage | Bones + Rabbit Pelts |
| Luck Charm | 25% to multiply drops | 52% to multiply drops | Gold Ore + Silver Bars |
| Prayer Spirit | drain at 50% | drain at 23% | Bones + Radiantite |

**The cost climbs hard.** The first rank of a Spirit Wolf is 120 gold; the last is
nearly 19,000, and taking one wolf all the way costs around 61,000 gold plus the
materials. This is a long-term goal, not an afternoon's work.

Each card shows what the next rank buys before you pay for it, and the offering turns red
when you can't afford it.

### 🐛 Fixed

- **"404 cannot download update".** The installer was being uploaded under a different
  name than the one the updater looked for, so every update check failed even though
  the release itself was fine. Fixed at the source, with a CI check that now fails the
  build rather than shipping a release nobody can update to.
- Releases now carry proper notes instead of an empty description.

---

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
