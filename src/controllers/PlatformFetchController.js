/**
 * PlatformFetchController — fetches games from Chess.com and Lichess via
 * proxy-with-fallback, parses PGN/JSON archive payloads, and renders the
 * fetch results UI. Pure browser-side; no shared state.
 *
 * Loading a fetched game delegates back to the host app via deps passed
 * to init(): `loadPGNGame`, `switchTab`, `triggerAutoReview`,
 * `readStoredProfile`. The first three are wired by AppController; the
 * latter is read by the click handlers for fallback usernames.
 */

import { escapeAttr, escapeHtml } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';

let _loadPGNGame = () => {};
let _switchTab = () => {};
let _triggerAutoReview = () => {};
let _readStoredProfile = () => ({});

function renderFetchSkeleton(container, labelText) {
  if (!container) return;
  var label = labelText || 'Loading';
  container.innerHTML =
    '<div class="skeleton-fetch-list">' +
      '<div class="skeleton-fetch-title">' + label + '</div>' +
      '<div class="skeleton-card">' +
        '<div class="skeleton-line w-55"></div>' +
        '<div class="skeleton-line w-80"></div>' +
        '<div class="skeleton-line w-38"></div>' +
      '</div>' +
      '<div class="skeleton-card">' +
        '<div class="skeleton-line w-48"></div>' +
        '<div class="skeleton-line w-76"></div>' +
        '<div class="skeleton-line w-34"></div>' +
      '</div>' +
      '<div class="skeleton-card">' +
        '<div class="skeleton-line w-52"></div>' +
        '<div class="skeleton-line w-72"></div>' +
        '<div class="skeleton-line w-30"></div>' +
      '</div>' +
    '</div>';
}

