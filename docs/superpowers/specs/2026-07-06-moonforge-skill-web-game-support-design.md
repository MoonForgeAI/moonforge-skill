# MoonForge Skill — Web Game Support (Full Unity Parity)

**Date:** 2026-07-06
**Status:** Approved design — ready for implementation plan
**Scope:** `moonforge-skill` repo only

## Problem

The `moonforge-skill` package (`/moonforge` + `analyze`/`events`/`implement`/`verify`)
instruments **Unity** games only — all detection, code generation, and verification
is C#/Unity-specific. Web games (Phaser, PixiJS, Three.js, Babylon, PlayCanvas,
plain HTML5 canvas, React-based games) get no equivalent flow.

Goal: give web games the **same guided instrumentation flow and the same SDK
surface** as Unity — analyze → recommend events → implement → verify — including
**full parity with the Unity SDK's analytics AND error-tracking pipelines**.

## Key findings (ground truth from exploration)

- **No shipped web SDK exists.** The onboarding snippet references
  `cdn.moonforge.dev/sdk/v1/moonforge.min.js`, which **404s** (undeployed). The
  Makerkit `packages/analytics` in `main-app` is a generic unwired interface. So
  the skill will **generate a local SDK** into the user's project.
- **The collector is the real contract** (`event-collector` repo):
  - Analytics: `POST {collector}/api/send`, body
    `{ type: 'event' | 'identify', payload: { game (uuid, required), name (≤50),
    data, url, title, referrer, screen (≤11), language (≤35), hostname (≤100),
    tag (≤50), id, timestamp } }`.
  - Errors: `POST {collector}/api/errors` (and `/api/errors/batch`) accepting
    stack frames, breadcrumbs (`type` navigation|network|user|debug|error,
    `level` debug|info|warning|error|fatal), device context
    (`platform` includes **`web`**), network context, and game state
    (`sceneName`/`gameMode`/`levelId`/`customData`).
  - **No auth** (game UUID identifies); **CORS `origin: '*'`**.
  - **Cache-token round-trip:** `/api/send` returns `{ cache, sessionId, visitId }`;
    the client sends the token back via the `x-moonforge-cache` request header for
    session/visit continuity. Allowed headers: `Content-Type`, `x-moonforge-cache`.
- **Live collector base URL:** `https://collector.moonforge.co` (Unity's
  `DefaultAPIEndpoint`). The onboarding `.dev` domain is a placeholder — the SDK
  targets `.co`.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Web instrumentation target | Skill **generates a local modular SDK** into the project; posts to the live collector. No CDN dependency. |
| Skill architecture | **Per-platform reference files** — shared 5-skill flow; each skill loads `references/<platform>.md` after platform detection. |
| SDK parity | **Full Unity parity** — analytics + error-tracking pipelines + auto-capture. |
| SDK structure | **Modular ES-module folder** (`moonforge/`), concatenated to one global file for legacy `<script>` games. |
| Collector | `https://collector.moonforge.co`, no auth, CORS `*`, cache-token round-trip. |
| Unreal | **Deferred** — architecture leaves a `references/unreal.md` slot; not built now. |

## Skill package file layout

```
skills/
  moonforge/SKILL.md                    # + platform detection & routing (Unity/Web)
  moonforge-analyze/
    SKILL.md                            # thin router: detect → load references/<platform>.md
    references/unity.md                 # today's Unity analyze content, extracted
    references/web.md                   # NEW
  moonforge-events/
    SKILL.md                            # shared P0–P3 catalog (platform-agnostic)
    references/web-auto-tracked.md      # NEW — web auto-tracked P0 note
  moonforge-implement/
    SKILL.md                            # thin router
    references/unity.md
    references/web.md                   # NEW
    assets/moonforge-sdk/               # NEW — canonical SDK source emitted verbatim
      index.js  core.js  analytics.js  errors.js  context.js
  moonforge-verify/
    SKILL.md                            # thin router
    references/unity.md
    references/web.md                   # NEW
docs/superpowers/…                      # this spec + the plan
package.json, vitest.config.ts          # NEW — dev-only, to test the SDK modules
tests/                                  # NEW — SDK unit tests (not shipped to users)
```

Unity behavior is **preserved unchanged**, relocated from each `SKILL.md` into
`references/unity.md`. The `SKILL.md` files become platform routers so no Unity
regression occurs.

## The generated Web SDK (`assets/moonforge-sdk/`)

