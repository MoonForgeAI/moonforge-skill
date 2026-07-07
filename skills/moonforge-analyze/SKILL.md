---
name: moonforge-analyze
description: Use when scanning a Unity project to understand its game structure, scenes, scripts, and existing analytics before instrumenting events
---

# MoonForge Analyze

## Overview

Scan a Unity project to build a game profile — scene flow, key scripts, game genre, and existing analytics calls. This profile drives event recommendations in moonforge-events.

## When to Use

- Before recommending analytics events for a Unity game
- When `/moonforge` orchestrator calls this as first step
- When you need to understand a Unity project's structure

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
