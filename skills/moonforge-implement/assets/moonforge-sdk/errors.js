// MoonForge Web SDK — error capture API. Reports are deduplicated, capped and
// batched by error-queue.js, which sends them to POST /api/errors/batch.
import { isReady, getConfig, getSessionId, unixSeconds, BreadcrumbType, BreadcrumbLevel, ErrorLevel } from './core.js';
import { getDeviceContext, getNetworkContext, getGameState } from './context.js';
import { exceptionFingerprint, messageFingerprint, networkFingerprint, urlPath } from './error-fingerprint.js';
import { flushErrors, getErrorQueueStats, recordError } from './error-queue.js';

const MAX_BREADCRUMBS = 50;
const store = { breadcrumbs: [], user: null };

function ensure() { if (!isReady()) { console.warn('[MoonForge] call MoonForgeAnalytics.init() before capturing errors.'); return false; } return true; }
function stringTags(tags) { const out = {}; for (const [k, v] of Object.entries(tags ?? {})) out[k] = String(v); return out; }

export function setUser(userId, tags = {}) { store.user = { userId, tags: stringTags(tags) }; }
export function clearUser() { store.user = null; }

export function addBreadcrumb(message, { type = BreadcrumbType.User, level = BreadcrumbLevel.Info, category, data } = {}) {
  const bc = { type, level, message, category, data, timestamp: Date.now() };
  store.breadcrumbs = [...store.breadcrumbs, bc].slice(-MAX_BREADCRUMBS);
  return bc;
}
export function getBreadcrumbs() { return [...store.breadcrumbs]; }
export function clearBreadcrumbs() { store.breadcrumbs = []; }

function parseFrames(stack) {
  if (!stack) return [];
  return String(stack).split('\n').map((raw) => {
    const line = raw.trim();
    let m = line.match(/^at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/);      // V8
    if (!m) m = line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);                 // Firefox/Safari
    if (!m) return null;
    const fn = m[1] && m[1].length ? m[1] : '<anonymous>';
    const filename = m[2];
    return { function: fn, filename, lineno: Number(m[3]), colno: Number(m[4]), inApp: !filename.includes('node_modules') };
  }).filter(Boolean);
}

function baseEnvelope(errorType, errorCategory, errorLevel, extraTags) {
  const cfg = getConfig();
  const payload = {
    game: cfg.gameId, errorType, errorCategory, errorLevel,
    device: getDeviceContext(),
    appVersion: cfg.appVersion, buildNumber: cfg.buildNumber,
    sessionId: getSessionId(), timestamp: unixSeconds(),
    breadcrumbs: getBreadcrumbs(),
    tags: { ...(store.user?.tags ?? {}), ...stringTags(extraTags) },
  };
  const net = getNetworkContext(); if (net) payload.network = net;
  const gsv = getGameState(); if (Object.keys(gsv).length) payload.gameState = gsv;
  if (store.user?.userId) payload.userId = store.user.userId;
  return payload;
}

/**
 * Hands one report to the queue. Capture calls resolve to true when the
 * occurrence will reach the collector (as a report or a repeat count), false
 * when it was only counted locally (session cap) or could not be built.
 */
function submit(build) {
  try {
    const { fingerprint, payload } = build();
    return Promise.resolve(recordError(fingerprint, payload));
  } catch {
    return Promise.resolve(false);
  }
}

export function captureException(error, { level = ErrorLevel.Error, tags = {}, category = 'handled' } = {}) {
  if (!ensure()) return undefined;
  return submit(() => {
    const e = error instanceof Error ? error : new Error(String(error));
    const message = String(e.message).slice(0, 5000);
    const exceptionClass = e.name || 'Error';
    const frames = parseFrames(e.stack);
    const payload = { ...baseEnvelope('exception', category, level, tags), message, exceptionClass, frames, rawStackTrace: e.stack ? String(e.stack).slice(0, 50000) : undefined };
    return { fingerprint: exceptionFingerprint(exceptionClass, message, frames), payload };
  });
}
export function captureMessage(message, { level = ErrorLevel.Info, tags = {} } = {}) {
  if (!ensure()) return undefined;
  return submit(() => {
    const text = String(message).slice(0, 5000);
    return { fingerprint: messageFingerprint(level, text), payload: { ...baseEnvelope('custom', 'handled', level, tags), message: text } };
  });
}
export function captureNetworkError(url, { method = 'GET', statusCode, errorMessage, durationMs, tags = {} } = {}) {
  if (!ensure()) return undefined;
  return submit(() => {
    // Only origin + path ever leaves the browser: query strings, fragments and
    // userinfo can carry tokens and personal data.
    const safeUrl = urlPath(url);
    addBreadcrumb(`${method} ${safeUrl} -> ${statusCode ?? 'failed'}`, { type: BreadcrumbType.Network, level: BreadcrumbLevel.Error });
    const payload = { ...baseEnvelope('network', 'handled', ErrorLevel.Error, tags), message: String(errorMessage ?? `${method} ${safeUrl} failed`).slice(0, 5000), networkRequest: { url: safeUrl.slice(0, 2000), method, statusCode, durationMs } };
    return { fingerprint: networkFingerprint(method, url, statusCode), payload };
  });
}
/** Sends everything queued now, including held repeat counts. Resolves true when the queue is empty. */
export function flush() { return flushErrors({ drain: true }); }
/** Queue diagnostics: { sent, dropped, suppressed, rejected, queued, distinctReported, paused, pausedUntil }. */
export function getStats() { return getErrorQueueStats(); }

// Internal: used by index.js auto-capture.
export function _captureUnhandled(error) { return captureException(error, { category: 'unhandled', level: ErrorLevel.Error }); }
