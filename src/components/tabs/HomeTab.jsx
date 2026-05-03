import React from 'react';

export default function HomeTab({ onSwitchTab, onOpenDailyPuzzle }) {
  return (
    <div className="tab-content active" id="tab-home">
      <div className="home-layout">
        <section className="home-hero" aria-labelledby="homeHeroTitle">
          <div className="home-hero-main">
            <div className="hero-kicker">Browser Stockfish review workspace</div>
            <h1 className="hero-title" id="homeHeroTitle">
              Welcome back, <span id="heroName">Guest</span>
            </h1>
            <p className="hero-sub">Analyze games, tighten openings, and keep daily tactics in one focused dashboard.</p>
            <div className="hero-actions">
              <button type="button" className="hero-btn primary" onClick={() => onSwitchTab('analyze')}>
                <svg className="hero-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Start review
              </button>
              <button type="button" className="hero-btn secondary" onClick={() => onSwitchTab('import')}>
                <svg className="hero-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v10m0 0l4-4m-4 4L8 9M5 17v2h14v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Import game
              </button>
            </div>
            <div className="home-hero-stats" aria-label="Home overview">
              <div className="hero-stat-card">
                <span className="hero-stat-value" id="hmHeroBullet">—</span>
                <span className="hero-stat-label">
                  <span className="hero-stat-icon hero-stat-icon-bullet" aria-hidden="true">&#9679;</span>
                  <span>Bullet</span>
                </span>
              </div>
              <div className="hero-stat-card">
                <span className="hero-stat-value" id="hmHeroRapid">—</span>
                <span className="hero-stat-label">
                  <span className="hero-stat-icon hero-stat-icon-rapid" aria-hidden="true">&#9201;</span>
                  <span>Rapid</span>
                </span>
              </div>
              <div className="hero-stat-card">
                <span className="hero-stat-value" id="hmHeroBlitz">—</span>
                <span className="hero-stat-label">
                  <span className="hero-stat-icon hero-stat-icon-blitz" aria-hidden="true">&#9889;</span>
                  <span>Blitz</span>
                </span>
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
          <button type="button" className="home-action-tile" onClick={() => onSwitchTab('games')}>
            <span className="home-action-icon">&#9823;</span>
            <span className="home-action-copy">
              <strong>Games</strong>
              <small>Recent imports and fetched games</small>
            </span>
          </button>
          <button type="button" className="home-action-tile" onClick={() => onSwitchTab('openings')}>
            <span className="home-action-icon">&#9816;</span>
            <span className="home-action-copy">
              <strong>Practice</strong>
              <small>Opening lines and repetition</small>
            </span>
          </button>
          <button
            type="button"
            className="home-action-tile"
            onClick={onOpenDailyPuzzle}
          >
            <span className="home-action-icon">&#9733;</span>
            <span className="home-action-copy">
              <strong>Daily puzzle</strong>
              <small>Keep the tactics streak moving</small>
            </span>
          </button>
          <button type="button" className="home-action-tile" onClick={() => onSwitchTab('player-analyze')}>
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

            <div className="home-card home-practice-card">
              <div className="hc-header">
                <div className="hc-title-group">
                  <span className="hc-title">Practice</span>
                  <span className="hc-subtitle">Opening lines and spaced repetition</span>
                </div>
                <button
                  type="button"
                  className="hc-edit-btn"
                  onClick={() => onSwitchTab('openings')}
                >
                  Open
                </button>
              </div>
              <div className="home-practice-body">
                <div className="home-practice-stats">
                  <div className="home-practice-stat">
                    <span className="home-practice-stat-value" id="homePracticeDue">0</span>
                    <span className="home-practice-stat-label">Due to review</span>
                  </div>
                  <div className="home-practice-stat">
                    <span className="home-practice-stat-value" id="homePracticeMastered">0</span>
                    <span className="home-practice-stat-label">Mastered</span>
                  </div>
                  <div className="home-practice-stat">
                    <span className="home-practice-stat-value" id="homePracticeTracked">0</span>
                    <span className="home-practice-stat-label">Tracked openings</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="home-practice-cta"
                  onClick={() => onSwitchTab('openings')}
                >
                  <span>Start practicing</span>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
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

              <div className="linked-accounts-section">
                <div className="linked-accounts-head">
                  <span>Connected</span>
                  <button type="button" className="link-another-account-btn" id="linkAnotherAccountBtn">
                    Link another account
                  </button>
                </div>
                <div className="linked-accounts-list" id="linkedAccountsList">
                  <div className="account-panel-state is-empty">
                    <div className="account-panel-state-title">No accounts linked</div>
                    <div className="account-panel-state-copy">Link a Chess.com or Lichess username below.</div>
                  </div>
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
              <span className="home-daily-knight" aria-hidden="true">&#9816;</span>
              <div className="home-daily-layout">
                <div className="home-daily-info">
                  <div className="home-daily-label-row">
                    <span className="home-daily-label-dot" aria-hidden="true" />
                    <span className="home-daily-label-text">Daily Puzzle</span>
                    <button
                      type="button"
                      className="home-daily-date"
                      id="homeDailyPuzzleDate"
                      aria-label="Open daily puzzle calendar"
                    >Today</button>
                  </div>
                  <div className="home-daily-elo-block">
                    <span className="home-daily-elo-num" id="homeDailyPuzzleElo">—</span>
                    <span className="home-daily-elo-caption">Puzzle Elo</span>
                  </div>
                  <div className="home-daily-divider" aria-hidden="true" />
                  <div className="home-daily-streak-badge" id="homeDailyStreak">
                    <span className="home-daily-streak-fire" aria-hidden="true">&#9812;</span>
                    <span className="home-daily-streak-count">0</span>
                    <span className="home-daily-streak-label">day streak</span>
                  </div>
                  <div className="home-daily-status" id="homeDailyPuzzleStatus">Open today&apos;s puzzle to generate it.</div>
                  <button type="button" className="home-daily-play-btn" id="openDailyPuzzleHome">
                    <span>Solve today&apos;s puzzle</span>
                    <svg className="home-daily-play-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="home-daily-board-wrap">
                  <div className="home-daily-preview" id="homeDailyPuzzlePreview">
                    <div className="home-daily-preview-empty">Today&apos;s puzzle preview will appear here.</div>
                  </div>
                  <span className="home-daily-corner home-daily-corner-tl" aria-hidden="true" />
                  <span className="home-daily-corner home-daily-corner-tr" aria-hidden="true" />
                  <span className="home-daily-corner home-daily-corner-bl" aria-hidden="true" />
                  <span className="home-daily-corner home-daily-corner-br" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
