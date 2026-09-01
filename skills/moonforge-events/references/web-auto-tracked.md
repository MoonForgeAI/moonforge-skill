# Web — Auto-Tracked (P0), No Code Needed
The bundled Web SDK auto-tracks once `MoonForgeAnalytics.init()` runs:
- `session_start` — on init (with `session_id`; re-engagement after the
  inactivity timeout carries `previous_session_id` too).
- `session_end` — on page hide/unload (with `session_id`, `duration_seconds`).
- `first_open` — once per device, the moment its distinct id is first
  created (the install signal — not the same as "the first `session_start`").
- `app_update` — once, on a returning device's `session_start`, when
  `appVersion` differs from the last one this device saw.
- `screen_view` — via `trackScreenView(name)`; auto for SPA route changes if wired.
- Unhandled JS errors and promise rejections (error pipeline).
- Geolocation (server-side, from IP) and UTM/click-ID parsing (server-side,
  from the `url` field's query string) — no client code involved at all.
So P0 session/install/screen items need no manual instrumentation on web.
