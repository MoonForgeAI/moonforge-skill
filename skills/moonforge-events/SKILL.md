---
name: moonforge-events
description: Use when recommending analytics events for a Unity game, organizing them by priority tier (P0-P3) based on game profile analysis
---

# MoonForge Events

## Overview

Recommend analytics events organized by priority tier, tailored to the specific game based on the game profile from moonforge-analyze.

## When to Use

- After moonforge-analyze has produced a game profile
- When user wants event recommendations for their Unity game
- When `/moonforge` orchestrator calls this as second step

## Priority Tiers

| Tier | Purpose | Instrumentation |
|------|---------|-----------------|
| P0 | Session health | Auto-tracked by SDK — no code needed |
| P1 | Core loop | Must implement — essential for retention |
| P2 | Engagement depth | Should implement — reveals behavior patterns |
| P3 | Advanced analytics | Optional — for mature games with specific questions |

## P0: Auto-Tracked (No Action Needed)

The MoonForge SDK automatically tracks these when initialized:
- `session_start` — with session_id
- `session_end` — with session_id, duration_seconds
- Scene changes — via `SceneManager.sceneLoaded` (TrackScreenView)

Tell the user these are already covered.

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
|-------|-----------|-----------------|
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
| `error_occurred` | error_type, message, context | Error tracking |

## Presentation Format

Present events to user grouped by tier:

```
## Recommended Events for [Game Name]

### P0: Auto-Tracked (already handled by SDK)
- session_start, session_end, scene changes

### P1: Core Loop (recommended)
[table of genre-specific events]

### P2: Engagement (suggested)
[table of applicable events based on game features]

### P3: Advanced (optional)
[table of applicable events]

**Which tiers would you like to implement? (e.g., "P1 and P2")**
```

## Common Mistakes

- Recommending events for systems the game doesn't have
- Not tailoring P1 events to the actual game genre
- Recommending P0 events for manual implementation (SDK handles them)
- Too many properties per event (keep to 3-5 max)
