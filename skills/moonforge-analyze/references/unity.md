# MoonForge Analyze — Unity

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
- Files with `Ad`, `Ads`, `Rewarded`, `Interstitial`, `AdMob`, `UnityAds` in the name
- Files containing currency/economy: `Coin`, `Gold`, `Gem`, `Currency`, `Inventory`, `Wallet`
- Files containing `Score`, `Achievement`, `Leaderboard`
- Files with `Tutorial`, `Onboarding` in the name
- Files containing `UI`, `Menu`, `HUD`, `Canvas`, `Modal`, `Popup`
- Files with `Save`, `Load`, `Progress`, `Login`, `Account`, `Auth` in the name

Read each to understand what the game does — don't just list them.

While scanning, build **Instrumentation Targets** rows for implement:
- **IAP** — `ProcessPurchase`, `IStoreListener`, shop buy handlers
- **Ads** — rewarded/interstitial show/complete callbacks
- **Economy** — wallet/inventory mutate methods (suggest `economy_transaction` + `reason`)
- **Attribution** — launch/deep-link entry (`Application.absoluteURL`, first scene boot)
- **Actions** — level/round/quest win/fail handlers discovered in core systems

```
- **Monetization** — IAP only, ads only, both, or none
- **Economy resources** — currency/item type names found (or "unknown" / "none")
- **Accounts** — login/auth/profile present? yes/no
- **UI surfaces** — major menus, modals, store/payment overlays beyond scenes

### 4. Check Existing Analytics

```bash
# Check if MoonForge SDK is already instrumented
grep -r "MoonForgeAnalytics" Assets/ --include="*.cs" -l
grep -r "TrackEvent\|TrackScreenView\|Identify" Assets/ --include="*.cs" -l
```

Also check for existing error tracking usage:

```bash
# Check for error tracking and breadcrumb usage
grep -r "MoonForgeErrorTracker\|AddBreadcrumb\|CaptureException\|SendWithTracking" Assets/ --include="*.cs" -l
```

### 5. Check SDK Configuration

Look for `MoonForgeSettings` asset in the project:

```bash
# Find MoonForgeSettings ScriptableObject
find Assets/ -name "MoonForgeSettings*" -type f
```

If found, note the configuration: `gameId`, `enabled`, `enableAnalytics`, `trackSceneViewsAutomatically`, `sessionTimeoutSeconds`, `enableNetworkErrorTracking`. These affect which P0 events are auto-tracked.

### 6. Infer Game Genre

Based on scripts found, classify the game:
- **Casual/Puzzle** — match-3, word games, simple tap mechanics
- **Action/Arcade** — platformer, shooter, runner
- **RPG/Adventure** — character progression, quests, inventory
- **Strategy/Simulation** — resource management, building
- **Multiplayer** — lobbies, matchmaking, leaderboards
- **Hyper-casual** — minimal UI, one mechanic, ad-driven

### 7. Check for Network Requests

Look for `UnityWebRequest` usage — these can benefit from `SendWithTracking()` or `NetworkErrorInterceptor`:

```bash
grep -rn "UnityWebRequest" Assets/ --include="*.cs" -l
```

### 8. Output Game Profile

Present findings to user as structured summary:

```
## Game Profile: [Game Name]

**Game ID:** [from .moonforge.json or user-provided]
**Genre:** [inferred]
**Scenes:** [ordered list with flow arrows]
**Core Systems:** [list of key MonoBehaviours with descriptions]
**Monetization:** [none | IAP | ads | both]
**Economy Resources:** [list of currencies/items detected, or "none" / "unknown"]
**Accounts:** [yes | no]
**UI Surfaces:** [major menus/modals/store beyond scenes, or "scenes only"]
**Existing Analytics:** [any TrackEvent calls found, or "None"]
**Existing Error Tracking:** [any CaptureException/AddBreadcrumb calls, or "None"]
**Network Requests:** [scripts using UnityWebRequest, or "None"]
**SDK Status:** [installed/not installed]
**SDK Config:** [key settings if MoonForgeSettings found]

**Instrumentation Targets:** (for implement — file + method + suggested events)
| System | File | Method / hook | Suggested events |
|--------|------|---------------|------------------|
| [IAP / ads / economy / attribution / actions] | | | |
```

## Common Mistakes

- Scanning `Library/` or `Temp/` folders (Unity cache, ignore these)
- Missing `Packages/` folder scripts that may contain game logic
- Not reading `EditorBuildSettings.asset` for scene order
- Listing files without understanding what they do
- Not checking for existing error tracking alongside analytics