Vanilla JS, **zero runtime dependencies**, ES modules. Works with bundlers and
`<script type="module">`; the implement skill can concatenate the modules into a
single `moonforge.js` IIFE that assigns `window.MoonForgeAnalytics` /
`window.MoonForgeErrorTracker` for legacy non-module `<script>` games.

### Modules
- **`core.js`** — config/init, persistent distinct id (`localStorage: mf_distinct_id`,
  UUID), session id + 30-min idle re-engagement, transport, cache-token handling,
  auto-collected fields, shared enums.
- **`analytics.js`** — the analytics pipeline (`/api/send`).
- **`errors.js`** — the error-tracking pipeline (`/api/errors`), breadcrumb ring
  buffer (max 50), auto-capture.
- **`context.js`** — web device context (`platform: 'web'`, UA-derived OS/model,
  `navigator.language`, `performance.memory` when present), network context
  (`navigator.connection`), and game-state store.
- **`index.js`** — wires modules, exposes `MoonForgeAnalytics` and
  `MoonForgeErrorTracker`, and the enums.

### Public API — analytics (`MoonForgeAnalytics`) → `POST /api/send`
```js
MoonForgeAnalytics.init({ gameId, apiEndpoint = 'https://collector.moonforge.co',
                          debug = false, autoTrackSession = true });
MoonForgeAnalytics.trackEvent(name, data = {});
MoonForgeAnalytics.trackScreenView(name);          // sets url/title to the screen
MoonForgeAnalytics.identify(userId, traits = {});  // type: 'identify'
MoonForgeAnalytics.setUserProperty(key, value);    // merged into later events
MoonForgeAnalytics.removeUserProperty(key);
MoonForgeAnalytics.clearUserProperties();
MoonForgeAnalytics.getDistinctId();                // -> string
MoonForgeAnalytics.getSessionId();                 // -> string
MoonForgeAnalytics.reset();                         // new distinct id + session
MoonForgeAnalytics.flush();                         // best-effort drain
```

### Public API — error tracking (`MoonForgeErrorTracker`) → `POST /api/errors`
```js
MoonForgeErrorTracker.setUser(userId, tags = {});
MoonForgeErrorTracker.clearUser();
MoonForgeErrorTracker.setGameState({ sceneName, gameMode, levelId });
MoonForgeErrorTracker.setGameStateData(key, value);
MoonForgeErrorTracker.addBreadcrumb(message, { type = 'user', level = 'info', category, data });
MoonForgeErrorTracker.captureException(error, { level = 'error', tags = {} });
MoonForgeErrorTracker.captureMessage(message, { level = 'info', tags = {} });
MoonForgeErrorTracker.captureNetworkError(url, { method = 'GET', statusCode, errorMessage, durationMs, tags });
MoonForgeErrorTracker.flush();
```
- **Auto-capture** (enabled by init): `window.addEventListener('error', …)` and
  `'unhandledrejection'` → `captureException`, with a parsed stack (filename,
  function, lineno, colno, inApp) matching the collector `StackFrame` schema.
- **Optional fetch interceptor** (opt-in via init `trackNetworkErrors: true`):
  wraps `window.fetch` to auto-`captureNetworkError` on responses ≥ a threshold
  (default 400) and network failures; always leaves a `network` breadcrumb.

### Enums (string unions matching the collector)
`ErrorLevel` = `info|warning|error|fatal`; `BreadcrumbType` =
`navigation|network|user|debug|error`; `BreadcrumbLevel` =
`debug|info|warning|error|fatal`.

### Transport rules
- Normal events: `fetch(url, { method:'POST', keepalive:true, headers:{'Content-Type':'application/json', ...(cacheToken && {'x-moonforge-cache': cacheToken})}, body })`.
  Read `{ cache, sessionId, visitId }` from the response and store `cache` for the
  next request.
- Unload-time `session_end` (on `pagehide` / `visibilitychange`→hidden):
  `navigator.sendBeacon(url, blob)` (no headers/response needed).
- All sends are best-effort and never throw into game code. No-op with a
  `console.warn` if `init` was not called or `gameId` is missing. `debug` logs
  each send.

### Auto-collected fields (every analytics event; never duplicated in `data`)
`game`, `id` (distinct id), `url` (`location.pathname + location.hash`),
`title` (`document.title`), `referrer` (`document.referrer`),
`screen` (`${screen.width}x${screen.height}`), `language` (`navigator.language`),
`hostname` (`location.hostname`), `timestamp` (`Date.now()`).

