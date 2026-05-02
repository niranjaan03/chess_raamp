import React, { useEffect } from 'react';
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
import OpeningsTab from './components/tabs/OpeningsTab.jsx';
import ProfileTab from './components/tabs/ProfileTab.jsx';
import SupportTab from './components/tabs/SupportTab.jsx';
import PricingTab from './components/tabs/PricingTab.jsx';
import SettingsTab from './components/tabs/SettingsTab.jsx';
import PlayerAnalyzeTab from './components/tabs/PlayerAnalyzeTab.jsx';

import { FeedbackModal, AuthModal } from './components/modals/Modals.jsx';

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
      if (typeof window !== 'undefined') {
        window.AppController = AppController;
        window.HomeController = HomeController;
        window.PuzzleController = PuzzleController;
      }

      AppController.init();
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
    <>
      <Navbar />
      <NavDrawer />

      <div className="app-container">
        <HomeTab onSwitchTab={handleSwitchTab} onOpenDailyPuzzle={handleOpenDailyPuzzle} />
        <AnalyzeTab />
        <ImportTab />
        <GamesTab onFetchLatest={handleGamesTabFetch} />
        <PuzzleTab />
        <DatabaseTab />
        <OpeningsTab />
        <ProfileTab />
        <SupportTab />
        <PricingTab />
        <SettingsTab />
        <PlayerAnalyzeTab />
      </div>

      <FeedbackModal />
      <AuthModal />

      <div id="toast" className="toast"></div>
    </>
  );
}

export default App;
