# Building, Certifying, Archiving, and Uploading LogGPT (Safari Extension) from the Command Line

This guide explains how to build, archive, sign, notarize, and upload the LogGPT Safari Extension to the Mac App Store **outside of Xcode** using command-line tools. This is useful for automation, CI/CD, or advanced users who prefer not to use Xcode's GUI.

---

## 1. Prerequisites

- **Xcode** and Xcode command-line tools installed
- **Apple Developer account** with valid certificates (Distribution, Developer ID, etc.)
- **Provisioning profiles** downloaded and installed
- **Transporter** app (for App Store upload) or access to `xcrun altool`
- **Project Scheme:** `LogGPT` (or your custom scheme)

---

## 2. Clean and Build the Project

```bash
cd /path/to/LogGPT
xcodebuild -project LogGPT/LogGPT.xcodeproj -scheme LogGPT clean build | tee build.log
```
- Output will be in `build.log`. Check for errors:
  ```bash
  grep -i error build.log
  ```

---

## 3. Archive the Project

```bash
xcodebuild -project LogGPT/LogGPT.xcodeproj -scheme LogGPT -configuration Release archive -archivePath ./build/LogGPT.xcarchive | tee archive.log
```
- Check for errors:
  ```bash
  grep -i error archive.log
  ```

---

## 4. Export the Archive for Distribution

Prepare an `ExportOptions.plist` (see Xcode docs for template; usually 'app-store' method for App Store):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
</dict>
</plist>
```

Export:
```bash
xcodebuild -exportArchive -archivePath ./build/LogGPT.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ./build | tee export.log
```
- Check for errors:
  ```bash
  grep -i error export.log
  ```

---

## 5. Notarize (for Mac apps, optional for Safari Extensions)

If required, notarize the exported .app or .pkg:
```bash
xcrun notarytool submit ./build/LogGPT.pkg --apple-id "YOUR_APPLE_ID" --team-id "YOUR_TEAM_ID" --password "APP_SPECIFIC_PASSWORD" --wait
```
- Check the notarization status as instructed by the tool.

---

## 6. Upload to App Store Connect

Using Transporter app (GUI) or command line:

**With Transporter GUI:**
- Open Transporter, sign in, drag the exported `.ipa` or `.pkg` file and upload.

**With altool (deprecated, but still available):**
```bash
xcrun altool --upload-app -f ./build/LogGPT.pkg -t osx -u "YOUR_APPLE_ID" -p "APP_SPECIFIC_PASSWORD"
```

---

## 7. Troubleshooting & Checking for Errors

- Always check your build, archive, and export logs for the word `error`.
- If you see code signing or provisioning errors, verify your certificates and provisioning profiles.
- For detailed build issues, search for `error:` or `failed` in the logs.

---

## 8. Additional Notes

- Some steps (like provisioning, entitlements, or fixing signing issues) may still require Xcode for initial setup.
- For Safari Extensions, Xcode manages entitlements and packaging best. Use the command line for automation, but validate in Xcode if you encounter issues.
- Always test your extension in Safari before submitting to the App Store.

---

## References
- [Apple: Distributing Apps Using Command Line Tools](https://developer.apple.com/documentation/xcode/distributing-your-app-for-testing-and-release)
- [xcodebuild Man Page](https://ss64.com/osx/xcodebuild.html)
- [Transporter App](https://apps.apple.com/us/app/transporter/id1450874784)
- [Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
