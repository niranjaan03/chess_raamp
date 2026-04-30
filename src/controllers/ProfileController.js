/**
 * ProfileController — local profile data (display name, linked accounts,
 * engine prefs) backed by localStorage `kv_profile`.
 *
 * Owns nothing beyond the shared `state.profile` slot from state.js.
 * Calls into AuthController.getDefaultProfile() for the seed shape and
 * uses HomeController (when present on window) to refresh derived UI.
 */

import { showToast } from '../utils/toast.js';
import { state, DEFAULT_ENGINE_ID } from './state.js';
import AuthController from './AuthController.js';

function loadProfile() {
  try {
    var saved = localStorage.getItem('kv_profile');
    if (saved) {
      state.profile = migrateProfileAccounts(JSON.parse(saved));
      localStorage.setItem('kv_profile', JSON.stringify(state.profile));
      applyProfile();
    }
  } catch { /* corrupt profile data – keep defaults */ }
}

function applyProfile() {
  if (state.profile.displayName) {
    document.getElementById('profileName').textContent = state.profile.displayName;
    document.getElementById('profileDisplayName').value = state.profile.displayName;
  }
  if (state.profile.chesscomUsername) document.getElementById('chesscomUsername').value = state.profile.chesscomUsername;
  if (state.profile.lichessUsername) document.getElementById('lichessUsername').value = state.profile.lichessUsername;
  if (state.profile.prefDepth) {
    document.getElementById('prefDepth').value = state.profile.prefDepth;
    document.getElementById('depthSlider').value = state.profile.prefDepth;
    document.getElementById('depthVal').textContent = state.profile.prefDepth;
  }
}

function saveProfile() {
  var existingProfile = {};
  try { existingProfile = JSON.parse(localStorage.getItem('kv_profile') || '{}'); } catch(e) { existingProfile = {}; }
  existingProfile = migrateProfileAccounts(existingProfile);
  state.profile = {
    displayName: document.getElementById('profileDisplayName').value,
    chesscomUsername: document.getElementById('chesscomUsername').value,
    lichessUsername: document.getElementById('lichessUsername').value,
    linkedAccounts: Array.isArray(existingProfile.linkedAccounts) ? existingProfile.linkedAccounts : [],
    activeAccountId: existingProfile.activeAccountId || '',
    prefEngine: DEFAULT_ENGINE_ID,
    prefDepth: document.getElementById('prefDepth').value,
    savedAt: new Date().toISOString()
  };
  state.profile = migrateProfileAccounts(state.profile);

  try {
    localStorage.setItem('kv_profile', JSON.stringify(state.profile));
    document.getElementById('profileName').textContent = state.profile.displayName || 'Guest';
    var ss = document.getElementById('saveStatus');
    if (ss) { ss.textContent = '✓ Saved!'; setTimeout(function() { ss.textContent = ''; }, 2000); }
    showToast('Profile saved!', 'success');
    if (window.HomeController) {
      window.HomeController.refreshHomeData();
      window.HomeController.saveCurrentAsProfile(state.profile);
      var em = document.getElementById('profileEditMode');
      var vm = document.getElementById('profileViewMode');
      var et = document.getElementById('editProfileToggle');
      if (em) em.style.display = 'none';
      if (vm) vm.style.display = 'block';
      if (et) et.textContent = 'Edit';
    }
  } catch(e) {
    showToast('Could not save profile', 'error');
  }
}

function normalizeStoredUsername(raw) {
  return String(raw || '').trim().replace(/^@+/, '');
}

function normalizeStoredPlatform(platform) {
  var value = String(platform || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (value === 'chesscom' || value === 'chess') return 'chesscom';
  if (value === 'lichess' || value === 'lichessorg') return 'lichess';
  return value || 'chesscom';
}

function getStoredLinkedAccountId(platform, username) {
  return normalizeStoredPlatform(platform) + ':' + normalizeStoredUsername(username).toLowerCase();
}

function migrateProfileAccounts(source) {
  var p = Object.assign(AuthController.getDefaultProfile(), source || {});
  var accounts = Array.isArray(p.linkedAccounts) ? p.linkedAccounts.slice() : [];
  var byId = {};
  accounts = accounts.map(function(account) {
    if (!account) return null;
    var platform = normalizeStoredPlatform(account.platform || account.site || '');
    var username = normalizeStoredUsername(account.username || account.handle || '');
    if (!platform || !username) return null;
    var id = getStoredLinkedAccountId(platform, username);
    if (byId[id]) return null;
    byId[id] = true;
    return Object.assign({
      id: id,
      platform: platform,
      username: username,
      displayName: username,
      avatar: '',
      ratingData: null,
      lastSynced: '',
      isActive: false
    }, account, { id: id, platform: platform, username: username });
  }).filter(Boolean);
  [
    { platform: 'chesscom', username: p.chesscomUsername },
    { platform: 'lichess', username: p.lichessUsername }
  ].forEach(function(entry) {
    var username = normalizeStoredUsername(entry.username);
    var id = username ? getStoredLinkedAccountId(entry.platform, username) : '';
    if (id && !byId[id]) {
      byId[id] = true;
      accounts.push({
        id: id,
        platform: entry.platform,
        username: username,
        displayName: username,
        avatar: '',
        ratingData: null,
        lastSynced: '',
        isActive: false
      });
    }
  });
  if (!p.activeAccountId || !accounts.some(function(account) { return account.id === p.activeAccountId; })) {
    p.activeAccountId = accounts.length ? accounts[0].id : '';
  }
  p.linkedAccounts = accounts.map(function(account) {
    return Object.assign({}, account, { isActive: account.id === p.activeAccountId });
  });
  var active = p.linkedAccounts.find(function(account) { return account.id === p.activeAccountId; }) || p.linkedAccounts[0] || null;
  var firstChesscom = p.linkedAccounts.find(function(account) { return account.platform === 'chesscom'; });
  var firstLichess = p.linkedAccounts.find(function(account) { return account.platform === 'lichess'; });
  p.chesscomUsername = active && active.platform === 'chesscom' ? active.username : (firstChesscom ? firstChesscom.username : '');
  p.lichessUsername = active && active.platform === 'lichess' ? active.username : (firstLichess ? firstLichess.username : '');
  return p;
}

export default {
  loadProfile,
  applyProfile,
  saveProfile,
  migrateProfileAccounts
};
