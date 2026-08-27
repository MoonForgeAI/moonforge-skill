---
name: moonforge-events
description: Use when recommending analytics events for a game on any engine, organizing them by priority tier (P0-P3) based on game profile analysis
version: 1.5.0
---

# MoonForge Events

## Overview

Recommend analytics events organized by priority tier, tailored to the game
profile from moonforge-analyze. North star: games are in **growth** or
**maintenance**, and in both cases telemetry serves **revenue** (more paying
users or more spend per payer). Recommendations answer four player questions:

1. **Who are they?** (identity — client Identify + device props)
2. **How did we get them?** (attribution — **client-captured** UTM, click IDs, deep links, install referrer)
3. **What do they do?** (behaviour / game actions)
4. **Where in the lifecycle are they?**

**Client-only rule:** Implement game/client code only. Do **not** assume the
collector enriches geolocation, UTM, click IDs, or attribution. Capture those
on the device and send them in payloads (see `references/telemetry-model.md`).

**Hard rule — zero deviation:** Session, economy, and revenue use one global
catalog of event names and required property keys. Same strings in every game,
every engine. No synonyms, no genre renames. Game-specific meaning goes in
**properties** (e.g. economy `reason`), never in the event `name`.

Canonical registry: `references/telemetry-model.md` — **copy names and keys
verbatim**. Game actions and most UI/engagement names may vary by game.

## When to Use

- After moonforge-analyze has produced a game profile
- When user wants event recommendations for their game, on any engine
- When `/moonforge` orchestrator calls this as second step

## Priority Tiers

| Tier | Purpose | Instrumentation |
|------|---------|--------------------|
| P0 | Core — session + identity context | Auto-tracked by the SDK on **every** platform (Unity, web, and generated generic SDKs) |
| P1 | Revenue + atomic game actions | Must implement — essential for revenue and retention |
| P2 | Game economy + UI gaps | Should implement when currencies/items or non-scene UI exist |
| P3 | Engagement / experiments | Optional — tutorial, achievements, A/B, share |

Recommendations start at **P1**. P0 needs no manual instrumentation once the SDK is initialized.

## P0: Core (Auto-Tracked)

The MoonForge SDK tracks these when initialized (`MoonForgeAnalytics.Initialize()` / `init()`):

> Web: see `references/web-auto-tracked.md`.
>
> Generic engines: see `references/generic-auto-tracked.md` — P0 is auto once
> the generated SDK's `init()` runs. Present it the same as Unity/web.

**Session events (locked names — see telemetry-model.md):**
- `session_start` — on init with `{ session_id }`
- `session_end` — on shutdown with `{ session_id, duration_seconds }`
- `session_start` (re-engagement) — after inactivity timeout (default 1800s), same name with `{ session_id, previous_session_id }`

**Screen views (via TrackScreenView):**
- Initial scene/screen on init
- Automatic screen view on scene load / route change when auto-tracking is enabled (default)

**Error tracking (separate system, NOT analytics events):**
- Unhandled exceptions, log errors, native crashes, network errors → `/api/errors`
- Scene change breadcrumbs; device context for errors

**Auto-collected payload fields on every event (do NOT duplicate in custom properties):**
- `game`, `id`, `screen`, `language`, `url`, `title`, `referrer`, `timestamp`, `appVersion`

**Client context (must be sourced on the device — not “server enrichment”):**

Session management (`session_id`, start/end, inactivity re-engagement) is
already client-side in the SDK. Additionally, recommend / ensure the SDK or
init path captures and attaches locked context keys from
`telemetry-model.md`:

- **Geo / locale:** `timezone` always when available; `country` / `region` /
  `city` via client location or OS region APIs when permitted — never assume
  IP geolocation on the server
- **Attribution:** parse launch URL / deep link / install referrer for
  `utm_*`, `gclid`, `fbclid`, `attr_channel`; persist **first-touch** in local
  storage / PlayerPrefs and resend on later `session_start`
