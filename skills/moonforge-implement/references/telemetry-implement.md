# Implementing Locked Telemetry (session / FTUE-accounts / economy / revenue)

Canonical names and property keys: `moonforge-events/references/telemetry-model.md`.
**Copy verbatim.** Use helpers when available so schemas stay correct.

## Order of work

1. **SDK in project.** Web bundled SDK already fires `session_start`,
   `first_open`, and `app_update` automatically from `init()` — no extra
   wiring. Unity/generic generated SDK must implement the equivalent
   (`prepareSessionStart()`/`isFirstOpen()`/`checkAppUpdate()` per
   `sdk-contract.md`) rather than only `session_start`. Same for `alias`: it
   has no hook recipe of its own (it fires automatically inside
   `identify()`'s implementation, not as a separate call) — it's part of
   `identify()` being implemented correctly, not an item on this list to
   instrument separately. Confirm it's present via `sdk-contract.md`'s "Alias
   on first identify" capability, not by looking for a call site.
2. **Revenue hooks** when profile Monetization is IAP / ads / both.
3. **FTUE/account hooks** — `tutorial_start`/`tutorial_complete` always when
   the game has any onboarding; `account_created` when profile shows Accounts.
4. **Economy hooks** at every currency/item mutation when profile has Economy Resources.
5. **Game action hooks** from the instrumentation manifest (analyze output).

**Do not build client-side geo or attribution capture.** The collector
derives `country`/`region`/`city` from the request IP and parses
`utm_*`/click IDs from the `url` field's query string itself, for every
event. The only requirement is that `url` includes the query string
(`pathname + search + hash`) — nothing else to wire.

---

## Web SDK helpers

```javascript
// Session, first_open, app_update — all automatic from init(), no calls needed.

// FTUE
MoonForgeAnalytics.trackTutorialStart();
MoonForgeAnalytics.trackTutorialComplete({ outcome: 'completed' }); // or 'skipped'

// Accounts — Identify first, then account_created, in that order
MoonForgeAnalytics.identify(userId, { plan: 'free' });
MoonForgeAnalytics.trackAccountCreated({ signup_method: 'social', provider: 'google' });

// Economy — always economy_transaction
MoonForgeAnalytics.trackEconomyTransaction({
  reason: 'upgrade_weapon',
  inputs: [{ type: 'gold', before: 500, after: 200 }],
  outputs: [{ type: 'weapon_t7', before: 0, after: 1 }],
});

// Revenue — locked names only
MoonForgeAnalytics.trackIapInitiated({ product_id, price, currency, store: 'web' });
MoonForgeAnalytics.trackIapCompleted({ product_id, price, currency, transaction_id, store: 'web' });
MoonForgeAnalytics.trackAdStarted({ ad_type: 'rewarded', placement: 'extra_life' });
MoonForgeAnalytics.trackAdCompleted({ ad_type: 'rewarded', placement: 'extra_life', watched_fraction: 1 });
MoonForgeAnalytics.trackAdImpression({ ad_type: 'interstitial', placement: 'level_end' });
```

---

## Unity / generic — FTUE & accounts (P1)

```csharp
void OnTutorialStart() => MoonForgeAnalytics.TrackEvent("tutorial_start");

void OnTutorialEnd(bool skipped) =>
    MoonForgeAnalytics.TrackEvent("tutorial_complete", new Dictionary<string, object>
    {
        { "outcome", skipped ? "skipped" : "completed" }
    });

// Signup handler: Identify first, then account_created - never inferred from
// Identify alone (a returning player's first Identify on a new device is a
// login, not a signup).
void OnSignupComplete(string userId, string method, string provider)
{
    MoonForgeAnalytics.Identify(userId, new Dictionary<string, object>());
    var data = new Dictionary<string, object> { { "signup_method", method } };
    if (!string.IsNullOrEmpty(provider)) data["provider"] = provider;
    MoonForgeAnalytics.TrackEvent("account_created", data);
}
```

`signup_method` must be one of: `email`, `social`, `platform`, `guest_upgrade`, `other`.

---

## Unity — economy (P1)

Hook at the **authoritative** wallet/inventory method, not the UI button:

```csharp
void ApplyUpgrade(Weapon from, Weapon to, int goldCost)
{
    int goldBefore = wallet.Gold;
    wallet.Spend(goldCost);
    inventory.Remove(from);
    inventory.Add(to);

    MoonForgeAnalytics.TrackEvent("economy_transaction", new Dictionary<string, object>
    {
        { "reason", "upgrade_weapon" },
        { "input_1_type", "gold" }, { "input_1_before", goldBefore }, { "input_1_after", wallet.Gold },
        { "input_2_type", from.Id }, { "input_2_before", 1 }, { "input_2_after", 0 },
        { "output_1_type", to.Id }, { "output_1_before", 0 }, { "output_1_after", 1 },
    });
}
```

Never `TrackEvent("upgrade_weapon", ...)`.

---

## Unity — IAP (P1)

```csharp
// Purchase flow start
MoonForgeAnalytics.TrackEvent("iap_initiated", new Dictionary<string, object>
{
    { "product_id", product.definition.id },
    { "price", product.metadata.localizedPrice },
    { "currency", product.metadata.isoCurrencyCode },
    { "store", "google_play" } // or app_store, steam, web, other
});

// ProcessPurchase / OnPurchaseComplete
MoonForgeAnalytics.TrackEvent("iap_completed", new Dictionary<string, object>
{
    { "product_id", product.definition.id },
    { "price", product.metadata.localizedPrice },
    { "currency", product.metadata.isoCurrencyCode },
    { "transaction_id", transactionId },
    { "store", "google_play" }
});
```

---

## Unity — ads (P1)

```csharp
void OnAdStarted(string placement, string adType) =>
    MoonForgeAnalytics.TrackEvent("ad_started", new Dictionary<string, object>
    {
        { "ad_type", adType }, { "placement", placement }
    });

void OnAdRewarded(string placement, float watchedFraction) =>
    MoonForgeAnalytics.TrackEvent("ad_completed", new Dictionary<string, object>
    {
        { "ad_type", "rewarded" }, { "placement", placement },
        { "watched_fraction", watchedFraction }, { "rewarded", true }
    });
```

`ad_type` must be one of: `rewarded`, `interstitial`, `banner`, `other`.

---

## Generic engines

Mirror the web helpers in the project's language. Generated SDK must expose:
- `init()` firing `session_start`, `first_open` (once per device), and
  `app_update` (once per version change) automatically
- `track_tutorial_start()` / `track_tutorial_complete(outcome)`
- `identify(user_id, traits)` and `track_account_created(signup_method, provider)`
- `track_economy_transaction(reason, inputs, outputs)`
- `track_iap_*` / `track_ad_*` with locked names

Instrument at the same hook categories as Unity: wallet mutations, store
callbacks, ad SDK listeners, signup handlers.

---

## Unreal

Full generation guidance, the Blueprint-callable wrapper, and the
Blueprint-only manual-wiring fallback: `moonforge-implement/references/unreal.md`.
From a C++ call site (a real hook exists), use the same
`UMoonForgeBlueprintLibrary` static functions a Blueprint graph would call —
one code path for both, not two to keep in sync:

```cpp
void AMyGameMode::ApplyUpgrade(FWeapon From, FWeapon To, float GoldCost)
{
    float GoldBefore = Wallet->Gold;
    Wallet->Spend(GoldCost);
    Inventory->Remove(From);
    Inventory->Add(To);

    UMoonForgeBlueprintLibrary::TrackEconomyTransaction(TEXT("upgrade_weapon"),
        TEXT("gold"), GoldBefore, Wallet->Gold,          // input 1: gold spent
        From.Id, 1.f, 0.f,                               // input 2: old weapon consumed
        TEXT(""), 0.f, 0.f,                              // input 3: unused, left at defaults
        To.Id, 0.f, 1.f);                                // output 1: new weapon granted
    // Output slots 2-3 left at their defaults - omitted, not sent empty.
}

void AMyGameMode::OnSignupComplete(const FString& UserId, EMoonForgeSignupMethod Method)
{
    UMoonForgeBlueprintLibrary::Identify(UserId, {});
    UMoonForgeBlueprintLibrary::TrackAccountCreated(Method);
}
```

A Blueprint graph calls the exact same nodes visually — same function names,
same parameters, same optional pins collapsed by default.
