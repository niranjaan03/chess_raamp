export function getEl(target) {
  if (!target) return null;
  if (typeof target === 'string') return document.getElementById(target);
  return target;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, function(ch) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch];
  });
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function setText(target, value) {
  var el = getEl(target);
  if (!el) return null;
  el.textContent = value ?? '';
  return el;
}

export function bind(target, eventName, handler, options) {
  var el = getEl(target);
  if (!el || typeof handler !== 'function') return null;
  el.addEventListener(eventName, handler, options);
  return el;
}

export function bindClick(target, handler, options) {
  return bind(target, 'click', handler, options);
}
