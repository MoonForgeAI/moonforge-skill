# MoonForge Analyze — Unreal

## Why Unreal isn't just another `generic` engine

Every other engine on the `generic` path (Godot, LÖVE, Bevy, MonoGame, a
custom engine) is instrumented the same way: find the file and method in the
project's own source, write a tracking call, show a diff. Unreal breaks that
assumption for any game whose actual gameplay logic lives in **Blueprints**
— visual-scripting graphs stored as opaque `.uasset` files, edited in Unreal
Editor's graph canvas, not plain text. No text-based coding agent can parse,
understand, or safely modify one. If a game's trigger point (level-complete
handler, purchase button, quest turn-in, signup handler) is pure Blueprint
logic with no backing C++ function, there is no automatic instrumentation
path for it — only a **manual one**, which this analysis exists to identify
precisely so `moonforge-implement` doesn't have to discover it mid-instrumentation.

## 1. Locate the Unreal project

- `*.uproject` (JSON — lists `Modules`, `Plugins`, engine version)
- `Source/<ProjectName>/` — the project's C++ module, if it has one at all.
  **Its absence, or near-emptiness, is itself the most important signal in
  this whole analysis** — see §2.
- `Content/` — Blueprint assets, maps, materials, etc. (binary `.uasset`
  files — do not attempt to open or parse these; they are not text)
- `.moonforge.json` if present — extract `gameId`/`gameName`

## 2. Classify Blueprint coverage

This is the step every other engine's analyze process skips, because it
doesn't need it. Produce exactly one of three classifications, and carry it
forward into the profile — `moonforge-implement` and `moonforge-verify` both
key off it.

```bash
# Does Source/ exist at all, and does it contain anything beyond
# boilerplate (the auto-generated <ProjectName>.Build.cs/.Target.cs/.cpp/.h)?
find Source/ -name "*.h" -o -name "*.cpp" 2>/dev/null

# Find classes deriving from the common gameplay base classes
grep -rlE "public\s+(A?GameModeBase|APlayerController|ACharacter|APawn|AActor|UUserWidget|UGameInstance)" Source/ --include="*.h" 2>/dev/null
```

- **Blueprint-only** (high confidence) — `Source/` is missing entirely, or
  the grep above returns nothing beyond the single auto-generated project
  class stub every Unreal project gets by default (which itself declares no
  gameplay logic). This is a common, legitimate pattern — small teams and
  non-programmers build entire games in Blueprints with no custom C++ at
  all.
