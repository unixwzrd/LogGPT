//
//  ViewController.swift
//  LogGPT
//
//  Created by Michael Sullivan on 11/4/24.
//

import Cocoa
import SafariServices
import WebKit

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    private var extensionBundleIdentifier: String {
        if let configured = Bundle.main.object(forInfoDictionaryKey: "LogGPTExtensionBundleIdentifier") as? String,
           !configured.isEmpty {
            return configured
        }
        return "ai.unixwzrd.LogGPT.Extension"
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

        self.webView.configuration.userContentController.add(self, name: "controller")

        StoreKitManager.shared.onChange = { [weak self] snapshot in
            self?.showPlusPurchase(snapshot)
        }
        StoreKitManager.shared.onPurchaseCompleted = { [weak self] in
            self?.showPurchaseConfirmationAndQuit()
        }
        StoreKitManager.shared.start()

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show(\(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show(\(state.isEnabled), false)")
                }
            }
        }
        showPlusPurchase(StoreKitManager.shared.currentSnapshot)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let action: String?
        if let string = message.body as? String {
            action = string
        } else if let dictionary = message.body as? [String: Any] {
            action = dictionary["action"] as? String
        } else {
            action = nil
        }

        switch action {
        case "open-preferences":
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
                DispatchQueue.main.async {
                    NSApplication.shared.terminate(nil)
                }
            }
        case "purchase-plus":
            Task { await StoreKitManager.shared.purchase() }
        case "restore-purchases":
            Task { await StoreKitManager.shared.restore() }
        case "refresh-purchases":
            Task { await StoreKitManager.shared.reload() }
        #if DEBUG
        case "reset-plus-development-cache":
            StoreKitManager.shared.clearDevelopmentEntitlementCache()
        #endif
        default:
            break
        }
    }

    private func showPlusPurchase(_ snapshot: StoreKitManager.Snapshot) {
        (NSApplication.shared.delegate as? AppDelegate)?.updateBranding(hasPlus: snapshot.hasPlus)
        let payload: [String: Any] = [
            "hasPlus": snapshot.hasPlus,
            "isLoading": snapshot.isLoading,
            "displayPrice": snapshot.displayPrice ?? NSNull(),
            "message": snapshot.message,
            "entitlementSource": snapshot.entitlementSource,
            "showDebugControls": _isDebugAssertConfiguration(),
        ]
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("updatePlusPurchase(\(json))")
    }

    private func showPurchaseConfirmationAndQuit() {
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "LogGPT Plus is ready"
        alert.informativeText = "Generated and uploaded artifact downloads are enabled. No additional Safari configuration is required."
        alert.addButton(withTitle: "Done")
        if let window = view.window {
            alert.beginSheetModal(for: window) { _ in
                NSApplication.shared.terminate(nil)
            }
        } else {
            alert.runModal()
            NSApplication.shared.terminate(nil)
        }
    }

}
