# Changelog

All notable changes to the MoonForge skill package.

This project adheres to [Semantic Versioning](https://semver.org/). The
`version` in `package.json`, the `version:` in every `SKILL.md` frontmatter, and
the git tag are kept in lockstep.

## [1.6.0] — 2026-09-04

### Added

- **Identity reconciliation via `alias`.** A player's pre-signup anonymous
  activity was permanently orphaned from their real account once they signed
  up — the pre-identify buffer only covers a ~10s/50-event window, which
  doesn't help a genuinely new player who plays anonymously for any real
  length of time before ever creating an account. The web SDK now sends a
  new `alias` event (`{ id, previous_id }`) on a device's first-ever
  `identify()` call, gated by a persistent flag distinct from the in-memory
  buffering flag, so the collector can reconcile the two ids into one player.
  Unity/generic SDKs are now held to this too (`sdk-contract.md`).
- **`first_open`.** Fires once per device, the moment its distinct id is
  first created — the install signal (matches Firebase's `first_open`/GA4's
  `first_visit`), distinct from "the first `session_start`," which also
  fires after a storage clear or device switch and can't tell those apart
  from a genuine install.
- **`app_update`.** Fires once, on a returning device's `session_start`,
  when `appVersion` differs from the last one seen for that device —
  `{ previous_version }`.
- **`tutorial_start` / `tutorial_complete`.** Locked FTUE events, universal
  across every game regardless of genre or how deep the tutorial goes.
  `tutorial_complete` carries an optional `outcome` (`completed` \| `skipped`).
- **`account_created`.** Locked signup event (`signup_method`, optional
  `provider`) for games with real accounts. Always called after `identify()`,
  never combined or inferred from it — a returning player's first `identify()`
  on a new device is a login, not a signup.
- **Locked revenue/economy catalog.** `iap_initiated`, `iap_completed`,
  `ad_started`, `ad_completed`, `ad_impression` (locked names, required/optional
  props, locked `ad_type`/`store` enums), and `economy_transaction` (one name
  for every economic state change, flat `input_N`/`output_N` schema) — the
  same names and required keys on every game, every engine.
- All locked helpers (`iap_*`, `ad_*`, `tutorial_*`, `account_created`)
  forward any extra properties you pass through to the event's `data` — the
  locked keys just can't be renamed or omitted. `trackEconomyTransaction`
  fills only 3 input and 3 output slots; passing more logs a `console.warn`
  and keeps the first 3 — split into multiple transactions instead.
- **Session chaining.** Re-engagement `session_start` (after the inactivity
  timeout) now carries `previous_session_id`, linking consecutive sessions
  from the same device.
- **`MOONFORGE_EVENTS.md`.** `moonforge-verify` now writes the event
  inventory to the project root as a file, grouped by tier, regenerated (full
  overwrite) on every run — not just presented once in chat. `moonforge-uninstall`
  deletes it alongside `.moonforge.json`.
- Tier remap in `moonforge-events`: P0 = core/auto (session, install, update),
  P1 = revenue + economy + FTUE/accounts + atomic game actions, P2 = UI gaps,
  P3 = optional engagement — replacing the old genre-recipe-first P1. Economy
  sits in P1 (not P2) deliberately: a broken or un-instrumented economy is as
  much a game-health blind spot as missing revenue data for any game whose
  core loop involves currencies/items. New `moonforge-analyze` profile
  signals feed this: Monetization, Economy Resources, Accounts, UI Surfaces —
  including `box`/`gacha`/`pack`/`unbox`/`loot` in the economy-detection
  keyword list, alongside the existing `coin`/`gold`/`gem`/`currency`/`inventory`.

### Fixed

- **The `url` field silently dropped the query string** (`pathname + hash`
  only), which meant `utm_source`/`utm_medium`/`utm_campaign`/click IDs had
  been empty in the collector's data for every game, always — confirmed
  directly against production data and against the collector's own ingestion
  code, which parses these straight out of `url`'s query string for every
  event. No other attribution capture is needed; this one field was the
  entire blocker.
- **`alias` was missing from every P0 summary except `sdk-contract.md`.**
  Reported after another agent using the skill followed
  `moonforge-events/SKILL.md`'s P0 template, dropped `alias` from a generated
  SDK as a result, and had to revert the affected edits once the gap
  surfaced. Root cause: `alias` has no game-code call site to grep for (it
  fires inside `identify()`'s own implementation, never as its own tracking
  call), so any P0 list assembled from what's visible in code — rather than
  copied from `telemetry-model.md` — silently drops it. Fixed in
  `telemetry-model.md` first (now explicitly the copy-from source, with a
  note not to reconstruct the list from memory), then in every place that
  had gone stale: the top-level `moonforge/SKILL.md` (which was also missing
  `first_open`/`app_update` entirely), `moonforge-events/SKILL.md` (both its
  main P0 section and its presentation template), both `*-auto-tracked.md`
  files, `event-inventory-export.md`'s example, and
  `moonforge-verify/references/web.md` (which had no alias check at all —
  Change 1 only added it to `unity.md`/`generic.md`).

### Notes

- Geolocation (`country`/`region`/`city`) remains entirely server-side,
  derived from the request IP — this was already correct and is unchanged.
  No client-side geo or timezone capture was added anywhere in this release.

## [1.5.2] — 2026-08-28

### Changed

- **Package renamed `@moonforge/skill` → `@moonforge/moonforge-skill`.** With
  1.5.1's `bin` entry actually working, an apparent `npx @moonforge/skill
  <agent>` failure on Windows was initially suspected to be a resolution
  problem caused by the bin command (`moonforge-skill`) not matching the
  package's own unscoped name (`skill`). That turned out not to be the real
  cause — the actual failure was an artifact of running `npx` from inside a
  local clone of this repo, where npx resolves against the checkout's own
  `package.json`/`node_modules/.bin` instead of installing fresh from the
  registry; it works correctly from any other directory, and always did.
  Renaming to make the unscoped package name equal the bin name is kept
  anyway, on its own merits: it puts installation on the same well-trodden
  npx path as `npx cowsay` or `npx @11ty/eleventy`, with no dependence on
  npx's single-bin-fallback resolution behavior. `@moonforge/skill` (1.5.0,
  1.5.1) has been unpublished entirely rather than deprecated — both
  versions existed for under 72 hours with no real-world adoption, and the
  name is not intended to be reused. All install instructions now use
  `@moonforge/moonforge-skill`.

## [1.5.1] — 2026-08-28

### Fixed

- **`npx @moonforge/skill` had no `bin` entry.** `package.json` declared
  `"moonforge-skill": "./bin/install.js"` — the leading `./` is invalid in
  npm's `bin` field and npm's publish-time validation silently strips the
  whole entry rather than failing the publish (`npm warn publish
  "bin[moonforge-skill]" script name bin/install.js was invalid and
  removed`). `1.5.0` published with no working CLI as a result. Fixed to
  `"bin/install.js"` (no `./`). `1.5.0` itself can't be republished (npm
  never allows reusing a version number), so this fix ships as 1.5.1.

## [1.5.0] — 2026-08-28

### Added

- **`npx @moonforge/skill <agent>` install.** The package is now publishable
  (`private` removed, `name` changed to the scoped `@moonforge/skill`) with a
  `bin/install.js` entry point. One command works identically on macOS,
  Linux, and Windows — no more OS-specific shell/PowerShell scripts — and
  installs into the right global skills directory for whichever agent you
  pass: `claude`, `codex`, `cursor`, `copilot`, or `windsurf`
  (`~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`,
  `~/.copilot/skills`, `~/.codeium/windsurf/skills` respectively — Windsurf's
  own directory lives under `.codeium`, not `.windsurf`).
- `package.json` gained a `files` allowlist (`bin`, `skills`) so the
  published tarball only ships what the installer needs, not `tests/`,
  `scripts/build-sdk.mjs`, or `docs/`.
- **Download-only fallback.** `npx @moonforge/skill` with no argument, or
  with an agent that isn't one of the five above, downloads the skill files
  into `./moonforge-skill/skills/` instead of erroring or guessing — there's
  no directory convention to write into on the user's behalf for a tool we
  don't recognize, so this hands them the files to place themselves (see
  the README's "Other AI Tools" section).

### Changed

- README's Installation section now leads with the npx command; the
  original `git clone` one-liner is kept as an explicit Claude-Code
  alternative underneath it, not removed.
- `moonforge/SKILL.md`'s update-check step now points at the npx command as
  the recommended update path instead of assuming `git clone`.

## [1.4.0] — 2026-08-21

### Changed

- **Docs are no longer Claude-Code-exclusive.** The skill package itself was
  already tool-agnostic (nothing in `skills/*/SKILL.md` besides the
  orchestrator's version-check step named a specific tool), but the README
  and version-check instructions assumed Claude Code throughout. Installation
  now has a `### Claude Code` subsection (exact, unchanged commands) and an
  `### Other AI Tools` subsection (clone + copy into your tool's
  skills/commands folder, with a note that tools supporting only flat
  single-file commands won't preserve the `references/`/`assets/` subfolder
  structure). The title and intro no longer claim Claude Code exclusivity.
- The version-check step in `moonforge/SKILL.md` and the README's Versioning
  section both hardcoded `~/.claude/skills/` as the install/check path; both
  now point at "whichever tool you're running as" with Claude Code kept as
  the one exact example.

## [1.3.0] — 2026-08-21

### Added

- **`appVersion` on every event and identify payload** — the game/app's own
  version at send time (Unity: `Application.version`; web: `package.json`
  `"version"` passed through `init`; other engines: whatever version metadata
  the project defines), never this skill's own version. No fabricated default
  is sent when it's missing — the field is simply omitted, with a console
  warning on init, rather than lying with a placeholder like `"1.0.0"`.
- **`screen`/`language` promoted from "optional, safe to omit" to "source
  them for real"** in the SDK contract, with per-engine guidance for the
  generic path (Godot, Unreal, LÖVE, Bevy, MonoGame, custom engines) and an
  analyze-step check for whether an engine even exposes display/locale APIs.
  Omitted only when the platform genuinely has no such concept (e.g. `screen`
  on a headless game server), never when it was simply not looked up.
- `/moonforge` now checks for a newer skill version at the start of every run
  (Step 1 of its process flow): it fetches the `version:` frontmatter from
  this repo's `main` branch and compares it to the installed version. If
  newer, it notifies the user once and asks whether to update. The check is
  best-effort — a failed or slow fetch (offline, GitHub unreachable) is
  skipped silently rather than blocking instrumentation — and it never
  installs anything without explicit confirmation, since updating touches
  files under `~/.claude/skills/`, outside the current project directory.

## [1.2.0] — 2026-08-18

### Fixed

- **Unity no longer instruments against an SDK that is not there.** The Unity
  reference had no install step at all — it wrote `MoonForgeAnalytics.TrackEvent()`
  calls against a namespace nothing ever put in the project. A real run ended
  with a project that would not compile and the user asked to go install a
  package, having been offered "code-only instrumentation" as though that were
  a mode anyone wants. It silently depended on `moon analytics init` having been
  run first, or on a UPM package the user could reach — neither true for someone
  who just installs the skill and runs `/moonforge`.

  Unity now generates a C# SDK into `Assets/MoonForge/` before writing a single
  call, with the Unity specifics spelled out: assembly definition, a
  `RuntimeInitializeOnLoadMethod` runner under `DontDestroyOnLoad`,
  `UnityWebRequest` transport with a timeout, `PlayerPrefs` for the distinct id,
  `Application.quitting` **plus** `OnApplicationPause` for `session_end` on
  mobile, and a `MoonForgeSettings` asset created with the game id written in.

### Added

- `moonforge-implement/references/sdk-contract.md` — one shared contract all
  three platforms meet, holding the required capabilities, the wire protocol and
  the User-Agent trap. Unity, web and generic now defer to it instead of
  restating it three times and drifting.
- The rule is stated where it will be read, in the implement skill itself:
  **never write a tracking call against an SDK that is not in the project.**

### Changed

- `moonforge-verify` checks the SDK is present before anything else, and reports
  its absence as the finding rather than as an unrelated compile failure. It
  also checks `MoonForgeSettings` carries the game id — an SDK without one is
  inert.
- `moonforge-uninstall` inventories a generated `Assets/MoonForge/` as well as a
  `com.moonforge.*` package entry.
- Documentation no longer describes Unity as shipping a prebuilt SDK.

## [1.1.0] — 2026-08-17

### Changed

- **The generic path now generates a real SDK, not a snippet.** 1.0.0 gave the
  user the wire protocol, one example, and a list of things to remember —
  sessions, identity and buffering were left as manual work. That was the wrong
  shape: the web path already generates a local SDK into the project, and the
  coding agent can do exactly the same in any language.

  `moonforge-implement` now generates a full SDK module for the target engine,
  held to an explicit parity contract with the prebuilt Unity and web SDKs:
  idempotent `init`, session lifecycle (start, end on the engine's quit hook,
  re-engagement after inactivity), persistent distinct id, `identify` with
  pre-identify event buffering, user properties, screen views, fire-and-forget
  transport, and `flush`. It is also asked to generate tests for what it wrote.

- **P0 is auto-tracked on every platform.** 1.0.0 told users that session events
  were manual on the generic path and had to be instrumented by hand. With a
  generated SDK they are not — P0 comes with the SDK everywhere, and
  recommendations start at P1. Corrected in the events reference, the
  orchestrator, and the README.

- `moonforge-verify` checks the generated SDK against the parity contract rather
  than just inspecting call sites, since an SDK that only implements
  `track_event` looks finished while silently losing sessions and identity.

- `moonforge-analyze` now records the language's test framework and the engine's
  quit hook, both of which the generation step needs.

## [1.0.0] — 2026-08-17

First versioned release. Earlier copies carry no version at all; if
`grep "^version:" ~/.claude/skills/moonforge/SKILL.md` prints nothing, reinstall.

### Added

- **Any engine is now supported.** A `generic` platform joins `unity` and `web`.
  Godot, Unreal, LÖVE, Bevy, MonoGame, custom C++ engines, and game servers are
  instrumented with a small hand-written HTTP client instead of an SDK — the
  same wire format and the same data. New references for analyze, implement,
  verify, and uninstall.
- `moonforge-implement/references/generic.md` documents the collector's wire
  protocol in full, so it can be reimplemented in any language.
- `moonforge-events/references/generic-auto-tracked.md` states plainly that P0
  session events are **not** automatic without an SDK. Presenting them as
  handled would have left generic-path games with no session data at all.
- Versioning: `version:` in all six skills, `version` in `package.json`, and
  this changelog.
- Self-serve onboarding: the orchestrator now tells a user without a game ID
  where to get one, validates that it is a UUID, and offers to run analyze and
  events — which need no game ID — first.

### Fixed

- **The live collector check was verifying nothing.** The `curl` probe in the
  Unity and web verify references used curl's default User-Agent, which the
  collector's bot filter flags — and flagged traffic is discarded while still
  returning HTTP 200. The check reported success on an event that was thrown
  away. Both probes now send a browser User-Agent, and the failure mode is
  documented where it will be read.
- The web verify probe sent `"timestamp": 0`, placing test events in 1970 where
  no dashboard query would return them. It now sends unix seconds.
- Unreal is no longer refused. It was declined outright in the orchestrator and
  in uninstall; both now route it through the generic path.

### Changed

- Every skill description dropped its Unity-only framing.
- The Unity C# API reference in the orchestrator and README is labelled as
  Unity-specific rather than presented as the SDK surface.
- The uninstall command in the README now removes `moonforge-uninstall` too,
  which it previously left behind.
