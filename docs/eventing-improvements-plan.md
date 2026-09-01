# Eventing Improvements — Plan

Tracks three changes originating from a review of `pr-10` (the abandoned
"locked telemetry model" branch) against `main`. Branch: `feat-eventing-improvements`.

| # | Change | Status |
|---|--------|--------|
| 1 | Identity reconciliation (alias) | **Done** — committed, pushed |
| 2 | Core locked event catalog | **Done** — implemented, tested, documented |
| 3 | Event inventory export | **Done** — implemented, documented |

---

## Change 1: Identity Reconciliation (Alias) — Done

### Problem

Every SDK assigns a random anonymous `distinct_id` on first launch. When a
player creates an account, `identify()` only relabels *future* events — it
can't retroactively fix anything already sent. The SDK's pre-identify buffer
(~10s / 50 events) only covers a *returning, already-registered* player's
login resolving moments after launch. It does nothing for the far more common
case: a genuinely new player who explores anonymously for any real length of
time before ever signing up, if they ever do. Their entire pre-signup
history — including, once re-added, first-touch marketing attribution —
permanently orphans under an anonymous id nobody will ever query again once
they finally identify.

### What shipped

- New wire event, `alias`: `{ "type": "alias", "payload": { "game", "id": "<real id>", "previous_id": "<anon id>", "timestamp" } }`.
- Sent once per device, on the **first-ever** `identify()` call, gated by a
  persistent flag (`hasAliased()`/`markAliased()` in `core.js`, not the
  in-memory buffering flag) — a returning already-identified player reloading
  and calling `identify` again does not repeat it.
- Never buffered — same exemption as `identify`.
- `resetAll()` clears the flag, so a fresh anonymous id after logout (e.g. a
  different person on a shared device) is eligible for its own alias.
- Documented as a required capability in `sdk-contract.md` (so Unity/generic
  SDKs are held to it too), wired into both verify checklists
  (`moonforge-verify/references/{unity,generic}.md`), and noted in `web.md`.
- Tests: alias fires before `identify` with the right ids, doesn't repeat on
  a second login, re-arms after `resetAll()`.
- Also fixed 5 pre-existing test failures (unrelated pre-identify-buffer test
  gaps) and added dedicated coverage for the buffering behavior itself, which
  had none despite being the exact mechanism those failures depended on.

### Collector/mart-side follow-up (not implementable from this repo)

Spec'd in [`docs/identity-reconciliation-handoff.md`](identity-reconciliation-handoff.md):
an alias table, canonical-id resolution across alias chains, resolving at
mart-build time rather than mutating raw event history, and a separately
confirmed `argMin`-on-empty-string bug in `mart_player_info` (every `first_*`
column picks the literal-first row's value even if empty, not the first
*non-empty* one) worth fixing in the same pass.

**Status:** committed (`1e298f5`) and pushed to `origin/feat-eventing-improvements`.
PR: https://github.com/MoonForgeAI/moonforge-skill/pull/new/feat-eventing-improvements

---

## Change 2: Core Locked Event Catalog — Done

### What shipped

- **SDK (`core.js`/`analytics.js`/`index.js`):** `isFirstOpen()`/`checkAppUpdate()`/
  `prepareSessionStart()` in `core.js`; `trackFirstOpen`/`trackAppUpdate`/
  `trackSessionStart`/`trackTutorialStart`/`trackTutorialComplete`/
  `trackAccountCreated`/`trackEconomyTransaction`/`trackIapInitiated`/
  `trackIapCompleted`/`trackAdStarted`/`trackAdCompleted`/`trackAdImpression`
  in `analytics.js`; `first_open`/`app_update` wired into `init()`, exported
  on `MoonForgeAnalytics`. The `url` fix (`collectAutoFields()` now includes
  `location.search`) landed as a one-line change — no attribution module was
  needed, per the corrected understanding above.
