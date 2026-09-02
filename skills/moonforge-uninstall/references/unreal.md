# MoonForge Uninstall — Unreal

Same shape as any generated-SDK removal (`generic.md`) — delete the module
and its call sites, not a package. One thing is unique to this platform and
must be handled explicitly, not silently: **any Blueprint nodes the user
manually wired in cannot be removed by this skill**, for the same reason
they couldn't be added by it.

## 1. Inventory before removing anything

Present the full list to the user and get approval before the first deletion.

- **The generated SDK module** — grep for `collector.moonforge.co` under
  `Source/`. The file containing it is `MoonForgeSDK.h`/`.cpp` (or however it
  was named).
- **The Blueprint-callable wrapper** — `UMoonForgeBlueprintLibrary` (or
  equivalent), typically alongside the SDK module, including its `UENUM`
  declarations.
- **Call sites** — grep `Source/` for `TrackEvent`, `TrackScreenView`,
  `Identify`, `MoonForgeBlueprintLibrary::`, and `moonforge` case-insensitively.
- **Registration** — the `UGameInstanceSubsystem` registration and the
  `FCoreDelegates::OnPreExit` quit hook.
- **Config** — `.moonforge.json`, `MOONFORGE_EVENTS.md`.
- **Manual Blueprint wiring** — read `MOONFORGE_EVENTS.md`'s "Manual
  Blueprint Wiring Needed" section if present (or ask the user directly if
  the file is already gone or was never generated). **Every event listed
  there that the user confirms they wired is a Blueprint graph edit this
  skill cannot see or undo.** Present this as its own explicit item in the
  inventory, not folded into "call sites" — a developer approving "remove
  all MoonForge code" needs to know a Blueprint-editing step is still
  required from them afterward, separate from anything this skill does
  automatically.

## 2. Remove, with a diff per file

Order matters — call sites first, then registration, then the module and the
Blueprint-callable wrapper. Removing the module first leaves the project in
a state that will not compile, which makes a mid-way abort worse than not
starting.

Watch for a call site that is the only statement inside an `if`, a lambda,
or a handler — deleting the line leaves an empty block that will not
compile; remove the whole construct or leave it doing what it did before
instrumentation.

## 3. Config

Delete `.moonforge.json` and `MOONFORGE_EVENTS.md` — the latter describes
events (including any manual Blueprint wiring) that will no longer be true
once removal completes.

## 4. Manual Blueprint node removal (cannot be automated)

**Tell the user explicitly, as its own step, not a footnote:** any
`UMoonForgeBlueprintLibrary` nodes they added to their own Blueprint graphs
need to be removed by hand, in Unreal Editor. Reproduce the "Manual
Blueprint Wiring Needed" list read in §1 as the removal checklist — same
events, same Blueprint assets, now as "go delete this node" instead of "go
add this node." Do not report the uninstall as complete without this list
in front of the user, even though this skill cannot verify it happened.

## 5. Verify the game still builds

Ask the user to compile in their own Editor — this repo has no Unreal
toolchain to run one itself. Then grep once more for `moonforge` and
`collector.moonforge.co` under `Source/` — both must return nothing outside
documentation. Note plainly that this grep cannot see Blueprint graphs, so a
clean grep result does not by itself mean the Blueprint nodes from §4 are
gone — that's confirmed by the user, not by this check.

## 6. Optional: deregister server-side

Same as the other platforms, using the `gameId` captured before
`.moonforge.json` was deleted. This is destructive and separate — confirm
explicitly with the user, and never assume removing instrumentation implies
deleting collected data.
