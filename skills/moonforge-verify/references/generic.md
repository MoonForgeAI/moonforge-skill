# MoonForge Verify — Any Engine

There is no SDK and no compiler contract to lean on here, so verification is
mostly about proving events actually arrive.

## 1. Static checks

- One client module exists and every call site goes through it — not scattered
  `http` calls. Grep for the endpoint string; more than one hit outside the
  client module is a finding.
- `game` is a valid **UUID**, matching `.moonforge.json`.
- `timestamp` is unix **seconds**. Grep the client for `* 1000`, `millis`,
  `MilliSeconds`, `get_ticks_msec` — any of these means the timestamp is
  ~1000× too large and the events land tens of thousands of years in the future,
  where no dashboard query will ever return them.
- A User-Agent is set, unless the engine is Unity/Unreal/Godot (§3).
- The client swallows transport errors and cannot throw into game code.
- A timeout is set on the request.
- `session_start` and `session_end` are both emitted — `session_end` is the one
  that gets forgotten, since it needs a quit handler.

## 2. Compile / run the project

Use whatever the project uses — `godot --headless --check-only`, `cargo check`,
`dotnet build`, `cmake --build`, `luac -p`. If the engine has no check command,
say so rather than claiming the build passed.

## 3. Confirm the User-Agent will not be filtered

This is the failure that looks like success. The collector discards traffic
whose User-Agent trips its bot filter and **still returns HTTP 200**, so a
dropped event is indistinguishable from an accepted one at the client.

Passes: a UA containing `UnityPlayer`, `UnrealEngine`, or `Godot` (allowlisted
outright), or a full realistic browser UA.

Dropped: `curl/*`, `node`, `python-requests/*`, a bare `MyGame/1.4`, and
`Mozilla/5.0 (compatible; ...)` — `compatible;` is itself a bot signature.

## 4. Live collector check

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://collector.moonforge.co/api/send \
  -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
  -H 'Content-Type: application/json' \
  -d '{"type":"event","payload":{"game":"<GAME_ID>","id":"verify-probe","name":"verify_test","data":{},"timestamp":'"$(date +%s)"'}}'
```

Expect `200`/`202`. This proves the endpoint and the game id — it does **not**
prove the game's own client works, because curl is not the game.

## 5. Prove the real client sends

The only check that counts. Pick whichever is available:

- Run the game and watch its network traffic (engine network profiler, or
  `mitmproxy` / Charles).
- Temporarily point the client at a local listener
  (`python3 -m http.server 8080`) and confirm the JSON body and headers are
  exactly what §1 expects.
- Add a one-line debug print of the response status behind the debug flag, run
  once, and remove it.

State plainly which of these was done. "The code looks right" is not
verification, and on this path it is the easiest place to fool yourself.

## 6. Present the event inventory

List each event, its trigger site, and its properties. Flag any event that is
emitted from more than one place — duplicate emission is the most common defect
in hand-written instrumentation.
