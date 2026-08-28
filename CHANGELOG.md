# Changelog

All notable changes to the MoonForge skill package.

This project adheres to [Semantic Versioning](https://semver.org/). The
`version` in `package.json`, the `version:` in every `SKILL.md` frontmatter, and
the git tag are kept in lockstep.

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
