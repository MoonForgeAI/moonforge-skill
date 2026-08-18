# The MoonForge SDK Contract

Every platform ends up with an SDK **inside the project**. None requires the
user to fetch a package, run another tool, or have anything pre-installed.

| Platform | How the SDK gets there |
|---|---|
| Web | Copied from this skill's `assets/moonforge-sdk/` |
| Unity | Generated into `Assets/MoonForge/` as C# |
| Any other engine | Generated in the project's language |

The rule: **never write a tracking call against an SDK that is not in the
project.** Instrumenting first and telling the user to go install something
leaves them with code that does not compile and a job half done. Put the SDK in
first, then instrument.

## Required capabilities

This is the contract. The bundled web SDK implements all of it; anything you
generate must too. A generated SDK that only does `track_event` looks finished
and silently loses sessions and identity — the single most likely defect on any
generate path.

| Capability | Behaviour |
|---|---|
| `init(gameId, opts)` | Load config, restore or create the distinct id, start the session. **Idempotent** — a second call must not start a second session. |
| `track_event(name, data)` | Fire-and-forget. Never blocks a frame, never throws. |
| `track_screen_view(name)` | Emits `screen_view` with `{ screen_name }`. |
| `identify(userId, traits)` | Sets the distinct id, emits `identify`, releases the pre-identify buffer. |
| `set_user_property(k, v)` | Persistent property merged into every later event's `data`. |
| **Session lifecycle** | `session_start` on init. `session_end` on the engine's quit hook with `{ session_id, duration_seconds }`. A fresh session after an inactivity timeout (default 1800s) carrying `previous_session_id`. |
| **Pre-identify buffering** | Events emitted before `identify` are held (cap 50) and rewritten to the real id when it lands. Flush anonymously after ~10s if identify never comes — losing them is worse than an anonymous id. Without this, everything before login is stranded: it is what made two thirds of one real game's players look like single-day visitors. |
| **Persistent distinct id** | Created once, stored on disk, reused across launches. Never derived from a device fingerprint or IP. |
| **Transport** | Off the main thread, 2–5s timeout, correct User-Agent, every error swallowed. |
| `flush()` | Best-effort drain, for use before quit. |
| **Error capture** (optional) | Hook the engine's global handler and POST to `/api/errors`, if the engine has one and the user wants it. Offer; do not assume. |

## Wire protocol

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
| `game` | Must be a valid **UUID** — schema-validated, silently rejected otherwise. |
| `id` | Stable per player across sessions. |
| `name` | `snake_case`. Every distinct name is a separate series. |
| `data` | Flat. Strings, numbers, booleans — no nested objects or arrays. |
| `timestamp` | Unix **SECONDS**. Milliseconds put events ~55,000 years in the future, where no query will return them. |

Optional, safe to omit: `url`, `title`, `referrer`, `screen`, `language`,
`hostname`.

## The User-Agent trap

The collector runs a bot filter and **discards flagged traffic while still
returning HTTP 200**. A dropped event is indistinguishable from an accepted one,
and most HTTP clients default to a User-Agent that trips it.

Measured against the collector's actual `isbot` version:

| User-Agent | Result |
|---|---|
| `UnityPlayer/...`, `UnrealEngine/5.3`, `Godot/4.2` | **Passes** — allowlisted before the filter |
| `curl/8.7.1`, `node`, `python-requests/2.31` | **Dropped** |
| `MyGame/1.4` | **Dropped** |
| `Mozilla/5.0 (compatible; MyGame/1.4)` | **Dropped** — `compatible;` is itself a bot signature |
| `Mozilla/5.0 MyGame/1.4` | Passes |
| A full realistic browser UA | Passes |

Unity, Unreal and Godot native builds are fine as they are. Everything else must
set:

```
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Do not invent a shorter "polite" variant — the honest-looking ones are exactly
the ones that get dropped.

## Test what you generate

A generated SDK is code you wrote; prove it. Whatever the platform's test
framework offers:

- `track_event` produces the exact envelope above, with unix-second timestamps.
- Events before `identify` are buffered and rewritten to the real id after.
- A transport failure cannot propagate into game code.

If the project has no test framework and the user does not want one added, say
plainly that the SDK is untested. Do not imply it was verified.
