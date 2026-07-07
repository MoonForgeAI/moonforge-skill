# MoonForge Analyze — Web

## 1. Locate the web game
Root markers: `package.json`, `index.html`, a build config (`vite.config.*`,
`webpack.config.*`, `rollup.config.*`). If `.moonforge.json` exists, read `gameId`/`gameName`.

## 2. Detect the framework
Read `package.json` dependencies and entry HTML:
- Phaser (`phaser`), PixiJS (`pixi.js`), Three.js (`three`), Babylon (`@babylonjs/core`),
  PlayCanvas (`playcanvas`), Kaboom (`kaboom`), Excalibur (`excalibur`), Matter.js (`matter-js`).
- Plain HTML5: an `index.html` with `<canvas>` and hand-written JS, no framework dep.
- React-based game: `react` present plus a game lib or a canvas component.

## 3. Map scenes / screens
- Phaser: classes extending `Phaser.Scene` (each `scene.key` is a screen).
- State machines / screen enums / route components (SPA).
Record the flow (MainMenu → Game → GameOver).

## 4. Find core systems
Grep for game loop (`requestAnimationFrame`, `update(`, `tick(`), input handlers,
score/level managers (`score`, `level`, `wave`), shop/IAP (`shop`, `store`, `purchase`,
`checkout`), UI/HUD, save/load (`localStorage`, `save`).

## 5. Check existing analytics
Look for an existing MoonForge SDK (`MoonForgeAnalytics`, `moonforge-sdk`), or other
tools (`gtag`, `plausible`, `posthog`, `mixpanel`).

## 6. Infer genre and output the game profile
Use the SAME profile format as Unity (Game ID, Genre, Scenes/flow, Core Systems,
Existing Analytics, SDK Status), adapted to web (framework instead of Unity version).

## Common mistakes
- Scanning `node_modules/` or `dist/` (ignore).
- Treating a bundler config as game logic.
- Missing plain-`<script>` games that have no `package.json`.
