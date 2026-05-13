import React from 'react';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

function BulletIcon() {
  return (
    <svg className="hero-stat-icon hero-stat-icon-bullet" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h6M3 12h8M4 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 6.5h3.4c2.6 0 4.7 2.1 4.7 4.7v1.6c0 2.6-2.1 4.7-4.7 4.7h-3.4l3-5.5-3-5.5z" fill="currentColor" />
    </svg>
  );
}

function RapidIcon() {
  return (
    <svg className="hero-stat-icon hero-stat-icon-rapid" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 9v4l2.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BlitzIcon() {
  return (
    <svg className="hero-stat-icon hero-stat-icon-blitz" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function FlameIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5s4.5 4 4.5 8.5a4.5 4.5 0 1 1-9 0c0-1.6.6-2.7 1.4-3.6.3 1 1 1.6 1.8 1.6.5-2.4 0-4.4 1.3-6.5z" fill="currentColor" />
      <path d="M14 14.5c0 1.4-.9 2.5-2 2.5s-2-1.1-2-2.5c0-.7.3-1.3.7-1.7.2.5.5.8 1 .8.3-1 .1-2 .8-2.8.5.6 1.5 2 1.5 3.7z" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

const ACTION_ICONS = {
  games: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M7 3h12a2 2 0 0 1 2 2v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  practice: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  daily: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 14.5l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  analyze: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 17.5L9 12l3.5 3.5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const EASE_OUT = [0.22, 1, 0.36, 1];

const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

const stripContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const stripItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const gridContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14 } },
};

const colContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

const reveal = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.2 },
};

function MarketingHero({ onSwitchTab, tilePress }) {
  return (
    <section
      aria-labelledby="homeHeroTitle"
      className="relative isolate overflow-hidden rounded-kv-lg border border-kv-border bg-gradient-to-br from-kv-bg-card via-kv-bg-surface to-kv-bg-base px-6 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(80% 60% at 15% 0%, var(--accent-glow), transparent 60%), radial-gradient(60% 50% at 85% 100%, var(--accent-glow), transparent 65%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(75%_55%_at_50%_40%,#000_30%,transparent_75%)]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          opacity: 0.35,
        }}
      />

      <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <m.div variants={heroContainer} initial="hidden" animate="show" className="min-w-0">
          <m.h1
            id="homeHeroTitle"
            variants={fadeUp}
            className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-kv-text-primary"
          >
            Welcome back,{' '}
            <span
              id="heroName"
              className="bg-gradient-to-r from-kv-text-primary via-kv-accent to-kv-text-primary bg-clip-text text-transparent"
            >
              Guest
            </span>
          </m.h1>

          <m.p
            variants={fadeUp}
            className="mt-4 max-w-xl font-mono text-[0.95rem] leading-relaxed text-kv-text-secondary"
          >
            Analyze games, tighten openings, and keep daily tactics in one focused dashboard — all in your browser.
          </m.p>

          <m.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
            <m.button
              type="button"
              onClick={() => onSwitchTab('analyze')}
              whileHover={tilePress ? { y: -1 } : undefined}
              whileTap={tilePress}
              className="group inline-flex items-center gap-2 rounded-kv bg-kv-text-primary px-5 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-kv-bg-base shadow-kv transition-colors hover:bg-kv-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kv-bg-base"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Start review
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5">
                <path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </m.button>

            <m.button
              type="button"
              onClick={() => onSwitchTab('import')}
              whileHover={tilePress ? { y: -1 } : undefined}
              whileTap={tilePress}
              className="inline-flex items-center gap-2 rounded-kv border border-kv-border-light bg-kv-bg-elevated px-5 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-kv-text-primary transition-colors hover:bg-kv-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kv-bg-base"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
                <path d="M12 3v10m0 0l4-4m-4 4L8 9M5 17v2h14v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Import game
            </m.button>
          </m.div>

          <m.div
            variants={fadeUp}
            aria-label="Home overview"
            className="mt-8 grid grid-cols-3 gap-3 max-w-md"
          >
            {[
              { id: 'hmHeroBullet', label: 'Bullet', Icon: BulletIcon },
              { id: 'hmHeroRapid', label: 'Rapid', Icon: RapidIcon },
              { id: 'hmHeroBlitz', label: 'Blitz', Icon: BlitzIcon },
            ].map(({ id, label, Icon }) => (
              <div
                key={id}
                className="rounded-kv border border-kv-border bg-kv-bg-elevated/60 px-3 py-3 backdrop-blur-sm"
              >
                <span
                  id={id}
                  className="block font-display text-[1.45rem] font-extrabold leading-none text-kv-text-primary [font-variant-numeric:tabular-nums]"
                >
                  —
                </span>
                <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-kv-text-muted">
                  <Icon />
                  <span>{label}</span>
                </span>
              </div>
            ))}
          </m.div>
        </m.div>

        <m.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.35 }}
          className="hidden lg:flex items-center justify-center"
        >
          <div className="hero-board-shell w-full max-w-[360px]">
            <div className="hero-board-topline">
              <span>Live position</span>
              <strong>+0.6</strong>
            </div>
            <div className="hero-board-mini">
              <span className="b">&#9820;</span><span className="b">&#9822;</span><span className="b">&#9821;</span><span className="b">&#9819;</span><span className="b">&#9818;</span><span className="b">&#9821;</span><span className="b">&#9822;</span><span className="b">&#9820;</span>
              <span className="b">&#9823;</span><span className="b">&#9823;</span><span className="b">&#9823;</span><span className="b">&#9823;</span><span></span><span className="b">&#9823;</span><span className="b">&#9823;</span><span className="b">&#9823;</span>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span className="b">&#9823;</span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span className="w">&#9817;</span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              <span className="w">&#9817;</span><span className="w">&#9817;</span><span className="w">&#9817;</span><span className="w">&#9817;</span><span></span><span className="w">&#9817;</span><span className="w">&#9817;</span><span className="w">&#9817;</span>
              <span className="w">&#9814;</span><span className="w">&#9816;</span><span className="w">&#9815;</span><span className="w">&#9813;</span><span className="w">&#9812;</span><span className="w">&#9815;</span><span className="w">&#9816;</span><span className="w">&#9814;</span>
            </div>
            <div className="hero-line-card">
              <span>Best move</span>
              <strong>Nf3</strong>
            </div>
          </div>
        </m.div>
      </div>
    </section>
  );
}

