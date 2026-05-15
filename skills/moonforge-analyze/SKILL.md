---
name: moonforge-analyze
description: Use when scanning a Unity project to understand its game structure, scenes, scripts, and existing analytics before instrumenting events
---

# MoonForge Analyze

## Overview

Scan a Unity project to build a game profile — scene flow, key scripts, game genre, and existing analytics calls. This profile drives event recommendations in moonforge-events.

## When to Use

- Before recommending analytics events for a Unity game
- When `/moonforge` orchestrator calls this as first step
- When you need to understand a Unity project's structure

## Process

### 1. Locate the Unity Project

Find the Unity project root by looking for:
- `Assets/` directory
- `ProjectSettings/ProjectSettings.asset`
- `.moonforge.json` (created by `moon analytics init`)

If `.moonforge.json` exists, extract `gameId` and `gameName`.

### 2. Scan Scenes

```bash
# Find all scene files
find Assets/ -name "*.unity" -type f
```

Look at `EditorBuildSettings.asset` for the scene build order. This reveals the player flow (e.g., MainMenu → Gameplay → GameOver).

### 3. Scan Key Scripts

Search for MonoBehaviours that represent core game systems:

```bash
# Find all C# scripts
find Assets/ -name "*.cs" -type f
```

**Priority scripts to read:**
- Files containing `GameManager`, `LevelManager`, `PlayerController`
- Files with `Shop`, `Store`, `Purchase`, `IAP` in the name
- Files containing `Score`, `Achievement`, `Leaderboard`
- Files with `Tutorial`, `Onboarding` in the name
- Files containing `UI`, `Menu`, `HUD`, `Canvas`
- Files with `Save`, `Load`, `Progress` in the name

Read each to understand what the game does — don't just list them.

### 4. Check Existing Analytics

```bash
# Check if MoonForge SDK is already instrumented
grep -r "MoonForgeAnalytics" Assets/ --include="*.cs" -l
grep -r "TrackEvent\|TrackScreenView\|Identify" Assets/ --include="*.cs" -l
```

### 5. Infer Game Genre

Based on scripts found, classify the game:
- **Casual/Puzzle** — match-3, word games, simple tap mechanics
- **Action/Arcade** — platformer, shooter, runner
- **RPG/Adventure** — character progression, quests, inventory
- **Strategy/Simulation** — resource management, building
- **Multiplayer** — lobbies, matchmaking, leaderboards
- **Hyper-casual** — minimal UI, one mechanic, ad-driven

### 6. Output Game Profile

Present findings to user as structured summary:

```
## Game Profile: [Game Name]

**Game ID:** [from .moonforge.json]
**Genre:** [inferred]
**Scenes:** [ordered list with flow arrows]
**Core Systems:** [list of key MonoBehaviours with descriptions]
**Existing Analytics:** [any TrackEvent calls found, or "None"]
**SDK Status:** [installed/not installed]
```

## Common Mistakes

- Scanning `Library/` or `Temp/` folders (Unity cache, ignore these)
- Missing `Packages/` folder scripts that may contain game logic
- Not reading `EditorBuildSettings.asset` for scene order
- Listing files without understanding what they do
