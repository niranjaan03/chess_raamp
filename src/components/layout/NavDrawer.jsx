import React from 'react';

export default function NavDrawer() {
  return (
    <div className="nav-drawer-overlay" id="navDrawerOverlay" style={{ display: 'none' }}>
      <aside className="nav-drawer" id="navDrawer" aria-label="Main navigation">
        <div className="nav-drawer-header">
          <div>
            <div className="nav-drawer-title">Menu</div>
            <div className="nav-drawer-subtitle">Navigate chess ramp</div>
          </div>
          <button type="button" className="nav-drawer-close" id="navDrawerClose" aria-label="Close navigation menu">
            &#10005;
          </button>
        </div>
        <div className="nav-drawer-body">
          <div className="nav-links nav-drawer-links">
            <a href="#" className="nav-link active" data-tab="home">
              <span className="nav-item-icon">&#8962;</span>
              <span className="nav-item-label">Home</span>
            </a>
            <a href="#" className="nav-link" data-tab="games">
              <span className="nav-item-icon">&#9823;</span>
              <span className="nav-item-label">Games</span>
            </a>
            <a href="#" className="nav-link" data-tab="openings">
              <span className="nav-item-icon">&#9816;</span>
              <span className="nav-item-label">Practice</span>
            </a>
            <div className="nav-menu-group">
              <button type="button" className="nav-group-label" id="puzzleMenuToggle" aria-expanded="false">
                <span className="nav-item-icon">&#129504;</span>
                <span className="nav-item-label">Puzzles</span>
                <span className="nav-group-caret" id="puzzleMenuCaret">&#8250;</span>
              </button>
              <div className="nav-submenu" id="puzzleSubmenu">
                <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="classic">
                  <span className="nav-item-icon">&#9822;</span>
                  <span className="nav-item-label">Puzzle</span>
                </button>
                <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="daily">
                  <span className="nav-item-icon">&#128197;</span>
                  <span className="nav-item-label">Daily Puzzle</span>
                </button>
                <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="custom">
                  <span className="nav-item-icon">&#9881;</span>
                  <span className="nav-item-label">Custom Puzzles</span>
                </button>
                <button type="button" className="nav-sublink" data-tab="puzzle" data-puzzle-mode="survival">
                  <span className="nav-item-icon">&#128293;</span>
                  <span className="nav-item-label">Puzzle Survival</span>
                </button>
              </div>
            </div>
            <a href="#" className="nav-link" data-tab="player-analyze">
              <span className="nav-item-icon">&#128200;</span>
              <span className="nav-item-label">Player Analyze</span>
            </a>
            <a href="#" className="nav-link" data-tab="import">
              <span className="nav-item-icon">&#128229;</span>
              <span className="nav-item-label">Import</span>
            </a>
            <a href="#" className="nav-link" data-tab="pricing">
              <span className="nav-item-icon">&#9830;</span>
              <span className="nav-item-label">Pricing</span>
            </a>
            <a href="#" className="nav-link" data-tab="settings">
              <span className="nav-item-icon">&#9881;</span>
              <span className="nav-item-label">Settings</span>
            </a>
            <a href="#" className="nav-link" data-tab="support">
              <span className="nav-item-icon">&#9993;</span>
              <span className="nav-item-label">Feedback</span>
            </a>
          </div>

          <div className="nav-drawer-social">
            <a href="https://instagram.com/chessramp" className="nav-link nav-social-link nav-instagram" target="_blank" rel="noopener noreferrer">
              <span className="nav-item-icon">&#128247;</span>
              <span className="nav-item-label">Instagram</span>
            </a>
            <a href="https://discord.gg/chessramp" className="nav-link nav-social-link nav-discord" target="_blank" rel="noopener noreferrer">
              <span className="nav-item-icon">
                <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.8 41.8 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4c-1.8 1-3.6 1.9-5.5 2.6a.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0017.7-9v-.1c1.4-15.1-2.4-28.2-10-39.8a.2.2 0 00-.1-.1zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z"/>
                </svg>
              </span>
              <span className="nav-item-label">Discord</span>
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
