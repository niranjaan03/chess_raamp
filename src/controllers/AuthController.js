/**
 * AuthController — sign-in / sign-up / Google OAuth / session persistence.
 *
 * Owns auth-only state via the shared `state` singleton (state.profile,
 * state.authSession, state.authMode). Calls back into the host app for
 * cross-cutting actions via the deps passed to init().
 */

import { showToast } from '../utils/toast.js';
import { state, DEFAULT_ENGINE_ID } from './state.js';

const RAW_GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID)
  ? import.meta.env.VITE_GOOGLE_CLIENT_ID
  : '';

const AUTH_ACCOUNTS_KEY = 'kv_auth_accounts';
const AUTH_SESSION_KEY = 'kv_auth_session';
const GOOGLE_AUTH_STATE_KEY = 'kv_google_auth_state';
const GOOGLE_AUTH_NONCE_KEY = 'kv_google_auth_nonce';
const GOOGLE_CLIENT_ID = RAW_GOOGLE_CLIENT_ID || '';

let _applyProfile = () => {};
let _switchTab = () => {};
let _onAuthChange = () => {};

function getDefaultProfile() {
  return {
    displayName: '',
    chesscomUsername: '',
    lichessUsername: '',
    linkedAccounts: [],
    activeAccountId: '',
    prefEngine: DEFAULT_ENGINE_ID,
    prefDepth: '20',
    authEmail: '',
    authProvider: '',
    isAuthenticated: false
  };
}

