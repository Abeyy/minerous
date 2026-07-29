window.Minerous = window.Minerous || {};

(function () {
  const { TAVERN_FOODS, TAVERN_REST, state, addItem, spendItems, hasItems } = window.Minerous;

  const el = {
    foodList: document.getElementById('tavern-food-list'),
    rest: document.getElementById('tavern-rest'),
  };

  function restMinutesLeft() {
    const ms = (state.restedUntil || 0) - Date.now();
    return ms <= 0 ? 0 : Math.ceil(ms / 60000);
  }

  function renderRest() {
    const rested = window.Minerous.isRested();
    const bonusPct = Math.round((TAVERN_REST.accuracyMultiplier - 1) * 100);
    const minutes = Math.round(TAVERN_REST.durationMs / 60000);

    el.rest.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'tavern-rest-card' + (rested ? ' rested' : '');
    card.innerHTML = `
      <div class="tavern-rest-text">
        <div class="tavern-rest-name">🛏 Sleep at the Tavern</div>
        <div class="node-card-meta">${TAVERN_REST.price} coins · +${bonusPct}% attack accuracy for ${minutes} minutes</div>
        ${rested ? `<div class="node-card-meta tavern-rest-active">😴 Rested — ${restMinutesLeft()} min remaining</div>` : ''}
      </div>
    `;

    const btn = document.createElement('button');
    btn.className = 'inv-action-btn tavern-rest-btn';
    btn.textContent = rested ? 'Sleep again' : 'Sleep';
    btn.addEventListener('click', sleep);
    card.appendChild(btn);
    el.rest.appendChild(card);
  }

  function sleep() {
    if (!hasItems({ coins: TAVERN_REST.price })) {
      window.Minerous.showToast(`Not enough coins (need ${TAVERN_REST.price})`);
      return;
    }
    spendItems({ coins: TAVERN_REST.price });
    // Sleeping again restarts the clock rather than stacking — you can't bank rest.
    state.restedUntil = Date.now() + TAVERN_REST.durationMs;
    window.Minerous.renderInventory();
    renderRest();
    window.Minerous.showToast('You wake rested and sharp-eyed');
  }

  function renderFoodList() {
    el.foodList.innerHTML = '';
    for (const food of TAVERN_FOODS) {
      const affordable = hasItems({ coins: food.price });
      const owned = state.inventory[food.id] || 0;

      const btn = document.createElement('button');
      btn.className = 'node-card' + (affordable ? '' : ' locked');
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(food.id)}
        <span class="node-card-text">
          <div class="node-card-name">${food.name}${owned ? ` · ${owned}` : ''}</div>
          <div class="node-card-meta">${food.description}</div>
          <div class="node-card-meta">${food.price} coins · heals ${food.heal} HP</div>
        </span>
      `;
      btn.addEventListener('click', () => buyFood(food));
      el.foodList.appendChild(btn);
    }
  }

  function buyFood(food) {
    if (!hasItems({ coins: food.price })) {
      window.Minerous.showToast(`Not enough coins (need ${food.price})`);
      return;
    }
    spendItems({ coins: food.price });
    addItem(food.id, 1);
    window.Minerous.renderInventory();
    renderFoodList();
    window.Minerous.showToast(`Bought ${food.name} for ${food.price} coins`);
  }

  window.Minerous.Tavern = {
    refresh() {
      renderRest();
      renderFoodList();
    },
    stop() {},
    tick() {
      // Keep the countdown honest while the player lingers at the bar.
      if (state.screen === 'tavern') renderRest();
    },
  };
})();
