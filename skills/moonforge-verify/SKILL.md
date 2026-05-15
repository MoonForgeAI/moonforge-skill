---
name: moonforge-verify
description: Use when verifying that MoonForge analytics instrumentation compiles correctly and events reach the collector endpoint
---

# MoonForge Verify

## Overview

Verify that instrumented analytics events compile without errors and (optionally) reach the MoonForge collector endpoint.

## When to Use

- After moonforge-implement has written TrackEvent calls
- When user wants to verify their analytics setup
- When `/moonforge` orchestrator calls this as final step

## Verification Steps

### 1. Compilation Check

Check that all modified C# files compile. If Unity Editor is running, check the console log:

```bash
# macOS
tail -100 ~/Library/Logs/Unity/Editor.log | grep -i "error CS"
# Windows: %LOCALAPPDATA%\Unity\Editor\Editor.log
# Linux: ~/.config/unity3d/Editor.log
```

If Unity isn't running, check manually:
- All `using` statements at the top (outside namespace)
- `Dictionary<string, object>` syntax correct
- No missing semicolons or braces
- Property values reference existing variables

### 2. Static Analysis

```bash
# Check for TrackEvent in Update loops (performance issue)
grep -rn "void Update\|void FixedUpdate\|void LateUpdate" Assets/ --include="*.cs" -A 10 | grep "TrackEvent"

# Verify using statements exist in all files with TrackEvent
for f in $(grep -rl "TrackEvent\|TrackScreenView\|Identify" Assets/ --include="*.cs"); do
  if ! grep -q "using MoonForge.ErrorTracking.Analytics" "$f"; then
    echo "MISSING IMPORT: $f"
  fi
done
```

### 3. Event Inventory

List all instrumented events:

```bash
grep -rn "TrackEvent\|TrackScreenView\|Identify" Assets/ --include="*.cs"
```

Present as summary table:

```
| Event | File | Line | Properties |
|-------|------|------|------------|
| level_completed | LevelManager.cs | 45 | level_id, score, stars, time_seconds |
```

### 4. Collector Endpoint Check (Optional)

If the user can run the game in Unity Editor:

1. Ask user to enable Debug Mode in MoonForgeSettings asset
2. Ask user to play through the instrumented flow
3. Check Unity Console for `[MoonForge Analytics] Tracked event:` log messages
4. Verify collector is reachable:

```bash
curl -s -o /dev/null -w "%{http_code}" https://collect.moonforge.co/api/send
```

### 5. Present Results

```
## Verification Results

### Compilation: [PASS/FAIL]
### Static Analysis: [PASS/FAIL]
### Event Inventory: [N events across M files]
### Collector: [PASS/SKIP]
```

## Common Mistakes

- Not checking the right Unity log path for the OS
- Missing that compilation errors only show up after Unity reimports
- Assuming events reach the collector without checking debug logs
