# TODO: Unreal Blueprint-only projects can't be instrumented

**Status:** Not started. Tracked separately from `eventing-improvements-plan.md`
— unrelated to that work, found while discussing it but not part of it.

## The problem

Confirmed via grep: "Blueprint" appears exactly once in the entire skill
(`moonforge-analyze/references/generic.md`'s routing table — `*.uproject` →
"Unreal (C++ / Blueprints)"), with no handling anywhere for what happens when
a game's actual logic lives in Blueprints rather than C++.

This is a hard limit, not a documentation gap. Every skill here works by
finding a file and method, showing a text diff, and getting approval —
Blueprint graphs are `.uasset` files, serialized/opaque assets edited via
Unreal Editor's visual graph canvas, not plain text. No text-based coding
agent can parse, understand, or safely modify one — there's no source
representation to diff. If a game's trigger point (level-complete handler,
purchase button, quest turn-in) is pure Blueprint graph logic with no backing
C++ function, there is currently no path to instrument it at all.

## What's actually affected

- **Not affected:** P0 (`session_start`/`session_end`/`first_open`/
  `app_update`/`alias`) hooks into engine-level lifecycle (`GameInstance`,
  `FCoreDelegates`), not gameplay Blueprint graphs — works regardless of how
  the game itself is authored.
- **Usually not affected:** revenue events — most third-party IAP/ad plugins
  expose a C++ interface even in Blueprint-primary projects, since the
  underlying platform SDKs are typically C++ wrappers first.
- **Affected:** P1+ game-specific action/economy/FTUE events whose real
  trigger point is Blueprint-only. No current path to instrument these.

## Proposed fix (two parts, neither is a full solve on its own)

1. **Make the generated Unreal SDK Blueprint-callable.** Wrap the public API
   (`TrackEvent`, `TrackScreenView`, `Identify`, etc.) in a
   `UBlueprintFunctionLibrary` with `UFUNCTION(BlueprintCallable)`. Doesn't
   let the agent instrument automatically, but turns "impossible" into
   "possible for a human" — the user can drag tracking nodes into their own
   Blueprint graphs themselves, given exact node names and placement.
2. **Detect this during `moonforge-analyze` and say so plainly**, rather than
   silently grepping C++ for hooks that don't exist. Check whether `Source/`
   has real gameplay logic or is mostly thin `GENERATED_BODY()` stubs with
   the actual logic living in `Content/`'s Blueprint classes (a very common
   Unreal pattern) — and if so, tell the user upfront which events can be
   auto-instrumented (P0, likely revenue) versus which need manual Blueprint
   wiring, with exact node/placement guidance for the rest.

## Open questions for whoever picks this up

- How to reliably detect "Blueprint-only" vs. "C++ with thin Blueprint
  subclasses" vs. "C++-primary" from a static scan — heuristics on
  `Source/` file count/size vs. `Content/` Blueprint class count and naming
  isn't foolproof.
- Whether `moonforge-implement` should always generate the
  `UBlueprintFunctionLibrary` wrapper for Unreal (cheap, no downside) or only
  when Blueprint-heaviness is detected.
- What the "manual instrumentation guide" output should look like — a
  written per-event node/placement list is the obvious answer, but worth
  designing properly rather than improvising when this is picked up.
