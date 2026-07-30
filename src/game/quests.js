window.Minerous = window.Minerous || {};

(function () {
  const { NPCS, QUESTS, SKILLS, AREAS, MONSTERS, CLOTHING, QUEST_ACTIONS, state, getItem, addItem, addXp, getLevel, hasItems, spendItems } =
    window.Minerous;

  const ASK_AFFINITY_THRESHOLD = 20;
  const ASK_COOLDOWN_MS = 60000;

  let dialogueMode = 'quest'; // 'quest' | 'ask' | 'trade'
  let lastAskTick = 0;
  // What each NPC last handed over, by npc id: { qty, name }. The panel is rebuilt from
  // scratch once a second to move the countdowns, so a message written straight into the DOM
  // is gone before it can be read — anything the player needs to see has to be re-derivable
  // on every render. Deliberately not saved: it's a note about the last minute, not progress.
  const lastAskResult = {};
  // Where the NPC dialogue panel is currently mounted, and for whom.
  let activeContainer = null;
  let activeNpcId = null;

  function questsForNpc(npcId) {
    return QUESTS.filter((q) => q.npcId === npcId).sort((a, b) => a.order - b.order);
  }

  function isQuestComplete(questId) {
    return state.quests.completedIds.includes(questId);
  }

  // A quest can wait on one belonging to a different NPC — the captain won't discuss
  // the gate until the king has actually asked him to.
  function isQuestAvailable(quest) {
    return !quest.requiresQuest || isQuestComplete(quest.requiresQuest);
  }

  // The quest this NPC currently has on the table — whether or not you've taken it.
  function activeQuestForNpc(npcId) {
    return questsForNpc(npcId).find((q) => !isQuestComplete(q.id) && isQuestAvailable(q)) || null;
  }

  function isQuestAccepted(questId) {
    // Acceptance is recorded, never inferred. This used to fall back to "has a counter
    // snapshot, so it must be in progress", which meant any code that snapshotted a
    // quest silently accepted it on the player's behalf. See migrate() for the
    // one-time handling of saves that predate acceptance.
    return state.quests.acceptedIds.includes(questId);
  }

  // Run once at boot, after the save is loaded.
  function migrate() {
    const q = state.quests;

    if (!q.migratedAcceptance) {
      // Saves made before quests needed accepting: anything already being counted was
      // genuinely in progress, so honour it rather than discarding the player's work.
      const tracked = new Set([...Object.keys(q.killSnapshots), ...Object.keys(q.actionSnapshots)]);
      for (const id of tracked) {
        if (!q.acceptedIds.includes(id) && !q.completedIds.includes(id)) q.acceptedIds.push(id);
      }
      q.migratedAcceptance = true;
    }

    // An accepted quest with a time limit but no deadline never expires. That happens
    // to saves from before deadlines existed, and to any quest the auto-accept bug
    // started. Start their clock now rather than leaving them unbounded.
    for (const id of q.acceptedIds) {
      if (q.deadlines[id] || q.completedIds.includes(id)) continue;
      const quest = QUESTS.find((x) => x.id === id);
      if (!quest) continue;
      const { timeLimitMs } = window.Minerous.getQuestFailure(quest);
      if (timeLimitMs) q.deadlines[id] = Date.now() + timeLimitMs;
    }
  }

  function acceptQuest(npc, quest) {
    if (isQuestAccepted(quest.id)) return;
    state.quests.acceptedIds.push(quest.id);
    // Snapshot on accept, not on first glance — progress starts the moment you agree.
    ensureCounterSnapshot(quest);

    const { timeLimitMs } = window.Minerous.getQuestFailure(quest);
    if (timeLimitMs) state.quests.deadlines[quest.id] = Date.now() + timeLimitMs;

    window.Minerous.showToast(`Quest accepted: ${questName(quest)}`);
    renderDetail();
  }

  function timeRemaining(questId) {
    const deadline = state.quests.deadlines[questId];
    if (!deadline) return null;
    return deadline - Date.now();
  }

  // Drops the quest back to "offered", takes the penalty, and clears its progress so
  // re-accepting starts clean rather than resuming a run you already lost.
  function failQuest(quest, reason) {
    const idx = state.quests.acceptedIds.indexOf(quest.id);
    if (idx === -1) return;
    state.quests.acceptedIds.splice(idx, 1);
    delete state.quests.deadlines[quest.id];
    delete state.quests.killSnapshots[quest.id];
    delete state.quests.actionSnapshots[quest.id];

    const { penalty } = window.Minerous.getQuestFailure(quest);
    const npc = NPCS.find((n) => n.id === quest.npcId);

    // Lose enough and the skill regresses — loseXp reports the level drop itself.
    const { lost: xpLost } = window.Minerous.loseXp(penalty.skill, penalty.xp);

    if (penalty.affinity > 0) {
      state.affinityBonus[quest.npcId] = (state.affinityBonus[quest.npcId] || 0) - penalty.affinity;
    }

    const skillName = (SKILLS.find((s) => s.id === penalty.skill) || {}).name || penalty.skill;
    window.Minerous.showToast(
      `Quest failed: ${questName(quest)} — ${reason}. −${xpLost} ${skillName} xp, −${penalty.affinity} affinity with ${
        npc ? npc.name : 'them'
      }`
    );
    renderQuestLog();
    renderDetail();
  }

  // Runs from the global loop so a deadline lands wherever the player happens to be.
  function tickFailures() {
    for (const quest of acceptedQuests()) {
      const remaining = timeRemaining(quest.id);
      if (remaining !== null && remaining <= 0) failQuest(quest, 'out of time');
    }
  }

  // Called by combat.js when the player is killed. Dying to the very thing an accepted
  // quest sent you after fails it.
  function notifyDeath(monsterId) {
    for (const quest of acceptedQuests()) {
      const { deadlyTargets } = window.Minerous.getQuestFailure(quest);
      if (deadlyTargets.includes(monsterId)) {
        const monster = MONSTERS.find((m) => m.id === monsterId);
        failQuest(quest, `slain by the ${monster ? monster.name : monsterId}`);
      }
    }
  }

  // Everything you've taken on and not yet finished, for the Quest Log.
  function acceptedQuests() {
    return QUESTS.filter((q) => isQuestAccepted(q.id) && !isQuestComplete(q.id));
  }

  // Derived from completed quests rather than stored as a running total. Quests are
  // the only source of affinity, so this is exact — and it self-heals saves made
  // before affinity existed, which would otherwise be stuck at 0 forever since their
  // quests are already marked complete and can't be re-turned-in.
  function getAffinity(npcId) {
    const earned = questsForNpc(npcId)
      .filter((q) => isQuestComplete(q.id))
      .reduce((sum, q) => sum + (q.rewardAffinity || 0), 0);
    // Plus anything the wider world granted, minus anything failure cost you. This
    // can go negative — letting someone down repeatedly puts you in their bad books,
    // and you have to work back up through zero before they'll deal with you again.
    return earned + ((state.affinityBonus || {})[npcId] || 0);
  }

  function lastCompletedQuestForNpc(npcId) {
    const npcQuestIds = new Set(questsForNpc(npcId).map((q) => q.id));
    for (let i = state.quests.completedIds.length - 1; i >= 0; i--) {
      const id = state.quests.completedIds[i];
      if (npcQuestIds.has(id)) return QUESTS.find((q) => q.id === id);
    }
    return null;
  }

  function askCooldownRemaining(npcId) {
    const readyAt = state.quests.giftCooldowns[npcId] || 0;
    return Math.max(0, readyAt - Date.now());
  }

  // Kill and action quests measure lifetime counters, so they'd read as instantly
  // complete if a player had already been grinding. Both instead snapshot the counter
  // when the quest becomes active and only count progress made after that point.
  // Item-gather quests need none of this — they just check current inventory.
  function counterSource(quest) {
    if (quest.type === 'kill') return { totals: state.kills, snapshots: state.quests.killSnapshots };
    if (quest.type === 'action') return { totals: state.actions, snapshots: state.quests.actionSnapshots };
    return null;
  }

  function ensureCounterSnapshot(quest) {
    const source = counterSource(quest);
    if (!source || source.snapshots[quest.id]) return;
    const snapshot = {};
    for (const key of Object.keys(quest.requires)) {
      snapshot[key] = source.totals[key] || 0;
    }
    source.snapshots[quest.id] = snapshot;
  }

  function counterProgress(quest, key) {
    const source = counterSource(quest);
    if (!source) return 0;
    const snapshot = source.snapshots[quest.id] || {};
    return Math.max(0, (source.totals[key] || 0) - (snapshot[key] || 0));
  }

  function isQuestMet(quest) {
    if (counterSource(quest)) {
      return Object.entries(quest.requires).every(([key, qty]) => counterProgress(quest, key) >= qty);
    }
    return hasItems(quest.requires);
  }

  function textEl(text) {
    const p = document.createElement('p');
    p.className = 'quest-dialogue';
    p.textContent = text;
    return p;
  }

  // Only ever rendered for accepted quests — an offer withholds its requirements.
  function renderRequirement(quest, id, qty) {
    let subject;
    let suffix = '';
    // Only item requirements name an actual item; kills and actions point at a
    // monster or a verb, so they keep the plain swatch.
    let isItem = false;
    if (quest.type === 'kill') {
      subject = MONSTERS.find((m) => m.id === id);
      suffix = ' slain';
    } else if (quest.type === 'action') {
      subject = QUEST_ACTIONS.find((a) => a.id === id);
      suffix = subject ? ` ${subject.verb}` : '';
    } else {
      subject = getItem(id);
      isItem = true;
    }
    const progress = counterSource(quest) ? counterProgress(quest, id) : state.inventory[id] || 0;
    const row = document.createElement('div');
    row.className = 'node-card no-hover' + (progress >= qty ? ' met' : '');
    row.innerHTML = `
      ${isItem ? window.Minerous.itemSwatch(id) : `<span class="node-swatch" style="background:${subject ? subject.color : '#2c3542'}"></span>`}
      <span class="node-card-text">
        <div class="node-card-name">${subject ? subject.name : id}</div>
        <div class="node-card-meta">${progress} / ${qty}${suffix}</div>
      </span>
    `;
    return row;
  }

  // A quest can read differently depending on what's already happened elsewhere —
  // Ned's blade is for a squire until Tomas is knighted, and for a knight after.
  function altVariant(quest) {
    const alt = quest.altDialogue;
    return alt && isQuestComplete(alt.afterQuest) ? alt : null;
  }

  function questDialogue(quest) {
    const alt = altVariant(quest);
    return (alt && alt.text) || quest.dialogue;
  }

  function questName(quest) {
    const alt = altVariant(quest);
    return (alt && alt.name) || quest.name;
  }

  // The vague line an NPC opens with before you agree. Picked by quest order rather
  // than at random, so a given offer always reads the same and doesn't reshuffle
  // under the player between renders.
  function questTeaser(npc, quest) {
    const pool = npc.questTeasers || [];
    if (!pool.length) return `"I could use a hand with something. Interested?"`;
    return pool[(quest.order - 1) % pool.length];
  }

  // The terms, stated plainly before you agree and kept on screen after — a player
  // should never discover a failure condition by tripping over it.
  function failureTermsEl(quest, accepted) {
    const { timeLimitMs, penalty, deadlyTargets } = window.Minerous.getQuestFailure(quest);
    const skillName = (SKILLS.find((s) => s.id === penalty.skill) || {}).name || penalty.skill;
    const lines = [];

    if (timeLimitMs) {
      const remaining = accepted ? timeRemaining(quest.id) : null;
      lines.push(
        accepted && remaining !== null
          ? `⏳ <b>${window.Minerous.formatDuration(remaining)}</b> remaining`
          : `⏳ Time limit: ${window.Minerous.formatDuration(timeLimitMs)}`
      );
    } else {
      lines.push('⏳ No time limit');
    }

    // The rule is stated either way, but the specific quarry is only named once you've
    // committed — knowing exactly what you'd be fighting would let you shop for a
    // quest you already outmatch.
    if (deadlyTargets.length) {
      if (accepted) {
        for (const id of deadlyTargets) {
          const monster = MONSTERS.find((m) => m.id === id);
          lines.push(`☠ Failed if you are killed by a ${monster ? monster.name : id}`);
        }
      } else {
        lines.push('☠ Failed if your quarry kills you');
      }
    }

    if (penalty.xp > 0 || penalty.affinity > 0) {
      const costs = [];
      if (penalty.xp > 0) costs.push(`−${penalty.xp} ${skillName} xp`);
      if (penalty.affinity > 0) costs.push(`−${penalty.affinity} affinity`);
      lines.push(`⚠ Failing costs ${costs.join(' and ')}`);
    }

    const box = document.createElement('div');
    box.className = 'quest-terms' + (accepted ? ' active' : '');
    box.innerHTML = `<div class="quest-terms-title">Terms</div>${lines
      .map((l) => `<div class="quest-terms-line">${l}</div>`)
      .join('')}`;
    return box;
  }

  function renderQuestMode(container, npc) {
    const quest = activeQuestForNpc(npc.id);
    if (!quest) {
      container.appendChild(
        textEl(`"You've done more than enough for me. Thank you, truly." — ${npc.name} has no more quests for you.`)
      );
      return;
    }

    const accepted = isQuestAccepted(quest.id);

    // Until you commit you get a vague line and nothing else. Both the real dialogue
    // and the requirement list would tell you what to go and prepare — or let you
    // size up the fight — and hand it all straight back the moment you accepted.
    container.appendChild(textEl(accepted ? questDialogue(quest) : questTeaser(npc, quest)));

    if (accepted) {
      const reqList = document.createElement('div');
      reqList.className = 'node-list';
      for (const [id, qty] of Object.entries(quest.requires)) {
        reqList.appendChild(renderRequirement(quest, id, qty));
      }
      container.appendChild(reqList);
    }

    container.appendChild(failureTermsEl(quest, accepted));

    if (!accepted) {
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'inv-action-btn quest-turn-in-btn';
      acceptBtn.textContent = `Accept: ${questName(quest)}`;
      acceptBtn.addEventListener('click', () => acceptQuest(npc, quest));
      container.appendChild(acceptBtn);
      return;
    }

    const turnInBtn = document.createElement('button');
    turnInBtn.className = 'inv-action-btn quest-turn-in-btn';
    // A talk quest has nothing to hand over, so "Turn In" would read oddly.
    turnInBtn.textContent = quest.turnInLabel || `Turn In: ${questName(quest)}`;
    turnInBtn.disabled = !isQuestMet(quest);
    turnInBtn.addEventListener('click', () => turnInQuest(npc, quest));
    container.appendChild(turnInBtn);
  }

  function renderAskMode(container, npc) {
    const lastQuest = lastCompletedQuestForNpc(npc.id);
    container.appendChild(
      textEl(
        lastQuest
          ? `"Ah, I still remember when you helped with '${questName(lastQuest)}'. Much appreciated."`
          : `"You haven't done anything for me yet — but I'm sure you will."`
      )
    );

    const affinity = getAffinity(npc.id);
    const remaining = askCooldownRemaining(npc.id);
    const eligible = affinity >= ASK_AFFINITY_THRESHOLD;

    const resultBox = document.createElement('div');
    resultBox.className = 'quest-ask-result';

    const askBtn = document.createElement('button');
    askBtn.className = 'inv-action-btn quest-turn-in-btn';
    askBtn.textContent = 'Do you have anything for me?';

    if (!eligible) {
      resultBox.classList.add('locked');
      resultBox.textContent = `🔒 Not close enough yet (❤ ${affinity} / ${ASK_AFFINITY_THRESHOLD}). Complete more of their quests to raise affinity.`;
      askBtn.disabled = true;
    } else if (remaining > 0) {
      // Keep what they were given on screen for the whole cooldown, rather than replacing it
      // with a bare timer — the countdown is the less interesting half of the message. It
      // stays styled as a reward, too; amber "warning" colours for a gift read as a problem.
      const got = lastAskResult[npc.id];
      const seconds = Math.ceil(remaining / 1000);
      if (got) {
        resultBox.classList.add('success');
        resultBox.textContent = `🎁 ${npc.name} gave you ${got.qty}× ${got.name} — ask again in ${seconds}s.`;
      } else {
        resultBox.classList.add('cooldown');
        resultBox.textContent = `⏳ Already gave you something recently — try again in ${seconds}s.`;
      }
      askBtn.disabled = true;
    } else {
      resultBox.classList.add('ready');
      resultBox.textContent = '❓ Worth asking.';
    }

    askBtn.addEventListener('click', () => {
      const gift = npc.gift;
      const qty = gift.min + Math.floor(Math.random() * (gift.max - gift.min + 1));
      const name = getItem(gift.itemId).name;
      addItem(gift.itemId, qty);
      state.quests.giftCooldowns[npc.id] = Date.now() + ASK_COOLDOWN_MS;
      lastAskResult[npc.id] = { qty, name };
      window.Minerous.renderInventory();
      window.Minerous.showToast(`${npc.name} gave you ${qty}x ${name}!`, { levelUp: true });
      // Re-render rather than writing the text here, so the message the player reads is the
      // one the next tick would have drawn anyway — no flash, and one place formats it.
      renderDetail();
    });

    container.appendChild(resultBox);
    container.appendChild(askBtn);
  }

  function renderTradeMode(container, npc) {
    const clothing = CLOTHING.find((c) => c.npcId === npc.id);
    if (!clothing) {
      container.appendChild(textEl(`${npc.name} doesn't have anything special to trade.`));
      return;
    }

    const affinity = getAffinity(npc.id);
    const unlocked = affinity >= clothing.minAffinity;
    const owned = (state.inventory[clothing.id] || 0) > 0 || state.equippedClothingId === clothing.id;

    const card = document.createElement('div');
    card.className = 'node-card no-hover' + (unlocked ? '' : ' locked');
    card.innerHTML = `
      ${window.Minerous.itemSwatch(clothing.id)}
      <span class="node-card-text">
        <div class="node-card-name">${clothing.name}</div>
        <div class="node-card-meta quest-clothing-effect">${clothing.description}</div>
        <div class="node-card-meta">${
          unlocked ? `${clothing.price} coins` : `🔒 Requires ❤ ${clothing.minAffinity} affinity (have ${affinity})`
        }</div>
      </span>
    `;
    container.appendChild(card);

    if (!unlocked) return;

    const buyBtn = document.createElement('button');
    buyBtn.className = 'inv-action-btn quest-turn-in-btn';
    if (owned) {
      buyBtn.textContent = `Already own ${clothing.name}`;
      buyBtn.disabled = true;
    } else {
      buyBtn.textContent = `Buy ${clothing.name} (${clothing.price} coins)`;
      buyBtn.disabled = (state.inventory.coins || 0) < clothing.price;
      buyBtn.addEventListener('click', () => {
        if ((state.inventory.coins || 0) < clothing.price) return;
        spendItems({ coins: clothing.price });
        addItem(clothing.id, 1);
        window.Minerous.renderInventory();
        window.Minerous.showToast(`Bought ${clothing.name}!`, { levelUp: true });
        renderDetail();
      });
    }
    container.appendChild(buyBtn);
  }

  // Builds the whole NPC dialogue panel into `activeContainer`. Because the panel is
  // constructed rather than pulled from fixed markup, the same code serves every
  // location — the smithy, the temple, the tavern, and so on.
  function renderDetail() {
    const npc = NPCS.find((n) => n.id === activeNpcId);
    const container = activeContainer;
    if (!npc || !container || !container.isConnected) return;

    container.innerHTML = '';

    const heading = document.createElement('h3');
    heading.className = 'panel-subtitle';
    heading.textContent = npc.name;
    container.appendChild(heading);

    const affinityValue = getAffinity(npc.id);
    const affinity = document.createElement('div');
    affinity.className = 'quest-affinity' + (affinityValue < 0 ? ' negative' : '');
    affinity.textContent =
      affinityValue < 0
        ? `💔 Affinity: ${affinityValue} — you have let them down`
        : `❤ Affinity: ${affinityValue}`;
    container.appendChild(affinity);

    // Once the gate guard is replaced, the people who used to pay him say so.
    if (state.corruptGuardReplaced && npc.guardRemark) {
      const remark = document.createElement('div');
      remark.className = 'quest-remark';
      remark.textContent = npc.guardRemark;
      container.appendChild(remark);
    }

    const tabs = document.createElement('div');
    tabs.className = 'quest-tabs';
    for (const mode of [
      { id: 'quest', label: 'Quest' },
      { id: 'ask', label: 'Ask Around' },
      { id: 'trade', label: 'Trade' },
    ]) {
      const btn = document.createElement('button');
      btn.className = 'quest-tab-btn' + (dialogueMode === mode.id ? ' active' : '');
      btn.textContent = mode.label;
      btn.addEventListener('click', () => {
        dialogueMode = mode.id;
        renderDetail();
      });
      tabs.appendChild(btn);
    }
    container.appendChild(tabs);

    const content = document.createElement('div');
    container.appendChild(content);
    if (dialogueMode === 'ask') renderAskMode(content, npc);
    else if (dialogueMode === 'trade') renderTradeMode(content, npc);
    else renderQuestMode(content, npc);
  }

  // Read-only overview: which NPCs exist, what they currently want, and where to go
  // to actually talk to them.
  // Where an NPC is standing, for the log's "go here" line.
  function npcWhere(npc) {
    const area = AREAS.find((a) => (a.npcs || []).includes(npc.id));
    const building =
      window.Minerous.getBuildingName(npc.locationId) ||
      (window.Minerous.getNpcLocation(npc.locationId) || {}).name;
    return [building, area && area.name].filter(Boolean).join(' · ');
  }

  // One line per requirement, so the log answers "what do I still owe?" without
  // making you walk back to the NPC to find out.
  function progressLine(quest) {
    return Object.entries(quest.requires)
      .map(([id, qty]) => {
        let name = id;
        if (quest.type === 'kill') {
          const m = MONSTERS.find((x) => x.id === id);
          name = m ? m.name : id;
        } else if (quest.type === 'action') {
          const a = QUEST_ACTIONS.find((x) => x.id === id);
          name = a ? a.name : id;
        } else {
          const item = getItem(id);
          name = item ? item.name : id;
        }
        const have = counterSource(quest) ? counterProgress(quest, id) : state.inventory[id] || 0;
        return `${name} ${Math.min(have, qty)}/${qty}`;
      })
      .join(' · ');
  }

  // Only what you've actually taken on — the log is a to-do list, not a catalogue of
  // every quest in the world.
  function renderQuestLog() {
    const list = document.getElementById('quest-log-list');
    if (!list) return;
    list.innerHTML = '';

    const active = acceptedQuests();
    if (active.length === 0) {
      list.innerHTML =
        '<div class="node-list-note">No quests accepted. Visit the townsfolk in their homes and shops to see what they need.</div>';
      return;
    }

    for (const quest of active) {
      const npc = NPCS.find((n) => n.id === quest.npcId);
      if (!npc) continue;
      const ready = isQuestMet(quest);

      const { deadlyTargets, penalty } = window.Minerous.getQuestFailure(quest);
      const remaining = timeRemaining(quest.id);
      const urgent = remaining !== null && remaining < 5 * 60 * 1000;
      const deadly = deadlyTargets
        .map((id) => (MONSTERS.find((m) => m.id === id) || {}).name || id)
        .join(', ');

      const card = document.createElement('div');
      card.className = 'node-card no-hover' + (ready ? ' met' : '');
      card.innerHTML = `
        <span class="node-swatch" style="background:${npc.color}"></span>
        <span class="node-card-text">
          <div class="node-card-name">${questName(quest)}${ready ? ' · READY TO TURN IN' : ''}</div>
          <div class="node-card-meta">${progressLine(quest) || 'Speak to them to finish this.'}</div>
          <div class="node-card-meta quest-log-where">📍 ${npc.name} — ${npcWhere(npc) || 'location unknown'}</div>
          <div class="node-card-meta quest-log-terms${urgent ? ' urgent' : ''}">${
            remaining === null ? '⏳ No time limit' : `⏳ ${window.Minerous.formatDuration(remaining)} left`
          }${deadly ? ` · ☠ Don't die to ${deadly}` : ''} · ⚠ −${penalty.xp} xp, −${penalty.affinity} affinity</div>
        </span>
      `;
      list.appendChild(card);
    }
  }

  // Effects a quest can have on the world beyond its own NPC: flipping a story flag,
  // moving everyone's opinion of you, or handing over a feat you can't buy.
  function applyStoryRewards(quest) {
    if (quest.setsFlags) {
      for (const [flag, value] of Object.entries(quest.setsFlags)) state[flag] = value;
    }

    if (quest.rewardAffinityAll) {
      for (const other of NPCS) {
        state.affinityBonus[other.id] = (state.affinityBonus[other.id] || 0) + quest.rewardAffinityAll;
      }
      window.Minerous.showToast(`Word spreads — +${quest.rewardAffinityAll} affinity with everyone`, { levelUp: true });
    }

    if (quest.rewardFeatId && !state.feats.includes(quest.rewardFeatId)) {
      const feat = window.Minerous.getFeat(quest.rewardFeatId);
      state.feats.push(quest.rewardFeatId);
      if (feat) window.Minerous.showToast(`Secret feat unlocked: ${feat.icon} ${feat.name}`, { levelUp: true });
    }
  }

  function turnInQuest(npc, quest) {
    if (!isQuestMet(quest)) return;

    // Only item-gather quests consume anything — kill and action quests are measured
    // against counters, so there's nothing in the inventory to hand over.
    if (!counterSource(quest)) spendItems(quest.requires);
    state.quests.completedIds.push(quest.id);

    if (quest.rewardCoins) addItem('coins', quest.rewardCoins);
    if (quest.rewardStoneId) addItem(quest.rewardStoneId, 1);
    const leveledUp = addXp(quest.rewardXp.skill, quest.rewardXp.amount);
    applyStoryRewards(quest);

    window.Minerous.renderInventory();
    window.Minerous.showToast(
      `Completed "${questName(quest)}"! +${quest.rewardCoins} coins, +${quest.rewardXp.amount} xp, +${quest.rewardAffinity} affinity with ${npc.name}`,
      { levelUp: true }
    );
    if (leveledUp) {
      const skillName = SKILLS.find((s) => s.id === quest.rewardXp.skill).name;
      window.Minerous.showToast(`Level up! ${skillName} level ${getLevel(quest.rewardXp.skill)}`, { levelUp: true });
    }

    // The next quest is only *offered* now — no snapshot, no acceptance. Snapshotting
    // it here (a leftover from before quests had to be accepted) made it look accepted
    // to the migration below, so finishing one quest silently started the next.
    renderDetail();
  }

  window.Minerous.Quests = {
    migrate,
    // Called by whichever location screen the NPC lives in.
    openPanel(container, npcId) {
      activeContainer = container;
      activeNpcId = npcId;
      dialogueMode = 'quest';
      renderDetail();
    },
    clearPanel() {
      activeContainer = null;
      activeNpcId = null;
    },
    // The Quests nav button — a log, not a place to talk to anyone.
    refresh() {
      renderQuestLog();
    },
    stop() {},
    tick() {},
    // Runs from the global loop rather than a screen module, because an NPC panel can
    // be embedded in any screen (the smithy's own tick wouldn't know about it).
    notifyDeath,
    tickPanel() {
      const now = performance.now();
      if (now - lastAskTick <= 1000) return;
      lastAskTick = now;
      // Deadlines land wherever you are, so this runs before any screen check.
      tickFailures();
      // Both the ask-around cooldown and the quest countdown need a second hand.
      if (activeContainer) renderDetail();
      if (state.screen === 'quests') renderQuestLog();
    },
  };
})();
