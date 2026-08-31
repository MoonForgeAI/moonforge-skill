# Handoff: Reconciling Pre-Signup and Post-Signup Player Identity

**Audience:** whoever owns the collector ingestion service and the
`mart_player_info` build job. **Not implementable from the `moonforge-skill`
repo** — this describes what the SDKs now send and what the collector/mart
side needs to do with it.

## The problem

Every MoonForge SDK assigns a random anonymous `distinct_id` on first launch,
persisted locally (`localStorage` on web, `PlayerPrefs` on Unity). When a
player eventually creates an account, the SDK calls `identify(realUserId)`,
which relabels *future* events with the real id. It cannot retroactively
relabel anything already sent to the collector.

The SDKs already buffer events for up to ~10 seconds (or 50 events) after
launch, rewriting them to the real id if `identify` resolves within that
window — this covers a *returning, already-registered* player whose login
session is still restoring asynchronously on launch.

It does **not** cover the far more common case: a **genuinely new** player
who explores anonymously for any real length of time — often an entire
session, sometimes many sessions, sometimes forever — before ever creating an
account, if they ever do. Their landing `session_start` and everything else
in that pre-signup activity is sent under the anonymous id long before
`identify` is ever called.

**Consequence today:** that player permanently becomes two unrelated rows —
an anonymous `distinct_id` holding all their pre-signup activity that nothing
will ever query again, and a real `distinct_id` (post-signup) with none of
it. `mart_player_info` groups by `(game_id, distinct_id)`, so this splits one
human into two player records with no way to recombine them.

This matters even more once first-touch marketing attribution
(`utm_source`/`utm_campaign`/click IDs on the landing `session_start`) is
captured correctly — see [the separate, related issue](#related-separate-issue-utmclick-id-data-is-currently-always-empty)
below — since that data lives specifically on the landing event, which is
exactly the event most likely to be sent under an anonymous id that never
gets reconciled.

## What the SDK now sends

On the **first** `identify()` call a device ever makes — tracked with a
persistent flag, not the in-memory session state, so a returning
already-identified player reloading the app and calling `identify` again does
**not** repeat this — the SDK sends a new event type, immediately, never
buffered:

```json
{
  "type": "alias",
  "payload": {
    "game": "<GAME_UUID>",
    "id": "<the real id just passed to identify>",
    "previous_id": "<the anonymous distinct_id this device had until now>",
    "timestamp": 1755381234
  }
}
```

Sent to the same endpoint as everything else: `POST /api/send`.

It fires again for the *same device* only if identity is explicitly reset
(e.g. a game calls `reset()` on logout, so a different person on a shared
device gets their own alias when they eventually sign in) — each reset +
re-identify produces one more `(previous_id → id)` pair for that device.

This is implemented in the web SDK now (`core.js`/`analytics.js` in
`moonforge-skill`). The Unity and generic-engine paths are specified to do
the same (`sdk-contract.md`'s "Alias on first identify" row) but depend on
whoever generates/maintains those SDKs actually implementing it.

## What needs to happen on the collector/mart side

This repo has no visibility into the collector's application source — only
read access to its ClickHouse data. The following is a **proposed shape**,
not a spec of what exists; whoever owns that codebase should adapt it to
however ingestion is actually structured today.

1. **Record every alias pair.** A small table is enough:
   ```sql
   CREATE TABLE game_identity_alias (
     game_id UUID,
     distinct_id String,      -- the real id (post-signup)
     previous_id String,      -- the anonymous id (pre-signup)
     created_at DateTime('UTC')
   ) ENGINE = MergeTree ORDER BY (game_id, previous_id)
   ```
   One row per `alias` event received. Cheap, append-only, matches how the
   collector already treats every other event type.

2. **Resolve chains to one canonical id.** A player can in principle be
   re-aliased more than once (shared-device logout/login cycles, or a game
   that calls `identify` with a different id later for its own reasons). The
   resolution logic needs to walk `previous_id → distinct_id` chains to a
   single canonical id per person — a union-find over `(game_id, distinct_id
   or previous_id)` pairs, or an iterative "follow the chain until it stops
   changing" pass, are both standard approaches. **Decision needed:** which
   id becomes canonical — the original anonymous id (stable from first
   launch, but meaningless to a human) or the most recent real id (matches
   what the game's own backend calls this player, but changes if re-aliased
   again)? Most systems (Segment, Mixpanel, PostHog) pick the most recent
   *identified* id as canonical and treat earlier ones as merged-in aliases.

3. **Join at mart-build time, not by mutating history.** `game_event` and
   `game_event_data` are the raw event log — leave them as-is (ClickHouse
   `MergeTree` tables don't support cheap in-place updates, so rewriting
   millions of historical rows' `distinct_id` is not the right approach
   anyway). Instead, when building `mart_player_info` and similar rollups,
   resolve each `distinct_id` to its canonical id via the alias table *before*
   grouping, so a player's pre-signup and post-signup activity lands in one
   row.

4. **Fix the separate `argMin`-on-empty-string bug while touching this
   pipeline.** Independently confirmed (see below): every `first_*` column in
   `mart_player_info` (`first_country`, `first_os`, `first_device`,
   `first_language`, `first_version`, `first_utm_source`, `first_utm_campaign`,
   `first_referrer_domain`) is computed with a plain `argMin(col, created_at)`,
   which picks the value from the literal earliest row **even if it's an
   empty string** — it does not find the first *non-empty* value. Confirmed
   empirically: three real players whose literal-first `game_event.city` was
   empty but who had a populated `city` on a later event all show
   `first_city = ''` in `mart_player_info` today. This should be
   `argMinIf(col, created_at, col != '')` (or an equivalent pre-filter)
   instead. Not required for the identity-reconciliation fix itself, but
   worth doing in the same pass since it affects every `first_*` field these
   marts rely on, including the `first_utm_source`/`first_utm_campaign`
   columns this whole effort is trying to make useful.

## Related, separate issue: UTM/click-ID data is currently always empty

**Not part of this change** — flagging it here only because it compounds
directly with the identity problem above, and because fixing it is what will
make the `argMin` bug in item 4 above actually visible/worth fixing.

The web SDK's `url` field currently strips the query string before sending
(`pathname + hash` only, no `search`) — so `utm_source`, `utm_medium`,
`utm_campaign`, `gclid`, `fbclid`, and `url_query` have been empty in
`game_event`, for every game, always. Confirmed directly against production
data: zero non-empty rows for any of those columns in the last 30 days across
433M+ events, while `url_path`/`hostname` are populated on ~100% of events —
so the collector's existing `url`+`hostname` → UTM/click-ID parsing pipeline
is alive and working, it has simply never been given a query string to parse.
The one-line client fix (include `location.search` in `url`) is straightforward
but deliberately **not** bundled into this alias work — worth its own change
whenever it's picked up.

## Suggested verification once this and the alias mechanism are both live

1. Send a test event as a fresh anonymous id with `?utm_source=test123` in
   the URL (requires the separate `url`-query-string fix above). Confirm
   `game_event.utm_source = 'test123'` and `url_query` is populated.
2. Call `identify('test-user-1')` on that same session. Confirm an `alias`
   event arrives with `previous_id` = the anonymous id and `id` =
   `'test-user-1'`.
3. Query `mart_player_info` for `distinct_id = 'test-user-1'` (post-fix) and
   confirm `first_utm_source` resolves to `'test123'` — i.e. it found the
   anonymous id's history via the alias, not just its own.
