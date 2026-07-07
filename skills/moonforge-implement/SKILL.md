---
name: moonforge-implement
description: Use when writing MoonForgeAnalytics.TrackEvent() calls into Unity C# scripts based on selected event recommendations
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
   - Ambiguous (both present): ask the user which to instrument.
2. Load and follow the matching reference for the rest of this skill:
   - Unity → `references/unity.md`
   - Web → `references/web.md`
