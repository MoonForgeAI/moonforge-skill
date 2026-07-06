// MoonForge Web SDK — public entry. Wires modules, session, auto-capture, globals.
import * as core from './core.js';
import * as analytics from './analytics.js';
import * as errors from './errors.js';
import { setGameState, setGameStateData, getGameState, clearGameState } from './context.js';

let sessionStartedAt = 0;
let autoInstalled = false;

const NETWORK_ERROR_STATUS_THRESHOLD = 400;

/**
 * Extracts a usable URL string from a fetch() first argument, which may be
 * a plain string, a URL object, or a Request object.
 * @param {string | URL | Request | undefined} input
 * @returns {string}
 */
function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.href === 'string') return input.href; // URL object
  if (input && typeof input.url === 'string') return input.url; // Request object
  return '';
}

function startSession() {
  sessionStartedAt = Date.now();
  analytics.trackEvent('session_start', { session_id: core.getSessionId() });
  if (typeof globalThis.addEventListener === 'function') {
    const end = () => {
      if (globalThis.__mfSessionEnded) return;
      globalThis.__mfSessionEnded = true;
      const duration_seconds = Math.round((Date.now() - sessionStartedAt) / 1000);
      analytics.trackEvent('session_end', { session_id: core.getSessionId(), duration_seconds }, { beacon: true });
    };
    globalThis.addEventListener('pagehide', end);
    globalThis.addEventListener('visibilitychange', () => { if (globalThis.document?.visibilityState === 'hidden') end(); });
  }
}

function installAutoCapture() {
  if (autoInstalled || typeof globalThis.addEventListener !== 'function') return;
  autoInstalled = true;
  globalThis.addEventListener('error', (e) => {
    if (e?.error) errors._captureUnhandled(e.error);
    else if (e?.message) errors.captureMessage(e.message, { level: core.ErrorLevel.Error });
  });
  globalThis.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason;
    errors._captureUnhandled(r instanceof Error ? r : new Error(String(r)));
  });
}

function installFetchInterceptor(threshold = NETWORK_ERROR_STATUS_THRESHOLD) {
  if (typeof globalThis.fetch !== 'function' || globalThis.__mfFetchWrapped) return;
  globalThis.__mfFetchWrapped = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args) => {
    const start = Date.now();
    const url = requestUrl(args[0]);
    const method = (args[1]?.method ?? (typeof args[0] !== 'string' ? args[0]?.method : undefined) ?? 'GET').toUpperCase();
    // Never intercept our own collector calls (also skips capture when the URL is unresolvable).
    const cfg = core.getConfig();
    if (!url || (cfg && url.startsWith(cfg.apiEndpoint))) return orig(...args);
    try {
      const res = await orig(...args);
      if (res.status >= threshold) errors.captureNetworkError(url, { method, statusCode: res.status, durationMs: Date.now() - start });
      return res;
    } catch (e) { errors.captureNetworkError(url, { method, errorMessage: String(e), durationMs: Date.now() - start }); throw e; }
  };
}

function init(options = {}) {
  const cfg = core.init(options);
  if (!cfg) return undefined;
  installAutoCapture();
  if (cfg.autoTrackSession) startSession();
  if (cfg.trackNetworkErrors) installFetchInterceptor();
  return cfg;
}

export const MoonForgeAnalytics = {
  init,
  trackEvent: analytics.trackEvent,
  trackScreenView: analytics.trackScreenView,
  identify: analytics.identify,
  setUserProperty: analytics.setUserProperty,
  removeUserProperty: analytics.removeUserProperty,
  clearUserProperties: analytics.clearUserProperties,
  getDistinctId: analytics.getDistinctId,
  getSessionId: analytics.getSessionId,
  reset: analytics.reset,
  flush: analytics.flush,
};

export const MoonForgeErrorTracker = {
  setUser: errors.setUser,
  clearUser: errors.clearUser,
  setGameState,
  setGameStateData,
  getGameState,
  clearGameState,
  addBreadcrumb: errors.addBreadcrumb,
  getBreadcrumbs: errors.getBreadcrumbs,
  captureException: errors.captureException,
  captureMessage: errors.captureMessage,
  captureNetworkError: errors.captureNetworkError,
  flush: errors.flush,
};

export const ErrorLevel = core.ErrorLevel;
export const BreadcrumbType = core.BreadcrumbType;
export const BreadcrumbLevel = core.BreadcrumbLevel;

if (typeof globalThis !== 'undefined') {
  globalThis.MoonForgeAnalytics = MoonForgeAnalytics;
  globalThis.MoonForgeErrorTracker = MoonForgeErrorTracker;
}
