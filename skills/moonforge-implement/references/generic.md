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
- **Source `appVersion`** from wherever the project's own version actually
  lives — Godot's `ProjectSettings` (`application/config/version`), Unreal's
  Project Settings version string, a `Cargo.toml` `version`, a `.csproj`
  `<Version>`, a version constant the project already defines. Read it fresh at
  send time, not once and cached. If nothing defines a version, ask the user —
  do not invent one, and never substitute this skill's own version.
- **Source `screen`** the same way — a real API call, not an empty string:
  Godot `DisplayServer.window_get_size()`; Unreal
  `UWidgetLayoutLibrary::GetViewportSize()`; LÖVE `love.graphics.getDimensions()`;
  Bevy the `Window` resource's `.width()`/`.height()`; MonoGame
  `GraphicsDevice.PresentationParameters.BackBufferWidth/Height`; a custom
  engine's own windowing layer (SDL `SDL_GetWindowSize`, GLFW
  `glfwGetWindowSize`). Format `"<width>x<height>"`. A genuinely headless
  project (a game server, with no window at all) has no `screen` — omit it
  there, rather than sending a placeholder like `"0x0"`.
- **Source `language`** the same way. Some engines have it built in — Godot
  `OS.get_locale()`; Unreal `FInternationalization::Get().GetCurrentLanguage()`;
  MonoGame/any .NET target `CultureInfo.CurrentCulture.Name`. Others don't —
  LÖVE and Bevy have no locale API — fall back to the OS locale environment
  variable (`LANG`/`LC_ALL` on Linux/macOS, `GetUserDefaultLocaleName` on
  Windows) rather than skipping it outright. Only omit if that fallback also
  comes back empty, not on the first engine that doesn't have a one-line
  answer.

- **Source `url`** as a scene/context marker (e.g. `scene://LevelName`, matching
  the Unity convention) if the engine has no browser-style URL. If the
  engine's launch mechanism *can* carry a deep link with query parameters
  (a mobile build opened via a marketing link, for example), include that
  query string verbatim rather than dropping it — the collector parses
  `utm_*`/click IDs straight out of this field server-side, so truncating it
  silently starves that pipeline. Do not build any separate attribution
  capture — there's nothing else to wire beyond not truncating this field.

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
