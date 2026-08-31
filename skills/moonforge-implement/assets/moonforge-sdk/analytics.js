// MoonForge Web SDK — analytics pipeline (POST /api/send).
import { clearUserProps, collectAutoFields, getConfig, getDistinctId, getSessionId, getUserProps, hasAliased, isReady, markAliased, markIdentified, postEvent, removeUserProp, resetAll, setDistinctId, setUserProp, unixSeconds } from './core.js';

function ensure() {
  if (!isReady()) { console.warn('[MoonForge] call MoonForgeAnalytics.init() before tracking.'); return false; }
  return true;
}

export function trackEvent(name, data = {}, opts = {}) {
  if (!ensure()) return undefined;
  return postEvent({ type: 'event', payload: { ...collectAutoFields(), name, data: { ...getUserProps(), ...data } } }, opts);
}
export function trackScreenView(name) {
  if (!ensure()) return undefined;
  const auto = collectAutoFields();
  return postEvent({ type: 'event', payload: { ...auto, name: 'screen_view', title: name || auto.title, data: { ...getUserProps(), screen_name: name } } });
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
