window.Minerous = window.Minerous || {};

(function () {
  const {
    MONSTERS,
    SKILLS,
    CLERIC_SPELLS,
    MONK_TECHNIQUES,
    state,
    getLevel,
    addXp,
    addItem,
    spendItems,
    getItem,
    getArmorDefense,
    getWeaponSocketEffects,
    getArmorSocketEffects,
    getMaxPrayerPoints,
    xpForLevel,
    MAX_LEVEL,
  } = window.Minerous;

  const ATTACK_STYLES = [
    { id: 'melee', label: '⚔ Melee' },
    { id: 'ranger', label: '🏹 Ranger' },
    { id: 'cleric', label: '🙏 Cleric' },
    { id: 'monk', label: '🧘 Monk' },
    { id: 'gunslinger', label: '🔫 Gunslinger' },
  ];

  const AUTO_EAT_THRESHOLD = 0.5;

  const BASE_PLAYER_ATTACK_MS = 2000;
  const MIN_PLAYER_ATTACK_MS = 600;
  const MONSTER_RESPAWN_MS = 1200;
  const DEFEAT_RECOVERY_MS = 3000;

  // The Battlegrounds screen doubles as the Boss Arena: the Home screen's Combat and
  // Bosses cards open the same screen with this flag flipped, and only the matching
  // category of enemies is listed.
  let bossMode = false;

  // A gate encounter is a fixed sequence of enemies fought back-to-back (an area
  // blocker). Clearing the whole sequence wins; dying at any point loses. While one is
  // running the enemy lists are hidden — you can't pick a different target.
  let gateEncounter = null;

  let activeMonsterId = null;
  let monsterHp = 0;
  let playerNextAttackAt = 0;
  let monsterNextAttackAt = 0;
  let familiarNextAttackAt = 0;
  let monsterRespawnAt = 0;
  let defeatedUntil = 0;
  let pendingBossConfirm = null;

  const bossEl = {
    modal: document.getElementById('boss-modal'),
    title: document.getElementById('boss-modal-title'),
    text: document.getElementById('boss-modal-text'),
    penalty: document.getElementById('boss-modal-penalty'),
    closeBtn: document.getElementById('boss-modal-close'),
    cancel: document.getElementById('boss-cancel-btn'),
    confirm: document.getElementById('boss-confirm-btn'),
  };

  const el = {
    level: document.getElementById('combat-level'),
    xpFill: document.getElementById('combat-xp-fill'),
    xpLabel: document.getElementById('combat-xp-label'),
    actionLabel: document.getElementById('combat-action-label'),
    title: document.getElementById('combat-title'),
    monsterHeading: document.getElementById('combat-monster-heading'),
    monsterList: document.getElementById('combat-monster-list'),
    bossHeading: document.getElementById('combat-boss-heading'),
    bossList: document.getElementById('combat-boss-list'),
    arm: document.getElementById('combat-character-arm'),
    monster: document.getElementById('combat-monster'),
    monsterShape: document.getElementById('combat-monster-shape'),
    familiar: document.getElementById('combat-familiar'),
    monsterName: document.getElementById('combat-monster-name'),
    monsterHpLabel: document.getElementById('combat-monster-hp-label'),
    monsterHpFill: document.getElementById('combat-monster-hp-fill'),
    playerHpLabel: document.getElementById('combat-player-hp-label'),
    playerHpFill: document.getElementById('combat-player-hp-fill'),
    weaponStatus: document.getElementById('combat-weapon-status'),
    armorStatus: document.getElementById('combat-armor-status'),
    prayerStatus: document.getElementById('combat-prayer-status'),
    familiarStatus: document.getElementById('combat-familiar-status'),
    skillName: document.getElementById('combat-skill-name'),
    attackStyleMenu: document.getElementById('attack-style-menu'),
    autoEatToggle: document.getElementById('combat-auto-eat-toggle'),
    log: document.getElementById('combat-log'),
  };

  el.autoEatToggle.addEventListener('change', () => {
    state.combat.autoEat = el.autoEatToggle.checked;
  });

  bossEl.closeBtn.addEventListener('click', () => closeBossWarning());
  bossEl.cancel.addEventListener('click', () => closeBossWarning());
  bossEl.confirm.addEventListener('click', () => {
    const confirmed = pendingBossConfirm;
    closeBossWarning();
    if (confirmed) confirmed();
  });
  bossEl.modal.addEventListener('click', (event) => {
    if (event.target === bossEl.modal) closeBossWarning();
  });

  const MAX_LOG_ENTRIES = 50;

  // Newest entry on top — appended chronologically, so a fresh combat.js load
  // (screen re-render) never has to reconstruct history, it just keeps growing.
  function logEvent(text, category = 'system') {
    const entry = document.createElement('div');
    entry.className = `combat-log-entry log-${category}`;
    entry.textContent = text;
    el.log.prepend(entry);
    while (el.log.children.length > MAX_LOG_ENTRIES) {
      el.log.removeChild(el.log.lastChild);
    }
  }

  function getMonster(id) {
    return MONSTERS.find((m) => m.id === id);
  }

  // A bow or a prayer book occupies the same weapon slot as a melee weapon —
  // whichever is equipped determines the attack style (and which skill's level
  // drives damage/accuracy).
  function getEquippedWeapon() {
    return state.equippedWeaponId ? getItem(state.equippedWeaponId) : null;
  }

  function getWeaponStyle() {
    const weapon = getEquippedWeapon();
    return (weapon && weapon.style) || 'melee';
  }

  function isRangerEquipped() {
    return getWeaponStyle() === 'ranger';
  }

  function isGunslingerEquipped() {
    return getWeaponStyle() === 'gunslinger';
  }

  // The consumable the equipped style spends per attack, or null for styles that don't.
  // `madeAt` finishes the sentence "Out of bullets! ..." in the action line.
  function ammoForStyle() {
    if (isRangerEquipped()) return { id: 'arrow', name: 'arrows', madeAt: 'Fletch' };
    if (isGunslingerEquipped()) return { id: 'bullet', name: 'bullets', madeAt: 'Smith' };
    return null;
  }

  function isClericEquipped() {
    return getWeaponStyle() === 'cleric';
  }

  function isMonkEquipped() {
    return getWeaponStyle() === 'monk';
  }

  // Dual-gated: the strongest technique whose Monk *and* Combat requirements you both
  // meet. A monk who only meditates stalls out just like one who only brawls.
  function getActiveTechnique() {
    const known = MONK_TECHNIQUES.filter(
      (t) => getLevel('monk') >= t.level && getLevel('combat') >= t.combatLevel
    );
    return known.length ? known[known.length - 1] : null;
  }

  // The highest-level spell the player's current Prayer level has unlocked —
  // Cleric spells are learned automatically via Worship, no separate pick step.
  // The area caps this too: the greater rites simply aren't taught out in the
  // village, so a cleric fighting there falls back to the lesser ones.
  function getActiveSpell() {
    const available = window.Minerous.filterByArea('cleric_spells', CLERIC_SPELLS);
    const known = available.filter((s) => getLevel('cleric') >= s.level);
    return known.length ? known[known.length - 1] : null;
  }

  function attackSkill() {
    const style = getWeaponStyle();
    if (style === 'ranger') return 'ranger';
    if (style === 'cleric') return 'cleric';
    if (style === 'monk') return 'monk';
    if (style === 'gunslinger') return 'gunslinger';
    return 'combat';
  }

  function featEffects() {
    return window.Minerous.Feats.getEffects();
  }

  function maxHp() {
    return 10 + getLevel('combat') * 2 + getArmorSocketEffects().hpBonus + featEffects().maxHpBonus;
  }

  function playerAttackMs() {
    const haste = getWeaponSocketEffects().hasteMs + featEffects().hasteMs;
    return Math.max(MIN_PLAYER_ATTACK_MS, BASE_PLAYER_ATTACK_MS - haste);
  }

  function damageRange() {
    const skill = attackSkill();
    const lvl = getLevel(skill);
    const weapon = getEquippedWeapon();
    let bonus =
      (weapon && weapon.damage ? weapon.damage : 0) +
      window.Minerous.Prayer.getActiveBuffEffects().damageBonus +
      getWeaponSocketEffects().damageBonus +
      featEffects().damageBonus;
    if (skill === 'cleric') {
      const spell = getActiveSpell();
      bonus += spell ? spell.damageBonus : 0;
    } else if (skill === 'monk') {
      const technique = getActiveTechnique();
      bonus += technique ? technique.damageBonus : 0;
    }
    return [1 + Math.floor(lvl / 4) + bonus, 3 + Math.floor(lvl / 3) + bonus];
  }

  function rollDamage([min, max]) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // RuneScape-style combat: accuracy vs. evasion decides hit-or-miss; damage is only
  // rolled (at full strength) when the attack actually lands. Never guarantees a hit
  // or a miss — a huge evasion edge just makes landing a hit rarer, not impossible.
  function computeHitChance(attackerAccuracy, defenderEvasion) {
    return attackerAccuracy / (attackerAccuracy + defenderEvasion);
  }

  function playerEvasion() {
    return (
      getLevel('combat') +
      getArmorDefense() +
      getArmorSocketEffects().defenseBonus +
      window.Minerous.Prayer.getActiveBuffEffects().evasionBonus +
      featEffects().evasionBonus
    );
  }

  function playerAccuracy() {
    const base = getLevel(attackSkill()) + getWeaponSocketEffects().accuracyBonus;
    // A night in a tavern bed sharpens the eye — a multiplier, so it stays relevant
    // at level 60 the way a flat bonus wouldn't.
    return base * window.Minerous.restedMultiplier();
  }

  // Gated by whichever combat style is further along — a ranger- or cleric-focused
  // player shouldn't be locked out of tougher monsters just because Combat (melee)
  // is low.
  function isUnlocked(monster) {
    return Math.max(
      getLevel('combat'), getLevel('ranger'), getLevel('cleric'), getLevel('monk'), getLevel('gunslinger')
    ) >= monster.level;
  }

  function ensurePlayerHp() {
    if (state.combat.hp === null) state.combat.hp = maxHp();
  }

  function renderMonsterList() {
    if (gateEncounter) {
      el.title.textContent = gateEncounter.title;
      el.monsterHeading.hidden = true;
      el.monsterList.hidden = true;
      el.bossHeading.hidden = true;
      el.bossList.hidden = true;
      el.monsterList.innerHTML = '';
      el.bossList.innerHTML = '';
      return;
    }

    el.title.textContent = bossMode ? 'Boss Arena' : 'Battlegrounds';
    el.monsterHeading.hidden = bossMode;
    el.monsterList.hidden = bossMode;
    el.bossHeading.hidden = !bossMode;
    el.bossList.hidden = !bossMode;

    el.monsterList.innerHTML = '';
    el.bossList.innerHTML = '';
    // Each area fields its own Battlegrounds roster; the Boss Arena is shared. Sorted
    // by level because an area's roster is assembled from several places in MONSTERS
    // and the declaration order says nothing useful to the player.
    const roster = (bossMode ? MONSTERS.filter((m) => m.boss && !m.gateBoss) : window.Minerous.getAreaMonsters())
      .slice()
      .sort((a, b) => a.level - b.level);
    for (const monster of roster) {
      if (!!monster.boss !== bossMode) continue;
      const unlocked = isUnlocked(monster);
      const btn = document.createElement('button');
      btn.className = 'node-card' + (unlocked ? '' : ' locked') + (activeMonsterId === monster.id ? ' active' : '');
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="node-swatch" style="background:${monster.color}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${monster.boss ? '☠ ' : ''}${monster.name}</div>
          <div class="node-card-meta">${unlocked ? `Lv ${monster.level} · ${monster.xp} xp` : `Requires level ${monster.level}`}</div>
        </span>
      `;
      btn.addEventListener('click', () => onMonsterClick(monster));
      (monster.boss ? el.bossList : el.monsterList).appendChild(btn);
    }
  }

  function renderHpBars() {
    ensurePlayerHp();
    const pMax = maxHp();
    el.playerHpLabel.textContent = `${Math.max(0, state.combat.hp)} / ${pMax}`;
    el.playerHpFill.style.width = `${Math.max(0, (state.combat.hp / pMax) * 100)}%`;

    if (activeMonsterId) {
      const monster = getMonster(activeMonsterId);
      el.monsterName.textContent = monster.name;
      el.monsterHpLabel.textContent = `${Math.max(0, monsterHp)} / ${monster.maxHp}`;
      el.monsterHpFill.style.width = `${Math.max(0, (monsterHp / monster.maxHp) * 100)}%`;
    } else {
      el.monsterName.textContent = 'No target';
      el.monsterHpLabel.textContent = '0 / 0';
      el.monsterHpFill.style.width = '0%';
    }
  }

  function renderWeaponStatus() {
    const weapon = getEquippedWeapon();
    let base = weapon ? `Weapon: ${weapon.name} (+${weapon.damage} dmg)` : 'Weapon: Fists';
    if (weapon && weapon.style === 'ranger') {
      base += ` [Ranger] · Arrows: ${state.inventory.arrow || 0}`;
    } else if (weapon && weapon.style === 'gunslinger') {
      base += ` [Gunslinger] · Bullets: ${state.inventory.bullet || 0}`;
    } else if (weapon && weapon.style === 'cleric') {
      const spell = getActiveSpell();
      base += spell
        ? ` [Cleric] · ${spell.name} (${spell.pointCost} pts/cast) · Prayer Points: ${Math.ceil(state.prayer.points || 0)}`
        : ` [Cleric] · No spell known yet — Worship to learn one`;
    } else if (weapon && weapon.style === 'monk') {
      const technique = getActiveTechnique();
      base += technique
        ? ` [Monk] · ${technique.name} (+${technique.damageBonus} dmg)`
        : ` [Monk] · No technique known yet — meditate and raise Combat`;
    }
    const socket = state.weaponSocket ? getItem(state.weaponSocket) : null;
    el.weaponStatus.textContent = socket ? `${base} · Socketed: ${socket.name}` : base;
  }

  // Progress in the skill the equipped style trains. Melee trains Combat, which the
  // panel's own level row already shows, so the line only appears for the styles that
  // have a skill of their own — otherwise Ranger, Cleric and Monk xp would tick up with
  // nothing on screen to show it.
  // The headline level bar at the top of the screen tracks whichever skill your gear is
  // actually training — not always Melee, which is what it used to do. Fighting as a
  // Gunslinger meant watching a Melee bar sit at 0 while the gunslinger xp piled up out of
  // sight further down the panel, which reads as "this class earns no xp".
  function renderStyleLevel() {
    const skill = attackSkill();
    const name = (SKILLS.find((s) => s.id === skill) || {}).name || skill;
    el.skillName.textContent = name;
    window.Minerous.renderSkillLevelRow('combat', skill);
  }

  // A read-only badge of which style is driving your damage. Changing style means changing
  // weapon, and that is deliberately not possible from here — see the Loadout screen. It
  // used to be a quick-swap menu, which let you re-class mid-fight.
  function renderAttackStyleMenu() {
    const current = getWeaponStyle();
    el.attackStyleMenu.innerHTML = '';
    for (const style of ATTACK_STYLES) {
      const badge = document.createElement('span');
      badge.className = `attack-style-badge style-${style.id}` + (current === style.id ? ' active' : '');
      badge.textContent = style.label;
      el.attackStyleMenu.appendChild(badge);
    }
    const hint = document.createElement('span');
    hint.className = 'attack-style-hint';
    hint.textContent = 'Change gear in Loadout';
    el.attackStyleMenu.appendChild(hint);
  }

  function getBestFood() {
    const owned = window.Minerous.getFoods().filter((f) => (state.inventory[f.id] || 0) > 0);
    if (owned.length === 0) return null;
    return owned.reduce((best, f) => (f.heal > best.heal ? f : best), owned[0]);
  }

  function maybeAutoEat() {
    if (!state.combat.autoEat || defeatedUntil) return;
    ensurePlayerHp();
    if (state.combat.hp >= maxHp() * AUTO_EAT_THRESHOLD) return;
    const food = getBestFood();
    if (!food) return;
    spendItems({ [food.id]: 1 });
    state.combat.hp = Math.min(maxHp(), state.combat.hp + food.heal);
    window.Minerous.renderInventory();
    logEvent(`🍗 Auto-ate ${food.name} (+${food.heal} HP).`, 'system');
    renderHpBars();
  }

  function renderArmorStatus() {
    const names = Object.values(state.equippedArmor)
      .filter(Boolean)
      .map((id) => getItem(id).name);
    const total = getArmorDefense() + getArmorSocketEffects().defenseBonus;
    const base = names.length ? `Armor: ${names.join(', ')} (+${total} def)` : 'Armor: None';
    const socket = state.armorSocket ? getItem(state.armorSocket) : null;
    el.armorStatus.textContent = socket ? `${base} · Socketed: ${socket.name}` : base;
  }

  function renderPrayerStatus() {
    const names = window.Minerous.Prayer.getActiveBuffNames();
    el.prayerStatus.textContent = `Active Blessings: ${names.length ? names.join(', ') : 'None'}`;
  }

  function renderFamiliarStatus() {
    const familiar = window.Minerous.Summoning.getActiveFamiliar();
    el.familiarStatus.textContent = familiar ? `Familiar: ${familiar.name}` : 'Familiar: None';

    el.familiar.hidden = !familiar;
    if (familiar) {
      el.familiar.style.color = familiar.color;
      el.familiar.classList.toggle('passive', !familiar.familiarAttack);
    }
  }

  // Nobody should walk into a losable-stakes fight by misclicking a list.
  function showBossWarning(monster, onConfirm) {
    const penalty = window.Minerous.bossDefeatPenalty(monster.level);
    const skillName = (SKILLS.find((s) => s.id === attackSkill()) || {}).name || 'Combat';
    bossEl.title.textContent = `⚠ ${monster.name}`;
    bossEl.text.textContent =
      `A level ${monster.level} boss — far tougher than any monster of its level. ` +
      'Come fully armoured and armed for its tier, or don\'t come at all.';
    bossEl.penalty.textContent = `If you lose: −${penalty.coins} gold and −${penalty.xp} ${skillName} xp.`;
    // Some bosses are already "The Bandit King" — don't hand them a second article.
    const article = /^the\b/i.test(monster.name) ? '' : 'the ';
    bossEl.confirm.textContent = `Face ${article}${monster.name}`;
    pendingBossConfirm = onConfirm;
    bossEl.modal.hidden = false;
  }

  function closeBossWarning() {
    bossEl.modal.hidden = true;
    pendingBossConfirm = null;
  }

  function onMonsterClick(monster) {
    if (!isUnlocked(monster)) {
      window.Minerous.showToast(`Requires Combat level ${monster.level}`);
      return;
    }
    if (activeMonsterId === monster.id) {
      retreat();
      return;
    }
    if (monster.boss) {
      showBossWarning(monster, () => startFight(monster.id));
      return;
    }
    startFight(monster.id);
  }

  function startFight(monsterId) {
    activeMonsterId = monsterId;
    const monster = getMonster(monsterId);
    monsterHp = monster.maxHp;
    monsterRespawnAt = 0;
    const now = performance.now();
    playerNextAttackAt = now + playerAttackMs();
    monsterNextAttackAt = now + monster.attackMs;
    const familiar = window.Minerous.Summoning.getActiveFamiliar();
    if (familiar && familiar.familiarAttack) {
      familiarNextAttackAt = now + familiar.familiarAttack.attackMs;
    }
    el.monster.hidden = false;
    el.monster.classList.remove('defeated');
    el.monsterShape.style.background = monster.color;
    el.arm.classList.add('swinging');
    el.actionLabel.textContent = `Fighting ${monster.name}...`;
    logEvent(`⚔ You engage a ${monster.name}!`, 'system');
    renderMonsterList();
    renderHpBars();
  }

  function retreat() {
    if (activeMonsterId) {
      logEvent(`You retreat from the ${getMonster(activeMonsterId).name}.`, 'system');
    }
    activeMonsterId = null;
    el.monster.hidden = true;
    el.arm.classList.remove('swinging');
    el.actionLabel.textContent = 'Select a monster to fight';
    renderMonsterList();
    renderHpBars();
  }

  function flashHit(target, className = 'hit') {
    target.classList.remove(className);
    void target.offsetWidth;
    target.classList.add(className);
  }

  function handleMonsterDefeated(monster) {
    const skill = attackSkill();
    const leveledUp = addXp(skill, monster.xp);
    state.kills[monster.id] = (state.kills[monster.id] || 0) + 1;

    let coins = monster.coinsMin + Math.floor(Math.random() * (monster.coinsMax - monster.coinsMin + 1));
    let meat = monster.meatId ? monster.meatMin + Math.floor(Math.random() * (monster.meatMax - monster.meatMin + 1)) : 0;
    let bones = monster.bonesMin ? monster.bonesMin + Math.floor(Math.random() * (monster.bonesMax - monster.bonesMin + 1)) : 0;
    const extraDrops = (monster.extraDrops || []).map((drop) => ({
      id: drop.id,
      qty: drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1)),
    }));

    const familiar = window.Minerous.Summoning.getActiveFamiliar();
    let lootMultiplier = 1;
    if (familiar && familiar.lootChance && Math.random() < familiar.lootChance) {
      lootMultiplier = Math.random() < 0.5 ? 2 : 3;
      coins *= lootMultiplier;
      meat *= lootMultiplier;
      bones *= lootMultiplier;
      extraDrops.forEach((drop) => (drop.qty *= lootMultiplier));
    }

    const feats = featEffects();
    if (feats.coinBonus > 0) coins = Math.round(coins * (1 + feats.coinBonus));

    addItem('coins', coins);
    if (monster.meatId && meat > 0) addItem(monster.meatId, meat);
    if (monster.bonesMin && bones > 0) addItem('bones', bones);
    extraDrops.forEach((drop) => addItem(drop.id, drop.qty));

    // A Cleric's divine reward: a kill made with a spell fully refills prayer points,
    // so a sustained streak of kills never runs the well dry — only a slow fight does.
    if (skill === 'cleric') {
      state.prayer.points = getMaxPrayerPoints();
      window.Minerous.Prayer.renderPanel();
    }

    if (feats.healOnKillPercent > 0 && state.combat.hp < maxHp()) {
      const healed = Math.min(Math.round(maxHp() * feats.healOnKillPercent), maxHp() - state.combat.hp);
      state.combat.hp += healed;
      if (healed > 0) logEvent(`🌬 Second Wind restores ${healed} HP.`, 'system');
    }

    window.Minerous.renderInventory();
    renderStyleLevel();

    if (leveledUp) {
      const skillName = (SKILLS.find((s) => s.id === skill) || {}).name || 'Combat';
      window.Minerous.showToast(`Level up! ${skillName} level ${getLevel(skill)}`, { levelUp: true });
    }
    if (lootMultiplier > 1) {
      window.Minerous.showToast(`${familiar.name} multiplied your loot x${lootMultiplier}!`, { levelUp: true });
    }

    el.monster.classList.add('defeated');
    monsterRespawnAt = performance.now() + MONSTER_RESPAWN_MS;
    el.actionLabel.textContent = `Defeated ${monster.name}! (+${monster.xp} xp, +${coins} coins)`;
    logEvent(`💀 Defeated the ${monster.name}! (+${monster.xp} xp, +${coins} coins)`, 'system');

    if (gateEncounter) {
      gateEncounter.defeated += 1;
      if (gateEncounter.defeated >= gateEncounter.count) {
        finishGateEncounter(true);
      } else {
        logEvent(
          `⚔ ${gateEncounter.count - gateEncounter.defeated} of ${gateEncounter.count} still standing...`,
          'system'
        );
      }
    }
  }

  // Losing to a boss costs coin and experience, scaled to the boss's level. The xp
  // hit never costs you a level — it eats into progress toward the next one and stops
  // at the floor, so a bad run sets you back rather than undoing what you've earned.
  function applyBossDefeatPenalty(monster) {
    const penalty = window.Minerous.bossDefeatPenalty(monster.level);
    const skill = attackSkill();

    const coinsLost = Math.min(state.inventory.coins || 0, penalty.coins);
    if (coinsLost > 0) spendItems({ coins: coinsLost });

    // Deep enough a loss and the skill drops a level; loseXp announces that itself.
    const { lost: xpLost } = window.Minerous.loseXp(skill, penalty.xp);

    const skillName = (SKILLS.find((s) => s.id === skill) || {}).name || skill;
    if (coinsLost > 0 || xpLost > 0) {
      logEvent(`☠ Defeat costs you ${coinsLost} gold and ${xpLost} ${skillName} xp.`, 'system');
      window.Minerous.showToast(`Defeated! Lost ${coinsLost} gold and ${xpLost} ${skillName} xp`);
    } else {
      logEvent('☠ You had nothing left to lose.', 'system');
      window.Minerous.showToast('Defeated! You had nothing left to lose.');
    }

    window.Minerous.renderInventory();
    renderStyleLevel();
  }

  // Ends the encounter and hands the result back to whoever started it (gate.js).
  // Cleared first so the normal combat screen is restored before the callback runs.
  function finishGateEncounter(won) {
    const encounter = gateEncounter;
    gateEncounter = null;
    activeMonsterId = null;
    monsterRespawnAt = 0;
    // Clear the death timer and heal up. The gold and xp already came off in
    // applyBossDefeatPenalty; no reason to also send them home crippled.
    defeatedUntil = 0;
    state.combat.hp = maxHp();
    el.monster.hidden = true;
    el.arm.classList.remove('swinging');
    logEvent(won ? `🎉 You cleared ${encounter.title}!` : `☠ You were driven back from ${encounter.title}.`, 'system');
    renderMonsterList();
    renderHpBars();
    if (won) encounter.onWin();
    else encounter.onLose();
  }

  window.Minerous.Combat = {
    // The hook for driving the sprite's animation from your active technique, so that
    // dual-gate rule stays derived here rather than duplicated — not consumed yet.
    getActiveTechnique,
    // Single source of truth for derived combat numbers — used by the Loadout screen
    // so it never has to duplicate (and risk drifting from) this module's math.
    getStats() {
      const [damageMin, damageMax] = damageRange();
      const armorEffects = getArmorSocketEffects();
      return {
        damageMin,
        damageMax,
        attackMs: playerAttackMs(),
        accuracy: playerAccuracy(),
        evasion: playerEvasion(),
        maxHp: maxHp(),
        deflectChance: armorEffects.deflectChance,
        deflectPercent: armorEffects.deflectPercent,
      };
    },
    refresh() {
      ensurePlayerHp();
      // Travelling leaves the local wildlife behind — don't keep swinging at a monster
      // that doesn't roam the area you're now standing in.
      if (activeMonsterId && !gateEncounter && !bossMode && !window.Minerous.getAreaMonsters().some((m) => m.id === activeMonsterId)) {
        retreat();
      }
      renderMonsterList();
      renderWeaponStatus();
      renderArmorStatus();
      renderPrayerStatus();
      renderFamiliarStatus();
      renderStyleLevel();
      renderAttackStyleMenu();
      el.autoEatToggle.checked = state.combat.autoEat;
      renderHpBars();
      if (!activeMonsterId) {
        el.actionLabel.textContent = 'Select a monster to fight';
      }
    },
    stop() {
      // Walking away from a gate encounter abandons it — no loss penalty, but the
      // blocker stays uncleared and has to be attempted again from the start.
      if (gateEncounter) {
        const encounter = gateEncounter;
        gateEncounter = null;
        encounter.onAbandon();
      }
      retreat();
      const deactivated = window.Minerous.Prayer.deactivateBuffs();
      if (deactivated.length) {
        window.Minerous.showToast(`Blessings deactivated: ${deactivated.join(', ')}`);
      }
    },
    // Called by the Home screen's Combat/Bosses cards before switching here.
    setBossMode(enabled) {
      bossMode = enabled;
    },
    isInGateEncounter() {
      return !!gateEncounter;
    },
    // Shows the same stakes warning the Boss Arena uses, for bosses reached from
    // elsewhere (the Bandit Camp tiles). Calls back only if the player commits.
    confirmBossFight(monster, onConfirm) {
      showBossWarning(monster, onConfirm);
    },
    // Fights `count` copies of a monster back-to-back. Caller supplies the outcome
    // handlers; see gate.js for the area-blocker flow that uses this.
    startGateEncounter({ title, monsterId, count, onWin, onLose, onAbandon }) {
      bossMode = false;
      // Switch first: switchScreen stops the outgoing module, and if we were already
      // on this screen that stop() would see the new encounter and abandon it.
      window.Minerous.switchScreen('combat');
      gateEncounter = { title, monsterId, count, defeated: 0, onWin, onLose, onAbandon };
      ensurePlayerHp();
      state.combat.hp = maxHp();
      defeatedUntil = 0;
      logEvent(`⚔ ${title}: ${count} enemies bar your way!`, 'system');
      startFight(monsterId);
    },
    refreshWeaponStatus() {
      renderWeaponStatus();
      renderAttackStyleMenu();
    },
    refreshArmorStatus() {
      renderArmorStatus();
    },
    heal(amount) {
      ensurePlayerHp();
      if (defeatedUntil) return;
      state.combat.hp = Math.min(maxHp(), state.combat.hp + amount);
      renderHpBars();
    },
    tick() {
      const now = performance.now();
      renderPrayerStatus();
      renderFamiliarStatus();

      if (defeatedUntil) {
        const remaining = Math.max(0, defeatedUntil - now);
        el.actionLabel.textContent = `Defeated! Recovering... (${Math.ceil(remaining / 1000)}s)`;
        if (now >= defeatedUntil) {
          defeatedUntil = 0;
          state.combat.hp = maxHp();
          el.actionLabel.textContent = 'Select a monster to fight';
          renderHpBars();
        }
        return;
      }

      if (!activeMonsterId) return;

      if (monsterRespawnAt) {
        if (now >= monsterRespawnAt) {
          const monster = getMonster(activeMonsterId);
          monsterHp = monster.maxHp;
          monsterRespawnAt = 0;
          el.monster.classList.remove('defeated');
          const attackNow = performance.now();
          playerNextAttackAt = attackNow + playerAttackMs();
          monsterNextAttackAt = attackNow + monster.attackMs;
          const familiar = window.Minerous.Summoning.getActiveFamiliar();
          if (familiar && familiar.familiarAttack) {
            familiarNextAttackAt = attackNow + familiar.familiarAttack.attackMs;
          }
          logEvent(`⚔ A new ${monster.name} appears!`, 'system');
          renderHpBars();
        }
        return;
      }

      const monster = getMonster(activeMonsterId);
      const cleric = isClericEquipped();
      const activeSpell = cleric ? getActiveSpell() : null;
      // Ranger and Gunslinger both spend a consumable per shot, differing only in which
      // one and where you make it.
      const ammo = ammoForStyle();
      const outOfAmmo = !!ammo && (state.inventory[ammo.id] || 0) <= 0;
      const outOfPoints = cleric && (!activeSpell || (state.prayer.points || 0) < activeSpell.pointCost);
      const blocked = outOfAmmo || outOfPoints;
      el.actionLabel.textContent = outOfAmmo
        ? `Out of ${ammo.name}! ${ammo.madeAt} more to keep fighting the ${monster.name}.`
        : outOfPoints
        ? `Out of prayer points! Commune or land a kill to keep fighting the ${monster.name}.`
        : `Fighting ${monster.name}...`;
      renderWeaponStatus();
      maybeAutoEat();

      if (now >= playerNextAttackAt && blocked) {
        playerNextAttackAt = now + playerAttackMs();
        // Still ticks on the normal attack cadence, so the warning repeats once per
        // swing instead of once ever — a clear, recurring nudge to switch styles or flee.
        // No `return` here: the familiar and monster still act this frame — only the
        // player's own attack (and its resource cost) is skipped.
        logEvent(
          outOfAmmo
            ? `⚠ You're out of ${ammo.name}! Change your loadout or retreat from the ${monster.name}.`
            : `⚠ You're out of prayer points! Change your loadout or retreat from the ${monster.name}.`,
          'system'
        );
      } else if (now >= playerNextAttackAt) {
        playerNextAttackAt = now + playerAttackMs();
        if (ammo) spendItems({ [ammo.id]: 1 });
        if (cleric) {
          state.prayer.points = Math.max(0, state.prayer.points - activeSpell.pointCost);
          state.actions.cleric_cast = (state.actions.cleric_cast || 0) + 1;
          window.Minerous.Prayer.renderPanel();
        }
        if (Math.random() < computeHitChance(playerAccuracy(), monster.level)) {
          const feats = featEffects();
          let dmg = rollDamage(damageRange());
          const crit = feats.critChance > 0 && Math.random() < feats.critChance;
          if (crit) dmg = Math.round(dmg * feats.critMultiplier);
          monsterHp = Math.max(0, monsterHp - dmg);
          flashHit(el.monsterShape);
          logEvent(
            cleric
              ? `You cast ${activeSpell.name} on the ${monster.name} for ${dmg} damage${crit ? ' — a critical strike!' : ''}.`
              : `You hit the ${monster.name} for ${dmg} damage${crit ? ' — a critical strike!' : ''}.`,
            'player'
          );
          if (feats.lifesteal > 0 && state.combat.hp < maxHp()) {
            const healed = Math.min(feats.lifesteal, maxHp() - state.combat.hp);
            state.combat.hp += healed;
            if (healed > 0) logEvent(`🩸 Lifedrinker restores ${healed} HP.`, 'system');
          }
        } else {
          logEvent(
            cleric ? `Your ${activeSpell.name} fizzles against the ${monster.name}.` : `You miss the ${monster.name}.`,
            'player'
          );
        }
        renderHpBars();

        if (monsterHp <= 0) {
          handleMonsterDefeated(monster);
          return;
        }
      }

      const familiar = window.Minerous.Summoning.getActiveFamiliar();
      if (familiar && familiar.familiarAttack && monsterHp > 0 && now >= familiarNextAttackAt) {
        const bond = featEffects().familiarDamageBonus;
        const dmg = rollDamage([familiar.familiarAttack.damageMin + bond, familiar.familiarAttack.damageMax + bond]);
        monsterHp = Math.max(0, monsterHp - dmg);
        familiarNextAttackAt = now + familiar.familiarAttack.attackMs;
        flashHit(el.monsterShape);
        flashHit(el.familiar, 'attacking');
        logEvent(`${familiar.name} hits the ${monster.name} for ${dmg} damage.`, 'familiar');
        renderHpBars();

        if (monsterHp <= 0) {
          handleMonsterDefeated(monster);
          return;
        }
      }

      if (now >= monsterNextAttackAt) {
        monsterNextAttackAt = now + monster.attackMs;
        if (Math.random() < computeHitChance(monster.level, playerEvasion())) {
          let dmg = rollDamage([monster.damageMin, monster.damageMax]);
          const { deflectChance, deflectPercent } = getArmorSocketEffects();
          let deflected = false;
          if (deflectChance && Math.random() < deflectChance) {
            dmg = Math.round(dmg * (1 - deflectPercent));
            deflected = true;
          }
          state.combat.hp = Math.max(0, state.combat.hp - dmg);
          logEvent(`${monster.name} hits you for ${dmg} damage${deflected ? ' (deflected!)' : ''}.`, 'monster');
        } else {
          logEvent(`${monster.name} misses you.`, 'monster');
        }
        renderHpBars();

        if (state.combat.hp <= 0) {
          defeatedUntil = now + DEFEAT_RECOVERY_MS;
          activeMonsterId = null;
          el.monster.hidden = true;
          el.arm.classList.remove('swinging');
          logEvent(`You were defeated by the ${monster.name}!`, 'system');
          if (monster.boss) applyBossDefeatPenalty(monster);
          // Dying to a quest target fails that quest — see getQuestFailure.
          window.Minerous.Quests.notifyDeath(monster.id);
          if (gateEncounter) finishGateEncounter(false);
          renderMonsterList();
        }
      }
    },
  };
})();
