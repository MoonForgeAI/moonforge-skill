# MoonForge Uninstall — Unity

## 1. Discover the footprint (read-only)

Run these from the Unity project root (never scan `Library/`, `Temp/`, `.git/`):

```bash
# SDK package: UPM entry and/or embedded package
grep -n "moonforge\|MoonForge" Packages/manifest.json 2>/dev/null
find Packages Assets -maxdepth 3 -type d -iname "*MoonForge*" 2>/dev/null

# Settings asset (+ its .meta)
find Assets -name "MoonForgeSettings*" -not -path "*/Library/*" 2>/dev/null

# Using directives and every call site
grep -rn "using MoonForge" Assets/ --include="*.cs"
grep -rn "MoonForgeAnalytics\.\|MoonForgeErrorTracker\.\|NetworkErrorInterceptor\.\|SendWithTracking" Assets/ --include="*.cs"

# Bootstrap initialize
grep -rn "MoonForgeErrorTracker.Initialize" Assets/ --include="*.cs"

# Config
ls .moonforge.json 2>/dev/null
```

Present the inventory grouped as: **SDK package** / **settings asset** /
**bootstrap wiring** / **analytics calls** / **error-tracking calls** /
**network tracking** / **config**. Classify each call site as *side-effect*
(deletable) or *value-using* (flag for manual review — e.g.
`MoonForgeAnalytics.GetDistinctId()` assigned to a variable, or a tracked
request object reused afterward).

## 2. Remove (per-file diffs, approval each)

- SDK package: remove the MoonForge entry from `Packages/manifest.json` (and
  `Packages/packages-lock.json` if present); delete an embedded
  `MoonForge.ErrorTracking` package folder (with `.meta` files) if the SDK was
  vendored under `Packages/` or `Assets/`.
- Delete the `MoonForgeSettings` asset and its `.meta` file.
- In each instrumented `.cs` file: remove `using MoonForge.ErrorTracking;`,
  `using MoonForge.ErrorTracking.Analytics;`, `using MoonForge.ErrorTracking.Capture;`;
  remove the bootstrap `MoonForgeErrorTracker.Initialize(config)` statement and
  the `[SerializeField] private ErrorTrackerConfig config;` field if now unused;
  delete each side-effect call statement. Revert `request.SendWithTracking()`
  back to `request.SendWebRequest()` (the untracked original) rather than
  deleting the send.
- Delete `.moonforge.json`.
- Leave every flagged value-using reference in place; list them at the end.

## 3. Verify

```bash
# Zero references (report any hits with file:line)
grep -rn -i "moonforge" Assets/ Packages/ --include="*.cs" --include="*.json" --include="*.asmdef" 2>/dev/null

# Compile check — same approach as /moonforge-verify:
# open the project in Unity (or run Unity batch-mode compile) and confirm no
# compiler errors; at minimum confirm no orphaned references remain via the grep.
```

If compilation fails on a removal-related error (usually an orphaned `using` or
a deleted variable still referenced), fix the removal and re-verify.

## Common mistakes

- Deleting `SendWithTracking()` entirely instead of reverting to
  `SendWebRequest()` — the request must still be sent.
- Removing a `using` directive while a flagged value-using call remains in the
  file (compile error).
- Forgetting `.meta` files (Unity regenerates GUID churn) or the
  `packages-lock.json` entry.
- Scanning `Library/`/`Temp/` caches.
