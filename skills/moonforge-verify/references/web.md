# MoonForge Verify — Web

## 1. Static checks
- SDK files present in the project (module folder or `moonforge.global.js`).
- `init({ gameId })` is wired at the game bootstrap.
- The first `identify()` call this device ever makes sends an `alias`
  (`previous_id` = the anonymous id, `id` = the real one) before `identify`
  itself, gated by a *persistent* flag (`hasAliased()`, not the in-memory
  buffering flag) — grep `analytics.js` for `alias` if it was modified.
  Without this, every player who signs up more than ~10s into their first
  session (the common case) becomes two unrelated player records forever.
  Confirm a second `identify()` call does not send a second `alias`.
- Syntax: `node --check` each SDK file and each modified game file. If the project
  uses TypeScript, run `npx tsc --noEmit`; if ESLint is configured, run `npx eslint`
  on the touched files.
- If the bundled SDK was modified rather than copied as-is: confirm `url` in
  `collectAutoFields()` still includes `location.search` — a re-truncation
  back to bare `pathname` silently starves the collector's UTM/click-ID
  parsing for every event. Confirm no client-side geo (`country`/`region`/
  `city`/`timezone`) or UTM-parsing code was added — both are server-side.
- If any locked event (revenue/economy/FTUE/accounts) was instrumented, run
  the checks in `moonforge-verify/references/telemetry-checks.md`.

## 2. Live collector check
**A 200 does not mean the event was stored.** The collector runs a bot filter on
the User-Agent and discards flagged traffic while still answering 200 — and
`curl`'s default User-Agent is flagged. Without the `-A` below, this check
reports success on an event that was thrown away. Verifying the wrong thing is
worse than not verifying.

Send a test event for the game and expect a 2xx JSON response:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://collector.moonforge.co/api/send \
  -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
  -H 'Content-Type: application/json' \
  -d '{"type":"event","payload":{"game":"<GAME_ID>","id":"verify-probe","name":"verify_test","data":{},"timestamp":'"$(date +%s)"'}}'
```
Expect `200`/`202`. Note `timestamp` is unix **seconds** (`date +%s`) — the
previous version of this check sent `0`, which lands in 1970 and is invisible to
any dashboard query. Repeat against `/api/errors` with a minimal error payload if error
tracking was instrumented.

## 3. Runtime check (manual)
Ask the user to run the game and watch the browser Network tab for POSTs to
`/api/send` (and `/api/errors`). `session_start` **and** `first_open` should
both fire on a fresh browser profile / cleared localStorage (a normal reload
must **not** re-fire `first_open`). If the project's own version differs from
a previously-seen one (e.g. bump `appVersion` in `init()` and reload), confirm
`app_update` fires with `previous_version`.

## 4. Present the event inventory
List the events instrumented, their trigger sites, and any P0 auto-tracked events.

## 5. Write `MOONFORGE_EVENTS.md`
Save the same inventory as a file in the project root — per
`moonforge-verify/references/event-inventory-export.md` — so it survives
after this conversation ends. Cover every event currently in the project,
not just what this run touched; overwrite the file completely each time.
