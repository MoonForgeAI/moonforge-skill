---
name: moonforge
description: Use when instrumenting a Unity or web game with MoonForge analytics and error events — analyzes the game, recommends events, implements tracking calls, and verifies the setup
---

# MoonForge Analytics Instrumentation

## Overview

Interactive agent that guides Unity and web game developers through analytics instrumentation. Analyzes the game, recommends events by priority tier, writes TrackEvent calls, and verifies everything works.

## When to Use

- User wants to add analytics events to their Unity game
- User says "instrument my game" or "add analytics" for a Unity project
- Another agent receives a game ID and needs to add analytics

## Arguments

- **game_id** (optional): Pass directly to skip game detection. Example: `/moonforge 550e8400-e29b-41d4-a716-446655440000`

## Process Flow

```dot
digraph moonforge {
    "Start" [shape=doublecircle];
    "Detect Unity project" [shape=box];
    "Get game ID" [shape=box];
    "game_id provided?" [shape=diamond];
    "Use provided game_id" [shape=box];
    "moonforge-analyze" [shape=box, style=bold];
    "moonforge-events" [shape=box, style=bold];
    "User selects tiers" [shape=box];
    "moonforge-implement" [shape=box, style=bold];
    "moonforge-verify" [shape=box, style=bold];
    "Done" [shape=doublecircle];

    "Start" -> "Detect Unity project";
    "Detect Unity project" -> "game_id provided?";
    "game_id provided?" -> "Use provided game_id" [label="yes"];
    "game_id provided?" -> "Get game ID" [label="no"];
    "Use provided game_id" -> "moonforge-analyze";
    "Get game ID" -> "moonforge-analyze";
    "moonforge-analyze" -> "moonforge-events";
    "moonforge-events" -> "User selects tiers";
    "User selects tiers" -> "moonforge-implement";
    "moonforge-implement" -> "moonforge-verify";
    "moonforge-verify" -> "Done";
}
```

### Step 1: Detect Platform

Determine the `platform` for this project by checking the current directory:
- **Unity** — `Assets/` directory and `ProjectSettings/ProjectSettings.asset` present.
- **Web** — `package.json` with a game framework dependency (`phaser`, `pixi.js`,
  `three`, `@babylonjs/core`, `playcanvas`, `kaboom`, `excalibur`, `matter-js`),
  or an `index.html` referencing a game bundle / `<canvas>`.
- **Unreal** — not yet supported; if Unreal markers (`.uproject`) are found, tell the
  user this platform is planned but not currently supported.
- Ambiguous (both Unity and Web markers present): ask the user which to instrument.
- If no markers are found: ask the user for the project path and platform.

Set `platform` to the detected value (`unity` or `web`) and pass it to every sub-skill invoked below.

### Step 2: Get Game ID

Priority order:
1. Passed as argument to this skill
2. Read from `.moonforge.json` if present in project root
3. Ask the user for their MoonForge game ID

### Step 3: Analyze

**REQUIRED SUB-SKILL:** Use moonforge-analyze, passing `platform`

Scan the project and present the game profile to the user.

### Step 4: Recommend Events

**REQUIRED SUB-SKILL:** Use moonforge-events, passing `platform`

Present tiered event recommendations. Wait for user to select tiers.

### Step 5: Implement

**REQUIRED SUB-SKILL:** Use moonforge-implement, passing `platform`

For each event in selected tiers, find the right file and method, write the TrackEvent call, and show diff for approval.

### Step 6: Verify

**REQUIRED SUB-SKILL:** Use moonforge-verify, passing `platform`

Run compilation check, static analysis, and present event inventory.

## Quick Reference

| Sub-Skill | Purpose | Invocation |
|-----------|---------|------------|
| moonforge-analyze | Scan project structure | `/moonforge:analyze` |
| moonforge-events | Recommend events by tier | `/moonforge:events` |
| moonforge-implement | Write TrackEvent calls | `/moonforge:implement` |
| moonforge-verify | Check build + collector | `/moonforge:verify` |

## Full SDK API Reference

Namespace: `MoonForge.ErrorTracking.Analytics`

### Analytics (TrackEvent / TrackScreenView / Identify / SetUserProperty)

```csharp
using MoonForge.ErrorTracking.Analytics;
using System.Collections.Generic;

// Track a custom event
MoonForgeAnalytics.TrackEvent("event_name", new Dictionary<string, object>
{
    { "key", value }
});

// Track a screen view
MoonForgeAnalytics.TrackScreenView("screen_name");

// Identify a user (for games with user accounts)
MoonForgeAnalytics.Identify("user_id", new Dictionary<string, object>
{
    { "trait_key", value }
});

// Set persistent user property (included in all subsequent events)
MoonForgeAnalytics.SetUserProperty("key", value);
```

