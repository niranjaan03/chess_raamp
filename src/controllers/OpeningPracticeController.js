/**
 * KnightVision - Opening Practice Controller
 * Handles the opening practice page logic: browsing, practicing moves, coach explanations
 */

import Chess from '../lib/chess';
import ChessBoard from './ChessBoard';
import SoundController from './SoundController';
import { escapeAttr, escapeHtml } from '../utils/dom.js';
import { getBaseOpeningName, getPuzzleTagForOpening } from '../lib/openingPuzzleMap.js';

const FAVORITES_KEY = 'kv_opening_favorites';
const PROGRESS_KEY = 'kv_opening_progress';
const LEARN_PROGRESS_KEY = 'kv_learn_progress_v1';
const TIME_BESTS_KEY = 'kv_opening_time_bests_v1';
const ARENA_STATS_KEY = 'kv_opening_arena_stats_v1';

const MODE_META = {
  learn:    { icon: '📖', title: 'Learn',    desc: 'Step through the line with coach explanations.' },
  practice: { icon: '🎯', title: 'Practice', desc: 'Play the moves with guided feedback and hints.' },
  drill:    { icon: '🔥', title: 'Drill',    desc: 'Replay the line from memory, no hints.' },
  time:     { icon: '⏱',  title: 'Time',     desc: 'Race the clock through the opening.' },
  puzzles:  { icon: '🧩', title: 'Puzzles',  desc: 'Solve positions from this opening.' },
  arena:    { icon: '⚔',  title: 'Arena',    desc: 'Random-line gauntlet. One mistake ends the run.' },
};
const RAW_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '';
const CLEAN_BASE_URL = (!RAW_BASE_URL || RAW_BASE_URL === '/') ? '' : RAW_BASE_URL.replace(/\/$/, '');
const DEFAULT_OPENING_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="12" fill="#111" stroke="#555" stroke-width="6"/><path d="M130 70c0 17.673-26.863 50-30 50s-30-32.327-30-50a30 30 0 1 1 60 0Z" stroke="#d4af37" stroke-width="8" fill="none"/><circle cx="100" cy="70" r="16" fill="#d4af37"/></svg>');
const OPENING_STATS_CACHE_KEY = 'kv_opening_stats_cache_v1';
const OPENING_STATS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const OPENING_STATS_MAX_CONCURRENT = 4;
const SRS_KEY = 'kv_opening_srs_v1';
const OPENING_STATS_SLUG_ALIASES = {
  'Sicilian': 'sicilian-defense',
  'King\'s Indian Attack with e6': 'kings-indian-attack',
  'King\'s Indian Attack with Bf5': 'kings-indian-attack',
  'Caro-Kann Classical': 'caro-kann-defense',
  'Caro-Kann Panov': 'caro-kann-defense',
  'French Classical': 'french-defense',
  'French Tarrasch': 'french-defense',
  'French Winawer': 'french-defense',
  'Sicilian Dragon': 'sicilian-defense',
  'Sicilian Grand Prix': 'sicilian-defense',
  'Sicilian Najdorf': 'sicilian-defense',
  'Sicilian Rossolimo': 'sicilian-defense',
  'Sicilian Sveshnikov': 'sicilian-defense',
  'Smith-Morra Gambit': 'sicilian-defense',
  'Catalan Open': 'catalan-opening',
  'Catalan Closed': 'catalan-opening',
  'Modern Benoni': 'benoni-defense',
  'Scotch Gambit': 'scotch-game',
  'Stonewall Attack': 'london-system',
  'Two Knights Defense': 'italian-game',
  'Belgrade Gambit': 'four-knights-game',
  'Halloween Gambit': 'four-knights-game',
  'Dunst Opening': 'van-geet-opening',
  'Damiano Defense': 'petrov-s-defense',
  'Chigorin Defense': 'queen-s-gambit-declined'
};
const BLACK_REPERTOIRE_NAMES = new Set([
  'Alekhine Defense',
  'Australian Defense',
  'Barnes Defense',
  'Benko Gambit',
  'Benko Gambit Accepted',
  'Benko Gambit Declined',
  'Benoni Defense',
  'Blumenfeld Countergambit',
  'Blumenfeld Countergambit Accepted',
  'Bogo-Indian Defense',
  'Borg Defense',
  'Caro-Kann Defense',
  'Carr Defense',
  'Czech Defense',
  'Duras Gambit',
  'Dutch Defense',
  'Döry Defense',
  'East Indian Defense',
  'Elephant Gambit',
  'English Defense',
  'Englund Gambit',
  'Englund Gambit Declined',
  'French Defense',
  'Fried Fox Defense',
  'Goldsmith Defense',
  'Grünfeld Defense',
  'Gunderam Defense',
  'Hippopotamus Defense',
  'Horwitz Defense',
  'Indian Defense',
  'Kangaroo Defense',
  'King\'s Indian Defense',
  'Latvian Gambit',
  'Latvian Gambit Accepted',
  'Lemming Defense',
  'Lion Defense',
  'Mexican Defense',
  'Mikenas Defense',
  'Modern Defense',
  'Montevideo Defense',
  'Neo-Grünfeld Defense',
  'Nimzo-Indian Defense',
  'Nimzowitsch Defense',
  'Old Indian Defense',
  'Owen Defense',
  'Petrov\'s Defense',
  'Philidor Defense',
  'Pirc Defense',
  'Polish Defense',
  'Pseudo Queen\'s Indian Defense',
  'Pterodactyl Defense',
  'Queen\'s Gambit Accepted',
  'Queen\'s Gambit Declined',
  'Queen\'s Indian Accelerated',
  'Queen\'s Indian Defense',
  'Rat Defense',
  'Robatsch Defense',
  'Scandinavian Defense',
  'Semi-Slav Defense',
  'Semi-Slav Defense Accepted',
  'Sicilian Defense',
  'Slav Defense',
  'Slav Indian',
  'St. George Defense',
  'Tarrasch Defense',
  'Vulture Defense',
  'Wade Defense',
  'Ware Defense',
  'Zaire Defense',
  'Zukertort Defense'
]);
const SICILIAN_FAMILY_NAMES = new Set([
  'Sicilian Defense',
  'Smith-Morra Gambit',
  'Sicilian, Dragon Variation',
  'Sicilian, Najdorf Variation',
  'Sicilian, Sveshnikov Variation',
  'Sicilian, Rossolimo Variation',
  'Sicilian, Grand Prix Attack'
]);

