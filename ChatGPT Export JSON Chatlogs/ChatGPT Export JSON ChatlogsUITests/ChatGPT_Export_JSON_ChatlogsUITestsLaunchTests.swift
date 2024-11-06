//
//  ChatGPT_Export_JSON_ChatlogsUITestsLaunchTests.swift
//  ChatGPT Export JSON ChatlogsUITests
//
//  Created by Michael Sullivan on 11/4/24.
//

import XCTest

final class ChatGPT_Export_JSON_ChatlogsUITestsLaunchTests: XCTestCase {

    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunch() throws {
        let app = XCUIApplication()
        app.launch()

        // Insert steps here to perform after app launch but before taking a screenshot,
        // such as logging into a test account or navigating somewhere in the app

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Launch Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
