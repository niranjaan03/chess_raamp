import React, { useEffect } from 'react';
import AppController, { HomeController } from './controllers/AppController';
import PuzzleController from './controllers/PuzzleController';

function showBootError(error) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('bootErrorOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'bootErrorOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '99999';
  overlay.style.background = '#090909';
  overlay.style.color = '#f6e7bf';
  overlay.style.padding = '24px';
  overlay.style.fontFamily = '"IBM Plex Mono", monospace';
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.style.overflow = 'auto';
  overlay.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:12px;">Startup error</div>' +
    '<div style="opacity:.86;margin-bottom:16px;">The app hit an exception during boot.</div>' +
    '<div>' + String((error && error.stack) || error || 'Unknown error') + '</div>';
  document.body.appendChild(overlay);
}

function PlayerStrip({ side, avatar, nameId, ratingId, clockId, defaultName }) {
  return (
    <div className={`player-info review-player-strip ${side}`}>
      <div className={`player-avatar ${side}`}>{avatar}</div>
      <div className="player-details">
        <span className="player-side-label">{side}</span>
        <span className="player-name" id={nameId}>{defaultName}</span>
        <span className="player-rating" id={ratingId}>—</span>
      </div>
      <div className="player-clock" id={clockId}>--:--</div>
    </div>
  );
}

function MoveNavigationControls({ compact = false }) {
  return (
    <div className={`nav-controls review-nav-controls${compact ? ' is-compact' : ''}`}>
      <button type="button" className="nav-btn" id="btnFirst" aria-label="First move">&#8676;</button>
      <button type="button" className="nav-btn" id="btnPrev" aria-label="Previous move">&#8592;</button>
      <button type="button" className="nav-btn" id="btnPlay" aria-label="Play game">&#9654;</button>
      <button type="button" className="nav-btn" id="btnNext" aria-label="Next move">&#8594;</button>
      <button type="button" className="nav-btn" id="btnLast" aria-label="Last move">&#8677;</button>
      <button type="button" className="nav-btn flip-btn" id="btnFlip" aria-label="Flip board">&#8645;</button>
    </div>
  );
}

function ReviewTabs() {
  return (
    <div className="gr-tabs review-tabs" role="tablist" aria-label="Game review views">
      <button type="button" className="gr-tab active" id="grReportTab" data-review-tab="report">Report</button>
      <button type="button" className="gr-tab" id="grAnalyzeTab" data-review-tab="analyze">Analysis</button>
      <button type="button" className="gr-tab" id="grSettingsTab" data-review-tab="settings">Settings</button>
    </div>
  );
}