### Error Tracking (MoonForgeErrorTracker singleton)

```csharp
using MoonForge.ErrorTracking;

// Set current user for error context
// SetUser(string userId, Dictionary<string, string> tags = null)
MoonForgeErrorTracker.Instance.SetUser("user_123", new Dictionary<string, string>
{
    { "email", "user@example.com" },
    { "displayName", "UserName" }
});
MoonForgeErrorTracker.Instance.ClearUser();

// Game state context (attached to error reports)
// SetGameState(string sceneName = null, string gameMode = null, string levelId = null)
MoonForgeErrorTracker.Instance.SetGameState(sceneName: "Arena", gameMode: "Ranked", levelId: "5");
// Arbitrary custom state data — one key/value per call
MoonForgeErrorTracker.Instance.SetGameStateData("score", 1200);

// Manual breadcrumbs for debugging context
// AddBreadcrumb(string message, BreadcrumbType type = User, BreadcrumbLevel level = Info, string category = null)
MoonForgeErrorTracker.Instance.AddBreadcrumb("Player picked up item", BreadcrumbType.User,
    BreadcrumbLevel.Info, "inventory");

// Capture exceptions manually
// CaptureException(Exception, ErrorLevel level = Error, Dictionary<string, string> tags = null)
try { /* ... */ }
catch (Exception ex)
{
    MoonForgeErrorTracker.Instance.CaptureException(ex, ErrorLevel.Error,
        new Dictionary<string, string> { { "context", "inventory_load" } });
}

// Capture a custom message
MoonForgeErrorTracker.Instance.CaptureMessage("Something unexpected", ErrorLevel.Warning);

// Flush pending events before shutdown
MoonForgeErrorTracker.Instance.Flush();
```

### Network Error Tracking

```csharp
using MoonForge.ErrorTracking;
using MoonForge.ErrorTracking.Capture;

// Option A: Extension method on UnityWebRequest
var request = UnityWebRequest.Get("https://api.example.com/data");
yield return request.SendWithTracking();  // auto-tracks errors

// Option B: Manual tracked request via NetworkErrorInterceptor (static class — no .Instance)
yield return NetworkErrorInterceptor.SendTrackedRequest(
    request, "api_data_fetch");

// Option C: Manual error reporting
NetworkErrorInterceptor.ReportError(
    "https://api.example.com/data", 500, "Internal Server Error",
    "GET", "api_data_fetch");
```

### Enums

```csharp
// Error severity levels
enum ErrorLevel { Info, Warning, Error, Fatal }

// Breadcrumb categories
enum BreadcrumbType { Navigation, Network, User, Debug, Error }

// Breadcrumb severity
enum BreadcrumbLevel { Debug, Info, Warning, Error, Fatal }
```

### MoonForgeSettings (ScriptableObject in Resources/)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| gameId | string | — | MoonForge game UUID (required) |
| enabled | bool | true | Master kill switch |
| enableInEditor | bool | true | Track in Unity Editor |
| debugMode | bool | false | Verbose console logging |
| enableAnalytics | bool | true | Enable analytics pipeline |
| trackSceneViewsAutomatically | bool | true | Auto-track scene changes |
| sessionTimeoutSeconds | int | 1800 | Inactivity timeout for new session |
| maxBreadcrumbs | int | 50 | Ring buffer size for breadcrumbs |
| enableNetworkErrorTracking | bool | true | Track UnityWebRequest errors |
| errorStatusCodeThreshold | int | 400 | HTTP status >= this is an error |
| captureConnectionErrors | bool | true | Track DNS/TLS/connection failures |
| captureHttpErrors | bool | true | Track HTTP error responses |
| addBreadcrumbsForAllRequests | bool | false | Breadcrumb every request, not just errors |

## Auto-Tracked (P0) — No Code Needed

The SDK automatically tracks when initialized:
- `session_start` — on init with `{ session_id }`
- `session_end` — on shutdown with `{ session_id, duration_seconds }`
- Session re-engagement after `sessionTimeoutSeconds` of inactivity
- Scene changes via `TrackScreenView` on `SceneManager.sceneLoaded`
- Unhandled exceptions, Unity log errors, native crashes (separate error pipeline)

**Auto-collected fields on EVERY event (never duplicate in custom properties):**
`game`, `id` (user UUID), `screen` (resolution), `language`, `url` (current scene), `title` (scene name), `referrer` (previous scene), `timestamp`

## .moonforge.json Format

```json
{
  "accountId": "uuid",
  "accountName": "Team Name",
  "gameId": "uuid",
  "gameName": "My Game",
  "sdkConfigured": true
}
```
