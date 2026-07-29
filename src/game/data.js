// Global namespace, loaded as a plain script (no bundler yet).
window.Minerous = window.Minerous || {};

window.Minerous.MAX_LEVEL = 99;

window.Minerous.SKILLS = [
  { id: 'mining', name: 'Mining', icon: '⛏', color: '#4d9fd6', blurb: 'Swing a pickaxe to gather ore.' },
  { id: 'smithing', name: 'Smithing', icon: '🔨', color: '#e0b33e', blurb: 'Smelt bars and forge weapons.' },
  { id: 'combat', name: 'Combat', icon: '⚔', color: '#d65c5c', blurb: 'Fight monsters for xp and loot.' },
  { id: 'cooking', name: 'Cooking', icon: '🍳', color: '#e0824f', blurb: 'Cook raw meat into healing food.' },
  { id: 'prayer', name: 'Prayer', icon: '🙏', color: '#c9a6e0', blurb: 'Offer bones for prayer points, then toggle combat blessings.' },
  { id: 'summoning', name: 'Summoning', icon: '🔮', color: '#4fd6c9', blurb: 'Summon otherworldly familiars to fight and assist you.' },
  { id: 'crafting', name: 'Crafting', icon: '💎', color: '#9a6bb8', blurb: 'Socket spirit stones into your weapon and armor.' },
  { id: 'woodcutting', name: 'Woodcutting', icon: '🪓', color: '#6b8f4e', blurb: 'Chop trees for logs.' },
  { id: 'fletching', name: 'Fletching', icon: '🪶', color: '#a67c52', blurb: 'Craft bows and arrows from logs.' },
  { id: 'monk', name: 'Monk', icon: '🧘', color: '#d99a5b', blurb: 'Meditate at the monastery to master martial techniques.' },
];

// The world is split into areas, and which skills you can train depends on where you
// are. `skills` lists the skill ids available in that area (order here doesn't matter —
// the hub renders them in SKILLS order); `bosses` controls the Boss Arena entrance.
// Both starting areas currently offer everything so any skill stays testable.
window.Minerous.AREAS = [
  {
    id: 'village',
    name: 'Riverbend Village',
    icon: '🏡',
    color: '#6b8f4e',
    blurb: 'A quiet riverside village where every trade can still be learned.',
    skills: ['mining', 'woodcutting', 'smithing', 'fletching', 'cooking', 'crafting', 'prayer', 'monk', 'summoning', 'combat'],
    // Who lives here. NPCs are only reachable in the area they belong to.
    npcs: ['ned', 'borca', 'clara', 'roland'],
    // A village can only offer so much: past these levels the ore seams, the cleric
    // spells and the summoning lore are all found in a proper town. Each entry caps
    // the level of content available here; omit `limits` to offer everything.
    limits: { mining: 9, cleric_spells: 29, summoning: 9 },
    bank: true,
    store: true,
    // Which regular monsters roam here. Bosses are shared between areas; only the
    // Battlegrounds roster changes. Omit `monsters` to field every non-boss monster.
    monsters: ['rat', 'spider', 'goblin', 'skeleton'],
    bosses: true,
  },
  {
    id: 'lidas',
    name: 'Town of Lidas',
    icon: '🏛',
    color: '#4d9fd6',
    blurb: 'A bustling trade town on the eastern road.',
    skills: ['mining', 'woodcutting', 'smithing', 'fletching', 'cooking', 'crafting', 'prayer', 'monk', 'summoning', 'combat'],
    npcs: ['jeffries'],
    // The road is open, but the man standing on it is not. Charged every time you
    // enter until the crown replaces him.
    toll: {
      amount: 50,
      title: 'The Gate of Lidas',
      text:
        'A guard steps into your path, thumbs in his belt. "Road\'s clear, sure. Doesn\'t mean the gate is." He looks ' +
        'you over. "Gate maintenance levy. Fifty gold. Cash." Behind him, a merchant is counting coins into another ' +
        "guard's hand and staring very hard at the ground.",
      payLabel: 'Pay the "levy" (50 gold)',
      refuseLabel: 'Turn back',
      brokeText: '"No coin, no gate. Come back when you\'ve got fifty on you."',
      paidText: 'The guard pockets your gold without writing anything down, and waves you through.',
    },
    // Only a town large enough to have heroes worth remembering keeps a Hall.
    hall: true,
    bank: true,
    store: true,
    monsters: ['goblin_survivor', 'bandit', 'boarhound', 'fen_wisp', 'golem', 'brigand_captain', 'knight'],
    bosses: true,
    // Every new area sits behind a blocker like this — always a boss fight, always
    // with a penalty for losing. Beat it once and `gate.id` goes into
    // state.clearedGates, so the road stays open for good.
    gate: {
      id: 'lidas_goblin_force',
      title: 'The Road to Lidas',
      text: 'There is a Large Goblin Force blocking the pathway, and at its head stands their warlord.',
      retreatChance: 0.5,
      retreatFailText: 'They spot you before you can slip away — the warlord bellows and the host closes in!',
      encounter: { monsterId: 'boss_goblin_warlord', count: 1 },
      // Shown once, on arrival, the first time the blocker is beaten.
      reward: {
        title: 'Lord Halvard of Lidas',
        text:
          '"So you\'re the one who broke the goblin host on our road. That rabble had us penned in for weeks — ' +
          'caravans turned back, trade dried up. You have the gratitude of this town, and 150 gold besides. ' +
          'Take a look around while you\'re here: Lidas keeps far more than that little village ever could."',
        coins: 150,
        xp: { skill: 'combat', amount: 150 },
      },
    },
  },
  {
    id: 'bandit_camp',
    name: 'The Bandit Camp',
    icon: '🏕',
    color: '#8a5a3f',
    blurb: 'A fortified camp in the eastern hills. No trades here — only bandits, and a ladder of them.',
    // Nothing to train and nobody to talk to: the camp is a gauntlet, not a settlement,
    // so travelling here opens the camp screen instead of a hub.
    skills: [],
    npcs: [],
    camp: true,
    // The tiers themselves are the progression, so there's no blocker on the road —
    // but you can't sensibly walk in before Lidas is open.
    requiresGate: 'lidas_goblin_force',
  },
  {
    id: 'capital',
    name: 'Highcastle',
    icon: '🏰',
    color: '#c9a45e',
    blurb: 'The seat of the realm. Every trade, the finest ore, and a palace at its heart.',
    skills: ['mining', 'woodcutting', 'smithing', 'fletching', 'cooking', 'crafting', 'prayer', 'monk', 'summoning', 'combat'],
    npcs: ['aldric'],
    bank: true,
    store: true,
    monsters: ['sewer_lurker', 'catacomb_revenant', 'gilded_construct'],
    hall: true,
    bosses: true,
    requiresGate: 'lidas_goblin_force',
    // Not a fight — a checkpoint. The guards are so jumpy about bandits in civilian
    // dress that nobody passes the screening, which is the point: the only way in is
    // to remove the reason for the screening.
    gate: {
      id: 'capital_screening',
      kind: 'quiz',
      title: 'The Gates of Highcastle',
      text:
        'A gate captain blocks your way. "Capital\'s closed to outsiders. Bandits have been slipping in dressed as ' +
        'honest folk — so everyone answers the screening now. Standard questions. Nothing to worry about."',
      // Clears itself the moment the Bandit King falls; see gate.js.
      clearedBy: { campTierDefeated: 'bandit_king' },
      lockedText:
        '"You already sat the screening. Nobody sits it twice — that\'s exactly what a bandit would ask to do." ' +
        'The captain softens slightly. "Look. Word is the whole business runs out of a camp in the eastern hills. ' +
        'Someone puts down the Bandit King, we stop screening, and you walk straight in. Until then, the answer is no."',
      questions: [
        {
          prompt: 'A merchant drops a heavy coin purse in the street in front of you. What do you do?',
          options: [
            'Return it immediately, of course.',
            'Return it, after counting it. For accuracy.',
            "Define 'drops'.",
            'I was nowhere near that street.',
          ],
        },
        {
          prompt: 'How many daggers are you carrying right now?',
          options: ['None whatsoever.', 'One. For fruit.', 'Fewer than yesterday.', 'Is this a competition?'],
        },
        {
          prompt: "Complete the phrase: 'Stand and—'",
          options: [
            '—admire the architecture.',
            '—deliver? No idea where that came from.',
            '—in line like everybody else.',
            "I'd honestly rather sit.",
          ],
        },
        {
          prompt: 'And your profession?',
          options: [
            'Adventurer.',
            'Freelance redistribution specialist.',
            'Not a bandit.',
            'Blacksmith. Ask me anything about... metal.',
          ],
        },
      ],
      // Whatever you pick, the screening fails. The captain has stopped trusting the
      // questions more than he's stopped trusting you.
      failText:
        '"Hmm." The captain reads your answers twice. "Too smooth. A real civilian dithers." He frowns at his own ' +
        'notes. "Although the last three we turned away for dithering turned out to be bakers, and the two we let ' +
        "through for being smooth turned out to be bandits, so honestly the screening's had a rough month.\" " +
        'He hands the sheet back. "Rejected. Sorry."',
      reward: {
        title: 'King Aldric of Highcastle',
        text:
          '"The gates are open, and they are open because of you. The Bandit King is dead and my captains tell me ' +
          'you did it alone." The hall erupts. When it quiets, the king leans in. "Highcastle owes you a debt — ' +
          '600 gold, and the run of the city. Come find me in the Royal Palace when you\'ve rested. There is more ' +
          'I would ask of you."',
        coins: 600,
        xp: { skill: 'combat', amount: 800 },
      },
    },
  },
];

// The Bandit Camp ladder, in order. Each tier unlocks only once the one before it is
// down, so the camp forces you home to train between rungs.
window.Minerous.CAMP_TIERS = [
  { monsterId: 'camp_lookout', label: 'The Watchpost', blurb: 'A lookout on a rock, bored and armed.' },
  { monsterId: 'camp_enforcer', label: 'The Stockade', blurb: 'The muscle that keeps the camp in line.' },
  { monsterId: 'camp_quartermaster', label: 'The Supply Tent', blurb: 'Whoever counts the loot fights to keep it.' },
  { monsterId: 'camp_champion', label: 'The Fighting Pit', blurb: "The king's own champion, undefeated here." },
  { monsterId: 'bandit_king', label: "The King's Tent", blurb: 'The Bandit King himself. Bring everything you have.' },
];

window.Minerous.campTierDefeated = function campTierDefeated(monsterId) {
  return (window.Minerous.state.campDefeated || []).includes(monsterId);
};