const OpeningPracticeController = (function () {
  var OPENING_DATA = null;
  var uiInitialized = false;
  var favorites = loadFavorites();
  var progress = loadProgress();
  var practiceChess = null;
  var currentOpening = null;
  var currentVariation = null;
  var openingModeVariationIdx = 0;
  var openingModeSelectedMode = 'learn';
  var openingRouteListenerBound = false;
  var expectedMoves = [];       // SAN moves for the current variation
  var currentMoveIndex = 0;     // How far the user has progressed
  var userColor = 'w';          // Which color the user plays
  var practiceMode = 'learn';
  var practiceBoard = null;     // We reuse ChessBoard but in practice mode
  var isPracticing = false;
  var learnMoveIndex = 0;       // Position cursor in learn-mode walk-through
  var learnProgress = loadLearnProgress(); // {openingId: {discovered: {varId: true}}}
  var wrongMove = false;
  var searchQuery = '';
  var filterColor = '';
  var filterStatus = '';
  var openingStatsCache = loadOpeningStatsCache();
  var openingStatsPending = {};
  var openingStatsQueue = [];
  var openingStatsActive = 0;

  // ── SRS state ──────────────────────────────────────────────────────────────
  var srsData = loadSRS();
  var sessionHints = 0;
  var sessionErrors = 0;
  var reviewQueue = [];
  var reviewQueueIdx = 0;
  var isInReviewMode = false;
  var variationIndex = null;
  var timeModeBests = loadTimeModeBests();
  var timeModeState = createInitialTimeModeState();
  var arenaStats = loadArenaStats();
  var arenaState = createInitialArenaState();

  // ── Opening puzzles state ─────────────────────────────────────────────────
  // Puzzles are served from the shared Lichess dataset and filtered by the
  // BASE opening family tag so every variation of the same opening pulls from
  // the same pool (see src/lib/openingPuzzleMap.js).
  var puzzleState = {
    active: false,
    opening: null,
    baseName: '',
    tag: '',
    loading: false,
    puzzle: null,
    chess: null,
    userColor: 'w',
    progressPly: 0,
    solved: false,
    awaitingRetry: false,
    solvedCount: 0,
    attemptedCount: 0,
    requestToken: 0
  };
  var openingPuzzleAdvanceTimer = null;
  var openingPuzzleRecentIds = []; // rolling list to avoid repeats
  var OPENING_PUZZLE_RECENT_MAX = 20;

  // Coach explanations for common moves (keyed by SAN)
  var COACH_EXPLANATIONS = {
    'e4': "1.e4 — The King's Pawn Opening. This controls the center immediately and opens lines for the bishop and queen. It's the most popular first move, favored by aggressive players.",
    'e5': "A central pawn advance. As 1...e5 it classically matches White's control, leading to open games with tactical opportunities for both sides. When played later (e.g. French Advance), it gains space and restricts the opponent's pieces.",
    'd4': "1.d4 — The Queen's Pawn Opening. This controls the center and is generally considered more positional than 1.e4. The d4 pawn is already protected by the queen.",
    'd5': "1...d5 — Directly challenging White's central control. This solid response leads to classical Queen's Pawn structures.",
    'c4': "The English Opening / Queen's Gambit. White fights for d5 control without committing the d-pawn yet. It's a flexible move that can transpose into many systems.",
    'c5': "The Sicilian Defense's key move. Black fights for the d4 square asymmetrically, creating an unbalanced position. The Sicilian is the most popular and successful defense against 1.e4.",
    'Nf3': "Developing the knight to its best square. It controls e5 and d4, and prepares kingside castling. A flexible move that keeps many options open.",
    'Nc3': "Developing the knight toward the center. It supports e4 and prepares for various setups. However, it blocks the c-pawn.",
    'Nc6': "Developing the knight to defend e5 and put pressure on d4. The most natural developing move for Black in many openings.",
    'Nf6': "Developing the knight to its most active square. It attacks e4 and prepares kingside castling. A key move in many Indian defenses.",
    'Bb5': "The Ruy Lopez bishop move. It pins the knight defending e5, creating long-term pressure. One of the most classical opening ideas in chess.",
    'Bc4': "The Italian bishop targets the weak f7 square. This is one of the oldest opening ideas, aiming for quick development and kingside pressure.",
    'Bc5': "Developing the bishop to an active diagonal, targeting f2. This puts immediate pressure on White's kingside.",
    'Bb4': "Pinning the knight on c3. This is the key idea of the Nimzo-Indian Defense, fighting for control of e4 indirectly.",
    'Bg5': "Pinning the knight on f6 to the queen. This creates tension and can disrupt Black's coordination.",
    'Bf4': "The London System bishop. Placed outside the pawn chain before playing e3, keeping the bishop active. A solid and popular system.",
    'Be2': "A modest but solid bishop development. It prepares castling and keeps options flexible.",
    'Be7': "A solid bishop development preparing to castle kingside. Common in the Queen's Gambit Declined.",
    'Bg7': "Fianchettoing the bishop on the long diagonal. This is the hallmark of the King's Indian and other hypermodern defenses.",
    'O-O': "Castling kingside — getting the king to safety and connecting the rooks. A crucial step in development.",
    'O-O-O': "Castling queenside — the king goes the opposite direction. This often signals aggressive intentions, as the king is slightly less safe.",
    'f4': "An aggressive pawn push. In the King's Gambit, White sacrifices a pawn for rapid development. In other openings, it supports e5.",
    'f5': "The Dutch Defense move. Black immediately fights for e4 control. Ambitious but slightly weakening of the kingside.",
    'c6': "The Caro-Kann move. Black prepares to play ...d5 with solid pawn support. A very reliable defense.",
    'e6': "The French Defense move. Black builds a solid pawn chain but locks in the light-squared bishop. Strategically complex.",
    'g6': "Preparing to fianchetto the bishop. This is the foundation of the King's Indian, Pirc, and Modern defenses.",
    'b3': "The Nimzowitsch-Larsen Attack or a fianchetto setup. White prepares Bb2 to control the long diagonal.",
    'b4': "The Polish Opening (Sokolsky). An unusual flank opening aiming for queenside expansion.",
    'a6': "The Morphy Defense in the Ruy Lopez. Black forces the bishop to decide its retreat square and prepares ...b5.",
    'a3': "A useful waiting move or prophylactic. In many positions, it prevents ...Bb4 or prepares b4 expansion.",
    'd6': "Supporting the e5 pawn (Philidor) or preparing a Pirc/King's Indian setup. A flexible but somewhat passive move.",
    'b5': "Challenging the bishop on a4 in the Ruy Lopez, or expanding on the queenside. An important thematic push.",
    'Ba4': "Retreating the bishop while maintaining the pin. This is the main line of the Ruy Lopez after ...a6.",
    'Bb3': "Retreating the bishop to a safe diagonal where it still eyes f7. A common Ruy Lopez continuation.",
    'exd5': "Capturing in the center. This can simplify the position or open lines depending on how the opponent recaptures.",
    'cxd4': "Capturing the center pawn. In the Sicilian, this leads to the Open Sicilian with rich tactical play.",
    'Nxd4': "Recapturing with the knight, centralizing it powerfully on d4. The knight dominates from here in the Open Sicilian.",
    'dxc4': "Accepting the Queen's Gambit. Black takes the pawn but cannot hold it long-term. The goal is to use the tempo White spends recapturing.",
    'Re1': "Supporting the e-pawn and controlling the e-file. A key move in many Ruy Lopez and Italian structures.",
    'Qe2': "Supporting e4 and preparing to connect rooks. In some lines, the queen is well-placed on e2.",
    'h3': "A prophylactic move preventing ...Bg4 pins. Very common in the Ruy Lopez and Italian Game.",
    'Nb8': "A paradoxical retreat! In the Breyer Variation of the Ruy Lopez, the knight reroutes to d7 for better placement.",
    'Nxe4': "Capturing the e4 pawn. In the Berlin Defense, this leads to a famous endgame. In other openings, it creates tactical complications.",
    'dxe4': "Capturing with the pawn, opening the d-file. In the French Rubinstein, this concedes the center but gains piece activity.",
    'cxd5': "Exchanging in the center. The Exchange Variation often leads to symmetrical pawn structures.",
    'exd4': "Capturing in the center, opening the position. This is a key moment in the Scotch Game and many other openings.",
    'Qc2': "The Classical Nimzo-Indian. White prepares to recapture on c3 with a pawn after ...Bxc3, maintaining the pawn structure.",
    'e3': "A solid move supporting d4. In the Nimzo-Indian Normal Variation, White keeps a strong center while preparing piece development.",
    'f3': "Supporting the e4 point aggressively. In the Sämisch King's Indian, this builds a massive center.",
    'd3': "A flexible move keeping the center fluid. Common in Italian setups and various other systems.",
  };

  function resolveImagePath(path) {
    if (!path || typeof path !== 'string' || !path.trim()) {
      return DEFAULT_OPENING_IMG;
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    var clean = path.trim();
    if (clean.startsWith('./')) clean = clean.slice(2);
    if (clean.startsWith('/')) clean = clean.slice(1);
    if (!clean) return DEFAULT_OPENING_IMG;
    var prefix = CLEAN_BASE_URL ? (CLEAN_BASE_URL + '/') : '/';
    return prefix + clean;
  }

  function applyImageFallbacks(root) {
    var scope = root || document;
    var imgs = scope.querySelectorAll ? scope.querySelectorAll('img[data-opening-img]') : [];
    imgs.forEach(function(img) {
      if (!img.__kvOpeningImg) {
        img.__kvOpeningImg = true;
        img.onerror = function() {
          this.onerror = null;
          this.src = DEFAULT_OPENING_IMG;
        };
      }
    });
  }

  function getOpeningPracticeColor(opening) {
    var name = opening && opening.name ? opening.name : '';
    if (!name) return 'w';
    if (opening.practiceColor === 'b' || opening.practiceColor === 'w') {
      return opening.practiceColor;
    }
    if (BLACK_REPERTOIRE_NAMES.has(name)) return 'b';
    if (/defen[sc]e|countergambit/i.test(name)) return 'b';
    return 'w';
  }

  function getColorLabel(color) {
    return color === 'b' ? 'Black' : 'White';
  }

  function getColorBadgeClass(color) {
    return color === 'b' ? 'black-badge' : 'white-badge';
  }

  function compareOpeningNames(a, b) {
    var nameA = (a && a.name ? a.name : '').trim();
    var nameB = (b && b.name ? b.name : '').trim();
    return nameA.localeCompare(nameB, undefined, {
      sensitivity: 'base',
      numeric: true
    });
  }

  function isSicilianFamilyOpening(opening) {
    return !!(opening && opening.name && SICILIAN_FAMILY_NAMES.has(opening.name));
  }

  function getOpeningLookupKey(opening) {
    if (!opening) return '';
    return opening.id || opening.name || '';
  }

  function getCanonicalOpening(opening, variation) {
    return variation && variation.__sourceOpening ? variation.__sourceOpening : opening;
  }

  function getCanonicalVariation(variation) {
    return variation && variation.__sourceVariation ? variation.__sourceVariation : variation;
  }

  function getCanonicalVariationId(opening, variation) {
    var sourceOpening = getCanonicalOpening(opening, variation);
    var sourceVariation = getCanonicalVariation(variation);
    if (!sourceOpening || !sourceVariation) return '';
    return getVariationId(sourceOpening, sourceVariation);
  }

  function getFavoriteKey(opening) {
    return getOpeningLookupKey(opening);
  }

  function getOpeningSearchText(opening) {
    if (!opening) return '';
    var parts = [opening.name || '', opening.eco || '', opening.description || ''];
    (opening.searchAliases || []).forEach(function(alias) {
      parts.push(alias || '');
    });
    (opening.variations || []).forEach(function(variation) {
      parts.push(variation.name || '', variation.fullName || '', variation.pgn || '');
    });
    return parts.join(' ').toLowerCase();
  }

  function getGroupedOpeningMembers(opening) {
    if (!opening) return [];
    if (Array.isArray(opening.__groupMembers) && opening.__groupMembers.length) {
      return opening.__groupMembers.slice();
    }
    return [opening];
  }

  function getOpeningDiscoveredStats(opening) {
    var members = getGroupedOpeningMembers(opening);
    var total = (opening && opening.variations ? opening.variations.length : 0) || 0;
    var discovered = 0;

    members.forEach(function(member) {
      var record = learnProgress[getOpeningId(member)];
      if (record && record.discovered) {
        discovered += Object.keys(record.discovered).length;
      }
    });

    return {
      discovered: Math.min(discovered, total),
      total: total
    };
  }

  function formatGroupedVariationName(sourceOpening, variation) {
    var sourceName = (sourceOpening && sourceOpening.name ? sourceOpening.name : '').replace(/^Sicilian,\s*/, '');
    var cleanSource = sourceName.replace(/\s+Variation$/i, '').trim() || 'Sicilian Defense';
    var variationName = variation && variation.name ? variation.name.trim() : 'Main Line';
    if (!variationName || /^main line$/i.test(variationName)) {
      return cleanSource + ' · Main Line';
    }
    return cleanSource + ' · ' + variationName;
  }

  function buildGroupedOpening(groupKey, members) {
    if (!members || !members.length) return null;

    if (groupKey === 'sicilian') {
      var groupedVariations = [];
      members.forEach(function(member) {
        (member.variations || []).forEach(function(variation) {
          groupedVariations.push(Object.assign({}, variation, {
            name: formatGroupedVariationName(member, variation),
            __sourceOpening: member,
            __sourceVariation: variation
          }));
        });
      });

      return {
        id: 'group::sicilian',
        name: 'Sicilian',
        eco: 'B20-B99',
        ecoVolume: 'B',
        image: '/opening-images/sicilian-defense.png',
        description: 'All major Sicilian systems in one place: open, anti-Sicilian, and mainline variations grouped under a single Practice entry.',
        practiceColor: 'b',
        searchAliases: members.map(function(member) { return member.name; }),
        variations: groupedVariations,
        __groupMembers: members.slice()
      };
    }

    return null;
  }

  function getDisplayOpenings() {
    if (!Array.isArray(OPENING_DATA) || !OPENING_DATA.length) return [];

    var display = [];
    var sicilianMembers = [];

    OPENING_DATA.forEach(function(opening) {
      if (isSicilianFamilyOpening(opening)) {
        sicilianMembers.push(opening);
        return;
      }
      display.push(opening);
    });

    if (sicilianMembers.length) {
      display.push(buildGroupedOpening('sicilian', sicilianMembers));
    }

    return display.filter(Boolean).sort(compareOpeningNames);
  }

  // ===== PERSISTENCE HELPERS =====
  function loadFavorites() {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveFavorites() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites || {}));
    } catch (e) {
      /* ignore storage errors */
    }
  }

  function loadProgress() {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveProgress() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress || {}));
    } catch (e) {
      /* ignore */
    }
  }

  function loadLearnProgress() {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(LEARN_PROGRESS_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function saveLearnProgress() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(learnProgress || {}));
    } catch (e) { /* ignore */ }
  }

  function loadTimeModeBests() {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(TIME_BESTS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveTimeModeBests() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TIME_BESTS_KEY, JSON.stringify(timeModeBests || {}));
    } catch (e) {
      /* ignore */
    }
  }

  function createInitialTimeModeState() {
    return {
      active: false,
      finished: false,
      totalMs: 0,
      remainingMs: 0,
      moveBudgetMs: 0,
      moveRemainingMs: 0,
      userMoves: 0,
      solvedMoves: 0,
      score: 0,
      maxScore: 0,
      lastTickAt: 0,
      timerId: null,
      medal: null,
      best: null,
      result: null
    };
  }

  function loadArenaStats() {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(ARENA_STATS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveArenaStats() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ARENA_STATS_KEY, JSON.stringify(arenaStats || {}));
    } catch (e) {
      /* ignore */
    }
  }

  function createInitialArenaState() {
    return {
      active: false,
      finished: false,
      openingId: '',
      challengeNo: 0,
      streak: 0,
      score: 0,
      rating: 1200,
      startRating: 1200,
      ratingDelta: 0,
      peakRating: 1200,
      bestScore: 0,
      bestStreak: 0,
      lineRating: 1200,
      lineUserMoves: 0,
      lineId: '',
      lineName: '',
      recentLineIds: [],
      completedLineIds: [],
      advanceTimerId: null,
      lastResult: null
    };
  }

  function getDiscoveredLines(opening) {
    if (!opening || !learnProgress) return 0;
    return getOpeningDiscoveredStats(opening).discovered;
  }

  function markLineDiscovered(opening, variation) {
    if (!opening || !variation) return;
    var sourceOpening = getCanonicalOpening(opening, variation);
    var sourceVariation = getCanonicalVariation(variation);
    var openingId = getOpeningId(sourceOpening);
    var variationId = getVariationId(sourceOpening, sourceVariation);
    learnProgress = learnProgress || {};
    if (!learnProgress[openingId]) learnProgress[openingId] = { discovered: {} };
    if (!learnProgress[openingId].discovered) learnProgress[openingId].discovered = {};
    if (!learnProgress[openingId].discovered[variationId]) {
      learnProgress[openingId].discovered[variationId] = true;
      saveLearnProgress();
      renderModeCards();
      updateLinesCounter();
    }
  }

  function loadOpeningStatsCache() {
    if (typeof window === 'undefined') return {};
    try {
      return pruneOpeningStatsCache(JSON.parse(localStorage.getItem(OPENING_STATS_CACHE_KEY) || '{}'));
    } catch (e) {
      return {};
    }
  }

  function pruneOpeningStatsCache(cacheData) {
    var next = {};
    var now = Date.now();
    Object.keys(cacheData || {}).forEach(function(key) {
      var entry = cacheData[key];
      if (!entry || !entry.fetchedAt || !entry.data) return;
      if ((now - entry.fetchedAt) > OPENING_STATS_CACHE_TTL_MS) return;
      next[key] = entry;
    });
    return next;
  }

  function saveOpeningStatsCache() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(OPENING_STATS_CACHE_KEY, JSON.stringify(pruneOpeningStatsCache(openingStatsCache)));
    } catch (e) {
      /* ignore */
    }
  }

  // ── SRS helpers ────────────────────────────────────────────────────────────

  function loadSRS() {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(SRS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveSRS() {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(SRS_KEY, JSON.stringify(srsData)); } catch { /* storage full */ }
  }

  function updateSRS(srsId, rating) {
    var r = srsData[srsId] || { interval: 1, ef: 2.5, dueDate: 0, reps: 0 };
    var now = Date.now();
    if (rating === 'again') {
      r.interval = 1;
      r.ef = Math.max(1.3, (r.ef || 2.5) - 0.2);
    } else if (rating === 'hard') {
      r.interval = Math.max(1, Math.round((r.interval || 1) * 1.2));
      r.ef = Math.max(1.3, (r.ef || 2.5) - 0.15);
    } else {
      var reps = r.reps || 0;
      if (reps < 1) r.interval = 1;
      else if (reps < 2) r.interval = 3;
      else r.interval = Math.round((r.interval || 1) * (r.ef || 2.5));
      r.ef = Math.min(3.0, (r.ef || 2.5) + 0.1);
    }
    r.reps = (r.reps || 0) + 1;
    r.dueDate = now + r.interval * 86400000;
    srsData[srsId] = r;
    saveSRS();
    return r;
  }

  function getDueCount() {
    var now = Date.now();
    return Object.keys(srsData).filter(function(k) {
      return srsData[k].dueDate && srsData[k].dueDate <= now;
    }).length;
  }

  function getSRSStatusLabel(srsId) {
    var r = srsData[srsId];
    if (!r || !r.reps) return 'new';
    if (r.dueDate && r.dueDate <= Date.now()) return 'due';
    if (r.interval >= 21) return 'mature';
    return 'learning';
  }

  function formatSRSInterval(days) {
    if (days <= 1) return '1 day';
    if (days < 7) return days + ' days';
    if (days < 30) return '~' + Math.round(days / 7) + 'w';
    return '~' + Math.round(days / 30) + 'mo';
  }

  function getOpeningSRSStats(opening) {
    var members = getGroupedOpeningMembers(opening);
    var now = Date.now();
    var due = 0;
    var started = 0;
    var mature = 0;

    members.forEach(function(member) {
      (member.variations || []).forEach(function(variation) {
        var record = srsData[getVariationId(member, variation)];
        if (!record || !record.reps) return;
        started++;
        if (record.dueDate && record.dueDate <= now) due++;
        if ((record.interval || 0) >= 21) mature++;
      });
    });

    return {
      due: due,
      started: started,
      mature: mature
    };
  }

  function isOpeningFavorite(opening) {
    return isFavorite(getFavoriteKey(opening));
  }

  function getOpeningTrainingState(opening) {
    var progressInfo = getOpeningProgress(opening);
    var discoveredInfo = getOpeningDiscoveredStats(opening);
    var srsInfo = getOpeningSRSStats(opening);
    var mastered = progressInfo.total > 0 && progressInfo.completed >= progressInfo.total;
    var started = !mastered && (
      progressInfo.completed > 0 ||
      discoveredInfo.discovered > 0 ||
      srsInfo.started > 0
    );

    return {
      progress: progressInfo,
      discovered: discoveredInfo,
      srs: srsInfo,
      favorite: isOpeningFavorite(opening),
      mastered: mastered,
      inProgress: started
    };
  }

  function matchesStatusFilter(opening) {
    if (!filterStatus) return true;
    var state = getOpeningTrainingState(opening);
    if (filterStatus === 'favorites') return state.favorite;
    if (filterStatus === 'due') return state.srs.due > 0;
    if (filterStatus === 'mastered') return state.mastered;
    if (filterStatus === 'in-progress') return state.inProgress;
    return true;
  }

  function buildVariationIndex() {
    if (variationIndex) return variationIndex;
    variationIndex = {};
    (OPENING_DATA || []).forEach(function(op) {
      (op.variations || []).forEach(function(v, idx) {
        variationIndex[getVariationId(op, v)] = { opening: op, variation: v, variationIdx: idx };
      });
    });
    return variationIndex;
  }

  function buildReviewQueue() {
    var now = Date.now();
    var idx = buildVariationIndex();
    return Object.keys(srsData)
      .filter(function(id) { return srsData[id].dueDate && srsData[id].dueDate <= now && idx[id]; })
      .sort(function(a, b) { return srsData[a].dueDate - srsData[b].dueDate; })
      .map(function(id) { return { srsId: id, item: idx[id] }; });
  }

  function updateReviewBanner() {
    var banner = document.getElementById('reviewQueueBanner');
    var countEl = document.getElementById('reviewQueueCount');
    if (!banner) return;
    var count = getDueCount();
    if (count > 0) {
      if (countEl) countEl.textContent = count + ' line' + (count !== 1 ? 's' : '') + ' due for review';
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }

  function startReviewSession() {
    reviewQueue = buildReviewQueue();
    if (!reviewQueue.length) return;
    reviewQueueIdx = 0;
    isInReviewMode = true;
    launchReviewItem(reviewQueue[0]);
  }

  function launchReviewItem(entry) {
    if (!entry) return;
    currentOpening = entry.item.opening;
    // Show detail briefly then start practice
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'none';
    startPractice(entry.item.variationIdx, 'drill');
  }

  function advanceReviewQueue(rating) {
    if (rating === 'again') reviewQueue.push(reviewQueue[reviewQueueIdx]);
    reviewQueueIdx++;
    if (reviewQueueIdx >= reviewQueue.length) {
      isInReviewMode = false;
      backToGallery();
      updateReviewBanner();
      setTimeout(function() {
        var countEl = document.getElementById('reviewQueueCount');
        var banner = document.getElementById('reviewQueueBanner');
        if (!banner) return;
        banner.style.display = '';
        if (countEl) countEl.textContent = '\u2713 Review session complete!';
        setTimeout(updateReviewBanner, 3000);
      }, 300);
      return;
    }
    launchReviewItem(reviewQueue[reviewQueueIdx]);
  }

  function slugifyOpeningName(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/["'’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getOpeningModeUrl(openingKey, variationIdx) {
    var idx = Math.max(0, parseInt(variationIdx, 10) || 0);
    return '/openings/' + encodeURIComponent(openingKey || '') + '/mode/' + idx;
  }

  function parseOpeningModeRoute() {
    if (typeof window === 'undefined') return null;
    var match = String(window.location.pathname || '').match(/^\/openings\/([^/]+)\/mode(?:\/(\d+))?\/?$/);
    if (!match) return null;
    return {
      openingKey: decodeURIComponent(match[1] || ''),
      variationIdx: Math.max(0, parseInt(match[2] || '0', 10) || 0)
    };
  }

  function writeOpeningModeHistory(opening, variationIdx, replace) {
    if (typeof window === 'undefined' || !opening) return;
    var openingKey = getOpeningLookupKey(opening);
    var url = getOpeningModeUrl(openingKey, variationIdx);
    try {
      var state = { kvTab: 'openings', openingMode: true, openingKey: openingKey, variationIdx: variationIdx };
      if (replace) window.history.replaceState(state, document.title, url);
      else window.history.pushState(state, document.title, url);
    } catch (e) { /* history API unavailable */ }
  }

  function writeOpeningsListHistory(replace) {
    if (typeof window === 'undefined') return;
    try {
      var state = { kvTab: 'openings' };
      if (replace) window.history.replaceState(state, document.title, '/openings');
      else window.history.pushState(state, document.title, '/openings');
    } catch (e) { /* history API unavailable */ }
  }

  function formatOpeningStatsDate(value) {
    if (!value) return '';
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getOpeningStatsMeta(opening) {
    if (!opening || !opening.name) return null;
    var practiceColor = getOpeningPracticeColor(opening);
    var side = practiceColor === 'b' ? 'black' : 'white';
    var slug = OPENING_STATS_SLUG_ALIASES[opening.name] || slugifyOpeningName(opening.name);
    if (!slug) return null;
    return {
      key: slug + '::' + side,
      slug: slug,
      side: side,
      colorLabel: getColorLabel(practiceColor)
    };
  }

  function readOpeningStatsCache(meta) {
    if (!meta || !openingStatsCache[meta.key]) return null;
    var entry = openingStatsCache[meta.key];
    if (!entry || !entry.fetchedAt || !entry.data) return null;
    if ((Date.now() - entry.fetchedAt) > OPENING_STATS_CACHE_TTL_MS) {
      delete openingStatsCache[meta.key];
      saveOpeningStatsCache();
      return null;
    }
    return entry.data;
  }

  function writeOpeningStatsCache(meta, data) {
    if (!meta) return;
    openingStatsCache[meta.key] = {
      fetchedAt: Date.now(),
      data: data
    };
    saveOpeningStatsCache();
  }

  function queueOpeningStatsRequest(meta) {
    return new Promise(function(resolve, reject) {
      openingStatsQueue.push({ meta: meta, resolve: resolve, reject: reject });
      pumpOpeningStatsQueue();
    });
  }

  function pumpOpeningStatsQueue() {
    while (openingStatsActive < OPENING_STATS_MAX_CONCURRENT && openingStatsQueue.length) {
      (function(job) {
        openingStatsActive++;
        fetchOpeningStatsFromApi(job.meta)
          .then(job.resolve)
          .catch(job.reject)
          .finally(function() {
            openingStatsActive = Math.max(0, openingStatsActive - 1);
            pumpOpeningStatsQueue();
          });
      })(openingStatsQueue.shift());
    }
  }

  async function fetchOpeningStatsFromApi(meta) {
    var query = '?slug=' + encodeURIComponent(meta.slug) + '&side=' + encodeURIComponent(meta.side);
    var response = await fetch('/api/opening-stats' + query, { cache: 'no-store' });
    var payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }

    if (response.status === 404) {
      return {
        ok: false,
        unavailable: true,
        slug: meta.slug,
        side: meta.side,
        error: payload && payload.error ? payload.error : 'No live win rate found for this opening'
      };
    }

    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload && payload.error ? payload.error : 'Could not load opening win rate');
    }

    return payload;
  }

  function ensureOpeningStats(opening) {
    var meta = getOpeningStatsMeta(opening);
    if (!meta) {
      return Promise.resolve({
        ok: false,
        unavailable: true,
        error: 'Opening stats unavailable'
      });
    }

    var cached = readOpeningStatsCache(meta);
    if (cached) return Promise.resolve(cached);
    if (openingStatsPending[meta.key]) return openingStatsPending[meta.key];

    openingStatsPending[meta.key] = queueOpeningStatsRequest(meta)
      .then(function(payload) {
        writeOpeningStatsCache(meta, payload);
        return payload;
      })
      .catch(function(err) {
        var failure = {
          ok: false,
          unavailable: true,
          slug: meta.slug,
          side: meta.side,
          error: err && err.message ? err.message : 'Could not load opening win rate'
        };
        writeOpeningStatsCache(meta, failure);
        return failure;
      })
      .finally(function() {
        delete openingStatsPending[meta.key];
      });

    return openingStatsPending[meta.key];
  }

  function buildOpeningStatsMarkup(opening, stats, view) {
    var meta = getOpeningStatsMeta(opening);
    var colorLabel = meta ? meta.colorLabel : 'This side';
    var detail = view === 'detail';

    if (!stats) {
      return detail
        ? '<span class="opening-live-stats-status">Loading live ' + escapeHtml(colorLabel) + ' win rate...</span>'
        : '<span class="opening-live-stats-status">Loading live win rate...</span>';
    }

    if (!stats.ok) {
      return detail
        ? '<span class="opening-live-stats-status is-muted">Live internet win rate is unavailable for this opening.</span>'
        : '';
    }

    var games = stats.games ? escapeHtml(stats.games + ' games') : '';
    var updated = formatOpeningStatsDate(stats.dateModified);
    var sourceUrl = stats.sourceUrl ? escapeAttr(stats.sourceUrl) : '';
    var sourceName = escapeHtml(stats.sourceName || 'Source');

    if (!detail) {
      return '<span class="opening-live-stats-label">Live ' + escapeHtml(colorLabel) + ' win rate</span>' +
        '<span class="opening-live-stats-value">' + escapeHtml(stats.winRate.toFixed(1) + '%') + '</span>' +
        (games ? '<span class="opening-live-stats-meta">' + games + '</span>' : '');
    }

    return '<span class="opening-live-stats-label">Live ' + escapeHtml(colorLabel) + ' win rate</span>' +
      '<span class="opening-live-stats-value">' + escapeHtml(stats.winRate.toFixed(1) + '%') + '</span>' +
      (stats.drawRate !== null && stats.drawRate !== undefined
        ? '<span class="opening-live-stats-meta">Draw ' + escapeHtml(stats.drawRate.toFixed(1) + '%') + '</span>'
        : '') +
      (stats.lossRate !== null && stats.lossRate !== undefined
        ? '<span class="opening-live-stats-meta">Loss ' + escapeHtml(stats.lossRate.toFixed(1) + '%') + '</span>'
        : '') +
      (games ? '<span class="opening-live-stats-meta">' + games + '</span>' : '') +
      (updated ? '<span class="opening-live-stats-meta">Updated ' + escapeHtml(updated) + '</span>' : '') +
      (sourceUrl ? '<a class="opening-live-stats-link" href="' + sourceUrl + '" target="_blank" rel="noreferrer">' + sourceName + '</a>' : '');
  }

  function hydrateOpeningStatsElement(element, opening, view) {
    if (!element || !opening) return;
    element.classList.add('is-loading');
    element.innerHTML = buildOpeningStatsMarkup(opening, null, view);

    ensureOpeningStats(opening).then(function(stats) {
      if (!element.isConnected) return;
      if (view === 'detail' && (!currentOpening || getOpeningLookupKey(currentOpening) !== getOpeningLookupKey(opening))) return;
      element.classList.remove('is-loading');
      if (!stats || !stats.ok) {
        element.classList.add('is-unavailable');
      } else {
        element.classList.remove('is-unavailable');
      }
      element.innerHTML = buildOpeningStatsMarkup(opening, stats, view);
    });
  }

  function getOpeningId(opening) {
    return getOpeningLookupKey(opening) || ((opening.eco || 'X') + '::' + (opening.name || ''));
  }

  function getVariationId(opening, variation) {
    return getOpeningId(opening) + '::' + (variation.name || variation.fullName || 'var');
  }

  function getOpeningProgress(opening) {
    var members = getGroupedOpeningMembers(opening);
    var total = (opening.variations || []).length || 1;
    var completed = 0;

    members.forEach(function(member) {
      var record = progress[getOpeningId(member)];
      if (record && record.completed) {
        completed += Object.keys(record.completed).length;
      }
    });

    return {
      completed: Math.min(completed, total),
      total: total,
      percent: Math.max(0, Math.min(100, total ? Math.round((completed / total) * 100) : 0))
    };
  }

  function isVariationDiscovered(opening, variation) {
    var sourceOpening = getCanonicalOpening(opening, variation);
    var sourceVariation = getCanonicalVariation(variation);
    if (!sourceOpening || !sourceVariation) return false;
    var record = learnProgress[getOpeningId(sourceOpening)];
    var variationId = getVariationId(sourceOpening, sourceVariation);
    return !!(record && record.discovered && record.discovered[variationId]);
  }

  function isVariationPerfected(opening, variation) {
    var sourceOpening = getCanonicalOpening(opening, variation);
    var sourceVariation = getCanonicalVariation(variation);
    if (!sourceOpening || !sourceVariation) return false;
    var record = progress[getOpeningId(sourceOpening)];
    var variationId = getVariationId(sourceOpening, sourceVariation);
    return !!(record && record.completed && record.completed[variationId]);
  }

  function toggleFavorite(openingId) {
    if (!openingId) return;
    favorites = favorites || {};
    if (favorites[openingId]) {
      delete favorites[openingId];
    } else {
      favorites[openingId] = true;
    }
    saveFavorites();
  }

  function isFavorite(openingId) {
    return !!(favorites && favorites[openingId]);
  }

  function toggleOpeningFavorite(opening) {
    if (!opening) return;
    toggleFavorite(getFavoriteKey(opening));
    renderOpeningGallery();
    updateDetailFavoriteButton();
  }

  function updateDetailFavoriteButton() {
    var btn = document.getElementById('detailFavoriteBtn');
    if (!btn) return;
    var isActive = !!(currentOpening && isOpeningFavorite(currentOpening));
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.title = isActive ? 'Remove from favorites' : 'Save to favorites';
    btn.innerHTML = '<span class="opening-favorite-btn-icon" aria-hidden="true">' + (isActive ? '&#9829;' : '&#9825;') + '</span>';
  }

  function buildOpeningCardStatusMarkup(state) {
    var parts = [];
    if (state.favorite) parts.push('<span class="opening-card-chip is-favorite">&#9829; Favorite</span>');
    if (state.srs.due > 0) parts.push('<span class="opening-card-chip is-due">' + escapeHtml(state.srs.due + ' due') + '</span>');
    if (state.mastered) parts.push('<span class="opening-card-chip is-mastered">Mastered</span>');
    else if (state.inProgress) parts.push('<span class="opening-card-chip is-progress">In Progress</span>');
    return parts.join('');
  }

  function markVariationComplete(opening, variation) {
    if (!opening || !variation) return;
    var sourceOpening = getCanonicalOpening(opening, variation);
    var sourceVariation = getCanonicalVariation(variation);
    var openingId = getOpeningId(sourceOpening);
    var variationId = getVariationId(sourceOpening, sourceVariation);
    progress = progress || {};
    if (!progress[openingId]) {
      progress[openingId] = { completed: {} };
    }
    if (!progress[openingId].completed[variationId]) {
      progress[openingId].completed[variationId] = true;
      saveProgress();
      updateDetailProgressDisplay();
      renderOpeningGallery();
    }
  }

  function updateDetailProgressDisplay() {
    if (!currentOpening) return;
    var detail = document.getElementById('detailVarCount');
    if (!detail) return;
    var info = getOpeningProgress(currentOpening);
    detail.textContent = info.completed + ' / ' + info.total + ' lines mastered';
  }

  // ===== OPENING GALLERY =====
  function renderOpeningGallery() {
    var container = document.getElementById('openingGalleryGrid');
    if (!container) return;

    var openings = getDisplayOpenings();
    var query = (searchQuery || '').toLowerCase().trim();

    var filtered = openings.filter(function (op) {
      var matchSearch = !query || getOpeningSearchText(op).includes(query);
      var practiceColor = getOpeningPracticeColor(op);
      var matchColor = !filterColor || practiceColor === filterColor;
      return matchSearch && matchColor && matchesStatusFilter(op);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="no-openings">No openings match your search.</div>';
      return;
    }

    container.innerHTML = filtered.map(function (op) {
      var imageSrc = resolveImagePath(op.image);
      var varCount = op.variations.length;
      var definition = getOpeningDefinition(op);
      var practiceColor = getOpeningPracticeColor(op);
      var colorLabel = getColorLabel(practiceColor);
      var openingKey = getOpeningLookupKey(op);
      var state = getOpeningTrainingState(op);
      var favoriteActive = state.favorite;
      var footerCopy = state.progress.completed + ' / ' + state.progress.total + ' mastered';
      return '<div class="opening-card" data-opening="' + encodeURIComponent(openingKey) + '">' +
        '<div class="opening-card-img">' +
        '<img data-opening-img="true" src="' + imageSrc + '" alt="' + op.name + '" loading="lazy" />' +
        '</div>' +
        '<div class="opening-card-body">' +
        '<div class="opening-card-topline">' +
        '<span class="opening-side-badge ' + getColorBadgeClass(practiceColor) + '">' + colorLabel + '</span>' +
        '<button class="opening-favorite-btn opening-card-favorite' + (favoriteActive ? ' is-active' : '') + '" data-favorite="' + encodeURIComponent(openingKey) + '" aria-pressed="' + (favoriteActive ? 'true' : 'false') + '" title="' + (favoriteActive ? 'Remove from favorites' : 'Save to favorites') + '">' +
        '<span class="opening-favorite-btn-icon" aria-hidden="true">' + (favoriteActive ? '&#9829;' : '&#9825;') + '</span>' +
        '</button>' +
        '</div>' +
        '<div class="opening-card-name">' + op.name + '</div>' +
        '<div class="opening-card-desc">' + definition + '</div>' +
        '<div class="opening-card-progress-row">' +
        '<div class="opening-card-progress-bar"><span style="width:' + state.progress.percent + '%"></span></div>' +
        '<div class="opening-card-progress-text">' + escapeHtml(footerCopy) + '</div>' +
        '</div>' +
        '<div class="opening-card-chip-row">' + buildOpeningCardStatusMarkup(state) + '</div>' +
        '<div class="opening-live-stats" data-opening-stats="' + encodeURIComponent(openingKey) + '"></div>' +
        '<div class="opening-card-footer">' +
        '<span class="var-count">' + varCount + ' variation' + (varCount !== 1 ? 's' : '') + ' · ' + escapeHtml(footerCopy) + '</span>' +
        '<button class="btn-practice-open">Practice →</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    // Attach click handlers
    container.querySelectorAll('.opening-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var openingKey = decodeURIComponent(this.getAttribute('data-opening'));
        showOpeningDetail(openingKey);
      });
    });

    container.querySelectorAll('.btn-practice-open').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var card = this.closest('.opening-card');
        var openingKey = card ? decodeURIComponent(card.getAttribute('data-opening') || '') : '';
        if (openingKey) showOpeningMode(openingKey, 0);
      });
    });

    container.querySelectorAll('[data-favorite]').forEach(function(btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var openingKey = decodeURIComponent(this.getAttribute('data-favorite'));
        var opening = openings.find(function(item) { return getOpeningLookupKey(item) === openingKey; });
        if (opening) toggleOpeningFavorite(opening);
      });
    });

    applyImageFallbacks(container);
    var statsObserver = new IntersectionObserver(function(entries, obs) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        var node = entry.target;
        var openingKey = decodeURIComponent(node.getAttribute('data-opening-stats') || '');
        var opening = filtered.find(function(item) { return getOpeningLookupKey(item) === openingKey; });
        if (opening) hydrateOpeningStatsElement(node, opening, 'card');
      });
    }, { rootMargin: '120px' });
    container.querySelectorAll('[data-opening-stats]').forEach(function(node) {
      statsObserver.observe(node);
    });
  }

  function getOpeningByKey(openingKey) {
    return getDisplayOpenings().find(function (o) { return getOpeningLookupKey(o) === openingKey; }) || null;
  }

  function getOpeningModeCoachCopy(opening, variation) {
    var name = opening && opening.name ? opening.name : 'this opening';
    var moves = parsePGNMoves((variation && variation.pgn) || '');
    var firstMove = moves && moves.length ? moves[0] : '';
    if (firstMove) {
      return 'Let\'s learn the ' + name + '. We start with ' + firstMove + '.';
    }
    return 'Let\'s learn the ' + name + '. Choose Learn for a guided walk-through or Practice to train the moves.';
  }

  function getOpeningModeCardSubtitle(opening, variation, mode) {
    var total = opening && opening.variations ? opening.variations.length : 0;
    var discovered = getDiscoveredLines(opening);
    if (mode === 'learn') {
      return discovered + '/' + total + ' lines discovered';
    }
    if (mode === 'practice') {
      return (isVariationPerfected(opening, variation) ? 1 : 0) + '/1 lines perfected';
    }
    if (mode === 'drill') return 'Replay the line from memory';
    if (mode === 'time') return 'Race the clock through this line';
    if (mode === 'puzzles') return 'Solve positions from this opening';
    if (mode === 'arena') return 'Random lines until one mistake';
    return '';
  }

  function renderOpeningModeOptions() {
    var container = document.getElementById('openingModeOptions');
    if (!container || !currentOpening) return;
    var variation = currentOpening.variations[openingModeVariationIdx];
    var modes = ['learn', 'practice', 'drill', 'time', 'puzzles', 'arena'];
    container.innerHTML = modes.map(function(mode) {
      var meta = MODE_META[mode] || MODE_META.practice;
      var wide = mode === 'learn' || mode === 'practice';
      var active = openingModeSelectedMode === mode;
      return '<button type="button" class="opening-mode-option' +
        (wide ? ' is-wide' : '') +
        (active ? ' is-selected' : '') +
        '" data-mode="' + escapeAttr(mode) + '">' +
        '<span class="opening-mode-option-icon" aria-hidden="true">' + meta.icon + '</span>' +
        '<span class="opening-mode-option-text">' +
        '<span class="opening-mode-option-title">' + escapeHtml(meta.title) + '</span>' +
        '<span class="opening-mode-option-sub">' + escapeHtml(getOpeningModeCardSubtitle(currentOpening, variation, mode)) + '</span>' +
        '</span>' +
        '</button>';
    }).join('');

    container.querySelectorAll('.opening-mode-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var mode = this.getAttribute('data-mode') || 'practice';
        startOpeningModeSelection(mode);
      });
    });
  }

  function updateOpeningModeView() {
    var empty = document.getElementById('openingModeEmpty');
    if (!currentOpening || !currentOpening.variations || !currentOpening.variations.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    openingModeVariationIdx = Math.max(0, Math.min(openingModeVariationIdx, currentOpening.variations.length - 1));
    var variation = currentOpening.variations[openingModeVariationIdx];
    var total = currentOpening.variations.length;

    var title = document.getElementById('openingModeTitle');
    var headerName = document.getElementById('openingModeHeaderName');
    var headerMode = document.getElementById('openingModeHeaderMode');
    var lineNo = document.getElementById('openingModeLineNo');
    var coach = document.getElementById('openingModeCoachText');
    if (title) title.textContent = currentOpening.name || 'Opening';
    if (headerName) headerName.textContent = currentOpening.name || 'Opening';
    if (headerMode) headerMode.textContent = (MODE_META[openingModeSelectedMode] || MODE_META.learn).title;
    if (lineNo) lineNo.textContent = '#' + (openingModeVariationIdx + 1);
    if (coach) coach.textContent = getOpeningModeCoachCopy(currentOpening, variation);

    renderOpeningModeOptions();

    var prev = document.getElementById('openingModePrevLineBtn');
    var next = document.getElementById('openingModeNextLineBtn');
    var hideArrows = total <= 1;
    if (prev) {
      prev.disabled = openingModeVariationIdx <= 0 || hideArrows;
      prev.style.visibility = hideArrows ? 'hidden' : '';
    }
    if (next) {
      next.disabled = openingModeVariationIdx >= total - 1 || hideArrows;
      next.style.visibility = hideArrows ? 'hidden' : '';
    }

    try {
      var previewChess = new Chess();
      ChessBoard.init('openingModeChessBoard', 'openingModeBoardOverlay', null);
      ChessBoard.setPosition(previewChess);
      ChessBoard.setLastMove(null, null);
      ChessBoard.clearArrows();
      ChessBoard.clearMarkers();
      ChessBoard.setFlipped(getOpeningPracticeColor(currentOpening) === 'b');
      ChessBoard.setOptions({ interactionColor: null, allowedMoves: [], interactive: false });
      ChessBoard.redraw();
    } catch (e) {
      console.error('Failed to render opening mode board:', e);
    }
  }

  function showOpeningMode(openingKey, variationIdx, options) {
    var opening = getOpeningByKey(openingKey);
    if (!opening) {
      if (options && options.fromRoute) showOpeningModeEmpty();
      return false;
    }
    currentOpening = opening;
    currentVariation = null;
    isPracticing = false;
    openingModeVariationIdx = Math.max(0, parseInt(variationIdx, 10) || 0);
    openingModeSelectedMode = 'learn';

    var galleryView = document.getElementById('openingGalleryView');
    var detailView = document.getElementById('openingDetailView');
    var modeView = document.getElementById('openingModeView');
    var practiceView = document.getElementById('openingPracticeView');
    if (galleryView) galleryView.style.display = 'none';
    if (detailView) detailView.style.display = 'none';
    if (practiceView) practiceView.style.display = 'none';
    if (modeView) modeView.style.display = 'block';

    updateOpeningModeView();
    animateEntry('openingModeView');
    if (!options || !options.fromRoute) writeOpeningModeHistory(opening, openingModeVariationIdx, false);
    return true;
  }

  function showOpeningModeEmpty() {
    currentOpening = null;
    currentVariation = null;
    var galleryView = document.getElementById('openingGalleryView');
    var detailView = document.getElementById('openingDetailView');
    var modeView = document.getElementById('openingModeView');
    var practiceView = document.getElementById('openingPracticeView');
    if (galleryView) galleryView.style.display = 'none';
    if (detailView) detailView.style.display = 'none';
    if (practiceView) practiceView.style.display = 'none';
    if (modeView) modeView.style.display = 'block';
    var title = document.getElementById('openingModeTitle');
    var headerName = document.getElementById('openingModeHeaderName');
    var lineNo = document.getElementById('openingModeLineNo');
    var coach = document.getElementById('openingModeCoachText');
    var options = document.getElementById('openingModeOptions');
    var empty = document.getElementById('openingModeEmpty');
    if (title) title.textContent = 'Opening unavailable';
    if (headerName) headerName.textContent = 'Opening unavailable';
    if (lineNo) lineNo.textContent = '';
    if (coach) coach.textContent = 'Opening data is unavailable. Return to the openings list and choose another opening.';
    if (options) options.innerHTML = '';
    if (empty) empty.style.display = '';
    animateEntry('openingModeView');
  }

  function startOpeningModeSelection(mode) {
    var normalized = normalizePracticeMode(mode);
    openingModeSelectedMode = normalized;
    renderOpeningModeOptions();
    startPractice(openingModeVariationIdx, normalized);
  }

  function changeOpeningModeLine(delta) {
    if (!currentOpening || !currentOpening.variations) return;
    var max = currentOpening.variations.length - 1;
    var nextIdx = Math.max(0, Math.min(max, openingModeVariationIdx + delta));
    if (nextIdx === openingModeVariationIdx) return;
    openingModeVariationIdx = nextIdx;
    updateOpeningModeView();
    writeOpeningModeHistory(currentOpening, openingModeVariationIdx, true);
  }

  function handleOpeningRoute() {
    var route = parseOpeningModeRoute();
    if (route) {
      showOpeningMode(route.openingKey, route.variationIdx, { fromRoute: true });
      return true;
    }
    if (typeof window !== 'undefined' && String(window.location.pathname || '').replace(/\/+$/, '') === '/openings') {
      var modeView = document.getElementById('openingModeView');
      var practiceView = document.getElementById('openingPracticeView');
      if ((modeView && modeView.style.display !== 'none') || (practiceView && practiceView.style.display !== 'none')) {
        isPracticing = false;
        stopTimeModeTimer();
        clearArenaAdvanceTimer();
        currentOpening = null;
        currentVariation = null;
        if (modeView) modeView.style.display = 'none';
        if (practiceView) practiceView.style.display = 'none';
        var detailView = document.getElementById('openingDetailView');
        var galleryView = document.getElementById('openingGalleryView');
        if (detailView) detailView.style.display = 'none';
        if (galleryView) galleryView.style.display = 'block';
      }
    }
    return false;
  }

  // ===== OPENING DETAIL (VARIATION LIST) =====
  function showOpeningDetail(openingKey) {
    var opening = getOpeningByKey(openingKey);
    if (!opening) return;

    currentOpening = opening;

    // Hide gallery, show detail
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'block';
    var modeView = document.getElementById('openingModeView');
    if (modeView) modeView.style.display = 'none';
    document.getElementById('openingPracticeView').style.display = 'none';
    animateEntry('openingDetailView');

    // Populate header
    document.getElementById('detailOpeningName').textContent = opening.name;
    document.getElementById('detailOpeningEco').textContent = 'Opening guide';
    var detailSide = document.getElementById('detailOpeningSide');
    if (detailSide) {
      var practiceColor = getOpeningPracticeColor(opening);
      detailSide.textContent = getColorLabel(practiceColor);
      detailSide.className = 'opening-side-badge ' + getColorBadgeClass(practiceColor);
    }
    document.getElementById('detailOpeningDesc').textContent = getOpeningDefinition(opening);
    updateDetailFavoriteButton();
    var detailImg = document.getElementById('detailOpeningImg');
    if (detailImg) {
      detailImg.setAttribute('data-opening-img', 'true');
      detailImg.className = 'detail-header-img';
      detailImg.src = resolveImagePath(opening.image);
      applyImageFallbacks(detailImg.parentElement || detailImg);
    }
    var detailStats = document.getElementById('detailOpeningStats');
    if (detailStats) {
      hydrateOpeningStatsElement(detailStats, opening, 'detail');
    }
    updateDetailProgressDisplay();

    // Render variation list — each variation offers Practice and Drill modes.
    var varList = document.getElementById('variationList');
    varList.innerHTML = opening.variations.map(function (v, idx) {
      return '<div class="variation-item" data-idx="' + idx + '">' +
        '<div class="var-item-info">' +
        '<div class="var-item-name">' + v.name + '</div>' +
        '<div class="var-item-pgn">' + v.pgn + '</div>' +
        '</div>' +
        '<div class="var-item-actions">' +
          '<button class="btn-start-practice" data-idx="' + idx + '" data-mode="practice" title="Guided line training with hints and explanations">' +
            '<span class="var-item-action-icon">&#127919;</span>Practice' +
          '</button>' +
          '<button class="btn-start-practice btn-start-time" data-idx="' + idx + '" data-mode="time" title="Race the clock through this line with penalties for hints and mistakes">' +
            '<span class="var-item-action-icon">&#9201;</span>Time' +
          '</button>' +
          '<button class="btn-start-practice btn-start-arena" data-idx="' + idx + '" data-mode="arena" title="Start a random-line Arena gauntlet for this opening">' +
            '<span class="var-item-action-icon">&#9876;</span>Arena' +
          '</button>' +
          '<button class="btn-start-practice btn-start-drill" data-idx="' + idx + '" data-mode="drill" title="Replay the line from memory — no hints">' +
            '<span class="var-item-action-icon">&#128293;</span>Drill' +
          '</button>' +
        '</div>' +
        '</div>';
    }).join('');

    // Attach click handlers — mode is read from data-mode on the button.
    varList.querySelectorAll('.btn-start-practice').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-idx'));
        var mode = this.getAttribute('data-mode') || 'practice';
        if (mode === 'practice') showOpeningMode(getOpeningLookupKey(currentOpening), idx);
        else startPractice(idx, mode);
      });
    });

    var detailFavoriteBtn = document.getElementById('detailFavoriteBtn');
    if (detailFavoriteBtn && !detailFavoriteBtn.__kvFavoriteBound) {
      detailFavoriteBtn.__kvFavoriteBound = true;
      detailFavoriteBtn.addEventListener('click', function () {
        toggleOpeningFavorite(currentOpening);
      });
    }
  }

  function normalizePracticeMode(mode) {
    if (mode === 'drill') return 'drill';
    if (mode === 'learn') return 'learn';
    if (mode === 'time' || mode === 'puzzles' || mode === 'arena') return mode;
    return 'practice';
  }

  function getCompletionMessage() {
    if (practiceMode === 'drill') return 'Drill complete! You replayed the full line from memory.';
    if (practiceMode === 'learn') return 'Line complete! You\'ve walked through every move.';
    if (practiceMode === 'time') return 'Timed run complete!';
    if (practiceMode === 'arena') return 'Arena run complete.';
    return 'Excellent! You completed this variation!';
  }

  function renderModeCards() {
    var grid = document.getElementById('opnModeGrid');
    if (!grid) return;
    var html = '';
    ['learn', 'practice', 'drill', 'time', 'puzzles', 'arena'].forEach(function(mode) {
      var meta = MODE_META[mode];
      var isActive = practiceMode === mode;
      html += '<div class="opn-mode-card' + (isActive ? ' active' : '') + '" data-mode="' + mode + '">';
      html += '<span class="opn-mode-card-icon">' + meta.icon + '</span>';
      html += '<div class="opn-mode-card-info">';
      html += '<span class="opn-mode-card-title">' + meta.title + '</span>';
      html += '<span class="opn-mode-card-sub">' + meta.desc + '</span>';
      html += '</div>';
      html += '</div>';
    });
    grid.innerHTML = html;

    grid.querySelectorAll('.opn-mode-card').forEach(function(card) {
      card.addEventListener('click', function() {
        setPracticeMode(this.getAttribute('data-mode'));
      });
    });
  }

  function updateTrainingHeader() {
    var badge = document.getElementById('opnModeBadge');
    var nameEl = document.getElementById('opnTrainName');
    var stepEl = document.getElementById('opnTrainStep');
    var meta = MODE_META[practiceMode] || MODE_META.practice;
    if (badge) badge.textContent = meta.icon + ' ' + meta.title;
    if (nameEl) {
      if (currentVariation && currentOpening) {
        nameEl.textContent = currentOpening.name + ': ' + currentVariation.name;
      } else if (currentOpening) {
        nameEl.textContent = currentOpening.name;
      } else {
        nameEl.textContent = 'Select an Opening';
      }
    }
    if (stepEl) {
      stepEl.textContent = practiceMode === 'arena' && arenaState.challengeNo
        ? ('Arena #' + arenaState.challengeNo)
        : currentVariation ? ('#' + (currentMoveIndex + 1)) : '';
    }
  }

  function updateLinesCounter() {
    var row = document.getElementById('opnLinesRow');
    var text = document.getElementById('opnLinesText');
    if (!currentOpening) { if (row) row.style.display = 'none'; return; }
    var discovered = getDiscoveredLines(currentOpening);
    var total = currentOpening.variations ? currentOpening.variations.length : 0;
    if (row) row.style.display = '';
    if (text) text.textContent = discovered + ' / ' + total + ' lines discovered';
  }

  function formatTimeClock(ms) {
    var safe = Math.max(0, Math.round(ms || 0));
    var totalSeconds = Math.ceil(safe / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ':' + String(seconds).padStart(2, '0');
  }

  function formatMoveClock(ms) {
    var safe = Math.max(0, ms || 0);
    return (safe / 1000).toFixed(1) + 's';
  }

  function getTimeModeLineId() {
    return getCanonicalVariationId(currentOpening, currentVariation);
  }

  function getTimeModeBest() {
    var key = getTimeModeLineId();
    return key && timeModeBests ? timeModeBests[key] || null : null;
  }

  function getTimeMedalInfo(score, maxScore) {
    if (!maxScore) return { label: 'No Medal Yet', tone: 'none' };
    var ratio = score / maxScore;
    if (ratio >= 0.9) return { label: 'Gold', tone: 'gold' };
    if (ratio >= 0.75) return { label: 'Silver', tone: 'silver' };
    if (ratio >= 0.6) return { label: 'Bronze', tone: 'bronze' };
    return { label: 'Practice', tone: 'none' };
  }

  function updateTimeModePanel() {
    var panel = document.getElementById('timeModePanel');
    if (!panel) return;
    var isVisible = practiceMode === 'time' && !!currentVariation;
    panel.style.display = isVisible ? '' : 'none';
    if (!isVisible) return;

    var best = timeModeState.best || getTimeModeBest();
    var result = timeModeState.result;
    var medal = result && result.medal ? result.medal : (timeModeState.medal || getTimeMedalInfo(timeModeState.score, timeModeState.maxScore));

    var sub = document.getElementById('timeModeSub');
    var medalEl = document.getElementById('timeModeMedal');
    var clockEl = document.getElementById('timeModeClock');
    var moveClockEl = document.getElementById('timeModeMoveClock');
    var scoreEl = document.getElementById('timeModeScore');
    var bestEl = document.getElementById('timeModeBest');

    if (sub) {
      if (result && result.failed) {
        sub.textContent = 'Time expired. Retry the line or switch modes.';
      } else if (result && result.success) {
        sub.textContent = 'Finished with ' + medal.label + ' pace.';
      } else {
        sub.textContent = timeModeState.userMoves + ' player move' + (timeModeState.userMoves !== 1 ? 's' : '') + ' · Hints and mistakes cost time.';
      }
    }
    if (medalEl) {
      medalEl.textContent = medal.label;
      medalEl.className = 'time-mode-medal is-' + medal.tone;
    }
    if (clockEl) clockEl.textContent = formatTimeClock(timeModeState.remainingMs);
    if (moveClockEl) moveClockEl.textContent = formatMoveClock(timeModeState.moveRemainingMs);
    if (scoreEl) scoreEl.textContent = String(Math.max(0, Math.round(timeModeState.score || 0)));
    if (bestEl) {
      bestEl.textContent = best && best.score !== undefined ? (best.score + ' · ' + (best.medal || 'Practice')) : '0';
    }
  }

  function stopTimeModeTimer() {
    if (timeModeState && timeModeState.timerId) {
      clearInterval(timeModeState.timerId);
      timeModeState.timerId = null;
    }
  }

  function resetTimeModeMoveClock() {
    if (!timeModeState.active) return;
    timeModeState.moveRemainingMs = timeModeState.moveBudgetMs;
    updateTimeModePanel();
  }

  function getTimeModeConfig() {
    var userMoves = expectedMoves.filter(function (_, idx) {
      return ((idx % 2 === 0) ? 'w' : 'b') === userColor;
    }).length || 1;
    var totalMs = Math.max(30000, (userMoves * 12000) + 6000);
    var moveBudgetMs = Math.max(7000, Math.min(15000, Math.round(totalMs / Math.max(userMoves, 1))));
    return {
      userMoves: userMoves,
      totalMs: totalMs,
      moveBudgetMs: moveBudgetMs,
      maxScore: userMoves * 160
    };
  }

  function applyTimeModePenalty(scorePenalty, timePenalty, statusText, resetMoveClock) {
    if (!timeModeState.active) return;
    timeModeState.score = Math.max(0, timeModeState.score - (scorePenalty || 0));
    timeModeState.remainingMs = Math.max(0, timeModeState.remainingMs - (timePenalty || 0));
    if (resetMoveClock) timeModeState.moveRemainingMs = timeModeState.moveBudgetMs;
    updateTimeModePanel();
    if (statusText) showPracticeStatus('error', statusText);
    if (timeModeState.remainingMs <= 0) {
      failTimeModeSession();
    }
  }

  function awardTimeModeMoveScore() {
    if (!timeModeState.active) return;
    var bonusRatio = timeModeState.moveBudgetMs > 0 ? Math.max(0, timeModeState.moveRemainingMs) / timeModeState.moveBudgetMs : 0;
    timeModeState.solvedMoves++;
    timeModeState.score += 100 + Math.round(60 * bonusRatio);
    updateTimeModePanel();
  }

  function persistTimeModeBest(result) {
    var key = getTimeModeLineId();
    if (!key || !result || !result.success) return;
    var existing = timeModeBests[key];
    if (!existing || result.score > existing.score) {
      timeModeBests[key] = {
        score: result.score,
        medal: result.medal.label,
        completedAt: Date.now()
      };
      saveTimeModeBests();
    }
    timeModeState.best = timeModeBests[key] || existing || null;
  }

  function finishTimeModeSession(success) {
    stopTimeModeTimer();
    timeModeState.active = false;
    timeModeState.finished = true;
    if (success) {
      var medal = getTimeMedalInfo(timeModeState.score, timeModeState.maxScore);
      timeModeState.medal = medal;
      timeModeState.result = {
        success: true,
        failed: false,
        score: Math.max(0, Math.round(timeModeState.score)),
        medal: medal
      };
      persistTimeModeBest(timeModeState.result);
    }
    updateTimeModePanel();
  }

  function failTimeModeSession() {
    if (!timeModeState.active) return;
    stopTimeModeTimer();
    timeModeState.active = false;
    timeModeState.finished = true;
    timeModeState.remainingMs = 0;
    timeModeState.moveRemainingMs = 0;
    timeModeState.result = {
      success: false,
      failed: true,
      score: Math.max(0, Math.round(timeModeState.score)),
      medal: { label: 'Practice', tone: 'none' }
    };
    isPracticing = false;
    ChessBoard.setOptions({ interactionColor: null, allowedMoves: [] });
    updateTimeModePanel();
    updateCoachPanel(false);
    hideSRSPanel();
    showPracticeStatus('error', 'Time expired. Switch modes or restart the variation to try again.');
  }

  function tickTimeMode() {
    if (!timeModeState.active) return;
    var now = Date.now();
    var elapsed = now - (timeModeState.lastTickAt || now);
    timeModeState.lastTickAt = now;
    if (elapsed <= 0) return;

    timeModeState.remainingMs = Math.max(0, timeModeState.remainingMs - elapsed);
    if (isPracticing && practiceChess && practiceChess.turn() === userColor) {
      timeModeState.moveRemainingMs = Math.max(0, timeModeState.moveRemainingMs - elapsed);
    }

    if (timeModeState.remainingMs <= 0) {
      failTimeModeSession();
      return;
    }

    if (isPracticing && practiceChess && practiceChess.turn() === userColor && timeModeState.moveRemainingMs <= 0) {
      applyTimeModePenalty(80, 4000, 'Move timer expired. -80 score and -4s.', true);
      if (!timeModeState.active) return;
    }

    updateTimeModePanel();
  }

  function startTimeModeSession() {
    stopTimeModeTimer();
    var cfg = getTimeModeConfig();
    timeModeState = createInitialTimeModeState();
    timeModeState.active = true;
    timeModeState.totalMs = cfg.totalMs;
    timeModeState.remainingMs = cfg.totalMs;
    timeModeState.moveBudgetMs = cfg.moveBudgetMs;
    timeModeState.moveRemainingMs = cfg.moveBudgetMs;
    timeModeState.userMoves = cfg.userMoves;
    timeModeState.maxScore = cfg.maxScore;
    timeModeState.best = getTimeModeBest();
    timeModeState.lastTickAt = Date.now();
    timeModeState.timerId = setInterval(tickTimeMode, 200);
    updateTimeModePanel();
  }

  function enterTimeMode(options) {
    options = options || {};
    if (!currentOpening || !currentVariation) {
      showPracticeStatus('hint', 'Select a variation to start Time mode.');
      return;
    }
    if (!options.fromStartPractice) {
      var idx = currentOpening.variations.indexOf(currentVariation);
      if (idx >= 0) {
        startPractice(idx, 'time');
        return;
      }
    }
    startTimeModeSession();
    updateCoachPanel(currentMoveIndex === 0);
  }

  function exitTimeMode() {
    stopTimeModeTimer();
    timeModeState = createInitialTimeModeState();
    updateTimeModePanel();
    if (currentOpening && currentVariation) {
      var idx = currentOpening.variations.indexOf(currentVariation);
      if (idx >= 0) {
        startPractice(idx, practiceMode);
        return;
      }
    }
  }

  function getArenaOpeningId() {
    return currentOpening ? getOpeningId(currentOpening) : '';
  }

  function getArenaRecord() {
    var key = getArenaOpeningId();
    var record = key && arenaStats ? arenaStats[key] : null;
    return record || {};
  }

  function persistArenaRecord(patch) {
    var key = getArenaOpeningId();
    if (!key) return;
    var existing = arenaStats[key] || {};
    arenaStats[key] = Object.assign({}, existing, patch || {}, { updatedAt: Date.now() });
    saveArenaStats();
  }

  function clampArenaRating(rating) {
    return Math.max(400, Math.min(3200, Math.round(rating || 1200)));
  }

  function getArenaLineId(variation, idx) {
    var base = getCanonicalVariationId(currentOpening, variation) || (getArenaOpeningId() + '::line');
    return base + '::' + (variation && variation.pgn ? variation.pgn : idx);
  }

  function countUserMovesForLine(moves) {
    return (moves || []).filter(function (_, idx) {
      return ((idx % 2 === 0) ? 'w' : 'b') === userColor;
    }).length;
  }

  function getArenaLineRating(variation) {
    var moves = parsePGNMoves((variation && variation.pgn) || '');
    var userMoves = countUserMovesForLine(moves);
    var tactics = moves.filter(function (move) {
      return /[x+#=]/.test(move);
    }).length;
    var castles = moves.filter(function (move) {
      return move === 'O-O' || move === 'O-O-O';
    }).length;
    var base = 780 + (moves.length * 24) + (userMoves * 76) + (tactics * 18) + (castles * 10);
    return Math.max(800, Math.min(2600, Math.round(base)));
  }

  function getArenaChallengeCandidates() {
    if (!currentOpening || !currentOpening.variations) return [];
    return currentOpening.variations.map(function(variation, idx) {
      var moves = parsePGNMoves((variation && variation.pgn) || '');
      var userMoves = countUserMovesForLine(moves);
      if (!variation || !moves.length || !userMoves) return null;
      return {
        variation: variation,
        idx: idx,
        id: getArenaLineId(variation, idx),
        rating: getArenaLineRating(variation),
        userMoves: userMoves
      };
    }).filter(Boolean);
  }

  function selectArenaChallenge() {
    var candidates = getArenaChallengeCandidates();
    if (!candidates.length) return null;

    var recent = {};
    (arenaState.recentLineIds || []).forEach(function(id) { recent[id] = true; });
    var pool = candidates.filter(function(candidate) {
      return !recent[candidate.id] && candidate.id !== arenaState.lineId;
    });
    if (!pool.length) pool = candidates.filter(function(candidate) {
      return candidate.id !== arenaState.lineId;
    });
    if (!pool.length) pool = candidates;

    var target = (arenaState.rating || 1200) + Math.min(500, (arenaState.streak || 0) * 55);
    pool.sort(function(a, b) {
      return Math.abs(a.rating - target) - Math.abs(b.rating - target);
    });
    var bandSize = Math.min(pool.length, Math.max(6, Math.ceil(pool.length * 0.18)));
    var band = pool.slice(0, bandSize);
    return band[Math.floor(Math.random() * band.length)];
  }

  function rememberArenaLine(id) {
    if (!id) return;
    arenaState.recentLineIds = (arenaState.recentLineIds || []).filter(function(existing) {
      return existing !== id;
    });
    arenaState.recentLineIds.push(id);
    if (arenaState.recentLineIds.length > 8) arenaState.recentLineIds.shift();
  }

  function applyArenaChallenge(challenge) {
    if (!challenge) return false;
    currentVariation = challenge.variation;
    expectedMoves = parsePGNMoves(currentVariation.pgn);
    currentMoveIndex = 0;
    learnMoveIndex = 0;
    wrongMove = false;
    practiceChess = new Chess();
    isPracticing = true;

    arenaState.challengeNo += 1;
    arenaState.lineId = challenge.id;
    arenaState.lineRating = challenge.rating;
    arenaState.lineUserMoves = challenge.userMoves;
    arenaState.lineName = currentVariation.name || currentVariation.fullName || 'Random Line';
    arenaState.lastResult = null;
    rememberArenaLine(challenge.id);

    ChessBoard.init('practiceChessBoard', 'practiceBoardOverlay', onPracticeMove);
    ChessBoard.setPosition(practiceChess);
    ChessBoard.setLastMove(null, null);
    ChessBoard.clearArrows();
    ChessBoard.clearMarkers();
    ChessBoard.setFlipped(userColor === 'b');
    ChessBoard.setOptions({ interactionColor: userColor, allowedMoves: [], interactive: true });

    updatePracticeModeUI();
    updatePracticeMeta();
    updatePracticeProgress();
    renderPracticeMoveList();
    updateTrainingHeader();
    updateArenaModePanel();
    updateCoachPanel(true);
    renderRelatedLines();

    if (currentMoveIndex < expectedMoves.length && practiceChess.turn() !== userColor) {
      setTimeout(function () { autoPlayOpponentMove(); }, 250);
    }
    return true;
  }

  function clearArenaAdvanceTimer() {
    if (!arenaState || !arenaState.advanceTimerId) return;
    clearTimeout(arenaState.advanceTimerId);
    arenaState.advanceTimerId = null;
  }

  function startArenaSessionState() {
    clearArenaAdvanceTimer();
    var record = getArenaRecord();
    var rating = clampArenaRating(record.rating || 1200);
    arenaState = createInitialArenaState();
    arenaState.active = true;
    arenaState.openingId = getArenaOpeningId();
    arenaState.rating = rating;
    arenaState.startRating = rating;
    arenaState.peakRating = clampArenaRating(record.peakRating || rating);
    arenaState.bestScore = Math.max(0, record.bestScore || 0);
    arenaState.bestStreak = Math.max(0, record.bestStreak || 0);
    persistArenaRecord({
      rating: rating,
      peakRating: arenaState.peakRating,
      bestScore: arenaState.bestScore,
      bestStreak: arenaState.bestStreak,
      runs: (record.runs || 0) + 1,
      linesCleared: record.linesCleared || 0
    });
  }

  function updateArenaModePanel() {
    var panel = document.getElementById('arenaModePanel');
    if (!panel) return;
    var isVisible = practiceMode === 'arena' && !!currentOpening;
    panel.style.display = isVisible ? '' : 'none';
    if (!isVisible) return;

    var sub = document.getElementById('arenaModeSub');
    var badge = document.getElementById('arenaModeBadge');
    var streakEl = document.getElementById('arenaModeStreak');
    var scoreEl = document.getElementById('arenaModeScore');
    var ratingEl = document.getElementById('arenaModeRating');
    var lineEl = document.getElementById('arenaModeLine');
    var bestEl = document.getElementById('arenaModeBest');

    if (sub) {
      if (arenaState.finished && arenaState.lastResult && arenaState.lastResult.failed) {
        sub.textContent = 'Arena over on challenge #' + arenaState.challengeNo + '. First mistake ends the run.';
      } else if (arenaState.active) {
        sub.textContent = 'Challenge #' + Math.max(1, arenaState.challengeNo) + ' · survive this random line without a mistake.';
      } else {
        sub.textContent = 'Start a run to face random lines until your first mistake.';
      }
    }
    if (badge) {
      var failed = arenaState.finished && arenaState.lastResult && arenaState.lastResult.failed;
      badge.textContent = failed ? 'Run Ended' : (arenaState.active ? 'Live Run' : 'Ready');
      badge.className = 'time-mode-medal arena-mode-badge ' + (failed ? 'is-failed' : (arenaState.active ? 'is-live' : ''));
    }
    if (streakEl) streakEl.textContent = String(arenaState.streak || 0);
    if (scoreEl) scoreEl.textContent = String(Math.max(0, Math.round(arenaState.score || 0)));
    if (ratingEl) {
      var delta = arenaState.ratingDelta || 0;
      ratingEl.textContent = String(clampArenaRating(arenaState.rating)) + (delta ? ' ' + (delta > 0 ? '+' : '') + delta : '');
    }
    if (lineEl) lineEl.textContent = String(arenaState.lineRating || '—');
    if (bestEl) bestEl.textContent = (arenaState.bestStreak || 0) + ' / ' + (arenaState.bestScore || 0);
  }

  function getArenaExpectedScore(playerRating, lineRating) {
    return 1 / (1 + Math.pow(10, ((lineRating || 1200) - (playerRating || 1200)) / 400));
  }

  function applyArenaRatingResult(resultScore) {
    var before = clampArenaRating(arenaState.rating);
    var expected = getArenaExpectedScore(before, arenaState.lineRating);
    var delta = Math.round(32 * ((resultScore || 0) - expected));
    arenaState.rating = clampArenaRating(before + delta);
    arenaState.ratingDelta += delta;
    arenaState.peakRating = Math.max(arenaState.peakRating || arenaState.rating, arenaState.rating);
    return delta;
  }

  function persistArenaProgress() {
    var record = getArenaRecord();
    var bestScore = Math.max(record.bestScore || 0, Math.round(arenaState.score || 0), arenaState.bestScore || 0);
    var bestStreak = Math.max(record.bestStreak || 0, arenaState.streak || 0, arenaState.bestStreak || 0);
    var linesCleared = (record.linesCleared || 0) + (arenaState.completedLineIds || []).length;
    arenaState.bestScore = bestScore;
    arenaState.bestStreak = bestStreak;
    persistArenaRecord({
      rating: clampArenaRating(arenaState.rating),
      peakRating: Math.max(record.peakRating || 0, arenaState.peakRating || arenaState.rating),
      bestScore: bestScore,
      bestStreak: bestStreak,
      linesCleared: linesCleared
    });
    arenaState.completedLineIds = [];
  }

  function awardArenaMoveScore() {
    if (!arenaState.active) return;
    var moveScore = 75 + Math.round((arenaState.lineRating || 1200) / 45) + Math.min(100, (arenaState.streak || 0) * 7);
    arenaState.score += moveScore;
    updateArenaModePanel();
  }

  function completeArenaChallenge() {
    if (!arenaState.active) return;

    arenaState.streak += 1;
    arenaState.score += 220 + Math.round((arenaState.lineRating || 1200) / 8) + (arenaState.streak * 70);
    arenaState.completedLineIds.push(arenaState.lineId);
    applyArenaRatingResult(1);
    markLineDiscovered(currentOpening, currentVariation);
    markVariationComplete(currentOpening, currentVariation);
    persistArenaProgress();

    isPracticing = false;
    updateArenaModePanel();
    updatePracticeProgress();
    renderPracticeMoveList();
    updateCoachPanel(false);
    showPracticeStatus('success', 'Line cleared. Streak ' + arenaState.streak + ' — loading the next random line.');

    clearArenaAdvanceTimer();
    arenaState.advanceTimerId = setTimeout(function() {
      arenaState.advanceTimerId = null;
      if (!arenaState.active || practiceMode !== 'arena') return;
      var next = selectArenaChallenge();
      if (!next || !applyArenaChallenge(next)) {
        failArenaSession(null, '');
      } else {
        clearPracticeStatus();
      }
    }, 850);
  }

  function failArenaSession(moveResult, expectedSAN) {
    if (!arenaState.active) return;
    clearArenaAdvanceTimer();

    if (practiceChess && moveResult) {
      practiceChess.undo();
      ChessBoard.setPosition(practiceChess);
      var history = practiceChess.history({ verbose: true });
      var last = history.length ? history[history.length - 1] : null;
      ChessBoard.setLastMove(last ? last.from : null, last ? last.to : null);
    }

    applyArenaRatingResult(0);
    arenaState.active = false;
    arenaState.finished = true;
    arenaState.lastResult = {
      failed: true,
      playedSAN: moveResult && moveResult.san ? moveResult.san : '',
      expectedSAN: expectedSAN || ''
    };
    isPracticing = false;
    ChessBoard.setOptions({ interactionColor: null, allowedMoves: [] });
    if (expectedSAN) {
      var preview = new Chess();
      preview.load(practiceChess.fen());
      var expectedMove = preview.move(expectedSAN);
      if (expectedMove) {
        ChessBoard.setArrows([{ from: expectedMove.from, to: expectedMove.to, color: 'rgba(239, 83, 80, 0.84)' }]);
      }
    }
    persistArenaProgress();
    updateArenaModePanel();
    updatePracticeProgress();
    renderPracticeMoveList();
    updateCoachPanel(false);
    hideSRSPanel();
    showPracticeStatus('error', 'Arena over. First mistake: ' + (moveResult && moveResult.san ? moveResult.san : 'wrong move') + (expectedSAN ? '. Correct move was ' + expectedSAN + '.' : '.'));
  }

  function enterArenaMode(options) {
    options = options || {};
    if (!currentOpening) {
      showPracticeStatus('hint', 'Select an opening to start Arena mode.');
      return;
    }
    if (!options.fromStartPractice) {
      var idx = currentVariation && currentOpening.variations ? currentOpening.variations.indexOf(currentVariation) : 0;
      startPractice(idx >= 0 ? idx : 0, 'arena');
      return;
    }
    updateArenaModePanel();
    updateCoachPanel(currentMoveIndex === 0);
  }

  function exitArenaMode() {
    clearArenaAdvanceTimer();
    if (arenaState.active || arenaState.finished) {
      persistArenaProgress();
    }
    arenaState = createInitialArenaState();
    updateArenaModePanel();
    if (currentOpening && currentVariation) {
      var idx = currentOpening.variations.indexOf(currentVariation);
      if (idx >= 0) {
        startPractice(idx, practiceMode);
        return;
      }
    }
  }

  function goToNextLearnMove() {
    if (practiceMode === 'puzzles') {
      clearOpeningPuzzleAdvanceTimer();
      loadOpeningPuzzle();
      return;
    }
    if (practiceMode !== 'learn') return;
    if (!expectedMoves || !expectedMoves.length) return;
    if (learnMoveIndex >= expectedMoves.length) { onVariationComplete(); return; }
    var move = expectedMoves[learnMoveIndex];
    var result = practiceChess.move(move);
    if (!result) return;
    learnMoveIndex++;
    currentMoveIndex = learnMoveIndex;
    ChessBoard.setPosition(practiceChess);
    ChessBoard.setLastMove(result.from, result.to);
    SoundController.playMove();
    updatePracticeProgress();
    renderPracticeMoveList();
    updateCoachPanel(false);
    updateTrainingHeader();
    if (learnMoveIndex >= expectedMoves.length) {
      markLineDiscovered(currentOpening, currentVariation);
      setTimeout(onVariationComplete, 500);
    }
  }

  function updatePracticeModeUI() {
    renderModeCards();

    var hintBtn = document.getElementById('practiceHintBtn');
    if (hintBtn) {
      var hintDisabled = practiceMode === 'drill' || practiceMode === 'learn' || practiceMode === 'arena';
      hintBtn.disabled = hintDisabled;
      hintBtn.classList.toggle('is-disabled', hintDisabled);
      hintBtn.title = hintDisabled ? 'Hints are disabled in this mode' : 'Show hint';
    }

    var nextBtn = document.getElementById('practiceNextBtn');
    if (nextBtn) {
      nextBtn.style.display = practiceMode === 'learn' ? '' : 'none';
    }

    var prevBtn = document.getElementById('practicePrevBtn');
    if (prevBtn) {
      var prevDisabled = practiceMode === 'time' || practiceMode === 'arena';
      prevBtn.disabled = prevDisabled;
      prevBtn.classList.toggle('is-disabled', prevDisabled);
      prevBtn.title = prevDisabled ? 'Back is disabled in this mode' : 'Previous move';
    }

    var modeBtn = document.getElementById('practiceModeBtn');
    if (modeBtn) {
      var meta = MODE_META[practiceMode] || MODE_META.practice;
      modeBtn.textContent = meta.title;
      modeBtn.title = 'Cycle training mode';
    }

    updateTimeModePanel();
    updateArenaModePanel();
  }

  function updatePracticeMeta() {
    var openingNameEl = document.getElementById('practiceOpeningName');
    if (openingNameEl) {
      openingNameEl.textContent = currentOpening ? currentOpening.name : 'Opening';
    }

    var variationNameEl = document.getElementById('practiceVarName');
    if (variationNameEl) {
      variationNameEl.textContent = currentVariation ? currentVariation.name : 'Variation';
    }

    var practiceSide = document.getElementById('practiceOpeningSide');
    if (practiceSide) {
      practiceSide.textContent = getColorLabel(userColor);
      practiceSide.className = 'opening-side-badge ' + getColorBadgeClass(userColor);
    }

    var practiceSideCopy = document.getElementById('practiceSideCopy');
    if (practiceSideCopy) {
      if (practiceMode === 'drill') {
        practiceSideCopy.textContent = 'Drill this opening as ' + getColorLabel(userColor) + ' from memory.';
      } else if (practiceMode === 'time') {
        practiceSideCopy.textContent = 'Race the clock as ' + getColorLabel(userColor) + '. Hints and mistakes cost time.';
      } else if (practiceMode === 'arena') {
        practiceSideCopy.textContent = 'Arena run as ' + getColorLabel(userColor) + '. Random lines continue until your first mistake.';
      } else if (practiceMode === 'learn') {
        practiceSideCopy.textContent = 'Step through this line as ' + getColorLabel(userColor) + ' with coach explanations.';
      } else {
        practiceSideCopy.textContent = 'Train this opening as ' + getColorLabel(userColor) + ' with guided feedback.';
      }
    }

    var pgnLine = document.getElementById('practiceMovePgn');
    if (pgnLine) {
      if (practiceMode === 'drill' || practiceMode === 'time' || practiceMode === 'arena') {
        pgnLine.textContent = practiceMode === 'time'
          ? 'Time mode hides the full line. Recall the moves under pressure.'
          : practiceMode === 'arena'
            ? 'Arena hides the line. One wrong legal move ends the run.'
            : 'Drill mode hides the full line. Play the moves from memory.';
        pgnLine.classList.add('is-concealed');
      } else {
        pgnLine.textContent = currentVariation ? currentVariation.pgn : '';
        pgnLine.classList.remove('is-concealed');
      }
    }

    var movesHeader = document.getElementById('practiceMovesHeader');
    if (movesHeader) {
      movesHeader.textContent = practiceMode === 'arena'
        ? 'Arena Line'
        : (practiceMode === 'drill' || practiceMode === 'time') ? 'Revealed Moves' : 'Moves';
    }
  }

  function setPracticeMode(mode, options) {
    options = options || {};
    var previousMode = practiceMode;
    practiceMode = normalizePracticeMode(mode);

    if (previousMode === 'puzzles' && practiceMode !== 'puzzles') {
      exitOpeningPuzzleMode();
      return;
    }

    if (previousMode === 'time' && practiceMode !== 'time') {
      exitTimeMode();
      return;
    }

    if (previousMode === 'arena' && practiceMode !== 'arena') {
      exitArenaMode();
      return;
    }

    updatePracticeModeUI();
    updatePracticeMeta();
    updatePracticeProgress();
    renderPracticeMoveList();
    updateTrainingHeader();
    updateLinesCounter();

    if (practiceMode === 'puzzles') {
      enterOpeningPuzzleMode(options);
      return;
    }

    if (practiceMode === 'time') {
      enterTimeMode(options);
      if (!options.silent && currentVariation) {
        showPracticeStatus('hint', 'Time mode — line hidden. Play quickly; hints and mistakes cost time.');
      }
      return;
    }

    if (practiceMode === 'arena') {
      enterArenaMode(options);
      if (!options.silent && currentOpening) {
        showPracticeStatus('hint', 'Arena mode — random lines, Elo rating, and survival until your first mistake.');
      }
      return;
    }

    if (currentOpening && currentVariation) {
      updateCoachPanel(currentMoveIndex === 0);
    }

    if (!options.silent && currentVariation) {
      var statusMsg;
      if (practiceMode === 'drill') statusMsg = 'Drill mode — play from memory. Hints disabled.';
      else if (practiceMode === 'learn') statusMsg = 'Learn mode — press › to step through the line.';
      else statusMsg = 'Practice mode — play the moves with guided feedback.';
      showPracticeStatus('hint', statusMsg);
    }
  }

  // ===== PRACTICE MODE =====
  function startPractice(variationIdx, requestedMode) {
    if (!currentOpening) return;

    if (requestedMode !== undefined) {
      practiceMode = normalizePracticeMode(requestedMode);
    }

    userColor = getOpeningPracticeColor(currentOpening);
    clearArenaAdvanceTimer();
    if (practiceMode === 'arena') {
      startArenaSessionState();
      var arenaChallenge = selectArenaChallenge();
      if (!arenaChallenge) {
        showPracticeStatus('error', 'Arena needs at least one playable line in this opening.');
        arenaState = createInitialArenaState();
        return;
      }
      currentVariation = arenaChallenge.variation;
      arenaState.challengeNo = 0;
      arenaState.lineId = arenaChallenge.id;
      arenaState.lineRating = arenaChallenge.rating;
      arenaState.lineUserMoves = arenaChallenge.userMoves;
      arenaState.lineName = currentVariation.name || currentVariation.fullName || 'Random Line';
    } else {
      arenaState = createInitialArenaState();
      currentVariation = currentOpening.variations[variationIdx];
    }
    if (!currentVariation) return;

    isPracticing = true;
    wrongMove = false;
    currentMoveIndex = 0;
    learnMoveIndex = 0;
    sessionHints = 0;
    sessionErrors = 0;
    stopTimeModeTimer();
    timeModeState = createInitialTimeModeState();
    hideSRSPanel();

    // Parse PGN into move list
    expectedMoves = parsePGNMoves(currentVariation.pgn);

    if (practiceMode === 'arena') {
      arenaState.challengeNo = 1;
      arenaState.lastResult = null;
      rememberArenaLine(arenaState.lineId);
    }

    // Initialize chess
    practiceChess = new Chess();

    // Show practice view
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'none';
    var modeView = document.getElementById('openingModeView');
    if (modeView) modeView.style.display = 'none';
    document.getElementById('openingPracticeView').style.display = 'flex';
    animateEntry('openingPracticeView');

    // Init the board — learn mode is display-only (no interaction)
    ChessBoard.init('practiceChessBoard', 'practiceBoardOverlay', onPracticeMove);
    ChessBoard.setPosition(practiceChess);
    ChessBoard.setLastMove(null, null);
    ChessBoard.setFlipped(userColor === 'b');
    if (practiceMode === 'learn') {
      ChessBoard.setOptions({ interactionColor: null, allowedMoves: [], interactive: true });
    } else {
      ChessBoard.setOptions({ interactionColor: userColor, allowedMoves: [], interactive: true });
    }

    // Update UI
    setPracticeMode(practiceMode, { silent: true, fromStartPractice: true });
    updateTrainingHeader();
    updateLinesCounter();
    clearPracticeStatus();

    // In practice/drill mode auto-play opponent's first move if needed
    if (practiceMode !== 'learn' && currentMoveIndex < expectedMoves.length) {
      var turn = practiceChess.turn();
      if (turn !== userColor) {
        setTimeout(function () { autoPlayOpponentMove(); }, 250);
      }
    }

    renderRelatedLines();
  }

  function parsePGNMoves(pgn) {
    // Parse PGN string into array of SAN moves
    // Remove move numbers and result markers
    var cleaned = pgn
      .replace(/\{[^}]*\}/g, '')       // remove comments
      .replace(/\([^)]*\)/g, '')       // remove variations
      .replace(/\d+\.\.\./g, '')       // remove "1..."
      .replace(/\d+\./g, '')           // remove "1."
      .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, '')  // remove results
      .trim();

    return cleaned.split(/\s+/).filter(function (m) { return m.length > 0; });
  }

  function onPracticeMove(moveResult, fen) {
    if (practiceMode === 'puzzles') {
      onOpeningPuzzleMove(moveResult);
      return;
    }

    if (!isPracticing || !expectedMoves.length) return;

    var expectedSAN = expectedMoves[currentMoveIndex];

    if (moveResult.san === expectedSAN) {
      // Correct move!
      wrongMove = false;
      if (practiceMode === 'time') {
        awardTimeModeMoveScore();
      } else if (practiceMode === 'arena') {
        awardArenaMoveScore();
      }
      currentMoveIndex++;
      SoundController.playMove();
      updatePracticeProgress();
      renderPracticeMoveList();
      updateCoachPanel(false);

      if (currentMoveIndex >= expectedMoves.length) {
        // Completed the variation!
        onVariationComplete();
        return;
      }

      // Auto-play opponent's next move after a short delay
      setTimeout(function () {
        autoPlayOpponentMove();
      }, 400);
    } else {
      if (practiceMode === 'arena') {
        failArenaSession(moveResult, expectedSAN);
        return;
      }
      // Wrong move — undo it
      sessionErrors++;
      practiceChess.undo();
      ChessBoard.setPosition(practiceChess);
      ChessBoard.clearArrows();
      wrongMove = true;
      if (practiceMode === 'time') {
        applyTimeModePenalty(90, 3000, 'Incorrect move. -90 score and -3s.', false);
        if (!timeModeState.active) return;
      }
      showPracticeStatus(
        'error',
        practiceMode === 'drill'
          ? 'Incorrect move. Try again from memory.'
          : practiceMode === 'time'
            ? 'Incorrect move. Stay sharp and try again.'
          : 'Incorrect move! Try again. The correct move is for ' + (practiceChess.turn() === 'w' ? 'White' : 'Black') + '.'
      );
    }
  }

  function autoPlayOpponentMove() {
    if (currentMoveIndex >= expectedMoves.length) return;

    var nextMove = expectedMoves[currentMoveIndex];
    var result = practiceChess.move(nextMove);

    if (result) {
      currentMoveIndex++;
      ChessBoard.setPosition(practiceChess);
      ChessBoard.setLastMove(result.from, result.to);
      SoundController.playMove();
      if (practiceMode === 'time' && practiceChess.turn() === userColor) {
        resetTimeModeMoveClock();
      }
      updatePracticeProgress();
      renderPracticeMoveList();
      updateCoachPanel(false);

      if (currentMoveIndex >= expectedMoves.length) {
        onVariationComplete();
      }
    }
  }

  function showHint() {
    if (practiceMode === 'puzzles') {
      showOpeningPuzzleHint();
      return;
    }
    if (!isPracticing || currentMoveIndex >= expectedMoves.length) return;
    if (practiceMode === 'arena') {
      showPracticeStatus('hint', 'Hints are disabled in Arena. One clean memory run at a time.');
      return;
    }
    if (practiceMode === 'drill') {
      showPracticeStatus('hint', 'Hints are disabled in Drill mode. Switch back to Practice for guided help.');
      return;
    }
    sessionHints++;
    if (practiceMode === 'time') {
      applyTimeModePenalty(120, 2500, 'Hint used. -120 score and -2.5s.', false);
      if (!timeModeState.active) return;
    }
    var hint = expectedMoves[currentMoveIndex];
    showPracticeStatus('hint', practiceMode === 'time' ? 'Hint used — follow the arrow quickly.' : 'Hint: The next move is ' + hint);

    // Show arrow on board for the hint
    var tempChess = new Chess();
    tempChess.load(practiceChess.fen());
    var moveObj = tempChess.move(hint);
    if (moveObj) {
      ChessBoard.setArrows([{ from: moveObj.from, to: moveObj.to, color: 'rgba(100, 200, 100, 0.8)' }]);
    }
  }

  function goToPrevMove() {
    if (practiceMode === 'puzzles') {
      // In puzzles mode, the "prev" control loads the next puzzle — skipping.
      clearOpeningPuzzleAdvanceTimer();
      loadOpeningPuzzle();
      return;
    }
    if (practiceMode === 'time' || practiceMode === 'arena') return;
    if (currentMoveIndex <= 0) return;

    // Undo the last two moves (opponent + user) or one if at start
    currentMoveIndex--;
    practiceChess.undo();

    // If we can undo one more (the auto-played move), do it
    if (currentMoveIndex > 0) {
      currentMoveIndex--;
      practiceChess.undo();
    }

    ChessBoard.setPosition(practiceChess);
    ChessBoard.clearArrows();
    var history = practiceChess.history({ verbose: true });
    if (history.length > 0) {
      var last = history[history.length - 1];
      ChessBoard.setLastMove(last.from, last.to);
      SoundController.playMove();
    } else {
      ChessBoard.setLastMove(null, null);
    }

    wrongMove = false;
    isPracticing = true;
    updatePracticeProgress();
    renderPracticeMoveList();
    updateCoachPanel(false);
    clearPracticeStatus();

    // If it's the opponent's turn, auto-play
    if (currentMoveIndex < expectedMoves.length) {
      var whoPlays = currentMoveIndex % 2 === 0 ? 'w' : 'b';
      if (whoPlays !== userColor) {
        setTimeout(function () { autoPlayOpponentMove(); }, 300);
      }
    }
  }

  function resetPractice() {
    if (!currentVariation) return;
    var idx = currentOpening.variations.indexOf(currentVariation);
    startPractice(idx >= 0 ? idx : 0);
  }

  // ===== OPENING PUZZLES =====
  // Every variation of a family shares the same puzzle pool. We derive the
  // base opening name and query the Lichess dataset by its family tag.
  function getOpeningPuzzleRating() {
    try {
      var stored = parseInt(localStorage.getItem('cr_puzzle_rating'), 10);
      if (!isNaN(stored)) return Math.max(400, Math.min(3200, stored));
    } catch { /* fall through */ }
    return 1200;
  }

  function rememberOpeningPuzzleId(puzzleId) {
    if (!puzzleId) return;
    openingPuzzleRecentIds = openingPuzzleRecentIds.filter(function (id) { return id !== puzzleId; });
    openingPuzzleRecentIds.push(puzzleId);
    if (openingPuzzleRecentIds.length > OPENING_PUZZLE_RECENT_MAX) {
      openingPuzzleRecentIds.shift();
    }
  }

  function clearOpeningPuzzleAdvanceTimer() {
    if (!openingPuzzleAdvanceTimer) return;
    clearTimeout(openingPuzzleAdvanceTimer);
    openingPuzzleAdvanceTimer = null;
  }

  function enterOpeningPuzzleMode(options) {
    options = options || {};
    if (!currentOpening) {
      showPracticeStatus('hint', 'Select an opening to start puzzles.');
      return;
    }

    // Reset the opening's walk-through state — the puzzle flow takes over the board.
    clearOpeningPuzzleAdvanceTimer();
    isPracticing = false;
    wrongMove = false;
    expectedMoves = [];
    currentMoveIndex = 0;
    learnMoveIndex = 0;
    hideSRSPanel();

    var baseName = getBaseOpeningName(currentOpening.name || '');
    var tag = getPuzzleTagForOpening(currentOpening);

    puzzleState.active = true;
    puzzleState.opening = currentOpening;
    puzzleState.baseName = baseName;
    puzzleState.tag = tag;
    puzzleState.solvedCount = 0;
    puzzleState.attemptedCount = 0;
    puzzleState.puzzle = null;
    puzzleState.chess = null;
    puzzleState.progressPly = 0;
    puzzleState.solved = false;
    puzzleState.awaitingRetry = false;

    // Show the practice view if it is not already visible (user may have
    // entered puzzles from the detail view before picking a variation).
    var galleryView = document.getElementById('openingGalleryView');
    var detailView = document.getElementById('openingDetailView');
    var practiceView = document.getElementById('openingPracticeView');
    if (practiceView && practiceView.style.display === 'none') {
      if (galleryView) galleryView.style.display = 'none';
      if (detailView) detailView.style.display = 'none';
      practiceView.style.display = 'flex';
      animateEntry('openingPracticeView');
    }

    ChessBoard.init('practiceChessBoard', 'practiceBoardOverlay', onPracticeMove);
    ChessBoard.clearArrows();
    ChessBoard.clearMarkers();

    renderPuzzleMovePanel();
    updatePracticeProgressForPuzzle();
    updateCoachPanelForPuzzle('loading');

    if (!options.silent) {
      showPracticeStatus('hint', 'Puzzles for ' + (baseName || 'this opening') + '.');
    }

    loadOpeningPuzzle({ initial: true });
  }

  function exitOpeningPuzzleMode() {
    clearOpeningPuzzleAdvanceTimer();
    puzzleState.active = false;
    puzzleState.puzzle = null;
    puzzleState.chess = null;
    puzzleState.progressPly = 0;
    puzzleState.solved = false;
    puzzleState.awaitingRetry = false;
    puzzleState.requestToken += 1;

    ChessBoard.clearArrows();
    ChessBoard.clearMarkers();

    // If a variation is selected, rebuild the practice board for the new mode.
    if (currentOpening && currentVariation) {
      var idx = currentOpening.variations.indexOf(currentVariation);
      if (idx >= 0) {
        startPractice(idx, practiceMode);
        return;
      }
    }
    // No variation to fall back to — leave the board blank.
    practiceChess = new Chess();
    ChessBoard.setPosition(practiceChess);
    ChessBoard.setLastMove(null, null);
  }

  function loadOpeningPuzzle(options) {
    options = options || {};
    if (!puzzleState.active) return;

    var tag = puzzleState.tag || '';
    var rating = getOpeningPuzzleRating();
    var url = '/api/puzzles/next?rating=' + encodeURIComponent(rating) + '&spread=320';
    if (tag) url += '&opening=' + encodeURIComponent(tag);
    var exclude = openingPuzzleRecentIds.join(',');
    if (exclude) url += '&exclude=' + encodeURIComponent(exclude);

    puzzleState.loading = true;
    puzzleState.requestToken += 1;
    var token = puzzleState.requestToken;

    updateCoachPanelForPuzzle('loading');
    if (!options.initial) {
      showPracticeStatus('hint', 'Loading next puzzle...');
    }

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Puzzle request failed');
        return r.json();
      })
      .then(function (data) {
        if (token !== puzzleState.requestToken || !puzzleState.active) return;
        if (!data || !data.ok || !data.puzzle) {
          throw new Error((data && data.error) || 'Puzzle unavailable');
        }
        applyOpeningPuzzle(data.puzzle);
      })
      .catch(function () {
        if (token !== puzzleState.requestToken || !puzzleState.active) return;
        puzzleState.loading = false;
        updateCoachPanelForPuzzle('error');
        showPracticeStatus('error', 'Could not load a puzzle for ' + (puzzleState.baseName || 'this opening') + '. Try again.');
      });
  }

  function applyOpeningPuzzle(puzzle) {
    if (!puzzleState.active || !puzzle) return;

    puzzleState.loading = false;
    puzzleState.puzzle = puzzle;
    puzzleState.progressPly = 0;
    puzzleState.solved = false;
    puzzleState.awaitingRetry = false;

    rememberOpeningPuzzleId(puzzle.id);

    var chess = new Chess();
    chess.load(puzzle.fen);

    // Lichess puzzles start with the opponent's setup move; auto-apply it so
    // the user is presented with the position where they must move.
    var setupUci = (puzzle.moves && puzzle.moves[0]) ? puzzle.moves[0] : null;
    var setupMove = setupUci ? applyUciMoveToChess(chess, setupUci) : null;

    puzzleState.chess = chess;
    puzzleState.userColor = chess.turn();

    ChessBoard.setFlipped(puzzleState.userColor === 'b');
    ChessBoard.setPosition(chess);
    ChessBoard.setLastMove(setupMove ? setupMove.from : null, setupMove ? setupMove.to : null);
    ChessBoard.clearArrows();
    ChessBoard.clearMarkers();
    ChessBoard.setOptions({
      showArrows: true,
      lastMoveMode: 'to',
      interactionColor: puzzleState.userColor,
      allowedMoves: []
    });

    userColor = puzzleState.userColor;
    updateTrainingHeader();
    updatePracticeProgressForPuzzle();
    renderPuzzleMovePanel();
    updateCoachPanelForPuzzle('ready');
    showPracticeStatus('hint', 'Find the best move for ' + (puzzleState.userColor === 'w' ? 'White' : 'Black') + '.');
  }

  function onOpeningPuzzleMove(moveResult) {
    if (!puzzleState.active || !puzzleState.puzzle || puzzleState.loading) return;
    if (puzzleState.solved || puzzleState.awaitingRetry) return;

    var expectedUci = getOpeningPuzzleExpectedUci();
    var playedUci = (moveResult.from || '') + (moveResult.to || '') + (moveResult.promotion || '');

    if (!expectedUci) return;

    if (playedUci !== expectedUci && playedUci.slice(0, 4) !== expectedUci.slice(0, 4)) {
      // Wrong move — roll back and let the user try again.
      puzzleState.awaitingRetry = true;
      puzzleState.attemptedCount += 1;
      if (puzzleState.chess) {
        puzzleState.chess.undo();
        ChessBoard.setPosition(puzzleState.chess);
      }
      ChessBoard.clearArrows();
      ChessBoard.clearMarkers();
      updateCoachPanelForPuzzle('wrong');
      showPracticeStatus('error', 'Not the puzzle move. Try again.');
      // Allow another attempt immediately after a short pause.
      setTimeout(function () { puzzleState.awaitingRetry = false; }, 150);
      return;
    }

    // Correct move.
    SoundController.playMove();
    puzzleState.progressPly += 1;
    ChessBoard.clearArrows();

    var solutionMoves = getOpeningPuzzleSolutionMoves();
    if (puzzleState.progressPly >= solutionMoves.length) {
      finishOpeningPuzzle(true);
      return;
    }

    // Auto-play opponent reply.
    var replyUci = solutionMoves[puzzleState.progressPly];
    var replyMove = replyUci ? applyUciMoveToChess(puzzleState.chess, replyUci) : null;
    if (replyMove) {
      puzzleState.progressPly += 1;
      ChessBoard.setPosition(puzzleState.chess);
      ChessBoard.setLastMove(replyMove.from, replyMove.to);
      setTimeout(function () { SoundController.playMove(); }, 140);
    }

    if (puzzleState.progressPly >= solutionMoves.length) {
      finishOpeningPuzzle(true);
      return;
    }

    updatePracticeProgressForPuzzle();
    updateCoachPanelForPuzzle('correct');
    showPracticeStatus('success', 'Correct. Keep calculating.');
  }

  function finishOpeningPuzzle(success) {
    puzzleState.solved = !!success;
    if (success) puzzleState.solvedCount += 1;
    puzzleState.attemptedCount += 1;
    updatePracticeProgressForPuzzle();
    updateCoachPanelForPuzzle(success ? 'solved' : 'failed');
    renderPuzzleMovePanel();
    showPracticeStatus(success ? 'success' : 'error',
      success
        ? 'Solved! Next puzzle loading...'
        : 'Puzzle missed. Loading the next one...'
    );
    clearOpeningPuzzleAdvanceTimer();
    openingPuzzleAdvanceTimer = setTimeout(function () {
      openingPuzzleAdvanceTimer = null;
      if (!puzzleState.active) return;
      loadOpeningPuzzle();
    }, success ? 900 : 1400);
  }

  function getOpeningPuzzleSolutionMoves() {
    if (!puzzleState.puzzle || !puzzleState.puzzle.moves) return [];
    return puzzleState.puzzle.moves.slice(1); // first move is setup
  }

  function getOpeningPuzzleExpectedUci() {
    return getOpeningPuzzleSolutionMoves()[puzzleState.progressPly] || '';
  }

  function applyUciMoveToChess(chess, uci) {
    if (!chess || !uci || uci.length < 4) return null;
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || 'q'
    });
  }

  function showOpeningPuzzleHint() {
    if (!puzzleState.active || !puzzleState.puzzle || puzzleState.solved) return;
    var expected = getOpeningPuzzleExpectedUci();
    if (!expected || !puzzleState.chess) return;
    sessionHints++;
    var preview = new Chess();
    preview.load(puzzleState.chess.fen());
    var move = applyUciMoveToChess(preview, expected);
    ChessBoard.clearArrows();
    if (move) {
      ChessBoard.setArrows([{ from: move.from, to: move.to, color: 'rgba(100, 200, 100, 0.82)' }]);
    }
    showPracticeStatus('hint', 'Hint shown — find the right move.');
  }

  function renderPuzzleMovePanel() {
    var container = document.getElementById('practiceMoveList');
    if (container) {
      if (!puzzleState.puzzle) {
        container.innerHTML = '<span class="pmove pmove-hidden">Loading puzzles for ' + escapeHtml(puzzleState.baseName || 'this opening') + '...</span>';
      } else {
        var themes = (puzzleState.puzzle.themes || []).slice(0, 4).map(function (t) {
          return '<span class="pmove">' + escapeHtml(String(t).replace(/([a-z])([A-Z])/g, '$1 $2')) + '</span>';
        }).join('');
        container.innerHTML = themes || '<span class="pmove pmove-hidden">Tactical puzzle</span>';
      }
    }

    var pgnLine = document.getElementById('practiceMovePgn');
    if (pgnLine) {
      if (!puzzleState.puzzle) {
        pgnLine.textContent = 'Puzzles from the ' + (puzzleState.baseName || 'opening') + ' family.';
      } else {
        pgnLine.textContent = 'Puzzle Elo ' + (puzzleState.puzzle.rating || '—') +
          ' · ' + (puzzleState.baseName || 'Opening') + ' pool';
      }
      pgnLine.classList.remove('is-concealed');
    }

    var movesHeader = document.getElementById('practiceMovesHeader');
    if (movesHeader) movesHeader.textContent = 'Puzzle Themes';
  }

  function updatePracticeProgressForPuzzle() {
    var bar = document.getElementById('practiceProgressBar');
    var text = document.getElementById('practiceProgressText');
    var total = getOpeningPuzzleSolutionMoves().length;
    var done = Math.min(puzzleState.progressPly, total);
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (text) {
      if (!puzzleState.puzzle) {
        text.textContent = 'Puzzles · ' + (puzzleState.baseName || 'Loading');
      } else {
        text.textContent = puzzleState.solvedCount + ' solved · Puzzle ' + (puzzleState.solvedCount + (puzzleState.solved ? 0 : 1));
      }
    }
  }

  function updateCoachPanelForPuzzle(phase) {
    var body = document.getElementById('opnCoachBody') || document.getElementById('coachExplanation');
    if (!body) return;

    var baseLabel = escapeHtml(puzzleState.baseName || (currentOpening && currentOpening.name) || 'Opening');
    var header = '<div class="opn-coach-move-label"><strong>Puzzles</strong> — ' + baseLabel + '</div>';
    var famNote = '<div class="opn-coach-move-explain" style="margin-top:6px">All variations of the <strong>' + baseLabel + '</strong> family share this puzzle pool.</div>';

    if (phase === 'loading') {
      body.innerHTML = header + famNote +
        '<div class="opn-coach-move-explain" style="margin-top:8px">Loading a puzzle from the ' + baseLabel + ' pool...</div>';
      return;
    }

    if (phase === 'error') {
      body.innerHTML = header + famNote +
        '<div class="opn-coach-move-explain" style="margin-top:8px">Could not load a puzzle. Switch modes or try again.</div>';
      return;
    }

    if (phase === 'wrong') {
      body.innerHTML = header + famNote +
        '<div class="opn-coach-move-explain" style="margin-top:8px">That was not the puzzle move — try the position again.</div>';
      return;
    }

    if (phase === 'solved') {
      body.innerHTML = header + famNote +
        '<div class="opn-coach-complete" style="margin-top:8px">🎉 Solved! Loading the next ' + baseLabel + ' puzzle...</div>';
      return;
    }

    if (phase === 'failed') {
      body.innerHTML = header + famNote +
        '<div class="opn-coach-move-explain" style="margin-top:8px">Next puzzle loading...</div>';
      return;
    }

    // phase === 'ready' or 'correct'
    var side = puzzleState.userColor === 'w' ? 'White' : 'Black';
    var rating = puzzleState.puzzle && puzzleState.puzzle.rating ? (' · Puzzle Elo ' + puzzleState.puzzle.rating) : '';
    body.innerHTML = header + famNote +
      '<div class="opn-coach-move-explain" style="margin-top:8px">Find the best move for <strong>' + side + '</strong>' + rating + '.</div>' +
      '<div class="opn-coach-next">Play the move on the board — correct moves auto-advance.</div>';
  }

  // ===== UI UPDATES =====
  function updatePracticeProgress() {
    var total = expectedMoves.length;
    var current = currentMoveIndex;
    var pct = total > 0 ? Math.round((current / total) * 100) : 0;

    var bar = document.getElementById('practiceProgressBar');
    var text = document.getElementById('practiceProgressText');
    if (bar) bar.style.width = pct + '%';
    if (text) {
      if (practiceMode === 'arena') {
        text.textContent = 'Arena #' + Math.max(1, arenaState.challengeNo || 1) + ' · ' + current + ' / ' + total + ' recalled · streak ' + (arenaState.streak || 0);
      } else {
        text.textContent = current + ' / ' + total + ((practiceMode === 'drill' || practiceMode === 'time') ? ' moves recalled' : ' moves');
      }
    }
  }

  function renderPracticeMoveList() {
    var container = document.getElementById('practiceMoveList');
    if (!container) return;

    var html = '';
    if (practiceMode === 'drill' || practiceMode === 'time' || practiceMode === 'arena') {
      for (var i = 0; i < expectedMoves.length; i++) {
        var hiddenMoveNum = Math.floor(i / 2) + 1;
        var hiddenIsWhite = i % 2 === 0;

        if (hiddenIsWhite) {
          html += '<span class="pmove-num">' + hiddenMoveNum + '.</span>';
        }

        if (i < currentMoveIndex) {
          html += '<span class="pmove pmove-done">' + expectedMoves[i] + '</span>';
          continue;
        }

        if (i === currentMoveIndex) {
          var nextTurnColor = hiddenIsWhite ? 'w' : 'b';
          var prompt = nextTurnColor === userColor ? 'Your move' : 'Line reply';
          html += '<span class="pmove pmove-current pmove-hidden">' + prompt + '</span>';
          break;
        }
      }

      if (!html) {
        html = '<span class="pmove pmove-hidden">' + (
          practiceMode === 'time'
            ? 'Timed line hidden. Start playing.'
            : practiceMode === 'arena'
              ? 'Arena line hidden. Survive the first move.'
              : 'Line hidden. Start playing.'
        ) + '</span>';
      }
    } else {
      for (var j = 0; j < expectedMoves.length; j++) {
        var moveNum = Math.floor(j / 2) + 1;
        var isWhite = j % 2 === 0;

        if (isWhite) {
          html += '<span class="pmove-num">' + moveNum + '.</span>';
        }

        var cls = 'pmove';
        if (j < currentMoveIndex) cls += ' pmove-done';
        if (j === currentMoveIndex) cls += ' pmove-current';
        if (j > currentMoveIndex) cls += ' pmove-future';

        html += '<span class="' + cls + '">' + expectedMoves[j] + '</span>';
      }
    }

    container.innerHTML = html;

    // Scroll to current move
    var currentEl = container.querySelector('.pmove-current');
    if (currentEl) currentEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function updateCoachPanel(isStart) {
    var body = document.getElementById('opnCoachBody') || document.getElementById('coachExplanation');
    if (!body) return;

    if (practiceMode === 'learn') {
      if (isStart || currentMoveIndex === 0) {
        body.innerHTML =
          '<div class="opn-coach-move-label"><strong>' + currentOpening.name + '</strong></div>' +
          '<div class="opn-coach-move-explain">' + getOpeningDefinition(currentOpening) + '</div>' +
          '<div class="opn-coach-move-explain" style="margin-top:8px">Playing as <strong>' + getColorLabel(userColor) + '</strong> — <em>' + currentVariation.name + '</em></div>' +
          '<div class="opn-coach-next">Press <strong>›</strong> to step through each move.</div>';
      } else if (currentMoveIndex > 0 && currentMoveIndex <= expectedMoves.length) {
        var idx = currentMoveIndex - 1;
        var move = expectedMoves[idx];
        var moveNum = Math.floor(idx / 2) + 1;
        var isWhiteTurn = idx % 2 === 0;
        var label = moveNum + (isWhiteTurn ? '.' : '...') + ' ' + move;
        body.innerHTML =
          '<div class="opn-coach-move-label">' + label + '</div>' +
          '<div class="opn-coach-move-explain">' + getExplanation(move, idx) + '</div>' +
          (currentMoveIndex < expectedMoves.length
            ? '<div class="opn-coach-next">Press <strong>›</strong> for the next move.</div>'
            : '<div class="opn-coach-complete">🎉 Line complete! All moves discovered.</div>');
      }
      return;
    }

    if (practiceMode === 'drill') {
      var nextTurnColor = currentMoveIndex % 2 === 0 ? 'w' : 'b';
      var drillHtml =
        '<p><strong>' + currentOpening.name + '</strong> — ' + currentVariation.name + '</p>' +
        '<p style="margin-top:8px">Play as <strong>' + getColorLabel(userColor) + '</strong> from memory.</p>' +
        '<p style="margin-top:8px">Progress: <strong>' + currentMoveIndex + ' / ' + expectedMoves.length + '</strong></p>';
      if (!isStart && currentMoveIndex < expectedMoves.length) {
        drillHtml += '<p style="margin-top:8px">' + (nextTurnColor === userColor ? 'Your turn.' : 'Opponent reply incoming.') + '</p>';
      }
      if (currentMoveIndex >= expectedMoves.length) drillHtml += '<p style="margin-top:8px"><strong>Line complete.</strong></p>';
      body.innerHTML = drillHtml;
      return;
    }

    if (practiceMode === 'time') {
      var best = timeModeState.best || getTimeModeBest();
      var timeHtml =
        '<p><strong>' + currentOpening.name + '</strong> — ' + currentVariation.name + '</p>' +
        '<p style="margin-top:8px">Race the clock as <strong>' + getColorLabel(userColor) + '</strong>. The full line stays hidden.</p>' +
        '<p style="margin-top:8px">Score: <strong>' + Math.max(0, Math.round(timeModeState.score || 0)) + '</strong> · Move timer <strong>' + formatMoveClock(timeModeState.moveRemainingMs) + '</strong></p>' +
        '<p style="margin-top:8px">Penalties: hints cost time and score; mistakes cost 3 seconds.</p>';
      if (best && best.score) {
        timeHtml += '<p style="margin-top:8px">Personal best: <strong>' + best.score + '</strong> · ' + escapeHtml(best.medal || 'Practice') + '</p>';
      }
      if (!isStart && currentMoveIndex < expectedMoves.length) {
        timeHtml += '<p style="margin-top:8px"><strong>' + ((currentMoveIndex % 2 === 0 ? 'w' : 'b') === userColor ? 'Your move.' : 'Opponent reply incoming.') + '</strong></p>';
      }
      if (timeModeState.result && timeModeState.result.success) {
        timeHtml += '<p style="margin-top:8px"><strong>' + escapeHtml(timeModeState.result.medal.label) + ' finish.</strong></p>';
      }
      body.innerHTML = timeHtml;
      return;
    }

    if (practiceMode === 'arena') {
      var arenaHtml =
        '<p><strong>Arena Gauntlet</strong> — ' + escapeHtml(currentOpening.name) + '</p>' +
        '<p style="margin-top:8px">Challenge <strong>#' + Math.max(1, arenaState.challengeNo || 1) + '</strong>: ' + escapeHtml(arenaState.lineName || (currentVariation && currentVariation.name) || 'Random line') + '</p>' +
        '<p style="margin-top:8px">Streak <strong>' + (arenaState.streak || 0) + '</strong> · Score <strong>' + Math.max(0, Math.round(arenaState.score || 0)) + '</strong> · Arena rating <strong>' + clampArenaRating(arenaState.rating) + '</strong></p>' +
        '<p style="margin-top:8px">Line Elo <strong>' + (arenaState.lineRating || '—') + '</strong>. No hints, no takebacks — the first wrong legal move ends the run.</p>';
      if (arenaState.finished && arenaState.lastResult && arenaState.lastResult.failed) {
        arenaHtml += '<p style="margin-top:8px"><strong>Run ended.</strong> ' +
          (arenaState.lastResult.playedSAN ? 'You played ' + escapeHtml(arenaState.lastResult.playedSAN) + '. ' : '') +
          (arenaState.lastResult.expectedSAN ? 'Correct was <strong>' + escapeHtml(arenaState.lastResult.expectedSAN) + '</strong>.' : '') +
          '</p>';
      } else if (!isStart && currentMoveIndex < expectedMoves.length) {
        arenaHtml += '<p style="margin-top:8px"><strong>' + ((currentMoveIndex % 2 === 0 ? 'w' : 'b') === userColor ? 'Your move.' : 'Opponent reply incoming.') + '</strong></p>';
      }
      body.innerHTML = arenaHtml;
      return;
    }

    if (isStart) {
      body.innerHTML =
        '<div class="opn-coach-move-label"><strong>' + currentOpening.name + '</strong></div>' +
        '<div class="opn-coach-move-explain">' + getOpeningDefinition(currentOpening) + '</div>' +
        '<div class="opn-coach-move-explain" style="margin-top:8px">Playing as <strong>' + getColorLabel(userColor) + '</strong> — <em>' + currentVariation.name + '</em></div>' +
        '<div class="opn-coach-next">Play the correct moves. Use <strong>Hint</strong> if you get stuck.</div>';
      return;
    }

    // Practice mode: explain the last move(s)
    var html = '';
    var startIdx = Math.max(0, currentMoveIndex - 2);
    for (var i = startIdx; i < currentMoveIndex && i < expectedMoves.length; i++) {
      var mv = expectedMoves[i];
      var mn = Math.floor(i / 2) + 1;
      var iw = i % 2 === 0;
      var lbl = mn + (iw ? '.' : '...') + ' ' + mv;
      html += '<div class="opn-coach-move-label">' + lbl + ' <span class="coach-color-badge ' + (iw ? 'white-badge' : 'black-badge') + '">' + (iw ? 'White' : 'Black') + '</span></div>';
      html += '<div class="opn-coach-move-explain">' + getExplanation(mv, i) + '</div>';
    }

    if (currentMoveIndex < expectedMoves.length) {
      var ntc = currentMoveIndex % 2 === 0 ? 'w' : 'b';
      var nt = ntc === 'w' ? 'White' : 'Black';
      var ld = ntc === userColor ? 'Your turn' : 'Opponent turn';
      html += '<div class="opn-coach-next">' + ld + ': <strong>' + nt + '</strong> to move.</div>';
    }

    body.innerHTML = html;
  }

  // GAC-inspired commentary: combines Move Description + Planning/Rationale + Move Quality
  function getExplanation(san, moveIndex) {
    var baseSan = san.replace(/[+#!?]/g, '');
    if (COACH_EXPLANATIONS[baseSan]) return COACH_EXPLANATIONS[baseSan];
    return generateGACCommentary(san, moveIndex);
  }

  var PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var FILE_NAMES  = { a:'a-file', b:'b-file', c:'c-file', d:'d-file', e:'e-file', f:'f-file', g:'g-file', h:'h-file' };
  var CENTER_SQUARES = { e4:1, e5:1, d4:1, d5:1, c4:1, c5:1, f4:1, f5:1 };
  var KINGSIDE_FILES = { f:1, g:1, h:1 };
  var QUEENSIDE_FILES = { a:1, b:1, c:1 };

  function generateGACCommentary(san, moveIndex) {
    var color    = moveIndex % 2 === 0 ? 'White' : 'Black';
    var opponent = color === 'White' ? 'Black' : 'White';
    var moveNum  = Math.floor(moveIndex / 2) + 1;
    var phase    = moveNum <= 5 ? 'opening' : moveNum <= 12 ? 'middlegame-approach' : 'late-opening';

    // Extract verbose move data from chess.js history
    var history  = (practiceChess && typeof practiceChess.history === 'function')
                     ? practiceChess.history({ verbose: true }) : [];
    var mv       = history.length > 0 ? history[history.length - 1] : null;

    var piece    = mv ? mv.piece : null;
    var from     = mv ? mv.from  : null;
    var to       = mv ? mv.to    : null;
    var captured = mv ? mv.captured : null;
    var flags    = mv ? (mv.flags || '') : '';

    var isCapture   = san.includes('x');
    var isCheck     = san.includes('+') && !san.includes('#');
    var isMate      = san.includes('#');
    var isKCastle   = san === 'O-O';
    var isQCastle   = san === 'O-O-O';
    var isPromotion = san.includes('=');
    var isEnPassant = flags.includes('e');
    var isCenter    = to && CENTER_SQUARES[to];
    var toFile      = to ? to[0] : null;
    var toRank      = to ? parseInt(to[1]) : null;

    var parts = [];

    // ── Category 1: Move Description ──────────────────────────────────────
    if (isMate) {
      parts.push(color + ' plays ' + san + ' — checkmate! The game is over.');
    } else if (isKCastle) {
      parts.push(color + ' castles kingside (O-O), tucking the king behind the pawns on f, g, and h while activating the rook on the h-file.');
    } else if (isQCastle) {
      parts.push(color + ' castles queenside (O-O-O), moving the king to c1/c8 and bringing the a-rook into the center.');
    } else if (isPromotion) {
      var promPiece = san.slice(-1).toLowerCase();
      parts.push(color + ' promotes the pawn to a ' + (PIECE_NAMES[promPiece] || 'queen') + ' on ' + to + '!');
    } else if (isEnPassant) {
      parts.push(color + ' captures en passant with ' + san + ', removing ' + opponent + '\'s pawn that advanced two squares last turn.');
    } else if (isCapture && captured) {
      var capName = PIECE_NAMES[captured] || 'piece';
      parts.push(color + ' captures the ' + opponent.toLowerCase() + ' ' + capName + ' on ' + to + ' with ' + san + (isCheck ? ', giving check' : '') + '.');
    } else if (piece) {
      var pieceName = PIECE_NAMES[piece] || 'piece';
      if (piece === 'p') {
        parts.push(color + ' advances the ' + pieceName + ' to ' + to + (isCenter ? ', striking at the center' : '') + (isCheck ? ', giving check' : '') + '.');
      } else {
        parts.push(color + ' develops the ' + pieceName + ' to ' + to + (isCenter ? ', placing it on a central square' : '') + (isCheck ? ', giving check' : '') + '.');
      }
    } else {
      parts.push(color + ' plays ' + san + '.');
    }

    // ── Category 2: Move Quality (threat / check context) ─────────────────
    if (isCheck && !isMate) {
      parts.push('This check forces ' + opponent + ' to respond immediately, disrupting their plans and potentially gaining a tempo.');
    }

    // ── Category 4: Planning / Rationale ──────────────────────────────────
    var rationale = getOpeningRationale(piece, to, from, toFile, toRank, isCapture, captured, isKCastle, isQCastle, color, opponent, phase, san, moveNum, isCenter);
    if (rationale) parts.push(rationale);

    return parts.join(' ');
  }

  function getOpeningRationale(piece, to, from, toFile, toRank, isCapture, captured, isKCastle, isQCastle, color, opponent, phase, san, moveNum, isCenter) {
    if (isKCastle || isQCastle) return null; // already described above

    // Pawn moves
    if (piece === 'p') {
      if (to === 'e4' || to === 'e5') return 'Central pawns claim maximum space and open diagonals for the bishops and queen — a cornerstone of classical opening theory.';
      if (to === 'd4' || to === 'd5') return 'The d-pawn supports central control. Together with e4/e5 it forms a classical pawn center that restricts the opponent\'s pieces.';
      if (to === 'c4' || to === 'c5') return 'This flank pawn fights for d5/d4 control without committing the d-pawn. It\'s a flexible move common to the English, Queen\'s Gambit, and Sicilian structures.';
      if (isCapture && captured) {
        if (captured === 'p') return 'Capturing the pawn changes the pawn structure. The recapture choice will shape the middlegame — open files and diagonals shift accordingly.';
        if (captured === 'n' || captured === 'b') return 'Exchanging a minor piece can be strong if it disrupts the opponent\'s piece coordination or gains the bishop pair.';
      }
      if (toFile === 'h' || toFile === 'a') return 'This flank pawn advance makes space, prevents an opponent piece from using that square, or prepares a future expansion.';
      if (toFile === 'f') return 'The f-pawn move can sharpen the game, supporting e5 or preparing a kingside attack — but it slightly weakens the king if castled short.';
      if (phase === 'opening') return 'Pawn moves in the opening fight for space and establish the structural foundation that determines the middlegame pawn skeleton.';
      return 'This pawn advance claims space and restricts opponent piece mobility in this area of the board.';
    }

    // Knight moves
    if (piece === 'n') {
      if (to === 'f3' || to === 'f6') return 'A model developing move — the knight on f3/f6 controls e5/e4 and d4/d5, prepares kingside castling, and rarely gets in the way of other pieces.';
      if (to === 'c3' || to === 'c6') return 'Developing toward the center. This knight supports e4/e5 and pressures d4/d5, though it blocks the c-pawn\'s advance.';
      if (to === 'd4' || to === 'd5') return 'An outpost in the center! A knight on d4/d5 that cannot be challenged by an opponent pawn is a powerful piece.';
      if (to === 'e5' || to === 'e4') return 'A centralized knight on e5/e4 is a powerful piece, controlling many squares and often supported by a pawn on d4/d4.';
      if (isCapture && captured) return 'This knight capture removes an important ' + opponent.toLowerCase() + ' piece, potentially gaining the bishop pair or removing a key defender.';
      if (phase === 'opening') return 'Knights are best developed early toward central squares. Each developing move brings the knight closer to its optimal outpost.';
      return 'This knight maneuver repositions to a more active square, a common technique called a "knight reroute" in opening theory.';
    }

    // Bishop moves
    if (piece === 'b') {
      if (to === 'b5' || to === 'b4') return 'A pin or threat of a pin! This classical bishop move (Ruy Lopez / Nimzo-Indian style) creates long-term pressure without immediately capturing.';
      if (to === 'c4' || to === 'c5') return 'The bishop targets the sensitive f7/f2 square — one of the oldest ideas in chess. It supports piece activity and potential kingside pressure.';
      if (to === 'g5' || to === 'g4') return 'Pinning the opponent\'s knight against the queen. This disrupts coordination and forces the opponent to decide whether to accept the pin or break it.';
      if (to === 'e2' || to === 'e7') return 'A modest but solid development, keeping the bishop on a flexible square while preparing to castle kingside.';
      if (to === 'g2' || to === 'g7') return 'Fianchettoing the bishop — placing it on the long diagonal where it can influence the center from a distance. A hypermodern technique.';
      if (to === 'b2' || to === 'b7') return 'The fianchetto bishop on b2/b7 controls the long diagonal (a1–h8), exerting powerful pressure across the board.';
      if (to === 'f4' || to === 'f5') return 'The bishop is placed outside the pawn chain before playing e3, keeping it actively on f4/f5. This is the signature of the London System and similar setups.';
      if (isCapture) return 'This bishop capture disrupts the opponent\'s structure or removes a key piece. Consider the consequences for the diagonal and pawn structure.';
      return 'Bishops are long-range pieces that thrive on open diagonals. This move activates it toward a productive diagonal for the coming middlegame.';
    }

    // Rook moves
    if (piece === 'r') {
      if (to && to[0] === 'e') return 'The rook eyes the open or semi-open e-file, preparing to double rooks or exert pressure on the e-pawn.';
      if (to && to[0] === 'd') return 'Placing the rook on the d-file — useful for supporting the d-pawn or contesting an open file in the center.';
      if (phase === 'opening') return 'Rooks are typically activated after castling. Connecting the rooks and placing them on open or semi-open files is a key goal in the opening.';
      return 'Rooks belong on open files where they can exert maximum pressure. This move aims to seize file control or support a pawn advance.';
    }

    // Queen moves
    if (piece === 'q') {
      if (moveNum <= 4) return 'Early queen development is risky — it can be chased by opponent minor pieces, losing tempos. This is a deliberate choice in this specific opening line.';
      if (isCapture) return 'The queen recapture is strong here, centralizing the queen while removing material. In the opening, recapturing with the queen avoids exposing it to early harassment.';
      if (to === 'd1' || to === 'd8') return 'The queen retreats to a safe central square, maintaining flexibility and keeping attacking options open.';
      return 'The queen move connects the ideas on both sides of the board. Watch for how it supports future piece coordination or threatens multiple targets.';
    }

    // King moves (non-castle)
    if (piece === 'k') {
      if (moveNum <= 8) return 'A king move this early is unusual and signals a specific theoretical idea — the king may be heading to safety via an unorthodox route, or this is a forcing response.';
      return 'The king steps to safety or activates in a simplified position. King activity is crucial in the endgame.';
    }

    return null;
  }

  function showPracticeStatus(type, message) {
    var el = document.getElementById('practiceStatus');
    if (!el) return;
    el.className = 'practice-status ps-' + type;
    el.textContent = message;
    el.style.display = 'block';
  }

  function clearPracticeStatus() {
    var el = document.getElementById('practiceStatus');
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  // ===== SRS COMPLETION PANEL =====

  function onVariationComplete() {
    if (practiceMode === 'arena') {
      completeArenaChallenge();
      return;
    }
    isPracticing = false;
    if (practiceMode === 'time') {
      finishTimeModeSession(true);
    }
    markVariationComplete(currentOpening, currentVariation);
    showSRSPanel();
  }

  function showSRSPanel() {
    var panel = document.getElementById('srsRatingPanel');
    if (!panel) {
      showPracticeStatus('success', getCompletionMessage());
      return;
    }

    var srsId = currentOpening && currentVariation ? getCanonicalVariationId(currentOpening, currentVariation) : null;
    var r = srsId ? (srsData[srsId] || {}) : {};
    var reps = r.reps || 0;
    var curInterval = r.interval || 1;
    var ef = r.ef || 2.5;

    var hardDays = Math.max(1, Math.round(curInterval * 1.2));
    var easyDays;
    if (reps < 1) easyDays = 1;
    else if (reps < 2) easyDays = 3;
    else easyDays = Math.round(curInterval * ef);

    var perfNote = sessionErrors === 0 && sessionHints === 0
      ? '&#10003; Perfect — no mistakes or hints!'
      : sessionErrors + ' mistake' + (sessionErrors !== 1 ? 's' : '') + ', ' + sessionHints + ' hint' + (sessionHints !== 1 ? 's' : '') + ' used.';

    var timeSummary = '';
    if (practiceMode === 'time' && timeModeState.result && timeModeState.result.success) {
      timeSummary =
        '<div class="srs-perf-note">Timed run: <strong>' + timeModeState.result.score + '</strong> points · ' +
        escapeHtml(timeModeState.result.medal.label) + ' medal · ' +
        escapeHtml(formatTimeClock(timeModeState.remainingMs)) + ' left.</div>';
    }

    panel.innerHTML =
      '<div class="srs-header">&#127775; How well did you remember it?</div>' +
      timeSummary +
      '<div class="srs-perf-note">' + perfNote + '</div>' +
      '<div class="srs-btns-row">' +
        '<button class="srs-btn srs-again" id="srsAgainBtn">&#8635; Again<span class="srs-int">1 day</span></button>' +
        '<button class="srs-btn srs-hard" id="srsHardBtn">&#9888; Hard<span class="srs-int">' + formatSRSInterval(hardDays) + '</span></button>' +
        '<button class="srs-btn srs-easy" id="srsEasyBtn">&#10003; Easy<span class="srs-int">' + formatSRSInterval(easyDays) + '</span></button>' +
      '</div>';
    panel.style.display = '';

    document.getElementById('srsAgainBtn').onclick = function() { rateSRS('again'); };
    document.getElementById('srsHardBtn').onclick  = function() { rateSRS('hard');  };
    document.getElementById('srsEasyBtn').onclick  = function() { rateSRS('easy');  };
  }

  function hideSRSPanel() {
    var panel = document.getElementById('srsRatingPanel');
    if (panel) panel.style.display = 'none';
  }

  function rateSRS(rating) {
    if (!currentOpening || !currentVariation) return;
    var srsId = getCanonicalVariationId(currentOpening, currentVariation);
    var record = updateSRS(srsId, rating);
    hideSRSPanel();
    updateReviewBanner();
    var nextLabel = formatSRSInterval(record.interval);
    showPracticeStatus('success', getCompletionMessage() + ' Next review: ' + nextLabel + '.');
    if (isInReviewMode) {
      setTimeout(function() { advanceReviewQueue(rating); }, 900);
    }
  }

  // ===== RELATED LINES (BRANCHING PANEL) =====

  function renderRelatedLines() {
    var container = document.getElementById('relatedLinesList');
    if (!container || !currentOpening) { return; }
    var allVars = currentOpening.variations || [];
    var others = allVars.filter(function(v) { return v !== currentVariation; });
    if (!others.length) {
      container.innerHTML = '<div class="related-empty">No other lines in this opening.</div>';
      return;
    }
    container.innerHTML = others.slice(0, 6).map(function(v) {
      var realIdx = allVars.indexOf(v);
      var vid = getCanonicalVariationId(currentOpening, v);
      var status = getSRSStatusLabel(vid);
      var badgeColors = { due: '#ef5350', mature: '#4caf7d', learning: '#d4af37', 'new': '#4a5568' };
      var bg = badgeColors[status] || '#4a5568';
      return '<button class="related-line-btn" data-idx="' + realIdx + '">' +
        '<span class="related-line-name">' + escapeHtml(v.name || 'Line') + '</span>' +
        '<span class="related-line-badge" style="background:' + bg + '">' + status + '</span>' +
      '</button>';
    }).join('');
    container.querySelectorAll('.related-line-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        startPractice(parseInt(this.getAttribute('data-idx')));
      });
    });
  }

  // ===== NAVIGATION =====
  function backToGallery() {
    isPracticing = false;
    stopTimeModeTimer();
    clearArenaAdvanceTimer();
    if (arenaState.active || arenaState.finished) persistArenaProgress();
    timeModeState = createInitialTimeModeState();
    arenaState = createInitialArenaState();
    currentOpening = null;
    currentVariation = null;
    clearPracticeStatus();
    updateTimeModePanel();
    updateArenaModePanel();
    document.getElementById('openingGalleryView').style.display = 'block';
    document.getElementById('openingDetailView').style.display = 'none';
    var modeView = document.getElementById('openingModeView');
    if (modeView) modeView.style.display = 'none';
    document.getElementById('openingPracticeView').style.display = 'none';
    animateEntry('openingGalleryView');
    writeOpeningsListHistory(false);
  }

  function backToDetail() {
    isPracticing = false;
    stopTimeModeTimer();
    clearArenaAdvanceTimer();
    if (arenaState.active || arenaState.finished) persistArenaProgress();
    timeModeState = createInitialTimeModeState();
    arenaState = createInitialArenaState();
    currentVariation = null;
    clearPracticeStatus();
    updateTimeModePanel();
    updateArenaModePanel();
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'block';
    var modeView = document.getElementById('openingModeView');
    if (modeView) modeView.style.display = 'none';
    document.getElementById('openingPracticeView').style.display = 'none';
    animateEntry('openingDetailView');
  }

  function animateEntry(target) {
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    el.classList.remove('kv-stage-enter');
    void el.offsetWidth;
    el.classList.add('kv-stage-enter');
    setTimeout(function() {
      el.classList.remove('kv-stage-enter');
    }, 260);
  }

  // ===== INIT =====
  function init() {
    // Lazy-load the opening data (1.3MB) only when the Practice tab is opened
    if (OPENING_DATA) {
      setupUI();
      return;
    }

    var container = document.getElementById('openingGalleryGrid');
    if (container) {
      container.innerHTML =
        '<div class="skeleton-card opening-skeleton-card"><div class="skeleton-media"></div><div class="skeleton-line w-38"></div><div class="skeleton-line w-82"></div><div class="skeleton-line w-60"></div></div>' +
        '<div class="skeleton-card opening-skeleton-card"><div class="skeleton-media"></div><div class="skeleton-line w-44"></div><div class="skeleton-line w-74"></div><div class="skeleton-line w-56"></div></div>' +
        '<div class="skeleton-card opening-skeleton-card"><div class="skeleton-media"></div><div class="skeleton-line w-40"></div><div class="skeleton-line w-78"></div><div class="skeleton-line w-52"></div></div>';
    }

    import('../lib/openingData').then(function (module) {
      OPENING_DATA = (module && module.default) || [];
      setupUI();
    }).catch(function (err) {
      console.error('Failed to load opening data:', err);
      if (container) container.innerHTML = '<div class="no-openings">Failed to load openings data.</div>';
    });
  }

  function mergeOpeningSources(base, extra) {
    var byName = Object.create(null);
    var merged = [];
    (base || []).forEach(function (op) {
      if (!op || !op.name) return;
      byName[op.name] = op;
      merged.push(op);
    });
    (extra || []).forEach(function (op) {
      if (!op || !op.name) return;
      if (byName[op.name]) return; // keep existing curated entry on collision
      byName[op.name] = op;
      merged.push(op);
    });
    return merged;
  }

  function setupUI() {
    if (uiInitialized) {
      renderOpeningGallery();
      handleOpeningRoute();
      return;
    }
    uiInitialized = true;

    renderOpeningGallery();

    // Search
    var searchInput = document.getElementById('openingSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchQuery = this.value;
        renderOpeningGallery();
      });
    }

    document.querySelectorAll('.eco-filter-btn[data-side]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.eco-filter-btn[data-side]').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        filterColor = this.getAttribute('data-side') || '';
        renderOpeningGallery();
      });
    });

    document.querySelectorAll('.eco-filter-btn[data-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.eco-filter-btn[data-status]').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        filterStatus = this.getAttribute('data-status') || '';
        renderOpeningGallery();
      });
    });

    // Back buttons
    var backGalleryBtn = document.getElementById('backToGalleryBtn');
    if (backGalleryBtn) backGalleryBtn.addEventListener('click', backToGallery);

    var openingModeBackBtn = document.getElementById('openingModeBackBtn');
    if (openingModeBackBtn) openingModeBackBtn.addEventListener('click', backToGallery);

    var openingModePrevLineBtn = document.getElementById('openingModePrevLineBtn');
    if (openingModePrevLineBtn) openingModePrevLineBtn.addEventListener('click', function() { changeOpeningModeLine(-1); });

    var openingModeNextLineBtn = document.getElementById('openingModeNextLineBtn');
    if (openingModeNextLineBtn) openingModeNextLineBtn.addEventListener('click', function() { changeOpeningModeLine(1); });

    var openingModeHintBtn = document.getElementById('openingModeHintBtn');
    if (openingModeHintBtn) openingModeHintBtn.addEventListener('click', function() {
      var coach = document.getElementById('openingModeCoachText');
      var variation = currentOpening && currentOpening.variations ? currentOpening.variations[openingModeVariationIdx] : null;
      if (coach && currentOpening && variation) coach.textContent = getOpeningModeCoachCopy(currentOpening, variation);
    });

    var openingModeCycleBtn = document.getElementById('openingModeCycleBtn');
    if (openingModeCycleBtn) openingModeCycleBtn.addEventListener('click', function() {
      openingModeSelectedMode = openingModeSelectedMode === 'learn' ? 'practice' : 'learn';
      updateOpeningModeView();
    });

    var backDetailBtn = document.getElementById('backToDetailBtn');
    if (backDetailBtn) backDetailBtn.addEventListener('click', backToDetail);

    var backDetailBtn2 = document.getElementById('backToDetailBtn2');
    if (backDetailBtn2) backDetailBtn2.addEventListener('click', backToGallery);

    // Practice controls
    var hintBtn = document.getElementById('practiceHintBtn');
    if (hintBtn) hintBtn.addEventListener('click', showHint);

    var prevBtn = document.getElementById('practicePrevBtn');
    if (prevBtn) prevBtn.addEventListener('click', goToPrevMove);

    var nextBtn = document.getElementById('practiceNextBtn');
    if (nextBtn) nextBtn.addEventListener('click', goToNextLearnMove);

    var resetBtn = document.getElementById('practiceResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetPractice);

    var flipBtn = document.getElementById('practiceFlipBtn');
    if (flipBtn) {
      flipBtn.addEventListener('click', function () {
        ChessBoard.flip();
      });
    }

    var modeBtn = document.getElementById('practiceModeBtn');
    if (modeBtn) {
      modeBtn.addEventListener('click', function () {
        if (!currentVariation) {
          showPracticeStatus('hint', 'Select a variation to switch modes.');
          return;
        }
        var cycle = ['learn', 'practice', 'drill', 'time', 'arena', 'puzzles'];
        var nextMode = cycle[(cycle.indexOf(practiceMode) + 1 + cycle.length) % cycle.length];
        setPracticeMode(nextMode);
      });
    }

    // Review queue
    var startReviewBtn = document.getElementById('startReviewBtn');
    if (startReviewBtn) startReviewBtn.addEventListener('click', startReviewSession);

    if (!openingRouteListenerBound && typeof window !== 'undefined') {
      openingRouteListenerBound = true;
      window.addEventListener('popstate', handleOpeningRoute);
    }
    handleOpeningRoute();

    updateReviewBanner();
  }

  return {
    init: init,
    renderOpeningGallery: renderOpeningGallery,
    showOpeningDetail: showOpeningDetail,
    startPractice: startPractice,
    backToGallery: backToGallery,
    backToDetail: backToDetail,
    setPracticeMode: setPracticeMode,
    showHint: showHint,
    goToPrevMove: goToPrevMove,
    goToNextLearnMove: goToNextLearnMove,
    resetPractice: resetPractice,
    startReviewSession: startReviewSession,
    updateReviewBanner: updateReviewBanner
  };
})();

