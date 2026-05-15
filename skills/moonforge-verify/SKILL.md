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
- Correct namespaces used:
  - `MoonForge.ErrorTracking.Analytics` for TrackEvent, TrackScreenView, Identify, SetUserProperty
  - `MoonForge.ErrorTracking` for MoonForgeErrorTracker, AddBreadcrumb, CaptureException, SetGameState
  - `MoonForge.ErrorTracking.Capture` for NetworkErrorInterceptor, SendWithTracking

### 2. Static Analysis

```bash
# Check for TrackEvent in Update loops (performance issue)
grep -rn "void Update\|void FixedUpdate\|void LateUpdate" Assets/ --include="*.cs" -A 10 | grep "TrackEvent"

# Verify using statements exist in all files with analytics calls
for f in $(grep -rl "TrackEvent\|TrackScreenView\|Identify\|SetUserProperty" Assets/ --include="*.cs"); do
  if ! grep -q "using MoonForge.ErrorTracking.Analytics" "$f"; then
    echo "MISSING IMPORT (Analytics): $f"
  fi
done

# Verify using statements exist in all files with error tracking calls
for f in $(grep -rl "MoonForgeErrorTracker\|AddBreadcrumb\|CaptureException\|CaptureMessage\|SetGameState\|SetUser" Assets/ --include="*.cs"); do
  if ! grep -q "using MoonForge.ErrorTracking" "$f"; then
    echo "MISSING IMPORT (ErrorTracking): $f"
  fi
done

# Verify using statements exist in all files with network tracking calls
for f in $(grep -rl "SendWithTracking\|NetworkErrorInterceptor\|SendTrackedRequest" Assets/ --include="*.cs"); do
  if ! grep -q "using MoonForge.ErrorTracking.Capture" "$f"; then
    echo "MISSING IMPORT (Capture): $f"
  fi
done

# Check for duplicate auto-collected properties
grep -rn "TrackEvent" Assets/ --include="*.cs" | grep -i '"game"\|"id"\|"screen"\|"language"\|"url"\|"title"\|"referrer"\|"timestamp"'
```

### 3. Event Inventory

List all instrumented calls:

```bash
grep -rn "TrackEvent\|TrackScreenView\|Identify\|SetUserProperty\|AddBreadcrumb\|CaptureException\|SetGameState\|SendWithTracking" Assets/ --include="*.cs"
```

Present as summary table:

```
## Analytics Events
| Event | File | Line | Properties |
|-------|------|------|------------|
| level_completed | LevelManager.cs | 45 | level_id, score, stars, time_seconds |

## Error Tracking
| Call | File | Line | Context |
|------|------|------|---------|
| SetGameState | GameManager.cs | 23 | "Playing" with level_id |
| AddBreadcrumb | BossController.cs | 67 | Boss fight started |
| SendWithTracking | ApiClient.cs | 34 | Leaderboard fetch |
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

**Collector rate limits (for reference):**
- Global: 50,000 events/minute
- Per game: 1,000 events/minute
- Per session: 100 events/minute

If rate-limited, events return HTTP 429. The SDK queues and retries automatically.

### 5. Present Results

```
## Verification Results

### Compilation: [PASS/FAIL]
[details of any errors]

### Static Analysis: [PASS/FAIL]
- TrackEvent in Update loops: [PASS/issues found]
- Missing imports: [PASS/issues found]
- Duplicate auto-collected properties: [PASS/issues found]

### Event Inventory: [N analytics events + M error tracking calls across K files]

### Collector: [PASS/SKIP]
[ping result or skipped reason]
```

## Common Mistakes

- Not checking the right Unity log path for the OS
- Missing that compilation errors only show up after Unity reimports
- Assuming events reach the collector without checking debug logs
- Not verifying all three import namespaces (Analytics, ErrorTracking, Capture)
- Forgetting to check for `System.Collections.Generic` import when Dictionary is used
