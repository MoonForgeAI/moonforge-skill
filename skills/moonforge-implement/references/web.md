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
`session_start`/`session_end` and unhandled-error capture start automatically.

**Always pass `appVersion`** — it is included on every event and identify
call as-is. Read it from the project's own `package.json` `"version"` field
(the game's version, not this skill's) and pass it literally:
`MoonForgeAnalytics.init({ gameId: '<GAME_ID>', appVersion: '<package.json version>' })`.
If `package.json` has no `"version"` or the project isn't versioned there, ask
the user rather than omitting it or inventing a value — an unset `appVersion`
means `appVersion` is silently absent from every event.

## 3. Instrument events (parity with Unity)
Analytics — `MoonForgeAnalytics`:
`trackEvent(name, data)`, `trackSessionStart()`, `trackScreenView(name)`,
`trackEconomyTransaction({ reason, inputs, outputs })`,
`trackIapInitiated(...)`, `trackIapCompleted(...)`,
`trackAdStarted(...)`, `trackAdCompleted(...)`, `trackAdImpression(...)`,
`identify(userId, traits)`, `setUserProperty(k, v)`, `removeUserProperty(k)`,
`clearUserProperties()`, `getDistinctId()`, `getSessionId()`, `reset()`, `flush()`.

`session_start` on init includes client context (`timezone`, attribution from URL,
persisted first-touch). See `telemetry-implement.md` for hook recipes.

Errors — `MoonForgeErrorTracker`:
`setUser(userId, tags)`, `clearUser()`, `setGameState({sceneName,gameMode,levelId})`,
`setGameStateData(k, v)`, `addBreadcrumb(msg, {type,level,category,data})`,
`captureException(err, {level,tags})`, `captureMessage(msg, {level,tags})`,
`captureNetworkError(url, {method,statusCode,errorMessage,durationMs,tags})`.

Place calls at the right site per framework (e.g. Phaser `Scene.create()` for
`trackScreenView(this.scene.key)`; level-complete handlers for
`trackEvent('level_complete', {...})`). Show a diff for each change and get approval,
exactly like the Unity flow.

**Locked catalog:** Session (`session_start` / `session_end`), economy
(`economy_transaction`), and revenue (`iap_*` / `ad_*`) names and required
props must match `moonforge-events/references/telemetry-model.md` exactly —
never invent aliases. Capture geo/timezone and UTM/attribution on the client
(locked keys on `session_start`); do not assume collector enrichment.

## 4. Write `.moonforge.json` if missing
`{ "gameId": "<GAME_ID>", "gameName": "<name>", "sdkConfigured": true }`.
