import Foundation

enum PlusEntitlement {
    static let productIdentifier = "ai.unixwzrd.LogGPT.plus.upgrade"
    static let appGroupIdentifier = "69H57JTW3S.ai.unixwzrd.LogGPT.shared"
    static let cacheKey = "LogGPT.hasVerifiedPlusEntitlement"

    static var buildIncludesPlus: Bool {
        Bundle.main.bundleIdentifier?.contains("LogGPTPlus") == true
    }

    static var cachedValue: Bool {
        buildIncludesPlus || (UserDefaults(suiteName: appGroupIdentifier)?.bool(forKey: cacheKey) ?? false)
    }

    static func updateCache(_ hasPlus: Bool) {
        // The standalone development target is always Plus and must not grant
        // an entitlement to the separately signed production LogGPT target.
        guard !buildIncludesPlus else { return }
        UserDefaults(suiteName: appGroupIdentifier)?.set(hasPlus, forKey: cacheKey)
    }
}
