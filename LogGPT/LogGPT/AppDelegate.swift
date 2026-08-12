import Cocoa
import SafariServices
import os.log

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    private var basicApplicationIcon: NSImage?

    private var extensionBundleIdentifier: String {
        if let configured = Bundle.main.object(forInfoDictionaryKey: "LogGPTExtensionBundleIdentifier") as? String,
           !configured.isEmpty {
            return configured
        }
        return "ai.unixwzrd.LogGPT.Extension"
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        basicApplicationIcon = NSApplication.shared.applicationIconImage
        configureApplicationMenu(hasPlus: PlusEntitlement.cachedValue)
        updateApplicationIcon(hasPlus: PlusEntitlement.cachedValue)
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

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            showMainWindow()
        }
        return true
    }

    func updateBranding(hasPlus: Bool) {
        updateApplicationIcon(hasPlus: hasPlus)
        configureApplicationMenu(hasPlus: hasPlus)
    }

    @objc private func showMainWindow() {
        NSApplication.shared.windows.first { $0.canBecomeMain }?.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    @objc private func showAboutPanel() {
        let hasPlus = PlusEntitlement.cachedValue
        let name = hasPlus ? "LogGPT Plus" : "LogGPT Basic"
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        NSApplication.shared.orderFrontStandardAboutPanel(options: [
            .applicationName: name,
            .applicationVersion: version,
            .version: build,
            .credits: NSAttributedString(string: hasPlus
                ? "Plus artifact archiving is unlocked. No analytics or personal information is collected."
                : "Basic JSON export. Upgrade to Plus for generated and uploaded artifact archiving."),
        ])
    }

    private func configureApplicationMenu(hasPlus: Bool) {
        guard let appMenu = NSApplication.shared.mainMenu?.items.first?.submenu else { return }
        if let about = appMenu.items.first {
            about.title = hasPlus ? "About LogGPT Plus" : "About LogGPT Basic"
            about.target = self
            about.action = #selector(showAboutPanel)
        }
        let identifier = NSUserInterfaceItemIdentifier("LogGPT.PlusMenuItem")
        let plusItem: NSMenuItem
        if let existing = appMenu.items.first(where: { $0.identifier == identifier }) {
            plusItem = existing
        } else {
            plusItem = NSMenuItem(title: "", action: #selector(showMainWindow), keyEquivalent: "")
            plusItem.identifier = identifier
            plusItem.target = self
            appMenu.insertItem(plusItem, at: min(2, appMenu.items.count))
        }
        plusItem.title = hasPlus ? "LogGPT Plus Settings…" : "Get LogGPT Plus…"
    }

    private func updateApplicationIcon(hasPlus: Bool) {
        if hasPlus,
           let url = Bundle.main.url(forResource: "PlusIcon", withExtension: "png"),
           let image = NSImage(contentsOf: url) {
            NSApplication.shared.applicationIconImage = image
        } else if let basicApplicationIcon {
            NSApplication.shared.applicationIconImage = basicApplicationIcon
        }
    }

    @objc func extensionStateDidChange(_ notification: Notification) {
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