- **Tests:** full coverage for every new/changed piece — `isFirstOpen`,
  `checkAppUpdate` (including the "no fire on first launch" and "no fire
  without appVersion" cases), `prepareSessionStart` chaining, the `url`
  query-string fix, `first_open`/`app_update` end-to-end via `init()`
  (including "does not repeat on a later launch"), and all locked revenue/
  economy/FTUE/account helpers. 49/49 tests passing.
- **Docs:** `moonforge-events/SKILL.md` (tier remap, new locked events, wrong
  client-geo/attribution guidance removed), new
  `moonforge-events/references/telemetry-model.md` (canonical registry),
  new `moonforge-implement/references/telemetry-implement.md` (hook recipes),
  new `moonforge-verify/references/telemetry-checks.md` (taxonomy checks),
  `sdk-contract.md` (new capability rows, corrected `url`/geo guidance),
  `moonforge-implement/references/{web,generic}.md`,
  `moonforge-verify/references/{web,unity,generic}.md`,
  `moonforge-analyze/references/{web,unity,generic}.md` (new profile
  signals: Monetization, Economy Resources, Accounts, UI Surfaces),
  `moonforge-events/references/{web,generic}-auto-tracked.md`.

### From `pr-10`: keep as-is

No bugs found in any of this — it's well-designed and was working correctly
on `pr-10` before that branch was abandoned:

- **Revenue** (locked names, zero deviation): `iap_initiated`, `iap_completed`,
  `ad_started`, `ad_completed`, `ad_impression`, with their required/optional
  props and locked enums (`ad_type`: `rewarded`\|`interstitial`\|`banner`\|`other`;
  `store`: `app_store`\|`google_play`\|`steam`\|`web`\|`other`).
- **Economy**: one name, `economy_transaction`, with `reason` (required) plus
  up to 3 `input_N_type/before/after` and 3 `output_N_type/before/after` slots.
- The matching SDK helpers: `trackEconomyTransaction`, `trackIapInitiated`,
  `trackIapCompleted`, `trackAdStarted`, `trackAdCompleted`, `trackAdImpression`
  (and the `flatRow` implementation backing the economy helper).
- Tier remap: P0 = core/auto, P1 = revenue + game actions, P2 = economy + UI
  gaps, P3 = optional engagement — replacing the old genre-recipe-first P1.
- `moonforge-analyze` profile additions that feed the above: Monetization,
  Economy Resources, Accounts, UI Surfaces.
- `previous_session_id` on re-engagement `session_start` (`prepareSessionStart()`'s
  inactivity-timeout rotation logic) — separate from the buffering regression;
  this part had no bug.
- `telemetry-implement.md` (hook recipes) / `telemetry-checks.md` (verify
  taxonomy checks) — the process docs built around the above.

### From `pr-10`: needs rework, not a straight port

- **UTM/attribution capture** — `pr-10`'s own client-side
  `context-capture.js`/`collectAttribution()` module is **not** being ported.
  Confirmed directly against the collector's ingestion source: it already
  parses `utm_source`/`utm_medium`/`utm_campaign`/`utm_content`/`utm_term`/
  click IDs straight out of the `url` field itself (`new URL(url, base)` →
  `.searchParams.get(...)`) for every `type: 'event'` payload — universal,
  not scoped to any event name. The only real blocker was `url` never
  carrying a query string to parse (stripped to `pathname + hash`, confirmed
  via production data — `utm_source`/`gclid`/`url_query` are 0% populated
  across every game, always). So the actual fix is a single line in
  `collectAutoFields()`, not a ported module — no first-touch persistence,
  no attribution-parsing code, no localStorage keys.

  **Bundling hazard, not a bug to fix:** `context-capture.js` doesn't exist
  on `main`/this branch at all — `country`/`region`/`city` were never
  client-captured here, and `main`'s own `moonforge-events/SKILL.md` already
  correctly documents these as server-side/IP-derived, "no code needed."
  `pr-10`'s wrong client-side geo guess (`getLocaleGeo()`, inferring
  `country` from `navigator.language`) lived bundled in the *same*
  `collectClientContext()` function as `collectAttribution()`. When
  re-adding UTM capture, don't pull that bundling back in — no client-side
  geo capture belongs in the reimplementation at all.
