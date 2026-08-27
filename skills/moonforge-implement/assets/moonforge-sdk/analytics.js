// MoonForge Web SDK — analytics pipeline (POST /api/send).
import { clearUserProps, collectAutoFields, getConfig, getDistinctId, getSessionId, getUserProps, isReady, markIdentified, postEvent, prepareSessionStart, removeUserProp, resetAll, setDistinctId, setUserProp, unixSeconds } from './core.js';

function ensure() {
  if (!isReady()) { console.warn('[MoonForge] call MoonForgeAnalytics.init() before tracking.'); return false; }
  return true;
}

function flatRow(data, prefix, rows, max = 3) {
  rows.slice(0, max).forEach((row, i) => {
    const n = i + 1;
    if (row.type != null) data[`${prefix}_${n}_type`] = row.type;
    if (row.before != null) data[`${prefix}_${n}_before`] = row.before;
    if (row.after != null) data[`${prefix}_${n}_after`] = row.after;
  });
}

export function trackEvent(name, data = {}, opts = {}) {
  if (!ensure()) return undefined;
  return postEvent({ type: 'event', payload: { ...collectAutoFields(), name, data: { ...getUserProps(), ...data } } }, opts);
}

export function trackSessionStart(extra = {}) {
  if (!ensure()) return undefined;
  return trackEvent('session_start', { ...prepareSessionStart(), ...extra });
}

export function trackScreenView(name) {
  if (!ensure()) return undefined;
  const auto = collectAutoFields();
  return postEvent({ type: 'event', payload: { ...auto, name: 'screen_view', title: name || auto.title, data: { ...getUserProps(), screen_name: name } } });
}

export function trackEconomyTransaction({ reason, inputs = [], outputs = [] } = {}) {
  const data = { reason };
  flatRow(data, 'input', inputs);
  flatRow(data, 'output', outputs);
  return trackEvent('economy_transaction', data);
}

export function trackIapInitiated({ product_id, price, currency, product_name, store } = {}) {
  const data = { product_id, price, currency };
  if (product_name != null) data.product_name = product_name;
  if (store != null) data.store = store;
  return trackEvent('iap_initiated', data);
}

export function trackIapCompleted({ product_id, price, currency, transaction_id, product_name, store } = {}) {
  const data = { product_id, price, currency, transaction_id };
  if (product_name != null) data.product_name = product_name;
  if (store != null) data.store = store;
  return trackEvent('iap_completed', data);
}

export function trackAdStarted({ ad_type, placement, provider, ...rest } = {}) {
  const data = { ad_type, placement, ...rest };
  if (provider != null) data.provider = provider;
  return trackEvent('ad_started', data);
}

export function trackAdCompleted({ ad_type, placement, watched_fraction, provider, rewarded, duration_seconds, ...rest } = {}) {
  const data = { ad_type, placement, watched_fraction, ...rest };
  if (provider != null) data.provider = provider;
  if (rewarded != null) data.rewarded = rewarded;
  if (duration_seconds != null) data.duration_seconds = duration_seconds;
  return trackEvent('ad_completed', data);
}

export function trackAdImpression({ ad_type, placement, provider, ...rest } = {}) {
  const data = { ad_type, placement, ...rest };
  if (provider != null) data.provider = provider;
  return trackEvent('ad_impression', data);
}

export function identify(userId, traits = {}) {
  if (!ensure()) return undefined;
  if (userId) setDistinctId(userId);
  markIdentified();
  return postEvent({ type: 'identify', payload: { game: getConfig().gameId, id: userId ?? getDistinctId(), data: traits, timestamp: unixSeconds(), appVersion: getConfig().appVersion } });
}
export function setUserProperty(k, v) { setUserProp(k, v); }
export function removeUserProperty(k) { removeUserProp(k); }
export function clearUserProperties() { clearUserProps(); }
export { getDistinctId, getSessionId, prepareSessionStart };
export function reset() { resetAll(); }
export function flush() { return Promise.resolve(true); }
