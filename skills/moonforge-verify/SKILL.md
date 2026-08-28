---
name: moonforge-verify
description: Use when verifying that MoonForge analytics instrumentation compiles correctly and events reach the collector endpoint
version: 1.5.2
---

# MoonForge Verify

## Overview

Verify that instrumented analytics events compile without errors and (optionally) reach the MoonForge collector endpoint.

## When to Use

- After moonforge-implement has written TrackEvent calls
- When user wants to verify their analytics setup
- When `/moonforge` orchestrator calls this as final step

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
2. Load and follow the matching reference for the rest of this skill:
   - Unity → `references/unity.md`
   - Web → `references/web.md`
   - Generic → `references/generic.md`