- **The `session_start`/`session_end` buffering exclusion** — an outright
  regression, not something to keep. Moot: `feat-eventing-improvements` is
  built on clean `main`, which never had it.

### New events to add

**`first_open`** (naming decided — not `download` or `app_installed`) —
fires once per device, the first time a fresh `distinct_id` is created.
**Not the same thing as "the first `session_start`"**: today, `session_start`'s
only "first-ness" signal is the *absence* of `previous_session_id`, which
fires identically whether this is a device's genuinely first-ever launch,
`localStorage` got cleared, or the player switched devices — there's no
dedicated signal for "a fresh `distinct_id` was just created," even though
that moment exists unambiguously in the code (`getDistinctId()`'s
`if (!id) { id = uuid(); ... }` branch). Matches Firebase's `first_open` /
GA4's `first_visit`, which both work this way specifically to decouple "was
this the first launch" from session-timeout semantics. Proposed to fire
**automatically** (P0, no instrumentation needed), the same way `session_start`
does, hooked to distinct-id creation rather than to session lifecycle at all.

**Confirmed this belongs alongside `session_start`, not instead of it** — the
two answer different questions and neither substitutes for the other:
`session_start`'s count *is* the session count (DAU, session frequency,
retention curves); `first_open`'s count is the install count (matches what ad
platforms report for ROAS/attribution reconciliation, anchors cohort day-0).
Approximating "installs" by filtering `session_start` for a missing
`previous_session_id` doesn't work — that's a noisy, indirect signal (it can
gap for reasons unrelated to installs at all), where a fresh `distinct_id` is
the precise, direct one. Same pattern as Firebase's `first_open` / GA4's
`first_visit` existing alongside their own session-start equivalents, for the
same reason.

**Note: `first_open` is a device/install-instance signal, not a human
signal — deliberately, not a gap to caveat.** A returning player who gets a
new phone, clears storage, or reinstalls the app *should* produce another
`first_open`, the same as a genuinely new player's first launch would. This
matches Firebase/GA4 exactly (both re-fire `first_open`/`first_visit` on a
reinstall for the same human) and is required for the event to do the one
job it exists for: matching what ad networks and app stores report as
"installs" for CPI/ROAS reconciliation, since those platforms attribute at
the device level too and have no concept of "this human played before."
Suppressing it for returning players would undercount installs relative to
what the ad network reports and break that reconciliation — the opposite of
the intended effect. This also means `alias` firing again on that new device
(linking its brief pre-login anonymous window to the same real user id) is
expected and correct, not a bug — see
[`identity-reconciliation-handoff.md`](identity-reconciliation-handoff.md)
for why this doesn't cause any downstream double-counting.

**Design requirement carried over from Change 1:** `first_open` needs the
exact same pre-identify-buffer-then-alias treatment `session_start` already
has. It fires before the player has any chance of having an account, so
without buffering + aliasing it will suffer the identical orphaning problem
Change 1 fixed — for the single most important acquisition event instead of
a generic one. Not optional; must ship together with the event itself, not
as a follow-up.

**`account_created`** — fires when a game with real accounts completes
signup. Distinct from `identify()`: `identify()` is the generic SDK-level "we
now know who this is" call (fires on login *or* signup, and drives the alias
mechanism); `account_created` is the specific *business* event marking the
signup moment, carrying properties `identify()`'s payload doesn't (signup
method, provider, etc.). The two will typically fire back-to-back — the
signup handler is exactly where a game calls `identify()` for the first time
on a device.

**Schema — decided:**

```
account_created
  signup_method (required, locked enum): email | social | platform | guest_upgrade | other
  provider (optional, string): which one, when signup_method is social/platform —
                                e.g. "google"/"apple"/"facebook" (social),
                                     "steam"/"psn"/"xbox"/"game_center"/"google_play_games" (platform)
```