function getStoredAuthAccounts() {
  try {
    var saved = JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

function saveStoredAuthAccounts(accounts) {
  try {
    localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch { /* storage full */ }
}

function getStoredAuthSession() {
  try {
    var saved = localStorage.getItem(AUTH_SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function saveAuthSession(session) {
  state.authSession = session || null;
  try {
    if (state.authSession) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(state.authSession));
    else localStorage.removeItem(AUTH_SESSION_KEY);
  } catch { /* storage full */ }
}

function deriveDisplayName(email) {
  var localPart = String(email || '').split('@')[0] || 'Guest';
  var cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  return cleaned ? cleaned.replace(/\b\w/g, function(ch) { return ch.toUpperCase(); }) : 'Guest';
}

function sanitizeProfileForAccount(sourceProfile) {
  return {
    displayName: sourceProfile.displayName || '',
    chesscomUsername: sourceProfile.chesscomUsername || '',
    lichessUsername: sourceProfile.lichessUsername || '',
    linkedAccounts: Array.isArray(sourceProfile.linkedAccounts) ? sourceProfile.linkedAccounts : [],
    activeAccountId: sourceProfile.activeAccountId || '',
    prefEngine: sourceProfile.prefEngine || DEFAULT_ENGINE_ID,
    prefDepth: sourceProfile.prefDepth || '20'
  };
}

function persistProfileState(syncAccount) {
  try {
    localStorage.setItem('kv_profile', JSON.stringify(state.profile));
  } catch { /* storage full */ }
  if (syncAccount !== false) persistProfileToAuthenticatedAccount();
}

function persistProfileToAuthenticatedAccount() {
  if (!state.authSession || !state.authSession.accountId) return;
  var accounts = getStoredAuthAccounts();
  var index = accounts.findIndex(function(account) {
    return String(account.id) === String(state.authSession.accountId);
  });
  if (index === -1) return;
  accounts[index].displayName = state.profile.displayName || state.authSession.displayName || deriveDisplayName(state.authSession.email);
  accounts[index].profileData = sanitizeProfileForAccount(state.profile);
  accounts[index].lastLoginAt = new Date().toISOString();
  saveStoredAuthAccounts(accounts);
}

function restoreProfileFromAccount(account) {
  if (!account) return;
  state.profile = Object.assign(getDefaultProfile(), account.profileData || {});
  state.profile.displayName = state.profile.displayName || account.displayName || deriveDisplayName(account.email);
  state.profile.authEmail = account.email || '';
  state.profile.authProvider = account.provider || 'email';
  state.profile.isAuthenticated = true;
  persistProfileState(false);
  _applyProfile();
}

function refreshAuthLinkedUI() {
  renderAuthState();
  if (window.HomeController) window.HomeController.refreshHomeData();
  _onAuthChange();
}

function loadAuthSession() {
  var savedSession = getStoredAuthSession();
  if (!savedSession || !savedSession.accountId) {
    saveAuthSession(null);
    renderAuthState();
    return;
  }

  var accounts = getStoredAuthAccounts();
  var account = accounts.find(function(entry) {
    return String(entry.id) === String(savedSession.accountId);
  });

  if (!account) {
    saveAuthSession(null);
    renderAuthState();
    return;
  }

  saveAuthSession({
    accountId: account.id,
    email: account.email || '',
    displayName: account.displayName || deriveDisplayName(account.email),
    provider: account.provider || 'email'
  });
  restoreProfileFromAccount(account);
  renderAuthState();
}

async function hashSecret(secret) {
  var value = String(secret || '');
  if (!value) return '';
  if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === 'undefined') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  var bytes = new TextEncoder().encode(value);
  var buffer = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer)).map(function(byte) {
    return byte.toString(16).padStart(2, '0');
  }).join('');
}

function parseJwtCredential(credential) {
  try {
    var payload = credential.split('.')[1];
    var normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    var decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

function getRandomToken(size) {
  var length = size || 24;
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var values = new Uint8Array(length);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(values);
  } else {
    for (var i = 0; i < length; i++) values[i] = Math.floor(Math.random() * alphabet.length);
  }
  return Array.from(values).map(function(value) {
    return alphabet[value % alphabet.length];
  }).join('');
}

function clearGoogleRedirectState() {
  try {
    sessionStorage.removeItem(GOOGLE_AUTH_STATE_KEY);
    sessionStorage.removeItem(GOOGLE_AUTH_NONCE_KEY);
  } catch { /* sessionStorage blocked in restricted environments */ }
}

function handleGooglePayload(payload) {
  if (!payload || !payload.email) return false;

  var accounts = getStoredAuthAccounts();
  var email = String(payload.email).toLowerCase();
  var account = accounts.find(function(entry) {
    return String(entry.email || '').toLowerCase() === email || (payload.sub && entry.googleSub === payload.sub);
  });

  if (!account) {
    account = {
      id: 'acct_' + Date.now(),
      email: email,
      displayName: payload.name || deriveDisplayName(email),
      provider: 'google',
      googleSub: payload.sub || '',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      profileData: {
        displayName: payload.name || deriveDisplayName(email),
        prefEngine: DEFAULT_ENGINE_ID,
        prefDepth: '20'
      }
    };
    accounts.unshift(account);
  } else {
    account.provider = 'google';
    account.googleSub = payload.sub || account.googleSub || '';
    account.displayName = account.displayName || payload.name || deriveDisplayName(email);
    account.lastLoginAt = new Date().toISOString();
  }

  saveStoredAuthAccounts(accounts);
  completeSignIn(account, 'Signed in with Google.');
  return true;
}

function handleGoogleRedirectResult() {
  if (!window.location.hash || window.location.hash.indexOf('id_token=') === -1) return;

  var hash = new URLSearchParams(window.location.hash.slice(1));
  var idToken = hash.get('id_token');
  var returnedState = hash.get('state');
  var returnedError = hash.get('error');
  var expectedState = '';
  var expectedNonce = '';

  try {
    expectedState = sessionStorage.getItem(GOOGLE_AUTH_STATE_KEY) || '';
    expectedNonce = sessionStorage.getItem(GOOGLE_AUTH_NONCE_KEY) || '';
  } catch { /* sessionStorage blocked in restricted environments */ }

  var nextUrl = window.location.pathname + window.location.search;
  window.history.replaceState({}, document.title, nextUrl);

  if (returnedError) {
    clearGoogleRedirectState();
    window.setTimeout(function() {
      showToast('Google sign-in was cancelled.', 'error');
    }, 60);
    return;
  }

  if (!idToken || !returnedState || returnedState !== expectedState) {
    clearGoogleRedirectState();
    window.setTimeout(function() {
      showToast('Google sign-in could not be verified.', 'error');
    }, 60);
    return;
  }

  var payload = parseJwtCredential(idToken);
  clearGoogleRedirectState();

  if (!payload || !payload.email || (expectedNonce && payload.nonce !== expectedNonce)) {
    window.setTimeout(function() {
      showToast('Google sign-in could not be verified.', 'error');
    }, 60);
    return;
  }

  window.setTimeout(function() {
    handleGooglePayload(payload);
  }, 60);
}

function getAuthProviderLabel(provider) {
  return provider === 'google' ? 'Google' : 'Email';
}

function setAuthMessage(message, type) {
  var statusEl = document.getElementById('authStatusMessage');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.className = 'auth-status-message' + (type ? ' is-' + type : '');
}

function setAuthMode(mode) {
  state.authMode = mode === 'signup' ? 'signup' : 'signin';
  var signInTab = document.getElementById('authTabSignIn');
  var signUpTab = document.getElementById('authTabSignUp');
  var signInPanel = document.getElementById('authPanelSignIn');
  var signUpPanel = document.getElementById('authPanelSignUp');
  if (signInTab) signInTab.classList.toggle('active', state.authMode === 'signin');
  if (signUpTab) signUpTab.classList.toggle('active', state.authMode === 'signup');
  if (signInPanel) signInPanel.style.display = state.authMode === 'signin' ? 'block' : 'none';
  if (signUpPanel) signUpPanel.style.display = state.authMode === 'signup' ? 'block' : 'none';
  setAuthMessage('');
}

function renderAuthState() {
  var nameEl = document.getElementById('profileName');
  var signedInView = document.getElementById('authSignedInView');
  var signedOutView = document.getElementById('authSignedOutView');
  var sessionNameEl = document.getElementById('authSessionName');
  var sessionEmailEl = document.getElementById('authSessionEmail');
  var sessionProviderEl = document.getElementById('authSessionProvider');
  var buttonEl = document.getElementById('profileBtn');

  if (nameEl) {
    nameEl.textContent = state.authSession
      ? (state.profile.displayName || state.authSession.displayName || deriveDisplayName(state.authSession.email))
      : 'Sign In';
  }
  if (buttonEl) buttonEl.classList.toggle('is-signed-in', !!state.authSession);
  if (signedInView) signedInView.style.display = state.authSession ? 'block' : 'none';
  if (signedOutView) signedOutView.style.display = state.authSession ? 'none' : 'block';
  if (sessionNameEl) sessionNameEl.textContent = state.profile.displayName || (state.authSession ? state.authSession.displayName : 'Guest');
  if (sessionEmailEl) sessionEmailEl.textContent = state.authSession ? state.authSession.email : '';
  if (sessionProviderEl) sessionProviderEl.textContent = state.authSession ? getAuthProviderLabel(state.authSession.provider) : '';
  if (!state.authSession) {
    setAuthMode(state.authMode);
  }
}

function openAuthModal() {
  var modal = document.getElementById('authModal');
  if (!modal) return;
  renderAuthState();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  var modal = document.getElementById('authModal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  setAuthMessage('');
}

function completeSignIn(account, toastMessage) {
  saveAuthSession({
    accountId: account.id,
    email: account.email || '',
    displayName: account.displayName || deriveDisplayName(account.email),
    provider: account.provider || 'email'
  });
  restoreProfileFromAccount(account);
  renderAuthState();
  closeAuthModal();
  refreshAuthLinkedUI();
  showToast(toastMessage || 'Signed in', 'success');
}

async function handleEmailSignUp() {
  var name = (document.getElementById('authSignUpName').value || '').trim();
  var email = (document.getElementById('authSignUpEmail').value || '').trim().toLowerCase();
  var password = document.getElementById('authSignUpPassword').value || '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthMessage('Enter a valid email address.', 'error');
    return;
  }
  if (password.length < 6) {
    setAuthMessage('Use a password with at least 6 characters.', 'error');
    return;
  }

  var accounts = getStoredAuthAccounts();
  var existing = accounts.find(function(account) {
    return String(account.email || '').toLowerCase() === email;
  });
  if (existing) {
    setAuthMessage(existing.provider === 'google' ? 'This email uses Google sign-in.' : 'An account with this email already exists.', 'error');
    return;
  }

  var account = {
    id: 'acct_' + Date.now(),
    email: email,
    displayName: name || deriveDisplayName(email),
    provider: 'email',
    passwordHash: await hashSecret(password),
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    profileData: {
      displayName: name || deriveDisplayName(email),
      prefEngine: DEFAULT_ENGINE_ID,
      prefDepth: '20'
    }
  };
  accounts.unshift(account);
  saveStoredAuthAccounts(accounts);
  completeSignIn(account, 'Account created and signed in.');
}

async function handleEmailSignIn() {
  var email = (document.getElementById('authSignInEmail').value || '').trim().toLowerCase();
  var password = document.getElementById('authSignInPassword').value || '';

  if (!email || !password) {
    setAuthMessage('Enter your email and password.', 'error');
    return;
  }

  var accounts = getStoredAuthAccounts();
  var account = accounts.find(function(entry) {
    return String(entry.email || '').toLowerCase() === email;
  });

  if (!account) {
    setAuthMessage('No account found for that email.', 'error');
    return;
  }
  if (account.provider === 'google') {
    setAuthMessage('This email uses Google sign-in.', 'error');
    return;
  }

  var passwordHash = await hashSecret(password);
  if (passwordHash !== account.passwordHash) {
    setAuthMessage('Incorrect password.', 'error');
    return;
  }

  account.lastLoginAt = new Date().toISOString();
  saveStoredAuthAccounts(accounts);
  completeSignIn(account, 'Signed in successfully.');
}

function handleGoogleSignInClick() {
  setAuthMessage('');
  if (!GOOGLE_CLIENT_ID) {
    setAuthMessage('Google sign-in is not configured yet.', 'error');
    return;
  }
  var oauthState = getRandomToken(28);
  var nonce = getRandomToken(28);
  try {
    sessionStorage.setItem(GOOGLE_AUTH_STATE_KEY, oauthState);
    sessionStorage.setItem(GOOGLE_AUTH_NONCE_KEY, nonce);
  } catch { /* sessionStorage blocked in restricted environments */ }

  var redirectUri = window.location.origin + window.location.pathname;
  var params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    state: oauthState,
    nonce: nonce,
    prompt: 'select_account'
  });
  window.location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}

function signOutUser() {
  persistProfileToAuthenticatedAccount();
  saveAuthSession(null);
  state.profile = getDefaultProfile();
  persistProfileState(false);
  _applyProfile();
  renderAuthState();
  closeAuthModal();
  refreshAuthLinkedUI();
  showToast('Signed out.', 'success');
}

function setupAuthListeners() {
  var profileBtn = document.getElementById('profileBtn');
  var closeBtn = document.getElementById('authModalClose');
  var modal = document.getElementById('authModal');
  var openFromProfileBtn = document.getElementById('openAuthFromProfile');
  var signInTab = document.getElementById('authTabSignIn');
  var signUpTab = document.getElementById('authTabSignUp');
  var googleTriggerBtn = document.getElementById('authGoogleTrigger');
  var emailSignInBtn = document.getElementById('authEmailSignInBtn');
  var emailSignUpBtn = document.getElementById('authEmailSignUpBtn');
  var signOutBtn = document.getElementById('authSignOutBtn');
  var manageProfileBtn = document.getElementById('authManageProfileBtn');

  if (profileBtn) profileBtn.addEventListener('click', openAuthModal);
  if (openFromProfileBtn) openFromProfileBtn.addEventListener('click', openAuthModal);
  if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeAuthModal();
    });
  }
  if (signInTab) signInTab.addEventListener('click', function() { setAuthMode('signin'); });
  if (signUpTab) signUpTab.addEventListener('click', function() { setAuthMode('signup'); });
  if (googleTriggerBtn) googleTriggerBtn.addEventListener('click', handleGoogleSignInClick);
  if (emailSignInBtn) emailSignInBtn.addEventListener('click', function() { handleEmailSignIn(); });
  if (emailSignUpBtn) emailSignUpBtn.addEventListener('click', function() { handleEmailSignUp(); });
  if (signOutBtn) signOutBtn.addEventListener('click', signOutUser);
  if (manageProfileBtn) manageProfileBtn.addEventListener('click', function() {
    closeAuthModal();
    _switchTab('home');
  });

  document.querySelectorAll('#authModal input').forEach(function(input) {
    input.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      if (state.authMode === 'signup') handleEmailSignUp();
      else handleEmailSignIn();
    });
  });

  renderAuthState();
}

function init({ applyProfile, switchTab, onAuthChange } = {}) {
  if (typeof applyProfile === 'function') _applyProfile = applyProfile;
  if (typeof switchTab === 'function') _switchTab = switchTab;
  if (typeof onAuthChange === 'function') _onAuthChange = onAuthChange;
  handleGoogleRedirectResult();
  loadAuthSession();
  setupAuthListeners();
}

export default {
  init,
  openAuthModal,
  closeAuthModal,
  renderAuthState,
  signOut: signOutUser,
  persistProfileToAuthenticatedAccount,
  getDefaultProfile,
  deriveDisplayName
};
