# The MoonForge SDK Contract

Every platform ends up with an SDK **inside the project**. None requires the
user to fetch a package, run another tool, or have anything pre-installed.

| Platform | How the SDK gets there |
|---|---|
| Web | Copied from this skill's `assets/moonforge-sdk/` |
| Unity | Generated into `Assets/MoonForge/` as C# |
| Unreal | Generated into `Source/` as C++, with a `UFUNCTION(BlueprintCallable)` surface — see `references/unreal.md` |
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
| **App version** | `appVersion` on every event and identify payload — the game/app's own version *at the moment the event is sent* (Unity: `Application.version`; web: the project's `package.json` `"version"`, passed through `init`'s `appVersion` option; other engines: whatever the project's own version metadata is). **Never** the moonforge-skill's or the generated SDK's own version — those are unrelated numbers that happen to also be called "version." If the project has no discoverable version, ask the user rather than hardcoding a placeholder like `"1.0.0"`. |
| **Screen & language** | `screen` (e.g. `"1920x1080"`) and `language` (e.g. `"en-US"`) on every event, read from whatever the platform actually exposes — not left to chance. Web and Unity always send both (real, always-available runtime APIs on both). On any other engine, source them for real (see `generic.md` §3 for the per-engine APIs) rather than defaulting to an empty string. Omit a field only when the platform genuinely has no such concept — a headless game server has no `screen` — never when it was simply not looked up. |
| `track_event(name, data)` | Fire-and-forget. Never blocks a frame, never throws. |
| `track_screen_view(name)` | Emits `screen_view` with `{ screen_name }`. |
| `identify(userId, traits)` | Sets the distinct id, emits `identify`, releases the pre-identify buffer. |
| `set_user_property(k, v)` | Persistent property merged into every later event's `data`. |
| **Session lifecycle** | `session_start` on init. `session_end` on the engine's quit hook with `{ session_id, duration_seconds }`. A fresh session after an inactivity timeout (default 1800s) carrying `previous_session_id`. |
| **`first_open`** | Fires once per device, the moment its distinct id is first created — before anything else can call the distinct-id getter (which creates one as a side effect). Not the same as "the first `session_start`": that only signals "no `previous_session_id`," which also fires after a storage clear or a device switch. This is the install signal ad platforms report against for CPI/ROAS — it deliberately re-fires on a reinstall/storage-clear for a returning player, matching Firebase's `first_open`/GA4's `first_visit`. Goes through the same pre-identify buffer as `session_start` (no special-casing needed — it's a normal event). |
| **`app_update`** | Fires once, on a returning device's `session_start`, when the configured `appVersion` differs from the last one this device saw — `{ previous_version }`. Never fires on a device's genuine first-ever launch (nothing stored to compare against — that's `first_open`'s moment). Self-gating: compare-then-store on every init is safe to call unconditionally. |
| **Pre-identify buffering** | Events emitted before `identify` are held (cap 50) and rewritten to the real id when it lands. Flush anonymously after ~10s if identify never comes — losing them is worse than an anonymous id. Without this, everything before login is stranded: it is what made two thirds of one real game's players look like single-day visitors. |
| **Alias on first identify** | Buffering only protects the ~10s/50-event window. Most players play anonymously for far longer than that before ever creating an account — the *common* case, not the edge case — so by the time `identify` is ever called, their landing `session_start` is almost always already flushed under the anonymous id. On the **first** `identify(userId, ...)` call this device has ever made (track this persistently — not the in-memory buffering flag, which resets every page load), send an `alias` event linking the anonymous id to the real one **before** anything else, so the collector can reconcile the two into one player. Never fire it again for this device unless identity is reset (e.g. logout on a shared device). Never buffer it — same as `identify`. Without this, every player who signs up more than ~10 seconds into their first session becomes two permanently separate player records: an anonymous one holding all their pre-signup activity, and a real one with none of it. |
| **`account_created`** (games with accounts) | Fires when signup completes: `{ signup_method, provider? }`. Call `identify()` **first**, then `track_event("account_created", ...)` — two separate calls, always in that order, never combined and never inferred from `identify` alone (a returning player's first `identify` on a *new* device is a login, not a signup). See `moonforge-events/references/telemetry-model.md` for the enum values. |
| **`tutorial_start` / `tutorial_complete`** | Locked FTUE events — fire whenever the game has any onboarding, regardless of genre. `tutorial_complete` carries optional `outcome` (`completed` \| `skipped`). Per-step tutorial detail is a separate, game-specific event (not locked) — see the telemetry model. |
| **Locked revenue/economy catalog** | `iap_initiated`, `iap_completed`, `ad_started`, `ad_completed`, `ad_impression`, `economy_transaction` — exact names and required/optional properties are in `moonforge-events/references/telemetry-model.md`. Zero deviation: copy verbatim, never rename. |
| **Persistent distinct id** | Created once, stored on disk, reused across launches. Never derived from a device fingerprint or IP. |
| **Transport** | Off the main thread, 2–5s timeout, correct User-Agent, every error swallowed. |
| `flush()` | Best-effort drain, for use before quit. |
| **Error capture** (optional) | Hook the engine's global handler and report through the batched, deduplicated pipeline in [Error reporting](#error-reporting), if the engine has one and the user wants it. Offer; do not assume. Never one POST per error. |

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
    "timestamp": 1755381234,
    "appVersion": "1.4.2"
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
    "timestamp": 1755381234,
    "appVersion": "1.4.2"
  }
}
```

### Alias
Sent once per device, immediately before the *first* `identify` call ever
succeeds on it — never repeated afterward unless identity is explicitly reset.
```json
{
  "type": "alias",
  "payload": {
    "game": "<GAME_UUID>",
    "id": "<the real id just passed to identify>",
    "previous_id": "<the anonymous distinct id this device had until now>",
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
| `appVersion` | The game's own version, read fresh at send time — not cached from a value that could go stale, not the skill's version. |
| `screen`, `language` | Send whenever the platform can provide them (see the capability table above) — not optional in the "don't bother" sense, only in the "may not exist on this platform" sense. |
| `previous_id` (alias only) | The anonymous id being replaced. Required on `alias`, absent everywhere else. |
| `url` | **Must include the query string** (`pathname + search + hash`, not just `pathname + hash`) when the platform has one. The collector parses `utm_*`/click IDs straight out of this field server-side for every event — confirmed against its own ingestion code, not inferred. Truncating the query string silently starves that entire pipeline; this happened for real and went unnoticed for a long time. Do **not** build any client-side UTM-parsing or attribution-persistence code — there is nothing else to wire beyond not stripping this field. |

Optional, safe to omit (but never truncate `url` if the platform has one — see above): `title`, `referrer`, `hostname`.

Also **never** send `country`/`region`/`city`/`timezone` — the collector
derives geolocation from the request IP, more reliably than any client-side
locale/OS guess. Client-side capture here is a step backward, not extra data.

## Error reporting

One POST per error is not acceptable: a single looping failure in one live game
produced ~4M reports a day and was rate-limited by the collector. Any SDK that
captures errors must implement all of the following (the bundled web SDK does —
`errors.js`, `error-queue.js`, `error-batch.js`, `error-fingerprint.js`,
`error-payload.js`).

| Rule | Behaviour |
|---|---|
| **Fingerprint** | Thrown errors: type + message + top stack frame. Network errors: method + URL path **without** query string or fragment + status (`failed` when the request threw). Messages: level + text. The fingerprint is a client-side dedupe key only — never sent; the collector computes its own grouping. |
| **Dedupe** | The first occurrence of a fingerprint in a session is queued with full breadcrumbs. Repeats only add to a count: merged into the queued report while it is unsent; after it is sent, held and reported as a count-only report (no breadcrumbs) at most once per 60s per fingerprint, and on page hide / explicit flush. |
| **Per-session cap** | At most `maxErrorReportsPerSession` (default **100**) distinct fingerprints are reported per session. Past it, occurrences are only counted locally (`getStats().suppressed`). At most 1000 fingerprints are remembered per session. A new session (inactivity timeout) gets a fresh budget. |
| **Batching** | Queue flushed to `POST /api/errors/batch` every **5s**, or immediately at **20** queued, at most 20 reports and 256KB per request (collector max is 50), one game per request. Requests that fit the keepalive budget are sent with `keepalive` so a send in flight survives a navigation. |
| **Page teardown** | On `pagehide` and `visibilitychange` → `hidden`: send everything queued (plus held repeat counts) with `fetch(..., { keepalive: true })`, all requests fired together (the page may freeze at any await), each kept under 60KB (browsers cap in-flight keepalive bodies at 64KB); an oversized report drops its raw stack and breadcrumbs to fit. Skipped while a 429 pause is active; attempted even during a transport-failure backoff. |
| **429 backoff** | On a 429, pause **all** error sending until `now + retryAfterMs` from the body `{ error, reason, retryAfterMs }` (default 60000 if absent, clamped to 1s–1h). The refused batch goes back to the head of the queue. Explicit `flush()` respects the pause. |
| **Other failures** | Network error, 5xx, 408, 425: retry with exponential backoff (5s doubling, max 5 min), giving up on an entry after 6 attempts. 400/413 on a multi-report batch: the collector validates a batch as a whole, so resend each report on its own. Any other 4xx (or 400 on a single report): refused; drop it, never resend (`getStats().rejected`). A dropped *first* report frees its slot, so the next occurrence is sent in full again. |
| **Bounded queue** | At most **200** entries; when full the oldest are dropped and counted (`getStats().dropped`). |
| **Schema limits** | Every item is clipped to the collector's field limits before sending (message 5000, raw stack 50000, frames 200, breadcrumbs 100, tag values 200, URL 2000, method 10, …) and enum fields are coerced to valid values — the collector validates a batch as a whole, so one bad item would reject all 20. |
| **Network errors** | The fetch interceptor (opt-in, `trackNetworkErrors`) reports only responses with status ≥ `networkErrorMinStatus` (default **500**; 4xx are usually expected application answers) and fetches that throw — except `AbortError`, which the game caused itself. It never intercepts requests to the collector's own `apiEndpoint`. A direct `captureNetworkError(...)` call is always reported. |
| **Session identity** | Dedupe and the cap are keyed on the SDK session id. Where storage is blocked (private mode, sandboxed iframes), ids must fall back to in-memory values rather than being re-minted on every read — otherwise every error looks like a new session and nothing is deduplicated. |
| **Never throw** | Every capture call returns a Promise resolving to a boolean once the occurrence is queued (true = it will be sent as a report or a count; delivery is asynchronous); nothing in the pipeline may throw into the game. |

### Error batch wire format

`POST https://collector.moonforge.co/api/errors/batch`, `Content-Type: application/json`.

```json
{
  "type": "error_batch",
  "game": "<GAME_UUID>",
  "errors": [
    {
      "clientErrorId": "<uuid v4, unique per report>",
      "errorType": "exception",
      "errorCategory": "unhandled",
      "errorLevel": "error",
      "message": "Cannot read properties of undefined (reading 'x')",
      "exceptionClass": "TypeError",
      "frames": [{ "function": "load", "filename": "https://game.example/app.js", "lineno": 10, "colno": 5, "inApp": true }],
      "rawStackTrace": "TypeError: ...",
      "device": { "platform": "web", "osVersion": "Mac OS X 10.15.7", "deviceModel": "Browser (Chrome)" },
      "appVersion": "1.4.2",
      "buildNumber": "1",
      "sessionId": "<session uuid>",
      "timestamp": 1755381234,
      "breadcrumbs": [{ "type": "user", "level": "info", "message": "opened shop", "timestamp": 1755381230000 }],
      "tags": { "mf_occurrences": "3" }
    }
  ]
}
```

Items are the single-error payload **without** `game` (it is on the batch),
plus `clientErrorId`. Unknown fields are silently stripped by the collector, so
the repeat count travels in `tags`, which it stores:

| Tag | Meaning |
|---|---|
| `mf_occurrences` | Occurrences this report stands for, as a string (`"1"` for a single one). Present on every report. |
| `mf_repeat` | `"true"` on a count-only report for a fingerprint already reported this session (no breadcrumbs). |

The total occurrences of an issue are the sum of `mf_occurrences` across its
reports, not the row count.

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
- The first-ever `identify` on a fresh device sends an `alias` (previous
  anonymous id → real id) before the `identify` itself; a second `identify`
  call does not send another one.
- `first_open` fires once, on a genuinely fresh distinct id — and never again
  on a later launch from the same (persisted) device.
- `app_update` fires only when a previously-stored `appVersion` differs from
  the current one — never on a device's first-ever launch.
- `url` retains its query string (not truncated to bare `pathname`/scene).
- A transport failure cannot propagate into game code.
- If errors are captured: repeats of one error produce one report with a
  count, not one request each; a 429 pauses sending for `retryAfterMs`; the
  queue never grows past its bound.

If the project has no test framework and the user does not want one added, say
plainly that the SDK is untested. Do not imply it was verified.
