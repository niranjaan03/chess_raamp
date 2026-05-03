const RAW_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '';
const CLEAN_BASE_URL = (!RAW_BASE_URL || RAW_BASE_URL === '/') ? '' : RAW_BASE_URL.replace(/\/$/, '');

const SOUND_SOURCES = {
  move: (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/move.mp3',
  capture: (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/capture.mp3',
  error: (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/error.mp3'
};

const MOVE_SOUND_STYLES = {
  classic: 'move',
  premium: 'move',
  glass: 'move'
};

const MOVE_SOUND_KEY = 'kv_move_sound_enabled';
const MOVE_SOUND_STYLE_KEY = 'kv_move_sound_style';

const SoundController = (function() {
  var initialized = false;
  var enabled = false;
  var soundStyle = 'classic';
  var audioContext = null;
  var soundBuffers = {};
  var fallbackAudios = {};

  function init() {
    if (initialized) return;
    initialized = true;
    enabled = readEnabledPreference();
    soundStyle = readSoundStylePreference();
    createFallbackAudios();
    preloadMoveSounds();
    registerUnlockListeners();
  }

  function createFallbackAudios() {
    if (typeof Audio === 'undefined') return;
    Object.keys(SOUND_SOURCES).forEach(function(type) {
      fallbackAudios[type] = new Audio(SOUND_SOURCES[type]);
      fallbackAudios[type].preload = 'auto';
    });
  }

  function ensureAudioContext() {
    if (audioContext || typeof window === 'undefined') return audioContext;
    var Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
    return audioContext;
  }

  function preloadMoveSounds() {
    var ctx = ensureAudioContext();
    if (!ctx || typeof fetch !== 'function') return;
    Object.keys(SOUND_SOURCES).forEach(function(type) {
      fetch(SOUND_SOURCES[type])
        .then(function(response) {
          if (!response.ok) throw new Error('Sound fetch failed');
          return response.arrayBuffer();
        })
        .then(function(buffer) {
          return ctx.decodeAudioData(buffer.slice(0));
        })
        .then(function(decoded) {
          soundBuffers[type] = decoded;
        })
        .catch(function() {
          /* Fallback audio element is enough if decode fails */
        });
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

  function readSoundStylePreference() {
    if (typeof window === 'undefined') return 'classic';
    try {
      var saved = localStorage.getItem(MOVE_SOUND_STYLE_KEY);
      if (saved && Object.keys(MOVE_SOUND_STYLES).indexOf(saved) !== -1) return saved;
      return 'classic';
    } catch (e) {
      return 'classic';
    }
  }

  function persistEnabledPreference(value) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MOVE_SOUND_KEY, value ? 'true' : 'false');
    } catch { /* storage full */ }
  }

  function persistSoundStylePreference(style) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MOVE_SOUND_STYLE_KEY, style);
    } catch { /* storage full */ }
  }

  function normalizeSoundType(type) {
    return Object.keys(SOUND_SOURCES).indexOf(type) !== -1 ? type : 'move';
  }

  function isCaptureMove(moveInfo) {
    if (!moveInfo) return false;
    if (moveInfo.captured) return true;
    if (moveInfo.san && String(moveInfo.san).indexOf('x') !== -1) return true;
    if (moveInfo.flags && /[ce]/.test(String(moveInfo.flags))) return true;
    return false;
  }

  function playBufferedSound(type) {
    type = normalizeSoundType(type);
    var ctx = ensureAudioContext();
    var buffer = soundBuffers[type];
    if (!ctx || !buffer || ctx.state !== 'running') return false;
    var source = ctx.createBufferSource();
    var gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.9;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  }

  function playFallbackSound(type) {
    type = normalizeSoundType(type);
    var fallback = fallbackAudios[type];
    if (!fallback) return;
    try {
      var sound = fallback.cloneNode();
      sound.volume = 0.9;
      var playPromise = sound.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function() {});
      }
    } catch { /* audio unavailable */ }
  }

  function playSound(type) {
    if (!enabled) return;
    init();
    type = normalizeSoundType(type);
    var ctx = ensureAudioContext();
    if (ctx && ctx.state !== 'running') {
      ctx.resume()
        .then(function() {
          if (!playBufferedSound(type)) playFallbackSound(type);
        })
        .catch(function() {
          playFallbackSound(type);
        });
      return;
    }
    if (!playBufferedSound(type)) playFallbackSound(type);
  }

  function playMove(moveInfo) {
    playSound(isCaptureMove(moveInfo) ? 'capture' : 'move');
  }

  function playCapture() {
    playSound('capture');
  }

  function playError() {
    playSound('error');
  }

  function setEnabled(value) {
    enabled = value !== false;
    persistEnabledPreference(enabled);
    if (enabled) unlockAudio();
  }

  function isEnabled() {
    return enabled;
  }

  function setSoundStyle(style) {
    if (Object.keys(MOVE_SOUND_STYLES).indexOf(style) !== -1) {
      soundStyle = style;
      persistSoundStylePreference(style);
    }
  }

  function getSoundStyle() {
    return soundStyle;
  }

  return {
    init: init,
    playMove: playMove,
    playCapture: playCapture,
    playError: playError,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    setSoundStyle: setSoundStyle,
    getSoundStyle: getSoundStyle
  };
})();

export default SoundController;
