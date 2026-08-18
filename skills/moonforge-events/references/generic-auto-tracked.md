# Any Engine — P0 is NOT Auto-Tracked

On Unity and web, P0 session events come free with the SDK. On the generic path
there is no SDK, so **nothing is automatic**. P0 is implementation work here,
not a freebie — and it is the highest-value work, because session counts,
playtime, and retention all derive from it.

Present P0 to the user as required implementation rather than "already handled":

- `session_start` — emit once at boot with `{ session_id }` (a UUID generated
  per launch).
- `session_end` — emit at shutdown with `{ session_id, duration_seconds }`.
- `screen_view` — emit on each scene/screen change with `{ screen_name }`.

`session_end` is the one that gets dropped. It has to fire on the engine's quit
notification (Godot `NOTIFICATION_WM_CLOSE_REQUEST`, Unreal
`FCoreDelegates::OnPreExit`), and a hard crash or force-quit will still lose it.
Say this plainly rather than implying session data will be complete — sessions
without an end are normal on this path and downstream analysis has to tolerate
them.

Error tracking is likewise manual: there is no global exception hook unless one
is written. If the user wants errors, that is a separate deliberate piece of
work, not a checkbox.
