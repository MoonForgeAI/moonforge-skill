# Telemetry taxonomy verification

Run after the event inventory. Registry:
`moonforge-events/references/telemetry-model.md`.

## Tier coverage (from user selection + game profile)

| Selected | Profile signal | Required in codebase |
|----------|----------------|----------------------|
| P0 | Always | `session_start`, `first_open` present (auto on web/Unity; must be manually wired on generic engines) |
| P1 | Monetization: IAP | `iap_initiated` and/or `iap_completed` at store hooks |
| P1 | Monetization: ads | `ad_started` / `ad_completed` and/or `ad_impression` |
| P1 | Any onboarding exists | `tutorial_start` and `tutorial_complete` |
| P1 | Accounts | `account_created` at the signup handler, called after `Identify` |
| P2 | Economy resources present | at least one `economy_transaction` |
| P2 | UI surfaces beyond scenes | extra `TrackScreenView` / screen_view for modals/menus |

If a tier was selected but required events are missing → **FAIL** with specific gaps.

## Forbidden aliases (grep — any hit is FAIL)

`purchase_complete`, `purchase`, `in_app_purchase`, `buy_item`, `resource_spent`,
`resource_transaction`, `currency_change`, `economy_change`, `session_begin`,
`app_open`, `sessionStart`, `rewarded_ad_watched`, `ad_view`, `download`,
`app_installed`, `signup`, `signup_complete`, `register`, `create_account`

## Locked name presence

```bash
# Economy must use the single locked name
grep -rn 'economy_transaction' <source roots>
# If economy hooks exist but only bespoke names appear → FAIL

# Revenue locked set
grep -rn 'iap_initiated\|iap_completed\|ad_started\|ad_completed\|ad_impression' <source roots>

# FTUE/account locked set
grep -rn 'tutorial_start\|tutorial_complete\|account_created' <source roots>
```

## Schema spot-checks

Sample each locked event in the inventory:

- `economy_transaction` → has `reason`; uses `input_N_*` / `output_N_*` keys (not nested objects)
- `iap_completed` → `product_id`, `price`, `currency`, `transaction_id`
- `ad_completed` → `ad_type`, `placement`, `watched_fraction`
- `session_start` → `session_id`
- `tutorial_complete` → `outcome` is `completed` or `skipped` when present, not a free string
- `account_created` → `signup_method` is one of the locked enum values; sent
  **after** an `Identify` call in the surrounding code, never on its own

## Attribution/geo — confirm nothing is client-captured

This model relies on the collector deriving geolocation from IP and
UTM/click IDs from the `url` field's query string — **not** on client code.
- Grep for `timezone`, `getLocaleGeo`, or a custom UTM-parsing module in the
  SDK/init path — any hit means stale (pre-fix) telemetry guidance was
  followed, and should be flagged, not treated as extra coverage.
- Confirm the SDK's `url` field is *not* stripped to bare `pathname`/scene —
  it must retain the query string (web) or an equivalent (generic engines),
  or the whole UTM/click-ID pipeline silently gets nothing to parse.

## Session / SDK contract

- `session_start` / `session_end` / `first_open` / `app_update` use locked names only
- Re-engagement `session_start` includes `previous_session_id` when inactivity timeout fired (if testable)
- `first_open` fires once per device (tied to distinct id creation), not once per session
- `app_update` never fires on the same launch as `first_open` (a device's first-ever launch has nothing to compare against)

## Report format

Add a **Telemetry taxonomy** section to verification results:

```
### Telemetry taxonomy: [PASS/FAIL]
- Tier coverage: [details]
- Forbidden aliases: [PASS / list]
- Locked schema samples: [PASS / list]
- Attribution/geo: [PASS - nothing client-captured / FAIL - list stale code]
```