function getOpeningDefinition(opening) {
  if (!opening) return '';

  var description = (opening.description || '').trim();
  if (description && !/^ECO\s+[A-E]\d{2}\./i.test(description)) {
    return description;
  }

  var firstLine = opening.variations && opening.variations[0] ? (opening.variations[0].pgn || '') : '';
  var moveSnippet = firstLine.split(/\s+/).slice(0, 6).join(' ').trim();
  var name = opening.name || 'This opening';
  var lower = name.toLowerCase();
  var plan = 'balanced development and central control';

  if (lower.includes('gambit')) plan = 'dynamic play with an early material offer for initiative';
  else if (lower.includes('defense') || lower.includes('defence')) plan = 'a counterattacking setup that challenges the center';
  else if (lower.includes('indian')) plan = 'flexible piece play and pressure against the center from a distance';
  else if (lower.includes('sicilian')) plan = 'imbalanced play and queenside counterplay for Black';
  else if (lower.includes('english')) plan = 'flank pressure and flexible transpositions into many structures';
  else if (lower.includes('french')) plan = 'a solid pawn chain with counterplay against White\'s center';
  else if (lower.includes('caro-kann')) plan = 'solid structure, healthy development, and a reliable endgame';
  else if (lower.includes('ruy lopez')) plan = 'long-term pressure on the center and queenside structure';
  else if (lower.includes('italian')) plan = 'rapid development, active bishops, and kingside attacking chances';
  else if (lower.includes('queen\'s gambit')) plan = 'space in the center and pressure on Black\'s queenside';
  else if (lower.includes('king\'s indian')) plan = 'kingside attacking chances and dynamic pawn breaks';

  if (moveSnippet) {
    return name + ' begins with ' + moveSnippet + '. It usually aims for ' + plan + '.';
  }
  return name + ' is an opening built around ' + plan + '.';
}

export default OpeningPracticeController;
