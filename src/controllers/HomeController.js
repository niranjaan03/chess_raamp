/**
 * KnightVision - Home Page Controller
 * Manages home page: profile, linked accounts (Chess.com / Lichess),
 * saved profiles, imports, recent games, and the Games tab.
 */

import AppController from './AppController.js';
import PuzzleController from './PuzzleController.js';
import { bindClick, escapeAttr, escapeHtml, getEl } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';

const DEFAULT_ENGINE_LABEL = 'Selectable Browser Stockfish';

const HomeController = (function() {
  var chesscomStatsRequest = 0;
  var CHESSCOM_FETCH_MONTHS = 3;
  var GAMES_TAB_PAGE_SIZE = 50;
  var accountSyncRequests = {};

  function init() {
    setupImportTabs();
    setupAccountPanelTabs();
    setupAccountLinks();
    setupProfileEditToggle();
    setupSavedProfiles();
    setupHomeImport();
    setupRecentGamesList();
    refreshHomeData();
  }

  function refreshHomeData() {
    updateVisitStreak();
    loadProfileToHome();
    renderRecentGames();
    restoreLinkedAccounts();
    refreshChesscomRatings();
    PuzzleController.refreshDailyHomeCard();
  }

  // Profile edit toggle
  function setupProfileEditToggle() {
    var btn = document.getElementById('editProfileToggle');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var viewMode = document.getElementById('profileViewMode');
      var editMode = document.getElementById('profileEditMode');
      if (editMode.style.display === 'none') {
        editMode.style.display = 'block';
        viewMode.style.display = 'none';
        btn.textContent = 'Cancel';
        // Prefill form
        var p = getProfile();
        if (document.getElementById('profileDisplayName')) document.getElementById('profileDisplayName').value = p.displayName || '';
        if (document.getElementById('prefDepth')) document.getElementById('prefDepth').value = p.prefDepth || '20';
      } else {
        editMode.style.display = 'none';
        viewMode.style.display = 'block';
        btn.textContent = 'Edit';
      }
    });
  }

  function getProfile() {
    try {
      var migrated = migrateProfileAccounts(JSON.parse(localStorage.getItem('kv_profile') || '{}'));
      localStorage.setItem('kv_profile', JSON.stringify(migrated));
      return migrated;
    } catch(e) { return migrateProfileAccounts({}); }
  }

  function normalizePlatform(platform) {
    var value = String(platform || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (value === 'chesscom' || value === 'chess') return 'chesscom';
    if (value === 'lichess' || value === 'lichessorg') return 'lichess';
    return value || 'chesscom';
  }

  function getAccountId(platform, username) {
    return normalizePlatform(platform) + ':' + normalizeUsername(username).toLowerCase();
  }

  function createLinkedAccount(platform, username, patch) {
    var normalizedPlatform = normalizePlatform(platform);
    var normalizedUsername = normalizeUsername(username);
    return Object.assign({
      id: getAccountId(normalizedPlatform, normalizedUsername),
      platform: normalizedPlatform,
      username: normalizedUsername,
      displayName: normalizedUsername,
      avatar: '',
      ratingData: null,
      lastSynced: '',
      isActive: false
    }, patch || {});
  }

  function migrateProfileAccounts(source) {
    var p = Object.assign({}, source || {});
    var accounts = Array.isArray(p.linkedAccounts) ? p.linkedAccounts.slice() : [];
    var byId = {};
    accounts = accounts.map(function(account) {
      if (!account) return null;
      var platform = normalizePlatform(account.platform || account.site || '');
      var username = normalizeUsername(account.username || account.handle || '');
      if (!platform || !username) return null;
      var normalized = createLinkedAccount(platform, username, account);
      normalized.id = getAccountId(platform, username);
      normalized.platform = platform;
      normalized.username = username;
      normalized.isActive = false;
      if (byId[normalized.id]) return null;
      byId[normalized.id] = true;
      return normalized;
    }).filter(Boolean);

    [
      { platform: 'chesscom', username: p.chesscomUsername },
      { platform: 'lichess', username: p.lichessUsername }
    ].forEach(function(entry) {
      var username = normalizeUsername(entry.username);
      var id = username ? getAccountId(entry.platform, username) : '';
      if (id && !byId[id]) {
        byId[id] = true;
        accounts.push(createLinkedAccount(entry.platform, username));
      }
    });

    if (!p.activeAccountId || !accounts.some(function(account) { return account.id === p.activeAccountId; })) {
      p.activeAccountId = accounts.length ? accounts[0].id : '';
    }
    accounts = accounts.map(function(account) {
      return Object.assign({}, account, { isActive: account.id === p.activeAccountId });
    });
    p.linkedAccounts = accounts;
    return syncLegacyAccountFields(p);
  }

  function syncLegacyAccountFields(profileObj) {
    var p = Object.assign({}, profileObj || {});
    var accounts = Array.isArray(p.linkedAccounts) ? p.linkedAccounts : [];
    var active = accounts.find(function(account) { return account.id === p.activeAccountId; }) || accounts[0] || null;
    var firstChesscom = accounts.find(function(account) { return account.platform === 'chesscom'; });
    var firstLichess = accounts.find(function(account) { return account.platform === 'lichess'; });
    if (active && active.platform === 'chesscom') p.chesscomUsername = active.username;
    else p.chesscomUsername = firstChesscom ? firstChesscom.username : '';
    if (active && active.platform === 'lichess') p.lichessUsername = active.username;
    else p.lichessUsername = firstLichess ? firstLichess.username : '';
    p.linkedAccounts = accounts.map(function(account) {
      return Object.assign({}, account, { isActive: account.id === p.activeAccountId });
    });
    return p;
  }

  function saveProfileObject(p) {
    var next = syncLegacyAccountFields(migrateProfileAccounts(p));
    localStorage.setItem('kv_profile', JSON.stringify(next));
    return next;
  }

  function getLinkedAccounts() {
    return getProfile().linkedAccounts || [];
  }

  function getActiveLinkedAccount(platform) {
    var normalizedPlatform = platform ? normalizePlatform(platform) : '';
    var p = getProfile();
    var accounts = p.linkedAccounts || [];
    var active = accounts.find(function(account) { return account.id === p.activeAccountId; }) || null;
    if (normalizedPlatform && (!active || active.platform !== normalizedPlatform)) {
      active = accounts.find(function(account) { return account.platform === normalizedPlatform; }) || null;
    }
    return active;
  }

  function getTodayKey() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function dateKeyToLocalDate(dateKey) {
    var parts = (dateKey || '').split('-');
    if (parts.length !== 3) return null;
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
  }

  function getVisitStreak() {
    try {
      var saved = JSON.parse(localStorage.getItem('kv_visit_streak') || '{}');
      return {
        lastVisit: saved.lastVisit || '',
        streak: Math.max(1, parseInt(saved.streak, 10) || 1)
      };
    } catch (e) {
      return { lastVisit: '', streak: 1 };
    }
  }

  function saveVisitStreak(data) {
    try {
      localStorage.setItem('kv_visit_streak', JSON.stringify({
        lastVisit: data.lastVisit,
        streak: data.streak
      }));
    } catch { /* storage full */ }
  }

  function updateVisitStreak() {
    var streakData = getVisitStreak();
    var todayKey = getTodayKey();

    if (!streakData.lastVisit) {
      streakData.lastVisit = todayKey;
      streakData.streak = 1;
      saveVisitStreak(streakData);
      return streakData;
    }

    if (streakData.lastVisit === todayKey) {
      return streakData;
    }

    var lastDate = dateKeyToLocalDate(streakData.lastVisit);
    var todayDate = dateKeyToLocalDate(todayKey);
    var daysDiff = lastDate && todayDate ? Math.round((todayDate - lastDate) / 86400000) : 0;

    if (daysDiff === 1) {
      streakData.streak += 1;
    } else {
      streakData.streak = 1;
    }

    streakData.lastVisit = todayKey;
    saveVisitStreak(streakData);
    return streakData;
  }

  function updateStreakUI() {
    var streakData = getVisitStreak();
    var valueEl = document.getElementById('profileStreakValue');
    var labelEl = document.querySelector('#profileStreakRow .profile-streak-label');
    if (valueEl) valueEl.textContent = String(streakData.streak);
    if (labelEl) labelEl.textContent = streakData.streak === 1 ? 'day streak' : 'days streak';
  }

  function loadProfileToHome() {
    var p = getProfile();
    var name = p.displayName || 'Guest';

    // Hero name
    var heroName = document.getElementById('heroName');
    if (heroName) heroName.textContent = name;

    // Navbar
    var navName = document.getElementById('profileName');
    if (navName) navName.textContent = name;

    // Profile view
    var nameView = document.getElementById('profileDisplayNameView');
    if (nameView) nameView.textContent = name;

    // Initials
    var initialsEl = document.getElementById('profileInitials');
    if (initialsEl) {
      var parts = name.trim().split(' ');
      initialsEl.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }

    // Engine/depth
    var evEl = document.getElementById('profileEngineView');
    var dvEl = document.getElementById('profileDepthView');
    if (evEl) evEl.textContent = DEFAULT_ENGINE_LABEL;
    if (dvEl) dvEl.textContent = p.prefDepth || '20';

    // Account chips
    updateAccountChips(p);

    updateStreakUI();

    // Stats
    updateHomeStats();
  }

  function updateAccountChips(p) {
    var ccChip = document.getElementById('chesscomChip');
    var lcChip = document.getElementById('lichessChip');
    var noChip = document.getElementById('noAccountsChip');
    var ccName = document.getElementById('chesscomChipName');
    var lcName = document.getElementById('lichessChipName');
    var accounts = (p && p.linkedAccounts) || [];
    var active = accounts.find(function(account) { return account.id === p.activeAccountId; }) || accounts[0] || null;
    var chesscom = active && active.platform === 'chesscom' ? active : accounts.find(function(account) { return account.platform === 'chesscom'; });
    var lichess = active && active.platform === 'lichess' ? active : accounts.find(function(account) { return account.platform === 'lichess'; });

    if (chesscom) {
      if (ccChip) { ccChip.style.display = 'inline-flex'; }
      if (ccName) ccName.textContent = chesscom.username;
    } else {
      if (ccChip) ccChip.style.display = 'none';
    }
    if (lichess) {
      if (lcChip) { lcChip.style.display = 'inline-flex'; }
      if (lcName) lcName.textContent = lichess.username;
    } else {
      if (lcChip) lcChip.style.display = 'none';
    }
    if (noChip) noChip.style.display = accounts.length ? 'none' : 'inline-flex';
  }

  function updateHomeStats() {
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch { /* corrupt data – start with empty db */ }
    var g = document.getElementById('hmStatGames');
    if (g) g.textContent = db.length;
  }

  function setChesscomRatingsState(values, username) {
    var bulletEl = document.getElementById('hmStatBullet');
    var blitzEl = document.getElementById('hmStatBlitz');
    var rapidEl = document.getElementById('hmStatRapid');
    var userEl = document.getElementById('hmChesscomStatsUser');

    if (bulletEl) bulletEl.textContent = values && values.bullet ? values.bullet : '—';
    if (blitzEl) blitzEl.textContent = values && values.blitz ? values.blitz : '—';
    if (rapidEl) rapidEl.textContent = values && values.rapid ? values.rapid : '—';
    if (userEl) userEl.textContent = username ? '@' + username : 'Not linked';
  }

  function extractChesscomRating(stats, key) {
    if (!stats || !stats[key] || !stats[key].last || typeof stats[key].last.rating !== 'number') {
      return '—';
    }
    return String(stats[key].last.rating);
  }

  function refreshChesscomRatings() {
    var account = getActiveLinkedAccount('chesscom');
    if (!account || !account.username) {
      setChesscomRatingsState(null, '');
      return;
    }
    if (account.ratingData) {
      setChesscomRatingsState({
        bullet: account.ratingData.bullet || '—',
        blitz: account.ratingData.blitz || '—',
        rapid: account.ratingData.rapid || '—'
      }, account.username);
      return;
    }
    fetchChesscomRatings(account.username);
  }

  function fetchChesscomRatings(username) {
    var requestId = ++chesscomStatsRequest;
    setChesscomRatingsState({
      bullet: '...',
      blitz: '...',
      rapid: '...'
    }, username);

    var encodedUser = encodeURIComponent(username);
    AppController.fetchChesscomWithFallback(
      '/api/chesscom/player/' + encodedUser + '/stats',
      'https://api.chess.com/pub/player/' + encodedUser + '/stats',
      'json'
    )
      .then(function(stats) {
        if (requestId !== chesscomStatsRequest) return;
        setChesscomRatingsState({
          bullet: extractChesscomRating(stats, 'chess_bullet'),
          blitz: extractChesscomRating(stats, 'chess_blitz'),
          rapid: extractChesscomRating(stats, 'chess_rapid')
        }, username);
      })
      .catch(function(err) {
        console.error('Chess.com stats fetch error:', err);
        if (requestId !== chesscomStatsRequest) return;
        setChesscomRatingsState({
          bullet: '—',
          blitz: '—',
          rapid: '—'
        }, username);
      });
  }

  // Saved Profiles
  function setupSavedProfiles() {
    bindHomeClick('addProfileBtn', 'homeAddProfileBound', function() {
      var p = getProfile();
      if (!p.displayName) {
        showToast('Fill in and save your profile first', 'error');
        var editBtn = document.getElementById('editProfileToggle');
        if (editBtn) editBtn.click();
        return;
      }
      saveCurrentAsProfile(p);
    });
    setupSavedProfileActions();
    renderSavedProfilesList();
  }

  function setupSavedProfileActions() {
    bindHomeClick('savedProfilesList', 'homeProfilesBound', function(e) {
      if (!e.target || !e.target.closest) return;
      var fetchBtn = e.target.closest('[data-profile-fetch]');
      if (fetchBtn) {
        fetchSavedProfileGames(fetchBtn.getAttribute('data-profile-fetch'), fetchBtn.getAttribute('data-profile-platform'));
        return;
      }
      var deleteBtn = e.target.closest('[data-profile-delete]');
      if (deleteBtn) {
        deleteProfile(deleteBtn.getAttribute('data-profile-delete'));
        return;
      }
      var loadTarget = e.target.closest('[data-profile-load], [data-profile-id]');
      if (loadTarget) {
        loadProfileFn(loadTarget.getAttribute('data-profile-load') || loadTarget.getAttribute('data-profile-id'));
      }
    });
  }

  function getSavedProfiles() {
    try { return JSON.parse(localStorage.getItem('kv_saved_profiles') || '[]'); } catch(e) { return []; }
  }

  function getSavedProfileDisplayName(p) {
    if (p && p.displayName) return p.displayName;
    var active = p && Array.isArray(p.linkedAccounts)
      ? (p.linkedAccounts.find(function(account) { return account.id === p.activeAccountId; }) || p.linkedAccounts[0])
      : null;
    if (active) return getPlatformLabel(active.platform) + ' @' + active.username;
    if (p && p.chesscomUsername) return 'Chess.com @' + p.chesscomUsername;
    if (p && p.lichessUsername) return 'Lichess @' + p.lichessUsername;
    return 'Unnamed';
  }

  function isActiveSavedProfile(saved, active) {
    return String(saved.displayName || '') === String(active.displayName || '') &&
      String(saved.activeAccountId || '') === String(active.activeAccountId || '') &&
      String(saved.chesscomUsername || '') === String(active.chesscomUsername || '') &&
      String(saved.lichessUsername || '') === String(active.lichessUsername || '');
  }

  function saveCurrentAsProfile(p, silent) {
    var profiles = getSavedProfiles();
    var existing = profiles.findIndex(function(x) { return x.displayName === p.displayName; });
    var entry = Object.assign({}, migrateProfileAccounts(p), { savedAt: new Date().toISOString(), id: Date.now() });
    if (existing !== -1) {
      profiles[existing] = entry;
      if (!silent) showToast('Profile updated', 'success');
    } else {
      profiles.push(entry);
      if (!silent) showToast('Profile saved!', 'success');
    }
    localStorage.setItem('kv_saved_profiles', JSON.stringify(profiles));
    renderSavedProfilesList();
  }

  function renderSavedProfilesList() {
    var container = document.getElementById('savedProfilesList');
    if (!container) return;
    var profiles = getSavedProfiles();
    var active = getProfile();

    if (!profiles.length) {
      container.innerHTML =
        '<div class="dashboard-empty-state">' +
          '<div class="dashboard-empty-title">No saved profiles yet</div>' +
          '<div class="dashboard-empty-copy">Edit your profile, then save it here for quick switching.</div>' +
        '</div>';
      return;
    }

    container.innerHTML = profiles.map(function(p) {
      var displayName = getSavedProfileDisplayName(p);
      var initials = displayName ? displayName.replace(/^.*@/, '').substring(0, 2).toUpperCase() : '??';
      var parts = displayName.trim().split(' ');
      if (parts.length >= 2) initials = (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
      var isActive = isActiveSavedProfile(p, active);
      var linked = migrateProfileAccounts(p).linkedAccounts || [];
      var accounts = linked.map(function(account) {
        return (account.platform === 'chesscom' ? '&#9823; ' : '&#9820; ') + escapeHtml(account.username) + (account.id === p.activeAccountId ? ' active' : '');
      }).join(' \u00b7 ') || 'No linked accounts';
      var meta = 'Stockfish \u00b7 Depth ' + escapeHtml(String(p.prefDepth || 20));
      var safeId = escapeAttr(p.id);
      var fetchActions = [
        linked.some(function(account) { return account.platform === 'chesscom'; }) ? '<button type="button" class="sp-fetch-btn" data-profile-fetch="' + safeId + '" data-profile-platform="chesscom">Fetch Games</button>' : '',
        linked.some(function(account) { return account.platform === 'lichess'; }) ? '<button type="button" class="sp-fetch-btn" data-profile-fetch="' + safeId + '" data-profile-platform="lichess">Fetch Lichess Games</button>' : ''
      ].filter(Boolean).join('');

      return '<div class="saved-profile-item' + (isActive ? ' active-profile' : '') + '" data-profile-id="' + safeId + '">' +
        '<div class="sp-avatar">' + escapeHtml(initials) + '</div>' +
        '<div class="sp-info">' +
          '<div class="sp-name">' + escapeHtml(displayName) + '</div>' +
          '<div class="sp-meta sp-accounts">Linked: ' + accounts + '</div>' +
          '<div class="sp-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="sp-actions">' +
          fetchActions +
          '<button type="button" class="sp-load-btn" data-profile-load="' + safeId + '">Load</button>' +
          '<button type="button" class="sp-del-btn" data-profile-delete="' + safeId + '">\u2715</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function fetchSavedProfileGames(id, platform) {
    var profiles = getSavedProfiles();
    var p = profiles.find(function(x) { return String(x.id) === String(id); });
    if (!p) return;
    var normalizedPlatform = platform === 'lichess' ? 'lichess' : 'chesscom';
    p = migrateProfileAccounts(p);
    var account = (p.linkedAccounts || []).find(function(item) {
      return item.platform === normalizedPlatform && item.id === p.activeAccountId;
    }) || (p.linkedAccounts || []).find(function(item) { return item.platform === normalizedPlatform; });
    if (!account || !account.username) {
      showToast('No ' + getPlatformLabel(normalizedPlatform) + ' account saved on this profile', 'error');
      return;
    }
    p.activeAccountId = account.id;
    localStorage.setItem('kv_profile', JSON.stringify(syncLegacyAccountFields(p)));
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    setAccountPanel(normalizedPlatform);
    fetchPlatformGames(normalizedPlatform, account.username);
  }

  function loadProfileFn(id) {
    var profiles = getSavedProfiles();
    var p = profiles.find(function(x) { return String(x.id) === String(id); });
    if (!p) return;
    localStorage.setItem('kv_profile', JSON.stringify(migrateProfileAccounts(p)));
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    showToast('Loaded profile: ' + p.displayName, 'success');
  }

  function deleteProfile(id) {
    var profiles = getSavedProfiles().filter(function(x) { return String(x.id) !== String(id); });
    localStorage.setItem('kv_saved_profiles', JSON.stringify(profiles));
    renderSavedProfilesList();
    showToast('Profile deleted', '');
  }

  // Account Linking
  function getPlatformLabel(platform) {
    return platform === 'chesscom' ? 'Chess.com' : 'Lichess';
  }

  function getPlatformInputId(platform) {
    return platform === 'chesscom' ? 'chesscomUsername' : 'lichessUsername';
  }

  function getAccountPanelCopy(platform, isLinked) {
    var label = getPlatformLabel(platform);
    if (!isLinked) return 'Link your ' + label + ' username to fetch recent games.';
    return platform === 'chesscom'
      ? 'Use Fetch Games to open your latest 3 months of Chess.com archives in the Games tab.'
      : 'Use Fetch Games to load your latest Lichess games here.';
  }

  function renderAccountPanelState(platform, state, title, copy, force) {
    var list = document.getElementById(platform + 'GamesList');
    if (!list) return;
    if (!force && list.querySelector('.fetch-game-item')) return;
    list.innerHTML =
      '<div class="account-panel-state is-' + escapeAttr(state || 'empty') + '">' +
        '<div class="account-panel-state-title">' + escapeHtml(title || '') + '</div>' +
        (copy ? '<div class="account-panel-state-copy">' + escapeHtml(copy) + '</div>' : '') +
      '</div>';
  }

  function bindHomeClick(target, key, handler) {
    var el = getEl(target);
    if (!el || el.dataset[key] === '1') return;
    el.dataset[key] = '1';
    bindClick(el, handler);
  }

  function setAccountPanel(platform) {
    var activePlatform = platform === 'lichess' ? 'lichess' : 'chesscom';
    [
      { name: 'chesscom', panelId: 'acctPanelChesscom', toggleId: 'toggleChesscom' },
      { name: 'lichess', panelId: 'acctPanelLichess', toggleId: 'toggleLichess' }
    ].forEach(function(item) {
      var isActive = item.name === activePlatform;
      var panel = document.getElementById(item.panelId);
      var toggle = document.getElementById(item.toggleId);
      if (panel) panel.style.display = isActive ? '' : 'none';
      if (toggle) {
        toggle.classList.toggle('active', isActive);
        toggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    });
  }

  function setupAccountPanelTabs() {
    document.querySelectorAll('.acct-toggle-btn[data-account-panel]').forEach(function(btn) {
      if (btn.dataset.homeAccountBound === '1') return;
      btn.dataset.homeAccountBound = '1';
      bindClick(btn, function() {
        setAccountPanel(btn.getAttribute('data-account-panel') || 'chesscom');
      });
    });
    setAccountPanel('chesscom');
  }

  function setupAccountLinks() {
    bindHomeClick('linkedAccountsList', 'homeLinkedAccountsBound', function(e) {
      if (!e.target || !e.target.closest) return;
      var switchBtn = e.target.closest('[data-account-switch]');
      if (switchBtn) {
        switchLinkedAccount(switchBtn.getAttribute('data-account-switch'));
        return;
      }
      var syncBtn = e.target.closest('[data-account-sync]');
      if (syncBtn) {
        syncLinkedAccount(syncBtn.getAttribute('data-account-sync'), true);
        return;
      }
      var removeBtn = e.target.closest('[data-account-remove]');
      if (removeBtn) {
        removeLinkedAccount(removeBtn.getAttribute('data-account-remove'));
      }
    });

    bindHomeClick('linkAnotherAccountBtn', 'homeLinkAnotherBound', function() {
      var platform = document.querySelector('.acct-toggle-btn.active[data-account-panel]');
      var activePlatform = platform ? platform.getAttribute('data-account-panel') : 'chesscom';
      var input = document.getElementById(getPlatformInputId(activePlatform));
      if (input && input.focus) input.focus();
    });

    // Chess.com
    bindHomeClick('linkChesscom', 'homeLinkBound', function() {
      var input = document.getElementById('chesscomUsername');
      var val = normalizeUsername(input ? input.value : '');
      if (!val) { showToast('Enter a Chess.com username', 'error'); return; }
      if (input) input.value = val;
      linkAccount('chesscom', val);
    });
    bindHomeClick('unlinkChesscom', 'homeUnlinkBound', function() {
      var account = getActiveLinkedAccount('chesscom');
      if (account) removeLinkedAccount(account.id);
    });
    bindHomeClick('fetchChesscomGames', 'homeFetchBound', function() {
      var account = getActiveLinkedAccount('chesscom');
      if (account) fetchPlatformGames('chesscom', account.username);
      else showToast('Link your Chess.com username first', 'error');
    });

    // Lichess
    bindHomeClick('linkLichess', 'homeLinkBound', function() {
      var input = document.getElementById('lichessUsername');
      var val = normalizeUsername(input ? input.value : '');
      if (!val) { showToast('Enter a Lichess username', 'error'); return; }
      if (input) input.value = val;
      linkAccount('lichess', val);
    });
    bindHomeClick('unlinkLichess', 'homeUnlinkBound', function() {
      var account = getActiveLinkedAccount('lichess');
      if (account) removeLinkedAccount(account.id);
    });
    bindHomeClick('fetchLichessGames', 'homeFetchBound', function() {
      var account = getActiveLinkedAccount('lichess');
      if (account) fetchPlatformGames('lichess', account.username);
      else showToast('Link your Lichess username first', 'error');
    });
  }

  function linkAccount(platform, username) {
    username = normalizeUsername(username);
    platform = normalizePlatform(platform);
    if (!username) {
      showToast('Enter a ' + (platform === 'chesscom' ? 'Chess.com' : 'Lichess') + ' username', 'error');
      return;
    }
    var p = getProfile();
    var id = getAccountId(platform, username);
    if ((p.linkedAccounts || []).some(function(account) { return account.id === id; })) {
      showToast(getPlatformLabel(platform) + ' @' + username + ' is already linked', 'error');
      return;
    }
    renderAccountPanelState(platform, 'loading', 'Linking ' + getPlatformLabel(platform), 'Checking @' + username + ' and fetching profile data.', true);
    setLinkButtonLoading(platform, true);
    fetchBasicAccountProfile(platform, username)
      .then(function(meta) {
        var current = getProfile();
        var account = createLinkedAccount(platform, username, Object.assign({}, meta || {}, {
          lastSynced: new Date().toISOString(),
          isActive: true
        }));
        current.linkedAccounts = (current.linkedAccounts || []).concat(account);
        current.activeAccountId = account.id;
        current = saveProfileObject(current);
        saveCurrentAsProfile(current, true);
        clearPlatformInput(platform);
        loadProfileToHome();
        restoreLinkedAccounts();
        renderSavedProfilesList();
        if (platform === 'chesscom') {
          setChesscomRatingsState(account.ratingData, username);
        }
        showToast(getPlatformLabel(platform) + ' account linked', 'success');
      })
      .catch(function(err) {
        renderAccountPanelState(platform, 'error', 'Could not link account', describeAccountLinkError(platform, username, err), true);
        showToast(describeAccountLinkError(platform, username, err), 'error');
      })
      .finally(function() {
        setLinkButtonLoading(platform, false);
      });
  }

  function setLinkButtonLoading(platform, loading) {
    var btn = document.getElementById(platform === 'chesscom' ? 'linkChesscom' : 'linkLichess');
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? 'Linking...' : 'Link';
  }

  function clearPlatformInput(platform) {
    var input = document.getElementById(getPlatformInputId(platform));
    if (input) input.value = '';
  }

  function describeAccountLinkError(platform, username, err) {
    if (err && err.status === 404) return getPlatformLabel(platform) + ' user @' + username + ' was not found.';
    if (err && err.timeout) return getPlatformLabel(platform) + ' profile lookup timed out. Try again.';
    return 'Could not verify ' + getPlatformLabel(platform) + ' @' + username + '.';
  }

  function fetchBasicAccountProfile(platform, username) {
    platform = normalizePlatform(platform);
    username = normalizeUsername(username);
    if (platform === 'chesscom') {
      var encodedChesscom = encodeURIComponent(username);
      return AppController.fetchChesscomWithFallback(
        '/api/chesscom/player/' + encodedChesscom,
        'https://api.chess.com/pub/player/' + encodedChesscom,
        'json'
      ).then(function(profilePayload) {
        return AppController.fetchChesscomWithFallback(
          '/api/chesscom/player/' + encodedChesscom + '/stats',
          'https://api.chess.com/pub/player/' + encodedChesscom + '/stats',
          'json'
        ).catch(function() { return null; }).then(function(stats) {
          return {
            displayName: profilePayload && (profilePayload.name || profilePayload.username) || username,
            avatar: profilePayload && profilePayload.avatar || '',
            ratingData: stats ? {
              bullet: extractChesscomRating(stats, 'chess_bullet'),
              blitz: extractChesscomRating(stats, 'chess_blitz'),
              rapid: extractChesscomRating(stats, 'chess_rapid')
            } : null
          };
        });
      });
    }
    var encodedLichess = encodeURIComponent(username);
    return AppController.fetchTextWithFallback(
      '/api/lichess/user/' + encodedLichess,
      'https://lichess.org/api/user/' + encodedLichess,
      { Accept: 'application/json' }
    ).then(function(text) {
      var payload = {};
      try { payload = JSON.parse(text); } catch(e) { payload = {}; }
      var perfs = payload.perfs || {};
      return {
        displayName: payload.username || username,
        avatar: '',
        ratingData: {
          bullet: perfs.bullet && perfs.bullet.rating ? String(perfs.bullet.rating) : '—',
          blitz: perfs.blitz && perfs.blitz.rating ? String(perfs.blitz.rating) : '—',
          rapid: perfs.rapid && perfs.rapid.rating ? String(perfs.rapid.rating) : '—'
        }
      };
    });
  }

  function switchLinkedAccount(accountId) {
    var p = getProfile();
    var account = (p.linkedAccounts || []).find(function(item) { return item.id === accountId; });
    if (!account) return;
    p.activeAccountId = account.id;
    p = saveProfileObject(p);
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    setAccountPanel(account.platform);
    if (account.platform === 'chesscom') refreshChesscomRatings();
    showToast('Active account: ' + getPlatformLabel(account.platform) + ' @' + account.username, 'success');
  }

  function removeLinkedAccount(accountId) {
    var p = getProfile();
    var removed = (p.linkedAccounts || []).find(function(account) { return account.id === accountId; });
    if (!removed) return;
    p.linkedAccounts = (p.linkedAccounts || []).filter(function(account) { return account.id !== accountId; });
    if (p.activeAccountId === accountId) {
      p.activeAccountId = p.linkedAccounts.length ? p.linkedAccounts[0].id : '';
    }
    p = saveProfileObject(p);
    saveCurrentAsProfile(p, true);
    loadProfileToHome();
    restoreLinkedAccounts();
    renderSavedProfilesList();
    if (removed.platform === 'chesscom') refreshChesscomRatings();
    showToast('Removed ' + getPlatformLabel(removed.platform) + ' @' + removed.username, '');
  }

  function syncLinkedAccount(accountId, fetchGamesAfterSync) {
    var p = getProfile();
    var account = (p.linkedAccounts || []).find(function(item) { return item.id === accountId; });
    if (!account) return;
    accountSyncRequests[account.id] = true;
    renderLinkedAccountsList();
    renderAccountPanelState(account.platform, 'loading', 'Syncing ' + getPlatformLabel(account.platform), 'Refreshing profile and rating data for @' + account.username + '.', true);
    fetchBasicAccountProfile(account.platform, account.username)
      .then(function(meta) {
        var current = getProfile();
        current.linkedAccounts = (current.linkedAccounts || []).map(function(item) {
          if (item.id !== account.id) return item;
          return Object.assign({}, item, meta || {}, { lastSynced: new Date().toISOString() });
        });
        current = saveProfileObject(current);
        saveCurrentAsProfile(current, true);
        loadProfileToHome();
        restoreLinkedAccounts();
        renderSavedProfilesList();
        if (fetchGamesAfterSync) fetchPlatformGames(account.platform, account.username);
      })
      .catch(function(err) {
        renderAccountPanelState(account.platform, 'error', 'Could not sync account', describeAccountLinkError(account.platform, account.username, err), true);
      })
      .finally(function() {
        delete accountSyncRequests[account.id];
        renderLinkedAccountsList();
      });
  }

  function formatAccountRatingSummary(account) {
    var ratings = account && account.ratingData ? account.ratingData : null;
    if (!ratings) return 'Ratings unavailable';
    var parts = [];
    if (ratings.rapid && ratings.rapid !== '—') parts.push('Rapid ' + ratings.rapid);
    if (ratings.blitz && ratings.blitz !== '—') parts.push('Blitz ' + ratings.blitz);
    if (ratings.bullet && ratings.bullet !== '—') parts.push('Bullet ' + ratings.bullet);
    return parts.length ? parts.join(' · ') : 'Ratings unavailable';
  }

  function formatAccountSynced(account) {
    if (!account || !account.lastSynced) return 'Not synced yet';
    var date = new Date(account.lastSynced);
    if (!date || isNaN(date.getTime())) return 'Not synced yet';
    return 'Synced ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderLinkedAccountsList() {
    var container = document.getElementById('linkedAccountsList');
    if (!container) return;
    var p = getProfile();
    var accounts = p.linkedAccounts || [];
    if (!accounts.length) {
      container.innerHTML =
        '<div class="account-panel-state is-empty">' +
          '<div class="account-panel-state-title">No accounts linked</div>' +
          '<div class="account-panel-state-copy">Link a Chess.com or Lichess username below.</div>' +
        '</div>';
      return;
    }
    container.innerHTML = accounts.map(function(account) {
      var active = account.id === p.activeAccountId;
      var syncing = !!accountSyncRequests[account.id];
      return '<div class="linked-account-row' + (active ? ' is-active' : '') + '">' +
        '<div class="linked-account-avatar">' +
          (account.avatar ? '<img src="' + escapeAttr(account.avatar) + '" alt="" />' : '<span>' + (account.platform === 'chesscom' ? '&#9823;' : '&#9820;') + '</span>') +
        '</div>' +
        '<div class="linked-account-main">' +
          '<div class="linked-account-top">' +
            '<span class="linked-account-platform">' + escapeHtml(getPlatformLabel(account.platform)) + '</span>' +
            (active ? '<span class="linked-account-active">Active</span>' : '') +
          '</div>' +
          '<div class="linked-account-name">@' + escapeHtml(account.username) + '</div>' +
          '<div class="linked-account-meta">' + escapeHtml(formatAccountRatingSummary(account)) + '</div>' +
          '<div class="linked-account-meta">' + escapeHtml(formatAccountSynced(account)) + '</div>' +
        '</div>' +
        '<div class="linked-account-actions">' +
          '<button type="button" class="btn-sm-green" data-account-switch="' + escapeAttr(account.id) + '"' + (active ? ' disabled' : '') + '>Switch</button>' +
          '<button type="button" class="btn-sm-green" data-account-sync="' + escapeAttr(account.id) + '"' + (syncing ? ' disabled' : '') + '>' + (syncing ? 'Syncing' : 'Sync') + '</button>' +
          '<button type="button" class="btn-sm-red" data-account-remove="' + escapeAttr(account.id) + '">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateAccountUI(platform, username) {
    var statusEl = document.getElementById(platform + 'Status');
    var linkedInfo = document.getElementById(platform + 'LinkedInfo');
    var linkedName = document.getElementById(platform + 'LinkedName');
    var inputEl = document.getElementById(getPlatformInputId(platform));
    var inputRow = inputEl ? inputEl.closest('.account-input-row') : null;
    var linkButton = document.getElementById(platform === 'chesscom' ? 'linkChesscom' : 'linkLichess');
    var label = getPlatformLabel(platform);

    var active = getActiveLinkedAccount(platform);
    var count = getLinkedAccounts().filter(function(account) { return account.platform === platform; }).length;

    if (username) {
      if (statusEl) { statusEl.textContent = count + ' linked'; statusEl.classList.add('linked'); }
      if (linkedInfo) linkedInfo.style.display = 'none';
      if (linkedName) linkedName.textContent = '@' + username;
      if (inputEl) {
        inputEl.value = '';
        inputEl.placeholder = active ? 'Active: ' + active.username : label + ' username...';
      }
      if (inputRow) inputRow.style.display = 'flex';
      if (linkButton) linkButton.textContent = 'Link';
      renderAccountPanelState(platform, 'ready', label + ' ready', active ? ('Active account @' + active.username + '. Use Sync on its account row to fetch games.') : 'Choose an account from the linked accounts list.', true);
    } else {
      if (statusEl) { statusEl.textContent = 'Not linked'; statusEl.classList.remove('linked'); }
      if (linkedInfo) linkedInfo.style.display = 'none';
      if (linkedName) linkedName.textContent = '';
      if (inputEl) inputEl.placeholder = label + ' username...';
      if (inputRow) inputRow.style.display = 'flex';
      if (linkButton) linkButton.textContent = 'Link';
      renderAccountPanelState(platform, 'empty', 'No account linked', getAccountPanelCopy(platform, false), true);
    }
  }

  function restoreLinkedAccounts() {
    var ccInput = document.getElementById('chesscomUsername');
    var lcInput = document.getElementById('lichessUsername');
    var chesscom = getActiveLinkedAccount('chesscom');
    var lichess = getActiveLinkedAccount('lichess');
    renderLinkedAccountsList();
    if (chesscom) {
      if (ccInput) ccInput.value = '';
      updateAccountUI('chesscom', chesscom.username);
    } else {
      updateAccountUI('chesscom', null);
    }
    if (lichess) {
      if (lcInput) lcInput.value = '';
      updateAccountUI('lichess', lichess.username);
    } else {
      updateAccountUI('lichess', null);
    }
  }

  function isGameReviewed(white, black, result) {
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch { /* corrupt data – start with empty db */ }
    return db.some(function(g) {
      return g.white === white && g.black === black && g.result === result;
    });
  }

  function normalizeUsername(raw) {
    return String(raw || '').trim().replace(/^@+/, '');
  }

  function getYesterdayArchiveDate() {
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      year: yesterday.getFullYear(),
      month: String(yesterday.getMonth() + 1).padStart(2, '0'),
      day: String(yesterday.getDate()).padStart(2, '0')
    };
  }

  function buildChesscomArchiveRange(endArchive, monthCount) {
    var fallback = getYesterdayArchiveDate();
    var safeArchive = endArchive || fallback;
    var year = parseInt(safeArchive.year, 10);
    var month = parseInt(safeArchive.month, 10);
    if (isNaN(year) || year < 2000) year = fallback.year;
    if (isNaN(month) || month < 1 || month > 12) month = parseInt(fallback.month, 10);

    var count = Math.max(1, parseInt(monthCount, 10) || CHESSCOM_FETCH_MONTHS);
    var archives = [];
    for (var i = count - 1; i >= 0; i--) {
      var date = new Date(Date.UTC(year, month - 1 - i, 1));
      archives.push({
        year: date.getUTCFullYear(),
        month: String(date.getUTCMonth() + 1).padStart(2, '0')
      });
    }
    return archives;
  }

  function resolveChesscomUsername(preferredUsername) {
    var activeChesscom = getActiveLinkedAccount('chesscom');
    var candidates = [
      preferredUsername,
      activeChesscom && activeChesscom.username,
      (document.getElementById('gamesTabUser') || {}).textContent,
      window._ccFetchedUsername,
      (document.getElementById('chesscomLinkedName') || {}).textContent,
      (document.getElementById('chesscomUsername') || {}).value,
      getProfile().chesscomUsername
    ];

    for (var i = 0; i < candidates.length; i++) {
      var username = normalizeUsername(candidates[i]);
      if (username && username.toLowerCase() !== 'username') return username;
    }
    return '';
  }

  function fetchLatestChesscomGames(preferredUsername) {
    var username = resolveChesscomUsername(preferredUsername);
    if (!username) {
      showToast('Link or enter a Chess.com username first', 'error');
      return;
    }
    AppController.switchToTab('games');
    fetchChesscomGames(username, getYesterdayArchiveDate());
  }

  function fetchHomeChesscomGames(preferredUsername) {
    fetchLatestChesscomGames(preferredUsername);
  }

  function getCurrentChesscomArchiveKey(username, archiveOverride) {
    var archives = Array.isArray(archiveOverride)
      ? archiveOverride
      : buildChesscomArchiveRange(archiveOverride || getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
    return normalizeUsername(username) + ':' + archives.map(function(archive) {
      return archive.year + '-' + archive.month;
    }).join(',');
  }

  // ===== CHESS.COM GAMES FETCH (Games Tab) =====
  function setupGamesTab() {
    var filterSelect = document.getElementById('gamesTabFilterSelect');
    if (filterSelect) {
      filterSelect.addEventListener('change', function() {
        setGamesTabFilter(this.value || 'all');
      });
    }
  }

  function refreshGamesTab() {
    var username = resolveChesscomUsername();
    var controls = document.getElementById('gamesTabControls');
    var filters = document.getElementById('gamesTabFilters');
    var sub = document.getElementById('gamesTabSub');
    var userEl = document.getElementById('gamesTabUser');
    if (username) {
      var archive = window._ccFetchedUsername === username && window._ccFetchedArchivePeriod
        ? window._ccFetchedArchivePeriod
        : buildChesscomArchiveRange(getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
      if (controls) controls.style.display = 'flex';
      if (filters) filters.style.display = window._ccFetchedGames && window._ccFetchedGames.length && window._ccFetchedUsername === username ? 'flex' : 'none';
      if (sub) sub.textContent = 'Chess.com archive range: ' + formatChesscomArchiveLabel(archive) + '.';
      if (userEl) userEl.textContent = '@' + username;
      updateGamesTabOverview({
        username: username,
        archive: archive,
        filter: getGamesTabFilter(),
        total: 0,
        filtered: 0,
        reviewed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        modes: 'No archive'
      });
    } else {
      if (controls) controls.style.display = 'none';
      if (filters) filters.style.display = 'none';
      if (sub) sub.textContent = 'Link your Chess.com account on the Home tab, then fetch the latest 3 months here.';
      updateGamesTabOverview({});
    }
    if (window._ccFetchedGames && window._ccFetchedGames.length && username && window._ccFetchedUsername === username) {
      var container = document.getElementById('gamesTabList');
      if (container) renderGamesTab(container, window._ccFetchedGames, username);
    } else if (username) {
      var emptyContainer = document.getElementById('gamesTabList');
      if (emptyContainer) {
        emptyContainer.innerHTML = buildGamesTabEmptyState('No archive loaded yet', 'Fetch the latest 3 months of Chess.com games to review openings, results, and unfinished analysis.');
      }
    }
  }

  function getChesscomGameWhiteName(game) {
    if (!game) return 'White';
    if (game.white && game.white.username) return game.white.username;
    return game.white || 'White';
  }

  function getChesscomGameBlackName(game) {
    if (!game) return 'Black';
    if (game.black && game.black.username) return game.black.username;
    return game.black || 'Black';
  }

  function getChesscomGameWhiteRating(game) {
    if (!game) return '?';
    if (game.white && game.white.rating) return game.white.rating;
    return game.whiteElo || '?';
  }

  function getChesscomGameBlackRating(game) {
    if (!game) return '?';
    if (game.black && game.black.rating) return game.black.rating;
    return game.blackElo || '?';
  }

  function getChesscomGameResult(game) {
    if (!game) return '*';
    if (game.result) return game.result;
    var whiteResult = game.white ? String(game.white.result || '').toLowerCase() : '';
    if (whiteResult === 'win') return '1-0';
    if (whiteResult === 'checkmated' || whiteResult === 'resigned' || whiteResult === 'timeout' || whiteResult === 'abandoned' || whiteResult === 'lose') {
      return '0-1';
    }
    return '½-½';
  }

  function getChesscomGameTimeClass(game) {
    if (!game) return 'rapid';
    if (game.time_class) return game.time_class;
    var timeControl = String(game.timeControl || '').trim();
    if (!timeControl) return 'rapid';
    if (timeControl.indexOf('/') !== -1) return 'daily';
    var base = parseInt(timeControl.split('+')[0], 10);
    if (isNaN(base)) return 'rapid';
    if (base < 180) return 'bullet';
    if (base < 600) return 'blitz';
    return 'rapid';
  }

  function getChesscomGameDisplayDate(game) {
    if (!game) return '';
    var date = null;
    if (game.end_time) {
      date = new Date(game.end_time * 1000);
    } else {
      var headers = game.headers || {};
      var dateText = headers.EndDate || game.date || headers.Date || '';
      var timeText = headers.EndTime || '00:00:00';
      if (dateText) {
        date = new Date(dateText.replace(/\./g, '-') + 'T' + timeText + 'Z');
      }
    }
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatChesscomArchiveLabel(archive) {
    if (Array.isArray(archive)) {
      if (!archive.length) return 'latest 3 months';
      if (archive.length === 1) return formatChesscomArchiveLabel(archive[0]);
      return formatChesscomArchiveLabel(archive[0]) + ' - ' + formatChesscomArchiveLabel(archive[archive.length - 1]);
    }
    if (!archive || !archive.year || !archive.month) return 'latest archive';
    var date = new Date(Date.UTC(Number(archive.year), Number(archive.month) - 1, 1));
    if (!date || isNaN(date.getTime())) return String(archive.year) + '/' + String(archive.month);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function getChesscomGameSortTime(game) {
    if (!game) return 0;
    if (game.end_time) return game.end_time * 1000;
    var headers = game.headers || {};
    var dateText = headers.EndDate || game.date || headers.Date || '';
    var timeText = headers.EndTime || '00:00:00';
    if (!dateText) return 0;
    var date = new Date(String(dateText).replace(/\./g, '-') + 'T' + timeText + 'Z');
    return date && !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  function getChesscomGameOpening(game) {
    return AppController.formatChesscomOpeningLabel(game);
  }

  function getChesscomGameTimeLabel(timeClass) {
    var normalized = String(timeClass || '').toLowerCase();
    if (normalized === 'bullet') return 'Bullet';
    if (normalized === 'blitz') return 'Blitz';
    if (normalized === 'rapid') return 'Rapid';
    if (normalized === 'daily') return 'Daily';
    if (!normalized) return 'Rapid';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function getGamesTabFilterLabel(filter) {
    if (filter === 'win') return 'Wins';
    if (filter === 'lost') return 'Losses';
    if (filter === 'draw') return 'Draws';
    if (filter === 'reviewed') return 'Reviewed';
    if (filter === 'not-reviewed') return 'Needs Review';
    return 'All Games';
  }

  function buildGamesTabEmptyState(title, copy) {
    return '<div class="games-empty-state">' +
      '<div class="games-empty-icon">&#9823;</div>' +
      '<div class="games-empty-title">' + escapeHtml(title || 'No games available') + '</div>' +
      '<div class="games-empty-copy">' + escapeHtml(copy || 'Fetch recent Chess.com archives to populate this view.') + '</div>' +
    '</div>';
  }

  function renderGamesTabSkeleton(container, labelText) {
    if (!container) return;
    var label = labelText || 'Loading games';
    var rows = '';
    for (var i = 0; i < 5; i++) {
      rows += '<article class="gt-game-row games-skeleton-row" aria-hidden="true">' +
        '<div class="gt-row-main">' +
          '<div class="gt-row-head">' +
            '<div class="gt-title-block">' +
              '<div class="skeleton-line w-55"></div>' +
              '<div class="gt-subline"><span class="skeleton-chip"></span><span class="skeleton-chip small"></span></div>' +
            '</div>' +
            '<div class="gt-result-col"><span class="skeleton-chip"></span><span class="skeleton-chip small"></span></div>' +
          '</div>' +
          '<div class="gt-row-body">' +
            '<div class="gt-player-line"><span class="skeleton-line w-72"></span></div>' +
            '<div class="gt-meta"><span class="skeleton-chip"></span><span class="skeleton-chip"></span></div>' +
          '</div>' +
        '</div>' +
        '<div class="gt-actions"><span class="skeleton-chip"></span><span class="skeleton-chip"></span></div>' +
      '</article>';
    }
    container.innerHTML =
      '<div class="games-list-banner games-list-banner-loading">' +
        '<div class="games-count">' +
          '<span class="games-count-main">' + escapeHtml(label) + '</span>' +
          '<span class="games-count-sub">Preparing a 50-game page</span>' +
        '</div>' +
        '<div class="games-list-banner-meta">Syncing archive</div>' +
      '</div>' +
      '<div class="games-list-stack">' + rows + '</div>';
  }

  function buildGamesTabPagination(currentPage, pageCount, total, startNumber, endNumber) {
    if (!total || pageCount <= 1) return '';
    var candidates = [1, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, pageCount];
    var seen = {};
    var pages = candidates
      .filter(function(page) {
        page = Number(page);
        if (page < 1 || page > pageCount || seen[page]) return false;
        seen[page] = true;
        return true;
      })
      .sort(function(a, b) { return a - b; });
    var buttons = '';
    var lastPage = 0;
    pages.forEach(function(page) {
      if (lastPage && page - lastPage > 1) {
        buttons += '<span class="games-page-ellipsis">...</span>';
      }
      if (page === currentPage) {
        buttons += '<button type="button" class="games-page-btn is-active" aria-current="page">' + page + '</button>';
      } else {
        buttons += '<button type="button" class="games-page-btn" onclick="HomeController.setGamesTabPage(' + page + ')">' + page + '</button>';
      }
      lastPage = page;
    });

    return '<nav class="games-pagination" aria-label="Games pagination">' +
      '<div class="games-page-summary">Showing ' + startNumber + '-' + endNumber + ' of ' + total + ' &middot; ' + GAMES_TAB_PAGE_SIZE + ' per page</div>' +
      '<div class="games-page-controls">' +
        '<button type="button" class="games-page-btn games-page-nav" ' + (currentPage <= 1 ? 'disabled' : 'onclick="HomeController.setGamesTabPage(' + (currentPage - 1) + ')"') + '>Previous</button>' +
        buttons +
        '<button type="button" class="games-page-btn games-page-nav" ' + (currentPage >= pageCount ? 'disabled' : 'onclick="HomeController.setGamesTabPage(' + (currentPage + 1) + ')"') + '>Next</button>' +
      '</div>' +
    '</nav>';
  }

  function summarizeGamesTabModes(items) {
    var counts = {};
    (items || []).forEach(function(item) {
      var key = String(item.timeLabel || '').trim() || 'Rapid';
      counts[key] = (counts[key] || 0) + 1;
    });
    var ranked = Object.keys(counts)
      .map(function(key) { return { label: key, count: counts[key] }; })
      .sort(function(a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 2);
    if (!ranked.length) return 'No archive';
    return ranked.map(function(entry) {
      return entry.label + ' ' + entry.count;
    }).join(' · ');
  }

  function updateGamesTabOverview(state) {
    state = state || {};
    var total = Number(state.total || 0);
    var filtered = Number(state.filtered != null ? state.filtered : total);
    var wins = Number(state.wins || 0);
    var losses = Number(state.losses || 0);
    var draws = Number(state.draws || 0);
    var reviewed = Number(state.reviewed || 0);
    var username = normalizeUsername(state.username || '');
    var archiveLabel = formatChesscomArchiveLabel(state.archive);
    var filterLabel = getGamesTabFilterLabel(state.filter || 'all');
    var summaryTitle = 'No archive loaded yet';
    var summaryMeta = 'Sync recent Chess.com archives to review games, openings, and analysis coverage.';

    if (!username) {
      summaryTitle = 'Connect Chess.com to get started';
      summaryMeta = 'Link your account on the Home tab, then sync the latest 3 months here.';
    } else if (state.loading) {
      summaryTitle = 'Fetching @' + username + ' games';
      summaryMeta = 'Loading games from ' + archiveLabel + '.';
    } else if (state.error) {
      summaryTitle = 'Could not load ' + archiveLabel;
      summaryMeta = String(state.error);
    } else if (!total) {
      summaryTitle = 'No games found in ' + archiveLabel;
      summaryMeta = '@' + username + ' is connected, but this period has no parsed games yet.';
    } else if (!filtered) {
      summaryTitle = 'No ' + filterLabel.toLowerCase() + ' in ' + archiveLabel;
      summaryMeta = '@' + username + ' · ' + wins + '-' + losses + '-' + draws + ' · ' + reviewed + ' reviewed';
    } else if ((state.filter || 'all') === 'all') {
      summaryTitle = total + ' game' + (total !== 1 ? 's' : '') + ' in ' + archiveLabel;
      summaryMeta = '@' + username + ' · ' + wins + '-' + losses + '-' + draws + ' · ' + reviewed + ' reviewed';
    } else {
      summaryTitle = filtered + ' ' + filterLabel.toLowerCase() + ' in ' + archiveLabel;
      summaryMeta = '@' + username + ' · ' + wins + '-' + losses + '-' + draws + ' overall · ' + reviewed + ' reviewed';
    }

    var totalEl = document.getElementById('gamesMetricTotal');
    var recordEl = document.getElementById('gamesMetricRecord');
    var reviewedEl = document.getElementById('gamesMetricReviewed');
    var modesEl = document.getElementById('gamesMetricModes');
    var titleEl = document.getElementById('gamesSummaryTitle');
    var metaEl = document.getElementById('gamesSummaryMeta');

    if (totalEl) totalEl.textContent = username ? String(total) : '--';
    if (recordEl) recordEl.textContent = username ? (total ? (wins + '-' + losses + '-' + draws) : '0-0-0') : '--';
    if (reviewedEl) reviewedEl.textContent = username ? (total ? (reviewed + ' / ' + total) : '0 / 0') : '--';
    if (modesEl) modesEl.textContent = username ? String(state.modes || 'No archive') : 'No archive';
    if (titleEl) titleEl.textContent = summaryTitle;
    if (metaEl) metaEl.textContent = summaryMeta;
  }

  function fetchChesscomGames(username, archiveOverride) {
    username = String(username || '').trim().replace(/^@+/, '');
    var container = document.getElementById('gamesTabList');
    if (!container) return;
    var archive = Array.isArray(archiveOverride)
      ? archiveOverride
      : buildChesscomArchiveRange(archiveOverride || getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
    var archiveLabel = formatChesscomArchiveLabel(archive);
    var controls = document.getElementById('gamesTabControls');
    var filters = document.getElementById('gamesTabFilters');
    var sub = document.getElementById('gamesTabSub');
    var userEl = document.getElementById('gamesTabUser');
    if (controls) controls.style.display = 'flex';
    if (filters) filters.style.display = 'none';
    if (sub) sub.textContent = 'Chess.com archive range: ' + archiveLabel + '.';
    if (userEl) userEl.textContent = '@' + username;
    window._gamesTabPage = 1;
    updateGamesTabOverview({
      username: username,
      archive: archive,
      filter: getGamesTabFilter(),
      loading: true,
      modes: 'Syncing...'
    });
    renderGamesTabSkeleton(container, 'Fetching 3 months of games for ' + username + '...');

    var archiveKey = getCurrentChesscomArchiveKey(username, archive);
    window._ccLastRequestedArchiveKey = archiveKey;
    fetchChesscomGamesFromArchive(username, archive)
      .then(function(games) {
        if (window._ccLastRequestedArchiveKey !== archiveKey) return;
        window._ccFetchedUsername = username;
        window._ccFetchedArchiveKey = archiveKey;
        window._ccFetchedArchivePeriod = archive;
        if (!games.length) {
          window._ccFetchedGames = [];
          if (filters) filters.style.display = 'none';
          if (sub) sub.textContent = 'No games found in ' + archiveLabel + '.';
          updateGamesTabOverview({
            username: username,
            archive: archive,
            filter: getGamesTabFilter(),
            total: 0,
            filtered: 0,
            reviewed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            modes: 'No archive'
          });
          container.innerHTML = buildGamesTabEmptyState('No games found in this period', 'Try again after you play a few games or switch to a newer archive range.');
          return;
        }
        window._ccFetchedGames = games;
        if (filters) filters.style.display = 'flex';
        if (sub) sub.textContent = 'Synced from Chess.com for ' + archiveLabel + '. Analyze any game directly from the archive range.';
        renderGamesTab(container, games, username);
      })
      .catch(function(err) {
        if (window._ccLastRequestedArchiveKey !== archiveKey) return;
        console.error('Chess.com fetch error:', err);
        window._ccFetchedGames = [];
        window._ccFetchedUsername = username;
        window._ccFetchedArchiveKey = archiveKey;
        window._ccFetchedArchivePeriod = archive;
        if (filters) filters.style.display = 'none';
        if (sub) sub.textContent = 'Chess.com archive sync failed for ' + archiveLabel + '.';
        var errorText = AppController.describeChesscomError(err, username, archiveLabel);
        updateGamesTabOverview({
          username: username,
          archive: archive,
          filter: getGamesTabFilter(),
          error: errorText,
          modes: 'Unavailable'
        });
        container.innerHTML = buildGamesTabEmptyState('Archive unavailable', errorText);
      });
  }

  function fetchChesscomGamesFromArchive(username, archive) {
    var archives = Array.isArray(archive) ? archive : [archive];
    return Promise.all(archives.map(function(item) {
      return AppController.fetchChesscomMonthPgn(username, item.year, item.month)
        .then(function(text) {
          return { archive: item, games: AppController.parseChesscomArchiveGames(text) || [] };
        })
        .catch(function(err) {
          return { archive: item, error: err, games: [] };
        });
    })).then(function(results) {
      var games = [];
      var errors = [];
      results.forEach(function(result) {
        if (result.error) errors.push(result.error);
        games = games.concat(result.games || []);
      });
      if (!games.length && errors.length === results.length && errors.length) {
        throw errors.find(function(err) {
          return err && err.status !== 404 && !err.invalidResponse;
        }) || errors[0];
      }
      return games.sort(function(a, b) {
        return getChesscomGameSortTime(b) - getChesscomGameSortTime(a);
      });
    });
  }

  function renderGamesTab(container, games, username) {
    var filter = getGamesTabFilter();
    updateGamesTabFilterUI(filter);
    var items = games.map(function(g, idx) {
      var white = getChesscomGameWhiteName(g);
      var black = getChesscomGameBlackName(g);
      var whiteRating = getChesscomGameWhiteRating(g);
      var blackRating = getChesscomGameBlackRating(g);
      var result = getChesscomGameResult(g);
      var resultClass = result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d';
      var isUserWhite = white.toLowerCase() === username.toLowerCase();
      var userWon = (result === '1-0' && isUserWhite) || (result === '0-1' && !isUserWhite);
      var userLost = (result === '0-1' && isUserWhite) || (result === '1-0' && !isUserWhite);
      var outcomeClass = userWon ? 'outcome-win' : userLost ? 'outcome-loss' : 'outcome-draw';
      var outcomeText = userWon ? 'Won' : userLost ? 'Lost' : 'Draw';
      var reviewed = isGameReviewed(white, black, result);
      var timeClass = getChesscomGameTimeClass(g);
      var timeLabel = getChesscomGameTimeLabel(timeClass);
      var dateStr = getChesscomGameDisplayDate(g);
      var opening = getChesscomGameOpening(g) || 'Opening not tagged';
      var userName = isUserWhite ? white : black;
      var userRating = isUserWhite ? whiteRating : blackRating;
      var opponentName = isUserWhite ? black : white;
      var opponentRating = isUserWhite ? blackRating : whiteRating;
      var userSide = isUserWhite ? 'White' : 'Black';
      var reviewedClass = reviewed ? 'is-reviewed' : 'is-pending';
      var reviewedText = reviewed ? 'Reviewed' : 'Needs review';
      var timeClassSafe = String(timeClass || 'rapid').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'rapid';

      return {
        idx: idx,
        userWon: userWon,
        userLost: userLost,
        reviewed: reviewed,
        outcomeText: outcomeText,
        timeLabel: timeLabel,
        html: '<article class="gt-game-row ' + outcomeClass + (reviewed ? ' game-reviewed' : '') + '" data-cc-idx="' + idx + '">' +
          '<div class="gt-row-main">' +
            '<div class="gt-row-head">' +
              '<div class="gt-title-block">' +
                '<div class="gt-opening-line">' +
                  '<span class="gt-opening">' + escapeHtml(opening) + '</span>' +
                '</div>' +
                '<div class="gt-subline">' +
                  '<span class="gt-date">' + escapeHtml(dateStr || 'Date unavailable') + '</span>' +
                  '<span class="gt-review-inline ' + reviewedClass + '">' + escapeHtml(reviewedText) + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="gt-result-col">' +
                '<span class="gt-outcome ' + outcomeClass + '">' + escapeHtml(outcomeText) + '</span>' +
                '<span class="gt-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="gt-row-body">' +
              '<div class="gt-player-line">' +
                '<span class="gt-player-emphasis">You &middot; ' + escapeHtml(userName) + ' (' + escapeHtml(userRating) + ')</span>' +
                '<span class="gt-player-divider">vs</span>' +
                '<span class="gt-player-secondary">' + escapeHtml(opponentName) + ' (' + escapeHtml(opponentRating) + ')</span>' +
              '</div>' +
              '<div class="gt-meta">' +
                '<span class="gt-side-chip gt-side-' + (isUserWhite ? 'white' : 'black') + '">' + escapeHtml(userSide) + '</span>' +
                '<span class="gt-time-badge gt-tc-' + escapeAttr(timeClassSafe) + '">' + escapeHtml(timeLabel) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="gt-actions">' +
            '<button type="button" class="gt-btn gt-btn-analyze" onclick="HomeController.loadChesscomGame(' + idx + ')"><span class="gt-btn-icon" aria-hidden="true">&#8599;</span><span>Analyze</span></button>' +
            '<button type="button" class="gt-btn gt-btn-share" onclick="HomeController.shareGame(' + idx + ')"><span class="gt-btn-icon" aria-hidden="true">&#128279;</span><span>Share</span></button>' +
          '</div>' +
        '</article>'
      };
    });

    var filteredItems = items.filter(function(item) {
      if (filter === 'win') return item.userWon;
      if (filter === 'lost') return item.userLost;
      if (filter === 'draw') return !item.userWon && !item.userLost;
      if (filter === 'reviewed') return item.reviewed;
      if (filter === 'not-reviewed') return !item.reviewed;
      return true;
    });

    var reviewedCount = items.filter(function(item) { return item.reviewed; }).length;
    var wins = items.filter(function(item) { return item.userWon; }).length;
    var losses = items.filter(function(item) { return item.userLost; }).length;
    var draws = items.length - wins - losses;
    var archive = window._ccFetchedArchivePeriod || buildChesscomArchiveRange(getYesterdayArchiveDate(), CHESSCOM_FETCH_MONTHS);
    updateGamesTabOverview({
      username: username,
      archive: archive,
      filter: filter,
      total: items.length,
      filtered: filteredItems.length,
      reviewed: reviewedCount,
      wins: wins,
      losses: losses,
      draws: draws,
      modes: summarizeGamesTabModes(items)
    });

    var pageCount = Math.max(1, Math.ceil(filteredItems.length / GAMES_TAB_PAGE_SIZE));
    var currentPage = Math.min(Math.max(getGamesTabPage(), 1), pageCount);
    window._gamesTabPage = currentPage;
    var startIndex = (currentPage - 1) * GAMES_TAB_PAGE_SIZE;
    var pageItems = filteredItems.slice(startIndex, startIndex + GAMES_TAB_PAGE_SIZE);
    var startNumber = filteredItems.length ? startIndex + 1 : 0;
    var endNumber = filteredItems.length ? Math.min(startIndex + GAMES_TAB_PAGE_SIZE, filteredItems.length) : 0;
    var rangeCopy = filteredItems.length
      ? 'Showing ' + startNumber + '-' + endNumber + ' of ' + filteredItems.length + ' &middot; ' + GAMES_TAB_PAGE_SIZE + ' per page'
      : 'No games to show';
    var header = '<div class="games-list-banner">' +
      '<div class="games-count">' +
        '<span class="games-count-main">' + filteredItems.length + ' game' + (filteredItems.length !== 1 ? 's' : '') +
          (filter === 'all' ? '' : ' matching ' + escapeHtml(getGamesTabFilterLabel(filter).toLowerCase())) + '</span>' +
        '<span class="games-count-sub">' + rangeCopy + '</span>' +
      '</div>' +
      '<div class="games-list-banner-meta">' + wins + '-' + losses + '-' + draws + ' · ' + reviewedCount + ' reviewed</div>' +
    '</div>';
    var rows = filteredItems.length
      ? '<div class="games-list-stack">' + pageItems.map(function(item) { return item.html; }).join('') + '</div>' +
        buildGamesTabPagination(currentPage, pageCount, filteredItems.length, startNumber, endNumber)
      : buildGamesTabEmptyState('No games match this filter', 'Try another filter to inspect the rest of the archive.');

    container.innerHTML = header + rows;
  }

  function getGamesTabPage() {
    var page = parseInt(window._gamesTabPage, 10);
    return isNaN(page) || page < 1 ? 1 : page;
  }

  function setGamesTabPage(page) {
    window._gamesTabPage = Math.max(1, parseInt(page, 10) || 1);
    var container = document.getElementById('gamesTabList');
    var games = window._ccFetchedGames || [];
    var activeChesscom = getActiveLinkedAccount('chesscom');
    var username = window._ccFetchedUsername || (activeChesscom && activeChesscom.username) || (getProfile().chesscomUsername || '');
    if (container && games.length && username) {
      renderGamesTab(container, games, username);
      if (container.scrollIntoView) {
        container.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }

  function getGamesTabFilter() {
    return window._gamesTabFilter || 'all';
  }

  function setGamesTabFilter(filter) {
    window._gamesTabFilter = filter || 'all';
    window._gamesTabPage = 1;
    updateGamesTabFilterUI(window._gamesTabFilter);
    var container = document.getElementById('gamesTabList');
    var games = window._ccFetchedGames || [];
    var activeChesscom = getActiveLinkedAccount('chesscom');
    var username = window._ccFetchedUsername || (activeChesscom && activeChesscom.username) || (getProfile().chesscomUsername || '');
    if (container && games.length && username) {
      renderGamesTab(container, games, username);
    }
  }

  function updateGamesTabFilterUI(activeFilter) {
    var filterSelect = document.getElementById('gamesTabFilterSelect');
    if (filterSelect) filterSelect.value = activeFilter || 'all';
  }

  // ===== Fetch button on Home goes to Games tab =====
  function fetchPlatformGames(platform, username) {
    if (platform === 'chesscom') {
      var resolvedUsername = resolveChesscomUsername(username);
      if (!resolvedUsername) {
        showToast('Link or enter a Chess.com username first', 'error');
        return;
      }
      renderAccountPanelState('chesscom', 'loading', 'Opening Games tab...', 'Fetching your latest 3 months of Chess.com games.', true);
      fetchHomeChesscomGames(resolvedUsername);
    } else if (platform === 'lichess') {
      var container = document.getElementById('lichessGamesList');
      if (!container) return;
      renderAccountPanelState('lichess', 'loading', 'Fetching Lichess games...', 'This usually takes a few seconds.', true);
      var encodedUser = encodeURIComponent(username);
      var proxyUrl = '/api/lichess/user/' + encodedUser + '/games?max=8&clocks=false&evals=false&opening=true';
      var directUrl = 'https://lichess.org/api/games/user/' + encodedUser + '?max=8&clocks=false&evals=false&opening=true';
      AppController.fetchTextWithFallback(proxyUrl, directUrl, { Accept: 'application/x-ndjson' })
        .then(function(text) {
          window._lichessFetchedUsername = username;
          var lines = text.trim().split('\n').filter(function(l) { return l.trim(); });
          var games = [];
          lines.forEach(function(line) { try { games.push(JSON.parse(line)); } catch { /* skip malformed NDJSON line */ } });
          renderLichessGames(container, games);
        })
        .catch(function(err) {
          renderAccountPanelState('lichess', 'error', 'Could not fetch Lichess games', AppController.describeLichessError(err, username), true);
        });
    }
  }

  function renderLichessGames(container, games) {
    if (!games.length) {
      renderAccountPanelState('lichess', 'empty', 'No recent games found', 'Try again after playing a Lichess game.', true);
      return;
    }
    var rows = games.map(function(g) {
      var white = g.players && g.players.white && g.players.white.user ? g.players.white.user.name : 'White';
      var black = g.players && g.players.black && g.players.black.user ? g.players.black.user.name : 'Black';
      var result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '½-½';
      var gameId = g.id || '';

      return '<div class="fetch-game-item" data-id="' + escapeAttr(gameId) + '" data-platform="lichess" onclick="HomeController.loadPlatformGame(this)">' +
        '<span>' + escapeHtml(white) + ' vs ' + escapeHtml(black) + '</span>' +
        '<span class="fetch-game-result ' + (result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d') + '">' + escapeHtml(result) + '</span>' +
        '</div>';
    }).join('');
    container.innerHTML = '<div class="games-count">' + games.length + ' recent Lichess game' + (games.length !== 1 ? 's' : '') + '</div>' + rows;
  }

  function loadPlatformGame(el) {
    var platform = el.getAttribute('data-platform');
    var pgn = el.getAttribute('data-pgn');
    var id = el.getAttribute('data-id');
    if (pgn) {
      AppController.loadPGNAndReviewExternal(decodeURIComponent(pgn), {
        sourcePlatform: platform || '',
        sourceUsername: platform === 'lichess'
          ? ((getActiveLinkedAccount('lichess') || {}).username || getProfile().lichessUsername || window._lichessFetchedUsername || '')
          : ''
      });
    } else if (id && platform === 'lichess') {
      var proxyUrl = '/api/lichess/game/' + encodeURIComponent(id) + '/export?clocks=true&evals=false';
      var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(id) + '?clocks=true&evals=false';
      AppController.fetchTextWithFallback(proxyUrl, directUrl)
        .then(function(p) {
          if (p) {
            AppController.loadPGNAndReviewExternal(p, {
              sourcePlatform: 'lichess',
              sourceUsername: window._lichessFetchedUsername || ((getActiveLinkedAccount('lichess') || {}).username) || getProfile().lichessUsername || ''
            });
          }
        });
    }
  }

  function loadChesscomGame(idx) {
    var games = window._ccFetchedGames;
    if (!games || !games[idx]) return;
    var game = games[idx];
    var pgn = game.pgn || '';
    if (pgn) {
      var reviewUsername = window._ccFetchedUsername || ((getActiveLinkedAccount('chesscom') || {}).username) || (getProfile().chesscomUsername || '');
      AppController.loadPGNAndReviewExternal(pgn, {
        sourceGame: game,
        sourcePlatform: 'chesscom',
        sourceUsername: reviewUsername
      });
      // Mark as reviewed in the list
      var item = document.querySelector('.gt-game-row[data-cc-idx="' + idx + '"]');
      if (item) {
        item.classList.add('game-reviewed');
        var icon = item.querySelector('.gt-review-icon');
        if (icon) icon.innerHTML = '&#10003;';
      }
      var container = document.getElementById('gamesTabList');
      if (container && reviewUsername) {
        renderGamesTab(container, games, reviewUsername);
      }
    }
  }

  function shareGame(idx) {
    var games = window._ccFetchedGames;
    if (!games || !games[idx]) return;
    var game = games[idx];
    var white = getChesscomGameWhiteName(game);
    var black = getChesscomGameBlackName(game);
    var pgn = game.pgn || '';
    var analyzeLink = AppController.createAnalyzeLinkForPGN(pgn);

    if (!analyzeLink && !pgn) {
      showToast('No shareable game data found', 'error');
      return;
    }

    if (navigator.share && analyzeLink) {
      navigator.share({
        title: white + ' vs ' + black,
        text: 'Open this game directly in chess ramp review.',
        url: analyzeLink
      }).catch(function() {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(analyzeLink || pgn).then(function() {
        showToast('Analyze link copied!', 'success');
      }).catch(function() {
        showToast('Could not copy', 'error');
      });
    }
  }

  // Import Tabs on Home
  function setupImportTabs() {
    document.querySelectorAll('.iht').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var parent = this.closest('.home-card');
        parent.querySelectorAll('.iht').forEach(function(t) { t.classList.remove('active'); });
        parent.querySelectorAll('.ihs').forEach(function(s) { s.classList.remove('active'); });
        this.classList.add('active');
        var method = this.getAttribute('data-imethod');
        var sec = document.getElementById('ihs-' + method);
        if (sec) sec.classList.add('active');
      });
    });
  }

  // Home Import Buttons
  function setupHomeImport() {
    var loadPgn = document.getElementById('homeLoadPGN');
    if (loadPgn) loadPgn.addEventListener('click', function() {
      var pgn = document.getElementById('homePgnInput').value.trim();
      if (pgn) AppController.loadPGNFromExternal(pgn);
      else showToast('Paste PGN first', 'error');
    });

    var loadFen = document.getElementById('homeLoadFen');
    if (loadFen) loadFen.addEventListener('click', function() {
      var fen = document.getElementById('homeFenInput').value.trim();
      if (fen) { AppController.loadFenFromExternal(fen); }
      else showToast('Enter a FEN string', 'error');
    });

    var loadUrl = document.getElementById('homeLoadUrl');
    if (loadUrl) loadUrl.addEventListener('click', function() {
      var url = document.getElementById('homeUrlInput').value.trim();
      if (url) AppController.loadFromURLExternal(url);
      else showToast('Enter a URL', 'error');
    });

    var dropZone = document.getElementById('homeFileDropZone');
    var fileInput = document.getElementById('homeFileInput');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', function() { fileInput.click(); });
      dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
      dropZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
      dropZone.addEventListener('drop', function(e) {
        e.preventDefault(); this.classList.remove('dragover');
        if (e.dataTransfer.files[0]) AppController.readPGNFileExternal(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', function() {
        if (this.files[0]) AppController.readPGNFileExternal(this.files[0]);
      });
    }
  }

  // Recent Games on Home
  function setupRecentGamesList() {
    bindHomeClick('homeRecentGames', 'homeRecentGamesBound', function(e) {
      if (!e.target || !e.target.closest) return;
      var row = e.target.closest('[data-home-game-id]');
      if (!row) return;
      AppController.loadDbGame(row.getAttribute('data-home-game-id'));
    });
  }

  function renderRecentGames() {
    var container = document.getElementById('homeRecentGames');
    if (!container) return;
    var db = [];
    try { db = JSON.parse(localStorage.getItem('kv_database') || '[]'); } catch { /* corrupt data – start with empty db */ }
    if (!db.length) {
      container.innerHTML =
        '<div class="dashboard-empty-state">' +
          '<div class="dashboard-empty-title">No games yet</div>' +
          '<div class="dashboard-empty-copy">Import a PGN, FEN, URL, or file to start building your review history.</div>' +
        '</div>';
      return;
    }
    container.innerHTML = db.slice(0, 6).map(function(g) {
      var resClass = g.result === '1-0' ? 'white-win' : g.result === '0-1' ? 'black-win' : 'draw';
      var safeId = escapeAttr(g.id);
      return '<div class="home-game-item" data-home-game-id="' + safeId + '">' +
        '<div class="sp-info">' +
          '<div class="hgi-players">' + escapeHtml(g.white || '?') + ' vs ' + escapeHtml(g.black || '?') + '</div>' +
          '<div class="hgi-meta">' + escapeHtml((g.opening || '').substring(0, 28) || 'Unknown opening') + ' \u00b7 ' + escapeHtml((g.date || '').substring(0, 10)) + '</div>' +
        '</div>' +
        '<span class="hgi-result ' + resClass + '">' + escapeHtml(g.result || '*') + '</span>' +
        '<button type="button" class="hgi-analyze-btn" data-home-game-id="' + safeId + '">Analyze</button>' +
        '</div>';
    }).join('');
  }

  return {
    init: init,
    refreshHomeData: refreshHomeData,
    setupGamesTab: setupGamesTab,
    refreshGamesTab: refreshGamesTab,
    fetchChesscomGames: fetchChesscomGames,
    fetchLatestChesscomGames: fetchLatestChesscomGames,
    fetchHomeChesscomGames: fetchHomeChesscomGames,
    setGamesTabPage: setGamesTabPage,
    loadPlatformGame: loadPlatformGame,
    loadChesscomGame: loadChesscomGame,
    shareGame: shareGame,
    loadProfile: loadProfileFn,
    deleteProfile: deleteProfile,
    renderRecentGames: renderRecentGames,
    saveCurrentAsProfile: saveCurrentAsProfile
  };
})();

// ===== PATCH AppController to expose new methods =====
(function() {
  var origInit = AppController.init;
  AppController.init = function() {
    origInit.call(this);
    HomeController.init();
    HomeController.setupGamesTab();
  };

  AppController.loadPGNFromExternal = function(pgn, options) {
    AppController.loadPGNPublic(pgn, options);
    AppController.switchToTab('analyze');
  };

  AppController.loadPGNAndReviewExternal = function(pgn, options) {
    AppController.loadPGNPublic(pgn, options);
    AppController.switchToTab('analyze');
    AppController.triggerAutoReview();
  };

  AppController.loadFenFromExternal = function(fen) {
    AppController.loadFenPublic(fen);
    AppController.switchToTab('analyze');
  };

  AppController.loadFromURLExternal = function(url) {
    AppController.loadFromURLPublic(url);
    AppController.switchToTab('analyze');
  };

  AppController.readPGNFileExternal = function(file) {
    AppController.readPGNFilePublic(file);
    AppController.switchToTab('analyze');
  };
})();

export default HomeController;
