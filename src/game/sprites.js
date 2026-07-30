window.Minerous = window.Minerous || {};

(function () {
  const { state } = window.Minerous;

  // Sprite sheets, keyed by the weapon `style` that wears them. Equipping a weapon with a
  // matching style swaps the CSS-art figure for that sheet, so what you see is what you
  // fight with. A style with no sheet here just keeps the CSS art.
  //
  // Frames are numbered left-to-right, top-to-bottom from 0. Rows shorter than the grid
  // leave trailing cells empty; no animation may name one.
  //
  // `figureRatio` is how much of a cell's height the character itself occupies in an idle
  // frame — printed by the build scripts. Sheets pad their cells differently (the cleric
  // reserves room for symbols above her head), so scaling by cell height would render her
  // noticeably smaller than the monk. Scaling by figure height keeps them consistent.
  const SHEETS = {
    // Melee is the default style — a sword carries no `style` field and fists carry no
    // weapon at all — so this sheet is what you see unless something else is equipped.
    melee: {
      url: 'assets/warrior-sheet.png',
      cols: 8,
      rows: 3,
      figureRatio: 196 / 210,
      // Detailed illustration rather than chunky pixel art, so it is resampled smoothly
      // instead of by nearest neighbour — see .sprite-smooth in styles.css.
      smooth: true,
      // Lifted from a labelled sheet whose other rows (overhead strike, magic thrust,
      // aether blast) could not be segmented — their effects overlap the neighbouring
      // poses. See scripts/build-warrior-sheet.py.
      animations: {
        idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: 170 },
        // An eight-frame lunging sword slash.
        attack: { frames: [8, 9, 10, 11, 12, 13, 14, 15], frameMs: 95 },
        // Shield up and braced.
        defense: { frames: [16, 17, 18, 19], frameMs: 140 },
      },
      cycle: ['attack', 'defense'],
    },
    monk: {
      url: 'assets/monk-sheet.png',
      cols: 5,
      rows: 4,
      figureRatio: 143 / 163,
      // 19 poses in no particular order, so each animation names the frames that read as
      // that motion. Frame 19 is the source art's empty cell.
      animations: {
        // Three near-identical standing poses; a third breaks up the obvious back-and
        // forth of a two-frame loop, and slow timing reads as breathing.
        idle: { frames: [0, 1, 10], frameMs: 620 },
        // Plain fist work: guard, hit, hit.
        strike: { frames: [11, 3, 5], frameMs: 130 },
        // Open-handed: guard, cock the palm back, full thrust, recover.
        attack: { frames: [14, 4, 6, 7], frameMs: 120 },
        // Step in, knee up, high kick, flying kick, land in guard.
        kick: { frames: [2, 9, 12, 8, 14], frameMs: 130 },
        // A relentless flurry of fists, with no recovery frame to pause it.
        fury: { frames: [11, 3, 5, 15, 16], frameMs: 90 },
        // Gather, leap, the palm strike with the energy blast, then settle.
        special: { frames: [17, 13, 18, 14], frameMs: 170 },
      },
      cycle: ['strike', 'attack', 'kick', 'fury', 'special'],
    },
    cleric: {
      url: 'assets/cleric-sheet.png',
      cols: 7,
      rows: 4,
      figureRatio: 232 / 323,
      // This sheet came labelled by row, so each row *is* an animation and the frames run
      // in the artist's own order. Cells 13, 20 and 27 are the empty tails of the three
      // six-pose rows.
      animations: {
        idle: { frames: [0, 1, 2, 3, 4, 5, 6], frameMs: 190 },
        // Staff thrust and follow-through.
        attack: { frames: [7, 8, 9, 10, 11, 12], frameMs: 110 },
        // Holy magic builds in both hands, then the sigil rings her feet.
        spell: { frames: [14, 15, 16, 17, 18, 19], frameMs: 140 },
        // Hands raised, healing crosses gathering overhead.
        heal: { frames: [21, 22, 23, 24, 25, 26], frameMs: 150 },
      },
      cycle: ['attack', 'spell', 'heal'],
    },
    gunslinger: {
      url: 'assets/gunslinger-sheet.png',
      cols: 8,
      rows: 5,
      figureRatio: 119 / 136,
      // Detailed illustration, and the source cards are only ~136px tall against a ~97px
      // cell on screen — nearest-neighbour sampling at that ratio drops roughly a third of
      // the pixels and looks grainy, so resample smoothly instead.
      smooth: true,
      // Lifted from a design sheet whose rows were labelled by attack pattern, so as with
      // the cleric each row is an animation in the artist's own order. The rows are
      // uneven — idle, hip-fire and trick shot have five poses to the other two's eight —
      // so cells 5-7, 21-23 and 29-31 are empty tails.
      animations: {
        idle: { frames: [0, 1, 2, 3, 4], frameMs: 210 },
        // Dual shot: both revolvers up, then eight frames of alternating muzzle flash.
        attack: { frames: [8, 9, 10, 11, 12, 13, 14, 15], frameMs: 95 },
        // Hip-fire burst: fired from the waist, faster and looser.
        hip_fire: { frames: [16, 17, 18, 19, 20], frameMs: 85 },
        // Trick shot: a flourish into a spin before the shot.
        trick_shot: { frames: [24, 25, 26, 27, 28], frameMs: 120 },
        // Charge shot: winds up a glowing round, then a beam of a muzzle flash.
        charge_shot: { frames: [32, 33, 34, 35, 36, 37, 38, 39], frameMs: 130 },
      },
      cycle: ['attack', 'hip_fire', 'trick_shot', 'charge_shot'],
    },
  };

  // The scene reserves a 64x96 box for the character (`.character` in styles.css). Sheets
  // are scaled so the figure stands this tall in it, whatever the export resolution.
  const BOX_W = 64;
  const TARGET_FIGURE_H = 85;

  // Measured geometry per sheet id, once its image has loaded.
  const geometry = new Map();
  const failedSheets = new Set();
  // Where each sheet's action cycle has got to.
  const cyclePos = {};
  // Elements currently showing a sprite, so the shared ticker can advance them.
  const active = new Map();

  // For now every action animation simply takes its turn, so all the artwork gets seen.
  // Each one plays through once and hands over to the next. Later these can be tied to
  // specific moves instead — MONK_TECHNIQUES and CLERIC_SPELLS both carry the mapping.
  function nextActionAnimation(sheetId) {
    const cycle = SHEETS[sheetId].cycle;
    const pos = cyclePos[sheetId] || 0;
    cyclePos[sheetId] = (pos + 1) % cycle.length;
    return cycle[pos % cycle.length];
  }

  // Loaded once per sheet, lazily. If the artwork isn't there the game keeps its CSS-art
  // character — a missing file should never break a screen.
  function loadSheet(id) {
    if (!id || failedSheets.has(id)) return Promise.resolve(null);
    if (geometry.has(id)) return Promise.resolve(geometry.get(id));
    const def = SHEETS[id];
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const frameW = img.naturalWidth / def.cols;
        const frameH = img.naturalHeight / def.rows;
        // Scale so the figure — not the padded cell — is TARGET_FIGURE_H tall.
        const displayH = TARGET_FIGURE_H / def.figureRatio;
        const scale = displayH / frameH;
        const geom = {
          // Every measurement below is in on-screen pixels, not sheet pixels.
          displayW: frameW * scale,
          displayH,
          sheetW: img.naturalWidth * scale,
          sheetH: img.naturalHeight * scale,
        };
        geometry.set(id, geom);
        resolve(geom);
      };
      img.onerror = () => {
        failedSheets.add(id);
        resolve(null);
      };
      img.src = def.url;
    });
  }

  // Which sheet the character should wear, read straight off the equipped weapon so no
  // other module has to be consulted and any future weapon of a known style just works.
  // Anything without a style of its own is melee — a sword, or bare fists — which matches
  // how combat.js resolves the attack style.
  function activeSheetId() {
    const id = state.equippedWeaponId;
    const item = id ? window.Minerous.getItem(id) : null;
    const style = (item && item.style) || 'melee';
    return SHEETS[style] ? style : null;
  }

  function animationFor(sheetId, name) {
    const set = SHEETS[sheetId].animations;
    return set[name] || set.idle;
  }

  function frameOffset(sheetId, geom, index) {
    const cols = SHEETS[sheetId].cols;
    const col = index % cols;
    const row = Math.floor(index / cols);
    return `${-col * geom.displayW}px ${-row * geom.displayH}px`;
  }

  function paint(el, entry) {
    const geom = geometry.get(entry.sheetId);
    if (!geom) return;
    const anim = animationFor(entry.sheetId, entry.animation);
    const frame = anim.frames[entry.step % anim.frames.length];
    el.style.backgroundPosition = frameOffset(entry.sheetId, geom, frame);
  }

  // Turns a CSS-art `.character` into a sprite, or back again.
  function dress(el, sheetId, animation) {
    const geom = geometry.get(sheetId);
    if (!geom) return;
    el.classList.add('sprite-character');
    el.classList.toggle('sprite-smooth', !!SHEETS[sheetId].smooth);
    el.style.backgroundImage = `url("${SHEETS[sheetId].url}")`;
    el.style.backgroundSize = `${geom.sheetW}px ${geom.sheetH}px`;
    el.style.width = `${geom.displayW}px`;
    el.style.height = `${geom.displayH}px`;
    // A frame wider or narrower than the reserved box would otherwise drift off the
    // spot the CSS-art figure stood on, so re-centre it on that spot.
    el.style.marginLeft = `${(BOX_W - geom.displayW) / 2}px`;

    const existing = active.get(el);
    const carryOver = existing && existing.sheetId === sheetId && existing.animation === animation;
    active.set(el, {
      sheetId,
      animation,
      step: carryOver ? existing.step : 0,
      last: 0,
      // Every skill module signals "acting" by putting `.swinging` on the arm — mining,
      // smithing, cooking, fletching, woodcutting, hunting and combat alike. Holding the
      // element lets the ticker follow that flag instead of each module learning about
      // sprites.
      arm: el.querySelector('.arm-front') || el.querySelector('.arm'),
      pinned: existing && existing.sheetId === sheetId ? existing.pinned : null,
    });
    paint(el, active.get(el));
  }

  function undress(el) {
    el.classList.remove('sprite-character');
    el.classList.remove('sprite-smooth');
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.width = '';
    el.style.height = '';
    el.style.marginLeft = '';
    active.delete(el);
  }

  window.Minerous.Sprites = {
    // Called after any screen render. Every `.character` on the visible screen either
    // becomes the sprite for the equipped style or reverts to the built-in CSS art.
    refresh() {
      const sheetId = activeSheetId();
      loadSheet(sheetId).then((geom) => {
        for (const el of document.querySelectorAll('.character')) {
          if (geom) {
            // An arm mid-swing is the CSS art's idea of acting; the sheet has its own
            // frames for that, so read the class and pick up the cycle there.
            dress(el, sheetId, el.querySelector('.swinging') ? nextActionAnimation(sheetId) : 'idle');
          } else if (el.classList.contains('sprite-character')) {
            undress(el);
          }
        }
      });
    },

    // Pins one animation for a character, taking it out of the cycle — for a screen that
    // wants a specific move. This is the hook for tying animations to moves later.
    setAnimation(el, animation) {
      if (!el || !el.classList.contains('sprite-character')) return;
      const entry = active.get(el);
      if (!entry || !SHEETS[entry.sheetId].animations[animation]) return;
      entry.pinned = animation;
      entry.animation = animation;
      entry.step = 0;
      entry.last = 0;
      paint(el, entry);
    },

    isActive() {
      const id = activeSheetId();
      return !!(id && geometry.has(id));
    },

    // Advances every visible sprite from the global loop.
    tick() {
      if (active.size === 0) return;
      const now = performance.now();
      for (const [el, entry] of active) {
        if (!el.isConnected) {
          active.delete(el);
          continue;
        }
        // Follow the arm's swing flag so the sprite acts whenever the CSS art would.
        const acting = !!(entry.arm && entry.arm.classList.contains('swinging'));
        if (!acting && entry.animation !== 'idle') {
          entry.animation = 'idle';
          entry.step = 0;
          entry.last = now;
          paint(el, entry);
          continue;
        }
        if (acting && entry.animation === 'idle') {
          entry.animation = entry.pinned || nextActionAnimation(entry.sheetId);
          entry.step = 0;
          entry.last = now;
          paint(el, entry);
          continue;
        }

        const anim = animationFor(entry.sheetId, entry.animation);
        if (now - entry.last < anim.frameMs) continue;
        entry.last = now;
        entry.step += 1;
        if (entry.step >= anim.frames.length) {
          entry.step = 0;
          // One animation finished, so hand over to the next in the cycle — a long swing
          // works through the whole set instead of repeating a single move.
          if (acting && !entry.pinned) entry.animation = nextActionAnimation(entry.sheetId);
        }
        paint(el, entry);
      }
    },
  };
})();
