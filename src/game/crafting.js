window.Minerous = window.Minerous || {};

(function () {
  const { SPIRIT_STONES, state, getLevel, addXp, spendItems } = window.Minerous;

  let activeId = null; // spirit stone id currently being socketed
  let actionStart = 0;

  const el = {
    actionLabel: document.getElementById('crafting-action-label'),
    progressFill: document.getElementById('crafting-progress-fill'),
    weaponStoneList: document.getElementById('crafting-weapon-stone-list'),
    armorStoneList: document.getElementById('crafting-armor-stone-list'),
    socketStatus: document.getElementById('crafting-socket-status'),
    character: document.getElementById('crafting-character'),
    gem: document.getElementById('crafting-gem'),
  };

  function getStone(id) {
    return SPIRIT_STONES.find((s) => s.id === id);
  }

  function isUnlocked(stone) {
    return getLevel('crafting') >= stone.level;
  }

  function renderSocketStatus() {
    const weaponStone = state.weaponSocket ? window.Minerous.getItem(state.weaponSocket) : null;
    const armorStone = state.armorSocket ? window.Minerous.getItem(state.armorSocket) : null;
    el.socketStatus.textContent =
      `Weapon Socket: ${weaponStone ? weaponStone.name : 'None'} · Armor Socket: ${armorStone ? armorStone.name : 'None'}`;
  }

  function renderStoneList(container, kind) {
    container.innerHTML = '';
    for (const stone of SPIRIT_STONES.filter((s) => s.kind === kind)) {
      const unlocked = isUnlocked(stone);
      const owned = (state.inventory[stone.id] || 0) > 0;
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeId === stone.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(stone.id)}
        <span class="node-card-text">
          <div class="node-card-name">${stone.name}${owned ? '' : ' (none owned)'}</div>
          <div class="node-card-meta">${unlocked ? `${stone.description} · ${stone.xp} xp` : `Requires level ${stone.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onStoneClick(stone));
      container.appendChild(btn);
    }
  }

  function renderLists() {
    renderStoneList(el.weaponStoneList, 'weapon');
    renderStoneList(el.armorStoneList, 'armor');
    renderSocketStatus();
  }

  function onStoneClick(stone) {
    if (!isUnlocked(stone)) {
      window.Minerous.showToast(`Requires Crafting level ${stone.level}`);
      return;
    }
    if (activeId === stone.id) {
      stopCrafting();
      renderLists();
      return;
    }
    if ((state.inventory[stone.id] || 0) < 1) {
      window.Minerous.showToast(`You don't own any ${stone.name} — buy some from the Merchant`);
      return;
    }
    if (stone.kind === 'weapon' && !state.equippedWeaponId) {
      window.Minerous.showToast('Equip a weapon first');
      return;
    }
    if (stone.kind === 'armor' && !Object.values(state.equippedArmor).some(Boolean)) {
      window.Minerous.showToast('Equip some armor first');
      return;
    }
    startCrafting(stone.id);
    renderLists();
  }

  function startCrafting(stoneId) {
    activeId = stoneId;
    actionStart = performance.now();
    el.character.classList.add('crafting');
    el.actionLabel.textContent = `Socketing ${getStone(stoneId).name}...`;
  }

  function stopCrafting() {
    activeId = null;
    el.character.classList.remove('crafting');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select a spirit stone to socket';
  }

  function awardStone(stone) {
    spendItems({ [stone.id]: 1 });
    const leveledUp = addXp('crafting', stone.xp);

    if (stone.kind === 'weapon') {
      state.weaponSocket = stone.id;
      if (window.Minerous.Combat) window.Minerous.Combat.refreshWeaponStatus();
    } else {
      state.armorSocket = stone.id;
      if (window.Minerous.Combat) window.Minerous.Combat.refreshArmorStatus();
    }

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('crafting', 'crafting');
    renderSocketStatus();

    window.Minerous.showToast(`Socketed ${stone.name} into your ${stone.kind}!`, { levelUp: true });
    if (leveledUp) {
      window.Minerous.showToast(`Level up! Crafting level ${getLevel('crafting')}`, { levelUp: true });
    }

    el.gem.classList.remove('hit');
    void el.gem.offsetWidth;
    el.gem.classList.add('hit');
  }

  window.Minerous.Crafting = {
    refresh() {
      renderLists();
      window.Minerous.renderSkillLevelRow('crafting', 'crafting');
      if (!activeId) {
        el.actionLabel.textContent = 'Select a spirit stone to socket';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopCrafting();
    },
    tick() {
      if (!activeId) return;
      const stone = getStone(activeId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / stone.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed < stone.timeMs) return;

      if ((state.inventory[stone.id] || 0) < 1) {
        window.Minerous.showToast(`Out of ${stone.name}`);
        stopCrafting();
        renderLists();
        return;
      }
      awardStone(stone);
      stopCrafting();
      renderLists();
    },
  };
})();
