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

    // Round hundreds cover the common case; this covers the rest. Kept on its own row so
    // the fixed-amount buttons stay a single glance.
    const custom = document.createElement('div');
    custom.className = 'bank-gold-actions bank-gold-custom';
    const input = amountInput('amount', goldAmount, (v) => { goldAmount = v; });
    custom.appendChild(input);
    for (const [label, sign] of [['Deposit', 1], ['Withdraw', -1]]) {
      const btn = document.createElement('button');
      btn.className = 'inv-action-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const amount = readAmount(input);
        if (!amount) {
          window.Minerous.showToast('Enter how much gold to move');
          return;
        }
        moveGold(sign * amount);
      });
      custom.appendChild(btn);
    }
    el.gold.appendChild(custom);
  }

  // What the player last typed, per input, so a re-render mid-interaction doesn't wipe the
  // field out from under them. Keyed by item id; gold gets its own.
  let goldAmount = '';
  const itemAmounts = new Map();

  function amountInput(placeholder, value, onInput) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'bank-amount';
    input.min = '1';
    input.step = '1';
    input.placeholder = placeholder;
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  // An empty or nonsense field means "no custom amount given" rather than zero, so the
  // caller can fall back to its own default.
  function readAmount(input) {
    const n = Math.floor(Number(input.value));
    return Number.isFinite(n) && n > 0 ? n : 0;
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

  // `run` is handed the typed amount, or 0 when the field is empty — each caller decides
  // what "no amount given" means for it (in both cases: as much as will move).
  function itemRow({ id, count, actionLabel, run, disabled, note }) {
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

    const controls = document.createElement('span');
    controls.className = 'bank-row-actions';
    const input = amountInput('all', itemAmounts.get(id), (v) => {
      if (v) itemAmounts.set(id, v);
      else itemAmounts.delete(id);
    });
    input.disabled = disabled;
    input.max = String(count);
    // Enter is the natural way to commit a typed amount.
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      run(readAmount(input));
    });
    controls.appendChild(input);

    const btn = document.createElement('button');
    btn.className = 'inv-action-btn';
    btn.textContent = actionLabel;
    btn.disabled = disabled;
    btn.addEventListener('click', () => run(readAmount(input)));
    controls.appendChild(btn);

    row.appendChild(controls);
    return row;
  }

  // The vault's row order is the player's arrangement, kept in state.bank.order. This is
  // the one place it's reconciled against what's actually stored, so a save written before
  // ordering existed, or an entry emptied by a withdrawal, sorts itself out on the next
  // render rather than needing a migration.
  function storedOrder() {
    if (!Array.isArray(state.bank.order)) state.bank.order = [];
    const present = Object.keys(state.bank.items).filter((id) => state.bank.items[id] > 0);
    const presentSet = new Set(present);
    const kept = state.bank.order.filter((id) => presentSet.has(id));
    const known = new Set(kept);
    // Anything new goes on the end, where a player expects a fresh deposit to land.
    for (const id of present) if (!known.has(id)) kept.push(id);
    state.bank.order = kept;
    return kept;
  }

  // Drop `id` immediately before or after `targetId`.
  function moveStored(id, targetId, after) {
    if (id === targetId) return false;
    const order = storedOrder();
    const from = order.indexOf(id);
    if (from < 0) return false;
    order.splice(from, 1);
    const to = order.indexOf(targetId);
    if (to < 0) {
      order.splice(from, 0, id);
      return false;
    }
    order.splice(after ? to + 1 : to, 0, id);
    return true;
  }

  // Keyboard equivalent of a drag, for a focused row.
  function nudgeStored(id, delta) {
    const order = storedOrder();
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return false;
    order.splice(from, 1);
    order.splice(to, 0, id);
    return true;
  }

  function clearDropMarks() {
    for (const n of el.storedList.querySelectorAll('.drop-before, .drop-after')) {
      n.classList.remove('drop-before', 'drop-after');
    }
  }

  // The vault is a grid flowing left to right and wrapping, so a drop lands before or after
  // a tile according to which half of it the pointer is in horizontally — the same axis the
  // order itself runs along. (Vertical midpoints would only work in a single column.)
  function dropsAfter(tile, clientX) {
    const box = tile.getBoundingClientRect();
    return clientX > box.left + box.width / 2;
  }

  // The tile under the pointer, or failing that the nearest one — so a drop into the gap
  // between two tiles still goes where it obviously meant to.
  function tileUnder(clientX, clientY) {
    const tiles = [...el.storedList.querySelectorAll('.node-card')];
    let nearest = null;
    let best = Infinity;
    for (const n of tiles) {
      const box = n.getBoundingClientRect();
      if (clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom) {
        return n;
      }
      const dx = clientX - (box.left + box.width / 2);
      const dy = clientY - (box.top + box.height / 2);
      const dist = dx * dx + dy * dy;
      if (dist < best) {
        best = dist;
        nearest = n;
      }
    }
    return nearest;
  }

  // How far the pointer must travel before this counts as a drag rather than a click. Keeps
  // a slightly shaky click on a row from rearranging the vault behind the player's back.
  const DRAG_THRESHOLD = 4;

  const ARROW_DELTA = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

  // Dragging is built on pointer events rather than HTML5 drag-and-drop. Same feel with a
  // mouse, but it also works under a finger, and there's no dataTransfer to fight.
  function makeReorderable(row, id) {
    row.tabIndex = 0;

    row.addEventListener('pointerdown', (e) => {
      // The amount field and the button are controls in their own right.
      if (e.button !== 0 || e.target.closest('.bank-row-actions')) return;
      // Focus by hand, since preventDefault (which stops the row's text being selected as
      // the pointer moves) would otherwise suppress it — and focus is what the arrow keys
      // need.
      row.focus();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let target = null;

      const onMove = (move) => {
        if (!dragging) {
          // Distance in either direction, now that tiles sit side by side as well as
          // stacked — a purely horizontal drag is a real drag.
          const dx = move.clientX - startX;
          const dy = move.clientY - startY;
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          dragging = true;
          row.classList.add('dragging');
        }
        const over = tileUnder(move.clientX, move.clientY);
        clearDropMarks();
        target = null;
        if (!over || over.dataset.bankId === id) return;
        const after = dropsAfter(over, move.clientX);
        over.classList.add(after ? 'drop-after' : 'drop-before');
        target = { id: over.dataset.bankId, after };
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        row.classList.remove('dragging');
        clearDropMarks();
        if (!target || !moveStored(id, target.id, target.after)) return;
        render();
        focusStoredRow(id);
      };

      // Tracked on the window, not the row: the pointer leaves the row immediately, that
      // being the whole point of a drag. Capture is requested as well so the row keeps
      // receiving events even over an iframe or a scrollbar, but it's an optimisation, not
      // load-bearing — a browser that refuses it still gets a working drag.
      try {
        if (row.setPointerCapture) row.setPointerCapture(e.pointerId);
      } catch (err) {
        /* no capture available; the window listeners below are enough */
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    // All four arrows move a tile one place along the order. Left/Right is the intuitive
    // pair in a grid; Up/Down are kept because they're what a list-shaped thing invites, and
    // in a grid one place back or forward often is the row above or below.
    row.addEventListener('keydown', (e) => {
      const delta = ARROW_DELTA[e.key] || 0;
      if (!delta) return;
      e.preventDefault();
      if (!nudgeStored(id, delta)) return;
      render();
      focusStoredRow(id);
    });
  }

  // Re-rendering throws away the element that had focus, so put it back on the row that
  // moved — otherwise a second arrow press would do nothing.
  function focusStoredRow(id) {
    const row = el.storedList.querySelector(`[data-bank-id="${id}"]`);
    if (row) row.focus();
  }

  function depositBlocked(id) {
    return !(state.bank.items[id] > 0) && window.Minerous.bankSlotsUsed() >= BANK_SLOTS;
  }

  // `amount` of 0 means everything held.
  function deposit(id, amount) {
    const held = state.inventory[id] || 0;
    if (held <= 0) return;
    if (depositBlocked(id)) {
      window.Minerous.showToast('The vault is full — withdraw or sell something first');
      return;
    }

    const moved = Math.min(amount > 0 ? amount : held, held);
    state.bank.items[id] = (state.bank.items[id] || 0) + moved;
    if (moved >= held) delete state.inventory[id];
    else state.inventory[id] = held - moved;
    itemAmounts.delete(id);

    window.Minerous.renderInventory();
    render();
    const item = getItem(id);
    window.Minerous.showToast(`Deposited ${moved} ${item ? item.name : id}`);
  }

  // `amount` of 0 means as much as the pack will take.
  function withdraw(id, amount) {
    const stored = state.bank.items[id] || 0;
    if (stored <= 0) return;

    // A vault entry can hold far more than a pack: take what fits rather than
    // refusing the whole withdrawal because the last few wouldn't.
    const room = window.Minerous.carryCapacityFor(id);
    if (room <= 0) {
      window.Minerous.showToast('Your pack is full — deposit something first');
      return;
    }

    const wanted = Math.min(amount > 0 ? amount : stored, stored);
    const taken = Math.min(wanted, room);
    addItem(id, taken);
    if (taken >= stored) delete state.bank.items[id];
    else state.bank.items[id] = stored - taken;
    itemAmounts.delete(id);

    window.Minerous.renderInventory();
    render();
    const item = getItem(id);
    const name = item ? item.name : id;
    if (taken < wanted) {
      window.Minerous.showToast(`Withdrew ${taken} ${name} — pack full, ${stored - taken} left in the vault`);
    } else {
      window.Minerous.showToast(`Withdrew ${taken} ${name}`);
    }
  }

  function renderLists() {
    const held = Object.entries(state.inventory).filter(([id, n]) => id !== 'coins' && n > 0);
    const stored = storedOrder();

    el.heldHeading.textContent = `On You — ${window.Minerous.inventorySlotsUsed()} / ${INVENTORY_SLOTS} slots`;
    // The vault holds a whole hoard per entry, no stack limit — that's the point of it.
    el.storedHeading.textContent = `In the Vault — ${stored.length} / ${BANK_SLOTS} kinds, any amount each`;

    el.heldList.innerHTML = '';
    if (held.length === 0) {
      el.heldList.innerHTML = '<div class="node-list-note">Your pack is empty.</div>';
    } else {
      for (const [id, count] of held) {
        const blocked = depositBlocked(id);
        el.heldList.appendChild(
          itemRow({
            id,
            count,
            actionLabel: 'Deposit',
            run: (amount) => deposit(id, amount),
            disabled: blocked,
            note: blocked ? 'vault full' : '',
          })
        );
      }
    }

    el.storedList.innerHTML = '';
    if (stored.length === 0) {
      el.storedList.innerHTML = '<div class="node-list-note">Nothing stored yet.</div>';
      return;
    }
    for (const id of stored) {
      const count = state.bank.items[id];
      const room = window.Minerous.carryCapacityFor(id);
      const blocked = room <= 0;
      const partial = !blocked && room < count;
      const row = itemRow({
        id,
        count,
        actionLabel: 'Withdraw',
        run: (amount) => withdraw(id, amount),
        disabled: blocked,
        note: blocked ? 'pack full' : partial ? `only ${room} will fit` : '',
      });
      row.dataset.bankId = id;
      // A full pack blocks withdrawing, not rearranging.
      makeReorderable(row, id);
      const grip = document.createElement('span');
      grip.className = 'bank-grip';
      grip.textContent = '⠿';
      grip.title = 'Drag to reorder, or focus the row and use the arrow keys';
      row.prepend(grip);
      el.storedList.appendChild(row);
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
    // Used by the inventory panel's Deposit buttons, which are only shown while the vault
    // is open. Routed through here so the vault lists redraw with the pack.
    depositBlocked,
    deposit(id, amount) {
      deposit(id, amount || 0);
    },
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
