import React from 'react';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function ImportTab() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultYear = yesterday.getFullYear();
  const defaultMonth = String(yesterday.getMonth() + 1).padStart(2, '0');

  return (
    <div className="tab-content" id="tab-import">
      <div className="import-layout">
        <div className="import-card">
          <div className="import-title">Import a Game</div>
          <div className="import-methods">
            <div className="import-method active" data-method="pgn">PGN</div>
            <div className="import-method" data-method="file">File</div>
            <div className="import-method" data-method="fen">FEN</div>
            <div className="import-method" data-method="url">URL</div>
          </div>

          <div className="import-section active" id="import-pgn">
            <textarea
              id="pgnInput"
              className="pgn-textarea"
              placeholder="Paste full PGN here..."
              defaultValue=""
            ></textarea>
            <button type="button" className="btn-import" id="loadPGN">
              Load PGN
            </button>
          </div>

          <div className="import-section" id="import-file">
            <div className="file-drop-zone" id="fileDropZone">
              Drag &amp; drop PGN file or click to browse
            </div>
            <input type="file" id="fileInput" accept=".pgn" style={{ display: 'none' }} />
          </div>

          <div className="import-section" id="import-fen">
            <input
              type="text"
              className="dark-input full-width"
              id="fenImportInput"
              placeholder="Enter FEN position"
              defaultValue=""
            />
            <button type="button" className="btn-import" id="loadFenImport">
              Load FEN
            </button>
          </div>

          <div className="import-section" id="import-url">
            <input
              type="text"
              className="dark-input full-width"
              id="urlInput"
              placeholder="Lichess.org or Chess.com URL"
              defaultValue=""
            />
            <button type="button" className="btn-import" id="loadURL">
              Import Game
            </button>
          </div>
        </div>

        <div className="import-card">
          <div className="import-title">Fetch Recent Games</div>
          <div className="form-group">
            <label htmlFor="platformSelect">Platform</label>
            <select id="platformSelect" className="dark-select" defaultValue="lichess">
              <option value="lichess">Lichess.org</option>
              <option value="chesscom">Chess.com</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fetchUsername">Username</label>
            <input
              type="text"
              className="dark-input full-width"
              id="fetchUsername"
              placeholder="Enter username"
              defaultValue=""
            />
          </div>
          <div className="form-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label htmlFor="fetchYear">Year (Chess.com)</label>
              <input
                type="number"
                className="dark-input full-width"
                id="fetchYear"
                min="2000"
                max="2100"
                defaultValue={defaultYear}
              />
            </div>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label htmlFor="fetchMonth">Month</label>
              <select id="fetchMonth" className="dark-select full-width" defaultValue={defaultMonth}>
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="form-hint" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
            Chess.com fetches the selected month plus the previous two monthly archives.
          </p>
          <p className="form-hint" style={{ fontSize: '0.7rem', marginTop: '-6px' }}>
            <a href="/router/chesscom" target="_blank" rel="noreferrer">Open Chess.com router page</a>
          </p>
          <button type="button" className="btn-import" id="fetchGamesBtn">
            Fetch Games
          </button>
          <div className="fetch-results" id="fetchResults">
            <div className="no-games">Fetch games to see them here.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
