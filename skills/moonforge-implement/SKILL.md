---
name: moonforge-implement
description: Use when writing MoonForgeAnalytics.TrackEvent() calls into Unity C# scripts based on selected event recommendations
---

# MoonForge Implement

## Overview

Write `MoonForgeAnalytics.TrackEvent()` calls into the correct locations in Unity C# scripts. Shows diffs for user approval before writing.

## When to Use

- After user has selected event tiers from moonforge-events
- When manually instrumenting specific events in a Unity game
- When `/moonforge` orchestrator calls this as third step

## SDK API Reference

Namespace: `MoonForge.ErrorTracking.Analytics`

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

## Implementation Process

For each event in the selected tiers:

### 1. Find the Right File and Method

Use the game profile from moonforge-analyze to locate where each event should fire. Read the script, find the exact method where the event logically occurs. Prefer hooking at the point of state change, not UI display.

### 2. Check for Existing Imports

If missing, add at the top of the file (outside any namespace block):
- `using MoonForge.ErrorTracking.Analytics;`
- `using System.Collections.Generic;` (for Dictionary)

### 3. Write the TrackEvent Call

Place the call at the logical point where the event occurs:

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

### 4. Show Diff and Get Approval

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
