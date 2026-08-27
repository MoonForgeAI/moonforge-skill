// Client-sourced session context: timezone, locale geo hints, attribution.
const FIRST_TOUCH_PREFIX = 'mf_attr_first_';
const ATTR_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'fbclid', 'attr_channel', 'attr_touch',
];

function lget(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } }
function lset(k, v) { try { globalThis.localStorage?.setItem(k, v); } catch { /* ignore */ } }

/** IANA timezone from the runtime (always try — no permission needed). */
export function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

/** Best-effort country/region without GPS — locale + timezone hints only. */
export function getLocaleGeo() {
  const nav = globalThis.navigator ?? {};
  const lang = nav.language ?? '';
  const parts = lang.split('-');
  const out = {};
  if (parts.length >= 2 && parts[1].length === 2) {
    out.country = parts[1].toUpperCase();
  }
  const locales = nav.languages ?? [];
  for (const loc of locales) {
    const seg = String(loc).split('-');
    if (seg.length >= 2 && seg[1].length === 2) {
      out.country = seg[1].toUpperCase();
      break;
    }
  }
  return out;
}

function parseAttributionFromSearch(search) {
  const out = {};
  if (!search) return out;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of ATTR_KEYS) {
    const v = params.get(key);
    if (v) out[key] = v;
  }
  if (!out.attr_channel && (out.utm_source || out.gclid || out.fbclid)) {
    out.attr_channel = out.utm_source ?? (out.gclid ? 'google' : out.fbclid ? 'facebook' : 'campaign');
  }
  if (Object.keys(out).length && !out.attr_touch) out.attr_touch = 'last';
  return out;
}

function readFirstTouch() {
  const out = {};
  for (const key of ATTR_KEYS) {
    const v = lget(`${FIRST_TOUCH_PREFIX}${key}`);
    if (v) out[`first_${key}`] = v;
  }
  return out;
}

function persistFirstTouch(attrs) {
  if (!attrs || !Object.keys(attrs).length) return;
  let wrote = false;
  for (const key of ATTR_KEYS) {
    if (!attrs[key]) continue;
    const storageKey = `${FIRST_TOUCH_PREFIX}${key}`;
    if (!lget(storageKey)) {
      lset(storageKey, String(attrs[key]));
      wrote = true;
    }
  }
  if (wrote) {
    const existing = lget(`${FIRST_TOUCH_PREFIX}attr_touch`);
    if (!existing) lset(`${FIRST_TOUCH_PREFIX}attr_touch`, 'first');
  }
}

/** Last-touch from current URL + persisted first-touch merged for session_start. */
export function collectAttribution() {
  const loc = globalThis.location ?? {};
  const last = parseAttributionFromSearch(loc.search ?? '');
  if (Object.keys(last).length) persistFirstTouch(last);
  const first = readFirstTouch();
  const merged = { ...first };
  for (const [k, v] of Object.entries(last)) {
    if (v != null && v !== '') merged[k] = v;
  }
  return merged;
}

/** Locked client-context fields for session_start (omit empty values). */
export function collectClientContext() {
  const ctx = { timezone: getTimezone(), ...getLocaleGeo(), ...collectAttribution() };
  const out = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v != null && v !== '') out[k] = v;
  }
  return out;
}

/** Test seam */
export function resetAttributionStorage() {
  for (const key of ATTR_KEYS) {
    try { globalThis.localStorage?.removeItem(`${FIRST_TOUCH_PREFIX}${key}`); } catch { /* ignore */ }
  }
}
