---
name: moonforge-events
description: Use when recommending analytics events for a game on any engine, organizing them by priority tier (P0-P3) based on game profile analysis
version: 1.6.0
---

# MoonForge Events

## Overview

Recommend analytics events organized by priority tier, tailored to the game
profile from moonforge-analyze. North star: games are in **growth** or
**maintenance**, and in both cases telemetry serves **revenue** (more paying
users or more spend per payer). Recommendations answer four player questions:

1. **Who are they?** (identity — `Identify` + account/signup events)
2. **How did we get them?** (attribution — the collector derives this
   server-side from the launch URL; nothing to capture client-side, see P0)
3. **What do they do?** (behaviour / game actions)
4. **Where in the lifecycle are they?** (`first_open` → `account_created` → revenue)

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
| P0 | Core — session, install, update, identity context | Auto-tracked by the SDK on **every** platform (Unity, web, and generated generic SDKs) |
| P1 | Revenue + FTUE + atomic game actions | Must implement — essential for revenue and retention |
| P2 | Game economy + UI gaps | Should implement when currencies/items or non-scene UI exist |
| P3 | Engagement / experiments | Optional — per-step tutorial detail, achievements, A/B, share |

Recommendations start at **P1**. P0 needs no manual instrumentation once the SDK is initialized.

## P0: Core (Auto-Tracked)

The MoonForge SDK tracks these when initialized (`MoonForgeAnalytics.Initialize()` / `init()`):

> Web: see `references/web-auto-tracked.md`.
>
> Generic engines: see `references/generic-auto-tracked.md` — P0 is auto once
> the generated SDK's `init()` runs. Present it the same as Unity/web.

**Session & lifecycle events (locked names — see telemetry-model.md):**
- `session_start` — on init with `{ session_id }`
- `session_end` — on shutdown with `{ session_id, duration_seconds }`
- `session_start` (re-engagement) — after inactivity timeout (default 1800s), same name with `{ session_id, previous_session_id }`
- `first_open` — once per device, the moment its distinct id is first created (the install signal — matches Firebase's `first_open`/GA4's `first_visit`; also re-fires on a reinstall/storage-clear for a returning player, by design, since it tracks the device/install instance, not the human)
- `app_update` — once, on a returning device's `session_start`, when `appVersion` differs from the last one seen for that device — `{ previous_version }`

**Screen views (via TrackScreenView):**
- Initial scene/screen on init
- Automatic screen view on scene load / route change when auto-tracking is enabled (default)

**Error tracking (separate system, NOT analytics events):**
- Unhandled exceptions, log errors, native crashes, network errors → `/api/errors`
- Scene change breadcrumbs; device context for errors

**Auto-collected payload fields on every event (do NOT duplicate in custom properties):**
- `game`, `id`, `screen`, `language`, `url`, `title`, `referrer`, `timestamp`, `appVersion`

**Server-side enrichment (also auto, no code needed):**
- Geolocation (`country`/`region`/`city`) from the request IP — never capture
  this on the client; the collector already derives it and does so more
  reliably than a locale-based guess.
