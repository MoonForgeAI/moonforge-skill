# Changelog

All notable changes to the MoonForge skill package.

This project adheres to [Semantic Versioning](https://semver.org/). The
`version` in `package.json`, the `version:` in every `SKILL.md` frontmatter, and
the git tag are kept in lockstep.

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
