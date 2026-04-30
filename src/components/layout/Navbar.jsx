import React from 'react';

export default function Navbar() {
  return (
    <nav className="navbar">
      <button type="button" className="nav-menu-btn" id="navMenuBtn" aria-label="Open navigation menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className="nav-brand">
        <svg className="nav-logo" viewBox="0 0 32 32" fill="none">
          <path d="M22 28H10v-2h12v2zm1-4H9l1-4h12l1 4zm-5-6c3 0 6-2.5 6-6 0-2-1-3.5-2.5-4.5L20 6l-1.5 2H16l1-3h-2l-1 3h-1c-2 0-4 2-4 4.5 0 3 2 5.5 5 5.5h3z" fill="var(--accent)" opacity="0.95"/>
          <circle cx="14.5" cy="12" r="1.2" fill="var(--bg-primary)"/>
        </svg>
        <span className="brand-name">chess ramp</span>
        <span className="brand-sub">Browser Stockfish Review</span>
      </div>
      <div className="nav-right">
        <div className="engine-badge" id="engineStatus">
          <span className="engine-dot"></span>
          <span className="engine-label">Initializing browser Stockfish...</span>
        </div>
        <button type="button" className="btn-profile" id="profileBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span id="profileName">Sign In</span>
        </button>
      </div>
    </nav>
  );
}
