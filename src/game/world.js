window.Minerous = window.Minerous || {};

(function () {
  const { AREAS, SKILLS, state } = window.Minerous;

  const el = {
    cards: document.getElementById('area-cards'),
  };

  function skillNames(area) {
    // Rendered in SKILLS order so every area lists its trades consistently.
    return SKILLS.filter((s) => area.skills.includes(s.id)).map((s) => s.name);
  }

  window.Minerous.World = {
    refresh() {
      el.cards.innerHTML = '';
      // A gate can open because of something you did elsewhere, so re-check before
      // drawing the map rather than only when a card is clicked.
      window.Minerous.Gate.checkAutoClears();

      for (const area of AREAS) {
        const current = state.currentAreaId === area.id;
        const gated = !!area.gate && !window.Minerous.Gate.isCleared(area.gate.id);
        // Some places you simply haven't heard of yet — no gate, just a prerequisite.
        const undiscovered = !!area.requiresGate && !window.Minerous.Gate.isCleared(area.requiresGate);
        const locked = gated || undiscovered;
        const names = skillNames(area);

        const card = document.createElement('button');
        card.className = 'skill-card area-card' + (current ? ' current' : '') + (locked ? ' locked-area' : '');
        card.style.setProperty('--skill-color', area.color);

        const blurb = undiscovered
          ? 'You have heard nothing of this place yet. Push further down the road first.'
          : gated
          ? area.gate.text
          : area.blurb;
        const footer = area.camp
          ? `${window.Minerous.CAMP_TIERS.length} tiers of bandit · Bosses`
          : `${names.length} trades · ${names.join(', ')}${area.bosses ? ' · Bosses' : ''}`;

        card.innerHTML = `
          <div class="skill-card-header">
            <span class="skill-card-icon">${locked ? '🔒' : area.icon}</span>
            <div>
              <div class="skill-card-name">${undiscovered ? '???' : area.name}</div>
              <div class="skill-card-level">${current ? 'You are here' : undiscovered ? 'Undiscovered' : gated ? 'Blocked' : 'Travel here'}</div>
            </div>
          </div>
          <div class="skill-card-blurb">${blurb}</div>
          <div class="area-card-skills">${undiscovered ? '' : footer}</div>
        `;
        card.addEventListener('click', () => {
          if (undiscovered) {
            window.Minerous.showToast('You have not heard of this place yet.');
            return;
          }
          const enter = () => {
            state.currentAreaId = area.id;
            // The camp is a gauntlet, not a settlement — it has no hub to arrive at.
            window.Minerous.switchScreen(area.camp ? 'bandit_camp' : 'home');
            window.Minerous.Gate.maybeShowArrivalReward(area);
          };
          // A blocked area opens its encounter instead of travelling, and a tolled one
          // opens its shakedown; either way we only enter once that's settled.
          if (window.Minerous.Gate.tryEnterArea(area, enter)) return;
          enter();
        });
        el.cards.appendChild(card);
      }
    },
    stop() {},
    tick() {},
  };
})();
