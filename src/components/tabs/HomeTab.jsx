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
                <span className="hero-stat-value" id="hmStatGames">0</span>
                <span className="hero-stat-label">Games saved</span>
              </div>
              <div className="hero-stat-card">
                <span className="hero-stat-value">18</span>
                    <span className="hero-stat-label">Browser engine</span>
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
                      Engine: <span id="profileEngineView">Selectable Browser Stockfish</span> · Depth:{' '}
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
                      <div className="psm-label">
                        <span className="psm-label-icon psm-label-icon-bullet" aria-hidden="true">&#9679;</span>
                        <span>Bullet</span>
                      </div>
                    </div>
                    <div className="psm-box">
                      <div className="psm-num" id="hmStatBlitz">—</div>
                      <div className="psm-label">
                        <span className="psm-label-icon psm-label-icon-blitz" aria-hidden="true">&#9889;</span>
                        <span>Blitz</span>
                      </div>
                    </div>
                    <div className="psm-box">
                      <div className="psm-num" id="hmStatRapid">—</div>
                      <div className="psm-label">
                        <span className="psm-label-icon psm-label-icon-rapid" aria-hidden="true">&#9201;</span>
                        <span>Rapid</span>
                      </div>
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
                    <label>Engine</label>
                    <div className="settings-static-value settings-static-full">Selectable Browser Stockfish</div>
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
  );
}
