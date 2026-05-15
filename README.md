# MoonForge Skill for Claude Code

An interactive Claude Code skill package that guides Unity developers through analytics instrumentation using the [MoonForge](https://moonforge.co) SDK.

## What It Does

The MoonForge skill analyzes your Unity game, recommends analytics events by priority tier, writes `MoonForgeAnalytics.TrackEvent()` calls into your C# scripts, and verifies everything compiles and reaches the collector.

### Skills Included

| Skill | Command | Purpose |
|-------|---------|---------|
| **Orchestrator** | `/moonforge` | Full guided flow: analyze → events → implement → verify |
| **Analyze** | `/moonforge:analyze` | Scan Unity project structure, scenes, and scripts |
| **Events** | `/moonforge:events` | Recommend events by priority tier (P0-P3) |
| **Implement** | `/moonforge:implement` | Write TrackEvent calls into C# scripts |
| **Verify** | `/moonforge:verify` | Check compilation and collector endpoint |

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
rm -rf ~/.claude/skills/moonforge ~/.claude/skills/moonforge-analyze ~/.claude/skills/moonforge-events ~/.claude/skills/moonforge-implement ~/.claude/skills/moonforge-verify
```

## Usage

### Full Guided Flow

Open Claude Code in your Unity project directory and run:

```
/moonforge
```

The skill will:
1. Detect your Unity project and ask for your MoonForge game ID (or read it from `.moonforge.json` if present)
2. Scan your game to understand its structure
3. Recommend events organized by priority (P0 = auto-tracked, P1 = core loop, P2 = engagement, P3 = advanced)
4. Let you pick which tiers to implement
5. Write the actual TrackEvent calls into your C# scripts (with diff approval)
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
| **P0** | Session health (auto-tracked by SDK) | session_start, session_end, scene changes |
| **P1** | Core loop events | level_completed, player_died, game_over |
| **P2** | Engagement events | tutorial_step, achievement_unlocked, settings_changed |
| **P3** | Advanced analytics | ad_impression, iap_completed, ab_variant_assigned |

## SDK API Reference

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

## Repository Structure

```
moonforge-skill/
├── README.md
├── skills/
│   ├── SKILL.md                          # Orchestrator entry point
│   ├── moonforge-analyze/SKILL.md        # Project scanner
│   ├── moonforge-events/SKILL.md         # Event recommender
│   ├── moonforge-implement/SKILL.md      # Code writer
│   └── moonforge-verify/SKILL.md         # Verification
```

## License

MIT