- `signup_method` required, small locked enum — same pattern as `ad_type` on
  the ad events: universal, every signup flow falls into one of these five
  buckets. `guest_upgrade` is called out specifically (rather than folded into
  `other`) because guest-to-real-account conversion is common and analytically
  distinct from a cold signup — the player already has progress worth tying
  the pre-existing anonymous history to.
- `provider` optional free string, not a second locked enum — same pattern as
  `ad_completed`'s `provider` field: a required, small, locked "what kind of
  thing" field plus an optional free-text "which specific vendor" field.
  Reusing this exact shape (rather than inventing a new one) keeps schema
  style consistent across the whole locked catalog, and avoids having to
  pre-enumerate every possible identity provider up front.
- Nothing else. No `user_id` (already the envelope's `id`). No client-computed
  "time since `first_open`" — that's derivable downstream from two timestamps
  already in raw data (`first_open.created_at` vs. `account_created.created_at`),
  so computing it client-side would just add clock-skew risk for a mart-layer
  concern. Two properties total, well inside the "3-5 max" guidance already
  used everywhere else in these docs.

**Tiering — decided: P1, gated on the Accounts signal.** Can't be P0 —
unlike `session_start`/`first_open`, the SDK has no way to know "the player
just created an account" on its own; it's inherently game-logic-driven, which
rules out P0 by definition (P0 = auto-tracked, no instrumentation needed,
throughout every doc here). Between P1 and P2: P1, same weight as revenue —
it's the anchor point for the entire new-user funnel (`first_open` →
`account_created` → first purchase) that signup-conversion analysis depends
on, and it's the trigger moment that makes the alias mechanism (Change 1)
actually matter for that game. A game with accounts but no `account_created`
instrumentation can't measure signup conversion at all.

**`tutorial_start` / `tutorial_complete`** — locked, universal, P1. Marks the
FTUE (first-time-user-experience) funnel boundary that exists in some form
for every game, regardless of genre or how deep the actual tutorial goes.
Distinct from `first_open` (install) and `account_created` (signup): without
this, there's no way to tell "the game is bad" apart from "the FTUE itself is
broken" when explaining early churn — arguably the most common diagnosis
needed for day-1 retention problems. Matches Firebase/GA4's own recommended
`tutorial_begin`/`tutorial_complete` events for games, so there's real
industry precedent here, not just an inferred gap.

- `tutorial_complete` carries one optional property, `outcome`: `completed`
  \| `skipped` — covers the common "let the player skip" case without a third
  locked event name.
- **Per-step tutorial tracking stays game-specific, not locked.** A 12-step
  tutorial and a single "swipe to move" prompt need completely different step
  vocabularies — this can't be a universal schema, the same way
  `economy_transaction`'s `reason` can't force one string across every game's
  economy. This slots into the P3 "may vary by game" bucket the telemetry
  model already carves out (it already lists `tutorial_step_completed` as its
  own example). Recommend `step_number`/`step_name` as a *convention* in the
  implement recipe doc for games that want step-level funnel data — not
  enforced, same soft-convention treatment `reason` values already get.

**`app_update`** — locked, auto-tracked, P0. Fires once on a returning
device's `session_start` when the current `appVersion` differs from the last
one the SDK saw for that device (persisted the same way `distinct_id`/
`hasAliased` are). No stored value yet (genuine first-ever launch) → nothing
fires, that's `first_open`'s territory. Stored value matches → ordinary
session, nothing fires.

- Property: `previous_version` (required) only — the new version is already
  the event's own `appVersion` auto-field, so no duplication.
- Purely mechanical (compare stored vs. current), same auto-tracked pattern
  as `first_open`. Doesn't need `first_open`'s special buffer/alias
  treatment — by definition it only fires on a device that's already been
  through at least one prior session, so it doesn't carry the "long anonymous
  exploration before ever identifying" risk; it rides the existing ordinary
  pre-identify buffer like any other event.
- Answers questions like: did a specific build change retention/session
  length/crash rate/revenue; how long it takes players to actually update
  (relevant for balance/anti-cheat patches); whether a bug report predates a
  fix's release.

### Decisions needed before implementation

1. ~~**Naming: `download` vs. `first_open` vs. `app_installed`.**~~ **Decided:
   `first_open`.**
