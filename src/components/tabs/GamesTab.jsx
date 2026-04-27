import React from 'react';

export default function GamesTab({ onFetchLatest }) {
  return (
    <div className="tab-content" id="tab-games">
      <div className="games-tab-layout">
        <section className="games-shell-card">
          <div className="games-shell-main">
            <div className="games-tab-header">
              <div className="games-eyebrow">Chess.com Archive</div>
              <h2 className="games-tab-title">Games</h2>
              <p className="games-tab-sub" id="gamesTabSub">Connect your Chess.com account on the Home tab, then sync the latest 3 months here.</p>
            </div>
            <div className="games-tab-controls" id="gamesTabControls" style={{ display: 'none' }}>
              <div className="games-tab-user" id="gamesTabUser"></div>
              <button type="button" className="btn-sm-green" id="gamesTabFetch" onClick={onFetchLatest}>Sync 3 Months</button>
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
              <p className="games-results-meta" id="gamesSummaryMeta">Fetch recent Chess.com archives to analyze games, openings, and review coverage.</p>
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
              <div className="games-empty-copy">Connect Chess.com on the Home tab, then sync the latest 3 months to populate this page.</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
