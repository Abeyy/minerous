window.Minerous = window.Minerous || {};

(function () {
  const { BANK_SLOTS, INVENTORY_SLOTS, BANK_INTEREST, state, getItem, addItem } = window.Minerous;

  const el = {
    banker: document.getElementById('bank-banker'),
    gold: document.getElementById('bank-gold'),
    heldList: document.getElementById('bank-held-list'),
    storedList: document.getElementById('bank-stored-list'),
    heldHeading: document.getElementById('bank-held-heading'),
    storedHeading: document.getElementById('bank-stored-heading'),
  };

  // A fresh line each time you walk in, so the banker doesn't read like a sign.
  let lineIndex = 0;

  function totalGold() {
    return (state.inventory.coins || 0) + state.bank.gold;
  }

  function renderBanker() {
    const tier = window.Minerous.getBankerTier(totalGold());
    const line = tier.lines[lineIndex % tier.lines.length];
    el.banker.innerHTML = `
      <div class="bank-banker-name">🎩 Ledgerwright, Vault Keeper <span class="bank-banker-mood">${tier.mood}</span></div>
      <p class="quest-dialogue">${line}</p>
    `;
  }

  function renderGold() {
    const rate = `${(BANK_INTEREST.rate * 100).toFixed(1)}%`;
    const minutes = Math.round(BANK_INTEREST.intervalMs / 60000);
    el.gold.innerHTML = `
      <div class="bank-gold-row">
        <div>
          <div class="bank-gold-label">Vault balance</div>
          <div class="bank-gold-value">💰 ${state.bank.gold}</div>
          <div class="node-card-meta">${rate} interest every ${minutes} min on balances over ${BANK_INTEREST.minBalance}</div>
        </div>
        <div>
          <div class="bank-gold-label">On you</div>
          <div class="bank-gold-value">💰 ${state.inventory.coins || 0}</div>
        </div>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'bank-gold-actions';
    for (const [label, run] of [
      ['Deposit 100', () => moveGold(100)],
      ['Deposit all', () => moveGold(state.inventory.coins || 0)],
      ['Withdraw 100', () => moveGold(-100)],
      ['Withdraw all', () => moveGold(-state.bank.gold)],
    ]) {
      const btn = document.createElement('button');
      btn.className = 'inv-action-btn';
      btn.textContent = label;
      btn.addEventListener('click', run);
      actions.appendChild(btn);
    }
    el.gold.appendChild(actions);
  }

  // Positive deposits, negative withdraws. Clamped so neither side can go negative.
  function moveGold(amount) {
    const move = amount > 0 ? Math.min(amount, state.inventory.coins || 0) : Math.max(amount, -state.bank.gold);
    if (move === 0) {
      window.Minerous.showToast(amount > 0 ? 'No coins to deposit' : 'Nothing in the vault to withdraw');
      return;
    }
    state.inventory.coins = (state.inventory.coins || 0) - move;
    state.bank.gold += move;
    window.Minerous.renderInventory();
    render();
    window.Minerous.showToast(move > 0 ? `Deposited ${move} gold` : `Withdrew ${-move} gold`);
  }

  function itemRow(id, count, actionLabel, run, disabled, note) {
    const item = getItem(id);
    const row = document.createElement('div');
    row.className = 'node-card' + (disabled ? ' locked' : '');
    row.innerHTML = `
      ${window.Minerous.itemSwatch(id)}
      <span class="node-card-text">
        <div class="node-card-name">${item ? item.name : id}</div>
        <div class="node-card-meta">${count}${note ? ` · ${note}` : ''}</div>
      </span>
    `;
    const btn = document.createElement('button');
    btn.className = 'inv-action-btn';
    btn.textContent = actionLabel;
    btn.disabled = disabled;
    btn.addEventListener('click', run);
    row.appendChild(btn);
    return row;
  }

  function deposit(id) {
    const count = state.inventory[id] || 0;
    if (count <= 0) return;
    const isNewStack = !(state.bank.items[id] > 0);
    if (isNewStack && window.Minerous.bankSlotsUsed() >= BANK_SLOTS) {
      window.Minerous.showToast('The vault is full — withdraw or sell something first');
      return;
    }
    state.bank.items[id] = (state.bank.items[id] || 0) + count;
    delete state.inventory[id];
    window.Minerous.renderInventory();
    render();
  }

  function withdraw(id) {
    const count = state.bank.items[id] || 0;
    if (count <= 0) return;
    if (!window.Minerous.canCarry(id)) {
      window.Minerous.showToast('Your pack is full — deposit something first');
      return;
    }
    // addItem is the single gatekeeper for capacity, so let it do the check.
    if (!addItem(id, count)) return;
    delete state.bank.items[id];
    window.Minerous.renderInventory();
    render();
  }

  function renderLists() {
    const held = Object.entries(state.inventory).filter(([id, n]) => id !== 'coins' && n > 0);
    const stored = Object.entries(state.bank.items).filter(([, n]) => n > 0);

    el.heldHeading.textContent = `On You — ${held.length} / ${INVENTORY_SLOTS} slots`;
    el.storedHeading.textContent = `In the Vault — ${stored.length} / ${BANK_SLOTS} slots`;

    el.heldList.innerHTML = '';
    if (held.length === 0) {
      el.heldList.innerHTML = '<div class="node-list-note">Your pack is empty.</div>';
    } else {
      const vaultFull = stored.length >= BANK_SLOTS;
      for (const [id, count] of held) {
        const newStack = !(state.bank.items[id] > 0);
        const blocked = vaultFull && newStack;
        el.heldList.appendChild(
          itemRow(id, count, 'Deposit', () => deposit(id), blocked, blocked ? 'vault full' : '')
        );
      }
    }

    el.storedList.innerHTML = '';
    if (stored.length === 0) {
      el.storedList.innerHTML = '<div class="node-list-note">Nothing stored yet.</div>';
    } else {
      for (const [id, count] of stored) {
        const blocked = !window.Minerous.canCarry(id);
        el.storedList.appendChild(
          itemRow(id, count, 'Withdraw', () => withdraw(id), blocked, blocked ? 'pack full' : '')
        );
      }
    }
  }

  function render() {
    renderBanker();
    renderGold();
    renderLists();
  }

  // Interest accrues on wall-clock time, so a session left running pays out the same
  // as one checked in on periodically. Never compounds more than one interval behind.
  function accrueInterest() {
    const now = Date.now();
    if (!state.bank.lastInterestAt) {
      state.bank.lastInterestAt = now;
      return 0;
    }
    const elapsed = now - state.bank.lastInterestAt;
    if (elapsed < BANK_INTEREST.intervalMs) return 0;

    const periods = Math.floor(elapsed / BANK_INTEREST.intervalMs);
    state.bank.lastInterestAt += periods * BANK_INTEREST.intervalMs;
    if (state.bank.gold < BANK_INTEREST.minBalance) return 0;

    const before = state.bank.gold;
    state.bank.gold = Math.floor(before * Math.pow(1 + BANK_INTEREST.rate, periods));
    return state.bank.gold - before;
  }

  window.Minerous.Bank = {
    accrueInterest,
    refresh() {
      // A new visit, a new opening line.
      lineIndex += 1;
      accrueInterest();
      render();
    },
    stop() {},
    tick() {
      const earned = accrueInterest();
      if (earned > 0 && state.screen === 'bank') render();
    },
  };
})();
