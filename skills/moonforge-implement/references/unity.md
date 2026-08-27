# MoonForge Implement — Unity

## 0. Put the SDK in the project FIRST

**Read `sdk-contract.md` before anything else. Do not write a single
`TrackEvent` call until the SDK exists in the project.**

Instrumenting first produces exactly one outcome: code that references
`MoonForge.ErrorTracking.Analytics`, a project that will not compile, and a
user told to go install a package. That is a half-finished job, and it is the
failure this step exists to prevent.

Check first — if all three are already present, skip to §1:

- `Assets/MoonForge/` (a previously generated SDK), or
- a `com.moonforge.*` entry in `Packages/manifest.json`, or
- a `MoonForgeSettings` asset under a `Resources/` folder.

Otherwise **generate the SDK into `Assets/MoonForge/`**, implementing every row
of the contract in `sdk-contract.md`. Do not go looking for a package to
install; write it.

### Unity specifics

- **Namespace** `MoonForge.ErrorTracking.Analytics`, static entry point
  `MoonForgeAnalytics`, so the API in §1 below is what the game calls. Keep
  these names exactly — the rest of this reference, and any existing
  instrumentation, depends on them.
- **Assembly definition** — add `MoonForge.ErrorTracking.asmdef` so the SDK
  compiles as its own assembly and cannot be broken by game-code changes.
- **Runner** — a `MonoBehaviour` created via
  `[RuntimeInitializeOnLoadMethod]` and kept with `DontDestroyOnLoad`, to own
  coroutines and lifecycle. `init` must be idempotent, so guard the creation.
- **Transport** — `UnityWebRequest` on a coroutine, `timeout = 5`. Swallow
  every error; never surface one to the game. Unity's default User-Agent
  contains `UnityPlayer` and is allowlisted, so leave it alone.
- **Distinct id** — `PlayerPrefs` (`Application.persistentDataPath` for a
  larger payload), written once and reused. `PlayerPrefs.Save()` after
  creating it.
- **Session end** — `Application.quitting`, plus `OnApplicationPause(true)` on
  mobile, where quitting often does not fire. Send it with
  `UnityWebRequest` best-effort; accept that a hard kill loses it.
- **Screen views** — `SceneManager.sceneLoaded` → `TrackScreenView(scene.name)`
  when `trackSceneViewsAutomatically` is on.
- **`appVersion`** — set `Application.version` on every `TrackEvent`,
  `TrackScreenView` and `Identify` payload, read fresh at send time (Unity's
  Player Settings "Version", not this skill's or the generated SDK's own
  version). No config needed — it is always available at runtime.
- **Settings** — a `MoonForgeSettings` `ScriptableObject` in `Assets/Resources/`
  carrying at minimum `gameId`, `enabled`, `debugMode`, plus the fields the
  orchestrator's settings table lists. **Create the asset and write the game id
  into it** — an SDK with no game id is inert, and this is the step most often
  left to the user.
- **Tests** — if the project has a Test Framework assembly, add EditMode tests
  for the envelope shape and the pre-identify buffer, per the contract.

Show the generated files as a diff and get approval, like any other change.

## Full SDK API Reference


Namespace: `MoonForge.ErrorTracking.Analytics` (analytics)
Namespace: `MoonForge.ErrorTracking` (error tracking, breadcrumbs, game state)
Namespace: `MoonForge.ErrorTracking.Capture` (network error interceptor)

### Analytics

```csharp
using MoonForge.ErrorTracking.Analytics;
using System.Collections.Generic;

// Track a custom event
MoonForgeAnalytics.TrackEvent("event_name", new Dictionary<string, object>
{
    { "property_key", value }
});

// Track a screen view (usually auto-tracked via scene changes)
MoonForgeAnalytics.TrackScreenView("screen_name");

// Identify a user (for games with accounts)
MoonForgeAnalytics.Identify("user_id", new Dictionary<string, object>
{
    { "trait_key", value }
});

// Set persistent user property (included in all subsequent events)
MoonForgeAnalytics.SetUserProperty("key", value);
```

### Error Tracking

