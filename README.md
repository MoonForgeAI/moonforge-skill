# MoonForge Skill for Claude Code

**Version 1.2.0**

An interactive Claude Code skill package that instruments any game with
[MoonForge](https://moonforge.co) analytics and error tracking — whatever engine
it runs on.

## What It Does

The skill analyzes your game, recommends analytics events by priority tier,
instruments the tracking calls, and verifies they compile and reach the
collector.

**Any engine works.** MoonForge's collector is a plain HTTP endpoint, so
anything that can send an HTTP POST can be instrumented:

| Your project | What the skill writes |
|---|---|
| **Unity** | A C# SDK generated into `Assets/MoonForge/`, plus `TrackEvent()` calls |
| **Web** (Phaser, Three.js, Babylon, PlayCanvas, Kaboom, …) | A generated local JS SDK, plus `trackEvent` and error calls |
| **Anything else** — Godot, Unreal, LÖVE, Bevy, MonoGame, a custom C++ engine, a game server | A full SDK generated into your project in your language, plus the calls |

**Nothing has to be installed first.** Every project ends up with an SDK inside
it — web copies the one bundled with the skill, Unity and every other engine get
one generated in their own language, all meeting the same contract. The skill
never writes a tracking call against an SDK that is not in the project.

### Skills Included

| Skill | Command | Purpose |
|-------|---------|---------|
| **Orchestrator** | `/moonforge` | Full guided flow: analyze → events → implement → verify |
| **Analyze** | `/moonforge:analyze` | Scan project structure, scenes, and scripts |
| **Events** | `/moonforge:events` | Recommend events by priority tier (P0-P3) |
| **Implement** | `/moonforge:implement` | Write the tracking calls into your source |
| **Verify** | `/moonforge:verify` | Check compilation and collector endpoint |
| **Uninstall** | `/moonforge-uninstall` | Remove all MoonForge code from a game (SDK, calls, config), optional server deregistration |

### Web games

For web games (Phaser, Babylon.js, Three.js, PlayCanvas, Kaboom, Excalibur, etc.), the skill follows the same analyze → events → implement → verify flow. The `/moonforge` skill generates a local MoonForge Web SDK, then instruments `trackEvent` and error calls into your JavaScript/TypeScript code. The generated SDK posts events to `https://collector.moonforge.co`.

### Every other engine

Same flow, same result. The skill **generates an SDK into your project in your
own language** — Godot GDScript,
Unreal C++, Rust, Lua, C#, whatever the game is written in — then instruments
your events through it.

The generated SDK is held to an explicit contract:
session lifecycle (start, end, inactivity re-engagement), a persistent player
id, `identify` with pre-identify event buffering, user properties, screen views,
and a fire-and-forget transport that can never throw into your game loop. So
P0 session events are automatic here too — you instrument P1 and up.

One thing the skill handles that is easy to get wrong by hand: the collector
drops traffic its bot filter flags **while still returning HTTP 200**, so a
misconfigured client fails invisibly. Unity, Unreal and Godot are allowlisted;
anything else needs a browser-shaped User-Agent. The generated SDK sets it and
`/moonforge:verify` checks it.

### Uninstalling

`/moonforge-uninstall` reverses `/moonforge`: it inventories every MoonForge file
and tracking call in the project, removes them with reviewable diffs (git-safe),
optionally deregisters the game from your MoonForge account, and verifies the
game still builds. Already-collected analytics data is retained server-side.

## Installation

### One-Line Install (Recommended)

```bash
git clone https://github.com/MoonForgeAI/moonforge-skill.git /tmp/moonforge-skill && cp -r /tmp/moonforge-skill/skills/* ~/.claude/skills/ && rm -rf /tmp/moonforge-skill && echo "MoonForge skill installed successfully"
```

### Manual Install

1. Clone this repository:
   ```bash
   git clone https://github.com/MoonForgeAI/moonforge-skill.git
   ```

2. Copy the skills into your Claude Code skills directory:
   ```bash
   cp -r moonforge-skill/skills/* ~/.claude/skills/
   ```

3. Verify installation — the skills should appear in your next Claude Code session.

### Uninstall

```bash
rm -rf ~/.claude/skills/moonforge ~/.claude/skills/moonforge-analyze ~/.claude/skills/moonforge-events ~/.claude/skills/moonforge-implement ~/.claude/skills/moonforge-verify ~/.claude/skills/moonforge-uninstall
```

## Usage

### Full Guided Flow

Open Claude Code in your game's directory and run:

```
/moonforge
```

The skill will:
1. Detect your engine and ask for your MoonForge game ID (or read it from `.moonforge.json` if present)
2. Scan your game to understand its structure
3. Recommend events organized by priority (P0 = auto-tracked, P1 = core loop, P2 = engagement, P3 = advanced)
4. Let you pick which tiers to implement
5. Write the actual tracking calls into your source (with diff approval)
6. Verify compilation and event delivery

No prerequisites — the skill asks you for everything it needs.

### Pass Game ID Directly

If you already know your game ID (useful when another agent is doing the work):

```
/moonforge 550e8400-e29b-41d4-a716-446655440000
```

### Run Individual Steps

```
/moonforge:analyze     # Just scan and profile the game
/moonforge:events      # Just get event recommendations
/moonforge:implement   # Just write TrackEvent calls
/moonforge:verify      # Just verify instrumentation
```

## Event Priority Tiers

| Tier | What | Examples |
|------|------|---------|
| **P0** | Session health (auto-tracked by the SDK on every platform) | session_start, session_end, scene changes |
| **P1** | Core loop events | level_completed, player_died, game_over |
| **P2** | Engagement events | tutorial_step, achievement_unlocked, settings_changed |
| **P3** | Advanced analytics | ad_impression, iap_completed, ab_variant_assigned |

## SDK API Reference (Unity)

For web, see `skills/moonforge-implement/references/web.md`. For any other engine,
see `skills/moonforge-implement/references/generic.md`, which documents the wire
protocol these SDKs speak.

### Analytics

```csharp
using MoonForge.ErrorTracking.Analytics;
using System.Collections.Generic;

// Track a custom event
MoonForgeAnalytics.TrackEvent("event_name", new Dictionary<string, object>
{
    { "level_id", currentLevel },
    { "score", playerScore }
});

// Track a screen view
MoonForgeAnalytics.TrackScreenView("MainMenu");

// Identify a user
MoonForgeAnalytics.Identify("user_123", new Dictionary<string, object>
{
    { "plan", "premium" }
});

// Set persistent user property
MoonForgeAnalytics.SetUserProperty("player_level", 42);
```

### Error Tracking

```csharp
using MoonForge.ErrorTracking;

// Set user context for error reports
MoonForgeErrorTracker.Instance.SetUser("user_id", "email", "DisplayName");

// Set game state (attached to error reports)
MoonForgeErrorTracker.Instance.SetGameState("Playing", new Dictionary<string, object>
{
    { "level_id", 5 }
});

// Manual breadcrumbs for debugging context
MoonForgeErrorTracker.Instance.AddBreadcrumb("Boss fight started",
    BreadcrumbType.Navigation,
    new Dictionary<string, string> { { "boss_id", "dragon_01" } });

// Capture exceptions manually
MoonForgeErrorTracker.Instance.CaptureException(ex, ErrorLevel.Error,
    new Dictionary<string, object> { { "context", "inventory_load" } });
```

### Network Error Tracking

```csharp
using MoonForge.ErrorTracking.Capture;

// Replace SendWebRequest() with SendWithTracking() — auto-tracks errors
yield return request.SendWithTracking();

// Or use labeled tracked requests
yield return NetworkErrorInterceptor.Instance.SendTrackedRequest(request, "api_fetch");
```

## Repository Structure

```
moonforge-skill/
├── README.md
├── CHANGELOG.md
├── skills/
│   ├── moonforge/SKILL.md                # Orchestrator entry point (/moonforge)
│   ├── moonforge-analyze/SKILL.md        # Project scanner
│   ├── moonforge-events/SKILL.md         # Event recommender
│   ├── moonforge-implement/SKILL.md      # Code writer
│   ├── moonforge-verify/SKILL.md         # Verification
│   └── moonforge-uninstall/SKILL.md      # Removal
```

Each skill carries `references/unity.md`, `references/web.md`, and
`references/generic.md` — the per-platform detail for that step.

## Versioning

Every `SKILL.md` declares a `version:` in its frontmatter, matching the
`version` in `package.json` and the release tag. To check what you have
installed:

```bash
grep -h "^version:" ~/.claude/skills/moonforge/SKILL.md
```

If that prints nothing, you are on a pre-1.0.0 copy from before versioning
existed — reinstall with the one-line command above.

`/moonforge` also checks for a newer version itself at the start of every run
(Step 1 of its process flow) and offers to update if one is available. The
check is best-effort — it never blocks the run if GitHub is unreachable — and
it only asks; it never installs anything without your say-so.

See [CHANGELOG.md](CHANGELOG.md) for what changed between versions.

## License

MIT
