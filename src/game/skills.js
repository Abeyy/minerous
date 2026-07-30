window.Minerous = window.Minerous || {};

(function () {
  const { SKILLS, MAX_LEVEL, state, getLevel, xpForLevel } = window.Minerous;

  const el = {
    summary: document.getElementById('skills-summary'),
    grid: document.getElementById('skills-grid'),
  };

  // Progress towards the next level, as a percentage and a readable "x / y xp".
  function progressFor(skillId) {
    const level = getLevel(skillId);
    const xp = state.skillXp[skillId] || 0;
    if (level >= MAX_LEVEL) return { percent: 100, label: `${xp} xp` };
    const floor = xpForLevel(level);
    const span = Math.max(1, xpForLevel(level + 1) - floor);
    return {
      percent: Math.min(100, Math.max(0, ((xp - floor) / span) * 100)),
      label: `${xp - floor} / ${span} xp`,
    };
  }

  function renderSummary() {
    const total = SKILLS.reduce((sum, skill) => sum + getLevel(skill.id), 0);
    const trained = SKILLS.filter((skill) => getLevel(skill.id) > 1).length;
    el.summary.innerHTML = `
      <div class="skills-summary-item">
        <div class="skills-summary-value">${total}</div>
        <div class="skills-summary-label">Character Level</div>
      </div>
      <div class="skills-summary-item">
        <div class="skills-summary-value">${trained} <span class="skills-summary-of">/ ${SKILLS.length}</span></div>
        <div class="skills-summary-label">Skills Trained</div>
      </div>
    `;
  }

  function renderTiles() {
    el.grid.innerHTML = '';
    for (const skill of SKILLS) {
      const level = getLevel(skill.id);
      const { percent, label } = progressFor(skill.id);

      const tile = document.createElement('div');
      tile.className = 'skill-tile';
      // Each tile is tinted with its own skill colour, so the icon isn't the only thing
      // distinguishing them at a glance.
      tile.style.setProperty('--skill-color', skill.color);
      tile.innerHTML = `
        <span class="skill-tile-icon">${skill.icon}</span>
        <span class="skill-tile-text">
          <div class="skill-tile-name">${skill.name}</div>
          <div class="skill-tile-level">
            <b>${level}</b><span class="skill-tile-max">/ ${MAX_LEVEL}</span>
          </div>
          <div class="skill-tile-bar"><span style="width: ${percent}%"></span></div>
          <div class="skill-tile-xp">${label}</div>
        </span>
      `;
      el.grid.appendChild(tile);
    }
  }

  window.Minerous.Skills = {
    refresh() {
      renderSummary();
      renderTiles();
    },
    // A reading screen: nothing runs in the background, so there's nothing to stop or tick.
    stop() {},
    tick() {},
  };
})();