// A tier opens once the previous one is down; the first is always open.
window.Minerous.campTierUnlocked = function campTierUnlocked(index) {
  if (index === 0) return true;
  return window.Minerous.campTierDefeated(window.Minerous.CAMP_TIERS[index - 1].monsterId);
};

window.Minerous.getArea = function getArea(id) {
  return window.Minerous.AREAS.find((a) => a.id === id) || null;
};

// How far a given kind of content goes in the area you're standing in. Anything an
// area doesn't cap is available in full, so only the limited places declare a number.
window.Minerous.getAreaLimit = function getAreaLimit(key) {
  const area = window.Minerous.getArea(window.Minerous.state.currentAreaId);
  if (!area || !area.limits || area.limits[key] == null) return Infinity;
  return area.limits[key];
};

// The regular monsters that roam the current area. Bosses are deliberately left
// alone — the Boss Arena is the same wherever you fight.
window.Minerous.getAreaMonsters = function getAreaMonsters() {
  const regular = window.Minerous.MONSTERS.filter((m) => !m.boss);
  const area = window.Minerous.getArea(window.Minerous.state.currentAreaId);
  if (!area || !area.monsters) return regular;
  return regular.filter((m) => area.monsters.includes(m.id));
};

// Trims a level-ordered list down to what this area actually offers.
window.Minerous.filterByArea = function filterByArea(key, entries) {
  const cap = window.Minerous.getAreaLimit(key);
  if (cap === Infinity) return entries;
  return entries.filter((e) => e.level <= cap);
};

// Buildings that exist purely to house an NPC. NPCs whose locationId is a skill id
// (Ned at the smithy, Clara at the temple) are shown inside that skill's screen
// instead, so they don't need an entry here.
window.Minerous.NPC_LOCATIONS = [
  { id: 'witch_hut', name: "Borca's Hut", icon: '🏚', color: '#6b5b8a', blurb: 'A crooked hut thick with the smell of brewing.', npcId: 'borca' },
  { id: 'barracks', name: 'The Barracks', icon: '🛡', color: '#4d5a6b', blurb: 'Drill yards and armour racks of the town guard.', npcId: 'jeffries' },
  { id: 'tavern', name: 'The Tavern', icon: '🍺', color: '#b8722f', blurb: 'Warm, loud, and always short of stew.', npcId: 'roland' },
  { id: 'palace', name: 'The Royal Palace', icon: '👑', color: '#c9a45e', blurb: 'Banner-hung halls, and a king who asked for you by name.', npcId: 'aldric' },
];

window.Minerous.getNpcLocation = function getNpcLocation(id) {
  return window.Minerous.NPC_LOCATIONS.find((l) => l.id === id) || null;
};

// A skill's screen is a place as well as an activity — the building name is what the
// hub card and quest log show, so Clara is found at "the Temple", not at "Prayer".
window.Minerous.SKILL_BUILDINGS = {
  mining: 'Mining Site',
  woodcutting: 'Timberland',
  smithing: 'Smithy',
  fletching: "Fletcher's Bench",
  cooking: 'Campfire',
  crafting: 'Crafting Table',
  prayer: 'Temple',
  monk: 'Monastery',
  summoning: 'Summoning Circle',
  combat: 'Battlegrounds',
};

window.Minerous.getBuildingName = function getBuildingName(skillId) {
  return window.Minerous.SKILL_BUILDINGS[skillId] || null;
};

// Familiars are summoned one at a time by offering a combination of items.
// A combat familiar (familiarAttack) fights alongside you on its own attack timer.
// A loot familiar (lootChance) has a chance to multiply combat drops.
// A prayer familiar (prayerDrainMultiplier) reduces how fast active prayer blessings drain points.
window.Minerous.FAMILIARS = [
  {
    id: 'wolf',
    name: 'Spirit Wolf',
    level: 1,
    xp: 15,
    timeMs: 3000,
    color: '#7a8a99',
    inputs: { bones: 2, raw_rat_meat: 1 },
    description: 'Fights alongside you in combat.',
    familiarAttack: { damageMin: 1, damageMax: 3, attackMs: 2400 },
  },
  {
    id: 'luck',
    name: 'Luck Charm',
    level: 10,
    xp: 22,
    timeMs: 3200,
    color: '#e0b33e',
    inputs: { gold: 3 },
    description: '25% chance to double or triple combat drops.',
    lootChance: 0.25,
  },
  {
    id: 'prayer_spirit',
    name: 'Prayer Spirit',
    level: 20,
    xp: 35,
    timeMs: 6000,
    color: '#c9a6e0',
    inputs: { bones: 5 },
    description: 'Communing with the beyond — halves prayer point drain while summoned.',
    prayerDrainMultiplier: 0.5,
  },
];

window.Minerous.getMaxPrayerPoints = function getMaxPrayerPoints() {
  return 10 + window.Minerous.getLevel('prayer') * 2;
};

// Toggleable prayer blessings. Only one buff per group can be active at a time.
// Active buffs drain prayer points at drainPerSec while switched on.
window.Minerous.PRAYER_BUFFS = [
  { id: 'sharp_eye', name: 'Sharp Eye', group: 'offense', level: 1, drainPerSec: 0.4, damageBonus: 1, description: '+1 combat damage' },
  { id: 'iron_will', name: 'Iron Will', group: 'defense', level: 10, drainPerSec: 0.4, evasionBonus: 8, description: 'Harder to hit (+8 evasion)' },
  { id: 'berserker', name: 'Berserker', group: 'offense', level: 20, drainPerSec: 0.8, damageBonus: 3, evasionBonus: -5, description: '+3 combat damage, easier to hit (-5 evasion)' },
  { id: 'guardian_angel', name: 'Guardian Angel', group: 'defense', level: 30, drainPerSec: 0.9, evasionBonus: 25, description: 'Much harder to hit (+25 evasion)' },
];

window.Minerous.ORES = [
  { id: 'copper', name: 'Copper Ore', level: 1, xp: 4, timeMs: 2400, color: '#c87f4a' },
  { id: 'tin', name: 'Tin Ore', level: 1, xp: 4, timeMs: 2400, color: '#c9c2b8' },
  { id: 'radiantite', name: 'Radiantite Ore', level: 3, xp: 6, timeMs: 2600, color: '#f5d76e' },
  { id: 'iron', name: 'Iron Ore', level: 10, xp: 10, timeMs: 3200, color: '#a8735a' },
  { id: 'coal', name: 'Coal', level: 10, xp: 15, timeMs: 3600, color: '#3a3a3a' },
  { id: 'silver', name: 'Silver Ore', level: 15, xp: 20, timeMs: 4000, color: '#c7cdd6' },
  { id: 'gold', name: 'Gold Ore', level: 20, xp: 30, timeMs: 4600, color: '#e0b33e' },
  { id: 'mithril', name: 'Mithril Ore', level: 30, xp: 50, timeMs: 5400, color: '#4d6fd6' },
  { id: 'adamantite', name: 'Adamantite Ore', level: 40, xp: 75, timeMs: 6200, color: '#3f8f5a' },
  { id: 'runite', name: 'Runite Ore', level: 50, xp: 110, timeMs: 7200, color: '#5ecbd6' },
];

window.Minerous.TREES = [
  { id: 'log', name: 'Logs', level: 1, xp: 5, timeMs: 2400, color: '#8a6a4a' },
  { id: 'oak_log', name: 'Oak Logs', level: 10, xp: 12, timeMs: 2800, color: '#6b4f36' },
  { id: 'willow_log', name: 'Willow Logs', level: 20, xp: 22, timeMs: 3200, color: '#7a9a5a' },
  { id: 'maple_log', name: 'Maple Logs', level: 30, xp: 35, timeMs: 3800, color: '#b8724f' },
  { id: 'yew_log', name: 'Yew Logs', level: 40, xp: 55, timeMs: 4400, color: '#4a5a3a' },
  { id: 'magic_log', name: 'Magic Logs', level: 50, xp: 85, timeMs: 5200, color: '#5ecbd6' },
];

// Smithing recipes: 'bar' recipes smelt ores into bars, 'weapon' recipes forge bars into weapons.
window.Minerous.SMITHING_RECIPES = [
  { id: 'bronze_bar', name: 'Bronze Bar', category: 'bar', level: 1, xp: 10, timeMs: 2000, color: '#b8834f', inputs: { copper: 1, tin: 1 } },
  { id: 'iron_bar', name: 'Iron Bar', category: 'bar', level: 10, xp: 18, timeMs: 2400, color: '#8a6a56', inputs: { iron: 1, coal: 1 } },
  { id: 'silver_bar', name: 'Silver Bar', category: 'bar', level: 15, xp: 22, timeMs: 2600, color: '#c7cdd6', inputs: { silver: 1 } },
  { id: 'gold_bar', name: 'Gold Bar', category: 'bar', level: 20, xp: 28, timeMs: 2800, color: '#e0b33e', inputs: { gold: 1 } },
  { id: 'mithril_bar', name: 'Mithril Bar', category: 'bar', level: 30, xp: 40, timeMs: 3200, color: '#4d6fd6', inputs: { mithril: 1, coal: 2 } },
  { id: 'adamantite_bar', name: 'Adamantite Bar', category: 'bar', level: 40, xp: 55, timeMs: 3600, color: '#3f8f5a', inputs: { adamantite: 1, coal: 3 } },
  { id: 'runite_bar', name: 'Runite Bar', category: 'bar', level: 50, xp: 80, timeMs: 4200, color: '#5ecbd6', inputs: { runite: 1, coal: 4 } },

  { id: 'bronze_sword', name: 'Bronze Sword', category: 'weapon', level: 1, xp: 12, timeMs: 2400, color: '#b8834f', inputs: { bronze_bar: 2 }, damage: 2 },
  { id: 'iron_sword', name: 'Iron Sword', category: 'weapon', level: 12, xp: 20, timeMs: 2800, color: '#8a6a56', inputs: { iron_bar: 2 }, damage: 4 },
  { id: 'silver_sword', name: 'Silver Sword', category: 'weapon', level: 18, xp: 24, timeMs: 3000, color: '#c7cdd6', inputs: { silver_bar: 2 }, damage: 5 },
  { id: 'gold_sword', name: 'Gold Sword', category: 'weapon', level: 24, xp: 30, timeMs: 3200, color: '#e0b33e', inputs: { gold_bar: 2 }, damage: 6 },
  { id: 'mithril_sword', name: 'Mithril Sword', category: 'weapon', level: 35, xp: 45, timeMs: 3600, color: '#4d6fd6', inputs: { mithril_bar: 2 }, damage: 9 },
  { id: 'adamantite_sword', name: 'Adamantite Sword', category: 'weapon', level: 45, xp: 60, timeMs: 4000, color: '#3f8f5a', inputs: { adamantite_bar: 2 }, damage: 13 },
  { id: 'runite_sword', name: 'Runite Sword', category: 'weapon', level: 55, xp: 90, timeMs: 4600, color: '#5ecbd6', inputs: { runite_bar: 2 }, damage: 18 },
];

