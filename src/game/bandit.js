window.Minerous = window.Minerous || {};

(function () {
  const { CAMP_TIERS, MONSTERS, state } = window.Minerous;

  const el = {
    grid: document.getElementById('camp-grid'),
    status: document.getElementById('camp-status'),
  };

  function monsterFor(tier) {
    return MONSTERS.find((m) => m.id === tier.monsterId);
  }

  function cleared() {
    return CAMP_TIERS.filter((t) => window.Minerous.campTierDefeated(t.monsterId)).length;
  }

  function renderStatus() {
    const done = cleared();
    const kingDown = window.Minerous.campTierDefeated('bandit_king');
    el.status.className = 'camp-status' + (kingDown ? ' complete' : '');
    el.status.textContent = kingDown
      ? '👑 The Bandit King is dead. The camp is broken, and Highcastle has opened its gates.'
      : `${done} of ${CAMP_TIERS.length} tents cleared. Each one is a boss — go home, train, and come back stronger.`;
  }

  function fight(tier, index) {
    const monster = monsterFor(tier);
    window.Minerous.Combat.confirmBossFight(monster, () => {
      window.Minerous.Combat.startGateEncounter({
        title: `${tier.label} — ${monster.name}`,
        monsterId: monster.id,
        count: 1,
        onWin() {
          if (!window.Minerous.campTierDefeated(monster.id)) state.campDefeated.push(monster.id);
          const last = index === CAMP_TIERS.length - 1;
          window.Minerous.switchScreen('bandit_camp');
          if (last) {
            window.Minerous.showToast('👑 The Bandit King has fallen!', { levelUp: true });
            // Killing the king is what unlocks the capital — let the gate notice.
            window.Minerous.Gate.checkAutoClears();
          } else {
            window.Minerous.showToast(`${monster.name} defeated — ${CAMP_TIERS[index + 1].label} lies beyond.`, { levelUp: true });
          }
        },
        onLose() {
          window.Minerous.switchScreen('bandit_camp');
          window.Minerous.showToast(`Driven out of ${tier.label}. Come back stronger.`);
        },
        onAbandon() {
          window.Minerous.showToast('You slipped back out of the camp.');
        },
      });
    });
  }

  function renderGrid() {
    el.grid.innerHTML = '';
    CAMP_TIERS.forEach((tier, index) => {
      const monster = monsterFor(tier);
      const done = window.Minerous.campTierDefeated(monster.id);
      const unlocked = window.Minerous.campTierUnlocked(index);

      const tile = document.createElement('button');
      tile.className = 'camp-tile' + (done ? ' cleared' : '') + (unlocked ? '' : ' locked');
      tile.disabled = !unlocked;
      tile.style.setProperty('--tier-color', monster.color);
      tile.innerHTML = `
        <div class="camp-tile-index">${done ? '✓' : unlocked ? index + 1 : '🔒'}</div>
        <div class="camp-tile-name">${tier.label}</div>
        <div class="camp-tile-monster">${unlocked || done ? monster.name : '???'}</div>
        <div class="camp-tile-meta">${
          done
            ? 'Cleared'
            : unlocked
            ? `Lv ${monster.level} boss · ${monster.maxHp} HP`
            : `Clear ${CAMP_TIERS[index - 1].label} first`
        }</div>
        <div class="camp-tile-blurb">${unlocked || done ? tier.blurb : ''}</div>
      `;
      tile.addEventListener('click', () => fight(tier, index));
      el.grid.appendChild(tile);
    });
  }

  window.Minerous.Bandit = {
    refresh() {
      renderStatus();
      renderGrid();
    },
    stop() {},
    tick() {},
  };
})();
