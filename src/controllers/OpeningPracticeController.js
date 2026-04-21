/**
 * KnightVision - Opening Practice Controller
 * Handles the opening practice page logic: browsing, practicing moves, coach explanations
 */

import Chess from '../lib/chess';
import ChessBoard from './ChessBoard';
import SoundController from './SoundController';
import { escapeAttr, escapeHtml } from '../utils/dom.js';

const FAVORITES_KEY = 'kv_opening_favorites';
const PROGRESS_KEY = 'kv_opening_progress';
const LEARN_PROGRESS_KEY = 'kv_learn_progress_v1';

const MODE_UNLOCK = { learn: 0, practice: 0, drill: 0, time: 0, puzzles: 0, arena: 0 };

const MODE_META = {
  learn:    { icon: '📖', title: 'Learn',    desc: 'Step through the line with coach explanations.' },
  practice: { icon: '🎯', title: 'Practice', desc: 'Play the moves with guided feedback and hints.' },
  drill:    { icon: '🔥', title: 'Drill',    desc: 'Replay the line from memory, no hints.' },
  time:     { icon: '⏱',  title: 'Time',     desc: 'Race the clock through the opening.' },
  puzzles:  { icon: '🧩', title: 'Puzzles',  desc: 'Solve positions from this opening.' },
  arena:    { icon: '⚔',  title: 'Arena',    desc: 'Compete with others in this opening.' },
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
    var prefix = CLEAN_BASE_URL ? (CLEAN_BASE_URL + '/') : '';
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

  function getDiscoveredLines(opening) {
    if (!opening || !learnProgress) return 0;
    var openingId = getOpeningId(opening);
    var record = learnProgress[openingId];
    if (!record || !record.discovered) return 0;
    return Object.keys(record.discovered).length;
  }

  function markLineDiscovered(opening, variation) {
    if (!opening || !variation) return;
    var openingId = getOpeningId(opening);
    var variationId = getVariationId(opening, variation);
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

  function markVariationComplete(opening, variation) {
    if (!opening || !variation) return;
    var sourceOpening = variation.__sourceOpening || opening;
    var sourceVariation = variation.__sourceVariation || variation;
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
      return matchSearch && matchColor;
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
      return '<div class="opening-card" data-opening="' + encodeURIComponent(openingKey) + '">' +
        '<div class="opening-card-img">' +
        '<img data-opening-img="true" src="' + imageSrc + '" alt="' + op.name + '" loading="lazy" />' +
        '</div>' +
        '<div class="opening-card-body">' +
        '<div class="opening-card-topline">' +
        '<span class="opening-side-badge ' + getColorBadgeClass(practiceColor) + '">' + colorLabel + '</span>' +
        '</div>' +
        '<div class="opening-card-name">' + op.name + '</div>' +
        '<div class="opening-card-desc">' + definition + '</div>' +
        '<div class="opening-live-stats" data-opening-stats="' + encodeURIComponent(openingKey) + '"></div>' +
        '<div class="opening-card-footer">' +
        '<span class="var-count">' + varCount + ' variation' + (varCount !== 1 ? 's' : '') + ' · Play as ' + colorLabel + '</span>' +
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

  // ===== OPENING DETAIL (VARIATION LIST) =====
  function showOpeningDetail(openingKey) {
    var opening = getDisplayOpenings().find(function (o) { return getOpeningLookupKey(o) === openingKey; });
    if (!opening) return;

    currentOpening = opening;

    // Hide gallery, show detail
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'block';
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
    document.getElementById('detailVarCount').textContent = opening.variations.length + ' variation' + (opening.variations.length !== 1 ? 's' : '');

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
        startPractice(idx, mode);
      });
    });
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
    if (stepEl) stepEl.textContent = currentVariation ? ('#' + (currentMoveIndex + 1)) : '';
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

  function goToNextLearnMove() {
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
      var hintDisabled = practiceMode === 'drill' || practiceMode === 'learn';
      hintBtn.disabled = hintDisabled;
      hintBtn.classList.toggle('is-disabled', hintDisabled);
      hintBtn.title = hintDisabled ? 'Hints are disabled in this mode' : 'Show hint';
    }

    var nextBtn = document.getElementById('practiceNextBtn');
    if (nextBtn) {
      nextBtn.style.display = practiceMode === 'learn' ? '' : 'none';
    }
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
      } else if (practiceMode === 'learn') {
        practiceSideCopy.textContent = 'Step through this line as ' + getColorLabel(userColor) + ' with coach explanations.';
      } else {
        practiceSideCopy.textContent = 'Train this opening as ' + getColorLabel(userColor) + ' with guided feedback.';
      }
    }

    var pgnLine = document.getElementById('practiceMovePgn');
    if (pgnLine) {
      if (practiceMode === 'drill') {
        pgnLine.textContent = 'Drill mode hides the full line. Play the moves from memory.';
        pgnLine.classList.add('is-concealed');
      } else {
        pgnLine.textContent = currentVariation ? currentVariation.pgn : '';
        pgnLine.classList.remove('is-concealed');
      }
    }

    var movesHeader = document.getElementById('practiceMovesHeader');
    if (movesHeader) {
      movesHeader.textContent = practiceMode === 'drill' ? 'Revealed Moves' : 'Moves';
    }
  }

  function setPracticeMode(mode, options) {
    options = options || {};
    practiceMode = normalizePracticeMode(mode);
    updatePracticeModeUI();
    updatePracticeMeta();
    updatePracticeProgress();
    renderPracticeMoveList();
    updateTrainingHeader();
    updateLinesCounter();

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
    currentVariation = currentOpening.variations[variationIdx];
    if (!currentVariation) return;

    if (requestedMode !== undefined) {
      practiceMode = normalizePracticeMode(requestedMode);
    }

    isPracticing = true;
    wrongMove = false;
    currentMoveIndex = 0;
    learnMoveIndex = 0;
    sessionHints = 0;
    sessionErrors = 0;
    hideSRSPanel();

    // Parse PGN into move list
    expectedMoves = parsePGNMoves(currentVariation.pgn);

    userColor = getOpeningPracticeColor(currentOpening);

    // Initialize chess
    practiceChess = new Chess();

    // Show practice view
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'none';
    document.getElementById('openingPracticeView').style.display = 'flex';
    animateEntry('openingPracticeView');

    // Init the board — learn mode is display-only (no interaction)
    ChessBoard.init('practiceChessBoard', 'practiceBoardOverlay', onPracticeMove);
    ChessBoard.setPosition(practiceChess);
    ChessBoard.setLastMove(null, null);
    ChessBoard.setFlipped(userColor === 'b');
    if (practiceMode === 'learn') {
      ChessBoard.setOptions({ interactionColor: null, allowedMoves: [] });
    } else {
      ChessBoard.setOptions({ interactionColor: userColor, allowedMoves: [] });
    }

    // Update UI
    setPracticeMode(practiceMode, { silent: true });
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
    if (!isPracticing || !expectedMoves.length) return;

    var expectedSAN = expectedMoves[currentMoveIndex];

    if (moveResult.san === expectedSAN) {
      // Correct move!
      wrongMove = false;
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
      // Wrong move — undo it
      sessionErrors++;
      practiceChess.undo();
      ChessBoard.setPosition(practiceChess);
      ChessBoard.clearArrows();
      wrongMove = true;
      showPracticeStatus(
        'error',
        practiceMode === 'drill'
          ? 'Incorrect move. Try again from memory.'
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
      updatePracticeProgress();
      renderPracticeMoveList();
      updateCoachPanel(false);

      if (currentMoveIndex >= expectedMoves.length) {
        onVariationComplete();
      }
    }
  }

  function showHint() {
    if (!isPracticing || currentMoveIndex >= expectedMoves.length) return;
    if (practiceMode === 'drill') {
      showPracticeStatus('hint', 'Hints are disabled in Drill mode. Switch back to Practice for guided help.');
      return;
    }
    sessionHints++;
    var hint = expectedMoves[currentMoveIndex];
    showPracticeStatus('hint', 'Hint: The next move is ' + hint);

    // Show arrow on board for the hint
    var tempChess = new Chess();
    tempChess.load(practiceChess.fen());
    var moveObj = tempChess.move(hint);
    if (moveObj) {
      ChessBoard.setArrows([{ from: moveObj.from, to: moveObj.to, color: 'rgba(100, 200, 100, 0.8)' }]);
    }
  }

  function goToPrevMove() {
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

  // ===== UI UPDATES =====
  function updatePracticeProgress() {
    var total = expectedMoves.length;
    var current = currentMoveIndex;
    var pct = total > 0 ? Math.round((current / total) * 100) : 0;

    var bar = document.getElementById('practiceProgressBar');
    var text = document.getElementById('practiceProgressText');
    if (bar) bar.style.width = pct + '%';
    if (text) {
      text.textContent = current + ' / ' + total + (practiceMode === 'drill' ? ' moves recalled' : ' moves');
    }
  }

  function renderPracticeMoveList() {
    var container = document.getElementById('practiceMoveList');
    if (!container) return;

    var html = '';
    if (practiceMode === 'drill') {
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
        html = '<span class="pmove pmove-hidden">Line hidden. Start playing.</span>';
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
    isPracticing = false;
    markVariationComplete(currentOpening, currentVariation);
    showSRSPanel();
  }

  function showSRSPanel() {
    var panel = document.getElementById('srsRatingPanel');
    if (!panel) {
      showPracticeStatus('success', getCompletionMessage());
      return;
    }

    var srsId = currentOpening && currentVariation ? getVariationId(currentOpening, currentVariation) : null;
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

    panel.innerHTML =
      '<div class="srs-header">&#127775; How well did you remember it?</div>' +
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
    var srsId = getVariationId(currentOpening, currentVariation);
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
      var vid = getVariationId(currentOpening, v);
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
    currentOpening = null;
    currentVariation = null;
    clearPracticeStatus();
    document.getElementById('openingGalleryView').style.display = 'block';
    document.getElementById('openingDetailView').style.display = 'none';
    document.getElementById('openingPracticeView').style.display = 'none';
    animateEntry('openingGalleryView');
  }

  function backToDetail() {
    isPracticing = false;
    currentVariation = null;
    clearPracticeStatus();
    document.getElementById('openingGalleryView').style.display = 'none';
    document.getElementById('openingDetailView').style.display = 'block';
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

    // Back buttons
    var backGalleryBtn = document.getElementById('backToGalleryBtn');
    if (backGalleryBtn) backGalleryBtn.addEventListener('click', backToGallery);

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

    // Review queue
    var startReviewBtn = document.getElementById('startReviewBtn');
    if (startReviewBtn) startReviewBtn.addEventListener('click', startReviewSession);

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
