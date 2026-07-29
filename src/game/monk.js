window.Minerous = window.Minerous || {};

(function () {
  const {
    MONK_MEDITATION,
    MONK_TECHNIQUES,
    MONK_GEAR,
    state,
    getLevel,
    addXp,
    addItem,
    hasItems,
    spendItems,
    getItem,
    getClothingXpBonus,
    xpForLevel,
  } = window.Minerous;

  let activeActionId = null;
  let actionStart = 0;

  const el = {
    actionLabel: document.getElementById('monk-action-label'),
    progressFill: document.getElementById('monk-progress-fill'),
    meditationList: document.getElementById('monk-meditation-list'),
    techniqueList: document.getElementById('monk-technique-list'),
    gearList: document.getElementById('monk-gear-list'),
    character: document.getElementById('monk-character'),
    gong: document.getElementById('monk-gong'),
  };

  function getGear(id) {
    return MONK_GEAR.find((g) => g.id === id);
  }

  function getAction(id) {
    if (id === MONK_MEDITATION.id) return MONK_MEDITATION;
    return getGear(id);
  }

  function inputsLabel(recipe) {
    return Object.entries(recipe.inputs)
      .map(([id, qty]) => `${qty}x ${getItem(id).name}`)
      .join(' + ');
  }

  // How many more Meditate cycles it'd take to reach a given Monk level from here,
  // accounting for any equipped clothing's Monk xp bonus.
  function meditationsToLevel(level) {
    const remainingXp = xpForLevel(level) - (state.skillXp.monk || 0);
    if (remainingXp <= 0) return 0;
    const xpPer = Math.round(MONK_MEDITATION.xp * (1 + getClothingXpBonus('monk')));
    return Math.ceil(remainingXp / Math.max(1, xpPer));
  }

  function renderMeditationList() {
    el.meditationList.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'node-card' + (activeActionId === MONK_MEDITATION.id ? ' active' : '');
    btn.innerHTML = `
      <span class="node-swatch" style="background:${MONK_MEDITATION.color}"></span>
      <span class="node-card-text">
        <div class="node-card-name">${MONK_MEDITATION.name}</div>
        <div class="node-card-meta">Free, but slow — ${MONK_MEDITATION.xp} xp per cycle. Raising Monk this way unlocks the techniques below.</div>
      </span>
    `;
    btn.addEventListener('click', onMeditateClick);
    el.meditationList.appendChild(btn);
  }

  // Read-only: techniques unlock automatically once BOTH requirements are met, so
  // there's nothing to click — but each unmet half is called out separately.
  function renderTechniqueList() {
    el.techniqueList.innerHTML = '';
    const monkLevel = getLevel('monk');
    const combatLevel = getLevel('combat');
    for (const tech of MONK_TECHNIQUES) {
      const monkOk = monkLevel >= tech.level;
      const combatOk = combatLevel >= tech.combatLevel;
      const unlocked = monkOk && combatOk;

      let requirement;
      if (unlocked) {
        requirement = `${tech.description} · +${tech.damageBonus} damage`;
      } else {
        const parts = [];
        if (!monkOk) parts.push(`Monk ${tech.level} (you have ${monkLevel})`);
        if (!combatOk) parts.push(`Combat ${tech.combatLevel} (you have ${combatLevel})`);
        requirement = `🔒 Requires ${parts.join(' + ')}`;
      }

      const card = document.createElement('div');
      card.className = 'node-card no-hover' + (unlocked ? ' met' : ' locked');
      card.innerHTML = `
        <span class="node-swatch" style="background:${unlocked ? '#d99a5b' : '#4a4f5a'}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${tech.name}${unlocked ? ' · KNOWN' : ''}</div>
          <div class="node-card-meta">${requirement}</div>
          ${monkOk ? '' : `<div class="node-card-meta technique-progress">🧘 ~${meditationsToLevel(tech.level)} more meditations to unlock</div>`}
        </span>
      `;
      el.techniqueList.appendChild(card);
    }
  }

  function renderGearList() {
    el.gearList.innerHTML = '';
    for (const gear of MONK_GEAR) {
      const unlocked = getLevel('monk') >= gear.level;
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

  function refreshLists() {
    renderMeditationList();
    renderTechniqueList();
    renderGearList();
  }

  function onMeditateClick() {
    if (activeActionId === MONK_MEDITATION.id) {
      stopAction();
    } else {
      startAction(MONK_MEDITATION.id);
    }
    refreshLists();
  }

  function onGearClick(gear) {
    if (getLevel('monk') < gear.level) {
      window.Minerous.showToast(`Requires Monk level ${gear.level}`);
      return;
    }
    if (activeActionId === gear.id) {
      stopAction();
      refreshLists();
      return;
    }
    if (!hasItems(gear.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(gear)}`);
      return;
    }
    startAction(gear.id);
    refreshLists();
  }

  function startAction(actionId) {
    activeActionId = actionId;
    actionStart = performance.now();
    el.character.classList.add('meditating');
    el.actionLabel.textContent =
      actionId === MONK_MEDITATION.id ? 'Meditating...' : `Forging ${getAction(actionId).name}...`;
  }

  function stopAction() {
    activeActionId = null;
    el.character.classList.remove('meditating');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select an action at the monastery';
  }

  function flashGong() {
    el.gong.classList.remove('hit');
    void el.gong.offsetWidth;
    el.gong.classList.add('hit');
  }

  function awardMeditation() {
    const leveledUp = addXp('monk', MONK_MEDITATION.xp);

    window.Minerous.renderSkillLevelRow('monk', 'monk');
    // Re-rendered every cycle so the "meditations remaining" countdown ticks down.
    renderTechniqueList();

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Monk level ${getLevel('monk')}`, { levelUp: true });
      renderGearList();
    }

    flashGong();
  }

  function awardGear(gear) {
    spendItems(gear.inputs);
    addItem(gear.id, 1);
    const leveledUp = addXp('monk', gear.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('monk', 'monk');
    renderTechniqueList();

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Monk level ${getLevel('monk')}`, { levelUp: true });
    }

    flashGong();
  }

  window.Minerous.Monk = {
    refresh() {
      refreshLists();
      window.Minerous.renderSkillLevelRow('monk', 'monk');
      if (!activeActionId) {
        el.actionLabel.textContent = 'Select an action at the monastery';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopAction();
    },
    tick() {
      if (!activeActionId) return;
      const action = getAction(activeActionId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / action.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed < action.timeMs) return;

      if (action.id === MONK_MEDITATION.id) {
        awardMeditation();
        actionStart = performance.now();
        return;
      }

      if (!hasItems(action.inputs)) {
        window.Minerous.showToast(`Out of materials for ${action.name}`);
        stopAction();
        refreshLists();
        return;
      }
      awardGear(action);
      actionStart = performance.now();
    },
  };
})();
