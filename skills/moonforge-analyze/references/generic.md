# MoonForge Analyze — Any Engine

Use when the project is neither Unity nor web. The goal is unchanged: produce a
game profile good enough to recommend the right events. Only the file layout
differs.

## 1. Identify the engine and language

Look for the marker, then confirm by reading the entry point:

| Marker | Engine |
|---|---|
| `project.godot` | Godot (GDScript / C#) |
| `*.uproject` | Unreal (C++ / Blueprints) |
| `main.lua` + `conf.lua` | LÖVE |
| `Cargo.toml` with `bevy` | Bevy (Rust) |
| `*.csproj` with `MonoGame` | MonoGame (C#) |
| `CMakeLists.txt` / `Makefile` + a graphics lib | Custom engine |
| none of the above | Ask. Do not guess. |

If nothing matches, ask the user which engine and language, and carry on. An
unfamiliar engine is not a blocker — the instrumentation is HTTP either way.

## 2. Map screens and the game flow

Every engine has an equivalent of a scene; find whichever applies:

- Godot — `.tscn` files, and `change_scene_to_file` calls.
- Unreal — `.umap` levels, `UGameplayStatics::OpenLevel`.
- Everything else — a state machine, a screen enum, or a `switch` in the main
  loop. Grep for `state`, `screen`, `scene`, `menu`, `level`.

Record the flow the player walks (MainMenu → Game → GameOver). This is what
makes a funnel possible later.

## 3. Find the core systems

Grep, in the project's language, for:

- **Game loop** — `_process`, `Tick`, `update`, `love.update`, `fn update`.
- **Progression** — `level`, `wave`, `stage`, `xp`, `unlock`.
- **Economy** — `coin`, `gold`, `currency`, `shop`, `purchase`, `iap`, `gem`,
  `inventory`, plus ads (`ad`, `rewarded`, `interstitial`).
- **Session boundaries** — quit handlers, pause, `NOTIFICATION_WM_CLOSE_REQUEST`,
  `OnPreExit`. Note these specifically: the generated SDK registers its
  `session_end` hook here, so knowing whether the engine exposes one — and
  whether the project already uses it — decides how that gets wired.
- **Save/load** — where a persistent player id can live.

## 4. Check for existing analytics

Grep for `moonforge`, and for other tools (`GameAnalytics`, `firebase`,
`posthog`, `mixpanel`, `amplitude`, `sentry`). Also look for an existing raw
HTTP client that already posts telemetry — reuse it rather than adding a second.

Read `.moonforge.json` if present; `platform: "generic"` means this project was
instrumented by this path before.

## 5. Output the game profile

Same format as the other platforms — Game ID, Genre, Screens/flow, Core Systems,
Monetization, Economy Resources, Accounts, UI Surfaces, Existing Analytics,
SDK Status — with additions that matter downstream:

- **Monetization** — none / IAP / ads / both (from economy/shop/ad greps).
- **Economy Resources** — currency/item types found, or "none" / "unknown".
- **Accounts** — yes/no (same signal as player identity below).
- **UI Surfaces** — major menus/modals/store beyond scene/screen flow.
- **Instrumentation Targets** — table of file + hook + suggested locked/custom events (IAP, ads, economy, attribution, actions).
- **Language and idiom** — the generated SDK is written in it, so note the
  language, its test framework (if any), and where the project keeps source.
- **Player identity / Accounts** — does the game have accounts, or does it need
  a generated persistent id? This decides whether `identify` and pre-identify
  buffering are in scope.
- **Quit hook** — which notification the engine exposes for shutdown. The
  generated SDK needs it for `session_end`.
- **Display and locale** — does the project have a window/viewport at all, or
  is it headless (a game server)? Does the engine expose a locale/language API,
  or would the generated SDK need to fall back to an OS environment variable?
  This decides whether `screen` and `language` are sourced for real or
  legitimately omitted — see `moonforge-implement/references/generic.md` §3.

## Common mistakes

- Telling the user their engine is unsupported. It is supported.
- Scanning build output (`build/`, `target/`, `Binaries/`, `.import/`).
- Assuming there is a session concept already. Usually there is not — that is a
  thing to be instrumented, not discovered.
