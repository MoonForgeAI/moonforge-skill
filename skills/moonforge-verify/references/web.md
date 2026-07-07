# MoonForge Verify — Web

## 1. Static checks
- SDK files present in the project (module folder or `moonforge.global.js`).
- `init({ gameId })` is wired at the game bootstrap.
- Syntax: `node --check` each SDK file and each modified game file. If the project
  uses TypeScript, run `npx tsc --noEmit`; if ESLint is configured, run `npx eslint`
  on the touched files.

## 2. Live collector check
Send a test event for the game and expect a 2xx JSON response:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://collector.moonforge.co/api/send \
  -H 'Content-Type: application/json' \
  -d '{"type":"event","payload":{"game":"<GAME_ID>","name":"verify_test","url":"/","timestamp":0}}'
```
Expect `200`/`202`. Repeat against `/api/errors` with a minimal error payload if error
tracking was instrumented.

## 3. Runtime check (manual)
Ask the user to run the game and watch the browser Network tab for POSTs to
`/api/send` (and `/api/errors`). `session_start` should fire on load.

## 4. Present the event inventory
List the events instrumented, their trigger sites, and any P0 auto-tracked events.
