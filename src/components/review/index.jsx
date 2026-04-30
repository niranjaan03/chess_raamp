import React from 'react';

export function ClockBadge({ clockId }) {
  return (
    <div className="player-clock review-clock-badge" id={clockId} hidden></div>
  );
}

export function CapturedPiecesRow({ capturedId, materialId }) {
  return (
    <div className="review-captured-row">
      <div className="review-captured-pieces" id={capturedId}></div>
      <span className="review-material-advantage" id={materialId}></span>
    </div>
  );
}

export function PlayerInfoBar({
  side,
  avatar,
  nameId,
  ratingId,
  flagId,
  capturedId,
  materialId,
  clockId,
  defaultName
}) {
  return (
    <div className={`player-info review-player-strip ${side}`} data-player-color={side === 'white' ? 'w' : 'b'}>
      <div className={`player-avatar ${side}`}>{avatar}</div>
      <div className="review-player-main">
        <div className="review-player-identity">
          <div className="review-player-name-line">
            <span className="player-name" id={nameId}>{defaultName}</span>
            <span className="review-player-flag" id={flagId} hidden></span>
            <span className="player-rating" id={ratingId}></span>
          </div>
        </div>
        <CapturedPiecesRow capturedId={capturedId} materialId={materialId} />
      </div>
      <ClockBadge clockId={clockId} />
    </div>
  );
}

export function MoveNavigationControls({ compact = false }) {
  return (
    <div className={`nav-controls review-nav-controls${compact ? ' is-compact' : ''}`}>
      <button type="button" className="nav-btn" id="btnFirst" aria-label="First move">&#171;</button>
      <button type="button" className="nav-btn" id="btnPrev" aria-label="Previous move">&#8249;</button>
      <button type="button" className="nav-btn" id="btnPlay" aria-label="Play game">&#9654;</button>
      <button type="button" className="nav-btn" id="btnNext" aria-label="Next move">&#8250;</button>
      <button type="button" className="nav-btn" id="btnLast" aria-label="Last move">&#187;</button>
      <button type="button" className="nav-btn review-menu-btn" id="reviewPanelMenu" aria-label="Open engine settings">&#8942;</button>
    </div>
  );
}

export function ReviewTabs() {
  return (
    <div className="gr-tabs review-tabs" role="tablist" aria-label="Game review views">
      <button type="button" className="gr-tab" id="grReportTab" data-review-tab="report">Report</button>
      <button type="button" className="gr-tab active" id="grAnalyzeTab" data-review-tab="analyze">Analysis</button>
      <button type="button" className="gr-tab" id="grSettingsTab" data-review-tab="settings">Settings</button>
    </div>
  );
}

