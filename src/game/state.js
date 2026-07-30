window.Minerous = window.Minerous || {};

(function () {
  const { MAX_LEVEL, levelForXp } = window.Minerous;

  const state = {
    screen: 'home',
    // null = no area chosen yet, so the game opens on the world map.
    currentAreaId: null,
    // Gate ids already beaten — a cleared blocker never reappears.
    clearedGates: [],
    // Bandit Camp tiers already put down, in the order they fell.
    campDefeated: [],
    // Gate rewards already played. Separate from clearedGates because a gate can clear
    // itself remotely (the capital opens when the Bandit King dies) and the arrival
    // scene should still wait until you actually walk in.
    gateRewardsShown: [],
    // The capital's screening is one-shot: sit it once, fail, and that's that.
    capitalScreeningFailed: false,
    // Once the crown replaces the gate guard, the Lidas toll stops for good.
    corruptGuardReplaced: false,
    // Affinity granted by events rather than by that NPC's own quests — added on top
    // of the quest-derived total in quests.js.
    affinityBonus: {},
    // Vault storage. Separate from inventory so its slot limit is its own, and gold
    // held here earns interest while the carried purse does not.
    bank: { items: {}, gold: 0, lastInterestAt: 0 },
    // Wall-clock ms when the tavern's rested bonus wears off. Saved deliberately: a
    // night's sleep should still be ticking down when you come back to the game.
    restedUntil: 0,
    // Feat ids bought at the Hall of Champions. Points spent are derived from this
    // list rather than stored, so the two can never drift apart.
    feats: [],
    // Per-skill batch size for crafting runs, keyed by skill id. Remembered so you
    // don't have to reset it every time you walk into the smithy.
    batchSize: {},
    skillXp: {
      mining: 0,
      smithing: 0,
      combat: 0,
      cooking: 0,
      prayer: 0,
      summoning: 0,
      crafting: 0,
      woodcutting: 0,
      fletching: 0,
      hunter: 0,
      // The three non-melee combat styles each train their own skill, earned by
      // fighting with that style rather than at any building.
      ranger: 0,
      cleric: 0,
      monk: 0,
      gunslinger: 0,
    },
    inventory: {},
    equippedWeaponId: null,
    equippedArmor: { helmet: null, body: null, legs: null },
    equippedClothingId: null,
    weaponSocket: null,
    armorSocket: null,
    combat: { hp: null, autoEat: false }, // hp: null = uninitialized, lazily set to max on first use
    prayer: { points: null, activeBuffs: { offense: null, defense: null } },
    // `levels` is each familiar's upgrade rank (1-10), keyed by id. Not to be
    // confused with FAMILIARS[].level, which is the Summoning level needed to
    // summon it in the first place.
    summoning: { activeFamiliarId: null, levels: {} },
    // `acceptedIds` are quests you've agreed to take on. A quest an NPC is offering
    // isn't tracked until you accept it, which is also when its counter snapshot is
    // taken — so prior grinding never counts toward a quest you hadn't agreed to.
    // `deadlines` holds the wall-clock ms each accepted quest expires at.
    quests: {
      completedIds: [],
      acceptedIds: [],
      deadlines: {},
      killSnapshots: {},
      actionSnapshots: {},
      giftCooldowns: {},
      // Set once the pre-acceptance migration has run; see Quests.migrate().
      migratedAcceptance: false,
    },
    kills: {},
    // Lifetime counters for repeatable actions that quests can ask you to perform
    // (worshipping, casting cleric spells) — see QUEST_ACTIONS in data.js.
    actions: {},
    affinity: {},
  };

  window.Minerous.state = state;

  window.Minerous.getLevel = function getLevel(skillId) {
    return Math.min(MAX_LEVEL, levelForXp(state.skillXp[skillId] || 0));
  };

  // Equipped clothing (bought from an NPC's Trade tab once affinity is high enough)
  // boosts xp gain for a couple of skills tied to that NPC's theme.
  window.Minerous.getClothingXpBonus = function getClothingXpBonus(skillId) {
    const clothing = state.equippedClothingId ? window.Minerous.getItem(state.equippedClothingId) : null;
    if (clothing && clothing.xpBonusSkills && clothing.xpBonusSkills.includes(skillId)) {
      return clothing.xpBonusPercent;
    }
    return 0;
  };

  // Returns true if this xp gain crossed a level boundary.
  window.Minerous.addXp = function addXp(skillId, amount) {
    const before = window.Minerous.getLevel(skillId);
    const featEffects = window.Minerous.Feats ? window.Minerous.Feats.getEffects() : null;
    const featXp = featEffects ? featEffects.xpBonus + (featEffects.skillXpBonus[skillId] || 0) : 0;
    const boosted = Math.round(amount * (1 + window.Minerous.getClothingXpBonus(skillId) + featXp));
    state.skillXp[skillId] = (state.skillXp[skillId] || 0) + boosted;
    const after = window.Minerous.getLevel(skillId);
    return after > before;
  };

  // A carried pile spills into as many slots as it needs: 100 copper at a stack limit
  // of 28 is four slots, not one. Coins never occupy a slot — they live on their own
  // line — and the vault ignores stack limits entirely, storing a whole hoard per
  // entry, which is the reason to walk to one.
  function stacksFor(count) {
    return Math.ceil(count / window.Minerous.STACK_LIMIT);
  }

  function countCarriedSlots(bag) {
    return Object.entries(bag)
      .filter(([id, count]) => id !== 'coins' && count > 0)
      .reduce((sum, [, count]) => sum + stacksFor(count), 0);
  }

  function countBankEntries(bag) {
    return Object.entries(bag).filter(([id, count]) => id !== 'coins' && count > 0).length;
  }

  window.Minerous.stacksFor = stacksFor;

  window.Minerous.inventorySlotsUsed = function inventorySlotsUsed() {
    return countCarriedSlots(state.inventory);
  };

  window.Minerous.bankSlotsUsed = function bankSlotsUsed() {
    return countBankEntries(state.bank.items);
  };

  window.Minerous.isInventoryFull = function isInventoryFull() {
    return countCarriedSlots(state.inventory) >= window.Minerous.INVENTORY_SLOTS;
  };

  // Whether `qty` more of this id would fit. Topping up a part-filled stack is free;
  // spilling into a new one needs a slot, and a big haul may need several.
  window.Minerous.canCarry = function canCarry(id, qty = 1) {
    if (id === 'coins') return true;
    const current = state.inventory[id] || 0;
    const extraSlots = stacksFor(current + qty) - stacksFor(current);
    return countCarriedSlots(state.inventory) + extraSlots <= window.Minerous.INVENTORY_SLOTS;
  };

  // The most of this id you could pick up right now — part-filled stack plus whatever
  // empty slots remain. Used by the vault so withdrawing a hoard takes what fits
  // instead of refusing outright.
  window.Minerous.carryCapacityFor = function carryCapacityFor(id) {
    const limit = window.Minerous.STACK_LIMIT;
    const current = state.inventory[id] || 0;
    const freeSlots = window.Minerous.INVENTORY_SLOTS - countCarriedSlots(state.inventory);
    const roomInOpenStack = current % limit === 0 ? 0 : limit - (current % limit);
    return roomInOpenStack + Math.max(0, freeSlots) * limit;
  };

  // A full bag shouldn't spam a toast on every swing of a pickaxe.
  let lastFullWarnAt = 0;

  // Losing experience can cost you levels. The only floor is zero — fall far enough
  // and the skill genuinely regresses, which is the point of a penalty.
  // Returns { lost, levelBefore, levelAfter } so callers can report it.
  window.Minerous.loseXp = function loseXp(skillId, amount) {
    const levelBefore = window.Minerous.getLevel(skillId);
    const current = state.skillXp[skillId] || 0;
    const lost = Math.max(0, Math.min(current, amount));
    state.skillXp[skillId] = current - lost;
    const levelAfter = window.Minerous.getLevel(skillId);

    if (levelAfter < levelBefore) {
      const skill = window.Minerous.SKILLS.find((s) => s.id === skillId);
      const name = skill ? skill.name : skillId;
      window.Minerous.showToast(`⬇ Level lost! ${name} is now level ${levelAfter}`);
      // A blessing you can no longer afford shouldn't keep draining.
      if (window.Minerous.Prayer) window.Minerous.Prayer.dropLockedBuffs();
    }
    return { lost, levelBefore, levelAfter };
  };

  // Returns false when the bag had no room, so callers that care (gathering skills)
  // can stop rather than silently dropping the haul.
  window.Minerous.addItem = function addItem(id, qty) {
    if (!window.Minerous.canCarry(id, qty)) {
      const now = Date.now();
      if (now - lastFullWarnAt > 4000) {
        lastFullWarnAt = now;
        const item = window.Minerous.getItem(id);
        window.Minerous.showToast(`Inventory full — no room for ${item ? item.name : id}. Visit a bank.`);
      }
      return false;
    }
    state.inventory[id] = (state.inventory[id] || 0) + qty;
    return true;
  };

  window.Minerous.hasItems = function hasItems(inputs) {
    return Object.entries(inputs).every(([id, qty]) => (state.inventory[id] || 0) >= qty);
  };

  window.Minerous.spendItems = function spendItems(inputs) {
    Object.entries(inputs).forEach(([id, qty]) => {
      state.inventory[id] -= qty;
      // Zeroed stacks must actually disappear, or they'd hold a slot hostage.
      if (state.inventory[id] <= 0) delete state.inventory[id];
    });
  };

  window.Minerous.getArmorDefense = function getArmorDefense() {
    return Object.values(state.equippedArmor).reduce((sum, id) => {
      if (!id) return sum;
      const item = window.Minerous.getItem(id);
      return sum + (item && item.defense ? item.defense : 0);
    }, 0);
  };

  window.Minerous.getWeaponSocketEffects = function getWeaponSocketEffects() {
    const stone = state.weaponSocket ? window.Minerous.getItem(state.weaponSocket) : null;
    const effect = (stone && stone.effect) || {};
    return { hasteMs: effect.hasteMs || 0, damageBonus: effect.damageBonus || 0, accuracyBonus: effect.accuracyBonus || 0 };
  };

  window.Minerous.getArmorSocketEffects = function getArmorSocketEffects() {
    const stone = state.armorSocket ? window.Minerous.getItem(state.armorSocket) : null;
    const effect = (stone && stone.effect) || {};
    return {
      defenseBonus: effect.defenseBonus || 0,
      hpBonus: effect.hpBonus || 0,
      deflectChance: effect.deflectChance || 0,
      deflectPercent: effect.deflectPercent || 0,
    };
  };
})();
