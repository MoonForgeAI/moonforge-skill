# MoonForge Verify — Any Engine

The SDK here was generated rather than installed, so verification covers both
the module that was written and the calls into it.

## 1. Verify the generated SDK against the parity contract

Check it implements every row of the required-capabilities table in
`moonforge-implement/references/sdk-contract.md`. Missing capabilities are the
main risk on this path — a generated SDK that only does `track_event` looks
finished and silently loses sessions, identity, and version.

- `init` is idempotent — a second call must not start a second session.
- **Session lifecycle**: `session_start` on init, `session_end` on a quit hook,
  re-engagement after the inactivity timeout. Grep for the engine's quit
  notification; if it is absent, `session_end` is never sent.
- **Pre-identify buffering**: events before `identify` are held and rewritten to
  the real id. Absent, everything before login is stranded anonymously.
- **Alias on first identify**: the first `identify` call this device ever makes
  sends an `alias` (`previous_id` = the anonymous id, `id` = the real one)
  before the `identify` itself, gated by a *persistent* flag (not the in-memory
  buffering flag). Grep for `alias` in the SDK module; if it's missing, every
  player who signs up more than ~10s into their first session (the common
  case, not the edge case) becomes two unrelated player records forever —
  buffering alone does not cover this. Confirm a second `identify` call does
  not send a second `alias`.
- **Persistent distinct id**: written to disk and reloaded, not regenerated per
  launch.
- **`first_open`**: fires once, the moment the distinct id is first created —
  not on every first-ever `session_start` signal, which also fires after a
  storage clear or device switch. Grep for where the distinct id getter first
  creates one; confirm the check happens before that call, not after.
- **`app_update`**: fires only on a later launch where the stored `appVersion`
  differs from the current one — never on the same first-ever launch as
  `first_open`. Grep for where the previous version gets compared/stored.
- **No client-side geo or UTM/attribution capture**: grep for `timezone`,
  `country`, `utm_source`, or any query-string parsing in the SDK module —
  any hit is stale guidance and a finding, not extra coverage. Geolocation
  and UTM/click IDs are both derived server-side from the request IP and the
  `url` field's query string; the only client requirement is that `url`
  isn't truncated to bare `pathname`/scene.
- **`appVersion`**: set on every event and identify payload from the
  project's own version, read fresh at send time — not hardcoded, not the
  moonforge-skill's own version. Grep the SDK module for where it's sourced;
  if it's a literal string constant, that's a finding.
- **`screen`/`language`**: sourced from a real engine/OS API, not a hardcoded
  literal and not silently dropped. Grep for where each is assigned in the SDK
  module — a literal string (`"1920x1080"`, `"en"`) or an empty string with no
  real lookup nearby is a finding. The only legitimate reason either is absent
  is the platform genuinely having no window (a headless server) or no locale
  source even after the OS-environment-variable fallback in `generic.md` §3 —
  confirm which, don't just accept that it's missing.
- `game` is a valid **UUID**, matching `.moonforge.json`.
- `timestamp` is unix **seconds**. Grep for `* 1000`, `millis`, `MilliSeconds`,
  `get_ticks_msec` — any of these is ~1000× too large and puts events tens of
  thousands of years in the future.
- A User-Agent is set, unless the engine is Unity/Unreal/Godot (§3).
- Transport errors are swallowed and cannot throw into game code.
- A request timeout is set.

## 1a. Locked event taxonomy

If any revenue/economy/FTUE/account event was instrumented (`iap_*`, `ad_*`,
`economy_transaction`, `tutorial_start`/`tutorial_complete`,
`account_created`), run `moonforge-verify/references/telemetry-checks.md` —
including confirming `account_created` is never sent without a preceding
`identify` call in the same handler.

## 1b. Call sites

Every call goes through the SDK module — grep for the endpoint string; more than
one hit outside the module is a finding.

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

## 5. Run the SDK's own tests

If `/moonforge:implement` generated tests, run them and report the result. If it
did not, say so — an untested generated SDK is a fair outcome to report, but not
one to leave implied.

## 6. Prove the real client sends

The only check that counts. Pick whichever is available:

- Run the game and watch its network traffic (engine network profiler, or
  `mitmproxy` / Charles).
- Temporarily point the client at a local listener
  (`python3 -m http.server 8080`) and confirm the JSON body and headers are
  exactly what §1 expects.
- Add a one-line debug print of the response status behind the debug flag, run
  once, and remove it.

State plainly which of these was done. "The code looks right" is not
verification, and on this path — where you wrote the SDK as well as the calls —
it is the easiest place to fool yourself.

## 7. Present the event inventory

List each event, its trigger site, and its properties. Flag any event that is
emitted from more than one place — duplicate emission is the most common defect
in generated instrumentation.