function fetchGames() {
  var usernameInput = document.getElementById('fetchUsername');
  var username = usernameInput ? String(usernameInput.value || '').trim().replace(/^@+/, '') : '';
  var platform = document.getElementById('platformSelect').value;

  if (!username) {
    showToast('Enter a username', 'error');
    return;
  }

  if (usernameInput && usernameInput.value !== username) {
    usernameInput.value = username;
  }

  var resultsEl = document.getElementById('fetchResults');

  if (platform === 'chesscom') {
    _switchTab('games');
    window.HomeController.fetchChesscomGames(username, getChessComArchiveDate());
    return;
  }

  renderFetchSkeleton(resultsEl, 'Fetching games for ' + username + '...');

  fetchLichessGames(username, resultsEl);
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

function getChessComArchiveDate() {
  var fallback = getYesterdayArchiveDate();
  var yearEl = document.getElementById('fetchYear');
  var monthEl = document.getElementById('fetchMonth');
  var year = yearEl ? parseInt(yearEl.value, 10) : fallback.year;
  if (isNaN(year) || year < 2000) year = fallback.year;
  var month = monthEl ? parseInt(monthEl.value, 10) : parseInt(fallback.month, 10);
  if (isNaN(month) || month < 1 || month > 12) month = parseInt(fallback.month, 10);
  return { year: year, month: String(month).padStart(2, '0') };
}

function encodeAttributeValue(text) {
  return encodeURIComponent(text || '').replace(/'/g, '%27');
}

function parseChesscomArchiveGames(source, maxGames) {
  if (!source) return [];
  if (typeof source === 'string') {
    return parseChesscomPgnPreviewGames(source, maxGames);
  }
  var games = Array.isArray(source.games) ? source.games : [];
  var filtered = games.filter(function(game) {
    return game && (game.pgn || game.url);
  });
  if (Number.isFinite(maxGames) && maxGames > 0) {
    return filtered.slice(0, maxGames);
  }
  return filtered;
}

function isEcoCode(value) {
  return /^[A-E]\d{2}$/i.test(String(value || '').trim());
}

function chesscomOpeningNameFromUrl(value) {
  var raw = String(value || '');
  var slug = raw.split('/openings/')[1] || '';
  if (!slug) return '';
  slug = slug.split(/[?#]/)[0];
  try {
    slug = decodeURIComponent(slug);
  } catch { /* keep original slug */ }
  return slug.replace(/-/g, ' ').trim();
}

function formatChesscomOpeningLabel(game) {
  if (!game) return '';
  var headers = game.headers || {};
  var opening = String(game.opening || headers.Opening || '').trim();
  var ecoUrl = game.ecoUrl || game.eco_url || headers.ECOUrl || headers.ECOURL || '';
  var eco = String(game.eco || headers.ECO || '').trim();

  if (opening && !isEcoCode(opening)) return opening;
  var fromEcoUrl = chesscomOpeningNameFromUrl(ecoUrl);
  if (fromEcoUrl) return fromEcoUrl;
  var fromEco = chesscomOpeningNameFromUrl(eco);
  if (fromEco) return fromEco;
  if (eco && !isEcoCode(eco)) return eco;
  return '';
}

function parseChesscomPgnPreviewGames(text, maxGames) {
  var raw = String(text || '').trim();
  if (!raw) return [];
  var parts = raw.split(/(?=\[Event\s+")/);
  var limit = Number.isFinite(maxGames) && maxGames > 0 ? maxGames : parts.length;
  var games = [];
  for (var i = 0; i < parts.length && games.length < limit; i++) {
    var trimmed = parts[i].trim();
    if (!trimmed) continue;
    var headers = {};
    var headerMatches = trimmed.matchAll(/\[(\w+)\s+"([^"]*)"\]/g);
    for (var match of headerMatches) {
      headers[match[1]] = match[2];
    }
    games.push({
      headers: headers,
      white: headers.White || 'White',
      black: headers.Black || 'Black',
      whiteElo: headers.WhiteElo || '?',
      blackElo: headers.BlackElo || '?',
      result: headers.Result || '*',
      event: headers.Event || '',
      date: headers.Date || '',
      opening: formatChesscomOpeningLabel({ headers: headers }),
      eco: headers.ECO || '',
      timeControl: headers.TimeControl || '',
      pgn: trimmed
    });
  }
  return games;
}

function fetchLichessGames(username, container) {
  var encodedUser = encodeURIComponent(username);
  var proxyUrl = '/api/lichess/user/' + encodedUser + '/games?max=10&clocks=false&evals=false&opening=true';
  var directUrl = 'https://lichess.org/api/games/user/' + encodedUser + '?max=10&clocks=false&evals=false&opening=true';

  fetchTextWithFallback(proxyUrl, directUrl, { Accept: 'application/x-ndjson' })
    .then(function(text) {
      window._lichessFetchedUsername = username;
      var lines = text.trim().split('\n').filter(function(l) { return l.trim(); });
      var games = [];

      lines.forEach(function(line) {
        try {
          var game = JSON.parse(line);
          games.push(game);
        } catch { /* skip malformed NDJSON line */ }
      });

      if (games.length === 0) {
        container.innerHTML = '<div class="no-games">No games found for @' + escapeHtml(username) + '</div>';
        return;
      }

      container.innerHTML = games.map(function(g) {
        var white = g.players && g.players.white ? (g.players.white.user ? g.players.white.user.name : 'White') : 'White';
        var black = g.players && g.players.black ? (g.players.black.user ? g.players.black.user.name : 'Black') : 'Black';
        var result = g.winner ? (g.winner === 'white' ? '1-0' : '0-1') : '½-½';
        var opening = g.opening ? g.opening.name : '';
        var isUserWhite = white.toLowerCase() === username.toLowerCase();
        var resultClass = result === '1-0' ? (isUserWhite ? 'result-w' : 'result-l') :
                         result === '0-1' ? (isUserWhite ? 'result-l' : 'result-w') : 'result-d';

        return '<div class="fetch-game-item" data-id="' + escapeAttr(g.id) + '" data-platform="lichess" onclick="AppController.loadFetchedGame(this)">' +
          escapeHtml(white) + ' vs ' + escapeHtml(black) + ' — ' + (opening ? escapeHtml(opening.substring(0, 25)) : '') +
          '<span class="fetch-game-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
          '</div>';
      }).join('');

      games.forEach(function(g) { window._fetchedGames = window._fetchedGames || {}; window._fetchedGames[g.id] = g; });
      showToast('Found ' + games.length + ' games', 'success');
    })
    .catch(function(err) {
      container.innerHTML = '<div class="no-games">' + describeLichessError(err, username) + '</div>';
      console.error(err);
    });
}

// Note: kept for legacy parity — currently unreferenced because fetchGames()
// delegates Chess.com archive fetching to HomeController.
function fetchChessComGames(username, container) {
  var archive = getChessComArchiveDate();
  fetchChesscomMonthPgn(username, archive.year, archive.month)
    .then(function(text) {
      window._ccFetchedUsername = username;
      var games = parseChesscomArchiveGames(text, 20) || [];
      if (!games.length) {
        container.innerHTML = '<div class="no-games">No public games for ' + escapeHtml(username) + ' in ' + escapeHtml(archive.year + '-' + archive.month) + '</div>';
        return;
      }

      container.innerHTML = games.map(function(g) {
        var white = g.white || 'White';
        var black = g.black || 'Black';
        var result = g.result || '*';
        var opening = g.opening || g.eco || '';
        var date = g.date || (g.headers ? g.headers.Date : '');
        var resultClass = result === '1-0' ? 'result-w' : result === '0-1' ? 'result-l' : 'result-d';
        return '<div class="fetch-game-item" data-pgn="' + encodeAttributeValue(g.pgn || '') + '" onclick="AppController.loadFetchedPGNGame(this)">' +
          '<strong>' + escapeHtml(white) + '</strong> vs <strong>' + escapeHtml(black) + '</strong>' +
          (opening ? ' — ' + escapeHtml(opening.substring(0, 28)) : '') +
          '<span class="fetch-game-result ' + resultClass + '">' + escapeHtml(result) + '</span>' +
          (date ? '<div class="fetch-game-date">' + escapeHtml(date) + '</div>' : '') +
        '</div>';
      }).join('');

      showToast('Fetched ' + games.length + ' games from ' + archive.year + '-' + archive.month, 'success');
    })
    .catch(function(err) {
      console.error('Chess.com PGN fetch failed', err);
      var hint = describeChesscomError(err, username, archive.year + '-' + archive.month);
      container.innerHTML = '<div class="no-games">' + hint + '</div>';
    });
}

function fetchChesscomMonthPgn(username, year, month) {
  var safeUsername = String(username || '').trim().replace(/^@+/, '');
  var encodedUser = encodeURIComponent(safeUsername);
  var requestUrl = 'https://api.chess.com/pub/player/' + encodedUser + '/games/' + year + '/' + month + '/pgn';
  var proxyUrl = '/api/chesscom/player/' + encodedUser + '/games/' + year + '/' + month + '/pgn';
  return fetchTextWithFallback(proxyUrl, requestUrl).then(function(text) {
    return parseChesscomArchivePayload(text, 'archive');
  });
}

function createChesscomHttpError(status, message) {
  var err = new Error(message || ('HTTP ' + status));
  err.status = status;
  return err;
}

function createChesscomInvalidResponseError(source) {
  var err = new Error('Unexpected ' + source + ' response');
  err.invalidResponse = true;
  return err;
}

function isHtmlResponse(text) {
  return /^\s*<!doctype html/i.test(text || '') || /^\s*<html/i.test(text || '');
}

function isLikelyChesscomPgn(text) {
  return /\[(Event|Site|Date)\s+"[^"]*"\]/.test(text || '');
}

function parseChesscomArchivePayload(text, source) {
  var raw = typeof text === 'string' ? text : '';
  if (!raw.trim()) {
    return '';
  }
  if (isHtmlResponse(raw)) {
    throw createChesscomInvalidResponseError(source);
  }
  if (isLikelyChesscomPgn(raw)) {
    return raw;
  }
  try {
    var parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.games)) {
      return parsed;
    }
  } catch { /* fall through to invalid response */ }
  throw createChesscomInvalidResponseError(source);
}

function fetchChesscomWithFallback(proxyUrl, directUrl, responseType) {
  function parse(response) {
    if (responseType === 'json') return response.json();
    return response.text();
  }
  return fetch(proxyUrl, { cache: 'no-store' })
    .then(function(r) {
      if (r.ok) return parse(r);
      if (r.status === 404) {
        var err = new Error('Not found on Chess.com (404)');
        err.status = 404;
        throw err;
      }
      throw new Error('proxy-unavailable');
    })
    .catch(function(err) {
      if (err && err.status === 404) throw err;
      return fetch(directUrl, { cache: 'no-store' }).then(function(r) {
        if (!r.ok) {
          var e = new Error('HTTP ' + r.status);
          e.status = r.status;
          throw e;
        }
        return parse(r);
      });
    });
}

function fetchTextWithFallback(proxyUrl, directUrl, headers) {
  var requestHeaders = headers || {};
  return fetchTextWithTimeout(proxyUrl, { cache: 'no-store', headers: requestHeaders }, 12000)
    .then(function(r) {
      if (r.ok) return r.text();
      if (r.status === 404) {
        var err = new Error('Not found (404)');
        err.status = 404;
        throw err;
      }
      throw new Error('proxy-unavailable');
    })
    .catch(function(err) {
      if (err && err.status === 404) throw err;
      return fetchTextWithTimeout(directUrl, { cache: 'no-store', headers: requestHeaders }, 12000).then(function(r) {
        if (!r.ok) {
          var e = new Error('HTTP ' + r.status);
          e.status = r.status;
          throw e;
        }
        return r.text();
      });
    });
}

function fetchTextWithTimeout(url, options, timeoutMs) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = null;
  var requestOptions = Object.assign({}, options || {});
  if (controller) requestOptions.signal = controller.signal;
  if (controller && timeoutMs > 0) {
    timer = setTimeout(function() {
      controller.abort();
    }, timeoutMs);
  }
  return fetch(url, requestOptions)
    .catch(function(err) {
      if (err && err.name === 'AbortError') {
        var timeoutErr = new Error('Request timed out');
        timeoutErr.timeout = true;
        throw timeoutErr;
      }
      throw err;
    })
    .finally(function() {
      if (timer) clearTimeout(timer);
    });
}

function describeChesscomError(err, username, period) {
  if (!err) return 'Could not reach Chess.com. Please try again.';
  var u = escapeHtml(username);
  var p = escapeHtml(period || '');
  if (err.status === 404) {
    return 'Chess.com returned 404 for “' + u + '”' +
      (p ? ' in ' + p : '') + '. Check the username and period.';
  }
  var rawMsg = err.message || '';
  if (err.timeout) {
    return 'Chess.com request timed out for “' + u + '”' +
      (p ? ' in ' + p : '') + '. Try again or change period.';
  }
  if (/Failed to fetch|NetworkError|load failed/i.test(rawMsg)) {
    return 'Network request to Chess.com was blocked. Disable ad/privacy blockers for this site, then retry.';
  }
  return 'Could not fetch games from Chess.com (' + escapeHtml(rawMsg || 'unknown error') + ').';
}

function describeLichessError(err, username) {
  if (!err) return 'Could not reach Lichess. Please try again.';
  var u = escapeHtml(username);
  if (err.status === 404) {
    return 'No public games found for “' + u + '” on Lichess.';
  }
  var rawMsg = err.message || '';
  if (/Failed to fetch|NetworkError|load failed/i.test(rawMsg)) {
    return 'Network request to Lichess was blocked. Disable blockers for this site, then retry.';
  }
  return 'Could not fetch games from Lichess (' + escapeHtml(rawMsg || 'unknown error') + ').';
}

function loadFetchedGame(el) {
  var id = el.getAttribute('data-id');
  var platform = el.getAttribute('data-platform');

  if (platform === 'lichess') {
    var proxyUrl = '/api/lichess/game/' + encodeURIComponent(id) + '/export?clocks=true&evals=false';
    var directUrl = 'https://lichess.org/game/export/' + encodeURIComponent(id) + '?clocks=true&evals=false';
    fetchTextWithFallback(proxyUrl, directUrl)
      .then(function(pgn) {
        if (pgn) {
          _loadPGNGame(pgn, {
            sourcePlatform: 'lichess',
            sourceUsername: window._lichessFetchedUsername || _readStoredProfile().lichessUsername || ''
          });
          _switchTab('analyze');
          _triggerAutoReview();
        }
      });
  }
}

function loadFetchedPGNGame(el) {
  var pgn = decodeURIComponent(el.getAttribute('data-pgn'));
  if (pgn) {
    _loadPGNGame(pgn, {
      sourcePlatform: 'chesscom',
      sourceUsername: window._ccFetchedUsername || _readStoredProfile().chesscomUsername || ''
    });
    _switchTab('analyze');
    _triggerAutoReview();
  }
}

function init({ loadPGNGame, switchTab, triggerAutoReview, readStoredProfile } = {}) {
  if (typeof loadPGNGame === 'function') _loadPGNGame = loadPGNGame;
  if (typeof switchTab === 'function') _switchTab = switchTab;
  if (typeof triggerAutoReview === 'function') _triggerAutoReview = triggerAutoReview;
  if (typeof readStoredProfile === 'function') _readStoredProfile = readStoredProfile;
}

export default {
  init,
  fetchGames,
  renderFetchSkeleton,
  parseChesscomArchiveGames,
  formatChesscomOpeningLabel,
  fetchChesscomMonthPgn,
  fetchChesscomWithFallback,
  fetchTextWithFallback,
  describeChesscomError,
  describeLichessError,
  loadFetchedGame,
  loadFetchedPGNGame,
  // legacy / unused but exported for parity
  fetchChessComGames
};
