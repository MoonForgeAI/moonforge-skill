---
name: moonforge-implement
description: Use when writing MoonForge tracking calls into a game's source based on selected event recommendations — the Unity/web SDK call, or a hand-written HTTP client on any other engine
version: 1.1.0
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
     Unity and Web are not the supported set — they are the two with a prebuilt
     SDK that saves writing the transport by hand.
   - Ambiguous (both Unity and Web markers present): ask the user which to instrument.
2. Load and follow the matching reference for the rest of this skill:
   - Unity → `references/unity.md`
   - Web → `references/web.md`
   - Generic → `references/generic.md`
