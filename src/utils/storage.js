export function getString(key, fallback = '') {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setString(key, value) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getJson(key, fallback = null) {
  const raw = getString(key, '');
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJson(key, value) {
  if (value === undefined) return removeItem(key);
  try {
    return setString(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
