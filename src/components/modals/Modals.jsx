import React from 'react';
import { createPortal } from 'react-dom';

export function FeedbackModal() {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal-overlay feedback-modal-overlay" id="feedbackModal" style={{ display: 'none' }}>
      <div className="modal feedback-modal">
        <div className="modal-header feedback-modal-header">
          <div>
            <h3>Your feedback matters</h3>
            <p className="feedback-modal-subtitle">Help us improve chess ramp. What&apos;s on your mind?</p>
          </div>
          <button type="button" className="modal-close" id="feedbackModalClose" aria-label="Close feedback window">
            &#10005;
          </button>
        </div>

        <div className="feedback-form">
          <div className="feedback-label">Category</div>
          <div className="feedback-category-grid" id="feedbackCategoryGrid">
            <button type="button" className="feedback-category-btn active" data-category="feature">
              <span className="feedback-category-icon">&#9889;</span>
              <span className="feedback-category-text">Feature</span>
            </button>
            <button type="button" className="feedback-category-btn" data-category="bug">
              <span className="feedback-category-icon">&#128027;</span>
              <span className="feedback-category-text">Bug</span>
            </button>
            <button type="button" className="feedback-category-btn" data-category="other">
              <span className="feedback-category-icon">&#128172;</span>
              <span className="feedback-category-text">Other</span>
            </button>
          </div>

          <div className="feedback-label">Message</div>
          <div className="feedback-textarea-wrap">
            <textarea
              id="feedbackMessage"
              className="feedback-textarea"
              maxLength="1000"
              placeholder="I noticed that..."
              defaultValue=""
            ></textarea>
            <div className="feedback-counter"><span id="feedbackCharCount">0</span>/1000</div>
          </div>

          <div className="feedback-actions">
            <button type="button" className="feedback-cancel-btn" id="feedbackCancelBtn">
              Cancel
            </button>
            <button type="button" className="feedback-send-btn" id="feedbackSendBtn">
              Send Feedback &#10148;
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AuthModal() {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal-overlay auth-modal-overlay" id="authModal" style={{ display: 'none' }}>
      <div className="modal auth-modal">
        <div className="modal-header">
          <div>
            <h3>Account Center</h3>
            <p className="feedback-modal-subtitle">Sign in with Google or continue with email on this device.</p>
          </div>
          <button type="button" className="modal-close" id="authModalClose" aria-label="Close account center">
            &#10005;
          </button>
        </div>

        <div className="auth-signed-in-view" id="authSignedInView" style={{ display: 'none' }}>
          <div className="auth-session-card">
            <div className="auth-session-label">Signed in as</div>
            <div className="auth-session-name" id="authSessionName">Guest</div>
            <div className="auth-session-email" id="authSessionEmail">guest@example.com</div>
            <div className="auth-session-provider" id="authSessionProvider">Email</div>
          </div>
          <div className="auth-actions-row">
            <button type="button" className="btn-full" id="authManageProfileBtn">
              Open Home Profile
            </button>
            <button type="button" className="feedback-cancel-btn auth-signout-btn" id="authSignOutBtn">
              Sign Out
            </button>
          </div>
        </div>

        <div className="auth-signed-out-view" id="authSignedOutView">
          <div className="auth-tabs">
            <button type="button" className="auth-tab-btn active" id="authTabSignIn">
              Sign In
            </button>
            <button type="button" className="auth-tab-btn" id="authTabSignUp">
              Sign Up
            </button>
          </div>

          <div className="auth-google-card">
            <button type="button" className="btn-full auth-google-trigger" id="authGoogleTrigger">
              Continue with Gmail
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          <div className="auth-panel" id="authPanelSignIn">
            <div className="form-group">
              <label htmlFor="authSignInEmail">Email</label>
              <input
                type="email"
                id="authSignInEmail"
                className="dark-input full-width"
                placeholder="you@example.com"
                defaultValue=""
              />
            </div>
            <div className="form-group">
              <label htmlFor="authSignInPassword">Password</label>
              <input
                type="password"
                id="authSignInPassword"
                className="dark-input full-width"
                placeholder="Enter password"
                defaultValue=""
              />
            </div>
            <button type="button" className="btn-full" id="authEmailSignInBtn">
              Sign In with Email
            </button>
          </div>

          <div className="auth-panel" id="authPanelSignUp" style={{ display: 'none' }}>
            <div className="form-group">
              <label htmlFor="authSignUpName">Display Name</label>
              <input
                type="text"
                id="authSignUpName"
                className="dark-input full-width"
                placeholder="Your name"
                defaultValue=""
              />
            </div>
            <div className="form-group">
              <label htmlFor="authSignUpEmail">Email</label>
              <input
                type="email"
                id="authSignUpEmail"
                className="dark-input full-width"
                placeholder="you@example.com"
                defaultValue=""
              />
            </div>
            <div className="form-group">
              <label htmlFor="authSignUpPassword">Password</label>
              <input
                type="password"
                id="authSignUpPassword"
                className="dark-input full-width"
                placeholder="Create password"
                defaultValue=""
              />
            </div>
            <button type="button" className="btn-full" id="authEmailSignUpBtn">
              Create Account
            </button>
          </div>

          <div className="auth-status-message" id="authStatusMessage"></div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ReviewProgressOverlay() {
  return (
    <div className="review-progress-overlay" id="reviewProgressOverlay" style={{ display: 'none' }}>
      <div className="review-progress-card" id="reviewProgressCard" role="status" aria-live="polite" aria-busy="true">
        <div className="review-progress-knight" aria-hidden="true">&#9822;</div>
        <div className="review-progress-text" id="reviewProgressText">Review in progress</div>
        <div className="review-progress-line" aria-hidden="true">
          <div className="review-progress-line-fill" id="reviewProgressFill" style={{ width: '0%' }}></div>
        </div>
      </div>
    </div>
  );
}