// Armor: one helmet/platebody/platelegs per bar tier, each a flat defense (damage reduction) stat.
// Bigger pieces cost more bars and take longer, mirroring the sword tiers' level gates.
const ARMOR_TIERS = [
  { bar: 'bronze_bar', name: 'Bronze', level: 1, xp: 12, timeMs: 2400, color: '#b8834f', defense: { helmet: 1, legs: 1, body: 2 } },
  { bar: 'iron_bar', name: 'Iron', level: 12, xp: 20, timeMs: 2800, color: '#8a6a56', defense: { helmet: 2, legs: 3, body: 4 } },
  { bar: 'silver_bar', name: 'Silver', level: 18, xp: 24, timeMs: 3000, color: '#c7cdd6', defense: { helmet: 2, legs: 3, body: 5 } },
  { bar: 'gold_bar', name: 'Gold', level: 24, xp: 30, timeMs: 3200, color: '#e0b33e', defense: { helmet: 3, legs: 4, body: 6 } },
  { bar: 'mithril_bar', name: 'Mithril', level: 35, xp: 45, timeMs: 3600, color: '#4d6fd6', defense: { helmet: 4, legs: 6, body: 8 } },
  { bar: 'adamantite_bar', name: 'Adamantite', level: 45, xp: 60, timeMs: 4000, color: '#3f8f5a', defense: { helmet: 6, legs: 8, body: 11 } },
  { bar: 'runite_bar', name: 'Runite', level: 55, xp: 90, timeMs: 4600, color: '#5ecbd6', defense: { helmet: 8, legs: 11, body: 15 } },
];

const ARMOR_SLOTS = [
  { slot: 'helmet', label: 'Full Helm', bars: 1, xpMultiplier: 0.6 },
  { slot: 'legs', label: 'Platelegs', bars: 2, xpMultiplier: 0.9 },
  { slot: 'body', label: 'Platebody', bars: 3, xpMultiplier: 1.3 },
];

for (const tier of ARMOR_TIERS) {
  for (const { slot, label, bars, xpMultiplier } of ARMOR_SLOTS) {
    window.Minerous.SMITHING_RECIPES.push({
      id: `${tier.bar.replace('_bar', '')}_${slot}`,
      name: `${tier.name} ${label}`,
      category: 'armor',
      slot,
      level: tier.level,
      xp: Math.round(tier.xp * xpMultiplier),
      timeMs: tier.timeMs,
      color: tier.color,
      inputs: { [tier.bar]: bars },
      defense: tier.defense[slot],
    });
  }
}

// Fletching recipes: 'ammo' recipes whittle logs into a batch of arrows (qty per craft),
// 'weapon' recipes (style: 'ranged') carve logs into bows, usable in the same weapon
// slot as melee weapons — equipping one switches Combat's attack style to Ranged.
window.Minerous.FLETCHING_RECIPES = [
  { id: 'arrow', name: 'Arrows', category: 'ammo', level: 1, xp: 3, timeMs: 1000, color: '#c9a06b', inputs: { log: 1 }, qty: 10 },

  { id: 'shortbow', name: 'Shortbow', category: 'weapon', style: 'ranged', level: 1, xp: 10, timeMs: 2200, color: '#8a6a4a', inputs: { log: 2 }, damage: 2 },
  { id: 'oak_shortbow', name: 'Oak Shortbow', category: 'weapon', style: 'ranged', level: 10, xp: 20, timeMs: 2600, color: '#6b4f36', inputs: { oak_log: 2 }, damage: 4 },
  { id: 'willow_shortbow', name: 'Willow Shortbow', category: 'weapon', style: 'ranged', level: 20, xp: 30, timeMs: 3000, color: '#7a9a5a', inputs: { willow_log: 2 }, damage: 6 },
  { id: 'maple_shortbow', name: 'Maple Shortbow', category: 'weapon', style: 'ranged', level: 30, xp: 45, timeMs: 3400, color: '#b8724f', inputs: { maple_log: 2 }, damage: 9 },
  { id: 'yew_shortbow', name: 'Yew Shortbow', category: 'weapon', style: 'ranged', level: 40, xp: 65, timeMs: 3800, color: '#4a5a3a', inputs: { yew_log: 2 }, damage: 13 },
  { id: 'magic_shortbow', name: 'Magic Shortbow', category: 'weapon', style: 'ranged', level: 50, xp: 95, timeMs: 4400, color: '#5ecbd6', inputs: { magic_log: 2 }, damage: 18 },
];

window.Minerous.MONSTERS = [
  { id: 'rat', name: 'Giant Rat', level: 1, maxHp: 8, damageMin: 1, damageMax: 2, attackMs: 1800, xp: 6, coinsMin: 1, coinsMax: 4, color: '#8a7f6b', meatId: 'raw_rat_meat', meatMin: 1, meatMax: 2, bonesMin: 1, bonesMax: 2 },
  { id: 'spider', name: 'Cave Spider', level: 3, maxHp: 12, damageMin: 1, damageMax: 3, attackMs: 1900, xp: 9, coinsMin: 2, coinsMax: 6, color: '#3f3a4a', bonesMin: 1, bonesMax: 2, extraDrops: [{ id: 'spider_eye', min: 1, max: 2 }] },
  { id: 'goblin', name: 'Cave Goblin', level: 5, maxHp: 16, damageMin: 2, damageMax: 4, attackMs: 2000, xp: 12, coinsMin: 3, coinsMax: 8, color: '#5e8a4f', bonesMin: 1, bonesMax: 3 },
  { id: 'skeleton', name: 'Skeleton', level: 12, maxHp: 30, damageMin: 3, damageMax: 6, attackMs: 2200, xp: 22, coinsMin: 6, coinsMax: 14, color: '#c7cdd6', bonesMin: 3, bonesMax: 6 },
  { id: 'golem', name: 'Rock Golem', level: 22, maxHp: 55, damageMin: 5, damageMax: 10, attackMs: 2500, xp: 38, coinsMin: 12, coinsMax: 24, color: '#7a828f' },
  { id: 'knight', name: 'Dark Knight', level: 35, maxHp: 90, damageMin: 8, damageMax: 15, attackMs: 2600, xp: 60, coinsMin: 20, coinsMax: 40, color: '#3a3f4d', bonesMin: 2, bonesMax: 5 },

  // The roads around Lidas. The survivor is the goblin host you broke to get in —
  // the rest is what a busy trade town attracts.
  { id: 'goblin_survivor', name: 'Goblin Survivor', level: 6, maxHp: 20, damageMin: 2, damageMax: 5, attackMs: 1900, xp: 15, coinsMin: 4, coinsMax: 10, color: '#4a7040', bonesMin: 1, bonesMax: 3, extraDrops: [{ id: 'goblin_ear', min: 1, max: 1 }] },
  { id: 'bandit', name: 'Road Bandit', level: 9, maxHp: 28, damageMin: 3, damageMax: 6, attackMs: 1800, xp: 24, coinsMin: 14, coinsMax: 30, color: '#7a5a3f', bonesMin: 1, bonesMax: 2, extraDrops: [{ id: 'stolen_pouch', min: 1, max: 1 }] },
  // Fast and hungry — the fastest attacker in the game, and the only source of boar.
  { id: 'boarhound', name: 'Feral Boarhound', level: 14, maxHp: 40, damageMin: 4, damageMax: 8, attackMs: 1500, xp: 34, coinsMin: 5, coinsMax: 12, color: '#6b4a3a', meatId: 'raw_boar_meat', meatMin: 1, meatMax: 2, bonesMin: 2, bonesMax: 4 },
  // Glass cannon: hits harder than its level suggests but folds fast, and being
  // bodiless it leaves no bones for your prayers.
  { id: 'fen_wisp', name: 'Fen Wisp', level: 20, maxHp: 34, damageMin: 7, damageMax: 12, attackMs: 2100, xp: 48, coinsMin: 10, coinsMax: 20, color: '#7fd6c9', extraDrops: [{ id: 'wisp_essence', min: 1, max: 1 }] },
  { id: 'brigand_captain', name: 'Brigand Captain', level: 28, maxHp: 78, damageMin: 7, damageMax: 13, attackMs: 2300, xp: 72, coinsMin: 32, coinsMax: 65, color: '#8a3f4d', bonesMin: 2, bonesMax: 5, extraDrops: [{ id: 'stolen_pouch', min: 1, max: 3 }] },

  // Bosses: far tougher than regular monsters of the same level — tuned assuming you're
  // fully kitted out for that tier (full armor + weapon + spirit stones: bronze at 5,
  // iron at 10, silver at 15). They pay out matching xp, coins, and bones.
  // The capital's own dangers — sewers and catacombs under a city that pretends it
  // has neither.
  { id: 'sewer_lurker', name: 'Sewer Lurker', level: 32, maxHp: 88, damageMin: 8, damageMax: 14, attackMs: 2100, xp: 80, coinsMin: 28, coinsMax: 55, color: '#4a6b5a', bonesMin: 2, bonesMax: 5, extraDrops: [{ id: 'sewer_pearl', min: 1, max: 1 }] },
  { id: 'catacomb_revenant', name: 'Catacomb Revenant', level: 40, maxHp: 120, damageMin: 11, damageMax: 18, attackMs: 2300, xp: 115, coinsMin: 40, coinsMax: 75, color: '#7a6b8a', bonesMin: 5, bonesMax: 10, extraDrops: [{ id: 'grave_token', min: 1, max: 2 }] },
  { id: 'gilded_construct', name: 'Gilded Construct', level: 48, maxHp: 165, damageMin: 14, damageMax: 22, attackMs: 2500, xp: 160, coinsMin: 60, coinsMax: 110, color: '#d6b24d', extraDrops: [{ id: 'gilded_core', min: 1, max: 1 }] },

  // The Bandit Camp ladder. Every tier is a boss — losing costs you, and you have to
  // go home and get stronger rather than grinding the same tier down.
  { id: 'camp_lookout', name: 'Camp Lookout', boss: true, campTier: true, level: 10, maxHp: 80, damageMin: 6, damageMax: 11, attackMs: 2200, xp: 85, coinsMin: 40, coinsMax: 70, color: '#9a6b4a', bonesMin: 2, bonesMax: 5 },
  { id: 'camp_enforcer', name: 'Camp Enforcer', boss: true, campTier: true, level: 16, maxHp: 125, damageMin: 9, damageMax: 15, attackMs: 2300, xp: 140, coinsMin: 65, coinsMax: 110, color: '#8a5a3f', bonesMin: 3, bonesMax: 6 },
  { id: 'camp_quartermaster', name: 'Camp Quartermaster', boss: true, campTier: true, level: 24, maxHp: 180, damageMin: 12, damageMax: 20, attackMs: 2400, xp: 220, coinsMin: 110, coinsMax: 180, color: '#7a4a35', bonesMin: 4, bonesMax: 8, extraDrops: [{ id: 'stolen_pouch', min: 2, max: 4 }] },
  { id: 'camp_champion', name: "The King's Champion", boss: true, campTier: true, level: 32, maxHp: 250, damageMin: 16, damageMax: 26, attackMs: 2400, xp: 330, coinsMin: 180, coinsMax: 300, color: '#6b3a2f', bonesMin: 5, bonesMax: 10, extraDrops: [{ id: 'stolen_pouch', min: 3, max: 6 }] },
  { id: 'bandit_king', name: 'The Bandit King', boss: true, campTier: true, level: 42, maxHp: 380, damageMin: 21, damageMax: 34, attackMs: 2300, xp: 600, coinsMin: 400, coinsMax: 700, color: '#a83f4d', bonesMin: 8, bonesMax: 15, extraDrops: [{ id: 'bandit_crown', min: 1, max: 1 }] },

  // Gate bosses guard the road into a new area. They're kept out of the Boss Arena
  // list — you meet them by travelling, not by picking them off a menu.
  { id: 'boss_goblin_warlord', name: 'Goblin Warlord', boss: true, gateBoss: true, level: 5, maxHp: 52, damageMin: 4, damageMax: 9, attackMs: 2200, xp: 55, coinsMin: 25, coinsMax: 45, color: '#3f6b38', bonesMin: 4, bonesMax: 8 },

  { id: 'boss_troll', name: 'Bridge Troll', boss: true, level: 5, maxHp: 45, damageMin: 4, damageMax: 8, attackMs: 2400, xp: 45, coinsMin: 20, coinsMax: 40, color: '#5e7050', bonesMin: 4, bonesMax: 8 },
  { id: 'boss_wraith', name: 'Grave Wraith', boss: true, level: 10, maxHp: 85, damageMin: 6, damageMax: 11, attackMs: 2400, xp: 90, coinsMin: 45, coinsMax: 80, color: '#8a94b8', bonesMin: 6, bonesMax: 10 },
  { id: 'boss_drake', name: 'Ember Drake', boss: true, level: 15, maxHp: 130, damageMin: 9, damageMax: 14, attackMs: 2500, xp: 150, coinsMin: 80, coinsMax: 140, color: '#d67a3f', bonesMin: 8, bonesMax: 12 },
];

