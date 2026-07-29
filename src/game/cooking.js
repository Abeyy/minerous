window.Minerous = window.Minerous || {};

(function () {
  const { COOKING_RECIPES, getLevel, addXp, addItem, hasItems, spendItems, getItem } = window.Minerous;

  let activeRecipeId = null;
  let actionStart = 0;
  // How many of the current recipe are still to be made. Infinity = until the
  // materials run out, which is what 'All' means.
  let batchRemaining = Infinity;

  const el = {
    batch: document.getElementById('cooking-batch'),
    actionLabel: document.getElementById('cooking-action-label'),
    progressFill: document.getElementById('cooking-progress-fill'),
    foodList: document.getElementById('cooking-food-list'),
    arm: document.getElementById('cooking-character-arm'),
    campfire: document.getElementById('cooking-campfire'),
  };

  function getRecipe(id) {
    return COOKING_RECIPES.find((r) => r.id === id);
  }

  function isUnlocked(recipe) {
    return getLevel('cooking') >= recipe.level;
  }

  function inputsLabel(recipe) {
    return Object.entries(recipe.inputs)
      .map(([id, qty]) => `${qty}x ${getItem(id).name}`)
      .join(' + ');
  }

  function renderList() {
    el.foodList.innerHTML = '';
    for (const recipe of COOKING_RECIPES) {
      const unlocked = isUnlocked(recipe);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeRecipeId === recipe.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(recipe.id)}
        <span class="node-card-text">
          <div class="node-card-name">${recipe.name}</div>
          <div class="node-card-meta">${unlocked ? `${inputsLabel(recipe)} · ${recipe.xp} xp · heals ${recipe.heal}` : `Requires level ${recipe.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onRecipeClick(recipe));
      el.foodList.appendChild(btn);
    }
  }

  function onRecipeClick(recipe) {
    if (!isUnlocked(recipe)) {
      window.Minerous.showToast(`Requires Cooking level ${recipe.level}`);
      return;
    }
    if (activeRecipeId === recipe.id) {
      stopCooking();
      renderList();
      return;
    }
    if (!hasItems(recipe.inputs)) {
      window.Minerous.showToast(`Missing materials: ${inputsLabel(recipe)}`);
      return;
    }
    startCooking(recipe.id);
    renderList();
  }

  function startCooking(recipeId) {
    activeRecipeId = recipeId;
    batchRemaining = window.Minerous.Batch.count('cooking');
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Cooking ${getRecipe(recipeId).name}...${window.Minerous.Batch.remainingSuffix(batchRemaining)}`;
  }

  function stopCooking() {
    activeRecipeId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select food to start cooking';
  }

  function awardResult(recipe) {
    // Guard before spending: a full pack must never eat the inputs and drop the
    // finished item on the floor.
    if (!window.Minerous.canCarry(recipe.id)) {
      stopCooking();
      window.Minerous.showToast(`Inventory full — no room for ${recipe.name}. Visit a bank.`);
      return;
    }
    spendItems(recipe.inputs);
    addItem(recipe.id, 1);
    const leveledUp = addXp('cooking', recipe.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('cooking', 'cooking');

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Cooking level ${getLevel('cooking')}`, { levelUp: true });
    }

    el.campfire.classList.remove('hit');
    void el.campfire.offsetWidth;
    el.campfire.classList.add('hit');
  }

  window.Minerous.Cooking = {
    refresh() {
      // Changing the size mid-run retargets the current run rather than cancelling it.
      window.Minerous.Batch.render(el.batch, 'cooking', () => {
        if (activeRecipeId) batchRemaining = window.Minerous.Batch.count('cooking');
      });
      renderList();
      window.Minerous.renderSkillLevelRow('cooking', 'cooking');
      if (!activeRecipeId) {
        el.actionLabel.textContent = 'Select food to start cooking';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopCooking();
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
          stopCooking();
          renderList();
          return;
        }
        awardResult(recipe);
        actionStart = performance.now();

        // A bounded run stops itself once it's made what was asked for, so a click
        // never quietly consumes the whole stockpile.
        batchRemaining -= 1;
        if (batchRemaining <= 0) {
          stopCooking();
          renderList();
          window.Minerous.showToast(`Finished ${recipe.name} ×${window.Minerous.Batch.count('cooking')}`);
          return;
        }
        el.actionLabel.textContent =
          `Cooking ${recipe.name}...${window.Minerous.Batch.remainingSuffix(batchRemaining)}`;
      }
    },
  };
})();
