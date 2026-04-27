import React from 'react';

export default function PricingTab() {
  return (
    <div className="tab-content" id="tab-pricing">
      <div className="pricing-layout">
        <div className="pricing-hero">
          <div className="support-badge">Pricing</div>
          <h2 className="support-title">Choose Your Plan</h2>
          <p className="support-subtitle">
            Start for free with full analysis tools. Upgrade to unlock 5 million puzzles and opening practice.
          </p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-card-badge">Free</div>
            <div className="pricing-card-price">
              <span className="pricing-amount">$0</span>
              <span className="pricing-period">forever</span>
            </div>
            <p className="pricing-card-desc">
              No sign-up or login required. Jump straight into analysis.
            </p>
            <ul className="pricing-features">
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Full chess analysis engine
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Import &amp; review games (PGN / FEN)
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Game report with accuracy %
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Board themes &amp; piece styles
              </li>
              <li className="pricing-feature is-excluded">
                <span className="pricing-feature-icon">&#10007;</span>
                Puzzles (5M+ database)
              </li>
              <li className="pricing-feature is-excluded">
                <span className="pricing-feature-icon">&#10007;</span>
                Practice openings (380 openings)
              </li>
              <li className="pricing-feature is-excluded">
                <span className="pricing-feature-icon">&#10007;</span>
                Daily puzzle &amp; streak tracking
              </li>
              <li className="pricing-feature is-excluded">
                <span className="pricing-feature-icon">&#10007;</span>
                Puzzle Survival mode
              </li>
            </ul>
            <button type="button" className="pricing-cta pricing-cta-free">Current Plan</button>
          </div>

          <div className="pricing-card is-featured">
            <div className="pricing-card-popular">Most Popular</div>
            <div className="pricing-card-badge">Monthly</div>
            <div className="pricing-card-price">
              <span className="pricing-amount">$4.99</span>
              <span className="pricing-period" id="pricingMonthlyPeriod">/ month</span>
            </div>
            <p className="pricing-card-desc">
              Unlock the full experience with puzzles and opening practice.
            </p>
            <ul className="pricing-features">
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Everything in Free
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                5 million+ puzzles by theme &amp; rating
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Practice 380 openings &amp; 4,235 variations
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Daily puzzle with streak tracking
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Puzzle Survival (Puzzle Rush)
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Custom puzzles — filter by 74 themes
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Puzzle Elo rating with mismatch protection
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Speed bonus rewards
              </li>
            </ul>
            <button type="button" className="pricing-cta pricing-cta-monthly">Get Started</button>
          </div>

          <div className="pricing-card is-yearly">
            <div className="pricing-card-badge">Yearly</div>
            <div className="pricing-card-price">
              <span className="pricing-amount">$19.99</span>
              <span className="pricing-period">/ year</span>
            </div>
            <div className="pricing-yearly-breakdown">
              That&apos;s just <strong>$1.67/mo</strong> &mdash; save 44%
            </div>
            <p className="pricing-card-desc">
              Same full access as Monthly, billed once a year at the best price.
            </p>
            <ul className="pricing-features">
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Everything in Monthly
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                5 million+ puzzles by theme &amp; rating
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Practice 380 openings &amp; 4,235 variations
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Daily puzzle with streak tracking
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Puzzle Survival (Puzzle Rush)
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Custom puzzles — filter by 74 themes
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Puzzle Elo rating with mismatch protection
              </li>
              <li className="pricing-feature is-included">
                <span className="pricing-feature-icon">&#10003;</span>
                Best value — save 44% vs monthly
              </li>
            </ul>
            <button type="button" className="pricing-cta pricing-cta-yearly">Get Started</button>
          </div>
        </div>

        <div className="pricing-faq">
          <div className="pricing-faq-title">Common questions</div>
          <div className="pricing-faq-grid">
            <div className="pricing-faq-item">
              <div className="pricing-faq-q">Do I need to sign up for the free plan?</div>
              <div className="pricing-faq-a">No. The free plan requires no account at all. Just open the app and start analyzing.</div>
            </div>
            <div className="pricing-faq-item">
              <div className="pricing-faq-q">Can I switch between Monthly and Yearly?</div>
              <div className="pricing-faq-a">Yes. You can upgrade, downgrade, or cancel anytime. Yearly savings apply immediately.</div>
            </div>
            <div className="pricing-faq-item">
              <div className="pricing-faq-q">What&apos;s included in the puzzle database?</div>
              <div className="pricing-faq-a">Over 5 million puzzles sourced from real games, spanning 74 tactical themes, all rating levels, and 1,500+ openings.</div>
            </div>
            <div className="pricing-faq-item">
              <div className="pricing-faq-q">Is the analysis engine the same across all plans?</div>
              <div className="pricing-faq-a">Yes. Every plan gets the same Stockfish analysis engine with full depth and multi-line support.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
