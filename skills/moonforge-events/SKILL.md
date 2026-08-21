---
name: moonforge-events
description: Use when recommending analytics events for a game on any engine, organizing them by priority tier (P0-P3) based on game profile analysis
version: 1.4.0
---

# MoonForge Events

## Overview

Recommend analytics events organized by priority tier, tailored to the specific game based on the game profile from moonforge-analyze.

## When to Use

- After moonforge-analyze has produced a game profile
- When user wants event recommendations for their game, on any engine
- When `/moonforge` orchestrator calls this as second step

## Priority Tiers

| Tier | Purpose | Instrumentation |
|------|---------|--------------------|
| P0 | Session health | Auto-tracked by the Unity and web SDKs; **manual on every other engine** |
| P1 | Core loop | Must implement — essential for retention |
| P2 | Engagement depth | Should implement — reveals behavior patterns |
| P3 | Advanced analytics | Optional — for mature games with specific questions |

## P0: Auto-Tracked (No Action Needed)

The MoonForge SDK automatically tracks these when initialized (`MoonForgeAnalytics.Initialize()`):

> Web games: see references/web-auto-tracked.md for what the Web SDK auto-tracks.
>
> **Any other engine: see references/generic-auto-tracked.md. Nothing is
> auto-tracked there — P0 is real implementation work, and presenting it as
> already handled will leave the game with no session data at all.**

**Analytics events (via TrackEvent):**
- `session_start` — fires on init with `{ session_id }`
- `session_end` — fires on shutdown with `{ session_id, duration_seconds }`
- `session_start` (re-engagement) — fires after `sessionTimeoutSeconds` (default 1800s) of inactivity, includes `{ session_id, previous_session_id }`

**Screen views (via TrackScreenView):**
- Initial scene screen view on init
- Automatic screen view on every `SceneManager.sceneLoaded` event (when `trackSceneViewsAutomatically` is enabled, which is the default)

**Error tracking (separate system, NOT analytics events):**
- Unhandled exceptions, Unity log errors, native crashes (iOS/Android), network errors
- These go to `/api/errors` as `ErrorPayload`, not to the analytics pipeline
- Scene change breadcrumbs for error context
- Auto-collected device context: platform, OS, device model, CPU, GPU, memory, FPS, battery level, network type, thermal state

**Auto-collected payload fields on every event (do NOT duplicate in custom properties):**
- `game` — game ID from config
- `id` — distinct user ID (auto-generated UUID, persisted in PlayerPrefs)
- `screen` — device resolution (e.g. "1920x1080")
- `language` — device language code (e.g. "en")
- `url` — current scene as `scene://SceneName`
- `title` — current scene name
- `referrer` — previous scene as `scene://PreviousScene`
- `timestamp` — unix seconds
- `appVersion` — the game/app's own version at send time (e.g. `Application.version`, `package.json`'s `"version"`) — never this skill's version

**Server-side enrichment (also auto, no code needed):**
- Geolocation (country, region, city) from IP
- Session management (deterministic session IDs, 30-min visit windows)
- UTM parameters and click IDs (gclid, fbclid, etc.) if present

Tell the user P0 is fully covered — no instrumentation needed. Also tell them not to include scene, device, or language info in custom event properties since the SDK captures these automatically.

## P1: Core Loop Events (Genre-Specific)

Recommend based on game genre from the profile:

### Casual/Puzzle
| Event | Properties | Where to Hook |
|-------|-----------|---------------|
| `level_started` | level_id, difficulty | Level load method |
| `level_completed` | level_id, score, stars, time_seconds | Win condition |
| `level_failed` | level_id, reason, attempts | Fail condition |

### Action/Arcade
| Event | Properties | Where to Hook |
|-------|-----------|---------------|
| `game_started` | mode, difficulty | Game start method |
| `player_died` | cause, score, wave/level | Death handler |
| `game_over` | final_score, time_alive, enemies_killed | Game over screen |

### RPG/Adventure
| Event | Properties | Where to Hook |
|-------|-----------|---------------|
| `quest_started` | quest_id, quest_name | Quest accept |
| `quest_completed` | quest_id, time_seconds, rewards | Quest turn-in |
| `character_leveled_up` | new_level, class | XP threshold |

### Strategy/Simulation
| Event | Properties | Where to Hook |
|-------|-----------|---------------|
| `building_placed` | building_type, level, cost | Build action |
| `resource_collected` | resource_type, amount | Collection |
| `stage_completed` | stage_id, time_seconds | Stage clear |

