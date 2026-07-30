window.Minerous = window.Minerous || {};

(function () {
  const { SMITHING_RECIPES, state, getLevel, addXp, addItem, hasItems, spendItems, getItem } = window.Minerous;

  let activeRecipeId = null;
  let actionStart = 0;
  // How many of the current recipe are still to be made. Infinity = until the
  // materials run out, which is what 'All' means.
  let batchRemaining = Infinity;

  const el = {
    level: document.getElementById('smithing-level'),
    xpFill: document.getElementById('smithing-xp-fill'),
    xpLabel: document.getElementById('smithing-xp-label'),
    batch: document.getElementById('smithing-batch'),
    actionLabel: document.getElementById('smithing-action-label'),
    progressFill: document.getElementById('smithing-progress-fill'),
    barList: document.getElementById('smithing-bar-list'),
    weaponList: document.getElementById('smithing-weapon-list'),
    armorList: document.getElementById('smithing-armor-list'),
    ammoList: document.getElementById('smithing-ammo-list'),
    arm: document.getElementById('smithing-character-arm'),
    anvil: document.getElementById('smithing-anvil'),
  };

  function getRecipe(id) {
    return SMITHING_RECIPES.find((r) => r.id === id);
  }

  function isUnlocked(recipe) {
    return getLevel('smithing') >= recipe.level;
  }

  function inputsLabel(recipe) {
    return Object.entries(recipe.inputs)
      .map(([id, qty]) => `${qty}x ${getItem(id).name}`)
      .join(' + ');
  }

  function statLabel(recipe) {
    if (recipe.category === 'weapon') return ` · +${recipe.damage} dmg`;
    if (recipe.category === 'armor') return ` · +${recipe.defense} def`;
    if (recipe.category === 'ammo') return ` · makes ${recipe.qty}`;
    return '';
  }

  function renderList(container, category) {
    container.innerHTML = '';
    for (const recipe of SMITHING_RECIPES.filter((r) => r.category === category)) {
      const unlocked = isUnlocked(recipe);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeRecipeId === recipe.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(recipe.id)}
        <span class="node-card-text">
          <div class="node-card-name">${recipe.name}</div>
          <div class="node-card-meta">${unlocked ? `${inputsLabel(recipe)} · ${recipe.xp} xp${statLabel(recipe)}` : `Requires level ${recipe.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onRecipeClick(recipe));
      container.appendChild(btn);
    }
  }

  function renderLists() {
    renderList(el.barList, 'bar');
    renderList(el.weaponList, 'weapon');
    renderList(el.armorList, 'armor');
    renderList(el.ammoList, 'ammo');
  }

  function onRecipeClick(recipe) {
    if (!isUnlocked(recipe)) {
      window.Minerous.showToast(`Requires Smithing level ${recipe.level}`);
      return;
    }
    if (activeRecipeId === recipe.id) {
      stopSmithing();
      renderLists();
      return;
    }
    if (!hasItems(recipe.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(recipe)}`);
      return;
    }
    startSmithing(recipe.id);
    renderLists();
  }

  function startSmithing(recipeId) {
    activeRecipeId = recipeId;
    batchRemaining = window.Minerous.Batch.count('smithing');
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Smithing ${getRecipe(recipeId).name}...${window.Minerous.Batch.remainingSuffix(batchRemaining)}`;
  }

  function stopSmithing() {
    activeRecipeId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select a recipe to start smithing';
  }

  function awardResult(recipe) {
    // Ammunition is cast in batches, like the fletcher's arrows; everything else is one
    // item per run.
    const made = recipe.qty || 1;

    // Guard before spending: a full pack must never eat the inputs and drop the
    // finished item on the floor.
    if (!window.Minerous.canCarry(recipe.id, made)) {
      stopSmithing();
      window.Minerous.showToast(`Inventory full — no room for ${recipe.name}. Visit a bank.`);
      return;
    }
    spendItems(recipe.inputs);
    addItem(recipe.id, made);
    const leveledUp = addXp('smithing', recipe.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('smithing', 'smithing');

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Smithing level ${getLevel('smithing')}`, { levelUp: true });
    }

    el.anvil.classList.remove('hit');
    void el.anvil.offsetWidth;
    el.anvil.classList.add('hit');
  }

  window.Minerous.Smithing = {
    refresh() {
      // Changing the size mid-run retargets the current run rather than cancelling it.
      window.Minerous.Batch.render(el.batch, 'smithing', () => {
        if (activeRecipeId) batchRemaining = window.Minerous.Batch.count('smithing');
      });
      renderLists();
      window.Minerous.renderSkillLevelRow('smithing', 'smithing');
      if (!activeRecipeId) {
        el.actionLabel.textContent = 'Select a recipe to start smithing';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopSmithing();
    },
    tick() {
      if (!activeRecipeId) return;
      const recipe = getRecipe(activeRecipeId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / recipe.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed >= recipe.timeMs) {
        if (!hasItems(recipe.inputs)) {
          window.Minerous.showToast(`Out of materials for ${recipe.name}`);
          stopSmithing();
          renderLists();
          return;
        }
        awardResult(recipe);
        actionStart = performance.now();

        // A bounded run stops itself once it's made what was asked for, so a click
        // never quietly consumes the whole stockpile.
        batchRemaining -= 1;
        if (batchRemaining <= 0) {
          stopSmithing();
          renderLists();
          window.Minerous.showToast(`Finished ${recipe.name} ×${window.Minerous.Batch.count('smithing')}`);
          return;
        }
        el.actionLabel.textContent =
          `Smithing ${recipe.name}...${window.Minerous.Batch.remainingSuffix(batchRemaining)}`;
      }
    },
  };
})();
