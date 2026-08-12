# LogGPT Plus StoreKit setup

LogGPT uses one permanent, non-consumable in-app purchase. StoreKit verifies it
on the Mac; LogGPT has no accounts, analytics, telemetry, or purchase server.

## App Store Connect

1. Open the existing **LogGPT** app record. Do not create a separate app for
   this upgrade.
2. Under **Monetization > In-App Purchases**, create a **Non-Consumable**.
3. Use product ID `ai.unixwzrd.LogGPT.plus.upgrade` and reference name
   `LogGPT Plus Upgrade`.
4. Select the $2.99 price point, add the display name and description, and add
   the required review screenshot.
5. Add the new IAP to the first LogGPT app version submitted with this code.
   Apple's first IAP must be submitted for review with a new app version.
6. In the version notes and App Review notes, explain that the containing app's
   **Upgrade to Plus** button unlocks ZIP artifact export and **Restore
   Purchases** restores the non-consumable.

The source still contains a `LogGPT Plus` target for possible future standalone
distribution, but it is not needed for this upgrade path and should not be
submitted now.

## Local testing in Xcode

The local StoreKit catalog is `LogGPT/Configuration.storekit`, and the shared
`LogGPT` scheme selects it automatically for Run builds.

1. Select the **LogGPT** scheme and run it.
2. Purchase the test upgrade, then use Safari's LogGPT toolbar popup
   to confirm that the artifact controls unlock.
3. In Xcode choose **Debug > StoreKit > Manage Transactions…** to test deletion,
   repurchase, and restoration.

Before release, also test with a Sandbox Apple Account and a build whose StoreKit
configuration is set to **None**, so the product comes from App Store Connect.

## Compatibility

This release targets macOS 12 because it uses StoreKit 2. The already-published
macOS 11-compatible build remains available to prior purchasers as the last
compatible version. Do not remove that version from sale; App Store availability
is handled from the same LogGPT app record.