### Hyper-casual
| Event | Properties | Where to Hook |
|-------|-----------|---------------|
| `round_started` | round_number | Round begin |
| `round_ended` | score, survived | Round end |
| `high_score` | score, previous_best | New record |

## P2: Engagement Events (Cross-Genre)

| Event | Properties | Applicable When |
|-------|-----------|--------------------|
| `tutorial_step_completed` | step_id, step_name | Game has tutorial |
| `tutorial_skipped` | at_step | Tutorial is skippable |
| `achievement_unlocked` | achievement_id, achievement_name | Achievement system |
| `item_equipped` | item_id, item_type, slot | Inventory/loadout system |
| `settings_changed` | setting_name, old_value, new_value | Settings screen |
| `share_clicked` | content_type, platform | Social sharing |

## P3: Advanced Events

| Event | Properties | Use Case |
|-------|-----------|----------|
| `ad_impression` | ad_type, placement, provider | Ad monetization |
| `iap_initiated` | product_id, price, currency | In-app purchases |
| `iap_completed` | product_id, price, currency, transaction_id | IAP tracking |
| `ab_variant_assigned` | experiment_id, variant | A/B testing |
| `error_occurred` | error_type, message, context | Custom error tracking |

## Beyond TrackEvent: Additional SDK Capabilities

When recommending events, also consider these SDK features that the game may benefit from:

### User Identity (for games with accounts)
```csharp
MoonForgeAnalytics.Identify("user_123", new Dictionary<string, object>
{
    { "plan", "premium" },
    { "signup_date", "2024-01-15" }
});
MoonForgeAnalytics.SetUserProperty("player_level", 42);
```
Recommend when the game has user accounts, login, or persistent profiles.

### Error Context via Breadcrumbs
```csharp
// AddBreadcrumb(string message, BreadcrumbType type = User, BreadcrumbLevel level = Info, string category = null)
MoonForgeErrorTracker.Instance.AddBreadcrumb("Entered boss fight",
    BreadcrumbType.Navigation, BreadcrumbLevel.Info, "combat");
```
Recommend when the game has complex flows where crash context would help debugging.

### Game State for Error Reports
```csharp
// SetGameState(string sceneName = null, string gameMode = null, string levelId = null)
MoonForgeErrorTracker.Instance.SetGameState(sceneName: "BossArena", gameMode: "BossFight");
// Attach arbitrary custom state — one key/value per call
MoonForgeErrorTracker.Instance.SetGameStateData("boss_id", "dragon_01");
MoonForgeErrorTracker.Instance.SetGameStateData("player_health", 45);
```
Recommend for games with distinct states (menu, playing, paused, loading) so error reports include game context.

### Network Error Tracking
```csharp
// Replace request.SendWebRequest() with:
yield return request.SendWithTracking();
```
Recommend when the game makes API calls (leaderboards, cloud saves, multiplayer, ads).

### Manual Exception Capture
```csharp
try { LoadLevel(id); }
catch (Exception ex)
{
    MoonForgeErrorTracker.Instance.CaptureException(ex, ErrorLevel.Error,
        new Dictionary<string, string> { { "level_id", id.ToString() } });
}
```
Recommend for critical code paths where you want to catch and report errors without crashing.

## Presentation Format

Present events to user grouped by tier:

```
## Recommended Events for [Game Name]

### P0: Auto-Tracked (already handled by SDK)
- session_start, session_end, scene changes
- Device context, geolocation, session management (all automatic)

### P1: Core Loop (recommended)
[table of genre-specific events]

### P2: Engagement (suggested)
[table of applicable events based on game features]

### P3: Advanced (optional)
[table of applicable events]

### Additional SDK Features to Consider
[list any applicable: Identify, breadcrumbs, game state, network tracking, exception capture]

**Which tiers would you like to implement? (e.g., "P1 and P2")**
```

## Common Mistakes

- Recommending events for systems the game doesn't have
- Not tailoring P1 events to the actual game genre
- Recommending P0 events for manual implementation (SDK handles them)
- Too many properties per event (keep to 3-5 max)
- Including auto-collected fields (scene, device, language, timestamp) as custom properties
- Not recommending Identify when the game clearly has user accounts
- Not recommending network tracking when the game has API calls
