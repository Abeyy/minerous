window.Minerous = window.Minerous || {};

(function () {
  const { BATCH_OPTIONS, state } = window.Minerous;

  const DEFAULT_ID = 'all';

  function selectedId(skillId) {
    return state.batchSize[skillId] || DEFAULT_ID;
  }

  function option(skillId) {
    return BATCH_OPTIONS.find((o) => o.id === selectedId(skillId)) || BATCH_OPTIONS[BATCH_OPTIONS.length - 1];
  }

  // Renders the ×1 / ×5 / ×10 / All row into a container. `onChange` lets the calling
  // module redraw its own labels — changing the size mid-run retargets the run rather
  // than cancelling it, so the remaining count needs refreshing.
  function render(container, skillId, onChange) {
    if (!container) return;
    container.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'batch-label';
    label.textContent = 'Make';
    container.appendChild(label);

    for (const opt of BATCH_OPTIONS) {
      const btn = document.createElement('button');
      btn.className = 'batch-btn' + (opt.id === selectedId(skillId) ? ' active' : '');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        state.batchSize[skillId] = opt.id;
        render(container, skillId, onChange);
        if (onChange) onChange(opt);
      });
      container.appendChild(btn);
    }
  }

  window.Minerous.Batch = {
    render,
    // How many a fresh run should make. Infinity means "until the materials run out",
    // which is the old always-on behaviour.
    count(skillId) {
      return option(skillId).count;
    },
    label(skillId) {
      return option(skillId).label;
    },
    // Text for the action line: "Smithing Bronze Sword… (3 left)". Nothing is appended
    // for an unbounded run, since there's no number worth showing.
    remainingSuffix(remaining) {
      return Number.isFinite(remaining) ? ` (${remaining} left)` : '';
    },
  };
})();
