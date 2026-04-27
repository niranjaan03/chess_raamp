/**
 * Toast notification + clipboard helpers.
 * Pure DOM utilities — no controller state.
 */

export function showToast(message, type) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(function() { toast.className = 'toast'; }, 3000);
}

export function copyToClipboard(text) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
