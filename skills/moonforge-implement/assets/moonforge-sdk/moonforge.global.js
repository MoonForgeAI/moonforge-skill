/* MoonForge Web SDK — generated global bundle. Do not edit by hand. Regenerate with: npm run build:sdk */
(() => {
  // skills/moonforge-implement/assets/moonforge-sdk/core.js
  var DISTINCT_ID_KEY = "mf_distinct_id";
  var SESSION_ID_KEY = "mf_session_id";
  var SESSION_TS_KEY = "mf_session_ts";
  var ALIASED_KEY = "mf_aliased";
  var LAST_VERSION_KEY = "mf_last_version";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1e3;
  var DEFAULT_ENDPOINT = "https://collector.moonforge.co";
  var DEFAULT_NETWORK_ERROR_MIN_STATUS = 500;
  var DEFAULT_MAX_ERROR_REPORTS_PER_SESSION = 100;
  var MAX_ERROR_REPORTS_PER_SESSION_LIMIT = 1e3;
  var ErrorLevel = Object.freeze({ Info: "info", Warning: "warning", Error: "error", Fatal: "fatal" });
  var BreadcrumbType = Object.freeze({ Navigation: "navigation", Network: "network", User: "user", Debug: "debug", Error: "error" });
  var BreadcrumbLevel = Object.freeze({ Debug: "debug", Info: "info", Warning: "warning", Error: "error", Fatal: "fatal" });
  var state = { config: null, cacheToken: null, userProps: {} };
  function newUuid() {
    return uuid();
  }
  function uuid() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      return (ch === "x" ? r : r & 3 | 8).toString(16);
    });
  }
  var memoryStore = /* @__PURE__ */ new Map();
  function lget(k) {
    var _a, _b, _c;
    let v = null;
    try {
      v = (_b = (_a = globalThis.localStorage) == null ? void 0 : _a.getItem(k)) != null ? _b : null;
    } catch {
      v = null;
    }
    return (_c = v != null ? v : memoryStore.get(k)) != null ? _c : null;
  }
  function lset(k, v) {
    try {
      if (!globalThis.localStorage) throw new Error("localStorage unavailable");
      globalThis.localStorage.setItem(k, v);
      memoryStore.delete(k);
    } catch {
      memoryStore.set(k, v);
    }
  }
  function readStored(key) {
    return lget(key);
  }
  function writeStored(key, value) {
    lset(key, value);
  }
  function unixSeconds() {
    return Math.floor(Date.now() / 1e3);
  }
  function validOption(options, name, isValid, fallback) {
    const value = options[name];
    if (value === void 0) return fallback;
    if (isValid(value)) return value;
    console.warn(`[MoonForge] init: invalid ${name} (${String(value)}); using ${fallback}.`);
    return fallback;
  }
  var isStatusFloor = (v) => Number.isInteger(v) && v >= 100 && v <= 600;
  var isNonNegativeInt = (v) => Number.isInteger(v) && v >= 0;
  function reportBudget(options) {
    const value = validOption(options, "maxErrorReportsPerSession", isNonNegativeInt, DEFAULT_MAX_ERROR_REPORTS_PER_SESSION);
    if (value <= MAX_ERROR_REPORTS_PER_SESSION_LIMIT) return value;
    console.warn(`[MoonForge] init: maxErrorReportsPerSession ${value} exceeds ${MAX_ERROR_REPORTS_PER_SESSION_LIMIT}; using ${MAX_ERROR_REPORTS_PER_SESSION_LIMIT}.`);
    return MAX_ERROR_REPORTS_PER_SESSION_LIMIT;
  }
  function init(options = {}) {
    var _a, _b, _c, _d, _e;
    if (!options.gameId) {
      console.warn("[MoonForge] init: gameId is required; SDK disabled.");
      state.config = null;
      return void 0;
    }
    if (!options.appVersion) {
      console.warn("[MoonForge] init: appVersion not provided \u2014 appVersion will be missing from every event.");
    }
    state.config = {
      gameId: options.gameId,
      apiEndpoint: ((_a = options.apiEndpoint) != null ? _a : DEFAULT_ENDPOINT).replace(/\/+$/, ""),
      debug: (_b = options.debug) != null ? _b : false,
      autoTrackSession: (_c = options.autoTrackSession) != null ? _c : true,
      trackNetworkErrors: (_d = options.trackNetworkErrors) != null ? _d : false,
      // No fallback default: a fabricated "1.0.0" would be indistinguishable
      // from a real one in the dashboard. Omitted from the JSON body entirely
      // when not supplied, rather than lying with a placeholder.
      appVersion: options.appVersion,
      buildNumber: (_e = options.buildNumber) != null ? _e : "1",
      // Lowest HTTP status the fetch interceptor reports (600 = never report a
      // response; thrown fetches are still reported).
      networkErrorMinStatus: validOption(options, "networkErrorMinStatus", isStatusFloor, DEFAULT_NETWORK_ERROR_MIN_STATUS),
      // Distinct error reports sent per session; past it only counts are kept.
      maxErrorReportsPerSession: reportBudget(options)
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
  function isFirstOpen() {
    return lget(DISTINCT_ID_KEY) === null;
  }
  function checkAppUpdate() {
    var _a;
    const current = (_a = state.config) == null ? void 0 : _a.appVersion;
    if (!current) return void 0;
    const previous = lget(LAST_VERSION_KEY);
    lset(LAST_VERSION_KEY, current);
    return previous && previous !== current ? previous : void 0;
  }
  function hasAliased() {
    return lget(ALIASED_KEY) === "1";
  }
  function markAliased() {
    lset(ALIASED_KEY, "1");
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
  function prepareSessionStart() {
    var _a;
    const now = Date.now();
    const last = parseInt((_a = lget(SESSION_TS_KEY)) != null ? _a : "0", 10);
    let id = lget(SESSION_ID_KEY);
    let previous_session_id;
    if (!id || !last) {
      id = uuid();
    } else if (now - last > SESSION_TIMEOUT_MS) {
      previous_session_id = id;
      id = uuid();
    }
    lset(SESSION_ID_KEY, id);
    lset(SESSION_TS_KEY, String(now));
    const data = { session_id: id };
    if (previous_session_id) data.previous_session_id = previous_session_id;
    return data;
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
    lset(ALIASED_KEY, "");
  }
  function collectAutoFields() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    const loc = (_a = globalThis.location) != null ? _a : {};
    const doc = (_b = globalThis.document) != null ? _b : {};
    const nav = (_c = globalThis.navigator) != null ? _c : {};
    const scr = (_d = globalThis.screen) != null ? _d : {};
    return {
      game: (_e = state.config) == null ? void 0 : _e.gameId,
      id: getDistinctId(),
      // Query string included deliberately: the collector parses utm_*/click-ID
      // fields straight out of this url server-side (new URL(url) -> searchParams),
      // for every event - confirmed against its own ingestion source, not inferred.
      // Stripping it (as this used to) silently starved that whole pipeline.
      url: `${(_f = loc.pathname) != null ? _f : ""}${(_g = loc.search) != null ? _g : ""}${(_h = loc.hash) != null ? _h : ""}`,
      title: (_i = doc.title) != null ? _i : "",
      referrer: (_j = doc.referrer) != null ? _j : "",
      screen: scr.width && scr.height ? `${scr.width}x${scr.height}` : "",
      language: (_k = nav.language) != null ? _k : "",
      hostname: (_l = loc.hostname) != null ? _l : "",
      timestamp: unixSeconds(),
      appVersion: (_m = state.config) == null ? void 0 : _m.appVersion
    };
  }
  var IDENTIFY_GRACE_MS = 1e4;
  var MAX_BUFFERED_EVENTS = 50;
  var pendingEvents = [];
  var identified = false;
  var flushTimer = null;
  function sendBuffered() {
    const queued = pendingEvents;
    pendingEvents = [];
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const id = getDistinctId();
    for (const { payload, opts } of queued) {
      if (payload && payload.payload && typeof payload.payload === "object") {
        payload.payload.id = id;
      }
      void deliver(payload, opts);
    }
  }
  function markIdentified() {
    if (identified) return;
    identified = true;
    sendBuffered();
  }
  function resetBuffering() {
    pendingEvents = [];
    identified = false;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
  async function postEvent(payload, { beacon = false } = {}) {
    if (!state.config) return false;
    const bufferable = !identified && !beacon && payload && payload.type !== "identify" && payload.type !== "alias";
    if (bufferable) {
      if (pendingEvents.length < MAX_BUFFERED_EVENTS) {
        pendingEvents.push({ payload, opts: { beacon } });
      } else {
        debugLog("buffer full, sending anonymously", payload.type);
        return deliver(payload, { beacon });
      }
      if (!flushTimer && typeof setTimeout === "function") {
        flushTimer = setTimeout(() => {
          debugLog("identify grace expired, flushing anonymously");
          sendBuffered();
        }, IDENTIFY_GRACE_MS);
        if (flushTimer && typeof flushTimer.unref === "function") flushTimer.unref();
      }
      return true;
    }
    return deliver(payload, { beacon });
  }
  async function deliver(payload, { beacon = false } = {}) {
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
  async function readRetryAfterMs(res) {
    try {
      const d = await res.json();
      const ms = d == null ? void 0 : d.retryAfterMs;
      return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : void 0;
    } catch {
      return void 0;
    }
  }
  async function readRejection(res) {
    try {
      const d = await res.json();
      const paths = Array.isArray(d == null ? void 0 : d.details) ? d.details.map((x) => {
        var _a;
        return String((_a = x == null ? void 0 : x.path) != null ? _a : "");
      }) : [];
      return { error: typeof (d == null ? void 0 : d.error) === "string" ? d.error : void 0, paths };
    } catch {
      return { error: void 0, paths: [] };
    }
  }
  async function postErrorBatch(body, { keepalive = false } = {}) {
    if (!state.config) return { ok: false, status: 0 };
    try {
      const res = await fetch(`${state.config.apiEndpoint}/api/errors/batch`, {
        method: "POST",
        keepalive,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      debugLog("error batch", res.status);
      if (res.status === 429) return { ok: false, status: 429, retryAfterMs: await readRetryAfterMs(res) };
      if (res.status === 400) return { ok: false, status: 400, rejection: await readRejection(res) };
      return { ok: res.ok, status: res.status };
    } catch (e) {
      debugLog("error batch send failed", e);
      return { ok: false, status: 0 };
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
  function flatRow(data, prefix, rows) {
    rows.forEach((row, i) => {
      const n = i + 1;
      if (row.type != null) data[`${prefix}_${n}_type`] = row.type;
      if (row.before != null) data[`${prefix}_${n}_before`] = row.before;
      if (row.after != null) data[`${prefix}_${n}_after`] = row.after;
    });
  }
  function trackEvent(name, data = {}, opts = {}) {
    if (!ensure()) return void 0;
    return postEvent({ type: "event", payload: { ...collectAutoFields(), name, data: { ...getUserProps(), ...data } } }, opts);
  }
  function trackSessionStart(extra = {}) {
    if (!ensure()) return void 0;
    return trackEvent("session_start", { ...prepareSessionStart(), ...extra });
  }
  function trackFirstOpen() {
    if (!ensure()) return void 0;
    return trackEvent("first_open", {});
  }
  function trackAppUpdate(previousVersion) {
    if (!ensure()) return void 0;
    return trackEvent("app_update", { previous_version: previousVersion });
  }
  function trackScreenView(name) {
    if (!ensure()) return void 0;
    const auto = collectAutoFields();
    return postEvent({ type: "event", payload: { ...auto, name: "screen_view", title: name || auto.title, data: { ...getUserProps(), screen_name: name } } });
  }
  function trackEconomyTransaction({ reason, inputs = [], outputs = [] } = {}) {
    const data = { reason };
    flatRow(data, "input", inputs);
    flatRow(data, "output", outputs);
    return trackEvent("economy_transaction", data);
  }
  function trackIapInitiated({ product_id, price, currency, product_name, store: store2, ...rest } = {}) {
    const data = { product_id, price, currency, ...rest };
    if (product_name != null) data.product_name = product_name;
    if (store2 != null) data.store = store2;
    return trackEvent("iap_initiated", data);
  }
  function trackIapCompleted({ product_id, price, currency, transaction_id, product_name, store: store2, ...rest } = {}) {
    const data = { product_id, price, currency, transaction_id, ...rest };
    if (product_name != null) data.product_name = product_name;
    if (store2 != null) data.store = store2;
    return trackEvent("iap_completed", data);
  }
  function trackAdStarted({ ad_type, placement, provider, ...rest } = {}) {
    const data = { ad_type, placement, ...rest };
    if (provider != null) data.provider = provider;
    return trackEvent("ad_started", data);
  }
  function trackAdCompleted({ ad_type, placement, watched_fraction, provider, rewarded, duration_seconds, ...rest } = {}) {
    const data = { ad_type, placement, watched_fraction, ...rest };
    if (provider != null) data.provider = provider;
    if (rewarded != null) data.rewarded = rewarded;
    if (duration_seconds != null) data.duration_seconds = duration_seconds;
    return trackEvent("ad_completed", data);
  }
  function trackAdImpression({ ad_type, placement, provider, ...rest } = {}) {
    const data = { ad_type, placement, ...rest };
    if (provider != null) data.provider = provider;
    return trackEvent("ad_impression", data);
  }
  function trackTutorialStart(extra = {}) {
    return trackEvent("tutorial_start", { ...extra });
  }
  function trackTutorialComplete({ outcome, ...rest } = {}) {
    const data = { ...rest };
    if (outcome != null) data.outcome = outcome;
    return trackEvent("tutorial_complete", data);
  }
  function trackAccountCreated({ signup_method, provider, ...rest } = {}) {
    const data = { signup_method, ...rest };
    if (provider != null) data.provider = provider;
    return trackEvent("account_created", data);
  }
  function identify(userId, traits = {}) {
    if (!ensure()) return void 0;
    const previousId = getDistinctId();
    if (userId && userId !== previousId && !hasAliased()) {
      postEvent({ type: "alias", payload: { game: getConfig().gameId, id: userId, previous_id: previousId, timestamp: unixSeconds() } });
      markAliased();
    }
    if (userId) setDistinctId(userId);
    markIdentified();
    return postEvent({ type: "identify", payload: { game: getConfig().gameId, id: userId != null ? userId : getDistinctId(), data: traits, timestamp: unixSeconds(), appVersion: getConfig().appVersion } });
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

  // skills/moonforge-implement/assets/moonforge-sdk/error-fingerprint.js
  var MAX_KEY_PART = 300;
  function part(value) {
    return String(value != null ? value : "").slice(0, MAX_KEY_PART);
  }
  function urlPath(url) {
    var _a;
    if (url === void 0 || url === null) return "";
    const raw = String(url);
    try {
      const base = ((_a = globalThis.location) == null ? void 0 : _a.href) || "http://localhost/";
      const u = new URL(raw, base);
      return `${u.origin}${u.pathname}`;
    } catch {
      return raw.split(/[?#]/)[0];
    }
  }
  function exceptionFingerprint(exceptionClass, message, frames) {
    var _a, _b, _c, _d;
    const top = Array.isArray(frames) && frames.length ? frames[0] : null;
    const where = top ? `${(_a = top.function) != null ? _a : ""}@${(_b = top.filename) != null ? _b : ""}:${(_c = top.lineno) != null ? _c : ""}:${(_d = top.colno) != null ? _d : ""}` : "";
    return `exception|${part(exceptionClass)}|${part(message)}|${part(where)}`;
  }
  function messageFingerprint(level, message) {
    return `message|${part(level)}|${part(message)}`;
  }
  function networkFingerprint(method, url, statusCode) {
    return `network|${part(String(method != null ? method : "GET").toUpperCase())}|${part(urlPath(url))}|${statusCode != null ? statusCode : "failed"}`;
  }

  // skills/moonforge-implement/assets/moonforge-sdk/error-payload.js
  var LIMITS = Object.freeze({
    message: 5e3,
    rawStackTrace: 5e4,
    exceptionClass: 500,
    fingerprint: 64,
    frames: 200,
    frameText: 500,
    framePackage: 200,
    frameAddress: 50,
    breadcrumbs: 100,
    breadcrumbMessage: 1e3,
    breadcrumbCategory: 100,
    tagValue: 200,
    appVersion: 50,
    buildNumber: 50,
    unityVersion: 50,
    userId: 255,
    osVersion: 50,
    deviceModel: 100,
    manufacturer: 100,
    cpuArchitecture: 50,
    networkCarrier: 100,
    networkEffectiveType: 50,
    sceneName: 100,
    gameMode: 50,
    levelId: 100,
    networkUrl: 2e3,
    networkMethod: 10
  });
  var OCCURRENCES_TAG = "mf_occurrences";
  var REPEAT_TAG = "mf_repeat";
  var ERROR_TYPES = /* @__PURE__ */ new Set(["crash", "exception", "network", "custom"]);
  var ERROR_CATEGORIES = /* @__PURE__ */ new Set(["native", "managed", "handled", "unhandled"]);
  var ERROR_LEVELS = /* @__PURE__ */ new Set(["fatal", "error", "warning", "info"]);
  var BREADCRUMB_TYPES = /* @__PURE__ */ new Set(["navigation", "network", "user", "debug", "error"]);
  var BREADCRUMB_LEVELS = /* @__PURE__ */ new Set(["debug", "info", "warning", "error", "fatal"]);
  var NETWORK_TYPES = /* @__PURE__ */ new Set(["wifi", "cellular", "ethernet", "none"]);
  function oneOf(value, allowed, fallback) {
    return allowed.has(value) ? value : fallback;
  }
  function isRecord(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function str(value, max) {
    return value === void 0 || value === null ? void 0 : String(value).slice(0, max);
  }
  function uint(value) {
    return Number.isInteger(value) && value >= 0 ? value : void 0;
  }
  function int(value) {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return Number.isInteger(n) ? n : void 0;
  }
  function nonNegative(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
  }
  function compact(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
  }
  function frame(f) {
    return compact({
      module: str(f.module, LIMITS.frameText),
      function: str(f.function, LIMITS.frameText),
      filename: str(f.filename, LIMITS.frameText),
      lineno: uint(f.lineno),
      colno: uint(f.colno),
      instructionAddress: str(f.instructionAddress, LIMITS.frameAddress),
      symbolAddress: str(f.symbolAddress, LIMITS.frameAddress),
      inApp: typeof f.inApp === "boolean" ? f.inApp : void 0,
      package: str(f.package, LIMITS.framePackage)
    });
  }
  function breadcrumb(b) {
    return compact({
      type: oneOf(b.type, BREADCRUMB_TYPES, "user"),
      level: oneOf(b.level, BREADCRUMB_LEVELS, "info"),
      message: str(b.message, LIMITS.breadcrumbMessage),
      category: str(b.category, LIMITS.breadcrumbCategory),
      data: isRecord(b.data) ? b.data : void 0,
      timestamp: Math.floor(Number(b.timestamp) || 0)
    });
  }
  function tags(t) {
    return Object.fromEntries(Object.entries(t != null ? t : {}).map(([k, v]) => [k, String(v).slice(0, LIMITS.tagValue)]));
  }
  function device(d) {
    var _a, _b;
    return compact({
      ...d,
      osVersion: (_a = str(d.osVersion, LIMITS.osVersion)) != null ? _a : "unknown",
      deviceModel: (_b = str(d.deviceModel, LIMITS.deviceModel)) != null ? _b : "unknown",
      manufacturer: str(d.manufacturer, LIMITS.manufacturer),
      cpuArchitecture: str(d.cpuArchitecture, LIMITS.cpuArchitecture)
    });
  }
  function network(n) {
    return compact({
      type: NETWORK_TYPES.has(n.type) ? n.type : void 0,
      carrier: str(n.carrier, LIMITS.networkCarrier),
      effectiveType: str(n.effectiveType, LIMITS.networkEffectiveType)
    });
  }
  function gameState(g) {
    return compact({
      sceneName: str(g.sceneName, LIMITS.sceneName),
      gameMode: str(g.gameMode, LIMITS.gameMode),
      levelId: str(g.levelId, LIMITS.levelId),
      customData: isRecord(g.customData) ? g.customData : void 0
    });
  }
  function networkRequest(n) {
    var _a, _b;
    return compact({
      ...n,
      url: (_a = str(n.url, LIMITS.networkUrl)) != null ? _a : "",
      method: (_b = str(n.method, LIMITS.networkMethod)) != null ? _b : "GET",
      statusCode: int(n.statusCode),
      durationMs: nonNegative(n.durationMs)
    });
  }
  function clipPayload(p) {
    var _a;
    return compact({
      ...p,
      errorType: oneOf(p.errorType, ERROR_TYPES, "custom"),
      errorCategory: oneOf(p.errorCategory, ERROR_CATEGORIES, "handled"),
      errorLevel: oneOf(p.errorLevel, ERROR_LEVELS, "error"),
      message: (_a = str(p.message, LIMITS.message)) != null ? _a : "",
      rawStackTrace: str(p.rawStackTrace, LIMITS.rawStackTrace),
      exceptionClass: str(p.exceptionClass, LIMITS.exceptionClass),
      fingerprint: str(p.fingerprint, LIMITS.fingerprint),
      frames: Array.isArray(p.frames) ? p.frames.slice(0, LIMITS.frames).map(frame) : void 0,
      breadcrumbs: Array.isArray(p.breadcrumbs) ? p.breadcrumbs.slice(-LIMITS.breadcrumbs).map(breadcrumb) : void 0,
      tags: p.tags ? tags(p.tags) : void 0,
      appVersion: str(p.appVersion, LIMITS.appVersion),
      buildNumber: str(p.buildNumber, LIMITS.buildNumber),
      unityVersion: str(p.unityVersion, LIMITS.unityVersion),
      userId: str(p.userId, LIMITS.userId),
      device: p.device ? device(p.device) : void 0,
      gameState: p.gameState ? gameState(p.gameState) : void 0,
      network: p.network ? network(p.network) : void 0,
      networkRequest: p.networkRequest ? networkRequest(p.networkRequest) : void 0,
      timestamp: typeof p.timestamp === "number" && Number.isFinite(p.timestamp) ? Math.floor(p.timestamp) : void 0
    });
  }
  function toBatchItem(entry) {
    var _a;
    const { game: _game, ...rest } = clipPayload(entry.payload);
    const countTags = { [OCCURRENCES_TAG]: String(entry.count), ...entry.repeat ? { [REPEAT_TAG]: "true" } : {} };
    return { ...rest, clientErrorId: entry.id, tags: { ...(_a = rest.tags) != null ? _a : {}, ...countTags } };
  }
  function slimItem(item) {
    const { rawStackTrace: _raw, breadcrumbs: _crumbs, ...rest } = item;
    return { ...rest, frames: Array.isArray(rest.frames) ? rest.frames.slice(0, 20) : void 0 };
  }

  // skills/moonforge-implement/assets/moonforge-sdk/error-batch.js
  var MAX_BATCH = 20;
  var MAX_BATCH_BYTES = 256e3;
  var KEEPALIVE_BUDGET_BYTES = 6e4;
  var ENVELOPE_OVERHEAD_BYTES = 200;
  function jsonBytes(value) {
    const s = JSON.stringify(value);
    return typeof TextEncoder === "function" ? new TextEncoder().encode(s).length : s.length;
  }
  function sized(entry) {
    try {
      const item = toBatchItem(entry);
      return { item, size: jsonBytes(item) };
    } catch (e) {
      debugLog("unsendable error report dropped", e);
      return null;
    }
  }
  function fit(built, limit) {
    if (!built) return null;
    if (built.size <= limit) return built;
    const item = slimItem(built.item);
    const size = jsonBytes(item);
    return size <= limit ? { item, size } : null;
  }
  function planBatch(queue2, { keepalive, budget }) {
    var _a;
    const ceiling = keepalive ? KEEPALIVE_BUDGET_BYTES : MAX_BATCH_BYTES;
    const allowance = Math.min(budget != null ? budget : ceiling, ceiling);
    const plan = { game: void 0, entries: [], items: [], bytes: ENVELOPE_OVERHEAD_BYTES, consumed: 0, unsendable: [] };
    for (const entry of queue2) {
      const game = (_a = entry.payload) == null ? void 0 : _a.game;
      if (plan.entries.length && (plan.entries.length >= MAX_BATCH || game !== plan.game || entry.solo || plan.entries[0].solo)) break;
      const fitted = fit(sized(entry), ceiling - ENVELOPE_OVERHEAD_BYTES);
      if (!fitted) {
        plan.unsendable.push(entry);
        plan.consumed += 1;
        continue;
      }
      if (plan.bytes + fitted.size > allowance) break;
      plan.game = game;
      plan.entries.push(entry);
      plan.items.push(fitted.item);
      plan.bytes += fitted.size + 1;
      plan.consumed += 1;
    }
    return plan;
  }

  // skills/moonforge-implement/assets/moonforge-sdk/error-queue.js
  var FLUSH_INTERVAL_MS = 5e3;
  var FLUSH_AT = 20;
  var MAX_QUEUE = 200;
  var REPEAT_REPORT_INTERVAL_MS = 6e4;
  var MAX_TRACKED_FINGERPRINTS = 1e3;
  var DEFAULT_RETRY_AFTER_MS = 6e4;
  var MAX_SEND_ATTEMPTS = 6;
  var MIN_PAUSE_MS = 1e3;
  var MAX_PAUSE_MS = 60 * 60 * 1e3;
  var BASE_BACKOFF_MS = 5e3;
  var MAX_BACKOFF_MS = 5 * 60 * 1e3;
  var EMPTY_STATS = Object.freeze({ sent: 0, dropped: 0, suppressed: 0, rejected: 0 });
  var REPORT_COUNT_KEY = "mf_error_reports";
  function loadReportCount(sessionId) {
    var _a;
    try {
      const saved = JSON.parse((_a = readStored(REPORT_COUNT_KEY)) != null ? _a : "null");
      return saved && saved.sessionId === sessionId && Number.isInteger(saved.count) && saved.count >= 0 ? saved.count : 0;
    } catch {
      return 0;
    }
  }
  function freshSession(id) {
    return { id, records: /* @__PURE__ */ new Map(), distinctReported: id === null ? 0 : loadReportCount(id) };
  }
  function setDistinctReported(count) {
    session = { ...session, distinctReported: count };
    if (session.id !== null) writeStored(REPORT_COUNT_KEY, JSON.stringify({ sessionId: session.id, count }));
  }
  var session = freshSession(null);
  var queue = [];
  var stats = EMPTY_STATS;
  var rateLimitedUntil = 0;
  var backoffUntil = 0;
  var failureStreak = 0;
  var timer = null;
  var inFlight = null;
  var lifecycle = null;
  function bump(key, n = 1) {
    stats = { ...stats, [key]: stats[key] + n };
  }
  function pausedUntil() {
    return Math.max(rateLimitedUntil, backoffUntil);
  }
  function isPaused() {
    return Date.now() < pausedUntil();
  }
  function isRateLimited() {
    return Date.now() < rateLimitedUntil;
  }
  function reportCap() {
    var _a, _b;
    return (_b = (_a = getConfig()) == null ? void 0 : _a.maxErrorReportsPerSession) != null ? _b : DEFAULT_MAX_ERROR_REPORTS_PER_SESSION;
  }
  function newEntry(fingerprint, payload, count, repeat) {
    return { id: newUuid(), fingerprint, payload, count, repeat, attempts: 0 };
  }
  function discard(entries) {
    if (!entries.length) return;
    bump("dropped", entries.length);
    for (const e of entries) {
      const rec = session.records.get(e.fingerprint);
      if (!e.repeat && rec && rec.queuedId === e.id) {
        session.records.delete(e.fingerprint);
        setDistinctReported(Math.max(0, session.distinctReported - 1));
      }
    }
  }
  function bounded(list) {
    const overflow = list.length - MAX_QUEUE;
    if (overflow <= 0) return list;
    discard(list.slice(0, overflow));
    return list.slice(overflow);
  }
  function scheduleFlush(delayMs) {
    if (timer || typeof setTimeout !== "function") return;
    const wait = Math.max(delayMs, pausedUntil() - Date.now());
    timer = setTimeout(() => {
      timer = null;
      void flushErrors();
    }, wait);
    if (timer && typeof timer.unref === "function") timer.unref();
  }
  function enqueue(entry) {
    queue = bounded([...queue, entry]);
    if (queue.length >= FLUSH_AT && !isPaused() && !inFlight) void flushErrors();
    else scheduleFlush(FLUSH_INTERVAL_MS);
  }
  function incrementQueued(entryId) {
    if (!queue.some((e) => e.id === entryId)) return false;
    queue = queue.map((e) => e.id === entryId ? { ...e, count: e.count + 1 } : e);
    return true;
  }
  function promoteRepeats(now, force) {
    for (const [fp, rec] of session.records) {
      if (rec.pending > 0 && rec.lastPayload && (force || now - rec.lastReportAt >= REPEAT_REPORT_INTERVAL_MS)) {
        const entry = newEntry(fp, rec.lastPayload, rec.pending, true);
        session.records.set(fp, { ...rec, pending: 0, lastPayload: null, queuedId: entry.id, lastReportAt: now });
        queue = bounded([...queue, entry]);
      }
    }
  }
  function hasPendingRepeats() {
    for (const rec of session.records.values()) if (rec.pending > 0) return true;
    return false;
  }
  function rollSession(sessionId) {
    if (session.id === sessionId) return;
    if (session.id !== null) promoteRepeats(Date.now(), true);
    session = freshSession(sessionId);
  }
  function recordFirst(fp, payload) {
    const now = Date.now();
    if (session.records.size >= MAX_TRACKED_FINGERPRINTS) {
      bump("suppressed");
      return false;
    }
    if (session.distinctReported >= reportCap()) {
      session.records.set(fp, { reported: false, queuedId: null, pending: 0, lastPayload: null, lastReportAt: now });
      bump("suppressed");
      return false;
    }
    const entry = newEntry(fp, payload, 1, false);
    setDistinctReported(session.distinctReported + 1);
    session.records.set(fp, { reported: true, queuedId: entry.id, pending: 0, lastPayload: null, lastReportAt: now });
    enqueue(entry);
    return true;
  }
  function recordRepeat(fp, rec, payload) {
    if (!rec.reported) {
      bump("suppressed");
      return false;
    }
    if (rec.queuedId && incrementQueued(rec.queuedId)) return true;
    const { breadcrumbs: _crumbs, rawStackTrace: _raw, ...countPayload } = payload;
    session.records.set(fp, { ...rec, queuedId: null, pending: rec.pending + 1, lastPayload: countPayload });
    scheduleFlush(FLUSH_INTERVAL_MS);
    return true;
  }
  function recordError(fingerprint, payload) {
    var _a;
    try {
      rollSession((_a = payload == null ? void 0 : payload.sessionId) != null ? _a : null);
      const rec = session.records.get(fingerprint);
      return rec ? recordRepeat(fingerprint, rec, payload) : recordFirst(fingerprint, payload);
    } catch (e) {
      debugLog("error queue failure", e);
      return false;
    }
  }
  function takeBatch(keepalive, budget) {
    const plan = planBatch(queue, { keepalive, budget });
    queue = queue.slice(plan.consumed);
    discard(plan.unsendable);
    return plan;
  }
  function pauseFor(ms, rateLimited) {
    const until = Date.now() + Math.min(Math.max(ms, MIN_PAUSE_MS), MAX_PAUSE_MS);
    if (rateLimited) rateLimitedUntil = Math.max(rateLimitedUntil, until);
    else backoffUntil = Math.max(backoffUntil, until);
    debugLog("error sending paused until", until, rateLimited ? "(429)" : "(backoff)");
  }
  function requeue(entries, { countAttempt = false, solo = false } = {}) {
    const updated = entries.map((e) => ({ ...e, attempts: e.attempts + (countAttempt ? 1 : 0), solo: e.solo || solo }));
    discard(updated.filter((e) => e.attempts >= MAX_SEND_ATTEMPTS));
    queue = bounded([...updated.filter((e) => e.attempts < MAX_SEND_ATTEMPTS), ...queue]);
  }
  function isRetryable(status) {
    return status === 0 || status === 408 || status === 425 || status >= 500;
  }
  function rejectedIndices(rejection, count) {
    var _a;
    const paths = (_a = rejection == null ? void 0 : rejection.paths) != null ? _a : [];
    if (!paths.length) return null;
    const indices = /* @__PURE__ */ new Set();
    for (const path of paths) {
      const m = /^errors\.(\d+)(\.|$)/.exec(path);
      if (!m || Number(m[1]) >= count) return null;
      indices.add(Number(m[1]));
    }
    return indices;
  }
  function handleRejection(entries, rejection) {
    const bad = rejectedIndices(rejection, entries.length);
    const survivors = bad ? entries.filter((_e, i) => !bad.has(i)) : [];
    bump("rejected", entries.length - survivors.length);
    debugLog("error batch rejected (400)", rejection == null ? void 0 : rejection.error, rejection == null ? void 0 : rejection.paths);
    if (survivors.length) requeue(survivors, { countAttempt: true });
    return "rejected";
  }
  async function sendBatch(plan, teardown) {
    var _a;
    const { entries, items } = plan;
    const res = await postErrorBatch({ type: "error_batch", game: plan.game, errors: items }, { keepalive: teardown });
    if (res.ok) {
      failureStreak = 0;
      bump("sent", items.length);
      return "sent";
    }
    if (res.status === 429) {
      pauseFor((_a = res.retryAfterMs) != null ? _a : DEFAULT_RETRY_AFTER_MS, true);
      requeue(entries);
      return "paused";
    }
    if (isRetryable(res.status)) {
      failureStreak += 1;
      pauseFor(Math.min(BASE_BACKOFF_MS * 2 ** (failureStreak - 1), MAX_BACKOFF_MS), false);
      requeue(entries, { countAttempt: true });
      return "failed";
    }
    if (res.status === 400) return handleRejection(entries, res.rejection);
    if (res.status === 413 && entries.length > 1) {
      requeue(entries, { solo: true });
      return "split";
    }
    bump("rejected", items.length);
    debugLog("error batch rejected", res.status);
    return "rejected";
  }
  async function sendBatches(maxBatches) {
    for (let i = 0; i < maxBatches && queue.length && !isPaused(); i++) {
      const plan = takeBatch(false);
      if (!plan.items.length) continue;
      const outcome = await sendBatch(plan, false);
      if (outcome === "paused" || outcome === "failed") return false;
    }
    return queue.length === 0;
  }
  async function sendForTeardown() {
    if (isRateLimited()) return false;
    const plans = [];
    let remaining = KEEPALIVE_BUDGET_BYTES;
    while (queue.length) {
      const plan = takeBatch(true, remaining);
      if (!plan.items.length) {
        if (!plan.consumed) break;
        continue;
      }
      plans.push(plan);
      remaining -= plan.bytes;
    }
    const outcomes = await Promise.all(plans.map((p) => sendBatch(p, true)));
    return queue.length === 0 && outcomes.every((o) => o === "sent" || o === "rejected");
  }
  function afterFlush() {
    if (queue.length || hasPendingRepeats()) scheduleFlush(FLUSH_INTERVAL_MS);
  }
  async function flushErrors({ keepalive = false, drain = false } = {}) {
    try {
      if (!getConfig()) return false;
      promoteRepeats(Date.now(), keepalive || drain);
      if (keepalive) return await sendForTeardown();
      while (inFlight) await inFlight;
      inFlight = sendBatches(drain ? Infinity : 1);
      try {
        return await inFlight;
      } finally {
        inFlight = null;
        afterFlush();
      }
    } catch (e) {
      debugLog("error flush failed", e);
      return false;
    }
  }
  function installErrorQueueLifecycle() {
    if (lifecycle || typeof globalThis.addEventListener !== "function") return;
    const onPageHide = () => {
      void flushErrors({ keepalive: true });
    };
    const onVisibility = () => {
      var _a;
      if (((_a = globalThis.document) == null ? void 0 : _a.visibilityState) === "hidden") onPageHide();
    };
    globalThis.addEventListener("pagehide", onPageHide);
    globalThis.addEventListener("visibilitychange", onVisibility);
    lifecycle = { onPageHide, onVisibility };
  }
  function getErrorQueueStats() {
    return { ...stats, queued: queue.length, distinctReported: session.distinctReported, paused: isPaused(), pausedUntil: pausedUntil() };
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
  function stringTags(tags2) {
    const out = {};
    for (const [k, v] of Object.entries(tags2 != null ? tags2 : {})) out[k] = String(v);
    return out;
  }
  function setUser(userId, tags2 = {}) {
    store.user = { userId, tags: stringTags(tags2) };
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
  function submit(build) {
    try {
      const { fingerprint, payload } = build();
      return Promise.resolve(recordError(fingerprint, payload));
    } catch {
      return Promise.resolve(false);
    }
  }
  function captureException(error, { level = ErrorLevel.Error, tags: tags2 = {}, category = "handled" } = {}) {
    if (!ensure2()) return void 0;
    return submit(() => {
      const e = error instanceof Error ? error : new Error(String(error));
      const message = String(e.message).slice(0, 5e3);
      const exceptionClass = e.name || "Error";
      const frames = parseFrames(e.stack);
      const payload = { ...baseEnvelope("exception", category, level, tags2), message, exceptionClass, frames, rawStackTrace: e.stack ? String(e.stack).slice(0, 5e4) : void 0 };
      return { fingerprint: exceptionFingerprint(exceptionClass, message, frames), payload };
    });
  }
  function captureMessage(message, { level = ErrorLevel.Info, tags: tags2 = {} } = {}) {
    if (!ensure2()) return void 0;
    return submit(() => {
      const text = String(message).slice(0, 5e3);
      return { fingerprint: messageFingerprint(level, text), payload: { ...baseEnvelope("custom", "handled", level, tags2), message: text } };
    });
  }
  function captureNetworkError(url, { method = "GET", statusCode, errorMessage, durationMs, tags: tags2 = {} } = {}) {
    if (!ensure2()) return void 0;
    return submit(() => {
      const safeUrl = urlPath(url);
      addBreadcrumb(`${method} ${safeUrl} -> ${statusCode != null ? statusCode : "failed"}`, { type: BreadcrumbType.Network, level: BreadcrumbLevel.Error });
      const payload = { ...baseEnvelope("network", "handled", ErrorLevel.Error, tags2), message: String(errorMessage != null ? errorMessage : `${method} ${safeUrl} failed`).slice(0, 5e3), networkRequest: { url: safeUrl.slice(0, 2e3), method, statusCode, durationMs } };
      return { fingerprint: networkFingerprint(method, url, statusCode), payload };
    });
  }
  function flush2() {
    return flushErrors({ drain: true });
  }
  function getStats() {
    return getErrorQueueStats();
  }
  function _captureUnhandled(error) {
    return captureException(error, { category: "unhandled", level: ErrorLevel.Error });
  }

  // skills/moonforge-implement/assets/moonforge-sdk/index.js
  var sessionStartedAt = 0;
  var autoInstalled = false;
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
    trackSessionStart();
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
  function isAbort(e) {
    return (e == null ? void 0 : e.name) === "AbortError";
  }
  function installFetchInterceptor() {
    if (typeof globalThis.fetch !== "function" || globalThis.__mfFetchWrapped) return;
    globalThis.__mfFetchWrapped = true;
    const orig = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (...args) => {
      var _a, _b, _c, _d, _e, _f;
      const start = Date.now();
      const url = requestUrl(args[0]);
      const method = ((_d = (_c = (_a = args[1]) == null ? void 0 : _a.method) != null ? _c : typeof args[0] !== "string" ? (_b = args[0]) == null ? void 0 : _b.method : void 0) != null ? _d : "GET").toUpperCase();
      const cfg = getConfig();
      if (!url || cfg && url.startsWith(cfg.apiEndpoint)) return orig(...args);
      try {
        const res = await orig(...args);
        const minStatus = (_f = (_e = getConfig()) == null ? void 0 : _e.networkErrorMinStatus) != null ? _f : DEFAULT_NETWORK_ERROR_MIN_STATUS;
        if (res.status >= minStatus) captureNetworkError(url, { method, statusCode: res.status, durationMs: Date.now() - start });
        return res;
      } catch (e) {
        if (!isAbort(e)) captureNetworkError(url, { method, errorMessage: String(e), durationMs: Date.now() - start });
        throw e;
      }
    };
  }
  function init2(options = {}) {
    const cfg = init(options);
    if (!cfg) return void 0;
    const firstOpen = isFirstOpen();
    const previousVersion = checkAppUpdate();
    if (firstOpen) trackFirstOpen();
    if (previousVersion) trackAppUpdate(previousVersion);
    installAutoCapture();
    installErrorQueueLifecycle();
    if (cfg.autoTrackSession) startSession();
    if (cfg.trackNetworkErrors) installFetchInterceptor();
    return cfg;
  }
  var MoonForgeAnalytics = {
    init: init2,
    trackEvent,
    trackScreenView,
    identify,
    // Locked revenue/economy catalog - same names/schemas across every game.
    trackEconomyTransaction,
    trackIapInitiated,
    trackIapCompleted,
    trackAdStarted,
    trackAdCompleted,
    trackAdImpression,
    // Locked FTUE/account events - see docs/eventing-improvements-plan.md.
    trackTutorialStart,
    trackTutorialComplete,
    trackAccountCreated,
    setUserProperty,
    removeUserProperty,
    clearUserProperties,
    getDistinctId,
    getSessionId,
    reset,
    flush,
    // Exposed so a host app can release buffered events on a path that does not
    // call identify, and so tests can reset buffering between cases.
    markIdentified,
    resetBuffering,
    // Exposed for diagnostics/tests: whether this device has ever sent an
    // alias linking an anonymous id to a real one.
    hasAliased
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
    flush: flush2,
    getStats
  };
  var ErrorLevel2 = ErrorLevel;
  var BreadcrumbType2 = BreadcrumbType;
  var BreadcrumbLevel2 = BreadcrumbLevel;
  if (typeof globalThis !== "undefined") {
    globalThis.MoonForgeAnalytics = MoonForgeAnalytics;
    globalThis.MoonForgeErrorTracker = MoonForgeErrorTracker;
  }
})();
