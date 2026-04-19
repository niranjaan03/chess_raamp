/**
 * KnightVision - Main Application Controller
 * Orchestrates board, engine, UI, and data
 */

import Chess from '../lib/chess';
import OpeningBook from '../lib/openings';
import PGNParser from '../lib/pgn-parser';
import ChessBoard from './ChessBoard';
import EngineController from './EngineController';
import OpeningPracticeController from './OpeningPracticeController';
import PuzzleController from './PuzzleController';
import SoundController from './SoundController';

const RAW_GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID)
  ? import.meta.env.VITE_GOOGLE_CLIENT_ID
  : '';
const DEFAULT_ENGINE_ID = 'sf18';
const DEFAULT_ENGINE_LABEL = 'Stockfish 18';

const AppController = (function() {
  var chess = null;
  var gamePositions = [];
  var currentMoveIndex = 0;
  var currentGame = null;
  var autoPlayInterval = null;
  var autoPlayActive = false;
  var profile = {};
  var authSession = null;
  var gameDatabase = [];
  var analysisMode = true;
  var lastAnalysisHistory = null;
  var lastAnalysisCounts = null;
  var feedbackCategory = 'feature';
  var authMode = 'signin';
  var DEFAULT_MOVE_DESC = 'Run a full game review to see brilliance, inaccuracies, and more for each move.';
  var DEFAULT_COACH_TEXT = 'Run a full analysis to unlock personalized move-by-move coaching.';
  var lastCoachSummary = DEFAULT_COACH_TEXT;
  var AUTH_ACCOUNTS_KEY = 'kv_auth_accounts';
  var AUTH_SESSION_KEY = 'kv_auth_session';
  var GOOGLE_AUTH_STATE_KEY = 'kv_google_auth_state';
  var GOOGLE_AUTH_NONCE_KEY = 'kv_google_auth_nonce';
  var GOOGLE_CLIENT_ID = RAW_GOOGLE_CLIENT_ID || '';
  var COLOR_MODE_KEY = 'kv_color_mode';
  var currentTab = 'home';
  var tabHistoryReady = false;
  var homeDailyCalendarBound = false;
  var TAB_ROUTE_MAP = {
    home: '/home',
    analyze: '/analyze',
    import: '/import',
    games: '/games',
    puzzle: '/puzzle',
    database: '/database',
    openings: '/openings',
    profile: '/profile',
    pricing: '/pricing',
    settings: '/settings'
  };

  var QUALITY_META = {
    brilliant: { label: 'Brilliant', icon: '!!', iconClass: 'qi-brilliant', tip: 'Genius resource that swings the evaluation.' },
    great: { label: 'Great', icon: '!', iconClass: 'qi-great', tip: 'Strong conversion that increases your edge.' },
    book: { label: 'Book', icon: '\u{1F4D6}', iconClass: 'qi-book', tip: 'Theory move keeps the balance steady.' },
    best: { label: 'Best', icon: '\u2605', iconClass: 'qi-best', tip: 'Engine-approved move played perfectly.' },
    excellent: { label: 'Excellent', icon: '\u{1F44D}', iconClass: 'qi-excellent', tip: 'Solid play that holds the evaluation.' },
    good: { label: 'Good', icon: '\u2714', iconClass: 'qi-good', tip: 'Keeps things stable with only a tiny concession.' },
    inaccuracy: { label: 'Inaccuracy', icon: '?!', iconClass: 'qi-inaccuracy', tip: 'Better continuations existed—review this moment.' },
    mistake: { label: 'Mistake', icon: '?', iconClass: 'qi-mistake', tip: 'A serious slip that hands back chances.' },
    miss: { label: 'Miss', icon: '\u2716', iconClass: 'qi-miss', tip: 'Missed tactic or win—study this carefully.' },
    blunder: { label: 'Blunder', icon: '??', iconClass: 'qi-blunder', tip: 'Game-changing error. Learn and avoid it next time.' }
  };

  // ===== INIT =====
  function init() {
    chess = new Chess();
    
    loadProfile();
    handleGoogleRedirectResult();
    loadAuthSession();
    loadDatabase();
    
    ChessBoard.init('chessBoard', 'boardOverlay', onBoardMove);
    ChessBoard.setPosition(chess);
    ChessBoard.setOptions({ interactionColor: '', allowedMoves: [] });
    EngineController.init();
    SoundController.init();
    
    setupEventListeners();
    setupAuth();
    setupTabNavigation();
    setupBrowserTabHistory();
    setupCoordinates();
    applyBoardPreferences();
    
    startAnalysis();
    
    updateMovesList();
    renderSavedGames();
    renderDatabase();
    
    showToast('Welcome to chess ramp!', 'success');

    setTimeout(function() {
      loadSharedReviewFromLocation();
    }, 0);

    setTimeout(function() {
      if (PuzzleController && typeof PuzzleController.preload === 'function') {
        PuzzleController.preload();
      }
    }, 120);
  }

  // ===== TAB NAVIGATION =====
  function setupTabNavigation() {
    document.querySelectorAll('.nav-link, .nav-sublink').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var tab = this.getAttribute('data-tab');
        var puzzleMode = this.getAttribute('data-puzzle-mode');
        if (tab === 'puzzle' && puzzleMode) {
          PuzzleController.setMode(puzzleMode);
        }
        switchTab(tab);
        closeNavDrawer();
      });
    });
    setupNavDrawer();
  }

  function setupBrowserTabHistory() {
    if (typeof window === 'undefined' || tabHistoryReady) return;
    tabHistoryReady = true;
    try {
      var initialTab = getTabFromPath(window.location.pathname) || getTabFromHistoryState(window.history.state) || currentTab || 'home';
      writeTabHistory(initialTab, true);
      if (initialTab !== currentTab) {
        switchTab(initialTab, { fromHistory: true });
      }
    } catch (e) {}
    window.addEventListener('popstate', function(event) {
      var historyTab = getTabFromPath(window.location.pathname) || getTabFromHistoryState(event.state) || 'home';
      switchTab(historyTab, { fromHistory: true });
    });
  }

  function getTabFromPath(pathname) {
    var path = String(pathname || '').trim();
    if (!path || path === '/') return 'home';
    var clean = path.replace(/\/+$/, '') || '/';
    var entries = Object.keys(TAB_ROUTE_MAP);
    for (var i = 0; i < entries.length; i++) {
      var tab = entries[i];
      if (TAB_ROUTE_MAP[tab] === clean) return tab;
    }
    return '';
  }

  function getTabFromHistoryState(state) {
    if (!state || typeof state !== 'object') return '';
    var tab = state.kvTab;
    if (tab === 'support') return 'home';
    return tab || '';
  }

  function getRouteForTab(tab) {
    return TAB_ROUTE_MAP[tab] || TAB_ROUTE_MAP.home;
  }

  function getSearchForTab(tab) {
    if (typeof window === 'undefined') return '';
    var params = new URLSearchParams(window.location.search || '');
    if (tab !== 'analyze') {
      params.delete('review');
    }
    var query = params.toString();
    return query ? ('?' + query) : '';
  }

  function writeTabHistory(tab, replace) {
    if (typeof window === 'undefined' || !tabHistoryReady) return;
    var safeTab = tab || 'home';
    var state = { kvTab: safeTab };
    var nextUrl = getRouteForTab(safeTab) + getSearchForTab(safeTab);
    try {
      if (replace) window.history.replaceState(state, document.title, nextUrl);
      else window.history.pushState(state, document.title, nextUrl);
    } catch (e) {}
  }

  function switchTab(tab, options) {
    var opts = options || {};
    if (tab === 'support') {
      openFeedbackModal('feature');
      closeNavDrawer();
      return;
    }
    if (!tab) tab = 'home';
    document.querySelectorAll('.nav-link, .nav-sublink').forEach(function(l) { l.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) {
      c.classList.remove('active');
      c.classList.remove('is-entering');
    });
    
    var tabLinks;
    if (tab === 'puzzle') {
      var puzzleMode = PuzzleController.getMode();
      tabLinks = document.querySelectorAll('.nav-sublink[data-tab="puzzle"][data-puzzle-mode="' + puzzleMode + '"]');
      setPuzzleMenuExpanded(true);
    } else {
      tabLinks = document.querySelectorAll('.nav-link[data-tab="' + tab + '"]');
      setPuzzleMenuExpanded(false);
    }
    var tabContent = document.getElementById('tab-' + tab);
    
    tabLinks.forEach(function(tabLink) { tabLink.classList.add('active'); });
    if (tabContent) {
      tabContent.classList.add('active');
      tabContent.classList.add('is-entering');
      setTimeout(function() {
        if (tabContent) tabContent.classList.remove('is-entering');
      }, 280);
    }
    var previousTab = currentTab;
    currentTab = tab;
    if (!opts.fromHistory && previousTab !== tab) {
      writeTabHistory(tab, false);
    }
    closeNavDrawer();
    
    if (tab === 'analyze') {
      // Re-init board for analyze tab (in case practice tab took over ChessBoard)
      setTimeout(function() {
        ChessBoard.init('chessBoard', 'boardOverlay', onBoardMove);
        if (chess) ChessBoard.setPosition(chess);
        ChessBoard.setOptions({ interactionColor: '', allowedMoves: [] });
        ChessBoard.redraw();
      }, 50);
    }
    if (tab === 'database') {
      renderDatabase();
    }
    if (tab === 'home' && typeof HomeController !== 'undefined') {
      HomeController.refreshHomeData();
    }
    if (tab === 'games' && typeof HomeController !== 'undefined') {
      HomeController.refreshGamesTab();
    }
    if (tab === 'openings') {
      if (!window._openingPracticeInited) {
        window._openingPracticeInited = true;
        window.OpeningPracticeController = OpeningPracticeController;
        OpeningPracticeController.init();
      } else if (window.OpeningPracticeController) {
        window.OpeningPracticeController.renderOpeningGallery();
      }
    }
    if (tab === 'puzzle') {
      PuzzleController.init();
    }
  }

  function openDailyPuzzleCalendar() {
    switchTab('puzzle');
    setTimeout(function() {
      var dailyModeBtn = document.getElementById('puzzleModeDaily');
      if (dailyModeBtn) {
        dailyModeBtn.click();
      } else {
        PuzzleController.openDailyPuzzle();
      }
      var dailyCard = document.getElementById('puzzleDailyCard');
      if (dailyCard) {
        dailyCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }, 120);
  }

  function getDefaultProfile() {
    return {
      displayName: '',
      chesscomUsername: '',
      lichessUsername: '',
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
    } catch (e) {}
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
    authSession = session || null;
    try {
      if (authSession) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));
      else localStorage.removeItem(AUTH_SESSION_KEY);
    } catch (e) {}
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
      prefEngine: sourceProfile.prefEngine || DEFAULT_ENGINE_ID,
      prefDepth: sourceProfile.prefDepth || '20'
    };
  }

  function persistProfileState(syncAccount) {
    try {
      localStorage.setItem('kv_profile', JSON.stringify(profile));
    } catch (e) {}
    if (syncAccount !== false) persistProfileToAuthenticatedAccount();
  }

  function persistProfileToAuthenticatedAccount() {
    if (!authSession || !authSession.accountId) return;
    var accounts = getStoredAuthAccounts();
    var index = accounts.findIndex(function(account) {
      return String(account.id) === String(authSession.accountId);
    });
    if (index === -1) return;
    accounts[index].displayName = profile.displayName || authSession.displayName || deriveDisplayName(authSession.email);
    accounts[index].profileData = sanitizeProfileForAccount(profile);
    accounts[index].lastLoginAt = new Date().toISOString();
    saveStoredAuthAccounts(accounts);
  }

  function restoreProfileFromAccount(account) {
    if (!account) return;
    profile = Object.assign(getDefaultProfile(), account.profileData || {});
    profile.displayName = profile.displayName || account.displayName || deriveDisplayName(account.email);
    profile.authEmail = account.email || '';
    profile.authProvider = account.provider || 'email';
    profile.isAuthenticated = true;
    persistProfileState(false);
    applyProfile();
  }

  function refreshAuthLinkedUI() {
    renderAuthState();
    if (typeof HomeController !== 'undefined') HomeController.refreshHomeData();
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
    } catch (e) {}
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
    } catch (e) {}

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
    authMode = mode === 'signup' ? 'signup' : 'signin';
    var signInTab = document.getElementById('authTabSignIn');
    var signUpTab = document.getElementById('authTabSignUp');
    var signInPanel = document.getElementById('authPanelSignIn');
    var signUpPanel = document.getElementById('authPanelSignUp');
    if (signInTab) signInTab.classList.toggle('active', authMode === 'signin');
    if (signUpTab) signUpTab.classList.toggle('active', authMode === 'signup');
    if (signInPanel) signInPanel.style.display = authMode === 'signin' ? 'block' : 'none';
    if (signUpPanel) signUpPanel.style.display = authMode === 'signup' ? 'block' : 'none';
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
      nameEl.textContent = authSession
        ? (profile.displayName || authSession.displayName || deriveDisplayName(authSession.email))
        : 'Sign In';
    }
    if (buttonEl) buttonEl.classList.toggle('is-signed-in', !!authSession);
    if (signedInView) signedInView.style.display = authSession ? 'block' : 'none';
    if (signedOutView) signedOutView.style.display = authSession ? 'none' : 'block';
    if (sessionNameEl) sessionNameEl.textContent = profile.displayName || (authSession ? authSession.displayName : 'Guest');
    if (sessionEmailEl) sessionEmailEl.textContent = authSession ? authSession.email : '';
    if (sessionProviderEl) sessionProviderEl.textContent = authSession ? getAuthProviderLabel(authSession.provider) : '';
    if (!authSession) {
      setAuthMode(authMode);
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
    var state = getRandomToken(28);
    var nonce = getRandomToken(28);
    try {
      sessionStorage.setItem(GOOGLE_AUTH_STATE_KEY, state);
      sessionStorage.setItem(GOOGLE_AUTH_NONCE_KEY, nonce);
    } catch (e) {}

    var redirectUri = window.location.origin + window.location.pathname;
    var params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      state: state,
      nonce: nonce,
      prompt: 'select_account'
    });
    window.location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
  }

  function signOutUser() {
    persistProfileToAuthenticatedAccount();
    saveAuthSession(null);
    profile = getDefaultProfile();
    persistProfileState(false);
    applyProfile();
    renderAuthState();
    closeAuthModal();
    refreshAuthLinkedUI();
    showToast('Signed out.', 'success');
  }

  function setupAuth() {
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
      switchTab('home');
    });

    document.querySelectorAll('#authModal input').forEach(function(input) {
      input.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        if (authMode === 'signup') handleEmailSignUp();
        else handleEmailSignIn();
      });
    });

    renderAuthState();
  }

  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    // Navigation buttons
    document.getElementById('btnFirst').addEventListener('click', goFirst);
    document.getElementById('btnPrev').addEventListener('click', goPrev);
    document.getElementById('btnPlay').addEventListener('click', toggleAutoPlay);
    document.getElementById('btnNext').addEventListener('click', goNext);
    document.getElementById('btnLast').addEventListener('click', goLast);
    document.getElementById('btnFlip').addEventListener('click', flipBoard);

    // FEN
    document.getElementById('loadFen').addEventListener('click', loadFenPosition);
    document.getElementById('fenInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') loadFenPosition();
    });

    // Engine settings
    document.getElementById('depthSlider').addEventListener('input', function() {
      document.getElementById('depthVal').textContent = this.value;
      EngineController.setDepth(parseInt(this.value));
      startAnalysis();
    });

    document.getElementById('analysisMode').addEventListener('change', function() {
      analysisMode = this.checked;
      if (analysisMode) startAnalysis();
      else EngineController.stop();
    });

    document.getElementById('analyzeFullGame').addEventListener('click', analyzeFullGame);

    // Lines count
    document.querySelectorAll('.lines-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.lines-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        var n = parseInt(this.getAttribute('data-lines'));
        EngineController.setNumLines(n);
        startAnalysis();
      });
    });

    // Board appearance
    var boardThemeEl = document.getElementById('boardTheme');
    if (boardThemeEl) boardThemeEl.addEventListener('change', function() {
      applyBoardThemeSelection(this.value);
    });
    var settingsColorMode = document.getElementById('settingsColorMode');
    if (settingsColorMode) settingsColorMode.addEventListener('change', function() {
      applyColorModeSelection(this.value);
    });
    var pieceStyleEl = document.getElementById('pieceStyle');
    if (pieceStyleEl) pieceStyleEl.addEventListener('change', function() {
      applyPieceStyleSelection(this.value);
    });
    var settingsBoardTheme = document.getElementById('settingsBoardTheme');
    if (settingsBoardTheme) settingsBoardTheme.addEventListener('change', function() {
      applyBoardThemeSelection(this.value);
    });
    var settingsPieceStyle = document.getElementById('settingsPieceStyle');
    if (settingsPieceStyle) settingsPieceStyle.addEventListener('change', function() {
      applyPieceStyleSelection(this.value);
    });
    document.querySelectorAll('.settings-option-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var target = this.getAttribute('data-target');
        var value = this.getAttribute('data-value');
        if (!target || !value) return;
        if (target === 'settingsBoardTheme') {
          applyBoardThemeSelection(value);
          return;
        }
        if (target === 'settingsColorMode') {
          applyColorModeSelection(value);
          return;
        }
        if (target === 'settingsPieceStyle') {
          applyPieceStyleSelection(value);
        }
      });
    });
    var showArrowsEl = document.getElementById('showArrows');
    if (showArrowsEl) showArrowsEl.addEventListener('change', function() {
      ChessBoard.setOptions({showArrows: this.checked});
    });
    var showCoordsEl = document.getElementById('showCoords');
    if (showCoordsEl) showCoordsEl.addEventListener('change', function() {
      ChessBoard.setOptions({showCoordinates: this.checked});
    });
    var highlightLastEl = document.getElementById('highlightLast');
    if (highlightLastEl) highlightLastEl.addEventListener('change', function() {
      ChessBoard.setOptions({highlightLast: this.checked});
    });
    var moveSoundEl = document.getElementById('settingsMoveSound');
    if (moveSoundEl) moveSoundEl.addEventListener('change', function() {
      applyMoveSoundSelection(this.checked, true);
    });

    // Copy PGN / FEN
    document.getElementById('copyPGN').addEventListener('click', function() {
      var pgn = chess.pgn();
      copyToClipboard(pgn);
      showToast('PGN copied!', 'success');
    });
    document.getElementById('copyFENBtn').addEventListener('click', function() {
      copyToClipboard(chess.fen());
      showToast('FEN copied!', 'success');
    });

    // Import tab
    document.querySelectorAll('.import-method').forEach(function(method) {
      method.addEventListener('click', function() {
        document.querySelectorAll('.import-method').forEach(function(m) { m.classList.remove('active'); });
        document.querySelectorAll('.import-section').forEach(function(s) { s.classList.remove('active'); });
        this.classList.add('active');
        var type = this.getAttribute('data-method');
        document.getElementById('import-' + type).classList.add('active');
      });
    });

    document.getElementById('loadPGN').addEventListener('click', function() {
      var pgn = document.getElementById('pgnInput').value;
      if (pgn.trim()) {
        loadPGNGame(pgn);
        switchTab('analyze');
      }
    });

    var dropZone = document.getElementById('fileDropZone');
    var fileInput = document.getElementById('fileInput');
    
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
      var file = e.dataTransfer.files[0];
      if (file) readPGNFile(file);
    });
    fileInput.addEventListener('change', function() {
      if (this.files[0]) readPGNFile(this.files[0]);
    });

    document.getElementById('loadFenImport').addEventListener('click', function() {
      var fen = document.getElementById('fenImportInput').value;
      if (fen.trim()) { loadFenGame(fen); switchTab('analyze'); }
    });

    document.getElementById('loadURL').addEventListener('click', loadFromURL);

    // Fetch games
    document.getElementById('fetchGamesBtn').addEventListener('click', fetchGames);

    // Profile
    document.getElementById('saveProfile').addEventListener('click', saveProfile);
    var openDailyPuzzleHomeBtn = document.getElementById('openDailyPuzzleHome');
    if (openDailyPuzzleHomeBtn) {
      openDailyPuzzleHomeBtn.addEventListener('click', openDailyPuzzleCalendar);
    }
    var homeDailyDateBtn = document.getElementById('homeDailyPuzzleDate');
    if (homeDailyDateBtn) {
      homeDailyDateBtn.addEventListener('click', openDailyPuzzleCalendar);
    }
    if (!homeDailyCalendarBound) {
      homeDailyCalendarBound = true;
      document.addEventListener('click', function(event) {
        var target = event.target;
        if (!target || !(target instanceof Element)) return;
        if (target.closest('#homeDailyPuzzleDate')) {
          event.preventDefault();
          openDailyPuzzleCalendar();
        }
      });
    }
    setupSupportFeedback();
    setupPricingToggle();

    // Database search
    document.getElementById('dbSearch').addEventListener('input', function() {
      renderDatabase(this.value);
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeFeedbackModal();
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowUp') { e.preventDefault(); goFirst(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); goLast(); }
      if (e.key === 'f' || e.key === 'F') flipBoard();
    });
  }

  // ===== BOARD COORDINATES =====
  function setupCoordinates() {
    var rankEl = document.getElementById('rankCoords');
    var fileEl = document.getElementById('fileCoords');
    if (rankEl) rankEl.innerHTML = '87654321'.split('').map(function(r) { return '<span>' + r + '</span>'; }).join('');
    if (fileEl) fileEl.innerHTML = 'abcdefgh'.split('').map(function(f) { return '<span>' + f + '</span>'; }).join('');
  }

  function setupNavDrawer() {
    var menuBtn = document.getElementById('navMenuBtn');
    var closeBtn = document.getElementById('navDrawerClose');
    var overlayEl = document.getElementById('navDrawerOverlay');

    if (menuBtn) menuBtn.addEventListener('click', openNavDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeNavDrawer);
    if (overlayEl) {
      overlayEl.addEventListener('click', function(e) {
        if (e.target === overlayEl) closeNavDrawer();
      });
    }
  }

  function openNavDrawer() {
    var overlayEl = document.getElementById('navDrawerOverlay');
    if (!overlayEl) return;
    overlayEl.style.display = 'block';
    document.body.style.overflow = 'hidden';
    if (document.querySelector('.nav-sublink.active')) {
      setPuzzleMenuExpanded(true);
    }
  }

  function closeNavDrawer() {
    var overlayEl = document.getElementById('navDrawerOverlay');
    if (!overlayEl) return;
    overlayEl.style.display = 'none';
    document.body.style.overflow = '';
  }

  function setPuzzleMenuExpanded(expanded) {
    var group = document.querySelector('.nav-menu-group');
    var toggle = document.getElementById('puzzleMenuToggle');
    if (!toggle || !group) return;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.classList.toggle('is-open', !!expanded);
    group.classList.toggle('is-active', !!expanded);
  }

  function setupPricingToggle() {
    var monthlyBtn = document.getElementById('pricingToggleMonthly');
    var yearlyBtn = document.getElementById('pricingToggleYearly');
    var cards = document.querySelectorAll('.pricing-card');
    if (!monthlyBtn || !yearlyBtn) return;

    function showMonthly() {
      monthlyBtn.classList.add('active');
      yearlyBtn.classList.remove('active');
      cards.forEach(function(card) {
        if (card.classList.contains('is-yearly')) {
          card.style.display = 'none';
        } else if (card.classList.contains('is-featured')) {
          card.style.display = '';
        }
      });
    }

    function showYearly() {
      yearlyBtn.classList.add('active');
      monthlyBtn.classList.remove('active');
      cards.forEach(function(card) {
        if (card.classList.contains('is-featured')) {
          card.style.display = 'none';
        } else if (card.classList.contains('is-yearly')) {
          card.style.display = '';
        }
      });
    }

    monthlyBtn.addEventListener('click', showMonthly);
    yearlyBtn.addEventListener('click', showYearly);
  }

  function setupSupportFeedback() {
    var openBtn = document.getElementById('openFeedbackModal');
    if (openBtn) openBtn.addEventListener('click', function() { openFeedbackModal('feature'); });

    document.querySelectorAll('.support-card-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openFeedbackModal(this.getAttribute('data-feedback-category') || 'feature');
      });
    });

    var copyBtn = document.getElementById('copySupportLinkBtn');
    if (copyBtn) copyBtn.addEventListener('click', copySupportLink);

    var modal = document.getElementById('feedbackModal');
    var closeBtn = document.getElementById('feedbackModalClose');
    var cancelBtn = document.getElementById('feedbackCancelBtn');
    var sendBtn = document.getElementById('feedbackSendBtn');
    var messageEl = document.getElementById('feedbackMessage');

    if (closeBtn) closeBtn.addEventListener('click', closeFeedbackModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFeedbackModal);
    if (sendBtn) sendBtn.addEventListener('click', submitFeedback);
    if (messageEl) messageEl.addEventListener('input', updateFeedbackCounter);
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeFeedbackModal();
      });
    }

    document.querySelectorAll('.feedback-category-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setFeedbackCategory(this.getAttribute('data-category') || 'feature');
      });
    });
  }

  function openFeedbackModal(category) {
    var modal = document.getElementById('feedbackModal');
    if (!modal) return;
    setFeedbackCategory(category || feedbackCategory || 'feature');
    var msg = document.getElementById('feedbackMessage');
    if (msg) {
      msg.value = '';
      updateFeedbackCounter();
      setTimeout(function() { msg.focus(); }, 20);
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeFeedbackModal() {
    var modal = document.getElementById('feedbackModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function setFeedbackCategory(category) {
    feedbackCategory = category || 'feature';
    document.querySelectorAll('.feedback-category-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-category') === feedbackCategory);
    });
  }

  function updateFeedbackCounter() {
    var msg = document.getElementById('feedbackMessage');
    var counter = document.getElementById('feedbackCharCount');
    if (!counter) return;
    counter.textContent = msg ? String((msg.value || '').length) : '0';
  }

  function submitFeedback() {
    var msg = document.getElementById('feedbackMessage');
    var text = msg ? msg.value.trim() : '';
    if (!text) {
      showToast('Enter your feedback first', 'error');
      if (msg) msg.focus();
      return;
    }

    var activeTab = document.querySelector('.nav-link.active, .nav-sublink.active');
    var feedbackEntry = {
      id: Date.now(),
      category: feedbackCategory,
      message: text,
      page: activeTab ? activeTab.getAttribute('data-tab') : 'unknown',
      createdAt: new Date().toISOString()
    };

    try {
      var existing = JSON.parse(localStorage.getItem('kv_feedback') || '[]');
      existing.unshift(feedbackEntry);
      if (existing.length > 50) existing = existing.slice(0, 50);
      localStorage.setItem('kv_feedback', JSON.stringify(existing));
      showToast('Feedback saved. Thank you.', 'success');
      closeFeedbackModal();
    } catch (e) {
      console.error('Feedback save failed', e);
      showToast('Could not save feedback', 'error');
    }
  }

  function copySupportLink() {
    var text = 'Check out chess ramp: ' + window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() { showToast('Feedback link copied', 'success'); })
        .catch(function() {
          copyToClipboard(text);
          showToast('Feedback link copied', 'success');
        });
      return;
    }
    copyToClipboard(text);
    showToast('Feedback link copied', 'success');
  }

  function applyBoardPreferences() {
    try {
      var savedColorMode = localStorage.getItem(COLOR_MODE_KEY);
      if (savedColorMode) {
        syncSelectValue(['settingsColorMode'], savedColorMode);
        applyColorMode(savedColorMode);
      } else {
        applyColorMode('dark');
      }
      var savedBoardTheme = localStorage.getItem('kv_board_theme');
      if (savedBoardTheme) {
        syncSelectValue(['boardTheme', 'settingsBoardTheme'], savedBoardTheme);
        ChessBoard.setTheme(savedBoardTheme);
      } else {
        syncSelectValue(['boardTheme', 'settingsBoardTheme'], 'blue');
        ChessBoard.setTheme('blue');
      }
      var savedPieceStyle = localStorage.getItem('kv_piece_style');
      if (savedPieceStyle) {
        syncSelectValue(['pieceStyle', 'settingsPieceStyle'], savedPieceStyle);
        ChessBoard.setPieceStyle(savedPieceStyle);
      }
      syncToggleValue('settingsMoveSound', SoundController.isEnabled());
    } catch (e) {}
  }

  function applyColorMode(mode) {
    var safeMode = mode === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-color-mode', safeMode);
    if (document.body) {
      document.body.setAttribute('data-color-mode', safeMode);
    }
  }

  function syncSelectValue(ids, value) {
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = value;
    });
    document.querySelectorAll('.settings-option-card').forEach(function(card) {
      var target = card.getAttribute('data-target');
      var cardValue = card.getAttribute('data-value');
      var isMatch = ids.indexOf(target) !== -1 && cardValue === value;
      card.classList.toggle('active', isMatch);
      card.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  function syncToggleValue(id, checked) {
    var el = document.getElementById(id);
    if (el) el.checked = !!checked;
  }

  function applyBoardThemeSelection(value) {
    syncSelectValue(['boardTheme', 'settingsBoardTheme'], value);
    ChessBoard.setTheme(value);
    try { localStorage.setItem('kv_board_theme', value); } catch (e) {}
  }

  function applyColorModeSelection(value) {
    var safeMode = value === 'light' ? 'light' : 'dark';
    syncSelectValue(['settingsColorMode'], safeMode);
    applyColorMode(safeMode);
    try { localStorage.setItem(COLOR_MODE_KEY, safeMode); } catch (e) {}
  }

  function applyPieceStyleSelection(value) {
    syncSelectValue(['pieceStyle', 'settingsPieceStyle'], value);
    ChessBoard.setPieceStyle(value);
    try { localStorage.setItem('kv_piece_style', value); } catch (e) {}
  }

  function applyMoveSoundSelection(enabled, preview) {
    var nextValue = enabled !== false;
    syncToggleValue('settingsMoveSound', nextValue);
    SoundController.setEnabled(nextValue);
    if (preview && nextValue) SoundController.playMove();
  }

  // ===== GAME LOADING =====
  function extractChesscomReviewAccuracies(sourceGame) {
    if (!sourceGame || !sourceGame.accuracies) return null;
    var white = parseFloat(sourceGame.accuracies.white);
    var black = parseFloat(sourceGame.accuracies.black);
    if (!isFinite(white) || !isFinite(black)) return null;
    return {
      white: white,
      black: black,
      source: 'chesscom'
    };
  }

  function applyLoadedGameMetadata(game, options) {
    var opts = options || {};
    var sourceGame = opts.sourceGame || null;
    var sourcePlatform = opts.sourcePlatform || '';
    var savedSourceAccuracies = opts.sourceAccuracies || null;
    var reviewAccuracies = extractChesscomReviewAccuracies(sourceGame) || savedSourceAccuracies || null;

    if (sourcePlatform) {
      game.sourcePlatform = sourcePlatform;
    } else if (sourceGame && sourceGame.accuracies) {
      game.sourcePlatform = 'chesscom';
    }

    if (sourceGame && sourceGame.url) {
      game.sourceUrl = sourceGame.url;
    } else if (opts.sourceUrl) {
      game.sourceUrl = opts.sourceUrl;
    }

    if (reviewAccuracies) {
      game.reviewAccuracies = {
        white: reviewAccuracies.white,
        black: reviewAccuracies.black,
        source: reviewAccuracies.source || ''
      };
    }
  }

  function getDisplayedReviewAccuracies(game, fallbackWhite, fallbackBlack) {
    var source = game && game.reviewAccuracies ? game.reviewAccuracies : null;
    var white = source && isFinite(parseFloat(source.white)) ? parseFloat(source.white) : fallbackWhite;
    var black = source && isFinite(parseFloat(source.black)) ? parseFloat(source.black) : fallbackBlack;
    return {
      white: white,
      black: black,
      source: source && source.source ? source.source : 'estimated'
    };
  }

  function loadPGNGame(pgn, options) {
    var game = PGNParser.parse(pgn);
    if (!game) {
      showToast('Invalid PGN format', 'error');
      return false;
    }

    applyLoadedGameMetadata(game, options);

    currentGame = game;
    gamePositions = PGNParser.buildPositions(game);
    chess = new Chess();
    currentMoveIndex = 0;
    resetGameReviewUI();

    // Update player info
    document.getElementById('whiteName').textContent = game.white || 'White';
    document.getElementById('blackName').textContent = game.black || 'Black';
    document.getElementById('whiteRating').textContent = game.whiteElo !== '?' ? '(' + game.whiteElo + ')' : '';
    document.getElementById('blackRating').textContent = game.blackElo !== '?' ? '(' + game.blackElo + ')' : '';
    document.getElementById('whiteClock').textContent = game.result || '—';

    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(null, null);
    updateMovesList();
    updateOpeningDisplay();
    startAnalysis();

    // Save to database
    saveToDatabase(game);
    renderDatabase();
    renderSavedGames();
    if (typeof HomeController !== 'undefined') HomeController.renderRecentGames();

    showToast('Game loaded: '   + game.white + ' vs ' + game.black, 'success');
    return true;
  }

  function loadFenGame(fen) {
    try {
      chess = new Chess();
      chess.load(fen);
      currentGame = null;
      gamePositions = [{fen: fen, move: null, moveNum: 0}];
      currentMoveIndex = 0;
      resetGameReviewUI();
      ChessBoard.setPosition(chess);
      ChessBoard.setLastMove(null, null);
      updateMovesList();
      startAnalysis();
      document.getElementById('fenInput').value = fen;
      showToast('Position loaded from FEN', 'success');
    } catch(e) {
      showToast('Invalid FEN position', 'error');
    }
  }

  function loadFenPosition() {
    var fen = document.getElementById('fenInput').value.trim();
    if (fen) loadFenGame(fen);
  }

  function readPGNFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      var games = PGNParser.parseMultiple(text);
      if (games.length === 0) {
        showToast('No valid games found in file', 'error');
        return;
      }
      if (games.length === 1) {
        loadPGNGame(games[0].pgn);
      } else {
        // Multiple games - load first, show picker
        showToast('Loaded ' + games.length + ' games. Loading first...', 'success');
        loadPGNGame(games[0].pgn);
        games.forEach(function(g) { saveToDatabase(g); });
        renderDatabase();
      }
      switchTab('analyze');
    };
    reader.readAsText(file);
  }

  function loadFromURL() {
    var url = document.getElementById('urlInput').value.trim();
    if (!url) return;

    // Extract game ID from URLs
    var gameId = null;
    var platform = null;

    if (url.includes('chess.com')) {
      var match = url.match(/chess\.com\/game\/(live|daily)\/(\d+)/);
      if (match) { gameId = match[2]; platform = 'chesscom'; }
    } else if (url.includes('lichess.org')) {
      var match2 = url.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
      if (match2) { gameId = match2[1]; platform = 'lichess'; }
    }

    if (!gameId) {
      showToast('Could not parse game URL', 'error');
      return;
    }

    showToast('Fetching game from ' + (platform === 'chesscom' ? 'Chess.com' : 'Lichess') + '...', '');

    if (platform === 'lichess') {
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(gameId) + '/export?clocks=false&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(gameId) + '?clocks=false&evals=false';
      fetchTextWithFallback(proxyUrl, directUrl)
        .then(function(pgn) {
          if (pgn && pgn.includes('[')) {
            document.getElementById('urlInput').value = '';
            loadPGNGame(pgn);
            switchTab('analyze');
          } else {
            showToast('Game not found or private', 'error');
          }
        })
        .catch(function() { showToast('Failed to fetch game', 'error'); });
    } else {
      showToast('Chess.com API requires authentication. Try exporting PGN manually.', 'error');
    }
  }

  function encodeSharePayload(text) {
    try {
      return btoa(unescape(encodeURIComponent(text || '')));
    } catch (e) {
      return '';
    }
  }

  function decodeSharePayload(text) {
    try {
      return decodeURIComponent(escape(atob(text || '')));
    } catch (e) {
      return '';
    }
  }

  function createAnalyzeLinkForPGN(pgn) {
    if (!pgn || typeof window === 'undefined') return '';
    var encoded = encodeSharePayload(pgn);
    if (!encoded) return '';
    return window.location.origin + getRouteForTab('analyze') + '?review=' + encodeURIComponent(encoded);
  }

  function loadSharedReviewFromLocation() {
    if (typeof window === 'undefined') return;
    var params = new URLSearchParams(window.location.search || '');
    var encoded = params.get('review');
    if (!encoded) return;
    var pgn = decodeSharePayload(encoded);
    if (!pgn || pgn.indexOf('[') === -1) return;
    loadPGNGame(pgn);
    switchTab('analyze');
    setTimeout(function() {
      analyzeFullGame();
    }, 120);
  }

  // ===== FETCH GAMES FROM PLATFORM =====
  function renderFetchSkeleton(container, labelText) {
    if (!container) return;
    var label = labelText || 'Loading';
    container.innerHTML =
      '<div class="skeleton-fetch-list">' +
        '<div class="skeleton-fetch-title">' + label + '</div>' +
        '<div class="skeleton-card">' +
          '<div class="skeleton-line w-55"></div>' +
          '<div class="skeleton-line w-80"></div>' +
          '<div class="skeleton-line w-38"></div>' +
        '</div>' +
        '<div class="skeleton-card">' +
          '<div class="skeleton-line w-48"></div>' +
          '<div class="skeleton-line w-76"></div>' +
          '<div class="skeleton-line w-34"></div>' +
        '</div>' +
        '<div class="skeleton-card">' +
          '<div class="skeleton-line w-52"></div>' +
          '<div class="skeleton-line w-72"></div>' +
          '<div class="skeleton-line w-30"></div>' +
        '</div>' +
      '</div>';
  }

  function fetchGames() {
    var usernameInput = document.getElementById('fetchUsername');
    var username = usernameInput ? String(usernameInput.value || '').trim().replace(/^@+/, '') : '';
    var platform = document.getElementById('platformSelect').value;
    
    if (!username) {
      showToast('Enter a username', 'error');
      return;
    }

    if (usernameInput && usernameInput.value !== username) {
      usernameInput.value = username;
    }

    var resultsEl = document.getElementById('fetchResults');

    if (platform === 'chesscom') {
      switchTab('games');
      fetchChesscomGames(username, getChessComArchiveDate());
      return;
    }

    renderFetchSkeleton(resultsEl, 'Fetching games for ' + username + '...');

    fetchLichessGames(username, resultsEl);
  }

  function getYesterdayArchiveDate() {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      year: yesterday.getFullYear(),
      month: String(yesterday.getMonth() + 1).padStart(2, '0'),
      day: String(yesterday.getDate()).padStart(2, '0')
    };
  }

  function getChessComArchiveDate() {
    var fallback = getYesterdayArchiveDate();
    var yearEl = document.getElementById('fetchYear');
    var monthEl = document.getElementById('fetchMonth');
    var year = yearEl ? parseInt(yearEl.value, 10) : fallback.year;
    if (isNaN(year) || year < 2000) year = fallback.year;
    var month = monthEl ? parseInt(monthEl.value, 10) : parseInt(fallback.month, 10);
    if (isNaN(month) || month < 1 || month > 12) month = parseInt(fallback.month, 10);
    return { year: year, month: String(month).padStart(2, '0') };
  }

  function encodeAttributeValue(text) {
    return encodeURIComponent(text || '').replace(/'/g, '%27');
  }

  function parseChesscomArchiveGames(source, maxGames) {
    if (!source) return [];
    if (typeof source === 'string') {
      return parseChesscomPgnPreviewGames(source, maxGames);
    }
    var games = Array.isArray(source.games) ? source.games : [];
    var filtered = games.filter(function(game) {
      return game && (game.pgn || game.url);
    });
    if (Number.isFinite(maxGames) && maxGames > 0) {
      return filtered.slice(0, maxGames);
    }
    return filtered;
  }

  function parseChesscomPgnPreviewGames(text, maxGames) {
    var raw = String(text || '').trim();
    if (!raw) return [];
    var parts = raw.split(/(?=\[Event\s+")/);
    var limit = Number.isFinite(maxGames) && maxGames > 0 ? maxGames : parts.length;
    var games = [];
    for (var i = 0; i < parts.length && games.length < limit; i++) {
      var trimmed = parts[i].trim();
      if (!trimmed) continue;
      var headers = {};
      var headerMatches = trimmed.matchAll(/\[(\w+)\s+"([^"]*)"\]/g);
      for (var match of headerMatches) {
        headers[match[1]] = match[2];
      }
      games.push({
        headers: headers,
        white: headers.White || 'White',
        black: headers.Black || 'Black',
        whiteElo: headers.WhiteElo || '?',
        blackElo: headers.BlackElo || '?',
        result: headers.Result || '*',
        event: headers.Event || '',
        date: headers.Date || '',
        opening: headers.Opening || '',
        eco: headers.ECO || '',
        timeControl: headers.TimeControl || '',
        pgn: trimmed
      });
    }
    return games;
  }

  function getChesscomArchivePlayerName(player, fallback) {
    if (player && player.username) return player.username;
    return player || fallback || 'Player';
  }

  function getChesscomArchiveGameResult(game) {
    if (!game) return '*';
    if (game.result) return game.result;
    var whiteResult = game.white ? String(game.white.result || '').toLowerCase() : '';
    if (whiteResult === 'win') return '1-0';
    if (whiteResult === 'checkmated' || whiteResult === 'resigned' || whiteResult === 'timeout' || whiteResult === 'abandoned' || whiteResult === 'lose') {
      return '0-1';
    }
    return '½-½';
  }

  function getChesscomArchiveGameDate(game) {
    if (!game || !game.end_time) return '';
    var date = new Date(game.end_time * 1000);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getChesscomArchiveGameOpening(game) {
    if (!game) return '';
    if (game.opening) return game.opening;
    var eco = String(game.eco || '');
    if (!eco) return '';
    var label = eco.split('/openings/')[1] || '';
    if (!label) return '';
    return decodeURIComponent(label).replace(/-/g, ' ');
  }

  function fetchLichessGames(username, container) {
    var encodedUser = encodeURIComponent(username);
    var proxyUrl = '/api/lichess/user/' + encodedUser + '/games?max=10&clocks=false&evals=false&opening=true';
    var directUrl = 'https://lichess.org/api/games/user/' + encodedUser + '?max=10&clocks=false&evals=false&opening=true';

    fetchTextWithFallback(proxyUrl, directUrl, { Accept: 'application/x-ndjson' })
      .then(function(text) {
        var lines = text.trim().split('\n').filter(function(l) { return l.trim(); });
        var games = [];
        
        lines.forEach(function(line) {
          try {
            var game = JSON.parse(line);
            games.push(game);
          } catch(e) {}
        });
        
        if (games.length === 0) {
          container.innerHTML = '<div class="no-games">No games found for @' + username + '</div>';
          return;
        }
        
        container.innerHTML = games.map(function(g) {
          var white = g.players && g.players.white ? (g.players.white.user ? g.players.white.user.name : 'White') : 'White';
          var black = g.players && g.players.black ? (g.players.black.user ? g.players.black.user.name : 'Black') : 'Black';
          var result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '½-½';
          var opening = g.opening ? g.opening.name : '';
          var isUserWhite = white.toLowerCase() === username.toLowerCase();
          var resultClass = result === '1-0' ? (isUserWhite ? 'result-w' : 'result-l') : 
                           result === '0-1' ? (isUserWhite ? 'result-l' : 'result-w') : 'result-d';
          
          return '<div class="fetch-game-item" data-id="' + g.id + '" data-platform="lichess" onclick="AppController.loadFetchedGame(this)">' +
            white + ' vs ' + black + ' — ' + (opening ? opening.substring(0, 25) : '') +
            '<span class="fetch-game-result ' + resultClass + '">' + result + '</span>' +
            '</div>';
        }).join('');
        
        // Store game data
        games.forEach(function(g) { window._fetchedGames = window._fetchedGames || {}; window._fetchedGames[g.id] = g; });
        showToast('Found ' + games.length + ' games', 'success');
      })
      .catch(function(err) {
        container.innerHTML = '<div class="no-games">' + describeLichessError(err, username) + '</div>';
        console.error(err);
      });
  }

  function fetchChessComGames(username, container) {
    var archive = getChessComArchiveDate();
    fetchChesscomMonthPgn(username, archive.year, archive.month)
      .then(function(text) {
        var games = parseChesscomArchiveGames(text, 20) || [];
        if (!games.length) {
          container.innerHTML = '<div class="no-games">No public games for ' + username + ' in ' + archive.year + '-' + archive.month + '</div>';
          return;
        }

        container.innerHTML = games.map(function(g) {
          var white = g.white || 'White';
          var black = g.black || 'Black';
          var result = g.result || '*';
          var opening = g.opening || g.eco || '';
          var date = g.date || (g.headers ? g.headers.Date : '');
          var resultClass = result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d';
          return '<div class="fetch-game-item" data-pgn="' + encodeAttributeValue(g.pgn || '') + '" onclick="AppController.loadFetchedPGNGame(this)">' +
            '<strong>' + white + '</strong> vs <strong>' + black + '</strong>' +
            (opening ? ' — ' + opening.substring(0, 28) : '') +
            '<span class="fetch-game-result ' + resultClass + '">' + result + '</span>' +
            (date ? '<div class="fetch-game-date">' + date + '</div>' : '') +
          '</div>';
        }).join('');

        showToast('Fetched ' + games.length + ' games from ' + archive.year + '-' + archive.month, 'success');
      })
      .catch(function(err) {
        console.error('Chess.com PGN fetch failed', err);
        var hint = describeChesscomError(err, username, archive.year + '-' + archive.month);
        container.innerHTML = '<div class="no-games">' + hint + '</div>';
      });
  }

  function fetchChesscomMonthPgn(username, year, month) {
    var safeUsername = String(username || '').trim().replace(/^@+/, '');
    var encodedUser = encodeURIComponent(safeUsername);
    var requestUrl = 'https://api.chess.com/pub/player/' + encodedUser + '/games/' + year + '/' + month + '/pgn';
    var proxyUrl = '/api/chesscom/player/' + encodedUser + '/games/' + year + '/' + month + '/pgn';
    return fetchTextWithFallback(proxyUrl, requestUrl).then(function(text) {
      if (!text || isHtmlResponse(text) || !isLikelyChesscomPgn(text)) {
        throw createChesscomInvalidResponseError('fallback');
      }
      return text;
    });
  }

  function createChesscomHttpError(status, message) {
    var err = new Error(message || ('HTTP ' + status));
    err.status = status;
    return err;
  }

  function createChesscomInvalidResponseError(source) {
    var err = new Error('Unexpected ' + source + ' response');
    err.invalidResponse = true;
    return err;
  }

  function isHtmlResponse(text) {
    return /^\s*<!doctype html/i.test(text || '') || /^\s*<html/i.test(text || '');
  }

  function isLikelyChesscomPgn(text) {
    return /\[(Event|Site|Date)\s+"[^"]*"\]/.test(text || '');
  }

  function parseChesscomResponse(response, responseType, source) {
    if (!response.ok) {
      throw createChesscomHttpError(
        response.status,
        response.status === 404 ? 'Not found on Chess.com (404)' : 'HTTP ' + response.status
      );
    }

    return response.text().then(function(body) {
      if (responseType === 'json') {
        if (!body || isHtmlResponse(body)) {
          throw createChesscomInvalidResponseError(source);
        }
        try {
          return JSON.parse(body);
        } catch (err) {
          throw createChesscomInvalidResponseError(source);
        }
      }

      if (!body || isHtmlResponse(body) || !isLikelyChesscomPgn(body)) {
        throw createChesscomInvalidResponseError(source);
      }
      return body;
    });
  }

  function fetchChesscomWithFallback(proxyUrl, directUrl, responseType) {
    function parse(response) {
      if (responseType === 'json') return response.json();
      return response.text();
    }
    return fetch(proxyUrl, { cache: 'no-store' })
      .then(function(r) {
        if (r.ok) return parse(r);
        if (r.status === 404) {
          var err = new Error('Not found on Chess.com (404)');
          err.status = 404;
          throw err;
        }
        throw new Error('proxy-unavailable');
      })
      .catch(function(err) {
        if (err && err.status === 404) throw err;
        return fetch(directUrl, { cache: 'no-store' }).then(function(r) {
          if (!r.ok) {
            var e = new Error('HTTP ' + r.status);
            e.status = r.status;
            throw e;
          }
          return parse(r);
        });
      });
  }

  function fetchTextWithFallback(proxyUrl, directUrl, headers) {
    var requestHeaders = headers || {};
    return fetchTextWithTimeout(proxyUrl, { cache: 'no-store', headers: requestHeaders }, 12000)
      .then(function(r) {
        if (r.ok) return r.text();
        if (r.status === 404) {
          var err = new Error('Not found (404)');
          err.status = 404;
          throw err;
        }
        throw new Error('proxy-unavailable');
      })
      .catch(function(err) {
        if (err && err.status === 404) throw err;
        return fetchTextWithTimeout(directUrl, { cache: 'no-store', headers: requestHeaders }, 12000).then(function(r) {
          if (!r.ok) {
            var e = new Error('HTTP ' + r.status);
            e.status = r.status;
            throw e;
          }
          return r.text();
        });
      });
  }

  function fetchTextWithTimeout(url, options, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    var requestOptions = Object.assign({}, options || {});
    if (controller) requestOptions.signal = controller.signal;
    if (controller && timeoutMs > 0) {
      timer = setTimeout(function() {
        controller.abort();
      }, timeoutMs);
    }
    return fetch(url, requestOptions)
      .catch(function(err) {
        if (err && err.name === 'AbortError') {
          var timeoutErr = new Error('Request timed out');
          timeoutErr.timeout = true;
          throw timeoutErr;
        }
        throw err;
      })
      .finally(function() {
        if (timer) clearTimeout(timer);
      });
  }

  function describeChesscomError(err, username, period) {
    if (!err) return 'Could not reach Chess.com. Please try again.';
    if (err.status === 404) {
      return 'Chess.com returned 404 for "' + username + '"' +
        (period ? ' in ' + period : '') + '. Check the username and month.';
    }
    var msg = err.message || '';
    if (err.timeout) {
      return 'Chess.com request timed out for "' + username + '"' +
        (period ? ' in ' + period : '') + '. Try again or change month.';
    }
    if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
      return 'Network request to Chess.com was blocked. Disable ad/privacy blockers for this site, then retry.';
    }
    return 'Could not fetch games from Chess.com (' + (msg || 'unknown error') + ').';
  }

  function describeLichessError(err, username) {
    if (!err) return 'Could not reach Lichess. Please try again.';
    if (err.status === 404) {
      return 'No public games found for "' + username + '" on Lichess.';
    }
    var msg = err.message || '';
    if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
      return 'Network request to Lichess was blocked. Disable blockers for this site, then retry.';
    }
    return 'Could not fetch games from Lichess (' + (msg || 'unknown error') + ').';
  }

  function loadFetchedGame(el) {
    var id = el.getAttribute('data-id');
    var platform = el.getAttribute('data-platform');
    
    if (platform === 'lichess') {
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(id) + '/export?clocks=false&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(id) + '?clocks=false&evals=false';
      fetchTextWithFallback(proxyUrl, directUrl)
        .then(function(pgn) {
          if (pgn) { loadPGNGame(pgn); switchTab('analyze'); triggerAutoReview(); }
        });
    }
  }

  function loadFetchedPGNGame(el) {
    var pgn = decodeURIComponent(el.getAttribute('data-pgn'));
    if (pgn) { loadPGNGame(pgn); switchTab('analyze'); triggerAutoReview(); }
  }

  // ===== NAVIGATION =====
  function goFirst() {
    if (!gamePositions.length) return;
    stopAutoPlay();
    currentMoveIndex = 0;
    chess = new Chess();
    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(null, null);
    updateActiveMoveHighlight();
    startAnalysis();
  }

  function goPrev() {
    if (!gamePositions.length || currentMoveIndex <= 0) return;
    stopAutoPlay();
    currentMoveIndex--;
    reloadPosition();
  }

  function goNext() {
    if (!gamePositions.length || currentMoveIndex >= gamePositions.length - 1) return;
    stopAutoPlay();
    currentMoveIndex++;
    reloadPosition();
  }

  function goLast() {
    if (!gamePositions.length) return;
    stopAutoPlay();
    currentMoveIndex = gamePositions.length - 1;
    reloadPosition();
  }

  function goToMove(index) {
    if (index < 0 || index >= gamePositions.length) return;
    stopAutoPlay();
    currentMoveIndex = index;
    reloadPosition();
  }

  function reloadPosition() {
    if (!gamePositions[currentMoveIndex]) return;
    
    var pos = gamePositions[currentMoveIndex];
    chess = new Chess();
    chess.load(pos.fen);
    ChessBoard.setPosition(chess);
    
    // Set last move highlight
    if (pos.move && currentMoveIndex > 0) {
      ChessBoard.setLastMove(pos.move.from, pos.move.to);
      SoundController.playMove();
    } else {
      ChessBoard.setLastMove(null, null);
    }
    
    ChessBoard.clearArrows();
    updateActiveMoveHighlight();
    updateFenDisplay();
    updateOpeningDisplay();
    startAnalysis();
    updateMoveQualityBanner();
  }

  function toggleAutoPlay() {
    if (autoPlayActive) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  }

  function startAutoPlay() {
    autoPlayActive = true;
    document.getElementById('btnPlay').textContent = '⏸';
    autoPlayInterval = setInterval(function() {
      if (currentMoveIndex >= gamePositions.length - 1) {
        stopAutoPlay();
        return;
      }
      goNext();
    }, 1200);
  }

  function stopAutoPlay() {
    autoPlayActive = false;
    document.getElementById('btnPlay').textContent = '▶';
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
  }

  // ===== BOARD EVENTS =====
  function onBoardMove(move, fen) {
    // User made a move on the board
    currentGame = null;
    resetGameReviewUI();
    
    if (!gamePositions.length) {
      gamePositions = [{fen: new Chess().fen(), move: null, moveNum: 0}];
    }
    
    // Truncate future moves and add new position
    gamePositions = gamePositions.slice(0, currentMoveIndex + 1);
    gamePositions.push({
      fen: fen,
      move: move,
      moveNum: currentMoveIndex + 1,
      san: move.san
    });
    currentMoveIndex++;
    
    ChessBoard.setLastMove(move.from, move.to);
    SoundController.playMove();
    updateMovesList();
    updateActiveMoveHighlight();
    updateFenDisplay();
    updateOpeningDisplay();
    startAnalysis();
  }

  function flipBoard() {
    ChessBoard.flip();
  }

  // ===== ANALYSIS =====
  function startAnalysis() {
    if (!analysisMode || !chess) return;
    
    var depth = parseInt(document.getElementById('depthSlider').value) || 20;
    var numLines = parseInt(document.querySelector('.lines-btn.active')?.getAttribute('data-lines')) || 3;
    
    EngineController.analyzeFen(chess.fen(), depth, numLines, function(bestMove) {
      // Best move received
    });
  }

  function analyzeFullGame() {
    var pgn = getAnalysisPGN();
    var parsed = pgn ? PGNParser.parse(pgn) : null;
    if ((!parsed || !parsed.moves || !parsed.moves.length) && gamePositions && gamePositions.length > 1) {
      pgn = buildAnalysisPgnFromPositions();
      parsed = pgn ? PGNParser.parse(pgn) : null;
    }
    if (!pgn && chess) {
      // Try getting PGN directly from the chess instance
      var directPgn = chess.pgn();
      if (directPgn && directPgn.trim()) {
        pgn = '[Event "chess ramp Analysis"]\n[Result "*"]\n\n' + directPgn + ' *';
      }
    }
    if (!pgn) {
      pgn = restoreLatestGameForAnalysis();
    }
    if (!pgn) {
      showToast('Load a game first', 'error');
      return;
    }

    setReviewBusyState(true, '0%');

    var reviewMeta = currentGame ? {
      whiteElo: parseInt(currentGame.whiteElo, 10) || undefined,
      blackElo: parseInt(currentGame.blackElo, 10) || undefined
    } : null;

    EngineController.analyzeGame(pgn, reviewMeta, function(done, total) {
      var pct = Math.round(done / total * 100);
      setReviewBusyState(true, pct + '%');
    }, function(results, history) {
      setReviewBusyState(false);
      
      // Apply quality labels to moves
      if (history) {
        history.forEach(function(move, i) {
          var el = document.querySelector('.move-san[data-move-index="' + (i + 1) + '"]');
          if (el && move.quality) {
            el.setAttribute('data-quality', move.quality);
          }
        });
      }
      
      // Show accuracy section
      showAccuracySection(history);
      showToast('Full game analysis complete!', 'success');
    });
  }

  function triggerAutoReview() {
    setTimeout(function() {
      analyzeFullGame();
    }, 120);
  }

  function restoreLatestGameForAnalysis() {
    if (!gameDatabase || !gameDatabase.length) {
      return '';
    }
    var latestGame = gameDatabase.find(function(entry) {
      return !!(entry && entry.pgn);
    });
    if (!latestGame || !latestGame.pgn) {
      return '';
    }
    var loaded = loadPGNGame(latestGame.pgn);
    if (!loaded) {
      return '';
    }
    showToast('Loaded latest saved game for review', 'success');
    return latestGame.pgn;
  }

  function getAnalysisPGN() {
    if (currentGame && currentGame.pgn) {
      return currentGame.pgn;
    }
    return buildAnalysisPgnFromPositions();
  }

  function buildAnalysisPgnFromPositions() {
    if (!gamePositions || gamePositions.length <= 1) {
      return '';
    }

    var startFen = gamePositions && gamePositions[0] ? gamePositions[0].fen : '';
    var fenParts = startFen ? startFen.split(/\s+/) : [];
    var moveParts = [];
    var moveNum = parseInt(fenParts[5], 10) || 1;
    var isWhiteTurn = !fenParts.length || fenParts[1] !== 'b';
    for (var i = 1; i < gamePositions.length; i++) {
      var san = gamePositions[i].san || (gamePositions[i].move && gamePositions[i].move.san) || '';
      if (!san) continue;
      if (isWhiteTurn) {
        moveParts.push(moveNum + '.');
      } else if (!moveParts.length) {
        moveParts.push(moveNum + '...');
      }
      moveParts.push(san);
      if (!isWhiteTurn) moveNum++;
      isWhiteTurn = !isWhiteTurn;
    }

    if (!moveParts.length) {
      return '';
    }

    var today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    var initialFen = new Chess().fen();
    var headerLines = [
      '[Event "chess ramp Analysis"]',
      '[Site "Local"]',
      '[Date "' + today + '"]',
      '[White "' + ((currentGame && currentGame.white) || 'White') + '"]',
      '[Black "' + ((currentGame && currentGame.black) || 'Black') + '"]',
      '[Result "*"]'
    ];

    if (startFen && startFen !== initialFen) {
      headerLines.push('[SetUp "1"]');
      headerLines.push('[FEN "' + startFen.replace(/"/g, '\\"') + '"]');
    }

    headerLines.push('');
    headerLines.push(moveParts.join(' ') + ' *');
    return headerLines.join('\n');
  }

  function showAccuracySection(history) {
    if (!history) return;

    var panel = document.getElementById('gameReviewPanel');
    if (panel) panel.classList.remove('is-empty');

    var allQualities = ['brilliant','great','book','best','excellent','good','inaccuracy','mistake','miss','blunder'];
    var counts = {w: {}, b: {}};
    allQualities.forEach(function(q) { counts.w[q] = 0; counts.b[q] = 0; });

    history.forEach(function(move) {
      if (move.quality && counts[move.color][move.quality] !== undefined) {
        counts[move.color][move.quality]++;
      }
    });

    // Prefer official Chess.com accuracy when the game came from Chess.com's
    // archive JSON. Manual PGNs still use the local estimate below.
    var wMoves = history.filter(function(m) { return m.color === 'w'; });
    var bMoves = history.filter(function(m) { return m.color === 'b'; });
    var estimatedWhite = calculateAccuracyFromCPL(wMoves, 'w', history);
    var estimatedBlack = calculateAccuracyFromCPL(bMoves, 'b', history);
    var displayedAccuracies = getDisplayedReviewAccuracies(currentGame, estimatedWhite, estimatedBlack);
    var wAcc = displayedAccuracies.white;
    var bAcc = displayedAccuracies.black;
    var whiteAccEl = document.getElementById('grWhiteAcc');
    var blackAccEl = document.getElementById('grBlackAcc');

    whiteAccEl.textContent = wAcc.toFixed(1) + '%';
    blackAccEl.textContent = bAcc.toFixed(1) + '%';
    whiteAccEl.title = displayedAccuracies.source === 'chesscom'
      ? 'Official Chess.com accuracy'
      : 'Local Stockfish review estimate';
    blackAccEl.title = whiteAccEl.title;

    // Player names & ratings
    var whiteName = currentGame ? currentGame.white : 'White';
    var blackName = currentGame ? currentGame.black : 'Black';
    var whiteElo = currentGame ? currentGame.whiteElo : '?';
    var blackElo = currentGame ? currentGame.blackElo : '?';
    document.getElementById('grWhiteName').textContent = whiteName;
    document.getElementById('grBlackName').textContent = blackName;
    var whiteEloDisplay = whiteElo && whiteElo !== '?' ? whiteElo + ' Elo' : '—';
    var blackEloDisplay = blackElo && blackElo !== '?' ? blackElo + ' Elo' : '—';
    document.getElementById('grWhiteElo').textContent = whiteEloDisplay;
    document.getElementById('grBlackElo').textContent = blackEloDisplay;

    // Classification table
    var table = document.getElementById('grClassifyTable');
    if (table) {
      table.innerHTML = allQualities.map(function(q) {
        var meta = QUALITY_META[q] || {label: q, icon: '?', iconClass: ''};
        return '<div class="gr-classify-row">' +
          '<div class="gr-cl-label">' + meta.label + '</div>' +
          '<div class="gr-cl-wval">' + counts.w[q] + '</div>' +
          '<div class="gr-cl-icon"><span class="qi ' + meta.iconClass + '">' + meta.icon + '</span></div>' +
          '<div class="gr-cl-bval">' + counts.b[q] + '</div>' +
          '</div>';
      }).join('');
    }

    // Phase ratings
    var phases = computePhaseRatings(history);
    setPhaseIcon('grPhaseOpW', phases.w.opening);
    setPhaseIcon('grPhaseOpB', phases.b.opening);
    setPhaseIcon('grPhaseMidW', phases.w.middlegame);
    setPhaseIcon('grPhaseMidB', phases.b.middlegame);
    setPhaseIcon('grPhaseEndW', phases.w.endgame);
    setPhaseIcon('grPhaseEndB', phases.b.endgame);

    lastAnalysisHistory = history;
    lastAnalysisCounts = counts;
    updateGameRatings(counts, wAcc, bAcc);
    highlightPlayerCards(wAcc, bAcc);
    updateCoachTip(wAcc, bAcc, counts);
    updateMoveQualityBanner();
  }

  function calculateAccuracyFromCPL(moves, color, history) {
    // Prefer the chess kit accuracy already computed during the game review.
    var summary = history && history.gameSummary && history.gameSummary.accuracy;
    if (!summary && lastAnalysisHistory && lastAnalysisHistory.gameSummary) {
      summary = lastAnalysisHistory.gameSummary.accuracy;
    }
    if (summary) {
      var fromSummary = color === 'b' ? summary.black : summary.white;
      if (typeof fromSummary === 'number' && isFinite(fromSummary)) {
        return Math.max(0, Math.min(100, fromSummary));
      }
    }
    return 100;
  }

  function computePhaseRatings(history) {
    var phases = {
      w: {opening: 0, middlegame: 0, endgame: 0},
      b: {opening: 0, middlegame: 0, endgame: 0}
    };
    var phaseMoves = {
      w: {opening: [], middlegame: [], endgame: []},
      b: {opening: [], middlegame: [], endgame: []}
    };
    history.forEach(function(m, i) {
      var moveNum = Math.floor(i / 2) + 1;
      var phase = moveNum <= 10 ? 'opening' : moveNum <= 30 ? 'middlegame' : 'endgame';
      phaseMoves[m.color][phase].push(m);
    });
    ['w','b'].forEach(function(color) {
      ['opening','middlegame','endgame'].forEach(function(phase) {
        var moves = phaseMoves[color][phase];
        if (!moves.length) { phases[color][phase] = -1; return; }
        var bad = 0;
        moves.forEach(function(m) {
          if (m.quality === 'blunder') bad += 5;
          else if (m.quality === 'miss') bad += 3.5;
          else if (m.quality === 'mistake') bad += 2.5;
          else if (m.quality === 'inaccuracy') bad += 0.8;
        });
        var acc = Math.max(0, 100 - (bad / moves.length * 18));
        phases[color][phase] = Math.min(100, acc);
      });
    });
    return phases;
  }

  function setPhaseIcon(elId, acc) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (acc < 0) { 
      el.innerHTML = '<span class="gr-phase-icon qi qi-good">--</span><span class="gr-phase-text">No data</span>';
      return;
    }
    var icon, cls, label;
    if (acc >= 85) { icon = '\u2605'; cls = 'qi-best'; label = 'Great'; }
    else if (acc >= 65) { icon = '\u2714'; cls = 'qi-good'; label = 'Good'; }
    else { icon = '?'; cls = 'qi-mistake'; label = 'Bad'; }
    el.innerHTML = '<span class="gr-phase-icon qi ' + cls + '" title="' + label + '">' + icon + '</span>' +
      '<span class="gr-phase-text">' + label + '</span>';
  }

  function drawEvalGraph(history, highlightIndex) {
    var canvas = document.getElementById('evalGraph');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Center line (0 eval)
    var midY = H / 2;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!history.length) return;

    var points = [];
    // Starting position eval = 0
    points.push({eval: 0, quality: null, color: null});
    history.forEach(function(m) {
      points.push({eval: m.evalAfter !== undefined ? m.evalAfter : 0, quality: m.quality, color: m.color});
    });

    var maxAbs = 5;
    function clampEval(v) { return Math.max(-maxAbs, Math.min(maxAbs, v)); }
    function toY(v) { return midY - (clampEval(v) / maxAbs) * (midY - 8); }
    function toX(i) { return (i / (points.length - 1)) * (W - 16) + 8; }

    // Fill area above/below center
    // White advantage area (above center)
    ctx.beginPath();
    ctx.moveTo(toX(0), midY);
    for (var i = 0; i < points.length; i++) {
      var y = toY(points[i].eval);
      if (y < midY) ctx.lineTo(toX(i), y);
      else ctx.lineTo(toX(i), midY);
    }
    ctx.lineTo(toX(points.length - 1), midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();

    // Black advantage area (below center)
    ctx.beginPath();
    ctx.moveTo(toX(0), midY);
    for (var j = 0; j < points.length; j++) {
      var yb = toY(points[j].eval);
      if (yb > midY) ctx.lineTo(toX(j), yb);
      else ctx.lineTo(toX(j), midY);
    }
    ctx.lineTo(toX(points.length - 1), midY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(50,50,50,0.3)';
    ctx.fill();

    // Eval line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].eval));
    for (var k = 1; k < points.length; k++) {
      ctx.lineTo(toX(k), toY(points[k].eval));
    }
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Colored dots for notable moves
    var dotColors = {
      brilliant: '#1baca6', great: '#5b8a5b', best: '#6abf40',
      excellent: '#6abf40', book: '#c8a03f',
      inaccuracy: '#e8bd58', mistake: '#d48b2a', miss: '#ef5350', blunder: '#c93030'
    };
    for (var d = 1; d < points.length; d++) {
      var q = points[d].quality;
      if (q && q !== 'good' && dotColors[q]) {
        ctx.beginPath();
        ctx.arc(toX(d), toY(points[d].eval), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColors[q];
        ctx.fill();
      }
    }

    if (typeof highlightIndex === 'number' && highlightIndex >= 0) {
      var pointIdx = Math.min(points.length - 1, highlightIndex + 1);
      if (pointIdx >= 0 && points[pointIdx]) {
        var hx = toX(pointIdx);
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx, 0);
        ctx.lineTo(hx, H);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(hx, toY(points[pointIdx].eval), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1abc9c';
        ctx.stroke();
      }
    }
  }

  function resetGameReviewUI() {
    lastAnalysisHistory = null;
    lastAnalysisCounts = null;
    lastCoachSummary = DEFAULT_COACH_TEXT;
    var panel = document.getElementById('gameReviewPanel');
    if (panel) panel.classList.add('is-empty');
    setCoachMessage('Coach Ramp', DEFAULT_COACH_TEXT);
    var table = document.getElementById('grClassifyTable');
    if (table) table.innerHTML = '';
    var wRating = document.getElementById('grWhiteGameRating');
    var bRating = document.getElementById('grBlackGameRating');
    if (wRating) wRating.textContent = '?';
    if (bRating) bRating.textContent = '?';
    var whiteCard = document.getElementById('grWhiteCard');
    var blackCard = document.getElementById('grBlackCard');
    if (whiteCard) whiteCard.classList.remove('active');
    if (blackCard) blackCard.classList.remove('active');
    setMoveQualityBanner(null);
    var canvas = document.getElementById('evalGraph');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setReviewBusyState(false);
  }

  function updateMoveQualityBanner() {
    var moveIndex = currentMoveIndex - 1;
    var moveInfo = null;
    if (lastAnalysisHistory && moveIndex >= 0 && moveIndex < lastAnalysisHistory.length) {
      moveInfo = lastAnalysisHistory[moveIndex];
    }
    setMoveQualityBanner(moveInfo, moveIndex);
    refreshEvalGraphHighlight(moveIndex);
  }

  function refreshEvalGraphHighlight(highlightIndex) {
    if (!lastAnalysisHistory) return;
    var idx = (typeof highlightIndex === 'number') ? highlightIndex : currentMoveIndex - 1;
    drawEvalGraph(lastAnalysisHistory, idx);
  }

  function setMoveQualityBanner(moveInfo, moveIndex) {
    var iconEl = document.getElementById('moveQualityIcon');
    var gradeEl = document.getElementById('moveQualityGrade');
    var descEl = document.getElementById('moveQualityDesc');
    if (!iconEl || !gradeEl || !descEl) return;

    if (!moveInfo) {
      iconEl.textContent = '?';
      iconEl.className = 'qi';
      var label = (typeof moveIndex === 'number' && moveIndex >= 0)
        ? 'Move ' + (Math.floor(moveIndex / 2) + 1) + ' not analyzed yet'
        : 'Awaiting analysis';
      gradeEl.textContent = label;
      descEl.textContent = DEFAULT_MOVE_DESC;
      setCoachMessage('Coach Ramp', lastCoachSummary || DEFAULT_COACH_TEXT);
      return;
    }

    var meta = getQualityMeta(moveInfo.quality);
    iconEl.textContent = meta.icon;
    iconEl.className = 'qi ' + (meta.iconClass || '');
    gradeEl.textContent = meta.label + ' · ' + buildMoveLabel(moveInfo, moveIndex);
    descEl.textContent = meta.tip + ' ' + describeMoveSwing(moveInfo);
    updateCoachForMove(moveInfo, moveIndex);
  }

  function buildMoveLabel(moveInfo, moveIndex) {
    var moveNum = moveInfo.moveNumber || (typeof moveIndex === 'number' ? Math.floor(moveIndex / 2) + 1 : '?');
    var prefix = moveInfo.color === 'w' ? moveNum + '.' : moveNum + '...';
    var san = moveInfo.san || moveInfo.move || '';
    return prefix + ' ' + san;
  }

  function describeMoveSwing(moveInfo) {
    var before = parseFloat(moveInfo.evalBefore);
    var after = parseFloat(moveInfo.evalAfter);
    if (isNaN(before) || isNaN(after)) {
      return 'Check this move with Stockfish for deeper insight.';
    }
    var delta = after - before;
    return 'Evaluation now ' + describeAdvantage(after) + ' (Δ ' + formatDeltaValue(delta) + ').';
  }

  function describeAdvantage(score) {
    if (typeof score !== 'number') score = parseFloat(score);
    if (isNaN(score)) return '0.00';
    if (score > 0.05) return formatEvalValue(score) + ' for White';
    if (score < -0.05) return formatEvalValue(score) + ' for Black';
    return formatEvalValue(score) + ' (Level)';
  }

  function formatEvalValue(value) {
    var num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    var prefix = num >= 0 ? '+' : '';
    return prefix + num.toFixed(2);
  }

  function formatDeltaValue(delta) {
    var num = parseFloat(delta);
    if (isNaN(num) || Math.abs(num) < 0.01) return '±0.00';
    var prefix = num >= 0 ? '+' : '';
    return prefix + num.toFixed(2);
  }

  function getQualityMeta(key) {
    return QUALITY_META[key] || QUALITY_META.good;
  }

  function setCoachMessage(title, text) {
    var titleEl = document.getElementById('grCoachTitle');
    var textEl = document.getElementById('grCoachText');
    if (titleEl) titleEl.textContent = title || 'Coach Ramp';
    if (textEl) textEl.textContent = text || DEFAULT_COACH_TEXT;
  }

  function updateCoachForMove(moveInfo, moveIndex) {
    if (!moveInfo) {
      setCoachMessage('Coach Ramp', lastCoachSummary || DEFAULT_COACH_TEXT);
      return;
    }
    var moveLabel = buildMoveLabel(moveInfo, moveIndex);
    var player = moveInfo.color === 'w' ? 'White' : 'Black';
    var before = parseFloat(moveInfo.evalBefore);
    var after = parseFloat(moveInfo.evalAfter);
    var delta = !isNaN(before) && !isNaN(after)
      ? (moveInfo.color === 'w' ? (after - before) : (before - after))
      : null;
    var swingText = (delta === null || isNaN(delta))
      ? ''
      : ' ' + player + '\'s eval swing: ' + formatDeltaValue(delta) + '.';

    var title = 'Coach Ramp · ' + getQualityMeta(moveInfo.quality).label;
    var text = moveLabel + ' was played by ' + player + '. ';

    switch (moveInfo.quality) {
      case 'brilliant':
        text += 'That is a brilliant resource. It finds a powerful idea and shifts the game in a big way.';
        break;
      case 'great':
        text += 'That is a great move. Strong practical choice, clean calculation, and clear improvement.';
        break;
      case 'book':
        text += 'This follows known opening theory. Solid, principled play with no need to reinvent the position.';
        break;
      case 'best':
        text += 'That is Stockfish\'s top move here. You matched the engine and kept maximum pressure.';
        break;
      case 'excellent':
        text += 'Very clean move. It keeps the position healthy and preserves your plans.';
        break;
      case 'good':
        text += 'Good move. Not the absolute top line, but it keeps the game under control.';
        break;
      case 'inaccuracy':
        text += 'Small slip. The position was still manageable, but there was a more accurate continuation.';
        break;
      case 'mistake':
        text += 'This is a real mistake. It gives the opponent extra chances and weakens your position.';
        break;
      case 'miss':
        text += 'Missed chance. There was a stronger tactic or conversion available in this moment.';
        break;
      case 'blunder':
        text += 'That is a blunder. It changes the game sharply and likely hands over the advantage.';
        break;
      default:
        text += 'Review this moment carefully.';
        break;
    }

    var tacticText = inferCoachTactic(moveInfo, moveIndex);
    setCoachMessage(title, text + (tacticText ? ' ' + tacticText : '') + swingText);
  }

  function inferCoachTactic(moveInfo, moveIndex) {
    var san = moveInfo.san || '';
    var nextMove = lastAnalysisHistory && typeof moveIndex === 'number'
      ? lastAnalysisHistory[moveIndex + 1]
      : null;
    var moverBefore = signedEvalForMover(moveInfo, moveInfo.evalBefore);
    var moverAfter = signedEvalForMover(moveInfo, moveInfo.evalAfter);
    var movedPiece = pieceLabel(moveInfo.piece);
    var bestMoveText = formatBestMoveHint(moveInfo.bestMove, moveIndex);

    if (san.indexOf('#') !== -1) {
      return 'It finishes the game with mate.';
    }

    if (moveInfo.quality === 'miss' && moverBefore >= 7 && moverAfter <= moverBefore - 2) {
      return 'This likely misses a mating attack or forced finish.';
    }

    if ((moveInfo.quality === 'blunder' || moveInfo.quality === 'mistake') && moverAfter <= -7) {
      return 'This appears to allow a major mate threat against the king.';
    }

    if (nextMove && nextMove.captured && nextMove.color !== moveInfo.color &&
        (moveInfo.quality === 'blunder' || moveInfo.quality === 'mistake' || moveInfo.quality === 'miss')) {
      var lostPiece = pieceLabel(nextMove.captured);
      if (nextMove.to === moveInfo.to && movedPiece) {
        return 'It seems to hang the ' + movedPiece + '; the opponent wins it on the next move.';
      }
      return 'It allows the opponent to win a ' + lostPiece + ' on the next move.';
    }

    if (moveInfo.captured) {
      var wonPiece = pieceLabel(moveInfo.captured);
      if (san.indexOf('+') !== -1) {
        return 'It wins a ' + wonPiece + ' with check.';
      }
      return 'It wins a ' + wonPiece + ' from the position.';
    }

    if (moveInfo.promotion) {
      return 'The pawn promotes to a ' + pieceLabel(moveInfo.promotion) + ', which is usually decisive.';
    }

    if (san.indexOf('O-O-O') === 0) {
      return 'Queenside castling activates the rook and tucks the king away.';
    }

    if (san.indexOf('O-O') === 0) {
      return 'Castling improves king safety and connects the rooks.';
    }

    if (san.indexOf('+') !== -1) {
      return 'The check forces a response and changes the tempo of the position.';
    }

    if ((moveInfo.quality === 'miss' || moveInfo.quality === 'inaccuracy') && bestMoveText) {
      return 'Stockfish preferred ' + bestMoveText + ' instead.';
    }

    if (moveInfo.quality === 'book') {
      return 'This is a standard theoretical move from the opening.';
    }

    return '';
  }

  function signedEvalForMover(moveInfo, evalValue) {
    var num = parseFloat(evalValue);
    if (isNaN(num)) return 0;
    return moveInfo && moveInfo.color === 'b' ? -num : num;
  }

  function pieceLabel(piece) {
    var map = {
      p: 'pawn',
      n: 'knight',
      b: 'bishop',
      r: 'rook',
      q: 'queen',
      k: 'king'
    };
    return map[(piece || '').toLowerCase()] || 'piece';
  }

  function formatBestMoveHint(bestMove, moveIndex) {
    if (!bestMove || bestMove.length < 4) return '';
    try {
      var boardFen = null;
      var idx = typeof moveIndex === 'number' ? moveIndex : Math.max(0, currentMoveIndex - 1);
      if (gamePositions && gamePositions[idx] && gamePositions[idx].fen) {
        boardFen = gamePositions[idx].fen;
      }
      if (!boardFen && chess) boardFen = chess.fen();
      var tempChess = new Chess();
      if (boardFen) tempChess.load(boardFen);
      var move = tempChess.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove[4] || 'q'
      });
      return move && move.san ? move.san : (bestMove.slice(0, 2) + '-' + bestMove.slice(2, 4));
    } catch (e) {
      return bestMove.slice(0, 2) + '-' + bestMove.slice(2, 4);
    }
  }

  function updateGameRatings(counts, wAcc, bAcc) {
    var wBox = document.getElementById('grWhiteGameRating');
    var bBox = document.getElementById('grBlackGameRating');
    if (!wBox || !bBox) return;
    if (!counts || !counts.w || !counts.b || isNaN(wAcc) || isNaN(bAcc)) {
      wBox.textContent = '—';
      bBox.textContent = '—';
      return;
    }
    wBox.textContent = estimateGameRating(wAcc, counts.w);
    bBox.textContent = estimateGameRating(bAcc, counts.b);
  }

  function estimateGameRating(acc, playerCounts) {
    if (acc === null || acc === undefined || isNaN(acc) || !playerCounts) return '—';
    var base = 200 + acc * 20;
    var swing = 0;
    swing += (playerCounts.brilliant || 0) * 24;
    swing += (playerCounts.great || 0) * 14;
    swing += (playerCounts.best || 0) * 8;
    swing += (playerCounts.excellent || 0) * 4;
    swing -= (playerCounts.inaccuracy || 0) * 10;
    swing -= (playerCounts.mistake || 0) * 24;
    swing -= (playerCounts.miss || 0) * 32;
    swing -= (playerCounts.blunder || 0) * 46;
    var rating = Math.round(Math.max(300, Math.min(3200, base + swing)));
    return rating;
  }

  function highlightPlayerCards(wAcc, bAcc) {
    var whiteCard = document.getElementById('grWhiteCard');
    var blackCard = document.getElementById('grBlackCard');
    if (!whiteCard || !blackCard) return;
    whiteCard.classList.remove('active');
    blackCard.classList.remove('active');
    if (isNaN(wAcc) || isNaN(bAcc)) return;
    if (Math.abs(wAcc - bAcc) < 0.1) return;
    if (wAcc > bAcc) whiteCard.classList.add('active');
    else blackCard.classList.add('active');
  }

  function updateCoachTip(wAcc, bAcc, counts) {
    if (wAcc === null || bAcc === null || isNaN(wAcc) || isNaN(bAcc)) {
      lastCoachSummary = DEFAULT_COACH_TEXT;
      return;
    }
    var diff = Math.abs(wAcc - bAcc);
    if (diff < 2) {
      lastCoachSummary = 'Balanced game. Step through the moves to catch the small turning points that decided the result.';
      return;
    }
    var leader = wAcc > bAcc ? 'White' : 'Black';
    var target = leader === 'White' ? counts.b : counts.w;
    var blunders = target ? (target.blunder || 0) : 0;
    var mistakes = target ? (target.mistake || 0) : 0;
    var misses = target ? (target.miss || 0) : 0;
    var issueLabel = blunders ? (blunders + ' blunder' + (blunders === 1 ? '' : 's')) :
      mistakes ? (mistakes + ' mistake' + (mistakes === 1 ? '' : 's')) :
      misses ? (misses + ' miss' + (misses === 1 ? '' : 'es')) :
      'the accuracy gap';
    lastCoachSummary = leader + ' controlled more of the game. Review ' + issueLabel + ' to find the decisive moments.';
  }

  function setReviewBusyState(isBusy, label) {
    var topButton = document.getElementById('analyzeFullGame');
    var overlay = document.getElementById('reviewProgressOverlay');
    var overlayCard = document.getElementById('reviewProgressCard');
    var overlayText = document.getElementById('reviewProgressText');
    var analyzeContent = document.getElementById('analyzeContent');
    var progressLabel = label || '0%';
    var text = isBusy ? ('Review ' + (label || '...')) : 'Full Analysis';
    if (topButton) {
      topButton.textContent = text;
      topButton.disabled = !!isBusy;
    }
    if (overlay) {
      overlay.style.display = isBusy ? 'flex' : 'none';
      if (isBusy) {
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '99999';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0, 0, 0, 0.34)';
        overlay.style.backdropFilter = 'blur(10px)';
      } else {
        overlay.style.position = '';
        overlay.style.inset = '';
        overlay.style.zIndex = '';
        overlay.style.alignItems = '';
        overlay.style.justifyContent = '';
        overlay.style.background = '';
        overlay.style.backdropFilter = '';
      }
    }
    if (overlayCard) {
      if (isBusy) {
        overlayCard.style.display = 'block';
        overlayCard.style.minWidth = '280px';
        overlayCard.style.maxWidth = '340px';
        overlayCard.style.padding = '16px 18px';
        overlayCard.style.borderRadius = '20px';
        overlayCard.style.background = 'rgba(10, 10, 10, 0.97)';
        overlayCard.style.border = '1px solid rgba(255, 255, 255, 0.14)';
        overlayCard.style.boxShadow = '0 24px 80px rgba(0, 0, 0, 0.46)';
        overlayCard.style.textAlign = 'center';
      } else {
        overlayCard.style.display = '';
        overlayCard.style.minWidth = '';
        overlayCard.style.maxWidth = '';
        overlayCard.style.padding = '';
        overlayCard.style.borderRadius = '';
        overlayCard.style.background = '';
        overlayCard.style.border = '';
        overlayCard.style.boxShadow = '';
        overlayCard.style.textAlign = '';
      }
    }
    if (overlayText) {
      overlayText.textContent = isBusy
        ? ('Review in progress · ' + progressLabel)
        : 'Review in progress';
    }
    if (analyzeContent) {
      analyzeContent.classList.toggle('is-reviewing', !!isBusy);
    }
    setCoachMessage('Coach Ramp', isBusy
      ? ('Review in progress · ' + progressLabel)
      : DEFAULT_COACH_TEXT);
  }
  // ===== MOVES LIST =====
  function updateMovesList() {
    var list = document.getElementById('movesList');
    if (!list) return;
    
    if (!gamePositions.length || gamePositions.length <= 1) {
      list.innerHTML = '<div class="move-number" style="color:var(--text-muted);font-size:0.75rem;padding:12px;">Make moves or import a game...</div>';
      return;
    }
    
    var html = '';
    var moveNum = 1;
    
    for (var i = 1; i < gamePositions.length; i++) {
      var pos = gamePositions[i];
      var isWhiteMove = (i % 2 === 1);
      
      if (isWhiteMove) {
        html += '<span class="move-number">' + moveNum + '.</span>';
      }
      
      html += '<span class="move-san" data-move-index="' + i + '" onclick="AppController.goToMoveByIndex(' + i + ')">' + (pos.san || pos.move?.san || '?') + '</span>';
      
      if (!isWhiteMove) moveNum++;
    }
    
    // Add result
    if (currentGame && currentGame.result && currentGame.result !== '*') {
      html += '<span class="move-number" style="color:var(--text-secondary)">' + currentGame.result + '</span>';
    }
    
    list.innerHTML = html;
    updateActiveMoveHighlight();
  }

  function updateActiveMoveHighlight() {
    document.querySelectorAll('.move-san').forEach(function(el) { el.classList.remove('active'); });
    var activeEl = document.querySelector('.move-san[data-move-index="' + currentMoveIndex + '"]');
    if (activeEl) {
      activeEl.classList.add('active');
      activeEl.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }
  }

  function goToMoveByIndex(index) {
    goToMove(index);
  }

  // ===== FEN / OPENING DISPLAY =====
  function updateFenDisplay() {
    var fenInput = document.getElementById('fenInput');
    if (fenInput && chess) fenInput.value = chess.fen();
  }

  function updateOpeningDisplay() {
    if (!chess) return;
    var opening = OpeningBook.identify(chess);
    var nameEl = document.getElementById('openingName');
    var ecoEl = document.getElementById('openingEco');
    if (nameEl) nameEl.textContent = opening.name || '—';
    if (ecoEl) ecoEl.textContent = opening.eco || '';
  }

  // ===== ENGINE LINE LOADING =====
  function loadEngineLine(pv) {
    if (!pv || !chess) return;
    var moves = pv.split(' ');
    var tempChess = new Chess();
    tempChess.load(chess.fen());
    
    var newPositions = [].concat(gamePositions.slice(0, currentMoveIndex + 1));
    
    moves.forEach(function(uciMove) {
      if (!uciMove || uciMove.length < 4) return;
      var result = tempChess.move({from: uciMove.slice(0,2), to: uciMove.slice(2,4), promotion: uciMove[4] || 'q'});
      if (result) {
        newPositions.push({fen: tempChess.fen(), move: result, san: result.san, moveNum: newPositions.length});
      }
    });
    
    gamePositions = newPositions;
    currentMoveIndex++;
    reloadPosition();
    updateMovesList();
  }

  // ===== PROFILE =====
  function loadProfile() {
    try {
      var saved = localStorage.getItem('kv_profile');
      if (saved) {
        profile = JSON.parse(saved);
        applyProfile();
      }
    } catch(e) {}
  }

  function applyProfile() {
    if (profile.displayName) {
      document.getElementById('profileName').textContent = profile.displayName;
      document.getElementById('profileDisplayName').value = profile.displayName;
    }
    if (profile.chesscomUsername) document.getElementById('chesscomUsername').value = profile.chesscomUsername;
    if (profile.lichessUsername) document.getElementById('lichessUsername').value = profile.lichessUsername;
    if (profile.prefDepth) {
      document.getElementById('prefDepth').value = profile.prefDepth;
      document.getElementById('depthSlider').value = profile.prefDepth;
      document.getElementById('depthVal').textContent = profile.prefDepth;
    }
  }

  function saveProfile() {
    profile = {
      displayName: document.getElementById('profileDisplayName').value,
      chesscomUsername: document.getElementById('chesscomUsername').value,
      lichessUsername: document.getElementById('lichessUsername').value,
      prefEngine: DEFAULT_ENGINE_ID,
      prefDepth: document.getElementById('prefDepth').value,
      savedAt: new Date().toISOString()
    };
    
    try {
      localStorage.setItem('kv_profile', JSON.stringify(profile));
      document.getElementById('profileName').textContent = profile.displayName || 'Guest';
      var ss = document.getElementById('saveStatus');
      if (ss) { ss.textContent = '✓ Saved!'; setTimeout(function() { ss.textContent = ''; }, 2000); }
      showToast('Profile saved!', 'success');
      // Refresh home display
      if (typeof HomeController !== 'undefined') {
        HomeController.refreshHomeData();
        HomeController.saveCurrentAsProfile(profile);
        // Close edit mode
        var em = document.getElementById('profileEditMode');
        var vm = document.getElementById('profileViewMode');
        var et = document.getElementById('editProfileToggle');
        if (em) em.style.display = 'none';
        if (vm) vm.style.display = 'block';
        if (et) et.textContent = 'Edit';
      }
    } catch(e) {
      showToast('Could not save profile', 'error');
    }
  }

  // ===== DATABASE =====
  function loadDatabase() {
    try {
      var saved = localStorage.getItem('kv_database');
      if (saved) gameDatabase = JSON.parse(saved);
    } catch(e) { gameDatabase = []; }
  }

  function saveToDatabase(game) {
    if (!game) return;
    var summary = PGNParser.gameToSummary(game);
    summary.id = Date.now();
    summary.analyzedAt = new Date().toISOString();
    if (game.sourcePlatform) summary.sourcePlatform = game.sourcePlatform;
    if (game.sourceUrl) summary.sourceUrl = game.sourceUrl;
    if (game.reviewAccuracies) {
      summary.sourceAccuracies = {
        white: game.reviewAccuracies.white,
        black: game.reviewAccuracies.black,
        source: game.reviewAccuracies.source || ''
      };
    }
    
    var existingIndex = gameDatabase.findIndex(function(g) {
      return (g.pgn && summary.pgn && g.pgn === summary.pgn) ||
        (g.white === summary.white && g.black === summary.black && g.result === summary.result);
    });

    if (existingIndex >= 0) {
      var existing = gameDatabase[existingIndex];
      var merged = Object.assign({}, existing, summary, {
        id: existing.id,
        analyzedAt: summary.analyzedAt
      });
      gameDatabase.splice(existingIndex, 1);
      gameDatabase.unshift(merged);
      try { localStorage.setItem('kv_database', JSON.stringify(gameDatabase)); } catch(e) {}
      return;
    }

    gameDatabase.unshift(summary);
    if (gameDatabase.length > 500) gameDatabase = gameDatabase.slice(0, 500);

    try { localStorage.setItem('kv_database', JSON.stringify(gameDatabase)); } catch(e) {}

    // Update stats
    updateStats();
  }

  function updateStats() {
    document.getElementById('statGamesAnalyzed').textContent = gameDatabase.length;
  }

  function renderDatabase(search) {
    var rows = document.getElementById('dbRows');
    if (!rows) return;
    
    var games = gameDatabase;
    if (search) {
      var q = search.toLowerCase();
      games = games.filter(function(g) {
        return (g.white || '').toLowerCase().includes(q) ||
               (g.black || '').toLowerCase().includes(q) ||
               (g.opening || '').toLowerCase().includes(q);
      });
    }
    
    if (!games.length) {
      rows.innerHTML = '<div class="no-games">No games in database. Import games to get started.</div>';
      return;
    }
    
    rows.innerHTML = games.slice(0, 50).map(function(g) {
      var resultClass = g.result === '1-0' ? 'result-w' : g.result === '0-1' ? 'result-l' : 'result-d';
      return '<div class="db-row" onclick="AppController.loadDbGame(\'' + g.id + '\')">' +
        '<span>' + (g.white || '?') + '</span>' +
        '<span>' + (g.black || '?') + '</span>' +
        '<span class="' + resultClass + '">' + (g.result || '*') + '</span>' +
        '<span>' + ((g.opening || '').substring(0, 20) || '—') + '</span>' +
        '<span>' + (g.date || '').substring(0, 10) + '</span>' +
        '<span class="db-row-actions"><button class="btn-sm" onclick="event.stopPropagation();AppController.loadDbGame(\'' + g.id + '\')">Load</button></span>' +
        '</div>';
    }).join('');
  }

  function loadDbGame(id) {
    var game = gameDatabase.find(function(g) { return String(g.id) === String(id); });
    if (game && game.pgn) {
      loadPGNGame(game.pgn, {
        sourcePlatform: game.sourcePlatform || '',
        sourceUrl: game.sourceUrl || '',
        sourceAccuracies: game.sourceAccuracies || null
      });
      switchTab('analyze');
    }
  }

  function renderSavedGames() {
    var list = document.getElementById('savedGamesList');
    if (!list) return;
    
    if (!gameDatabase.length) {
      list.innerHTML = '<div class="no-games">No saved games yet</div>';
      return;
    }
    
    list.innerHTML = gameDatabase.slice(0, 20).map(function(g) {
      return '<div class="saved-game-item" onclick="AppController.loadDbGame(\'' + g.id + '\')">' +
        '<div class="saved-game-players">' + (g.white || '?') + ' vs ' + (g.black || '?') + ' <strong>' + (g.result || '*') + '</strong></div>' +
        '<div class="saved-game-meta">' + (g.opening || '').substring(0, 30) + ' • ' + (g.date || '').substring(0, 10) + '</div>' +
        '</div>';
    }).join('');
  }

  // ===== UTILS =====
  function copyToClipboard(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(function() { toast.className = 'toast'; }, 3000);
  }

  // Public API
  return {
    init: init,
    goToMoveByIndex: goToMoveByIndex,
    loadEngineLine: loadEngineLine,
    loadFetchedGame: loadFetchedGame,
    loadFetchedPGNGame: loadFetchedPGNGame,
    loadDbGame: loadDbGame,
    showToast: showToast,
    loadPGNPublic: loadPGNGame,
    loadFenPublic: loadFenGame,
    loadFromURLPublic: loadFromURL,
    readPGNFilePublic: readPGNFile,
    renderDatabasePublic: renderDatabase,
    switchToTab: switchTab,
    createAnalyzeLinkForPGN: createAnalyzeLinkForPGN,
    renderFetchSkeleton: renderFetchSkeleton,
    parseChesscomArchiveGames: parseChesscomArchiveGames,
    fetchChesscomMonthPgn: fetchChesscomMonthPgn,
    fetchChesscomWithFallback: fetchChesscomWithFallback,
    fetchTextWithFallback: fetchTextWithFallback,
    describeChesscomError: describeChesscomError,
    describeLichessError: describeLichessError
  };
})();

// ===== HOME PAGE CONTROLLER =====
const HomeController = (function() {
  var chesscomStatsRequest = 0;

  function init() {
    setupImportTabs();
    setupAccountLinks();
    setupProfileEditToggle();
    setupSavedProfiles();
    setupHomeImport();
    refreshHomeData();
  }

  function refreshHomeData() {
    updateVisitStreak();
    loadProfileToHome();
    renderRecentGames();
    restoreLinkedAccounts();
    refreshChesscomRatings();
    PuzzleController.refreshDailyHomeCard();
  }

  // Profile edit toggle
  function setupProfileEditToggle() {
    var btn = document.getElementById('editProfileToggle');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var viewMode = document.getElementById('profileViewMode');
      var editMode = document.getElementById('profileEditMode');
      if (editMode.style.display === 'none') {
        editMode.style.display = 'block';
        viewMode.style.display = 'none';
        btn.textContent = 'Cancel';
        // Prefill form
        var p = getProfile();
        if (document.getElementById('profileDisplayName')) document.getElementById('profileDisplayName').value = p.displayName || '';
        if (document.getElementById('prefDepth')) document.getElementById('prefDepth').value = p.prefDepth || '20';
      } else {
        editMode.style.display = 'none';
        viewMode.style.display = 'block';
        btn.textContent = 'Edit';
      }
    });
  }

  function getProfile() {
    try { return JSON.parse(localStorage.getItem('kv_profile') || '{}'); } catch(e) { return {}; }
  }

  function getTodayKey() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function dateKeyToLocalDate(dateKey) {
    var parts = (dateKey || '').split('-');
    if (parts.length !== 3) return null;
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
  }

  function getVisitStreak() {
    try {
      var saved = JSON.parse(localStorage.getItem('kv_visit_streak') || '{}');
      return {
        lastVisit: saved.lastVisit || '',
        streak: Math.max(1, parseInt(saved.streak, 10) || 1)
      };
    } catch (e) {
      return { lastVisit: '', streak: 1 };
    }
  }

  function saveVisitStreak(data) {
    try {
      localStorage.setItem('kv_visit_streak', JSON.stringify({
        lastVisit: data.lastVisit,
        streak: data.streak
      }));
    } catch (e) {}
  }

  function updateVisitStreak() {
    var streakData = getVisitStreak();
    var todayKey = getTodayKey();

    if (!streakData.lastVisit) {
      streakData.lastVisit = todayKey;
      streakData.streak = 1;
      saveVisitStreak(streakData);
      return streakData;
    }

    if (streakData.lastVisit === todayKey) {
      return streakData;
    }

    var lastDate = dateKeyToLocalDate(streakData.lastVisit);
    var todayDate = dateKeyToLocalDate(todayKey);
    var daysDiff = lastDate && todayDate ? Math.round((todayDate - lastDate) / 86400000) : 0;

    if (daysDiff === 1) {
      streakData.streak += 1;
    } else {
      streakData.streak = 1;
    }

    streakData.lastVisit = todayKey;
    saveVisitStreak(streakData);
    return streakData;
  }

  function updateStreakUI() {
    var streakData = getVisitStreak();
    var valueEl = document.getElementById('profileStreakValue');
    var labelEl = document.querySelector('#profileStreakRow .profile-streak-label');
    if (valueEl) valueEl.textContent = String(streakData.streak);
    if (labelEl) labelEl.textContent = streakData.streak === 1 ? 'day streak' : 'days streak';
  }

  function loadProfileToHome() {
    var p = getProfile();
    var name = p.displayName || 'Guest';

    // Hero name
    var heroName = document.getElementById('heroName');
    if (heroName) heroName.textContent = name;

    // Navbar
    var navName = document.getElementById('profileName');
    if (navName) navName.textContent = name;

    // Profile view
    var nameView = document.getElementById('profileDisplayNameView');
    if (nameView) nameView.textContent = name;

    // Initials
    var initialsEl = document.getElementById('profileInitials');
    if (initialsEl) {
      var parts = name.trim().split(' ');
      initialsEl.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }

    // Engine/depth
    var evEl = document.getElementById('profileEngineView');
    var dvEl = document.getElementById('profileDepthView');
    if (evEl) evEl.textContent = DEFAULT_ENGINE_LABEL;
    if (dvEl) dvEl.textContent = p.prefDepth || '20';

    // Account chips
    updateAccountChips(p);

    updateStreakUI();

    // Stats
    updateHomeStats();
  }

  function updateAccountChips(p) {
    var ccChip = document.getElementById('chesscomChip');
    var lcChip = document.getElementById('lichessChip');
    var noChip = document.getElementById('noAccountsChip');
    var ccName = document.getElementById('chesscomChipName');
    var lcName = document.getElementById('lichessChipName');

    var hasAny = false;
    if (p.chesscomUsername) {
      if (ccChip) { ccChip.style.display = 'inline-flex'; }
      if (ccName) ccName.textContent = p.chesscomUsername;
      hasAny = true;
    } else {
      if (ccChip) ccChip.style.display = 'none';
    }
    if (p.lichessUsername) {
      if (lcChip) { lcChip.style.display = 'inline-flex'; }
      if (lcName) lcName.textContent = p.lichessUsername;
      hasAny = true;
    } else {
      if (lcChip) lcChip.style.display = 'none';
    }
    if (noChip) noChip.style.display = hasAny ? 'none' : 'inline-flex';
  }

  function updateHomeStats() {
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch(e) {}
    var g = document.getElementById('hmStatGames');
    if (g) g.textContent = db.length;
  }

  function setChesscomRatingsState(values, username) {
    var bulletEl = document.getElementById('hmStatBullet');
    var blitzEl = document.getElementById('hmStatBlitz');
    var rapidEl = document.getElementById('hmStatRapid');
    var userEl = document.getElementById('hmChesscomStatsUser');

    if (bulletEl) bulletEl.textContent = values && values.bullet ? values.bullet : '—';
    if (blitzEl) blitzEl.textContent = values && values.blitz ? values.blitz : '—';
    if (rapidEl) rapidEl.textContent = values && values.rapid ? values.rapid : '—';
    if (userEl) userEl.textContent = username ? '@' + username : 'Not linked';
  }

  function extractChesscomRating(stats, key) {
    if (!stats || !stats[key] || !stats[key].last || typeof stats[key].last.rating !== 'number') {
      return '—';
    }
    return String(stats[key].last.rating);
  }

  function refreshChesscomRatings() {
    var p = getProfile();
    if (!p.chesscomUsername) {
      setChesscomRatingsState(null, '');
      return;
    }
    fetchChesscomRatings(p.chesscomUsername);
  }

  function fetchChesscomRatings(username) {
    var requestId = ++chesscomStatsRequest;
    setChesscomRatingsState({
      bullet: '...',
      blitz: '...',
      rapid: '...'
    }, username);

    var encodedUser = encodeURIComponent(username);
    AppController.fetchChesscomWithFallback(
      '/api/chesscom/player/' + encodedUser + '/stats',
      'https://api.chess.com/pub/player/' + encodedUser + '/stats',
      'json'
    )
      .then(function(stats) {
        if (requestId !== chesscomStatsRequest) return;
        setChesscomRatingsState({
          bullet: extractChesscomRating(stats, 'chess_bullet'),
          blitz: extractChesscomRating(stats, 'chess_blitz'),
          rapid: extractChesscomRating(stats, 'chess_rapid')
        }, username);
      })
      .catch(function(err) {
        console.error('Chess.com stats fetch error:', err);
        if (requestId !== chesscomStatsRequest) return;
        setChesscomRatingsState({
          bullet: '—',
          blitz: '—',
          rapid: '—'
        }, username);
      });
  }

  // Saved Profiles
  function setupSavedProfiles() {
    var addBtn = document.getElementById('addProfileBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var p = getProfile();
        if (!p.displayName) {
          AppController.showToast('Fill in and save your profile first', 'error');
          document.getElementById('editProfileToggle').click();
          return;
        }
        saveCurrentAsProfile(p);
      });
    }
    renderSavedProfilesList();
  }

  function getSavedProfiles() {
    try { return JSON.parse(localStorage.getItem('kv_saved_profiles') || '[]'); } catch(e) { return []; }
  }

  function saveCurrentAsProfile(p, silent) {
    var profiles = getSavedProfiles();
    var existing = profiles.findIndex(function(x) { return x.displayName === p.displayName; });
    var entry = Object.assign({}, p, { savedAt: new Date().toISOString(), id: Date.now() });
    if (existing !== -1) {
      profiles[existing] = entry;
      if (!silent) AppController.showToast('Profile updated', 'success');
    } else {
      profiles.push(entry);
      if (!silent) AppController.showToast('Profile saved!', 'success');
    }
    localStorage.setItem('kv_saved_profiles', JSON.stringify(profiles));
    renderSavedProfilesList();
  }

  function renderSavedProfilesList() {
    var container = document.getElementById('savedProfilesList');
    if (!container) return;
    var profiles = getSavedProfiles();
    var active = getProfile();

    if (!profiles.length) {
      container.innerHTML = '<div class="no-profiles-msg">No saved profiles yet. Edit and save your profile above.</div>';
      return;
    }

    container.innerHTML = profiles.map(function(p) {
      var initials = p.displayName ? p.displayName.substring(0, 2).toUpperCase() : '??';
      var parts = (p.displayName || '').trim().split(' ');
      if (parts.length >= 2) initials = (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
      var isActive = p.displayName === active.displayName;
      var accounts = [p.chesscomUsername ? '&#9823; ' + p.chesscomUsername : '', p.lichessUsername ? '&#9820; ' + p.lichessUsername : ''].filter(Boolean).join(' · ') || 'No linked accounts';
      var meta = 'Stockfish · Depth ' + (p.prefDepth || 20);

      return '<div class="saved-profile-item' + (isActive ? ' active-profile' : '') + '" data-pid="' + p.id + '">' +
        '<div class="sp-avatar">' + initials + '</div>' +
        '<div class="sp-info">' +
          '<div class="sp-name">' + (p.displayName || 'Unnamed') + '</div>' +
          '<div class="sp-meta sp-accounts">Linked: ' + accounts + '</div>' +
          '<div class="sp-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="sp-actions">' +
          '<button class="sp-load-btn" onclick="HomeController.loadProfile(\'' + p.id + '\')">Load</button>' +
          '<button class="sp-del-btn" onclick="HomeController.deleteProfile(\'' + p.id + '\')">✕</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function loadProfileFn(id) {
    var profiles = getSavedProfiles();
    var p = profiles.find(function(x) { return String(x.id) === String(id); });
    if (!p) return;
    localStorage.setItem('kv_profile', JSON.stringify(p));
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    AppController.showToast('Loaded profile: ' + p.displayName, 'success');
  }

  function deleteProfile(id) {
    var profiles = getSavedProfiles().filter(function(x) { return String(x.id) !== String(id); });
    localStorage.setItem('kv_saved_profiles', JSON.stringify(profiles));
    renderSavedProfilesList();
    AppController.showToast('Profile deleted', '');
  }

  // Account Linking
  function setupAccountLinks() {
    // Chess.com
    var linkCC = document.getElementById('linkChesscom');
    if (linkCC) linkCC.addEventListener('click', function() {
      var input = document.getElementById('chesscomUsername');
      var val = normalizeUsername(input ? input.value : '');
      if (!val) { AppController.showToast('Enter a Chess.com username', 'error'); return; }
      if (input) input.value = val;
      linkAccount('chesscom', val);
    });
    var unlinkCC = document.getElementById('unlinkChesscom');
    if (unlinkCC) unlinkCC.addEventListener('click', function() { unlinkAccount('chesscom'); });

    // Lichess
    var linkLC = document.getElementById('linkLichess');
    if (linkLC) linkLC.addEventListener('click', function() {
      var input = document.getElementById('lichessUsername');
      var val = normalizeUsername(input ? input.value : '');
      if (!val) { AppController.showToast('Enter a Lichess username', 'error'); return; }
      if (input) input.value = val;
      linkAccount('lichess', val);
    });
    var unlinkLC = document.getElementById('unlinkLichess');
    if (unlinkLC) unlinkLC.addEventListener('click', function() { unlinkAccount('lichess'); });
    var fetchLC = document.getElementById('fetchLichessGames');
    if (fetchLC) fetchLC.addEventListener('click', function() {
      var p = getProfile();
      if (p.lichessUsername) fetchPlatformGames('lichess', p.lichessUsername);
    });
  }

  function linkAccount(platform, username) {
    username = normalizeUsername(username);
    if (!username) {
      AppController.showToast('Enter a ' + (platform === 'chesscom' ? 'Chess.com' : 'Lichess') + ' username', 'error');
      return;
    }
    var p = getProfile();
    if (platform === 'chesscom') p.chesscomUsername = username;
    else p.lichessUsername = username;
    localStorage.setItem('kv_profile', JSON.stringify(p));
    saveCurrentAsProfile(p, true);
    loadProfileToHome();
    updateAccountUI(platform, username);
    if (platform === 'chesscom') fetchChesscomRatings(username);
    AppController.showToast((platform === 'chesscom' ? 'Chess.com' : 'Lichess') + ' account linked!', 'success');
    fetchPlatformGames(platform, username);
  }

  function unlinkAccount(platform) {
    var p = getProfile();
    if (platform === 'chesscom') { p.chesscomUsername = ''; document.getElementById('chesscomUsername').value = ''; }
    else { p.lichessUsername = ''; document.getElementById('lichessUsername').value = ''; }
    localStorage.setItem('kv_profile', JSON.stringify(p));
    saveCurrentAsProfile(p, true);
    loadProfileToHome();
    updateAccountUI(platform, null);
    if (platform === 'chesscom') setChesscomRatingsState(null, '');
    var gList = document.getElementById(platform + 'GamesList');
    if (gList) gList.innerHTML = '';
    AppController.showToast('Account unlinked', '');
  }

  function updateAccountUI(platform, username) {
    var statusEl = document.getElementById(platform + 'Status');
    var linkedInfo = document.getElementById(platform + 'LinkedInfo');
    var linkedName = document.getElementById(platform + 'LinkedName');
    var inputRow = document.querySelector(platform === 'chesscom' ? '#chesscomUsername' : '#lichessUsername');

    if (username) {
      if (statusEl) { statusEl.textContent = 'Linked'; statusEl.classList.add('linked'); }
      if (linkedInfo) linkedInfo.style.display = 'block';
      if (linkedName) linkedName.textContent = '@' + username;
      if (inputRow) inputRow.value = '';
      if (inputRow) inputRow.placeholder = 'Linked: ' + username;
    } else {
      if (statusEl) { statusEl.textContent = 'Not linked'; statusEl.classList.remove('linked'); }
      if (linkedInfo) linkedInfo.style.display = 'none';
      if (inputRow) inputRow.placeholder = (platform === 'chesscom' ? 'Chess.com' : 'Lichess') + ' username...';
    }
  }

  function restoreLinkedAccounts() {
    var p = getProfile();
    if (p.chesscomUsername) {
      document.getElementById('chesscomUsername').value = p.chesscomUsername;
      updateAccountUI('chesscom', p.chesscomUsername);
    }
    if (p.lichessUsername) {
      document.getElementById('lichessUsername').value = p.lichessUsername;
      updateAccountUI('lichess', p.lichessUsername);
    }
  }

  function isGameReviewed(white, black, result) {
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch(e) {}
    return db.some(function(g) {
      return g.white === white && g.black === black && g.result === result;
    });
  }

  function normalizeUsername(raw) {
    return String(raw || '').trim().replace(/^@+/, '');
  }

  function getYesterdayArchiveDate() {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      year: yesterday.getFullYear(),
      month: String(yesterday.getMonth() + 1).padStart(2, '0'),
      day: String(yesterday.getDate()).padStart(2, '0')
    };
  }

  function resolveChesscomUsername(preferredUsername) {
    var candidates = [
      preferredUsername,
      (document.getElementById('gamesTabUser') || {}).textContent,
      window._ccFetchedUsername,
      (document.getElementById('chesscomLinkedName') || {}).textContent,
      (document.getElementById('chesscomUsername') || {}).value,
      getProfile().chesscomUsername
    ];

    for (var i = 0; i < candidates.length; i++) {
      var username = normalizeUsername(candidates[i]);
      if (username) return username;
    }
    return '';
  }

  function fetchLatestChesscomGames(preferredUsername) {
    var username = resolveChesscomUsername(preferredUsername);
    if (!username) {
      AppController.showToast('Link or enter a Chess.com username first', 'error');
      return;
    }
    AppController.switchToTab('games');
    fetchChesscomGames(username, getYesterdayArchiveDate());
  }

  function fetchHomeChesscomGames(preferredUsername) {
    fetchLatestChesscomGames(preferredUsername);
  }

  function getCurrentChesscomArchiveKey(username, archiveOverride) {
    var archive = archiveOverride || getYesterdayArchiveDate();
    return normalizeUsername(username) + ':' + archive.year + '-' + archive.month;
  }

  // ===== CHESS.COM GAMES FETCH (Games Tab) =====
  function setupGamesTab() {
    var filterSelect = document.getElementById('gamesTabFilterSelect');
    if (filterSelect) {
      filterSelect.addEventListener('change', function() {
        setGamesTabFilter(this.value || 'all');
      });
    }
  }

  function refreshGamesTab() {
    var username = resolveChesscomUsername();
    var controls = document.getElementById('gamesTabControls');
    var filters = document.getElementById('gamesTabFilters');
    var sub = document.getElementById('gamesTabSub');
    var userEl = document.getElementById('gamesTabUser');
    if (username) {
      var archive = window._ccFetchedArchivePeriod || getYesterdayArchiveDate();
      if (controls) controls.style.display = 'flex';
      if (filters) filters.style.display = 'flex';
      if (sub) sub.textContent = 'Showing games for ' + username + ' from ' + archive.year + '/' + archive.month;
      if (userEl) userEl.textContent = '@' + username;
    } else {
      if (controls) controls.style.display = 'none';
      if (filters) filters.style.display = 'none';
      if (sub) sub.textContent = 'Link your Chess.com account on the Home tab, then click Fetch Games.';
    }
    if (window._ccFetchedGames && window._ccFetchedGames.length && username) {
      var container = document.getElementById('gamesTabList');
      if (container) renderGamesTab(container, window._ccFetchedGames, username);
    }
  }

  function getChesscomGameWhiteName(game) {
    if (!game) return 'White';
    if (game.white && game.white.username) return game.white.username;
    return game.white || 'White';
  }

  function getChesscomGameBlackName(game) {
    if (!game) return 'Black';
    if (game.black && game.black.username) return game.black.username;
    return game.black || 'Black';
  }

  function getChesscomGameWhiteRating(game) {
    if (!game) return '?';
    if (game.white && game.white.rating) return game.white.rating;
    return game.whiteElo || '?';
  }

  function getChesscomGameBlackRating(game) {
    if (!game) return '?';
    if (game.black && game.black.rating) return game.black.rating;
    return game.blackElo || '?';
  }

  function getChesscomGameResult(game) {
    if (!game) return '*';
    if (game.result) return game.result;
    var whiteResult = game.white ? String(game.white.result || '').toLowerCase() : '';
    if (whiteResult === 'win') return '1-0';
    if (whiteResult === 'checkmated' || whiteResult === 'resigned' || whiteResult === 'timeout' || whiteResult === 'abandoned' || whiteResult === 'lose') {
      return '0-1';
    }
    return '½-½';
  }

  function getChesscomGameTimeClass(game) {
    if (!game) return 'rapid';
    if (game.time_class) return game.time_class;
    var timeControl = String(game.timeControl || '').trim();
    if (!timeControl) return 'rapid';
    if (timeControl.indexOf('/') !== -1) return 'daily';
    var base = parseInt(timeControl.split('+')[0], 10);
    if (isNaN(base)) return 'rapid';
    if (base < 180) return 'bullet';
    if (base < 600) return 'blitz';
    return 'rapid';
  }

  function getChesscomGameDisplayDate(game) {
    if (!game) return '';
    var date = null;
    if (game.end_time) {
      date = new Date(game.end_time * 1000);
    } else {
      var headers = game.headers || {};
      var dateText = headers.EndDate || game.date || headers.Date || '';
      var timeText = headers.EndTime || '00:00:00';
      if (dateText) {
        date = new Date(dateText.replace(/\./g, '-') + 'T' + timeText + 'Z');
      }
    }
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fetchChesscomGames(username, archiveOverride) {
    username = String(username || '').trim().replace(/^@+/, '');
    var container = document.getElementById('gamesTabList');
    if (!container) return;
    var archive = archiveOverride || getYesterdayArchiveDate();
    var controls = document.getElementById('gamesTabControls');
    var filters = document.getElementById('gamesTabFilters');
    var sub = document.getElementById('gamesTabSub');
    var userEl = document.getElementById('gamesTabUser');
    if (controls) controls.style.display = 'flex';
    if (filters) filters.style.display = 'flex';
    if (sub) sub.textContent = 'Showing games for ' + username + ' from ' + archive.year + '/' + archive.month;
    if (userEl) userEl.textContent = '@' + username;
    AppController.renderFetchSkeleton(container, 'Fetching games for ' + username + '...');

    var archiveKey = getCurrentChesscomArchiveKey(username, archive);
    window._ccLastRequestedArchiveKey = archiveKey;
    fetchChesscomGamesFromArchive(username, archive)
      .then(function(games) {
        if (!games.length) {
          container.innerHTML = '<div class="no-games">No games found for this month. Try playing some games first!</div>';
          return;
        }
        window._ccFetchedGames = games;
        window._ccFetchedUsername = username;
        window._ccFetchedArchiveKey = getCurrentChesscomArchiveKey(username, archive);
        window._ccFetchedArchivePeriod = { year: archive.year, month: archive.month };
        if (sub) sub.textContent = 'Showing games for ' + username + ' from ' + archive.year + '/' + archive.month;
        renderGamesTab(container, games, username);
      })
      .catch(function(err) {
        console.error('Chess.com fetch error:', err);
        container.innerHTML = '<div class="no-games">' +
          AppController.describeChesscomError(err, username, archive.year + '-' + archive.month) + '</div>';
      });
  }

  function fetchChesscomGamesFromArchive(username, archive) {
    return AppController.fetchChesscomMonthPgn(username, archive.year, archive.month)
      .then(function(text) {
        return AppController.parseChesscomArchiveGames(text, 20) || [];
      });
  }

  function renderHomeChesscomGames(container, games, username, archive) {
    var intro = '<div class="games-count">' + games.length + ' game' + (games.length !== 1 ? 's' : '') +
      ' from ' + archive.year + '/' + archive.month + '</div>';
    var rows = games.map(function(g, idx) {
      var white = getChesscomGameWhiteName(g);
      var black = getChesscomGameBlackName(g);
      var result = getChesscomGameResult(g);
      var resultClass = result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d';
      var opening = g.opening || g.eco || '';
      var date = getChesscomGameDisplayDate(g) || g.date || '';
      return '<div class="fetch-game-item" data-cc-idx="' + idx + '" onclick="HomeController.loadChesscomGame(' + idx + ')">' +
        '<strong>' + white + '</strong> vs <strong>' + black + '</strong>' +
        (opening ? ' — ' + opening.substring(0, 28) : '') +
        '<span class="fetch-game-result ' + resultClass + '">' + result + '</span>' +
        (date ? '<div class="fetch-game-date">' + date + '</div>' : '') +
      '</div>';
    }).join('');
    container.innerHTML = intro + rows;
  }

  function renderGamesTab(container, games, username) {
    var filter = getGamesTabFilter();
    updateGamesTabFilterUI(filter);
    var items = games.map(function(g, idx) {
      var white = getChesscomGameWhiteName(g);
      var black = getChesscomGameBlackName(g);
      var whiteRating = getChesscomGameWhiteRating(g);
      var blackRating = getChesscomGameBlackRating(g);
      var result = getChesscomGameResult(g);
      var resultClass = result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d';
      var isUserWhite = white.toLowerCase() === username.toLowerCase();
      var userWon = (result === '1-0' && isUserWhite) || (result === '0-1' && !isUserWhite);
      var userLost = (result === '0-1' && isUserWhite) || (result === '1-0' && !isUserWhite);
      var outcomeClass = userWon ? 'outcome-win' : userLost ? 'outcome-loss' : 'outcome-draw';
      var outcomeText = userWon ? 'Won' : userLost ? 'Lost' : 'Draw';
      var reviewed = isGameReviewed(white, black, result);
      var timeClass = getChesscomGameTimeClass(g);
      var dateStr = getChesscomGameDisplayDate(g);

      return {
        idx: idx,
        userWon: userWon,
        userLost: userLost,
        reviewed: reviewed,
        outcomeText: outcomeText,
        html: '<div class="gt-game-row ' + outcomeClass + (reviewed ? ' game-reviewed' : '') + '" data-cc-idx="' + idx + '">' +
        '<div class="gt-review-icon">' + (reviewed ? '&#10003;' : '') + '</div>' +
        '<div class="gt-game-main">' +
          '<div class="gt-players">' +
            '<span class="gt-white">' + white + ' <span class="gt-rating">(' + whiteRating + ')</span></span>' +
            '<span class="gt-vs">vs</span>' +
            '<span class="gt-black">' + black + ' <span class="gt-rating">(' + blackRating + ')</span></span>' +
          '</div>' +
          '<div class="gt-meta">' +
            '<span class="gt-time-badge gt-tc-' + timeClass + '">' + timeClass + '</span>' +
            '<span class="gt-date">' + dateStr + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="gt-result-col">' +
          '<span class="gt-outcome ' + outcomeClass + '">' + outcomeText + '</span>' +
        '</div>' +
        '<div class="gt-actions">' +
          '<button class="gt-btn gt-btn-analyze" onclick="HomeController.loadChesscomGame(' + idx + ')">Analyze</button>' +
          '<button class="gt-btn gt-btn-share" onclick="HomeController.shareGame(' + idx + ')">Share</button>' +
        '</div>' +
      '</div>'
      };
    });

    var filteredItems = items.filter(function(item) {
      if (filter === 'win') return item.userWon;
      if (filter === 'lost') return item.userLost;
      if (filter === 'draw') return !item.userWon && !item.userLost;
      if (filter === 'reviewed') return item.reviewed;
      if (filter === 'not-reviewed') return !item.reviewed;
      return true;
    });

    var header = '<div class="games-count">' + filteredItems.length + ' of ' + games.length + ' game' + (games.length !== 1 ? 's' : '') + ' this month <span class="games-legend">&#10003; reviewed</span></div>';
    var rows = filteredItems.length
      ? filteredItems.map(function(item) { return item.html; }).join('')
      : '<div class="no-games">No games match the selected filter.</div>';

    container.innerHTML = header + rows;
  }

  function getGamesTabFilter() {
    return window._gamesTabFilter || 'all';
  }

  function setGamesTabFilter(filter) {
    window._gamesTabFilter = filter || 'all';
    updateGamesTabFilterUI(window._gamesTabFilter);
    var container = document.getElementById('gamesTabList');
    var games = window._ccFetchedGames || [];
    var username = window._ccFetchedUsername || (getProfile().chesscomUsername || '');
    if (container && games.length && username) {
      renderGamesTab(container, games, username);
    }
  }

  function updateGamesTabFilterUI(activeFilter) {
    var filterSelect = document.getElementById('gamesTabFilterSelect');
    if (filterSelect) filterSelect.value = activeFilter || 'all';
  }

  // ===== Fetch button on Home goes to Games tab =====
  function fetchPlatformGames(platform, username) {
    if (platform === 'chesscom') {
      var resolvedUsername = resolveChesscomUsername(username);
      if (!resolvedUsername) {
        AppController.showToast('Link or enter a Chess.com username first', 'error');
        return;
      }
      fetchHomeChesscomGames(resolvedUsername);
    } else if (platform === 'lichess') {
      var container = document.getElementById('lichessGamesList');
      if (!container) return;
      container.innerHTML = '<div class="no-games" style="padding:8px;font-size:.7rem"><span class="spinner"></span> Fetching...</div>';
      var encodedUser = encodeURIComponent(username);
      var proxyUrl = '/api/lichess/user/' + encodedUser + '/games?max=8&clocks=false&evals=false&opening=true';
      var directUrl = 'https://lichess.org/api/games/user/' + encodedUser + '?max=8&clocks=false&evals=false&opening=true';
      AppController.fetchTextWithFallback(proxyUrl, directUrl, { Accept: 'application/x-ndjson' })
        .then(function(text) {
          var lines = text.trim().split('\n').filter(function(l) { return l.trim(); });
          var games = [];
          lines.forEach(function(line) { try { games.push(JSON.parse(line)); } catch(e) {} });
          renderLichessGames(container, games);
        })
        .catch(function(err) {
          container.innerHTML = '<div class="no-games" style="font-size:.7rem;padding:8px;">' + AppController.describeLichessError(err, username) + '</div>';
        });
    }
  }

  function renderLichessGames(container, games) {
    if (!games.length) {
      container.innerHTML = '<div class="no-games" style="font-size:.7rem;padding:8px;">No recent games found.</div>';
      return;
    }
    container.innerHTML = games.map(function(g) {
      var white = g.players && g.players.white && g.players.white.user ? g.players.white.user.name : 'White';
      var black = g.players && g.players.black && g.players.black.user ? g.players.black.user.name : 'Black';
      var result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '½-½';
      var gameId = g.id || '';

      return '<div class="fetch-game-item" data-id="' + gameId + '" data-platform="lichess" onclick="HomeController.loadPlatformGame(this)" style="font-size:.7rem">' +
        '<span>' + white + ' vs ' + black + '</span>' +
        '<span class="fetch-game-result ' + (result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d') + '" style="float:right">' + result + '</span>' +
        '</div>';
    }).join('');
  }

  function loadPlatformGame(el) {
    var platform = el.getAttribute('data-platform');
    var pgn = el.getAttribute('data-pgn');
    var id = el.getAttribute('data-id');
    if (pgn) {
      AppController.loadPGNAndReviewExternal(decodeURIComponent(pgn));
    } else if (id && platform === 'lichess') {
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(id) + '/export?clocks=false&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(id) + '?clocks=false&evals=false';
      AppController.fetchTextWithFallback(proxyUrl, directUrl)
        .then(function(p) { if (p) AppController.loadPGNAndReviewExternal(p); });
    }
  }

  function loadChesscomGame(idx) {
    var games = window._ccFetchedGames;
    if (!games || !games[idx]) return;
    var game = games[idx];
    var pgn = game.pgn || '';
    if (pgn) {
      AppController.loadPGNAndReviewExternal(pgn, {
        sourceGame: game,
        sourcePlatform: 'chesscom'
      });
      // Mark as reviewed in the list
      var item = document.querySelector('.gt-game-row[data-cc-idx="' + idx + '"]');
      if (item) {
        item.classList.add('game-reviewed');
        var icon = item.querySelector('.gt-review-icon');
        if (icon) icon.innerHTML = '&#10003;';
      }
      var container = document.getElementById('gamesTabList');
      var username = window._ccFetchedUsername || (getProfile().chesscomUsername || '');
      if (container && username) {
        renderGamesTab(container, games, username);
      }
    }
  }

  function shareGame(idx) {
    var games = window._ccFetchedGames;
    if (!games || !games[idx]) return;
    var game = games[idx];
    var white = getChesscomGameWhiteName(game);
    var black = getChesscomGameBlackName(game);
    var pgn = game.pgn || '';
    var analyzeLink = AppController.createAnalyzeLinkForPGN(pgn);

    if (!analyzeLink && !pgn) {
      AppController.showToast('No shareable game data found', 'error');
      return;
    }

    if (navigator.share && analyzeLink) {
      navigator.share({
        title: white + ' vs ' + black,
        text: 'Open this game directly in chess ramp review.',
        url: analyzeLink
      }).catch(function() {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(analyzeLink || pgn).then(function() {
        AppController.showToast('Analyze link copied!', 'success');
      }).catch(function() {
        AppController.showToast('Could not copy', 'error');
      });
    }
  }

  // Import Tabs on Home
  function setupImportTabs() {
    document.querySelectorAll('.iht').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var parent = this.closest('.home-card');
        parent.querySelectorAll('.iht').forEach(function(t) { t.classList.remove('active'); });
        parent.querySelectorAll('.ihs').forEach(function(s) { s.classList.remove('active'); });
        this.classList.add('active');
        var method = this.getAttribute('data-imethod');
        var sec = document.getElementById('ihs-' + method);
        if (sec) sec.classList.add('active');
      });
    });
  }

  // Home Import Buttons
  function setupHomeImport() {
    var loadPgn = document.getElementById('homeLoadPGN');
    if (loadPgn) loadPgn.addEventListener('click', function() {
      var pgn = document.getElementById('homePgnInput').value.trim();
      if (pgn) AppController.loadPGNFromExternal(pgn);
      else AppController.showToast('Paste PGN first', 'error');
    });

    var loadFen = document.getElementById('homeLoadFen');
    if (loadFen) loadFen.addEventListener('click', function() {
      var fen = document.getElementById('homeFenInput').value.trim();
      if (fen) { AppController.loadFenFromExternal(fen); }
      else AppController.showToast('Enter a FEN string', 'error');
    });

    var loadUrl = document.getElementById('homeLoadUrl');
    if (loadUrl) loadUrl.addEventListener('click', function() {
      var url = document.getElementById('homeUrlInput').value.trim();
      if (url) AppController.loadFromURLExternal(url);
      else AppController.showToast('Enter a URL', 'error');
    });

    var dropZone = document.getElementById('homeFileDropZone');
    var fileInput = document.getElementById('homeFileInput');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', function() { fileInput.click(); });
      dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
      dropZone.addEventListener('drop', function(e) {
        e.preventDefault(); this.classList.remove('dragover');
        if (e.dataTransfer.files[0]) AppController.readPGNFileExternal(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', function() {
        if (this.files[0]) AppController.readPGNFileExternal(this.files[0]);
      });
    }
  }

  // Recent Games on Home
  function renderRecentGames() {
    var container = document.getElementById('homeRecentGames');
    if (!container) return;
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch(e) {}
    if (!db.length) {
      container.innerHTML = '<div class="no-games">No games yet. Import a game to get started.</div>';
      return;
    }
    container.innerHTML = db.slice(0, 6).map(function(g) {
      var resClass = g.result === '1-0' ? 'white-win' : g.result === '0-1' ? 'black-win' : 'draw';
      return '<div class="home-game-item" onclick="AppController.loadDbGame(\'' + g.id + '\')">' +
        '<div class="sp-info">' +
          '<div class="hgi-players">' + (g.white || '?') + ' vs ' + (g.black || '?') + '</div>' +
          '<div class="hgi-meta">' + ((g.opening || '').substring(0, 28) || 'Unknown opening') + ' · ' + (g.date || '').substring(0, 10) + '</div>' +
        '</div>' +
        '<span class="hgi-result ' + resClass + '">' + (g.result || '*') + '</span>' +
        '<button class="hgi-analyze-btn" onclick="event.stopPropagation();AppController.loadDbGame(\'' + g.id + '\')">Analyze</button>' +
        '</div>';
    }).join('');
  }

  return {
    init: init,
    refreshHomeData: refreshHomeData,
    setupGamesTab: setupGamesTab,
    refreshGamesTab: refreshGamesTab,
    fetchLatestChesscomGames: fetchLatestChesscomGames,
    fetchHomeChesscomGames: fetchHomeChesscomGames,
    loadPlatformGame: loadPlatformGame,
    loadChesscomGame: loadChesscomGame,
    shareGame: shareGame,
    loadProfile: loadProfileFn,
    deleteProfile: deleteProfile,
    renderRecentGames: renderRecentGames,
    saveCurrentAsProfile: saveCurrentAsProfile
  };
})();

// ===== PATCH AppController to expose new methods =====
(function() {
  var origInit = AppController.init;
  AppController.init = function() {
    origInit.call(this);
    HomeController.init();
    HomeController.setupGamesTab();
  };

  AppController.loadPGNFromExternal = function(pgn, options) {
    AppController.loadPGNPublic(pgn, options);
    AppController.switchToTab('analyze');
  };

  AppController.loadPGNAndReviewExternal = function(pgn, options) {
    AppController.loadPGNPublic(pgn, options);
    AppController.switchToTab('analyze');
    setTimeout(function() {
      var btn = document.getElementById('analyzeFullGame');
      if (btn && !btn.disabled) btn.click();
    }, 120);
  };

  AppController.loadFenFromExternal = function(fen) {
    AppController.loadFenPublic(fen);
    AppController.switchToTab('analyze');
  };

  AppController.loadFromURLExternal = function(url) {
    AppController.loadFromURLPublic(url);
    AppController.switchToTab('analyze');
  };

  AppController.readPGNFileExternal = function(file) {
    AppController.readPGNFilePublic(file);
    AppController.switchToTab('analyze');
  };
})();

export { HomeController };
export default AppController;
