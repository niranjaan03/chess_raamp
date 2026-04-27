import React from 'react';

export default function SupportTab() {
  return (
    <div className="tab-content" id="tab-support">
      <div className="support-layout">
        <div className="support-hero">
          <div className="support-badge">Feedback</div>
          <h2 className="support-title">Help us improve chess ramp</h2>
          <p className="support-subtitle">
            Share ideas, report bugs, and help shape the next features for analyze, review, practice, and game study.
          </p>
          <div className="support-actions">
            <button type="button" className="hero-btn primary" id="openFeedbackModal">
              Send Feedback
            </button>
            <button type="button" className="hero-btn secondary" id="copySupportLinkBtn">
              Copy feedback link
            </button>
          </div>
        </div>

        <div className="support-grid">
          <div className="support-card">
            <div className="support-card-icon">&#9889;</div>
            <div className="support-card-title">Feature Requests</div>
            <p className="support-card-text">
              Tell us what would make analysis, game review, or practice more useful for your workflow.
            </p>
            <button type="button" className="btn-full support-card-btn" data-feedback-category="feature">
              Request a Feature
            </button>
          </div>

          <div className="support-card">
            <div className="support-card-icon">&#128027;</div>
            <div className="support-card-title">Bug Reports</div>
            <p className="support-card-text">
              Found something broken or inaccurate? Send the issue with the steps so we can reproduce it quickly.
            </p>
            <button type="button" className="btn-full support-card-btn" data-feedback-category="bug">
              Report a Bug
            </button>
          </div>

          <div className="support-card">
            <div className="support-card-icon">&#128172;</div>
            <div className="support-card-title">General Feedback</div>
            <p className="support-card-text">
              Share what you like, what feels slow, and what should be improved next.
            </p>
            <button type="button" className="btn-full support-card-btn" data-feedback-category="other">
              Share Feedback
            </button>
          </div>
        </div>

        <div className="support-info-grid">
          <div className="support-panel">
            <div className="support-panel-title">How you can help</div>
            <div className="support-list">
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>Use feedback to suggest the next review, opening, and board improvements.</span>
              </div>
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>Share chess ramp with your chess friends, coaches, and study groups.</span>
              </div>
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>Report Stockfish, UI, and game-review issues with exact steps to reproduce.</span>
              </div>
            </div>
          </div>

          <div className="support-panel">
            <div className="support-panel-title">What your feedback should include</div>
            <div className="support-list">
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>The page you were using: Analyze, Games, Practice, Import, or Database.</span>
              </div>
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>What you expected to happen and what actually happened.</span>
              </div>
              <div className="support-list-item">
                <span className="support-list-dot"></span>
                <span>Any PGN, position, username, or move sequence that reproduces the issue.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