export function AccuracySummary() {
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

export function MoveQualityBreakdown() {
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

export function LearnFromMistakesCard({ currentUser, opponent, criticalMoves = [], onMoveClick }) {
  const qualityIcon = { inaccuracy: '?!', mistake: '?', blunder: '??' };
  const qualityLabel = { inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder' };
  const renderCountBadge = (quality, count, label) => (
    <span className={`learn-count-badge is-${quality}`}>
      <strong>{count || 0}</strong>
      <span className={`qi qi-${quality}`}>{qualityIcon[quality]}</span>
      <span className="learn-count-label">{label}</span>
    </span>
  );
  const renderInlineBadge = (quality, count) => (
    <span className={`learn-inline-badge is-${quality}`}>
      <strong>{count || 0}</strong>
      <span className={`qi qi-${quality}`}>{qualityIcon[quality]}</span>
    </span>
  );
  const renderPlayerRow = (player, isOpponent) => (
    <div className={`learn-player-row ${isOpponent ? 'is-opponent' : 'is-current'}`}>
      <span className="learn-player-avatar" aria-hidden="true">{player?.color === 'black' ? '♜' : '♖'}</span>
      <span className="learn-player-name">{player?.username || (player?.color === 'black' ? 'Black' : 'White')}</span>
      <span className="learn-player-counts">
        {(!isOpponent || player?.mistakes > 0 || !player?.blunders) && renderInlineBadge('mistake', player?.mistakes || 0)}
        {(!isOpponent || (player?.mistakes > 0 && player?.blunders > 0)) && <span className="learn-count-divider"></span>}
        {(!isOpponent || player?.blunders > 0) && renderInlineBadge('blunder', player?.blunders || 0)}
      </span>
    </div>
  );

  return (
    <div className="learn-mistakes-card">
      <div className="learn-mistakes-head"><span className="learn-mistakes-dot"></span><span>Coach Ramp Review</span></div>
      <div className="learn-mistakes-layout">
        <div className="learn-mistakes-copy">
          <h3>Repair the turning points.</h3>
          <div className="learn-mistakes-summary">
            <span>We found</span>
            {renderCountBadge('mistake', currentUser?.mistakes || 0, 'mistakes')}
            <span>and</span>
            {renderCountBadge('blunder', currentUser?.blunders || 0, 'blunders')}
            <span>worth replaying before your next game.</span>
          </div>
        </div>
        <div className="learn-mistakes-chips">
          {criticalMoves.slice(0, 3).map((move, index) => (
            <button
              key={`${move.ply || index}-${move.san || ''}`}
              type="button"
              className={`learn-move-chip is-${move.quality} ${index === 0 ? 'is-tilt-left' : index === 1 ? 'is-flat' : 'is-tilt-right'}`}
              onClick={() => onMoveClick && onMoveClick(move)}
              title={qualityLabel[move.quality] || move.quality}
            >
              <span className="learn-move-chip-index">0{index + 1}</span>
              <span className={`qi qi-${move.quality}`}>{qualityIcon[move.quality]}</span>
              <span>{move.san}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="learn-player-rows">
        {renderPlayerRow(opponent, true)}
        {renderPlayerRow(currentUser, false)}
      </div>
    </div>
  );
}

export function CriticalMomentsPanel() {
  return (
    <section className="review-card critical-card" id="grCriticalCard" style={{ display: 'none' }}>
      <div id="grCriticalMoments" className="critical-moments-list">
        <div className="gr-analysis-empty">Run full analysis to see critical positions.</div>
      </div>
    </section>
  );
}

export function CoachRampPanel() {
  return (
    <section className="coach-ramp-hero" id="grCoachTip" data-mood="idle">
      <div className="coach-ramp-stage">
        <div className="coach-ramp-avatar" aria-hidden="true">
          <svg className="coach-ramp-portrait" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <clipPath id="crClip"><circle cx="70" cy="70" r="68" /></clipPath>
              <linearGradient id="crBg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#25313a" />
                <stop offset="100%" stopColor="#1b242c" />
              </linearGradient>
            </defs>
            <g clipPath="url(#crClip)">
              <rect width="140" height="140" fill="url(#crBg)" />
              <path d="M70 30 C54 30 44 42 44 58 L44 64 C44 66 45 68 47 68 L93 68 C95 68 96 66 96 64 L96 58 C96 42 86 30 70 30 Z" fill="#4a3326" />
              <path d="M70 28 C78 28 85 31 90 36 C88 33 82 28 70 28 Z" fill="#3a281c" />
              <ellipse cx="70" cy="72" rx="22" ry="24" fill="#f2caa6" />
              <path d="M48 70 C48 88 56 104 70 104 C84 104 92 88 92 70 C92 72 88 90 70 92 C52 90 48 72 48 70 Z" fill="#4a3326" />
              <path d="M50 62 C50 56 56 52 62 54 L62 58 C58 57 54 60 54 64 Z" fill="#4a3326" />
              <path d="M90 62 C90 56 84 52 78 54 L78 58 C82 57 86 60 86 64 Z" fill="#4a3326" />
              <rect x="51" y="62" width="14" height="12" rx="3.5" fill="rgba(255,255,255,0.12)" stroke="#1b1b1b" strokeWidth="1.8" />
              <rect x="75" y="62" width="14" height="12" rx="3.5" fill="rgba(255,255,255,0.12)" stroke="#1b1b1b" strokeWidth="1.8" />
              <line x1="65" y1="68" x2="75" y2="68" stroke="#1b1b1b" strokeWidth="1.6" />
              <circle cx="58" cy="68" r="2.2" fill="#1b1b1b" />
              <circle cx="82" cy="68" r="2.2" fill="#1b1b1b" />
              <path d="M62 86 Q70 90 78 86" stroke="#b57657" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M44 96 C50 110 60 116 70 116 C80 116 90 110 96 96 L108 140 L32 140 Z" fill="#3b5261" />
              <path d="M60 102 L60 140 L80 140 L80 102 L70 108 Z" fill="#f6f6f6" />
              <path d="M64 102 L70 108 L76 102 L70 100 Z" fill="#2e404b" />
            </g>
            <circle cx="70" cy="70" r="68" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          </svg>
          <span className="coach-ramp-avatar-badge">
            <span className="crab-dot"></span>
            Coach Ramp
          </span>
        </div>

        <div className="review-feedback-stack">
          <div className="coach-ramp-bubble review-feedback-bubble" id="grCoachBubble" aria-live="polite">
            <span className="coach-ramp-tail" aria-hidden="true"></span>
            <div className="review-feedback-main">
              <span className="coach-ramp-quality-pill review-feedback-quality" id="grCoachQuality">
                <span className="crqp-icon qi" id="grCoachQualityIcon">?</span>
                <span className="crqp-label" id="grCoachTitle">Awaiting analysis</span>
              </span>
              <span className="review-feedback-eval" id="grReviewEvalBadge">--</span>
            </div>
            <span className="coach-ramp-move-label review-feedback-move" id="grCoachMoveLabel"></span>
            <p className="coach-ramp-headline review-feedback-copy" id="grCoachHeadline">
              Run a full analysis to unlock move feedback.
            </p>
            <p className="coach-ramp-text review-feedback-copy" id="grCoachText">
              Run a full analysis to unlock personalized move-by-move coaching.
            </p>
            <div className="coach-ramp-tips review-feedback-copy" id="grCoachTips"></div>
          </div>

          <div className="review-feedback-actions is-best-hidden" id="grReviewActions" aria-label="Move feedback actions">
            <button type="button" className="review-feedback-btn is-best" id="grReviewBestBtn" aria-label="Show best move" disabled>
              <span className="review-feedback-btn-icon">&#9733;</span>
              <span>Best</span>
            </button>
            <button type="button" className="review-feedback-btn is-try" id="grReviewTryAgainBtn" aria-label="Try again" disabled>
              <span className="review-feedback-btn-icon">&#8634;</span>
              <span>Try Again</span>
            </button>
            <button type="button" className="review-feedback-btn is-forward" id="grReviewNextBtn" aria-label="Next review move" disabled>
              <span className="review-feedback-btn-icon">&#8594;</span>
            </button>
          </div>
        </div>
      </div>

      <div className="coach-ramp-timeline" id="grCoachTimeline">
        <div className="crt-rail" id="grCoachTimelineRail">
          <canvas className="crt-graph" id="grCoachTimelineGraph" width="1000" height="92"></canvas>
          <div className="crt-midline"></div>
          <div className="crt-dots" id="grCoachTimelineDots"></div>
          <div className="crt-cursor" id="grCoachTimelineCursor"></div>
        </div>
        <div className="crt-players">
          <span className="crt-player-name" id="grCoachTlWhite">White Player</span>
          <span className="crt-player-hint" id="grCoachTlHint">Step through moves to hear the coach</span>
          <span className="crt-player-name is-black" id="grCoachTlBlack">Black Player</span>
        </div>
      </div>
    </section>
  );
}

export function AnalysisPanel() {
  return (
    <div className="gr-tab-panel gr-analyze-panel active" id="grAnalyzePanel">
      <section className="analysis-workspace-panel" aria-label="Engine analysis">
        <div className="analysis-score-header">
          <div className="analysis-score-left">
            <button type="button" className="analysis-confirm-toggle" aria-label="Engine enabled">
              <span>&#10003;</span>
            </button>
            <div className="analysis-score-stack">
              <div className="eval-score analysis-eval-score" id="evalScore">+0.00</div>
              <div className="analysis-score-caption">
                Best move <span id="bestMoveDisplay">—</span>
              </div>
            </div>
          </div>
          <div className="analysis-depth-block">
            <span className="analysis-depth-plus">+</span>
            <span className="analysis-depth-main">Depth <strong id="evalDepth">0</strong></span>
            <span className="analysis-engine-name" id="analysisEngineName">Stockfish 18 Browser</span>
            <span className="analysis-engine-nodes" id="evalNodes">0</span>
          </div>
          <button type="button" className="analysis-settings-btn" id="analysisSettingsGear" aria-label="Open engine settings">&#9881;</button>
        </div>
        <div className="analysis-glow-divider"></div>

        <div className="analysis-lines-head">
          <div>
            <span className="analysis-section-kicker">Engine Lines</span>
            <span className="analysis-position-label" id="grAnalysisPositionLabel">Current position</span>
          </div>
          <div className="analysis-lines-head-actions">
            <button
              type="button"
              id="exitEnginePreviewBtn"
              className="exit-engine-preview-btn"
              onClick={() => window.AppController && window.AppController.exitEnginePreview && window.AppController.exitEnginePreview()}
              hidden
            >
              ← Back to game
            </button>
            <span className="lines-summary" id="engineLinesSummary">All available</span>
          </div>
        </div>

        <div className="analysis-lines-stack" id="linesContainer">
          <div className="engine-lines-skeleton">
            <div className="line-item loading skeleton-line-row"><span className="skeleton-chip"></span><span className="skeleton-line w-70"></span><span className="skeleton-chip small"></span></div>
            <div className="line-item loading skeleton-line-row"><span className="skeleton-chip"></span><span className="skeleton-line w-62"></span><span className="skeleton-chip small"></span></div>
            <div className="line-item loading skeleton-line-row"><span className="skeleton-chip"></span><span className="skeleton-line w-76"></span><span className="skeleton-chip small"></span></div>
          </div>
        </div>

        <div className="analysis-review-candidates" id="grAnalysisCandidates" hidden></div>
      </section>

      <section className="analysis-history-card">
        <div className="analysis-player-card">
          <div className="analysis-player-side">
            <span className="analysis-player-dot is-white"></span>
            <div>
              <div className="analysis-player-name">
                <span id="analysisWhiteName">White Player</span>
                <span className="analysis-player-flag" id="analysisWhiteFlag"></span>
              </div>
              <div className="analysis-player-rating" id="analysisWhiteRating"></div>
            </div>
          </div>
          <div className="analysis-result-pill" id="analysisGameResult">*</div>
          <div className="analysis-player-side is-black">
            <span className="analysis-player-dot is-black"></span>
            <div>
              <div className="analysis-player-name">
                <span id="analysisBlackFlag" className="analysis-player-flag"></span>
                <span id="analysisBlackName">Black Player</span>
              </div>
              <div className="analysis-player-rating" id="analysisBlackRating"></div>
            </div>
          </div>
        </div>

        <div className="analysis-move-history-head">
          <span>Move History</span>
          <span className="analysis-history-hint">Quality badges appear after full analysis</span>
        </div>
        <div className="moves-list analysis-move-list" id="movesList"></div>
      </section>
    </div>
  );
}

export function EngineSettingsModal() {
  const engineOptions = (
    <>
      <option value="sf18">Stockfish 18 Browser</option>
      <option value="sf18-lite">Stockfish 18 Lite Browser</option>
      <option value="sf18-full">Stockfish 18 Full Browser</option>
      <option value="sf17-1-lite">Stockfish 17.1 Lite Browser</option>
      <option value="sf17-1-full">Stockfish 17.1 Full Browser</option>
      <option value="sf17-lite">Stockfish 17 Lite Browser</option>
      <option value="sf17-full">Stockfish 17 Full Browser</option>
      <option value="sf16-1-lite">Stockfish 16.1 Lite Browser</option>
      <option value="sf16-1-full">Stockfish 16.1 Full Browser</option>
      <option value="sf16-nnue">Stockfish 16 NNUE Browser</option>
    </>
  );

  return (
    <div className="engine-settings-overlay" id="engineSettingsOverlay" hidden>
      <div className="engine-settings-modal" role="dialog" aria-modal="true" aria-labelledby="engineSettingsTitle">
        <div className="engine-settings-header">
          <h2 id="engineSettingsTitle">Settings</h2>
          <button type="button" className="engine-settings-close" id="engineSettingsClose" aria-label="Close engine settings">&#215;</button>
        </div>
        <div className="engine-settings-body">
          <div className="engine-settings-section">
            <div className="engine-settings-section-title">Game Review</div>
            <label className="engine-setting-field">
              <span>Chess Engine</span>
              <small>Analysis runs locally in your browser through WebAssembly.</small>
              <select id="engineSettingsReviewEngine" className="dark-select">
                {engineOptions}
              </select>
            </label>
            <label className="engine-setting-field">
              <span>Strength</span>
              <select id="engineSettingsReviewStrength" className="dark-select">
                <option value="fast">Fast (~1 sec, 3270 Rating)</option>
                <option value="balanced">Medium (~3 sec, 3400 Rating)</option>
                <option value="slow">Deep (~7 sec, 3500 Rating)</option>
              </select>
            </label>
          </div>

          <div className="engine-settings-section">
            <div className="engine-settings-section-title">Analysis</div>
            <label className="engine-setting-field">
              <span>Chess Engine</span>
              <small>Runs locally in your browser through a WebAssembly worker.</small>
              <select id="engineSettingsEngine" className="dark-select">
                {engineOptions}
              </select>
            </label>
            <label className="engine-setting-field">
              <span>Maximum Time</span>
              <select id="engineSettingsTime" className="dark-select">
                <option value="1">1 sec</option>
                <option value="3">3 sec</option>
                <option value="5">5 sec</option>
                <option value="10">10 sec</option>
              </select>
            </label>
            <label className="engine-setting-field">
              <span>Number of Lines</span>
              <select id="engineSettingsLines" className="dark-select">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>
            <label className="engine-setting-field">
              <span>Suggestion Arrows</span>
              <select id="engineSettingsArrows" className="dark-select">
                <option value="off">Off</option>
                <option value="best">Best Move</option>
                <option value="best-moves">Best Moves</option>
                <option value="all">All Lines</option>
              </select>
            </label>
            <label className="engine-setting-field">
              <span>Depth</span>
              <select id="engineSettingsDepth" className="dark-select">
                <option value="auto">Auto</option>
                <option value="15">Depth 15</option>
                <option value="20">Depth 20</option>
                <option value="25">Depth 25</option>
              </select>
            </label>
          </div>
        </div>
        <div className="engine-settings-footer">
          <button type="button" className="engine-settings-done" id="engineSettingsDone">Done</button>
        </div>
      </div>
    </div>
  );
}

export function ReviewSettingsPanel() {
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
