# MoonForge Implement — Any Engine

Use this when the project is not Unity and not web. Godot, Unreal, LÖVE, Bevy,
MonoGame, a custom C++ engine, a headless game server — all the same path.

There is no SDK to install here. MoonForge's collector is an HTTP endpoint, so
instrumenting any engine means writing a small client that speaks the wire
protocol below. That client is typically 30–60 lines. Everything the Unity and
web SDKs do, they do by sending exactly these requests.

## 1. The wire protocol

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

### Field rules — each of these silently drops data if broken

| Field | Rule |
|---|---|
| `game` | Must be a valid **UUID**. The collector validates it with a schema and rejects anything else. |
| `id` | The distinct id. Stable per player across sessions — see §3. |
| `name` | `snake_case`. Keep the vocabulary small and stable; every distinct name is a separate series. |
| `data` | Flat object. Values are strings, numbers, or booleans — not nested objects or arrays. |
| `timestamp` | **Unix SECONDS**, not milliseconds. Sending milliseconds puts events ~55,000 years in the future, where they will never appear in a dashboard query. |

Optional fields the web SDK also sends, all safe to omit: `url`, `title`,
`referrer`, `screen` (`"1920x1080"`), `language`, `hostname`.

## 2. The User-Agent trap — read this before writing any code

The collector runs `isbot()` on the User-Agent and **discards bot traffic while
still returning HTTP 200**. A dropped event and an accepted event look
identical from the client. Nothing errors, nothing logs, and the data simply
never arrives.

Most HTTP libraries default to a User-Agent that `isbot()` flags — Node's fetch
sends `node`, Python's requests sends `python-requests`, curl sends `curl`. This
exact bug silently dropped 100% of a customer's server-side events until it was
caught in review.

The collector allowlists engine clients by User-Agent, checked BEFORE the bot
filter:

```
/UnityPlayer|UnrealEngine|Godot/i
```

The following is measured against the collector's actual `isbot` version, not
assumed:

| User-Agent | Result |
|---|---|
| `Godot/4.2`, `UnrealEngine/5.3` | **Passes** — via the allowlist above, even though `isbot` alone flags them |
| `curl/8.7.1`, `node`, `python-requests/2.31` | **Dropped** |
| `MyGame/1.4` | **Dropped** |
| `Mozilla/5.0 (compatible; MyGame/1.4)` | **Dropped** — `compatible;` is itself a bot signature |
| `Mozilla/5.0 MyGame/1.4` | Passes |
| A full, realistic browser UA | Passes |

So:

- **Unreal, Godot, or a Unity native build** — the default User-Agent already
  contains an allowlisted token. Nothing to do, but verify it (§5).
- **Any other engine or language** — send a full, realistic browser User-Agent:

```
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Do **not** invent a shortened "polite" variant. `Mozilla/5.0 (compatible;
MyGame/1.4)` looks more honest and is silently discarded — the one thing that
matters here is passing the filter, and only a real-looking UA does that
reliably.

## 3. The distinct id

One stable id per player, or every session looks like a new user and retention
is unmeasurable.

- **Game with accounts** — use the account id, prefixed for readability
  (`account4821`). Call identify once per session after login.
- **No accounts** — generate a UUID on first run, persist it (Godot
  `user://`, Unreal `SaveGame`, a file under the platform's app-data dir), and
  reuse it forever.

Never derive it from a device fingerprint, IP, or anything that changes between
sessions or across a reinstall you care about tracking through.

## 4. Writing the client

Requirements, in priority order:

1. **Never block gameplay.** Fire-and-forget on a background thread or async
   task. A frame must never wait on the collector.
2. **Never throw into game code.** Swallow every transport error. Analytics
   failing must be invisible to the player.
3. **Bound the request.** A 2–5 second timeout. Without one, a hung connection
   leaks a thread or keeps a server invocation alive.
4. **Buffer before identify** if the game has accounts. Events emitted before
   login otherwise carry the anonymous id and can never be attributed. Hold
   them (cap ~50), rewrite their `id` once identify lands, then flush.

### Godot 4 (GDScript)

```gdscript
extends Node

const ENDPOINT := "https://collector.moonforge.co/api/send"
const GAME_ID := "<GAME_UUID>"

var _distinct_id: String

func _ready() -> void:
    _distinct_id = _load_or_create_id()

func track(name: String, data: Dictionary = {}) -> void:
    var body := {
        "type": "event",
        "payload": {
            "game": GAME_ID,
            "id": _distinct_id,
            "name": name,
            "data": data,
            "timestamp": int(Time.get_unix_time_from_system()),
        },
    }
    var request := HTTPRequest.new()
    add_child(request)
    # Godot's default UA is allowlisted by the collector, so no override needed.
    request.request_completed.connect(func(_r, _c, _h, _b): request.queue_free())
    var err := request.request(
        ENDPOINT, ["Content-Type: application/json"],
        HTTPClient.METHOD_POST, JSON.stringify(body))
    if err != OK:
        request.queue_free()   # analytics never surfaces an error to the game

func _load_or_create_id() -> String:
    var path := "user://moonforge_id"
    if FileAccess.file_exists(path):
        return FileAccess.open(path, FileAccess.READ).get_as_text().strip_edges()
    var id := "anon-%s" % str(randi()).sha256_text().substr(0, 16)
    FileAccess.open(path, FileAccess.WRITE).store_string(id)
    return id
```

### Anything else

The shape is identical in any language: build the JSON, POST it, set a
User-Agent, time out, ignore failures. If the engine has no HTTP client, shell
out to `curl` on a worker thread as a last resort.

## 5. Sessions are NOT automatic here

The Unity and web SDKs emit `session_start` and `session_end` for you. On this
path nothing is automatic — emit them yourself, or session counts and playtime
will be empty:

- `session_start` at boot, once, with `{ "session_id": "<uuid>" }`.
- `session_end` at shutdown, with `{ "session_id": "<uuid>", "duration_seconds": N }`.

`session_end` is the one most often lost, because the process is already
exiting. Send it on the engine's quit notification (Godot
`NOTIFICATION_WM_CLOSE_REQUEST`, Unreal `FCoreDelegates::OnPreExit`) and accept
that a hard crash will lose it.

## 6. Write `.moonforge.json`

```json
{ "gameId": "<GAME_UUID>", "gameName": "<name>", "platform": "generic", "sdkConfigured": true }
```

`platform: "generic"` lets `/moonforge:verify` and `/moonforge-uninstall` know
to look for hand-written calls rather than an SDK.

## 7. Show diffs and get approval

Same as every other path: one diff per change, approved before writing. Put the
client in one file (`moonforge.gd`, `MoonForgeClient.cpp`, `moonforge.py`) and
have every call site go through it — a scattered protocol is unmaintainable and
makes uninstall guesswork.