- **Likely Blueprint-heavy** (caveat, don't assert as fact) — gameplay
  classes exist, but read them: if most are near-empty overrides (a
  `GENERATED_BODY()` and one or two lifecycle overrides with trivial bodies —
  a `Super::` call and nothing else), the real logic almost certainly lives
  in Blueprint subclasses of these C++ base classes, a very common Unreal
  pattern (thin C++ base, all actual behavior in the Blueprint child).
- **C++-primary** — gameplay classes contain substantive logic: conditionals,
  state mutations, calls into other systems. Proceed the same way any other
  `generic`-path engine would.

Corroborating (not conclusive) signal: count Blueprint classes under
`Content/` by naming convention (`find Content/ -iname "BP_*.uasset" -o
-iname "WBP_*.uasset"`). A large count of gameplay-named Blueprint classes
(`BP_GameMode`, `BP_PlayerController`, `WBP_MainMenu`, etc.) alongside a thin
`Source/` reinforces "Blueprint-heavy" — but the file names are the only
thing readable here; the graph logic inside each `.uasset` is not.

**Do not try to be more precise than this.** The classification only needs
to answer one question for `moonforge-implement`: can a text-based diff
reach this game's actual trigger points, or not? A false "C++-primary" call
just means implement discovers the gap itself when it can't find a real hook
— report the honest three-way split rather than forcing a binary yes/no.

**What this does *not* affect:** P0 (`session_start`/`session_end`/
`first_open`/`app_update`/`alias`) hooks engine-level lifecycle
(`UGameInstanceSubsystem`, `FCoreDelegates::OnPreExit`), not gameplay
Blueprint graphs — it works identically regardless of this classification.
Revenue is usually unaffected too, since most third-party IAP/ad plugins
expose a C++ interface even in Blueprint-primary projects. **What it does
affect:** `tutorial_start`/`tutorial_complete`, `account_created`,
`economy_transaction`, and game-specific actions — anything whose real
trigger point might be a Blueprint graph with no backing C++ function.

## 3. Map levels and the game flow

- `.umap` files under `Content/` (commonly `Content/Maps/`) — the Unreal
  equivalent of a scene.
- `UGameplayStatics::OpenLevel` calls in C++, if any exist.
- If `Source/` has nothing (Blueprint-only), level transitions likely happen
  from Blueprint logic too (Level Blueprints or a Blueprint game mode) — note
  this rather than searching C++ for something that isn't there.

## 4. Find core systems

Same categories and keywords as `generic.md`'s economy/FTUE/accounts lists
(`shop`, `purchase`, `iap`, `coin`, `gold`, `gem`, `currency`, `inventory`,
`box`, `gacha`, `pack`, `unbox`, `loot`, ads (`ad`, `rewarded`,
`interstitial`), `tutorial`, `onboarding`, `login`, `signup`, `auth`,
`account`) — but **only searchable within `Source/`**. On a Blueprint-only
or Blueprint-heavy project this will legitimately find little or nothing —
that's the finding, not a failed search. Note which of these systems'
*names* are still discoverable from Blueprint asset naming (`Content/`'s
`.uasset` file names) even when their logic isn't readable.

## 5. Check for existing analytics

```bash
grep -rn "moonforge\|MoonForgeAnalytics\|MoonForgeBlueprintLibrary" Source/ --include="*.h" --include="*.cpp"
```

A prior MoonForge install here would be C++ (this skill can't have written
Blueprint nodes in a previous run any more than it can in this one) — if
none is found in `Source/`, also ask the user directly whether they've
manually wired any MoonForge Blueprint nodes already, since those aren't
discoverable by grep at all.

## 6. Output the game profile

Same format as the other platforms — Game ID, Genre, Levels/flow, Core
Systems, Monetization, Economy Resources, Accounts, UI Surfaces,
Instrumentation Targets, Existing Analytics, SDK Status — plus one field
unique to this platform:

```
**Blueprint Coverage:** [C++-primary | Likely Blueprint-heavy | Blueprint-only]
  [One sentence on what this means: e.g. "Gameplay logic lives entirely in
  Blueprints — tutorial_start/tutorial_complete, account_created,
  economy_transaction, and game actions will mostly need manual Blueprint
  wiring; P0 and revenue (if IAP/ads use a C++ plugin) can still be
  auto-instrumented."]
```

Present this plainly and early, before the event recommendations — a
developer expecting full auto-instrumentation needs to know upfront that
part of this game's coverage will be a guide for them to wire themselves,
not a diff they approve.

## Common mistakes

- Treating `Source/` being thin or absent as a failed scan rather than the
  actual finding — a Blueprint-only project is a normal, legitimate way to
  build in Unreal, not a broken project.
- Trying to read or grep inside `.uasset` files for Blueprint graph logic —
  they are binary/opaque; only their file names are usable signal.
- Skipping the Blueprint Coverage classification because "it's Unreal, just
  treat it like Unity" — Unity's MonoBehaviours are always C++ (well, C#)
  source; Unreal's Blueprint graphs have no equivalent text form at all.
- Assuming Blueprint Coverage affects P0 or revenue the same way it affects
  the locked FTUE/account/economy catalog and game actions — it usually
  doesn't (see §2).
- Scanning `Binaries/`, `Intermediate/`, `DerivedDataCache/`, or `Saved/`
  (Unreal build/cache output, not source).
