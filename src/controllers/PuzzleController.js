import Chess from '../lib/chess';
import ChessBoard from './ChessBoard';
import SoundController from './SoundController';
import { showToast, copyToClipboard } from '../utils/toast.js';

const PUZZLE_RATING_KEY = 'cr_puzzle_rating';
const PUZZLE_WINS_KEY = 'cr_puzzle_wins';
const DAILY_PUZZLES_KEY = 'cr_daily_puzzles';
const DAILY_SELECTED_DATE_KEY = 'cr_daily_puzzle_date';
const DEFAULT_PUZZLE_RATING = 1200;
const DAILY_MIN_PUZZLE_RATING = 1301;
const MODE_CLASSIC = 'classic';
const MODE_DAILY = 'daily';
const MODE_CUSTOM = 'custom';
const MODE_SURVIVAL = 'survival';
const PUZZLE_QUALITY_META = {
  brilliant: { label: 'Brilliant', icon: '!!', className: 'qi qi-brilliant' },
  great: { label: 'Great', icon: '!', className: 'qi qi-great' },
  best: { label: 'Best', icon: '\u2605', className: 'qi qi-best' },
  excellent: { label: 'Excellent', icon: '\u{1F44D}', className: 'qi qi-excellent' },
  good: { label: 'Good', icon: '\u2714', className: 'qi qi-good' },
  book: { label: 'Book', icon: '\u{1F4D6}', className: 'qi qi-book' },
  inaccuracy: { label: 'Inaccuracy', icon: '?!', className: 'qi qi-inaccuracy' },
  mistake: { label: 'Mistake', icon: '?', className: 'qi qi-mistake' },
  miss: { label: 'Miss', icon: '\u2716', className: 'qi qi-miss' },
  blunder: { label: 'Blunder', icon: '??', className: 'qi qi-blunder' }
};

