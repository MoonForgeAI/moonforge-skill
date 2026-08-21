---
name: moonforge-analyze
description: Use when scanning a game project on any engine to understand its structure, scenes, scripts, and existing analytics before instrumenting events
version: 1.3.0
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
