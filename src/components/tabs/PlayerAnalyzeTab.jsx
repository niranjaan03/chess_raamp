import React from 'react';

export default function PlayerAnalyzeTab() {
  return (
    <div className="tab-content" id="tab-player-analyze">
      <div className="pa-layout">

        <div className="pa-hero">
          <div className="pa-hero-orbits" aria-hidden="true">
            <span className="pa-hero-orbit pa-hero-orbit-1" />
            <span className="pa-hero-orbit pa-hero-orbit-2" />
            <span className="pa-hero-orbit pa-hero-orbit-3" />
          </div>
          <div className="pa-hero-eyebrow">
            <span className="pa-hero-eyebrow-dot" aria-hidden="true" />
            Performance Intelligence
          </div>
          <div className="pa-hero-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 17l5-5 4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 8h6v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="pa-hero-title">
            <span className="pa-hero-title-grad">Player Analyze</span>
          </h1>
          <p className="pa-hero-sub">Find rating leaks, opening weaknesses, and recurring loss patterns from recent games.</p>
          <div className="pa-search-card">
            <form className="pa-search-row" onSubmit={(e) => { e.preventDefault(); document.getElementById('paAnalyzeBtn').click(); }}>
              <span className="pa-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input type="text" id="paUsernameInput" className="pa-search-input"
                placeholder="Chess.com username or @handle" autoComplete="off" />
              <button type="submit" id="paAnalyzeBtn" className="pa-search-btn">
                <span>Analyze</span>
                <svg className="pa-search-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </button>
            </form>
            <div className="pa-search-hint">
              <span>Try</span>
              <button type="button" className="pa-search-chip" onClick={() => { var i = document.getElementById('paUsernameInput'); if (i) { i.value = 'magnuscarlsen'; i.focus(); } }}>magnuscarlsen</button>
              <button type="button" className="pa-search-chip" onClick={() => { var i = document.getElementById('paUsernameInput'); if (i) { i.value = 'hikaru'; i.focus(); } }}>hikaru</button>
              <button type="button" className="pa-search-chip" onClick={() => { var i = document.getElementById('paUsernameInput'); if (i) { i.value = 'gothamchess'; i.focus(); } }}>gothamchess</button>
            </div>
          </div>
        </div>

        <div id="paLoading" className="pa-loading" style={{ display: 'none' }}>
          <div className="pa-loading-knight">&#9822;</div>
          <p>Loading player data...</p>
          <p className="pa-loading-sub">Fetching up to 12 months of games from Chess.com API</p>
        </div>

        <div id="paError" className="pa-error-box" style={{ display: 'none' }}>
          <span className="pa-error-icon">&#9888;</span>
          <span id="paErrorMsg">Player not found</span>
        </div>

        <div id="paContent" style={{ display: 'none' }}>

          <div id="paProfileHeader"></div>

          <div id="paKeyMetrics" className="pa-metrics-row"></div>

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

          <div id="paSummaryBar" className="pa-summary-bar"></div>

          <div id="paInsights" className="pa-insights-card pa-card pa-mt"></div>

          <div id="paGameResults" className="pa-card pa-mt"></div>

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

          <div className="pa-section-hdr">
            <div className="pa-sec-icon">&#128202;</div>
            <div><h2 className="pa-sec-title">Performance Breakdown</h2><p className="pa-sec-sub">Win rates across time controls, days &amp; months</p></div>
          </div>
          <div className="pa-two-col">
            <div id="paByTCCard" className="pa-card"></div>
            <div id="paByDOWCard" className="pa-card"></div>
          </div>
          <div id="paMonthlyCard" className="pa-card pa-mt"></div>

          <div className="pa-section-hdr">
            <div className="pa-sec-icon">&#11088;</div>
            <div><h2 className="pa-sec-title">Rating Analysis</h2><p className="pa-sec-sub">Your rating journey with moving averages &amp; opponent breakdown</p></div>
          </div>
          <div id="paRatingProgCard" className="pa-card"></div>
          <div className="pa-two-col pa-mt">
            <div id="paRatingDiffCard" className="pa-card"></div>
            <div id="paOppStrengthCard" className="pa-card"></div>
          </div>

          <div className="pa-section-hdr">
            <div className="pa-sec-icon">&#127919;</div>
            <div><h2 className="pa-sec-title">Game Patterns</h2><p className="pa-sec-sub">Result breakdowns &amp; win streak analysis</p></div>
          </div>
          <div className="pa-two-col">
            <div id="paResultBreakdown" className="pa-card"></div>
            <div id="paStreakDist" className="pa-card"></div>
          </div>

          <div className="pa-section-hdr">
            <div className="pa-sec-icon">&#129504;</div>
            <div><h2 className="pa-sec-title">Pro Coaching Modules</h2><p className="pa-sec-sub">What a real coach would tell you</p></div>
          </div>
          <div className="pa-two-col">
            <div id="paHeadToHead" className="pa-card"></div>
            <div id="paRadarCard" className="pa-card"></div>
          </div>

          <div id="paOpenings" className="pa-card pa-mt"></div>

          <div id="paLossAnalysis" className="pa-card pa-mt"></div>

        </div>
      </div>
    </div>
  );
}