2. ~~**Trigger mechanism for `first_open`.**~~ **Decided:** tie it to
   `distinct_id` creation, not to `session_start` at all — auto-fires, zero
   instrumentation, same tier as `session_start`, and goes through the same
   pre-identify buffer + alias treatment (see above).
3. ~~**`account_created` schema.**~~ **Decided:** `signup_method` (required,
   locked enum: `email`\|`social`\|`platform`\|`guest_upgrade`\|`other`) +
   `provider` (optional string, which specific vendor when social/platform).
   See above.
4. ~~**`account_created` tiering.**~~ **Decided:** P1, gated on
   `moonforge-analyze`'s existing Accounts signal, same pattern as revenue
   being gated on Monetization.
5. ~~**Sequencing of the UTM/attribution rework.**~~ **Decided, and simpler
   than first scoped:** confirmed directly against the collector's own
   ingestion code (not inferred) that `utm_source`/`utm_medium`/`utm_campaign`/
   `utm_content`/`utm_term`/click IDs are parsed server-side straight out of
   the `url` field (`new URL(url, base)` → `.searchParams.get(...)`) for
   every `type: 'event'` payload — this is universal per-event logic, not
   scoped to any particular event name. So **no new client-side
   attribution/UTM module is needed at all** — the only fix is the one already
   identified: include `location.search` in `url` (`collectAutoFields()`),
   applied the same way for every event. There's no bespoke "attach to
   `first_open` specifically" mechanism to build — it falls out for free,
   since `first_open` fires first, before any client-side navigation could
   strip the query string, the same way a later `session_start` naturally
   won't carry it once the browser's moved on. No first-touch persistence, no
   localStorage, no `pr-10`-style attribution module ported. `country`/
   `region`/`city` needs no decision — confirmed unchanged, see above.
6. ~~**Should `identify()` / `account_created` be combined into one call?**~~
   **Decided: stay separate.** Two calls at the signup handler —
   `identify(userId, traits)` first, then `trackAccountCreated({ signup_method,
   provider })` — added as a plain named helper matching the existing
   `trackIapCompleted`/`trackEconomyTransaction`/`trackAdStarted` pattern, not
   a bespoke combinator. Two reasons: (1) auto-inferring "this is a signup"
   from inside `identify()` isn't safe — the alias mechanism's own trigger
   ("first-ever `identify()` on this device") also fires for a returning
   player logging into an *existing* account after a reinstall/storage clear,
   so only the game's own signup-vs-login code path actually knows which
   happened; a combined call wouldn't remove that requirement, just rename
   it. (2) keeps the SDK API surface uniform — every other locked event is
   its own plain helper independent of `identify()`. Call order (`identify()`
   before `trackAccountCreated()`) means the business event already carries
   the real id rather than depending on the pre-identify buffer to get
   attributed correctly.

---

## Change 3: Event Inventory Export — Done

### What shipped

- New shared reference doc,
  `moonforge-verify/references/event-inventory-export.md`: the
  `MOONFORGE_EVENTS.md` format (tier-grouped tables, P0 two-column/P1-P3
  three-column with `Trigger`), the "auto-generated — do not edit by hand"
  header, and the regeneration/scope rules (full overwrite, every event
  currently in the project).
- Wired into all three `moonforge-verify` platform references
  (`web.md`/`unity.md`/`generic.md`) as a step immediately after the existing
  chat-only "Present the event inventory" / "Present Results" step — same
  data, now also saved to a file.
- `moonforge-uninstall` deletes `MOONFORGE_EVENTS.md` alongside
  `.moonforge.json` — added to the inventory check, the deletion step, and
  the "expect ZERO MoonForge references" verification step, across its
  top-level `SKILL.md` and all three platform references.
- Top-level `moonforge/SKILL.md` updated: Step 7 now mentions the file gets
  written, and a new `## MOONFORGE_EVENTS.md` section points to the format doc.

### Requirement

