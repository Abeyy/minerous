window.Minerous = window.Minerous || {};

(function () {
  const { FEATS, SKILLS, LEVELS_PER_FEAT_POINT, state, getLevel, getItem, addItem, spendItems, hasItems } = window.Minerous;

  const el = {
    charLevel: document.getElementById('feats-char-level'),
    pointSummary: document.getElementById('feats-point-summary'),
    list: document.getElementById('feats-list'),
    reset: document.getElementById('feats-reset'),
  };

  // Character level is the sum of every skill level — training anything at all moves
  // it, so no build is locked out of feats.
  function characterLevel() {
    return SKILLS.reduce((sum, skill) => sum + getLevel(skill.id), 0);
  }

  function totalPoints() {
    return Math.floor(characterLevel() / LEVELS_PER_FEAT_POINT);
  }

  function ownedFeats() {
    return (state.feats || []).map((id) => window.Minerous.getFeat(id)).filter(Boolean);
  }

  function spentPoints() {
    return ownedFeats().reduce((sum, feat) => sum + feat.points, 0);
  }

  function availablePoints() {
    return totalPoints() - spentPoints();
  }

  function hasFeat(id) {
    return (state.feats || []).includes(id);
  }

  // Every feat's numbers folded into one object, so callers ask for a single value
  // rather than walking the list themselves.
  function getEffects() {
    const totals = {
      damageBonus: 0,
      evasionBonus: 0,
      maxHpBonus: 0,
      hasteMs: 0,
      critChance: 0,
      critMultiplier: 1,
      lifesteal: 0,
      healOnKillPercent: 0,
      doubleOreChance: 0,
      doubleLogChance: 0,
      xpBonus: 0,
      // Per-skill xp on top of the global bonus, keyed by skill id.
      skillXpBonus: {},
      coinBonus: 0,
      familiarDamageBonus: 0,
      prayerDrainReduction: 0,
    };
    for (const feat of ownedFeats()) {
      for (const [key, value] of Object.entries(feat.effects)) {
        // critMultiplier replaces rather than accumulates — two sources of "double
        // damage" shouldn't quietly become quadruple.
        if (key === 'critMultiplier') {
          totals[key] = Math.max(totals[key], value);
        } else if (key === 'skillXpBonus') {
          for (const [skill, amount] of Object.entries(value)) {
            totals.skillXpBonus[skill] = (totals.skillXpBonus[skill] || 0) + amount;
          }
        } else {
          totals[key] = (totals[key] || 0) + value;
        }
      }
    }
    return totals;
  }

  function costLabel(cost) {
    return Object.entries(cost)
      .map(([id, qty]) => {
        if (id === 'coins') return `${qty} coins`;
        const item = getItem(id);
        return `${qty}x ${item ? item.name : id}`;
      })
      .join(' + ');
  }

  function missingLabel(cost) {
    const short = Object.entries(cost).filter(([id, qty]) => (state.inventory[id] || 0) < qty);
    if (short.length === 0) return null;
    return short
      .map(([id, qty]) => {
        const have = state.inventory[id] || 0;
        const item = getItem(id);
        return `${qty - have} more ${id === 'coins' ? 'coins' : item ? item.name : id}`;
      })
      .join(', ');
  }

  function unlockFeat(feat) {
    if (hasFeat(feat.id)) return;
    if (availablePoints() < feat.points) {
      window.Minerous.showToast(`Needs ${feat.points} feat point${feat.points === 1 ? '' : 's'} — you have ${availablePoints()}`);
      return;
    }
    if (!hasItems(feat.cost)) {
      window.Minerous.showToast(`Missing ${missingLabel(feat.cost)}`);
      return;
    }
    spendItems(feat.cost);
    state.feats.push(feat.id);
    window.Minerous.renderInventory();
    render();
    window.Minerous.showToast(`Feat unlocked: ${feat.name}`, { levelUp: true });
  }

  function resetFeats() {
    const spent = spentPoints();
    if (spent === 0) {
      window.Minerous.showToast('You have no feats to reset');
      return;
    }
    const price = window.Minerous.featResetCost(spent);
    if (!hasItems({ coins: price })) {
      window.Minerous.showToast(`Not enough coins (need ${price})`);
      return;
    }
    spendItems({ coins: price });
    // Points come back; the materials do not. That's the cost of changing your mind.
    // Story feats survive — they cost no points, and you can't re-earn them.
    const kept = state.feats.filter((id) => (window.Minerous.getFeat(id) || {}).secret);
    state.feats.length = 0;
    kept.forEach((id) => state.feats.push(id));
    window.Minerous.renderInventory();
    render();
    window.Minerous.showToast(`${spent} feat point${spent === 1 ? '' : 's'} refunded`);
  }

  function renderHeader() {
    const level = characterLevel();
    const toNext = LEVELS_PER_FEAT_POINT - (level % LEVELS_PER_FEAT_POINT);
    el.charLevel.innerHTML = `
      <div class="feats-char-level-value">Character Level <b>${level}</b></div>
      <div class="node-card-meta">The sum of all your skill levels · ${toNext} more level${toNext === 1 ? '' : 's'} to your next feat point</div>
    `;

    const available = availablePoints();
    el.pointSummary.innerHTML = `
      <span class="feats-points ${available > 0 ? 'has-points' : ''}">${available} feat point${available === 1 ? '' : 's'} available</span>
      <span class="node-card-meta">${spentPoints()} spent of ${totalPoints()} earned</span>
    `;
  }

  function renderList() {
    el.list.innerHTML = '';
    // Story feats stay off the board until you've earned them — no teasing a reward
    // you can't buy your way to.
    const visible = FEATS.filter((f) => !f.secret || hasFeat(f.id));
    const categories = [...new Set(visible.map((f) => f.category))];

    for (const category of categories) {
      const heading = document.createElement('h4');
      heading.className = 'feats-category';
      heading.textContent = category;
      el.list.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'node-list';

      for (const feat of FEATS.filter((f) => f.category === category)) {
        const owned = hasFeat(feat.id);
        const affordable = hasItems(feat.cost);
        const enoughPoints = availablePoints() >= feat.points;
        const buyable = !owned && affordable && enoughPoints;

        const card = document.createElement('button');
        card.className = 'node-card feat-card' + (owned ? ' met' : buyable ? '' : ' locked');
        card.disabled = owned;
        card.innerHTML = `
          <span class="node-card-text">
            <div class="node-card-name">${feat.icon} ${feat.name}${owned ? ' · UNLOCKED' : ''}</div>
            <div class="node-card-meta feat-effect">${feat.effectText}</div>
            <div class="node-card-meta feat-flavour">${feat.description}</div>
            <div class="node-card-meta">${feat.points} point${feat.points === 1 ? '' : 's'} · ${costLabel(feat.cost)}</div>
            ${owned || (affordable && enoughPoints) ? '' : `<div class="node-card-meta feat-missing">${!enoughPoints ? `Needs ${feat.points} feat point${feat.points === 1 ? '' : 's'}` : `Missing ${missingLabel(feat.cost)}`}</div>`}
          </span>
        `;
        card.addEventListener('click', () => unlockFeat(feat));
        grid.appendChild(card);
      }
      el.list.appendChild(grid);
    }
  }

  function renderReset() {
    const spent = spentPoints();
    const price = window.Minerous.featResetCost(spent);
    el.reset.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'tavern-rest-card';
    card.innerHTML = `
      <div class="tavern-rest-text">
        <div class="tavern-rest-name">🔄 Forget Your Training</div>
        <div class="node-card-meta">${spent === 0 ? 'You have no feats to reset.' : `Refunds all ${spent} spent point${spent === 1 ? '' : 's'} for ${price} coins. Materials are not returned.`}</div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.className = 'inv-action-btn tavern-rest-btn';
    btn.textContent = spent === 0 ? 'Nothing to reset' : `Reset · ${price} coins`;
    btn.disabled = spent === 0;
    btn.addEventListener('click', resetFeats);
    card.appendChild(btn);
    el.reset.appendChild(card);
  }

  function render() {
    renderHeader();
    renderList();
    renderReset();
  }

  window.Minerous.Feats = {
    characterLevel,
    totalPoints,
    spentPoints,
    availablePoints,
    hasFeat,
    getEffects,
    refresh: render,
    stop() {},
    tick() {},
  };
})();