```csharp
using MoonForge.ErrorTracking;

// Set user context for error reports
// SetUser(string userId, Dictionary<string, string> tags = null)
MoonForgeErrorTracker.Instance.SetUser("user_id", new Dictionary<string, string>
{
    { "email", "email@example.com" },
    { "displayName", "DisplayName" }
});
MoonForgeErrorTracker.Instance.ClearUser();

// Set game state (attached to all error reports until changed)
// SetGameState(string sceneName = null, string gameMode = null, string levelId = null)
MoonForgeErrorTracker.Instance.SetGameState(sceneName: "Arena", gameMode: "Ranked", levelId: currentLevel);
// Add arbitrary custom game-state data — one key/value at a time
// SetGameStateData(string key, object value)
MoonForgeErrorTracker.Instance.SetGameStateData("score", playerScore);
MoonForgeErrorTracker.Instance.SetGameStateData("health", currentHealth);

// Manual breadcrumbs (auto-collected: scene changes, network requests)
// AddBreadcrumb(string message, BreadcrumbType type = BreadcrumbType.User,
//               BreadcrumbLevel level = BreadcrumbLevel.Info, string category = null)
// BreadcrumbType values: Navigation, Network, User, Debug, Error
MoonForgeErrorTracker.Instance.AddBreadcrumb("Equipped sword", BreadcrumbType.User,
    BreadcrumbLevel.Info, "inventory");
// Typed breadcrumb helpers
MoonForgeErrorTracker.Instance.AddBreadcrumb("Navigated to Shop", BreadcrumbType.Navigation);
MoonForgeErrorTracker.Instance.AddBreadcrumb("Bought item", BreadcrumbType.User);
MoonForgeErrorTracker.Instance.AddBreadcrumb("API call failed", BreadcrumbType.Network);
MoonForgeErrorTracker.Instance.AddBreadcrumb("Cache miss", BreadcrumbType.Debug);

// Manual exception capture
// CaptureException(Exception exception, ErrorLevel level = ErrorLevel.Error,
//                  Dictionary<string, string> tags = null)
try { /* risky code */ }
catch (Exception ex)
{
    MoonForgeErrorTracker.Instance.CaptureException(ex, ErrorLevel.Error,
        new Dictionary<string, string> { { "context_key", "value" } });
}

// Capture a custom message (not tied to an exception)
MoonForgeErrorTracker.Instance.CaptureMessage("Something unexpected", ErrorLevel.Warning);

// Flush pending data before app quit
MoonForgeErrorTracker.Instance.Flush();
```

### Network Error Tracking

```csharp
using MoonForge.ErrorTracking.Capture;
using UnityEngine.Networking;

// Option A: Extension method (simplest — just replace SendWebRequest)
var request = UnityWebRequest.Get("https://api.example.com/data");
yield return request.SendWithTracking();  // auto-tracks errors >= threshold

// Option B: Tracked request with label (for filtering in dashboard)
// NetworkErrorInterceptor is a static class — call its methods directly (no .Instance)
yield return NetworkErrorInterceptor.SendTrackedRequest(
    request, "leaderboard_fetch");

// Option C: Manual error reporting (when not using UnityWebRequest)
NetworkErrorInterceptor.ReportError(
    "https://api.example.com/data", 500, "Internal Server Error",
    "GET", "api_data_fetch");
```

### Enums

```csharp
// Error severity
enum ErrorLevel { Info, Warning, Error, Fatal }

// Breadcrumb categories
enum BreadcrumbType { Navigation, Network, User, Debug, Error }

// Breadcrumb severity
enum BreadcrumbLevel { Debug, Info, Warning, Error, Fatal }
```

## Implementation Process

For each row in the **instrumentation manifest** (or each event in selected tiers):

See `references/telemetry-implement.md` for locked economy/revenue recipes.

### 1. Find the Right File and Method

Use the game profile from moonforge-analyze to locate where each event should fire. Read the script, find the exact method where the event logically occurs. Prefer hooking at the point of state change, not UI display.

### 2. Check for Existing Imports

