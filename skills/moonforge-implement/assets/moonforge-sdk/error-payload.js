// MoonForge Web SDK — shapes queued reports into /api/errors/batch items.
//
// The collector validates a batch as a whole (zod, ErrorBatchPayloadSchema):
// one item over a field limit rejects every report in that request with a 400.
// So each item is clipped to the collector's own limits before it is sent.
// Limits mirror apps/collector/src/schemas/error.schema.ts.

export const LIMITS = Object.freeze({
  message: 5000, rawStackTrace: 50000, exceptionClass: 500, fingerprint: 64,
  frames: 200, frameText: 500, framePackage: 200, frameAddress: 50,
  breadcrumbs: 100, breadcrumbMessage: 1000, breadcrumbCategory: 100,
  tagValue: 200, appVersion: 50, buildNumber: 50, unityVersion: 50, userId: 255,
  osVersion: 50, deviceModel: 100, manufacturer: 100, cpuArchitecture: 50,
  networkCarrier: 100, networkEffectiveType: 50,
  sceneName: 100, gameMode: 50, levelId: 100,
  networkUrl: 2000, networkMethod: 10,
});

/** Tag carrying how many occurrences this report stands for (string: tags are string-valued). */
export const OCCURRENCES_TAG = 'mf_occurrences';
/** Tag marking a count-only report for a fingerprint already reported this session. */
export const REPEAT_TAG = 'mf_repeat';

// Enum values accepted by the collector schema.
const ERROR_TYPES = new Set(['crash', 'exception', 'network', 'custom']);
const ERROR_CATEGORIES = new Set(['native', 'managed', 'handled', 'unhandled']);
const ERROR_LEVELS = new Set(['fatal', 'error', 'warning', 'info']);
const BREADCRUMB_TYPES = new Set(['navigation', 'network', 'user', 'debug', 'error']);
const BREADCRUMB_LEVELS = new Set(['debug', 'info', 'warning', 'error', 'fatal']);
const NETWORK_TYPES = new Set(['wifi', 'cellular', 'ethernet', 'none']);

function oneOf(value, allowed, fallback) { return allowed.has(value) ? value : fallback; }
function isRecord(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
/** Any present value as a clipped string (games pass numeric ids/levels); undefined stays absent. */
function str(value, max) { return value === undefined || value === null ? undefined : String(value).slice(0, max); }
function uint(value) { return Number.isInteger(value) && value >= 0 ? value : undefined; }
function int(value) { const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value; return Number.isInteger(n) ? n : undefined; }
function nonNegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined; }
function compact(obj) { return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)); }

function frame(f) {
  return compact({
    module: str(f.module, LIMITS.frameText),
    function: str(f.function, LIMITS.frameText),
    filename: str(f.filename, LIMITS.frameText),
    lineno: uint(f.lineno),
    colno: uint(f.colno),
    instructionAddress: str(f.instructionAddress, LIMITS.frameAddress),
    symbolAddress: str(f.symbolAddress, LIMITS.frameAddress),
    inApp: typeof f.inApp === 'boolean' ? f.inApp : undefined,
    package: str(f.package, LIMITS.framePackage),
  });
}

function breadcrumb(b) {
  return compact({
    type: oneOf(b.type, BREADCRUMB_TYPES, 'user'),
    level: oneOf(b.level, BREADCRUMB_LEVELS, 'info'),
    message: str(b.message, LIMITS.breadcrumbMessage),
    category: str(b.category, LIMITS.breadcrumbCategory),
    data: isRecord(b.data) ? b.data : undefined,
    timestamp: Math.floor(Number(b.timestamp) || 0),
  });
}

function tags(t) {
  return Object.fromEntries(Object.entries(t ?? {}).map(([k, v]) => [k, String(v).slice(0, LIMITS.tagValue)]));
}

function device(d) {
  return compact({
    ...d,
    osVersion: str(d.osVersion, LIMITS.osVersion) ?? 'unknown',
    deviceModel: str(d.deviceModel, LIMITS.deviceModel) ?? 'unknown',
    manufacturer: str(d.manufacturer, LIMITS.manufacturer),
    cpuArchitecture: str(d.cpuArchitecture, LIMITS.cpuArchitecture),
  });
}

function network(n) {
  return compact({
    type: NETWORK_TYPES.has(n.type) ? n.type : undefined,
    carrier: str(n.carrier, LIMITS.networkCarrier),
    effectiveType: str(n.effectiveType, LIMITS.networkEffectiveType),
  });
}

function gameState(g) {
  return compact({
    sceneName: str(g.sceneName, LIMITS.sceneName),
    gameMode: str(g.gameMode, LIMITS.gameMode),
    levelId: str(g.levelId, LIMITS.levelId),
    customData: isRecord(g.customData) ? g.customData : undefined,
  });
}

function networkRequest(n) {
  return compact({
    ...n,
    url: str(n.url, LIMITS.networkUrl) ?? '',
    method: str(n.method, LIMITS.networkMethod) ?? 'GET',
    statusCode: int(n.statusCode),
    durationMs: nonNegative(n.durationMs),
  });
}

/**
 * Coerces a single-error payload to the collector's schema: every string
 * field stringified and clipped to its limit, enums validated (falling back to
 * the default), numbers checked. Pure: returns a new object.
 * @param {object} p payload as built by errors.js
 * @returns {object}
 */
export function clipPayload(p) {
  return compact({
    ...p,
    errorType: oneOf(p.errorType, ERROR_TYPES, 'custom'),
    errorCategory: oneOf(p.errorCategory, ERROR_CATEGORIES, 'handled'),
    errorLevel: oneOf(p.errorLevel, ERROR_LEVELS, 'error'),
    message: str(p.message, LIMITS.message) ?? '',
    rawStackTrace: str(p.rawStackTrace, LIMITS.rawStackTrace),
    exceptionClass: str(p.exceptionClass, LIMITS.exceptionClass),
    fingerprint: str(p.fingerprint, LIMITS.fingerprint),
    frames: Array.isArray(p.frames) ? p.frames.slice(0, LIMITS.frames).map(frame) : undefined,
    breadcrumbs: Array.isArray(p.breadcrumbs) ? p.breadcrumbs.slice(-LIMITS.breadcrumbs).map(breadcrumb) : undefined,
    tags: p.tags ? tags(p.tags) : undefined,
    appVersion: str(p.appVersion, LIMITS.appVersion),
    buildNumber: str(p.buildNumber, LIMITS.buildNumber),
    unityVersion: str(p.unityVersion, LIMITS.unityVersion),
    userId: str(p.userId, LIMITS.userId),
    device: p.device ? device(p.device) : undefined,
    gameState: p.gameState ? gameState(p.gameState) : undefined,
    network: p.network ? network(p.network) : undefined,
    networkRequest: p.networkRequest ? networkRequest(p.networkRequest) : undefined,
    timestamp: typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) ? Math.floor(p.timestamp) : undefined,
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
