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
import { showToast, copyToClipboard } from '../utils/toast.js';
import FeedbackController from './FeedbackController.js';
import AuthController from './AuthController.js';
import ProfileController from './ProfileController.js';
import DatabaseController from './DatabaseController.js';
import PlatformFetchController from './PlatformFetchController.js';
import { state, DEFAULT_ENGINE_ID } from './state.js';

const APP_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '/';
const CLEAN_APP_BASE_URL = (!APP_BASE_URL || APP_BASE_URL === '/') ? '' : APP_BASE_URL.replace(/\/$/, '');
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
  var analysisMode = true;
  var lastAnalysisHistory = null;
  var lastAnalysisCounts = null;
  var activeReviewTab = 'analyze';
  var currentReviewCandidates = [];
  var selectedMoveQuality = null;
  var selectedMoveQualityColor = null;
  var selectedMoveQualityCursor = 0;
  var reviewReplayState = null;
  var enginePreviewSnapshot = null;
  var DEFAULT_MOVE_DESC = 'Run a full game review to see brilliance, inaccuracies, and more for each move.';
  var DEFAULT_COACH_TEXT = 'Run a full analysis to unlock personalized move-by-move coaching.';
  var COACH_COMMENTARY_URL = APP_BASE_URL.replace(/\/?$/, '/') + 'data/chess_commentary_cleaned_combined.json';
  var lastCoachSummary = DEFAULT_COACH_TEXT;
  var coachCommentaryPromise = null;
  var coachCommentaryStore = null;
  var coachCommentaryRequestId = 0;
  var COLOR_MODE_KEY = 'kv_color_mode';
  var ENGINE_SETTINGS_KEY = 'kv_engine_settings';
  var ENGINE_LABELS = {
    sf18: 'Stockfish 18 Browser',
    'sf18-lite': 'Stockfish 18 Lite Browser',
    'sf18-full': 'Stockfish 18 Full Browser',
    'sf17-1-lite': 'Stockfish 17.1 Lite Browser',
    'sf17-1-full': 'Stockfish 17.1 Full Browser',
    'sf17-lite': 'Stockfish 17 Lite Browser',
    'sf17-full': 'Stockfish 17 Full Browser',
    'sf16-1-lite': 'Stockfish 16.1 Lite Browser',
    'sf16-1-full': 'Stockfish 16.1 Full Browser',
    'sf16-nnue': 'Stockfish 16 NNUE Browser'
  };
  var REVIEW_STRENGTHS = ['fast', 'balanced', 'slow'];
  var DEFAULT_ENGINE_SETTINGS = {
    gameReview: {
      engine: 'sf18',
      strength: 'fast'
    },
    analysis: {
      engine: 'sf18',
      maxTimeMs: 1000,
      lines: 3,
      suggestionArrows: 'best-moves',
      depth: '25'
    }
  };
  var engineSettings = normalizeEngineSettings(null);
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
    
    ProfileController.loadProfile();
    AuthController.init({
      applyProfile: ProfileController.applyProfile,
      switchTab: switchTab,
      onAuthChange: function() { /* room for future hooks */ }
    });
    DatabaseController.init({
      loadPGNGame: loadPGNGame,
      switchTab: switchTab
    });
    PlatformFetchController.init({
      loadPGNGame: loadPGNGame,
      switchTab: switchTab,
      triggerAutoReview: triggerAutoReview,
      readStoredProfile: readStoredProfile
    });

    ChessBoard.init('chessBoard', 'boardOverlay', onBoardMove);
    ChessBoard.setPosition(chess);
    updateAnalyzePlayerInfo(null, getAnalyzeBottomColor());
    syncAnalyzeBoardInteraction();
    EngineController.init();
    SoundController.init();

    setupEventListeners();
    setupTabNavigation();
    setupBrowserTabHistory();
    setupCoordinates();
    setupCoachTimelineInteractions();
    applyBoardPreferences();
    applyEngineSettings();
    switchReviewTab(activeReviewTab);
    
    startAnalysis();
    
    updateMovesList();
    DatabaseController.renderSavedGames();
    DatabaseController.render();
    
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
      FeedbackController.open('feature');
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
      DatabaseController.render();
    }
    if (tab === 'home' && window.HomeController) {
      window.HomeController.refreshHomeData();
    }
    if (tab === 'games' && window.HomeController) {
      window.HomeController.refreshGamesTab();
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
      engineSettings = normalizeEngineSettings(engineSettings);
      engineSettings.analysis.depth = String(this.value);
      persistEngineSettings();
      syncEngineSettingsControls();
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
    bindClick('analysisSettingsGear', openEngineSettingsModal);
    bindClick('reviewPanelMenu', openEngineSettingsModal);
    bindClick('engineSettingsClose', closeEngineSettingsModal);
    bindClick('engineSettingsDone', saveAndCloseEngineSettingsModal);
    bind('settingsEngineSelect', 'change', handleEngineSettingChange);
    bind('engineSettingsEngine', 'change', handleEngineSettingChange);
    bind('engineSettingsReviewEngine', 'change', handleEngineSettingChange);
    bind('engineSettingsReviewStrength', 'change', handleEngineSettingChange);
    bind('engineSettingsLines', 'change', handleEngineSettingChange);
    bind('engineSettingsArrows', 'change', handleEngineSettingChange);
    bind('engineSettingsTime', 'change', handleEngineSettingChange);
    bind('engineSettingsDepth', 'change', handleEngineSettingChange);
    var engineSettingsOverlay = document.getElementById('engineSettingsOverlay');
    if (engineSettingsOverlay) {
      engineSettingsOverlay.addEventListener('click', function(e) {
        if (e.target === engineSettingsOverlay) closeEngineSettingsModal();
      });
    }

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
    bindClick('fetchGamesBtn', PlatformFetchController.fetchGames);

    // Profile
    bindClick('saveProfile', ProfileController.saveProfile);
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
    FeedbackController.init();

    // Database search
    bind('dbSearch', 'input', function() {
      DatabaseController.render(this.value);
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        FeedbackController.close();
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

  function normalizeEngineSettings(raw) {
    var source = raw || {};
    var reviewSource = source.gameReview || {
      engine: source.reviewEngine,
      strength: source.reviewStrength
    };
    var analysisSource = source.analysis || {
      engine: source.engine,
      maxTimeMs: source.maxTimeMs || (source.time ? parseInt(source.time, 10) * 1000 : undefined),
      lines: source.lines,
      suggestionArrows: source.suggestionArrows || source.arrows,
      depth: source.depth
    };
    var maxTimeMs = parseInt(analysisSource.maxTimeMs, 10);
    if ([1000, 3000, 5000, 10000].indexOf(maxTimeMs) === -1) maxTimeMs = DEFAULT_ENGINE_SETTINGS.analysis.maxTimeMs;

    return {
      gameReview: {
        engine: ENGINE_LABELS[reviewSource.engine] ? reviewSource.engine : DEFAULT_ENGINE_SETTINGS.gameReview.engine,
        strength: REVIEW_STRENGTHS.indexOf(reviewSource.strength) !== -1 ? reviewSource.strength : DEFAULT_ENGINE_SETTINGS.gameReview.strength
      },
      analysis: {
        engine: ENGINE_LABELS[analysisSource.engine] ? analysisSource.engine : DEFAULT_ENGINE_SETTINGS.analysis.engine,
        maxTimeMs: maxTimeMs,
        lines: Math.max(1, Math.min(5, parseInt(analysisSource.lines, 10) || DEFAULT_ENGINE_SETTINGS.analysis.lines)),
        suggestionArrows: ['off', 'best', 'best-moves', 'all'].indexOf(analysisSource.suggestionArrows) !== -1 ? analysisSource.suggestionArrows : DEFAULT_ENGINE_SETTINGS.analysis.suggestionArrows,
        depth: ['auto', '15', '20', '25'].indexOf(String(analysisSource.depth)) !== -1 ? String(analysisSource.depth) : DEFAULT_ENGINE_SETTINGS.analysis.depth
      }
    };
  }

  function readEngineSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(ENGINE_SETTINGS_KEY) || 'null');
      engineSettings = normalizeEngineSettings(saved);
    } catch {
      engineSettings = normalizeEngineSettings(null);
    }

    persistEngineSettings();
  }

  function persistEngineSettings() {
    try { localStorage.setItem(ENGINE_SETTINGS_KEY, JSON.stringify(engineSettings)); } catch { /* storage full */ }
  }

  function getAnalysisEngineSettings() {
    engineSettings = normalizeEngineSettings(engineSettings);
    return engineSettings.analysis;
  }

  function getReviewEngineSettings() {
    engineSettings = normalizeEngineSettings(engineSettings);
    return engineSettings.gameReview;
  }

  function getEngineDepthValue() {
    var analysis = getAnalysisEngineSettings();
    if (String(analysis.depth) === 'auto') return 20;
    return parseInt(analysis.depth, 10) || 20;
  }

  function syncEngineSettingsControls() {
    var analysis = getAnalysisEngineSettings();
    var review = getReviewEngineSettings();
    var settingsEngineEl = document.getElementById('settingsEngineSelect');
    var engineEl = document.getElementById('engineSettingsEngine');
    var reviewEngineEl = document.getElementById('engineSettingsReviewEngine');
    var reviewStrengthEl = document.getElementById('engineSettingsReviewStrength');
    var linesEl = document.getElementById('engineSettingsLines');
    var arrowsEl = document.getElementById('engineSettingsArrows');
    var timeEl = document.getElementById('engineSettingsTime');
    var depthEl = document.getElementById('engineSettingsDepth');
    if (settingsEngineEl) settingsEngineEl.value = analysis.engine;
    if (engineEl) engineEl.value = analysis.engine;
    if (reviewEngineEl) reviewEngineEl.value = review.engine;
    if (reviewStrengthEl) reviewStrengthEl.value = review.strength;
    if (linesEl) linesEl.value = String(analysis.lines);
    if (arrowsEl) arrowsEl.value = analysis.suggestionArrows;
    if (timeEl) timeEl.value = String(Math.round(analysis.maxTimeMs / 1000));
    if (depthEl) depthEl.value = String(analysis.depth);

    var nameEl = document.getElementById('analysisEngineName');
    if (nameEl) nameEl.textContent = ENGINE_LABELS[analysis.engine] || 'Browser Stockfish';

    var depthSlider = document.getElementById('depthSlider');
    var depthVal = document.getElementById('depthVal');
    var depthValue = getEngineDepthValue();
    if (depthSlider) depthSlider.value = String(depthValue);
    if (depthVal) depthVal.textContent = String(depthValue);
  }

  function applyEngineSettings() {
    readEngineSettings();
    syncEngineSettingsControls();
    var analysis = getAnalysisEngineSettings();
    EngineController.setNumLines(analysis.lines);
    EngineController.setDepth(getEngineDepthValue());
    EngineController.setOption('Engine', analysis.engine);
    if (EngineController.setSuggestionArrowsMode) {
      EngineController.setSuggestionArrowsMode(analysis.suggestionArrows);
    }
    ChessBoard.setOptions({ showArrows: analysis.suggestionArrows !== 'off' });
    if (analysis.suggestionArrows === 'off') ChessBoard.clearArrows();
  }

  function collectEngineSettingsFromControls(analysisEngineOverride) {
    var currentAnalysis = getAnalysisEngineSettings();
    var currentReview = getReviewEngineSettings();
    var settingsEngineEl = document.getElementById('settingsEngineSelect');
    var modalEngineEl = document.getElementById('engineSettingsEngine');
    engineSettings = normalizeEngineSettings({
      gameReview: {
        engine: document.getElementById('engineSettingsReviewEngine')?.value || currentReview.engine,
        strength: document.getElementById('engineSettingsReviewStrength')?.value || currentReview.strength
      },
      analysis: {
        engine: analysisEngineOverride || settingsEngineEl?.value || modalEngineEl?.value || currentAnalysis.engine,
        maxTimeMs: (parseInt(document.getElementById('engineSettingsTime')?.value, 10) || Math.round(currentAnalysis.maxTimeMs / 1000)) * 1000,
        lines: document.getElementById('engineSettingsLines')?.value || currentAnalysis.lines,
        suggestionArrows: document.getElementById('engineSettingsArrows')?.value || currentAnalysis.suggestionArrows,
        depth: document.getElementById('engineSettingsDepth')?.value || currentAnalysis.depth
      }
    });
  }

  function handleEngineSettingChange(e) {
    var analysisEngineOverride = e?.target && (
      e.target.id === 'settingsEngineSelect' ||
      e.target.id === 'engineSettingsEngine'
    ) ? e.target.value : null;
    collectEngineSettingsFromControls(analysisEngineOverride);
    persistEngineSettings();
    syncEngineSettingsControls();
    var analysis = getAnalysisEngineSettings();
    EngineController.setNumLines(analysis.lines);
    EngineController.setDepth(getEngineDepthValue());
    EngineController.setOption('Engine', analysis.engine);
    if (EngineController.setSuggestionArrowsMode) {
      EngineController.setSuggestionArrowsMode(analysis.suggestionArrows);
    }
    ChessBoard.setOptions({ showArrows: analysis.suggestionArrows !== 'off' });
    if (analysis.suggestionArrows === 'off') ChessBoard.clearArrows();
    startAnalysis();
  }

  function openEngineSettingsModal() {
    syncEngineSettingsControls();
    var overlay = document.getElementById('engineSettingsOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    var shell = document.getElementById('analyzeShell');
    if (shell) shell.classList.add('engine-settings-open');
    var closeBtn = document.getElementById('engineSettingsClose');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
  }

  function closeEngineSettingsModal() {
    var overlay = document.getElementById('engineSettingsOverlay');
    if (overlay) overlay.hidden = true;
    var shell = document.getElementById('analyzeShell');
    if (shell) shell.classList.remove('engine-settings-open');
  }

  function saveAndCloseEngineSettingsModal() {
    collectEngineSettingsFromControls();
    persistEngineSettings();
    applyEngineSettings();
    closeEngineSettingsModal();
    startAnalysis();
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

  function getDurationParts(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && isFinite(value)) {
      var numericSeconds = value > 10000 ? value / 1000 : value;
      return {
        totalSeconds: Math.max(0, numericSeconds),
        precision: numericSeconds < 20 && Math.floor(numericSeconds) !== numericSeconds ? 3 : 0
      };
    }

    var text = String(value).trim();
    if (!text) return null;

    if (/^\d+(\.\d+)?$/.test(text)) {
      var rawSeconds = parseFloat(text);
      return {
        totalSeconds: Math.max(0, rawSeconds),
        precision: (text.split('.')[1] || '').length
      };
    }

    var clockMatch = text.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d(?:\.\d+)?))?$/);
    if (!clockMatch) return null;

    var hasHours = clockMatch[3] !== undefined;
    var hours = hasHours ? parseInt(clockMatch[1], 10) || 0 : 0;
    var minutes = hasHours ? parseInt(clockMatch[2], 10) || 0 : parseInt(clockMatch[1], 10) || 0;
    var secondsText = hasHours ? clockMatch[3] : clockMatch[2];
    var seconds = parseFloat(secondsText) || 0;

    return {
      totalSeconds: Math.max(0, hours * 3600 + minutes * 60 + seconds),
      precision: (String(secondsText).split('.')[1] || '').length
    };
  }

  function formatSecondsParts(totalSeconds, precision) {
    var safeTotal = Math.max(0, Number(totalSeconds) || 0);
    var showFraction = safeTotal < 20 && precision > 0;
    var fractionDigits = showFraction ? Math.min(6, Math.max(1, precision)) : 0;
    var roundedTotal = showFraction ? safeTotal : Math.round(safeTotal);
    var minutes = Math.floor(roundedTotal / 60);
    var seconds = roundedTotal - minutes * 60;
    var secondsText = showFraction
      ? seconds.toFixed(fractionDigits).padStart(3 + fractionDigits, '0')
      : String(Math.round(seconds)).padStart(2, '0');

    return minutes + ':' + secondsText;
  }

  function formatDurationValue(value) {
    if (value === null || value === undefined || value === '') return '';
    var parts = getDurationParts(value);
    if (!parts) return String(value).trim().replace(/\.\d+/, '');
    return formatSecondsParts(parts.totalSeconds, parts.precision);
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
    var analysisWhiteNameEl = document.getElementById('analysisWhiteName');
    var analysisBlackNameEl = document.getElementById('analysisBlackName');
    var analysisWhiteRatingEl = document.getElementById('analysisWhiteRating');
    var analysisBlackRatingEl = document.getElementById('analysisBlackRating');
    var analysisWhiteFlagEl = document.getElementById('analysisWhiteFlag');
    var analysisBlackFlagEl = document.getElementById('analysisBlackFlag');
    var analysisResultEl = document.getElementById('analysisGameResult');
    var whiteName = game && game.white ? game.white : 'White Player';
    var blackName = game && game.black ? game.black : 'Black Player';
    var whiteRating = game && game.whiteElo && game.whiteElo !== '?' ? '(' + game.whiteElo + ')' : '';
    var blackRating = game && game.blackElo && game.blackElo !== '?' ? '(' + game.blackElo + ')' : '';

    if (whiteNameEl) whiteNameEl.textContent = whiteName;
    if (blackNameEl) blackNameEl.textContent = blackName;
    if (whiteRatingEl) whiteRatingEl.textContent = whiteRating;
    if (blackRatingEl) blackRatingEl.textContent = blackRating;
    if (analysisWhiteNameEl) analysisWhiteNameEl.textContent = whiteName;
    if (analysisBlackNameEl) analysisBlackNameEl.textContent = blackName;
    if (analysisWhiteRatingEl) analysisWhiteRatingEl.textContent = whiteRating;
    if (analysisBlackRatingEl) analysisBlackRatingEl.textContent = blackRating;
    if (analysisResultEl) analysisResultEl.textContent = game && game.result ? game.result : '*';
    if (analysisWhiteFlagEl) analysisWhiteFlagEl.textContent = game && game.whiteCountry ? getCountryFlag(game.whiteCountry) : '';
    if (analysisBlackFlagEl) analysisBlackFlagEl.textContent = game && game.blackCountry ? getCountryFlag(game.blackCountry) : '';
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
    enginePreviewSnapshot = null;
    updateEnginePreviewControls();
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
    DatabaseController.save(game);
    DatabaseController.render();
    DatabaseController.renderSavedGames();
    if (window.HomeController) window.HomeController.renderRecentGames();

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
        games.forEach(function(g) { DatabaseController.save(g); });
        DatabaseController.render();
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
      PlatformFetchController.fetchTextWithFallback(proxyUrl, directUrl)
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
    var analysis = getAnalysisEngineSettings();
    var depth = getEngineDepthValue();
    var numLines = analysis.lines || (EngineController.getMaxLines ? EngineController.getMaxLines() : 5);

    EngineController.setOption('Engine', analysis.engine);
    EngineController.analyzeFen(chess.fen(), depth, numLines, function(_bestMove) {
      // Best move received
    }, {
      engine: analysis.engine,
      movetimeMs: analysis.maxTimeMs
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

    var review = getReviewEngineSettings();
    var reviewOptions = {
      engine: review.engine,
      strength: review.strength
    };

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
      switchReviewTab('report');
    }, reviewOptions);
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
    if (!state.gameDatabase || !state.gameDatabase.length) {
      return '';
    }
    var latestGame = state.gameDatabase.find(function(entry) {
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
    updateMovesList();
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
          var rowSelected = selectedMoveQuality === q;
          var wSelected = selectedMoveQuality === q && selectedMoveQualityColor === 'w';
          var bSelected = selectedMoveQuality === q && selectedMoveQualityColor === 'b';
          return '<div class="gr-classify-row gr-quality-click-row' + (rowSelected ? ' is-selected' : '') + '" data-quality="' + escapeAttr(q) + '" onclick="AppController.openMoveQualityList(\'' + escapeAttr(q) + '\', null)">' +
            '<div class="gr-cl-icon"><span class="qi ' + meta.iconClass + '">' + meta.icon + '</span></div>' +
            '<button type="button" class="gr-cl-label gr-quality-label-btn" onclick="AppController.openMoveQualityList(\'' + escapeAttr(q) + '\', null); event.stopPropagation();">' + meta.label + '</button>' +
            '<button type="button" class="gr-cl-wval gr-quality-count-btn' + (wSelected ? ' is-selected' : '') + '" aria-label="Show White ' + escapeAttr(meta.label) + ' moves" onclick="AppController.openMoveQualityList(\'' + escapeAttr(q) + '\', \'w\'); event.stopPropagation();">' + (counts.w[q] || 0) + '</button>' +
            '<button type="button" class="gr-cl-bval gr-quality-count-btn' + (bSelected ? ' is-selected' : '') + '" aria-label="Show Black ' + escapeAttr(meta.label) + ' moves" onclick="AppController.openMoveQualityList(\'' + escapeAttr(q) + '\', \'b\'); event.stopPropagation();">' + (counts.b[q] || 0) + '</button>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('') + '</div>';
  }

  function getMovesByQuality(quality, colorFilter) {
    var targetQuality = String(quality || '').toLowerCase();
    var targetColor = colorFilter === 'w' || colorFilter === 'b' ? colorFilter : null;
    if (!targetQuality || !Array.isArray(lastAnalysisHistory)) return [];
    return lastAnalysisHistory.map(function(move, idx) {
      return { move: move, idx: idx };
    }).filter(function(item) {
      if (!item.move || item.move.quality !== targetQuality) return false;
      return !targetColor || item.move.color === targetColor;
    });
  }

  function openMoveQualityList(quality, colorFilter) {
    var nextQuality = String(quality || '').toLowerCase();
    var nextColor = colorFilter === 'w' || colorFilter === 'b' ? colorFilter : null;
    var isSameFilter = selectedMoveQuality === nextQuality && selectedMoveQualityColor === nextColor;
    selectedMoveQuality = nextQuality;
    selectedMoveQualityColor = nextColor;
    var moves = getMovesByQuality(selectedMoveQuality, selectedMoveQualityColor);
    selectedMoveQualityCursor = isSameFilter
      ? Math.min(selectedMoveQualityCursor + 1, Math.max(0, moves.length - 1))
      : 0;
    if (moves.length) {
      goToMove(moves[selectedMoveQualityCursor].idx + 1);
    }
    if (lastAnalysisCounts) {
      var table = document.getElementById('grClassifyTable');
      if (table) table.innerHTML = buildMoveQualityBreakdownHTML(lastAnalysisCounts);
    }
  }

  function closeMoveQualityList() {
    selectedMoveQuality = null;
    selectedMoveQualityColor = null;
    selectedMoveQualityCursor = 0;
    if (lastAnalysisCounts) {
      var table = document.getElementById('grClassifyTable');
      if (table) table.innerHTML = buildMoveQualityBreakdownHTML(lastAnalysisCounts);
    }
  }

  function stepMoveQualitySelection(direction) {
    if (!selectedMoveQuality) return;
    var moves = getMovesByQuality(selectedMoveQuality, selectedMoveQualityColor);
    if (!moves.length) return;
    var delta = parseInt(direction, 10) || 0;
    selectedMoveQualityCursor = Math.max(0, Math.min(moves.length - 1, selectedMoveQualityCursor + delta));
    goToMove(moves[selectedMoveQualityCursor].idx + 1);
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
    var sessionProfile = state.profile || {};

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
    var card = document.getElementById('grCriticalCard');
    if (!container) return;

    var criticalKeys = ['mistake', 'blunder'];
    var chipKeys = ['blunder', 'mistake', 'inaccuracy'];
    var userColor = getReviewUserColor(currentGame) || 'w';
    var opponentColor = userColor === 'w' ? 'b' : 'w';

    var userCounts = counts[userColor] || {};
    var opponentCounts = counts[opponentColor] || {};
    var totals = criticalKeys.reduce(function(acc, key) {
      acc[key] = userCounts[key] || 0;
      return acc;
    }, {});
    var totalCritical = criticalKeys.reduce(function(sum, key) { return sum + totals[key]; }, 0);
    var totalGameCritical = criticalKeys.reduce(function(sum, key) {
      return sum + (counts.w && counts.w[key] || 0) + (counts.b && counts.b[key] || 0);
    }, 0);

    if (!totalGameCritical) {
      if (card) card.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    if (card) card.style.display = '';

    var severityRank = { blunder: 5, miss: 4, mistake: 3, inaccuracy: 2 };
    var moments = (history || []).map(function(move, idx) {
      return { move: move, idx: idx, cpl: getMoveCentipawnLoss(move) };
    }).filter(function(item) {
      return item.move.color === userColor && chipKeys.indexOf(item.move.quality) !== -1;
    }).sort(function(a, b) {
      var rankDiff = (severityRank[b.move.quality] || 0) - (severityRank[a.move.quality] || 0);
      return rankDiff || b.cpl - a.cpl;
    }).slice(0, 3);

    var userSummary = {
      username: userColor === 'w' ? (currentGame && currentGame.white || 'White') : (currentGame && currentGame.black || 'Black'),
      color: userColor,
      mistakes: userCounts.mistake || 0,
      blunders: userCounts.blunder || 0,
      inaccuracies: userCounts.inaccuracy || 0
    };
    var opponentSummary = {
      username: opponentColor === 'w' ? (currentGame && currentGame.white || 'White') : (currentGame && currentGame.black || 'Black'),
      color: opponentColor,
      mistakes: opponentCounts.mistake || 0,
      blunders: opponentCounts.blunder || 0,
      inaccuracies: opponentCounts.inaccuracy || 0
    };

    container.innerHTML = buildLearnFromMistakesCardHTML({
      currentUser: userSummary,
      opponent: opponentSummary,
      criticalMoves: moments
    });
  }

  function buildLearnFromMistakesCardHTML(props) {
    var currentUser = props.currentUser;
    var opponent = props.opponent;
    var moves = props.criticalMoves || [];
    return '<div class="learn-mistakes-card">' +
      '<div class="learn-mistakes-head"><span class="learn-mistakes-dot"></span><span>Critical Analysis</span></div>' +
      '<div class="learn-mistakes-layout">' +
        '<div class="learn-mistakes-copy">' +
          '<h3>Learn from your mistakes.</h3>' +
          '<div class="learn-mistakes-summary">' +
            '<span>You made</span>' +
            buildCriticalCountBadge('mistake', currentUser.mistakes) +
            '<span>and</span>' +
            buildCriticalCountBadge('blunder', currentUser.blunders) +
            '<span>critical errors.</span>' +
            '<span>Master these positions to improve.</span>' +
          '</div>' +
        '</div>' +
        '<div class="learn-mistakes-chips">' + buildCriticalMoveChips(moves) + '</div>' +
      '</div>' +
      '<div class="learn-player-rows">' +
        buildCriticalPlayerRow(opponent, true) +
        buildCriticalPlayerRow(currentUser, false) +
      '</div>' +
    '</div>';
  }

  function buildCriticalCountBadge(quality, count) {
    var meta = getQualityMeta(quality);
    return '<span class="learn-count-badge is-' + escapeAttr(quality) + '">' +
      '<strong>' + (count || 0) + '</strong><span class="qi ' + escapeAttr(meta.iconClass || '') + '">' + meta.icon + '</span>' +
    '</span>';
  }

  function buildCriticalMoveChips(moves) {
    if (!moves.length) {
      return '<div class="learn-chip-empty">No user critical move chips.</div>';
    }
    return moves.map(function(item, index) {
      var move = item.move;
      var meta = getQualityMeta(move.quality);
      var san = move.san || move.playedMove || '?';
      var tilt = index === 0 ? ' is-tilt-left' : index === 1 ? ' is-flat' : ' is-tilt-right';
      return '<button type="button" class="learn-move-chip is-' + escapeAttr(move.quality || '') + tilt + '" onclick="AppController.openCriticalMoment(' + item.idx + ')">' +
        '<span class="qi ' + escapeAttr(meta.iconClass || '') + '">' + meta.icon + '</span>' +
        '<span>' + escapeHtml(san) + '</span>' +
      '</button>';
    }).join('');
  }

  function buildCriticalPlayerRow(summary, isOpponent) {
    var rowClass = isOpponent ? ' is-opponent' : ' is-current';
    var countsHtml = '';
    if (isOpponent) {
      if (summary.mistakes || !summary.blunders) countsHtml += buildInlineCriticalBadge('mistake', summary.mistakes);
      if (summary.blunders) {
        if (countsHtml) countsHtml += '<span class="learn-count-divider"></span>';
        countsHtml += buildInlineCriticalBadge('blunder', summary.blunders);
      }
    } else {
      countsHtml = buildInlineCriticalBadge('mistake', summary.mistakes) +
        '<span class="learn-count-divider"></span>' +
        buildInlineCriticalBadge('blunder', summary.blunders);
    }
    return '<div class="learn-player-row' + rowClass + '">' +
      '<span class="learn-player-avatar" aria-hidden="true">' + (summary.color === 'b' ? '&#9820;' : '&#9814;') + '</span>' +
      '<span class="learn-player-name">' + escapeHtml(summary.username || (summary.color === 'b' ? 'Black' : 'White')) + '</span>' +
      '<span class="learn-player-counts">' + countsHtml + '</span>' +
    '</div>';
  }

  function buildInlineCriticalBadge(quality, count) {
    var meta = getQualityMeta(quality);
    return '<span class="learn-inline-badge is-' + escapeAttr(quality) + '">' +
      '<strong>' + (count || 0) + '</strong><span class="qi ' + escapeAttr(meta.iconClass || '') + '">' + meta.icon + '</span>' +
    '</span>';
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
    selectedMoveQuality = null;
    selectedMoveQualityColor = null;
    selectedMoveQualityCursor = 0;
    reviewReplayState = null;
    switchReviewTab('analyze');
    var panel = document.getElementById('gameReviewPanel');
    if (panel) panel.classList.add('is-empty');
    setCoachMessage('Coach Ramp', DEFAULT_COACH_TEXT);
    var table = document.getElementById('grClassifyTable');
    if (table) table.innerHTML = '';
    var criticalCard = document.getElementById('grCriticalCard');
    if (criticalCard) criticalCard.style.display = 'none';
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

    if (!moveInfo) {
      if (iconEl) {
        iconEl.textContent = '?';
        iconEl.className = 'qi';
      }
      if (ChessBoard && typeof ChessBoard.clearMarkers === 'function') ChessBoard.clearMarkers();
      if (ChessBoard && typeof ChessBoard.clearReviewMoveQuality === 'function') ChessBoard.clearReviewMoveQuality();
      var label = (typeof moveIndex === 'number' && moveIndex >= 0)
        ? 'Move ' + (Math.floor(moveIndex / 2) + 1) + ' not analyzed yet'
        : 'Awaiting analysis';
      if (gradeEl) gradeEl.textContent = label;
      if (descEl) descEl.textContent = DEFAULT_MOVE_DESC;
      setCoachMessage('Coach Ramp', lastCoachSummary || DEFAULT_COACH_TEXT);
      return;
    }

    var meta = getQualityMeta(moveInfo.quality);
    if (iconEl) {
      iconEl.textContent = meta.icon;
      iconEl.className = 'qi ' + (meta.iconClass || '');
    }
    if (gradeEl) gradeEl.textContent = meta.label + ' · ' + buildMoveLabel(moveInfo, moveIndex);
    if (descEl) descEl.textContent = meta.tip + ' ' + describeMoveSwing(moveInfo);
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
    document.querySelectorAll('#grAnalysisCandidates .gr-candidate-row').forEach(function(row) {
      row.classList.remove('is-selected');
    });
    var selectedRow = document.querySelector('#grAnalysisCandidates .gr-candidate-row:nth-child(' + (index + 1) + ')');
    if (selectedRow) selectedRow.classList.add('is-selected');
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
    var overlayText = document.getElementById('reviewProgressText');
    var overlayFill = document.getElementById('reviewProgressFill');
    var progressLabel = label || '0%';
    var progressValue = parseInt(progressLabel, 10);
    if (!isFinite(progressValue)) progressValue = 0;
    progressValue = Math.max(0, Math.min(100, progressValue));
    var text = isBusy ? ('Review ' + (label || '...')) : 'Full Analysis';
    if (topButton) {
      topButton.textContent = text;
      topButton.disabled = !!isBusy;
    }
    if (overlay) {
      overlay.style.display = isBusy ? 'flex' : 'none';
    }
    if (overlayText) {
      overlayText.textContent = isBusy
        ? ('Review in progress · ' + progressLabel)
        : 'Review in progress';
    }
    if (overlayFill) {
      overlayFill.style.width = (isBusy ? progressValue : 0) + '%';
    }
    setCoachMessage('Coach Ramp', isBusy
      ? ('Review in progress · ' + progressLabel)
      : DEFAULT_COACH_TEXT);
  }
  // ===== MOVES LIST =====
  function getMovePieceIcon(pos, moveInfo) {
    var color = (moveInfo && moveInfo.color) || (pos && pos.move && pos.move.color) || '';
    var piece = (pos && pos.move && pos.move.piece) || '';
    piece = String(piece || '').toLowerCase();
    var white = color !== 'b';
    var icons = {
      p: white ? '♙' : '♟',
      n: white ? '♘' : '♞',
      b: white ? '♗' : '♝',
      r: white ? '♖' : '♜',
      q: white ? '♕' : '♛',
      k: white ? '♔' : '♚'
    };
    return icons[piece] || (white ? '♙' : '♟');
  }

  function buildMoveQualityBadge(quality) {
    if (!quality) return '';
    var meta = getQualityMeta(quality);
    return '<span class="move-quality-dot move-quality-dot--' + escapeAttr(quality) + '" title="' + escapeAttr(meta.label) + '" aria-label="' + escapeAttr(meta.label) + '">' +
      escapeHtml(meta.icon) +
    '</span>';
  }

  function buildMoveHistoryButton(index) {
    var pos = gamePositions[index];
    if (!pos) return '';
    var moveInfo = lastAnalysisHistory && lastAnalysisHistory[index - 1] ? lastAnalysisHistory[index - 1] : null;
    var quality = moveInfo && moveInfo.quality ? moveInfo.quality : '';
    var san = pos.san || (pos.move && pos.move.san) || '?';
    var pieceIcon = getMovePieceIcon(pos, moveInfo);
    var qualityAttr = quality ? ' data-quality="' + escapeAttr(quality) + '"' : '';
    return '<button type="button" class="move-san analysis-move-pill" data-move-index="' + index + '"' + qualityAttr + ' onclick="AppController.goToMoveByIndex(' + index + ')">' +
      '<span class="move-piece-icon" aria-hidden="true">' + escapeHtml(pieceIcon) + '</span>' +
      '<span class="move-san-text">' + escapeHtml(san) + '</span>' +
      buildMoveQualityBadge(quality) +
    '</button>';
  }

  function updateMovesList() {
    var list = document.getElementById('movesList');
    if (!list) return;
    
    if (!gamePositions.length || gamePositions.length <= 1) {
      list.innerHTML = '<div class="gr-analysis-empty">Make moves or import a game to see move history.</div>';
      return;
    }
    
    var html = '';

    for (var i = 1; i < gamePositions.length; i += 2) {
      var moveNum = Math.floor((i + 1) / 2);
      html += '<div class="analysis-move-row">';
      html += '<span class="move-number">' + moveNum + '.</span>';
      html += '<div class="analysis-move-cell">' + buildMoveHistoryButton(i) + '</div>';
      html += '<div class="analysis-move-cell">' + (gamePositions[i + 1] ? buildMoveHistoryButton(i + 1) : '') + '</div>';
      html += '</div>';
    }
    
    // Add result
    if (currentGame && currentGame.result && currentGame.result !== '*') {
      html += '<div class="analysis-history-result">' + escapeHtml(currentGame.result) + '</div>';
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
    var tempChess = new Chess();
    tempChess.load(chess.fen());
    stopAutoPlay();

    if (!enginePreviewSnapshot) {
      enginePreviewSnapshot = {
        positions: gamePositions.slice(),
        moveIndex: currentMoveIndex
      };
    }

    var baseIndex = enginePreviewSnapshot.moveIndex;
    var newPositions = enginePreviewSnapshot.positions.slice(0, baseIndex + 1);
    var addedMoves = 0;

    moves.forEach(function(uciMove) {
      if (!uciMove || uciMove.length < 4) return;
      var result = tempChess.move({from: uciMove.slice(0,2), to: uciMove.slice(2,4), promotion: uciMove[4] || 'q'});
      if (result) {
        newPositions.push({fen: tempChess.fen(), move: result, san: result.san, moveNum: newPositions.length, isVariation: true});
        addedMoves++;
      }
    });

    if (!addedMoves) return;

    gamePositions = newPositions;
    currentMoveIndex = Math.min(baseIndex + 1, gamePositions.length - 1);
    updateMovesList();
    reloadPosition();
    updateEnginePreviewControls();
  }

  function exitEnginePreview() {
    if (!enginePreviewSnapshot) return;
    stopAutoPlay();
    gamePositions = enginePreviewSnapshot.positions;
    currentMoveIndex = enginePreviewSnapshot.moveIndex;
    enginePreviewSnapshot = null;
    document.querySelectorAll('#linesContainer .line-item.is-playing').forEach(function(el) {
      el.classList.remove('is-playing');
    });
    updateMovesList();
    reloadPosition();
    updateEnginePreviewControls();
  }

  function updateEnginePreviewControls() {
    var btn = document.getElementById('exitEnginePreviewBtn');
    if (!btn) return;
    btn.hidden = !enginePreviewSnapshot;
  }

  // Public API
  return {
    init: init,
    goToMoveByIndex: goToMoveByIndex,
    openCriticalMoment: openCriticalMoment,
    openMoveQualityList: openMoveQualityList,
    closeMoveQualityList: closeMoveQualityList,
    stepMoveQualitySelection: stepMoveQualitySelection,
    loadEngineLine: loadEngineLine,
    exitEnginePreview: exitEnginePreview,
    loadReviewCandidateLine: loadReviewCandidateLine,
    loadFetchedGame: PlatformFetchController.loadFetchedGame,
    loadFetchedPGNGame: PlatformFetchController.loadFetchedPGNGame,
    loadDbGame: DatabaseController.loadGame,
    showToast: showToast,
    loadPGNPublic: loadPGNGame,
    loadFenPublic: loadFenGame,
    loadFromURLPublic: loadFromURL,
    readPGNFilePublic: readPGNFile,
    renderDatabasePublic: DatabaseController.render,
    switchToTab: switchTab,
    createAnalyzeLinkForPGN: createAnalyzeLinkForPGN,
    renderFetchSkeleton: PlatformFetchController.renderFetchSkeleton,
    parseChesscomArchiveGames: PlatformFetchController.parseChesscomArchiveGames,
    formatChesscomOpeningLabel: PlatformFetchController.formatChesscomOpeningLabel,
    fetchChesscomMonthPgn: PlatformFetchController.fetchChesscomMonthPgn,
    fetchChesscomWithFallback: PlatformFetchController.fetchChesscomWithFallback,
    fetchTextWithFallback: PlatformFetchController.fetchTextWithFallback,
    describeChesscomError: PlatformFetchController.describeChesscomError,
    describeLichessError: PlatformFetchController.describeLichessError,
    formatDurationValue: formatDurationValue,
    triggerAutoReview: triggerAutoReview
  };
})();

export default AppController;
