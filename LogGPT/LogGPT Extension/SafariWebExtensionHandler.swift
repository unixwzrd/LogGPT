//
//  SafariWebExtensionHandler.swift
//  LogGPT Extension
//

import SafariServices
import AppKit
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received native extension message (profile: %@)", profile?.uuidString ?? "none")

        let responseMessage: [String: Any]
        if let dictionary = message as? [String: Any],
           let command = dictionary["command"] as? String {
            switch command {
            case "getPlusEntitlement":
                responseMessage = [
                    "hasPlus": PlusEntitlement.cachedValue,
                    "source": PlusEntitlement.buildIncludesPlus ? "plus-build" : "verified-cache",
                ]
            case "openContainingApp":
                responseMessage = ["opened": openContainingApp()]
            default:
                responseMessage = ["error": "Unknown native message command"]
            }
        } else {
            responseMessage = ["error": "Invalid native message"]
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseMessage]
        } else {
            response.userInfo = ["message": responseMessage]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

    private func openContainingApp() -> Bool {
        let appURL = Bundle.main.bundleURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        guard appURL.pathExtension == "app" else { return false }
        NSWorkspace.shared.open(appURL)
        return true
    }

    func handleExtensionDeactivation() {
        os_log("Extension is being deactivated. Reloading all ChatGPT tabs.")
        reloadAllChatGPTTabs()
    }

    func reloadAllChatGPTTabs() {
        SFSafariApplication.getAllWindows { windows in
            for window in windows {
                window.getAllTabs { tabs in
                    for tab in tabs {
                        tab.getActivePage { page in
                            page?.getPropertiesWithCompletionHandler { properties in
                                if let url = properties?.url, url.host?.contains("chatgpt.com") == true {
                                    page?.reload()
                                    os_log("Reloaded tab with URL: %@", url.absoluteString)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
