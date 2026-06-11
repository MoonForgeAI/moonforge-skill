---
name: moonforge-implement
description: Use when writing MoonForgeAnalytics.TrackEvent() calls into Unity C# scripts based on selected event recommendations
---

# MoonForge Implement

## Overview

Write `MoonForgeAnalytics.TrackEvent()` calls into the correct locations in Unity C# scripts. Shows diffs for user approval before writing. Can also implement Identify, breadcrumbs, game state, network tracking, and exception capture.

## When to Use

- After user has selected event tiers from moonforge-events
- When manually instrumenting specific events in a Unity game
- When `/moonforge` orchestrator calls this as third step

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

For each event in the selected tiers:

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
- Keep property count to 3-5 per event
- Use `snake_case` for property keys
- **Never add these as custom properties** — the SDK auto-collects them on every event: `game`, `id` (user ID), `screen` (resolution), `language`, `url` (current scene), `title` (scene name), `referrer` (previous scene), `timestamp`

## Common Mistakes

- Adding TrackEvent in Update() or FixedUpdate() (fires every frame)
- Tracking in both the event source and the event listener
- Hardcoding property values instead of using game variables
- Placing `using` statement inside a namespace block
- Forgetting `System.Collections.Generic` import for Dictionary
- Not checking if the SDK is installed (look for MoonForgeSettings asset)
- Using `MoonForge.ErrorTracking` import when only analytics is needed (or vice versa)
- Adding `SendWithTracking()` without `using MoonForge.ErrorTracking.Capture`
- Duplicating auto-collected fields (scene, device, language, timestamp) in custom properties
