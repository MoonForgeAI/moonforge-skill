// MoonForge Web SDK — public entry. Wires modules, session, auto-capture, globals.
import * as core from './core.js';
import * as analytics from './analytics.js';
import * as errors from './errors.js';
import { setGameState, setGameStateData, getGameState, clearGameState } from './context.js';

let sessionStartedAt = 0;
let autoInstalled = false;

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

function installFetchInterceptor(threshold = 400) {
  if (typeof globalThis.fetch !== 'function' || globalThis.__mfFetchWrapped) return;
  globalThis.__mfFetchWrapped = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args) => {
    const start = Date.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const method = (args[1]?.method ?? 'GET').toUpperCase();
    // Never intercept our own collector calls.
    if (url && core.getConfig() && url.startsWith(core.getConfig().apiEndpoint)) return orig(...args);
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