Once the skill finishes instrumenting a game (end of the `/moonforge` flow —
after `moonforge-verify`), it should **write a document into the game's
project** listing every event actually implemented and its data fields — not
just present a table in chat, which disappears once the conversation ends.
`moonforge-verify` already builds this information for its own "event
inventory" report section (`references/*.md`'s "Present Results" /
"Present the event inventory" steps in each platform's verify reference) —
this formalizes that existing output into a saved artifact.

### Decisions — all made

1. ~~**File location.**~~ **Decided: root-level `MOONFORGE_EVENTS.md`.**
   `.moonforge.json` already establishes root as where MoonForge-owned
   project metadata lives — one consistent location regardless of platform
   (web/Unity/Unreal/generic), visible and git-trackable, not buried in
   per-engine SDK internals (`assets/moonforge-sdk/` on web, `Assets/MoonForge/`
   on Unity — which differ per platform anyway).
2. ~~**Format.**~~ **Decided: markdown only, not JSON.** The purpose is "for
   developers to read." No concrete consumer needs structured JSON today —
   the speculative future use (verify diffing against it) is better served by
   verify re-scanning the actual codebase directly, which it already does,
   than by trusting a possibly-stale exported file. Revisit only if a real
   consumer shows up.
3. ~~**Regeneration policy.**~~ **Decided: full overwrite on every
   `/moonforge:verify` run**, with an explicit "auto-generated by MoonForge —
   do not edit by hand" header in the file. Treated exactly like
   `.moonforge.json`: skill-owned, skill-regenerated, not a shared editing
   surface — avoids needing merge/diff logic to preserve manual edits.
4. ~~**Uninstall behavior.**~~ **Decided: `moonforge-uninstall` deletes it.**
   Same rule as `.moonforge.json` ("must be gone" per its existing
   verification step). A doc describing events that no longer exist is
   actively misleading, not just clutter — add `MOONFORGE_EVENTS.md` to
   uninstall's inventory/cleanup step and its "expect ZERO MoonForge
   references" check.
5. ~~**Scope on a partial/pre-existing instrumentation.**~~ **Decided:
   everything currently in the project, not just this run's changes.** The
   doc's whole point is being a persistent single source of truth, and most
   real integrations happen incrementally across multiple sessions — a
   partial doc undermines that. `moonforge-verify`/`moonforge-uninstall`
   already do full-project scans for their own reporting (not session-diffs),
   so this costs nothing extra to match.

---

## Open Questions Summary (all decisions, in one place)

- [x] `download` vs `first_open` vs `app_installed` naming → **`first_open`**
- [x] `first_open` fires on distinct-id creation, auto, P0, same buffer+alias treatment as `session_start`
- [x] Confirmed `first_open` belongs alongside `session_start`, not instead of it (installs vs. sessions are different counts)
- [x] `account_created` required/optional properties → `signup_method` (required, locked enum) + `provider` (optional string)
- [x] `account_created` tier → **P1**, gated on Accounts signal
- [x] Added `tutorial_start`/`tutorial_complete` (locked, P1) — universal FTUE-completion signal; per-step tracking stays game-specific/P3
- [x] Added `app_update` (locked, P0, auto) — `previous_version` property, fires on version change since last session
- [x] `identify()`/`account_created`: **stay separate** — `identify()` then `trackAccountCreated()`, plain helper, no new API surface
- [x] Sequencing: UTM/attribution rework **lands in Change 2**, and it's just the `url` query-string fix — confirmed against collector source that it parses UTM/click-IDs from `url` itself, universally per-event; no ported attribution module needed. `country`/`region`/`city` confirmed unchanged (never broken on this branch).
- [x] Event inventory doc: file location → root-level **`MOONFORGE_EVENTS.md`**
- [x] Event inventory doc: format → **markdown only**
- [x] Event inventory doc: regenerate policy → **full overwrite every `/moonforge:verify` run**, "do not edit by hand" header
- [x] Event inventory doc: uninstall behavior → **deleted**, same rule as `.moonforge.json`
- [x] Event inventory doc: scope → **everything currently in the project**, not just this run's changes
