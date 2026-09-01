# MoonForge Verify — Unity

## 0. The SDK must be in the project

Before anything else, confirm the SDK is actually there — `Assets/MoonForge/`
(generated), a `com.moonforge.*` entry in `Packages/manifest.json`, or an
existing install. If tracking calls exist and the SDK does not, that is the
finding: the project does not compile and the instrumentation is inert. Report
it as a failure, not as "compilation failed for an unrelated reason".

Then check the generated SDK against `moonforge-implement/references/sdk-contract.md`:
idempotent `init`, session lifecycle (`Application.quitting` **and**
`OnApplicationPause` on mobile), persistent distinct id in `PlayerPrefs`,
pre-identify buffering, unix-second timestamps, swallowed transport errors, and
`appVersion` set to `Application.version` (read fresh at send time, not the
skill's own version) on every event and identify call. Also confirm the first
`Identify` call this install ever makes sends an `alias` first (linking the
`PlayerPrefs`-stored anonymous id to the real one), gated by a persistent flag
so a later `Identify` on the same install never repeats it — most players play
anonymously well past the pre-identify buffer's window before ever creating an
account, so without this every such signup becomes two unrelated player
records. An SDK implementing only `TrackEvent` looks finished while losing
sessions, identity, version, and the ability to ever reconcile them.

Confirm `first_open` fires once, on this install's first-ever `TrackEvent` of
any kind (tied to the `PlayerPrefs` distinct id being created, not to
`session_start`'s own first-ness signal — those are different things), and
`app_update` fires only on a later install where `Application.version`
differs from the value last stored, never on the same first-ever launch as
`first_open`. If any locked revenue/economy/FTUE/account event was
instrumented (`iap_*`, `ad_*`, `economy_transaction`, `tutorial_start`/
`tutorial_complete`, `account_created`), run
`moonforge-verify/references/telemetry-checks.md` — including confirming
`account_created` is never sent without a preceding `Identify` call in the
same handler, and that no client-side geo/timezone/UTM-parsing code exists
anywhere in the generated SDK (server-side, not a Unity concern).

Confirm `MoonForgeSettings` exists in a `Resources/` folder **and carries the
game id**. An SDK with no game id is inert, and this is the step most often
skipped.

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
grep -rn "TrackEvent" Assets/ --include="*.cs" | grep -i '"game"\|"id"\|"screen"\|"language"\|"url"\|"title"\|"referrer"\|"timestamp"\|"appVersion"'
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


**A 200 does not mean the event was stored.** The collector runs a bot filter on
the User-Agent and discards flagged traffic while still answering 200 — and
`curl`'s default User-Agent is flagged. Without the `-A` below, this check
reports success on an event that was thrown away. Verifying the wrong thing is
worse than not verifying.

If the user can run the game in Unity Editor:

1. Ask user to enable Debug Mode in MoonForgeSettings asset
2. Ask user to play through the instrumented flow
3. Check Unity Console for `[MoonForge Analytics] Tracked event:` log messages
4. Verify collector is reachable:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
  https://collector.moonforge.co/api/send
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
