import React from 'react';

function OpeningModePage() {
  return (
    <div id="openingModeView" className="opening-mode-view" style={{ display: 'none' }}>
      <div className="opening-mode-shell">
        <button type="button" className="btn-back opening-mode-back" id="openingModeBackBtn">
          &#8592; All Openings
        </button>

        <h1 className="opening-mode-title" id="openingModeTitle">Opening</h1>

        <div className="opening-mode-layout">
          <section className="opening-mode-board-panel" aria-label="Opening board preview">
            <div className="opening-mode-board-frame">
              <canvas id="openingModeChessBoard" width="640" height="640"></canvas>
              <div id="openingModeBoardOverlay" className="board-overlay"></div>
            </div>
          </section>

          <aside className="opening-mode-card" aria-label="Opening learning modes">
            <div className="opening-mode-card-header">
              <span className="opening-mode-header-icon" aria-hidden="true">&#128218;</span>
              <span className="opening-mode-header-mode" id="openingModeHeaderMode">Learn</span>
              <span className="opening-mode-header-name" id="openingModeHeaderName">Opening</span>
              <span className="opening-mode-line-no" id="openingModeLineNo">#1</span>
            </div>

            <div className="opening-mode-coach-row">
              <div className="opening-mode-coach-icon" aria-hidden="true">&#9812;</div>
              <div className="opening-mode-speech" id="openingModeCoachText">
                Select Learn or Practice to start this opening line.
              </div>
            </div>

            <div className="opening-mode-options" id="openingModeOptions"></div>

            <div className="opening-mode-empty" id="openingModeEmpty" style={{ display: 'none' }}>
              Opening data is unavailable. Return to the openings list and choose another opening.
            </div>

            <div className="opening-mode-footer">
              <button type="button" className="opening-mode-icon-btn" id="openingModeSettingsBtn" title="Mode settings" aria-label="Mode settings">&#9881;</button>
              <button type="button" className="opening-mode-action-btn" id="openingModeHintBtn">
                <span aria-hidden="true">&#128161;</span>
                Hint
              </button>
              <button type="button" className="opening-mode-action-btn" id="openingModeCycleBtn">
                Mode
              </button>
              <button type="button" className="opening-mode-arrow-btn" id="openingModePrevLineBtn" aria-label="Previous line">&#8249;</button>
              <button type="button" className="opening-mode-arrow-btn" id="openingModeNextLineBtn" aria-label="Next line">&#8250;</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function OpeningsTab() {
  return (
    <div className="tab-content" id="tab-openings">

      <div id="openingGalleryView" className="openings-gallery-view">
        <div className="openings-hero">
          <div className="openings-hero-text">
            <h1 className="openings-title">&#9816; Practice Chess Openings</h1>
            <p className="openings-subtitle">
              Master 173 openings with 3,901 variations. Select an opening, pick a line, and play the moves on the board.
            </p>
          </div>
        </div>

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
        </div>
      </div>

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
                <span className="opening-favorite-btn-icon" aria-hidden="true">&#9825;</span>
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
        </div>
      </div>

      <OpeningModePage />

      <div id="openingPracticeView" className="opn-practice-root" style={{ display: 'none' }}>

        <div className="opn-board-col">
          <div className="practice-nav-row">
            <button type="button" className="btn-back" id="backToDetailBtn">&#8592; Variations</button>
            <button type="button" className="btn-back" id="backToDetailBtn2" style={{ marginLeft: '8px' }}>&#8592; All Openings</button>
          </div>

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

          <div className="opn-bottom-bar">
            <button type="button" className="opn-ctrl-btn opn-ctrl-icon" id="practiceFlipBtn" title="Flip board">&#8645;</button>
            <button type="button" className="opn-ctrl-btn opn-ctrl-hint" id="practiceHintBtn" title="Show hint">&#128161; Hint</button>
            <button type="button" className="opn-ctrl-btn opn-ctrl-mode" id="practiceModeBtn" title="Switch mode">Mode</button>
            <button type="button" className="opn-ctrl-btn opn-ctrl-nav" id="practicePrevBtn" title="Previous move">&#8249;</button>
            <button type="button" className="opn-ctrl-btn opn-ctrl-nav" id="practiceNextBtn" title="Next move">&#8250;</button>
          </div>

          <button type="button" id="practiceResetBtn" style={{ display: 'none' }}></button>
        </div>

        <div className="opn-train-col">

          <div className="opn-train-header">
            <span className="opn-mode-badge" id="opnModeBadge">&#128218; Learn</span>
            <span className="opn-train-name" id="opnTrainName">Select an Opening</span>
            <span className="opn-train-step" id="opnTrainStep">#1</span>
          </div>

          <div className="opn-coach-bubble" id="coachExplanation">
            <div className="opn-coach-head">
              <span className="opn-coach-icon">&#9822;</span>
              <span className="opn-coach-label">Coach</span>
            </div>
            <div className="opn-coach-body" id="opnCoachBody">
              Select a variation to begin. Use <strong>›</strong> to step through moves in Learn mode.
            </div>
          </div>

          <div className="opn-mode-grid" id="opnModeGrid"></div>

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

          <div className="practice-progress">
            <div className="practice-progress-bar">
              <div className="practice-progress-fill" id="practiceProgressBar"></div>
            </div>
            <div className="practice-progress-text" id="practiceProgressText">0 / 0 moves</div>
          </div>

          <div id="srsRatingPanel" className="srs-rating-panel" style={{ display: 'none' }}></div>

          <div className="practice-moves-panel">
            <div className="practice-moves-header" id="practiceMovesHeader">Moves</div>
            <div className="practice-pgn-line" id="practiceMovePgn"></div>
            <div className="practice-move-list" id="practiceMoveList"></div>
          </div>

          <div className="practice-moves-panel related-lines-panel">
            <div className="practice-moves-header">Related Lines</div>
            <div id="relatedLinesList">
              <div className="related-empty">Select a variation to see related lines.</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