- Prefer attaching these on `session_start` (and as persistent user/session
  properties if the SDK supports merge-into-all-events)

**Identity:** when the profile shows accounts/login, recommend Identify and
user properties (including test group / feature flags) as part of Core setup —
not only as a side note.

Tell the user P0 session/screen auto-tracking is covered by the SDK, but
**client geo + attribution context still needs to be wired** if the generated/
bundled SDK does not already populate those locked keys. Do not recommend
duplicate scene, device, or language props on custom events.

## P1: Revenue + Game Actions (Must Implement)

### Revenue (locked names — zero deviation)

Whenever the profile has **Monetization: IAP / ads / both**, recommend the
applicable subset from the registry. Copy names and required keys exactly:

| Event | Required props | Optional | When |
|-------|----------------|----------|------|
| `iap_initiated` | `product_id`, `price`, `currency` | `product_name`, `store` | IAP purchase flow starts |
| `iap_completed` | `product_id`, `price`, `currency`, `transaction_id` | `product_name`, `store` | IAP succeeds |
| `ad_started` | `ad_type`, `placement` | `provider`, campaign attrs | Ad playback begins |
| `ad_completed` | `ad_type`, `placement`, `watched_fraction` | `provider`, `rewarded`, `duration_seconds` | Ad finishes / reward granted |
| `ad_impression` | `ad_type`, `placement` | `provider` | Mediation only exposes impression |

- `ad_type`: `rewarded` \| `interstitial` \| `banner` \| `other`
- `store`: prefer `app_store` \| `google_play` \| `steam` \| `web` \| `other`

Never invent aliases (`purchase`, `buy_item`, `rewarded_ad_watched`, etc.).

### Game actions (names may vary — discovery method)

Do **not** only dump a genre recipe. Discover atomic actions from the profile:

1. List player/system actions that change (or can change) player state:
   start/complete pairs (level, round, quest, match) or single-shot (kill,
   death, donate, claim reward, offered choice).
2. Prefer linked start/complete with a shared `action_id` when both exist.
3. Props = **state at action** (e.g. level, mode) and **outcome** (win/loss,
   score, choice). Keep to **3–5 props** for actions. Never duplicate auto Core fields.
4. Hook at the real win/fail/accept handlers — not Update loops.

Use genre seeds below only when they match systems that exist; rename/extend
to the game's real verbs when needed (**actions only** — never rename revenue
or economy events).

#### Genre seeds (examples, not a closed set)

**Casual/Puzzle:** `level_started` / `level_completed` / `level_failed`  
**Action/Arcade:** `game_started` / `player_died` / `game_over`  
**RPG/Adventure:** `quest_started` / `quest_completed` / `character_leveled_up`  
**Strategy/Simulation:** `building_placed` / `stage_completed` (currency moves → P2 `economy_transaction`, not a bespoke spend event)  
**Hyper-casual:** `round_started` / `round_ended` / `high_score`

## P2: Game Economy + UI Gaps (Should Implement)

### Economy (locked name — zero deviation)

If the profile lists **Economy resources** (or the game clearly has currencies /
craft / upgrade / rewards), recommend **only**:

**Event name:** `economy_transaction` (never anything else)

**Props** (omit unused slots; never rename keys):

- `reason` (required) — game-specific why (`upgrade_weapon`, `claim_login_reward`, …)
- `input_N_type`, `input_N_before`, `input_N_after` for N = 1..3
- `output_N_type`, `output_N_before`, `output_N_after` for N = 1..3
- Free reward → omit inputs; sink with no grant → omit outputs

One event per economic state change. LHS → RHS transform. Do **not** use the
reason as the TrackEvent name.

Full schema: `references/telemetry-model.md`.

### UI (beyond auto screen views)

Recommend additional screen/modal tracking only when not already covered by
auto scene/`TrackScreenView`:

- Side menus, store popup, payment SDK modals, major canvas switches
- Props via screen-view API: entered screen name (and exit is implied by next enter)
- **No** hover-level or per-component noise

