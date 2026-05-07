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
import { getJson, setJson } from '../utils/storage.js';

function loadProfile() {
  var saved = getJson('kv_profile', null);
  if (saved && typeof saved === 'object') {
    state.profile = migrateProfileAccounts(saved);
    setJson('kv_profile', state.profile);
    applyProfile();
  }
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  var el = document.getElementById(id);
  if (el) el.value = value;
}

function applyProfile() {
  // Many of these elements live in tabs that may not be in the DOM
  // depending on which JSX is mounted; tolerate missing nodes.
  if (state.profile.displayName) {
    setText('profileName', state.profile.displayName);
    setValue('profileDisplayName', state.profile.displayName);
  }
  if (state.profile.chesscomUsername) setValue('chesscomUsername', state.profile.chesscomUsername);
  if (state.profile.lichessUsername) setValue('lichessUsername', state.profile.lichessUsername);
  if (state.profile.prefDepth) {
    setValue('prefDepth', state.profile.prefDepth);
    setValue('depthSlider', state.profile.prefDepth);
    setText('depthVal', state.profile.prefDepth);
  }
}

function readValue(id, fallback) {
  var el = document.getElementById(id);
  return el ? el.value : (fallback || '');
}

function saveProfile() {
  var existingProfile = migrateProfileAccounts(getJson('kv_profile', {}) || {});
  state.profile = {
    displayName: readValue('profileDisplayName', existingProfile.displayName),
    chesscomUsername: readValue('chesscomUsername', existingProfile.chesscomUsername),
    lichessUsername: readValue('lichessUsername', existingProfile.lichessUsername),
    linkedAccounts: Array.isArray(existingProfile.linkedAccounts) ? existingProfile.linkedAccounts : [],
    activeAccountId: existingProfile.activeAccountId || '',
    prefEngine: DEFAULT_ENGINE_ID,
    prefDepth: readValue('prefDepth', existingProfile.prefDepth || '20'),
    savedAt: new Date().toISOString()
  };
  state.profile = migrateProfileAccounts(state.profile);

  try {
    setJson('kv_profile', state.profile);
    setText('profileName', state.profile.displayName || 'Guest');
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
