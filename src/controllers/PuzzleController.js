import Chess from '../lib/chess';
import ChessBoard from './ChessBoard';
import SoundController from './SoundController';

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
  var currentDailyDate = '';
  var currentDailyMonth = '';
  var dailyPreviewPromise = null;
  var prefetchedPuzzle = null;
  var prefetchedSignature = '';
  var prefetchPromise = null;
  var prefetchToken = 0;
  var awaitingRetry = false;
  var hintUsedThisPuzzle = false;

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
      if (currentMode === MODE_SURVIVAL) startSurvivalRun();
      else loadNextPuzzle();
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

    syncPuzzleSoundState();
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
    if (currentMode === MODE_SURVIVAL) startSurvivalRun();
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
    clearPrefetch();
    ChessBoard.clearArrows();
    clearPuzzleMoveFeedback();
    clearHint();
    resetDelta();
    resetSurvivalState();
    renderMode();
    renderDailyControls();

    if (mode === MODE_SURVIVAL) {
      setStatus('Survival ready. One miss ends the run.', 'neutral');
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
    renderWinCount();
    renderSurvivalSummary();
    syncSummaryVisibility();
  }

  function startSurvivalRun() {
    clearAutoAdvance();
    resetSurvivalState();
    currentPuzzle = null;
    isFinished = false;
    setStatus('Survival started. One miss ends the run.', 'neutral');
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

    updatePrimaryButton();
    renderWinCount();
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
    decisionHistory = [];

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
      var quality = classifyUserMove(move, expectedUci);
      showMoveQualityFeedback(move, quality);
      awaitingRetry = true;
      showTryAgainButton(true);
      setStatus(getQualityLabel(quality) + '. That was not the puzzle move. Use Try Again.', 'error');
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
      if (hintUsedThisPuzzle) return 'excellent';
      if (currentPuzzle && currentPuzzle.themes && currentPuzzle.themes.some(function(theme) {
        return ['mate', 'mateIn2', 'mateIn3', 'sacrifice', 'discoveredAttack', 'doubleAttack'].indexOf(theme) !== -1;
      })) {
        return 'brilliant';
      }
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
        survivalResults.push({
          index: survivalWins,
          puzzleRating: currentPuzzle && currentPuzzle.rating ? currentPuzzle.rating : 0,
          elapsedMs: elapsedMs,
          delta: ratingResult.delta
        });
        renderWinCount();
        setStatus(successText + ' Next puzzle loading...', 'success');
        primePuzzlePrefetch();
        scheduleSurvivalAdvance();
      } else if (currentMode === MODE_DAILY) {
        renderWinCount();
        setStatus(successText, 'success');
      } else {
        renderWinCount();
        setStatus(successText + ' Next puzzle loading...', 'success');
        primePuzzlePrefetch();
        scheduleSolvedPuzzleAdvance();
      }
      refreshDailyHomeCard();
      return;
    }

    showHint();
    if (currentMode === MODE_SURVIVAL) {
      survivalFailed = true;
      renderWinCount();
      renderSurvivalSummary();
      syncSummaryVisibility();
      setStatus('Survival over. You cleared ' + survivalWins + ' puzzle' + (survivalWins === 1 ? '' : 's') + '.', 'error');
      updatePrimaryButton();
      return;
    }

    var failResult = applyRatingResult(false, elapsedMs);
    updateDailyEntry(false, elapsedMs, failResult);
    renderWinCount();
    setStatus('Incorrect. Your puzzle Elo went down.', 'error');
    refreshDailyHomeCard();
  }

  function applyRatingResult(success, elapsedMs) {
    if (!currentPuzzle) return { delta: 0, speedBonus: 0 };

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
    } else if (currentMode !== MODE_SURVIVAL) {
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
    panelEl.style.display = visible ? 'flex' : 'none';
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
          cells.push(renderMiniSquare(pieceToGlyph(char), rank, file));
          file += 1;
        }
      }
      rows.push(cells.join(''));
    }
    return rows.join('');
  }

  function renderMiniSquare(piece, rank, file) {
    var squareClass = ((rank + file) % 2 === 0) ? 'is-light' : 'is-dark';
    return '<div class="home-daily-square ' + squareClass + '">' + (piece || '') + '</div>';
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

  function getStoredDailyDate() {
    try {
      var saved = localStorage.getItem(DAILY_SELECTED_DATE_KEY);
      return normalizeDateKey(saved) || getTodayKey();
    } catch (e) {
      return getTodayKey();
    }
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
    preload: preloadClassicPuzzle
  };
})();

export default PuzzleController;
