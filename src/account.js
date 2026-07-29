window.Minerous = window.Minerous || {};

(function () {
  let session = null;

  const el = {
    accountBtn: document.getElementById('nav-account-btn'),
    modal: document.getElementById('account-modal'),
    closeBtn: document.getElementById('account-modal-close'),
    signedOutView: document.getElementById('account-signed-out'),
    signedInView: document.getElementById('account-signed-in'),
    emailInput: document.getElementById('account-email'),
    passwordInput: document.getElementById('account-password'),
    signInBtn: document.getElementById('account-signin-btn'),
    signUpBtn: document.getElementById('account-signup-btn'),
    signOutBtn: document.getElementById('account-signout-btn'),
    syncBtn: document.getElementById('account-sync-btn'),
    emailLabel: document.getElementById('account-email-label'),
    status: document.getElementById('account-status'),
  };

  function setStatus(message) {
    el.status.textContent = message || '';
  }

  function renderSession() {
    const signedIn = !!session;
    el.signedOutView.hidden = signedIn;
    el.signedInView.hidden = !signedIn;
    el.accountBtn.textContent = signedIn ? `👤 ${session.email}` : '👤 Account';
    if (signedIn) el.emailLabel.textContent = session.email;
  }

  function openModal() {
    el.modal.hidden = false;
    setStatus('');
  }

  function closeModal() {
    el.modal.hidden = true;
  }

  async function syncAfterLogin() {
    const result = await window.minerousAPI.cloud.pullSave();
    if (result.error) {
      setStatus(`Signed in, but cloud sync failed: ${result.error}`);
      return;
    }
    if (result.data) {
      window.Minerous.Persistence.applyCloudSave(result.data.data);
      window.Minerous.refreshAllUI();
      window.Minerous.showToast('Cloud save loaded');
    } else {
      await window.Minerous.Persistence.pushToCloud();
      window.Minerous.showToast('Progress uploaded to your account');
    }
  }

  async function handleSignIn() {
    const email = el.emailInput.value.trim();
    const password = el.passwordInput.value;
    if (!email || !password) {
      setStatus('Enter an email and password.');
      return;
    }
    setStatus('Signing in...');
    const result = await window.minerousAPI.auth.signIn(email, password);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    session = result.session;
    renderSession();
    setStatus('Signed in!');
    await syncAfterLogin();
  }

  async function handleSignUp() {
    const email = el.emailInput.value.trim();
    const password = el.passwordInput.value;
    if (!email || !password) {
      setStatus('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setStatus('Password must be at least 6 characters.');
      return;
    }
    setStatus('Creating account...');
    const result = await window.minerousAPI.auth.signUp(email, password);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    if (result.session) {
      session = result.session;
      renderSession();
      setStatus('Account created!');
      await syncAfterLogin();
    } else {
      setStatus('Check your email to confirm your account, then log in.');
    }
  }

  async function handleSignOut() {
    setStatus('Signing out...');
    await window.minerousAPI.auth.signOut();
    session = null;
    renderSession();
    setStatus('Signed out.');
  }

  async function handleSyncNow() {
    setStatus('Syncing...');
    const result = await window.Minerous.Persistence.pushToCloud();
    setStatus(result && result.error ? result.error : 'Synced!');
  }

  el.accountBtn.addEventListener('click', openModal);
  el.closeBtn.addEventListener('click', closeModal);
  el.signInBtn.addEventListener('click', handleSignIn);
  el.signUpBtn.addEventListener('click', handleSignUp);
  el.signOutBtn.addEventListener('click', handleSignOut);
  el.syncBtn.addEventListener('click', handleSyncNow);

  window.Minerous.Account = {
    isSignedIn: () => !!session,
    async restoreSession() {
      if (!window.minerousAPI) return;
      const result = await window.minerousAPI.auth.getSession();
      if (result.session) {
        session = result.session;
        renderSession();
      }
    },
  };
})();
