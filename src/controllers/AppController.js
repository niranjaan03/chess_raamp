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
import { bind, bindClick, escapeAttr, escapeHtml, getEl, setText } from '../utils/dom.js';

const RAW_GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID)
  ? import.meta.env.VITE_GOOGLE_CLIENT_ID
  : '';
const APP_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '/';
const CLEAN_APP_BASE_URL = (!APP_BASE_URL || APP_BASE_URL === '/') ? '' : APP_BASE_URL.replace(/\/$/, '');
const DEFAULT_ENGINE_ID = 'sf18';
const DEFAULT_ENGINE_LABEL = 'Stockfish 18';
const REVIEW_PIECE_ASSET_PATHS = {
  wP: 'Chess_plt45.svg',
  wN: 'Chess_nlt45.svg',
  wB: 'Chess_blt45.svg',
  wR: 'Chess_rlt45.svg',
  wQ: 'Chess_qlt45.svg',
  wK: 'Chess_klt45.svg',
  bP: 'Chess_pdt45.svg',
  bN: 'Chess_ndt45.svg',
  bB: 'Chess_bdt45.svg',
  bR: 'Chess_rdt45.svg',
  bQ: 'Chess_qdt45.svg',
  bK: 'Chess_kdt45.svg'
};
const REVIEW_PIECE_ORDER = ['q', 'r', 'n', 'b', 'p'];
const REVIEW_PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const AppController = (function() {
  var chess = null;
  var gamePositions = [];
  var currentMoveIndex = 0;
  var currentGame = null;
  var autoPlayInterval = null;
  var autoPlayActive = false;
  var autoPlayDelay = 1200;
  var profile = {};
  var authSession = null;
  var gameDatabase = [];
  var analysisMode = true;
  var lastAnalysisHistory = null;
  var lastAnalysisCounts = null;
  var activeReviewTab = 'report';
  var currentReviewCandidates = [];
  var reviewReplayState = null;
  var feedbackCategory = 'feature';
  var authMode = 'signin';
  var DEFAULT_MOVE_DESC = 'Run a full game review to see brilliance, inaccuracies, and more for each move.';
  var DEFAULT_COACH_TEXT = 'Run a full analysis to unlock personalized move-by-move coaching.';
  var COACH_COMMENTARY_URL = APP_BASE_URL.replace(/\/?$/, '/') + 'data/chess_commentary_cleaned_combined.json';
  var lastCoachSummary = DEFAULT_COACH_TEXT;
  var coachCommentaryPromise = null;
  var coachCommentaryStore = null;
  var coachCommentaryRequestId = 0;
  var AUTH_ACCOUNTS_KEY = 'kv_auth_accounts';
  var AUTH_SESSION_KEY = 'kv_auth_session';
  var GOOGLE_AUTH_STATE_KEY = 'kv_google_auth_state';
  var GOOGLE_AUTH_NONCE_KEY = 'kv_google_auth_nonce';
  var GOOGLE_CLIENT_ID = RAW_GOOGLE_CLIENT_ID || '';
  var COLOR_MODE_KEY = 'kv_color_mode';
  var currentTab = 'home';
  var tabHistoryReady = false;
  var homeDailyCalendarBound = false;
  var PlayerAnalyzeController = null;
  var playerAnalyzeControllerPromise = null;
  var TAB_ROUTE_MAP = {
    home: '/home',
    analyze: '/analyze',
    import: '/import',
    games: '/games',
    'player-analyze': '/player-analyze',
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
    updateAnalyzePlayerInfo(null, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    EngineController.init();
    SoundController.init();
    
    setupEventListeners();
    setupAuth();
    setupTabNavigation();
    setupBrowserTabHistory();
    setupCoordinates();
    setupCoachTimelineInteractions();
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
    } catch { /* history API unavailable */ }
    window.addEventListener('popstate', function(event) {
      var historyTab = getTabFromPath(window.location.pathname) || getTabFromHistoryState(event.state) || 'home';
      switchTab(historyTab, { fromHistory: true });
    });
  }

  function getTabFromPath(pathname) {
    var path = String(pathname || '').trim();
    if (!path || path === '/') return 'home';
    var clean = path.replace(/\/+$/, '') || '/';
    if (clean === TAB_ROUTE_MAP.openings || clean.indexOf(TAB_ROUTE_MAP.openings + '/') === 0) return 'openings';
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
    var currentPath = String(window.location.pathname || '').replace(/\/+$/, '') || '/';
    var isOpeningSubroute = safeTab === 'openings' && currentPath.indexOf(TAB_ROUTE_MAP.openings + '/') === 0;
    var nextUrl = (replace && isOpeningSubroute ? currentPath : getRouteForTab(safeTab)) + getSearchForTab(safeTab);
    try {
      if (replace) window.history.replaceState(state, document.title, nextUrl);
      else window.history.pushState(state, document.title, nextUrl);
    } catch { /* restricted environment – history API blocked */ }
  }

  function loadPlayerAnalyzeController() {
    if (PlayerAnalyzeController) return Promise.resolve(PlayerAnalyzeController);
    if (!playerAnalyzeControllerPromise) {
      playerAnalyzeControllerPromise = import('./PlayerAnalyzeController.js').then(function(module) {
        PlayerAnalyzeController = module.default;
        if (typeof window !== 'undefined') {
          window.PlayerAnalyzeController = PlayerAnalyzeController;
        }
        return PlayerAnalyzeController;
      });
    }
    return playerAnalyzeControllerPromise;
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
        syncAnalyzeBoardInteraction();
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
    if (tab === 'player-analyze') {
      loadPlayerAnalyzeController()
        .then(function(controller) {
          if (controller && typeof controller.init === 'function') {
            controller.init();
          }
        })
        .catch(function(err) {
          console.error('Failed to load player analyze:', err);
          showToast('Failed to load player analysis', 'error');
        });
    }
  }

  function syncAnalyzeBoardInteraction() {
    var reviewIsLoaded = !!(currentGame && gamePositions && gamePositions.length > 1);
    var replay = reviewReplayState && reviewReplayState.active ? reviewReplayState : null;
    ChessBoard.setOptions({
      interactionColor: replay && replay.moveInfo ? replay.moveInfo.color : '',
      allowedMoves: [],
      interactive: replay ? true : !reviewIsLoaded
    });
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
    authSession = session || null;
    try {
      if (authSession) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));
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
      localStorage.setItem('kv_profile', JSON.stringify(profile));
    } catch { /* storage full */ }
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
    } catch { /* sessionStorage blocked in restricted environments */ }

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
    bindClick('btnFirst', goFirst);
    bindClick('btnPrev', goPrev);
    bindClick('btnPlay', toggleAutoPlay);
    bindClick('btnNext', goNext);
    bindClick('btnLast', goLast);
    bindClick('btnFlip', flipBoard);
    bindClick('grReviewBestBtn', showReviewBestMove);
    bindClick('grReviewTryAgainBtn', startReviewTryAgain);
    bindClick('grReviewNextBtn', handleReviewFeedbackNext);

    // FEN
    bindClick('loadFen', loadFenPosition);
    bind('fenInput', 'keydown', function(e) {
      if (e.key === 'Enter') loadFenPosition();
    });

    // Engine settings
    bind('depthSlider', 'input', function() {
      setText('depthVal', this.value);
      EngineController.setDepth(parseInt(this.value));
      startAnalysis();
    });

    bind('analysisMode', 'change', function() {
      analysisMode = this.checked;
      if (analysisMode) startAnalysis();
      else EngineController.stop();
    });

    bind('threadsSlider', 'input', function() {
      setText('threadsVal', this.value);
      EngineController.setOption('Threads', parseInt(this.value));
    });

    bind('hashSlider', 'input', function() {
      setText('hashVal', this.value);
      EngineController.setOption('Hash', parseInt(this.value));
    });

    bindClick('analyzeFullGame', analyzeFullGame);
    setupReviewTabs();

    // Board appearance
    bind('boardTheme', 'change', function() {
      applyBoardThemeSelection(this.value);
    });
    bind('settingsColorMode', 'change', function() {
      applyColorModeSelection(this.value);
    });
    bind('pieceStyle', 'change', function() {
      applyPieceStyleSelection(this.value);
    });
    bind('settingsBoardTheme', 'change', function() {
      applyBoardThemeSelection(this.value);
    });
    bind('settingsPieceStyle', 'change', function() {
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
    bind('showArrows', 'change', function() {
      ChessBoard.setOptions({showArrows: this.checked});
    });
    bind('showCoords', 'change', function() {
      ChessBoard.setOptions({showCoordinates: this.checked});
    });
    bind('highlightLast', 'change', function() {
      ChessBoard.setOptions({highlightLast: this.checked});
    });
    bind('settingsMoveSound', 'change', function() {
      applyMoveSoundSelection(this.checked, true);
    });
    bind('settingsSoundStyle', 'change', function() {
      applySoundStyleSelection(this.value);
    });
    bindClick('settingsSoundStyle', function(e) {
      var button = e.target.closest('[data-target="settingsSoundStyle"]');
      if (button) {
        var value = button.getAttribute('data-value');
        var select = document.getElementById('settingsSoundStyle');
        if (select) {
          select.value = value;
          applySoundStyleSelection(value);
        }
      }
    });
    bind('reviewBoardTheme', 'change', function() {
      applyBoardThemeSelection(this.value);
    });
    bind('reviewPieceStyle', 'change', function() {
      applyPieceStyleSelection(this.value);
    });
    bind('reviewShowArrows', 'change', function() {
      ChessBoard.setOptions({showArrows: this.checked});
    });
    bind('reviewShowCoords', 'change', function() {
      ChessBoard.setOptions({showCoordinates: this.checked});
    });
    bind('reviewHighlightLast', 'change', function() {
      ChessBoard.setOptions({highlightLast: this.checked});
    });
    bind('reviewMoveSound', 'change', function() {
      applyMoveSoundSelection(this.checked, true);
    });
    bindClick('reviewFlipBoard', flipBoard);
    bind('reviewAutoplaySpeed', 'input', function() {
      autoPlayDelay = parseInt(this.value, 10) || 1200;
      setText('reviewAutoplaySpeedVal', (autoPlayDelay / 1000).toFixed(1) + 's');
      if (autoPlayActive) {
        stopAutoPlay();
        startAutoPlay();
      }
    });

    // Copy PGN / FEN
    bindClick('copyPGN', function() {
      var pgn = chess.pgn();
      copyToClipboard(pgn);
      showToast('PGN copied!', 'success');
    });
    bindClick('copyFENBtn', function() {
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
        var section = getEl('import-' + type);
        if (section) section.classList.add('active');
      });
    });

    bindClick('loadPGN', function() {
      var pgnInput = getEl('pgnInput');
      var pgn = pgnInput ? pgnInput.value : '';
      if (pgn.trim()) {
        loadPGNGame(pgn);
        switchTab('analyze');
      }
    });

    var dropZone = document.getElementById('fileDropZone');
    var fileInput = document.getElementById('fileInput');
    
    if (dropZone && fileInput) {
      bindClick(dropZone, function() { fileInput.click(); });
      bind(dropZone, 'dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
      bind(dropZone, 'dragleave', function() { this.classList.remove('dragover'); });
      bind(dropZone, 'drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        var file = e.dataTransfer.files[0];
        if (file) readPGNFile(file);
      });
      bind(fileInput, 'change', function() {
        if (this.files[0]) readPGNFile(this.files[0]);
      });
    }

    bindClick('loadFenImport', function() {
      var fenInput = getEl('fenImportInput');
      var fen = fenInput ? fenInput.value : '';
      if (fen.trim()) { loadFenGame(fen); switchTab('analyze'); }
    });

    bindClick('loadURL', loadFromURL);

    // Fetch games
    bindClick('fetchGamesBtn', fetchGames);

    // Profile
    bindClick('saveProfile', saveProfile);
    bindClick('openDailyPuzzleHome', openDailyPuzzleCalendar);
    bindClick('homeDailyPuzzleDate', openDailyPuzzleCalendar);
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

    // Database search
    bind('dbSearch', 'input', function() {
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
  function syncAnalyzeCoordinates(flipped) {
    var rankEl = document.getElementById('rankCoords');
    var fileEl = document.getElementById('fileCoords');
    var ranks = flipped ? '12345678' : '87654321';
    var files = flipped ? 'hgfedcba' : 'abcdefgh';
    if (rankEl) rankEl.innerHTML = ranks.split('').map(function(r) { return '<span>' + r + '</span>'; }).join('');
    if (fileEl) fileEl.innerHTML = files.split('').map(function(f) { return '<span>' + f + '</span>'; }).join('');
  }

  function setupCoordinates() {
    syncAnalyzeCoordinates(false);
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
        syncSelectValue(['boardTheme', 'settingsBoardTheme', 'reviewBoardTheme'], savedBoardTheme);
        ChessBoard.setTheme(savedBoardTheme);
      } else {
        syncSelectValue(['boardTheme', 'settingsBoardTheme', 'reviewBoardTheme'], 'blue');
        ChessBoard.setTheme('blue');
      }
      var savedPieceStyle = localStorage.getItem('kv_piece_style');
      if (savedPieceStyle) {
        syncSelectValue(['pieceStyle', 'settingsPieceStyle', 'reviewPieceStyle'], savedPieceStyle);
        ChessBoard.setPieceStyle(savedPieceStyle);
      }
      var savedSoundStyle = localStorage.getItem('kv_move_sound_style');
      var soundButtons = document.querySelectorAll('[data-target="settingsSoundStyle"]');
      if (savedSoundStyle) {
        syncSelectValue(['settingsSoundStyle'], savedSoundStyle);
        soundButtons.forEach(function(btn) {
          btn.classList.toggle('active', btn.getAttribute('data-value') === savedSoundStyle);
        });
        SoundController.setSoundStyle(savedSoundStyle);
      } else {
        syncSelectValue(['settingsSoundStyle'], 'classic');
        soundButtons.forEach(function(btn) {
          btn.classList.toggle('active', btn.getAttribute('data-value') === 'classic');
        });
      }
      syncToggleValue('settingsMoveSound', SoundController.isEnabled());
      syncToggleValue('reviewMoveSound', SoundController.isEnabled());
    } catch { /* corrupt settings – use defaults */ }
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
    syncSelectValue(['boardTheme', 'settingsBoardTheme', 'reviewBoardTheme'], value);
    ChessBoard.setTheme(value);
    try { localStorage.setItem('kv_board_theme', value); } catch { /* storage full */ }
  }

  function applyColorModeSelection(value) {
    var safeMode = value === 'light' ? 'light' : 'dark';
    syncSelectValue(['settingsColorMode'], safeMode);
    applyColorMode(safeMode);
    try { localStorage.setItem(COLOR_MODE_KEY, safeMode); } catch { /* storage full */ }
  }

  function applyPieceStyleSelection(value) {
    syncSelectValue(['pieceStyle', 'settingsPieceStyle', 'reviewPieceStyle'], value);
    ChessBoard.setPieceStyle(value);
    try { localStorage.setItem('kv_piece_style', value); } catch { /* storage full */ }
  }

  function applyMoveSoundSelection(enabled, preview) {
    var nextValue = enabled !== false;
    syncToggleValue('settingsMoveSound', nextValue);
    syncToggleValue('reviewMoveSound', nextValue);
    SoundController.setEnabled(nextValue);
    if (preview && nextValue) SoundController.playMove();
  }

  function applySoundStyleSelection(style) {
    SoundController.setSoundStyle(style);
    syncSelectValue(['settingsSoundStyle'], style);
    var buttons = document.querySelectorAll('[data-target="settingsSoundStyle"]');
    buttons.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-value') === style);
    });
    SoundController.playMove();
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

  function getAnalyzeBottomColor() {
    return ChessBoard.getFlipped && ChessBoard.getFlipped() ? 'b' : 'w';
  }

  function createEmptyPieceCounts() {
    return {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
    };
  }

  function getPieceCountsFromFen(fen) {
    var counts = createEmptyPieceCounts();
    var boardPart = String(fen || '').split(' ')[0] || '';
    for (var i = 0; i < boardPart.length; i++) {
      var ch = boardPart.charAt(i);
      if (!/[prnbqkPRNBQK]/.test(ch)) continue;
      var color = ch === ch.toLowerCase() ? 'b' : 'w';
      var piece = ch.toLowerCase();
      if (counts[color][piece] !== undefined) {
        counts[color][piece]++;
      }
    }
    return counts;
  }

  function getMissingPieceCounts(baseCounts, currentCounts, color) {
    var missing = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
    Object.keys(missing).forEach(function(piece) {
      var baseCount = baseCounts && baseCounts[color] ? baseCounts[color][piece] || 0 : 0;
      var currentCount = currentCounts && currentCounts[color] ? currentCounts[color][piece] || 0 : 0;
      missing[piece] = Math.max(0, baseCount - currentCount);
    });
    return missing;
  }

  function getMaterialScore(pieceCounts) {
    if (!pieceCounts) return 0;
    return Object.keys(REVIEW_PIECE_VALUES).reduce(function(total, piece) {
      return total + (pieceCounts[piece] || 0) * REVIEW_PIECE_VALUES[piece];
    }, 0);
  }

  function getReviewPieceAssetUrl(pieceColor, pieceType) {
    var key = String(pieceColor || '').toLowerCase() + String(pieceType || '').toUpperCase();
    var fileName = REVIEW_PIECE_ASSET_PATHS[key];
    if (!fileName) return '';
    return (CLEAN_APP_BASE_URL ? CLEAN_APP_BASE_URL : '') + '/chess-pieces/cburnett/' + fileName;
  }

  function buildCapturedPiecesMarkup(pieceColor, capturedCounts) {
    var items = [];
    REVIEW_PIECE_ORDER.forEach(function(piece) {
      var count = capturedCounts && capturedCounts[piece] ? capturedCounts[piece] : 0;
      for (var i = 0; i < count; i++) {
        var src = getReviewPieceAssetUrl(pieceColor, piece);
        if (!src) continue;
        items.push(
          '<img class="review-captured-piece is-' + pieceColor + '" src="' + escapeAttr(src) + '" alt="" aria-hidden="true">'
        );
      }
    });
    return items.join('');
  }

  function formatDurationValue(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && isFinite(value)) {
      var numeric = value > 10000 ? Math.round(value / 1000) : Math.round(value);
      var hours = Math.floor(numeric / 3600);
      var minutes = Math.floor((numeric % 3600) / 60);
      var seconds = numeric % 60;
      if (hours > 0) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
      return minutes + ':' + String(seconds).padStart(2, '0');
    }

    var text = String(value).trim();
    if (!text) return '';
    if (/^\d+(\.\d+)?$/.test(text)) {
      return formatDurationValue(parseFloat(text));
    }
    return text;
  }

  function getSourcePlayer(sourceGame, color) {
    if (!sourceGame) return null;
    var key = color === 'w' ? 'white' : 'black';
    if (sourceGame[key]) return sourceGame[key];
    if (sourceGame.players && sourceGame.players[key]) return sourceGame.players[key];
    return null;
  }

  function getSourcePlayerCountry(sourceGame, color) {
    var player = getSourcePlayer(sourceGame, color);
    if (!player) return '';
    return player.countryCode ||
      player.country ||
      player.flag ||
      player.federation ||
      (player.user && (player.user.countryCode || player.user.country || player.user.flag)) ||
      '';
  }

  function getSourcePlayerClock(sourceGame, color) {
    var key = color === 'w' ? 'white' : 'black';
    var player = getSourcePlayer(sourceGame, color);
    if (player) {
      var nestedClock = player.clock || player.time || player.remainingTime || player.remaining_time || player.clockTime;
      if (nestedClock !== undefined && nestedClock !== null && nestedClock !== '') {
        return nestedClock;
      }
    }

    return sourceGame
      ? sourceGame[key + 'Clock'] ||
          sourceGame[key + '_clock'] ||
          sourceGame[key + 'Time'] ||
          sourceGame[key + '_time'] ||
          ''
      : '';
  }

  function extractLiveClocks(sourceGame, options) {
    var opts = options || {};
    var provided = opts.liveClocks || null;
    var white = provided && (provided.w || provided.white || '');
    var black = provided && (provided.b || provided.black || '');

    if (!white) white = getSourcePlayerClock(sourceGame, 'w');
    if (!black) black = getSourcePlayerClock(sourceGame, 'b');

    white = formatDurationValue(white);
    black = formatDurationValue(black);

    if (!white && !black) return null;
    return { w: white, b: black };
  }

  function normalizeCountryCode(rawCountry) {
    var text = String(rawCountry || '').trim();
    if (!text) return '';
    if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
    var suffixMatch = text.match(/(?:^|\/)([A-Za-z]{2})(?:\/)?$/);
    if (suffixMatch) return suffixMatch[1].toUpperCase();

    var aliasMap = {
      USA: 'US',
      IND: 'IN',
      GBR: 'GB',
      ENG: 'GB',
      UAE: 'AE'
    };
    return aliasMap[text.toUpperCase()] || '';
  }

  function getCountryFlag(rawCountry) {
    var text = String(rawCountry || '').trim();
    if (!text) return '';
    if (/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(text)) return text;

    var code = normalizeCountryCode(text);
    if (!code) return '';
    return code.split('').map(function(char) {
      return String.fromCodePoint(127397 + char.toUpperCase().charCodeAt(0));
    }).join('');
  }

  function setPlayerCountryFlag(color, rawCountry) {
    var flagEl = document.getElementById(color === 'w' ? 'whiteFlag' : 'blackFlag');
    if (!flagEl) return;

    var flag = getCountryFlag(rawCountry);
    if (!flag) {
      flagEl.textContent = '';
      flagEl.hidden = true;
      flagEl.removeAttribute('title');
      return;
    }

    flagEl.hidden = false;
    flagEl.textContent = flag;
    flagEl.title = normalizeCountryCode(rawCountry) || String(rawCountry || '').trim();
  }

  function getRecordedPlayerTimeState(game, moveIndex) {
    var clocks = { w: '', b: '' };
    var moveTimes = { w: '', b: '' };
    var moves = game && Array.isArray(game.moves) ? game.moves : [];
    var limit = Math.max(0, Math.min(typeof moveIndex === 'number' ? moveIndex : moves.length, moves.length));

    for (var i = 0; i < limit; i++) {
      var move = moves[i];
      if (!move || !move.color) continue;
      if (move.clock) clocks[move.color] = formatDurationValue(move.clock);
      if (move.elapsedTime) moveTimes[move.color] = formatDurationValue(move.elapsedTime);
    }

    return { clocks: clocks, moveTimes: moveTimes };
  }

  function getPlayerClockDisplay(game, color, moveIndex) {
    var latestIndex = gamePositions && gamePositions.length ? gamePositions.length - 1 : 0;
    var liveClocks = moveIndex >= latestIndex && game && game.liveClocks ? game.liveClocks : null;
    var liveValue = liveClocks ? formatDurationValue(liveClocks[color] || liveClocks[color === 'w' ? 'white' : 'black']) : '';
    if (liveValue) {
      return { value: liveValue, label: 'live' };
    }

    var recorded = getRecordedPlayerTimeState(game, moveIndex);
    if (recorded.clocks[color]) {
      return { value: recorded.clocks[color], label: 'clock' };
    }
    if (recorded.moveTimes[color]) {
      return { value: recorded.moveTimes[color], label: 'move' };
    }

    return { value: '', label: '' };
  }

  function setPlayerClockDisplay(color, state) {
    var clockEl = document.getElementById(color === 'w' ? 'whiteClock' : 'blackClock');
    if (!clockEl) return;

    var value = state && state.value ? state.value : '';
    if (!value) {
      clockEl.hidden = true;
      clockEl.textContent = '';
      clockEl.dataset.clockLabel = '';
      clockEl.classList.remove('is-live', 'is-move-time');
      return;
    }

    clockEl.hidden = false;
    clockEl.textContent = value;
    clockEl.dataset.clockLabel = state.label === 'move' ? 'move time' : state.label || 'clock';
    clockEl.classList.toggle('is-live', state.label === 'live');
    clockEl.classList.toggle('is-move-time', state.label === 'move');
  }

  function updateAnalyzePlayerBarState(game) {
    var currentFen = chess && chess.fen
      ? chess.fen()
      : (gamePositions && gamePositions[currentMoveIndex] ? gamePositions[currentMoveIndex].fen : '');
    var baseFen = gamePositions && gamePositions[0] ? gamePositions[0].fen : '';
    var baseCounts = getPieceCountsFromFen(baseFen || new Chess().fen());
    var currentCounts = getPieceCountsFromFen(currentFen || baseFen || new Chess().fen());
    var capturedByWhite = getMissingPieceCounts(baseCounts, currentCounts, 'b');
    var capturedByBlack = getMissingPieceCounts(baseCounts, currentCounts, 'w');
    var whiteMaterial = getMaterialScore(currentCounts.w);
    var blackMaterial = getMaterialScore(currentCounts.b);
    var materialDiff = whiteMaterial - blackMaterial;
    var whiteCapturedEl = document.getElementById('whiteCapturedPieces');
    var blackCapturedEl = document.getElementById('blackCapturedPieces');
    var whiteAdvEl = document.getElementById('whiteMaterialAdvantage');
    var blackAdvEl = document.getElementById('blackMaterialAdvantage');

    if (whiteCapturedEl) {
      whiteCapturedEl.innerHTML = buildCapturedPiecesMarkup('b', capturedByWhite);
      whiteCapturedEl.classList.toggle('is-empty', !whiteCapturedEl.innerHTML);
    }
    if (blackCapturedEl) {
      blackCapturedEl.innerHTML = buildCapturedPiecesMarkup('w', capturedByBlack);
      blackCapturedEl.classList.toggle('is-empty', !blackCapturedEl.innerHTML);
    }

    if (whiteAdvEl) {
      whiteAdvEl.textContent = materialDiff > 0 ? '+' + materialDiff : '';
      whiteAdvEl.classList.toggle('is-visible', materialDiff > 0);
    }
    if (blackAdvEl) {
      blackAdvEl.textContent = materialDiff < 0 ? '+' + Math.abs(materialDiff) : '';
      blackAdvEl.classList.toggle('is-visible', materialDiff < 0);
    }

    var positionIndex = typeof currentMoveIndex === 'number' ? currentMoveIndex : 0;
    setPlayerClockDisplay('w', getPlayerClockDisplay(game, 'w', positionIndex));
    setPlayerClockDisplay('b', getPlayerClockDisplay(game, 'b', positionIndex));
  }

  function applyLoadedGameMetadata(game, options) {
    var opts = options || {};
    var sourceGame = opts.sourceGame || null;
    var sourcePlatform = opts.sourcePlatform || '';
    var savedSourceAccuracies = opts.sourceAccuracies || null;
    var sourceUsername = normalizeReviewUsername(opts.sourceUsername || opts.reviewUsername || '');
    var reviewAccuracies = extractChesscomReviewAccuracies(sourceGame) || savedSourceAccuracies || null;
    var liveClocks = extractLiveClocks(sourceGame, opts);
    var whiteCountry = opts.whiteCountry ||
      (opts.playerFlags && (opts.playerFlags.white || opts.playerFlags.w)) ||
      game.whiteCountry ||
      getSourcePlayerCountry(sourceGame, 'w') ||
      '';
    var blackCountry = opts.blackCountry ||
      (opts.playerFlags && (opts.playerFlags.black || opts.playerFlags.b)) ||
      game.blackCountry ||
      getSourcePlayerCountry(sourceGame, 'b') ||
      '';

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

    if (liveClocks) {
      game.liveClocks = liveClocks;
    }
    if (whiteCountry) {
      game.whiteCountry = whiteCountry;
    }
    if (blackCountry) {
      game.blackCountry = blackCountry;
    }

    if (sourceUsername) {
      game.reviewUsername = sourceUsername;
      var reviewUserKey = normalizePlayerLookupName(sourceUsername);
      if (reviewUserKey && normalizePlayerLookupName(game.white) === reviewUserKey) {
        game.reviewUserColor = 'w';
      } else if (reviewUserKey && normalizePlayerLookupName(game.black) === reviewUserKey) {
        game.reviewUserColor = 'b';
      }
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

  function getReviewPlayerStrip(color) {
    var nameEl = document.getElementById(color === 'b' ? 'blackName' : 'whiteName');
    return nameEl && nameEl.closest ? nameEl.closest('.review-player-strip') : null;
  }

  function syncReviewPlayerStripOrder(flipped) {
    var stage = document.querySelector('.review-board-stage');
    var panel = stage ? stage.parentNode : null;
    var whiteStrip = getReviewPlayerStrip('w');
    var blackStrip = getReviewPlayerStrip('b');
    if (!panel || !stage || !whiteStrip || !blackStrip) return;

    var topStrip = flipped ? whiteStrip : blackStrip;
    var bottomStrip = flipped ? blackStrip : whiteStrip;
    panel.insertBefore(topStrip, stage);
    panel.insertBefore(bottomStrip, stage.nextSibling);
    syncAnalyzeCoordinates(flipped);
  }

  function updateAnalyzePlayerInfo(game, _bottomColor) {
    var whiteNameEl = document.getElementById('whiteName');
    var blackNameEl = document.getElementById('blackName');
    var whiteRatingEl = document.getElementById('whiteRating');
    var blackRatingEl = document.getElementById('blackRating');

    if (whiteNameEl) whiteNameEl.textContent = game && game.white ? game.white : 'White Player';
    if (blackNameEl) blackNameEl.textContent = game && game.black ? game.black : 'Black Player';
    if (whiteRatingEl) whiteRatingEl.textContent = game && game.whiteElo && game.whiteElo !== '?' ? '(' + game.whiteElo + ')' : '';
    if (blackRatingEl) blackRatingEl.textContent = game && game.blackElo && game.blackElo !== '?' ? '(' + game.blackElo + ')' : '';
    setPlayerCountryFlag('w', game ? game.whiteCountry : '');
    setPlayerCountryFlag('b', game ? game.blackCountry : '');
    updateAnalyzePlayerBarState(game);
  }

  function applyAnalyzeBoardOrientation(game) {
    var bottomColor = getReviewUserColor(game) === 'b' ? 'b' : 'w';
    var flipped = bottomColor === 'b';
    ChessBoard.setFlipped(flipped);
    syncReviewPlayerStripOrder(flipped);
    return bottomColor;
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
    if (gamePositions[0] && gamePositions[0].fen) {
      chess.load(gamePositions[0].fen);
    }
    currentMoveIndex = 0;
    resetGameReviewUI();

    var bottomColor = applyAnalyzeBoardOrientation(game);
    updateAnalyzePlayerInfo(game, bottomColor);

    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(null, null);
    syncAnalyzeBoardInteraction();
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
      updateAnalyzePlayerInfo(null, getAnalyzeBottomColor());
      syncAnalyzeBoardInteraction();
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
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(gameId) + '/export?clocks=true&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(gameId) + '?clocks=true&evals=false';
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
      HomeController.fetchChesscomGames(username, getChessComArchiveDate());
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

  function isEcoCode(value) {
    return /^[A-E]\d{2}$/i.test(String(value || '').trim());
  }

  function chesscomOpeningNameFromUrl(value) {
    var raw = String(value || '');
    var slug = raw.split('/openings/')[1] || '';
    if (!slug) return '';
    slug = slug.split(/[?#]/)[0];
    try {
      slug = decodeURIComponent(slug);
    } catch { /* keep original slug */ }
    return slug.replace(/-/g, ' ').trim();
  }

  function formatChesscomOpeningLabel(game) {
    if (!game) return '';
    var headers = game.headers || {};
    var opening = String(game.opening || headers.Opening || '').trim();
    var ecoUrl = game.ecoUrl || game.eco_url || headers.ECOUrl || headers.ECOURL || '';
    var eco = String(game.eco || headers.ECO || '').trim();

    if (opening && !isEcoCode(opening)) return opening;
    var fromEcoUrl = chesscomOpeningNameFromUrl(ecoUrl);
    if (fromEcoUrl) return fromEcoUrl;
    var fromEco = chesscomOpeningNameFromUrl(eco);
    if (fromEco) return fromEco;
    if (eco && !isEcoCode(eco)) return eco;
    return '';
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
        opening: formatChesscomOpeningLabel({ headers: headers }),
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
        window._lichessFetchedUsername = username;
        var lines = text.trim().split('\n').filter(function(l) { return l.trim(); });
        var games = [];
        
        lines.forEach(function(line) {
          try {
            var game = JSON.parse(line);
            games.push(game);
          } catch { /* skip malformed NDJSON line */ }
        });
        
        if (games.length === 0) {
          container.innerHTML = '<div class="no-games">No games found for @' + escapeHtml(username) + '</div>';
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

          return '<div class="fetch-game-item" data-id="' + escapeAttr(g.id) + '" data-platform="lichess" onclick="AppController.loadFetchedGame(this)">' +
            escapeHtml(white) + ' vs ' + escapeHtml(black) + ' — ' + (opening ? escapeHtml(opening.substring(0, 25)) : '') +
            '<span class="fetch-game-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
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
        window._ccFetchedUsername = username;
        var games = parseChesscomArchiveGames(text, 20) || [];
        if (!games.length) {
          container.innerHTML = '<div class="no-games">No public games for ' + escapeHtml(username) + ' in ' + escapeHtml(archive.year + '-' + archive.month) + '</div>';
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
            '<strong>' + escapeHtml(white) + '</strong> vs <strong>' + escapeHtml(black) + '</strong>' +
            (opening ? ' — ' + escapeHtml(opening.substring(0, 28)) : '') +
            '<span class="fetch-game-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
            (date ? '<div class="fetch-game-date">' + escapeHtml(date) + '</div>' : '') +
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
      return parseChesscomArchivePayload(text, 'archive');
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

  function parseChesscomArchivePayload(text, source) {
    var raw = typeof text === 'string' ? text : '';
    if (!raw.trim()) {
      return '';
    }
    if (isHtmlResponse(raw)) {
      throw createChesscomInvalidResponseError(source);
    }
    if (isLikelyChesscomPgn(raw)) {
      return raw;
    }
    try {
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.games)) {
        return parsed;
      }
    } catch { /* fall through to invalid response */ }
    throw createChesscomInvalidResponseError(source);
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
    var u = escapeHtml(username);
    var p = escapeHtml(period || '');
    if (err.status === 404) {
      return 'Chess.com returned 404 for \u201c' + u + '\u201d' +
        (p ? ' in ' + p : '') + '. Check the username and period.';
    }
    var rawMsg = err.message || '';
    if (err.timeout) {
      return 'Chess.com request timed out for \u201c' + u + '\u201d' +
        (p ? ' in ' + p : '') + '. Try again or change period.';
    }
    if (/Failed to fetch|NetworkError|load failed/i.test(rawMsg)) {
      return 'Network request to Chess.com was blocked. Disable ad/privacy blockers for this site, then retry.';
    }
    return 'Could not fetch games from Chess.com (' + escapeHtml(rawMsg || 'unknown error') + ').';
  }

  function describeLichessError(err, username) {
    if (!err) return 'Could not reach Lichess. Please try again.';
    var u = escapeHtml(username);
    if (err.status === 404) {
      return 'No public games found for \u201c' + u + '\u201d on Lichess.';
    }
    var rawMsg = err.message || '';
    if (/Failed to fetch|NetworkError|load failed/i.test(rawMsg)) {
      return 'Network request to Lichess was blocked. Disable blockers for this site, then retry.';
    }
    return 'Could not fetch games from Lichess (' + escapeHtml(rawMsg || 'unknown error') + ').';
  }

  function loadFetchedGame(el) {
    var id = el.getAttribute('data-id');
    var platform = el.getAttribute('data-platform');
    
    if (platform === 'lichess') {
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(id) + '/export?clocks=true&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(id) + '?clocks=true&evals=false';
      fetchTextWithFallback(proxyUrl, directUrl)
        .then(function(pgn) {
          if (pgn) {
            loadPGNGame(pgn, {
              sourcePlatform: 'lichess',
              sourceUsername: window._lichessFetchedUsername || readStoredProfile().lichessUsername || ''
            });
            switchTab('analyze');
            triggerAutoReview();
          }
        });
    }
  }

  function loadFetchedPGNGame(el) {
    var pgn = decodeURIComponent(el.getAttribute('data-pgn'));
    if (pgn) {
      loadPGNGame(pgn, {
        sourcePlatform: 'chesscom',
        sourceUsername: window._ccFetchedUsername || readStoredProfile().chesscomUsername || ''
      });
      switchTab('analyze');
      triggerAutoReview();
    }
  }

  // ===== NAVIGATION =====
  function goFirst() {
    if (!gamePositions.length) return;
    stopAutoPlay();
    reviewReplayState = null;
    currentMoveIndex = 0;
    chess = new Chess();
    if (gamePositions[0] && gamePositions[0].fen) {
      chess.load(gamePositions[0].fen);
    }
    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(null, null);
    updateAnalyzePlayerInfo(currentGame, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    updateActiveMoveHighlight();
    startAnalysis();
    updateMoveQualityBanner();
  }

  function goPrev() {
    if (!gamePositions.length || currentMoveIndex <= 0) return;
    stopAutoPlay();
    reviewReplayState = null;
    currentMoveIndex--;
    reloadPosition();
  }

  function goNext() {
    if (!gamePositions.length || currentMoveIndex >= gamePositions.length - 1) return;
    stopAutoPlay();
    reviewReplayState = null;
    currentMoveIndex++;
    reloadPosition();
  }

  function goLast() {
    if (!gamePositions.length) return;
    stopAutoPlay();
    reviewReplayState = null;
    currentMoveIndex = gamePositions.length - 1;
    reloadPosition();
  }

  function goToMove(index) {
    if (index < 0 || index >= gamePositions.length) return;
    stopAutoPlay();
    reviewReplayState = null;
    currentMoveIndex = index;
    reloadPosition();
  }

  function reloadPosition() {
    if (!gamePositions[currentMoveIndex]) return;
    
    var pos = gamePositions[currentMoveIndex];
    chess = new Chess();
    chess.load(pos.fen);
    ChessBoard.setPosition(chess);
    updateAnalyzePlayerInfo(currentGame, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    
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
    if (!gamePositions || gamePositions.length <= 1) return;
    if (currentMoveIndex >= gamePositions.length - 1) {
      currentMoveIndex = 0;
      reloadPosition();
    }
    autoPlayActive = true;
    setPlayButtonState(true);
    stepAutoPlay();
    autoPlayInterval = setInterval(function() {
      stepAutoPlay();
    }, autoPlayDelay);
  }

  function stepAutoPlay() {
    if (!autoPlayActive || !gamePositions || currentMoveIndex >= gamePositions.length - 1) {
      stopAutoPlay();
      return;
    }
    currentMoveIndex++;
    reloadPosition();
    if (currentMoveIndex >= gamePositions.length - 1) {
      stopAutoPlay();
    }
  }

  function stopAutoPlay() {
    autoPlayActive = false;
    setPlayButtonState(false);
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
  }

  function setPlayButtonState(isPlaying) {
    var playBtn = document.getElementById('btnPlay');
    if (!playBtn) return;
    playBtn.textContent = isPlaying ? '⏸' : '▶';
    playBtn.classList.toggle('is-playing', !!isPlaying);
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause game playback' : 'Play game');
  }

  function uciFromMoveObject(move) {
    if (!move) return '';
    return String(move.from || '') + String(move.to || '') + String(move.promotion || '');
  }

  function normalizeUciMove(move) {
    return String(move || '').trim().toLowerCase();
  }

  function movesMatchUci(a, b) {
    var left = normalizeUciMove(a);
    var right = normalizeUciMove(b);
    return !!left && !!right && left === right;
  }

  function getPlayedUciForReview(moveInfo) {
    if (!moveInfo) return '';
    return normalizeUciMove(moveInfo.playedMove || uciFromMoveObject(moveInfo));
  }

  function getEngineBestMoveForReview(moveInfo) {
    if (!moveInfo) return '';
    var candidates = Array.isArray(moveInfo.candidateMoves) ? moveInfo.candidateMoves.slice() : [];
    candidates = candidates.filter(function(candidate) {
      return candidate && (candidate.move || (candidate.pv && candidate.pv[0]));
    }).sort(function(a, b) {
      var ar = parseInt(a.rank || a.multiPv || 99, 10);
      var br = parseInt(b.rank || b.multiPv || 99, 10);
      return ar - br;
    });
    var bestCandidate = candidates.find(function(candidate) { return candidate.isBest; }) || candidates[0];
    if (bestCandidate) {
      return normalizeUciMove(bestCandidate.move || (bestCandidate.pv && bestCandidate.pv[0]));
    }
    return normalizeUciMove(moveInfo.bestMove || '');
  }

  function wasEngineBestMovePlayed(moveInfo) {
    var bestMove = getEngineBestMoveForReview(moveInfo);
    var playedMove = getPlayedUciForReview(moveInfo);
    return !!bestMove && movesMatchUci(bestMove, playedMove);
  }

  function shouldShowBestReviewButton(moveInfo) {
    var bestMove = getEngineBestMoveForReview(moveInfo);
    return !!bestMove && !wasEngineBestMovePlayed(moveInfo);
  }

  function formatReviewEvalBadge(moveInfo) {
    if (!moveInfo) return '--';
    var mate = parseInt(moveInfo.mateAfter, 10);
    if (!isNaN(mate) && isFinite(mate)) {
      return (mate < 0 ? '-#' : '#') + Math.max(1, Math.abs(mate));
    }
    var after = parseFloat(moveInfo.evalAfter);
    if (!isNaN(after) && isFinite(after) && Math.abs(after) > 900) {
      return (after < 0 ? '-#' : '#') + '1';
    }
    if (isNaN(after) || !isFinite(after)) return '--';
    return formatEvalValue(after);
  }

  function getReviewEvalBadgeClass(moveInfo) {
    if (!moveInfo) return '';
    var mate = parseInt(moveInfo.mateAfter, 10);
    if (!isNaN(mate) && isFinite(mate)) {
      return ' is-mate' + (mate < 0 ? ' is-negative' : '');
    }
    var after = parseFloat(moveInfo.evalAfter);
    if (!isNaN(after) && isFinite(after) && after < 0) return ' is-negative';
    return '';
  }

  function updateReviewFeedbackControls(moveInfo, moveIndex) {
    var actionsEl = document.getElementById('grReviewActions');
    var bestBtn = document.getElementById('grReviewBestBtn');
    var tryBtn = document.getElementById('grReviewTryAgainBtn');
    var nextBtn = document.getElementById('grReviewNextBtn');
    var evalBadge = document.getElementById('grReviewEvalBadge');
    var bubble = document.getElementById('grCoachBubble');

    if (evalBadge) {
      evalBadge.textContent = formatReviewEvalBadge(moveInfo);
      evalBadge.className = 'review-feedback-eval' + getReviewEvalBadgeClass(moveInfo);
    }
    if (bubble) {
      bubble.setAttribute('data-quality', moveInfo && moveInfo.quality ? moveInfo.quality : 'idle');
    }

    var showBest = shouldShowBestReviewButton(moveInfo);
    if (bestBtn) {
      bestBtn.style.display = showBest ? '' : 'none';
      bestBtn.disabled = !showBest;
      bestBtn.setAttribute('aria-hidden', showBest ? 'false' : 'true');
      var bestMove = getEngineBestMoveForReview(moveInfo);
      bestBtn.title = showBest && bestMove
        ? 'Show ' + formatBestMoveHint(bestMove, moveIndex)
        : 'The played move matched the engine best move';
    }
    if (actionsEl) {
      actionsEl.classList.toggle('is-best-hidden', !showBest);
      actionsEl.classList.toggle('has-best', showBest);
    }

    var hasBasePosition = !!(moveInfo && typeof moveIndex === 'number' && moveIndex >= 0 && gamePositions && gamePositions[moveIndex]);
    if (tryBtn) {
      tryBtn.disabled = !hasBasePosition;
    }
    if (nextBtn) {
      var nextIndex = reviewReplayState && reviewReplayState.active
        ? reviewReplayState.focusMoveIndex + 2
        : currentMoveIndex + 1;
      nextBtn.disabled = !gamePositions || !gamePositions.length || nextIndex >= gamePositions.length;
    }
  }

  function startReviewTryAgain() {
    var selected = getSelectedReviewMove();
    var moveInfo = selected.moveInfo;
    var moveIndex = selected.moveIndex;
    var baseFen = getFenBeforeReviewMove(moveIndex);
    if (!moveInfo || !baseFen) return;

    stopAutoPlay();
    reviewReplayState = {
      active: true,
      mode: 'try',
      focusMoveIndex: moveIndex,
      baseIndex: moveIndex,
      baseFen: baseFen,
      moveInfo: moveInfo
    };
    currentMoveIndex = moveIndex;

    chess = new Chess();
    chess.load(baseFen);
    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(null, null);
    ChessBoard.clearArrows();
    if (ChessBoard.clearMarkers) ChessBoard.clearMarkers();
    if (ChessBoard.clearReviewMoveQuality) ChessBoard.clearReviewMoveQuality();
    updateAnalyzePlayerInfo(currentGame, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    updateFenDisplay();
    updateOpeningDisplay();
    startAnalysis();
    updateMoveQualityBanner();
    showToast('Try again from the position before ' + (moveInfo.san || 'that move') + '.', '');
  }

  function showReviewBestMove() {
    var selected = getSelectedReviewMove();
    var moveInfo = selected.moveInfo;
    var moveIndex = selected.moveIndex;
    var bestMove = getEngineBestMoveForReview(moveInfo);
    var baseFen = getFenBeforeReviewMove(moveIndex);
    if (!moveInfo || !bestMove || !baseFen) return;
    if (wasEngineBestMovePlayed(moveInfo)) {
      showToast('The played move was already the engine best move.', 'success');
      updateReviewFeedbackControls(moveInfo, moveIndex);
      return;
    }

    var tempChess = new Chess();
    tempChess.load(baseFen);
    var result = tempChess.move({
      from: bestMove.slice(0, 2),
      to: bestMove.slice(2, 4),
      promotion: bestMove[4] || 'q'
    });
    if (!result) {
      showToast('Could not play the saved best move from this position.', 'error');
      return;
    }

    stopAutoPlay();
    reviewReplayState = {
      active: true,
      mode: 'best',
      focusMoveIndex: moveIndex,
      baseIndex: moveIndex,
      baseFen: baseFen,
      moveInfo: moveInfo,
      bestMove: bestMove,
      bestResult: { from: result.from, to: result.to }
    };
    currentMoveIndex = moveIndex;
    chess = tempChess;
    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(result.from, result.to);
    ChessBoard.clearArrows();
    ChessBoard.setArrows([{ from: result.from, to: result.to, color: 'rgba(134, 185, 87, 0.92)' }]);
    updateAnalyzePlayerInfo(currentGame, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    updateFenDisplay();
    updateOpeningDisplay();
    startAnalysis();
    updateMoveQualityBanner();
  }

  function handleReviewFeedbackNext() {
    if (reviewReplayState && reviewReplayState.active) {
      var target = reviewReplayState.focusMoveIndex + 2;
      reviewReplayState = null;
      if (gamePositions && target < gamePositions.length) {
        goToMove(target);
      } else if (gamePositions && gamePositions.length) {
        goToMove(gamePositions.length - 1);
      }
      return;
    }
    goNext();
  }

  function handleReviewReplayMove(move, fen) {
    var replay = reviewReplayState;
    if (!replay || !replay.active) return;

    chess = new Chess();
    chess.load(fen);
    replay.mode = 'attempt';
    replay.attemptedMove = uciFromMoveObject(move);
    replay.attemptFen = fen;
    replay.bestMove = getEngineBestMoveForReview(replay.moveInfo);
    replay.bestResult = null;
    reviewReplayState = replay;

    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(move.from, move.to);
    ChessBoard.clearArrows();
    updateAnalyzePlayerInfo(currentGame, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    updateFenDisplay();
    updateOpeningDisplay();
    startAnalysis();
    updateMoveQualityBanner();

    if (movesMatchUci(replay.attemptedMove, replay.bestMove)) {
      showToast('That is the best move.', 'success');
    } else {
      showToast('Move replayed. Use Best to compare or Try Again to reset.', '');
    }
  }

  // ===== BOARD EVENTS =====
  function onBoardMove(move, fen) {
    if (reviewReplayState && reviewReplayState.active) {
      handleReviewReplayMove(move, fen);
      return;
    }

    if (currentGame) {
      var reviewPos = gamePositions && gamePositions[currentMoveIndex] ? gamePositions[currentMoveIndex] : null;
      chess = new Chess();
      if (reviewPos && reviewPos.fen) chess.load(reviewPos.fen);
      ChessBoard.setPosition(chess);
      if (reviewPos && reviewPos.move && currentMoveIndex > 0) {
        ChessBoard.setLastMove(reviewPos.move.from, reviewPos.move.to);
      } else {
        ChessBoard.setLastMove(null, null);
      }
      syncAnalyzeBoardInteraction();
      updateFenDisplay();
      showToast('Game review is read-only. Use the move list or engine lines to explore.', 'error');
      return;
    }

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
    updateAnalyzePlayerInfo(null, getAnalyzeBottomColor());
    SoundController.playMove();
    updateMovesList();
    updateActiveMoveHighlight();
    updateFenDisplay();
    updateOpeningDisplay();
    startAnalysis();
  }

  function flipBoard() {
    ChessBoard.flip();
    var flipped = ChessBoard.getFlipped && ChessBoard.getFlipped();
    syncReviewPlayerStripOrder(flipped);
    updateAnalyzePlayerInfo(currentGame, flipped ? 'b' : 'w');
  }

  // ===== ANALYSIS =====
  function startAnalysis() {
    if (!analysisMode || !chess) return;
    
    var depth = parseInt(document.getElementById('depthSlider').value) || 20;
    var numLines = EngineController.getMaxLines ? EngineController.getMaxLines() : 5;
    
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

    setReviewBusyState(true, 'Starting');

    var reviewMeta = currentGame ? {
      whiteElo: parseInt(currentGame.whiteElo, 10) || undefined,
      blackElo: parseInt(currentGame.blackElo, 10) || undefined
    } : null;

    EngineController.analyzeGame(pgn, reviewMeta, function(done, total) {
      if (!total || done <= 0) {
        setReviewBusyState(true, 'Starting');
        return;
      }
      var pct = Math.max(1, Math.round(done / total * 100));
      setReviewBusyState(true, pct + '%');
    }, function(results, history, error) {
      if (error) {
        console.error('Full game analysis failed:', error);
        resetGameReviewUI();
        showToast(error, 'error');
        return;
      }

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

  function setupReviewTabs() {
    document.querySelectorAll('.gr-tab[data-review-tab]').forEach(function(tab) {
      tab.addEventListener('click', function() {
        switchReviewTab(this.getAttribute('data-review-tab') || 'report');
      });
    });
  }

  function switchReviewTab(tab) {
    activeReviewTab = (tab === 'analyze' || tab === 'settings') ? tab : 'report';

    document.querySelectorAll('.gr-tab[data-review-tab]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-review-tab') === activeReviewTab);
    });

    var reportPanel = document.getElementById('grReportPanel');
    var analyzePanel = document.getElementById('grAnalyzePanel');
    var settingsPanel = document.getElementById('grSettingsPanel');
    if (reportPanel) reportPanel.style.display = activeReviewTab === 'report' ? '' : 'none';
    if (analyzePanel) analyzePanel.style.display = activeReviewTab === 'analyze' ? '' : 'none';
    if (settingsPanel) settingsPanel.style.display = activeReviewTab === 'settings' ? '' : 'none';

    if (activeReviewTab === 'report' && lastAnalysisHistory) {
      renderCoachTimeline(lastAnalysisHistory);
      updateCoachTimelineCursor(currentMoveIndex - 1);
    }

    if (activeReviewTab === 'analyze') {
      var selected = getSelectedReviewMove();
      updateReviewAnalyzePanel(selected.moveInfo, selected.moveIndex);
      if (window.EngineController && typeof EngineController.renderLiveCandidates === 'function') {
        EngineController.renderLiveCandidates();
      }
    }
  }

  function getSelectedReviewMove() {
    if (reviewReplayState && reviewReplayState.active && typeof reviewReplayState.focusMoveIndex === 'number') {
      var focusIndex = reviewReplayState.focusMoveIndex;
      var focusedMove = reviewReplayState.moveInfo || null;
      if (!focusedMove && lastAnalysisHistory && focusIndex >= 0 && focusIndex < lastAnalysisHistory.length) {
        focusedMove = lastAnalysisHistory[focusIndex];
      }
      return { moveInfo: focusedMove, moveIndex: focusIndex };
    }
    var moveIndex = currentMoveIndex - 1;
    var moveInfo = null;
    if (lastAnalysisHistory && moveIndex >= 0 && moveIndex < lastAnalysisHistory.length) {
      moveInfo = lastAnalysisHistory[moveIndex];
    }
    return { moveInfo: moveInfo, moveIndex: moveIndex };
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

    whiteAccEl.textContent = Math.round(wAcc) + '%';
    blackAccEl.textContent = Math.round(bAcc) + '%';
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
      table.innerHTML = buildMoveQualityBreakdownHTML(counts);
    }
    renderCriticalMoments(history, counts);

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
    drawCentipawnLossChart(history, currentMoveIndex - 1);
    updateCoachTimelinePlayers();
    renderCoachTimeline(history);
    updateMoveQualityBanner();
  }

  function buildMoveQualityBreakdownHTML(counts) {
    var groups = [
      {
        title: 'Good',
        className: 'is-good',
        keys: ['brilliant', 'great', 'best', 'excellent', 'good', 'book']
      },
      {
        title: 'Bad',
        className: 'is-bad',
        keys: ['inaccuracy', 'mistake', 'miss', 'blunder']
      }
    ];

    return '<div class="gr-quality-grid">' + groups.map(function(group) {
      return '<div class="gr-quality-card ' + group.className + '">' +
        '<div class="gr-quality-card-head">' +
          '<span class="gr-quality-dot"></span>' +
          '<span>' + group.title + '</span>' +
          '<span class="gr-quality-side-pill">W</span>' +
          '<span class="gr-quality-side-pill is-black">B</span>' +
        '</div>' +
        group.keys.map(function(q) {
          var meta = QUALITY_META[q] || {label: q, icon: '?', iconClass: ''};
          return '<div class="gr-classify-row">' +
            '<div class="gr-cl-icon"><span class="qi ' + meta.iconClass + '">' + meta.icon + '</span></div>' +
            '<div class="gr-cl-label">' + meta.label + '</div>' +
            '<div class="gr-cl-wval">' + (counts.w[q] || 0) + '</div>' +
            '<div class="gr-cl-bval">' + (counts.b[q] || 0) + '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('') + '</div>';
  }

  function normalizeReviewUsername(raw) {
    return String(raw || '').trim().replace(/^@+/, '');
  }

  function readStoredProfile() {
    try { return JSON.parse(localStorage.getItem('kv_profile') || '{}'); } catch { return {}; }
  }

  function normalizePlayerLookupName(raw) {
    return normalizeReviewUsername(raw).toLowerCase();
  }

  function getKnownReviewUsernames(game) {
    var names = [];
    var storedProfile = readStoredProfile();
    var sessionProfile = profile || {};

    function pushName(value) {
      var name = normalizePlayerLookupName(value);
      if (name && names.indexOf(name) === -1) names.push(name);
    }

    pushName(game && game.reviewUsername);
    pushName(game && game.sourceUsername);
    pushName(storedProfile.chesscomUsername);
    pushName(storedProfile.lichessUsername);
    pushName(sessionProfile.chesscomUsername);
    pushName(sessionProfile.lichessUsername);

    if (typeof window !== 'undefined') {
      pushName(window._ccFetchedUsername);
      pushName(window._lichessFetchedUsername);
    }

    ['gamesTabUser', 'chesscomLinkedName', 'lichessLinkedName', 'chesscomUsername', 'lichessUsername'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      pushName(el.value || el.textContent);
    });

    return names;
  }

  function getReviewUserColor(game) {
    if (!game) return null;
    if (game.reviewUserColor === 'w' || game.reviewUserColor === 'b') return game.reviewUserColor;

    var white = normalizePlayerLookupName(game.white);
    var black = normalizePlayerLookupName(game.black);
    var names = getKnownReviewUsernames(game);

    if (white && names.indexOf(white) !== -1) return 'w';
    if (black && names.indexOf(black) !== -1) return 'b';
    return null;
  }

  function renderCriticalMoments(history, counts) {
    var container = document.getElementById('grCriticalMoments');
    if (!container) return;

    var criticalKeys = ['inaccuracy', 'mistake', 'miss', 'blunder'];
    var userColor = getReviewUserColor(currentGame);

    if (!userColor) {
      container.innerHTML = '<div class="critical-empty">Set your Chess.com or Lichess username in profile to show only your mistakes for this game.</div>';
      return;
    }

    var userCounts = counts[userColor] || {};
    var totals = criticalKeys.reduce(function(acc, key) {
      acc[key] = userCounts[key] || 0;
      return acc;
    }, {});
    var totalCritical = criticalKeys.reduce(function(sum, key) { return sum + totals[key]; }, 0);
    var severityRank = { blunder: 5, miss: 4, mistake: 3, inaccuracy: 2 };
    var moments = (history || []).map(function(move, idx) {
      return { move: move, idx: idx, cpl: getMoveCentipawnLoss(move) };
    }).filter(function(item) {
      return item.move.color === userColor && criticalKeys.indexOf(item.move.quality) !== -1;
    }).sort(function(a, b) {
      var rankDiff = (severityRank[b.move.quality] || 0) - (severityRank[a.move.quality] || 0);
      return rankDiff || b.cpl - a.cpl;
    }).slice(0, 6);

    if (!totalCritical) {
      container.innerHTML = '<div class="critical-empty">No major mistakes found in this review. Keep stepping through the game to study smaller improvements.</div>';
      return;
    }

    var summary = '<div class="critical-summary">' +
      '<div><strong>' + totalCritical + '</strong><span>your critical moments</span></div>' +
      '<div><strong>' + totals.inaccuracy + '</strong><span>inaccuracies</span></div>' +
      '<div><strong>' + totals.mistake + '</strong><span>mistakes</span></div>' +
      '<div><strong>' + (totals.miss + totals.blunder) + '</strong><span>misses/blunders</span></div>' +
    '</div>';

    var cards = moments.map(function(item) {
      var move = item.move;
      var meta = getQualityMeta(move.quality);
      var side = move.color === 'w' ? 'White' : 'Black';
      var moveLabel = buildMoveLabel(move, item.idx);
      var bestMove = formatBestMoveHint(move.bestMove, item.idx);
      var best = bestMove ? '<span class="critical-best">Best: ' + escapeHtml(bestMove) + '</span>' : '';
      return '<button type="button" class="critical-moment ' + escapeAttr(move.quality || '') + '" onclick="AppController.openCriticalMoment(' + item.idx + ')">' +
        '<span class="critical-icon qi ' + escapeAttr(meta.iconClass || '') + '">' + meta.icon + '</span>' +
        '<span class="critical-main">' +
          '<span class="critical-move">' + escapeHtml(moveLabel) + '</span>' +
          '<span class="critical-meta">' + escapeHtml(side + ' · ' + meta.label + ' · ' + Math.round(item.cpl) + ' cpl') + '</span>' +
          best +
        '</span>' +
      '</button>';
    }).join('');

    container.innerHTML = summary + '<div class="critical-list">' + cards + '</div>';
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

  function getMoveCentipawnLoss(move) {
    if (!move) return 0;
    var cpl = parseFloat(move.centipawnLoss);
    if (!isNaN(cpl) && isFinite(cpl)) return Math.max(0, cpl);

    var before = parseFloat(move.evalBefore);
    var after = parseFloat(move.evalAfter);
    if (!isNaN(before) && !isNaN(after)) {
      var moverDelta = move.color === 'b' ? before - after : after - before;
      return Math.max(0, -moverDelta * 100);
    }

    var fallback = {
      brilliant: 0, great: 0, book: 0, best: 0, excellent: 6, good: 18,
      inaccuracy: 55, mistake: 145, miss: 280, blunder: 360
    };
    return fallback[move.quality] || 0;
  }

  function getCplBucket(move) {
    var quality = move && move.quality;
    if (quality === 'blunder' || quality === 'miss') return 'blunder';
    if (quality === 'mistake') return 'mistake';
    if (quality === 'inaccuracy') return 'inaccuracy';
    return 'accurate';
  }

  function getCplBucketMeta(bucket) {
    var meta = {
      accurate: { label: 'Accurate', color: '#6abf40' },
      inaccuracy: { label: 'Inaccuracy', color: '#e8bd58' },
      mistake: { label: 'Mistake', color: '#d48b2a' },
      blunder: { label: 'Blunder', color: '#c93030' }
    };
    return meta[bucket] || meta.accurate;
  }

  function drawCentipawnLossChart(history, highlightIndex) {
    var canvas = document.getElementById('cplChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    var cssW = Math.max(320, Math.round(rect.width || canvas.clientWidth || 420));
    var cssH = Math.max(110, Math.round(rect.height || canvas.clientHeight || 130));
    var dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, cssW, cssH);

    if (!history || !history.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.font = '12px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Run a review to see centipawn loss', cssW / 2, cssH / 2 + 4);
      return;
    }

    var padL = 10;
    var padR = 10;
    var padT = 12;
    var padB = 18;
    var chartW = cssW - padL - padR;
    var chartH = cssH - padT - padB;
    var values = history.map(getMoveCentipawnLoss);
    var maxCpl = Math.max.apply(null, values.concat([120]));
    maxCpl = Math.min(Math.max(maxCpl, 120), 800);

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(function(step) {
      var y = padT + chartH * step;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(cssW - padR, y);
      ctx.stroke();
    });

    var gap = chartW / history.length;
    var barW = Math.max(2, Math.min(12, gap * 0.62));
    var selectedIdx = typeof highlightIndex === 'number' ? highlightIndex : -1;
    var hitAreas = [];

    history.forEach(function(move, idx) {
      var cpl = values[idx];
      var clamped = Math.min(cpl, maxCpl);
      var h = Math.max(2, (clamped / maxCpl) * chartH);
      var x = padL + idx * gap + (gap - barW) / 2;
      var y = padT + chartH - h;
      var bucket = getCplBucket(move);
      var meta = getCplBucketMeta(bucket);

      ctx.fillStyle = meta.color;
      ctx.globalAlpha = idx === selectedIdx ? 1 : 0.82;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barW, h);
      }
      ctx.globalAlpha = 1;

      if (idx === selectedIdx) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 2, padT - 3, barW + 4, chartH + 6);
      }

      hitAreas.push({ x: x, y: y, w: barW, h: h, move: move, index: idx, cpl: cpl, bucket: bucket });
    });

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '10px IBM Plex Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0', padL, cssH - 5);
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxCpl) + ' cpl', cssW - padR, cssH - 5);

    canvas._cplHitAreas = hitAreas;
    bindCplChartTooltip(canvas);
  }

  function bindCplChartTooltip(canvas) {
    if (!canvas || canvas._cplTooltipBound) return;
    canvas._cplTooltipBound = true;
    canvas.addEventListener('mousemove', function(event) {
      var tooltip = document.getElementById('cplTooltip');
      if (!tooltip) return;
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var nearest = null;
      var bestDist = Infinity;
      (canvas._cplHitAreas || []).forEach(function(area) {
        var mid = area.x + area.w / 2;
        var dist = Math.abs(x - mid);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = area;
        }
      });
      if (!nearest || bestDist > 14) {
        tooltip.style.display = 'none';
        return;
      }
      var meta = getCplBucketMeta(nearest.bucket);
      var moveInfo = nearest.move || {};
      var bestMove = formatBestMoveHint(moveInfo.bestMove, nearest.index);
      tooltip.innerHTML =
        '<div class="cpl-tt-header"><span class="cpl-tt-icon" style="color:' + meta.color + '">■</span>' +
          '<span class="cpl-tt-quality">' + meta.label + '</span></div>' +
        '<div class="cpl-tt-move">' + buildMoveLabel(moveInfo, nearest.index) + '</div>' +
        '<div class="cpl-tt-cpl">' + Math.round(nearest.cpl) + ' centipawn loss</div>' +
        '<div class="cpl-tt-best' + (bestMove ? '' : ' cpl-tt-best--same') + '">' +
          (bestMove ? 'Best: ' + bestMove : 'Best move matched') +
        '</div>';
      tooltip.style.display = 'block';
      tooltip.style.left = Math.min(rect.width - 160, Math.max(8, nearest.x - 24)) + 'px';
      tooltip.style.top = Math.max(8, nearest.y - 76) + 'px';
    });
    canvas.addEventListener('mouseleave', function() {
      var tooltip = document.getElementById('cplTooltip');
      if (tooltip) tooltip.style.display = 'none';
    });
    canvas.addEventListener('click', function(event) {
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var nearest = null;
      var bestDist = Infinity;
      (canvas._cplHitAreas || []).forEach(function(area) {
        var mid = area.x + area.w / 2;
        var dist = Math.abs(x - mid);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = area;
        }
      });
      if (nearest && bestDist <= 18) {
        goToMove(nearest.index + 1);
      }
    });
  }

  function resetGameReviewUI() {
    lastAnalysisHistory = null;
    lastAnalysisCounts = null;
    lastCoachSummary = DEFAULT_COACH_TEXT;
    coachCommentaryRequestId++;
    currentReviewCandidates = [];
    reviewReplayState = null;
    switchReviewTab('report');
    var panel = document.getElementById('gameReviewPanel');
    if (panel) panel.classList.add('is-empty');
    setCoachMessage('Coach Ramp', DEFAULT_COACH_TEXT);
    var table = document.getElementById('grClassifyTable');
    if (table) table.innerHTML = '';
    var critical = document.getElementById('grCriticalMoments');
    if (critical) critical.innerHTML = '<div class="gr-analysis-empty">Run full analysis to see critical positions.</div>';
    var wRating = document.getElementById('grWhiteGameRating');
    var bRating = document.getElementById('grBlackGameRating');
    if (wRating) wRating.textContent = '?';
    if (bRating) bRating.textContent = '?';
    var whiteCard = document.getElementById('grWhiteCard');
    var blackCard = document.getElementById('grBlackCard');
    if (whiteCard) whiteCard.classList.remove('active');
    if (blackCard) blackCard.classList.remove('active');
    setMoveQualityBanner(null);
    resetCoachTimeline();
    var cplCanvas = document.getElementById('cplChart');
    if (cplCanvas) {
      var cplCtx = cplCanvas.getContext('2d');
      cplCtx.clearRect(0, 0, cplCanvas.width, cplCanvas.height);
      cplCanvas._cplHitAreas = [];
    }
    var cplTooltip = document.getElementById('cplTooltip');
    if (cplTooltip) cplTooltip.style.display = 'none';
    updateReviewAnalyzePanel(null, -1);
    setReviewBusyState(false);
  }

  function updateMoveQualityBanner() {
    var selected = getSelectedReviewMove();
    var moveIndex = selected.moveIndex;
    var moveInfo = selected.moveInfo;
    setMoveQualityBanner(moveInfo, moveIndex);
    updateCoachTimelineCursor(moveIndex);
    refreshCentipawnLossHighlight(moveIndex);
    updateReviewAnalyzePanel(moveInfo, moveIndex);
  }

  function refreshCentipawnLossHighlight(highlightIndex) {
    if (!lastAnalysisHistory) return;
    var idx = (typeof highlightIndex === 'number') ? highlightIndex : currentMoveIndex - 1;
    drawCentipawnLossChart(lastAnalysisHistory, idx);
  }

  function setMoveQualityBanner(moveInfo, moveIndex) {
    var iconEl = document.getElementById('moveQualityIcon');
    var gradeEl = document.getElementById('moveQualityGrade');
    var descEl = document.getElementById('moveQualityDesc');
    updateReviewFeedbackControls(moveInfo, moveIndex);
    if (!iconEl || !gradeEl || !descEl) {
      if (moveInfo) updateCoachForMove(moveInfo, moveIndex);
      return;
    }

    if (!moveInfo) {
      iconEl.textContent = '?';
      iconEl.className = 'qi';
      if (ChessBoard && typeof ChessBoard.clearMarkers === 'function') ChessBoard.clearMarkers();
      if (ChessBoard && typeof ChessBoard.clearReviewMoveQuality === 'function') ChessBoard.clearReviewMoveQuality();
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
    if (ChessBoard && typeof ChessBoard.clearMarkers === 'function') {
      ChessBoard.clearMarkers();
    }

    var replayForMove = reviewReplayState && reviewReplayState.active && reviewReplayState.focusMoveIndex === moveIndex
      ? reviewReplayState
      : null;
    if (replayForMove) {
      if (ChessBoard && typeof ChessBoard.clearReviewMoveQuality === 'function') {
        ChessBoard.clearReviewMoveQuality();
      }
      if (replayForMove.mode === 'best' && replayForMove.bestResult && ChessBoard && typeof ChessBoard.setReviewMoveQuality === 'function') {
        ChessBoard.setReviewMoveQuality({
          from: replayForMove.bestResult.from,
          to: replayForMove.bestResult.to,
          square: replayForMove.bestResult.to,
          quality: 'best',
          label: 'Best'
        });
      }
      updateCoachForMove(moveInfo, moveIndex);
      return;
    }

    if (ChessBoard && typeof ChessBoard.setReviewMoveQuality === 'function' && moveInfo.to) {
      ChessBoard.setReviewMoveQuality({
        from: moveInfo.from,
        to: moveInfo.to,
        square: moveInfo.to,
        quality: moveInfo.quality,
        label: meta.label
      });
    } else if (ChessBoard && typeof ChessBoard.setMarkers === 'function' && moveInfo.to) {
      ChessBoard.setMarkers([{
        square: moveInfo.to,
        text: meta.icon,
        className: 'qi ' + (meta.iconClass || ''),
        title: meta.label
      }]);
    }
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
    applyCoachNarrative({
      title: title,
      headline: null,
      text: text,
      moveLabel: '',
      mood: inferCoachMoodFromTitle(title),
      tips: []
    });
  }

  var COACH_MOOD_BY_QUALITY = {
    brilliant: 'brilliant',
    great: 'good',
    best: 'good',
    excellent: 'good',
    good: 'good',
    book: 'book',
    inaccuracy: 'warn',
    mistake: 'bad',
    miss: 'bad',
    blunder: 'bad'
  };

  var COACH_ICON_BY_QUALITY = {
    brilliant: '‼',
    great: '!',
    best: '★',
    excellent: '✓',
    good: '✓',
    book: '\u{1F4D6}',
    inaccuracy: '?!',
    mistake: '?',
    miss: '✖',
    blunder: '??'
  };

  function inferCoachMoodFromTitle(title) {
    if (!title || typeof title !== 'string') return 'idle';
    var t = title.toLowerCase();
    for (var q in COACH_MOOD_BY_QUALITY) {
      if (t.indexOf(q) !== -1) return COACH_MOOD_BY_QUALITY[q];
    }
    return 'idle';
  }

  function applyCoachNarrative(payload) {
    var hero = document.getElementById('grCoachTip');
    var titleEl = document.getElementById('grCoachTitle');
    var iconEl = document.getElementById('grCoachQualityIcon');
    var moveLabelEl = document.getElementById('grCoachMoveLabel');
    var headlineEl = document.getElementById('grCoachHeadline');
    var textEl = document.getElementById('grCoachText');
    var tipsEl = document.getElementById('grCoachTips');

    var title = payload && payload.title ? String(payload.title) : 'Coach Ramp';
    var quality = payload && payload.quality ? payload.quality : null;
    var mood = payload && payload.mood ? payload.mood : (quality ? (COACH_MOOD_BY_QUALITY[quality] || 'idle') : 'idle');
    var text = payload && typeof payload.text === 'string' ? payload.text : '';
    var headline = payload && payload.headline ? String(payload.headline) : '';
    var moveLabel = payload && payload.moveLabel ? String(payload.moveLabel) : '';
    var tips = payload && Array.isArray(payload.tips) ? payload.tips : [];

    var shortTitle = title.replace(/^Coach Ramp\s*[·•-]\s*/i, '');
    if (!shortTitle) shortTitle = 'Coach Ramp';
    var meta = quality ? getQualityMeta(quality) : null;
    if (titleEl) titleEl.textContent = meta ? meta.label : shortTitle;
    if (iconEl) {
      var fallbackIcon = quality && COACH_ICON_BY_QUALITY[quality] ? COACH_ICON_BY_QUALITY[quality] : '♞';
      iconEl.textContent = meta ? meta.icon : fallbackIcon;
      iconEl.className = meta
        ? 'crqp-icon qi ' + (meta.iconClass || '')
        : 'crqp-icon qi';
    }
    if (moveLabelEl) moveLabelEl.textContent = moveLabel || '';

    if (!headline && text) {
      var firstStop = text.indexOf('. ');
      if (firstStop > 0 && firstStop < 80) {
        headline = text.slice(0, firstStop + 1);
        text = text.slice(firstStop + 2).trim();
      } else if (text.length < 110) {
        headline = text;
        text = '';
      } else {
        headline = 'Coach Ramp';
      }
    }
    if (headlineEl) headlineEl.textContent = headline || 'Coach Ramp';
    if (textEl) textEl.textContent = text || '';
    if (textEl) textEl.style.display = text ? '' : 'none';

    if (tipsEl) {
      tipsEl.innerHTML = '';
      tips.forEach(function(tip) {
        if (!tip || !tip.text) return;
        var pill = document.createElement('span');
        pill.className = 'coach-ramp-tip' + (tip.kind ? ' is-' + tip.kind : '');
        pill.textContent = tip.text;
        tipsEl.appendChild(pill);
      });
    }

    if (hero) {
      hero.setAttribute('data-mood', mood || 'idle');
      hero.setAttribute('data-quality', quality || 'idle');
      hero.classList.remove('is-speaking');
      void hero.offsetWidth;
      hero.classList.add('is-speaking');
    }
  }

  function loadCoachCommentaryData() {
    if (coachCommentaryStore) return Promise.resolve(coachCommentaryStore);
    if (coachCommentaryPromise) return coachCommentaryPromise;
    if (typeof fetch !== 'function') return Promise.resolve(null);

    coachCommentaryPromise = fetch(COACH_COMMENTARY_URL, { cache: 'force-cache' })
      .then(function(response) {
        if (!response.ok) throw new Error('Coach commentary data unavailable');
        return response.json();
      })
      .then(function(rows) {
        coachCommentaryStore = buildCoachCommentaryStore(rows);
        return coachCommentaryStore;
      })
      .catch(function() {
        coachCommentaryStore = { byExactMove: Object.create(null), byBaseMove: Object.create(null), count: 0 };
        return coachCommentaryStore;
      });

    return coachCommentaryPromise;
  }

  function buildCoachCommentaryStore(rows) {
    var store = {
      byExactMove: Object.create(null),
      byBaseMove: Object.create(null),
      count: 0
    };
    if (!Array.isArray(rows)) return store;

    rows.forEach(function(row) {
      var entry = normalizeCoachCommentaryEntry(row);
      if (!entry) return;
      addCoachCommentaryIndex(store.byExactMove, entry.exactMoveKey, entry);
      addCoachCommentaryIndex(store.byBaseMove, entry.baseMoveKey, entry);
      store.count++;
    });

    return store;
  }

  function addCoachCommentaryIndex(index, key, entry) {
    if (!key) return;
    if (!index[key]) index[key] = [];
    index[key].push(entry);
  }

  function normalizeCoachCommentaryEntry(row) {
    if (!row || !row.output) return null;
    var meta = parseCoachCommentaryInput(row.input || '');
    var move = meta.move || '';
    var exactMoveKey = normalizeCoachMoveKey(move, true);
    var baseMoveKey = normalizeCoachMoveKey(move, false);
    if (!exactMoveKey && !baseMoveKey) return null;

    return {
      output: normalizeCoachOutput(row.output),
      exactMoveKey: exactMoveKey,
      baseMoveKey: baseMoveKey,
      moveNumber: parseInt(meta.movenumber, 10) || 0,
      player: normalizeCoachPlayer(meta.currentplayer),
      phase: normalizeCoachPhase(meta.phase),
      quality: normalizeCoachQuality(meta.classification),
      moveType: normalizeCoachMoveType(meta.movetype),
      check: /^yes$/i.test(meta.check || ''),
      checkmate: /^yes$/i.test(meta.checkmate || ''),
      winner: normalizeCoachPlayer(meta.winner)
    };
  }

  function parseCoachCommentaryInput(input) {
    var meta = {};
    String(input || '').split('|').forEach(function(part) {
      var sep = part.indexOf(':');
      if (sep === -1) return;
      var key = part.slice(0, sep).trim().toLowerCase().replace(/\s+/g, '');
      meta[key] = part.slice(sep + 1).trim();
    });
    return meta;
  }

  function normalizeCoachOutput(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeCoachMoveKey(move, keepCheckMarks) {
    var key = String(move || '')
      .replace(/\s+/g, '')
      .replace(/0/g, 'O')
      .replace(/[!?]+/g, '')
      .trim();
    if (!keepCheckMarks) key = key.replace(/[+#]+/g, '');
    return key;
  }

  function normalizeCoachPlayer(value) {
    var text = String(value || '').toLowerCase();
    if (text.indexOf('white') !== -1) return 'white';
    if (text.indexOf('black') !== -1) return 'black';
    return 'none';
  }

  function normalizeCoachPhase(value) {
    var text = String(value || '').toLowerCase();
    if (text.indexOf('opening') !== -1) return 'opening';
    if (text.indexOf('end') !== -1) return 'endgame';
    if (text.indexOf('middle') !== -1) return 'middlegame';
    return '';
  }

  function normalizeCoachQuality(value) {
    var text = String(value || '').toLowerCase();
    if (text.indexOf('brilliant') !== -1) return 'brilliant';
    if (text.indexOf('great') !== -1) return 'great';
    if (text.indexOf('book') !== -1) return 'book';
    if (text.indexOf('best') !== -1) return 'best';
    if (text.indexOf('excellent') !== -1) return 'excellent';
    if (text.indexOf('inaccuracy') !== -1 || text.indexOf('inaccurate') !== -1) return 'inaccuracy';
    if (text.indexOf('mistake') !== -1) return 'mistake';
    if (text.indexOf('miss') !== -1) return 'miss';
    if (text.indexOf('blunder') !== -1) return 'blunder';
    if (text.indexOf('good') !== -1) return 'good';
    return '';
  }

  function normalizeCoachMoveType(value) {
    var text = String(value || '').toLowerCase();
    if (text.indexOf('capture') !== -1) return 'capture';
    if (text.indexOf('castle') !== -1) return 'castle';
    if (text.indexOf('promotion') !== -1) return 'promotion';
    if (text.indexOf('check') !== -1) return 'check';
    return text || '';
  }

  function buildCoachCommentaryTarget(moveInfo, moveIndex) {
    var san = moveInfo.san || moveInfo.move || moveInfo.playedMove || '';
    var moveNumber = moveInfo.moveNumber || (typeof moveIndex === 'number' ? Math.floor(moveIndex / 2) + 1 : 0);
    var checkmate = san.indexOf('#') !== -1 || !!(moveInfo.terminal && moveInfo.terminal.type === 'checkmate');
    var check = checkmate || san.indexOf('+') !== -1;
    return {
      exactMoveKey: normalizeCoachMoveKey(san, true),
      baseMoveKey: normalizeCoachMoveKey(san, false),
      moveNumber: moveNumber,
      player: moveInfo.color === 'b' ? 'black' : 'white',
      phase: getCoachPhaseForMove(moveNumber),
      quality: normalizeCoachQuality(moveInfo.quality),
      moveType: inferCoachMoveType(moveInfo, san, check),
      check: check,
      checkmate: checkmate,
      winner: checkmate ? (moveInfo.color === 'b' ? 'black' : 'white') : 'none'
    };
  }

  function getCoachPhaseForMove(moveNumber) {
    var num = parseInt(moveNumber, 10) || 0;
    if (num && num <= 10) return 'opening';
    if (num && num >= 36) return 'endgame';
    return 'middlegame';
  }

  function getCoachOpeningName(moveInfo, moveIndex) {
    var opening = moveInfo && moveInfo.opening;
    if (!opening && lastAnalysisHistory && typeof moveIndex === 'number') {
      for (var i = moveIndex - 1; i >= 0; i--) {
        if (lastAnalysisHistory[i] && lastAnalysisHistory[i].opening) {
          opening = lastAnalysisHistory[i].opening;
          break;
        }
      }
    }
    if (!opening && currentGame && currentGame.opening) opening = currentGame.opening;
    if (!opening) return '';
    if (typeof opening === 'object') return opening.name || opening.opening || opening.eco || '';
    return String(opening).trim();
  }

  function didCoachMoveLeaveTheory(moveInfo, moveIndex) {
    if (!moveInfo || moveInfo.quality === 'book' || typeof moveIndex !== 'number' || moveIndex <= 0) return false;
    if (moveIndex > 22) return false;
    var previous = lastAnalysisHistory && lastAnalysisHistory[moveIndex - 1];
    return !!(previous && previous.quality === 'book');
  }

  function getCoachPlanTip(moveInfo, moveIndex, equalish) {
    var moveNumber = moveInfo && moveInfo.moveNumber
      ? moveInfo.moveNumber
      : (typeof moveIndex === 'number' ? Math.floor(moveIndex / 2) + 1 : 0);
    var phase = getCoachPhaseForMove(moveNumber);
    if (phase === 'opening') {
      return equalish
        ? 'Keep developing pieces, fight for the center, and get the king safe.'
        : 'Follow opening principles: develop, castle, and do not chase pawns without a reason.';
    }
    if (phase === 'endgame') {
      return equalish
        ? 'In equal endgames, activate the king and create a useful pawn break.'
        : 'In the endgame, active pieces and passed pawns matter more than one-move threats.';
    }
    return equalish
      ? 'With the game balanced, improve your worst piece and look for pawn breaks.'
      : 'In the middlegame, ask what your opponent is threatening before starting your own plan.';
  }

  function isCoachCriticalMove(moveInfo, delta) {
    if (!moveInfo) return false;
    if (moveInfo.quality === 'brilliant' || moveInfo.quality === 'great') return true;
    if (moveInfo.quality === 'blunder' || moveInfo.quality === 'mistake' || moveInfo.quality === 'miss') return true;
    var cpl = getMoveCentipawnLoss(moveInfo);
    return cpl >= 120 || (typeof delta === 'number' && Math.abs(delta) >= 1.25);
  }

  function inferCoachMoveType(moveInfo, san, check) {
    if (san.indexOf('O-O') === 0) return 'castle';
    if (moveInfo.promotion || san.indexOf('=') !== -1) return 'promotion';
    if (moveInfo.captured || san.indexOf('x') !== -1) return 'capture';
    if (check) return 'check';
    return 'quiet';
  }

  function qualityFamily(quality) {
    if (quality === 'blunder' || quality === 'mistake' || quality === 'miss' || quality === 'inaccuracy') {
      return 'error';
    }
    if (quality === 'brilliant' || quality === 'great' || quality === 'best') return 'strong';
    return 'steady';
  }

  function scoreCoachCommentaryEntry(entry, target) {
    var score = 0;
    if (entry.exactMoveKey && entry.exactMoveKey === target.exactMoveKey) score += 42;
    else if (entry.baseMoveKey && entry.baseMoveKey === target.baseMoveKey) score += 28;

    if (entry.quality && entry.quality === target.quality) score += 24;
    else if (entry.quality && target.quality && qualityFamily(entry.quality) === qualityFamily(target.quality)) score += 9;
    else if (entry.quality && target.quality) score -= 7;

    if (entry.player === target.player) score += 10;
    if (entry.phase && entry.phase === target.phase) score += 7;
    if (entry.moveType && entry.moveType === target.moveType) score += 5;
    if (entry.checkmate === target.checkmate) score += target.checkmate ? 14 : 2;
    else score -= 18;
    if (entry.check === target.check) score += target.check ? 7 : 1;
    else if (target.check || entry.check) score -= 6;
    if (entry.winner === target.winner) score += target.winner !== 'none' ? 7 : 1;
    if (entry.moveNumber && target.moveNumber) {
      var diff = Math.abs(entry.moveNumber - target.moveNumber);
      if (diff === 0) score += 4;
      else if (diff <= 3) score += 2;
    }
    return score;
  }

  function hashCoachSeed(value) {
    var str = String(value || '');
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function findCoachCommentaryExample(store, moveInfo, moveIndex) {
    if (!store || !moveInfo) return '';
    var target = buildCoachCommentaryTarget(moveInfo, moveIndex);
    var candidates = store.byExactMove[target.exactMoveKey] || store.byBaseMove[target.baseMoveKey] || [];
    if (!candidates.length) return '';

    var scored = candidates.map(function(entry) {
      return { entry: entry, score: scoreCoachCommentaryEntry(entry, target) };
    }).sort(function(a, b) {
      return b.score - a.score;
    });

    var bestScore = scored.length ? scored[0].score : 0;
    if (bestScore < 34) return '';
    var pool = scored.filter(function(item) {
      return item.score >= bestScore - 5;
    }).slice(0, 12);
    var seed = hashCoachSeed(target.exactMoveKey + target.quality + target.player + moveIndex);
    return pool[seed % pool.length].entry.output;
  }

  function applyDatasetCoachCommentary(moveInfo, moveIndex, narrative) {
    var requestId = ++coachCommentaryRequestId;
    loadCoachCommentaryData().then(function(store) {
      if (requestId !== coachCommentaryRequestId) return;
      var selected = getSelectedReviewMove();
      if (selected.moveIndex !== moveIndex) return;
      var exampleText = findCoachCommentaryExample(store, moveInfo, moveIndex);
      if (!exampleText) return;
      var merged = Object.assign({}, narrative || {});
      merged.headline = narrative && narrative.headline ? narrative.headline : 'Coach Ramp says:';
      merged.text = exampleText;
      applyCoachNarrative(merged);
    });
  }

  function updateCoachForMove(moveInfo, moveIndex) {
    if (!moveInfo) {
      coachCommentaryRequestId++;
      applyCoachNarrative({
        title: 'Coach Ramp',
        mood: 'idle',
        headline: 'Pick a move to review.',
        text: lastCoachSummary && lastCoachSummary !== DEFAULT_COACH_TEXT
          ? lastCoachSummary
          : DEFAULT_COACH_TEXT,
        tips: []
      });
      return;
    }

    var narrative = buildCoachNarrative(moveInfo, moveIndex);
    applyCoachNarrative(narrative);
    applyDatasetCoachCommentary(moveInfo, moveIndex, narrative);
  }

  function buildCoachNarrative(moveInfo, moveIndex) {
    var quality = moveInfo.quality || 'good';
    var meta = getQualityMeta(quality);
    var moveLabel = buildMoveLabel(moveInfo, moveIndex);
    var player = moveInfo.color === 'w' ? 'White' : 'Black';
    var san = moveInfo.san || moveInfo.move || '';
    var movedPiece = pieceLabel(moveInfo.piece);

    var nextMove = lastAnalysisHistory && typeof moveIndex === 'number'
      ? lastAnalysisHistory[moveIndex + 1]
      : null;
    var moverBefore = signedEvalForMover(moveInfo, moveInfo.evalBefore);
    var moverAfter = signedEvalForMover(moveInfo, moveInfo.evalAfter);
    var bestMoveText = formatBestMoveHint(moveInfo.bestMove, moveIndex);
    var before = parseFloat(moveInfo.evalBefore);
    var after = parseFloat(moveInfo.evalAfter);
    var delta = !isNaN(before) && !isNaN(after)
      ? (moveInfo.color === 'w' ? (after - before) : (before - after))
      : null;
    var equalish = !isNaN(after) && Math.abs(after) < 0.45;
    var openingName = getCoachOpeningName(moveInfo, moveIndex);
    var leavesTheory = didCoachMoveLeaveTheory(moveInfo, moveIndex);
    var phasePlan = getCoachPlanTip(moveInfo, moveIndex, equalish);
    var critical = isCoachCriticalMove(moveInfo, delta);

    var isMate = san.indexOf('#') !== -1;
    var isCheck = san.indexOf('+') !== -1 && !isMate;
    var isCastle = san.indexOf('O-O') === 0;
    var isPromotion = !!moveInfo.promotion;
    var wonPiece = moveInfo.captured ? pieceLabel(moveInfo.captured) : '';
    var hangsPiece = nextMove && nextMove.captured && nextMove.color !== moveInfo.color
      && (quality === 'blunder' || quality === 'mistake' || quality === 'miss');
    var hangsOwnPieceLabel = hangsPiece ? pieceLabel(nextMove.captured) : '';
    var hangsIsRecapture = hangsPiece && nextMove.to === moveInfo.to && movedPiece;
    var missedMateThreat = quality === 'miss' && moverBefore >= 7 && moverAfter <= moverBefore - 2;
    var allowsMate = (quality === 'blunder' || quality === 'mistake') && moverAfter <= -7;

    var headline;
    var detail;

    if (isMate) {
      headline = 'Checkmate — well played!';
      detail = player + ' delivers mate with ' + san + '. Clean finish.';
    } else if (quality === 'brilliant') {
      headline = 'Brilliant! A move only the sharpest eyes see.';
      detail = san + ' finds a hidden resource that shifts the game in ' + player + '\'s favour.';
    } else if (quality === 'great') {
      headline = 'Great move — you spotted the key idea.';
      detail = san + ' keeps the initiative and improves the position clearly.';
    } else if (quality === 'best') {
      headline = wonPiece
        ? 'Nicely done — you pounced on that free ' + wonPiece + '.'
        : 'Top choice. That is exactly what the engine wanted.';
      detail = isCheck
        ? 'The check forces a reply and keeps you in the driver\'s seat.'
        : 'Stay calm and keep finding moves like this — it is the strongest try.';
    } else if (quality === 'excellent') {
      headline = 'Excellent — the position stays healthy.';
      detail = san + ' holds everything together and preserves your plans.';
    } else if (quality === 'good') {
      headline = 'Good move, position under control.';
      detail = 'Not the sharpest line, but ' + san + ' keeps the balance and avoids risk.';
    } else if (quality === 'book') {
      headline = openingName
        ? 'Still in book — this fits the ' + openingName + '.'
        : 'Still in book — theory says this is fine.';
      detail = 'A standard opening move. Keep developing smoothly and do not rush tactics that are not there yet.';
    } else if (quality === 'inaccuracy') {
      headline = 'A small slip, but nothing fatal.';
      detail = bestMoveText
        ? 'There was a sharper try with ' + bestMoveText + '. Remember it for next time.'
        : 'The position is still very playable — just keep an eye on precision.';
    } else if (quality === 'mistake') {
      headline = hangsIsRecapture
        ? 'Careful — the ' + movedPiece + ' ends up hanging.'
        : 'That move gives the opponent something back.';
      detail = bestMoveText
        ? 'A cleaner path was ' + bestMoveText + '. Slow down before moving pieces into undefended squares.'
        : 'Look for safer squares and double-check opponent replies next time.';
    } else if (quality === 'miss') {
      headline = missedMateThreat
        ? 'You had a winning attack — one more precise move would have done it.'
        : 'A stronger tactic was available here.';
      detail = bestMoveText
        ? 'Stockfish preferred ' + bestMoveText + '. When you feel a finish is near, slow down and count candidates.'
        : 'Look for forcing moves first: checks, captures, and threats.';
    } else if (quality === 'blunder') {
      headline = hangsIsRecapture
        ? 'Ouch — ' + san + ' hangs the ' + movedPiece + '.'
        : allowsMate
          ? 'Blunder — this allows a serious threat against your king.'
          : 'Blunder. Let\'s learn from this one.';
      detail = bestMoveText
        ? 'A safer and stronger move was ' + bestMoveText + '. Before moving, ask: "what does my opponent do next?"'
        : 'Before playing, always check: is this piece safe? Is my king safe? Is there a cleaner capture?';
    } else {
      headline = 'Let\'s look at this move.';
      detail = 'Take a moment to study the position and the engine suggestions.';
    }

    if (leavesTheory) {
      detail += openingName
        ? ' This is where the game leaves known ' + openingName + ' theory, so simple principles matter now.'
        : ' This is where the game leaves known theory, so simple principles matter now.';
    }

    if (isPromotion) {
      detail += ' The pawn promotes to a ' + pieceLabel(moveInfo.promotion) + ' — usually decisive.';
    } else if (isCastle && (quality === 'best' || quality === 'excellent' || quality === 'good' || quality === 'book')) {
      detail += ' Castling tucks the king away and connects the rooks.';
    }

    if (equalish && (quality === 'book' || quality === 'excellent' || quality === 'good')) {
      detail += ' The position is close to equal, so the goal is steady improvement: ' + phasePlan;
    }

    if (hangsPiece && !hangsIsRecapture) {
      detail += ' It also lets the opponent win a ' + hangsOwnPieceLabel + ' on the next move.';
    }
    if (wonPiece && (quality === 'best' || quality === 'great' || quality === 'brilliant')) {
      detail += ' Material gained: a ' + wonPiece + '.';
    }

    var tips = [];
    if (bestMoveText && (quality === 'inaccuracy' || quality === 'mistake' || quality === 'miss' || quality === 'blunder')) {
      tips.push({ kind: 'best', text: 'Best: ' + bestMoveText });
    } else if (bestMoveText && quality === 'book') {
      tips.push({ kind: 'idea', text: 'Main line: ' + bestMoveText });
    } else if ((quality === 'best' || quality === 'great' || quality === 'brilliant') && san) {
      tips.push({ kind: 'best', text: 'Engine approved ✓' });
    }
    if (hangsPiece) {
      tips.push({ kind: 'threat', text: 'Threat: ' + hangsOwnPieceLabel + ' is loose' });
    }
    if (isCheck) tips.push({ kind: 'idea', text: 'Check — forces a reply' });
    if (isCastle && (quality === 'book' || quality === 'best' || quality === 'excellent')) {
      tips.push({ kind: 'plan', text: 'Castle & connect rooks' });
    }
    if (delta !== null && Math.abs(delta) >= 0.3) {
      tips.push({ kind: 'plan', text: 'Eval ' + formatDeltaValue(delta) });
    }
    if (leavesTheory) {
      tips.push({ kind: 'idea', text: 'Out of book' });
    }
    if (critical) {
      tips.push({ kind: 'threat', text: 'Critical moment' });
    } else if (equalish && phasePlan) {
      tips.push({ kind: 'plan', text: 'Plan: improve pieces' });
    }

    return {
      title: 'Coach Ramp · ' + meta.label,
      quality: quality,
      mood: COACH_MOOD_BY_QUALITY[quality] || 'idle',
      headline: headline,
      text: detail,
      moveLabel: moveLabel + ' · ' + player,
      tips: tips
    };
  }

  function signedEvalForMover(moveInfo, evalValue) {
    var num = parseFloat(evalValue);
    if (isNaN(num)) return 0;
    return moveInfo && moveInfo.color === 'b' ? -num : num;
  }

  // ===== Coach Ramp Timeline =====
  var coachTimelineState = { history: null, width: 0, height: 0 };

  function clampCoachEval(v) {
    if (typeof v !== 'number' || isNaN(v)) return 0;
    if (v > 6) return 6;
    if (v < -6) return -6;
    return v;
  }

  function renderCoachTimeline(history) {
    coachTimelineState.history = history;
    var canvas = document.getElementById('grCoachTimelineGraph');
    var dotsEl = document.getElementById('grCoachTimelineDots');
    var rail = document.getElementById('grCoachTimelineRail');
    if (!canvas || !dotsEl || !rail) return;

    var ctx = canvas.getContext('2d');
    var rect = rail.getBoundingClientRect();
    var W = Math.max(320, Math.floor(rect.width));
    var H = Math.max(60, Math.floor(rect.height));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    coachTimelineState.width = W;
    coachTimelineState.height = H;

    if (!history || !history.length) {
      dotsEl.innerHTML = '';
      updateCoachTimelineCursor(-1);
      return;
    }

    var n = history.length;
    var stepX = n > 1 ? W / (n - 1) : W;
    var midY = H / 2;

    // Build eval points (smoothed).
    var points = history.map(function(h, i) {
      var ev = clampCoachEval(parseFloat(h.evalAfter));
      var y = midY - (ev / 6) * (H / 2 - 6);
      return { x: i * stepX, y: y };
    });

    // Area fill gradient (white-ish for white advantage, dark for black advantage).
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(240, 242, 248, 0.28)');
    grad.addColorStop(0.5, 'rgba(240, 242, 248, 0.06)');
    grad.addColorStop(0.5, 'rgba(10, 12, 18, 0.14)');
    grad.addColorStop(1, 'rgba(10, 12, 18, 0.40)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      var p0 = points[i - 1], p1 = points[i];
      var cx = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
    }
    ctx.lineTo(W, midY);
    ctx.closePath();
    ctx.fill();

    // Line stroke on top.
    ctx.strokeStyle = 'rgba(230, 234, 245, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j++) {
      var q0 = points[j - 1], q1 = points[j];
      var cx2 = (q0.x + q1.x) / 2;
      ctx.bezierCurveTo(cx2, q0.y, cx2, q1.y, q1.x, q1.y);
    }
    ctx.stroke();

    // Dots overlay (DOM nodes so they can be colored by class).
    var dotsHtml = '';
    var highlightable = { brilliant:1, great:1, best:1, inaccuracy:1, mistake:1, miss:1, blunder:1 };
    for (var k = 0; k < n; k++) {
      var h = history[k];
      if (!h || !highlightable[h.quality]) continue;
      var cx3 = k * stepX;
      var cy3 = points[k].y;
      var left = (cx3 / W) * 100;
      var top = (cy3 / H) * 100;
      dotsHtml += '<span class="crt-dot q-' + h.quality + '" data-move-index="' + k + '" style="left:' + left.toFixed(3) + '%;top:' + top.toFixed(3) + '%;"></span>';
    }
    dotsEl.innerHTML = dotsHtml;

    updateCoachTimelineCursor(typeof currentMoveIndex === 'number' ? currentMoveIndex - 1 : -1);
  }

  function updateCoachTimelineCursor(moveIndex) {
    var cursor = document.getElementById('grCoachTimelineCursor');
    var dotsEl = document.getElementById('grCoachTimelineDots');
    if (!cursor) return;
    var history = coachTimelineState.history;
    if (!history || !history.length || typeof moveIndex !== 'number' || moveIndex < 0 || moveIndex >= history.length) {
      cursor.classList.remove('is-visible');
      if (dotsEl) {
        var prev = dotsEl.querySelector('.crt-dot.is-current');
        if (prev) prev.classList.remove('is-current');
      }
      return;
    }
    var n = history.length;
    var stepX = n > 1 ? 1 / (n - 1) : 1;
    var pct = Math.max(0, Math.min(1, moveIndex * stepX));
    cursor.style.left = (pct * 100).toFixed(3) + '%';
    cursor.classList.add('is-visible');
    if (dotsEl) {
      var was = dotsEl.querySelector('.crt-dot.is-current');
      if (was) was.classList.remove('is-current');
      var now = dotsEl.querySelector('.crt-dot[data-move-index="' + moveIndex + '"]');
      if (now) now.classList.add('is-current');
    }
  }

  function setupCoachTimelineInteractions() {
    var rail = document.getElementById('grCoachTimelineRail');
    if (!rail || rail._coachBound) return;
    rail._coachBound = true;
    rail.addEventListener('click', function(ev) {
      var history = coachTimelineState.history;
      if (!history || !history.length) return;
      var r = rail.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      var idx = Math.round(pct * (history.length - 1));
      goToMove(idx + 1);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', function() {
        if (coachTimelineState.history) renderCoachTimeline(coachTimelineState.history);
      });
    }
  }

  function updateCoachTimelinePlayers() {
    var whiteEl = document.getElementById('grCoachTlWhite');
    var blackEl = document.getElementById('grCoachTlBlack');
    if (whiteEl) whiteEl.textContent = (currentGame && currentGame.white) ? currentGame.white : 'White Player';
    if (blackEl) blackEl.textContent = (currentGame && currentGame.black) ? currentGame.black : 'Black Player';
  }

  function resetCoachTimeline() {
    coachTimelineState.history = null;
    var canvas = document.getElementById('grCoachTimelineGraph');
    var dots = document.getElementById('grCoachTimelineDots');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (dots) dots.innerHTML = '';
    updateCoachTimelineCursor(-1);
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

  function getFenBeforeReviewMove(moveIndex) {
    if (typeof moveIndex === 'number' && moveIndex >= 0 && gamePositions && gamePositions[moveIndex]) {
      return gamePositions[moveIndex].fen || '';
    }
    return chess ? chess.fen() : '';
  }

  function formatCandidateEval(candidate) {
    if (!candidate) return '--';
    if (typeof candidate.mate === 'number') {
      if (candidate.mate === 0) return 'M0';
      return candidate.mate > 0 ? 'M' + candidate.mate : '-M' + Math.abs(candidate.mate);
    }
    if (typeof candidate.cp === 'number') {
      var pawn = candidate.cp / 100;
      return (pawn >= 0 ? '+' : '') + pawn.toFixed(2);
    }
    return '--';
  }

  function getCandidateEvalClass(candidate) {
    if (!candidate) return '';
    if (typeof candidate.mate === 'number') return candidate.mate < 0 ? ' negative' : '';
    if (typeof candidate.cp === 'number') return candidate.cp < 0 ? ' negative' : '';
    return '';
  }

  function sanForUciMove(fen, uciMove) {
    if (!uciMove || uciMove.length < 4) return uciMove || '';
    try {
      var tempChess = new Chess();
      if (fen) tempChess.load(fen);
      var move = tempChess.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove[4] || 'q'
      });
      return move && move.san ? move.san : (uciMove.slice(0, 2) + '-' + uciMove.slice(2, 4));
    } catch (e) {
      return uciMove.slice(0, 2) + '-' + uciMove.slice(2, 4);
    }
  }

  function formatCandidatePv(pv, fen) {
    if (!pv || !pv.length) return '';

    var moves = Array.isArray(pv) ? pv : String(pv).split(' ');
    try {
      var tempChess = new Chess();
      if (fen) tempChess.load(fen);

      var fenParts = String(fen || '').split(' ');
      var moveNum = parseInt(fenParts[5], 10) || 1;
      var isWhite = (fenParts[1] || 'w') === 'w';
      var formatted = [];

      for (var i = 0; i < Math.min(moves.length, 8); i++) {
        var uciMove = moves[i];
        if (!uciMove || uciMove.length < 4) break;

        if (isWhite || i === 0) {
          formatted.push(isWhite ? moveNum + '.' : moveNum + '...');
          if (isWhite) moveNum++;
        }

        var move = tempChess.move({
          from: uciMove.slice(0, 2),
          to: uciMove.slice(2, 4),
          promotion: uciMove[4] || 'q'
        });
        formatted.push(move && move.san ? move.san : uciMove);
        isWhite = !isWhite;
      }

      return formatted.join(' ');
    } catch (e) {
      return moves.slice(0, 8).join(' ');
    }
  }

  function describeReviewPosition(moveInfo, moveIndex) {
    if (!moveInfo || typeof moveIndex !== 'number' || moveIndex < 0) {
      return 'Select a move after running full analysis.';
    }
    var moveNum = moveInfo.moveNumber || Math.floor(moveIndex / 2) + 1;
    var prefix = moveInfo.color === 'w' ? moveNum + '.' : moveNum + '...';
    return 'Before ' + prefix + ' ' + (moveInfo.san || moveInfo.playedMove || 'the selected move');
  }

  function updateReviewAnalyzePanel(moveInfo, moveIndex) {
    var labelEl = document.getElementById('grAnalysisPositionLabel');
    var listEl = document.getElementById('grAnalysisCandidates');
    if (!labelEl || !listEl) return;

    currentReviewCandidates = [];
    labelEl.textContent = describeReviewPosition(moveInfo, moveIndex);

    if (!moveInfo) {
      listEl.innerHTML = '<div class="gr-analysis-empty">Run full analysis, then select a move to see better choices.</div>';
      return;
    }

    var candidates = Array.isArray(moveInfo.candidateMoves) ? moveInfo.candidateMoves.slice() : [];
    if (!candidates.length && moveInfo.bestMove) {
      candidates = [{
        rank: 1,
        move: moveInfo.bestMove,
        pv: [moveInfo.bestMove],
        isBest: true,
        isPlayed: moveInfo.bestMove === moveInfo.playedMove
      }];
    }
    if (!candidates.length) {
      listEl.innerHTML = '<div class="gr-analysis-empty">No alternate engine moves were saved for this position.</div>';
      return;
    }

    var fen = getFenBeforeReviewMove(moveIndex);
    currentReviewCandidates = candidates.map(function(candidate) {
      return Object.assign({}, candidate, {
        fen: fen,
        moveIndex: moveIndex
      });
    });

    listEl.innerHTML = currentReviewCandidates.map(function(candidate, idx) {
      var firstMove = sanForUciMove(fen, candidate.move || (candidate.pv && candidate.pv[0]));
      var pvLine = formatCandidatePv(candidate.pv || [], fen);
      var tags = '';
      if (candidate.isBest) {
        tags += '<span class="gr-candidate-tag is-best">Best</span>';
      }
      if (candidate.isPlayed) {
        tags += '<span class="gr-candidate-tag is-played">Played</span>';
      }
      var depth = candidate.depth ? '<span class="gr-candidate-depth">d' + escapeHtml(candidate.depth) + '</span>' : '';
      var rowClass = 'gr-candidate-row' + (candidate.isBest ? ' is-best' : '') + (candidate.isPlayed ? ' is-played' : '');
      return '<button type="button" class="' + rowClass + '" onclick="AppController.loadReviewCandidateLine(' + idx + ')">' +
        '<span class="gr-candidate-rank">' + escapeHtml(candidate.rank || idx + 1) + '</span>' +
        '<span class="gr-candidate-main">' +
          '<span class="gr-candidate-top">' +
            '<span class="gr-candidate-move">' + escapeHtml(firstMove) + '</span>' +
            tags +
          '</span>' +
          '<span class="gr-candidate-line">' + escapeHtml(pvLine || firstMove) + '</span>' +
        '</span>' +
        '<span class="gr-candidate-side">' +
          '<span class="gr-candidate-eval' + getCandidateEvalClass(candidate) + '">' + escapeHtml(formatCandidateEval(candidate)) + '</span>' +
          depth +
        '</span>' +
      '</button>';
    }).join('');
  }

  function loadReviewCandidateLine(index) {
    var candidate = currentReviewCandidates && currentReviewCandidates[index];
    if (!candidate || !candidate.pv || !candidate.pv.length) return;
    var targetIndex = typeof candidate.moveIndex === 'number' ? candidate.moveIndex : Math.max(0, currentMoveIndex - 1);
    goToMove(targetIndex);
    loadEngineLine(candidate.pv.join(' '));
  }

  function formatEstimatedElo(value) {
    if (value === null || value === undefined) return 'N/A';
    var num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return 'N/A';
    return String(Math.round(num / 50) * 50);
  }

  function updateGameRatings(counts, wAcc, bAcc) {
    var wBox = document.getElementById('grWhiteGameRating');
    var bBox = document.getElementById('grBlackGameRating');
    if (!wBox || !bBox) return;
    if (!counts || !counts.w || !counts.b || isNaN(wAcc) || isNaN(bAcc)) {
      wBox.textContent = 'N/A';
      bBox.textContent = 'N/A';
      return;
    }
    wBox.textContent = formatEstimatedElo(estimateGameRating(wAcc, counts.w));
    bBox.textContent = formatEstimatedElo(estimateGameRating(bAcc, counts.b));
  }

  function estimateGameRating(acc, playerCounts) {
    if (acc === null || acc === undefined || isNaN(acc) || !playerCounts) return null;
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
    return Math.max(300, Math.min(3200, base + swing));
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

  function openCriticalMoment(moveIndex) {
    var idx = parseInt(moveIndex, 10);
    if (isNaN(idx)) return;

    // `gamePositions[n]` is the board after history move n - 1, so jump one
    // ply past the mistake while keeping Analysis focused on that move.
    goToMove(idx + 1);
    switchReviewTab('analyze');

    var selected = getSelectedReviewMove();
    updateReviewAnalyzePanel(selected.moveInfo, selected.moveIndex);

    var analysisPanel = document.getElementById('grAnalyzePanel');
    if (analysisPanel && analysisPanel.scrollIntoView) {
      analysisPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
    var openingName = opening && opening.name && opening.name !== 'Unknown Opening' ? opening.name : '';
    if (nameEl) nameEl.textContent = openingName || '—';
    if (ecoEl) ecoEl.textContent = '';
  }

  // ===== ENGINE LINE LOADING =====
  function loadEngineLine(pv) {
    if (!pv || !chess) return;
    var moves = pv.split(' ');
    var baseIndex = currentMoveIndex;
    var tempChess = new Chess();
    tempChess.load(chess.fen());
    stopAutoPlay();

    var newPositions = [].concat(gamePositions.slice(0, baseIndex + 1));
    var addedMoves = 0;
    
    moves.forEach(function(uciMove) {
      if (!uciMove || uciMove.length < 4) return;
      var result = tempChess.move({from: uciMove.slice(0,2), to: uciMove.slice(2,4), promotion: uciMove[4] || 'q'});
      if (result) {
        newPositions.push({fen: tempChess.fen(), move: result, san: result.san, moveNum: newPositions.length});
        addedMoves++;
      }
    });

    if (!addedMoves) return;
    
    gamePositions = newPositions;
    currentMoveIndex = baseIndex;
    updateMovesList();
    startAutoPlay();
  }

  // ===== PROFILE =====
  function loadProfile() {
    try {
      var saved = localStorage.getItem('kv_profile');
      if (saved) {
        profile = migrateProfileAccounts(JSON.parse(saved));
        localStorage.setItem('kv_profile', JSON.stringify(profile));
        applyProfile();
      }
    } catch { /* corrupt profile data – keep defaults */ }
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
    var existingProfile = {};
    try { existingProfile = JSON.parse(localStorage.getItem('kv_profile') || '{}'); } catch(e) { existingProfile = {}; }
    existingProfile = migrateProfileAccounts(existingProfile);
    profile = {
      displayName: document.getElementById('profileDisplayName').value,
      chesscomUsername: document.getElementById('chesscomUsername').value,
      lichessUsername: document.getElementById('lichessUsername').value,
      linkedAccounts: Array.isArray(existingProfile.linkedAccounts) ? existingProfile.linkedAccounts : [],
      activeAccountId: existingProfile.activeAccountId || '',
      prefEngine: DEFAULT_ENGINE_ID,
      prefDepth: document.getElementById('prefDepth').value,
      savedAt: new Date().toISOString()
    };
    profile = syncLegacyAccountFields(migrateProfileAccounts(profile));
    
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

  function normalizeStoredUsername(raw) {
    return String(raw || '').trim().replace(/^@+/, '');
  }

  function normalizeStoredPlatform(platform) {
    var value = String(platform || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (value === 'chesscom' || value === 'chess') return 'chesscom';
    if (value === 'lichess' || value === 'lichessorg') return 'lichess';
    return value || 'chesscom';
  }

  function getStoredLinkedAccountId(platform, username) {
    return normalizeStoredPlatform(platform) + ':' + normalizeStoredUsername(username).toLowerCase();
  }

  function migrateProfileAccounts(source) {
    var p = Object.assign(getDefaultProfile(), source || {});
    var accounts = Array.isArray(p.linkedAccounts) ? p.linkedAccounts.slice() : [];
    var byId = {};
    accounts = accounts.map(function(account) {
      if (!account) return null;
      var platform = normalizeStoredPlatform(account.platform || account.site || '');
      var username = normalizeStoredUsername(account.username || account.handle || '');
      if (!platform || !username) return null;
      var id = getStoredLinkedAccountId(platform, username);
      if (byId[id]) return null;
      byId[id] = true;
      return Object.assign({
        id: id,
        platform: platform,
        username: username,
        displayName: username,
        avatar: '',
        ratingData: null,
        lastSynced: '',
        isActive: false
      }, account, { id: id, platform: platform, username: username });
    }).filter(Boolean);
    [
      { platform: 'chesscom', username: p.chesscomUsername },
      { platform: 'lichess', username: p.lichessUsername }
    ].forEach(function(entry) {
      var username = normalizeStoredUsername(entry.username);
      var id = username ? getStoredLinkedAccountId(entry.platform, username) : '';
      if (id && !byId[id]) {
        byId[id] = true;
        accounts.push({
          id: id,
          platform: entry.platform,
          username: username,
          displayName: username,
          avatar: '',
          ratingData: null,
          lastSynced: '',
          isActive: false
        });
      }
    });
    if (!p.activeAccountId || !accounts.some(function(account) { return account.id === p.activeAccountId; })) {
      p.activeAccountId = accounts.length ? accounts[0].id : '';
    }
    p.linkedAccounts = accounts.map(function(account) {
      return Object.assign({}, account, { isActive: account.id === p.activeAccountId });
    });
    var active = p.linkedAccounts.find(function(account) { return account.id === p.activeAccountId; }) || p.linkedAccounts[0] || null;
    var firstChesscom = p.linkedAccounts.find(function(account) { return account.platform === 'chesscom'; });
    var firstLichess = p.linkedAccounts.find(function(account) { return account.platform === 'lichess'; });
    p.chesscomUsername = active && active.platform === 'chesscom' ? active.username : (firstChesscom ? firstChesscom.username : '');
    p.lichessUsername = active && active.platform === 'lichess' ? active.username : (firstLichess ? firstLichess.username : '');
    return p;
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
    if (game.reviewUsername) summary.reviewUsername = game.reviewUsername;
    if (game.whiteCountry) summary.whiteCountry = game.whiteCountry;
    if (game.blackCountry) summary.blackCountry = game.blackCountry;
    if (game.liveClocks) summary.liveClocks = game.liveClocks;
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
      try { localStorage.setItem('kv_database', JSON.stringify(gameDatabase)); } catch { /* storage full */ }
      return;
    }

    gameDatabase.unshift(summary);
    if (gameDatabase.length > 500) gameDatabase = gameDatabase.slice(0, 500);

    try { localStorage.setItem('kv_database', JSON.stringify(gameDatabase)); } catch { /* storage full */ }

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
      var safeId = escapeAttr(g.id);
      return '<div class="db-row" onclick="AppController.loadDbGame(\'' + safeId + '\')">' +
        '<span>' + escapeHtml(g.white || '?') + '</span>' +
        '<span>' + escapeHtml(g.black || '?') + '</span>' +
        '<span class="' + resultClass + '">' + escapeHtml(g.result || '*') + '</span>' +
        '<span>' + escapeHtml((g.opening || '').substring(0, 20) || '—') + '</span>' +
        '<span>' + escapeHtml((g.date || '').substring(0, 10)) + '</span>' +
        '<span class="db-row-actions"><button class="btn-sm" onclick="event.stopPropagation();AppController.loadDbGame(\'' + safeId + '\')">Load</button></span>' +
        '</div>';
    }).join('');
  }

  function loadDbGame(id) {
    var game = gameDatabase.find(function(g) { return String(g.id) === String(id); });
    if (game && game.pgn) {
      loadPGNGame(game.pgn, {
        sourcePlatform: game.sourcePlatform || '',
        sourceUrl: game.sourceUrl || '',
        sourceUsername: game.reviewUsername || '',
        sourceAccuracies: game.sourceAccuracies || null,
        whiteCountry: game.whiteCountry || '',
        blackCountry: game.blackCountry || '',
        liveClocks: game.liveClocks || null
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
      var safeId = escapeAttr(g.id);
      return '<div class="saved-game-item" onclick="AppController.loadDbGame(\'' + safeId + '\')">' +
        '<div class="saved-game-players">' + escapeHtml(g.white || '?') + ' vs ' + escapeHtml(g.black || '?') + ' <strong>' + escapeHtml(g.result || '*') + '</strong></div>' +
        '<div class="saved-game-meta">' + escapeHtml((g.opening || '').substring(0, 30)) + ' \u2022 ' + escapeHtml((g.date || '').substring(0, 10)) + '</div>' +
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
    openCriticalMoment: openCriticalMoment,
    loadEngineLine: loadEngineLine,
    loadReviewCandidateLine: loadReviewCandidateLine,
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
    formatChesscomOpeningLabel: formatChesscomOpeningLabel,
    fetchChesscomMonthPgn: fetchChesscomMonthPgn,
    fetchChesscomWithFallback: fetchChesscomWithFallback,
    fetchTextWithFallback: fetchTextWithFallback,
    describeChesscomError: describeChesscomError,
    describeLichessError: describeLichessError,
    triggerAutoReview: triggerAutoReview
  };
})();

// ===== HOME PAGE CONTROLLER =====
const HomeController = (function() {
  var chesscomStatsRequest = 0;
  var CHESSCOM_FETCH_MONTHS = 3;
  var GAMES_TAB_PAGE_SIZE = 50;
  var accountSyncRequests = {};

  function init() {
    setupImportTabs();
    setupAccountPanelTabs();
    setupAccountLinks();
    setupProfileEditToggle();
    setupSavedProfiles();
    setupHomeImport();
    setupRecentGamesList();
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
    try {
      var migrated = migrateProfileAccounts(JSON.parse(localStorage.getItem('kv_profile') || '{}'));
      localStorage.setItem('kv_profile', JSON.stringify(migrated));
      return migrated;
    } catch(e) { return migrateProfileAccounts({}); }
  }

  function normalizePlatform(platform) {
    var value = String(platform || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (value === 'chesscom' || value === 'chess') return 'chesscom';
    if (value === 'lichess' || value === 'lichessorg') return 'lichess';
    return value || 'chesscom';
  }

  function getAccountId(platform, username) {
    return normalizePlatform(platform) + ':' + normalizeUsername(username).toLowerCase();
  }

  function createLinkedAccount(platform, username, patch) {
    var normalizedPlatform = normalizePlatform(platform);
    var normalizedUsername = normalizeUsername(username);
    return Object.assign({
      id: getAccountId(normalizedPlatform, normalizedUsername),
      platform: normalizedPlatform,
      username: normalizedUsername,
      displayName: normalizedUsername,
      avatar: '',
      ratingData: null,
      lastSynced: '',
      isActive: false
    }, patch || {});
  }

  function migrateProfileAccounts(source) {
    var p = Object.assign({}, source || {});
    var accounts = Array.isArray(p.linkedAccounts) ? p.linkedAccounts.slice() : [];
    var byId = {};
    accounts = accounts.map(function(account) {
      if (!account) return null;
      var platform = normalizePlatform(account.platform || account.site || '');
      var username = normalizeUsername(account.username || account.handle || '');
      if (!platform || !username) return null;
      var normalized = createLinkedAccount(platform, username, account);
      normalized.id = getAccountId(platform, username);
      normalized.platform = platform;
      normalized.username = username;
      normalized.isActive = false;
      if (byId[normalized.id]) return null;
      byId[normalized.id] = true;
      return normalized;
    }).filter(Boolean);

    [
      { platform: 'chesscom', username: p.chesscomUsername },
      { platform: 'lichess', username: p.lichessUsername }
    ].forEach(function(entry) {
      var username = normalizeUsername(entry.username);
      var id = username ? getAccountId(entry.platform, username) : '';
      if (id && !byId[id]) {
        byId[id] = true;
        accounts.push(createLinkedAccount(entry.platform, username));
      }
    });

    if (!p.activeAccountId || !accounts.some(function(account) { return account.id === p.activeAccountId; })) {
      p.activeAccountId = accounts.length ? accounts[0].id : '';
    }
    accounts = accounts.map(function(account) {
      return Object.assign({}, account, { isActive: account.id === p.activeAccountId });
    });
    p.linkedAccounts = accounts;
    return syncLegacyAccountFields(p);
  }

  function syncLegacyAccountFields(profileObj) {
    var p = Object.assign({}, profileObj || {});
    var accounts = Array.isArray(p.linkedAccounts) ? p.linkedAccounts : [];
    var active = accounts.find(function(account) { return account.id === p.activeAccountId; }) || accounts[0] || null;
    var firstChesscom = accounts.find(function(account) { return account.platform === 'chesscom'; });
    var firstLichess = accounts.find(function(account) { return account.platform === 'lichess'; });
    if (active && active.platform === 'chesscom') p.chesscomUsername = active.username;
    else p.chesscomUsername = firstChesscom ? firstChesscom.username : '';
    if (active && active.platform === 'lichess') p.lichessUsername = active.username;
    else p.lichessUsername = firstLichess ? firstLichess.username : '';
    p.linkedAccounts = accounts.map(function(account) {
      return Object.assign({}, account, { isActive: account.id === p.activeAccountId });
    });
    return p;
  }

  function saveProfileObject(p) {
    var next = syncLegacyAccountFields(migrateProfileAccounts(p));
    localStorage.setItem('kv_profile', JSON.stringify(next));
    return next;
  }

  function getLinkedAccounts() {
    return getProfile().linkedAccounts || [];
  }

  function getActiveLinkedAccount(platform) {
    var normalizedPlatform = platform ? normalizePlatform(platform) : '';
    var p = getProfile();
    var accounts = p.linkedAccounts || [];
    var active = accounts.find(function(account) { return account.id === p.activeAccountId; }) || null;
    if (normalizedPlatform && (!active || active.platform !== normalizedPlatform)) {
      active = accounts.find(function(account) { return account.platform === normalizedPlatform; }) || null;
    }
    return active;
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
    } catch { /* storage full */ }
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
    var accounts = (p && p.linkedAccounts) || [];
    var active = accounts.find(function(account) { return account.id === p.activeAccountId; }) || accounts[0] || null;
    var chesscom = active && active.platform === 'chesscom' ? active : accounts.find(function(account) { return account.platform === 'chesscom'; });
    var lichess = active && active.platform === 'lichess' ? active : accounts.find(function(account) { return account.platform === 'lichess'; });

    if (chesscom) {
      if (ccChip) { ccChip.style.display = 'inline-flex'; }
      if (ccName) ccName.textContent = chesscom.username;
    } else {
      if (ccChip) ccChip.style.display = 'none';
    }
    if (lichess) {
      if (lcChip) { lcChip.style.display = 'inline-flex'; }
      if (lcName) lcName.textContent = lichess.username;
    } else {
      if (lcChip) lcChip.style.display = 'none';
    }
    if (noChip) noChip.style.display = accounts.length ? 'none' : 'inline-flex';
  }

  function updateHomeStats() {
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch { /* corrupt data – start with empty db */ }
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
    var account = getActiveLinkedAccount('chesscom');
    if (!account || !account.username) {
      setChesscomRatingsState(null, '');
      return;
    }
    if (account.ratingData) {
      setChesscomRatingsState({
        bullet: account.ratingData.bullet || '—',
        blitz: account.ratingData.blitz || '—',
        rapid: account.ratingData.rapid || '—'
      }, account.username);
      return;
    }
    fetchChesscomRatings(account.username);
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
    bindHomeClick('addProfileBtn', 'homeAddProfileBound', function() {
      var p = getProfile();
      if (!p.displayName) {
        AppController.showToast('Fill in and save your profile first', 'error');
        var editBtn = document.getElementById('editProfileToggle');
        if (editBtn) editBtn.click();
        return;
      }
      saveCurrentAsProfile(p);
    });
    setupSavedProfileActions();
    renderSavedProfilesList();
  }

  function setupSavedProfileActions() {
    bindHomeClick('savedProfilesList', 'homeProfilesBound', function(e) {
      if (!e.target || !e.target.closest) return;
      var fetchBtn = e.target.closest('[data-profile-fetch]');
      if (fetchBtn) {
        fetchSavedProfileGames(fetchBtn.getAttribute('data-profile-fetch'), fetchBtn.getAttribute('data-profile-platform'));
        return;
      }
      var deleteBtn = e.target.closest('[data-profile-delete]');
      if (deleteBtn) {
        deleteProfile(deleteBtn.getAttribute('data-profile-delete'));
        return;
      }
      var loadTarget = e.target.closest('[data-profile-load], [data-profile-id]');
      if (loadTarget) {
        loadProfileFn(loadTarget.getAttribute('data-profile-load') || loadTarget.getAttribute('data-profile-id'));
      }
    });
  }

  function getSavedProfiles() {
    try { return JSON.parse(localStorage.getItem('kv_saved_profiles') || '[]'); } catch(e) { return []; }
  }

  function getSavedProfileDisplayName(p) {
    if (p && p.displayName) return p.displayName;
    var active = p && Array.isArray(p.linkedAccounts)
      ? (p.linkedAccounts.find(function(account) { return account.id === p.activeAccountId; }) || p.linkedAccounts[0])
      : null;
    if (active) return getPlatformLabel(active.platform) + ' @' + active.username;
    if (p && p.chesscomUsername) return 'Chess.com @' + p.chesscomUsername;
    if (p && p.lichessUsername) return 'Lichess @' + p.lichessUsername;
    return 'Unnamed';
  }

  function isActiveSavedProfile(saved, active) {
    return String(saved.displayName || '') === String(active.displayName || '') &&
      String(saved.activeAccountId || '') === String(active.activeAccountId || '') &&
      String(saved.chesscomUsername || '') === String(active.chesscomUsername || '') &&
      String(saved.lichessUsername || '') === String(active.lichessUsername || '');
  }

  function saveCurrentAsProfile(p, silent) {
    var profiles = getSavedProfiles();
    var existing = profiles.findIndex(function(x) { return x.displayName === p.displayName; });
    var entry = Object.assign({}, migrateProfileAccounts(p), { savedAt: new Date().toISOString(), id: Date.now() });
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
      container.innerHTML =
        '<div class="dashboard-empty-state">' +
          '<div class="dashboard-empty-title">No saved profiles yet</div>' +
          '<div class="dashboard-empty-copy">Edit your profile, then save it here for quick switching.</div>' +
        '</div>';
      return;
    }

    container.innerHTML = profiles.map(function(p) {
      var displayName = getSavedProfileDisplayName(p);
      var initials = displayName ? displayName.replace(/^.*@/, '').substring(0, 2).toUpperCase() : '??';
      var parts = displayName.trim().split(' ');
      if (parts.length >= 2) initials = (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
      var isActive = isActiveSavedProfile(p, active);
      var linked = migrateProfileAccounts(p).linkedAccounts || [];
      var accounts = linked.map(function(account) {
        return (account.platform === 'chesscom' ? '&#9823; ' : '&#9820; ') + escapeHtml(account.username) + (account.id === p.activeAccountId ? ' active' : '');
      }).join(' \u00b7 ') || 'No linked accounts';
      var meta = 'Stockfish \u00b7 Depth ' + escapeHtml(String(p.prefDepth || 20));
      var safeId = escapeAttr(p.id);
      var fetchActions = [
        linked.some(function(account) { return account.platform === 'chesscom'; }) ? '<button type="button" class="sp-fetch-btn" data-profile-fetch="' + safeId + '" data-profile-platform="chesscom">Fetch Chess.com</button>' : '',
        linked.some(function(account) { return account.platform === 'lichess'; }) ? '<button type="button" class="sp-fetch-btn" data-profile-fetch="' + safeId + '" data-profile-platform="lichess">Fetch Lichess</button>' : ''
      ].filter(Boolean).join('');

      return '<div class="saved-profile-item' + (isActive ? ' active-profile' : '') + '" data-profile-id="' + safeId + '">' +
        '<div class="sp-avatar">' + escapeHtml(initials) + '</div>' +
        '<div class="sp-info">' +
          '<div class="sp-name">' + escapeHtml(displayName) + '</div>' +
          '<div class="sp-meta sp-accounts">Linked: ' + accounts + '</div>' +
          '<div class="sp-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="sp-actions">' +
          fetchActions +
          '<button type="button" class="sp-load-btn" data-profile-load="' + safeId + '">Load</button>' +
          '<button type="button" class="sp-del-btn" data-profile-delete="' + safeId + '">\u2715</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function fetchSavedProfileGames(id, platform) {
    var profiles = getSavedProfiles();
    var p = profiles.find(function(x) { return String(x.id) === String(id); });
    if (!p) return;
    var normalizedPlatform = platform === 'lichess' ? 'lichess' : 'chesscom';
    p = migrateProfileAccounts(p);
    var account = (p.linkedAccounts || []).find(function(item) {
      return item.platform === normalizedPlatform && item.id === p.activeAccountId;
    }) || (p.linkedAccounts || []).find(function(item) { return item.platform === normalizedPlatform; });
    if (!account || !account.username) {
      AppController.showToast('No ' + getPlatformLabel(normalizedPlatform) + ' account saved on this profile', 'error');
      return;
    }
    p.activeAccountId = account.id;
    localStorage.setItem('kv_profile', JSON.stringify(syncLegacyAccountFields(p)));
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    setAccountPanel(normalizedPlatform);
    fetchPlatformGames(normalizedPlatform, account.username);
  }

  function loadProfileFn(id) {
    var profiles = getSavedProfiles();
    var p = profiles.find(function(x) { return String(x.id) === String(id); });
    if (!p) return;
    localStorage.setItem('kv_profile', JSON.stringify(migrateProfileAccounts(p)));
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
  function getPlatformLabel(platform) {
    return platform === 'chesscom' ? 'Chess.com' : 'Lichess';
  }

  function getPlatformInputId(platform) {
    return platform === 'chesscom' ? 'chesscomUsername' : 'lichessUsername';
  }

  function getAccountPanelCopy(platform, isLinked) {
    var label = getPlatformLabel(platform);
    if (!isLinked) return 'Link your ' + label + ' username to fetch recent games.';
    return platform === 'chesscom'
      ? 'Use Fetch Games to open your latest 3 months of Chess.com archives in the Games tab.'
      : 'Use Fetch Games to load your latest Lichess games here.';
  }

  function renderAccountPanelState(platform, state, title, copy, force) {
    var list = document.getElementById(platform + 'GamesList');
    if (!list) return;
    if (!force && list.querySelector('.fetch-game-item')) return;
    list.innerHTML =
      '<div class="account-panel-state is-' + escapeAttr(state || 'empty') + '">' +
        '<div class="account-panel-state-title">' + escapeHtml(title || '') + '</div>' +
        (copy ? '<div class="account-panel-state-copy">' + escapeHtml(copy) + '</div>' : '') +
      '</div>';
  }

  function bindHomeClick(target, key, handler) {
    var el = getEl(target);
    if (!el || el.dataset[key] === '1') return;
    el.dataset[key] = '1';
    bindClick(el, handler);
  }

  function setAccountPanel(platform) {
    var activePlatform = platform === 'lichess' ? 'lichess' : 'chesscom';
    [
      { name: 'chesscom', panelId: 'acctPanelChesscom', toggleId: 'toggleChesscom' },
      { name: 'lichess', panelId: 'acctPanelLichess', toggleId: 'toggleLichess' }
    ].forEach(function(item) {
      var isActive = item.name === activePlatform;
      var panel = document.getElementById(item.panelId);
      var toggle = document.getElementById(item.toggleId);
      if (panel) panel.style.display = isActive ? '' : 'none';
      if (toggle) {
        toggle.classList.toggle('active', isActive);
        toggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    });
  }

  function setupAccountPanelTabs() {
    document.querySelectorAll('.acct-toggle-btn[data-account-panel]').forEach(function(btn) {
      if (btn.dataset.homeAccountBound === '1') return;
      btn.dataset.homeAccountBound = '1';
      bindClick(btn, function() {
        setAccountPanel(btn.getAttribute('data-account-panel') || 'chesscom');
      });
    });
    setAccountPanel('chesscom');
  }

  function setupAccountLinks() {
    bindHomeClick('linkedAccountsList', 'homeLinkedAccountsBound', function(e) {
      if (!e.target || !e.target.closest) return;
      var switchBtn = e.target.closest('[data-account-switch]');
      if (switchBtn) {
        switchLinkedAccount(switchBtn.getAttribute('data-account-switch'));
        return;
      }
      var syncBtn = e.target.closest('[data-account-sync]');
      if (syncBtn) {
        syncLinkedAccount(syncBtn.getAttribute('data-account-sync'), true);
        return;
      }
      var removeBtn = e.target.closest('[data-account-remove]');
      if (removeBtn) {
        removeLinkedAccount(removeBtn.getAttribute('data-account-remove'));
      }
    });

    bindHomeClick('linkAnotherAccountBtn', 'homeLinkAnotherBound', function() {
      var platform = document.querySelector('.acct-toggle-btn.active[data-account-panel]');
      var activePlatform = platform ? platform.getAttribute('data-account-panel') : 'chesscom';
      var input = document.getElementById(getPlatformInputId(activePlatform));
      if (input && input.focus) input.focus();
    });

    // Chess.com
    bindHomeClick('linkChesscom', 'homeLinkBound', function() {
      var input = document.getElementById('chesscomUsername');
      var val = normalizeUsername(input ? input.value : '');
      if (!val) { AppController.showToast('Enter a Chess.com username', 'error'); return; }
      if (input) input.value = val;
      linkAccount('chesscom', val);
    });
    bindHomeClick('unlinkChesscom', 'homeUnlinkBound', function() {
      var account = getActiveLinkedAccount('chesscom');
      if (account) removeLinkedAccount(account.id);
    });
    bindHomeClick('fetchChesscomGames', 'homeFetchBound', function() {
      var account = getActiveLinkedAccount('chesscom');
      if (account) fetchPlatformGames('chesscom', account.username);
      else AppController.showToast('Link your Chess.com username first', 'error');
    });

    // Lichess
    bindHomeClick('linkLichess', 'homeLinkBound', function() {
      var input = document.getElementById('lichessUsername');
      var val = normalizeUsername(input ? input.value : '');
      if (!val) { AppController.showToast('Enter a Lichess username', 'error'); return; }
      if (input) input.value = val;
      linkAccount('lichess', val);
    });
    bindHomeClick('unlinkLichess', 'homeUnlinkBound', function() {
      var account = getActiveLinkedAccount('lichess');
      if (account) removeLinkedAccount(account.id);
    });
    bindHomeClick('fetchLichessGames', 'homeFetchBound', function() {
      var account = getActiveLinkedAccount('lichess');
      if (account) fetchPlatformGames('lichess', account.username);
      else AppController.showToast('Link your Lichess username first', 'error');
    });
  }

  function linkAccount(platform, username) {
    username = normalizeUsername(username);
    platform = normalizePlatform(platform);
    if (!username) {
      AppController.showToast('Enter a ' + (platform === 'chesscom' ? 'Chess.com' : 'Lichess') + ' username', 'error');
      return;
    }
    var p = getProfile();
    var id = getAccountId(platform, username);
    if ((p.linkedAccounts || []).some(function(account) { return account.id === id; })) {
      AppController.showToast(getPlatformLabel(platform) + ' @' + username + ' is already linked', 'error');
      return;
    }
    renderAccountPanelState(platform, 'loading', 'Linking ' + getPlatformLabel(platform), 'Checking @' + username + ' and fetching profile data.', true);
    setLinkButtonLoading(platform, true);
    fetchBasicAccountProfile(platform, username)
      .then(function(meta) {
        var current = getProfile();
        var account = createLinkedAccount(platform, username, Object.assign({}, meta || {}, {
          lastSynced: new Date().toISOString(),
          isActive: true
        }));
        current.linkedAccounts = (current.linkedAccounts || []).concat(account);
        current.activeAccountId = account.id;
        current = saveProfileObject(current);
        saveCurrentAsProfile(current, true);
        clearPlatformInput(platform);
        loadProfileToHome();
        restoreLinkedAccounts();
        renderSavedProfilesList();
        if (platform === 'chesscom') {
          setChesscomRatingsState(account.ratingData, username);
        }
        AppController.showToast(getPlatformLabel(platform) + ' account linked', 'success');
      })
      .catch(function(err) {
        renderAccountPanelState(platform, 'error', 'Could not link account', describeAccountLinkError(platform, username, err), true);
        AppController.showToast(describeAccountLinkError(platform, username, err), 'error');
      })
      .finally(function() {
        setLinkButtonLoading(platform, false);
      });
  }

  function setLinkButtonLoading(platform, loading) {
    var btn = document.getElementById(platform === 'chesscom' ? 'linkChesscom' : 'linkLichess');
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? 'Linking...' : 'Link';
  }

  function clearPlatformInput(platform) {
    var input = document.getElementById(getPlatformInputId(platform));
    if (input) input.value = '';
  }

  function describeAccountLinkError(platform, username, err) {
    if (err && err.status === 404) return getPlatformLabel(platform) + ' user @' + username + ' was not found.';
    if (err && err.timeout) return getPlatformLabel(platform) + ' profile lookup timed out. Try again.';
    return 'Could not verify ' + getPlatformLabel(platform) + ' @' + username + '.';
  }

  function fetchBasicAccountProfile(platform, username) {
    platform = normalizePlatform(platform);
    username = normalizeUsername(username);
    if (platform === 'chesscom') {
      var encodedChesscom = encodeURIComponent(username);
      return AppController.fetchChesscomWithFallback(
        '/api/chesscom/player/' + encodedChesscom,
        'https://api.chess.com/pub/player/' + encodedChesscom,
        'json'
      ).then(function(profilePayload) {
        return AppController.fetchChesscomWithFallback(
          '/api/chesscom/player/' + encodedChesscom + '/stats',
          'https://api.chess.com/pub/player/' + encodedChesscom + '/stats',
          'json'
        ).catch(function() { return null; }).then(function(stats) {
          return {
            displayName: profilePayload && (profilePayload.name || profilePayload.username) || username,
            avatar: profilePayload && profilePayload.avatar || '',
            ratingData: stats ? {
              bullet: extractChesscomRating(stats, 'chess_bullet'),
              blitz: extractChesscomRating(stats, 'chess_blitz'),
              rapid: extractChesscomRating(stats, 'chess_rapid')
            } : null
          };
        });
      });
    }
    var encodedLichess = encodeURIComponent(username);
    return AppController.fetchTextWithFallback(
      '/api/lichess/user/' + encodedLichess,
      'https://lichess.org/api/user/' + encodedLichess,
      { Accept: 'application/json' }
    ).then(function(text) {
      var payload = {};
      try { payload = JSON.parse(text); } catch(e) { payload = {}; }
      var perfs = payload.perfs || {};
      return {
        displayName: payload.username || username,
        avatar: '',
        ratingData: {
          bullet: perfs.bullet && perfs.bullet.rating ? String(perfs.bullet.rating) : '—',
          blitz: perfs.blitz && perfs.blitz.rating ? String(perfs.blitz.rating) : '—',
          rapid: perfs.rapid && perfs.rapid.rating ? String(perfs.rapid.rating) : '—'
        }
      };
    });
  }

  function switchLinkedAccount(accountId) {
    var p = getProfile();
    var account = (p.linkedAccounts || []).find(function(item) { return item.id === accountId; });
    if (!account) return;
    p.activeAccountId = account.id;
    p = saveProfileObject(p);
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    setAccountPanel(account.platform);
    if (account.platform === 'chesscom') refreshChesscomRatings();
    AppController.showToast('Active account: ' + getPlatformLabel(account.platform) + ' @' + account.username, 'success');
  }

  function removeLinkedAccount(accountId) {
    var p = getProfile();
    var removed = (p.linkedAccounts || []).find(function(account) { return account.id === accountId; });
    if (!removed) return;
    p.linkedAccounts = (p.linkedAccounts || []).filter(function(account) { return account.id !== accountId; });
    if (p.activeAccountId === accountId) {
      p.activeAccountId = p.linkedAccounts.length ? p.linkedAccounts[0].id : '';
    }
    p = saveProfileObject(p);
    saveCurrentAsProfile(p, true);
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    if (removed.platform === 'chesscom') refreshChesscomRatings();
    AppController.showToast('Removed ' + getPlatformLabel(removed.platform) + ' @' + removed.username, '');
  }

  function syncLinkedAccount(accountId, fetchGamesAfterSync) {
    var p = getProfile();
    var account = (p.linkedAccounts || []).find(function(item) { return item.id === accountId; });
    if (!account) return;
    accountSyncRequests[account.id] = true;
    renderLinkedAccountsList();
    renderAccountPanelState(account.platform, 'loading', 'Syncing ' + getPlatformLabel(account.platform), 'Refreshing profile and rating data for @' + account.username + '.', true);
    fetchBasicAccountProfile(account.platform, account.username)
      .then(function(meta) {
        var current = getProfile();
        current.linkedAccounts = (current.linkedAccounts || []).map(function(item) {
          if (item.id !== account.id) return item;
          return Object.assign({}, item, meta || {}, { lastSynced: new Date().toISOString() });
        });
        current = saveProfileObject(current);
        saveCurrentAsProfile(current, true);
        loadProfileToHome();
        restoreLinkedAccounts();
        renderSavedProfilesList();
        if (fetchGamesAfterSync) fetchPlatformGames(account.platform, account.username);
      })
      .catch(function(err) {
        renderAccountPanelState(account.platform, 'error', 'Could not sync account', describeAccountLinkError(account.platform, account.username, err), true);
      })
      .finally(function() {
        delete accountSyncRequests[account.id];
        renderLinkedAccountsList();
      });
  }

  function formatAccountRatingSummary(account) {
    var ratings = account && account.ratingData ? account.ratingData : null;
    if (!ratings) return 'Ratings unavailable';
    var parts = [];
    if (ratings.rapid && ratings.rapid !== '—') parts.push('Rapid ' + ratings.rapid);
    if (ratings.blitz && ratings.blitz !== '—') parts.push('Blitz ' + ratings.blitz);
    if (ratings.bullet && ratings.bullet !== '—') parts.push('Bullet ' + ratings.bullet);
    return parts.length ? parts.join(' · ') : 'Ratings unavailable';
  }

  function formatAccountSynced(account) {
    if (!account || !account.lastSynced) return 'Not synced yet';
    var date = new Date(account.lastSynced);
    if (!date || isNaN(date.getTime())) return 'Not synced yet';
    return 'Synced ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderLinkedAccountsList() {
    var container = document.getElementById('linkedAccountsList');
    if (!container) return;
    var p = getProfile();
    var accounts = p.linkedAccounts || [];
    if (!accounts.length) {
      container.innerHTML =
        '<div class="account-panel-state is-empty">' +
          '<div class="account-panel-state-title">No accounts linked</div>' +
          '<div class="account-panel-state-copy">Link a Chess.com or Lichess username below.</div>' +
        '</div>';
      return;
    }
    container.innerHTML = accounts.map(function(account) {
      var active = account.id === p.activeAccountId;
      var syncing = !!accountSyncRequests[account.id];
      return '<div class="linked-account-row' + (active ? ' is-active' : '') + '">' +
        '<div class="linked-account-avatar">' +
          (account.avatar ? '<img src="' + escapeAttr(account.avatar) + '" alt="" />' : '<span>' + (account.platform === 'chesscom' ? '&#9823;' : '&#9820;') + '</span>') +
        '</div>' +
        '<div class="linked-account-main">' +
          '<div class="linked-account-top">' +
            '<span class="linked-account-platform">' + escapeHtml(getPlatformLabel(account.platform)) + '</span>' +
            (active ? '<span class="linked-account-active">Active</span>' : '') +
          '</div>' +
          '<div class="linked-account-name">@' + escapeHtml(account.username) + '</div>' +
          '<div class="linked-account-meta">' + escapeHtml(formatAccountRatingSummary(account)) + '</div>' +
          '<div class="linked-account-meta">' + escapeHtml(formatAccountSynced(account)) + '</div>' +
        '</div>' +
        '<div class="linked-account-actions">' +
          '<button type="button" class="btn-sm-green" data-account-switch="' + escapeAttr(account.id) + '"' + (active ? ' disabled' : '') + '>Switch</button>' +
          '<button type="button" class="btn-sm-green" data-account-sync="' + escapeAttr(account.id) + '"' + (syncing ? ' disabled' : '') + '>' + (syncing ? 'Syncing' : 'Sync') + '</button>' +
          '<button type="button" class="btn-sm-red" data-account-remove="' + escapeAttr(account.id) + '">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateAccountUI(platform, username) {
    var statusEl = document.getElementById(platform + 'Status');
    var linkedInfo = document.getElementById(platform + 'LinkedInfo');
    var linkedName = document.getElementById(platform + 'LinkedName');
    var inputEl = document.getElementById(getPlatformInputId(platform));
    var inputRow = inputEl ? inputEl.closest('.account-input-row') : null;
    var linkButton = document.getElementById(platform === 'chesscom' ? 'linkChesscom' : 'linkLichess');
    var label = getPlatformLabel(platform);

    var active = getActiveLinkedAccount(platform);
    var count = getLinkedAccounts().filter(function(account) { return account.platform === platform; }).length;

    if (username) {
      if (statusEl) { statusEl.textContent = count + ' linked'; statusEl.classList.add('linked'); }
      if (linkedInfo) linkedInfo.style.display = 'none';
      if (linkedName) linkedName.textContent = '@' + username;
      if (inputEl) {
        inputEl.value = '';
        inputEl.placeholder = active ? 'Active: ' + active.username : label + ' username...';
      }
      if (inputRow) inputRow.style.display = 'flex';
      if (linkButton) linkButton.textContent = 'Link';
      renderAccountPanelState(platform, 'ready', label + ' ready', active ? ('Active account @' + active.username + '. Use Sync on its account row to fetch games.') : 'Choose an account from the linked accounts list.', true);
    } else {
      if (statusEl) { statusEl.textContent = 'Not linked'; statusEl.classList.remove('linked'); }
      if (linkedInfo) linkedInfo.style.display = 'none';
      if (linkedName) linkedName.textContent = '';
      if (inputEl) inputEl.placeholder = label + ' username...';
      if (inputRow) inputRow.style.display = 'flex';
      if (linkButton) linkButton.textContent = 'Link';
      renderAccountPanelState(platform, 'empty', 'No account linked', getAccountPanelCopy(platform, false), true);
    }
  }

  function restoreLinkedAccounts() {
    var p = getProfile();
    var ccInput = document.getElementById('chesscomUsername');
    var lcInput = document.getElementById('lichessUsername');
    var chesscom = getActiveLinkedAccount('chesscom');
    var lichess = getActiveLinkedAccount('lichess');
    renderLinkedAccountsList();
    if (chesscom) {
      if (ccInput) ccInput.value = '';
      updateAccountUI('chesscom', chesscom.username);
    } else {
      updateAccountUI('chesscom', null);
    }
    if (lichess) {
      if (lcInput) lcInput.value = '';
      updateAccountUI('lichess', lichess.username);
    } else {
      updateAccountUI('lichess', null);
    }
  }

  function isGameReviewed(white, black, result) {
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch { /* corrupt data – start with empty db */ }
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

  function buildChesscomArchiveRange(endArchive, monthCount) {
    var fallback = getYesterdayArchiveDate();
    var safeArchive = endArchive || fallback;
    var year = parseInt(safeArchive.year, 10);
    var month = parseInt(safeArchive.month, 10);
    if (isNaN(year) || year < 2000) year = fallback.year;
    if (isNaN(month) || month < 1 || month > 12) month = parseInt(fallback.month, 10);

    var count = Math.max(1, parseInt(monthCount, 10) || CHESSCOM_FETCH_MONTHS);
    var archives = [];
    for (var i = count - 1; i >= 0; i--) {
      var date = new Date(Date.UTC(year, month - 1 - i, 1));
      archives.push({
        year: date.getUTCFullYear(),
        month: String(date.getUTCMonth() + 1).padStart(2, '0')
      });
    }
    return archives;
  }

  function resolveChesscomUsername(preferredUsername) {
    var activeChesscom = getActiveLinkedAccount('chesscom');
    var candidates = [
      preferredUsername,
      activeChesscom && activeChesscom.username,
      (document.getElementById('gamesTabUser') || {}).textContent,
      window._ccFetchedUsername,
      (document.getElementById('chesscomLinkedName') || {}).textContent,
      (document.getElementById('chesscomUsername') || {}).value,
      getProfile().chesscomUsername
    ];

    for (var i = 0; i < candidates.length; i++) {
      var username = normalizeUsername(candidates[i]);
      if (username && username.toLowerCase() !== 'username') return username;
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
    var archives = Array.isArray(archiveOverride)
      ? archiveOverride
      : buildChesscomArchiveRange(archiveOverride || getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
    return normalizeUsername(username) + ':' + archives.map(function(archive) {
      return archive.year + '-' + archive.month;
    }).join(',');
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
      var archive = window._ccFetchedUsername === username && window._ccFetchedArchivePeriod
        ? window._ccFetchedArchivePeriod
        : buildChesscomArchiveRange(getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
      if (controls) controls.style.display = 'flex';
      if (filters) filters.style.display = window._ccFetchedGames && window._ccFetchedGames.length && window._ccFetchedUsername === username ? 'flex' : 'none';
      if (sub) sub.textContent = 'Chess.com archive range: ' + formatChesscomArchiveLabel(archive) + '.';
      if (userEl) userEl.textContent = '@' + username;
      updateGamesTabOverview({
        username: username,
        archive: archive,
        filter: getGamesTabFilter(),
        total: 0,
        filtered: 0,
        reviewed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        modes: 'No archive'
      });
    } else {
      if (controls) controls.style.display = 'none';
      if (filters) filters.style.display = 'none';
      if (sub) sub.textContent = 'Link your Chess.com account on the Home tab, then fetch the latest 3 months here.';
      updateGamesTabOverview({});
    }
    if (window._ccFetchedGames && window._ccFetchedGames.length && username && window._ccFetchedUsername === username) {
      var container = document.getElementById('gamesTabList');
      if (container) renderGamesTab(container, window._ccFetchedGames, username);
    } else if (username) {
      var emptyContainer = document.getElementById('gamesTabList');
      if (emptyContainer) {
        emptyContainer.innerHTML = buildGamesTabEmptyState('No archive loaded yet', 'Fetch the latest 3 months of Chess.com games to review openings, results, and unfinished analysis.');
      }
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

  function formatChesscomArchiveLabel(archive) {
    if (Array.isArray(archive)) {
      if (!archive.length) return 'latest 3 months';
      if (archive.length === 1) return formatChesscomArchiveLabel(archive[0]);
      return formatChesscomArchiveLabel(archive[0]) + ' - ' + formatChesscomArchiveLabel(archive[archive.length - 1]);
    }
    if (!archive || !archive.year || !archive.month) return 'latest archive';
    var date = new Date(Date.UTC(Number(archive.year), Number(archive.month) - 1, 1));
    if (!date || isNaN(date.getTime())) return String(archive.year) + '/' + String(archive.month);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function getChesscomGameSortTime(game) {
    if (!game) return 0;
    if (game.end_time) return game.end_time * 1000;
    var headers = game.headers || {};
    var dateText = headers.EndDate || game.date || headers.Date || '';
    var timeText = headers.EndTime || '00:00:00';
    if (!dateText) return 0;
    var date = new Date(String(dateText).replace(/\./g, '-') + 'T' + timeText + 'Z');
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  function getChesscomGameOpening(game) {
    return AppController.formatChesscomOpeningLabel(game);
  }

  function getChesscomGameTimeLabel(timeClass) {
    var normalized = String(timeClass || '').toLowerCase();
    if (normalized === 'bullet') return 'Bullet';
    if (normalized === 'blitz') return 'Blitz';
    if (normalized === 'rapid') return 'Rapid';
    if (normalized === 'daily') return 'Daily';
    if (!normalized) return 'Rapid';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function getGamesTabFilterLabel(filter) {
    if (filter === 'win') return 'Wins';
    if (filter === 'lost') return 'Losses';
    if (filter === 'draw') return 'Draws';
    if (filter === 'reviewed') return 'Reviewed';
    if (filter === 'not-reviewed') return 'Needs Review';
    return 'All Games';
  }

  function buildGamesTabEmptyState(title, copy) {
    return '<div class="games-empty-state">' +
      '<div class="games-empty-icon">&#9823;</div>' +
      '<div class="games-empty-title">' + escapeHtml(title || 'No games available') + '</div>' +
      '<div class="games-empty-copy">' + escapeHtml(copy || 'Fetch recent Chess.com archives to populate this view.') + '</div>' +
    '</div>';
  }

  function renderGamesTabSkeleton(container, labelText) {
    if (!container) return;
    var label = labelText || 'Loading games';
    var rows = '';
    for (var i = 0; i < 5; i++) {
      rows += '<article class="gt-game-row games-skeleton-row" aria-hidden="true">' +
        '<div class="gt-row-main">' +
          '<div class="gt-row-head">' +
            '<div class="gt-title-block">' +
              '<div class="skeleton-line w-55"></div>' +
              '<div class="gt-subline"><span class="skeleton-chip"></span><span class="skeleton-chip small"></span></div>' +
            '</div>' +
            '<div class="gt-result-col"><span class="skeleton-chip"></span><span class="skeleton-chip small"></span></div>' +
          '</div>' +
          '<div class="gt-row-body">' +
            '<div class="gt-player-line"><span class="skeleton-line w-72"></span></div>' +
            '<div class="gt-meta"><span class="skeleton-chip"></span><span class="skeleton-chip"></span></div>' +
          '</div>' +
        '</div>' +
        '<div class="gt-actions"><span class="skeleton-chip"></span><span class="skeleton-chip"></span></div>' +
      '</article>';
    }
    container.innerHTML =
      '<div class="games-list-banner games-list-banner-loading">' +
        '<div class="games-count">' +
          '<span class="games-count-main">' + escapeHtml(label) + '</span>' +
          '<span class="games-count-sub">Preparing a 50-game page</span>' +
        '</div>' +
        '<div class="games-list-banner-meta">Syncing archive</div>' +
      '</div>' +
      '<div class="games-list-stack">' + rows + '</div>';
  }

  function buildGamesTabPagination(currentPage, pageCount, total, startNumber, endNumber) {
    if (!total || pageCount <= 1) return '';
    var candidates = [1, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, pageCount];
    var seen = {};
    var pages = candidates
      .filter(function(page) {
        page = Number(page);
        if (page < 1 || page > pageCount || seen[page]) return false;
        seen[page] = true;
        return true;
      })
      .sort(function(a, b) { return a - b; });
    var buttons = '';
    var lastPage = 0;
    pages.forEach(function(page) {
      if (lastPage && page - lastPage > 1) {
        buttons += '<span class="games-page-ellipsis">...</span>';
      }
      if (page === currentPage) {
        buttons += '<button type="button" class="games-page-btn is-active" aria-current="page">' + page + '</button>';
      } else {
        buttons += '<button type="button" class="games-page-btn" onclick="HomeController.setGamesTabPage(' + page + ')">' + page + '</button>';
      }
      lastPage = page;
    });

    return '<nav class="games-pagination" aria-label="Games pagination">' +
      '<div class="games-page-summary">Showing ' + startNumber + '-' + endNumber + ' of ' + total + ' &middot; ' + GAMES_TAB_PAGE_SIZE + ' per page</div>' +
      '<div class="games-page-controls">' +
        '<button type="button" class="games-page-btn games-page-nav" ' + (currentPage <= 1 ? 'disabled' : 'onclick="HomeController.setGamesTabPage(' + (currentPage - 1) + ')"') + '>Previous</button>' +
        buttons +
        '<button type="button" class="games-page-btn games-page-nav" ' + (currentPage >= pageCount ? 'disabled' : 'onclick="HomeController.setGamesTabPage(' + (currentPage + 1) + ')"') + '>Next</button>' +
      '</div>' +
    '</nav>';
  }

  function summarizeGamesTabModes(items) {
    var counts = {};
    (items || []).forEach(function(item) {
      var key = String(item.timeLabel || '').trim() || 'Rapid';
      counts[key] = (counts[key] || 0) + 1;
    });
    var ranked = Object.keys(counts)
      .map(function(key) { return { label: key, count: counts[key] }; })
      .sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 2);
    if (!ranked.length) return 'No archive';
    return ranked.map(function(entry) {
      return entry.label + ' ' + entry.count;
    }).join(' · ');
  }

  function updateGamesTabOverview(state) {
    state = state || {};
    var total = Number(state.total || 0);
    var filtered = Number(state.filtered != null ? state.filtered : total);
    var wins = Number(state.wins || 0);
    var losses = Number(state.losses || 0);
    var draws = Number(state.draws || 0);
    var reviewed = Number(state.reviewed || 0);
    var username = normalizeUsername(state.username || '');
    var archiveLabel = formatChesscomArchiveLabel(state.archive);
    var filterLabel = getGamesTabFilterLabel(state.filter || 'all');
    var summaryTitle = 'No archive loaded yet';
    var summaryMeta = 'Sync recent Chess.com archives to review games, openings, and analysis coverage.';

    if (!username) {
      summaryTitle = 'Connect Chess.com to get started';
      summaryMeta = 'Link your account on the Home tab, then sync the latest 3 months here.';
    } else if (state.loading) {
      summaryTitle = 'Fetching @' + username + ' games';
      summaryMeta = 'Loading games from ' + archiveLabel + '.';
    } else if (state.error) {
      summaryTitle = 'Could not load ' + archiveLabel;
      summaryMeta = String(state.error);
    } else if (!total) {
      summaryTitle = 'No games found in ' + archiveLabel;
      summaryMeta = '@' + username + ' is connected, but this period has no parsed games yet.';
    } else if (!filtered) {
      summaryTitle = 'No ' + filterLabel.toLowerCase() + ' in ' + archiveLabel;
      summaryMeta = '@' + username + ' · ' + wins + '-' + losses + '-' + draws + ' · ' + reviewed + ' reviewed';
    } else if ((state.filter || 'all') === 'all') {
      summaryTitle = total + ' game' + (total !== 1 ? 's' : '') + ' in ' + archiveLabel;
      summaryMeta = '@' + username + ' · ' + wins + '-' + losses + '-' + draws + ' · ' + reviewed + ' reviewed';
    } else {
      summaryTitle = filtered + ' ' + filterLabel.toLowerCase() + ' in ' + archiveLabel;
      summaryMeta = '@' + username + ' · ' + wins + '-' + losses + '-' + draws + ' overall · ' + reviewed + ' reviewed';
    }

    var totalEl = document.getElementById('gamesMetricTotal');
    var recordEl = document.getElementById('gamesMetricRecord');
    var reviewedEl = document.getElementById('gamesMetricReviewed');
    var modesEl = document.getElementById('gamesMetricModes');
    var titleEl = document.getElementById('gamesSummaryTitle');
    var metaEl = document.getElementById('gamesSummaryMeta');

    if (totalEl) totalEl.textContent = username ? String(total) : '--';
    if (recordEl) recordEl.textContent = username ? (total ? (wins + '-' + losses + '-' + draws) : '0-0-0') : '--';
    if (reviewedEl) reviewedEl.textContent = username ? (total ? (reviewed + ' / ' + total) : '0 / 0') : '--';
    if (modesEl) modesEl.textContent = username ? String(state.modes || 'No archive') : 'No archive';
    if (titleEl) titleEl.textContent = summaryTitle;
    if (metaEl) metaEl.textContent = summaryMeta;
  }

  function fetchChesscomGames(username, archiveOverride) {
    username = String(username || '').trim().replace(/^@+/, '');
    var container = document.getElementById('gamesTabList');
    if (!container) return;
    var archive = Array.isArray(archiveOverride)
      ? archiveOverride
      : buildChesscomArchiveRange(archiveOverride || getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
    var archiveLabel = formatChesscomArchiveLabel(archive);
    var controls = document.getElementById('gamesTabControls');
    var filters = document.getElementById('gamesTabFilters');
    var sub = document.getElementById('gamesTabSub');
    var userEl = document.getElementById('gamesTabUser');
    if (controls) controls.style.display = 'flex';
    if (filters) filters.style.display = 'none';
    if (sub) sub.textContent = 'Chess.com archive range: ' + archiveLabel + '.';
    if (userEl) userEl.textContent = '@' + username;
    window._gamesTabPage = 1;
    updateGamesTabOverview({
      username: username,
      archive: archive,
      filter: getGamesTabFilter(),
      loading: true,
      modes: 'Syncing...'
    });
    renderGamesTabSkeleton(container, 'Fetching 3 months of games for ' + username + '...');

    var archiveKey = getCurrentChesscomArchiveKey(username, archive);
    window._ccLastRequestedArchiveKey = archiveKey;
    fetchChesscomGamesFromArchive(username, archive)
      .then(function(games) {
        if (window._ccLastRequestedArchiveKey !== archiveKey) return;
        window._ccFetchedUsername = username;
        window._ccFetchedArchiveKey = archiveKey;
        window._ccFetchedArchivePeriod = archive;
        if (!games.length) {
          window._ccFetchedGames = [];
          if (filters) filters.style.display = 'none';
          if (sub) sub.textContent = 'No games found in ' + archiveLabel + '.';
          updateGamesTabOverview({
            username: username,
            archive: archive,
            filter: getGamesTabFilter(),
            total: 0,
            filtered: 0,
            reviewed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            modes: 'No archive'
          });
          container.innerHTML = buildGamesTabEmptyState('No games found in this period', 'Try again after you play a few games or switch to a newer archive range.');
          return;
        }
        window._ccFetchedGames = games;
        if (filters) filters.style.display = 'flex';
        if (sub) sub.textContent = 'Synced from Chess.com for ' + archiveLabel + '. Analyze any game directly from the archive range.';
        renderGamesTab(container, games, username);
      })
      .catch(function(err) {
        if (window._ccLastRequestedArchiveKey !== archiveKey) return;
        console.error('Chess.com fetch error:', err);
        window._ccFetchedGames = [];
        window._ccFetchedUsername = username;
        window._ccFetchedArchiveKey = archiveKey;
        window._ccFetchedArchivePeriod = archive;
        if (filters) filters.style.display = 'none';
        if (sub) sub.textContent = 'Chess.com archive sync failed for ' + archiveLabel + '.';
        var errorText = AppController.describeChesscomError(err, username, archiveLabel);
        updateGamesTabOverview({
          username: username,
          archive: archive,
          filter: getGamesTabFilter(),
          error: errorText,
          modes: 'Unavailable'
        });
        container.innerHTML = buildGamesTabEmptyState('Archive unavailable', errorText);
      });
  }

  function fetchChesscomGamesFromArchive(username, archive) {
    var archives = Array.isArray(archive) ? archive : [archive];
    return Promise.all(archives.map(function(item) {
      return AppController.fetchChesscomMonthPgn(username, item.year, item.month)
        .then(function(text) {
          return { archive: item, games: AppController.parseChesscomArchiveGames(text) || [] };
        })
        .catch(function(err) {
          return { archive: item, error: err, games: [] };
        });
    })).then(function(results) {
      var games = [];
      var errors = [];
      results.forEach(function(result) {
        if (result.error) errors.push(result.error);
        games = games.concat(result.games || []);
      });
      if (!games.length && errors.length === results.length && errors.length) {
        throw errors.find(function(err) {
          return err && err.status !== 404 && !err.invalidResponse;
        }) || errors[0];
      }
      return games.sort(function(a, b) {
        return getChesscomGameSortTime(b) - getChesscomGameSortTime(a);
      });
    });
  }

  function renderHomeChesscomGames(container, games, username, archive) {
    var intro = '<div class="games-count">' + games.length + ' game' + (games.length !== 1 ? 's' : '') +
      ' from ' + formatChesscomArchiveLabel(archive) + '</div>';
    var rows = games.map(function(g, idx) {
      var white = getChesscomGameWhiteName(g);
      var black = getChesscomGameBlackName(g);
      var result = getChesscomGameResult(g);
      var resultClass = result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d';
      var opening = AppController.formatChesscomOpeningLabel(g);
      var date = getChesscomGameDisplayDate(g) || g.date || '';
      return '<div class="fetch-game-item" data-cc-idx="' + idx + '" onclick="HomeController.loadChesscomGame(' + idx + ')">' +
        '<strong>' + escapeHtml(white) + '</strong> vs <strong>' + escapeHtml(black) + '</strong>' +
        (opening ? ' \u2014 ' + escapeHtml(opening.substring(0, 28)) : '') +
        '<span class="fetch-game-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
        (date ? '<div class="fetch-game-date">' + escapeHtml(date) + '</div>' : '') +
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
      var timeLabel = getChesscomGameTimeLabel(timeClass);
      var dateStr = getChesscomGameDisplayDate(g);
      var opening = getChesscomGameOpening(g) || 'Opening not tagged';
      var userName = isUserWhite ? white : black;
      var userRating = isUserWhite ? whiteRating : blackRating;
      var opponentName = isUserWhite ? black : white;
      var opponentRating = isUserWhite ? blackRating : whiteRating;
      var userSide = isUserWhite ? 'White' : 'Black';
      var reviewedClass = reviewed ? 'is-reviewed' : 'is-pending';
      var reviewedText = reviewed ? 'Reviewed' : 'Needs review';
      var timeClassSafe = String(timeClass || 'rapid').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'rapid';

      return {
        idx: idx,
        userWon: userWon,
        userLost: userLost,
        reviewed: reviewed,
        outcomeText: outcomeText,
        timeLabel: timeLabel,
        html: '<article class="gt-game-row ' + outcomeClass + (reviewed ? ' game-reviewed' : '') + '" data-cc-idx="' + idx + '">' +
          '<div class="gt-row-main">' +
            '<div class="gt-row-head">' +
              '<div class="gt-title-block">' +
                '<div class="gt-opening-line">' +
                  '<span class="gt-opening">' + escapeHtml(opening) + '</span>' +
                '</div>' +
                '<div class="gt-subline">' +
                  '<span class="gt-date">' + escapeHtml(dateStr || 'Date unavailable') + '</span>' +
                  '<span class="gt-review-inline ' + reviewedClass + '">' + escapeHtml(reviewedText) + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="gt-result-col">' +
                '<span class="gt-outcome ' + outcomeClass + '">' + escapeHtml(outcomeText) + '</span>' +
                '<span class="gt-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="gt-row-body">' +
              '<div class="gt-player-line">' +
                '<span class="gt-player-emphasis">You &middot; ' + escapeHtml(userName) + ' (' + escapeHtml(userRating) + ')</span>' +
                '<span class="gt-player-divider">vs</span>' +
                '<span class="gt-player-secondary">' + escapeHtml(opponentName) + ' (' + escapeHtml(opponentRating) + ')</span>' +
              '</div>' +
              '<div class="gt-meta">' +
                '<span class="gt-side-chip gt-side-' + (isUserWhite ? 'white' : 'black') + '">' + escapeHtml(userSide) + '</span>' +
                '<span class="gt-time-badge gt-tc-' + escapeAttr(timeClassSafe) + '">' + escapeHtml(timeLabel) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="gt-actions">' +
            '<button type="button" class="gt-btn gt-btn-analyze" onclick="HomeController.loadChesscomGame(' + idx + ')"><span class="gt-btn-icon" aria-hidden="true">&#8599;</span><span>Analyze</span></button>' +
            '<button type="button" class="gt-btn gt-btn-share" onclick="HomeController.shareGame(' + idx + ')"><span class="gt-btn-icon" aria-hidden="true">&#128279;</span><span>Share</span></button>' +
          '</div>' +
        '</article>'
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

    var reviewedCount = items.filter(function(item) { return item.reviewed; }).length;
    var wins = items.filter(function(item) { return item.userWon; }).length;
    var losses = items.filter(function(item) { return item.userLost; }).length;
    var draws = items.length - wins - losses;
    var archive = window._ccFetchedArchivePeriod || buildChesscomArchiveRange(getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
    updateGamesTabOverview({
      username: username,
      archive: archive,
      filter: filter,
      total: items.length,
      filtered: filteredItems.length,
      reviewed: reviewedCount,
      wins: wins,
      losses: losses,
      draws: draws,
      modes: summarizeGamesTabModes(items)
    });

    var pageCount = Math.max(1, Math.ceil(filteredItems.length / GAMES_TAB_PAGE_SIZE));
    var currentPage = Math.min(Math.max(getGamesTabPage(), 1), pageCount);
    window._gamesTabPage = currentPage;
    var startIndex = (currentPage - 1) * GAMES_TAB_PAGE_SIZE;
    var pageItems = filteredItems.slice(startIndex, startIndex + GAMES_TAB_PAGE_SIZE);
    var startNumber = filteredItems.length ? startIndex + 1 : 0;
    var endNumber = filteredItems.length ? Math.min(startIndex + GAMES_TAB_PAGE_SIZE, filteredItems.length) : 0;
    var rangeCopy = filteredItems.length
      ? 'Showing ' + startNumber + '-' + endNumber + ' of ' + filteredItems.length + ' &middot; ' + GAMES_TAB_PAGE_SIZE + ' per page'
      : 'No games to show';
    var header = '<div class="games-list-banner">' +
      '<div class="games-count">' +
        '<span class="games-count-main">' + filteredItems.length + ' game' + (filteredItems.length !== 1 ? 's' : '') +
          (filter === 'all' ? '' : ' matching ' + escapeHtml(getGamesTabFilterLabel(filter).toLowerCase())) + '</span>' +
        '<span class="games-count-sub">' + rangeCopy + '</span>' +
      '</div>' +
      '<div class="games-list-banner-meta">' + wins + '-' + losses + '-' + draws + ' · ' + reviewedCount + ' reviewed</div>' +
    '</div>';
    var rows = filteredItems.length
      ? '<div class="games-list-stack">' + pageItems.map(function(item) { return item.html; }).join('') + '</div>' +
        buildGamesTabPagination(currentPage, pageCount, filteredItems.length, startNumber, endNumber)
      : buildGamesTabEmptyState('No games match this filter', 'Try another filter to inspect the rest of the archive.');

    container.innerHTML = header + rows;
  }

  function getGamesTabPage() {
    var page = parseInt(window._gamesTabPage, 10);
    return isNaN(page) || page < 1 ? 1 : page;
  }

  function setGamesTabPage(page) {
    window._gamesTabPage = Math.max(1, parseInt(page, 10) || 1);
    var container = document.getElementById('gamesTabList');
    var games = window._ccFetchedGames || [];
    var activeChesscom = getActiveLinkedAccount('chesscom');
    var username = window._ccFetchedUsername || (activeChesscom && activeChesscom.username) || (getProfile().chesscomUsername || '');
    if (container && games.length && username) {
      renderGamesTab(container, games, username);
      if (container.scrollIntoView) {
        container.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }

  function getGamesTabFilter() {
    return window._gamesTabFilter || 'all';
  }

  function setGamesTabFilter(filter) {
    window._gamesTabFilter = filter || 'all';
    window._gamesTabPage = 1;
    updateGamesTabFilterUI(window._gamesTabFilter);
    var container = document.getElementById('gamesTabList');
    var games = window._ccFetchedGames || [];
    var activeChesscom = getActiveLinkedAccount('chesscom');
    var username = window._ccFetchedUsername || (activeChesscom && activeChesscom.username) || (getProfile().chesscomUsername || '');
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
      renderAccountPanelState('chesscom', 'loading', 'Opening Games tab...', 'Fetching your latest 3 months of Chess.com games.', true);
      fetchHomeChesscomGames(resolvedUsername);
    } else if (platform === 'lichess') {
      var container = document.getElementById('lichessGamesList');
      if (!container) return;
      renderAccountPanelState('lichess', 'loading', 'Fetching Lichess games...', 'This usually takes a few seconds.', true);
      var encodedUser = encodeURIComponent(username);
      var proxyUrl = '/api/lichess/user/' + encodedUser + '/games?max=8&clocks=false&evals=false&opening=true';
      var directUrl = 'https://lichess.org/api/games/user/' + encodedUser + '?max=8&clocks=false&evals=false&opening=true';
      AppController.fetchTextWithFallback(proxyUrl, directUrl, { Accept: 'application/x-ndjson' })
        .then(function(text) {
          window._lichessFetchedUsername = username;
          var lines = text.trim().split('\n').filter(function(l) { return l.trim(); });
          var games = [];
          lines.forEach(function(line) { try { games.push(JSON.parse(line)); } catch { /* skip malformed NDJSON line */ } });
          renderLichessGames(container, games);
        })
        .catch(function(err) {
          renderAccountPanelState('lichess', 'error', 'Could not fetch Lichess games', AppController.describeLichessError(err, username), true);
        });
    }
  }

  function renderLichessGames(container, games) {
    if (!games.length) {
      renderAccountPanelState('lichess', 'empty', 'No recent games found', 'Try again after playing a Lichess game.', true);
      return;
    }
    var rows = games.map(function(g) {
      var white = g.players && g.players.white && g.players.white.user ? g.players.white.user.name : 'White';
      var black = g.players && g.players.black && g.players.black.user ? g.players.black.user.name : 'Black';
      var result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '½-½';
      var gameId = g.id || '';

      return '<div class="fetch-game-item" data-id="' + escapeAttr(gameId) + '" data-platform="lichess" onclick="HomeController.loadPlatformGame(this)">' +
        '<span>' + escapeHtml(white) + ' vs ' + escapeHtml(black) + '</span>' +
        '<span class="fetch-game-result ' + (result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d') + '">' + escapeHtml(result) + '</span>' +
        '</div>';
    }).join('');
    container.innerHTML = '<div class="games-count">' + games.length + ' recent Lichess game' + (games.length !== 1 ? 's' : '') + '</div>' + rows;
  }

  function loadPlatformGame(el) {
    var platform = el.getAttribute('data-platform');
    var pgn = el.getAttribute('data-pgn');
    var id = el.getAttribute('data-id');
    if (pgn) {
      AppController.loadPGNAndReviewExternal(decodeURIComponent(pgn), {
        sourcePlatform: platform || '',
        sourceUsername: platform === 'lichess'
          ? ((getActiveLinkedAccount('lichess') || {}).username || getProfile().lichessUsername || window._lichessFetchedUsername || '')
          : ''
      });
    } else if (id && platform === 'lichess') {
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(id) + '/export?clocks=true&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(id) + '?clocks=true&evals=false';
      AppController.fetchTextWithFallback(proxyUrl, directUrl)
        .then(function(p) {
          if (p) {
            AppController.loadPGNAndReviewExternal(p, {
              sourcePlatform: 'lichess',
              sourceUsername: window._lichessFetchedUsername || ((getActiveLinkedAccount('lichess') || {}).username) || getProfile().lichessUsername || ''
            });
          }
        });
    }
  }

  function loadChesscomGame(idx) {
    var games = window._ccFetchedGames;
    if (!games || !games[idx]) return;
    var game = games[idx];
    var pgn = game.pgn || '';
    if (pgn) {
      var reviewUsername = window._ccFetchedUsername || ((getActiveLinkedAccount('chesscom') || {}).username) || (getProfile().chesscomUsername || '');
      AppController.loadPGNAndReviewExternal(pgn, {
        sourceGame: game,
        sourcePlatform: 'chesscom',
        sourceUsername: reviewUsername
      });
      // Mark as reviewed in the list
      var item = document.querySelector('.gt-game-row[data-cc-idx="' + idx + '"]');
      if (item) {
        item.classList.add('game-reviewed');
        var icon = item.querySelector('.gt-review-icon');
        if (icon) icon.innerHTML = '&#10003;';
      }
      var container = document.getElementById('gamesTabList');
      if (container && reviewUsername) {
        renderGamesTab(container, games, reviewUsername);
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
  function setupRecentGamesList() {
    bindHomeClick('homeRecentGames', 'homeRecentGamesBound', function(e) {
      if (!e.target || !e.target.closest) return;
      var row = e.target.closest('[data-home-game-id]');
      if (!row) return;
      AppController.loadDbGame(row.getAttribute('data-home-game-id'));
    });
  }

  function renderRecentGames() {
    var container = document.getElementById('homeRecentGames');
    if (!container) return;
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch { /* corrupt data – start with empty db */ }
    if (!db.length) {
      container.innerHTML =
        '<div class="dashboard-empty-state">' +
          '<div class="dashboard-empty-title">No games yet</div>' +
          '<div class="dashboard-empty-copy">Import a PGN, FEN, URL, or file to start building your review history.</div>' +
        '</div>';
      return;
    }
    container.innerHTML = db.slice(0, 6).map(function(g) {
      var resClass = g.result === '1-0' ? 'white-win' : g.result === '0-1' ? 'black-win' : 'draw';
      var safeId = escapeAttr(g.id);
      return '<div class="home-game-item" data-home-game-id="' + safeId + '">' +
        '<div class="sp-info">' +
          '<div class="hgi-players">' + escapeHtml(g.white || '?') + ' vs ' + escapeHtml(g.black || '?') + '</div>' +
          '<div class="hgi-meta">' + escapeHtml((g.opening || '').substring(0, 28) || 'Unknown opening') + ' \u00b7 ' + escapeHtml((g.date || '').substring(0, 10)) + '</div>' +
        '</div>' +
        '<span class="hgi-result ' + resClass + '">' + escapeHtml(g.result || '*') + '</span>' +
        '<button type="button" class="hgi-analyze-btn" data-home-game-id="' + safeId + '">Analyze</button>' +
        '</div>';
    }).join('');
  }

  return {
    init: init,
    refreshHomeData: refreshHomeData,
    setupGamesTab: setupGamesTab,
    refreshGamesTab: refreshGamesTab,
    fetchChesscomGames: fetchChesscomGames,
    fetchLatestChesscomGames: fetchLatestChesscomGames,
    fetchHomeChesscomGames: fetchHomeChesscomGames,
    setGamesTabPage: setGamesTabPage,
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
    AppController.triggerAutoReview();
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
