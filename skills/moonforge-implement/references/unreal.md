# MoonForge Implement — Unreal (supplement to `generic.md`)

Unreal is a `generic`-path engine — generate a real C++ SDK module per
`generic.md` and `sdk-contract.md` (`UGameInstanceSubsystem` for idempotent
`init`, `FCoreDelegates::OnPreExit` for `session_end`, `FHttpModule` transport
off the game thread, persistent id in `SaveGame`/`GConfig`). The locked
catalog schemas come from `moonforge-events/references/telemetry-model.md`,
same as every platform. This file adds three Unreal-specific points.

## 1. Make the SDK callable from Blueprint

The SDK's public track API needs `UFUNCTION(BlueprintCallable)` so a graph can
reach it. Two shapes work — pick one per project:

- **A thin `UBlueprintFunctionLibrary`** that forwards each call to the
  subsystem: one clean static node per call, and the library carries no schema
  logic of its own (pure argument forwarding), so there is nothing to keep in
  sync with the locked model.
- **`BlueprintCallable` directly on the subsystem**: the Blueprint author adds
  a Get-Subsystem node first, then the call. Fine — just two nodes.

Either way, `first_open`/`app_update`/`alias` are internal and get no entry
point (nothing calls them directly).

For the locked catalog, expose the enums as `UENUM(BlueprintType)` rather than
`FString` parameters — `ad_type`, `store`, `signup_method`, `outcome`. A
Blueprint dropdown makes a typo'd locked value structurally impossible, a
stronger "zero deviation" guarantee than any other platform gets. The enums
for *optional* properties (`store`, `outcome`) carry an `Unspecified` member
the implementation maps to "omit the field", so a Blueprint author isn't
forced to send a value the schema says is optional.

`economy_transaction` inputs/outputs: a `TArray` of a small
`USTRUCT(BlueprintType)` `{ Type, Before, After }` — one entry per resource,
no fixed slot count (matches the model — no cap).

The custom `TrackEvent(Name, Data)` passthrough takes `TMap<FString, FString>`
(the only Blueprint-exposable map), so numeric properties on *custom* events
authored in Blueprint land as strings — unlike Unity/web, where the dict holds
native types. Fine for the usual custom props (level name, difficulty,
outcome); if a numeric custom prop needs downstream aggregation and its trigger
*is* C++, use a typed C++ call there. The locked catalog is unaffected — its
params are already typed.

## 2. Where the game id comes from

Web and Unity bake the id in at generation time (a bootstrap `init({ gameId })`
call, a settings asset). Unreal's subsystem auto-inits with no bootstrap call
site, so either:

- **Bake it as a constant** in the generated `.cpp` — `Initialize()` passes the
  literal UUID the skill wrote to the internal init. Simplest, works in every
  build type; regenerating the SDK rewrites it.
- **`UDeveloperSettings`** — a `UCLASS(Config = Game, DefaultConfig)` subclass
  with a `Config FString GameId`, read via `GetDefault<UMoonForgeSettings>()`.
  The skill writes the value into `Config/DefaultGame.ini` (which is packaged):

  ```ini
  [/Script/<Module>.MoonForgeSettings]
  GameId=<GAME_UUID>
  ```

  `<Module>` is the module the class compiles into — the primary game module
  (from the `.uproject`) or the plugin module if the SDK is its own plugin.
  This mirrors Unity's `MoonForgeSettings` asset: editable in Project Settings
  without a recompile. Prefer it if the team will want to swap the id or point
  at a staging collector without rebuilding.

Either way, an empty or non-UUID id must make the subsystem log once and no-op
every call — never send events with a blank `game`. Don't read `.moonforge.json`
at runtime; it's a skill artifact for `moonforge-analyze`/`moonforge-uninstall`,
not shipped in a build.

## 3. Blueprint-only trigger points → a wiring list, not a diff

Read the profile's **Blueprint Coverage** (`moonforge-analyze/references/unreal.md`).

- **C++-primary** — instrument normally: find the file and method, write the
  call to the `BlueprintCallable` function, show a diff, get approval.
- **Blueprint-only / Blueprint-heavy** — for each event whose trigger is a
  Blueprint graph with no backing C++ function, **don't attempt a diff** —
  there's nothing to diff. Add it to a **manual wiring list**: event name, the
  exact SDK function/node to call, its parameters (including which enum value),
  and the Blueprint asset + rough graph location if discoverable from asset
  naming. Events that *do* have a C++ hook still get instrumented normally —
  judge per-event, not per-project.

`moonforge-verify` presents this list as its own "Manual Blueprint Wiring
Needed" section and it goes into `MOONFORGE_EVENTS.md` (see
`moonforge-verify/references/event-inventory-export.md`). Tell the user plainly
which events they'll need to wire themselves, before finishing this step.

## Testing and `.moonforge.json`

This repo has no Unreal Editor or Build Tool — nothing generated here is
compiled or run. Say so plainly; the user confirms it compiles in their own
Editor (`moonforge-verify/references/unreal.md`).

`.moonforge.json` is written per `generic.md` §5 (`"platform": "generic"`) —
`*.uproject` is what tells `moonforge-analyze`/`moonforge-uninstall` this is an
Unreal project, not that field.