- `utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`utm_term`/click IDs
  (`gclid`, `fbclid`, etc.) — the collector parses these straight out of the
  `url` field's own query string, for every event. The **only** thing the SDK
  must do is include the query string in `url` (don't strip it to just
  `pathname`/scene) — there is no separate attribution module to build, and
  no first-touch persistence needed: `first_open` fires before any
  client-side navigation could strip the query string, so it naturally
  carries the launch URL's campaign params if present.

**Identity & account lifecycle:** when the profile shows accounts/login,
recommend `Identify` **and** `account_created` as part of Core setup — see P1
below for `account_created`'s schema and the call-order rule with `Identify`.

Tell the user P0 is fully covered — no instrumentation needed, including
attribution. Do not recommend duplicate scene, device, or language props on
custom events.

## P1: Revenue + FTUE + Game Actions (Must Implement)

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

### FTUE & accounts (locked names — zero deviation)

| Event | Required props | Optional | When |
|-------|----------------|----------|------|
| `tutorial_start` | — | — | The FTUE begins |
| `tutorial_complete` | — | `outcome` (`completed` \| `skipped`) | The FTUE ends, however it ended |
| `account_created` | `signup_method` | `provider` | Whenever the profile shows **Accounts** — signup completes |

- `signup_method`: `email` \| `social` \| `platform` \| `guest_upgrade` \| `other`
- `provider`: free string naming which one, when `signup_method` is `social`/`platform` (e.g. `google`, `apple`, `steam`)
- **Call order:** `Identify(userId, traits)` first, **then** `TrackEvent("account_created", ...)` — two separate calls, not combined. `account_created` is the business event marking signup; `Identify` is the generic "we now know who this is" call that also drives alias reconciliation of the player's pre-signup anonymous history. Never infer signup from `Identify` alone — a returning player logging into an *existing* account on a new device also calls `Identify` for the first time on that device, and must **not** produce a spurious `account_created`.
- Per-step tutorial detail (`tutorial_step_completed` with `step_id`/`step_name`) is **not** locked — see P3. `tutorial_start`/`tutorial_complete` exist specifically so cross-game FTUE-completion-rate comparisons work even when a game's tutorial has no discrete steps at all.

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
to the game's real verbs when needed (**actions only** — never rename revenue,
economy, or FTUE/account events).

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
| `tutorial_step_completed` | step_id, step_name | Tutorial has discrete steps worth funnel analysis beyond `tutorial_start`/`tutorial_complete` |
| `achievement_unlocked` | achievement_id, achievement_name | Achievement system |
| `item_equipped` | item_id, item_type, slot | Inventory/loadout |
| `settings_changed` | setting_name, old_value, new_value | Settings screen |
| `share_clicked` | content_type, platform | Social sharing |
| `ab_variant_assigned` | experiment_id, variant | A/B or feature flags |

Revenue, economy, and FTUE/account events do **not** belong in P3.

## Beyond TrackEvent: Additional SDK Capabilities

### User Identity (for games with accounts)
```csharp
MoonForgeAnalytics.Identify("user_123", new Dictionary<string, object>
{
    { "plan", "premium" }
});
MoonForgeAnalytics.TrackEvent("account_created", new Dictionary<string, object>
{
    { "signup_method", "social" }, { "provider", "google" }
});
MoonForgeAnalytics.SetUserProperty("player_level", 42);
MoonForgeAnalytics.SetUserProperty("test_group", "variant_b");
```
Recommend `Identify` when the game has user accounts, login, persistent
profiles, or test groups; recommend `account_created` alongside it whenever
signup is a real, distinct moment (not just returning-player login).

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

North star: growth/maintenance → revenue (more payers / more spend). Identity,
attribution, behaviour, and lifecycle are all covered by locked events and
server-side enrichment — no client-side geo/attribution capture needed.

### P0: Core (SDK auto - session, install, update, screen views, server enrichment)
- session_start, session_end, first_open, app_update (locked names)
- Screen views, device context (auto)
- Geolocation + UTM/click IDs (server-side, automatic - nothing to wire)
- [Identify / test_group if accounts or experiments exist]

### P1: Revenue + FTUE + Game Actions (recommended)
[Revenue table — locked iap_* / ad_* names only, if monetization present]
[tutorial_start / tutorial_complete, account_created — if accounts/FTUE present]
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

- Assuming the client must capture geolocation or UTM/attribution — both are
  server-side and automatic; the only client requirement is not stripping the
  query string out of `url`
- Renaming session, economy, revenue, or FTUE/account events or their required prop keys
- Encoding economy `reason` as the TrackEvent name instead of `economy_transaction`
- Putting IAP/ads/FTUE/account events in P3 — they're P0/P1
- Skipping `economy_transaction` when the game has currencies/items
- Inferring `account_created` from `Identify` alone — a returning player's first `Identify` on a *new device* is a login, not a signup
- Recommending events for systems the game doesn't have
- Not discovering game actions from the profile (blind genre dump only)
- Recommending P0 events for manual re-implementation (SDK handles them)
- Too many properties on **action** events (keep to 3–5); economy/revenue/FTUE use fixed schemas
- Including auto-collected fields (scene, device, language, timestamp) as custom properties
- Hover-level UI tracking
- Not recommending Identify + account_created when the game has user accounts
- Not recommending network tracking when the game has API calls
