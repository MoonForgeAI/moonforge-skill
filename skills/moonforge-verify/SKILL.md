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
