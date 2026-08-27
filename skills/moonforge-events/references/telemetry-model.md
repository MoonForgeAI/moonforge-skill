# Canonical Telemetry Model (Immutable Registry)

**Hard rule:** Session, economy, and revenue use one global catalog of event
names and required property keys. Same strings in every game, every engine,
every recommendation and `TrackEvent` call. **Zero deviation** — no synonyms,
no genre renames, no “close enough.” Game-specific meaning goes in
**properties** (e.g. economy `reason`), never in the event `name`.

**Client-only rule:** Skills implement **client/game code only**. Do **not**
assume the collector or any server enriches geolocation, attribution, UTM,
click IDs, or session context. Anything needed for analysis must be **read on
the device/runtime and sent in the event payload**. Omit a field only when the
platform genuinely cannot provide it (e.g. no location permission) — never
because “the server will fill it in.”

Game **actions**, most **UI** screen labels, and **P3 engagement** names may
vary by game. Resource *type values* (e.g. `gold`, `gems`) may vary; keys and
event names for session / economy / revenue do not.

---

## Session (P0 — SDK auto; same names if manually wired)

| Event name | Required props | Notes |
|------------|----------------|-------|
| `session_start` | `session_id` | On init. Re-engagement also uses **this same name** with extra `previous_session_id`. Attach **client context** props below when available. |
| `session_end` | `session_id`, `duration_seconds` | On quit / page hide |

**Forbidden aliases:** `session_begin`, `app_open`, `sessionStart`, `session_started`, etc.

### Client context props (locked keys — capture on client)

Attach on `session_start` (and merge into later events via SDK user/session
properties when the SDK supports it). Use these **exact** keys; omit only if
unavailable after a real client lookup.

**Device / locale (usually always available):**
- `timezone` — IANA or offset string from the device (e.g. `Australia/Sydney`)
- `locale` — device locale if distinct from auto `language` (optional)

**Geolocation (client APIs only — never IP/server):**
- `country` — ISO country when known (Geolocation + reverse geocode, OS locale
  region, or store/account region APIs the game already uses)
- `region` — state/province when known
- `city` — when known
- If precise geo is denied/unavailable: still send `timezone` (and region from
  locale if the OS exposes it). Do **not** skip all location signals.

**Attribution / acquisition (from launch URL, deep link, install referrer, or
stored first-touch — all client-side):**
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `gclid`, `fbclid` (and other click IDs present in the launch URL)
- `attr_touch` — `first` \| `last` \| `only` when distinguishing touches
- `attr_channel` — platform/channel string the client knows (e.g. deep-link host,
  store, `organic` if no campaign params)
- Persist **first-touch** campaign params in local storage / PlayerPrefs on first
  launch; send them on later `session_start` as well as last-touch from the
  current launch URL when present

Do **not** invent spend/cost or MMP-only fields the client does not have. Do
capture every campaign/referrer signal the client **can** read.

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
| **Core** | Yes (client) | Session events + auto payload (game, id, screen, language, url, title, referrer, timestamp, appVersion) **plus** client context props (geo, timezone, UTM/click IDs) — all sourced on device. |
| **Attribution** | Client | Parse launch URL / deep link / install referrer; persist first-touch locally; send on `session_start`. No server/MMP enrichment assumed. |
| **Game actions** | Names vary | Atomic start/complete or single-shot; props = state + outcome. |
| **Game economy** | Name + keys fixed | Always `economy_transaction`. |
| **UI** | Method fixed | Screen enter/exit via `TrackScreenView` / equivalent — not hover-level noise. |
| **Revenue** | Names + keys fixed | Locked `iap_*` / `ad_*` set above. |

---

## What may vary by game

- Game action event names (level/round/quest/kill/…)
- UI screen names passed to screen-view APIs
- P3 engagement names (`tutorial_step_completed`, etc.)
- Economy `reason` values and resource type *string values*
- Which geo fields are populated (depends on permissions / OS APIs)
