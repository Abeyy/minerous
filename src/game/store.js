window.Minerous = window.Minerous || {};

(function () {
  const { SPIRIT_STONES, STORE_GOODS, state, getItem, getSellPrice, getLevel, addItem, spendItems, hasItems } =
    window.Minerous;

  const el = {
    title: document.getElementById('store-title'),
    blurb: document.getElementById('store-blurb'),
    goodsList: document.getElementById('store-goods-list'),
    sellList: document.getElementById('store-sell-list'),
    weaponStoneList: document.getElementById('store-weapon-stone-list'),
    armorStoneList: document.getElementById('store-armor-stone-list'),
    stoneNote: document.getElementById('store-stone-note'),
  };

  function stockedTiers() {
    return window.Minerous.getStoreStoneTiers(state.currentAreaId);
  }

  function buy(item, qty) {
    if (!hasItems({ coins: item.price })) {
      window.Minerous.showToast(`Not enough coins (need ${item.price})`);
      return;
    }
    if (!window.Minerous.canCarry(item.id)) {
      window.Minerous.showToast('Inventory full — visit the bank first');
      return;
    }
    spendItems({ coins: item.price });
    addItem(item.id, qty);
    window.Minerous.renderInventory();
    render();
    window.Minerous.showToast(`Bought ${item.name} for ${item.price} coins`);
  }

  function renderGoods() {
    el.goodsList.innerHTML = '';
    for (const good of STORE_GOODS) {
      const owned = state.inventory[good.id] || 0;
      const affordable = hasItems({ coins: good.price });
      const btn = document.createElement('button');
      btn.className = 'node-card' + (affordable ? '' : ' locked');
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(good.id)}
        <span class="node-card-text">
          <div class="node-card-name">${good.name}${owned ? ` · ${owned}` : ''}</div>
          <div class="node-card-meta">${good.description}</div>
          <div class="node-card-meta">${good.price} coins · heals ${good.heal} HP</div>
        </span>
      `;
      btn.addEventListener('click', () => buy(good, 1));
      el.goodsList.appendChild(btn);
    }
  }

  function renderSellList() {
    const entries = Object.entries(state.inventory).filter(([id, count]) => id !== 'coins' && count > 0);
    if (entries.length === 0) {
      el.sellList.innerHTML = '<div class="inv-empty">Nothing to sell yet.</div>';
      return;
    }
    el.sellList.innerHTML = '';
    for (const [id, count] of entries) {
      const item = getItem(id);
      if (!item) continue;
      const unitPrice = getSellPrice(id);
      const total = unitPrice * count;
      const btn = document.createElement('button');
      btn.className = 'node-card';
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(id)}
        <span class="node-card-text">
          <div class="node-card-name">${item.name} x${count}</div>
          <div class="node-card-meta">${unitPrice} coins each · Sell all for ${total}</div>
        </span>
      `;
      btn.addEventListener('click', () => sellAll(id, count, total));
      el.sellList.appendChild(btn);
    }
  }

  function sellAll(id, count, total) {
    const name = getItem(id).name;
    spendItems({ [id]: count });
    addItem('coins', total);
    window.Minerous.renderInventory();
    render();
    window.Minerous.showToast(`Sold ${count}x ${name} for ${total} coins`);
  }

  // Stones are stocked by settlement size, but socketing them (in Crafting) is
  // level-gated — surface both so nobody buys a stone they can't use or travels for
  // one they could have bought at home.
  function renderStoneList(container, kind) {
    container.innerHTML = '';
    const craftingLevel = getLevel('crafting');
    const tiers = stockedTiers();
    const stocked = SPIRIT_STONES.filter((s) => s.kind === kind && tiers.includes(s.tier));

    for (const stone of stocked) {
      const canSocket = craftingLevel >= stone.level;
      const btn = document.createElement('button');
      btn.className = 'node-card';
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(stone.id)}
        <span class="node-card-text">
          <div class="node-card-name">${stone.name}</div>
          <div class="node-card-meta">${stone.description} · ${stone.price} coins</div>
          <div class="node-card-meta stone-req${canSocket ? '' : ' unmet'}">${
            canSocket
              ? `✓ Crafting ${stone.level} to socket`
              : `🔒 Needs Crafting ${stone.level} to socket (you have ${craftingLevel})`
          }</div>
        </span>
      `;
      btn.addEventListener('click', () => buy(stone, 1));
      container.appendChild(btn);
    }
  }

  function renderStoneNote() {
    const tiers = stockedTiers();
    const missing = ['Minor', 'Greater', 'Superior'].filter((t) => !tiers.includes(t));
    el.stoneNote.hidden = missing.length === 0;
    if (!missing.length) return;

    // Name where you can actually buy the missing tiers, rather than a vague "bigger
    // towns" — a store in Lidas saying "go to a town" would be nonsense.
    const where = missing.includes('Greater') ? 'in the towns and the capital' : 'in the capital';
    el.stoneNote.textContent = `This store stocks ${tiers.join(' and ')} stones only. ${missing.join(
      ' and '
    )} stones are sold ${where}.`;
  }

  function render() {
    const area = window.Minerous.getArea(state.currentAreaId);
    el.title.textContent = area ? `${area.name} General Store` : 'General Store';
    el.blurb.textContent = 'Provisions, spirit stones, and a fair price for anything you have spare.';
    renderGoods();
    renderStoneNote();
    renderStoneList(el.weaponStoneList, 'weapon');
    renderStoneList(el.armorStoneList, 'armor');
    renderSellList();
  }

  window.Minerous.Store = {
    refresh: render,
    stop() {},
    tick() {},
  };
})();
