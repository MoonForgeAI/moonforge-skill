# MoonForge Uninstall — Any Engine

Nothing was installed as a package here — the SDK was generated into the project.
What exists is that generated module plus the call sites that use it, so removal
is deleting both rather than uninstalling a dependency.

## 1. Inventory before removing anything

Present the full list to the user and get approval before the first deletion.

- **The generated SDK module** — grep for `collector.moonforge.co`. The file
  containing it is the SDK (`moonforge.gd`, `MoonForgeSDK.cpp/.h`,
  `moonforge.lua`, …). Include any tests generated alongside it.
- **Call sites** — grep for the client's function names (`track`,
  `track_event`, `MoonForge::Track`) and for `moonforge` case-insensitively.
- **Registration** — how the client is wired in: a Godot autoload in
  `project.godot`, a `require`/`import`, a global singleton set up at boot.
- **Config** — `.moonforge.json`, `MOONFORGE_EVENTS.md`, plus any `MOONFORGE_*`
  entries in `.env`, CI config, or build scripts.
- **Session hooks** — the quit handler the SDK registered for `session_end`, and
  any scene-change hook used for `screen_view`. If the handler existed before
  instrumentation, remove only the MoonForge line; if it was added solely for
  this, remove the handler.

## 2. Remove, with a diff per file

Order matters — call sites first, then registration, then the module. Removing
the module first leaves the project in a state that will not compile, which
makes a mid-way abort worse than not starting.

Watch for a call site that is the only statement inside an `if`, a lambda, or a
handler. Deleting the line leaves an empty block that will not compile in most
languages — remove the whole construct, or leave it doing what it did before
instrumentation.

## 3. Config

Delete `.moonforge.json` and `MOONFORGE_EVENTS.md` — the latter describes
events that no longer exist once removal is done, which is actively
misleading, not just clutter. Remove `MOONFORGE_*` from `.env`,
`.env.example`, CI config, and any deploy script. Leaving them behind is
harmless at runtime but strands dead config that the next reader has to
investigate.

## 4. Verify the game still builds

Run the project's own check (`godot --headless --check-only`, `cargo check`,
`dotnet build`, `cmake --build`). Then grep once more for `moonforge` and
`collector.moonforge.co` — both must return nothing outside documentation.

If the engine has no check command, say so. Do not claim a clean build that was
never run.

## 5. Optional: deregister server-side

Same as the other platforms, using the `gameId` captured before
`.moonforge.json` was deleted. This is destructive and separate — confirm
explicitly with the user, and never assume removing instrumentation implies
deleting collected data.
