# MoonForge Verify — Unreal

Same underlying contract as any generated SDK (`generic.md`'s §1 parity
checks all apply verbatim). Two things are specific to this platform: the
Blueprint-callable wrapper, and the manual wiring list for anything
Blueprint couldn't reach.

## 1. Verify the generated SDK against the parity contract

Check every row in `moonforge-implement/references/sdk-contract.md`, same as
`generic.md` §1 — `init` idempotency, session lifecycle, pre-identify
buffering, alias-on-first-identify, `first_open`/`app_update`, persistent
distinct id, no client-side geo/UTM capture, `appVersion`/`screen`/`language`
sourced for real, `game` a valid UUID, unix-second timestamps, transport
errors swallowed. Unreal specifics:

- `session_end` hooked via `FCoreDelegates::OnPreExit` — grep for it; its
  absence means every session is open-ended.
- `appVersion` sourced from Project Settings' version string, read fresh at
  send time — a literal string constant is a finding.
- `screen`/`language` sourced via real APIs
  (`UWidgetLayoutLibrary::GetViewportSize()`,
  `FInternationalization::Get().GetCurrentLanguage()`), not hardcoded.
- User-Agent: Unreal's default (`UnrealEngine/...`) is already allowlisted —
  confirm it wasn't overridden to something that isn't.

## 2. Blueprint-callable wrapper present and well-formed

**This is the check unique to this platform.** Confirm
`UMoonForgeBlueprintLibrary` (or equivalently named) exists, derives from
`UBlueprintFunctionLibrary`, and exposes `UFUNCTION(BlueprintCallable)`
wrappers for the base API (`TrackEvent`, `TrackScreenView`, `Identify`,
`SetUserProperty`) **and** the full locked catalog instrumented for this
game (`TrackTutorialStart`/`TrackTutorialComplete`, `TrackAccountCreated`,
`TrackEconomyTransaction`, `TrackIapInitiated`/`TrackIapCompleted`,
`TrackAdStarted`/`TrackAdCompleted`/`TrackAdImpression`) — this must exist
**regardless of the project's Blueprint Coverage classification**, its
absence is a defect on every Unreal project, not just Blueprint-heavy ones.
Confirm the locked enums (`ad_type`, `store`, `signup_method`, `outcome`)
are exposed as `UENUM(BlueprintType)` values, not free-text `FString`
parameters — a string parameter reopens exactly the typo risk the locked
schema exists to prevent, on the one platform where a dropdown enum could
have closed it completely.

Read the generated code for syntactic correctness (balanced braces, a
plausible `UFUNCTION`/`UCLASS`/`GENERATED_BODY()` shape) — this repo has no
Unreal Editor or Unreal Build Tool, so this is a text-level check, not a
compile. **Say so plainly**: ask the user to open the project in their own
Editor and confirm it compiles (Unreal's own error list, or
`UnrealBuildTool` output), and report their answer rather than implying this
was verified here.

## 2a. Locked event taxonomy

Same as `generic.md` §1a — if any revenue/economy/FTUE/account event was
instrumented, run `moonforge-verify/references/telemetry-checks.md`,
including confirming `TrackAccountCreated` is never called without a
preceding `Identify` call in the same handler (whether that call site is
C++ or a Blueprint graph — ask the user to confirm the Blueprint node order
if it's the latter, since this skill can't read the graph itself).

## 3. Manual Blueprint wiring list is accurate

If the game profile's Blueprint Coverage was **Blueprint-only** or **likely
Blueprint-heavy**, `moonforge-implement` should have produced a "Manual
Blueprint Wiring Needed" list rather than silently skipping those events.
Confirm:

- Every event flagged as needing manual wiring genuinely has no backing C++
  function to hook (re-check — don't just trust the earlier classification
  blindly, since a specific event's trigger might turn out to have a C++
  hook even in an otherwise Blueprint-heavy project).
- Each listed event names the exact `UMoonForgeBlueprintLibrary` node to
  add, its parameters (including which `UENUM` dropdown value), and the
  Blueprint asset/rough graph location where discoverable.
- Ask the user directly whether they've actually added the nodes yet — this
  skill has no way to confirm a Blueprint graph edit happened, unlike a C++
  diff it wrote itself.

If the profile was **C++-primary**, this section should be empty or absent —
confirm nothing was incorrectly deferred to a manual list when a real C++
hook existed.

## 4. Confirm the User-Agent will not be filtered

Same as `generic.md` §3 — Unreal's own UA is allowlisted; only relevant if
it was overridden.

## 5. Live collector check

Same `curl` probe as every other platform (`generic.md` §4) — proves the
endpoint and game id, not that the game's own client works.

## 6. Run the SDK's own tests

If `/moonforge:implement` generated tests and the project has a test
framework, run them. This repo cannot run Unreal's own test tooling, so if
none exist, say the SDK is untested rather than implying otherwise.

## 7. Prove the real client sends

The only check that counts, same as `generic.md` §6 — run the game in the
Editor or a packaged build and watch its network traffic (Unreal's own
Network Profiler, or an external proxy), or a temporary local listener.
State plainly which was done.

## 8. Present the event inventory and write `MOONFORGE_EVENTS.md`

List each auto-instrumented event with its trigger site and properties, same
as `generic.md` §7-8 — per `moonforge-verify/references/event-inventory-export.md`.
**Plus** a separate "Manual Blueprint Wiring Needed" section from §3, if
non-empty, appended after the normal tiered tables so the two are never
conflated: one is done, the other is a checklist for the user. Cover every
event currently in the project, not just what this run touched; overwrite
the file completely each time.