window.Minerous.COINS_ITEM = { id: 'coins', name: 'Coins', color: '#e0b33e' };
window.Minerous.BONES_ITEM = { id: 'bones', name: 'Bones', color: '#d8d3c5', sellPrice: 1 };

// Raw ingredients dropped by monsters, cooked via the Cooking skill.
window.Minerous.RAW_FOOD = [
  { id: 'raw_rat_meat', name: 'Raw Rat Meat', color: '#c98a6a', sellPrice: 2 },
  { id: 'raw_boar_meat', name: 'Raw Boar Meat', color: '#a8563f', sellPrice: 6 },
];

// Miscellaneous monster drops with no skill use of their own — quest turn-ins, mostly.
window.Minerous.MISC_ITEMS = [
  { id: 'spider_eye', name: 'Spider Eye', color: '#6b5b8a', sellPrice: 3 },
  { id: 'goblin_ear', name: 'Goblin Ear', color: '#4a7040', sellPrice: 5 },
  { id: 'stolen_pouch', name: 'Stolen Pouch', color: '#7a5a3f', sellPrice: 16 },
  { id: 'wisp_essence', name: 'Wisp Essence', color: '#7fd6c9', sellPrice: 32 },
  { id: 'sewer_pearl', name: 'Sewer Pearl', color: '#4a6b5a', sellPrice: 45 },
  { id: 'grave_token', name: 'Grave Token', color: '#7a6b8a', sellPrice: 70 },
  { id: 'gilded_core', name: 'Gilded Core', color: '#d6b24d', sellPrice: 140 },
  { id: 'bandit_crown', name: "The Bandit King's Crown", color: '#a83f4d', sellPrice: 500 },
];

// Cooking recipes turn raw food into healing food usable in combat.
window.Minerous.COOKING_RECIPES = [
  { id: 'cooked_rat_meat', name: 'Cooked Rat Meat', category: 'food', level: 1, xp: 6, timeMs: 2000, color: '#d68a3f', inputs: { raw_rat_meat: 1 }, heal: 4 },
  { id: 'cooked_boar_meat', name: 'Roast Boar', category: 'food', level: 8, xp: 16, timeMs: 2600, color: '#b8603f', inputs: { raw_boar_meat: 1 }, heal: 11 },
];

// Tavern fare — bought with coin rather than cooked, so it heals harder than anything
// you can make early on but drains the purse you'd otherwise spend on spirit stones.
window.Minerous.TAVERN_FOODS = [
  { id: 'bread', name: 'Crusty Bread', color: '#c9a45e', heal: 3, price: 8, sellPrice: 2, description: 'Yesterday\'s loaf, still good.' },
  { id: 'bowl_of_stew', name: 'Bowl of Stew', color: '#b8722f', heal: 7, price: 20, sellPrice: 5, description: 'Thick, hot, and faintly mysterious.' },
  { id: 'roast_chicken', name: 'Roast Chicken', color: '#d9a05b', heal: 12, price: 42, sellPrice: 11, description: 'Crisped over the tavern fire.' },
  { id: 'fish_pie', name: 'Fish Pie', color: '#8fb3c4', heal: 18, price: 75, sellPrice: 19, description: 'River catch under a golden crust.' },
  { id: 'hearty_feast', name: 'Hearty Feast', color: '#d65c5c', heal: 26, price: 130, sellPrice: 33, description: 'Enough to put a warrior back on their feet.' },
];

// General store stock. Plain travelling food — worse per coin than the tavern's
// cooking, but every settlement has some and you don't need a Cooking level for it.
window.Minerous.STORE_GOODS = [
  { id: 'trail_rations', name: 'Trail Rations', color: '#a8935e', heal: 5, price: 16, sellPrice: 4, description: 'Dry, salty, and endlessly available.' },
  { id: 'salted_pork', name: 'Salted Pork', color: '#c07a68', heal: 9, price: 34, sellPrice: 9, description: 'Keeps for months. Tastes like it.' },
  { id: 'honey_cake', name: 'Honey Cake', color: '#e0b33e', heal: 14, price: 60, sellPrice: 15, description: 'A small luxury, sold by the slice.' },
];

// Which spirit stone tiers a settlement's store stocks. A village quartermaster has
// no business handling Superior stones; the capital handles everything.
window.Minerous.STORE_STONE_TIERS = {
  village: ['Minor'],
  lidas: ['Minor', 'Greater'],
  capital: ['Minor', 'Greater', 'Superior'],
};

window.Minerous.getStoreStoneTiers = function getStoreStoneTiers(areaId) {
  return window.Minerous.STORE_STONE_TIERS[areaId] || ['Minor'];
};

// A night in a tavern bed. The bonus is a flat multiplier on accuracy, so it stays
// worth buying at every level rather than fading out the way a flat +N would.
window.Minerous.TAVERN_REST = {
  price: 60,
  durationMs: 10 * 60 * 1000,
  accuracyMultiplier: 1.15,
};

// ---------------------------------------------------------------------------
// Carrying capacity and the bank.
//
// Limits count distinct stacks, not quantities — 400 copper is one slot, the way a
// pack works. Coins are excluded from both: they're currency, tracked on their own
// line, and nobody wants a purse taking up a bag slot.
// ---------------------------------------------------------------------------
// Every item gets a silhouette from what it *is*, while its colour keeps saying what
// tier it is — so a runite bar and a bronze bar read as the same kind of thing at a
// glance, and an ore never gets mistaken for a log.
window.Minerous.getItemKind = function getItemKind(idOrItem) {
  const item = typeof idOrItem === 'string' ? window.Minerous.getItem(idOrItem) : idOrItem;
  const id = typeof idOrItem === 'string' ? idOrItem : (item && item.id);
  if (!id) return 'misc';

  if (id === 'coins') return 'coin';
  if (id === 'bones') return 'bone';
  if (window.Minerous.ORES.some((o) => o.id === id)) return 'ore';
  if (window.Minerous.TREES.some((t) => t.id === id)) return 'log';
  if (window.Minerous.RAW_FOOD.some((f) => f.id === id)) return 'raw';
  if (window.Minerous.SPIRIT_STONES.some((s) => s.id === id)) return 'stone';
  if (!item) return 'misc';

  // Checked before category: prayer books and gauntlets are catalogued as weapons so
  // they take the weapon slot, but neither looks remotely like a blade.
  if (window.Minerous.CLERIC_GEAR.some((g) => g.id === id)) return 'book';
  if (window.Minerous.MONK_GEAR.some((g) => g.id === id)) return 'gauntlet';

  if (item.category === 'bar') return 'bar';
  if (item.category === 'ammo') return 'ammo';
  if (item.category === 'armor') return 'armor';
  if (item.category === 'weapon') return item.style === 'ranged' ? 'bow' : 'weapon';
  if (item.category === 'clothing') return 'clothing';
  if (typeof item.heal === 'number') return 'food';
  return 'misc';
};

// The markup every list uses for an item's icon, so the shape is decided in one place.
window.Minerous.itemSwatch = function itemSwatch(idOrItem, fallbackColor) {
  const item = typeof idOrItem === 'string' ? window.Minerous.getItem(idOrItem) : idOrItem;
  const color = (item && item.color) || fallbackColor || '#2c3542';
  return `<span class="node-swatch kind-${window.Minerous.getItemKind(idOrItem)}" style="background:${color}"></span>`;
};

window.Minerous.INVENTORY_SLOTS = 25;
window.Minerous.BANK_SLOTS = 50;

// Interest ticks on banked gold while you play. Deliberately small — it should feel
// like a reason to bank rather than a way to get rich standing still.
window.Minerous.BANK_INTEREST = {
  intervalMs: 60000,
  rate: 0.002,
  minBalance: 100,
};

