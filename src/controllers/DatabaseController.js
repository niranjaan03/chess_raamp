/**
 * DatabaseController — saved-games CRUD backed by localStorage `kv_database`.
 *
 * Owns `state.gameDatabase` from state.js. Loading a saved game delegates
 * back to the host app for PGN parsing and tab switching via deps passed
 * to init().
 */

import PGNParser from '../lib/pgn-parser';
import { escapeAttr, escapeHtml } from '../utils/dom.js';
import { state } from './state.js';

let _loadPGNGame = () => {};
let _switchTab = () => {};

function load() {
  try {
    var saved = localStorage.getItem('kv_database');
    if (saved) state.gameDatabase = JSON.parse(saved);
  } catch (e) { state.gameDatabase = []; }
}

function save(game) {
  if (!game) return;
  var summary = PGNParser.gameToSummary(game);
  summary.id = Date.now();
  summary.analyzedAt = new Date().toISOString();
  if (game.sourcePlatform) summary.sourcePlatform = game.sourcePlatform;
  if (game.sourceUrl) summary.sourceUrl = game.sourceUrl;
  if (game.reviewUsername) summary.reviewUsername = game.reviewUsername;
  if (game.whiteCountry) summary.whiteCountry = game.whiteCountry;
  if (game.blackCountry) summary.blackCountry = game.blackCountry;
  if (game.liveClocks) summary.liveClocks = game.liveClocks;
  if (game.reviewAccuracies) {
    summary.sourceAccuracies = {
      white: game.reviewAccuracies.white,
      black: game.reviewAccuracies.black,
      source: game.reviewAccuracies.source || ''
    };
  }

  var existingIndex = state.gameDatabase.findIndex(function(g) {
    return (g.pgn && summary.pgn && g.pgn === summary.pgn) ||
      (g.white === summary.white && g.black === summary.black && g.result === summary.result);
  });

  if (existingIndex >= 0) {
    var existing = state.gameDatabase[existingIndex];
    var merged = Object.assign({}, existing, summary, {
      id: existing.id,
      analyzedAt: summary.analyzedAt
    });
    state.gameDatabase.splice(existingIndex, 1);
    state.gameDatabase.unshift(merged);
    try { localStorage.setItem('kv_database', JSON.stringify(state.gameDatabase)); } catch { /* storage full */ }
    return;
  }

  state.gameDatabase.unshift(summary);
  if (state.gameDatabase.length > 500) state.gameDatabase = state.gameDatabase.slice(0, 500);

  try { localStorage.setItem('kv_database', JSON.stringify(state.gameDatabase)); } catch { /* storage full */ }

  updateStats();
}

function updateStats() {
  var el = document.getElementById('statGamesAnalyzed');
  if (el) el.textContent = state.gameDatabase.length;
}

function render(search) {
  var rows = document.getElementById('dbRows');
  if (!rows) return;

  var games = state.gameDatabase;
  if (search) {
    var q = search.toLowerCase();
    games = games.filter(function(g) {
      return (g.white || '').toLowerCase().includes(q) ||
             (g.black || '').toLowerCase().includes(q) ||
             (g.opening || '').toLowerCase().includes(q);
    });
  }

  if (!games.length) {
    rows.innerHTML = '<div class="no-games">No games in database. Import games to get started.</div>';
    return;
  }

  rows.innerHTML = games.slice(0, 50).map(function(g) {
    var resultClass = g.result === '1-0' ? 'result-w' : g.result === '0-1' ? 'result-l' : 'result-d';
    var safeId = escapeAttr(g.id);
    return '<div class="db-row" onclick="AppController.loadDbGame(\'' + safeId + '\')">' +
      '<span>' + escapeHtml(g.white || '?') + '</span>' +
      '<span>' + escapeHtml(g.black || '?') + '</span>' +
      '<span class="' + resultClass + '">' + escapeHtml(g.result || '*') + '</span>' +
      '<span>' + escapeHtml((g.opening || '').substring(0, 20) || '—') + '</span>' +
      '<span>' + escapeHtml((g.date || '').substring(0, 10)) + '</span>' +
      '<span class="db-row-actions"><button class="btn-sm" onclick="event.stopPropagation();AppController.loadDbGame(\'' + safeId + '\')">Load</button></span>' +
      '</div>';
  }).join('');
}

function loadGame(id) {
  var game = state.gameDatabase.find(function(g) { return String(g.id) === String(id); });
  if (game && game.pgn) {
    _loadPGNGame(game.pgn, {
      sourcePlatform: game.sourcePlatform || '',
      sourceUrl: game.sourceUrl || '',
      sourceUsername: game.reviewUsername || '',
      sourceAccuracies: game.sourceAccuracies || null,
      whiteCountry: game.whiteCountry || '',
      blackCountry: game.blackCountry || '',
      liveClocks: game.liveClocks || null
    });
    _switchTab('analyze');
  }
}

function renderSavedGames() {
  var list = document.getElementById('savedGamesList');
  if (!list) return;

  if (!state.gameDatabase.length) {
    list.innerHTML = '<div class="no-games">No saved games yet</div>';
    return;
  }

  list.innerHTML = state.gameDatabase.slice(0, 20).map(function(g) {
    var safeId = escapeAttr(g.id);
    return '<div class="saved-game-item" onclick="AppController.loadDbGame(\'' + safeId + '\')">' +
      '<div class="saved-game-players">' + escapeHtml(g.white || '?') + ' vs ' + escapeHtml(g.black || '?') + ' <strong>' + escapeHtml(g.result || '*') + '</strong></div>' +
      '<div class="saved-game-meta">' + escapeHtml((g.opening || '').substring(0, 30)) + ' • ' + escapeHtml((g.date || '').substring(0, 10)) + '</div>' +
      '</div>';
  }).join('');
}

function init({ loadPGNGame, switchTab } = {}) {
  if (typeof loadPGNGame === 'function') _loadPGNGame = loadPGNGame;
  if (typeof switchTab === 'function') _switchTab = switchTab;
  load();
}

export default {
  init,
  load,
  save,
  render,
  renderSavedGames,
  loadGame,
  updateStats
};
