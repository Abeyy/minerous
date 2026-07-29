window.Minerous = window.Minerous || {};

(function () {
  const { MONSTERS, SKILLS, state, addItem, addXp, getLevel, spendItems } = window.Minerous;

  // Area blockers: a locked area shows this modal, and you either slip away or fight
  // your way through. Beating one records its id in state.clearedGates permanently.
  let pendingArea = null;
  // Set while a toll modal is open; the pay button doubles as the modal's primary
  // action, so it needs to know which flow it's serving.
  let tollHandler = null;

  const el = {
    modal: document.getElementById('gate-modal'),
    title: document.getElementById('gate-modal-title'),
    text: document.getElementById('gate-modal-text'),
    result: document.getElementById('gate-modal-result'),
    rewards: document.getElementById('gate-modal-rewards'),
    quiz: document.getElementById('gate-modal-quiz'),
    actions: document.getElementById('gate-modal-actions'),
    closeBtn: document.getElementById('gate-modal-close'),
    retreatBtn: document.getElementById('gate-retreat-btn'),
    fightBtn: document.getElementById('gate-fight-btn'),
    continueBtn: document.getElementById('gate-continue-btn'),
  };

  function isCleared(gateId) {
    return state.clearedGates.includes(gateId);
  }

  function closeModal() {
    el.modal.hidden = true;
    el.quiz.hidden = true;
    el.continueBtn.textContent = 'Continue';
    pendingArea = null;
    tollHandler = null;
  }

  function showResult(message, kind) {
    el.result.hidden = false;
    el.result.className = `gate-modal-result ${kind}`;
    el.result.textContent = message;
  }

  function encounterMonster(gate) {
    return MONSTERS.find((m) => m.id === gate.encounter.monsterId) || null;
  }

  function encounterLabel(gate) {
    const monster = encounterMonster(gate);
    const name = monster ? monster.name : gate.encounter.monsterId;
    const prefix = gate.encounter.count > 1 ? `${gate.encounter.count}x ` : '';
    return `${prefix}${name} (Lv ${monster ? monster.level : '?'})`;
  }

  // The way into a new area is always a boss, so the stakes are spelled out before
  // you commit — same numbers combat.js will actually take off you if you lose.
  function penaltyLabel(gate) {
    const monster = encounterMonster(gate);
    if (!monster || !monster.boss) return '';
    const penalty = window.Minerous.bossDefeatPenalty(monster.level);
    return `⚠ Boss fight — if you lose: −${penalty.coins} gold and −${penalty.xp} xp, and the road stays blocked.`;
  }

  // Screening gates aren't fights — you answer questions and get turned away. The
  // quiz is unwinnable by design; the real key is elsewhere in the world.
  function openQuizModal(area) {
    pendingArea = area;
    const gate = area.gate;
    el.title.textContent = gate.title;
    el.rewards.hidden = true;
    el.retreatBtn.hidden = true;
    el.fightBtn.hidden = true;
    el.continueBtn.hidden = false;
    el.continueBtn.textContent = 'Leave';

    if (state.capitalScreeningFailed) {
      el.text.textContent = gate.lockedText;
      el.result.hidden = true;
      el.quiz.hidden = true;
      el.modal.hidden = false;
      return;
    }

    el.text.textContent = gate.text;
    el.result.hidden = true;
    el.continueBtn.hidden = true;
    renderQuiz(gate);
    el.modal.hidden = false;
  }

  function renderQuiz(gate) {
    el.quiz.hidden = false;
    el.quiz.innerHTML = '';
    const picked = new Array(gate.questions.length).fill(null);

    gate.questions.forEach((question, qi) => {
      const block = document.createElement('div');
      block.className = 'quiz-question';
      block.innerHTML = `<div class="quiz-prompt">${qi + 1}. ${question.prompt}</div>`;

      const opts = document.createElement('div');
      opts.className = 'quiz-options';
      question.options.forEach((option, oi) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = option;
        btn.addEventListener('click', () => {
          picked[qi] = oi;
          [...opts.children].forEach((c) => c.classList.remove('picked'));
          btn.classList.add('picked');
          submit.disabled = picked.some((p) => p === null);
        });
        opts.appendChild(btn);
      });
      block.appendChild(opts);
      el.quiz.appendChild(block);
    });

    const submit = document.createElement('button');
    submit.className = 'modal-btn primary quiz-submit';
    submit.textContent = 'Hand in your answers';
    submit.disabled = true;
    submit.addEventListener('click', () => failQuiz(gate));
    el.quiz.appendChild(submit);
  }

  function failQuiz(gate) {
    state.capitalScreeningFailed = true;
    el.quiz.hidden = true;
    showResult(gate.failText, 'danger');
    el.text.textContent = gate.lockedText;
    el.continueBtn.hidden = false;
    el.continueBtn.textContent = 'Leave';
  }

  // Some gates open because of something you did elsewhere rather than at the gate
  // itself. Called after any event that might satisfy one.
  function checkAutoClears() {
    for (const area of window.Minerous.AREAS) {
      const gate = area.gate;
      if (!gate || !gate.clearedBy || isCleared(gate.id)) continue;
      const tier = gate.clearedBy.campTierDefeated;
      if (tier && window.Minerous.campTierDefeated(tier)) {
        state.clearedGates.push(gate.id);
      }
    }
  }

  // Plays a gate's arrival scene the first time you actually set foot in the area,
  // however the gate came to be open.
  function maybeShowArrivalReward(area) {
    const gate = area.gate;
    if (!gate || !gate.reward || !isCleared(gate.id)) return;
    if (state.gateRewardsShown.includes(gate.id)) return;
    state.gateRewardsShown.push(gate.id);
    grantReward(gate);
  }

  // A toll isn't a blocker — the road is cleared and the town would have you. It's one
  // man with his hand out, and it keeps costing until the crown removes him.
  function tollDue(area) {
    return !!area.toll && !state.corruptGuardReplaced;
  }

  function openTollModal(area, onPaid) {
    const toll = area.toll;
    pendingArea = area;
    el.title.textContent = toll.title;
    el.text.textContent = toll.text;
    el.quiz.hidden = true;
    el.rewards.hidden = true;
    el.result.hidden = true;
    el.continueBtn.hidden = true;
    el.retreatBtn.hidden = false;
    el.fightBtn.hidden = false;
    el.retreatBtn.disabled = false;
    el.fightBtn.disabled = false;
    el.retreatBtn.textContent = toll.refuseLabel;
    el.fightBtn.textContent = toll.payLabel;

    const canPay = (state.inventory.coins || 0) >= toll.amount;
    el.fightBtn.disabled = !canPay;
    if (!canPay) showResult(toll.brokeText, 'danger');

    tollHandler = () => {
      spendItems({ coins: toll.amount });
      window.Minerous.renderInventory();
      closeModal();
      window.Minerous.showToast(toll.paidText);
      onPaid();
    };
    el.modal.hidden = false;
  }

  function openModal(area) {
    pendingArea = area;
    const gate = area.gate;
    if (gate.kind === 'quiz') {
      openQuizModal(area);
      return;
    }
    el.title.textContent = gate.title;
    el.text.textContent = gate.text;
    const warning = penaltyLabel(gate);
    if (warning) {
      showResult(warning, 'danger');
    } else {
      el.result.hidden = true;
    }
    el.rewards.hidden = true;
    el.retreatBtn.hidden = false;
    el.fightBtn.hidden = false;
    el.continueBtn.hidden = true;
    el.retreatBtn.disabled = false;
    el.fightBtn.disabled = false;
    el.retreatBtn.textContent = `Attempt to retreat (${Math.round(gate.retreatChance * 100)}% chance)`;
    el.fightBtn.textContent = `Fight — ${encounterLabel(gate)}`;
    el.modal.hidden = false;
  }

  // Granted once, the first time a blocker is cleared — then the town's ruler shows up
  // to thank you in person.
  function grantReward(gate) {
    const reward = gate.reward;
    if (!reward) return;

    const lines = [];
    if (reward.coins) {
      addItem('coins', reward.coins);
      lines.push(`💰 ${reward.coins} gold`);
    }
    if (reward.xp) {
      const leveledUp = addXp(reward.xp.skill, reward.xp.amount);
      const skill = SKILLS.find((s) => s.id === reward.xp.skill);
      const skillName = skill ? skill.name : reward.xp.skill;
      lines.push(`⚔ ${reward.xp.amount} ${skillName} xp`);
      if (leveledUp) {
        window.Minerous.showToast(`Level up! ${skillName} level ${getLevel(reward.xp.skill)}`, { levelUp: true });
      }
    }
    window.Minerous.renderInventory();

    pendingArea = null;
    el.title.textContent = reward.title;
    el.text.textContent = reward.text;
    el.result.hidden = true;
    // The same modal may have just held a screening; clear it out before the ruler
    // speaks, or their scene renders on top of the rejection.
    el.quiz.hidden = true;
    el.quiz.innerHTML = '';
    el.rewards.hidden = false;
    el.rewards.innerHTML = lines.map((line) => `<div class="gate-reward-line">${line}</div>`).join('');
    el.retreatBtn.hidden = true;
    el.fightBtn.hidden = true;
    el.continueBtn.hidden = false;
    el.modal.hidden = false;
  }

  function beginFight() {
    const area = pendingArea;
    const gate = area.gate;
    closeModal();

    window.Minerous.Combat.startGateEncounter({
      title: gate.title,
      monsterId: gate.encounter.monsterId,
      count: gate.encounter.count,
      onWin() {
        if (!isCleared(gate.id)) state.clearedGates.push(gate.id);
        state.currentAreaId = area.id;
        window.Minerous.showToast(`Path cleared — welcome to ${area.name}!`, { levelUp: true });
        window.Minerous.switchScreen('home');
        // Arrive in town first, then the ruler greets you.
        maybeShowArrivalReward(area);
      },
      onLose() {
        window.Minerous.showToast(`Driven back! ${gate.text} You'll have to try again.`);
        // Back to whichever area they set out from — the blocker stays uncleared.
        window.Minerous.switchScreen(window.Minerous.getArea(state.currentAreaId) ? 'home' : 'world');
      },
      onAbandon() {
        window.Minerous.showToast('You slipped away from the fight — the path is still blocked.');
      },
    });
  }

  function attemptRetreat() {
    const gate = pendingArea.gate;
    el.retreatBtn.disabled = true;
    el.fightBtn.disabled = true;

    if (Math.random() < gate.retreatChance) {
      showResult('✅ You slip away unnoticed. The path remains blocked.', 'success');
      setTimeout(() => {
        closeModal();
        window.Minerous.showToast('You retreated safely.');
      }, 1200);
      return;
    }

    // Failed retreat means they catch you — straight into the fight, no second choice.
    showResult(`⚠ ${gate.retreatFailText}`, 'danger');
    setTimeout(beginFight, 1400);
  }

  el.closeBtn.addEventListener('click', closeModal);
  // Both buttons serve double duty: retreat/fight for a blocker, refuse/pay for a toll.
  el.retreatBtn.addEventListener('click', () => (tollHandler ? closeModal() : attemptRetreat()));
  el.fightBtn.addEventListener('click', () => (tollHandler ? tollHandler() : beginFight()));
  el.continueBtn.addEventListener('click', closeModal);
  el.modal.addEventListener('click', (event) => {
    if (event.target === el.modal) closeModal();
  });

  window.Minerous.Gate = {
    isCleared,
    checkAutoClears,
    maybeShowArrivalReward,
    // Returns true if something stopped you at the edge of the area — a blocker to
    // clear, or a toll to pay. `onPaid` runs if a toll is settled, since paying should
    // let you straight in rather than making you click the map again.
    tryEnterArea(area, onPaid) {
      checkAutoClears();
      if (area.gate && !isCleared(area.gate.id)) {
        openModal(area);
        return true;
      }
      if (tollDue(area)) {
        openTollModal(area, onPaid || (() => {}));
        return true;
      }
      return false;
    },
  };
})();
