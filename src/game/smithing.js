window.Minerous = window.Minerous || {};

(function () {
  const { SMITHING_RECIPES, state, getLevel, addXp, addItem, hasItems, spendItems, getItem } = window.Minerous;

  let activeRecipeId = null;
  let actionStart = 0;

  const el = {
    level: document.getElementById('smithing-level'),
    xpFill: document.getElementById('smithing-xp-fill'),
    xpLabel: document.getElementById('smithing-xp-label'),
    actionLabel: document.getElementById('smithing-action-label'),
    progressFill: document.getElementById('smithing-progress-fill'),
    barList: document.getElementById('smithing-bar-list'),
    weaponList: document.getElementById('smithing-weapon-list'),
    armorList: document.getElementById('smithing-armor-list'),
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
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Smithing ${getRecipe(recipeId).name}...`;
  }

  function stopSmithing() {
    activeRecipeId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select a recipe to start smithing';
  }

  function awardResult(recipe) {
    // Guard before spending: a full pack must never eat the inputs and drop the
    // finished item on the floor.
    if (!window.Minerous.canCarry(recipe.id)) {
      stopSmithing();
      window.Minerous.showToast(`Inventory full — no room for ${recipe.name}. Visit a bank.`);
      return;
    }
    spendItems(recipe.inputs);
    addItem(recipe.id, 1);
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
      }
    },
  };
})();
