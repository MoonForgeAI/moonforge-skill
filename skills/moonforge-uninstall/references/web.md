# MoonForge Uninstall — Web

## 1. Discover the footprint (read-only)

Run these from the project root (exclude `node_modules/`, `dist/`, `build/`,
`.next/`, `.git/`):

```bash
# SDK files (module folder or legacy global bundle)
find . -path ./node_modules -prune -o -type d -name "moonforge" -print
find . -path ./node_modules -prune -o -type f -name "moonforge*.js" -print

# Init wiring, imports, script tags
grep -rn "MoonForgeAnalytics.init\|from ['\"].*moonforge\|import.*MoonForge" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --include="*.html" . | grep -vE 'node_modules|/dist/|/build/|/\.next/'

# Every call site (analytics + errors)
grep -rn "MoonForgeAnalytics\.\|MoonForgeErrorTracker\." --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --include="*.html" . | grep -vE 'node_modules|/dist/|/build/|/\.next/'

# Config
ls .moonforge.json MOONFORGE_EVENTS.md 2>/dev/null
```

Present the inventory grouped as: **SDK files** / **bootstrap wiring** /
**analytics calls** / **error-tracking calls** / **config**. Classify each call
site as *side-effect* (deletable) or *value-using* (flag for manual review —
e.g. `getDistinctId()`, `getSessionId()`, `getGameState()`, `getBreadcrumbs()`
results that are assigned or passed onward).

## 2. Remove (per-file diffs, approval each)

- Delete the SDK: the copied module folder (e.g. `src/moonforge/` containing
  `core.js`, `context.js`, `analytics.js`, `errors.js`, `index.js`) or the
  single `moonforge.global.js` / `js/moonforge.js`.
- Entry HTML: remove the `<script src=".../moonforge...js"></script>` tag and any
  inline `<script>MoonForgeAnalytics.init({...})</script>` block.
- Bootstrap file: remove the `import { MoonForgeAnalytics } ...` line and the
  `MoonForgeAnalytics.init({...})` statement.
- Each side-effect call statement (`trackEvent`, `trackScreenView`, `identify`,
  `setUserProperty`, `addBreadcrumb`, `captureException`, `captureMessage`,
  `captureNetworkError`, `setUser`, `setGameState`, ...): delete the statement
  line(s). If a surrounding block becomes empty (e.g. a now-empty `try/catch`
  or handler), clean it up and show that in the diff.
- Delete `.moonforge.json` and `MOONFORGE_EVENTS.md` (if present) — a doc
  describing events that no longer exist is actively misleading, not just clutter.
- Leave every flagged value-using reference in place; list them at the end.

## 3. Verify

```bash
# Zero references (report any hits with file:line)
grep -rn -i "moonforge" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --include="*.html" --include="*.json" . | grep -vE 'node_modules|/dist/|/build/|/\.next/'

# Build still passes — use what the project has, in this order:
npm run build          # if a build script exists
npx tsc --noEmit       # if tsconfig.json exists
node --check <each modified .js file>   # fallback
```

If the build fails on a removal-related error, show the error, fix the removal
(not the game logic), and re-verify.

## Common mistakes

- Deleting a `const x = MoonForge...` line whose variable is used later (breaks
  the build) — that is exactly what the value-using flag is for.
- Missing the inline `init` `<script>` block in the entry HTML of legacy games.
- Forgetting `.moonforge.json`, `MOONFORGE_EVENTS.md`, or the `moonforge/` folder itself.
- Grepping inside `node_modules/` or `dist/` and "finding" bundled copies.
