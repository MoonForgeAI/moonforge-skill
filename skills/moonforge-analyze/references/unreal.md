# MoonForge Analyze — Unreal (supplement to `generic.md`)

Unreal is a `generic`-path engine — follow `generic.md`. This file adds the
one thing generic can't assume: **a game's real trigger points may live in
Blueprint graphs**, opaque `.uasset` files with no text to grep or diff. If
a level-complete handler, purchase button, or signup flow is pure Blueprint
with no backing C++ function, there is no automatic instrumentation path for
it — only a manual one, which the profile has to flag up front.

## Classify Blueprint coverage

Produce one of three classifications and carry it into the profile —
`moonforge-implement` and `moonforge-verify` both key off it.

```bash
# Is there a C++ module at all, and does it hold real gameplay logic?
find Source/ \( -name "*.h" -o -name "*.cpp" \) 2>/dev/null
grep -rlE "public[[:space:]]+(A?GameModeBase|APlayerController|ACharacter|APawn|AActor|UUserWidget|UGameInstance)" Source/ --include="*.h" 2>/dev/null
```

- **Blueprint-only** — no `Source/`, or nothing beyond the auto-generated
  project stub. A common, legitimate pattern; not a broken project.
- **Likely Blueprint-heavy** — gameplay C++ classes exist but are thin
  (`GENERATED_BODY()` plus one or two trivial `Super::` overrides) — the real
  logic is in Blueprint subclasses.
- **C++-primary** — gameplay classes hold substantive logic. Proceed exactly
  as any other `generic` engine.

Corroborating signal only: `find Content/ \( -iname "BP_*.uasset" -o -iname "WBP_*.uasset" \)`.
A large count of gameplay-named Blueprints beside a thin `Source/` reinforces
"Blueprint-heavy" — but the file *names* are all that's readable; the graph
logic inside is not.

Don't try to be more precise. The classification answers one question for
`moonforge-implement`: can a text diff reach this game's trigger points? A
wrong "C++-primary" just means implement finds the gap itself.

## Game flow

`generic.md` §2 expects `UGameplayStatics::OpenLevel` calls in C++. On a
Blueprint-only or Blueprint-heavy project those live in Level Blueprints and
won't grep — that's the finding, not a failed scan. Map the flow from the
`.umap` file names under `Content/` (commonly `Content/Maps/`) plus what the
user tells you, and note that the transitions are Blueprint-authored.

## What it affects

- **Not P0** — `session_start`/`session_end`/`first_open`/`app_update`/`alias`
  hook engine lifecycle (`UGameInstanceSubsystem`, `FCoreDelegates::OnPreExit`),
  not gameplay graphs.
- **Usually not revenue** — most IAP/ad plugins expose a C++ interface even in
  Blueprint-primary projects.
- **Does affect** `tutorial_start`/`tutorial_complete`, `account_created`,
  `economy_transaction`, and game-specific actions — anything whose trigger
  might be a Blueprint graph.

## In the profile

Add a `Blueprint Coverage:` line (`C++-primary` | `Likely Blueprint-heavy` |
`Blueprint-only`) with one sentence on what it means for this game. Present it
**early**, before event recommendations — a developer expecting full
auto-instrumentation needs to know part of the coverage will be a checklist
for them to wire, not a diff they approve.

## Existing analytics

`grep -rn "moonforge\|MoonForge" Source/ --include="*.h" --include="*.cpp" 2>/dev/null`.
A prior install here is always C++ (this skill can't write Blueprint nodes).
If `Source/` is clean, also ask the user whether they've manually wired any
MoonForge Blueprint nodes — grep can't see those.
