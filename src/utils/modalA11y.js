// Modal a11y wiring — ESC to close, focus trap inside the modal, and
// focus restoration after close. The app's modals are toggled by
// controllers via `style.display = 'flex'/'none'`, so we observe that
// attribute instead of forcing every controller to call a helper.
//
// Markup contract:
//   - The modal root has role="dialog" + aria-modal="true"
//   - It has a `[data-modal-close]` element (or `.modal-close` / `id*="ModalClose"`)
//     that closes the modal when clicked. ESC fires that element's click.
//   - Optional: `[data-modal-initial-focus]` to override which child gets
//     initial focus.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',');

const observed = new WeakSet();

function isVisible(el) {
  if (!el) return false;
  const display = (el.style && el.style.display) || '';
  if (display === 'none') return false;
  if (el.hidden) return false;
  // getComputedStyle is more accurate but uses layout. Style attr is enough
  // for our case because controllers toggle inline display.
  return true;
}

function focusableChildren(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => !el.hidden);
}

function findCloseTrigger(modal) {
  return (
    modal.querySelector('[data-modal-close]') ||
    modal.querySelector('.modal-close') ||
    modal.querySelector('[id$="ModalClose"]')
  );
}

function activate(modal) {
  if (modal._a11yState) return;
  const previousFocus = document.activeElement;
  const focusables = focusableChildren(modal);
  const initial = modal.querySelector('[data-modal-initial-focus]') || focusables[0];
  if (initial && typeof initial.focus === 'function') {
    setTimeout(() => initial.focus(), 0);
  }

  function onKeydown(event) {
    if (!isVisible(modal)) return;
    if (event.key === 'Escape' || event.keyCode === 27) {
      const close = findCloseTrigger(modal);
      if (close) {
        event.preventDefault();
        close.click();
      }
      return;
    }
    if (event.key === 'Tab' || event.keyCode === 9) {
      const items = focusableChildren(modal);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', onKeydown);
  modal._a11yState = { onKeydown, previousFocus };
}

function deactivate(modal) {
  const state = modal._a11yState;
  if (!state) return;
  document.removeEventListener('keydown', state.onKeydown);
  if (state.previousFocus && typeof state.previousFocus.focus === 'function') {
    try { state.previousFocus.focus(); } catch { /* element gone */ }
  }
  modal._a11yState = null;
}

function syncModal(modal) {
  if (isVisible(modal)) activate(modal);
  else deactivate(modal);
}

export function attachModalA11y(modal) {
  if (!modal || observed.has(modal)) return;
  observed.add(modal);
  syncModal(modal);
  const observer = new MutationObserver(() => syncModal(modal));
  observer.observe(modal, { attributes: true, attributeFilter: ['style', 'hidden'] });
}

export function attachAllModals(root) {
  const scope = root || document;
  scope.querySelectorAll('[role="dialog"]').forEach(attachModalA11y);
}
