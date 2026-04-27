import React from 'react';

export default function DatabaseTab() {
  return (
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
  );
}