// The banker's manner is entirely a function of your net worth, and he is not subtle
// about it. Highest matching tier wins.
window.Minerous.BANKER_TIERS = [
  {
    minGold: 0,
    mood: 'Barely concealed pity',
    lines: [
      '"Welcome to the vault." He looks at your purse. Then at you. Then, at some length, back at your purse.',
      '"We do offer accounts at this level. We offer them the way one offers a chair to someone who has already sat down."',
      '"Interest is calculated on the balance. I mention this only so the number does not surprise you later."',
    ],
  },
  {
    minGold: 500,
    mood: 'Professional restraint',
    lines: [
      '"Ah. You\'ve been working." He says it the way one might congratulate a dog for sitting.',
      '"A respectable sum, for a given definition of respectable. The definition is mine, and it is generous today."',
      '"Do keep going. I have seen worse starts. Not many. But I have seen them."',
    ],
  },
  {
    minGold: 5000,
    mood: 'Cautious approval',
    lines: [
      '"Now this I can work with." He actually opens the ledger properly, rather than at the page for small accounts.',
      '"You have crossed the line where I stop rounding your balance down in conversation. Congratulations."',
      '"I shall stop calling you \'the adventurer\' in the back office. Probably."',
    ],
  },
  {
    minGold: 25000,
    mood: 'Warmth, at a price',
    lines: [
      '"Always a pleasure." He means it, which is somehow worse.',
      '"I have taken the liberty of moving your account to the good ledger. The one with the ribbon."',
      '"Should you ever wish to discuss investments, I am available. I am also available if you do not wish to discuss them."',
    ],
  },
  {
    minGold: 100000,
    mood: 'Undisguised reverence',
    lines: [
      'He is standing before you finish opening the door. "Everything is exactly as you left it. I checked twice this morning."',
      '"The vault has a chair now. It is your chair. Nobody else sits in it — I have been very clear about that."',
      '"Whatever you need. Truly. I have a nephew who would love to meet you, but I would never presume."',
    ],
  },
];

window.Minerous.getBankerTier = function getBankerTier(totalGold) {
  const tiers = window.Minerous.BANKER_TIERS;
  let match = tiers[0];
  for (const tier of tiers) {
    if (totalGold >= tier.minGold) match = tier;
  }
  return match;
};

// Everything edible, wherever it came from — used by the Eat button and auto-eat.
window.Minerous.getFoods = function getFoods() {
  return window.Minerous.COOKING_RECIPES.concat(window.Minerous.TAVERN_FOODS, window.Minerous.STORE_GOODS);
};

// ---------------------------------------------------------------------------
// Feats — permanent passive upgrades bought at the Hall of Champions with feat
// points, gold, and materials thematically tied to what the feat does. A feat is
// never lost except by paying for a full respec.
// ---------------------------------------------------------------------------

// Character level is the sum of every skill level, so it climbs no matter what
// you train. One feat point per this many character levels.
window.Minerous.LEVELS_PER_FEAT_POINT = 5;

window.Minerous.FEATS = [
  // — Offense: paid for in blood and battle spoils —
  {
    id: 'bonebreaker',
    name: 'Bonebreaker',
    icon: '💀',
    category: 'Offense',
    points: 1,
    description: 'Every blow you land carries the weight of the fallen.',
    effectText: '+2 damage on every hit',
    cost: { coins: 400, bones: 40 },
    effects: { damageBonus: 2 },
  },
  {
    id: 'duelists_tempo',
    name: "Duelist's Tempo",
    icon: '⚡',
    category: 'Offense',
    points: 2,
    description: 'You have learned to strike between your enemy\'s breaths.',
    effectText: 'Attack 300ms faster',
    cost: { coins: 900, gold_bar: 2 },
    effects: { hasteMs: 300 },
  },
  {
    id: 'executioners_poise',
    name: "Executioner's Poise",
    icon: '🗡',
    category: 'Offense',
    points: 2,
    description: 'You find the gap in the guard, and you do not hesitate.',
    effectText: '12% chance to strike for double damage',
    cost: { coins: 1200, mithril_bar: 3 },
    effects: { critChance: 0.12, critMultiplier: 2 },
  },
  {
    id: 'lifedrinker',
    name: 'Lifedrinker',
    icon: '🩸',
    category: 'Offense',
    points: 2,
    description: 'Silver-etched steel drinks what it spills.',
    effectText: 'Heal 2 HP whenever you land a hit',
    cost: { coins: 1000, silver_bar: 4 },
    effects: { lifesteal: 2 },
  },

  // — Defense: paid for in armour, as befits it —
  {
    id: 'ironhide',
    name: 'Ironhide',
    icon: '🛡',
    category: 'Defense',
    points: 1,
    description: 'You have been hit enough times to know how not to be.',
    effectText: '+6 evasion',
    cost: { coins: 300, bronze_body: 1 },
    effects: { evasionBonus: 6 },
  },
  {
    id: 'bulwark_stance',
    name: 'Bulwark Stance',
    icon: '🏰',
    category: 'Defense',
    points: 2,
    description: 'You plant your feet, and the world moves around you.',
    effectText: '+25 max HP',
    cost: { coins: 800, iron_body: 1, iron_helmet: 1 },
    effects: { maxHpBonus: 25 },
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    icon: '🌬',
    category: 'Defense',
    points: 2,
    description: 'The moment a foe drops, you are already breathing easier.',
    effectText: 'Restore 20% of max HP on every kill',
    cost: { coins: 700, iron_legs: 1 },
    effects: { healOnKillPercent: 0.2 },
  },

  // — Gathering: paid for in the very stuff you gather —
  {
    id: 'prospectors_instinct',
    name: "Prospector's Instinct",
    icon: '⛏',
    category: 'Gathering',
    points: 1,
    description: 'You read the rock the way others read a page.',
    effectText: '20% chance to mine a second ore',
    cost: { coins: 350, copper: 50 },
    effects: { doubleOreChance: 0.2 },
  },
  {
    id: 'woodwise',
    name: 'Woodwise',
    icon: '🪓',
    category: 'Gathering',
    points: 1,
    description: 'One clean cut where others need three.',
    effectText: '20% chance to fell a second log',
    cost: { coins: 350, log: 50 },
    effects: { doubleLogChance: 0.2 },
  },

  // — Fortune & lore —
  {
    id: 'scholars_focus',
    name: "Scholar's Focus",
    icon: '📖',
    category: 'Fortune',
    points: 2,
    description: 'You learn from every swing, every strike, every prayer.',
    effectText: '+10% experience in every skill',
    cost: { coins: 1500, oak_log: 25 },
    effects: { xpBonus: 0.1 },
  },
  {
    id: 'silver_tongue',
    name: 'Silver Tongue',
    icon: '💰',
    category: 'Fortune',
    points: 1,
    description: 'Somehow the purses you find are always a little heavier.',
    effectText: '+25% coins from kills',
    cost: { coins: 600, silver_bar: 2 },
    effects: { coinBonus: 0.25 },
  },
  {
    id: 'beastmasters_bond',
    name: "Beastmaster's Bond",
    icon: '🐺',
    category: 'Fortune',
    points: 2,
    description: 'Your familiar fights like it has something to prove.',
    effectText: 'Familiars deal +3 damage',
    cost: { coins: 800, raw_rat_meat: 30 },
    effects: { familiarDamageBonus: 3 },
  },
  {
    id: 'zealots_fervor',
    name: "Zealot's Fervor",
    icon: '🙏',
    category: 'Fortune',
    points: 2,
    description: 'Your devotion burns slow and steady.',
    effectText: 'Prayer blessings drain 40% slower',
    cost: { coins: 900, bones: 60 },
    effects: { prayerDrainReduction: 0.4 },
  },
];

// Losing to a boss costs coin and hard-won experience, scaled to how far above your
// weight you were punching. Regular monsters cost you nothing but time.
window.Minerous.BOSS_DEFEAT_PENALTY = { coinsPerLevel: 30, xpPerLevel: 25 };

window.Minerous.bossDefeatPenalty = function bossDefeatPenalty(level) {
  const p = window.Minerous.BOSS_DEFEAT_PENALTY;
  return { coins: p.coinsPerLevel * level, xp: p.xpPerLevel * level };
};

// Story feats aren't bought — they're earned by doing something, cost no points, and
// stay hidden in the Hall until you have them.
window.Minerous.FEATS.push({
  id: 'justice',
  name: 'A Sense of Justice',
  icon: '⚖',
  category: 'Secret',
  secret: true,
  points: 0,
  description: 'You put an honest man on a crooked gate, and something in you settled.',
  effectText: '+15% Prayer xp, from worship and offerings alike',
  cost: {},
  effects: { skillXpBonus: { prayer: 0.15 } },
});

// ---------------------------------------------------------------------------
// Quest failure.
//
// Accepting a quest starts a clock, and a kill quest also stakes your life against
// its target. Failing costs experience and standing — derived from what the quest
// was going to pay, so a big commission hurts more to botch than an errand. Quests
// can override either field; a null time limit means no clock at all.
// ---------------------------------------------------------------------------
window.Minerous.DEFAULT_QUEST_TIME_LIMIT_MS = 30 * 60 * 1000;

window.Minerous.getQuestFailure = function getQuestFailure(quest) {
  const timeLimitMs =
    quest.timeLimitMs === null
      ? null
      : quest.timeLimitMs || window.Minerous.DEFAULT_QUEST_TIME_LIMIT_MS;

  const penalty = quest.failPenalty || {
    // Half of what you'd have earned, rounded up so even small quests sting.
    skill: quest.rewardXp.skill,
    xp: Math.ceil(quest.rewardXp.amount * 0.5),
    affinity: Math.ceil((quest.rewardAffinity || 0) * 0.5),
  };

  // A kill quest is also a wager: die to what you were sent after and it's failed.
  const deadlyTargets = quest.type === 'kill' ? Object.keys(quest.requires) : [];

  return { timeLimitMs, penalty, deadlyTargets };
};

