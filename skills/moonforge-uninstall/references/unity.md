# MoonForge Uninstall — Unity

The SDK may have been **generated** into `Assets/MoonForge/` rather than
installed as a package. Inventory both: a generated folder (plus its `.asmdef`
and any generated tests) and a `com.moonforge.*` entry in
`Packages/manifest.json`. Remove whichever is present, along with the
`MoonForgeSettings` asset in `Resources/`.

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
ls .moonforge.json MOONFORGE_EVENTS.md 2>/dev/null
```

Present the inventory grouped as: **SDK package** / **settings asset** /
**bootstrap wiring** / **analytics calls** / **error-tracking calls** /
**network tracking** / **config**. Classify each call site as *side-effect*
(deletable) or *value-using* (flag for manual review — e.g. a tracked
`UnityWebRequest` object that is reused after the tracked send, or any
MoonForge call whose result is assigned/returned — this also covers a
`yield return`ed tracked request such as
`yield return NetworkErrorInterceptor.SendTrackedRequest(request, "label")`,
which is never a deletable side-effect statement).

## 2. Remove (per-file diffs, approval each)

- SDK package: remove the MoonForge entry from `Packages/manifest.json` (and
  `Packages/packages-lock.json` if present); delete an embedded
  `MoonForge.ErrorTracking` package folder (with `.meta` files) if the SDK was
  vendored under `Packages/` or `Assets/`.
- Delete the `MoonForgeSettings` asset and its `.meta` file.
- In each instrumented `.cs` file: remove `using MoonForge.ErrorTracking;`,
  `using MoonForge.ErrorTracking.Analytics;`, `using MoonForge.ErrorTracking.Capture;`;
  if a bootstrap `MoonForgeErrorTracker.Initialize(config)` exists (e.g. a
  GameBootstrap MonoBehaviour), remove the statement and the
  `[SerializeField] private ErrorTrackerConfig config;` field if now unused;
  delete each side-effect call statement. Revert `request.SendWithTracking()`
  back to `request.SendWebRequest()` (the untracked original) rather than
  deleting the send. Likewise revert Option-B calls:
  `yield return NetworkErrorInterceptor.SendTrackedRequest(request, "label")` →
  `yield return request.SendWebRequest();` — the request must still be sent.
  `NetworkErrorInterceptor.ReportError(...)` statements are side-effect calls
  and are simply deleted.
- Delete `.moonforge.json` and `MOONFORGE_EVENTS.md` (if present) — a doc
  describing events that no longer exist is actively misleading, not just clutter.
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
- Deleting `SendTrackedRequest(...)` (or its `yield return`) instead of
  reverting to `SendWebRequest()` — the coroutine must still yield the send.
- Removing a `using` directive while a flagged value-using call remains in the
  file (compile error).
- Forgetting `.meta` files (Unity regenerates GUID churn) or the
  `packages-lock.json` entry.
- Forgetting `.moonforge.json` or `MOONFORGE_EVENTS.md` at the project root.
- Scanning `Library/`/`Temp/` caches.
