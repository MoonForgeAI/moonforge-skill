# Implementing Locked Telemetry (session / economy / revenue)

Canonical names and property keys: `moonforge-events/references/telemetry-model.md`.
**Copy verbatim.** Use helpers when available so schemas stay correct.

## Order of work

1. **SDK in project** with client context on `session_start` (timezone, attribution,
   geo hints) — web bundled SDK does this automatically; Unity/generic generated
   SDK must implement `prepareSessionStart()` / equivalent per `sdk-contract.md`.
2. **Revenue hooks** when profile Monetization is IAP / ads / both.
3. **Economy hooks** at every currency/item mutation when profile has Economy Resources.
4. **Game action hooks** from the instrumentation manifest (analyze output).

---

## Web SDK helpers

```javascript
// Session (auto on init; manual re-fire if needed)
MoonForgeAnalytics.trackSessionStart();

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

## Unity — economy (P2)

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
- `track_session_start()` with client context payload
- `track_economy_transaction(reason, inputs, outputs)`
- `track_iap_*` / `track_ad_*` with locked names

Instrument at the same hook categories as Unity: wallet mutations, store
callbacks, ad SDK listeners, launch URL / deep-link parser for attribution.
