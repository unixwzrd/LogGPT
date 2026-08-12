import Foundation

enum PlusEntitlement {
    static let productIdentifier = "ai.unixwzrd.LogGPT.plus.upgrade"
    static let appGroupIdentifier = "69H57JTW3S.ai.unixwzrd.LogGPT.shared"
    static let cacheKey = "LogGPT.hasVerifiedPlusEntitlement"
    static let cacheVerifiedAtKey = "LogGPT.plusEntitlementVerifiedAt"
    static let cachedDisplayPriceKey = "LogGPT.plusDisplayPrice"
    #if DEBUG
    static let forceBasicForDevelopmentKey = "LogGPT.forceBasicForDevelopment"
    #endif

    static var buildIncludesPlus: Bool {
        Bundle.main.bundleIdentifier?.contains("LogGPTPlus") == true
    }

    static var cachedValue: Bool {
        if buildIncludesPlus { return true }
        #if DEBUG
        if forceBasicForDevelopment { return false }
        #endif
        return UserDefaults(suiteName: appGroupIdentifier)?.bool(forKey: cacheKey) ?? false
    }

    static var cacheVerifiedAt: Date? {
        UserDefaults(suiteName: appGroupIdentifier)?.object(forKey: cacheVerifiedAtKey) as? Date
    }

    static var cachedDisplayPrice: String? {
        UserDefaults(suiteName: appGroupIdentifier)?.string(forKey: cachedDisplayPriceKey)
    }

    static func updateCache(_ hasPlus: Bool) {
        // The standalone development target is always Plus and must not grant
        // an entitlement to the separately signed production LogGPT target.
        guard !buildIncludesPlus else { return }
        let defaults = UserDefaults(suiteName: appGroupIdentifier)
        defaults?.set(hasPlus, forKey: cacheKey)
        defaults?.set(Date(), forKey: cacheVerifiedAtKey)
    }

    static func updateCachedDisplayPrice(_ displayPrice: String?) {
        guard !buildIncludesPlus else { return }
        UserDefaults(suiteName: appGroupIdentifier)?.set(displayPrice, forKey: cachedDisplayPriceKey)
    }

    #if DEBUG
    static var forceBasicForDevelopment: Bool {
        UserDefaults(suiteName: appGroupIdentifier)?.bool(forKey: forceBasicForDevelopmentKey) ?? false
    }

    static func clearDevelopmentCache() {
        guard !buildIncludesPlus else { return }
        let defaults = UserDefaults(suiteName: appGroupIdentifier)
        defaults?.removeObject(forKey: cacheKey)
        defaults?.removeObject(forKey: cacheVerifiedAtKey)
        defaults?.set(true, forKey: forceBasicForDevelopmentKey)
    }

    static func resumeStoreKitEntitlementsForDevelopment() {
        UserDefaults(suiteName: appGroupIdentifier)?.removeObject(forKey: forceBasicForDevelopmentKey)
    }
    #endif
}
