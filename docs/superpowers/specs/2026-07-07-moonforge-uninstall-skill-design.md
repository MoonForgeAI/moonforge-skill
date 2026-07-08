# MoonForge Uninstall Skill

**Date:** 2026-07-07
**Status:** Approved design — ready for implementation plan
**Scope:** `moonforge-skill` repo only

## Problem

The `moonforge-skill` package can *install* analytics instrumentation into a Unity
or web game (`/moonforge` → analyze/events/implement/verify), but there is no clean
way to *remove* it. A churned or trial customer, or a developer reverting an
experiment, is left to hand-delete the SDK, the `init` call, and every scattered
`trackEvent`/error call. Goal: a `/moonforge-uninstall` skill that removes **all**
MoonForge client-side instrumentation from a game (leaving it buildable) and
**optionally** deregisters the game server-side.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Skill shape | New top-level skill **`moonforge-uninstall`**, platform-router pattern (`references/unity.md` + `references/web.md`), consistent with the package. Self-contained (not part of the analyze→verify flow). |
| Scope | **Client-side removal** (always) **+ opt-in server cleanup**. |
| Server cleanup | Deregister the game via `DELETE /api/games/:id` (owner-authenticated). Raw collected events are **retained** — a separate owner-side purge, out of scope, documented. |
| Safety | Require a clean git tree (or offer to commit first); present a full inventory + per-file diffs; get approval before deleting. |
| Value-using references | Any MoonForge reference whose return value is *used* is **flagged for manual review**, never blindly deleted. |
| Tests | Markdown skill content — validated by structural checks + review (no code, no unit tests), like the rest of the skill package. |

## The install footprint to reverse

### Web (what `moonforge-implement/references/web.md` installs)
- SDK module folder copied into the project (e.g. `src/moonforge/` — the files
  `core.js`, `context.js`, `analytics.js`, `errors.js`, `index.js`), **or** the
  single `moonforge.global.js` for legacy `<script>` games.
- For legacy games: a `<script src=".../moonforge*.js"></script>` tag in the entry
  HTML, plus an inline `<script>MoonForgeAnalytics.init({...})</script>`.
- For module games: `import { MoonForgeAnalytics } from '.../moonforge/index.js';`
  and a `MoonForgeAnalytics.init({ gameId })` at the game bootstrap.
- Scattered `MoonForgeAnalytics.*` and `MoonForgeErrorTracker.*` calls.
- `.moonforge.json` at project root.

### Unity (what `moonforge-implement/references/unity.md` installs)
- The SDK package (UPM entry in `Packages/manifest.json` and/or an embedded
  `MoonForge.ErrorTracking` package with its `.asmdef`).
- A `MoonForgeSettings` ScriptableObject (under a `Resources/` folder).
- `using MoonForge.ErrorTracking;` / `using MoonForge.ErrorTracking.Analytics;` /
  `using MoonForge.ErrorTracking.Capture;` directives.
- The bootstrap `MoonForgeErrorTracker.Initialize(config)` call.
- Scattered `MoonForgeAnalytics.*`, `MoonForgeErrorTracker.*`,
  `NetworkErrorInterceptor.*`, and `.SendWithTracking()` calls.
- `.moonforge.json` at project root.

## Skill flow

```
Detect platform → Discover footprint (inventory) → Confirm + git safety →
Client removal (diffs + approval) → [opt-in] Server cleanup → Verify
```

### 1. Detect platform
Reuse the router rules: Unity (`Assets/` + `ProjectSettings/ProjectSettings.asset`),
Web (`package.json` game-framework dep or `index.html`+`<canvas>`), Unreal → not
supported. Ambiguous → ask. Load `references/<platform>.md`.

### 2. Discover the footprint (read-only inventory FIRST)
Grep the project (excluding `node_modules`, build output, `.git`) for the full
MoonForge surface and present a structured inventory — files, call sites, config —
**before** changing anything. Read `.moonforge.json` to capture `gameId`/`gameName`
for the optional server step.

### 3. Confirm + git safety
- If the working tree is dirty, recommend committing/stashing first (so the removal
  is a reviewable, revertible diff). Proceed only on user confirmation.
- Present the inventory and the removal plan; get explicit approval.

### 4. Client removal (with per-file diffs + approval)
- **Delete** the SDK folder (module set) or `moonforge.global.js`; delete
  `.moonforge.json`.
- **Web:** remove the `<script src=…moonforge…>` tag and any inline
  `MoonForgeAnalytics.init(...)` script; remove the `import … MoonForgeAnalytics …`
  line; delete each **side-effect** `MoonForgeAnalytics.*` / `MoonForgeErrorTracker.*`
  statement line.
- **Unity:** remove the UPM/package entry + embedded package, the `MoonForgeSettings`
  asset (and its `.meta`), the `using MoonForge.*` directives, the bootstrap
  `Initialize` call, and each side-effect call line.
- **Value-using references** (e.g. `const id = MoonForgeAnalytics.getDistinctId();`,
  or a MoonForge value passed into other logic): do **not** auto-delete — list them
  with file:line for the user to resolve manually, since removing them changes
  program behavior.
- Show a per-file diff; apply on approval.

### 5. Server cleanup (opt-in; explicit destructive confirmation)
- Offer only if a `gameId` is known. Require an explicit second confirmation.
- Needs a MoonForge auth token (the same Bearer token the CLI/session uses); if none
  is available, print the exact manual step (dashboard URL / `curl`) instead of
  proceeding.
- Call `DELETE {app_base}/api/games/{gameId}` with the auth token. On success the
  game is removed from the account/dashboard.
- **Be explicit:** this deregisters the game; **raw events already collected are
  retained** in the analytics store and are not purged by this call. Document that a
  full data purge is a separate owner-side operation (not performed by this skill).

### 6. Verify
- Grep the project → **zero** MoonForge references remain (`MoonForge`, `moonforge`,
  `.moonforge.json`, the SDK folder). Report any surviving flagged value-using
  references the user chose to keep.
- Build check: web → `npm run build` / `tsc --noEmit` / lint on touched files (as
  available); Unity → the same compile check `moonforge-verify` uses. Confirm the
  game still builds without the SDK.
- Present a removal summary (files deleted, call sites removed, server status).

## File layout (skill package changes)

```
skills/moonforge-uninstall/
  SKILL.md                       # router: detect platform → load references/<platform>.md
  references/unity.md            # Unity discovery + removal + verify
  references/web.md              # Web discovery + removal + verify
skills/moonforge/SKILL.md        # add a one-line pointer to /moonforge-uninstall
README.md                        # document the uninstall skill
```

No SDK code changes. No changes to the existing install skills beyond the
orchestrator pointer.

## Out of scope / follow-ups
- Purging raw collected events from the analytics store (owner-side data operation;
  no safe API path from a customer repo).
- A `moon games delete` CLI command (doesn't exist today) — server cleanup uses the
  web `DELETE /api/games/:id` endpoint.
- Unreal (no install support yet, so nothing to uninstall).

## Success criteria
1. `/moonforge-uninstall` in an instrumented web or Unity project detects the
   platform, inventories the full MoonForge footprint, removes it with reviewable
   diffs, and the project still builds — with **zero** MoonForge references left
   (except value-using ones explicitly flagged/kept).
2. Value-using references are never silently deleted.
3. Client removal is git-safe (clean-tree recommendation + per-file diffs +
   approval).
4. Server cleanup is opt-in, requires explicit confirmation + auth, calls
   `DELETE /api/games/:id`, and is transparent that raw event data is retained.
5. The orchestrator and README document the uninstall path.
