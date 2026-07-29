window.Minerous = window.Minerous || {};

(function () {
  const api = window.minerousAPI && window.minerousAPI.updates;

  const el = {
    banner: document.getElementById('update-banner'),
    text: document.getElementById('update-banner-text'),
    restartBtn: document.getElementById('update-restart-btn'),
    dismissBtn: document.getElementById('update-dismiss-btn'),
    versionLabel: document.getElementById('app-version-label'),
    checkBtn: document.getElementById('update-check-btn'),
  };

  // Running in a plain browser (the dev preview) — there's no main process to ask.
  if (!api) {
    el.versionLabel.textContent = 'Minerous — browser preview';
    el.checkBtn.hidden = true;
    return;
  }

  let currentVersion = '';

  function show(message, { restart = false, tone = '' } = {}) {
    el.banner.hidden = false;
    el.banner.className = `update-banner${tone ? ` ${tone}` : ''}`;
    el.text.textContent = message;
    el.restartBtn.hidden = !restart;
  }

  function hide() {
    el.banner.hidden = true;
  }

  el.dismissBtn.addEventListener('click', hide);

  el.restartBtn.addEventListener('click', async () => {
    // Flush the save synchronously first — quitAndInstall kills the window, and an
    // idle game's whole value is the progress sitting in memory.
    window.Minerous.Persistence.saveBeforeQuit();
    el.restartBtn.disabled = true;
    el.text.textContent = 'Saving and restarting…';
    await api.install();
  });

  el.checkBtn.addEventListener('click', async () => {
    el.checkBtn.disabled = true;
    show('Checking for updates…');
    const result = await api.check();
    el.checkBtn.disabled = false;
    if (!result.ok) show(result.error, { tone: 'muted' });
  });

  api.onStatus((payload) => {
    switch (payload.status) {
      case 'checking':
        show('Checking for updates…', { tone: 'muted' });
        break;
      case 'current':
        show(`You're up to date (v${currentVersion}).`, { tone: 'muted' });
        setTimeout(hide, 4000);
        break;
      case 'available':
        show(`Minerous v${payload.version} is available — downloading in the background…`);
        break;
      case 'downloading':
        show(`Downloading update… ${payload.percent}%`);
        break;
      case 'ready':
        // Deliberately not auto-restarting: nobody wants the app to vanish mid-fight.
        show(`Minerous v${payload.version} is ready to install.`, { restart: true, tone: 'ready' });
        break;
      case 'disabled':
        // Dev build — say so in the modal rather than nagging with a banner.
        el.versionLabel.textContent += ' — dev build, updates disabled';
        break;
      case 'error':
        show(`Update check failed: ${payload.message}`, { tone: 'muted' });
        setTimeout(hide, 6000);
        break;
      default:
        break;
    }
  });

  api.version().then((version) => {
    currentVersion = version;
    el.versionLabel.textContent = `Minerous v${version}`;
  });
})();
