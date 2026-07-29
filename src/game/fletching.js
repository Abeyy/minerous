window.Minerous = window.Minerous || {};

(function () {
  const { FLETCHING_RECIPES, state, getLevel, addXp, addItem, hasItems, spendItems, getItem } = window.Minerous;

  let activeRecipeId = null;
  let actionStart = 0;

  const el = {
    level: document.getElementById('fletching-level'),
    xpFill: document.getElementById('fletching-xp-fill'),
    xpLabel: document.getElementById('fletching-xp-label'),
    actionLabel: document.getElementById('fletching-action-label'),
    progressFill: document.getElementById('fletching-progress-fill'),
    arrowList: document.getElementById('fletching-arrow-list'),
    bowList: document.getElementById('fletching-bow-list'),
    arm: document.getElementById('fletching-character-arm'),
    workbench: document.getElementById('fletching-workbench'),
  };

  function getRecipe(id) {
    return FLETCHING_RECIPES.find((r) => r.id === id);
  }

  function isUnlocked(recipe) {
    return getLevel('fletching') >= recipe.level;
  }

  function inputsLabel(recipe) {
    return Object.entries(recipe.inputs)
      .map(([id, qty]) => `${qty}x ${getItem(id).name}`)
      .join(' + ');
  }

  function statLabel(recipe) {
    if (recipe.category === 'weapon') return ` · +${recipe.damage} dmg`;
    if (recipe.category === 'ammo') return ` · makes ${recipe.qty}`;
    return '';
  }

  function renderList(container, category) {
    container.innerHTML = '';
    for (const recipe of FLETCHING_RECIPES.filter((r) => r.category === category)) {
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
    renderList(el.arrowList, 'ammo');
    renderList(el.bowList, 'weapon');
  }

  function onRecipeClick(recipe) {
    if (!isUnlocked(recipe)) {
      window.Minerous.showToast(`Requires Fletching level ${recipe.level}`);
      return;
    }
    if (activeRecipeId === recipe.id) {
      stopFletching();
      renderLists();
      return;
    }
    if (!hasItems(recipe.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(recipe)}`);
      return;
    }
    startFletching(recipe.id);
    renderLists();
  }

  function startFletching(recipeId) {
    activeRecipeId = recipeId;
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Fletching ${getRecipe(recipeId).name}...`;
  }

  function stopFletching() {
    activeRecipeId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select a recipe to start fletching';
  }

  function awardResult(recipe) {
    // Guard before spending: a full pack must never eat the inputs and drop the
    // finished item on the floor.
    if (!window.Minerous.canCarry(recipe.id)) {
      stopFletching();
      window.Minerous.showToast(`Inventory full — no room for ${recipe.name}. Visit a bank.`);
      return;
    }
    spendItems(recipe.inputs);
    addItem(recipe.id, recipe.qty || 1);
    const leveledUp = addXp('fletching', recipe.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('fletching', 'fletching');

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Fletching level ${getLevel('fletching')}`, { levelUp: true });
    }

    el.workbench.classList.remove('hit');
    void el.workbench.offsetWidth;
    el.workbench.classList.add('hit');
  }

  window.Minerous.Fletching = {
    refresh() {
      renderLists();
      window.Minerous.renderSkillLevelRow('fletching', 'fletching');
      if (!activeRecipeId) {
        el.actionLabel.textContent = 'Select a recipe to start fletching';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopFletching();
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
          stopFletching();
          renderLists();
          return;
        }
        awardResult(recipe);
        actionStart = performance.now();
      }
    },
  };
})();
