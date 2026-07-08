/* MoonForge Web SDK — generated global bundle. Do not edit by hand. Regenerate with: npm run build:sdk */
(() => {
  // skills/moonforge-implement/assets/moonforge-sdk/core.js
  var DISTINCT_ID_KEY = "mf_distinct_id";
  var SESSION_ID_KEY = "mf_session_id";
  var SESSION_TS_KEY = "mf_session_ts";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1e3;
  var DEFAULT_ENDPOINT = "https://collector.moonforge.co";
  var ErrorLevel = Object.freeze({ Info: "info", Warning: "warning", Error: "error", Fatal: "fatal" });
  var BreadcrumbType = Object.freeze({ Navigation: "navigation", Network: "network", User: "user", Debug: "debug", Error: "error" });
  var BreadcrumbLevel = Object.freeze({ Debug: "debug", Info: "info", Warning: "warning", Error: "error", Fatal: "fatal" });
  var state = { config: null, cacheToken: null, userProps: {} };
  function uuid() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      return (ch === "x" ? r : r & 3 | 8).toString(16);
    });
  }
  function lget(k) {
    var _a, _b;
    try {
      return (_b = (_a = globalThis.localStorage) == null ? void 0 : _a.getItem(k)) != null ? _b : null;
    } catch {
      return null;
    }
  }
  function lset(k, v) {
    var _a;
    try {
      (_a = globalThis.localStorage) == null ? void 0 : _a.setItem(k, v);
    } catch {
    }
  }
  function unixSeconds() {
    return Math.floor(Date.now() / 1e3);
  }
  function init(options = {}) {
    var _a, _b, _c, _d, _e, _f;
    if (!options.gameId) {
      console.warn("[MoonForge] init: gameId is required; SDK disabled.");
      state.config = null;
      return void 0;
    }
    state.config = {
      gameId: options.gameId,
      apiEndpoint: ((_a = options.apiEndpoint) != null ? _a : DEFAULT_ENDPOINT).replace(/\/+$/, ""),
      debug: (_b = options.debug) != null ? _b : false,
      autoTrackSession: (_c = options.autoTrackSession) != null ? _c : true,
      trackNetworkErrors: (_d = options.trackNetworkErrors) != null ? _d : false,
      appVersion: (_e = options.appVersion) != null ? _e : "1.0.0",
      buildNumber: (_f = options.buildNumber) != null ? _f : "1"
    };
    return state.config;
  }
  function isReady() {
    return state.config !== null;
  }
  function getConfig() {
    return state.config;
  }
  function debugLog(...args) {
    var _a;
    if ((_a = state.config) == null ? void 0 : _a.debug) console.debug("[MoonForge]", ...args);
  }
  function getDistinctId() {
    let id = lget(DISTINCT_ID_KEY);
    if (!id) {
      id = uuid();
      lset(DISTINCT_ID_KEY, id);
    }
    return id;
  }
  function setDistinctId(id) {
    if (id) lset(DISTINCT_ID_KEY, id);
  }
  function getSessionId() {
    var _a;
    const now = Date.now();
    const last = parseInt((_a = lget(SESSION_TS_KEY)) != null ? _a : "0", 10);
    let id = lget(SESSION_ID_KEY);
    if (!id || !last || now - last > SESSION_TIMEOUT_MS) {
      id = uuid();
      lset(SESSION_ID_KEY, id);
    }
    lset(SESSION_TS_KEY, String(now));
    return id;
  }
  function resetSession() {
    const id = uuid();
    lset(SESSION_ID_KEY, id);
    lset(SESSION_TS_KEY, String(Date.now()));
    return id;
  }
  function getUserProps() {
    return { ...state.userProps };
  }
  function setUserProp(k, v) {
    state.userProps = { ...state.userProps, [k]: v };
  }
  function removeUserProp(k) {
    const n = { ...state.userProps };
    delete n[k];
    state.userProps = n;
  }
  function clearUserProps() {
    state.userProps = {};
  }
  function resetAll() {
    state.userProps = {};
    state.cacheToken = null;
    setDistinctId(uuid());
    resetSession();
  }
  function collectAutoFields() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const loc = (_a = globalThis.location) != null ? _a : {};
    const doc = (_b = globalThis.document) != null ? _b : {};
    const nav = (_c = globalThis.navigator) != null ? _c : {};
    const scr = (_d = globalThis.screen) != null ? _d : {};
    return {
      game: (_e = state.config) == null ? void 0 : _e.gameId,
      id: getDistinctId(),
      url: `${(_f = loc.pathname) != null ? _f : ""}${(_g = loc.hash) != null ? _g : ""}`,
      title: (_h = doc.title) != null ? _h : "",
      referrer: (_i = doc.referrer) != null ? _i : "",
      screen: scr.width && scr.height ? `${scr.width}x${scr.height}` : "",
      language: (_j = nav.language) != null ? _j : "",
      hostname: (_k = loc.hostname) != null ? _k : "",
      timestamp: unixSeconds()
    };
  }
  async function postEvent(payload, { beacon = false } = {}) {
    var _a;
    if (!state.config) return false;
    const url = `${state.config.apiEndpoint}/api/send`;
    const body = JSON.stringify(payload);
    if (beacon && typeof ((_a = globalThis.navigator) == null ? void 0 : _a.sendBeacon) === "function") {
      try {
        const ok = globalThis.navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        debugLog("beacon", payload.type, ok);
        if (ok) return true;
      } catch (e) {
        debugLog("beacon failed", e);
      }
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", ...state.cacheToken ? { "x-moonforge-cache": state.cacheToken } : {} },
        body
      });
      if (res.ok) {
        try {
          const d = await res.json();
          if (d == null ? void 0 : d.cache) state.cacheToken = d.cache;
        } catch {
        }
      }
      debugLog("send", payload.type, res.status);
      return res.ok;
    } catch (e) {
      debugLog("send failed", e);
      return false;
    }
  }
  async function postError(body) {
    if (!state.config) return false;
    try {
      const res = await fetch(`${state.config.apiEndpoint}/api/errors`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      debugLog("error", res.status);
      return res.ok;
    } catch (e) {
      debugLog("error send failed", e);
      return false;
    }
  }

  // skills/moonforge-implement/assets/moonforge-sdk/analytics.js
  function ensure() {
    if (!isReady()) {
      console.warn("[MoonForge] call MoonForgeAnalytics.init() before tracking.");
      return false;
    }
    return true;
  }
  function trackEvent(name, data = {}, opts = {}) {
    if (!ensure()) return void 0;
    return postEvent({ type: "event", payload: { ...collectAutoFields(), name, data: { ...getUserProps(), ...data } } }, opts);
  }
  function trackScreenView(name) {
    if (!ensure()) return void 0;
    const auto = collectAutoFields();
    return postEvent({ type: "event", payload: { ...auto, name: "screen_view", title: name || auto.title, data: { ...getUserProps(), screen_name: name } } });
  }
  function identify(userId, traits = {}) {
    if (!ensure()) return void 0;
    if (userId) setDistinctId(userId);
    return postEvent({ type: "identify", payload: { game: getConfig().gameId, id: userId != null ? userId : getDistinctId(), data: traits, timestamp: unixSeconds() } });
  }
  function setUserProperty(k, v) {
    setUserProp(k, v);
  }
  function removeUserProperty(k) {
    removeUserProp(k);
  }
  function clearUserProperties() {
    clearUserProps();
  }
  function reset() {
    resetAll();
  }
  function flush() {
    return Promise.resolve(true);
  }

  // skills/moonforge-implement/assets/moonforge-sdk/context.js
  var NET_TYPES = /* @__PURE__ */ new Set(["wifi", "cellular", "ethernet", "none"]);
  var gs = { value: {} };
  function ua() {
    var _a, _b;
    return (_b = (_a = globalThis.navigator) == null ? void 0 : _a.userAgent) != null ? _b : "";
  }
  function osVersion(s) {
    var _a;
    const m = s.match(/(Windows NT [\d.]+|Mac OS X [\d_]+|Android [\d.]+|iPhone OS [\d_]+|CPU OS [\d_]+)/);
    return (m ? m[1].replace(/_/g, ".") : ((_a = globalThis.navigator) == null ? void 0 : _a.platform) || "unknown") || "unknown";
  }
  function deviceModel(s) {
    if (/iPhone/.test(s)) return "iPhone";
    if (/iPad/.test(s)) return "iPad";
    if (/Android/.test(s)) {
      const m = s.match(/;\s?([^;)]+)\sBuild/);
      return (m ? m[1].trim() : "Android") || "Android";
    }
    const b = s.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/);
    return (b ? `Browser (${b[1]})` : "Browser") || "Browser";
  }
  function getDeviceContext() {
    var _a;
    const s = ua();
    const ctx = { platform: "web", osVersion: osVersion(s), deviceModel: deviceModel(s) };
    const mem = (_a = globalThis.performance) == null ? void 0 : _a.memory;
    if (mem) {
      ctx.memoryUsedMb = Math.round(mem.usedJSHeapSize / 1048576);
      ctx.memoryAvailableMb = Math.round(mem.jsHeapSizeLimit / 1048576);
    }
    return ctx;
  }
  function getNetworkContext() {
    var _a;
    const c = (_a = globalThis.navigator) == null ? void 0 : _a.connection;
    if (!c) return void 0;
    const out = {};
    if (NET_TYPES.has(c.type)) out.type = c.type;
    if (c.effectiveType) out.effectiveType = c.effectiveType;
    return Object.keys(out).length ? out : void 0;
  }
  function setGameState(next = {}) {
    gs.value = {
      ...gs.value,
      ...next.sceneName !== void 0 ? { sceneName: next.sceneName } : {},
      ...next.gameMode !== void 0 ? { gameMode: next.gameMode } : {},
      ...next.levelId !== void 0 ? { levelId: next.levelId } : {}
    };
  }
  function setGameStateData(k, v) {
    var _a;
    gs.value = { ...gs.value, customData: { ...(_a = gs.value.customData) != null ? _a : {}, [k]: v } };
  }
  function getGameState() {
    return { ...gs.value, ...gs.value.customData ? { customData: { ...gs.value.customData } } : {} };
  }
  function clearGameState() {
    gs.value = {};
  }

  // skills/moonforge-implement/assets/moonforge-sdk/errors.js
  var MAX_BREADCRUMBS = 50;
  var store = { breadcrumbs: [], user: null };
  function ensure2() {
    if (!isReady()) {
      console.warn("[MoonForge] call MoonForgeAnalytics.init() before capturing errors.");
      return false;
    }
    return true;
  }
  function stringTags(tags) {
    const out = {};
    for (const [k, v] of Object.entries(tags != null ? tags : {})) out[k] = String(v);
    return out;
  }
  function setUser(userId, tags = {}) {
    store.user = { userId, tags: stringTags(tags) };
  }
  function clearUser() {
    store.user = null;
  }
  function addBreadcrumb(message, { type = BreadcrumbType.User, level = BreadcrumbLevel.Info, category, data } = {}) {
    const bc = { type, level, message, category, data, timestamp: Date.now() };
    store.breadcrumbs = [...store.breadcrumbs, bc].slice(-MAX_BREADCRUMBS);
    return bc;
  }
  function getBreadcrumbs() {
    return [...store.breadcrumbs];
  }
  function parseFrames(stack) {
    if (!stack) return [];
    return String(stack).split("\n").map((raw) => {
      const line = raw.trim();
      let m = line.match(/^at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/);
      if (!m) m = line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
      if (!m) return null;
      const fn = m[1] && m[1].length ? m[1] : "<anonymous>";
      const filename = m[2];
      return { function: fn, filename, lineno: Number(m[3]), colno: Number(m[4]), inApp: !filename.includes("node_modules") };
    }).filter(Boolean);
  }
  function baseEnvelope(errorType, errorCategory, errorLevel, extraTags) {
    var _a, _b, _c;
    const cfg = getConfig();
    const payload = {
      game: cfg.gameId,
      errorType,
      errorCategory,
      errorLevel,
      device: getDeviceContext(),
      appVersion: cfg.appVersion,
      buildNumber: cfg.buildNumber,
      sessionId: getSessionId(),
      timestamp: unixSeconds(),
      breadcrumbs: getBreadcrumbs(),
      tags: { ...(_b = (_a = store.user) == null ? void 0 : _a.tags) != null ? _b : {}, ...stringTags(extraTags) }
    };
    const net = getNetworkContext();
    if (net) payload.network = net;
    const gsv = getGameState();
    if (Object.keys(gsv).length) payload.gameState = gsv;
    if ((_c = store.user) == null ? void 0 : _c.userId) payload.userId = store.user.userId;
    return payload;
  }
  function captureException(error, { level = ErrorLevel.Error, tags = {}, category = "handled" } = {}) {
    if (!ensure2()) return void 0;
    try {
      const e = error instanceof Error ? error : new Error(String(error));
      const payload = { ...baseEnvelope("exception", category, level, tags), message: String(e.message).slice(0, 5e3), exceptionClass: e.name || "Error", frames: parseFrames(e.stack), rawStackTrace: e.stack ? String(e.stack).slice(0, 5e4) : void 0 };
      return postError({ type: "error", payload });
    } catch {
      return false;
    }
  }
  function captureMessage(message, { level = ErrorLevel.Info, tags = {} } = {}) {
    if (!ensure2()) return void 0;
    try {
      return postError({ type: "error", payload: { ...baseEnvelope("custom", "handled", level, tags), message: String(message).slice(0, 5e3) } });
    } catch {
      return false;
    }
  }
  function captureNetworkError(url, { method = "GET", statusCode, errorMessage, durationMs, tags = {} } = {}) {
    if (!ensure2()) return void 0;
    try {
      addBreadcrumb(`${method} ${url} -> ${statusCode != null ? statusCode : "failed"}`, { type: BreadcrumbType.Network, level: BreadcrumbLevel.Error });
      const payload = { ...baseEnvelope("network", "handled", ErrorLevel.Error, tags), message: String(errorMessage != null ? errorMessage : `${method} ${url} failed`).slice(0, 5e3), networkRequest: { url: String(url).slice(0, 2e3), method, statusCode, durationMs } };
      return postError({ type: "error", payload });
    } catch {
      return false;
    }
  }
  function flush2() {
    return Promise.resolve(true);
  }
  function _captureUnhandled(error) {
    return captureException(error, { category: "unhandled", level: ErrorLevel.Error });
  }

  // skills/moonforge-implement/assets/moonforge-sdk/index.js
  var sessionStartedAt = 0;
  var autoInstalled = false;
  var NETWORK_ERROR_STATUS_THRESHOLD = 400;
  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.href === "string") return input.href;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }
  function beginSpan() {
    if (globalThis.__mfSessionActive) return;
    globalThis.__mfSessionActive = true;
    sessionStartedAt = Date.now();
    trackEvent("session_start", { session_id: getSessionId() });
  }
  function endSpan() {
    if (!globalThis.__mfSessionActive) return;
    globalThis.__mfSessionActive = false;
    const duration_seconds = Math.round((Date.now() - sessionStartedAt) / 1e3);
    trackEvent("session_end", { session_id: getSessionId(), duration_seconds }, { beacon: true });
  }
  var sessionListenersInstalled = false;
  function startSession() {
    beginSpan();
    if (sessionListenersInstalled || typeof globalThis.addEventListener !== "function") return;
    sessionListenersInstalled = true;
    globalThis.addEventListener("pagehide", endSpan);
    globalThis.addEventListener("visibilitychange", () => {
      var _a;
      const vis = (_a = globalThis.document) == null ? void 0 : _a.visibilityState;
      if (vis === "hidden") endSpan();
      else if (vis === "visible") beginSpan();
    });
  }
  function installAutoCapture() {
    if (autoInstalled || typeof globalThis.addEventListener !== "function") return;
    autoInstalled = true;
    globalThis.addEventListener("error", (e) => {
      if (e == null ? void 0 : e.error) _captureUnhandled(e.error);
      else if (e == null ? void 0 : e.message) captureMessage(e.message, { level: ErrorLevel.Error });
    });
    globalThis.addEventListener("unhandledrejection", (e) => {
      const r = e == null ? void 0 : e.reason;
      _captureUnhandled(r instanceof Error ? r : new Error(String(r)));
    });
  }
  function installFetchInterceptor(threshold = NETWORK_ERROR_STATUS_THRESHOLD) {
    if (typeof globalThis.fetch !== "function" || globalThis.__mfFetchWrapped) return;
    globalThis.__mfFetchWrapped = true;
    const orig = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (...args) => {
      var _a, _b, _c, _d;
      const start = Date.now();
      const url = requestUrl(args[0]);
      const method = ((_d = (_c = (_a = args[1]) == null ? void 0 : _a.method) != null ? _c : typeof args[0] !== "string" ? (_b = args[0]) == null ? void 0 : _b.method : void 0) != null ? _d : "GET").toUpperCase();
      const cfg = getConfig();
      if (!url || cfg && url.startsWith(cfg.apiEndpoint)) return orig(...args);
      try {
        const res = await orig(...args);
        if (res.status >= threshold) captureNetworkError(url, { method, statusCode: res.status, durationMs: Date.now() - start });
        return res;
      } catch (e) {
        captureNetworkError(url, { method, errorMessage: String(e), durationMs: Date.now() - start });
        throw e;
      }
    };
  }
  function init2(options = {}) {
    const cfg = init(options);
    if (!cfg) return void 0;
    installAutoCapture();
    if (cfg.autoTrackSession) startSession();
    if (cfg.trackNetworkErrors) installFetchInterceptor();
    return cfg;
  }
  var MoonForgeAnalytics = {
    init: init2,
    trackEvent,
    trackScreenView,
    identify,
    setUserProperty,
    removeUserProperty,
    clearUserProperties,
    getDistinctId,
    getSessionId,
    reset,
    flush
  };
  var MoonForgeErrorTracker = {
    setUser,
    clearUser,
    setGameState,
    setGameStateData,
    getGameState,
    clearGameState,
    addBreadcrumb,
    getBreadcrumbs,
    captureException,
    captureMessage,
    captureNetworkError,
    flush: flush2
  };
  var ErrorLevel2 = ErrorLevel;
  var BreadcrumbType2 = BreadcrumbType;
  var BreadcrumbLevel2 = BreadcrumbLevel;
  if (typeof globalThis !== "undefined") {
    globalThis.MoonForgeAnalytics = MoonForgeAnalytics;
    globalThis.MoonForgeErrorTracker = MoonForgeErrorTracker;
  }
})();
