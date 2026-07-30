(function () {
  const { state, MAX_LEVEL, xpForLevel, getLevel, getItem } = window.Minerous;

  const homeBtn = document.getElementById('nav-home-btn');
  const questsBtn = document.getElementById('nav-quests-btn');
  const skillsBtn = document.getElementById('nav-skills-btn');
  const loadoutBtn = document.getElementById('nav-loadout-btn');
  const worldBtn = document.getElementById('nav-world-btn');
  const toastStack = document.getElementById('toast-stack');
  const inventoryGrid = document.getElementById('inventory-grid');
  const inventoryGoldLabel = document.getElementById('inventory-gold-label');
  const inventorySlotsLabel = document.getElementById('inventory-slots-label');
  const prayerPanel = document.getElementById('prayer-panel');

  // Screens where the Prayer Buffs panel is just noise.
  const NO_PRAYER_PANEL = new Set(['quests', 'skills']);

  const screenHome = document.getElementById('screen-home');
  const screenWorld = document.getElementById('screen-world');
  const skillArea = document.getElementById('skill-area');
  const skillScreens = {
    mining: document.getElementById('screen-mining'),
    woodcutting: document.getElementById('screen-woodcutting'),
    smithing: document.getElementById('screen-smithing'),
    fletching: document.getElementById('screen-fletching'),
    cooking: document.getElementById('screen-cooking'),
    prayer: document.getElementById('screen-prayer'),
    monk: document.getElementById('screen-monk'),
    hunter: document.getElementById('screen-hunter'),
    summoning: document.getElementById('screen-summoning'),
    crafting: document.getElementById('screen-crafting'),
    combat: document.getElementById('screen-combat'),
    store: document.getElementById('screen-store'),
    quests: document.getElementById('screen-quests'),
    skills: document.getElementById('screen-skills'),
    loadout: document.getElementById('screen-loadout'),
    witch_hut: document.getElementById('screen-witch_hut'),
    barracks: document.getElementById('screen-barracks'),
    tavern: document.getElementById('screen-tavern'),
    palace: document.getElementById('screen-palace'),
    hall: document.getElementById('screen-hall'),
    bandit_camp: document.getElementById('screen-bandit_camp'),
    bank: document.getElementById('screen-bank'),
  };
  const skillModules = {
    mining: () => window.Minerous.Mining,
    woodcutting: () => window.Minerous.Woodcutting,
    smithing: () => window.Minerous.Smithing,
    fletching: () => window.Minerous.Fletching,
    cooking: () => window.Minerous.Cooking,
    prayer: () => window.Minerous.Prayer,
    monk: () => window.Minerous.Monk,
    hunter: () => window.Minerous.Hunter,
    summoning: () => window.Minerous.Summoning,
    crafting: () => window.Minerous.Crafting,
    combat: () => window.Minerous.Combat,
    store: () => window.Minerous.Store,
    quests: () => window.Minerous.Quests,
    skills: () => window.Minerous.Skills,
    loadout: () => window.Minerous.Loadout,
    // NPC-only buildings have no mechanics of their own — their whole content is the
    // dialogue panel, which mountNpcPanel() below fills in.
    witch_hut: () => npcLocationModule,
    barracks: () => npcLocationModule,
    // The tavern is the exception — it sells food and beds alongside its keeper.
    tavern: () => window.Minerous.Tavern,
    palace: () => npcLocationModule,
    hall: () => window.Minerous.Feats,
    bandit_camp: () => window.Minerous.Bandit,
    bank: () => window.Minerous.Bank,
  };

  const npcLocationModule = { refresh() {}, stop() {}, tick() {} };

  // An NPC appears on the screen matching their locationId, but only in the area they
  // live in — so Ned is at the smithy in Riverbend, and the Lidas smithy stands empty.
  function mountNpcPanel(screenId) {
    const container = document.getElementById(`${screenId}-npc-panel`);
    if (!container) return;
    const area = window.Minerous.getArea(state.currentAreaId);
    const areaNpcs = (area && area.npcs) || [];
    const npc = window.Minerous.NPCS.find((n) => n.locationId === screenId && areaNpcs.includes(n.id));

    if (!npc) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.hidden = false;
    window.Minerous.Quests.openPanel(container, npc.id);
  }

  window.Minerous.showToast = function showToast(message, { levelUp = false } = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (levelUp ? ' level-up' : '');
    toast.textContent = message;
    toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  };

  window.Minerous.renderSkillLevelRow = function renderSkillLevelRow(prefix, skillId) {
    const level = getLevel(skillId);
    const currentFloor = xpForLevel(level);
    const nextFloor = level >= MAX_LEVEL ? currentFloor : xpForLevel(level + 1);
    const span = Math.max(1, nextFloor - currentFloor);
    const xp = state.skillXp[skillId] || 0;
    const progress = level >= MAX_LEVEL ? 100 : ((xp - currentFloor) / span) * 100;

    const levelEl = document.getElementById(`${prefix}-level`);
    const xpFillEl = document.getElementById(`${prefix}-xp-fill`);
    const xpLabelEl = document.getElementById(`${prefix}-xp-label`);

    levelEl.textContent = level;
    xpFillEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    xpLabelEl.textContent = level >= MAX_LEVEL ? `${xp} xp (max)` : `${xp - currentFloor} / ${span} xp`;
  };

  window.Minerous.renderInventory = function renderInventory() {
    inventoryGoldLabel.textContent = `💰 ${state.inventory.coins || 0}`;

    const entries = Object.entries(state.inventory).filter(([id, count]) => id !== 'coins' && count > 0);

    const cap = window.Minerous.INVENTORY_SLOTS;
    const used = window.Minerous.inventorySlotsUsed();
    inventorySlotsLabel.textContent = `🎒 ${used} / ${cap} slots · stacks of ${window.Minerous.STACK_LIMIT}`;
    inventorySlotsLabel.classList.toggle('full', used >= cap);

    if (entries.length === 0) {
      inventoryGrid.innerHTML = '<div class="inv-empty">No resources yet — start a skill!</div>';
      return;
    }
    inventoryGrid.innerHTML = '';

    // Bucket first, then render section by section, so the pack reads as a few
    // labelled shelves rather than one long undifferentiated wall of icons.
    const bySection = new Map();
    for (const [id, count] of entries) {
      if (!getItem(id)) continue;
      const section = window.Minerous.getItemSection(id);
      if (!bySection.has(section.id)) bySection.set(section.id, []);
      bySection.get(section.id).push([id, count]);
    }

    for (const section of window.Minerous.INVENTORY_SECTIONS) {
      const items = bySection.get(section.id);
      if (!items || items.length === 0) continue;

      const slotsUsed = items.reduce((sum, [, count]) => sum + window.Minerous.stacksFor(count), 0);
      const collapsed = collapsedSections.has(section.id);

      const header = document.createElement('button');
      header.className = 'inv-section-header' + (collapsed ? ' collapsed' : '');
      header.innerHTML = `
        <span class="inv-section-caret">${collapsed ? '▸' : '▾'}</span>
        <span class="inv-section-name">${section.name}</span>
        <span class="inv-section-slots">${slotsUsed} ${slotsUsed === 1 ? 'slot' : 'slots'}</span>
      `;
      header.addEventListener('click', () => {
        if (collapsedSections.has(section.id)) collapsedSections.delete(section.id);
        else collapsedSections.add(section.id);
        window.Minerous.renderInventory();
      });
      inventoryGrid.appendChild(header);

      if (collapsed) continue;

      const grid = document.createElement('div');
      grid.className = 'inv-section-grid';
      inventoryGrid.appendChild(grid);
      renderSlots(items, grid);
    }
  };

  // Which sections the player has folded away. Deliberately not saved — it's a view
  // preference for the current session, not progress.
  const collapsedSections = new Set();

  function renderSlots(entries, container) {
    for (const [id, count] of entries) {
      const item = getItem(id);
      if (!item) continue;
      const isWeapon = item.category === 'weapon';
      const isArmor = item.category === 'armor';
      // Anything with a heal value is edible, whether it was cooked or bought at a bar.
      const isFood = typeof item.heal === 'number';
      const isClothing = item.category === 'clothing';

      // Equipped weapons/armor are moved out of the inventory entirely (see equipWeapon/
      // equipArmor below), so anything still listed here is, by definition, not equipped.
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      // A pile bigger than one stack says how many slots it's actually costing, so a
      // filling pack is explicable rather than mysterious.
      const stacks = window.Minerous.stacksFor(count);
      slot.innerHTML = `
        <span class="inv-slot-icon kind-${window.Minerous.getItemKind(id)}" style="background:${item.color}; display:block;"></span>
        <span class="inv-slot-name">${item.name}</span>
        <span class="inv-slot-count">${count}${stacks > 1 ? ` <span class="inv-slot-stacks">${stacks} slots</span>` : ''}</span>
      `;

      // Gear is deliberately not equippable from here. The inventory panel is visible on
      // every screen, including the Battlegrounds, so an Equip button here amounted to
      // swapping weapons — and therefore attack style — in the middle of a fight. All
      // equipping happens on the Loadout screen now.
      if (isWeapon || isArmor) {
        const note = document.createElement('span');
        note.className = 'inv-slot-note';
        note.textContent = 'Loadout';
        slot.appendChild(note);
      } else if (isFood) {
        const btn = document.createElement('button');
        btn.className = 'inv-action-btn';
        btn.textContent = `Eat (+${item.heal})`;
        btn.addEventListener('click', () => {
          window.Minerous.spendItems({ [id]: 1 });
          window.Minerous.Combat.heal(item.heal);
          window.Minerous.showToast(`Ate ${item.name} (+${item.heal} HP)`);
          window.Minerous.renderInventory();
        });
        slot.appendChild(btn);
      } else if (isClothing) {
        const note = document.createElement('span');
        note.className = 'inv-slot-note';
        note.textContent = 'Loadout';
        slot.appendChild(note);
      }

      container.appendChild(slot);
    }
  }

  // Equipping moves the item out of the inventory and into the loadout; any item
  // it replaces is returned to the inventory. Unequipping just returns it.
  window.Minerous.equipWeapon = function equipWeapon(id) {
    if (state.equippedWeaponId) window.Minerous.addItem(state.equippedWeaponId, 1);
    window.Minerous.spendItems({ [id]: 1 });
    state.equippedWeaponId = id;
    window.Minerous.renderInventory();
    if (window.Minerous.Combat) window.Minerous.Combat.refreshWeaponStatus();
    if (window.Minerous.Loadout) window.Minerous.Loadout.refresh();
  };

  window.Minerous.unequipWeapon = function unequipWeapon() {
    if (!state.equippedWeaponId) return;
    window.Minerous.addItem(state.equippedWeaponId, 1);
    state.equippedWeaponId = null;
    window.Minerous.renderInventory();
    if (window.Minerous.Combat) window.Minerous.Combat.refreshWeaponStatus();
    if (window.Minerous.Loadout) window.Minerous.Loadout.refresh();
  };

  window.Minerous.equipArmor = function equipArmor(id, slot) {
    if (state.equippedArmor[slot]) window.Minerous.addItem(state.equippedArmor[slot], 1);
    window.Minerous.spendItems({ [id]: 1 });
    state.equippedArmor[slot] = id;
    window.Minerous.renderInventory();
    if (window.Minerous.Combat) window.Minerous.Combat.refreshArmorStatus();
    if (window.Minerous.Loadout) window.Minerous.Loadout.refresh();
  };

  window.Minerous.unequipArmor = function unequipArmor(slot) {
    if (!state.equippedArmor[slot]) return;
    window.Minerous.addItem(state.equippedArmor[slot], 1);
    state.equippedArmor[slot] = null;
    window.Minerous.renderInventory();
    if (window.Minerous.Combat) window.Minerous.Combat.refreshArmorStatus();
    if (window.Minerous.Loadout) window.Minerous.Loadout.refresh();
  };

  window.Minerous.equipClothing = function equipClothing(id) {
    if (state.equippedClothingId) window.Minerous.addItem(state.equippedClothingId, 1);
    window.Minerous.spendItems({ [id]: 1 });
    state.equippedClothingId = id;
    window.Minerous.renderInventory();
    if (window.Minerous.Loadout) window.Minerous.Loadout.refresh();
  };

  window.Minerous.unequipClothing = function unequipClothing() {
    if (!state.equippedClothingId) return;
    window.Minerous.addItem(state.equippedClothingId, 1);
    state.equippedClothingId = null;
    window.Minerous.renderInventory();
    if (window.Minerous.Loadout) window.Minerous.Loadout.refresh();
  };

  // The topbar never hides buttons — the one matching the current screen is
  // highlighted instead, so navigation stays in a fixed, predictable place.
  const navButtons = { home: homeBtn, world: worldBtn, quests: questsBtn, skills: skillsBtn, loadout: loadoutBtn };
  function updateNavActive(screenId) {
    for (const [id, btn] of Object.entries(navButtons)) {
      btn.classList.toggle('active', id === screenId);
    }
  }

  // 'world' (area select) and 'home' (the current area's skill hub) sit above the
  // skill screens and live outside skillArea, so they're toggled separately.
  const HUB_SCREENS = ['world', 'home'];
  const isHubScreen = (id) => HUB_SCREENS.includes(id);

  // Guards against a save pointing at an area that no longer exists — without this,
  // getArea() would return null and the hub would silently offer every skill again.
  const hasValidArea = () => !!window.Minerous.getArea(state.currentAreaId);
  const landingScreen = () => (hasValidArea() ? 'home' : 'world');

  window.Minerous.switchScreen = function switchScreen(screenId) {
    const previous = state.screen;
    if (!isHubScreen(previous) && skillModules[previous]) {
      const mod = skillModules[previous]();
      if (mod) mod.stop();
    }

    state.screen = screenId;
    updateNavActive(screenId);

    if (isHubScreen(screenId)) {
      screenWorld.hidden = screenId !== 'world';
      screenHome.hidden = screenId !== 'home';
      skillArea.hidden = true;
      if (screenId === 'world') window.Minerous.World.refresh();
      else window.Minerous.Home.refresh();
      window.Minerous.Persistence.saveNow();
      return;
    }

    screenWorld.hidden = true;
    screenHome.hidden = true;
    skillArea.hidden = false;
    for (const [id, section] of Object.entries(skillScreens)) {
      section.hidden = id !== screenId;
    }
    window.Minerous.renderInventory();
    // The Quest Log and Skills tab are reading screens — blessings have nothing to do
    // with either, and the panel only pushes their content further down the page.
    prayerPanel.hidden = NO_PRAYER_PANEL.has(screenId);
    if (!prayerPanel.hidden) window.Minerous.Prayer.renderPanel();
    const mod = skillModules[screenId]();
    mod.refresh();
    // The class sprite sheet replaces the CSS-art figure wherever a character is drawn.
    window.Minerous.Sprites.refresh();
    window.Minerous.Quests.clearPanel();
    mountNpcPanel(screenId);
    window.Minerous.Persistence.saveNow();
  };

  homeBtn.addEventListener('click', () => {
    // Can't enter an area hub without an area — send them to pick one first.
    window.Minerous.switchScreen(landingScreen());
  });
  worldBtn.addEventListener('click', () => window.Minerous.switchScreen('world'));
  questsBtn.addEventListener('click', () => window.Minerous.switchScreen('quests'));
  skillsBtn.addEventListener('click', () => window.Minerous.switchScreen('skills'));
  loadoutBtn.addEventListener('click', () => window.Minerous.switchScreen('loadout'));

  // Re-renders whatever's currently visible — used after a cloud save is pulled in
  // mid-session, since that mutates state well after the normal render pass.
  window.Minerous.refreshAllUI = function refreshAllUI() {
    window.Minerous.renderInventory();
    if (!prayerPanel.hidden) window.Minerous.Prayer.renderPanel();
    if (isHubScreen(state.screen)) {
      if (state.screen === 'world') window.Minerous.World.refresh();
      else window.Minerous.Home.refresh();
      return;
    }
    const mod = skillModules[state.screen];
    if (mod && mod()) mod().refresh();
  };

  function tick() {
    const mod = skillModules[state.screen];
    if (mod && mod()) mod().tick();
    // Active prayer blessings drain in real time regardless of which screen is showing.
    window.Minerous.Prayer.buffTick();
    // The NPC panel can live inside any screen, so its refresh runs globally rather
    // than from whichever skill module happens to own the screen.
    window.Minerous.Quests.tickPanel();
    // Banked gold earns wherever you are — you shouldn't have to stand in the vault
    // watching it. The Bank module renders the change if you happen to be looking.
    if (state.screen !== 'bank') window.Minerous.Bank.accrueInterest();
    window.Minerous.Sprites.tick();
    requestAnimationFrame(tick);
  }

  window.Minerous.Persistence.loadOnBoot().then(() => {
    // Repairs quest state carried over from older builds — must run after the save is
    // in and before anything reads it.
    window.Minerous.Quests.migrate();
    window.Minerous.renderInventory();
    // Returning players resume in their last area; new ones pick a destination first.
    window.Minerous.switchScreen(landingScreen());
    requestAnimationFrame(tick);
    window.Minerous.Account.restoreSession();
  });
})();
