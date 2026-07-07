# MoonForge Implement — Web

The generated SDK lives in this skill at `assets/moonforge-sdk/` (ES modules) with a
prebuilt `moonforge.global.js` for legacy `<script>` games.

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

## 3. Instrument events (parity with Unity)
Analytics — `MoonForgeAnalytics`:
`trackEvent(name, data)`, `trackScreenView(name)`, `identify(userId, traits)`,
`setUserProperty(k, v)`, `removeUserProperty(k)`, `clearUserProperties()`,
`getDistinctId()`, `getSessionId()`, `reset()`, `flush()`.
Errors — `MoonForgeErrorTracker`:
`setUser(userId, tags)`, `clearUser()`, `setGameState({sceneName,gameMode,levelId})`,
`setGameStateData(k, v)`, `addBreadcrumb(msg, {type,level,category,data})`,
`captureException(err, {level,tags})`, `captureMessage(msg, {level,tags})`,
`captureNetworkError(url, {method,statusCode,errorMessage,durationMs,tags})`.

Place calls at the right site per framework (e.g. Phaser `Scene.create()` for
`trackScreenView(this.scene.key)`; level-complete handlers for
`trackEvent('level_complete', {...})`). Show a diff for each change and get approval,
exactly like the Unity flow.

## 4. Write `.moonforge.json` if missing
`{ "gameId": "<GAME_ID>", "gameName": "<name>", "sdkConfigured": true }`.
