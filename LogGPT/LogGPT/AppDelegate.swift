import Cocoa
import SafariServices
import os.log

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        let extensionBundleIdentifier = "ai.unixwzrd.LogGPT" // Use your actual extension's bundle identifier

        // Check the current state of the extension
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            if let error = error {
                os_log("Error retrieving extension state: %@", error.localizedDescription)
                return
            }

            guard let state = state else {
                os_log("Extension state is nil")
                return
            }

            if !state.isEnabled {
                os_log("Extension is disabled; reloading all ChatGPT tabs.")
                self.reloadAllChatGPTTabs()
            }
        }

        // Observe for extension state changes
        NotificationCenter.default.addObserver(self, selector: #selector(extensionStateDidChange(_:)), name: NSNotification.Name("SFSafariExtensionStateDidChangeNotification"), object: nil)
    }

    @objc func extensionStateDidChange(_ notification: Notification) {
        let extensionBundleIdentifier = "ai.unixwzrd.LogGPT" // Use your actual extension's bundle identifier

        // Re-check the state when a change is detected
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            if let error = error {
                os_log("Error retrieving extension state after change: %@", error.localizedDescription)
                return
            }

            guard let state = state else {
                os_log("Extension state is nil after change")
                return
            }

            if !state.isEnabled {
                os_log("Extension was disabled; reloading all ChatGPT tabs.")
                self.reloadAllChatGPTTabs()
            }
        }
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