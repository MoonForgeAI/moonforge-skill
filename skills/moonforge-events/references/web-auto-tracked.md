# Web — Auto-Tracked (P0), No Code Needed

The generated Web SDK auto-tracks once `MoonForgeAnalytics.init()` runs.
Session event names are **locked** (see `telemetry-model.md`) — never rename:

- `session_start` — on init (with `session_id`).
- `session_end` — on page hide/unload (with `session_id`, `duration_seconds`).
- `screen_view` — via `trackScreenView(name)`; auto for SPA route changes if wired.
- Unhandled JS errors and promise rejections (error pipeline).

So P0 session/screen items need no manual instrumentation on web.
Recommendations start at P1.
