// MoonForge Web SDK — client-side error fingerprints (dedupe keys for error-queue.js).
//
// These keys only decide which reports the SDK merges before sending. They are
// never sent: the collector computes its own grouping fingerprint server-side,
// and overriding it from the client would change how existing issues group.

/** Upper bound on any free-text part of a key, so keys stay small in memory. */
const MAX_KEY_PART = 300;

function part(value) { return String(value ?? '').slice(0, MAX_KEY_PART); }

/**
 * URL without its query string or fragment (origin + pathname when parseable).
 * Query strings carry tokens, cache-busters and ids that would otherwise make
 * every failure of the same endpoint look distinct.
 * @param {unknown} url
 * @returns {string}
 */
export function urlPath(url) {
  if (url === undefined || url === null) return '';
  const raw = String(url);
  try {
    const base = globalThis.location?.href || 'http://localhost/';
    const u = new URL(raw, base);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw.split(/[?#]/)[0];
  }
}

/**
 * Thrown errors: type + message + top stack frame.
 * @param {string|undefined} exceptionClass
 * @param {string} message
 * @param {Array<{function?: string, filename?: string, lineno?: number, colno?: number}>} frames
 * @returns {string}
 */
export function exceptionFingerprint(exceptionClass, message, frames) {
  const top = Array.isArray(frames) && frames.length ? frames[0] : null;
  const where = top ? `${top.function ?? ''}@${top.filename ?? ''}:${top.lineno ?? ''}:${top.colno ?? ''}` : '';
  return `exception|${part(exceptionClass)}|${part(message)}|${part(where)}`;
}

/**
 * captureMessage reports: level + message.
 * @param {string} level
 * @param {string} message
 * @returns {string}
 */
export function messageFingerprint(level, message) {
  return `message|${part(level)}|${part(message)}`;
}

/**
 * Network errors: method + URL path (no query string) + status
 * ('failed' when the request threw and there is no status).
 * @param {string} method
 * @param {unknown} url
 * @param {number|undefined} statusCode
 * @returns {string}
 */
export function networkFingerprint(method, url, statusCode) {
  return `network|${part(String(method ?? 'GET').toUpperCase())}|${part(urlPath(url))}|${statusCode ?? 'failed'}`;
}