If missing, add at the top of the file (outside any namespace block):
- `using MoonForge.ErrorTracking.Analytics;` — for TrackEvent, TrackScreenView, Identify, SetUserProperty
- `using MoonForge.ErrorTracking;` — for MoonForgeErrorTracker, AddBreadcrumb, CaptureException, SetGameState, SetUser
- `using MoonForge.ErrorTracking.Capture;` — for NetworkErrorInterceptor, SendWithTracking
- `using System.Collections.Generic;` — for Dictionary

Only add the imports actually needed for the calls being written.

### 3. Write the Calls

Place calls at the logical point where the event occurs:

```csharp
public void OnLevelComplete(int stars)
{
    // ... existing game logic ...

    MoonForgeAnalytics.TrackEvent("level_completed", new Dictionary<string, object>
    {
        { "level_id", currentLevel.id },
        { "score", currentScore },
        { "stars", stars },
        { "time_seconds", elapsedTime }
    });

    // ... rest of existing logic ...
}
```

### 4. Implement Additional SDK Features (if recommended)

Based on moonforge-events recommendations, also implement:

**Identify** — Call after login/signup:
```csharp
public void OnLoginSuccess(User user)
{
    MoonForgeAnalytics.Identify(user.id, new Dictionary<string, object>
    {
        { "username", user.name },
        { "signup_date", user.createdAt }
    });
}
```

**Game State** — Set on state transitions:
```csharp
public void EnterGameplay(int levelId)
{
    MoonForgeErrorTracker.Instance.SetGameState(sceneName: "Gameplay", gameMode: "Playing",
        levelId: levelId.ToString());
}
```

**Network Tracking** — Replace `SendWebRequest()`:
```csharp
// Before:
yield return request.SendWebRequest();
// After:
yield return request.SendWithTracking();
```

**Breadcrumbs** — Add at key decision points:
```csharp
public void OnBossFightStart(string bossId)
{
    MoonForgeErrorTracker.Instance.AddBreadcrumb("Boss fight started",
        BreadcrumbType.Navigation,
        new Dictionary<string, string> { { "boss_id", bossId } });
}
```

### 5. Show Diff and Get Approval

**Always show the diff to the user before writing.** Present each file's changes as a group.

## Placement Rules

1. **After state change, before side effects** — Track after game state updates but before UI animations or scene transitions
2. **Inside the authoritative method** — Don't track in a UI callback if there's a game logic method that's the source of truth
3. **One event per logical action** — Don't fire `level_completed` in both the manager and the UI script

## Property Value Guidelines

- Use actual variable names from the game code, not hardcoded strings
- Cast to appropriate types: strings for IDs, ints/floats for numeric values
- Keep property count to 3-5 per **action** event; economy/revenue use the fixed schemas in `moonforge-events/references/telemetry-model.md`
- Use `snake_case` for property keys
- **Session / economy / revenue:** copy event names and required keys from `telemetry-model.md` verbatim — zero deviation
- **Never add these as custom properties** — the SDK auto-collects them on every event: `game`, `id` (user ID), `screen` (resolution), `language`, `url` (current scene), `title` (scene name), `referrer` (previous scene), `timestamp`, `appVersion`

## Common Mistakes

- Renaming session, economy, or revenue events (e.g. `purchase_complete`, `resource_spent`, `sessionStart`) or their required prop keys
- Using the economy `reason` as the TrackEvent name instead of `economy_transaction`
- Assuming geolocation or UTM/attribution will be added server-side — capture on the client and send locked keys from `telemetry-model.md`
- Adding TrackEvent in Update() or FixedUpdate() (fires every frame)
- Tracking in both the event source and the event listener
- Hardcoding property values instead of using game variables
- Placing `using` statement inside a namespace block
- Forgetting `System.Collections.Generic` import for Dictionary
- Writing TrackEvent calls before the SDK is in the project (see §0 — this leaves the project not compiling)
- Leaving `MoonForgeSettings` without the game id, which makes the SDK inert
- Using `MoonForge.ErrorTracking` import when only analytics is needed (or vice versa)
- Adding `SendWithTracking()` without `using MoonForge.ErrorTracking.Capture`
- Duplicating auto-collected fields (scene, device, language, timestamp) in custom properties