export default function HomeTab({ onSwitchTab, onOpenDailyPuzzle }) {
  const reduceMotion = useReducedMotion();
  const tilePress = reduceMotion ? undefined : { scale: 0.96 };
  const tileHover = reduceMotion ? undefined : { y: -4, transition: { duration: 0.25, ease: EASE_OUT } };

  return (
    <div className="tab-content active" id="tab-home">
      <LazyMotion features={domAnimation} strict>
        <div className="home-layout">
          <MarketingHero onSwitchTab={onSwitchTab} tilePress={tilePress} />

          <m.div
            className="home-action-strip"
            aria-label="Quick actions"
            variants={stripContainer}
            {...reveal}
          >
            <m.button
              type="button"
              className="home-action-tile"
              onClick={() => onSwitchTab('games')}
              variants={stripItem}
              whileHover={tileHover}
              whileTap={tilePress}
            >
              <span className="home-action-icon">{ACTION_ICONS.games}</span>
              <span className="home-action-copy">
                <strong>Games</strong>
                <small>Recent imports and fetched games</small>
              </span>
            </m.button>
            <m.button
              type="button"
              className="home-action-tile"
              onClick={() => onSwitchTab('openings')}
              variants={stripItem}
              whileHover={tileHover}
              whileTap={tilePress}
            >
              <span className="home-action-icon">{ACTION_ICONS.practice}</span>
              <span className="home-action-copy">
                <strong>Practice</strong>
                <small>Opening lines and repetition</small>
              </span>
            </m.button>
            <m.button
              type="button"
              className="home-action-tile"
              onClick={onOpenDailyPuzzle}
              variants={stripItem}
              whileHover={tileHover}
              whileTap={tilePress}
            >
              <span className="home-action-icon">{ACTION_ICONS.daily}</span>
              <span className="home-action-copy">
                <strong>Daily puzzle</strong>
                <small>Keep the tactics streak moving</small>
              </span>
            </m.button>
            <m.button
              type="button"
              className="home-action-tile"
              onClick={() => onSwitchTab('player-analyze')}
              variants={stripItem}
              whileHover={tileHover}
              whileTap={tilePress}
            >
              <span className="home-action-icon">{ACTION_ICONS.analyze}</span>
              <span className="home-action-copy">
                <strong>Player analyze</strong>
                <small>Patterns across recent games</small>
              </span>
            </m.button>
          </m.div>

          <m.div className="home-grid" variants={gridContainer} {...reveal}>
            <m.div className="home-col" variants={colContainer}>
              <m.div className="home-card" variants={cardItem} whileHover={tileHover}>
                <div className="hc-header">
                  <div className="hc-title-group">
                    <span className="hc-title">Saved Profiles</span>
                    <span className="hc-subtitle">Switch between study setups</span>
                  </div>
                  <button type="button" className="hc-edit-btn" id="addProfileBtn">
                    Save Current
                  </button>
                </div>
                <div className="saved-profiles-list" id="savedProfilesList">
                  <div className="no-data">No saved profiles yet.</div>
                </div>
              </m.div>

              <m.div className="home-card home-practice-card" variants={cardItem} whileHover={tileHover}>
                <div className="hc-header">
                  <div className="hc-title-group">
                    <span className="hc-title">Practice</span>
                    <span className="hc-subtitle">Opening lines and spaced repetition</span>
                  </div>
                  <button type="button" className="hc-edit-btn" onClick={() => onSwitchTab('openings')}>
                    Open
                  </button>
                </div>
                <div className="home-practice-body">
                  <div className="home-practice-stats">
                    <div className="home-practice-stat">
                      <span className="home-practice-stat-value" id="homePracticeDue">0</span>
                      <span className="home-practice-stat-label">Due to review</span>
                    </div>
                    <div className="home-practice-stat">
                      <span className="home-practice-stat-value" id="homePracticeMastered">0</span>
                      <span className="home-practice-stat-label">Mastered</span>
                    </div>
                    <div className="home-practice-stat">
                      <span className="home-practice-stat-value" id="homePracticeTracked">0</span>
                      <span className="home-practice-stat-label">Tracked openings</span>
                    </div>
                  </div>
                  <button type="button" className="home-practice-cta" onClick={() => onSwitchTab('openings')}>
                    <span>Start practicing</span>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </m.div>
            </m.div>

            <m.div className="home-col" variants={colContainer}>
              <m.div className="home-card" variants={cardItem} whileHover={tileHover}>
                <div className="hc-header">
                  <div className="hc-title-group">
                    <span className="hc-title">Linked Accounts</span>
                    <span className="hc-subtitle">Fetch games from your platforms</span>
                  </div>
                  <div className="acct-platform-toggle">
                    <button type="button" className="acct-toggle-btn active" id="toggleChesscom" data-account-panel="chesscom" aria-pressed="true">Chess.com</button>
                    <button type="button" className="acct-toggle-btn" id="toggleLichess" data-account-panel="lichess" aria-pressed="false">Lichess</button>
                  </div>
                </div>

                <div className="linked-accounts-section">
                  <div className="linked-accounts-head">
                    <span>Connected</span>
                    <button type="button" className="link-another-account-btn" id="linkAnotherAccountBtn">
                      Link another account
                    </button>
                  </div>
                  <div className="linked-accounts-list" id="linkedAccountsList">
                    <div className="account-panel-state is-empty">
                      <div className="account-panel-state-title">No accounts linked</div>
                      <div className="account-panel-state-copy">Link a Chess.com or Lichess username below.</div>
                    </div>
                  </div>
                </div>

                <div id="acctPanelChesscom" className="account-card">
                  <div className="hc-header" style={{ marginBottom: '10px' }}>
                    <div className="account-icon cc-icon">&#9823;</div>
                    <div>
                      <div className="hc-title">Chess.com</div>
                      <span className="acct-badge" id="chesscomStatus">Not linked</span>
                    </div>
                  </div>
                  <div className="account-input-row">
                    <input type="text" className="dark-input flex-input" id="chesscomUsername" placeholder="Chess.com username..." defaultValue="" />
                    <button type="button" className="btn-link-acct cc-btn" id="linkChesscom">Link</button>
                  </div>
                  <div className="account-linked-info" id="chesscomLinkedInfo" style={{ display: 'none' }}>
                    <div className="linked-name" id="chesscomLinkedName">@username</div>
                    <div className="linked-btns">
                      <button type="button" className="btn-sm-green" id="fetchChesscomGames">Fetch Games</button>
                      <button type="button" className="btn-sm-red" id="unlinkChesscom">Unlink</button>
                    </div>
                  </div>
                  <div className="platform-games-list" id="chesscomGamesList">
                    <div className="account-panel-state is-empty">
                      <div className="account-panel-state-title">No account linked</div>
                      <div className="account-panel-state-copy">Link your Chess.com username to fetch recent games.</div>
                    </div>
                  </div>
                </div>

                <div id="acctPanelLichess" className="account-card" style={{ display: 'none' }}>
                  <div className="hc-header" style={{ marginBottom: '10px' }}>
                    <div className="account-icon lc-icon">&#9820;</div>
                    <div>
                      <div className="hc-title">Lichess.org</div>
                      <span className="acct-badge" id="lichessStatus">Not linked</span>
                    </div>
                  </div>
                  <div className="account-input-row">
                    <input type="text" className="dark-input flex-input" id="lichessUsername" placeholder="Lichess username..." defaultValue="" />
                    <button type="button" className="btn-link-acct lc-btn" id="linkLichess">Link</button>
                  </div>
                  <div className="account-linked-info" id="lichessLinkedInfo" style={{ display: 'none' }}>
                    <div className="linked-name" id="lichessLinkedName">@username</div>
                    <div className="linked-btns">
                      <button type="button" className="btn-sm-green" id="fetchLichessGames">Fetch Games</button>
                      <button type="button" className="btn-sm-red" id="unlinkLichess">Unlink</button>
                    </div>
                  </div>
                  <div className="platform-games-list" id="lichessGamesList">
                    <div className="account-panel-state is-empty">
                      <div className="account-panel-state-title">No account linked</div>
                      <div className="account-panel-state-copy">Link your Lichess username to fetch recent games.</div>
                    </div>
                  </div>
                </div>
              </m.div>
            </m.div>

            <m.div className="home-col" variants={colContainer}>
              <m.div className="home-card home-daily-puzzle-card" variants={cardItem} whileHover={tileHover}>
                <span className="home-daily-knight" aria-hidden="true">&#9816;</span>
                <div className="home-daily-layout">
                  <div className="home-daily-info">
                    <div className="home-daily-label-row">
                      <span className="home-daily-label-dot" aria-hidden="true" />
                      <span className="home-daily-label-text">Daily Puzzle</span>
                      <button type="button" className="home-daily-date" id="homeDailyPuzzleDate" aria-label="Open daily puzzle calendar">Today</button>
                    </div>
                    <div className="home-daily-elo-block">
                      <span className="home-daily-elo-num" id="homeDailyPuzzleElo">—</span>
                      <span className="home-daily-elo-caption">Puzzle Elo</span>
                    </div>
                    <div className="home-daily-divider" aria-hidden="true" />
                    <div className="home-daily-streak-badge" id="homeDailyStreak">
                      <FlameIcon className="home-daily-streak-fire" />
                      <span className="home-daily-streak-count">0</span>
                      <span className="home-daily-streak-label">day streak</span>
                    </div>
                    <div className="home-daily-status" id="homeDailyPuzzleStatus">Open today&apos;s puzzle to generate it.</div>
                    <button type="button" className="home-daily-play-btn" id="openDailyPuzzleHome">
                      <span>Solve today&apos;s puzzle</span>
                      <svg className="home-daily-play-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="home-daily-board-wrap">
                    <div className="home-daily-preview" id="homeDailyPuzzlePreview">
                      <div className="home-daily-preview-empty">Today&apos;s puzzle preview will appear here.</div>
                    </div>
                    <span className="home-daily-corner home-daily-corner-tl" aria-hidden="true" />
                    <span className="home-daily-corner home-daily-corner-tr" aria-hidden="true" />
                    <span className="home-daily-corner home-daily-corner-bl" aria-hidden="true" />
                    <span className="home-daily-corner home-daily-corner-br" aria-hidden="true" />
                  </div>
                </div>
              </m.div>
            </m.div>
          </m.div>
        </div>
      </LazyMotion>
    </div>
  );
}
