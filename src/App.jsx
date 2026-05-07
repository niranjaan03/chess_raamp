import React, { useEffect, Suspense, lazy } from 'react';
import AppController from './controllers/AppController';
import HomeController from './controllers/HomeController';
import PuzzleController from './controllers/PuzzleController';

import Navbar from './components/layout/Navbar.jsx';
import NavDrawer from './components/layout/NavDrawer.jsx';

import HomeTab from './components/tabs/HomeTab.jsx';
import AnalyzeTab from './components/tabs/AnalyzeTab.jsx';
import ImportTab from './components/tabs/ImportTab.jsx';
import GamesTab from './components/tabs/GamesTab.jsx';
import PuzzleTab from './components/tabs/PuzzleTab.jsx';
import DatabaseTab from './components/tabs/DatabaseTab.jsx';
import ProfileTab from './components/tabs/ProfileTab.jsx';
import SettingsTab from './components/tabs/SettingsTab.jsx';

// Lazy: tabs whose DOM is only needed when activated
const OpeningsTab = lazy(() => import('./components/tabs/OpeningsTab.jsx'));
const PlayerAnalyzeTab = lazy(() => import('./components/tabs/PlayerAnalyzeTab.jsx'));
const PricingTab = lazy(() => import('./components/tabs/PricingTab.jsx'));

import { FeedbackModal, AuthModal } from './components/modals/Modals.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { attachAllModals } from './utils/modalA11y.js';

function lazyTabFallback(tabId) {
  return (
    <div className="tab-content" id={tabId} style={{ padding: '24px', color: '#a8b3c2' }}>
      <p>Could not load this tab. Try reloading the page.</p>
    </div>
  );
}

function showBootError(error) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('bootErrorOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'bootErrorOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '99999';
  overlay.style.background = '#090909';
  overlay.style.color = '#f6e7bf';
  overlay.style.padding = '24px';
  overlay.style.fontFamily = '"IBM Plex Mono", monospace';
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.style.overflow = 'auto';

  const title = document.createElement('div');
  title.style.fontSize = '18px';
  title.style.fontWeight = '700';
  title.style.marginBottom = '12px';
  title.textContent = 'Startup error';

  const message = document.createElement('div');
  message.style.opacity = '.86';
  message.style.marginBottom = '16px';
  message.textContent = 'The app hit an exception during boot.';

  const details = document.createElement('pre');
  details.style.margin = '0';
  details.style.whiteSpace = 'pre-wrap';
  details.textContent = String((error && error.stack) || error || 'Unknown error');

  overlay.append(title, message, details);
  document.body.appendChild(overlay);
}

function App() {
  useEffect(() => {
    try {
      // Cross-controller lookups still go through these globals to avoid
      // import cycles (e.g. AppController.switchTab -> HomeController.refresh).
      // They are NOT used by inline onclick handlers anymore — those are
      // delegated through src/utils/actions.js. Treat any new inline handler
      // string as an XSS regression.
      if (typeof window !== 'undefined') {
        window.AppController = AppController;
        window.HomeController = HomeController;
      }

      AppController.init();
      attachAllModals();
    } catch (error) {
      console.error('App boot failed', error);
      showBootError(error);
    }
  }, []);

  const handleSwitchTab = (tab) => {
    AppController.switchToTab(tab);
  };

  const handleGamesTabFetch = () => {
    HomeController.fetchLatestChesscomGames();
  };

  const handleOpenDailyPuzzle = () => {
    PuzzleController.setMode('daily');
    handleSwitchTab('puzzle');
  };

  return (
    <ErrorBoundary>
      <Navbar />
      <NavDrawer />

      <div className="app-container">
        <HomeTab onSwitchTab={handleSwitchTab} onOpenDailyPuzzle={handleOpenDailyPuzzle} />
        <AnalyzeTab />
        <ImportTab />
        <GamesTab onFetchLatest={handleGamesTabFetch} />
        <PuzzleTab />
        <DatabaseTab />
        <ErrorBoundary fallback={lazyTabFallback('tab-openings')}>
          <Suspense fallback={<div className="tab-content" id="tab-openings" />}>
            <OpeningsTab />
          </Suspense>
        </ErrorBoundary>
        <ProfileTab />
        <ErrorBoundary fallback={lazyTabFallback('tab-pricing')}>
          <Suspense fallback={<div className="tab-content" id="tab-pricing" />}>
            <PricingTab />
          </Suspense>
        </ErrorBoundary>
        <SettingsTab />
        <ErrorBoundary fallback={lazyTabFallback('tab-player-analyze')}>
          <Suspense fallback={<div className="tab-content" id="tab-player-analyze" />}>
            <PlayerAnalyzeTab />
          </Suspense>
        </ErrorBoundary>
      </div>

      <FeedbackModal />
      <AuthModal />

      <div id="toast" className="toast"></div>

      <div id="streakNotification" className="streak-notif" role="status" aria-live="polite">
        <span className="streak-notif-fire" aria-hidden="true">🔥</span>
        <span className="streak-notif-body">
          <span className="streak-notif-count" id="streakNotificationCount">0</span>
          <span className="streak-notif-label" id="streakNotificationLabel">day streak</span>
        </span>
      </div>
    </ErrorBoundary>
  );
}

export default App;