## P3: Engagement / Experiments (Optional)

Recommend only systems the game has:

| Event | Properties | Applicable When |
|-------|-----------|--------------------|
| `tutorial_step_completed` | step_id, step_name | Tutorial exists |
| `tutorial_skipped` | at_step | Tutorial is skippable |
| `achievement_unlocked` | achievement_id, achievement_name | Achievement system |
| `item_equipped` | item_id, item_type, slot | Inventory/loadout |
| `settings_changed` | setting_name, old_value, new_value | Settings screen |
| `share_clicked` | content_type, platform | Social sharing |
| `ab_variant_assigned` | experiment_id, variant | A/B or feature flags |

Revenue and economy do **not** belong in P3.

## Beyond TrackEvent: Additional SDK Capabilities

### User Identity (for games with accounts)
```csharp
MoonForgeAnalytics.Identify("user_123", new Dictionary<string, object>
{
    { "plan", "premium" },
    { "signup_date", "2024-01-15" }
});
MoonForgeAnalytics.SetUserProperty("player_level", 42);
MoonForgeAnalytics.SetUserProperty("test_group", "variant_b");
```
Recommend when the game has user accounts, login, persistent profiles, or test groups.

### Error Context via Breadcrumbs
```csharp
MoonForgeErrorTracker.Instance.AddBreadcrumb("Entered boss fight",
    BreadcrumbType.Navigation, BreadcrumbLevel.Info, "combat");
```
Recommend for complex flows where crash context helps.

### Game State for Error Reports
```csharp
MoonForgeErrorTracker.Instance.SetGameState(sceneName: "BossArena", gameMode: "BossFight");
MoonForgeErrorTracker.Instance.SetGameStateData("boss_id", "dragon_01");
MoonForgeErrorTracker.Instance.SetGameStateData("player_health", 45);
```

### Network Error Tracking
```csharp
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

## Presentation Format

```
## Recommended Events for [Game Name]

North star: growth/maintenance → revenue (more payers / more spend). Telemetry
is **client-only**: identity, attribution, geo, behaviour, and lifecycle are
all captured in game/runtime code — no server enrichment assumed.

### P0: Core (SDK session/screen + client context)
- session_start, session_end (locked names)
- Screen views, device context (auto)
- Client geo/timezone + UTM/click IDs / first-touch (wire if SDK does not already)
- [Identify / test_group if accounts or experiments exist]

### P1: Revenue + Game Actions (recommended)
[Revenue table — locked iap_* / ad_* names only, if monetization present]
[Action table — discovered for this game; genre seeds only if they match]

### P2: Economy + UI (suggested)
[economy_transaction rows with reason + input/output props — if resources exist]
[Extra UI screens/modals if not auto-covered]

### P3: Engagement (optional)
[Only applicable engagement/experiment events]

### Additional SDK Features to Consider
[Identify, breadcrumbs, game state, network tracking, exception capture]

**Which tiers would you like to implement? (e.g., "P1 and P2")**
```

## Common Mistakes

- Assuming the server will add geolocation, UTM, or attribution — capture on the client
- Skipping `timezone` / campaign params because precise GPS was denied
- Inventing MMP cost/spend fields the client does not have
- Renaming session, economy, or revenue events or their required prop keys
- Encoding economy `reason` as the TrackEvent name instead of `economy_transaction`
- Putting IAP/ads in P3 — revenue is P1
- Skipping `economy_transaction` when the game has currencies/items
- Recommending events for systems the game doesn't have
- Not discovering game actions from the profile (blind genre dump only)
- Recommending P0 session events for manual re-implementation (SDK handles session lifecycle)
- Too many properties on **action** events (keep to 3–5); economy/revenue/client-context use fixed schemas
- Including auto-collected fields (scene, device, language, timestamp) as custom properties
- Hover-level UI tracking
- Not recommending Identify when the game has user accounts
- Not recommending network tracking when the game has API calls
