# Telemetry taxonomy verification

Run after the event inventory. Registry:
`moonforge-events/references/telemetry-model.md`.

## Tier coverage (from user selection + game profile)

| Selected | Profile signal | Required in codebase |
|----------|----------------|----------------------|
| P1 | Monetization: IAP | `iap_initiated` and/or `iap_completed` at store hooks |
| P1 | Monetization: ads | `ad_started` / `ad_completed` and/or `ad_impression` |
| P2 | Economy resources present | at least one `economy_transaction` |
| P2 | UI surfaces beyond scenes | extra `TrackScreenView` / screen_view for modals/menus |

If a tier was selected but required events are missing → **FAIL** with specific gaps.

## Forbidden aliases (grep — any hit is FAIL)

`purchase_complete`, `purchase`, `in_app_purchase`, `buy_item`, `resource_spent`,
`resource_transaction`, `currency_change`, `economy_change`, `session_begin`,
`app_open`, `sessionStart`, `rewarded_ad_watched`, `ad_view`

## Locked name presence

```bash
# Economy must use the single locked name
grep -rn 'economy_transaction' <source roots>
# If economy hooks exist but only bespoke names appear → FAIL

# Revenue locked set
grep -rn 'iap_initiated\|iap_completed\|ad_started\|ad_completed\|ad_impression' <source roots>
```

## Schema spot-checks

Sample each locked event in the inventory:

- `economy_transaction` → has `reason`; uses `input_N_*` / `output_N_*` keys (not nested objects)
- `iap_completed` → `product_id`, `price`, `currency`, `transaction_id`
- `ad_completed` → `ad_type`, `placement`, `watched_fraction`
- `session_start` → `session_id`; when SDK supports it: `timezone` and/or attribution keys when launch URL had campaign params

## Session / SDK contract

- `session_start` / `session_end` use locked names only
- Re-engagement `session_start` includes `previous_session_id` when inactivity timeout fired (if testable)
- Client context not assumed from server — if implementing P0 context, grep for `timezone` or `utm_source` in SDK init path

## Report format

Add a **Telemetry taxonomy** section to verification results:

```
### Telemetry taxonomy: [PASS/FAIL]
- Tier coverage: [details]
- Forbidden aliases: [PASS / list]
- Locked schema samples: [PASS / list]
```