const PuzzleController = (function() {
  var uiInitialized = false;
  var puzzleChess = null;
  var currentPuzzle = null;
  var currentMode = MODE_CLASSIC;
  var currentProgressPly = 0;
  var isLoading = false;
  var isFinished = false;
  var decisionHistory = [];
  var userColor = 'w';
  var timerStartedAt = 0;
  var timerInterval = null;
  var currentElapsedMs = 0;
  var autoAdvanceTimeout = null;
  var survivalWins = 0;
  var survivalResults = [];
  var survivalFailed = false;
  var survivalActive = false;
  var survivalLives = 3;
  var survivalAttempts = 0;
  var survivalCorrect = 0;
  var survivalSelectedMode = '3min';
  var survivalCustomMinutes = 7;
  var survivalEndsAt = 0;
  var survivalTimerInterval = null;
  var survivalBestKey = 'cr_puzzle_survival_best';
  var survivalBestTodayKey = 'cr_puzzle_survival_best_today';
  var survivalRunsKey = 'cr_puzzle_survival_runs';
  var survivalActiveSetupTab = 'play';
  var survivalLeaderboardFilter = 'all';
  var survivalRecentRatings = [];
  var currentDailyDate = '';
  var currentDailyMonth = '';
  var dailyPreviewPromise = null;
  var prefetchedPuzzle = null;
  var prefetchedSignature = '';
  var prefetchPromise = null;
  var prefetchToken = 0;
  var awaitingRetry = false;
  var hintUsedThisPuzzle = false;
  var hintedProgressPlys = {};
  var ratingPenaltyAppliedThisPuzzle = false;

  function init() {
    ChessBoard.init('puzzleChessBoard', 'puzzleBoardOverlay', onBoardMove);
    if (!uiInitialized) {
      setupUI();
      uiInitialized = true;
    }

    currentDailyDate = getTodayKey();
    currentDailyMonth = getMonthKey(currentDailyDate);
    storeDailyDate(currentDailyDate);
    ensureHomeDailyPuzzle(currentDailyDate);

    preloadClassicPuzzle();

    renderMode();
    renderRating();
    renderWinCount();
    renderTimer(0);
    renderDailyControls();
    refreshDailyHomeCard();
    syncSummaryVisibility();

    if (currentMode === MODE_DAILY) {
      loadDailyPuzzleForDate(currentDailyDate || getTodayKey());
      return;
    }

    if (!currentPuzzle) {
      if (currentMode === MODE_SURVIVAL) {
        puzzleChess = new Chess();
        userColor = 'w';
        ChessBoard.setFlipped(false);
        ChessBoard.setPosition(puzzleChess);
        ChessBoard.setLastMove(null, null);
        ChessBoard.clearArrows();
        survivalActive = false;
        setStatus('Pick a time mode and press Play to begin.', 'neutral');
        renderSurvivalPanels();
        renderSurvivalSetupStats();
      } else loadNextPuzzle();
      return;
    }

    ChessBoard.setPosition(puzzleChess);
    ChessBoard.redraw();
    if (!isFinished) startTimer();
  }

  function setupUI() {
    var nextBtn = document.getElementById('puzzleNextBtn');
    if (nextBtn) nextBtn.addEventListener('click', handlePrimaryAction);

    var hintBtn = document.getElementById('puzzleHintBtn');
    if (hintBtn) hintBtn.addEventListener('click', showHint);

    var prevBtn = document.getElementById('puzzlePrevBtn');
    if (prevBtn) prevBtn.addEventListener('click', goPrev);

    var tryAgainBtn = document.getElementById('puzzleTryAgainBtn');
    if (tryAgainBtn) tryAgainBtn.addEventListener('click', tryAgain);

    var soundToggleBtn = document.getElementById('puzzleSoundToggleBtn');
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', togglePuzzleSound);
    }

    bindModeButton('puzzleModeClassic', MODE_CLASSIC);
    bindModeButton('puzzleModeDaily', MODE_DAILY);
    bindModeButton('puzzleModeCustom', MODE_CUSTOM);
    bindModeButton('puzzleModeSurvival', MODE_SURVIVAL);
    bindCustomFilter('puzzleEloSelect');
    bindCustomFilter('puzzleDifficultySelect');
    bindCustomFilter('puzzleThemeSelect');
    bindCustomFilter('puzzleOpeningSelect');

    var prevMonthBtn = document.getElementById('puzzleDailyPrevMonthBtn');
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', function() {
      currentDailyMonth = shiftMonthKey(currentDailyMonth || getMonthKey(currentDailyDate || getTodayKey()), -1);
      renderDailyControls();
    });

    var nextMonthBtn = document.getElementById('puzzleDailyNextMonthBtn');
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', function() {
      var nextMonth = shiftMonthKey(currentDailyMonth || getMonthKey(currentDailyDate || getTodayKey()), 1);
      if (nextMonth > getMonthKey(getTodayKey())) return;
      currentDailyMonth = nextMonth;
      renderDailyControls();
    });

    var calendarGrid = document.getElementById('puzzleDailyCalendarGrid');
    if (calendarGrid) {
      calendarGrid.addEventListener('click', function(event) {
        var button = event.target.closest('.puzzle-calendar-day');
        if (!button || button.disabled) return;
        var dateKey = normalizeDateKey(button.getAttribute('data-date'));
        if (!dateKey) return;
        currentDailyDate = dateKey;
        currentDailyMonth = getMonthKey(dateKey);
        storeDailyDate(dateKey);
        renderDailyControls();
        loadDailyPuzzleForDate(dateKey);
      });
    }

    var minimizeBtn = document.getElementById('puzzleDailyMinimizeBtn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', toggleDailyCalendarMinimized);
      try {
        var stored = localStorage.getItem('puzzle.daily.calendar.minimized');
        setDailyCalendarMinimized(stored !== '0');
      } catch {
        setDailyCalendarMinimized(true);
      }
    }

    syncPuzzleSoundState();
    setupCompletionModal();
    setupDailyHero();
    setupSurvivalUI();
  }

  function setupSurvivalUI() {
    var setupCard = document.getElementById('puzzleSurvivalSetup');
    if (setupCard) {
      var modeBtns = setupCard.querySelectorAll('.puzzle-survival-mode-btn');
      modeBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var mode = btn.getAttribute('data-survival-mode');
          selectSurvivalMode(mode);
        });
      });

      var customConfirm = document.getElementById('puzzleSurvivalCustomConfirm');
      if (customConfirm) customConfirm.addEventListener('click', confirmSurvivalCustomMinutes);

      var customInput = document.getElementById('puzzleSurvivalCustomMinutes');
      if (customInput) {
        customInput.addEventListener('keydown', function(event) {
          if (event.key === 'Enter') {
            event.preventDefault();
            confirmSurvivalCustomMinutes();
          }
        });
      }

      var playBtn = document.getElementById('puzzleSurvivalPlay');
      if (playBtn) playBtn.addEventListener('click', startSurvivalRun);

      var backBtn = document.getElementById('puzzleSurvivalBack');
      if (backBtn) backBtn.addEventListener('click', function() {
        if (window.AppController && typeof window.AppController.switchToTab === 'function') {
          window.AppController.switchToTab('home');
        }
      });

      setupCard.querySelectorAll('.puzzle-survival-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
          setSurvivalSetupTab(btn.getAttribute('data-survival-tab') || 'play');
        });
      });

      setupCard.querySelectorAll('.puzzle-survival-filter').forEach(function(btn) {
        btn.addEventListener('click', function() {
          survivalLeaderboardFilter = btn.getAttribute('data-survival-filter') || 'all';
          renderSurvivalLeaderboard();
        });
      });
    }

    var quitBtn = document.getElementById('puzzleSurvivalQuit');
    if (quitBtn) quitBtn.addEventListener('click', function() { endSurvivalRun('quit'); });

    var goClose = document.getElementById('puzzleSurvivalGameOverClose');
    if (goClose) goClose.addEventListener('click', hideSurvivalGameOver);
    var goAgain = document.getElementById('puzzleSurvivalPlayAgain');
    if (goAgain) goAgain.addEventListener('click', function() {
      hideSurvivalGameOver();
      startSurvivalRun();
    });
    var goBack = document.getElementById('puzzleSurvivalBackToSetup');
    if (goBack) goBack.addEventListener('click', function() {
      hideSurvivalGameOver();
      survivalActive = false;
      setSurvivalSetupTab('play');
      renderSurvivalPanels();
    });
    var goLeaderboard = document.getElementById('puzzleSurvivalViewLeaderboard');
    if (goLeaderboard) goLeaderboard.addEventListener('click', function() {
      hideSurvivalGameOver();
      survivalActive = false;
      setSurvivalSetupTab('leaderboard');
      renderSurvivalPanels();
    });
    var goOverlay = document.getElementById('puzzleSurvivalGameOver');
    if (goOverlay) goOverlay.addEventListener('click', function(event) {
      if (event.target === goOverlay) hideSurvivalGameOver();
    });

    selectSurvivalMode(survivalSelectedMode);
    renderSurvivalSetupStats();
    renderSurvivalLeaderboard();
    setSurvivalSetupTab('play');
  }

  function setSurvivalSetupTab(tab) {
    survivalActiveSetupTab = tab === 'leaderboard' ? 'leaderboard' : 'play';
    var setupCard = document.getElementById('puzzleSurvivalSetup');
    if (!setupCard) return;
    setupCard.querySelectorAll('.puzzle-survival-tab').forEach(function(btn) {
      var active = btn.getAttribute('data-survival-tab') === survivalActiveSetupTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    var playView = document.getElementById('puzzleSurvivalPlayView');
    var leaderboardView = document.getElementById('puzzleSurvivalLeaderboardView');
    if (playView) playView.hidden = survivalActiveSetupTab !== 'play';
    if (leaderboardView) leaderboardView.hidden = survivalActiveSetupTab !== 'leaderboard';
    if (survivalActiveSetupTab === 'leaderboard') renderSurvivalLeaderboard();
  }

  function selectSurvivalMode(mode) {
    if (['3min', '5min', 'custom', 'survival'].indexOf(mode) === -1) return;
    survivalSelectedMode = mode;
    var setupCard = document.getElementById('puzzleSurvivalSetup');
    if (!setupCard) return;
    setupCard.querySelectorAll('.puzzle-survival-mode-btn').forEach(function(btn) {
      btn.setAttribute('aria-checked', btn.getAttribute('data-survival-mode') === mode ? 'true' : 'false');
    });
    var customRow = document.getElementById('puzzleSurvivalCustomRow');
    if (customRow) customRow.hidden = mode !== 'custom';
    if (mode === 'custom') updateCustomLabel();
  }

  function confirmSurvivalCustomMinutes() {
    var input = document.getElementById('puzzleSurvivalCustomMinutes');
    if (!input) return;
    var minutes = parseInt(input.value, 10);
    if (isNaN(minutes) || minutes < 1) minutes = 1;
    if (minutes > 30) minutes = 30;
    survivalCustomMinutes = minutes;
    input.value = String(minutes);
    selectSurvivalMode('custom');
    updateCustomLabel();
  }

  function updateCustomLabel() {
    var label = document.getElementById('puzzleSurvivalCustomLabel');
    if (label) label.textContent = 'Custom · ' + survivalCustomMinutes + ' min';
  }

  function getSurvivalDurationMs() {
    if (survivalSelectedMode === 'survival') return 0;
    if (survivalSelectedMode === '5min') return 5 * 60 * 1000;
    if (survivalSelectedMode === 'custom') return Math.max(1, survivalCustomMinutes) * 60 * 1000;
    return 3 * 60 * 1000;
  }

  function getSurvivalModeLabel() {
    if (survivalSelectedMode === 'survival') return 'Survival';
    if (survivalSelectedMode === '5min') return '5 min';
    if (survivalSelectedMode === 'custom') return 'Custom · ' + survivalCustomMinutes + ' min';
    return '3 min';
  }

  function isTimedSurvivalMode() {
    return survivalSelectedMode !== 'survival';
  }

  function renderSurvivalPanels() {
    var layout = document.getElementById('puzzleLayout');
    if (layout) layout.setAttribute('data-survival-active', survivalActive ? 'true' : 'false');
    var setupCard = document.getElementById('puzzleSurvivalSetup');
    var activeCard = document.getElementById('puzzleSurvivalActive');
    if (setupCard) setupCard.hidden = currentMode !== MODE_SURVIVAL || survivalActive;
    if (activeCard) activeCard.hidden = currentMode !== MODE_SURVIVAL || !survivalActive;
  }

  function renderSurvivalLives() {
    var lives = document.querySelectorAll('#puzzleSurvivalLives .puzzle-survival-life');
    lives.forEach(function(el) {
      var n = parseInt(el.getAttribute('data-life'), 10);
      el.classList.toggle('is-alive', n <= survivalLives);
      el.classList.toggle('is-lost', n > survivalLives);
    });
  }

  function renderSurvivalActiveStats() {
    var scoreEl = document.getElementById('puzzleSurvivalScore');
    var mainScoreEl = document.getElementById('puzzleSurvivalMainScore');
    var streakEl = document.getElementById('puzzleSurvivalStreak');
    var modeEl = document.getElementById('puzzleSurvivalActiveMode');
    var sideEl = document.getElementById('puzzleSurvivalSideLabel');
    var chipEl = document.getElementById('puzzleSurvivalTurnChip');
    var ratingEl = document.getElementById('puzzleSurvivalCurrentRating');
    if (scoreEl) scoreEl.textContent = String(survivalWins);
    if (mainScoreEl) mainScoreEl.textContent = String(survivalWins);
    if (streakEl) streakEl.textContent = String(survivalAttempts + 1);
    if (modeEl) modeEl.textContent = getSurvivalModeLabel();
    if (sideEl) sideEl.textContent = (userColor === 'b' ? 'Black' : 'White') + ' to Move';
    if (chipEl) chipEl.className = 'puzzle-survival-turn-chip is-' + (userColor === 'b' ? 'black' : 'white');
    if (ratingEl) ratingEl.textContent = currentPuzzle && currentPuzzle.rating ? String(currentPuzzle.rating) : '—';
    renderSurvivalTimerMode();
    renderSurvivalRatingHistory();
  }

  function renderSurvivalTimerMode() {
    var timerEl = document.getElementById('puzzleSurvivalTimer');
    var noTimerEl = document.getElementById('puzzleSurvivalNoTimer');
    var timed = isTimedSurvivalMode();
    if (timerEl) timerEl.hidden = !timed;
    if (noTimerEl) noTimerEl.hidden = timed;
  }

  function pushSurvivalRatingResult(correct) {
    if (!currentPuzzle) return;
    survivalRecentRatings.push({
      rating: currentPuzzle.rating || 0,
      correct: !!correct
    });
    survivalRecentRatings = survivalRecentRatings.slice(-6);
    renderSurvivalRatingHistory();
  }

  function renderSurvivalRatingHistory() {
    var historyEl = document.getElementById('puzzleSurvivalRatingHistory');
    if (!historyEl) return;
    if (!survivalRecentRatings.length) {
      historyEl.innerHTML = '<span class="puzzle-survival-rating-empty">Ratings appear as you play.</span>';
      return;
    }
    historyEl.innerHTML = survivalRecentRatings.map(function(entry) {
      var cls = entry.correct ? 'is-correct' : 'is-wrong';
      var icon = entry.correct ? '✓' : '×';
      return '<span class="puzzle-survival-rating-pill ' + cls + '">' +
        '<span class="puzzle-survival-rating-mark">' + icon + '</span>' +
        '<span>' + String(entry.rating || '—') + '</span>' +
      '</span>';
    }).join('');
  }

  function getSurvivalAverageRating() {
    var solved = survivalResults
      .map(function(entry) { return entry.puzzleRating || 0; })
      .filter(function(rating) { return rating > 0; });
    if (!solved.length) return 0;
    var total = solved.reduce(function(sum, rating) { return sum + rating; }, 0);
    return Math.round(total / solved.length);
  }

  function getSurvivalMaxRating() {
    var ratings = survivalResults
      .map(function(entry) { return entry.puzzleRating || 0; })
      .filter(function(rating) { return rating > 0; });
    return ratings.length ? Math.max.apply(null, ratings) : 0;
  }

  function renderSurvivalSetupStats() {
    var topEl = document.getElementById('puzzleSurvivalTopScore');
    var todayEl = document.getElementById('puzzleSurvivalBestToday');
    var top = 0;
    var today = '--';
    try {
      top = parseInt(localStorage.getItem(survivalBestKey) || '0', 10) || 0;
      var raw = localStorage.getItem(survivalBestTodayKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.date === getTodayKey()) today = String(parsed.score || 0);
      }
    } catch { /* storage unavailable */ }
    if (topEl) topEl.textContent = String(top);
    if (todayEl) todayEl.textContent = today;
    renderSurvivalLeaderboard();
  }

  function getStoredSurvivalRuns() {
    try {
      var raw = localStorage.getItem(survivalRunsKey);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSurvivalRun(reason) {
    var run = {
      username: 'You',
      score: survivalWins,
      mode: getSurvivalModeLabel(),
      modeKey: survivalSelectedMode,
      date: getTodayKey(),
      endedBy: reason || 'time',
      attempts: survivalAttempts,
      correct: survivalCorrect,
      avgRating: getSurvivalAverageRating(),
      maxRating: getSurvivalMaxRating(),
      createdAt: new Date().toISOString()
    };
    try {
      var runs = getStoredSurvivalRuns();
      runs.unshift(run);
      localStorage.setItem(survivalRunsKey, JSON.stringify(runs.slice(0, 25)));
    } catch { /* storage unavailable */ }
  }

  function persistSurvivalBestScores() {
    var top = 0;
    var newBest = false;
    try {
      var rawTop = localStorage.getItem(survivalBestKey);
      top = parseInt(rawTop || '0', 10) || 0;
      newBest = survivalWins > top;
      if (newBest || rawTop == null) {
        localStorage.setItem(survivalBestKey, String(Math.max(top, survivalWins)));
        top = Math.max(top, survivalWins);
      }
    } catch { /* storage unavailable */ }

    try {
      var todayKey = getTodayKey();
      var rawToday = localStorage.getItem(survivalBestTodayKey);
      var parsedToday = rawToday ? JSON.parse(rawToday) : null;
      var hasToday = parsedToday && parsedToday.date === todayKey;
      var prevToday = hasToday ? (parsedToday.score || 0) : 0;
      if (!hasToday || survivalWins > prevToday) {
        localStorage.setItem(survivalBestTodayKey, JSON.stringify({
          date: todayKey,
          score: Math.max(prevToday, survivalWins)
        }));
      }
    } catch { /* storage unavailable */ }

    return { top: top, newBest: newBest };
  }

  function renderSurvivalLeaderboard() {
    var listEl = document.getElementById('puzzleSurvivalLeaderboard');
    if (!listEl) return;
    var filters = document.querySelectorAll('.puzzle-survival-filter');
    filters.forEach(function(btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-survival-filter') === survivalLeaderboardFilter);
    });

    var seeded = [
      { username: 'RampBot', score: 18, mode: '3 min', modeKey: '3min', date: getTodayKey() },
      { username: 'TacticLab', score: 14, mode: '5 min', modeKey: '5min', date: getTodayKey() },
      { username: 'EndgameAce', score: 9, mode: 'Custom · 7 min', modeKey: 'custom', date: getTodayKey() },
      { username: 'Marathon', score: 22, mode: 'Survival', modeKey: 'survival', date: getTodayKey() }
    ];
    var rows = getStoredSurvivalRuns().concat(seeded)
      .filter(function(row) {
        return survivalLeaderboardFilter === 'all' || row.modeKey === survivalLeaderboardFilter;
      })
      .sort(function(a, b) {
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''));
      })
      .slice(0, 10);

    if (!rows.length) {
      listEl.innerHTML = '<div class="puzzle-summary-empty">No scores for this time mode yet.</div>';
      return;
    }

    listEl.innerHTML = rows.map(function(row, index) {
      return '<div class="puzzle-survival-leaderboard-row">' +
        '<div class="puzzle-survival-rank">#' + (index + 1) + '</div>' +
        '<div class="puzzle-survival-player">' +
          '<span class="puzzle-survival-player-name">' + escapeHtml(row.username || 'Player') + '</span>' +
          '<span class="puzzle-survival-player-meta">' + escapeHtml(row.mode || '3 min') + ' · ' + escapeHtml(formatDateLabel(row.date || getTodayKey())) + formatLeaderboardRating(row) + '</span>' +
        '</div>' +
        '<div class="puzzle-survival-leaderboard-score">' + String(row.score || 0) + '</div>' +
      '</div>';
    }).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatLeaderboardRating(row) {
    if (!row || !row.maxRating) return '';
    return ' · max ' + escapeHtml(row.maxRating);
  }

  function tickSurvivalTimer() {
    if (!isTimedSurvivalMode()) return;
    var el = document.getElementById('puzzleSurvivalTimer');
    if (!el) return;
    var remainingMs = Math.max(0, survivalEndsAt - Date.now());
    var totalSeconds = Math.ceil(remainingMs / 1000);
    var mm = Math.floor(totalSeconds / 60);
    var ss = totalSeconds % 60;
    el.textContent = mm + ':' + String(ss).padStart(2, '0');
    el.classList.toggle('is-warning', totalSeconds <= 30 && totalSeconds > 10);
    el.classList.toggle('is-danger', totalSeconds <= 10);
    if (remainingMs <= 0) endSurvivalRun('time');
  }

  function startSurvivalTimer() {
    stopSurvivalTimer();
    renderSurvivalTimerMode();
    if (!isTimedSurvivalMode()) return;
    survivalEndsAt = Date.now() + getSurvivalDurationMs();
    tickSurvivalTimer();
    survivalTimerInterval = setInterval(tickSurvivalTimer, 250);
  }

  function stopSurvivalTimer() {
    if (survivalTimerInterval) {
      clearInterval(survivalTimerInterval);
      survivalTimerInterval = null;
    }
  }

  function showSurvivalGameOver(reason) {
    var overlay = document.getElementById('puzzleSurvivalGameOver');
    if (!overlay) return;
    var heading = document.getElementById('puzzleSurvivalGameOverHeading');
    if (heading) {
      heading.textContent = reason === 'time' ? "Time's Up!"
        : reason === 'quit' ? 'Run Ended'
        : reason === 'lives' ? 'Out of Lives'
        : 'Game Over';
    }

    var bestResult = persistSurvivalBestScores();
    var top = bestResult.top;
    var newBest = bestResult.newBest;

    var scoreEl = document.getElementById('puzzleSurvivalResultScore');
    var bestEl = document.getElementById('puzzleSurvivalResultBest');
    var attemptsEl = document.getElementById('puzzleSurvivalResultAttempts');
    var correctEl = document.getElementById('puzzleSurvivalResultCorrect');
    var accuracyEl = document.getElementById('puzzleSurvivalResultAccuracy');
    var modeEl = document.getElementById('puzzleSurvivalResultMode');
    var livesLostEl = document.getElementById('puzzleSurvivalResultLivesLost');
    var avgRatingEl = document.getElementById('puzzleSurvivalResultAvgRating');
    if (scoreEl) scoreEl.textContent = String(survivalWins);
    if (bestEl) bestEl.textContent = (newBest ? 'New best! · ' : '') + 'Top score: ' + top;
    if (attemptsEl) attemptsEl.textContent = String(survivalAttempts);
    if (correctEl) correctEl.textContent = String(survivalCorrect);
    if (accuracyEl) accuracyEl.textContent = survivalAttempts > 0 ? Math.round((survivalCorrect / survivalAttempts) * 100) + '%' : '—';
    if (modeEl) modeEl.textContent = getSurvivalModeLabel();
    if (livesLostEl) livesLostEl.textContent = String(3 - survivalLives);
    if (avgRatingEl) avgRatingEl.textContent = getSurvivalAverageRating() || '—';

    overlay.hidden = false;
    requestAnimationFrame(function() { overlay.classList.add('show'); });
  }

  function hideSurvivalGameOver() {
    var overlay = document.getElementById('puzzleSurvivalGameOver');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(function() { overlay.hidden = true; }, 240);
  }

  function endSurvivalRun(reason) {
    if (!survivalActive) return;
    survivalActive = false;
    survivalFailed = true;
    stopSurvivalTimer();
    clearAutoAdvance();
    saveSurvivalRun(reason);
    persistSurvivalBestScores();
    renderSurvivalPanels();
    renderSurvivalSetupStats();
    showSurvivalGameOver(reason);
  }

  function setupDailyHero() {
    var prevBtn = document.getElementById('puzzleDailyHeroPrev');
    if (prevBtn) prevBtn.addEventListener('click', function() {
      var newDate = shiftDateKey(currentDailyDate || getTodayKey(), -1);
      openDailyPuzzle(newDate);
    });

    var nextBtn = document.getElementById('puzzleDailyHeroNext');
    if (nextBtn) nextBtn.addEventListener('click', function() {
      var newDate = shiftDateKey(currentDailyDate || getTodayKey(), 1);
      if (newDate > getTodayKey()) return;
      openDailyPuzzle(newDate);
    });

    var dateBtn = document.getElementById('puzzleDailyHeroDate');
    if (dateBtn) dateBtn.addEventListener('click', function() {
      // Open the completion modal in browse mode (no auto-show on solve)
      completionModalMonth = getMonthKey(currentDailyDate || getTodayKey());
      var overlay = document.getElementById('puzzleCompleteOverlay');
      var heading = document.getElementById('puzzleCompleteHeading');
      var msg = overlay && overlay.querySelector('.puzzle-complete-message');
      if (heading) heading.textContent = 'Pick a date';
      if (msg) msg.textContent = 'Browse past daily puzzles. Solved days are marked with a flame.';
      renderCompletionCalendar();
      if (overlay) {
        overlay.hidden = false;
        requestAnimationFrame(function() { overlay.classList.add('show'); });
      }
    });

    var backBtn = document.getElementById('puzzleDailyHeroBack');
    if (backBtn) backBtn.addEventListener('click', function() {
      if (window.AppController && typeof window.AppController.switchToTab === 'function') {
        window.AppController.switchToTab('home');
      }
    });

    var settingsBtn = document.getElementById('puzzleDailyHeroSettings');
    if (settingsBtn) settingsBtn.addEventListener('click', function() {
      if (window.AppController && typeof window.AppController.switchToTab === 'function') {
        window.AppController.switchToTab('settings');
      }
    });

    var retryBtn = document.getElementById('puzzleDailyHeroRetry');
    if (retryBtn) retryBtn.addEventListener('click', function() {
      if (currentDailyDate) loadDailyPuzzleForDate(currentDailyDate);
    });

    var analyzeBtn = document.getElementById('puzzleDailyHeroAnalyze');
    if (analyzeBtn) analyzeBtn.addEventListener('click', function() {
      if (!puzzleChess) {
        showToast('Load a puzzle first', 'error');
        return;
      }
      var fen = puzzleChess.fen();
      if (window.AppController && typeof window.AppController.loadFenPublic === 'function') {
        window.AppController.loadFenPublic(fen);
        window.AppController.switchToTab('analyze');
      } else {
        showToast('Analysis board unavailable', 'error');
      }
    });

    var shareBtn = document.getElementById('puzzleDailyHeroShare');
    if (shareBtn) shareBtn.addEventListener('click', function() {
      var date = currentDailyDate || getTodayKey();
      var url = window.location.origin + window.location.pathname + '#puzzle/daily/' + date;
      copyToClipboard(url);
      showToast('Daily puzzle link copied', 'success');
    });
  }

  var completionModalMonth = '';

  function setupCompletionModal() {
    var overlay = document.getElementById('puzzleCompleteOverlay');
    if (!overlay) return;

    var closeBtn = document.getElementById('puzzleCompleteCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', hideCompletionModal);

    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) hideCompletionModal();
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && overlay.classList.contains('show')) hideCompletionModal();
    });

    var prevMonth = document.getElementById('puzzleCompletePrevMonth');
    if (prevMonth) prevMonth.addEventListener('click', function() {
      completionModalMonth = shiftMonthKey(completionModalMonth || getMonthKey(getTodayKey()), -1);
      renderCompletionCalendar();
    });

    var nextMonth = document.getElementById('puzzleCompleteNextMonth');
    if (nextMonth) nextMonth.addEventListener('click', function() {
      var next = shiftMonthKey(completionModalMonth || getMonthKey(getTodayKey()), 1);
      if (next > getMonthKey(getTodayKey())) return;
      completionModalMonth = next;
      renderCompletionCalendar();
    });

    var grid = document.getElementById('puzzleCompleteCalGrid');
    if (grid) {
      grid.addEventListener('click', function(event) {
        var btn = event.target.closest('.puzzle-complete-cal-cell');
        if (!btn || btn.disabled) return;
        var dateKey = btn.getAttribute('data-date');
        if (!dateKey) return;
        hideCompletionModal();
        openDailyPuzzle(dateKey);
      });
    }

    var moreBtn = document.getElementById('puzzleCompleteMoreBtn');
    if (moreBtn) moreBtn.addEventListener('click', function() {
      hideCompletionModal();
      setMode(MODE_CLASSIC);
      loadNextPuzzle();
    });
  }

  function showCompletionModal() {
    var overlay = document.getElementById('puzzleCompleteOverlay');
    if (!overlay) return;
    var heading = document.getElementById('puzzleCompleteHeading');
    var msg = overlay.querySelector('.puzzle-complete-message');
    if (heading) heading.textContent = 'Good job!';
    if (msg) msg.textContent = 'Check back each day for a new puzzle! Puzzles get harder throughout the week.';
    completionModalMonth = getMonthKey(currentDailyDate || getTodayKey());
    renderCompletionCalendar();
    overlay.hidden = false;
    requestAnimationFrame(function() { overlay.classList.add('show'); });
  }

  function hideCompletionModal() {
    var overlay = document.getElementById('puzzleCompleteOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(function() { overlay.hidden = true; }, 240);
  }

  function renderCompletionCalendar() {
    var label = document.getElementById('puzzleCompleteMonthLabel');
    var grid = document.getElementById('puzzleCompleteCalGrid');
    if (!label || !grid) return;

    var monthKey = completionModalMonth || getMonthKey(getTodayKey());
    var parts = monthKey.split('-');
    var year = parseInt(parts[0], 10);
    var monthIndex = parseInt(parts[1], 10) - 1;
    var monthDate = new Date(year, monthIndex, 1);
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    label.textContent = monthNames[monthIndex] + ' ' + year;

    var firstDay = monthDate.getDay();
    var leadingBlanks = (firstDay + 6) % 7;
    var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    var todayKey = getTodayKey();
    var map = getStoredDailyMap();

    var cells = '';
    for (var i = 0; i < leadingBlanks; i++) {
      cells += '<span class="puzzle-complete-cal-cell is-empty"></span>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var dayKey = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var entry = map[dayKey];
      var classes = ['puzzle-complete-cal-cell'];
      var disabled = '';
      var fire = '';
      if (dayKey > todayKey) {
        classes.push('is-future');
        disabled = 'disabled';
      } else if (entry && entry.status === 'solved') {
        classes.push('is-solved');
        fire = '<span class="puzzle-complete-cal-fire" aria-hidden="true">🔥</span>';
      } else if (entry && entry.status === 'missed') {
        classes.push('is-missed');
      }
      if (dayKey === todayKey) classes.push('is-today');
      cells += '<button type="button" class="' + classes.join(' ') + '" data-date="' + dayKey + '" ' + disabled + '>' +
        fire + d + '</button>';
    }
    grid.innerHTML = cells;
  }

  function setDailyCalendarMinimized(minimized) {
    var card = document.getElementById('puzzleDailyCard');
    var btn = document.getElementById('puzzleDailyMinimizeBtn');
    if (!card || !btn) return;
    card.classList.toggle('is-minimized', !!minimized);
    btn.setAttribute('aria-expanded', minimized ? 'false' : 'true');
    btn.setAttribute('title', minimized ? 'Expand calendar' : 'Minimize calendar');
    var iconEl = btn.querySelector('.puzzle-daily-minimize-icon');
    var labelEl = btn.querySelector('.puzzle-daily-minimize-label');
    if (iconEl) iconEl.innerHTML = minimized ? '&#9660;' : '&#9650;';
    if (labelEl) labelEl.textContent = minimized ? 'Expand' : 'Minimize';
    try { localStorage.setItem('puzzle.daily.calendar.minimized', minimized ? '1' : '0'); } catch {
      /* localStorage unavailable */
    }
  }

  function toggleDailyCalendarMinimized() {
    var card = document.getElementById('puzzleDailyCard');
    if (!card) return;
    setDailyCalendarMinimized(!card.classList.contains('is-minimized'));
  }

  function bindCustomFilter(id) {
    var field = document.getElementById(id);
    if (!field) return;
    field.addEventListener('change', function() {
      if (currentMode !== MODE_CUSTOM) return;
      clearPrefetch();
      loadNextPuzzle();
    });
  }

  function bindModeButton(id, mode) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function() {
      activateMode(mode);
    });
  }

  function syncPuzzleSoundState() {
    var toggleBtn = document.getElementById('puzzleSoundToggleBtn');
    var icon = document.getElementById('puzzleSoundToggleIcon');
    var label = document.getElementById('puzzleSoundToggleLabel');
    var enabled = SoundController.isEnabled();
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      toggleBtn.setAttribute('title', enabled ? 'Turn puzzle sound off' : 'Turn puzzle sound on');
      toggleBtn.classList.toggle('is-muted', !enabled);
    }
    if (icon) {
      icon.textContent = enabled ? '🔊' : '🔇';
    }
    if (label) {
      label.textContent = enabled ? 'Sound On' : 'Sound Off';
    }
  }

  function togglePuzzleSound() {
    var enabled = !SoundController.isEnabled();
    SoundController.setEnabled(enabled);
    if (enabled) SoundController.playMove();
    syncPuzzleSoundState();
  }

  function activateMode(mode) {
    var changed = setMode(mode);
    if (!changed && mode === MODE_DAILY) {
      currentDailyDate = getTodayKey();
      currentDailyMonth = getMonthKey(currentDailyDate);
      loadDailyPuzzleForDate(currentDailyDate || getTodayKey());
      return;
    }
    if (!changed) return;
    if (currentMode === MODE_SURVIVAL) {
      // Show setup card; don't auto-start
      survivalActive = false;
      stopSurvivalTimer();
      renderSurvivalPanels();
      renderSurvivalSetupStats();
    }
    else if (currentMode === MODE_DAILY) {
      currentDailyDate = getTodayKey();
      currentDailyMonth = getMonthKey(currentDailyDate);
      loadDailyPuzzleForDate(currentDailyDate || getTodayKey());
    }
    else loadNextPuzzle();
  }

  function setMode(mode) {
    if ([MODE_CLASSIC, MODE_DAILY, MODE_CUSTOM, MODE_SURVIVAL].indexOf(mode) === -1) return false;
    if (!currentDailyDate) currentDailyDate = getTodayKey();
    currentDailyMonth = getMonthKey(currentDailyDate);
    if (currentMode === mode) {
      renderMode();
      renderDailyControls();
      return false;
    }

    currentMode = mode;
    clearAutoAdvance();
    stopTimer();
    currentPuzzle = null;
    puzzleChess = null;
    isFinished = false;
    awaitingRetry = false;
    decisionHistory = [];
    currentProgressPly = 0;
    hintUsedThisPuzzle = false;
    hintedProgressPlys = {};
    ratingPenaltyAppliedThisPuzzle = false;
    clearPrefetch();
    ChessBoard.clearArrows();
    clearPuzzleMoveFeedback();
    clearHint();
    resetDelta();
    resetSurvivalState();
    renderMode();
    renderDailyControls();

    if (mode === MODE_SURVIVAL) {
      survivalActive = false;
      stopSurvivalTimer();
      setStatus('Pick a time mode and press Play to begin.', 'neutral');
      renderSurvivalPanels();
      renderSurvivalSetupStats();
    } else if (mode === MODE_CUSTOM) {
      setStatus('Custom puzzles ready. Adjust difficulty and opening, then load a puzzle.', 'neutral');
    } else if (mode === MODE_DAILY) {
      ensureHomeDailyPuzzle(getTodayKey());
      setStatus('Daily puzzle ready. Pick a date from the calendar.', 'neutral');
    } else {
      setStatus('Classic puzzle mode ready.', 'neutral');
    }

    return true;
  }

  function getMode() {
    return currentMode;
  }

  function openDailyPuzzle(dateKey) {
    currentDailyDate = normalizeDateKey(dateKey) || getTodayKey();
    currentDailyMonth = getMonthKey(currentDailyDate);
    storeDailyDate(currentDailyDate);
    if (currentMode !== MODE_DAILY) setMode(MODE_DAILY);
    renderMode();
    renderDailyControls();
    if (isPuzzleTabActive()) {
      loadDailyPuzzleForDate(currentDailyDate);
    }
  }

  function isPuzzleTabActive() {
    var tabEl = document.getElementById('tab-puzzle');
    return !!(tabEl && tabEl.classList.contains('active'));
  }

  function handlePrimaryAction() {
    if (isLoading) return;
    if (currentMode === MODE_SURVIVAL) {
      startSurvivalRun();
      return;
    }
    if (currentMode === MODE_DAILY) {
      loadDailyPuzzleForDate(currentDailyDate || getTodayKey());
      return;
    }
    loadNextPuzzle();
  }

  function resetSurvivalState() {
    survivalWins = 0;
    survivalResults = [];
    survivalFailed = false;
    survivalLives = 3;
    survivalAttempts = 0;
    survivalCorrect = 0;
    survivalRecentRatings = [];
    renderWinCount();
    renderSurvivalSummary();
    renderSurvivalLives();
    renderSurvivalActiveStats();
    syncSummaryVisibility();
  }

  function startSurvivalRun() {
    clearAutoAdvance();
    resetSurvivalState();
    currentPuzzle = null;
    isFinished = false;
    survivalActive = true;
    setSurvivalSetupTab('play');
    renderSurvivalPanels();
    renderSurvivalLives();
    renderSurvivalActiveStats();
    startSurvivalTimer();
    setStatus(isTimedSurvivalMode() ? 'Run started — solve as many as you can!' : 'Endurance run started — no timer, three lives.', 'neutral');
    loadRandomPuzzle();
  }

  function getPuzzleRating() {
    try {
      var saved = parseInt(localStorage.getItem(PUZZLE_RATING_KEY), 10);
      if (!isNaN(saved)) return Math.max(400, Math.min(3200, saved));
    } catch { /* corrupt data – use default rating */ }
    return DEFAULT_PUZZLE_RATING;
  }

  function getPuzzleWins() {
    try {
      var saved = parseInt(localStorage.getItem(PUZZLE_WINS_KEY), 10);
      if (!isNaN(saved) && saved >= 0) return saved;
    } catch { /* corrupt data – use default */ }
    return 0;
  }

  function setPuzzleWins(wins) {
    var safeWins = Math.max(0, Math.round(wins || 0));
    try {
      localStorage.setItem(PUZZLE_WINS_KEY, String(safeWins));
    } catch { /* storage full */ }
  }

  function incrementPuzzleWins() {
    var wins = getPuzzleWins() + 1;
    setPuzzleWins(wins);
    return wins;
  }

  function setPuzzleRating(rating) {
    var safeRating = Math.max(400, Math.min(3200, Math.round(rating)));
    try {
      localStorage.setItem(PUZZLE_RATING_KEY, String(safeRating));
    } catch { /* storage full */ }
    renderRating();
  }

  function renderRating() {
    var ratingEl = document.getElementById('puzzleUserRating');
    if (ratingEl) ratingEl.textContent = String(getPuzzleRating());
  }

  function resetDelta() {
    var deltaEl = document.getElementById('puzzleDelta');
    if (!deltaEl) return;
    deltaEl.textContent = '+0';
    deltaEl.className = 'puzzle-rating-delta';
  }

  function renderMode() {
    toggleModeButton('puzzleModeClassic', currentMode === MODE_CLASSIC);
    toggleModeButton('puzzleModeDaily', currentMode === MODE_DAILY);
    toggleModeButton('puzzleModeCustom', currentMode === MODE_CUSTOM);
    toggleModeButton('puzzleModeSurvival', currentMode === MODE_SURVIVAL);

    var eyebrow = document.querySelector('.puzzle-eyebrow');
    if (eyebrow) {
      eyebrow.textContent = currentMode === MODE_SURVIVAL
        ? 'Puzzle Survival'
        : currentMode === MODE_CUSTOM
          ? 'Custom Puzzles'
          : currentMode === MODE_DAILY
            ? 'Daily Puzzle'
            : 'Puzzles';
    }

    var filterCard = document.getElementById('puzzleFilterCard');
    if (filterCard) filterCard.style.display = currentMode === MODE_CUSTOM ? 'block' : 'none';

    var dailyCard = document.getElementById('puzzleDailyCard');
    if (dailyCard) dailyCard.style.display = currentMode === MODE_DAILY ? 'block' : 'none';

    var layout = document.getElementById('puzzleLayout');
    if (layout) layout.setAttribute('data-puzzle-mode', currentMode);

    var dailyHero = document.getElementById('puzzleDailyHero');
    if (dailyHero) dailyHero.hidden = currentMode !== MODE_DAILY;

    updatePrimaryButton();
    renderWinCount();
    renderDailyHero();
  }

  function renderDailyHero() {
    var hero = document.getElementById('puzzleDailyHero');
    if (!hero || hero.hidden) return;
    var dateLabel = document.getElementById('puzzleDailyHeroDateLabel');
    var titleEl = document.getElementById('puzzleDailyHeroTitle');
    var prevBtn = document.getElementById('puzzleDailyHeroPrev');
    var nextBtn = document.getElementById('puzzleDailyHeroNext');
    var statusEl = document.getElementById('puzzleDailyHeroStatus');
    var statusLabel = document.getElementById('puzzleDailyHeroStatusLabel');
    var activeDate = currentDailyDate || getTodayKey();
    var todayKey = getTodayKey();

    if (dateLabel) dateLabel.textContent = formatDateLabel(activeDate);
    if (nextBtn) nextBtn.disabled = activeDate >= todayKey;
    if (prevBtn) prevBtn.disabled = false;

    if (titleEl) {
      var title = 'Daily Puzzle';
      if (currentPuzzle && currentPuzzle.themes && currentPuzzle.themes.length) {
        title = humanizeTheme(currentPuzzle.themes[0]);
      }
      titleEl.textContent = title;
    }

    if (statusEl && statusLabel) {
      var entry = getDailyEntry(activeDate);
      var status = entry && entry.status === 'solved' ? 'solved'
        : entry && entry.status === 'missed' ? 'missed'
        : 'unsolved';
      statusEl.setAttribute('data-status', status);
      statusLabel.textContent = status === 'solved' ? 'Solved'
        : status === 'missed' ? 'Attempted — keep trying'
        : 'Daily Puzzle';
    }
  }

  function humanizeTheme(theme) {
    if (!theme) return 'Daily Puzzle';
    var spaced = String(theme).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function toggleModeButton(id, active) {
    var btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', !!active);
  }

  function updatePrimaryButton() {
    var nextBtn = document.getElementById('puzzleNextBtn');
    if (!nextBtn) return;

    nextBtn.disabled = !!isLoading;
    if (currentMode === MODE_SURVIVAL) nextBtn.textContent = survivalFailed ? 'Try Again' : 'Restart Survival';
    else if (currentMode === MODE_DAILY) nextBtn.textContent = 'Load Daily Puzzle';
    else if (currentMode === MODE_CUSTOM) nextBtn.textContent = 'Next Custom Puzzle';
    else nextBtn.textContent = 'Next Puzzle';
  }

  function showTryAgainButton(show) {
    var btn = document.getElementById('puzzleTryAgainBtn');
    if (!btn) return;
    btn.style.display = show ? 'inline-flex' : 'none';
  }

  function renderWinCount() {
    var labelEl = document.getElementById('puzzleStreakLabel');
    var valueEl = document.getElementById('puzzleWinCount');
    if (!valueEl || !labelEl) return;

    if (currentMode === MODE_SURVIVAL) {
      labelEl.textContent = 'Wins';
      valueEl.textContent = String(survivalWins);
      return;
    }

    if (currentMode === MODE_DAILY) {
      var entry = getDailyEntry(currentDailyDate || getTodayKey());
      var dailyStreak = computeDailyStreak();
      if (dailyStreak > 0) {
        labelEl.textContent = 'Streak';
        valueEl.textContent = dailyStreak + 'd';
      } else {
        labelEl.textContent = 'Solved';
        valueEl.textContent = entry && entry.status === 'solved' ? 'Yes' : 'No';
      }
      return;
    }

    labelEl.textContent = 'Wins';
    valueEl.textContent = String(getPuzzleWins());
  }

  function getCustomDifficultyConfig() {
    var difficultyEl = document.getElementById('puzzleDifficultySelect');
    var difficulty = difficultyEl ? difficultyEl.value : 'hard';
    if (difficulty === 'extra-hard') return { spread: 90 };
    if (difficulty === 'hard') return { spread: 110 };
    return { spread: 140 };
  }

  function getCustomTargetRating() {
    var eloEl = document.getElementById('puzzleEloSelect');
    var rating = eloEl ? parseInt(eloEl.value, 10) : NaN;
    if (!Number.isFinite(rating)) return getPuzzleRating();
    return Math.max(400, Math.min(3200, rating));
  }

  function getCustomTheme() {
    var themeEl = document.getElementById('puzzleThemeSelect');
    return themeEl ? String(themeEl.value || '').trim() : '';
  }

  function getCustomOpening() {
    var openingEl = document.getElementById('puzzleOpeningSelect');
    return openingEl ? String(openingEl.value || '').trim() : '';
  }

  function setLoadingState(loading) {
    isLoading = loading;
    var boardShell = document.querySelector('.puzzle-board-shell');
    if (boardShell) boardShell.classList.toggle('is-loading', !!loading);
    var resultCard = document.getElementById('puzzleResultCard');
    if (resultCard) resultCard.classList.toggle('is-loading', !!loading);
    var statusEl = document.getElementById('puzzleStatus');
    if (statusEl) statusEl.classList.toggle('is-loading', !!loading);
    updatePrimaryButton();
  }

  function clearPrefetch() {
    prefetchedPuzzle = null;
    prefetchedSignature = '';
    prefetchPromise = null;
    prefetchToken += 1;
  }

  function preloadClassicPuzzle() {
    if (currentPuzzle || prefetchedPuzzle || prefetchPromise) return;
    var previousMode = currentMode;
    currentMode = MODE_CLASSIC;
    primePuzzlePrefetch();
    currentMode = previousMode;
  }

  function buildPuzzleRequestSignature(config) {
    return [
      currentMode,
      config.targetRating,
      config.spread,
      config.opening || '',
      config.theme || ''
    ].join('|');
  }

  function getRandomRequestConfig(options) {
    var opts = options || {};
    var targetRating = getPuzzleRating();
    var spread = 140;
    var opening = '';
    var theme = '';
    var loadingText = 'Loading a puzzle near your rating...';

    if (currentMode === MODE_CUSTOM) {
      var difficultyConfig = getCustomDifficultyConfig();
      targetRating = getCustomTargetRating();
      spread = difficultyConfig.spread;
      opening = getCustomOpening();
      theme = getCustomTheme();
      loadingText = 'Loading a custom puzzle...';
    } else if (currentMode === MODE_SURVIVAL) {
      var survivalBaseOffset = -400;
      var survivalRampPerPuzzle = 60;
      var assumedWins = survivalWins + (opts.survivalWinOffset || 0);
      var survivalOffset = survivalBaseOffset + (assumedWins * survivalRampPerPuzzle);
      targetRating = Math.max(400, targetRating + survivalOffset);
      spread = 100;
      loadingText = 'Loading next survival puzzle... (#' + (assumedWins + 1) + ')';
    }

    return {
      targetRating: targetRating,
      spread: spread,
      opening: opening,
      theme: theme,
      loadingText: loadingText
    };
  }

  function getExcludeIds(extraId) {
    var ids = [];
    if (currentPuzzle && currentPuzzle.id) ids.push(currentPuzzle.id);
    if (extraId) ids.push(extraId);
    return ids.filter(Boolean).join(',');
  }

  function primePuzzlePrefetch(options) {
    if (currentMode === MODE_DAILY) return;
    var config = getRandomRequestConfig(options);
    var signature = buildPuzzleRequestSignature(config);

    if (prefetchedPuzzle && prefetchedSignature === signature) return;
    if (prefetchPromise && prefetchedSignature === signature) return;

    prefetchedSignature = signature;
    var token = ++prefetchToken;
    prefetchPromise = requestPuzzle(config.targetRating, config.spread, config.opening, config.theme, getExcludeIds())
      .then(function(puzzle) {
        if (token !== prefetchToken) return puzzle;
        prefetchedPuzzle = puzzle;
        return puzzle;
      })
      .catch(function() {
        if (token !== prefetchToken) return null;
        prefetchedPuzzle = null;
        prefetchedSignature = '';
        return null;
      })
      .finally(function() {
        if (token === prefetchToken) prefetchPromise = null;
      });
  }

  function loadNextPuzzle() {
    if (currentMode === MODE_DAILY) {
      loadDailyPuzzleForDate(currentDailyDate || getTodayKey());
      return;
    }
    loadRandomPuzzle();
  }

  function loadRandomPuzzle() {
    if (isLoading) return;
    clearAutoAdvance();
    awaitingRetry = false;
    showTryAgainButton(false);
    setLoadingState(true);
    stopTimer();
    currentElapsedMs = 0;
    renderTimer(0);
    clearHint();
    ChessBoard.clearArrows();
    clearPuzzleMoveFeedback();

    var config = getRandomRequestConfig();
    var signature = buildPuzzleRequestSignature(config);
    setStatus(config.loadingText, 'neutral');

    var request = null;
    if (prefetchedPuzzle && prefetchedSignature === signature) {
      request = Promise.resolve(prefetchedPuzzle);
      prefetchedPuzzle = null;
      prefetchedSignature = '';
    } else if (prefetchPromise && prefetchedSignature === signature) {
      request = prefetchPromise.then(function(puzzle) {
        if (prefetchedPuzzle && prefetchedSignature === signature) {
          var cachedPuzzle = prefetchedPuzzle;
          prefetchedPuzzle = null;
          prefetchedSignature = '';
          return cachedPuzzle;
        }
        if (puzzle) return puzzle;
        return requestPuzzle(config.targetRating, config.spread, config.opening, config.theme, getExcludeIds());
      });
    } else {
      request = requestPuzzle(config.targetRating, config.spread, config.opening, config.theme, getExcludeIds());
    }

    request
      .then(function(puzzle) {
        applyPuzzle(puzzle);
      })
      .catch(function() {
        setStatus('Could not load a puzzle from the dataset.', 'error');
      })
      .finally(function() {
        setLoadingState(false);
      });
  }

  function loadDailyPuzzleForDate(dateKey) {
    var normalized = normalizeDateKey(dateKey) || getTodayKey();
    currentDailyDate = normalized;
    storeDailyDate(currentDailyDate);
    renderDailyControls();
    renderWinCount();
    refreshDailyHomeCard();

    var existingEntry = getDailyEntry(normalized);
    if (existingEntry && existingEntry.puzzle && isDailyPuzzleRatingAllowed(existingEntry.puzzle)) {
      stopTimer();
      currentElapsedMs = 0;
      renderTimer(0);
      applyPuzzle(existingEntry.puzzle);
      setStatus('Daily puzzle for ' + formatDateLabel(normalized) + ' loaded.', 'neutral');
      return;
    }

    if (isLoading) return;
    clearAutoAdvance();
    awaitingRetry = false;
    showTryAgainButton(false);
    setLoadingState(true);
    stopTimer();
    currentElapsedMs = 0;
    renderTimer(0);
    clearHint();
    ChessBoard.clearArrows();
    clearPuzzleMoveFeedback();
    setStatus('Loading daily puzzle for ' + formatDateLabel(normalized) + '...', 'neutral');

    var targetRating = computeDailyTargetRating(normalized);
    requestPuzzle(targetRating, 220, '', '', '', { minRating: DAILY_MIN_PUZZLE_RATING })
      .then(function(puzzle) {
        saveDailyEntry(normalized, {
          dateKey: normalized,
          createdAt: new Date().toISOString(),
          status: 'unplayed',
          attempts: 0,
          puzzle: puzzle
        });
        renderDailyControls();
        refreshDailyHomeCard();
        applyPuzzle(puzzle);
        setStatus('Daily puzzle for ' + formatDateLabel(normalized) + ' loaded.', 'neutral');
      })
      .catch(function() {
        setStatus('Could not load the daily puzzle.', 'error');
      })
      .finally(function() {
        setLoadingState(false);
      });
  }

  function requestPuzzle(targetRating, spread, opening, theme, exclude, options) {
    var opts = options || {};
    var url = '/api/puzzles/next?rating=' + encodeURIComponent(targetRating) + '&spread=' + encodeURIComponent(spread);
    if (opening) url += '&opening=' + encodeURIComponent(opening);
    if (theme) url += '&theme=' + encodeURIComponent(theme);
    if (exclude) url += '&exclude=' + encodeURIComponent(exclude);
    if (opts.minRating) url += '&minRating=' + encodeURIComponent(opts.minRating);

    return fetch(url)
      .then(function(r) {
        if (!r.ok) throw new Error('Puzzle request failed');
        return r.json();
      })
      .then(function(data) {
        if (!data || !data.ok || !data.puzzle) {
          throw new Error(data && data.error ? data.error : 'Puzzle data unavailable');
        }
        return data.puzzle;
      });
  }

  function applyPuzzle(puzzle) {
    currentPuzzle = puzzle;
    currentProgressPly = 0;
    isFinished = false;
    awaitingRetry = false;
    hintUsedThisPuzzle = false;
    hintedProgressPlys = {};
    ratingPenaltyAppliedThisPuzzle = false;
    decisionHistory = [];
    var resultCard = document.getElementById('puzzleResultCard');
    if (resultCard) resultCard.classList.remove('is-daily-solved');

    var chess = new Chess();
    chess.load(puzzle.fen);

    var setupMove = puzzle.moves && puzzle.moves[0] ? applyUciMove(chess, puzzle.moves[0]) : null;
    puzzleChess = chess;
    userColor = chess.turn();
    ChessBoard.setFlipped(userColor === 'b');
    ChessBoard.setPosition(puzzleChess);
    ChessBoard.setLastMove(setupMove ? setupMove.from : null, setupMove ? setupMove.to : null);
    syncPuzzleBoardOptions();
    ChessBoard.clearArrows();
    clearPuzzleMoveFeedback();
    showTryAgainButton(false);
    decisionHistory.push(snapshotCurrent(setupMove));

    renderPuzzleMeta();
    renderDailyControls();
    renderWinCount();
    renderSurvivalActiveStats();
    animatePuzzleEntry();
    startTimer();
    setStatus(
      currentMode === MODE_SURVIVAL
        ? 'Survival run active. Find the best move for ' + (userColor === 'w' ? 'White' : 'Black') + '.'
        : currentMode === MODE_DAILY
          ? 'Solve the daily puzzle for ' + formatDateLabel(currentDailyDate) + '.'
          : 'Find the best move for ' + (userColor === 'w' ? 'White' : 'Black') + '.',
      'neutral'
    );

    if (currentMode === MODE_CLASSIC || currentMode === MODE_CUSTOM) {
      primePuzzlePrefetch();
    }
  }

  function renderPuzzleMeta() {
    var titleEl = document.getElementById('puzzleTitle');
    if (titleEl) {
      titleEl.textContent = currentMode === MODE_SURVIVAL
        ? 'Puzzle Survival'
        : currentMode === MODE_CUSTOM
          ? 'Custom Puzzle'
          : currentMode === MODE_DAILY
            ? 'Daily Puzzle'
            : (currentPuzzle && currentPuzzle.openingTags && currentPuzzle.openingTags.length
              ? currentPuzzle.openingTags[0].replace(/_/g, ' ')
              : 'Tactical Puzzle');
    }

    var ratingEl = document.getElementById('puzzleTargetRating');
    if (ratingEl) ratingEl.textContent = currentPuzzle ? String(currentPuzzle.rating || '—') : '—';

    var metaEl = document.getElementById('puzzleMeta');
    if (!metaEl) return;

    var parts = [];
    if (currentMode === MODE_SURVIVAL) {
      parts.push('One mistake ends the run');
    } else if (currentMode === MODE_CUSTOM) {
      var selectedOpening = getCustomOpening();
      var selectedDifficulty = document.getElementById('puzzleDifficultySelect');
      parts.push(selectedDifficulty ? selectedDifficulty.options[selectedDifficulty.selectedIndex].text : 'Hard');
      parts.push(selectedOpening ? selectedOpening.replace(/_/g, ' ') : 'Any opening');
    } else if (currentMode === MODE_DAILY) {
      parts.push(formatDateLabel(currentDailyDate));
      parts.push('Stored by date');
    }

    if (currentPuzzle && currentPuzzle.themes && currentPuzzle.themes.length) {
      parts.push(currentPuzzle.themes.slice(0, 4).join(' · '));
    }

    metaEl.textContent = parts.join(' · ') || 'Solve the line to improve your puzzle Elo.';
    renderDailyHero();
  }

  function applyUciMove(chess, uci) {
    if (!uci || uci.length < 4) return null;
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || 'q'
    });
  }

  function snapshotCurrent(lastMove) {
    return {
      fen: puzzleChess.fen(),
      progressPly: currentProgressPly,
      lastMove: lastMove ? { from: lastMove.from, to: lastMove.to } : null
    };
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot) return;
    puzzleChess = new Chess();
    puzzleChess.load(snapshot.fen);
    currentProgressPly = snapshot.progressPly;
    ChessBoard.setPosition(puzzleChess);
    ChessBoard.setLastMove(snapshot.lastMove ? snapshot.lastMove.from : null, snapshot.lastMove ? snapshot.lastMove.to : null);
    syncPuzzleBoardOptions();
    ChessBoard.clearArrows();
    clearPuzzleMoveFeedback();
    clearHint();
  }

  function onBoardMove(move) {
    if (!currentPuzzle || isFinished || isLoading || awaitingRetry) return;

    var expectedUci = getExpectedUserMove();
    var playedUci = moveToUci(move);

    if (playedUci !== expectedUci) {
      if (currentMode === MODE_SURVIVAL) {
        showMoveQualityFeedback(move, 'blunder');
        finishPuzzle(false, move);
        return;
      }
      var quality = classifyUserMove(move, expectedUci);
      var penaltyResult = applyWrongMoveRatingPenalty(quality);
      showMoveQualityFeedback(move, quality);
      awaitingRetry = true;
      showTryAgainButton(true);
      var penaltyText = penaltyResult && penaltyResult.delta < 0
        ? ' Puzzle Elo ' + penaltyResult.delta + '.'
        : '';
      setStatus(getQualityLabel(quality) + '. That was not the puzzle move.' + penaltyText + ' Use Try Again.', 'error');
      return;
    }

    clearPuzzleMoveFeedback();
    showTryAgainButton(false);
    awaitingRetry = false;
    currentProgressPly += 1;
    clearHint();
    SoundController.playMove();
    showMoveQualityFeedback(move, classifyUserMove(move, expectedUci));

    if (currentProgressPly >= getSolutionMoves().length) {
      finishPuzzle(true, move);
      return;
    }

    var replyMove = playOpponentContinuation();
    if (currentProgressPly >= getSolutionMoves().length) {
      finishPuzzle(true, replyMove || move);
      return;
    }

    syncPuzzleBoardOptions();
    decisionHistory.push(snapshotCurrent(replyMove));
    setStatus('Correct. Keep calculating. Opponent move auto-played.', 'success');
  }

  function moveToUci(move) {
    if (!move) return '';
    return String(move.from || '') + String(move.to || '') + String(move.promotion || '');
  }

  function getSolutionMoves() {
    return currentPuzzle && currentPuzzle.moves ? currentPuzzle.moves.slice(1) : [];
  }

  function getExpectedUserMove() {
    return getSolutionMoves()[currentProgressPly] || '';
  }

  function syncPuzzleBoardOptions() {
    ChessBoard.setOptions({
      showArrows: true,
      lastMoveMode: 'to',
      interactionColor: userColor,
      allowedMoves: []
    });
  }

  function classifyUserMove(move, expectedUci) {
    var expectedFrom = expectedUci ? expectedUci.slice(0, 2) : '';
    var expectedTo = expectedUci ? expectedUci.slice(2, 4) : '';
    if (move && moveToUci(move) === expectedUci) {
      if (hintedProgressPlys[currentProgressPly]) return 'excellent';
      if (isBrilliantPuzzleMove(move)) return 'brilliant';
      return 'best';
    }
    if (move && move.from === expectedFrom && (move.to[0] === expectedTo[0] || move.to[1] === expectedTo[1])) {
      return 'inaccuracy';
    }
    if (move && (move.from === expectedFrom || move.to === expectedTo || move.san.indexOf('+') !== -1 || move.san.indexOf('x') !== -1)) {
      return 'mistake';
    }
    return 'blunder';
  }

  // A correct puzzle move is "brilliant" only when it's a genuine sacrifice:
  // the moved piece is more valuable than what it captures (or nothing is captured)
  // AND the destination square is attacked by the opponent. Pawn moves don't count.
  function isBrilliantPuzzleMove(move) {
    if (!move || !move.piece || move.piece === 'p') return false;
    var values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    var moverValue = values[move.piece] || 0;
    var capturedValue = move.captured ? (values[move.captured] || 0) : 0;
    if (moverValue <= capturedValue) return false;
    if (!puzzleChess) return false;
    var defenders = countAttackers(puzzleChess, move.to, oppositeColor(move.color));
    if (defenders === 0) return false;
    var supporters = countAttackers(puzzleChess, move.to, move.color) - 1;
    // Net material loss after the trade sequence (rough): if defenders outnumber supporters, it's a real sac.
    return defenders > supporters;
  }

  function oppositeColor(color) {
    return color === 'w' ? 'b' : 'w';
  }

  function countAttackers(chess, square, color) {
    if (!chess || !square || !color) return 0;
    if (typeof chess.attackers === 'function') {
      try {
        var list = chess.attackers(square, color);
        return Array.isArray(list) ? list.length : 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  function getQualityLabel(quality) {
    var meta = PUZZLE_QUALITY_META[quality] || PUZZLE_QUALITY_META.best;
    return meta.label;
  }

  function clearPuzzleMoveFeedback() {
    ChessBoard.clearMarkers();
    if (ChessBoard.clearReviewMoveQuality) ChessBoard.clearReviewMoveQuality();
  }

  function showMoveQualityFeedback(move, quality) {
    var square = move && move.to ? move.to : move;
    if (!square) return;
    var meta = PUZZLE_QUALITY_META[quality] || PUZZLE_QUALITY_META.best;
    ChessBoard.clearMarkers();
    if (ChessBoard.setReviewMoveQuality) {
      ChessBoard.setReviewMoveQuality({
        from: move && move.from ? move.from : '',
        to: square,
        square: square,
        quality: quality || 'best',
        label: meta.label
      });
      return;
    }
    ChessBoard.setMarkers([{ square: square, text: meta.icon, className: meta.className, title: meta.label }]);
  }

  function playOpponentContinuation() {
    var solutionMoves = getSolutionMoves();
    var lastReplyMove = null;

    while (currentProgressPly < solutionMoves.length && puzzleChess.turn() !== userColor) {
      lastReplyMove = applyUciMove(puzzleChess, solutionMoves[currentProgressPly]);
      currentProgressPly += 1;
    }

    ChessBoard.setPosition(puzzleChess);
    ChessBoard.setLastMove(lastReplyMove ? lastReplyMove.from : null, lastReplyMove ? lastReplyMove.to : null);
    ChessBoard.clearArrows();

    if (lastReplyMove) {
      setTimeout(function() {
        SoundController.playMove();
      }, 140);
    }

    return lastReplyMove;
  }

  function showHint() {
    if (!currentPuzzle || isFinished || isLoading || awaitingRetry) return;
    var nextMove = getExpectedUserMove();
    if (!nextMove) return;
    hintUsedThisPuzzle = true;
    hintedProgressPlys[currentProgressPly] = true;
    var previewChess = new Chess();
    var hintMove = null;
    previewChess.load(puzzleChess.fen());
    hintMove = applyUciMove(previewChess, nextMove);

    ChessBoard.setOptions({ showArrows: true });
    ChessBoard.clearArrows();
    if (hintMove) {
      ChessBoard.setArrows([{
        from: hintMove.from,
        to: hintMove.to,
        color: 'rgba(100, 200, 100, 0.82)'
      }]);
    }

    var hintEl = document.getElementById('puzzleHintText');
    if (hintEl) hintEl.textContent = 'Hint: ' + formatSanFromCurrent(nextMove);
  }

  function clearHint() {
    var hintEl = document.getElementById('puzzleHintText');
    if (hintEl) hintEl.textContent = 'Hint shows the next move with an arrow.';
  }

  function formatSanFromCurrent(uci) {
    if (!uci || !puzzleChess) return uci || '—';
    var chess = new Chess();
    chess.load(puzzleChess.fen());
    var move = applyUciMove(chess, uci);
    return move ? move.san : uci;
  }

  function goPrev() {
    if (awaitingRetry) {
      tryAgain();
      return;
    }
    if (isFinished || isLoading || decisionHistory.length <= 1) return;
    decisionHistory.pop();
    restoreSnapshot(decisionHistory[decisionHistory.length - 1]);
    SoundController.playMove();
    setStatus('Stepped back to the previous puzzle position.', 'neutral');
  }

  function tryAgain() {
    if (!currentPuzzle) return;
    awaitingRetry = false;
    showTryAgainButton(false);
    restoreSnapshot(decisionHistory[decisionHistory.length - 1]);
    setStatus('Position restored. Try again.', 'neutral');
  }

  function finishPuzzle(success, finalMove) {
    isFinished = true;
    clearAutoAdvance();
    syncPuzzleBoardOptions();
    var elapsedMs = stopTimer();

    if (success) {
      if (currentMode !== MODE_SURVIVAL) incrementPuzzleWins();
      if (finalMove) ChessBoard.setLastMove(finalMove.from, finalMove.to);
      ChessBoard.clearArrows();
      clearHint();

      var ratingResult = applyRatingResult(true, elapsedMs);
      updateDailyEntry(true, elapsedMs, ratingResult);

      var successText = 'Solved in ' + formatElapsed(elapsedMs) + '. Your puzzle Elo went up';
      if (ratingResult.speedBonus > 0) successText += ' with a +' + ratingResult.speedBonus + ' speed bonus';
      successText += '.';

      if (currentMode === MODE_SURVIVAL) {
        survivalWins += 1;
        survivalCorrect += 1;
        survivalAttempts += 1;
        pushSurvivalRatingResult(true);
        survivalResults.push({
          index: survivalWins,
          puzzleRating: currentPuzzle && currentPuzzle.rating ? currentPuzzle.rating : 0,
          elapsedMs: elapsedMs,
          delta: ratingResult.delta
        });
        renderWinCount();
        renderSurvivalActiveStats();
        setStatus(successText + ' Next puzzle loading...', 'success');
        primePuzzlePrefetch();
        scheduleSurvivalAdvance();
      } else if (currentMode === MODE_DAILY) {
        renderWinCount();
        setStatus(successText, 'success');
        var resultCard = document.getElementById('puzzleResultCard');
        if (resultCard) resultCard.classList.add('is-daily-solved');
        renderDailyHero();
        setTimeout(showCompletionModal, 650);
      } else {
        renderWinCount();
        setStatus(successText + ' Next puzzle loading...', 'success');
        primePuzzlePrefetch();
        scheduleSolvedPuzzleAdvance();
      }
      refreshDailyHomeCard();
      return;
    }

    if (currentMode === MODE_SURVIVAL) {
      survivalAttempts += 1;
      survivalLives = Math.max(0, survivalLives - 1);
      pushSurvivalRatingResult(false);
      renderSurvivalLives();
      renderSurvivalActiveStats();
      if (survivalLives <= 0) {
        endSurvivalRun('lives');
        return;
      }
      setStatus('Incorrect — ' + survivalLives + ' ' + (survivalLives === 1 ? 'life' : 'lives') + ' left. Loading next puzzle...', 'error');
      primePuzzlePrefetch();
      scheduleSurvivalAdvance();
      return;
    }

    showHint();
    var failResult = ratingPenaltyAppliedThisPuzzle
      ? { delta: 0, speedBonus: 0 }
      : applyRatingResult(false, elapsedMs);
    updateDailyEntry(false, elapsedMs, failResult);
    renderWinCount();
    setStatus('Incorrect. Your puzzle Elo went down.', 'error');
    refreshDailyHomeCard();
  }

  function applyWrongMoveRatingPenalty(quality) {
    if (ratingPenaltyAppliedThisPuzzle || !currentPuzzle) {
      return { delta: 0, speedBonus: 0 };
    }
    ratingPenaltyAppliedThisPuzzle = true;
    var severityScale = {
      inaccuracy: 0.45,
      mistake: 0.75,
      miss: 1,
      blunder: 1
    };
    var elapsedMs = timerStartedAt ? Date.now() - timerStartedAt : currentElapsedMs;
    return applyRatingResult(false, elapsedMs, {
      lossScale: severityScale[quality] || 1
    });
  }

  function getHintAdjustedSuccessDelta(delta, speedBonus) {
    if (!hintUsedThisPuzzle || delta <= 0) return { delta: delta, speedBonus: speedBonus };
    var solutionMoves = getSolutionMoves();
    var totalUserSteps = Math.max(1, Math.ceil(solutionMoves.length / 2));
    var hintedSteps = Object.keys(hintedProgressPlys).length;
    if (!hintedSteps) return { delta: delta, speedBonus: speedBonus };
    var solvedWithoutHint = Math.max(0, totalUserSteps - hintedSteps);
    var rewardScale = Math.max(0.25, solvedWithoutHint / totalUserSteps);
    var baseDelta = Math.max(0, delta - speedBonus);
    var scaledDelta = Math.max(1, Math.round(baseDelta * rewardScale));
    return { delta: scaledDelta, speedBonus: 0 };
  }

  function applyRatingResult(success, elapsedMs, options) {
    if (!currentPuzzle) return { delta: 0, speedBonus: 0 };
    var opts = options || {};

    var currentRating = getPuzzleRating();
    var puzzleRating = currentPuzzle.rating || currentRating;
    var diff = puzzleRating - currentRating;
    var delta = 0;
    var speedBonus = 0;

    // Elo-inspired expected score: how likely is the user to solve this puzzle?
    var expected = 1 / (1 + Math.pow(10, diff / 400));

    if (success) {
      // K-factor scales with rating gap: solving a harder puzzle = bigger reward
      var kWin = 16 + Math.round(Math.max(0, diff) / 80);
      kWin = Math.max(8, Math.min(32, kWin));
      delta = Math.round(kWin * (1 - expected));
      delta = Math.max(4, Math.min(28, delta));
      speedBonus = getSpeedBonus(elapsedMs);
      delta += speedBonus;
      var hintAdjusted = getHintAdjustedSuccessDelta(delta, speedBonus);
      delta = hintAdjusted.delta;
      speedBonus = hintAdjusted.speedBonus;
    } else {
      // Rating mismatch protection: if the puzzle was significantly harder than the
      // user's rating (200+ above), reduce the penalty. This follows Chess.com's
      // principle: "when a mismatch in rating might occur, we arrange it so that
      // the user cannot lose rating points."
      var kLoss = 16;
      delta = -Math.round(kLoss * expected);

      if (diff > 200) {
        // Puzzle was much harder — protect the user's rating
        delta = Math.round(delta * 0.3);
      } else if (diff > 100) {
        // Moderately harder — partial protection
        delta = Math.round(delta * 0.6);
      }

      if (opts.lossScale && opts.lossScale > 0 && opts.lossScale < 1) {
        delta = Math.round(delta * opts.lossScale);
      }

      delta = Math.max(-14, Math.min(-2, delta));
    }

    setPuzzleRating(currentRating + delta);

    var deltaEl = document.getElementById('puzzleDelta');
    if (deltaEl) {
      deltaEl.textContent = (delta > 0 ? '+' : '') + String(delta);
      deltaEl.className = 'puzzle-rating-delta' + (delta > 0 ? ' is-up' : delta < 0 ? ' is-down' : '');
    }

    return { delta: delta, speedBonus: speedBonus };
  }

  function getSpeedBonus(elapsedMs) {
    if (elapsedMs <= 4000) return 8;
    if (elapsedMs <= 7000) return 5;
    if (elapsedMs <= 12000) return 3;
    if (elapsedMs <= 20000) return 1;
    return 0;
  }

  function startTimer() {
    stopTimer();
    timerStartedAt = Date.now();
    currentElapsedMs = 0;
    renderTimer(0);
    timerInterval = setInterval(function() {
      currentElapsedMs = Date.now() - timerStartedAt;
      renderTimer(currentElapsedMs);
    }, 100);
  }

  function stopTimer() {
    if (timerStartedAt) currentElapsedMs = Date.now() - timerStartedAt;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerStartedAt = 0;
    renderTimer(currentElapsedMs);
    return currentElapsedMs;
  }

  function renderTimer(elapsedMs) {
    var timerEl = document.getElementById('puzzleTimer');
    if (timerEl) timerEl.textContent = formatElapsed(elapsedMs || 0);
  }

  function formatElapsed(elapsedMs) {
    return (Math.max(0, elapsedMs) / 1000).toFixed(1) + 's';
  }

  function scheduleSurvivalAdvance() {
    clearAutoAdvance();
    autoAdvanceTimeout = setTimeout(function() {
      autoAdvanceTimeout = null;
      loadRandomPuzzle();
    }, 900);
  }

  function scheduleSolvedPuzzleAdvance() {
    clearAutoAdvance();
    autoAdvanceTimeout = setTimeout(function() {
      autoAdvanceTimeout = null;
      if (currentMode === MODE_CLASSIC || currentMode === MODE_CUSTOM) {
        loadRandomPuzzle();
      }
    }, 350);
  }

  function clearAutoAdvance() {
    if (!autoAdvanceTimeout) return;
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }

  function renderSurvivalSummary() {
    var titleEl = document.getElementById('puzzleSummaryTitle');
    var subEl = document.getElementById('puzzleSummarySub');
    var listEl = document.getElementById('puzzleSurvivalResults');
    if (!listEl) return;

    if (titleEl) titleEl.textContent = 'Survival Over';
    if (subEl) subEl.textContent = 'You solved ' + survivalWins + ' puzzle' + (survivalWins === 1 ? '' : 's') + ' before missing.';

    if (!survivalResults.length) {
      listEl.innerHTML = '<div class="puzzle-summary-empty">No puzzle Elo checkpoints cleared in this run.</div>';
      return;
    }

    listEl.innerHTML = survivalResults.map(function(entry) {
      return '<div class="puzzle-summary-row">' +
        '<div class="puzzle-summary-main">Win ' + entry.index + ' · Puzzle Elo ' + entry.puzzleRating + '</div>' +
        '<div class="puzzle-summary-meta">' + formatElapsed(entry.elapsedMs) + ' · +' + entry.delta + ' Elo</div>' +
      '</div>';
    }).join('');
  }

  function syncSummaryVisibility() {
    var layoutEl = document.getElementById('puzzleLayout');
    var panelEl = document.getElementById('puzzleRightPanel');
    if (!layoutEl || !panelEl) return;

    var visible = currentMode === MODE_SURVIVAL && survivalFailed;
    layoutEl.classList.toggle('has-summary', visible);
    panelEl.style.display = currentMode === MODE_SURVIVAL ? 'flex' : (visible ? 'flex' : 'none');
  }

  function setStatus(message, tone) {
    var el = document.getElementById('puzzleStatus');
    if (!el) return;
    el.textContent = message;
    el.className = 'puzzle-status is-' + (tone || 'neutral');
    el.classList.toggle('is-loading', !!isLoading);
  }

  function animatePuzzleEntry() {
    var shell = document.querySelector('.puzzle-board-shell');
    var cards = [
      shell,
      document.getElementById('puzzleResultCard'),
      document.getElementById('puzzleStatus')
    ];
    cards.forEach(function(el) {
      if (!el) return;
      el.classList.remove('kv-stage-enter');
      void el.offsetWidth;
      el.classList.add('kv-stage-enter');
      setTimeout(function() {
        el.classList.remove('kv-stage-enter');
      }, 260);
    });
  }

  function renderDailyControls() {
    var monthLabelEl = document.getElementById('puzzleDailyMonthLabel');
    var calendarGridEl = document.getElementById('puzzleDailyCalendarGrid');
    var nextMonthBtn = document.getElementById('puzzleDailyNextMonthBtn');
    var summaryEl = document.getElementById('puzzleDailySummary');
    var todayKey = getTodayKey();
    var activeDate = currentDailyDate || todayKey;
    currentDailyMonth = currentDailyMonth || getMonthKey(activeDate);

    if (monthLabelEl) {
      monthLabelEl.textContent = formatMonthLabel(currentDailyMonth);
    }
    if (nextMonthBtn) {
      nextMonthBtn.disabled = currentDailyMonth >= getMonthKey(todayKey);
    }
    if (calendarGridEl) {
      calendarGridEl.innerHTML = buildDailyCalendarMarkup(currentDailyMonth, activeDate, todayKey);
    }
    if (!summaryEl) return;

    var entry = getDailyEntry(activeDate);
    if (!entry || !entry.puzzle) {
      summaryEl.textContent = formatDateLabel(activeDate) + ' · Daily puzzle will be generated automatically when you open this date.';
      return;
    }

    var status = entry.status === 'solved' ? 'Solved' : entry.status === 'missed' ? 'Attempted' : 'Unplayed';
    summaryEl.textContent = formatDateLabel(entry.dateKey || activeDate) +
      ' · Puzzle Elo ' + (entry.puzzle.rating || '—') +
      ' · ' + status +
      ' · Attempts ' + (entry.attempts || 0);
    renderDailyHero();
  }

  function refreshDailyHomeCard() {
    var dateEl = document.getElementById('homeDailyPuzzleDate');
    var statusEl = document.getElementById('homeDailyPuzzleStatus');
    var eloEl = document.getElementById('homeDailyPuzzleElo');
    var previewEl = document.getElementById('homeDailyPuzzlePreview');
    var streakEl = document.getElementById('homeDailyStreak');
    if (!dateEl || !statusEl || !eloEl || !previewEl) return;

    var todayKey = getTodayKey();
    var todayEntry = getDailyEntry(todayKey);
    dateEl.textContent = formatDateLabel(todayKey);

    // Update streak display
    var streak = computeDailyStreak();
    if (streakEl) {
      var countEl = streakEl.querySelector('.home-daily-streak-count');
      var labelEl = streakEl.querySelector('.home-daily-streak-label');
      if (countEl) countEl.textContent = String(streak);
      if (labelEl) labelEl.textContent = streak === 1 ? 'day' : streak === 0 ? 'streak' : 'days';
      if (streak > 0) {
        streakEl.classList.add('is-active');
        streakEl.classList.remove('is-zero');
      } else {
        streakEl.classList.remove('is-active');
        streakEl.classList.add('is-zero');
      }
    }

    if (!todayEntry || !todayEntry.puzzle) {
      statusEl.textContent = 'Generating today\'s puzzle preview...';
      eloEl.textContent = '—';
      previewEl.innerHTML = '<div class="home-daily-preview-empty">Today\'s puzzle preview will appear here.</div>';
      ensureHomeDailyPuzzle(todayKey);
      return;
    }

    renderDailyHomePreview(previewEl, todayEntry.puzzle);
    eloEl.textContent = String(todayEntry.puzzle.rating || '—');
    if (todayEntry.status === 'solved') {
      statusEl.textContent = 'Solved already. You can reopen it from the calendar.';
    } else if (todayEntry.status === 'missed') {
      statusEl.textContent = 'Attempted already. Reopen it to solve the same puzzle.';
    } else {
      statusEl.textContent = streak > 0
        ? 'Keep your ' + streak + '-day streak alive! Today\'s puzzle is waiting.'
        : 'Ready to solve. Today\'s puzzle is waiting.';
    }
  }

  function ensureHomeDailyPuzzle(dateKey) {
    var safeDate = normalizeDateKey(dateKey) || getTodayKey();
    var existingEntry = getDailyEntry(safeDate);
    if (existingEntry && existingEntry.puzzle && isDailyPuzzleRatingAllowed(existingEntry.puzzle)) {
      if (safeDate === getTodayKey()) refreshDailyHomeCard();
      return Promise.resolve(existingEntry);
    }
    if (dailyPreviewPromise) return dailyPreviewPromise;

    dailyPreviewPromise = requestPuzzle(computeDailyTargetRating(safeDate), 220, '', '', '', { minRating: DAILY_MIN_PUZZLE_RATING })
      .then(function(puzzle) {
        var entry = {
          dateKey: safeDate,
          createdAt: new Date().toISOString(),
          status: 'unplayed',
          attempts: 0,
          puzzle: puzzle
        };
        saveDailyEntry(safeDate, entry);
        if (safeDate === getTodayKey()) refreshDailyHomeCard();
        return entry;
      })
      .catch(function() {
        var statusEl = document.getElementById('homeDailyPuzzleStatus');
        if (statusEl && safeDate === getTodayKey()) {
          statusEl.textContent = 'Could not load today\'s puzzle preview.';
        }
        return null;
      })
      .finally(function() {
        dailyPreviewPromise = null;
      });

    return dailyPreviewPromise;
  }

  function updateDailyEntry(success, elapsedMs, ratingResult) {
    if (currentMode !== MODE_DAILY || !currentPuzzle) return;

    var dateKey = currentDailyDate || getTodayKey();
    var entry = getDailyEntry(dateKey) || {
      dateKey: dateKey,
      createdAt: new Date().toISOString(),
      status: 'unplayed',
      attempts: 0,
      puzzle: currentPuzzle
    };

    entry.puzzle = currentPuzzle;
    entry.attempts = (entry.attempts || 0) + 1;
    entry.lastPlayedAt = new Date().toISOString();
    entry.lastElapsedMs = elapsedMs;
    entry.lastDelta = ratingResult ? ratingResult.delta : 0;

    if (success) {
      entry.status = 'solved';
      entry.solvedAt = new Date().toISOString();
      if (!entry.bestElapsedMs || elapsedMs < entry.bestElapsedMs) entry.bestElapsedMs = elapsedMs;
    } else {
      entry.status = 'missed';
    }

    saveDailyEntry(dateKey, entry);
    renderDailyControls();
  }

  function renderDailyHomePreview(container, puzzle) {
    if (!container || !puzzle || !puzzle.fen) return;
    var previewFen = getPreviewFenForPuzzle(puzzle);
    var boardMarkup = buildMiniBoardMarkup(previewFen);
    container.innerHTML =
      '<div class="home-daily-preview-board">' + boardMarkup + '</div>' +
      '<div class="home-daily-preview-elo">Puzzle Elo ' + (puzzle.rating || '—') + '</div>';
  }

  function getPreviewFenForPuzzle(puzzle) {
    if (!puzzle || !puzzle.fen) return '';
    var chess = new Chess();
    chess.load(puzzle.fen);
    if (puzzle.moves && puzzle.moves[0]) {
      applyUciMove(chess, puzzle.moves[0]);
    }
    return chess.fen();
  }

  function buildMiniBoardMarkup(fen) {
    var boardRows = String(fen || '').split(' ')[0].split('/');
    var rows = [];
    for (var rank = 0; rank < 8; rank++) {
      var cells = [];
      var fenRow = boardRows[rank] || '8';
      var file = 0;
      for (var i = 0; i < fenRow.length; i++) {
        var char = fenRow[i];
        if (/\d/.test(char)) {
          var emptyCount = parseInt(char, 10);
          for (var k = 0; k < emptyCount; k++) {
            cells.push(renderMiniSquare('', rank, file));
            file += 1;
          }
        } else {
          cells.push(renderMiniSquare(pieceToGlyph(char), rank, file, char));
          file += 1;
        }
      }
      rows.push(cells.join(''));
    }
    return rows.join('');
  }

  function renderMiniSquare(piece, rank, file, originalChar) {
    var squareClass = ((rank + file) % 2 === 0) ? 'is-light' : 'is-dark';
    var rankLabel = file === 0 ? '<span class="home-daily-square-rank">' + (8 - rank) + '</span>' : '';
    var fileLabel = rank === 7 ? '<span class="home-daily-square-file">' + String.fromCharCode(97 + file) + '</span>' : '';
    var pieceMarkup = '';
    if (piece) {
      var colorClass = originalChar && originalChar === originalChar.toUpperCase() ? 'is-white' : 'is-black';
      pieceMarkup = '<span class="home-daily-square-piece ' + colorClass + '">' + piece + '</span>';
    }
    return '<div class="home-daily-square ' + squareClass + '">' + rankLabel + fileLabel + pieceMarkup + '</div>';
  }

  function pieceToGlyph(piece) {
    var glyphs = {
      p: '♟',
      r: '♜',
      n: '♞',
      b: '♝',
      q: '♛',
      k: '♚',
      P: '♙',
      R: '♖',
      N: '♘',
      B: '♗',
      Q: '♕',
      K: '♔'
    };
    return glyphs[piece] || '';
  }

  function getStoredDailyMap() {
    try {
      var saved = JSON.parse(localStorage.getItem(DAILY_PUZZLES_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) {
      return {};
    }
  }

  function saveStoredDailyMap(map) {
    try {
      localStorage.setItem(DAILY_PUZZLES_KEY, JSON.stringify(map));
    } catch { /* storage full */ }
  }

  function getDailyEntry(dateKey) {
    var map = getStoredDailyMap();
    var entry = map[normalizeDateKey(dateKey) || ''] || null;
    if (entry && entry.puzzle && !isDailyPuzzleRatingAllowed(entry.puzzle)) return null;
    return entry;
  }

  function saveDailyEntry(dateKey, entry) {
    var safeDate = normalizeDateKey(dateKey);
    if (!safeDate) return;
    var map = getStoredDailyMap();
    map[safeDate] = Object.assign({}, entry, { dateKey: safeDate });
    saveStoredDailyMap(map);
  }

  function isDailyPuzzleRatingAllowed(puzzle) {
    return !!(puzzle && parseInt(puzzle.rating, 10) >= DAILY_MIN_PUZZLE_RATING);
  }

  function storeDailyDate(dateKey) {
    var safeDate = normalizeDateKey(dateKey) || getTodayKey();
    try {
      localStorage.setItem(DAILY_SELECTED_DATE_KEY, safeDate);
    } catch { /* storage full */ }
  }

  function normalizeDateKey(value) {
    if (!value) return '';
    var str = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : '';
  }

  function getTodayKey() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatDateLabel(dateKey) {
    var safeDate = normalizeDateKey(dateKey) || getTodayKey();
    var parts = safeDate.split('-');
    var date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getMonthKey(dateKey) {
    var safeDate = normalizeDateKey(dateKey) || getTodayKey();
    return safeDate.slice(0, 7);
  }

  function shiftDateKey(dateKey, offsetDays) {
    var safeDate = normalizeDateKey(dateKey) || getTodayKey();
    var parts = safeDate.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shiftMonthKey(monthKey, offset) {
    var safeMonth = /^\d{4}-\d{2}$/.test(String(monthKey || '')) ? String(monthKey) : getMonthKey(getTodayKey());
    var parts = safeMonth.split('-');
    var date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1 + offset, 1);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function formatMonthLabel(monthKey) {
    var safeMonth = /^\d{4}-\d{2}$/.test(String(monthKey || '')) ? String(monthKey) : getMonthKey(getTodayKey());
    var parts = safeMonth.split('-');
    var date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });
  }

  function buildDailyCalendarMarkup(monthKey, selectedDate, todayKey) {
    var safeMonth = /^\d{4}-\d{2}$/.test(String(monthKey || '')) ? String(monthKey) : getMonthKey(getTodayKey());
    var parts = safeMonth.split('-');
    var year = parseInt(parts[0], 10);
    var monthIndex = parseInt(parts[1], 10) - 1;
    var firstDay = new Date(year, monthIndex, 1);
    var startWeekday = firstDay.getDay();
    var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    var cells = [];

    for (var i = 0; i < startWeekday; i++) {
      cells.push('<span class="puzzle-calendar-blank"></span>');
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateKey = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var entry = getDailyEntry(dateKey);
      var classes = ['puzzle-calendar-day'];
      if (dateKey === selectedDate) classes.push('is-selected');
      if (dateKey === todayKey) classes.push('is-today');
      if (entry && entry.status === 'solved') classes.push('is-solved');
      else if (entry && entry.status === 'missed') classes.push('is-attempted');
      else if (entry && entry.puzzle) classes.push('is-ready');
      var disabled = dateKey > todayKey;
      cells.push(
        '<button type="button" class="' + classes.join(' ') + '" data-date="' + dateKey + '"' + (disabled ? ' disabled' : '') + '>' +
          '<span class="puzzle-calendar-day-number">' + day + '</span>' +
        '</button>'
      );
    }

    return cells.join('');
  }

  function computeDailyStreak() {
    var map = getStoredDailyMap();
    var streak = 0;
    var date = new Date();

    // Check today first. If today isn't solved yet, that's ok —
    // the streak still counts from yesterday backwards so we
    // don't break it mid-day.
    var todayKey = getTodayKey();
    var todayEntry = map[todayKey];
    var todaySolved = todayEntry && todayEntry.status === 'solved';

    if (todaySolved) {
      streak = 1;
    }

    // Walk backwards from yesterday, counting consecutive solved days
    date.setDate(date.getDate() - 1);
    for (var i = 0; i < 365; i++) {
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var key = year + '-' + month + '-' + day;
      var entry = map[key];
      if (entry && entry.status === 'solved') {
        streak++;
        date.setDate(date.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  function computeDailyTargetRating(dateKey) {
    var safeDate = normalizeDateKey(dateKey) || getTodayKey();
    var seed = 0;
    for (var i = 0; i < safeDate.length; i++) seed = ((seed * 31) + safeDate.charCodeAt(i)) % 2147483647;
    return DAILY_MIN_PUZZLE_RATING + 220 + (seed % (2400 - DAILY_MIN_PUZZLE_RATING));
  }

  return {
    init: init,
    loadNextPuzzle: loadNextPuzzle,
    setMode: setMode,
    getMode: getMode,
    openDailyPuzzle: openDailyPuzzle,
    refreshDailyHomeCard: refreshDailyHomeCard,
    preload: preloadClassicPuzzle,
    computeDailyStreak: computeDailyStreak
  };
})();

export default PuzzleController;
