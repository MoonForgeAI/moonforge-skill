# MoonForge Verify — Unreal (supplement to `generic.md`)

Run `generic.md`'s checks in full — parity contract, locked taxonomy, User-Agent,
live collector probe, "prove the real client sends." This file adds what's
Unreal-specific.

## Blueprint-callable surface

- The SDK's own public track methods carry `UFUNCTION(BlueprintCallable)` —
  including the full locked catalog instrumented for this game. Its absence is
  a defect on every Unreal project, Blueprint-heavy or not: without it, none of
  this is reachable from a graph, and retrofitting it later isn't a text diff.
- Locked enums (`ad_type`, `store`, `signup_method`, `outcome`) are
  `UENUM(BlueprintType)`, not `FString` params. The optional ones (`store`,
  `outcome`) carry an `Unspecified` member mapped to "omit the field" — without
  it the wrapper forces a value the schema says is optional.
- `economy_transaction` inputs/outputs take a `TArray` of a `{Type,Before,After}`
  struct — **not** fixed `Input1Type`/`Input2Type`/… params. A capped signature
  silently drops resources past the cap and is a finding (`economy_transaction`
  has no slot cap — `telemetry-model.md`).
- This repo has no Unreal Build Tool. Read for syntactic plausibility only, and
  say so — ask the user to confirm it compiles in their Editor.

## Game id source

Confirm a `UDeveloperSettings` subclass with a `Config GameId`, read from
`Initialize()` via `GetDefault<...>()`, and a matching
`[/Script/<Module>.MoonForgeSettings]` / `GameId=<UUID>` in
`Config/DefaultGame.ini`. A subsystem reading `.moonforge.json` at runtime is a
finding — that file isn't in a packaged build, so the shipped game sends
nothing.

## Manual Blueprint wiring list

If the profile's Blueprint Coverage was Blueprint-only or Blueprint-heavy,
`moonforge-implement` should have produced a "Manual Blueprint Wiring Needed"
list, not silently skipped those events. Confirm each listed event genuinely
has no C++ hook (re-check per-event), names the exact function/node + params +
location, and ask the user whether they've actually added the nodes — this
skill can't see a Blueprint graph edit. If the profile was C++-primary, the
list should be empty; confirm nothing was deferred that had a real C++ hook.

Present the list as its own section in `MOONFORGE_EVENTS.md`, after the tiered
tables, never merged into them — one is done, the other is the user's checklist.
