import React from 'react';

export default function PlayerAnalyzeTab() {
  return (
    <div className="tab-content" id="tab-player-analyze">
      <div className="pa-layout">

        <div className="pa-hero">
          <h1 className="pa-hero-title">Player Analyze</h1>
          <p className="pa-hero-sub">Find rating leaks, opening weaknesses, and recurring loss patterns from recent games</p>
          <div className="pa-search-row">
            <input type="text" id="paUsernameInput" className="pa-search-input"
              placeholder="Enter Chess.com username or @handle..." autoComplete="off" />
            <button type="button" id="paAnalyzeBtn" className="pa-search-btn">Analyze &#9889;</button>
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
