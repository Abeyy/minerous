// Every quest must be completable without leaving the area its NPC lives in.
//
// This is easy to break by accident: moving an NPC, restricting an area's ore, or
// splitting the monster roster can all strand a questline in a town that can't
// supply it. Run this after touching AREAS, MONSTERS, QUESTS, or any recipe list.
//
//   node scripts/check-quest-locality.js

const path = require('node:path');

global.window = { Minerous: {} };
require(path.join(__dirname, '..', 'src', 'game', 'data.js'));
const M = global.window.Minerous;

// Everything obtainable in an area, closed over crafting: gather what the ground and
// the local wildlife give you, then keep applying recipes until nothing new appears.
function obtainableIn(area) {
  const have = new Set(['coins']);

  const cap = (key) => (area.limits && area.limits[key] != null ? area.limits[key] : Infinity);
  const offers = (skill) => (area.skills || []).includes(skill);
  M.ORES.filter((o) => o.level <= cap('mining')).forEach((o) => have.add(o.id));
  M.TREES.forEach((t) => have.add(t.id));

  // Hunting yields meat, hides and bones wherever the Hunting Grounds are open, which is
  // every settlement — without this, a perfectly local quest for a pelt reads as stranded.
  if (offers('hunter')) {
    for (const target of M.HUNT_TARGETS) {
      (target.drops || []).forEach((d) => have.add(d.id));
    }
  }

  const roster = M.MONSTERS.filter((m) => !m.boss && (!area.monsters || area.monsters.includes(m.id)));
  for (const m of roster) {
    if (m.meatId) have.add(m.meatId);
    if (m.bonesMin) have.add('bones');
    (m.extraDrops || []).forEach((d) => have.add(d.id));
  }
  // Bosses are shared between areas, so their drops count everywhere.
  for (const m of M.MONSTERS.filter((b) => b.boss)) {
    if (m.bonesMin) have.add('bones');
    (m.extraDrops || []).forEach((d) => have.add(d.id));
  }

  // Anything sold for coin is obtainable wherever the shop is.
  M.SPIRIT_STONES.forEach((s) => have.add(s.id));
  if ((area.npcs || []).includes('roland')) M.TAVERN_FOODS.forEach((f) => have.add(f.id));

  const recipes = [
    ...M.SMITHING_RECIPES,
    ...M.FLETCHING_RECIPES,
    ...M.COOKING_RECIPES,
    ...M.CLERIC_GEAR,
    ...M.MONK_GEAR,
    ...M.FAMILIARS.filter((f) => f.inputs),
  ];
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of recipes) {
      if (have.has(r.id) || !r.inputs) continue;
      if (Object.keys(r.inputs).every((id) => have.has(id))) {
        have.add(r.id);
        grew = true;
      }
    }
  }
  return have;
}

const areaOf = {};
for (const area of M.AREAS) for (const npc of area.npcs || []) areaOf[npc] = area;

const problems = [];
for (const quest of M.QUESTS) {
  const area = areaOf[quest.npcId];
  if (!area) {
    problems.push(`${quest.npcId} lives in no area — quest "${quest.name}" is unreachable.`);
    continue;
  }

  for (const id of Object.keys(quest.requires || {})) {
    if (quest.type === 'kill') {
      const local = (area.monsters || M.MONSTERS.filter((m) => !m.boss).map((m) => m.id)).includes(id);
      if (!local) problems.push(`[${area.name}] ${quest.npcId} "${quest.name}" needs kills of "${id}", which does not roam here.`);
    } else if (quest.type === 'action') {
      // Worship and casting need the Temple; nothing else uses action counters yet.
      if (!area.skills.includes('prayer')) {
        problems.push(`[${area.name}] ${quest.npcId} "${quest.name}" needs "${id}" but there is no Temple here.`);
      }
    } else if (!obtainableIn(area).has(id)) {
      problems.push(`[${area.name}] ${quest.npcId} "${quest.name}" needs item "${id}", which cannot be got here.`);
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} quest(s) cannot be finished locally:\n`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ All ${M.QUESTS.length} quests are completable in their own area.`);
