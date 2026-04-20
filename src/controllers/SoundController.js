const RAW_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '';
const CLEAN_BASE_URL = (!RAW_BASE_URL || RAW_BASE_URL === '/') ? '' : RAW_BASE_URL.replace(/\/$/, '');
const MOVE_SOUND_SRC = (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/chess-move.ogg';
const MOVE_SOUND_KEY = 'kv_move_sound_enabled';

const SoundController = (function() {
  var initialized = false;
  var enabled = false;
  var audioContext = null;
  var moveBuffer = null;
  var fallbackAudio = null;

  function init() {
    if (initialized) return;
    initialized = true;
    enabled = readEnabledPreference();
    createFallbackAudio();
    preloadMoveSound();
    registerUnlockListeners();
  }

  function createFallbackAudio() {
    if (typeof Audio === 'undefined') return;
    fallbackAudio = new Audio(MOVE_SOUND_SRC);
    fallbackAudio.preload = 'auto';
  }

  function ensureAudioContext() {
    if (audioContext || typeof window === 'undefined') return audioContext;
    var Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
    return audioContext;
  }

  function preloadMoveSound() {
    var ctx = ensureAudioContext();
    if (!ctx || typeof fetch !== 'function') return;
    fetch(MOVE_SOUND_SRC)
      .then(function(response) {
        if (!response.ok) throw new Error('Sound fetch failed');
        return response.arrayBuffer();
      })
      .then(function(buffer) {
        return ctx.decodeAudioData(buffer.slice(0));
      })
      .then(function(decoded) {
        moveBuffer = decoded;
      })
      .catch(function() {
        /* Fallback audio element is enough if decode fails */
      });
  }

  function registerUnlockListeners() {
    if (typeof window === 'undefined') return;
    ['pointerdown', 'keydown', 'touchstart'].forEach(function(eventName) {
      window.addEventListener(eventName, unlockAudio, { passive: true });
    });
  }

  function unlockAudio() {
    var ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function() {});
    }
  }

  function readEnabledPreference() {
    if (typeof window === 'undefined') return true;
    try {
      var saved = localStorage.getItem(MOVE_SOUND_KEY);
      if (saved == null) return false;
      return saved !== 'false';
    } catch (e) {
      return true;
    }
  }

  function persistEnabledPreference(value) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MOVE_SOUND_KEY, value ? 'true' : 'false');
    } catch { /* storage full */ }
  }

  function playBufferedMove() {
    var ctx = ensureAudioContext();
    if (!ctx || !moveBuffer || ctx.state !== 'running') return false;
    var source = ctx.createBufferSource();
    var gain = ctx.createGain();
    source.buffer = moveBuffer;
    gain.gain.value = 0.9;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  }

  function playFallbackMove() {
    if (!fallbackAudio) return;
    try {
      var sound = fallbackAudio.cloneNode();
      sound.volume = 0.9;
      var playPromise = sound.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function() {});
      }
    } catch { /* audio unavailable */ }
  }

  function playMove() {
    if (!enabled) return;
    init();
    var ctx = ensureAudioContext();
    if (ctx && ctx.state !== 'running') {
      ctx.resume()
        .then(function() {
          if (!playBufferedMove()) playFallbackMove();
        })
        .catch(function() {
          playFallbackMove();
        });
      return;
    }
    if (!playBufferedMove()) playFallbackMove();
  }

  function setEnabled(value) {
    enabled = value !== false;
    persistEnabledPreference(enabled);
    if (enabled) unlockAudio();
  }

  function isEnabled() {
    return enabled;
  }

  return {
    init: init,
    playMove: playMove,
    setEnabled: setEnabled,
    isEnabled: isEnabled
  };
})();

export default SoundController;
