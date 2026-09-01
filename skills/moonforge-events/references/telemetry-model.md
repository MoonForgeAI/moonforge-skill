# Canonical Telemetry Model (Immutable Registry)

**Hard rule:** Session, FTUE/account, economy, and revenue use one global
catalog of event names and required property keys. Same strings in every game,
every engine, every recommendation and `TrackEvent` call. **Zero deviation** —
no synonyms, no genre renames, no "close enough." Game-specific meaning goes
in **properties** (e.g. economy `reason`), never in the event `name`.

Game **actions**, most **UI** screen labels, and **P3 engagement** names may
vary by game. Resource *type values* (e.g. `gold`, `gems`) may vary; keys and
event names for session / FTUE-account / economy / revenue do not.

---

## Session & lifecycle (P0 — SDK auto; same names if manually wired)

| Event name | Required props | Notes |
|------------|----------------|-------|
| `session_start` | `session_id` | On init. Re-engagement also uses **this same name** with extra `previous_session_id`. |
| `session_end` | `session_id`, `duration_seconds` | On quit / page hide |
| `first_open` | — | Once per device, the moment its distinct id is first created — the install signal. Re-fires on reinstall/storage-clear for a returning player, by design (device/install-instance signal, not a human signal — matches Firebase/GA4). |
| `app_update` | `previous_version` | Once, on a returning device's `session_start`, when `appVersion` differs from the last one seen for that device. Never fires on a device's first-ever launch (`first_open`'s territory). |
| `alias` (wire **type**, not an event name) | `id`, `previous_id` | P0, auto — but easy to drop from any summary built by scanning for `track_event`/`TrackEvent` calls, since it has **no game-code call site**: it fires automatically inside `identify()`'s own implementation, on the device's first-ever `identify()` call only, never as its own tracking call. Full mechanism: `sdk-contract.md`'s "Alias on first identify" capability. |

**This table is the copy-from source for every other P0 list in this skill** (`moonforge/SKILL.md`, `moonforge-events/SKILL.md`, `*-auto-tracked.md`, `event-inventory-export.md`'s example). If you're writing or checking one of those, copy this table's row set — do not reconstruct the P0 list from memory or from what has a visible call site, which is exactly how `alias` gets dropped.

**Forbidden aliases:** `session_begin`, `app_open`, `sessionStart`, `session_started`, `download`, `app_installed`, etc.

### Attribution and geolocation — server-side, not client (do not implement)

Unlike earlier drafts of this model, **do not** build client-side geo or
attribution capture. Confirmed against the collector's own ingestion code:

- `country`/`region`/`city` are derived server-side from the request IP —
  more reliable than any client-side locale/OS guess.
- `utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`utm_term` and click
  IDs (`gclid`, `fbclid`, etc.) are parsed server-side straight out of the
  `url` field's own query string (`new URL(url) -> searchParams`), for every
  event — not scoped to any particular event name.

The **only** client requirement is that `url` actually includes the query
string (`pathname + search + hash`, not just `pathname + hash`) — stripping it
silently starves this entire pipeline. No first-touch persistence, no
attribution-parsing module, no `timezone`/geo fields to send.

---

## FTUE & accounts (P1 — locked names, zero deviation)

| Event name | Required props | Optional props | Notes |
|------------|----------------|-----------------|-------|
| `tutorial_start` | — | — | The FTUE begins |
| `tutorial_complete` | — | `outcome` | The FTUE ends, however it ended |
| `account_created` | `signup_method` | `provider` | Signup completes, for games with real accounts |

### Locked enum values

- `outcome` (`tutorial_complete`): `completed` \| `skipped`
- `signup_method`: `email` \| `social` \| `platform` \| `guest_upgrade` \| `other`
- `provider` (`account_created`, optional): free string naming which one when
  `signup_method` is `social`/`platform` — e.g. `google`, `apple`, `facebook`
  (social), `steam`, `psn`, `xbox`, `game_center`, `google_play_games` (platform)

### Call order with `Identify`

`Identify(userId, traits)` **first**, then `TrackEvent("account_created", ...)`
— two separate calls, always in that order:

- `Identify` is the generic "we now know who this is" call. It fires on
  **both** login and signup, and drives alias reconciliation of the player's
  pre-signup anonymous history (see `sdk-contract.md`'s alias capability).
- `account_created` is the specific *business* event marking the signup
  moment — it carries properties `Identify` doesn't, and must **not** be
  inferred from `Identify` alone. A returning player logging into an
  *existing* account on a new device also makes their first-ever `Identify`
  call on that device — that's a login, not a signup, and must not produce a
  spurious `account_created`.
- Calling `Identify` first means `account_created` already carries the real
  id when it sends, rather than depending on the pre-identify buffer to
  attribute it correctly.

### Per-step tutorial detail is not locked

`tutorial_start`/`tutorial_complete` exist so cross-game FTUE-completion-rate
comparisons work even when a tutorial has no discrete steps. A game whose
tutorial has multiple steps worth funnel analysis adds its own event on top —
recommended convention (not enforced): `tutorial_step_completed` with
`step_number`/`step_name`, in P3. Step vocabularies are inherently
game-specific — a 12-step tutorial and a single "swipe to move" prompt need
different schemas, the same way `economy_transaction`'s `reason` can't be
universal.

**Forbidden aliases:** `download`, `signup`, `signup_complete`, `register`, `create_account`, etc. — always `account_created`.

---

## Economy (P2 — one name for every transform, every game)

| Event name | Role |
|------------|------|
| `economy_transaction` | **Only** economy event name. One row per economic state change. |

### Properties (flat; omit unused slots; never rename keys)

- `reason` (string, required) — why it happened (game-specific:
  `upgrade_weapon`, `claim_login_reward`, `end_of_match_payout`). Bespoke
  meaning lives here.
- Inputs (up to 3): `input_1_type`, `input_1_before`, `input_1_after` …
  `input_3_type`, `input_3_before`, `input_3_after`
- Outputs (up to 3): `output_1_type`, `output_1_before`, `output_1_after` …
  `output_3_type`, `output_3_before`, `output_3_after`
- Free reward → omit inputs; sink with no grant → omit outputs
- Do **not** duplicate auto fields (`timestamp`, scene, device, language)

**Forbidden:** naming the TrackEvent after the reason
(`TrackEvent("upgrade_weapon")`), or synonyms (`resource_transaction`,
`currency_change`, `economy_change`, `resource_spent`).

### Example

```
economy_transaction {
  reason: "upgrade_weapon",
  input_1_type: "gold",
  input_1_before: 500,
  input_1_after: 200,
  input_2_type: "weapon_t6",
  input_2_before: 1,
  input_2_after: 0,
  output_1_type: "weapon_t7",
  output_1_before: 0,
  output_1_after: 1
}
```

---

## Revenue (P1 — locked set)

| Event name | Required props | Optional props |
|------------|----------------|----------------|
| `iap_initiated` | `product_id`, `price`, `currency` | `product_name`, `store` |
| `iap_completed` | `product_id`, `price`, `currency`, `transaction_id` | `product_name`, `store` |
| `ad_started` | `ad_type`, `placement` | `provider`, campaign/attrs if available |
| `ad_completed` | `ad_type`, `placement`, `watched_fraction` | `provider`, `rewarded` (bool), `duration_seconds` |
| `ad_impression` | `ad_type`, `placement` | `provider` — when mediation only exposes impression |

### Locked enum values

- `ad_type`: `rewarded` \| `interstitial` \| `banner` \| `other`
- `store` (preferred): `app_store` \| `google_play` \| `steam` \| `web` \| `other`

**Forbidden aliases:** `purchase`, `purchase_complete`, `in_app_purchase`,
`buy_item`, `ad_view`, `rewarded_ad_watched`, etc.

---

## Layers summary (north star)

| Layer | Standardized? | Notes |
|-------|---------------|-------|
| **Core** | Yes (SDK auto) | Session/install/update events + auto payload (game, id, screen, language, url, title, referrer, timestamp, appVersion). |
| **Attribution & geo** | Server-side | Derived by the collector from the request IP and the `url` field's query string. Client only needs to not strip the query string. |
| **FTUE & accounts** | Names + keys fixed | `tutorial_start`/`tutorial_complete`/`account_created`, locked. |
| **Game actions** | Names vary | Atomic start/complete or single-shot; props = state + outcome. |
| **Game economy** | Name + keys fixed | Always `economy_transaction`. |
| **UI** | Method fixed | Screen enter/exit via `TrackScreenView` / equivalent — not hover-level noise. |
| **Revenue** | Names + keys fixed | Locked `iap_*` / `ad_*` set above. |

---

## What may vary by game

- Game action event names (level/round/quest/kill/…)
- UI screen names passed to screen-view APIs
- P3 engagement names (`tutorial_step_completed`, etc.) and per-step tutorial schemas
- Economy `reason` values and resource type *string values*
- Which `provider` values appear on `account_created`/ad events
