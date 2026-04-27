import React from 'react';

const PUZZLE_ELO_OPTIONS = Array.from({ length: 15 }, (_, index) => 400 + (index * 200));

export default function PuzzleTab() {
  return (
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
                  {PUZZLE_ELO_OPTIONS.map((elo) => (
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
  );
}
