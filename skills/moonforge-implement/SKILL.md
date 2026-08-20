---
name: moonforge-implement
description: Use when putting the MoonForge SDK into a game and writing tracking calls against it — copies the bundled SDK on web, generates one on Unity and every other engine, then instruments the selected events
version: 1.3.0
---

# MoonForge Implement

## Overview

Write `MoonForgeAnalytics.TrackEvent()` calls into the correct locations in Unity C# scripts. Shows diffs for user approval before writing. Can also implement Identify, breadcrumbs, game state, network tracking, and exception capture.

## When to Use

- After user has selected event tiers from moonforge-events
- When manually instrumenting specific events in a Unity game
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
