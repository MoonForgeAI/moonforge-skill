---
name: moonforge-implement
description: Use when putting the MoonForge SDK into a game and writing tracking calls against it — copies the bundled SDK on web, generates one on Unity and every other engine, then instruments the selected events
version: 1.5.0
---

# MoonForge Implement

## Overview

Put the MoonForge SDK into the project (generate or copy), then write tracking
calls for the events the user selected from moonforge-events. Show diffs for
approval before writing. Can also implement Identify, breadcrumbs, game state,
network tracking, and exception capture.

**Canonical names:** Session, economy, and revenue event names and required
property keys are **immutable** across every game. Before writing any of those
calls, read `../moonforge-events/references/telemetry-model.md` and copy strings
verbatim. Never invent aliases (`purchase_complete`, `resource_spent`,
`sessionStart`, etc.). Economy is always `economy_transaction` with `reason` as
a property — never the event name. Game **action** names may vary by game.

## When to Use

- After user has selected event tiers from moonforge-events
- When manually instrumenting specific events in a game
- When `/moonforge` orchestrator calls this as third step

## Platform routing

1. Determine the platform (the `/moonforge` orchestrator passes it; if absent, detect):
   - **Unity** — `Assets/` and `ProjectSettings/ProjectSettings.asset` present.
   - **Web** — `package.json` with a game framework dependency (`phaser`, `pixi.js`,
     `three`, `@babylonjs/core`, `playcanvas`, `kaboom`, `excalibur`, `matter-js`),
     or an `index.html` referencing a game bundle / `<canvas>`.
   - **Any other engine** — `generic`. Godot, Unreal, LÖVE, Bevy, MonoGame, a
     custom C++ engine, or a game server all qualify. MoonForge's collector is a
     plain HTTP endpoint, so anything that can send an HTTP POST is supported.
     Every platform ends up with an SDK inside the project: web copies the
     bundled one, Unity and everything else have one generated.
   - Ambiguous (both Unity and Web markers present): ask the user which to instrument.
2. Read `references/sdk-contract.md`. It applies to every platform: the SDK goes
   into the project BEFORE any tracking call is written, and it must implement
   the full capability list — session lifecycle, pre-identify buffering,
   persistent identity — not just `track_event`.

   Never instrument against an SDK that is not in the project. Doing so leaves
   the user with code that does not compile and a job half done.

3. Load and follow the matching reference for the rest of this skill:
   - Unity → `references/unity.md` (generates C# into `Assets/MoonForge/`)
   - Web → `references/web.md` (copies the bundled SDK in)
   - Generic → `references/generic.md` (generates in the project's language)

4. When writing session / economy / revenue calls, use **only** the locked
   catalog in `../moonforge-events/references/telemetry-model.md`.

5. **Client-only context:** When generating or extending the SDK / init path,
   capture geo/timezone and attribution (UTM, click IDs, deep link, install
   referrer, persisted first-touch) on the device and attach the locked keys
   from `telemetry-model.md` on `session_start`. Do not rely on collector
   enrichment for these fields.