### Auto-tracked P0 (no code needed)
`session_start` on init (with `session_id`); `session_end` on unload (with
`session_id`, `duration_seconds`); `screen_view` via `trackScreenView` and, for
SPA/router games, an optional `history.pushState` hook (documented, opt-in).

## Per-skill web behavior

### moonforge (orchestrator)
Add **platform detection** before analyze, with precedence and disambiguation:
- **Unity:** `Assets/` + `ProjectSettings/ProjectSettings.asset`.
- **Web:** `package.json` with a game framework dep (`phaser`, `pixi.js`, `three`,
  `@babylonjs/core`, `playcanvas`, `kaboom`, `excalibur`, `matter-js`, `pixi-*`),
  OR an `index.html` referencing a game bundle / `<canvas>`.
- **Ambiguous** (both present, e.g. a WebGL export of a Unity game): ask the user.
Route the four sub-skills to the detected platform. `.moonforge.json` `gameId`
handling is unchanged.

### moonforge-analyze → references/web.md
Detect framework; map scenes/states/screens (Phaser `Scene`s, game states, SPA
routes); find core systems (game loop, input, score/level/shop/IAP, UI); check
existing analytics (existing MoonForge SDK, gtag, plausible, posthog); infer
genre; output the **same game-profile format** as Unity.

### moonforge-events
Shared P0–P3 catalog is reused as-is. `references/web-auto-tracked.md` documents
that the web SDK auto-tracks `session_start`/`session_end`/`screen_view`, so those
P0 items need no code (parity with Unity's auto-tracking note).

### moonforge-implement → references/web.md
1. Copy `assets/moonforge-sdk/` into the project (choose location from project
   layout: `src/`, `js/`, or next to the entry HTML) with `gameId` wired into the
   `init` call. For non-module `<script>` games, emit the concatenated
   single-file build instead.
2. Add `MoonForgeAnalytics.init({ gameId })` (and error auto-capture is on by
   default) at the game bootstrap — module import or `<script>` in `index.html`.
3. Write `trackEvent` / error calls at event sites, framework-aware; show diffs
   for approval (same approval UX as Unity).

### moonforge-verify → references/web.md
- **Static:** SDK files present; `init` wired; `node --check` (or `tsc --noEmit`
  / eslint if configured) on the SDK and touched files.
- **Live:** `curl` a test event to `{collector}/api/send` for the gameId,
  expecting `2xx` with a JSON body — same collector reachability check Unity uses.
  Optionally instruct the user to run the game and watch the network tab for
  `/api/send` and `/api/errors` calls.

## Config
Reuses `.moonforge.json` (`{ accountId, accountName, gameId, gameName,
sdkConfigured }`). The SDK's `apiEndpoint` defaults to
`https://collector.moonforge.co`.

## Testing
The generated SDK is real code, so the **skill repo** gets a dev-only test setup
(vitest + jsdom; not shipped to users) covering the SDK modules:
- analytics payload envelope + auto-field collection;
- cache-token capture and replay via `x-moonforge-cache`;
- `sendBeacon` used on unload, `fetch(keepalive)` otherwise;
- error payload shape, breadcrumb ring buffer cap, stack parsing;
- auto-capture of `window.onerror` / `unhandledrejection`;
- no-op + warn when `init` not called or `gameId` missing.
Target ≥ 80% coverage on the SDK modules. The markdown skills themselves are
validated by review, not tests.

## Docs
Update `README.md` and the `moonforge/SKILL.md` description: "Unity developers" →
"Unity and web game developers"; document the web flow and the generated SDK.

## Scope boundaries / follow-ups (not in this work)
- **Unreal** skill content (a `moonforge-unreal-sdk` exists) — architecture leaves
  room via `references/unreal.md`; not built here.
- **Deploying an official CDN web SDK** and fixing the `.dev` → `.co` domain
  mismatch in `moonforge-prod` onboarding — flagged for a separate task.
- Server-side changes to `event-collector` — none; we conform to the existing
  contract.

## Success criteria
1. Running `/moonforge` in a web game project detects "web", analyzes it,
   recommends events, generates the modular SDK, writes instrumented calls, and
   verifies against the live collector — end to end.
2. The generated SDK exposes **every** Unity analytics + error-tracking method
   listed above and auto-captures unhandled errors.
3. A test event and a test error reach `collector.moonforge.co` (`2xx`).
4. Unity flow is unchanged (no regression; content merely relocated to
   `references/unity.md`).
5. SDK unit tests pass at ≥ 80% coverage.
