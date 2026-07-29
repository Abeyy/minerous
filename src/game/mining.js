window.Minerous = window.Minerous || {};

(function () {
  const { ORES, state, getLevel, addXp, addItem } = window.Minerous;

  let activeOreId = null;
  let actionStart = 0;

  const el = {
    level: document.getElementById('mining-level'),
    xpFill: document.getElementById('mining-xp-fill'),
    xpLabel: document.getElementById('mining-xp-label'),
    actionLabel: document.getElementById('mining-action-label'),
    progressFill: document.getElementById('mining-progress-fill'),
    oreList: document.getElementById('mining-ore-list'),
    arm: document.getElementById('mining-character-arm'),
    rock: document.getElementById('mining-rock'),
  };

  function getOre(id) {
    return ORES.find((o) => o.id === id);
  }

  function isUnlocked(ore) {
    return getLevel('mining') >= ore.level;
  }

  function renderOreList() {
    el.oreList.innerHTML = '';
    const areaOres = window.Minerous.filterByArea('mining', ORES);
    for (const ore of areaOres) {
      const unlocked = isUnlocked(ore);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeOreId === ore.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        ${window.Minerous.itemSwatch(ore.id)}
        <span class="node-card-text">
          <div class="node-card-name">${ore.name}</div>
          <div class="node-card-meta">${unlocked ? `Lv ${ore.level} · ${ore.xp} xp` : `Requires level ${ore.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onOreClick(ore));
      el.oreList.appendChild(btn);
    }

    // Say plainly that the richer seams exist elsewhere, so a thin list doesn't read
    // as a bug or a level gate.
    if (areaOres.length < ORES.length) {
      const note = document.createElement('div');
      note.className = 'node-list-note';
      note.textContent = 'These hills only hold the shallow seams. Richer ore is mined in other lands.';
      el.oreList.appendChild(note);
    }
  }

  function onOreClick(ore) {
    if (!isUnlocked(ore)) {
      window.Minerous.showToast(`Requires Mining level ${ore.level}`);
      return;
    }
    // Refuse up front rather than letting the player swing for a few seconds and then
    // discover the ore had nowhere to go.
    if (activeOreId !== ore.id && !window.Minerous.canCarry(ore.id)) {
      window.Minerous.showToast(`Inventory full — no room for ${ore.name}. Visit a bank.`);
      return;
    }
    if (activeOreId === ore.id) {
      stopMining();
    } else {
      startMining(ore.id);
    }
    renderOreList();
  }

  function startMining(oreId) {
    activeOreId = oreId;
    actionStart = performance.now();
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Mining ${getOre(oreId).name}...`;
  }

  function stopMining() {
    activeOreId = null;
    el.arm.classList.remove('swinging');
    el.progressFill.style.width = '0%';
    el.actionLabel.textContent = 'Select an ore to start mining';
  }

  function awardResult(ore) {
    // A full pack stops the swing outright — awarding xp for ore that goes nowhere
    // would quietly level the skill while paying nothing.
    if (!window.Minerous.canCarry(ore.id)) {
      stopMining();
      window.Minerous.showToast(`Inventory full — no room for ${ore.name}. Visit a bank.`);
      return;
    }
    const bonus = Math.random() < window.Minerous.Feats.getEffects().doubleOreChance ? 1 : 0;
    addItem(ore.id, 1 + bonus);
    if (bonus) window.Minerous.showToast(`⛏ Prospector's Instinct — a second ${ore.name}!`);
    const leveledUp = addXp('mining', ore.xp);

    window.Minerous.renderInventory();
    window.Minerous.renderSkillLevelRow('mining', 'mining');

    if (leveledUp) {
      window.Minerous.showToast(`Level up! Mining level ${getLevel('mining')}`, { levelUp: true });
      renderOreList();
    }

    el.rock.classList.remove('hit');
    void el.rock.offsetWidth;
    el.rock.classList.add('hit');
  }

  window.Minerous.Mining = {
    refresh() {
      // Travelling can pull the seam out from under an in-progress swing.
      if (activeOreId && !window.Minerous.filterByArea('mining', ORES).some((o) => o.id === activeOreId)) {
        stopMining();
      }
      renderOreList();
      window.Minerous.renderSkillLevelRow('mining', 'mining');
      if (!activeOreId) {
        el.actionLabel.textContent = 'Select an ore to start mining';
        el.progressFill.style.width = '0%';
      }
    },
    stop() {
      stopMining();
    },
    tick() {
      if (!activeOreId) return;
      const ore = getOre(activeOreId);
      const elapsed = performance.now() - actionStart;
      const progress = Math.min(1, elapsed / ore.timeMs);
      el.progressFill.style.width = `${progress * 100}%`;

      if (elapsed >= ore.timeMs) {
        awardResult(ore);
        actionStart = performance.now();
      }
    },
  };
})();
