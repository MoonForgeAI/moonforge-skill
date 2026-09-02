# MoonForge Implement — Unreal

**Read `sdk-contract.md` first.** The generated SDK must implement the full
capability list — session lifecycle, `first_open`/`app_update`, pre-identify
buffering, alias-on-first-identify, persistent identity — not just
`TrackEvent`. Everything below is Unreal-specific detail on top of that
shared contract. For the locked revenue/economy/FTUE/account catalog
specifically, `telemetry-implement.md`'s "Order of work" and canonical
schemas (`moonforge-events/references/telemetry-model.md`) apply here
exactly as they do on Unity/generic — this file only adds what's
Unreal-specific on top: module structure, and the Blueprint-callable layer.

**Read the game profile's Blueprint Coverage field before writing anything.**
It came from `moonforge-analyze/references/unreal.md` and decides which
events below get a code diff and which get a manual wiring instruction
instead — see §3.

## 1. Generate the SDK module

A proper Unreal module under `Source/<ProjectName>/` (or its own plugin
module if the project already separates concerns that way):
`MoonForgeSDK.h`/`.cpp`, implementing every row of `sdk-contract.md`.

- **Register it** as a `UGameInstanceSubsystem` — initializes automatically
  with the game instance, one instance per game, exactly the idempotent
  `init` the contract requires.
- **Hook quit** via `FCoreDelegates::OnPreExit` for `session_end`. This is
  the single most-forgotten hook on every generic-path engine — Unreal is no
  exception.
- **`first_open`/`app_update`/`alias`** are automatic, same as every other
  platform — implement `IsFirstOpen()`/`CheckAppUpdate()` (persisted flags,
  same shape as `sdk-contract.md` describes) and fire them from the
  subsystem's `Initialize()`; fire `alias` from inside `Identify()`'s own
  implementation on the device's first-ever call. **None of these three need
  a Blueprint-callable entry point** — nothing in game code, Blueprint or
  C++, ever calls them directly.
- **Source `appVersion`** from Project Settings' version string, read fresh
  at send time — never hardcoded, never this skill's own version.
- **Source `screen`** via `UWidgetLayoutLibrary::GetViewportSize()`, format
  `"<width>x<height>"`.
- **Source `language`** via `FInternationalization::Get().GetCurrentLanguage()`.
- **`url`** — a scene/context marker (`level://LevelName`) unless the
  project's launch mechanism can carry a deep link with query parameters, in
  which case include that query string verbatim (see `sdk-contract.md`'s
  `url` row — the collector parses `utm_*`/click IDs from it server-side;
  there is nothing else to build for attribution).
- **Transport** — `FHttpModule`, off the game thread, `2-5s` timeout, every
  error swallowed. Unreal's default User-Agent contains `UnrealEngine/` and
  is already allowlisted by the collector's bot filter — leave it alone.

## 2. Always generate a Blueprint-callable wrapper

**Unconditional — generate this regardless of the profile's Blueprint
Coverage classification, including "C++-primary."** It's cheap (the same
underlying C++ calls, wrapped), and it's the only thing that makes any of
this reachable from a Blueprint graph at all, including for a project that
adds Blueprint logic later even if it's C++-heavy today.

Cover the full locked catalog with **dedicated, typed functions** — not a
single generic `TrackEvent(Name, Data)` passthrough for locked events.
Blueprint has no compiler to catch a fat-fingered event name or property key
in a string literal, which is exactly the failure "zero deviation" exists to
prevent — a dedicated function per locked event, with real parameters,
closes that gap the same way a typed C++ call would. Use `UENUM(BlueprintType)`
for every locked enum, so the locked values appear as a Blueprint dropdown
rather than a free-text pin — this is actually a *stronger* guarantee against
drift than the C++ path gets, since a Blueprint enum dropdown makes a typo
structurally impossible, not just discouraged:

```cpp
UENUM(BlueprintType)
enum class EMoonForgeAdType : uint8 { Rewarded, Interstitial, Banner, Other };

// Unspecified lets a Blueprint author omit an optional locked enum -
// the underlying implementation must skip the field entirely when this
// value is passed, not send the literal string "Unspecified".
UENUM(BlueprintType)
enum class EMoonForgeStore : uint8 { Unspecified, AppStore, GooglePlay, Steam, Web, Other };

UENUM(BlueprintType)
enum class EMoonForgeSignupMethod : uint8 { Email, Social, Platform, GuestUpgrade, Other };

UENUM(BlueprintType)
enum class EMoonForgeTutorialOutcome : uint8 { Completed, Skipped };

// C++ default arguments render as collapsed/optional pins in the Blueprint
// node - use them for every optional property below, rather than forcing a
// Blueprint author to wire a value the schema doesn't require. This is the
// idiomatic Unreal way to expose "optional" to Blueprint; there is no
// Blueprint-exposable equivalent of a nullable/TOptional parameter.
UCLASS()
class UMoonForgeBlueprintLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    // Base API
    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackEvent(const FString& Name, const TMap<FString, FString>& Data);

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackScreenView(const FString& ScreenName);

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void Identify(const FString& UserId, const TMap<FString, FString>& Traits);

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void SetUserProperty(const FString& Key, const FString& Value);

    // FTUE & accounts (P1) - see telemetry-model.md
    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackTutorialStart();

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackTutorialComplete(EMoonForgeTutorialOutcome Outcome);

    // Call Identify() first, always - never combined, never inferred from Identify alone.
    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackAccountCreated(EMoonForgeSignupMethod SignupMethod, const FString& Provider = TEXT(""));

    // Economy (P1) - always economy_transaction. Omit a slot by leaving its
    // *Type field empty - the underlying TrackEvent call must still omit
    // that slot's keys entirely rather than sending them empty, same rule
    // as every other platform.
    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackEconomyTransaction(const FString& Reason,
        const FString& Input1Type = TEXT(""), float Input1Before = 0.f, float Input1After = 0.f,
        const FString& Input2Type = TEXT(""), float Input2Before = 0.f, float Input2After = 0.f,
        const FString& Input3Type = TEXT(""), float Input3Before = 0.f, float Input3After = 0.f,
        const FString& Output1Type = TEXT(""), float Output1Before = 0.f, float Output1After = 0.f,
        const FString& Output2Type = TEXT(""), float Output2Before = 0.f, float Output2After = 0.f,
        const FString& Output3Type = TEXT(""), float Output3Before = 0.f, float Output3After = 0.f);

    // Revenue (P1) - locked names only.
    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackIapInitiated(const FString& ProductId, float Price, const FString& Currency,
        const FString& ProductName = TEXT(""), EMoonForgeStore Store = EMoonForgeStore::Unspecified);

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackIapCompleted(const FString& ProductId, float Price, const FString& Currency,
        const FString& TransactionId, const FString& ProductName = TEXT(""), EMoonForgeStore Store = EMoonForgeStore::Unspecified);

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackAdStarted(EMoonForgeAdType AdType, const FString& Placement, const FString& Provider = TEXT(""));

    // Rewarded has no natural "unset" bool value once exposed to Blueprint,
    // so it defaults to false rather than distinguishing "false" from "not
    // passed" - a corner case not worth the extra parameter it would take to
    // solve. DurationSeconds < 0 means omit (a real duration is never negative).
    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackAdCompleted(EMoonForgeAdType AdType, const FString& Placement, float WatchedFraction,
        const FString& Provider = TEXT(""), bool bRewarded = false, float DurationSeconds = -1.f);

    UFUNCTION(BlueprintCallable, Category = "MoonForge")
    static void TrackAdImpression(EMoonForgeAdType AdType, const FString& Placement, const FString& Provider = TEXT(""));
};
```

Match this to whatever *additional* custom/game-action events the profile
calls for too — every `TrackEvent`-shaped call the game needs should have a
`BlueprintCallable` path, not just the locked catalog above. This is what
turns "impossible to instrument" into "possible for a human" for anything in
§3's manual list.

## 3. Instrument events — split by Blueprint Coverage

For **C++-primary** projects: proceed exactly like any other `generic`-path
engine — find the file and method, write the call, show a diff, get
approval. Use the dedicated `UMoonForgeBlueprintLibrary` functions from §2
even from C++ call sites (they're just static functions), so there is only
one code path to keep correct, not two.

For **Blueprint-only** or **likely Blueprint-heavy** projects: for each
event whose real trigger point is a Blueprint graph with no backing C++
function, **do not attempt a code diff** — there is nothing to diff. Skip it
per the code path and instead add it to a **manual wiring list**: event
name, the specific `UMoonForgeBlueprintLibrary` node to add, its parameters
(including which `UENUM` dropdown value to select), and the Blueprint asset
+ rough graph location if discoverable from asset naming (e.g. "`BP_GameMode`'s
EventGraph, after the level-complete custom event"). Events that *do* have a
backing C++ function (even in an otherwise Blueprint-heavy project) still
get instrumented normally — judge this per-event, not per-project.

Keep this list — `moonforge-verify` presents it as its own "Manual Blueprint
Wiring Needed" section alongside the normal event inventory, and it becomes
part of `MOONFORGE_EVENTS.md` (see
`moonforge-verify/references/event-inventory-export.md`). Tell the user
plainly, before finishing this step, which events they'll need to wire
themselves and why, rather than letting it surface as a surprise later.

## 4. Test what you generated

Per `sdk-contract.md` — envelope shape, pre-identify buffering, alias fires
once and doesn't repeat, `first_open`/`app_update` fire correctly, a
transport failure that can't reach game code. **This repo has no Unreal
Editor or C++ toolchain** — nothing generated here gets compiled or
runtime-verified the way a Unity/web change would be. Say so plainly rather
than implying the generated module was proven to compile; the user confirms
that in their own Editor (see `moonforge-verify/references/unreal.md`).

## 5. Write `.moonforge.json`

```json
{ "gameId": "<GAME_UUID>", "gameName": "<name>", "platform": "unreal", "sdkConfigured": true }
```
