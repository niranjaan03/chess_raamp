const RAW_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
  ? import.meta.env.BASE_URL
  : '';
const CLEAN_BASE_URL = (!RAW_BASE_URL || RAW_BASE_URL === '/') ? '' : RAW_BASE_URL.replace(/\/$/, '');

const MOVE_SOUND_SOURCES = {
  classic: (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/chess-move.ogg',
  premium: (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/premium-chime.wav',
  glass: (CLEAN_BASE_URL ? CLEAN_BASE_URL : '') + '/sounds/glass-bell.wav'
};

const MOVE_SOUND_KEY = 'kv_move_sound_enabled';
const MOVE_SOUND_STYLE_KEY = 'kv_move_sound_style';

const SoundController = (function() {
  var initialized = false;
  var enabled = false;
  var soundStyle = 'classic';
  var audioContext = null;
  var moveBuffers = {};
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
    Object.keys(MOVE_SOUND_SOURCES).forEach(function(style) {
      fallbackAudios[style] = new Audio(MOVE_SOUND_SOURCES[style]);
      fallbackAudios[style].preload = 'auto';
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
    Object.keys(MOVE_SOUND_SOURCES).forEach(function(style) {
      fetch(MOVE_SOUND_SOURCES[style])
        .then(function(response) {
          if (!response.ok) throw new Error('Sound fetch failed');
          return response.arrayBuffer();
        })
        .then(function(buffer) {
          return ctx.decodeAudioData(buffer.slice(0));
        })
        .then(function(decoded) {
          moveBuffers[style] = decoded;
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
      if (saved && Object.keys(MOVE_SOUND_SOURCES).indexOf(saved) !== -1) return saved;
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

  function playBufferedMove() {
    var ctx = ensureAudioContext();
    var buffer = moveBuffers[soundStyle];
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

  function playFallbackMove() {
    var fallback = fallbackAudios[soundStyle];
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

  function setSoundStyle(style) {
    if (Object.keys(MOVE_SOUND_SOURCES).indexOf(style) !== -1) {
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
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    setSoundStyle: setSoundStyle,
    getSoundStyle: getSoundStyle
  };
})();

export default SoundController;