function AccuracySummary() {
  return (
    <section className="review-card review-summary-card" aria-label="Accuracy summary">
      <div className="review-card-head">
        <div>
          <div className="gr-section-title">Game Report</div>
          <div className="review-card-title">Accuracy & estimated ELO</div>
        </div>
        <span className="review-vs-pill">VS</span>
      </div>
      <div className="gr-players-row review-summary-grid">
        <div className="gr-player-card review-player-card" id="grWhiteCard">
          <div className="gr-player-card-top">
            <div className="gr-player-avatar">♙</div>
            <div className="gr-player-meta">
              <span className="gr-player-role">White</span>
              <span className="gr-player-name" id="grWhiteName">White</span>
              <span className="gr-player-rating" id="grWhiteElo">—</span>
            </div>
          </div>
          <div className="review-metric-row">
            <span className="gr-acc-label">Accuracy</span>
            <span className="gr-acc-value" id="grWhiteAcc">--</span>
          </div>
          <div className="review-metric-row">
            <span className="gr-acc-label">Estimated ELO</span>
            <span className="gr-val gr-rating-box" id="grWhiteGameRating">?</span>
          </div>
        </div>
        <div className="gr-player-card review-player-card" id="grBlackCard">
          <div className="gr-player-card-top">
            <div className="gr-player-avatar">♟</div>
            <div className="gr-player-meta">
              <span className="gr-player-role">Black</span>
              <span className="gr-player-name" id="grBlackName">Black</span>
              <span className="gr-player-rating" id="grBlackElo">—</span>
            </div>
          </div>
          <div className="review-metric-row">
            <span className="gr-acc-label">Accuracy</span>
            <span className="gr-acc-value" id="grBlackAcc">--</span>
          </div>
          <div className="review-metric-row">
            <span className="gr-acc-label">Estimated ELO</span>
            <span className="gr-val gr-rating-box" id="grBlackGameRating">?</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function EvalGraphCard() {
  return (
    <section className="review-card eval-graph-card">
      <div className="review-card-head">
        <div>
          <div className="gr-section-title">Evaluation Graph</div>
          <div className="review-card-title">Game trend</div>
        </div>
        <div className="gr-cpl-legend">
          <span className="gr-legend-item"><span className="gr-legend-dot accurate"></span>Good</span>
          <span className="gr-legend-item"><span className="gr-legend-dot mistake"></span>Mistake</span>
          <span className="gr-legend-item"><span className="gr-legend-dot blunder"></span>Blunder</span>
        </div>
      </div>
      <div className="gr-graph-wrap gr-eval-graph-wrap">
        <canvas id="evalGraph" width="640" height="160"></canvas>
      </div>
    </section>
  );
}

function MoveQualityBreakdown() {
  return (
    <section className="review-card review-quality-card">
      <div className="review-card-head">
        <div>
          <div className="gr-section-title">Move Quality</div>
          <div className="review-card-title">Good vs bad decisions</div>
        </div>
      </div>
      <div className="gr-classify-table" id="grClassifyTable"></div>
    </section>
  );
}

function CriticalMomentsPanel() {
  return (
    <section className="review-card critical-card">
      <div className="review-card-head">
        <div>
          <div className="gr-section-title danger">Critical Analysis</div>
          <div className="review-card-title">Learn from your mistakes</div>
        </div>
      </div>
      <div id="grCriticalMoments" className="critical-moments-list">
        <div className="gr-analysis-empty">Run full analysis to see critical positions.</div>
      </div>
    </section>
  );
}

function AnalysisPanel() {
  return (
    <div className="gr-tab-panel gr-analyze-panel" id="grAnalyzePanel" style={{ display: 'none' }}>
      <section className="review-card current-engine-card">
        <div className="review-card-head">
          <div>
            <div className="gr-section-title">Current Position</div>
            <div className="review-card-title">Engine read</div>
          </div>
          <div className="eval-score" id="evalScore">+0.00</div>
        </div>
        <div className="eval-section">
          <div className="eval-body">
            <div className="eval-meta">
              <span className="eval-meta-label">Best Move</span>
              <span className="eval-meta-move" id="bestMoveDisplay">—</span>
            </div>
          </div>
          <div className="eval-footer">
            Depth <span id="evalDepth">0</span> · Nodes <span id="evalNodes">0</span>
          </div>
        </div>
      </section>

      <section className="review-card">
        <div className="lines-header">
          <span>Engine Lines</span>
          <span className="lines-summary" id="engineLinesSummary">All available</span>
        </div>
        <div className="lines-container" id="linesContainer">
          <div className="line-item loading">Waiting for Stockfish...</div>
        </div>
      </section>

      <section className="review-card">
        <div className="move-quality-banner" id="moveQualityBanner">
          <div className="mq-label">Selected Move</div>
          <div className="mq-pill">
            <span className="qi" id="moveQualityIcon">?</span>
            <div className="mq-details">
              <div className="mq-grade" id="moveQualityGrade">Awaiting analysis</div>
              <div className="mq-desc" id="moveQualityDesc">
                Run a full game review to see brilliance, inaccuracies, and more for each move.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="gr-coach-bar review-card" id="grCoachTip">
        <div className="gr-coach-avatar" aria-hidden="true">
          <div className="gr-coach-face">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%'}}>
              <circle cx="32" cy="32" r="30" fill="#1a1a2e"/>
              <circle cx="32" cy="36" r="18" fill="#e8c170"/>
              <ellipse cx="32" cy="42" rx="10" ry="7" fill="#d4a555"/>
              <rect x="13" y="28" rx="3" width="38" height="8" fill="#111"/>
              <rect x="15" y="29" rx="2" width="14" height="6" fill="#333" opacity="0.7"/>
              <rect x="35" y="29" rx="2" width="14" height="6" fill="#333" opacity="0.7"/>
              <line x1="29" y1="32" x2="35" y2="32" stroke="#555" strokeWidth="1.5"/>
              <path d="M26 44 Q32 50 38 44" stroke="#1a1a2e" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              <path d="M10 24 Q32 10 54 24 L52 28 Q32 16 12 28 Z" fill="#2d2d5e"/>
              <circle cx="48" cy="26" r="2" fill="#f7c948"/>
            </svg>
          </div>
          <span className="gr-coach-badge">Coach</span>
        </div>
        <div className="gr-coach-copy">
          <div className="gr-coach-name" id="grCoachTitle">Coach Ramp</div>
          <div className="gr-coach-text" id="grCoachText">
            Run a full analysis to unlock personalized move-by-move coaching.
          </div>
        </div>
      </section>

      <section className="review-card gr-live-section">
        <div className="gr-live-header">
          <span className="gr-section-title">Live Engine Analysis</span>
          <span className="gr-live-badge">Live</span>
        </div>
        <div className="gr-live-candidates" id="grLiveCandidates">
          <div className="gr-analysis-empty">Start analyzing a position to see engine candidates.</div>
        </div>
      </section>

      <section className="review-card">
        <div className="gr-analysis-head">
          <div>
            <div className="gr-section-title">Review Candidates</div>
            <div className="gr-analysis-position" id="grAnalysisPositionLabel">
              Select a move after running full analysis.
            </div>
          </div>
        </div>
        <div className="gr-analysis-list" id="grAnalysisCandidates">
          <div className="gr-analysis-empty">Run full analysis to see better moves in this position.</div>
        </div>
      </section>

      <section className="review-card phase-review-card">
        <div className="review-card-head">
          <div>
            <div className="gr-section-title">Phase Review</div>
            <div className="review-card-title">Opening, middlegame, endgame</div>
          </div>
        </div>
        <div className="phase-review-grid">
          <div className="phase-review-row">
            <span>Opening</span>
            <div className="gr-val" id="grPhaseOpW"><span className="gr-phase-icon">--</span></div>
            <div className="gr-val" id="grPhaseOpB"><span className="gr-phase-icon">--</span></div>
          </div>
          <div className="phase-review-row">
            <span>Middlegame</span>
            <div className="gr-val" id="grPhaseMidW"><span className="gr-phase-icon">--</span></div>
            <div className="gr-val" id="grPhaseMidB"><span className="gr-phase-icon">--</span></div>
          </div>
          <div className="phase-review-row">
            <span>Endgame</span>
            <div className="gr-val" id="grPhaseEndW"><span className="gr-phase-icon">--</span></div>
            <div className="gr-val" id="grPhaseEndB"><span className="gr-phase-icon">--</span></div>
          </div>
        </div>
      </section>

      <section className="review-card gr-cpl-section">
        <div className="gr-cpl-header">
          <span className="gr-section-title" style={{margin:0}}>Centipawn Loss</span>
          <div className="gr-cpl-legend">
            <span className="gr-legend-item"><span className="gr-legend-dot accurate"></span>Accurate</span>
            <span className="gr-legend-item"><span className="gr-legend-dot inaccuracy"></span>Inaccuracy</span>
            <span className="gr-legend-item"><span className="gr-legend-dot mistake"></span>Mistake</span>
            <span className="gr-legend-item"><span className="gr-legend-dot blunder"></span>Blunder</span>
          </div>
        </div>
        <div className="gr-cpl-chart-wrap" id="cplChartWrap">
          <canvas id="cplChart" height="130"></canvas>
          <div className="cpl-tooltip" id="cplTooltip" style={{display:'none'}}></div>
        </div>
      </section>

      <section className="moves-section review-card">
        <div className="moves-header">
          <span>Moves &amp; Notation</span>
        </div>
        <div className="moves-list" id="movesList"></div>
      </section>
    </div>
  );
}

function ReviewSettingsPanel() {
  return (
    <div className="gr-tab-panel gr-settings-panel" id="grSettingsPanel" style={{ display: 'none' }}>
      <section className="review-card review-settings-card">
        <div className="review-card-head">
          <div>
            <div className="gr-section-title">Board</div>
            <div className="review-card-title">Review preferences</div>
          </div>
        </div>
        <div className="review-settings-grid">
          <button type="button" className="review-setting-action" id="reviewFlipBoard">
            <span>&#8645;</span>
            <strong>Flip board</strong>
          </button>
          <label className="review-setting-row">
            <span>Show engine arrows</span>
            <input type="checkbox" id="reviewShowArrows" defaultChecked />
          </label>
          <label className="review-setting-row">
            <span>Highlight last move</span>
            <input type="checkbox" id="reviewHighlightLast" defaultChecked />
          </label>
          <label className="review-setting-row">
            <span>Show board coordinates</span>
            <input type="checkbox" id="reviewShowCoords" defaultChecked />
          </label>
        </div>
      </section>

      <section className="review-card review-settings-card">
        <div className="review-card-head">
          <div>
            <div className="gr-section-title">Appearance</div>
            <div className="review-card-title">Board and pieces</div>
          </div>
        </div>
        <div className="review-settings-grid two-col">
          <label className="review-setting-field">
            <span>Board theme</span>
            <select id="reviewBoardTheme" className="dark-select" defaultValue="blue">
              <option value="green">Classic Green</option>
              <option value="brown">Brown Wood</option>
              <option value="blue">Blue Ice</option>
              <option value="purple">Purple Dark</option>
              <option value="red">Crimson</option>
            </select>
          </label>
          <label className="review-setting-field">
            <span>Piece style</span>
            <select id="reviewPieceStyle" className="dark-select" defaultValue="classic">
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="glass">Glass</option>
              <option value="minimal">Minimal</option>
              <option value="outline">Outline</option>
              <option value="bold">Bold</option>
            </select>
          </label>
        </div>
      </section>

      <section className="review-card review-settings-card">
        <div className="review-card-head">
          <div>
            <div className="gr-section-title">Playback</div>
            <div className="review-card-title">Flow and sound</div>
          </div>
        </div>
        <div className="review-settings-grid">
          <label className="review-setting-field">
            <span>Auto-play speed <strong id="reviewAutoplaySpeedVal">1.2s</strong></span>
            <input type="range" min="500" max="2500" step="100" defaultValue="1200" id="reviewAutoplaySpeed" className="dark-slider" />
          </label>
          <label className="review-setting-row">
            <span>Move sound</span>
            <input type="checkbox" id="reviewMoveSound" defaultChecked />
          </label>
        </div>
      </section>
    </div>
  );
}

function GameReviewLayout() {
  return (
    <div className="tab-content" id="tab-analyze">
      <div className="analyze-shell game-review-shell" id="analyzeShell">
        <div className="analyze-layout game-review-layout" id="analyzeContent">
          <section className="board-panel review-board-panel">
            <PlayerStrip side="black" avatar="♜" nameId="blackName" ratingId="blackRating" clockId="blackClock" defaultName="Black Player" />

            <div className="review-board-stage">
              <div className="review-eval-rail" aria-label="Evaluation">
                <span className="review-eval-side">White</span>
                <div className="eval-bar review-eval-bar">
                  <div className="eval-fill eval-fill-white white-fill" id="evalFillWhite"></div>
                  <div className="eval-fill eval-fill-black black-fill" id="evalFillBlack"></div>
                </div>
                <span className="review-eval-side">Black</span>
              </div>

              <div className="review-board-stack">
                <div className="board-wrapper">
                  <div className="board-main">
                    <canvas id="chessBoard" width="640" height="640"></canvas>
                    <div id="boardOverlay" className="board-overlay"></div>
                  </div>
                  <div className="board-coordinates" id="rankCoords"></div>
                </div>
                <div className="board-coordinates coords-file" id="fileCoords"></div>
              </div>
            </div>

            <PlayerStrip side="white" avatar="♖" nameId="whiteName" ratingId="whiteRating" clockId="whiteClock" defaultName="White Player" />

            <div className="opening-info review-opening-info" id="openingInfo">
              <div className="opening-live-row">
                <span className="opening-live-dot" id="openingLiveDot"></span>
                <span className="opening-name" id="openingName">Waiting for moves…</span>
                <span className="opening-eco-badge" id="openingEco"></span>
              </div>
            </div>
          </section>

          <aside className="analysis-panel review-side-panel">
            <div className="game-review-panel is-empty" id="gameReviewPanel">
              <div className="gr-header review-panel-header">
                <div>
                  <span className="gr-title">Game Review</span>
                  <span className="review-panel-subtitle">Report, engine lines, and review settings</span>
                </div>
                <div className="moves-actions review-panel-actions">
                  <button type="button" className="btn-sm" id="copyPGN">Copy PGN</button>
                  <button type="button" className="btn-sm review-primary-action" id="analyzeFullGame">Full Analysis</button>
                </div>
              </div>

              <ReviewTabs />

              <div className="gr-tab-panel active" id="grReportPanel">
                <AccuracySummary />
                <EvalGraphCard />
                <MoveQualityBreakdown />
                <CriticalMomentsPanel />
              </div>

              <AnalysisPanel />
              <ReviewSettingsPanel />

              <div className="review-panel-footer">
                <MoveNavigationControls compact />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function App() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultYear = yesterday.getFullYear();
  const defaultMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  const puzzleEloOptions = Array.from({ length: 15 }, (_, index) => 400 + (index * 200));
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.AppController = AppController;
        window.HomeController = HomeController;
        window.PuzzleController = PuzzleController;
      }

      AppController.init();
    } catch (error) {
      console.error('App boot failed', error);
      showBootError(error);
    }
  }, []);

  const handleSwitchTab = (tab) => {
    AppController.switchToTab(tab);
  };

  const handleGamesTabFetch = () => {
    HomeController.fetchLatestChesscomGames();
  };

  return (
    <>
      <nav className="navbar">
        <button type="button" className="nav-menu-btn" id="navMenuBtn" aria-label="Open navigation menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="nav-brand">
          <svg className="nav-logo" viewBox="0 0 32 32" fill="none">
            <path d="M22 28H10v-2h12v2zm1-4H9l1-4h12l1 4zm-5-6c3 0 6-2.5 6-6 0-2-1-3.5-2.5-4.5L20 6l-1.5 2H16l1-3h-2l-1 3h-1c-2 0-4 2-4 4.5 0 3 2 5.5 5 5.5h3z" fill="var(--accent)" opacity="0.95"/>
            <circle cx="14.5" cy="12" r="1.2" fill="var(--bg-primary)"/>
          </svg>
          <span className="brand-name">chess ramp</span>
          <span className="brand-sub">Stockfish Review</span>
        </div>
        <div className="nav-right">
          <div className="engine-badge" id="engineStatus">
            <span className="engine-dot"></span>
            <span className="engine-label">Initializing Stockfish 18...</span>
          </div>
          <button type="button" className="btn-profile" id="profileBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <span id="profileName">Sign In</span>
          </button>
        </div>
      </nav>

      <div className="nav-drawer-overlay" id="navDrawerOverlay" style={{ display: 'none' }}>
        <aside className="nav-drawer" id="navDrawer" aria-label="Main navigation">
          <div className="nav-drawer-header">
            <div>
              <div className="nav-drawer-title">Menu</div>
              <div className="nav-drawer-subtitle">Navigate chess ramp</div>
            </div>
            <button type="button" className="nav-drawer-close" id="navDrawerClose" aria-label="Close navigation menu">
              &#10005;
            </button>
          </div>
          <div className="nav-drawer-body">
            <div className="nav-links nav-drawer-links">
              <a href="#" className="nav-link active" data-tab="home">
                <span className="nav-item-icon">&#8962;</span>
                <span className="nav-item-label">Home</span>
              </a>
              <a href="#" className="nav-link" data-tab="games">
                <span className="nav-item-icon">&#9823;</span>
                <span className="nav-item-label">Games</span>
              </a>
              <a href="#" className="nav-link" data-tab="openings">
                <span className="nav-item-icon">&#9816;</span>
                <span className="nav-item-label">Practice</span>
              </a>
              <div className="nav-menu-group">
                <button type="button" className="nav-group-label" id="puzzleMenuToggle" aria-expanded="false">
                  <span className="nav-item-icon">&#129504;</span>
                  <span className="nav-item-label">Puzzles</span>
                  <span className="nav-group-caret" id="puzzleMenuCaret">&#8250;</span>
                </button>
                <div className="nav-submenu" id="puzzleSubmenu">
                  <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="classic">
                    <span className="nav-item-icon">&#9822;</span>
                    <span className="nav-item-label">Puzzle</span>
                  </button>
                  <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="daily">
                    <span className="nav-item-icon">&#128197;</span>
                    <span className="nav-item-label">Daily Puzzle</span>
                  </button>
                  <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="custom">
                    <span className="nav-item-icon">&#9881;</span>
                    <span className="nav-item-label">Custom Puzzles</span>
                  </button>
                  <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="survival">
                    <span className="nav-item-icon">&#128293;</span>
                    <span className="nav-item-label">Puzzle Survival</span>
                  </button>
                </div>
              </div>
              <a href="#" className="nav-link" data-tab="player-analyze">
                <span className="nav-item-icon">&#128200;</span>
                <span className="nav-item-label">Player Analyze</span>
              </a>
              <a href="#" className="nav-link" data-tab="import">
                <span className="nav-item-icon">&#128229;</span>
                <span className="nav-item-label">Import</span>
              </a>
              <a href="#" className="nav-link" data-tab="pricing">
                <span className="nav-item-icon">&#9830;</span>
                <span className="nav-item-label">Pricing</span>
              </a>
              <a href="#" className="nav-link" data-tab="settings">
                <span className="nav-item-icon">&#9881;</span>
                <span className="nav-item-label">Settings</span>
              </a>
              <a href="#" className="nav-link" data-tab="support">
                <span className="nav-item-icon">&#9993;</span>
                <span className="nav-item-label">Feedback</span>
              </a>
            </div>

            <div className="nav-drawer-social">
              <a href="https://instagram.com/chessramp" className="nav-link nav-social-link nav-instagram" target="_blank" rel="noopener noreferrer">
                <span className="nav-item-icon">&#128247;</span>
                <span className="nav-item-label">Instagram</span>
              </a>
              <a href="https://discord.gg/chessramp" className="nav-link nav-social-link nav-discord" target="_blank" rel="noopener noreferrer">
                <span className="nav-item-icon">
                  <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.8 41.8 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4c-1.8 1-3.6 1.9-5.5 2.6a.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0017.7-9v-.1c1.4-15.1-2.4-28.2-10-39.8a.2.2 0 00-.1-.1zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z"/>
                  </svg>
                </span>
                <span className="nav-item-label">Discord</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      <div className="app-container">
        <div className="tab-content active" id="tab-home">
          <div className="home-layout">
            <section className="home-hero" aria-labelledby="homeHeroTitle">
              <div className="home-hero-main">
                <div className="hero-kicker">Stockfish review workspace</div>
                <h1 className="hero-title" id="homeHeroTitle">
                  Welcome back, <span id="heroName">Guest</span>
                </h1>
                <p className="hero-sub">Analyze games, tighten openings, and keep daily tactics in one focused dashboard.</p>
                <div className="hero-actions">
                  <button type="button" className="hero-btn primary" onClick={() => handleSwitchTab('analyze')}>
                    <svg className="hero-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    Start review
                  </button>
                  <button type="button" className="hero-btn secondary" onClick={() => handleSwitchTab('import')}>
                    <svg className="hero-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 3v10m0 0l4-4m-4 4L8 9M5 17v2h14v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Import game
                  </button>
                </div>
                <div className="home-hero-stats" aria-label="Home overview">
                  <div className="hero-stat-card">
                    <span className="hero-stat-value" id="hmStatGames">0</span>
                    <span className="hero-stat-label">Games saved</span>
                  </div>
                  <div className="hero-stat-card">
                    <span className="hero-stat-value">18</span>
                    <span className="hero-stat-label">Stockfish</span>
                  </div>
                  <div className="hero-stat-card">
                    <span className="hero-stat-value">3</span>
                    <span className="hero-stat-label">Rating pools</span>
                  </div>
                </div>
              </div>
              <div className="home-hero-visual" aria-hidden="true">
                <div className="hero-board-shell">
                  <div className="hero-board-topline">
                    <span>Live position</span>
                    <strong>+0.6</strong>
                  </div>
                  <div className="hero-board-mini">
                    <span></span><span>&#9820;</span><span></span><span>&#9818;</span>
                    <span>&#9823;</span><span></span><span>&#9823;</span><span></span>
                    <span></span><span>&#9816;</span><span></span><span>&#9813;</span>
                    <span>&#9814;</span><span></span><span>&#9812;</span><span></span>
                  </div>
                  <div className="hero-line-card">
                    <span>Best move</span>
                    <strong>Nf3</strong>
                  </div>
                </div>
              </div>
            </section>

            <div className="home-action-strip" aria-label="Quick actions">
              <button type="button" className="home-action-tile" onClick={() => handleSwitchTab('games')}>
                <span className="home-action-icon">&#9823;</span>
                <span className="home-action-copy">
                  <strong>Games</strong>
                  <small>Recent imports and fetched games</small>
                </span>
              </button>
              <button type="button" className="home-action-tile" onClick={() => handleSwitchTab('openings')}>
                <span className="home-action-icon">&#9816;</span>
                <span className="home-action-copy">
                  <strong>Practice</strong>
                  <small>Opening lines and repetition</small>
                </span>
              </button>
              <button
                type="button"
                className="home-action-tile"
                onClick={() => {
                  PuzzleController.setMode('daily');
                  handleSwitchTab('puzzle');
                }}
              >
                <span className="home-action-icon">&#9733;</span>
                <span className="home-action-copy">
                  <strong>Daily puzzle</strong>
                  <small>Keep the tactics streak moving</small>
                </span>
              </button>
              <button type="button" className="home-action-tile" onClick={() => handleSwitchTab('player-analyze')}>
                <span className="home-action-icon">&#8599;</span>
                <span className="home-action-copy">
                  <strong>Player analyze</strong>
                  <small>Patterns across recent games</small>
                </span>
              </button>
            </div>

            <div className="home-grid">
              <div className="home-col">
                <div className="home-card">
                  <div className="hc-header">
                    <div className="hc-title-group">
                      <span className="hc-title">My Profile</span>
                      <span className="hc-subtitle">Engine preferences and linked handles</span>
                    </div>
                    <button type="button" className="hc-edit-btn" id="editProfileToggle">
                      Edit
                    </button>
                  </div>
                  <div id="profileViewMode">
                    <div className="profile-display">
                      <div className="profile-avatar-home">
                        <span id="profileInitials">KV</span>
                      </div>
                      <div className="profile-info-home">
                        <div className="profile-display-name" id="profileDisplayNameView">
                          Guest
                        </div>
                        <div className="profile-accounts-row">
                          <span className="account-chip chesscom-chip" id="chesscomChip" style={{ display: 'none' }}>
                            &#9823; <span id="chesscomChipName"></span>
                          </span>
                          <span className="account-chip lichess-chip" id="lichessChip" style={{ display: 'none' }}>
                            &#9820; <span id="lichessChipName"></span>
                          </span>
                          <span className="account-chip no-chip" id="noAccountsChip">
                            No accounts linked
                          </span>
                        </div>
                        <div className="profile-engine-row">
                          Engine: <span id="profileEngineView">Stockfish 18</span> · Depth:{' '}
                          <span id="profileDepthView">20</span>
                        </div>
                      </div>
                      <div className="profile-streak-row" id="profileStreakRow" aria-label="Visit streak">
                        <span className="profile-streak-icon" aria-hidden="true">&#128293;</span>
                        <div className="profile-streak-copy">
                          <span className="profile-streak-value" id="profileStreakValue">1</span>
                          <span className="profile-streak-label">day streak</span>
                        </div>
                      </div>
                    </div>
                    <div className="profile-rating-stats">
                      <div className="profile-rating-head">
                        <span className="profile-rating-title">Chess.com Ratings</span>
                        <span className="profile-rating-user" id="hmChesscomStatsUser">Not linked</span>
                      </div>
                      <div className="profile-rating-grid">
                        <div className="psm-box">
                          <div className="psm-num" id="hmStatBullet">—</div>
                          <div className="psm-label">Bullet</div>
                        </div>
                        <div className="psm-box">
                          <div className="psm-num" id="hmStatBlitz">—</div>
                          <div className="psm-label">Blitz</div>
                        </div>
                        <div className="psm-box">
                          <div className="psm-num" id="hmStatRapid">—</div>
                          <div className="psm-label">Rapid</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div id="profileEditMode" style={{ display: 'none' }}>
                    <div className="edit-form-grid">
                      <div className="form-group">
                        <label htmlFor="profileDisplayName">Display Name</label>
                        <input
                          type="text"
                          id="profileDisplayName"
                          className="dark-input full-width"
                          placeholder="Your name"
                          defaultValue=""
                        />
                      </div>
                      <div className="form-group">
                        <label>Stockfish</label>
                        <div className="settings-static-value settings-static-full">Stockfish</div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="prefDepth">Depth</label>
                        <input
                          type="number"
                          min="8"
                          max="40"
                          id="prefDepth"
                          className="dark-input full-width"
                          defaultValue="20"
                        />
                      </div>
                    </div>
                    <button type="button" className="btn-full" id="saveProfile">
                      Save Profile
                    </button>
                    <div className="save-status" id="saveStatus"></div>
                  </div>
                </div>

                <div className="home-card">
                  <div className="hc-header">
                    <div className="hc-title-group">
                      <span className="hc-title">Saved Profiles</span>
                      <span className="hc-subtitle">Switch between study setups</span>
                    </div>
                    <button type="button" className="hc-edit-btn" id="addProfileBtn">
                      Save Current
                    </button>
                  </div>
                  <div className="saved-profiles-list" id="savedProfilesList">
                    <div className="no-data">No saved profiles yet.</div>
                  </div>
                </div>

              </div>

              <div className="home-col">
                <div className="home-card">
                  <div className="hc-header">
                    <div className="hc-title-group">
                      <span className="hc-title">Linked Accounts</span>
                      <span className="hc-subtitle">Fetch games from your platforms</span>
                    </div>
                    <div className="acct-platform-toggle">
                      <button
                        type="button"
                        className="acct-toggle-btn active"
                        id="toggleChesscom"
                        data-account-panel="chesscom"
                        aria-pressed="true"
                      >Chess.com</button>
                      <button
                        type="button"
                        className="acct-toggle-btn"
                        id="toggleLichess"
                        data-account-panel="lichess"
                        aria-pressed="false"
                      >Lichess</button>
                    </div>
                  </div>

                  <div id="acctPanelChesscom" className="account-card">
                    <div className="hc-header" style={{ marginBottom: '10px' }}>
                      <div className="account-icon cc-icon">&#9823;</div>
                      <div>
                        <div className="hc-title">Chess.com</div>
                        <span className="acct-badge" id="chesscomStatus">Not linked</span>
                      </div>
                    </div>
                    <div className="account-input-row">
                      <input
                        type="text"
                        className="dark-input flex-input"
                        id="chesscomUsername"
                        placeholder="Chess.com username..."
                        defaultValue=""
                      />
                      <button type="button" className="btn-link-acct cc-btn" id="linkChesscom">Link</button>
                    </div>
                    <div className="account-linked-info" id="chesscomLinkedInfo" style={{ display: 'none' }}>
                      <div className="linked-name" id="chesscomLinkedName">@username</div>
                      <div className="linked-btns">
                        <button type="button" className="btn-sm-green" id="fetchChesscomGames">Fetch Games</button>
                        <button type="button" className="btn-sm-red" id="unlinkChesscom">Unlink</button>
                      </div>
                    </div>
                    <div className="platform-games-list" id="chesscomGamesList">
                      <div className="account-panel-state is-empty">
                        <div className="account-panel-state-title">No account linked</div>
                        <div className="account-panel-state-copy">Link your Chess.com username to fetch recent games.</div>
                      </div>
                    </div>
                  </div>

                  <div id="acctPanelLichess" className="account-card" style={{ display: 'none' }}>
                    <div className="hc-header" style={{ marginBottom: '10px' }}>
                      <div className="account-icon lc-icon">&#9820;</div>
                      <div>
                        <div className="hc-title">Lichess.org</div>
                        <span className="acct-badge" id="lichessStatus">Not linked</span>
                      </div>
                    </div>
                    <div className="account-input-row">
                      <input
                        type="text"
                        className="dark-input flex-input"
                        id="lichessUsername"
                        placeholder="Lichess username..."
                        defaultValue=""
                      />
                      <button type="button" className="btn-link-acct lc-btn" id="linkLichess">Link</button>
                    </div>
                    <div className="account-linked-info" id="lichessLinkedInfo" style={{ display: 'none' }}>
                      <div className="linked-name" id="lichessLinkedName">@username</div>
                      <div className="linked-btns">
                        <button type="button" className="btn-sm-green" id="fetchLichessGames">Fetch Games</button>
                        <button type="button" className="btn-sm-red" id="unlinkLichess">Unlink</button>
                      </div>
                    </div>
                    <div className="platform-games-list" id="lichessGamesList">
                      <div className="account-panel-state is-empty">
                        <div className="account-panel-state-title">No account linked</div>
                        <div className="account-panel-state-copy">Link your Lichess username to fetch recent games.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="home-col">
                <div className="home-card home-daily-puzzle-card">
                  <div className="hc-header">
                    <div className="hc-title-group">
                      <span className="hc-title">Daily Puzzle</span>
                      <span className="hc-subtitle">One focused tactic per day</span>
                    </div>
                    <div className="home-daily-header-right">
                      <div className="home-daily-streak-badge" id="homeDailyStreak">
                        <span className="home-daily-streak-fire">&#9733;</span>
                        <span className="home-daily-streak-count">0</span>
                        <span className="home-daily-streak-label">streak</span>
                      </div>
                      <button type="button" className="home-daily-date" id="homeDailyPuzzleDate">Today</button>
                    </div>
                  </div>
                  <div className="home-daily-body">
                    <div className="home-daily-preview" id="homeDailyPuzzlePreview">
                      <div className="home-daily-preview-empty">Today&apos;s puzzle preview will appear here.</div>
                    </div>
                    <div className="home-daily-copy">
                      <div className="home-daily-status" id="homeDailyPuzzleStatus">Open today&apos;s puzzle to generate it.</div>
                      <div className="home-daily-meta">
                        Puzzle Elo: <span id="homeDailyPuzzleElo">—</span>
                      </div>
                    </div>
                    <button type="button" className="hero-btn secondary home-daily-btn" id="openDailyPuzzleHome">
                      Open Daily Puzzle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <GameReviewLayout />

        <div className="tab-content" id="tab-import">
          <div className="import-layout">
            <div className="import-card">
              <div className="import-title">Import a Game</div>
              <div className="import-methods">
                <div className="import-method active" data-method="pgn">PGN</div>
                <div className="import-method" data-method="file">File</div>
                <div className="import-method" data-method="fen">FEN</div>
                <div className="import-method" data-method="url">URL</div>
              </div>

              <div className="import-section active" id="import-pgn">
                <textarea
                  id="pgnInput"
                  className="pgn-textarea"
                  placeholder="Paste full PGN here..."
                  defaultValue=""
                ></textarea>
                <button type="button" className="btn-import" id="loadPGN">
                  Load PGN
                </button>
              </div>

              <div className="import-section" id="import-file">
                <div className="file-drop-zone" id="fileDropZone">
                  Drag &amp; drop PGN file or click to browse
                </div>
                <input type="file" id="fileInput" accept=".pgn" style={{ display: 'none' }} />
              </div>

              <div className="import-section" id="import-fen">
                <input
                  type="text"
                  className="dark-input full-width"
                  id="fenImportInput"
                  placeholder="Enter FEN position"
                  defaultValue=""
                />
                <button type="button" className="btn-import" id="loadFenImport">
                  Load FEN
                </button>
              </div>

              <div className="import-section" id="import-url">
                <input
                  type="text"
                  className="dark-input full-width"
                  id="urlInput"
                  placeholder="Lichess.org or Chess.com URL"
                  defaultValue=""
                />
                <button type="button" className="btn-import" id="loadURL">
                  Import Game
                </button>
              </div>
            </div>

            <div className="import-card">
              <div className="import-title">Fetch Recent Games</div>
              <div className="form-group">
                <label htmlFor="platformSelect">Platform</label>
                <select id="platformSelect" className="dark-select" defaultValue="lichess">
                  <option value="lichess">Lichess.org</option>
                  <option value="chesscom">Chess.com</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="fetchUsername">Username</label>
                <input
                  type="text"
                  className="dark-input full-width"
                  id="fetchUsername"
                  placeholder="Enter username"
                  defaultValue=""
                />
              </div>
              <div className="form-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 120px' }}>
                  <label htmlFor="fetchYear">Year (Chess.com)</label>
                  <input
                    type="number"
                    className="dark-input full-width"
                    id="fetchYear"
                    min="2000"
                    max="2100"
                    defaultValue={defaultYear}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 120px' }}>
                  <label htmlFor="fetchMonth">Month</label>
                  <select id="fetchMonth" className="dark-select full-width" defaultValue={defaultMonth}>
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="form-hint" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
                Chess.com archives are fetched by month via the official multi-game PGN API.
              </p>
              <p className="form-hint" style={{ fontSize: '0.7rem', marginTop: '-6px' }}>
                <a href="/router/chesscom" target="_blank" rel="noreferrer">Open Chess.com router page</a>
              </p>
              <button type="button" className="btn-import" id="fetchGamesBtn">
                Fetch Games
              </button>
              <div className="fetch-results" id="fetchResults">
                <div className="no-games">Fetch games to see them here.</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== GAMES TAB ===== */}
        <div className="tab-content" id="tab-games">
          <div className="games-tab-layout">
            <section className="games-shell-card">
              <div className="games-shell-main">
                <div className="games-tab-header">
                  <div className="games-eyebrow">Chess.com Archive</div>
                  <h2 className="games-tab-title">Games</h2>
                  <p className="games-tab-sub" id="gamesTabSub">Connect your Chess.com account on the Home tab, then sync the latest archive here.</p>
                </div>
                <div className="games-tab-controls" id="gamesTabControls" style={{ display: 'none' }}>
                  <div className="games-tab-user" id="gamesTabUser"></div>
                  <button type="button" className="btn-sm-green" id="gamesTabFetch" onClick={handleGamesTabFetch}>Sync Latest</button>
                </div>
              </div>

              <div className="games-overview-strip" aria-label="Games archive summary">
                <div className="games-overview-item">
                  <span className="games-overview-label">Archive</span>
                  <strong className="games-overview-value" id="gamesMetricTotal">--</strong>
                  <span className="games-overview-foot">Games in view</span>
                </div>
                <div className="games-overview-item">
                  <span className="games-overview-label">Record</span>
                  <strong className="games-overview-value" id="gamesMetricRecord">--</strong>
                  <span className="games-overview-foot">Wins, losses, draws</span>
                </div>
                <div className="games-overview-item">
                  <span className="games-overview-label">Reviewed</span>
                  <strong className="games-overview-value" id="gamesMetricReviewed">--</strong>
                  <span className="games-overview-foot">Analysis coverage</span>
                </div>
                <div className="games-overview-item">
                  <span className="games-overview-label">Modes</span>
                  <strong className="games-overview-value games-overview-value-compact" id="gamesMetricModes">No archive</strong>
                  <span className="games-overview-foot">Most-played formats</span>
                </div>
              </div>
            </section>

            <section className="games-results-card">
              <div className="games-results-head">
                <div className="games-results-copy">
                  <div className="games-results-kicker">Overview</div>
                  <h3 className="games-results-title" id="gamesSummaryTitle">No archive loaded yet</h3>
                  <p className="games-results-meta" id="gamesSummaryMeta">Fetch a Chess.com archive to analyze recent games, openings, and review coverage.</p>
                </div>
                <div className="games-tab-filters" id="gamesTabFilters" style={{ display: 'none' }}>
                  <label className="games-filter-label" htmlFor="gamesTabFilterSelect">Filter</label>
                  <select id="gamesTabFilterSelect" className="games-filter-select" defaultValue="all">
                    <option value="all">All Games</option>
                    <option value="win">Wins</option>
                    <option value="lost">Losses</option>
                    <option value="draw">Draws</option>
                    <option value="not-reviewed">Needs Review</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </div>
              </div>

              <div className="games-tab-list" id="gamesTabList">
                <div className="games-empty-state">
                  <div className="games-empty-icon">&#9823;</div>
                  <div className="games-empty-title">No games fetched yet</div>
                  <div className="games-empty-copy">Connect Chess.com on the Home tab, then sync the latest archive to populate this page.</div>
                </div>
              </div>
            </section>

          </div>
        </div>

        <div className="tab-content" id="tab-puzzle">
          <div className="puzzle-layout" id="puzzleLayout">
            <div className="puzzle-left-panel">
              <div className="puzzle-header-card">
                <div>
                  <div className="puzzle-eyebrow">Puzzles</div>
                  <h2 className="puzzle-title" id="puzzleTitle">Tactical Puzzle</h2>
                  <p className="puzzle-meta" id="puzzleMeta">Solve the line to improve your puzzle Elo.</p>
                </div>
                <div className="puzzle-stats-grid">
                  <div className="puzzle-rating-box">
                    <div className="puzzle-rating-label">Your Puzzle Elo</div>
                    <div className="puzzle-rating-value">
                      <span id="puzzleUserRating">1200</span>
                      <span className="puzzle-rating-delta" id="puzzleDelta">+0</span>
                    </div>
                  </div>
                  <div className="puzzle-rating-box">
                    <div className="puzzle-rating-label">Puzzle Elo</div>
                    <div className="puzzle-rating-value">
                      <span id="puzzleTargetRating">—</span>
                    </div>
                  </div>
                  <div className="puzzle-rating-box">
                    <div className="puzzle-rating-label" id="puzzleStreakLabel">Wins</div>
                    <div className="puzzle-rating-value">
                      <span id="puzzleWinCount">0</span>
                    </div>
                  </div>
                  <div className="puzzle-rating-box">
                    <div className="puzzle-rating-label">Season Points</div>
                    <div className="puzzle-rating-value">
                      <span id="puzzleSeasonPoints">0</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="puzzle-filter-card" id="puzzleFilterCard" style={{ display: 'none' }}>
                <div className="puzzle-filter-head">
                  <div>
                    <span className="practice-moves-header">Filters</span>
                    <div className="puzzle-filter-subhead">Set a target Elo and narrow the puzzle pool.</div>
                  </div>
                  <span className="puzzle-filter-badge">Custom</span>
                </div>
                <div className="puzzle-filter-grid">
                  <div className="form-group puzzle-filter-field">
                    <label htmlFor="puzzleEloSelect">Elo</label>
                    <select id="puzzleEloSelect" className="dark-select full-width" defaultValue="1200">
                      {puzzleEloOptions.map((elo) => (
                        <option key={elo} value={String(elo)}>{elo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group puzzle-filter-field">
                    <label htmlFor="puzzleDifficultySelect">Difficulty</label>
                    <select id="puzzleDifficultySelect" className="dark-select full-width" defaultValue="hard">
                      <option value="standard">Standard</option>
                      <option value="hard">Hard</option>
                      <option value="extra-hard">Extra Hard</option>
                    </select>
                  </div>
                  <div className="form-group puzzle-filter-field">
                    <label htmlFor="puzzleThemeSelect">Theme</label>
                    <select id="puzzleThemeSelect" className="dark-select full-width" defaultValue="">
                      <option value="">Any theme</option>
                      <optgroup label="Tactics">
                        <option value="fork">Fork</option>
                        <option value="pin">Pin</option>
                        <option value="skewer">Skewer</option>
                        <option value="discoveredAttack">Discovered Attack</option>
                        <option value="discoveredCheck">Discovered Check</option>
                        <option value="doubleCheck">Double Check</option>
                        <option value="deflection">Deflection</option>
                        <option value="attraction">Attraction</option>
                        <option value="interference">Interference</option>
                        <option value="intermezzo">Intermezzo</option>
                        <option value="xRayAttack">X-Ray Attack</option>
                        <option value="sacrifice">Sacrifice</option>
                        <option value="clearance">Clearance</option>
                        <option value="capturingDefender">Capturing Defender</option>
                        <option value="trappedPiece">Trapped Piece</option>
                        <option value="hangingPiece">Hanging Piece</option>
                      </optgroup>
                      <optgroup label="Mate in N">
                        <option value="mate">Mate</option>
                        <option value="mateIn1">Mate in 1</option>
                        <option value="mateIn2">Mate in 2</option>
                        <option value="mateIn3">Mate in 3</option>
                        <option value="mateIn4">Mate in 4</option>
                        <option value="mateIn5">Mate in 5</option>
                      </optgroup>
                      <optgroup label="Mate Patterns">
                        <option value="backRankMate">Back Rank Mate</option>
                        <option value="smotheredMate">Smothered Mate</option>
                        <option value="anastasiaMate">Anastasia's Mate</option>
                        <option value="arabianMate">Arabian Mate</option>
                        <option value="balestraMate">Balestra Mate</option>
                        <option value="blindSwineMate">Blind Swine Mate</option>
                        <option value="bodenMate">Boden's Mate</option>
                        <option value="cornerMate">Corner Mate</option>
                        <option value="doubleBishopMate">Double Bishop Mate</option>
                        <option value="dovetailMate">Dovetail Mate</option>
                        <option value="epauletteMate">Epaulette Mate</option>
                        <option value="hookMate">Hook Mate</option>
                        <option value="killBoxMate">Kill Box Mate</option>
                        <option value="morphysMate">Morphy's Mate</option>
                        <option value="operaMate">Opera Mate</option>
                        <option value="pillsburysMate">Pillsbury's Mate</option>
                        <option value="swallowstailMate">Swallow's Tail Mate</option>
                        <option value="triangleMate">Triangle Mate</option>
                        <option value="vukovicMate">Vukovic Mate</option>
                      </optgroup>
                      <optgroup label="Strategy">
                        <option value="advancedPawn">Advanced Pawn</option>
                        <option value="advantage">Advantage</option>
                        <option value="attackingF2F7">Attacking f2/f7</option>
                        <option value="castling">Castling</option>
                        <option value="crushing">Crushing</option>
                        <option value="defensiveMove">Defensive Move</option>
                        <option value="enPassant">En Passant</option>
                        <option value="exposedKing">Exposed King</option>
                        <option value="kingsideAttack">Kingside Attack</option>
                        <option value="queensideAttack">Queenside Attack</option>
                        <option value="promotion">Promotion</option>
                        <option value="underPromotion">Under-Promotion</option>
                        <option value="quietMove">Quiet Move</option>
                        <option value="zugzwang">Zugzwang</option>
                        <option value="equality">Equality</option>
                        <option value="collinearMove">Collinear Move</option>
                      </optgroup>
                      <optgroup label="Endgames">
                        <option value="endgame">Endgame (any)</option>
                        <option value="bishopEndgame">Bishop Endgame</option>
                        <option value="knightEndgame">Knight Endgame</option>
                        <option value="pawnEndgame">Pawn Endgame</option>
                        <option value="queenEndgame">Queen Endgame</option>
                        <option value="queenRookEndgame">Queen + Rook Endgame</option>
                        <option value="rookEndgame">Rook Endgame</option>
                      </optgroup>
                      <optgroup label="Game Phase">
                        <option value="opening">Opening</option>
                        <option value="middlegame">Middlegame</option>
                      </optgroup>
                      <optgroup label="Puzzle Length">
                        <option value="oneMove">One Move</option>
                        <option value="short">Short</option>
                        <option value="long">Long</option>
                        <option value="veryLong">Very Long</option>
                      </optgroup>
                      <optgroup label="Player Level">
                        <option value="master">Master</option>
                        <option value="masterVsMaster">Master vs Master</option>
                        <option value="superGM">Super GM</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="form-group puzzle-filter-field">
                    <label htmlFor="puzzleOpeningSelect">Opening</label>
                    <select id="puzzleOpeningSelect" className="dark-select full-width" defaultValue="">
                      <option value="">Any opening</option>
                      <optgroup label="King's Pawn (e4)">
                        <option value="Sicilian_Defense">Sicilian Defense</option>
                        <option value="French_Defense">French Defense</option>
                        <option value="Caro-Kann_Defense">Caro-Kann Defense</option>
                        <option value="Italian_Game">Italian Game</option>
                        <option value="Scandinavian_Defense">Scandinavian Defense</option>
                        <option value="Ruy_Lopez">Ruy Lopez</option>
                        <option value="Scotch_Game">Scotch Game</option>
                        <option value="Philidor_Defense">Philidor Defense</option>
                        <option value="Russian_Game">Russian Game (Petrov)</option>
                        <option value="Kings_Gambit_Accepted">King's Gambit Accepted</option>
                        <option value="Kings_Gambit_Declined">King's Gambit Declined</option>
                        <option value="Four_Knights_Game">Four Knights Game</option>
                        <option value="Vienna_Game">Vienna Game</option>
                        <option value="Bishops_Opening">Bishop's Opening</option>
                        <option value="Kings_Pawn_Game">King's Pawn Game</option>
                        <option value="Pirc_Defense">Pirc Defense</option>
                        <option value="Modern_Defense">Modern Defense</option>
                        <option value="Alekhine_Defense">Alekhine Defense</option>
                        <option value="Nimzowitsch_Defense">Nimzowitsch Defense</option>
                        <option value="Owen_Defense">Owen Defense</option>
                      </optgroup>
                      <optgroup label="Queen's Pawn (d4)">
                        <option value="Queens_Pawn_Game">Queen's Pawn Game</option>
                        <option value="Queens_Gambit_Declined">Queen's Gambit Declined</option>
                        <option value="Queens_Gambit_Accepted">Queen's Gambit Accepted</option>
                        <option value="Indian_Defense">Indian Defense</option>
                        <option value="Kings_Indian_Defense">King's Indian Defense</option>
                        <option value="Slav_Defense">Slav Defense</option>
                        <option value="Benoni_Defense">Benoni Defense</option>
                        <option value="Dutch_Defense">Dutch Defense</option>
                        <option value="Grunfeld_Defense">Grunfeld Defense</option>
                        <option value="Nimzo-Indian_Defense">Nimzo-Indian Defense</option>
                        <option value="Queens_Indian_Defense">Queen's Indian Defense</option>
                        <option value="Bogo-Indian_Defense">Bogo-Indian Defense</option>
                        <option value="Catalan_Opening">Catalan Opening</option>
                        <option value="London_System">London System</option>
                        <option value="Trompowsky_Attack">Trompowsky Attack</option>
                      </optgroup>
                      <optgroup label="Flank Openings">
                        <option value="English_Opening">English Opening</option>
                        <option value="Zukertort_Opening">Zukertort / Reti Opening</option>
                        <option value="Nimzo-Larsen_Attack">Nimzo-Larsen Attack</option>
                        <option value="Bird_Opening">Bird Opening</option>
                        <option value="Englund_Gambit">Englund Gambit</option>
                        <option value="Hungarian_Opening">Hungarian Opening</option>
                      </optgroup>
                      <optgroup label="Gambits & Others">
                        <option value="Benko_Gambit">Benko Gambit</option>
                        <option value="Budapest_Gambit">Budapest Gambit</option>
                        <option value="Evans_Gambit">Evans Gambit</option>
                        <option value="Smith-Morra_Gambit">Smith-Morra Gambit</option>
                        <option value="Horwitz_Defense">Horwitz Defense</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>

              <div className="puzzle-filter-card" id="puzzleDailyCard" style={{ display: 'none' }}>
                <div className="puzzle-filter-head">
                  <span className="practice-moves-header">Daily Puzzle Calendar</span>
                </div>
                <div className="puzzle-calendar-shell">
                  <div className="puzzle-calendar-head">
                    <button type="button" className="practice-ctrl-btn puzzle-calendar-nav" id="puzzleDailyPrevMonthBtn" aria-label="Previous month">
                      &#8592;
                    </button>
                    <div className="puzzle-calendar-month" id="puzzleDailyMonthLabel">Month</div>
                    <button type="button" className="practice-ctrl-btn puzzle-calendar-nav" id="puzzleDailyNextMonthBtn" aria-label="Next month">
                      &#8594;
                    </button>
                  </div>
                  <div className="puzzle-calendar-weekdays">
                    <span>Sun</span>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                  </div>
                  <div className="puzzle-calendar-grid" id="puzzleDailyCalendarGrid"></div>
                </div>
                <div className="puzzle-daily-summary" id="puzzleDailySummary">
                  Select a date to open that day&apos;s stored puzzle.
                </div>
              </div>

              <div className="practice-board-wrapper puzzle-board-shell">
                <div className="practice-board-main">
                  <canvas id="puzzleChessBoard" width="640" height="640"></canvas>
                  <div id="puzzleBoardOverlay" className="board-overlay"></div>
                </div>
              </div>

              <div className="puzzle-status is-neutral" id="puzzleStatus">
                Load a puzzle to start solving.
              </div>

              <div className="puzzle-badge-row">
                <span className="puzzle-badge speed" id="puzzleSpeedBadge" style={{ display: 'none' }}>+0 speed</span>
                <span className="puzzle-badge milestone" id="puzzleMilestoneBadge" style={{ display: 'none' }}>Beat 1600</span>
              </div>

              <div className="practice-controls puzzle-controls">
                <button type="button" className="practice-ctrl-btn" id="puzzlePrevBtn">
                  &#8592; Prev
                </button>
                <button type="button" className="practice-ctrl-btn hint-btn" id="puzzleHintBtn">
                  &#128161; Hint
                </button>
                <button type="button" className="practice-ctrl-btn puzzle-try-again-btn" id="puzzleTryAgainBtn" style={{ display: 'none' }}>
                  Try Again
                </button>
                <button type="button" className="practice-ctrl-btn" id="puzzleNextBtn">
                  Next Puzzle
                </button>
                <button type="button" className="practice-ctrl-btn puzzle-sound-btn" id="puzzleSoundToggleBtn" aria-pressed="true">
                  <span className="puzzle-sound-icon" id="puzzleSoundToggleIcon">🔊</span>
                  <span className="puzzle-sound-label" id="puzzleSoundToggleLabel">Sound On</span>
                </button>
              </div>

              <div className="puzzle-hint-row" id="puzzleHintText">
                Hint shows the next move with an arrow.
              </div>

            </div>

            <div className="puzzle-right-panel" id="puzzleRightPanel">
              <div className="puzzle-side-card puzzle-result-card" id="puzzleResultCard">
                <div className="practice-moves-header">Post-Puzzle Stats</div>
                <div className="puzzle-result-head">
                  <div className="puzzle-summary-title" id="puzzleResultHeading">Waiting for a result</div>
                  <div className="puzzle-summary-sub" id="puzzleResultSummary">Solve or miss a puzzle to see details.</div>
                </div>
                <div className="puzzle-metric-grid">
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Target Time</span>
                    <span className="puzzle-metric-value" id="puzzleResultTargetTime">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Actual Time</span>
                    <span className="puzzle-metric-value" id="puzzleResultActualTime">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Speed Bonus</span>
                    <span className="puzzle-metric-value" id="puzzleResultSpeedBonus">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Elo Change</span>
                    <span className="puzzle-metric-value" id="puzzleResultDelta">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Attempts</span>
                    <span className="puzzle-metric-value" id="puzzleResultAttempts">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Popularity</span>
                    <span className="puzzle-metric-value" id="puzzleResultPopularity">—</span>
                  </div>
                </div>
                <div className="puzzle-result-tags">
                  <div className="puzzle-result-opening" id="puzzleResultOpening">Opening: —</div>
                  <div className="puzzle-tag-list" id="puzzleResultThemes">
                    <span className="puzzle-tag">No themes yet</span>
                  </div>
                  <div className="puzzle-hint-note" id="puzzleHintPenaltyNote">Hints not used.</div>
                </div>
              </div>

              <div className="puzzle-side-card">
                <div className="practice-moves-header">Records</div>
                <div className="puzzle-metric-grid">
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Best Survival</span>
                    <span className="puzzle-metric-value" id="puzzleBestSurvival">0</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Best This Month</span>
                    <span className="puzzle-metric-value" id="puzzleBestMonthly">0</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Fastest Avg</span>
                    <span className="puzzle-metric-value" id="puzzleBestAvgTime">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Peak Puzzle Elo</span>
                    <span className="puzzle-metric-value" id="puzzlePeakElo">1200</span>
                  </div>
                </div>
              </div>

              <div className="puzzle-side-card puzzle-summary-card" id="puzzleSurvivalSummary" style={{ display: 'none' }}>
                <div className="practice-moves-header">Progress</div>
                <div className="puzzle-summary-head">
                  <div className="puzzle-summary-title" id="puzzleSummaryTitle">Survival Over</div>
                  <div className="puzzle-summary-sub" id="puzzleSummarySub">You solved 0 puzzles.</div>
                </div>
                <div className="puzzle-metric-grid">
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Average Solve</span>
                    <span className="puzzle-metric-value" id="puzzleSummaryAverage">—</span>
                  </div>
                  <div className="puzzle-metric-box">
                    <span className="puzzle-metric-label">Fastest Solve</span>
                    <span className="puzzle-metric-value" id="puzzleSummaryFastest">—</span>
                  </div>
                </div>
                <button type="button" className="practice-ctrl-btn" id="puzzleRetryFailedBtn">
                  Retry Failed Puzzle
                </button>
                <div className="puzzle-summary-list" id="puzzleSurvivalResults">
                  <div className="puzzle-summary-empty">Your cleared puzzle Elo checkpoints will appear here.</div>
                </div>
              </div>

              <div className="puzzle-side-card">
                <div className="practice-moves-header">Review</div>
                <div className="puzzle-history-list" id="puzzleHistoryList">
                  <div className="puzzle-summary-empty">Your recent puzzle history will appear here.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tab-content" id="tab-database">
          <div className="database-layout">
            <div className="db-header">
              <h2>Game Database</h2>
              <div>Total games analyzed: <span id="statGamesAnalyzed">0</span></div>
            </div>
            <div className="db-search-row">
              <input
                type="text"
                className="dark-input"
                id="dbSearch"
                placeholder="Search players, openings..."
                defaultValue=""
              />
            </div>
            <div className="database-table">
              <div className="db-table-header">
                <div>White</div>
                <div>Black</div>
                <div>Result</div>
                <div>Opening</div>
                <div>Date</div>
                <div>Actions</div>
              </div>
              <div className="db-rows" id="dbRows">
                <div className="no-games">Analyze a game to start building your database.</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== PRACTICE OPENINGS TAB ===== */}
        <div className="tab-content" id="tab-openings">

          {/* --- Gallery View --- */}
          <div id="openingGalleryView" className="openings-gallery-view">
            <div className="openings-hero">
              <div className="openings-hero-text">
                <h1 className="openings-title">&#9816; Practice Chess Openings</h1>
                <p className="openings-subtitle">
                  Master 173 openings with 3,901 variations. Select an opening, pick a line, and play the moves on the board.
                </p>
              </div>
            </div>

            {/* Due for Review banner */}
            <div id="reviewQueueBanner" className="review-queue-banner" style={{ display: 'none' }}>
              <span style={{ fontSize: '18px' }}>&#127344;</span>
              <span id="reviewQueueCount" style={{ flex: 1 }}>0 lines due for review</span>
              <button type="button" id="startReviewBtn" className="review-start-btn">
                Start Review &#9889;
              </button>
            </div>

            <div className="openings-toolbar">
              <input
                type="text"
                className="dark-input openings-search"
                id="openingSearchInput"
                placeholder="Search openings by name..."
                defaultValue=""
              />
              <div className="openings-filter-stack">
                <div className="games-filter-label">Side</div>
                <div className="eco-filter-group">
                  <button type="button" className="eco-filter-btn active" data-side="">All Sides</button>
                  <button type="button" className="eco-filter-btn" data-side="w">White</button>
                  <button type="button" className="eco-filter-btn" data-side="b">Black</button>
                </div>
              </div>
              <div className="openings-filter-stack">
                <div className="games-filter-label">Track</div>
                <div className="eco-filter-group" id="openingStatusFilters">
                  <button type="button" className="eco-filter-btn active" data-status="">All</button>
                  <button type="button" className="eco-filter-btn" data-status="favorites">Favorites</button>
                  <button type="button" className="eco-filter-btn" data-status="due">Due</button>
                  <button type="button" className="eco-filter-btn" data-status="mastered">Mastered</button>
                  <button type="button" className="eco-filter-btn" data-status="in-progress">In Progress</button>
                </div>
              </div>
            </div>

            <div className="opening-gallery-grid" id="openingGalleryGrid">
              {/* Cards rendered by JS */}
            </div>
          </div>

          {/* --- Detail View (Variation List) --- */}
          <div id="openingDetailView" className="opening-detail-view" style={{ display: 'none' }}>
            <button type="button" className="btn-back" id="backToGalleryBtn">
              &#8592; All Openings
            </button>
            <div className="detail-header">
              <img className="detail-header-img" id="detailOpeningImg" src="" alt="" />
              <div className="detail-header-info">
                <div className="detail-opening-title-row">
                  <h2 className="detail-opening-name" id="detailOpeningName">Opening</h2>
                  <button type="button" className="opening-favorite-btn detail-favorite-btn" id="detailFavoriteBtn" aria-pressed="false" title="Save to favorites">
                    <span className="opening-favorite-btn-icon" aria-hidden="true">&#9734;</span>
                    <span>Favorite</span>
                  </button>
                </div>
                <div className="detail-opening-meta">
                  <div className="detail-eco" id="detailOpeningEco">Opening guide</div>
                  <span className="opening-side-badge white-badge" id="detailOpeningSide">White</span>
                </div>
                <p className="detail-desc" id="detailOpeningDesc"></p>
                <div className="detail-live-stats opening-live-stats" id="detailOpeningStats">Loading live win rate...</div>
                <div className="detail-var-count" id="detailVarCount">0 variations</div>
              </div>
            </div>
            <div className="variation-list-header">
              <h3>Variations &amp; Lines</h3>
            </div>
            <div className="variation-list" id="variationList">
              {/* Variations rendered by JS */}
            </div>
          </div>

          {/* --- Practice View --- */}
          <div id="openingPracticeView" className="opn-practice-root" style={{ display: 'none' }}>

            {/* ── LEFT: Board column ── */}
            <div className="opn-board-col">
              <div className="practice-nav-row">
                <button type="button" className="btn-back" id="backToDetailBtn">&#8592; Variations</button>
                <button type="button" className="btn-back" id="backToDetailBtn2" style={{ marginLeft: '8px' }}>&#8592; All Openings</button>
              </div>

              {/* Hidden legacy elements kept for JS data-binding */}
              <div style={{ display: 'none' }} aria-hidden="true">
                <div id="practiceOpeningName"></div>
                <div id="practiceVarName"></div>
                <span id="practiceOpeningSide"></span>
                <span id="practiceSideCopy"></span>
              </div>

              <div className="opn-board-frame">
                <canvas id="practiceChessBoard" width="640" height="640"></canvas>
                <div id="practiceBoardOverlay" className="board-overlay"></div>
              </div>

              <div id="practiceStatus" className="practice-status" style={{ display: 'none' }}></div>

              {/* Bottom control bar */}
              <div className="opn-bottom-bar">
                <button type="button" className="opn-ctrl-btn opn-ctrl-icon" id="practiceFlipBtn" title="Flip board">&#8645;</button>
                <button type="button" className="opn-ctrl-btn opn-ctrl-hint" id="practiceHintBtn" title="Show hint">&#128161; Hint</button>
                <button type="button" className="opn-ctrl-btn opn-ctrl-mode" id="practiceModeBtn" title="Switch mode">Mode</button>
                <button type="button" className="opn-ctrl-btn opn-ctrl-nav" id="practicePrevBtn" title="Previous move">&#8249;</button>
                <button type="button" className="opn-ctrl-btn opn-ctrl-nav" id="practiceNextBtn" title="Next move">&#8250;</button>
              </div>

              {/* Hidden reset button (wired by controller) */}
              <button type="button" id="practiceResetBtn" style={{ display: 'none' }}></button>
            </div>

            {/* ── RIGHT: Training panel ── */}
            <div className="opn-train-col">

              {/* Header row */}
              <div className="opn-train-header">
                <span className="opn-mode-badge" id="opnModeBadge">&#128218; Learn</span>
                <span className="opn-train-name" id="opnTrainName">Select an Opening</span>
                <span className="opn-train-step" id="opnTrainStep">#1</span>
              </div>

              {/* Coach bubble */}
              <div className="opn-coach-bubble" id="coachExplanation">
                <div className="opn-coach-head">
                  <span className="opn-coach-icon">&#9822;</span>
                  <span className="opn-coach-label">Coach</span>
                </div>
                <div className="opn-coach-body" id="opnCoachBody">
                  Select a variation to begin. Use <strong>›</strong> to step through moves in Learn mode.
                </div>
              </div>

              {/* Mode cards — rendered by JS */}
              <div className="opn-mode-grid" id="opnModeGrid"></div>

              {/* Lines discovered counter */}
              <div className="opn-lines-row" id="opnLinesRow" style={{ display: 'none' }}>
                <span className="opn-lines-icon">&#128218;</span>
                <span className="opn-lines-text" id="opnLinesText">0 / 0 lines discovered</span>
              </div>

              <div id="timeModePanel" className="time-mode-panel" style={{ display: 'none' }}>
                <div className="time-mode-head">
                  <div>
                    <div className="time-mode-title">Timed Run</div>
                    <div className="time-mode-sub" id="timeModeSub">Race the clock through the line.</div>
                  </div>
                  <div className="time-mode-medal" id="timeModeMedal">No Medal Yet</div>
                </div>
                <div className="time-mode-grid">
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Clock</span>
                    <span className="time-mode-stat-value" id="timeModeClock">00:00</span>
                  </div>
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Move</span>
                    <span className="time-mode-stat-value" id="timeModeMoveClock">00.0s</span>
                  </div>
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Score</span>
                    <span className="time-mode-stat-value" id="timeModeScore">0</span>
                  </div>
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Best</span>
                    <span className="time-mode-stat-value" id="timeModeBest">0</span>
                  </div>
                </div>
              </div>

              <div id="arenaModePanel" className="time-mode-panel arena-mode-panel" style={{ display: 'none' }}>
                <div className="time-mode-head">
                  <div>
                    <div className="time-mode-title">Arena Gauntlet</div>
                    <div className="time-mode-sub" id="arenaModeSub">Random lines until your first mistake.</div>
                  </div>
                  <div className="time-mode-medal arena-mode-badge" id="arenaModeBadge">Ready</div>
                </div>
                <div className="time-mode-grid">
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Streak</span>
                    <span className="time-mode-stat-value" id="arenaModeStreak">0</span>
                  </div>
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Score</span>
                    <span className="time-mode-stat-value" id="arenaModeScore">0</span>
                  </div>
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Rating</span>
                    <span className="time-mode-stat-value" id="arenaModeRating">1200</span>
                  </div>
                  <div className="time-mode-stat">
                    <span className="time-mode-stat-label">Line Elo</span>
                    <span className="time-mode-stat-value" id="arenaModeLine">—</span>
                  </div>
                  <div className="time-mode-stat arena-mode-best">
                    <span className="time-mode-stat-label">Best</span>
                    <span className="time-mode-stat-value" id="arenaModeBest">0 / 0</span>
                  </div>
                </div>
              </div>

              {/* Move progress bar */}
              <div className="practice-progress">
                <div className="practice-progress-bar">
                  <div className="practice-progress-fill" id="practiceProgressBar"></div>
                </div>
                <div className="practice-progress-text" id="practiceProgressText">0 / 0 moves</div>
              </div>

              {/* SRS rating panel */}
              <div id="srsRatingPanel" className="srs-rating-panel" style={{ display: 'none' }}></div>

              {/* Move list */}
              <div className="practice-moves-panel">
                <div className="practice-moves-header" id="practiceMovesHeader">Moves</div>
                <div className="practice-pgn-line" id="practiceMovePgn"></div>
                <div className="practice-move-list" id="practiceMoveList"></div>
              </div>

              {/* Related lines */}
              <div className="practice-moves-panel related-lines-panel">
                <div className="practice-moves-header">Related Lines</div>
                <div id="relatedLinesList">
                  <div className="related-empty">Select a variation to see related lines.</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="tab-content" id="tab-profile">
          <div className="profile-layout">
            <div className="profile-card">
              <div className="profile-avatar-big">&#9822;</div>
              <div className="profile-info-home">
                <div className="profile-display-name">Account &amp; Identity</div>
                <p className="hero-sub" style={{ marginTop: '8px' }}>
                  Use the account button in the top-right corner to sign in with Google or continue with email.
                  Your chess ramp preferences stay synced on this device for the signed-in account.
                </p>
                <button type="button" className="btn-full auth-launch-btn" id="openAuthFromProfile">
                  Open Account Center
                </button>
              </div>
            </div>
            <div className="profile-card stats-card">
              <h3>Why sign in?</h3>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-num">&#9889;</div>
                  <div className="stat-label">Saved profile</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num">&#9993;</div>
                  <div className="stat-label">Email sign-in</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num">&#71;</div>
                  <div className="stat-label">Google option</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num">&#128202;</div>
                  <div className="stat-label">Local session</div>
                </div>
              </div>
              <p className="no-data">Home still manages your display name, engine depth, and linked chess accounts.</p>
            </div>
          </div>
        </div>

        <div className="tab-content" id="tab-support">
          <div className="support-layout">
            <div className="support-hero">
              <div className="support-badge">Feedback</div>
              <h2 className="support-title">Help us improve chess ramp</h2>
              <p className="support-subtitle">
                Share ideas, report bugs, and help shape the next features for analyze, review, practice, and game study.
              </p>
              <div className="support-actions">
                <button type="button" className="hero-btn primary" id="openFeedbackModal">
                  Send Feedback
                </button>
                <button type="button" className="hero-btn secondary" id="copySupportLinkBtn">
                  Copy feedback link
                </button>
              </div>
            </div>

            <div className="support-grid">
              <div className="support-card">
                <div className="support-card-icon">&#9889;</div>
                <div className="support-card-title">Feature Requests</div>
                <p className="support-card-text">
                  Tell us what would make analysis, game review, or practice more useful for your workflow.
                </p>
                <button type="button" className="btn-full support-card-btn" data-feedback-category="feature">
                  Request a Feature
                </button>
              </div>

              <div className="support-card">
                <div className="support-card-icon">&#128027;</div>
                <div className="support-card-title">Bug Reports</div>
                <p className="support-card-text">
                  Found something broken or inaccurate? Send the issue with the steps so we can reproduce it quickly.
                </p>
                <button type="button" className="btn-full support-card-btn" data-feedback-category="bug">
                  Report a Bug
                </button>
              </div>

              <div className="support-card">
                <div className="support-card-icon">&#128172;</div>
                <div className="support-card-title">General Feedback</div>
                <p className="support-card-text">
                  Share what you like, what feels slow, and what should be improved next.
                </p>
                <button type="button" className="btn-full support-card-btn" data-feedback-category="other">
                  Share Feedback
                </button>
              </div>
            </div>

            <div className="support-info-grid">
              <div className="support-panel">
                <div className="support-panel-title">How you can help</div>
                <div className="support-list">
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>Use feedback to suggest the next review, opening, and board improvements.</span>
                  </div>
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>Share chess ramp with your chess friends, coaches, and study groups.</span>
                  </div>
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>Report Stockfish, UI, and game-review issues with exact steps to reproduce.</span>
                  </div>
                </div>
              </div>

              <div className="support-panel">
                <div className="support-panel-title">What your feedback should include</div>
                <div className="support-list">
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>The page you were using: Analyze, Games, Practice, Import, or Database.</span>
                  </div>
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>What you expected to happen and what actually happened.</span>
                  </div>
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>Any PGN, position, username, or move sequence that reproduces the issue.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tab-content" id="tab-pricing">
          <div className="pricing-layout">
            <div className="pricing-hero">
              <div className="support-badge">Pricing</div>
              <h2 className="support-title">Choose Your Plan</h2>
              <p className="support-subtitle">
                Start for free with full analysis tools. Upgrade to unlock 5 million puzzles and opening practice.
              </p>
            </div>

            <div className="pricing-grid">
              <div className="pricing-card">
                <div className="pricing-card-badge">Free</div>
                <div className="pricing-card-price">
                  <span className="pricing-amount">$0</span>
                  <span className="pricing-period">forever</span>
                </div>
                <p className="pricing-card-desc">
                  No sign-up or login required. Jump straight into analysis.
                </p>
                <ul className="pricing-features">
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Full chess analysis engine
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Import &amp; review games (PGN / FEN)
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Game report with accuracy %
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Board themes &amp; piece styles
                  </li>
                  <li className="pricing-feature is-excluded">
                    <span className="pricing-feature-icon">&#10007;</span>
                    Puzzles (5M+ database)
                  </li>
                  <li className="pricing-feature is-excluded">
                    <span className="pricing-feature-icon">&#10007;</span>
                    Practice openings (380 openings)
                  </li>
                  <li className="pricing-feature is-excluded">
                    <span className="pricing-feature-icon">&#10007;</span>
                    Daily puzzle &amp; streak tracking
                  </li>
                  <li className="pricing-feature is-excluded">
                    <span className="pricing-feature-icon">&#10007;</span>
                    Puzzle Survival mode
                  </li>
                </ul>
                <button type="button" className="pricing-cta pricing-cta-free">Current Plan</button>
              </div>

              <div className="pricing-card is-featured">
                <div className="pricing-card-popular">Most Popular</div>
                <div className="pricing-card-badge">Monthly</div>
                <div className="pricing-card-price">
                  <span className="pricing-amount">$4.99</span>
                  <span className="pricing-period" id="pricingMonthlyPeriod">/ month</span>
                </div>
                <p className="pricing-card-desc">
                  Unlock the full experience with puzzles and opening practice.
                </p>
                <ul className="pricing-features">
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Everything in Free
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    5 million+ puzzles by theme &amp; rating
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Practice 380 openings &amp; 4,235 variations
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Daily puzzle with streak tracking
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Puzzle Survival (Puzzle Rush)
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Custom puzzles — filter by 74 themes
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Puzzle Elo rating with mismatch protection
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Speed bonus rewards
                  </li>
                </ul>
                <button type="button" className="pricing-cta pricing-cta-monthly">Get Started</button>
              </div>

              <div className="pricing-card is-yearly">
                <div className="pricing-card-badge">Yearly</div>
                <div className="pricing-card-price">
                  <span className="pricing-amount">$19.99</span>
                  <span className="pricing-period">/ year</span>
                </div>
                <div className="pricing-yearly-breakdown">
                  That&apos;s just <strong>$1.67/mo</strong> &mdash; save 44%
                </div>
                <p className="pricing-card-desc">
                  Same full access as Monthly, billed once a year at the best price.
                </p>
                <ul className="pricing-features">
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Everything in Monthly
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    5 million+ puzzles by theme &amp; rating
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Practice 380 openings &amp; 4,235 variations
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Daily puzzle with streak tracking
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Puzzle Survival (Puzzle Rush)
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Custom puzzles — filter by 74 themes
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Puzzle Elo rating with mismatch protection
                  </li>
                  <li className="pricing-feature is-included">
                    <span className="pricing-feature-icon">&#10003;</span>
                    Best value — save 44% vs monthly
                  </li>
                </ul>
                <button type="button" className="pricing-cta pricing-cta-yearly">Get Started</button>
              </div>
            </div>

            <div className="pricing-faq">
              <div className="pricing-faq-title">Common questions</div>
              <div className="pricing-faq-grid">
                <div className="pricing-faq-item">
                  <div className="pricing-faq-q">Do I need to sign up for the free plan?</div>
                  <div className="pricing-faq-a">No. The free plan requires no account at all. Just open the app and start analyzing.</div>
                </div>
                <div className="pricing-faq-item">
                  <div className="pricing-faq-q">Can I switch between Monthly and Yearly?</div>
                  <div className="pricing-faq-a">Yes. You can upgrade, downgrade, or cancel anytime. Yearly savings apply immediately.</div>
                </div>
                <div className="pricing-faq-item">
                  <div className="pricing-faq-q">What&apos;s included in the puzzle database?</div>
                  <div className="pricing-faq-a">Over 5 million puzzles sourced from real games, spanning 74 tactical themes, all rating levels, and 1,500+ openings.</div>
                </div>
                <div className="pricing-faq-item">
                  <div className="pricing-faq-q">Is the analysis engine the same across all plans?</div>
                  <div className="pricing-faq-a">Yes. Every plan gets the same Stockfish analysis engine with full depth and multi-line support.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tab-content" id="tab-settings">
          <div className="settings-layout">
            <div className="settings-hero">
              <div className="support-badge">Settings</div>
              <h2 className="support-title">Customize your analysis setup</h2>
              <p className="support-subtitle">
                Tune Stockfish, board colors, piece style, and move sound. Changes apply across analysis, practice, and puzzle boards.
              </p>
            </div>

            <div className="settings-grid">
              <div className="settings-card settings-engine-card">
                <div className="settings-card-title">Stockfish Settings</div>
                <p className="settings-card-text">Control the engine strength and resource usage used for live analysis.</p>
                <div className="settings-engine-controls">
                  <div className="setting-row settings-engine-row">
                    <span>Stockfish</span>
                    <span className="settings-static-value">Stockfish</span>
                  </div>
                  <div className="slider-row settings-engine-row">
                    <span>Depth</span>
                    <input type="range" min="8" max="35" defaultValue="20" id="depthSlider" className="dark-slider" />
                    <span id="depthVal">20</span>
                  </div>
                  <div className="slider-row settings-engine-row">
                    <span>Threads</span>
                    <input type="range" min="1" max="16" defaultValue="2" id="threadsSlider" className="dark-slider" />
                    <span id="threadsVal">2</span>
                  </div>
                  <div className="slider-row settings-engine-row">
                    <span>Hash (MB)</span>
                    <input type="range" min="64" max="1024" step="64" defaultValue="256" id="hashSlider" className="dark-slider" />
                    <span id="hashVal">256</span>
                  </div>
                  <div className="setting-row toggle-row settings-engine-row">
                    <span>Analysis Mode</span>
                    <label className="toggle">
                      <input type="checkbox" id="analysisMode" defaultChecked />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">Appearance Mode</div>
                <p className="settings-card-text">Switch the whole website between dark and light mode for day and night use.</p>
                <select id="settingsColorMode" className="dark-select settings-select settings-native-select" defaultValue="dark">
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
                <div className="settings-visual-grid settings-mode-grid">
                  <button type="button" className="settings-option-card active" data-target="settingsColorMode" data-value="dark">
                    <div className="settings-mode-preview settings-mode-preview-dark">
                      <span className="settings-mode-icon">&#9790;</span>
                    </div>
                    <span className="settings-option-label">Dark</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsColorMode" data-value="light">
                    <div className="settings-mode-preview settings-mode-preview-light">
                      <span className="settings-mode-icon">&#9728;</span>
                    </div>
                    <span className="settings-option-label">Light</span>
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">Board Theme</div>
                <p className="settings-card-text">Pick the board color palette you want to use across the app.</p>
                <select id="settingsBoardTheme" className="dark-select settings-select settings-native-select" defaultValue="green">
                  <option value="green">Classic Green</option>
                  <option value="brown">Brown Wood</option>
                  <option value="blue">Blue Ice</option>
                  <option value="purple">Purple Dark</option>
                  <option value="red">Crimson</option>
                </select>
                <div className="settings-visual-grid">
                  <button type="button" className="settings-option-card active" data-target="settingsBoardTheme" data-value="green">
                    <div className="settings-preview-board theme-green">
                      <span className="preview-piece preview-white">♘</span>
                      <span className="preview-piece preview-black">♞</span>
                    </div>
                    <span className="settings-option-label">Classic Green</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="brown">
                    <div className="settings-preview-board theme-brown">
                      <span className="preview-piece preview-white">♘</span>
                      <span className="preview-piece preview-black">♞</span>
                    </div>
                    <span className="settings-option-label">Brown Wood</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="blue">
                    <div className="settings-preview-board theme-blue">
                      <span className="preview-piece preview-white">♘</span>
                      <span className="preview-piece preview-black">♞</span>
                    </div>
                    <span className="settings-option-label">Blue Ice</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="purple">
                    <div className="settings-preview-board theme-purple">
                      <span className="preview-piece preview-white">♘</span>
                      <span className="preview-piece preview-black">♞</span>
                    </div>
                    <span className="settings-option-label">Purple Dark</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsBoardTheme" data-value="red">
                    <div className="settings-preview-board theme-red">
                      <span className="preview-piece preview-white">♘</span>
                      <span className="preview-piece preview-black">♞</span>
                    </div>
                    <span className="settings-option-label">Crimson</span>
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">Piece Style</div>
                <p className="settings-card-text">Switch between six piece looks and use the one you prefer.</p>
                <select id="settingsPieceStyle" className="dark-select settings-select settings-native-select" defaultValue="classic">
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                  <option value="glass">Glass</option>
                  <option value="minimal">Minimal</option>
                  <option value="outline">Outline</option>
                  <option value="bold">Bold</option>
                </select>
                <div className="settings-visual-grid settings-piece-grid">
                  <button type="button" className="settings-option-card active" data-target="settingsPieceStyle" data-value="classic">
                    <div className="settings-preview-piece style-classic">
                      <span className="preview-piece preview-white">♕</span>
                      <span className="preview-piece preview-black">♛</span>
                    </div>
                    <span className="settings-option-label">Classic</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="modern">
                    <div className="settings-preview-piece style-modern">
                      <span className="preview-piece preview-white">♕</span>
                      <span className="preview-piece preview-black">♛</span>
                    </div>
                    <span className="settings-option-label">Modern</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="glass">
                    <div className="settings-preview-piece style-glass">
                      <span className="preview-piece preview-white">♕</span>
                      <span className="preview-piece preview-black">♛</span>
                    </div>
                    <span className="settings-option-label">Glass</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="minimal">
                    <div className="settings-preview-piece style-minimal">
                      <span className="preview-piece preview-white">♕</span>
                      <span className="preview-piece preview-black">♛</span>
                    </div>
                    <span className="settings-option-label">Minimal</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="outline">
                    <div className="settings-preview-piece style-outline">
                      <span className="preview-piece preview-white">♕</span>
                      <span className="preview-piece preview-black">♛</span>
                    </div>
                    <span className="settings-option-label">Outline</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsPieceStyle" data-value="bold">
                    <div className="settings-preview-piece style-bold">
                      <span className="preview-piece preview-white">♕</span>
                      <span className="preview-piece preview-black">♛</span>
                    </div>
                    <span className="settings-option-label">Bold</span>
                  </button>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">Move Sound</div>
                <p className="settings-card-text">Play a sound for accepted moves across Analyze, Practice, and Puzzles.</p>
                <div className="setting-row toggle-row settings-sound-row">
                  <span>Move sound</span>
                  <label className="toggle">
                    <input type="checkbox" id="settingsMoveSound" />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-sound-label" style={{ marginTop: '16px', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Sound Style</div>
                <select id="settingsSoundStyle" className="dark-select settings-select settings-native-select" defaultValue="classic">
                  <option value="classic">Classic Tick</option>
                  <option value="premium">Premium Chime</option>
                  <option value="glass">Glass Bell</option>
                </select>
                <div className="settings-visual-grid settings-sound-grid" style={{ marginTop: '12px' }}>
                  <button type="button" className="settings-option-card active" data-target="settingsSoundStyle" data-value="classic">
                    <div className="settings-sound-preview">
                      <span style={{ fontSize: '24px' }}>🎵</span>
                    </div>
                    <span className="settings-option-label">Classic</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsSoundStyle" data-value="premium">
                    <div className="settings-sound-preview">
                      <span style={{ fontSize: '24px' }}>✨</span>
                    </div>
                    <span className="settings-option-label">Premium</span>
                  </button>
                  <button type="button" className="settings-option-card" data-target="settingsSoundStyle" data-value="glass">
                    <div className="settings-sound-preview">
                      <span style={{ fontSize: '24px' }}>🔔</span>
                    </div>
                    <span className="settings-option-label">Glass Bell</span>
                  </button>
                </div>
                <div className="settings-sound-note">
                  Choose your preferred sound style. All options stay on during autoplay, opponent replies, and puzzle continuation.
                </div>
              </div>
            </div>

            <div className="support-info-grid">
              <div className="support-panel">
                <div className="support-panel-title">Theme notes</div>
                <div className="support-list">
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>`Classic Green` and `Brown Wood` match traditional chessboard colors.</span>
                  </div>
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>`Blue Ice`, `Purple Dark`, and `Crimson` give higher contrast visual styles.</span>
                  </div>
                </div>
              </div>

              <div className="support-panel">
                <div className="support-panel-title">Piece style notes</div>
                <div className="support-list">
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>`Classic` and `Bold` are easiest to read quickly during review.</span>
                  </div>
                  <div className="support-list-item">
                    <span className="support-list-dot"></span>
                    <span>`Minimal`, `Outline`, and `Glass` are better if you want a cleaner visual style.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* ── Player Analyze Tab ── */}
        <div className="tab-content" id="tab-player-analyze">
          <div className="pa-layout">

            {/* Hero search */}
            <div className="pa-hero">
              <h1 className="pa-hero-title">Player Analyze</h1>
              <p className="pa-hero-sub">Find rating leaks, opening weaknesses, and recurring loss patterns from recent games</p>
              <div className="pa-search-row">
                <input type="text" id="paUsernameInput" className="pa-search-input"
                  placeholder="Enter Chess.com username..." autoComplete="off" />
                <button type="button" id="paAnalyzeBtn" className="pa-search-btn">Analyze &#9889;</button>
              </div>
            </div>

            {/* Loading */}
            <div id="paLoading" className="pa-loading" style={{ display: 'none' }}>
              <div className="pa-loading-knight">&#9822;</div>
              <p>Loading player data...</p>
              <p className="pa-loading-sub">Fetching up to 12 months of games from Chess.com API</p>
            </div>

            {/* Error */}
            <div id="paError" className="pa-error-box" style={{ display: 'none' }}>
              <span className="pa-error-icon">&#9888;</span>
              <span id="paErrorMsg">Player not found</span>
            </div>

            {/* Content */}
            <div id="paContent" style={{ display: 'none' }}>

              {/* Profile Header */}
              <div id="paProfileHeader"></div>

              {/* Key Metrics Row */}
              <div id="paKeyMetrics" className="pa-metrics-row"></div>

              {/* Controls */}
              <div className="pa-controls-row">
                <div className="pa-tab-group">
                  <button className="pa-tc-btn active" data-tc="rapid">Rapid</button>
                  <button className="pa-tc-btn" data-tc="blitz">Blitz</button>
                  <button className="pa-tc-btn" data-tc="bullet">Bullet</button>
                  <button className="pa-tc-btn" data-tc="all">All</button>
                </div>
                <div className="pa-tab-group">
                  <button className="pa-period-btn active" data-period="30">30 days</button>
                  <button className="pa-period-btn" data-period="60">60 days</button>
                  <button className="pa-period-btn" data-period="90">90 days</button>
                  <button className="pa-period-btn" data-period="365">12 months</button>
                </div>
              </div>

              {/* Summary bar */}
              <div id="paSummaryBar" className="pa-summary-bar"></div>

              {/* Performance Insights */}
              <div id="paInsights" className="pa-insights-card pa-card pa-mt"></div>

              {/* Game Results dual-ring donut */}
              <div id="paGameResults" className="pa-card pa-mt"></div>

              {/* ── PERFORMANCE VITALS ── */}
              <div className="pa-section-hdr">
                <div className="pa-sec-icon">&#128200;</div>
                <div><h2 className="pa-sec-title">Performance Vitals</h2><p className="pa-sec-sub">Your momentum at a glance</p></div>
              </div>
              <div className="pa-vitals-grid">
                <div id="paWLDCard" className="pa-card"></div>
                <div id="paRatingCard" className="pa-card"></div>
              </div>
              <div id="paByDayCard" className="pa-card pa-mt"></div>
              <div id="paStreaksCard" className="pa-card pa-mt"></div>

              {/* ── PERFORMANCE BREAKDOWN ── */}
              <div className="pa-section-hdr">
                <div className="pa-sec-icon">&#128202;</div>
                <div><h2 className="pa-sec-title">Performance Breakdown</h2><p className="pa-sec-sub">Win rates across time controls, days &amp; months</p></div>
              </div>
              <div className="pa-two-col">
                <div id="paByTCCard" className="pa-card"></div>
                <div id="paByDOWCard" className="pa-card"></div>
              </div>
              <div id="paMonthlyCard" className="pa-card pa-mt"></div>

              {/* ── RATING ANALYSIS ── */}
              <div className="pa-section-hdr">
                <div className="pa-sec-icon">&#11088;</div>
                <div><h2 className="pa-sec-title">Rating Analysis</h2><p className="pa-sec-sub">Your rating journey with moving averages &amp; opponent breakdown</p></div>
              </div>
              <div id="paRatingProgCard" className="pa-card"></div>
              <div className="pa-two-col pa-mt">
                <div id="paRatingDiffCard" className="pa-card"></div>
                <div id="paOppStrengthCard" className="pa-card"></div>
              </div>

              {/* ── GAME PATTERNS ── */}
              <div className="pa-section-hdr">
                <div className="pa-sec-icon">&#127919;</div>
                <div><h2 className="pa-sec-title">Game Patterns</h2><p className="pa-sec-sub">Result breakdowns &amp; win streak analysis</p></div>
              </div>
              <div className="pa-two-col">
                <div id="paResultBreakdown" className="pa-card"></div>
                <div id="paStreakDist" className="pa-card"></div>
              </div>

              {/* ── PRO COACHING ── */}
              <div className="pa-section-hdr">
                <div className="pa-sec-icon">&#129504;</div>
                <div><h2 className="pa-sec-title">Pro Coaching Modules</h2><p className="pa-sec-sub">What a real coach would tell you</p></div>
              </div>
              <div className="pa-two-col">
                <div id="paHeadToHead" className="pa-card"></div>
                <div id="paRadarCard" className="pa-card"></div>
              </div>

              {/* ── OPENING REPERTOIRE ── */}
              <div id="paOpenings" className="pa-card pa-mt"></div>

              {/* ── ANATOMY OF A LOSS ── */}
              <div id="paLossAnalysis" className="pa-card pa-mt"></div>

            </div>
          </div>
        </div>

      <div className="modal-overlay feedback-modal-overlay" id="feedbackModal" style={{ display: 'none' }}>
        <div className="modal feedback-modal">
          <div className="modal-header feedback-modal-header">
            <div>
              <h3>Your feedback matters</h3>
              <p className="feedback-modal-subtitle">Help us improve chess ramp. What&apos;s on your mind?</p>
            </div>
            <button type="button" className="modal-close" id="feedbackModalClose" aria-label="Close feedback window">
              &#10005;
            </button>
          </div>

          <div className="feedback-form">
            <div className="feedback-label">Category</div>
            <div className="feedback-category-grid" id="feedbackCategoryGrid">
              <button type="button" className="feedback-category-btn active" data-category="feature">
                <span className="feedback-category-icon">&#9889;</span>
                <span className="feedback-category-text">Feature</span>
              </button>
              <button type="button" className="feedback-category-btn" data-category="bug">
                <span className="feedback-category-icon">&#128027;</span>
                <span className="feedback-category-text">Bug</span>
              </button>
              <button type="button" className="feedback-category-btn" data-category="other">
                <span className="feedback-category-icon">&#128172;</span>
                <span className="feedback-category-text">Other</span>
              </button>
            </div>

            <div className="feedback-label">Message</div>
            <div className="feedback-textarea-wrap">
              <textarea
                id="feedbackMessage"
                className="feedback-textarea"
                maxLength="1000"
                placeholder="I noticed that..."
                defaultValue=""
              ></textarea>
              <div className="feedback-counter"><span id="feedbackCharCount">0</span>/1000</div>
            </div>

            <div className="feedback-actions">
              <button type="button" className="feedback-cancel-btn" id="feedbackCancelBtn">
                Cancel
              </button>
              <button type="button" className="feedback-send-btn" id="feedbackSendBtn">
                Send Feedback &#10148;
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-overlay auth-modal-overlay" id="authModal" style={{ display: 'none' }}>
        <div className="modal auth-modal">
          <div className="modal-header">
            <div>
              <h3>Account Center</h3>
              <p className="feedback-modal-subtitle">Sign in with Google or continue with email on this device.</p>
            </div>
            <button type="button" className="modal-close" id="authModalClose" aria-label="Close account center">
              &#10005;
            </button>
          </div>

          <div className="auth-signed-in-view" id="authSignedInView" style={{ display: 'none' }}>
            <div className="auth-session-card">
              <div className="auth-session-label">Signed in as</div>
              <div className="auth-session-name" id="authSessionName">Guest</div>
              <div className="auth-session-email" id="authSessionEmail">guest@example.com</div>
              <div className="auth-session-provider" id="authSessionProvider">Email</div>
            </div>
            <div className="auth-actions-row">
              <button type="button" className="btn-full" id="authManageProfileBtn">
                Open Home Profile
              </button>
              <button type="button" className="feedback-cancel-btn auth-signout-btn" id="authSignOutBtn">
                Sign Out
              </button>
            </div>
          </div>

          <div className="auth-signed-out-view" id="authSignedOutView">
            <div className="auth-tabs">
              <button type="button" className="auth-tab-btn active" id="authTabSignIn">
                Sign In
              </button>
              <button type="button" className="auth-tab-btn" id="authTabSignUp">
                Sign Up
              </button>
            </div>

            <div className="auth-google-card">
              <button type="button" className="btn-full auth-google-trigger" id="authGoogleTrigger">
                Continue with Gmail
              </button>
            </div>

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>

            <div className="auth-panel" id="authPanelSignIn">
              <div className="form-group">
                <label htmlFor="authSignInEmail">Email</label>
                <input
                  type="email"
                  id="authSignInEmail"
                  className="dark-input full-width"
                  placeholder="you@example.com"
                  defaultValue=""
                />
              </div>
              <div className="form-group">
                <label htmlFor="authSignInPassword">Password</label>
                <input
                  type="password"
                  id="authSignInPassword"
                  className="dark-input full-width"
                  placeholder="Enter password"
                  defaultValue=""
                />
              </div>
              <button type="button" className="btn-full" id="authEmailSignInBtn">
                Sign In with Email
              </button>
            </div>

            <div className="auth-panel" id="authPanelSignUp" style={{ display: 'none' }}>
              <div className="form-group">
                <label htmlFor="authSignUpName">Display Name</label>
                <input
                  type="text"
                  id="authSignUpName"
                  className="dark-input full-width"
                  placeholder="Your name"
                  defaultValue=""
                />
              </div>
              <div className="form-group">
                <label htmlFor="authSignUpEmail">Email</label>
                <input
                  type="email"
                  id="authSignUpEmail"
                  className="dark-input full-width"
                  placeholder="you@example.com"
                  defaultValue=""
                />
              </div>
              <div className="form-group">
                <label htmlFor="authSignUpPassword">Password</label>
                <input
                  type="password"
                  id="authSignUpPassword"
                  className="dark-input full-width"
                  placeholder="Create password"
                  defaultValue=""
                />
              </div>
              <button type="button" className="btn-full" id="authEmailSignUpBtn">
                Create Account
              </button>
            </div>

            <div className="auth-status-message" id="authStatusMessage"></div>
          </div>
        </div>
      </div>

      <div className="modal-overlay review-progress-overlay" id="reviewProgressOverlay" style={{ display: 'none' }}>
        <div className="modal review-progress-card" id="reviewProgressCard" role="status" aria-live="polite" aria-busy="true">
          <div className="review-progress-knight" aria-hidden="true">&#9822;</div>
          <div className="review-progress-text" id="reviewProgressText">Review in progress</div>
        </div>
      </div>

      <div id="toast" className="toast"></div>
    </>
  );
}

export default App;
