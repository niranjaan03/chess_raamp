import React from 'react';

export default function ProfileTab() {
  return (
    <div className="tab-content" id="tab-profile">
      <div className="profile-layout">
        <div className="profile-card">
          <div className="profile-avatar-big">&#9822;</div>
          <div className="profile-info-home">
            <div className="profile-display-name">Account &amp; Identity</div>
            <p className="hero-sub" style={{ marginTop: '8px' }}>
              Use the account button in the top-right corner to sign in with Google or continue with email.
              Your chess ramp preferences stay synced on this device for the signed-in account.
            </p>
            <button type="button" className="btn-full auth-launch-btn" id="openAuthFromProfile">
              Open Account Center
            </button>
          </div>
        </div>
        <div className="profile-card stats-card">
          <h3>Why sign in?</h3>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-num">&#9889;</div>
              <div className="stat-label">Saved profile</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">&#9993;</div>
              <div className="stat-label">Email sign-in</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">&#71;</div>
              <div className="stat-label">Google option</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">&#128202;</div>
              <div className="stat-label">Local session</div>
            </div>
          </div>
          <p className="no-data">Home still manages your display name, engine depth, and linked chess accounts.</p>
        </div>
      </div>
    </div>
  );
}
