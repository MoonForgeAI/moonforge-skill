# MoonForge Implement — Web

The SDK ships with this skill at `assets/moonforge-sdk/` (ES modules, plus a
prebuilt `moonforge.global.js` for legacy `<script>` games). It already
implements the full contract in `sdk-contract.md` — session lifecycle,
pre-identify buffering, persistent distinct id — so on web you copy rather than
generate.

**Copy it in before writing any tracking calls.** Instrumenting against an SDK
that is not in the project leaves the game broken and the job half done.

## 1. Install the SDK into the project
- **Bundler / `<script type="module">` game:** copy the folder `assets/moonforge-sdk/`
  into the project source (e.g. `src/moonforge/`). Keep the module files
  (`core.js`, `context.js`, `analytics.js`, `errors.js`, `index.js`).
- **Legacy `<script>` game (no bundler/modules):** copy only
  `assets/moonforge-sdk/moonforge.global.js` into the project (e.g. `js/moonforge.js`)
  and load it with `<script src="js/moonforge.js"></script>` before game code.

## 2. Initialize at bootstrap
- Module game: at the entry point,
  `import { MoonForgeAnalytics } from './moonforge/index.js';`
  then `MoonForgeAnalytics.init({ gameId: '<GAME_ID>' });`
- `<script>` game: after the SDK script,
  `<script>MoonForgeAnalytics.init({ gameId: '<GAME_ID>' });</script>`
Read `<GAME_ID>` from `.moonforge.json` (`gameId`) or ask the user.
`init` accepts `{ gameId, apiEndpoint?, debug?, autoTrackSession?, trackNetworkErrors?, appVersion?, buildNumber? }`.
`session_start`/`session_end`, unhandled-error capture, `first_open` (once per
device, on distinct-id creation), and `app_update` (once, when `appVersion`
differs from the last one this device saw) all start automatically — no
extra calls needed for any of them.

**Always pass `appVersion`** — it is included on every event and identify
call as-is. Read it from the project's own `package.json` `"version"` field
(the game's version, not this skill's) and pass it literally:
`MoonForgeAnalytics.init({ gameId: '<GAME_ID>', appVersion: '<package.json version>' })`.
If `package.json` has no `"version"` or the project isn't versioned there, ask
the user rather than omitting it or inventing a value — an unset `appVersion`
means `appVersion` is silently absent from every event.

## 3. Instrument events (parity with Unity)
Analytics — `MoonForgeAnalytics`:
`trackEvent(name, data)`, `trackScreenView(name)`, `identify(userId, traits)`,
`trackEconomyTransaction({reason, inputs, outputs})`,
`trackIapInitiated({product_id, price, currency, product_name?, store?})`,
`trackIapCompleted({product_id, price, currency, transaction_id, product_name?, store?})`,
`trackAdStarted({ad_type, placement, provider?})`,
`trackAdCompleted({ad_type, placement, watched_fraction, provider?, rewarded?, duration_seconds?})`,
`trackAdImpression({ad_type, placement, provider?})`,
`trackTutorialStart()`, `trackTutorialComplete({outcome?})`,
`trackAccountCreated({signup_method, provider?})`,
The `iap_*`, `ad_*`, `tutorial_*` and `account_created` helpers forward any
extra keys you pass through to the event's `data` (the locked keys above just
can't be renamed or omitted). `trackEconomyTransaction` fills only 3 input and
3 output slots — passing more logs a `console.warn` and drops the rest; split
into multiple transactions instead.
`setUserProperty(k, v)`, `removeUserProperty(k)`, `clearUserProperties()`,
`getDistinctId()`, `getSessionId()`, `reset()`, `flush()`.

The revenue/economy/FTUE helpers send the exact locked names and schemas from
`moonforge-events/references/telemetry-model.md` — use them rather than a raw
`trackEvent` call, so the schema can't drift. **Call `identify()` before
`trackAccountCreated()`, never the reverse and never combined** — `identify`
drives alias reconciliation and must run first so `account_created` already
carries the real id.
Errors — `MoonForgeErrorTracker`:
`setUser(userId, tags)`, `clearUser()`, `setGameState({sceneName,gameMode,levelId})`,
`setGameStateData(k, v)`, `addBreadcrumb(msg, {type,level,category,data})`,
`captureException(err, {level,tags})`, `captureMessage(msg, {level,tags})`,
`captureNetworkError(url, {method,statusCode,errorMessage,durationMs,tags})`.

Place calls at the right site per framework (e.g. Phaser `Scene.create()` for
`trackScreenView(this.scene.key)`; level-complete handlers for
`trackEvent('level_complete', {...})`). Show a diff for each change and get approval,
exactly like the Unity flow.

**`identify(userId, traits)` sends an `alias` automatically** the first time
it's ever called on a device, linking the anonymous id that was tracking the
player pre-signup to the real one — this is what lets pre-signup activity
survive account creation instead of being permanently stranded under an id
nobody will query again. It fires once per device; a later `identify` (a
normal login) does not repeat it. No action needed beyond calling `identify`
— just don't assume a fresh anonymous id after `reset()` (e.g. logout) is
unaliasable; it correctly becomes eligible again.

## 4. Write `.moonforge.json` if missing
`{ "gameId": "<GAME_ID>", "gameName": "<name>", "sdkConfigured": true }`.
