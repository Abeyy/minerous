window.Minerous = window.Minerous || {};

(function () {
  const {
    PRAYER_RECIPES,
    PRAYER_RECHARGE,
    PRAYER_WORSHIP,
    PRAYER_BUFFS,
    CLERIC_SPELLS,
    CLERIC_GEAR,
    state,
    getLevel,
    addXp,
    addItem,
    hasItems,
    spendItems,
    getItem,
    getMaxPrayerPoints,
  } = window.Minerous;

  let activeActionId = null;
  let actionStart = 0;
  let lastBuffTickAt = null;

  const el = {
    actionLabel: document.getElementById('prayer-action-label'),
    progressFill: document.getElementById('prayer-progress-fill'),
    offeringList: document.getElementById('prayer-offering-list'),
    communeList: document.getElementById('prayer-commune-list'),
    worshipList: document.getElementById('prayer-worship-list'),
    spellList: document.getElementById('prayer-spell-list'),
    gearList: document.getElementById('prayer-gear-list'),
    character: document.getElementById('prayer-character'),
    shrine: document.getElementById('prayer-shrine'),
    buffList: document.getElementById('prayer-buff-list'),
    pointsLabel: document.getElementById('prayer-points-label'),
    pointsFill: document.getElementById('prayer-points-fill'),
  };

  function getRecipe(id) {
    return PRAYER_RECIPES.find((r) => r.id === id);
  }

  function getGear(id) {
    return CLERIC_GEAR.find((g) => g.id === id);
  }

  function getAction(id) {
    if (id === PRAYER_RECHARGE.id) return PRAYER_RECHARGE;
    if (id === PRAYER_WORSHIP.id) return PRAYER_WORSHIP;
    return getGear(id) || getRecipe(id);
  }

  function getBuff(id) {
    return PRAYER_BUFFS.find((b) => b.id === id);
  }

  function isRecipeUnlocked(recipe) {
    return getLevel('prayer') >= recipe.level;
  }

  function isBuffUnlocked(buff) {
    return getLevel('prayer') >= buff.level;
  }

  function ensurePoints() {
    if (state.prayer.points === null) state.prayer.points = getMaxPrayerPoints();
  }

  function inputsLabel(recipe) {
    return Object.entries(recipe.inputs)
      .map(([id, qty]) => `${qty}x ${getItem(id).name}`)
      .join(' + ');
  }

  function renderPointsBar() {
    ensurePoints();
    const max = getMaxPrayerPoints();
    el.pointsLabel.textContent = `${Math.ceil(state.prayer.points)} / ${max}`;
    el.pointsFill.style.width = `${Math.max(0, Math.min(100, (state.prayer.points / max) * 100))}%`;
  }

  function renderBuffList() {
    ensurePoints();
    el.buffList.innerHTML = '';
    for (const buff of PRAYER_BUFFS) {
      const unlocked = isBuffUnlocked(buff);
      const active = state.prayer.activeBuffs[buff.group] === buff.id;
      const btn = document.createElement('button');
      btn.className = 'node-card buff-card' + (unlocked ? '' : ' locked') + (active ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="node-swatch" style="background:${unlocked ? '#c9a6e0' : '#4a4f5a'}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${buff.name}${active ? ' · ON' : ''}</div>
          <div class="node-card-meta">${unlocked ? `${buff.description} · ${buff.drainPerSec}/s` : `Requires level ${buff.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onBuffClick(buff));
      el.buffList.appendChild(btn);
    }
  }

  function onBuffClick(buff) {
    if (!isBuffUnlocked(buff)) {
      window.Minerous.showToast(`Requires Prayer level ${buff.level}`);
      return;
    }
    ensurePoints();
    if (state.prayer.activeBuffs[buff.group] === buff.id) {
      state.prayer.activeBuffs[buff.group] = null;
    } else {
      if (state.prayer.points <= 0) {
        window.Minerous.showToast('No prayer points left — commune at the shrine to recharge');
        return;
      }
      state.prayer.activeBuffs[buff.group] = buff.id;
    }
    renderBuffList();
  }

  function renderOfferingList() {
    el.offeringList.innerHTML = '';
    for (const recipe of PRAYER_RECIPES) {
      const unlocked = isRecipeUnlocked(recipe);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeActionId === recipe.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(recipe.id, recipe.color)}
        <span class="node-card-text">
          <div class="node-card-name">${recipe.name}</div>
          <div class="node-card-meta">${unlocked ? `${inputsLabel(recipe)} · ${recipe.xp} xp` : `Requires level ${recipe.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onRecipeClick(recipe));
      el.offeringList.appendChild(btn);
    }
  }

  function renderCommuneList() {
    ensurePoints();
    el.communeList.innerHTML = '';
    const full = state.prayer.points >= getMaxPrayerPoints();
    const btn = document.createElement('button');
    btn.className = 'node-card' + (activeActionId === PRAYER_RECHARGE.id ? ' active' : '');
    btn.innerHTML = `
      <span class="node-swatch" style="background:${PRAYER_RECHARGE.color}"></span>
      <span class="node-card-text">
        <div class="node-card-name">${PRAYER_RECHARGE.name}</div>
        <div class="node-card-meta">${full ? 'Prayer points already full' : 'Restores all prayer points'}</div>
      </span>
    `;
    btn.addEventListener('click', onCommuneClick);
    el.communeList.appendChild(btn);
  }

  function renderWorshipList() {
    el.worshipList.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'node-card' + (activeActionId === PRAYER_WORSHIP.id ? ' active' : '');
    btn.innerHTML = `
      <span class="node-swatch" style="background:${PRAYER_WORSHIP.color}"></span>
      <span class="node-card-text">
        <div class="node-card-name">${PRAYER_WORSHIP.name}</div>
        <div class="node-card-meta">Free, but slow — ${PRAYER_WORSHIP.xp} xp per cycle. Raising Prayer this way unlocks stronger blessings.</div>
      </span>
    `;
    btn.addEventListener('click', onWorshipClick);
    el.worshipList.appendChild(btn);
  }

  // Purely informational — spells unlock automatically as the Cleric skill rises, with no
  // separate "learn" action, so these cards aren't clickable. Cleric is trained by
  // fighting with a prayer book equipped, not by worshipping here.
  function renderSpellList() {
    el.spellList.innerHTML = '';
    const areaSpells = window.Minerous.filterByArea('cleric_spells', CLERIC_SPELLS);
    for (const spell of areaSpells) {
      const unlocked = getLevel('cleric') >= spell.level;
      const card = document.createElement('div');
      card.className = 'node-card no-hover' + (unlocked ? ' met' : ' locked');
      card.innerHTML = `
        <span class="node-swatch" style="background:${unlocked ? '#c9a6e0' : '#4a4f5a'}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${spell.name}${unlocked ? ' · KNOWN' : ''}</div>
          <div class="node-card-meta">${unlocked ? `${spell.description} · ${spell.pointCost} prayer pts/cast` : `Requires Cleric level ${spell.level}`}</div>
          ${unlocked ? '' : '<div class="node-card-meta spell-progress">✨ Raise Cleric by fighting with a prayer book equipped</div>'}
        </span>
      `;
      el.spellList.appendChild(card);
    }

    if (areaSpells.length < CLERIC_SPELLS.length) {
      const note = document.createElement('div');
      note.className = 'node-list-note';
      note.textContent = 'This shrine keeps only the simpler rites. The higher mysteries are taught at temples in the towns.';
      el.spellList.appendChild(note);
    }
  }

  function renderGearList() {
    el.gearList.innerHTML = '';
    for (const gear of CLERIC_GEAR) {
      const unlocked = getLevel('prayer') >= gear.level;
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeActionId === gear.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(gear.id)}
        <span class="node-card-text">
          <div class="node-card-name">${gear.name}</div>
          <div class="node-card-meta">${unlocked ? `${inputsLabel(gear)} · ${gear.xp} xp · +${gear.damage} dmg` : `Requires level ${gear.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onGearClick(gear));
      el.gearList.appendChild(btn);
    }
  }

  function refreshShrineLists() {
    renderOfferingList();
    renderCommuneList();
    renderWorshipList();
    renderGearList();
  }

  function onRecipeClick(recipe) {
    if (!isRecipeUnlocked(recipe)) {
      window.Minerous.showToast(`Requires Prayer level ${recipe.level}`);
      return;
    }
    if (activeActionId === recipe.id) {
      stopPraying();
      refreshShrineLists();
      return;
    }
    if (!hasItems(recipe.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(recipe)}`);
      return;
    }
    startAction(recipe.id);
    refreshShrineLists();
  }

  function onCommuneClick() {
    if (activeActionId === PRAYER_RECHARGE.id) {
      stopPraying();
      refreshShrineLists();
      return;
    }
    ensurePoints();
    if (state.prayer.points >= getMaxPrayerPoints()) {
      window.Minerous.showToast('Prayer points are already full');
      return;
    }
    startAction(PRAYER_RECHARGE.id);
    refreshShrineLists();
  }

  function onWorshipClick() {
    if (activeActionId === PRAYER_WORSHIP.id) {
      stopPraying();
      refreshShrineLists();
      return;
    }
    startAction(PRAYER_WORSHIP.id);
    refreshShrineLists();
  }

  function onGearClick(gear) {
    if (getLevel('prayer') < gear.level) {
      window.Minerous.showToast(`Requires Prayer level ${gear.level}`);
      return;
    }
    if (activeActionId === gear.id) {
      stopPraying();
      refreshShrineLists();
      return;
    }
    if (!hasItems(gear.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(gear)}`);
      return;
    }
    startAction(gear.id);
    refreshShrineLists();
  }

  function startAction(actionId) {
    activeActionId = actionId;
    actionStart = performance.now();
    el.character.classList.add('praying');
    if (actionId === PRAYER_RECHARGE.id) {
      el.actionLabel.textContent = 'Communing with the shrine...';
    } else if (actionId === PRAYER_WORSHIP.id) {
      el.actionLabel.textContent = 'Worshipping at the shrine...';
    } else if (getGear(actionId)) {
      el.actionLabel.textContent = `Binding a ${getAction(actionId).name}...`;
    } else {
      el.actionLabel.textContent = `Praying with ${getAction(actionId).name}...`;
    }
  }

  function stopPraying() {
    activeActionId = null;
    el.character.classList.remove('praying');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select an action at the shrine';
  }

  function awardOffering(recipe) {
    spendItems(recipe.inputs);
    const leveledUp = addXp('prayer', recipe.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('prayer', 'prayer');
    // Re-rendered on every xp gain, not just level-ups, so the "worships remaining"
    // countdown on each locked spell ticks down as you go.
    renderSpellList();

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Prayer level ${getLevel('prayer')}`, { levelUp: true });
    }

    flashShrine();
  }

  function awardWorship() {
    const leveledUp = addXp('prayer', PRAYER_WORSHIP.xp);
    state.actions.worship = (state.actions.worship || 0) + 1;

    window.Minerous.renderSkillLevelRow('prayer', 'prayer');
    renderSpellList();

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Prayer level ${getLevel('prayer')}`, { levelUp: true });
    }

    flashShrine();
  }

  function awardGear(gear) {
    spendItems(gear.inputs);
    addItem(gear.id, 1);
    const leveledUp = addXp('prayer', gear.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('prayer', 'prayer');
    renderSpellList();

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Prayer level ${getLevel('prayer')}`, { levelUp: true });
    }

    flashShrine();
  }

  function awardCommune() {
    state.prayer.points = getMaxPrayerPoints();
    renderPointsBar();
    window.Minerous.showToast('Prayer points fully recharged!', { levelUp: true });
    flashShrine();
    stopPraying();
    refreshShrineLists();
  }

  function flashShrine() {
    el.shrine.classList.remove('hit');
    void el.shrine.offsetWidth;
    el.shrine.classList.add('hit');
  }

  window.Minerous.Prayer = {
    refresh() {
      refreshShrineLists();
      renderSpellList();
      renderBuffList();
      renderPointsBar();
      window.Minerous.renderSkillLevelRow('prayer', 'prayer');
      if (!activeActionId) {
        el.actionLabel.textContent = 'Select an action at the shrine';
        el.progressFill.style.width = '0%';
      }
    },
    renderPanel() {
      renderBuffList();
      renderPointsBar();
    },
    // Called after a level is lost: a blessing you no longer qualify for switches off
    // rather than continuing to drain points and apply effects you haven't earned.
    dropLockedBuffs() {
      let dropped = false;
      for (const group of Object.keys(state.prayer.activeBuffs)) {
        const id = state.prayer.activeBuffs[group];
        if (!id) continue;
        const buff = getBuff(id);
        if (buff && !isBuffUnlocked(buff)) {
          state.prayer.activeBuffs[group] = null;
          window.Minerous.showToast(`${buff.name} switched off — your Prayer level no longer supports it`);
          dropped = true;
        }
      }
      if (dropped) renderBuffList();
    },
    stop() {
      stopPraying();
    },
    getActiveBuffNames() {
      return ['offense', 'defense']
        .map((groupKey) => state.prayer.activeBuffs[groupKey] && getBuff(state.prayer.activeBuffs[groupKey]))
        .filter(Boolean)
        .map((buff) => buff.name);
    },
    // Blessings drain points every second regardless of screen, so combat.js switches
    // them off on the way out — no silently bleeding prayer points while you mine.
    // Returns the names that were switched off, so the caller can report them.
    deactivateBuffs() {
      const names = window.Minerous.Prayer.getActiveBuffNames();
      if (names.length === 0) return names;
      state.prayer.activeBuffs.offense = null;
      state.prayer.activeBuffs.defense = null;
      renderBuffList();
      return names;
    },
    getActiveBuffEffects() {
      const effects = { damageBonus: 0, evasionBonus: 0 };
      for (const groupKey of ['offense', 'defense']) {
        const buff = state.prayer.activeBuffs[groupKey] && getBuff(state.prayer.activeBuffs[groupKey]);
        if (!buff) continue;
        effects.damageBonus += buff.damageBonus || 0;
        effects.evasionBonus += buff.evasionBonus || 0;
      }
      return effects;
    },
    tick() {
      if (!activeActionId) return;
      const action = getAction(activeActionId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / action.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed < action.timeMs) return;

      if (action.id === PRAYER_RECHARGE.id) {
        awardCommune();
        return;
      }

      if (action.id === PRAYER_WORSHIP.id) {
        awardWorship();
        actionStart = performance.now();
        return;
      }

      if (!hasItems(action.inputs)) {
        window.Minerous.showToast(`Out of materials for ${action.name}`);
        stopPraying();
        refreshShrineLists();
        return;
      }

      if (getGear(action.id)) {
        awardGear(action);
      } else {
        awardOffering(action);
      }
      actionStart = performance.now();
    },
    // Drains active buffs in real time regardless of which screen is showing.
    buffTick() {
      const now = performance.now();
      if (lastBuffTickAt === null) {
        lastBuffTickAt = now;
        return;
      }
      const dtSec = (now - lastBuffTickAt) / 1000;
      lastBuffTickAt = now;

      const activeIds = [state.prayer.activeBuffs.offense, state.prayer.activeBuffs.defense].filter(Boolean);
      if (activeIds.length === 0) return;

      ensurePoints();
      const familiar = window.Minerous.Summoning.getActiveFamiliar();
      const familiarMultiplier = familiar && familiar.prayerDrainMultiplier ? familiar.prayerDrainMultiplier : 1;
      const featMultiplier = 1 - window.Minerous.Feats.getEffects().prayerDrainReduction;
      const drainMultiplier = familiarMultiplier * Math.max(0, featMultiplier);
      const drainPerSec = activeIds.reduce((sum, id) => sum + getBuff(id).drainPerSec, 0) * drainMultiplier;
      state.prayer.points = Math.max(0, state.prayer.points - drainPerSec * dtSec);
      renderPointsBar();

      if (state.prayer.points <= 0) {
        state.prayer.activeBuffs.offense = null;
        state.prayer.activeBuffs.defense = null;
        window.Minerous.showToast('Out of prayer points — blessings deactivated');
        renderBuffList();
      }
    },
  };
})();
