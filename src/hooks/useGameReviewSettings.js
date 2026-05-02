import { useEffect, useState } from 'react';
import {
  DEFAULT_GAME_REVIEW_SETTINGS,
  GAME_REVIEW_SETTINGS_KEY,
  GAME_REVIEW_SETTINGS_SCHEMA,
} from '../constants/gameReviewSettings.js';
import { getJson, setJson } from '../utils/storage.js';

const listeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeBranch(defaultBranch, schemaBranch, sourceBranch) {
  const result = Array.isArray(defaultBranch) ? [] : {};
  Object.keys(defaultBranch).forEach((key) => {
    const defaultValue = defaultBranch[key];
    const schemaValue = schemaBranch && schemaBranch[key];
    const sourceValue = sourceBranch && sourceBranch[key];

    if (isPlainObject(defaultValue)) {
      result[key] = sanitizeBranch(defaultValue, schemaValue || {}, isPlainObject(sourceValue) ? sourceValue : {});
      return;
    }

    if (Array.isArray(schemaValue)) {
      result[key] = schemaValue.includes(sourceValue) ? sourceValue : defaultValue;
      return;
    }

    result[key] = sourceValue !== undefined ? sourceValue : defaultValue;
  });
  return result;
}

export function normalizeGameReviewSettings(raw) {
  return sanitizeBranch(DEFAULT_GAME_REVIEW_SETTINGS, GAME_REVIEW_SETTINGS_SCHEMA, isPlainObject(raw) ? raw : {});
}

export function readGameReviewSettings() {
  if (typeof window === 'undefined') return clone(DEFAULT_GAME_REVIEW_SETTINGS);
  return normalizeGameReviewSettings(getJson(GAME_REVIEW_SETTINGS_KEY, null));
}

export function writeGameReviewSettings(nextSettings) {
  const normalized = normalizeGameReviewSettings(nextSettings);
  if (typeof window !== 'undefined') {
    setJson(GAME_REVIEW_SETTINGS_KEY, normalized);
  }
  listeners.forEach((listener) => listener(normalized));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('game-review-settings-change', { detail: normalized }));
  }
  return normalized;
}

export function updateGameReviewSettings(path, value) {
  const next = readGameReviewSettings();
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return writeGameReviewSettings(next);
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlainObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return writeGameReviewSettings(next);
}

export function subscribeGameReviewSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGameReviewSettings() {
  const [settings, setSettings] = useState(readGameReviewSettings);

  useEffect(() => {
    const unsubscribe = subscribeGameReviewSettings(setSettings);
    const onStorage = (event) => {
      if (event.key === GAME_REVIEW_SETTINGS_KEY) setSettings(readGameReviewSettings());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return {
    settings,
    setSetting: updateGameReviewSettings,
    replaceSettings: writeGameReviewSettings,
  };
}
