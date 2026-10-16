// MoonForge Web SDK — shapes queued reports into /api/errors/batch items.
//
// The collector validates a batch as a whole (zod, ErrorBatchPayloadSchema):
// one item over a field limit rejects every report in that request with a 400.
// So each item is clipped to the collector's own limits before it is sent.
// Limits mirror apps/collector/src/schemas/error.schema.ts.

export const LIMITS = Object.freeze({
  message: 5000, rawStackTrace: 50000, exceptionClass: 500, frames: 200, frameText: 500,
  breadcrumbs: 100, breadcrumbMessage: 1000, breadcrumbCategory: 100,
  tagValue: 200, appVersion: 50, buildNumber: 50, userId: 255,
  osVersion: 50, deviceModel: 100, sceneName: 100, gameMode: 50, levelId: 100,
  networkUrl: 2000, networkMethod: 10, networkEffectiveType: 50,
});

/** Tag carrying how many occurrences this report stands for (string: tags are string-valued). */
export const OCCURRENCES_TAG = 'mf_occurrences';
/** Tag marking a count-only report for a fingerprint already reported this session. */
export const REPEAT_TAG = 'mf_repeat';

const BREADCRUMB_TYPES = new Set(['navigation', 'network', 'user', 'debug', 'error']);
const LEVELS = new Set(['debug', 'info', 'warning', 'error', 'fatal']);
const ERROR_LEVELS = new Set(['fatal', 'error', 'warning', 'info']);

function oneOf(value, allowed, fallback) { return allowed.has(value) ? value : fallback; }
function isRecord(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function clip(value, max) { return typeof value === 'string' ? value.slice(0, max) : value; }
function uint(value) { return Number.isInteger(value) && value >= 0 ? value : undefined; }
function compact(obj) { return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)); }

function frame(f) {
  return compact({
    ...f,
    function: clip(f.function, LIMITS.frameText),
    filename: clip(f.filename, LIMITS.frameText),
    module: clip(f.module, LIMITS.frameText),
    lineno: uint(f.lineno),
    colno: uint(f.colno),
  });
}

function breadcrumb(b) {
  return compact({
    ...b,
    type: oneOf(b.type, BREADCRUMB_TYPES, 'user'),
    level: oneOf(b.level, LEVELS, 'info'),
    message: b.message === undefined ? undefined : String(b.message).slice(0, LIMITS.breadcrumbMessage),
    category: b.category === undefined ? undefined : String(b.category).slice(0, LIMITS.breadcrumbCategory),
    data: isRecord(b.data) ? b.data : undefined,
    timestamp: Math.floor(Number(b.timestamp) || 0),
  });
}

function tags(t) {
  return Object.fromEntries(Object.entries(t ?? {}).map(([k, v]) => [k, String(v).slice(0, LIMITS.tagValue)]));
}

function device(d) {
  return compact({ ...d, osVersion: clip(d.osVersion, LIMITS.osVersion), deviceModel: clip(d.deviceModel, LIMITS.deviceModel) });
}

function gameState(g) {
  return compact({
    ...g,
    sceneName: clip(g.sceneName, LIMITS.sceneName),
    gameMode: clip(g.gameMode, LIMITS.gameMode),
    levelId: clip(g.levelId, LIMITS.levelId),
    customData: isRecord(g.customData) ? g.customData : undefined,
  });
}

function networkRequest(n) {
  return compact({ ...n, url: clip(String(n.url ?? ''), LIMITS.networkUrl), method: clip(String(n.method ?? 'GET'), LIMITS.networkMethod) });
}

/**
 * Clips a single-error payload to the collector's schema limits. Pure: returns a new object.
 * @param {object} p payload as built by errors.js
 * @returns {object}
 */
export function clipPayload(p) {
  return compact({
    ...p,
    errorLevel: oneOf(p.errorLevel, ERROR_LEVELS, 'error'),
    message: String(p.message ?? '').slice(0, LIMITS.message),
    rawStackTrace: clip(p.rawStackTrace, LIMITS.rawStackTrace),
    exceptionClass: clip(p.exceptionClass, LIMITS.exceptionClass),
    frames: Array.isArray(p.frames) ? p.frames.slice(0, LIMITS.frames).map(frame) : undefined,
    breadcrumbs: Array.isArray(p.breadcrumbs) ? p.breadcrumbs.slice(-LIMITS.breadcrumbs).map(breadcrumb) : undefined,
    tags: p.tags ? tags(p.tags) : undefined,
    appVersion: clip(p.appVersion, LIMITS.appVersion),
    buildNumber: clip(p.buildNumber, LIMITS.buildNumber),
    userId: clip(p.userId, LIMITS.userId),
    device: p.device ? device(p.device) : undefined,
    gameState: p.gameState ? gameState(p.gameState) : undefined,
    network: p.network ? compact({ ...p.network, effectiveType: clip(p.network.effectiveType, LIMITS.networkEffectiveType) }) : undefined,
    networkRequest: p.networkRequest ? networkRequest(p.networkRequest) : undefined,
  });
}

/**
 * Builds one batch item: the clipped payload minus `game` (it lives on the
 * batch), plus `clientErrorId` and the occurrence tags.
 * @param {{ id: string, payload: object, count: number, repeat: boolean }} entry
 * @returns {object}
 */
export function toBatchItem(entry) {
  const { game: _game, ...rest } = clipPayload(entry.payload);
  const countTags = { [OCCURRENCES_TAG]: String(entry.count), ...(entry.repeat ? { [REPEAT_TAG]: 'true' } : {}) };
  return { ...rest, clientErrorId: entry.id, tags: { ...(rest.tags ?? {}), ...countTags } };
}

/**
 * Smaller variant of an item for page-teardown sends, where every keepalive
 * request in flight shares a ~64KB budget. Drops the raw stack (frames keep
 * the structured trace) and the breadcrumb trail.
 * @param {object} item
 * @returns {object}
 */
export function slimItem(item) {
  const { rawStackTrace: _raw, breadcrumbs: _crumbs, ...rest } = item;
  return { ...rest, frames: Array.isArray(rest.frames) ? rest.frames.slice(0, 20) : undefined };
}