window.Minerous.formatDuration = function formatDuration(ms) {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

window.Minerous.getFeat = function getFeat(id) {
  return window.Minerous.FEATS.find((f) => f.id === id) || null;
};

// Respeccing gets steeper the more you've committed, so a full rebuild of a deep
// build is a real decision rather than something you do between fights.
window.Minerous.featResetCost = function featResetCost(spentPoints) {
  if (spentPoints <= 0) return 0;
  return 250 * spentPoints + 75 * spentPoints * spentPoints;
};

window.Minerous.isRested = function isRested() {
  return Date.now() < (window.Minerous.state.restedUntil || 0);
};

window.Minerous.restedMultiplier = function restedMultiplier() {
  return window.Minerous.isRested() ? window.Minerous.TAVERN_REST.accuracyMultiplier : 1;
};

// Prayer offerings consume bones for xp only — no item is produced.
window.Minerous.PRAYER_RECIPES = [
  { id: 'offer_bones', name: 'Bones', category: 'offering', level: 1, xp: 8, timeMs: 1800, color: '#d8d3c5', inputs: { bones: 1 } },
];

// Communing with the shrine fully recharges prayer points — no inputs, no xp.
window.Minerous.PRAYER_RECHARGE = {
  id: 'commune', name: 'Commune with Shrine', category: 'commune', timeMs: 3000, color: '#c9a6e0', inputs: {},
};

// Worship costs no materials — just time — and is the slow-but-free way to raise
// Prayer level, which is what unlocks Cleric spells below.
window.Minerous.PRAYER_WORSHIP = {
  id: 'worship', name: 'Worship', category: 'worship', timeMs: 3000, xp: 8, color: '#c9a6e0', inputs: {},
};

// Cleric spells unlock automatically once Prayer reaches their level — no separate
// "learn" step. The highest-level spell you've unlocked is cast automatically
// whenever a Prayer Book is equipped (see combat.js).
window.Minerous.CLERIC_SPELLS = [
  { id: 'smite', name: 'Smite', level: 1, pointCost: 3, damageBonus: 2, description: 'A basic bolt of holy energy.' },
  { id: 'holy_strike', name: 'Holy Strike', level: 15, pointCost: 5, damageBonus: 5, description: 'Focused holy force strikes true.' },
  { id: 'divine_judgment', name: 'Divine Judgment', level: 30, pointCost: 8, damageBonus: 9, description: 'Judgment descends upon your foe.' },
  { id: 'wrath_of_heavens', name: 'Wrath of the Heavens', level: 50, pointCost: 12, damageBonus: 15, description: 'The full fury of the divine, unleashed.' },
];

// A Prayer Book occupies the same weapon slot as a sword or bow — equipping one
// switches Combat's attack style to Cleric (spells cost prayer points to cast,
// but a Cleric kill fully refills the pool — see combat.js).
window.Minerous.CLERIC_GEAR = [
  {
    id: 'prayer_book',
    name: 'Prayer Book',
    category: 'weapon',
    style: 'cleric',
    level: 1,
    xp: 20,
    timeMs: 2800,
    color: '#c9a6e0',
    inputs: { radiantite: 2, log: 3 },
    damage: 2,
  },
];

// Meditation costs nothing but time — the slow, free way to raise the Monk level
// that unlocks the techniques below.
window.Minerous.MONK_MEDITATION = {
  id: 'meditate', name: 'Meditate', category: 'meditation', timeMs: 3000, xp: 8, color: '#d99a5b', inputs: {},
};

// Monk techniques are dual-gated: meditation raises the Monk level, but raw Combat
// level gates them too — a monk has to actually fight, not just sit. The strongest
// technique you qualify for on BOTH counts is the one you strike with.
window.Minerous.MONK_TECHNIQUES = [
  { id: 'palm_strike', name: 'Palm Strike', level: 1, combatLevel: 1, damageBonus: 2, description: 'A grounded, open-handed blow.' },
  { id: 'crane_kick', name: 'Crane Kick', level: 15, combatLevel: 10, damageBonus: 5, description: 'Balanced and precise, striking high.' },
  { id: 'tiger_fist', name: 'Tiger Fist', level: 30, combatLevel: 20, damageBonus: 9, description: 'Ferocious close-quarters mauling.' },
  { id: 'dragon_palm', name: 'Dragon Palm', level: 50, combatLevel: 35, damageBonus: 15, description: 'The perfected form — devastating.' },
];

// Monk's Gauntlets take the weapon slot like a sword, bow, or prayer book, and
// switch Combat's attack style to Monk — a bare-fisted brawler, so the "weapon" is
// just what's wrapped around the hands.
window.Minerous.MONK_GEAR = [
  {
    id: 'monk_gauntlets',
    name: "Monk's Gauntlets",
    category: 'weapon',
    style: 'monk',
    level: 1,
    xp: 20,
    timeMs: 2800,
    color: '#b8834f',
    inputs: { bronze_bar: 2, radiantite: 2 },
    damage: 2,
  },
];

// Spirit stones are bought from the Merchant, then socketed into gear via Crafting.
// Only one stone can be socketed per slot (weapon, armor) at a time — socketing a new
// one consumes and replaces whatever was there before.
const STONE_TIERS = [
  { tier: 'Minor', level: 1, xp: 15, price: 50, sellPrice: 20 },
  { tier: 'Greater', level: 20, xp: 40, price: 200, sellPrice: 80 },
  { tier: 'Superior', level: 40, xp: 90, price: 600, sellPrice: 240 },
];

const STONE_KINDS = [
  { key: 'haste', kind: 'weapon', label: 'Haste Stone', color: '#4fd6c9', values: [100, 200, 300], describe: (v) => `Attacks ${v}ms faster`, effect: (v) => ({ hasteMs: v }) },
  { key: 'power', kind: 'weapon', label: 'Power Stone', color: '#d65c5c', values: [1, 2, 3], describe: (v) => `+${v} combat damage`, effect: (v) => ({ damageBonus: v }) },
  { key: 'precision', kind: 'weapon', label: 'Precision Stone', color: '#e0b33e', values: [2, 4, 6], describe: (v) => `+${v} accuracy`, effect: (v) => ({ accuracyBonus: v }) },
  { key: 'ward', kind: 'armor', label: 'Ward Stone', color: '#4d9fd6', values: [2, 4, 6], describe: (v) => `+${v} defense`, effect: (v) => ({ defenseBonus: v }) },
  {
    key: 'deflect',
    kind: 'armor',
    label: 'Deflect Stone',
    color: '#9a6bb8',
    values: [
      { chance: 0.1, percent: 0.3 },
      { chance: 0.15, percent: 0.4 },
      { chance: 0.2, percent: 0.5 },
    ],
    describe: (v) => `${Math.round(v.chance * 100)}% chance to deflect ${Math.round(v.percent * 100)}% of a hit`,
    effect: (v) => ({ deflectChance: v.chance, deflectPercent: v.percent }),
  },
  { key: 'vitality', kind: 'armor', label: 'Vitality Stone', color: '#5fbf6f', values: [5, 10, 15], describe: (v) => `+${v} max HP`, effect: (v) => ({ hpBonus: v }) },
];

window.Minerous.SPIRIT_STONES = [];
STONE_KINDS.forEach(({ key, kind, label, color, values, describe, effect }) => {
  STONE_TIERS.forEach((tierInfo, i) => {
    window.Minerous.SPIRIT_STONES.push({
      id: `${tierInfo.tier.toLowerCase()}_${key}_stone`,
      name: `${tierInfo.tier} ${label}`,
      // Kept so stores can stock by tier without parsing the id.
      tier: tierInfo.tier,
      kind,
      color,
      level: tierInfo.level,
      xp: tierInfo.xp,
      timeMs: 3000,
      price: tierInfo.price,
      sellPrice: tierInfo.sellPrice,
      description: describe(values[i]),
      effect: effect(values[i]),
    });
  });
});

// NPCs offer a fixed, ordered chain of quests. Only the earliest incomplete quest
// in an NPC's chain is available at a time — turning it in unlocks the next one.
// Each NPC hands out a small thematic gift (via the "Ask Around" dialogue option)
// once affinity is high enough — see ASK_AFFINITY_THRESHOLD in quests.js.
window.Minerous.NPCS = [
  {
    id: 'ned',
    locationId: 'smithing',
    name: 'Ned the Blacksmith',
    color: '#8a6a56',
    blurb: "Ned's swamped with an order for the royal army.",
    gift: { itemId: 'copper', min: 2, max: 4 },
    // Shown in place of the real quest line until you accept — vague on purpose, so
    // nobody can read the requirements, go and prepare them, and hand them straight
    // back. The specific dialogue is revealed the moment you agree.
    questTeasers: [
      '"Good timing. I\'m short again and the orders keep coming — fancy helping me out?"',
      '"There\'s work here if you want it. Nothing I can\'t explain once you\'ve said yes."',
      '"I need a few things brought in. Say the word and I\'ll write you a list."',
      '"Big job, this one. Bigger than I\'d ask of most. Interested?"',
      '"One more favour, if you\'ve got the time. I\'ll tell you the details after."',
    ],
    guardRemark:
      '"Heard they finally pulled that leech off the Lidas gate. Fifty gold every time I hauled ore through. Fifty!"',
  },
  {
    id: 'borca',
    locationId: 'witch_hut',
    name: 'Borca the Witch',
    color: '#6b5b8a',
    blurb: 'Borca is brewing something... unusual.',
    gift: { itemId: 'bones', min: 2, max: 4 },
    questTeasers: [
      '"Mmm. I need things. You needn\'t know what for — not yet."',
      '"The brew wants feeding. Agree to help and I\'ll tell you with what."',
      '"I have a task. It is unpleasant. Most of mine are."',
      '"Come closer. There is something I want, and I would rather ask than explain."',
      '"The last one worked. This one will need more. Say yes and I\'ll be specific."',
    ],
    guardRemark:
      '"The new one at the Lidas gate waved me through. Waved! The old one charged me and then searched my basket."',
  },
  {
    id: 'jeffries',
    locationId: 'barracks',
    name: 'Royal Captain Jeffries',
    color: '#4d5a6b',
    blurb: 'Jeffries needs the roads cleared of monsters.',
    gift: { itemId: 'coins', min: 15, max: 30 },
    questTeasers: [
      '"There\'s a contract open. Sign on and I\'ll brief you properly."',
      '"Something needs killing. I\'ll name it once you\'ve committed."',
      '"The roads want clearing. Take the job and I\'ll tell you where."',
      '"This one\'s uglier than the last. Still interested?"',
      '"A matter of some delicacy. I\'ll speak plainly once you\'ve agreed."',
    ],
    guardRemark:
      '"Sir Tomas has the gate now. Refused a bribe on his first morning and then reported it, in writing. I have ' +
      'never been prouder, nor buried in more paperwork."',
  },
  {
    id: 'roland',
    locationId: 'tavern',
    name: 'Roland the Tavern Keeper',
    color: '#b8722f',
    blurb: 'Goblin raiders are hitting his storehouse, and his stew pot is running low.',
    gift: { itemId: 'cooked_rat_meat', min: 1, max: 2 },
    questTeasers: [
      '"I\'ve got trouble. Say you\'ll help and I\'ll pour you one while I explain."',
      '"Need a favour. Nothing I\'d put in writing before you agree."',
      '"You again — good. There\'s something I can\'t handle myself."',
      '"The regulars are restless. Take the job and I\'ll tell you why."',
    ],
    guardRemark:
      '"My suppliers have stopped adding a \'gate fee\' to every barrel. Ale is cheaper this week, and that is your doing."',
  },
  {
    id: 'clara',
    locationId: 'prayer',
    name: 'Clara the Cleric',
    color: '#e8d9a0',
    blurb: 'Clara tends the shrine and is looking for a promising acolyte.',
    gift: { itemId: 'radiantite', min: 1, max: 3 },
    questTeasers: [
      '"The shrine has need of you. Accept, and I will explain what is asked."',
      '"There is work of faith to be done. I\'ll tell you its shape once you consent."',
      '"You have the look of someone willing. Shall I go on?"',
      '"This next step is harder. It is meant to be. Will you take it?"',
    ],
    guardRemark:
      '"They tell me an honest man holds the gate now. Good. Coin taken at a gate is coin taken from someone who needed it."',
  },
  {
    id: 'aldric',
    locationId: 'palace',
    name: 'King Aldric',
    color: '#c9a45e',
    blurb: 'The king has been waiting to speak with you since the gates opened.',
    gift: { itemId: 'coins', min: 40, max: 120 },
    questTeasers: [
      '"I have a task for you. Accept it and I will speak plainly."',
      '"The crown has need. Agree, and I\'ll tell you exactly what of."',
      '"There is a thing I would rather not put to a courtier. Will you hear it?"',
      '"One more matter, and it is not a small one."',
    ],
    guardRemark: '"Sir Tomas writes to me weekly. Dull letters. Wonderfully, gloriously dull."',
  },
];

// Repeatable actions a quest can ask you to perform, counted in state.actions.
// Each entry's id is the counter key incremented by the module that performs it.
window.Minerous.QUEST_ACTIONS = [
  { id: 'worship', name: 'Worship at the Shrine', verb: 'performed', color: '#c9a6e0' },
  { id: 'cleric_cast', name: 'Cleric Spells Cast', verb: 'cast', color: '#e8d9a0' },
];

window.Minerous.QUESTS = [
  {
    id: 'ned_ore',
    npcId: 'ned',
    order: 1,
    name: 'Short on Stock',
    dialogue: "\"Ah, welcome! I'm swamped — the royal army placed a rush order and I'm out of copper and tin. Could you fetch me some?\"",
    requires: { copper: 5, tin: 5 },
    rewardCoins: 20,
    rewardXp: { skill: 'smithing', amount: 15 },
    rewardStoneId: 'minor_power_stone',
    rewardAffinity: 8,
  },
  {
    id: 'ned_iron',
    npcId: 'ned',
    order: 2,
    name: 'Sturdier Stock',
    dialogue: '"Raw ore only gets us so far. Smelt it down and bring me six bronze bars — I want stock I can work with, not a pile of rocks."',
    requires: { bronze_bar: 6 },
    rewardCoins: 35,
    rewardXp: { skill: 'smithing', amount: 30 },
    rewardStoneId: 'minor_haste_stone',
    rewardAffinity: 12,
  },
  {
    id: 'ned_sword',
    npcId: 'ned',
    order: 3,
    name: "A Soldier's Blade",
    dialogue: '"Here\'s the real task: forge me a Bronze Sword and a Full Helm to match. The army needs to see what you\'re capable of."',
    requires: { bronze_sword: 1, bronze_helmet: 1 },
    rewardCoins: 70,
    rewardXp: { skill: 'smithing', amount: 50 },
    rewardStoneId: 'minor_precision_stone',
    rewardAffinity: 18,
  },
  {
    id: 'ned_royal_order',
    npcId: 'ned',
    order: 4,
    name: 'The Royal Order',
    dialogue: '"This is it — the royal order itself. A Bronze Platebody, and twelve radiantite to gild it. Nothing else in these hills shines like that."',
    requires: { bronze_body: 1, radiantite: 12 },
    rewardCoins: 150,
    rewardXp: { skill: 'smithing', amount: 100 },
    rewardStoneId: 'greater_power_stone',
    rewardAffinity: 30,
  },
  {
    id: 'ned_squire_blade',
    npcId: 'ned',
    order: 5,
    // Word of the knighting has to reach the village before Ned can start on it.
    requiresQuest: 'aldric_gate',
    name: "The Squire's Blade",
    dialogue:
      '"A rider came through with news — the crown\'s knighting some squire out of Lidas to fix that gate business." ' +
      'Ned wipes his hands. "Jeffries can find him plate. Plate is easy. A man remembers his first sword. Bring me a ' +
      'Bronze Sword and ten radiantite, and I\'ll inlay the fuller so it catches the light when he swears the oath."',
    // If you hold the ceremony before coming back here, Ned is working to a different
    // brief — the blade is no longer for a squire.
    altDialogue: {
      afterQuest: 'jeffries_knighting',
      name: "The Knight's Blade",
      text:
        '"You\'re late." Ned doesn\'t look up. "They knighted that lad already — I heard it from three people before ' +
        'breakfast. So he swore his oath holding whatever the barracks had spare, did he." He sets out his tools ' +
        'anyway. "Fine. Then it isn\'t a squire\'s blade, it\'s a knight\'s, and it had better look like one. Bronze ' +
        'Sword, ten radiantite. Sir Tomas can carry something made for him instead of handed down to him."',
    },
    requires: { bronze_sword: 1, radiantite: 10 },
    rewardCoins: 120,
    rewardXp: { skill: 'smithing', amount: 180 },
    rewardStoneId: 'greater_precision_stone',
    rewardAffinity: 16,
  },
  {
    id: 'borca_bones',
    npcId: 'borca',
    order: 1,
    name: 'Grave Robbing',
    dialogue: '"Mmm, bones... perfect for my brew. Bring me eight and I\'ll make it worth your while."',
    requires: { bones: 8 },
    rewardCoins: 20,
    rewardXp: { skill: 'prayer', amount: 20 },
    rewardStoneId: 'minor_ward_stone',
    rewardAffinity: 8,
  },
  {
    id: 'borca_eyes',
    npcId: 'borca',
    order: 2,
    name: 'Eight-Legged Ingredients',
    dialogue: '"Now I need spider eyes — five of them, plucked fresh. The caves nearby should oblige."',
    requires: { spider_eye: 5 },
    rewardCoins: 35,
    rewardXp: { skill: 'combat', amount: 30 },
    rewardStoneId: 'minor_deflect_stone',
    rewardAffinity: 12,
  },
  {
    id: 'borca_meat',
    npcId: 'borca',
    order: 3,
    name: "A Familiar's Meal",
    dialogue: '"My familiar needs feeding — raw rat meat and a few more bones will do nicely."',
    requires: { raw_rat_meat: 5, bones: 5 },
    rewardCoins: 50,
    rewardXp: { skill: 'prayer', amount: 40 },
    rewardStoneId: 'minor_vitality_stone',
    rewardAffinity: 18,
  },
  {
    id: 'borca_curse',
    npcId: 'borca',
    order: 4,
    name: "The Witch's Curse",
    dialogue: '"For the final working, I need ten spider eyes and fifteen bones. This curse will not brew itself."',
    requires: { spider_eye: 10, bones: 15 },
    rewardCoins: 120,
    rewardXp: { skill: 'prayer', amount: 90 },
    rewardStoneId: 'greater_deflect_stone',
    rewardAffinity: 30,
  },
  {
    id: 'jeffries_rats',
    npcId: 'jeffries',
    order: 1,
    type: 'kill',
    name: 'Stragglers',
    dialogue: '"You broke the host on the road, but survivors are still creeping back to pick at the outskirts. Finish five of them."',
    requires: { goblin_survivor: 5 },
    rewardCoins: 25,
    rewardXp: { skill: 'combat', amount: 20 },
    rewardStoneId: 'minor_precision_stone',
    rewardAffinity: 8,
  },
  {
    id: 'jeffries_spiders',
    npcId: 'jeffries',
    order: 2,
    type: 'kill',
    name: 'Highway Robbery',
    dialogue:
      '"Bandits are working the eastern road and the merchants are refusing to travel. Put six of them down." He ' +
      'glances at a young man polishing a rack of spears with far too much care. "Tomas would volunteer. Tomas ' +
      'always volunteers. Tomas is also nineteen, so Tomas is staying here."',
    requires: { bandit: 6 },
    rewardCoins: 40,
    rewardXp: { skill: 'combat', amount: 35 },
    rewardStoneId: 'minor_haste_stone',
    rewardAffinity: 12,
  },
  {
    id: 'jeffries_combo',
    npcId: 'jeffries',
    order: 3,
    type: 'kill',
    name: 'Twin Threats',
    dialogue:
      '"The bandits have boarhounds running with them now — trained, by the look of it. Five of each, and I\'ll rest ' +
      'easier." He lowers his voice. "My squire Tomas asked whether the hounds could be reasoned with. Good heart. ' +
      'Terrible instincts. Take the contract yourself."',
    requires: { boarhound: 5, bandit: 5 },
    rewardCoins: 70,
    rewardXp: { skill: 'combat', amount: 55 },
    rewardStoneId: 'minor_ward_stone',
    rewardAffinity: 18,
  },
  {
    id: 'jeffries_muster',
    npcId: 'jeffries',
    order: 4,
    type: 'kill',
    name: "The Captain's Muster",
    dialogue:
      '"Wisps are drifting up out of the fens and the brigands have a captain organising them. Five wisps, three ' +
      'captains — then I\'ll sleep." He rubs his eyes. "Tomas stood a double watch on the fen road last night. ' +
      'Unasked. Unpaid. That boy deserves a better posting than this barracks can give him."',
    requires: { fen_wisp: 5, brigand_captain: 3 },
    rewardCoins: 150,
    rewardXp: { skill: 'combat', amount: 120 },
    rewardStoneId: 'greater_power_stone',
    rewardAffinity: 30,
  },
  {
    id: 'roland_raiders_1',
    npcId: 'roland',
    order: 1,
    type: 'kill',
    name: 'Raiders at the Door',
    dialogue: '"Goblins have been raiding my storehouse every night! Kill five of the raiders lurking near the caves."',
    requires: { goblin: 5 },
    rewardCoins: 30,
    rewardXp: { skill: 'combat', amount: 25 },
    rewardStoneId: 'minor_ward_stone',
    rewardAffinity: 8,
  },
  {
    id: 'roland_stew',
    npcId: 'roland',
    order: 2,
    name: 'A Warm Meal',
    dialogue: '"With the raids scaring off my usual suppliers, I could use some cooked rat meat to keep the stew pot full. Bring me five."',
    requires: { cooked_rat_meat: 5 },
    rewardCoins: 25,
    rewardXp: { skill: 'cooking', amount: 25 },
    rewardStoneId: 'minor_vitality_stone',
    rewardAffinity: 12,
  },
  {
    id: 'roland_raiders_2',
    npcId: 'roland',
    order: 3,
    type: 'kill',
    name: 'Driving Them Back',
    dialogue: '"They keep coming back! Ten more goblins should send a message."',
    requires: { goblin: 10 },
    rewardCoins: 60,
    rewardXp: { skill: 'combat', amount: 50 },
    rewardStoneId: 'minor_precision_stone',
    rewardAffinity: 18,
  },
  {
    id: 'roland_feast',
    npcId: 'roland',
    order: 4,
    name: 'Feast for the Regulars',
    dialogue: '"Business is finally picking back up — think you can cook up ten more plates for the regulars?"',
    requires: { cooked_rat_meat: 10 },
    rewardCoins: 70,
    rewardXp: { skill: 'cooking', amount: 60 },
    rewardStoneId: 'greater_vitality_stone',
    rewardAffinity: 30,
  },
  {
    id: 'clara_ore',
    npcId: 'clara',
    order: 1,
    name: 'Sacred Stone',
    dialogue: '"The shrine\'s inlays have gone dull. Radiantite catches the light like nothing else — bring me five pieces and I\'ll show you what it\'s for."',
    requires: { radiantite: 5 },
    rewardCoins: 30,
    rewardXp: { skill: 'prayer', amount: 25 },
    rewardStoneId: 'minor_ward_stone',
    rewardAffinity: 12,
  },
  {
    id: 'clara_worship',
    npcId: 'clara',
    order: 2,
    type: 'action',
    name: 'Devotion',
    dialogue: '"Faith isn\'t bought, it\'s practiced. Worship at the shrine ten times — I\'ll know if you rushed it."',
    requires: { worship: 10 },
    rewardCoins: 50,
    rewardXp: { skill: 'prayer', amount: 60 },
    rewardStoneId: 'minor_vitality_stone',
    rewardAffinity: 22,
  },
  {
    id: 'clara_spells',
    npcId: 'clara',
    order: 3,
    type: 'action',
    name: 'The Cleric\'s Path',
    dialogue: '"Now put it to use. Take up a prayer book and strike down fifteen foes with holy power — that is what it means to walk the cleric\'s path."',
    requires: { cleric_cast: 15 },
    rewardCoins: 120,
    rewardXp: { skill: 'prayer', amount: 120 },
    rewardStoneId: 'greater_ward_stone',
    rewardAffinity: 34,
  },

  {
    id: 'aldric_sewers',
    npcId: 'aldric',
    order: 1,
    type: 'kill',
    name: 'What Lies Beneath',
    dialogue:
      '"Highcastle has a problem it does not discuss at court. Things live in the drains, and they have grown bold ' +
      'while my guard watched the gates for bandits. Clear five of them."',
    requires: { sewer_lurker: 5 },
    rewardCoins: 200,
    rewardXp: { skill: 'combat', amount: 250 },
    rewardStoneId: 'greater_power_stone',
    rewardAffinity: 14,
  },
  {
    id: 'aldric_catacombs',
    npcId: 'aldric',
    order: 2,
    name: 'The Quiet Vaults',
    dialogue:
      '"Beneath the drains are the old vaults, and my ancestors do not rest as soundly as the histories claim. ' +
      'Bring me three grave tokens so my scholars can name what walks down there."',
    requires: { grave_token: 3 },
    rewardCoins: 320,
    rewardXp: { skill: 'prayer', amount: 300 },
    rewardStoneId: 'greater_ward_stone',
    rewardAffinity: 20,
  },
  {
    id: 'aldric_construct',
    npcId: 'aldric',
    order: 3,
    name: 'The Gilded Guardian',
    dialogue:
      '"One last thing, and then I will stop sending my saviour into holes in the ground. Something gilded guards ' +
      'the deepest vault. Bring me its core and the throne room is yours whenever you want it."',
    requires: { gilded_core: 1 },
    rewardCoins: 600,
    rewardXp: { skill: 'combat', amount: 700 },
    rewardStoneId: 'greater_haste_stone',
    rewardAffinity: 34,
  },
  {
    id: 'aldric_gate',
    npcId: 'aldric',
    order: 4,
    type: 'talk',
    name: 'The Matter of the Gate',
    dialogue:
      '"A levy at the Lidas gate? There is no such levy." The king\'s jaw tightens. "Then he goes — but I will not ' +
      'leave that post empty and I will not hand it to another of his friends. Find me someone honest and I will ' +
      'knight them myself. Captain Jeffries keeps a barracks in that town; if anyone knows a good one, he does."',
    requires: {},
    // Nothing to gather and nothing to fight — no clock on a conversation.
    timeLimitMs: null,
    turnInLabel: 'Take it to Captain Jeffries',
    rewardCoins: 0,
    rewardXp: { skill: 'combat', amount: 100 },
    rewardAffinity: 6,
  },

  {
    id: 'jeffries_knighting',
    npcId: 'jeffries',
    order: 5,
    // Can't be raised with the captain until the king has actually asked for it.
    requiresQuest: 'aldric_gate',
    name: 'A Squire Worth Knighting',
    dialogue:
      '"The gate levy. Yes. We all know." Jeffries sets down his cup. "I have a squire — Tomas. Honest to a fault, ' +
      'which is why he is still a squire and that other one is still on the gate. But a knighting costs: two hundred ' +
      'gold for the ceremony, and he needs a suit to stand up in. Bronze will do — helm, body, legs. Do that and the ' +
      'crown gets its honest man."',
    requires: { coins: 200, bronze_helmet: 1, bronze_body: 1, bronze_legs: 1 },
    rewardCoins: 0,
    rewardXp: { skill: 'prayer', amount: 250 },
    rewardStoneId: 'greater_ward_stone',
    rewardAffinity: 24,
    // Word travels: everyone who ever paid that levy hears about it.
    rewardAffinityAll: 20,
    rewardFeatId: 'justice',
    setsFlags: { corruptGuardReplaced: true },
  },
];

// NPC clothing: a single xp-boosting cosmetic item per NPC, unlocked only once an
// NPC's affinity reaches minAffinity (in practice, finishing their whole questline).
window.Minerous.CLOTHING = [
  {
    id: 'smith_overalls',
    npcId: 'ned',
    name: "Smith's Overalls",
    category: 'clothing',
    color: '#8a6a56',
    price: 250,
    minAffinity: 68,
    xpBonusSkills: ['mining', 'smithing'],
    xpBonusPercent: 0.1,
    description: '+10% Mining and Smithing xp',
  },
  {
    id: 'witch_shawl',
    npcId: 'borca',
    name: "Witch's Shawl",
    category: 'clothing',
    color: '#6b5b8a',
    price: 250,
    minAffinity: 68,
    xpBonusSkills: ['prayer', 'crafting'],
    xpBonusPercent: 0.1,
    description: '+10% Prayer and Crafting xp',
  },
  {
    id: 'captains_cloak',
    npcId: 'jeffries',
    name: "Captain's Cloak",
    category: 'clothing',
    color: '#4d5a6b',
    price: 250,
    minAffinity: 68,
    xpBonusSkills: ['combat'],
    xpBonusPercent: 0.15,
    description: '+15% Combat xp',
  },
  {
    id: 'tavern_apron',
    npcId: 'roland',
    name: 'Tavern Apron',
    category: 'clothing',
    color: '#b8722f',
    price: 250,
    minAffinity: 68,
    xpBonusSkills: ['cooking'],
    xpBonusPercent: 0.15,
    description: '+15% Cooking xp',
  },
  {
    id: 'cleric_vestments',
    npcId: 'clara',
    name: "Cleric's Vestments",
    category: 'clothing',
    color: '#e8d9a0',
    price: 250,
    minAffinity: 68,
    xpBonusSkills: ['prayer'],
    xpBonusPercent: 0.15,
    description: '+15% Prayer xp',
  },
  {
    id: 'royal_regalia',
    npcId: 'aldric',
    name: 'Royal Regalia',
    category: 'clothing',
    color: '#c9a45e',
    price: 1200,
    minAffinity: 68,
    xpBonusSkills: ['mining', 'smithing', 'combat', 'cooking', 'prayer', 'summoning', 'crafting', 'woodcutting', 'fletching', 'monk'],
    xpBonusPercent: 0.08,
    description: '+8% xp in every skill',
  },
];

// Falls back to half the item's crafting xp when no explicit sellPrice is set —
// keeps every ore/bar/weapon/armor/food sellable without hand-tagging each one.
window.Minerous.getSellPrice = function getSellPrice(id) {
  const item = window.Minerous.getItem(id);
  if (!item) return 0;
  if (item.sellPrice !== undefined) return item.sellPrice;
  if (item.xp) return Math.max(1, Math.round(item.xp * 0.5));
  return 1;
};

// Looks up display metadata (name/color) for any item id that can live in the inventory.
window.Minerous.getItem = function getItem(id) {
  if (id === window.Minerous.COINS_ITEM.id) return window.Minerous.COINS_ITEM;
  if (id === window.Minerous.BONES_ITEM.id) return window.Minerous.BONES_ITEM;
  const ore = window.Minerous.ORES.find((o) => o.id === id);
  if (ore) return ore;
  const tree = window.Minerous.TREES.find((t) => t.id === id);
  if (tree) return tree;
  const recipe = window.Minerous.SMITHING_RECIPES.find((r) => r.id === id);
  if (recipe) return recipe;
  const fletched = window.Minerous.FLETCHING_RECIPES.find((r) => r.id === id);
  if (fletched) return fletched;
  const raw = window.Minerous.RAW_FOOD.find((f) => f.id === id);
  if (raw) return raw;
  const misc = window.Minerous.MISC_ITEMS.find((m) => m.id === id);
  if (misc) return misc;
  const cooked = window.Minerous.COOKING_RECIPES.find((f) => f.id === id);
  if (cooked) return cooked;
  const tavernFood = window.Minerous.TAVERN_FOODS.find((f) => f.id === id);
  if (tavernFood) return tavernFood;
  const storeGood = window.Minerous.STORE_GOODS.find((g) => g.id === id);
  if (storeGood) return storeGood;
  const stone = window.Minerous.SPIRIT_STONES.find((s) => s.id === id);
  if (stone) return stone;
  const clothing = window.Minerous.CLOTHING.find((c) => c.id === id);
  if (clothing) return clothing;
  const gear = window.Minerous.CLERIC_GEAR.find((g) => g.id === id);
  if (gear) return gear;
  const monkGear = window.Minerous.MONK_GEAR.find((g) => g.id === id);
  if (monkGear) return monkGear;
  return null;
};

// Classic RuneScape-style experience curve: smoothly escalating xp/level.
window.Minerous.xpForLevel = function xpForLevel(level) {
  let points = 0;
  for (let l = 1; l < level; l++) {
    points += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(points / 4);
};

window.Minerous.levelForXp = function levelForXp(xp) {
  const max = window.Minerous.MAX_LEVEL;
  for (let level = max; level >= 1; level--) {
    if (xp >= window.Minerous.xpForLevel(level)) return level;
  }
  return 1;
};
