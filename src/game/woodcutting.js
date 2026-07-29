window.Minerous = window.Minerous || {};

(function () {
  const { TREES, state, getLevel, addXp, addItem } = window.Minerous;

  let activeTreeId = null;
  let actionStart = 0;

  const el = {
    level: document.getElementById('woodcutting-level'),
    xpFill: document.getElementById('woodcutting-xp-fill'),
    xpLabel: document.getElementById('woodcutting-xp-label'),
    actionLabel: document.getElementById('woodcutting-action-label'),
    progressFill: document.getElementById('woodcutting-progress-fill'),
    treeList: document.getElementById('woodcutting-tree-list'),
    arm: document.getElementById('woodcutting-character-arm'),
    tree: document.getElementById('woodcutting-tree'),
  };

  function getTree(id) {
    return TREES.find((t) => t.id === id);
  }

  function isUnlocked(tree) {
    return getLevel('woodcutting') >= tree.level;
  }

  function renderTreeList() {
    el.treeList.innerHTML = '';
    for (const tree of TREES) {
      const unlocked = isUnlocked(tree);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeTreeId === tree.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(tree.id)}
        <span class="node-card-text">
          <div class="node-card-name">${tree.name}</div>
          <div class="node-card-meta">${unlocked ? `Lv ${tree.level} · ${tree.xp} xp` : `Requires level ${tree.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onTreeClick(tree));
      el.treeList.appendChild(btn);
    }
  }

  function onTreeClick(tree) {
    if (!isUnlocked(tree)) {
      window.Minerous.showToast(`Requires Woodcutting level ${tree.level}`);
      return;
    }
    if (activeTreeId !== tree.id && !window.Minerous.canCarry(tree.id)) {
      window.Minerous.showToast(`Inventory full — no room for ${tree.name}. Visit a bank.`);
      return;
    }
    if (activeTreeId === tree.id) {
      stopChopping();
    } else {
      startChopping(tree.id);
    }
    renderTreeList();
  }

  function startChopping(treeId) {
    activeTreeId = treeId;
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Chopping ${getTree(treeId).name}...`;
  }

  function stopChopping() {
    activeTreeId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select a tree to start chopping';
  }

  function awardResult(tree) {
    if (!window.Minerous.canCarry(tree.id)) {
      stopChopping();
      window.Minerous.showToast(`Inventory full — no room for ${tree.name}. Visit a bank.`);
      return;
    }
    const bonus = Math.random() < window.Minerous.Feats.getEffects().doubleLogChance ? 1 : 0;
    addItem(tree.id, 1 + bonus);
    if (bonus) window.Minerous.showToast(`🪓 Woodwise — a second ${tree.name}!`);
    const leveledUp = addXp('woodcutting', tree.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('woodcutting', 'woodcutting');

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Woodcutting level ${getLevel('woodcutting')}`, { levelUp: true });
      renderTreeList();
    }

    el.tree.classList.remove('hit');
    void el.tree.offsetWidth;
    el.tree.classList.add('hit');
  }

  window.Minerous.Woodcutting = {
    refresh() {
      renderTreeList();
      window.Minerous.renderSkillLevelRow('woodcutting', 'woodcutting');
      if (!activeTreeId) {
        el.actionLabel.textContent = 'Select a tree to start chopping';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopChopping();
    },
    tick() {
      if (!activeTreeId) return;
      const tree = getTree(activeTreeId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / tree.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed >= tree.timeMs) {
        awardResult(tree);
        actionStart = performance.now();
      }
    },
  };
})();
