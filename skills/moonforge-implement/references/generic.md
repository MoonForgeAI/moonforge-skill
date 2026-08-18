# MoonForge Implement — Any Engine

Use this when the project is neither Unity nor web. Godot, Unreal, LÖVE, Bevy,
MonoGame, a custom C++ engine, a headless game server — all the same path.

**You are going to write a real SDK, not a snippet.** The web path generates a
local JS SDK into the project; do exactly the same thing here, in the project's
language. The user should end up with `MoonForge.track_event("level_complete",
{...})` and nothing else to think about — sessions, identity, retries and
transport all handled inside the module you generate.

Do not hand the user a bare `POST` example and a list of things to remember.
That is the difference between an SDK and homework.

## 1. Generate the SDK module

One file (two if the language wants a header), in the project's idiom and
naming convention, placed where the project keeps its own source. Name it after
the project's conventions — `moonforge.gd`, `MoonForgeSDK.cpp/.h`,
`moonforge.lua`, `moonforge.rs`, `MoonForge.cs`.

It must implement all of §2. Anything you leave out becomes a silent gap in the
game's data that nobody discovers for months.

## 2. What it must do, and what it sends

Both live in `sdk-contract.md` — the required capabilities, the wire protocol,
and the User-Agent trap. Read it now; it is the same contract the bundled web
SDK satisfies, and a generated SDK that implements less will silently lose
sessions and identity while looking finished.

Nothing on this path is exempt. "It is only a small engine" is not a reason to
skip pre-identify buffering or session lifecycle — those are precisely what
separate usable data from a pile of anonymous events.

## 3. Wire it up

- **Register the module** so it initialises once at boot: a Godot autoload, an
  Unreal `GameInstance` subsystem, a `require` at the entry point.
- **Call `init`** with the game id from `.moonforge.json`.
- **Hook quit** for `session_end` — Godot `NOTIFICATION_WM_CLOSE_REQUEST`,
  Unreal `FCoreDelegates::OnPreExit`, Rust `Drop`/ctrl-c handler. This is the
  single most-forgotten hook, and without it every session is open-ended.
- **Call `identify`** after login, if the game has accounts.

Then instrument the selected events, one diff per change with approval, exactly
as on the other platforms.

## 4. Test what you generated

Per `sdk-contract.md` — envelope shape, pre-identify buffering, and that a
transport failure cannot reach game code. If the project has no test framework
and the user does not want one, say the SDK is untested rather than implying it
was verified.

## 5. Write `.moonforge.json`

```json
{ "gameId": "<GAME_UUID>", "gameName": "<name>", "platform": "generic", "sdkConfigured": true }
```
