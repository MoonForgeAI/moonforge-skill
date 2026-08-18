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

## 2. Required feature parity

This is the contract. The Unity and web SDKs provide all of it; a generated SDK
that provides less is not finished.

| Capability | Behaviour |
|---|---|
| `init(game_id, opts)` | Stores config, loads/creates the distinct id, starts the session. Idempotent — a second call is a no-op, not a second session. |
| `track_event(name, data)` | Fire-and-forget event. Never blocks, never throws. |
| `track_screen_view(name)` | Emits `screen_view` with `{ screen_name }`. |
| `identify(user_id, traits)` | Sets the distinct id, emits `identify`, releases the pre-identify buffer (below). |
| `set_user_property(k, v)` | Persistent property merged into every later event's `data`. |
| **Session lifecycle** | `session_start` on init; `session_end` on quit with `{ session_id, duration_seconds }`; a new session after an inactivity timeout (default 1800s), carrying `previous_session_id`. |
| **Pre-identify buffering** | Events emitted before `identify` are held (cap 50) and rewritten to the real id when it arrives. Without this, everything before login is stranded under an anonymous id — which is what made two thirds of one real game's players look like single-day visitors. Flush anonymously after ~10s if identify never comes, rather than losing them. |
| **Persistent distinct id** | Generated once, stored on disk, reused forever. |
| **Transport** | Background thread/task, 2–5s timeout, browser-shaped User-Agent (§4), all errors swallowed. |
| `flush()` | Best-effort send of anything pending, for use before quit. |
| **Error capture** (optional) | If the engine exposes a global handler, hook it and POST to `/api/errors`. Offer it; do not assume it. |

Session and identity handling are the whole reason this is a module and not a
snippet. Get those right and the rest is plumbing.

## 3. The wire protocol

`POST https://collector.moonforge.co/api/send`, `Content-Type: application/json`.

### Event
```json
{
  "type": "event",
  "payload": {
    "game": "<GAME_UUID>",
    "id": "<distinct-id>",
    "name": "level_complete",
    "data": { "level": 3, "duration_seconds": 91 },
    "timestamp": 1755381234
  }
}
```

### Identify
```json
{
  "type": "identify",
  "payload": {
    "game": "<GAME_UUID>",
    "id": "<user-id>",
    "data": { "plan": "premium" },
    "timestamp": 1755381234
  }
}
```

| Field | Rule |
|---|---|
| `game` | Must be a valid **UUID** — schema-validated, and rejected silently otherwise. |
| `id` | Stable per player across sessions. |
| `name` | `snake_case`. Every distinct name is a separate series; keep the vocabulary small. |
| `data` | Flat. Strings, numbers, booleans — no nested objects or arrays. |
| `timestamp` | Unix **SECONDS**. Milliseconds put events ~55,000 years in the future, where no query will ever return them. |

Optional, safe to omit: `url`, `title`, `referrer`, `screen` (`"1920x1080"`),
`language`, `hostname`.

## 4. The User-Agent trap

The collector runs a bot filter and **discards flagged traffic while still
returning HTTP 200**. A dropped event is indistinguishable from an accepted one.
Most HTTP clients default to a User-Agent that trips it.

Measured against the collector's actual `isbot` version:

| User-Agent | Result |
|---|---|
| `Godot/4.2`, `UnrealEngine/5.3` | **Passes** — allowlisted before the filter |
| `curl/8.7.1`, `node`, `python-requests/2.31` | **Dropped** |
| `MyGame/1.4` | **Dropped** |
| `Mozilla/5.0 (compatible; MyGame/1.4)` | **Dropped** — `compatible;` is itself a bot signature |
| `Mozilla/5.0 MyGame/1.4` | Passes |
| A full realistic browser UA | Passes |

If the engine's own UA contains `UnityPlayer`, `UnrealEngine` or `Godot`, leave
it alone. Otherwise set:

```
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Do not invent a shorter "polite" variant — the honest-looking ones are exactly
the ones that get dropped.

## 5. Wire it up

- **Register the module** so it initialises once at boot: a Godot autoload, an
  Unreal `GameInstance` subsystem, a `require` at the entry point.
- **Call `init`** with the game id from `.moonforge.json`.
- **Hook quit** for `session_end` — Godot `NOTIFICATION_WM_CLOSE_REQUEST`,
  Unreal `FCoreDelegates::OnPreExit`, Rust `Drop`/ctrl-c handler. This is the
  single most-forgotten hook, and without it every session is open-ended.
- **Call `identify`** after login, if the game has accounts.

Then instrument the selected events, one diff per change with approval, exactly
as on the other platforms.

## 6. Test what you generated

You wrote this SDK, so it is yours to prove — do not hand the user an untested
module. Whatever the language offers:

- A unit test that `track_event` produces the exact envelope in §3, including
  unix-second timestamps.
- A test that events before `identify` are buffered and rewritten to the real
  id afterwards.
- A test that a transport failure cannot propagate into game code.

If the project has no test framework and the user does not want one added, say
plainly that the SDK is untested rather than implying it was verified.

## 7. Write `.moonforge.json`

```json
{ "gameId": "<GAME_UUID>", "gameName": "<name>", "platform": "generic", "sdkConfigured": true }
```
