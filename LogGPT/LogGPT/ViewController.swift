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
        default:
            break
        }
    }

    private func showPlusPurchase(_ snapshot: StoreKitManager.Snapshot) {
        let payload: [String: Any] = [
            "hasPlus": snapshot.hasPlus,
            "isLoading": snapshot.isLoading,
            "displayPrice": snapshot.displayPrice ?? NSNull(),
            "message": snapshot.message,
        ]
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("updatePlusPurchase(\(json))")
    }

}
