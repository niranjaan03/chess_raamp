// Click delegation for data-action handlers. Replaces inline
// onclick="ControllerName.foo(arg)" strings — those required globals
// on `window` and are blocked by strict CSP / a security audit.
//
// Usage:
//   import { registerActions } from '../utils/actions.js';
//   registerActions({
//     'home.setGamesTabPage': (target, args) => HomeController.setGamesTabPage(Number(args[0])),
//   });
//
// Markup:
//   <button data-action="home.setGamesTabPage" data-arg-0="3">3</button>
//
// Args are read from `data-arg-0`, `data-arg-1`, ... (strings; coerce
// in the handler). The clicked element itself is also passed.

const registry = new Map();
let listenerInstalled = false;

function readArgs(target) {
  const args = [];
  let i = 0;
  while (true) {
    const value = target.getAttribute(`data-arg-${i}`);
    if (value === null) break;
    args.push(value);
    i += 1;
  }
  return args;
}

function handleDelegatedClick(event) {
  let node = event.target;
  while (node && node !== document.body) {
    if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-action')) {
      const action = node.getAttribute('data-action');
      const handler = registry.get(action);
      if (handler) {
        if (node.getAttribute('data-stop-propagation') === '1') event.stopPropagation();
        try {
          handler(node, readArgs(node), event);
        } catch (err) {
          console.error(`[actions] handler "${action}" threw:`, err);
        }
      }
      return;
    }
    node = node.parentNode;
  }
}

function ensureListener() {
  if (listenerInstalled) return;
  if (typeof document === 'undefined') return;
  document.addEventListener('click', handleDelegatedClick);
  listenerInstalled = true;
}

export function registerActions(handlers) {
  ensureListener();
  Object.keys(handlers || {}).forEach((key) => {
    registry.set(key, handlers[key]);
  });
}

export function unregisterAction(key) {
  registry.delete(key);
}
