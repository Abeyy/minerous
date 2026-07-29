window.Minerous = window.Minerous || {};

(function () {
  const { FAMILIARS, state, getLevel, addXp, hasItems, spendItems, getItem } = window.Minerous;

  let activeActionId = null; // familiar id currently being summoned (ritual in progress)
  let actionStart = 0;

  const el = {
    actionLabel: document.getElementById('summoning-action-label'),
    progressFill: document.getElementById('summoning-progress-fill'),
    familiarList: document.getElementById('summoning-familiar-list'),
    familiarStatus: document.getElementById('summoning-familiar-status'),
    character: document.getElementById('summoning-character'),
    circle: document.getElementById('summoning-circle'),
  };

  function getFamiliar(id) {
    return FAMILIARS.find((f) => f.id === id);
  }

  function isUnlocked(familiar) {
    return getLevel('summoning') >= familiar.level;
  }

  function inputsLabel(familiar) {
    return Object.entries(familiar.inputs)
      .map(([id, qty]) => `${qty}x ${getItem(id).name}`)
      .join(' + ');
  }

  function renderFamiliarStatus() {
    const familiar = state.summoning.activeFamiliarId ? getFamiliar(state.summoning.activeFamiliarId) : null;
    el.familiarStatus.textContent = familiar ? `Active Familiar: ${familiar.name}` : 'Active Familiar: None';
  }

  function renderFamiliarList() {
    el.familiarList.innerHTML = '';
    // A bound spirit follows you between areas, so keep an active familiar on the list
    // even where it couldn't be summoned — otherwise there's no way to dismiss it.
    const areaFamiliars = FAMILIARS.filter(
      (f) =>
        f.id === state.summoning.activeFamiliarId ||
        window.Minerous.filterByArea('summoning', FAMILIARS).includes(f)
    );
    for (const familiar of areaFamiliars) {
      const unlocked = isUnlocked(familiar);
      const summoned = state.summoning.activeFamiliarId === familiar.id;
      const summoning = activeActionId === familiar.id;
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (summoned || summoning ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="node-swatch" style="background:${familiar.color}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${familiar.name}${summoned ? ' · ACTIVE' : ''}</div>
          <div class="node-card-meta">${unlocked ? `${familiar.description}` : `Requires level ${familiar.level}`}</div>
          ${unlocked ? `<div class="node-card-meta">${inputsLabel(familiar)} · ${familiar.xp} xp</div>` : ''}
        </span>
      `;
      btn.addEventListener('click', () => onFamiliarClick(familiar));
      el.familiarList.appendChild(btn);
    }

    if (areaFamiliars.length < FAMILIARS.length) {
      const note = document.createElement('div');
      note.className = 'node-list-note';
      note.textContent = 'This circle is a modest one. Binding the greater spirits takes a circle raised in the towns.';
      el.familiarList.appendChild(note);
    }
  }

  function onFamiliarClick(familiar) {
    if (!isUnlocked(familiar)) {
      window.Minerous.showToast(`Requires Summoning level ${familiar.level}`);
      return;
    }
    if (state.summoning.activeFamiliarId === familiar.id) {
      state.summoning.activeFamiliarId = null;
      window.Minerous.showToast(`${familiar.name} dismissed`);
      renderFamiliarList();
      renderFamiliarStatus();
      return;
    }
    if (activeActionId === familiar.id) {
      stopSummoning();
      renderFamiliarList();
      return;
    }
    // Dismissing works anywhere, but binding a new spirit needs a circle that can hold it.
    if (!window.Minerous.filterByArea('summoning', FAMILIARS).includes(familiar)) {
      window.Minerous.showToast(`${familiar.name} can only be summoned in a town`);
      return;
    }
    if (!hasItems(familiar.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(familiar)}`);
      return;
    }
    startSummoning(familiar.id);
    renderFamiliarList();
  }

  function startSummoning(familiarId) {
    activeActionId = familiarId;
    actionStart = performance.now();
    el.character.classList.add('summoning');
    el.actionLabel.textContent = `Summoning ${getFamiliar(familiarId).name}...`;
  }

  function stopSummoning() {
    activeActionId = null;
    el.character.classList.remove('summoning');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select a familiar to summon';
  }

  function awardResult(familiar) {
    spendItems(familiar.inputs);
    const leveledUp = addXp('summoning', familiar.xp);
    state.summoning.activeFamiliarId = familiar.id;

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('summoning', 'summoning');
    renderFamiliarList();
    renderFamiliarStatus();

    window.Minerous.showToast(`${familiar.name} summoned!`, { levelUp: true });
    if (leveledUp) {
      window.Minerous.showToast(`Level up! Summoning level ${getLevel('summoning')}`, { levelUp: true });
    }

    el.circle.classList.remove('hit');
    void el.circle.offsetWidth;
    el.circle.classList.add('hit');

    stopSummoning();
  }

  window.Minerous.Summoning = {
    refresh() {
      renderFamiliarList();
      renderFamiliarStatus();
      window.Minerous.renderSkillLevelRow('summoning', 'summoning');
      if (!activeActionId) {
        el.actionLabel.textContent = 'Select a familiar to summon';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopSummoning();
    },
    getActiveFamiliar() {
      return state.summoning.activeFamiliarId ? getFamiliar(state.summoning.activeFamiliarId) : null;
    },
    tick() {
      if (!activeActionId) return;
      const familiar = getFamiliar(activeActionId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / familiar.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed >= familiar.timeMs) {
        if (!hasItems(familiar.inputs)) {
          window.Minerous.showToast(`Out of materials for ${familiar.name}`);
          stopSummoning();
          renderFamiliarList();
          return;
        }
        awardResult(familiar);
      }
    },
  };
})();
