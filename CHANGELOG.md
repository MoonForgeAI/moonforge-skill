# Changelog

All notable changes to the MoonForge skill package.

This project adheres to [Semantic Versioning](https://semver.org/). The
`version` in `package.json`, the `version:` in every `SKILL.md` frontmatter, and
the git tag are kept in lockstep.

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
