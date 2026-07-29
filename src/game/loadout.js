window.Minerous = window.Minerous || {};

(function () {
  const { state, getItem } = window.Minerous;

  const el = {
    equippedList: document.getElementById('loadout-equipped-list'),
    statsList: document.getElementById('loadout-stats-list'),
    featsHeader: document.getElementById('loadout-feats-header'),
    featsList: document.getElementById('loadout-feats-list'),
  };

  function renderEquippedRow({ label, item, meta, onUnequip }) {
    const row = document.createElement('div');
    row.className = 'node-card' + (item ? ' equipped' : '');
    row.innerHTML = `
      ${item ? window.Minerous.itemSwatch(item.id) : '<span class="node-swatch"></span>'}
      <span class="node-card-text">
        <div class="node-card-name">${label}: ${item ? item.name : 'None'}</div>
        <div class="node-card-meta">${item ? meta : 'Nothing equipped'}</div>
      </span>
    `;
    if (item && onUnequip) {
      const btn = document.createElement('button');
      btn.className = 'inv-action-btn';
      btn.textContent = 'Unequip';
      btn.addEventListener('click', onUnequip);
      row.appendChild(btn);
    }
    el.equippedList.appendChild(row);
  }

  function renderEquipped() {
    el.equippedList.innerHTML = '';

    const weapon = state.equippedWeaponId ? getItem(state.equippedWeaponId) : null;
    renderEquippedRow({
      label: 'Weapon',
      item: weapon,
      meta: weapon ? `+${weapon.damage} damage` : '',
      onUnequip: () => window.Minerous.unequipWeapon(),
    });

    const slotLabels = { helmet: 'Helmet', body: 'Body', legs: 'Legs' };
    for (const [slot, label] of Object.entries(slotLabels)) {
      const id = state.equippedArmor[slot];
      const item = id ? getItem(id) : null;
      renderEquippedRow({
        label,
        item,
        meta: item ? `+${item.defense} defense` : '',
        onUnequip: () => window.Minerous.unequipArmor(slot),
      });
    }

    const weaponStone = state.weaponSocket ? getItem(state.weaponSocket) : null;
    renderEquippedRow({
      label: 'Weapon Socket',
      item: weaponStone,
      meta: weaponStone ? weaponStone.description : '',
      onUnequip: null,
    });

    const armorStone = state.armorSocket ? getItem(state.armorSocket) : null;
    renderEquippedRow({
      label: 'Armor Socket',
      item: armorStone,
      meta: armorStone ? armorStone.description : '',
      onUnequip: null,
    });

    const clothing = state.equippedClothingId ? getItem(state.equippedClothingId) : null;
    renderEquippedRow({
      label: 'Clothing',
      item: clothing,
      meta: clothing ? clothing.description : '',
      onUnequip: () => window.Minerous.unequipClothing(),
    });
  }

  function statCard(name, value, color) {
    const card = document.createElement('div');
    card.className = 'node-card';
    card.innerHTML = `
      <span class="node-swatch" style="background:${color}"></span>
      <span class="node-card-text">
        <div class="node-card-name">${name}</div>
        <div class="node-card-meta">${value}</div>
      </span>
    `;
    el.statsList.appendChild(card);
  }

  function renderStats() {
    el.statsList.innerHTML = '';
    const stats = window.Minerous.Combat.getStats();
    statCard('Attack Power', `${stats.damageMin}-${stats.damageMax} damage`, '#d65c5c');
    statCard('Attack Speed', `Every ${(stats.attackMs / 1000).toFixed(1)}s`, '#4fd6c9');
    statCard('Accuracy', `${stats.accuracy}`, '#e0b33e');
    statCard('Defense', `${stats.evasion} evasion`, '#4d9fd6');
    statCard('Max HP', `${stats.maxHp}`, '#5fbf6f');
    statCard(
      'Deflect',
      stats.deflectChance
        ? `${Math.round(stats.deflectChance * 100)}% chance to deflect ${Math.round(stats.deflectPercent * 100)}%`
        : 'None',
      '#9a6bb8'
    );
  }

  // Combat Stats above already folds in the feats that touch damage, evasion and the
  // like — this section names them, and is the only place the out-of-combat ones
  // (extra ore, bonus xp, richer purses) are visible at all.
  function renderFeats() {
    const Feats = window.Minerous.Feats;
    const available = Feats.availablePoints();

    el.featsHeader.innerHTML = `
      <div>
        <div class="feats-char-level-value">Character Level <b>${Feats.characterLevel()}</b></div>
        <div class="node-card-meta">The sum of all your skill levels</div>
      </div>
      <div class="feats-point-summary">
        <span class="feats-points ${available > 0 ? 'has-points' : ''}">${available} feat point${available === 1 ? '' : 's'} available</span>
        <span class="node-card-meta">${Feats.spentPoints()} spent of ${Feats.totalPoints()} earned</span>
      </div>
    `;

    el.featsList.innerHTML = '';
    const owned = (state.feats || []).map((id) => window.Minerous.getFeat(id)).filter(Boolean);

    if (owned.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'node-list-note';
      empty.textContent = available > 0
        ? `No feats yet — you have ${available} point${available === 1 ? '' : 's'} waiting at the Hall of Champions in the Town of Lidas.`
        : 'No feats yet. Train any skill to raise your character level and earn feat points.';
      el.featsList.appendChild(empty);
      return;
    }

    for (const feat of owned) {
      const card = document.createElement('div');
      card.className = 'node-card feat-card equipped no-hover';
      card.innerHTML = `
        <span class="node-card-text">
          <div class="node-card-name">${feat.icon} ${feat.name}</div>
          <div class="node-card-meta feat-effect">${feat.effectText}</div>
          <div class="node-card-meta">${feat.category} · ${feat.points} point${feat.points === 1 ? '' : 's'}</div>
        </span>
      `;
      el.featsList.appendChild(card);
    }
  }

  window.Minerous.Loadout = {
    refresh() {
      renderEquipped();
      renderStats();
      renderFeats();
    },
    stop() {},
    tick() {},
  };
})();
