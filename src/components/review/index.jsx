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
      <button type="button" className="nav-btn" id="btnFirst" aria-label="First move">&#8676;</button>
      <button type="button" className="nav-btn" id="btnPrev" aria-label="Previous move">&#8592;</button>
      <button type="button" className="nav-btn" id="btnPlay" aria-label="Play game">&#9654;</button>
      <button type="button" className="nav-btn" id="btnNext" aria-label="Next move">&#8594;</button>
      <button type="button" className="nav-btn" id="btnLast" aria-label="Last move">&#8677;</button>
      <button type="button" className="nav-btn flip-btn" id="btnFlip" aria-label="Flip board">&#8645;</button>
    </div>
  );
}

export function ReviewTabs() {
  return (
    <div className="gr-tabs review-tabs" role="tablist" aria-label="Game review views">
      <button type="button" className="gr-tab active" id="grReportTab" data-review-tab="report">Report</button>
      <button type="button" className="gr-tab" id="grAnalyzeTab" data-review-tab="analyze">Analysis</button>
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
  const renderCountBadge = (quality, count) => (
    <span className={`learn-count-badge is-${quality}`}>
      <strong>{count || 0}</strong>
      <span className={`qi qi-${quality}`}>{qualityIcon[quality]}</span>
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
      <div className="learn-mistakes-head"><span className="learn-mistakes-dot"></span><span>Critical Analysis</span></div>
      <div className="learn-mistakes-layout">
        <div className="learn-mistakes-copy">
          <h3>Learn from your mistakes.</h3>
          <div className="learn-mistakes-summary">
            <span>You made</span>
            {renderCountBadge('mistake', currentUser?.mistakes || 0)}
            <span>and</span>
            {renderCountBadge('blunder', currentUser?.blunders || 0)}
            <span>critical errors.</span>
            <span>Master these positions to improve.</span>
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
