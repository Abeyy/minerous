window.Minerous = window.Minerous || {};

(function () {
  const { HUNT_TARGETS, state, getLevel, addXp, addItem, getItem } = window.Minerous;

  let activeTargetId = null;
  let actionStart = 0;

  const el = {
    actionLabel: document.getElementById('hunter-action-label'),
    progressFill: document.getElementById('hunter-progress-fill'),
    targetList: document.getElementById('hunter-target-list'),
    arm: document.getElementById('hunter-character-arm'),
    quarry: document.getElementById('hunter-quarry'),
  };

  function getTarget(id) {
    return HUNT_TARGETS.find((t) => t.id === id);
  }

  function isUnlocked(target) {
    return getLevel('hunter') >= target.level;
  }

  function dropsLabel(target) {
    return target.drops
      .map((d) => {
        const item = getItem(d.id);
        const name = item ? item.name : d.id;
        return d.min === d.max ? `${d.min}x ${name}` : `${d.min}-${d.max}x ${name}`;
      })
      .join(', ');
  }

  // A catch yields several things at once, so it needs room for all of them at once —
  // a half-taken kill that drops the hide on the floor would be worse than not
  // hunting. Checking each drop separately would be wrong: three drops would each
  // "fit" the same single free slot, so the cost has to accumulate.
  function hasRoomFor(target) {
    const limit = window.Minerous.STACK_LIMIT;
    const projected = {};
    let extraSlots = 0;

    for (const drop of target.drops) {
      const before = (state.inventory[drop.id] || 0) + (projected[drop.id] || 0);
      const after = before + drop.max;
      extraSlots += Math.ceil(after / limit) - Math.ceil(before / limit);
      projected[drop.id] = (projected[drop.id] || 0) + drop.max;
    }
    return window.Minerous.inventorySlotsUsed() + extraSlots <= window.Minerous.INVENTORY_SLOTS;
  }

  function renderTargetList() {
    el.targetList.innerHTML = '';
    for (const target of HUNT_TARGETS) {
      const unlocked = isUnlocked(target);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeTargetId === target.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="node-swatch kind-raw" style="background:${target.color}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${target.name}</div>
          <div class="node-card-meta">${unlocked ? `Lv ${target.level} · ${target.xp} xp` : `Requires level ${target.level}`}</div>
          ${unlocked ? `<div class="node-card-meta">${dropsLabel(target)}</div>` : ''}
        </span>
      `;
      btn.addEventListener('click', () => onTargetClick(target));
      el.targetList.appendChild(btn);
    }
  }

  function onTargetClick(target) {
    if (!isUnlocked(target)) {
      window.Minerous.showToast(`Requires Hunter level ${target.level}`);
      return;
    }
    if (activeTargetId === target.id) {
      stopHunting();
      renderTargetList();
      return;
    }
    // Refuse up front rather than tracking something whose catch has nowhere to go.
    if (!hasRoomFor(target)) {
      window.Minerous.showToast(`Inventory full — no room for a ${target.name}. Visit a bank.`);
      return;
    }
    startHunting(target.id);
    renderTargetList();
  }

  function startHunting(targetId) {
    activeTargetId = targetId;
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Tracking ${getTarget(targetId).name}...`;
  }

  function stopHunting() {
    activeTargetId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select quarry to start hunting';
  }

  function awardResult(target) {
    if (!hasRoomFor(target)) {
      stopHunting();
      window.Minerous.showToast(`Inventory full — the ${target.name} goes to waste. Visit a bank.`);
      renderTargetList();
      return;
    }

    const taken = [];
    for (const drop of target.drops) {
      const qty = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
      if (qty <= 0) continue;
      addItem(drop.id, qty);
      const item = getItem(drop.id);
      taken.push(`${qty}x ${item ? item.name : drop.id}`);
    }
    const leveledUp = addXp('hunter', target.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('hunter', 'hunter');
    window.Minerous.showToast(`🏹 Caught a ${target.name} — ${taken.join(', ')}`);

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Hunter level ${getLevel('hunter')}`, { levelUp: true });
      renderTargetList();
    }

    el.quarry.classList.remove('hit');
    void el.quarry.offsetWidth;
    el.quarry.classList.add('hit');
  }

  window.Minerous.Hunter = {
    refresh() {
      renderTargetList();
      window.Minerous.renderSkillLevelRow('hunter', 'hunter');
      if (!activeTargetId) {
        el.actionLabel.textContent = 'Select quarry to start hunting';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopHunting();
    },
    tick() {
      if (!activeTargetId) return;
      const target = getTarget(activeTargetId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / target.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed >= target.timeMs) {
        awardResult(target);
        actionStart = performance.now();
      }
    },
  };
})();
