# MoonForge Implement — Unreal (supplement to `generic.md`)

Unreal is a `generic`-path engine — generate a real C++ SDK module per
`generic.md` and `sdk-contract.md` (`UGameInstanceSubsystem` for idempotent
`init`, `FCoreDelegates::OnPreExit` for `session_end`, `FHttpModule` transport
off the game thread, persistent id in `SaveGame`/`GConfig`). The locked
catalog schemas come from `moonforge-events/references/telemetry-model.md`,
same as every platform. This file adds three Unreal-specific points.

## 1. Make the SDK callable from Blueprint

Mark the SDK's **own** public track methods `UFUNCTION(BlueprintCallable)` —
this is an annotation on the API you're already generating, not a second
wrapper layer to keep in sync. `first_open`/`app_update`/`alias` are internal
and get no entry point (nothing ever calls them directly).

For the locked catalog, expose the enums as `UENUM(BlueprintType)` rather than
`FString` parameters — `ad_type`, `store`, `signup_method`, `outcome`. A
Blueprint dropdown makes a typo'd locked value structurally impossible, which
is a stronger "zero deviation" guarantee than any other platform gets. The
enums for *optional* properties (`store`, `outcome`) need an `Unspecified`
member the implementation maps to "omit the field", so a Blueprint author
isn't forced to send a value the schema says is optional.

`economy_transaction` inputs/outputs: a `TArray` of a small
`USTRUCT(BlueprintType)` `{ Type, Before, After }` — one entry per resource,
no fixed slot count (matches the model — no cap).

For the **custom** `TrackEvent(Name, Data)` passthrough, `TMap<FString, FString>`
is the only Blueprint-exposable map — have the SDK coerce numeric-looking
values to numbers on send, so a Blueprint author passing `score` as `"4500"`
still lands it as a number, not a string, the way Unity and web do.

## 2. Config from `DefaultGame.ini`, not `.moonforge.json`

The subsystem auto-inits with no caller to pass a game id, and
`.moonforge.json` is not staged into a packaged build — reading it at runtime
works in the Editor and returns nothing in a shipped game. Generate a
`UDeveloperSettings` subclass (`Config = Game`) with a `Config FString GameId`;
`Initialize()` reads it via `GetDefault<UMoonForgeSettings>()`. Write the value
into `Config/DefaultGame.ini` (which *is* packaged):

```ini
[/Script/<Module>.MoonForgeSettings]
GameId=<GAME_UUID>
```

`<Module>` is the module the settings class compiles into (usually the primary
game module — check the `.uproject`). An empty or non-UUID `GameId` must make
the subsystem log once and no-op every call, not send events with a blank
`game`. `.moonforge.json` stays the skill's install marker, read by
`moonforge-analyze`/`moonforge-uninstall`, never by the game.

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

## Testing

This repo has no Unreal Editor or Build Tool — nothing generated here is
compiled or run. Say so plainly; the user confirms it compiles in their own
Editor (`moonforge-verify/references/unreal.md`).

## `.moonforge.json`

```json
{ "gameId": "<GAME_UUID>", "gameName": "<name>", "platform": "unreal", "sdkConfigured": true }
```

(`platform` here is an informational record, not a routing value — Unreal
still runs the `generic` skill path plus this supplement.)
