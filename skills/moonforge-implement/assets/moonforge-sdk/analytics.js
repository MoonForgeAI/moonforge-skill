// MoonForge Web SDK — analytics pipeline (POST /api/send).
import { clearUserProps, collectAutoFields, getConfig, getDistinctId, getSessionId, getUserProps, hasAliased, isReady, markAliased, markIdentified, postEvent, prepareSessionStart, removeUserProp, resetAll, setDistinctId, setUserProp, unixSeconds } from './core.js';

function ensure() {
  if (!isReady()) { console.warn('[MoonForge] call MoonForgeAnalytics.init() before tracking.'); return false; }
  return true;
}

/**
 * Flattens each {type,before,after} row to `${prefix}_N_{type,before,after}`.
 * No cap: the collector stores these keys generically (EAV), so N inputs cost
 * the same whether they ride one event or several - splitting a large
 * transaction would only duplicate the envelope. Model one economic state
 * change as one call, however many resources it touches.
 */
function flatRow(data, prefix, rows) {
  rows.forEach((row, i) => {
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

/** session_start with session_id (+ previous_session_id on re-engagement). */
export function trackSessionStart(extra = {}) {
  if (!ensure()) return undefined;
  return trackEvent('session_start', { ...prepareSessionStart(), ...extra });
}

/**
 * Fires once per device, the moment its distinct_id is first created - the
 * install signal (matches Firebase's first_open / GA4's first_visit; also
 * re-fires on a reinstall/storage-clear for a returning player, by design -
 * see docs/eventing-improvements-plan.md). Deliberately fires no other
 * properties: UTM/click-ID attribution is not sent explicitly here - the
 * collector parses it from this event's own `url` field (via
 * collectAutoFields(), which now includes the query string) the same way it
 * would for any event, so there is nothing extra to attach.
 */
export function trackFirstOpen() {
  if (!ensure()) return undefined;
  return trackEvent('first_open', {});
}

/** Fires once, on a returning device's session_start, when appVersion changed since last seen. */
export function trackAppUpdate(previousVersion) {
  if (!ensure()) return undefined;
  return trackEvent('app_update', { previous_version: previousVersion });
}

export function trackScreenView(name) {
  if (!ensure()) return undefined;
  const auto = collectAutoFields();
  return postEvent({ type: 'event', payload: { ...auto, name: 'screen_view', title: name || auto.title, data: { ...getUserProps(), screen_name: name } } });
}

/** Locked economy event - one name for every economic state change. */
export function trackEconomyTransaction({ reason, inputs = [], outputs = [] } = {}) {
  const data = { reason };
  flatRow(data, 'input', inputs);
  flatRow(data, 'output', outputs);
  return trackEvent('economy_transaction', data);
}

export function trackIapInitiated({ product_id, price, currency, product_name, store, ...rest } = {}) {
  const data = { product_id, price, currency, ...rest };
  if (product_name != null) data.product_name = product_name;
  if (store != null) data.store = store;
  return trackEvent('iap_initiated', data);
}

export function trackIapCompleted({ product_id, price, currency, transaction_id, product_name, store, ...rest } = {}) {
  const data = { product_id, price, currency, transaction_id, ...rest };
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

/** outcome: 'completed' | 'skipped'. Per-step tutorial tracking stays game-specific, not locked. */
export function trackTutorialStart(extra = {}) {
  return trackEvent('tutorial_start', { ...extra });
}
export function trackTutorialComplete({ outcome, ...rest } = {}) {
  const data = { ...rest };
  if (outcome != null) data.outcome = outcome;
  return trackEvent('tutorial_complete', data);
}

/** signup_method: 'email' | 'social' | 'platform' | 'guest_upgrade' | 'other'. Call after identify(). */
export function trackAccountCreated({ signup_method, provider, ...rest } = {}) {
  const data = { signup_method, ...rest };
  if (provider != null) data.provider = provider;
  return trackEvent('account_created', data);
}
export function identify(userId, traits = {}) {
  if (!ensure()) return undefined;

  // First-ever anonymous-to-real transition on this device: link the two
  // ids so history already sent under the anonymous one (anything the
  // pre-identify buffer already flushed, or prior sessions entirely) isn't
  // permanently orphaned from the real account. Fires once per device, not
  // on every login - a returning already-identified player calling identify
  // again is a normal login, not a new person to alias. Most players play
  // anonymously well past the ~10s/50-event buffer window before ever
  // signing up, so buffering alone does not cover this - it only covers a
  // returning player's login resolving moments after launch.
  const previousId = getDistinctId();
  if (userId && userId !== previousId && !hasAliased()) {
    postEvent({ type: 'alias', payload: { game: getConfig().gameId, id: userId, previous_id: previousId, timestamp: unixSeconds() } });
    markAliased();
  }

  if (userId) setDistinctId(userId);
  // Releases anything emitted before the player was known - session_start
  // above all - rewritten to this id rather than the anonymous one.
  markIdentified();
  return postEvent({ type: 'identify', payload: { game: getConfig().gameId, id: userId ?? getDistinctId(), data: traits, timestamp: unixSeconds(), appVersion: getConfig().appVersion } });
}
export function setUserProperty(k, v) { setUserProp(k, v); }
export function removeUserProperty(k) { removeUserProp(k); }
export function clearUserProperties() { clearUserProps(); }
export { getDistinctId, getSessionId };
export function reset() { resetAll(); }
export function flush() { return Promise.resolve(true); }
