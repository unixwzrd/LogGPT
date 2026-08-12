import Foundation
import StoreKit

@MainActor
final class StoreKitManager {
    struct Snapshot {
        let hasPlus: Bool
        let isLoading: Bool
        let displayPrice: String?
        let message: String
        let entitlementSource: String
    }

    static let shared = StoreKitManager()

    var onChange: ((Snapshot) -> Void)?
    var onPurchaseCompleted: (() -> Void)?

    private(set) var hasPlus = PlusEntitlement.cachedValue
    private var product: Product?
    private var isLoading = false
    private var message = "Checking your Plus upgrade…"
    private var entitlementSource = PlusEntitlement.buildIncludesPlus
        ? "Standalone Plus build"
        : (PlusEntitlement.cachedValue ? "Cached pending verification" : "Basic")
    private var transactionListener: Task<Void, Never>?
    private var started = false

    var currentSnapshot: Snapshot {
        Snapshot(
            hasPlus: hasPlus,
            isLoading: isLoading,
            displayPrice: product?.displayPrice,
            message: message,
            entitlementSource: entitlementSource
        )
    }

    private init() {}

    deinit {
        transactionListener?.cancel()
    }

    func start() {
        guard !started else {
            notify()
            return
        }
        started = true

        if PlusEntitlement.buildIncludesPlus {
            hasPlus = true
            message = "Plus features are included in this build."
            entitlementSource = "Standalone Plus build"
            notify()
            return
        }

        transactionListener = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                await self.process(transactionResult: result)
            }
        }

        Task { [weak self] in
            await self?.reload()
        }
    }

    func reload() async {
        isLoading = true
        message = "Checking your Plus upgrade…"
        notify()

        do {
            product = try await Product.products(for: [PlusEntitlement.productIdentifier]).first
            PlusEntitlement.updateCachedDisplayPrice(product?.displayPrice)
            await refreshEntitlement()
            if hasPlus {
                message = "LogGPT Plus is unlocked on this Mac."
            } else if product == nil {
                message = "The Plus upgrade is not available in the current App Store environment."
            } else {
                message = "Upgrade once to archive generated and uploaded artifacts."
            }
        } catch {
            await refreshEntitlement()
            message = hasPlus
                ? "LogGPT Plus is unlocked on this Mac."
                : "Could not contact the App Store. Basic JSON export remains available."
        }

        isLoading = false
        notify()
    }

    func purchase() async {
        #if DEBUG
        PlusEntitlement.resumeStoreKitEntitlementsForDevelopment()
        #endif
        if product == nil {
            await reload()
        }
        guard let product else {
            message = "The Plus upgrade is currently unavailable. Please try again later."
            notify()
            return
        }

        isLoading = true
        message = "Waiting for the App Store…"
        notify()

        var completedPurchase = false
        do {
            switch try await product.purchase() {
            case .success(let verification):
                let transaction = try verified(verification)
                await transaction.finish()
                await refreshEntitlement()
                message = hasPlus
                    ? "Thank you—LogGPT Plus is now unlocked."
                    : "The purchase completed, but its entitlement could not be verified."
                completedPurchase = hasPlus
            case .pending:
                message = "The purchase is pending approval or payment confirmation."
            case .userCancelled:
                message = "The purchase was cancelled."
            @unknown default:
                message = "The App Store returned an unknown purchase result."
            }
        } catch {
            message = "The purchase could not be completed: \(error.localizedDescription)"
        }

        isLoading = false
        notify()
        if completedPurchase {
            onPurchaseCompleted?()
        }
    }

    func restore() async {
        #if DEBUG
        PlusEntitlement.resumeStoreKitEntitlementsForDevelopment()
        #endif
        isLoading = true
        message = "Restoring App Store purchases…"
        notify()

        do {
            try await AppStore.sync()
            await refreshEntitlement()
            message = hasPlus
                ? "LogGPT Plus has been restored."
                : "No LogGPT Plus purchase was found for this Apple Account."
        } catch {
            message = "Purchases could not be restored: \(error.localizedDescription)"
        }

        isLoading = false
        notify()
    }

    private func refreshEntitlement() async {
        #if DEBUG
        if PlusEntitlement.forceBasicForDevelopment {
            hasPlus = false
            PlusEntitlement.updateCache(false)
            entitlementSource = "Development Basic override"
            return
        }
        #endif
        var verifiedPlus = false
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard transaction.productID == PlusEntitlement.productIdentifier else { continue }
            if transaction.revocationDate == nil {
                verifiedPlus = true
            }
        }
        hasPlus = verifiedPlus
        PlusEntitlement.updateCache(verifiedPlus)
        entitlementSource = verifiedPlus ? "Verified App Store purchase" : "Basic"
    }

    private func process(transactionResult: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = transactionResult else { return }
        guard transaction.productID == PlusEntitlement.productIdentifier else { return }
        await transaction.finish()
        await refreshEntitlement()
        message = hasPlus
            ? "LogGPT Plus is unlocked on this Mac."
            : "The Plus entitlement is no longer active."
        notify()
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw StoreKitError.unverifiedTransaction
        }
    }

    private func notify() {
        onChange?(currentSnapshot)
    }

    #if DEBUG
    func clearDevelopmentEntitlementCache() {
        guard !PlusEntitlement.buildIncludesPlus else {
            message = "The LogGPT Plus scheme is always unlocked. Select the LogGPT scheme to test Basic mode."
            entitlementSource = "Standalone Plus build"
            notify()
            return
        }
        PlusEntitlement.clearDevelopmentCache()
        hasPlus = false
        entitlementSource = "Development Basic override"
        message = "Basic mode is forced for this Debug build. Upgrade or Restore re-enables StoreKit testing."
        notify()
    }
    #endif

    private enum StoreKitError: LocalizedError {
        case unverifiedTransaction

        var errorDescription: String? {
            "The App Store transaction could not be verified."
        }
    }
}
