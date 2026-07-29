window.Minerous = window.Minerous || {};

(function () {
  const { SKILLS, MAX_LEVEL, xpForLevel, getLevel, getArea, state } = window.Minerous;

  const el = {
    cards: document.getElementById('skill-cards'),
    areaName: document.getElementById('home-area-name'),
    areaBlurb: document.getElementById('home-area-blurb'),
  };

  window.Minerous.Home = {
    refresh() {
      // Which trades you can train depends on where you are — an area only lists the
      // skills it actually offers.
      const area = getArea(state.currentAreaId);
      el.areaName.textContent = area ? area.name : 'Choose a Skill';
      el.areaBlurb.textContent = area ? area.blurb : '';

      const availableSkills = area ? SKILLS.filter((s) => area.skills.includes(s.id)) : SKILLS;

      el.cards.innerHTML = '';
      for (const skill of availableSkills) {
        const level = getLevel(skill.id);
        const currentFloor = xpForLevel(level);
        const nextFloor = level >= MAX_LEVEL ? currentFloor : xpForLevel(level + 1);
        const span = Math.max(1, nextFloor - currentFloor);
        const xp = window.Minerous.state.skillXp[skill.id] || 0;
        const progress = level >= MAX_LEVEL ? 100 : ((xp - currentFloor) / span) * 100;

        // The hub lists places, so a card is titled with its building and carries the
        // trade you practise there underneath.
        const building = window.Minerous.getBuildingName(skill.id) || skill.name;

        const card = document.createElement('button');
        card.className = 'skill-card';
        card.style.setProperty('--skill-color', skill.color);
        card.innerHTML = `
          <div class="skill-card-header">
            <span class="skill-card-icon">${skill.icon}</span>
            <div>
              <div class="skill-card-name">${building}</div>
              <div class="skill-card-level">${skill.name} · Level ${level}</div>
            </div>
          </div>
          <div class="xp-bar"><div class="xp-bar-fill" style="width:${Math.min(100, Math.max(0, progress))}%"></div></div>
          <div class="skill-card-blurb">${skill.blurb}</div>
        `;
        card.addEventListener('click', () => {
          // The Combat card always opens the regular monster list, never the Boss Arena.
          if (skill.id === 'combat') window.Minerous.Combat.setBossMode(false);
          window.Minerous.switchScreen(skill.id);
        });
        el.cards.appendChild(card);
      }

      // Buildings that exist just to house an NPC (hut, barracks, tavern). NPCs posted
      // to a skill screen instead — Ned, Clara — appear on that screen, not here.
      const areaNpcs = (area && area.npcs) || [];
      for (const loc of window.Minerous.NPC_LOCATIONS) {
        if (!areaNpcs.includes(loc.npcId)) continue;
        const npc = window.Minerous.NPCS.find((n) => n.id === loc.npcId);

        const card = document.createElement('button');
        card.className = 'skill-card';
        card.style.setProperty('--skill-color', loc.color);
        card.innerHTML = `
          <div class="skill-card-header">
            <span class="skill-card-icon">${loc.icon}</span>
            <div>
              <div class="skill-card-name">${loc.name}</div>
              <div class="skill-card-level">${npc ? npc.name : ''}</div>
            </div>
          </div>
          <div class="skill-card-blurb">${loc.blurb}</div>
        `;
        card.addEventListener('click', () => window.Minerous.switchScreen(loc.id));
        el.cards.appendChild(card);
      }

      if (area && area.store) {
        const tiers = window.Minerous.getStoreStoneTiers(area.id);
        const storeCard = document.createElement('button');
        storeCard.className = 'skill-card';
        storeCard.style.setProperty('--skill-color', '#b8925e');
        storeCard.innerHTML = `
          <div class="skill-card-header">
            <span class="skill-card-icon">🏪</span>
            <div>
              <div class="skill-card-name">General Store</div>
              <div class="skill-card-level">${tiers.join(' & ')} spirit stones</div>
            </div>
          </div>
          <div class="skill-card-blurb">Provisions, spirit stones, and a buyer for anything you have spare.</div>
        `;
        storeCard.addEventListener('click', () => window.Minerous.switchScreen('store'));
        el.cards.appendChild(storeCard);
      }

      if (area && area.bank) {
        const used = window.Minerous.bankSlotsUsed();
        const bankCard = document.createElement('button');
        bankCard.className = 'skill-card';
        bankCard.style.setProperty('--skill-color', '#6b8fb8');
        bankCard.innerHTML = `
          <div class="skill-card-header">
            <span class="skill-card-icon">🏦</span>
            <div>
              <div class="skill-card-name">The Vault</div>
              <div class="skill-card-level">💰 ${state.bank.gold} · ${used} / ${window.Minerous.BANK_SLOTS} stored</div>
            </div>
          </div>
          <div class="skill-card-blurb">Store what you can't carry, and let your gold earn its keep.</div>
        `;
        bankCard.addEventListener('click', () => window.Minerous.switchScreen('bank'));
        el.cards.appendChild(bankCard);
      }

      // The Hall spends feat points, which come from total skill levels rather than
      // any one skill — so like Bosses it's a place, not a trade.
      if (area && area.hall) {
        const available = window.Minerous.Feats.availablePoints();
        const hallCard = document.createElement('button');
        hallCard.className = 'skill-card';
        hallCard.style.setProperty('--skill-color', '#d6b24d');
        hallCard.innerHTML = `
          <div class="skill-card-header">
            <span class="skill-card-icon">🏆</span>
            <div>
              <div class="skill-card-name">Hall of Champions</div>
              <div class="skill-card-level">${available > 0 ? `${available} feat point${available === 1 ? '' : 's'} to spend` : `Character level ${window.Minerous.Feats.characterLevel()}`}</div>
            </div>
          </div>
          <div class="skill-card-blurb">Spend feat points on permanent passive mastery.</div>
        `;
        hallCard.addEventListener('click', () => window.Minerous.switchScreen('hall'));
        el.cards.appendChild(hallCard);
      }

      if (area && !area.bosses) return;

      // Bosses live on the Battlegrounds screen — this card is a shortcut, not a skill,
      // so it skips the level/xp bar the real skill cards render.
      const bossCard = document.createElement('button');
      bossCard.className = 'skill-card';
      bossCard.style.setProperty('--skill-color', '#d65c5c');
      bossCard.innerHTML = `
        <div class="skill-card-header">
          <span class="skill-card-icon">☠</span>
          <div>
            <div class="skill-card-name">Bosses</div>
            <div class="skill-card-level">Lv 5+</div>
          </div>
        </div>
        <div class="skill-card-blurb">Challenge fearsome bosses — bring full armor and weaponry of their tier.</div>
      `;
      bossCard.addEventListener('click', () => {
        window.Minerous.Combat.setBossMode(true);
        window.Minerous.switchScreen('combat');
      });
      el.cards.appendChild(bossCard);
    },
  };
})();
