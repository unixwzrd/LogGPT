# LogGPT and LogGPT Plus

It appears the security policy changes with Apple and I have managed to get the app submitted to the App Store. There are also no time restrictions on having to reset the Allow Unsigned extensions anymore, though I could be wrong, in fact it seems to install and stay installed and function now without having to allow for unsigned extensions. I have not been able to try this out, but am adding a signed binary compile using my valid Apple Developer Certificate to the repo.

<p align="center">
  <img src="./LogGPT/LogGPT%20Extension/icons/Icon-512.png" alt="LogGPT Icon" />
</p>

## Table of Contents

- [LogGPT and LogGPT Plus](#loggpt-and-loggpt-plus)
  - [Table of Contents](#table-of-contents)
  - [Project Update](#project-update)
  - [Export and preserve your ChatGPT conversation logs easily](#export-and-preserve-your-chatgpt-conversation-logs-easily)
  - [Features](#features)
    - [LogGPT and the Plus upgrade](#loggpt-and-the-plus-upgrade)
  - [Safari Extension](#safari-extension)
    - [Why Use It?](#why-use-it)
    - [Using the Extension](#using-the-extension)
    - [Uninstalling the Extension](#uninstalling-the-extension)
  - [Build It Yourself](#build-it-yourself)
    - [If You Build It Yourself](#if-you-build-it-yourself)
  - [Support](#support)
  - [Changelog](#changelog)
    - [2026-03-18  v1.2.0](#2026-03-18--v120)
    - [2025-06-22  v1.0.6](#2025-06-22--v106)
  - [Credits](#credits)
  
## Project Update

This project is a utility designed to make exporting ChatGPT conversation history in JSON format simple and efficient. It's a straightforward tool that I hoped to share freely for anyone to use and improve upon, while also showcasing my work to potential employers or clients. The extension has been submitted to Apple for review and after being rejected last week because it looked too much like ChatGPT and a few other reasons, I have changed the Application Icons and a few other things to help it pass the App Store review process.

**Recent UI Update:**

- Has an option to activate LogGPT Plus to capture more content, including generated content, uploaded content, and selected content.
- The LogGPT and LogGPT Plus button is now visually integrated as the right-most button in the ChatGPT conversation header bar (not fixed-positioned).
- The export/save button when using LogGPT Plus will ask which artifacts you wish to download - generated, uploaded or both.

## Export and preserve your ChatGPT conversation logs easily

This extension allows users to download complete conversation logs from OpenAI's ChatGPT in JSON format, capturing session details for use in documentation, analysis, and content creation.

## Features

- LogGPT will download chat history in JSON format.
- LogGPT Plus will download chat history in JSON format, and optionally generated, uploaded or both in a ZIP archive.
- Full conversation export to JSON format
- Save/export button is now seamlessly integrated into the ChatGPT conversation header bar as the left-most action button
- Button size is 48x32px with a 32x32px icon, matching the style of other header actions
- Robust injection logic ensures the button remains visible even if the page content changes dynamically
- **NEW**: Consistent download icon display across all page states and navigation
- Supports browser compatibility for Safari
- Preserves chat logs for documentation, import, and analysis
- Prioritizes user privacy: **no tracking or data collection**

### LogGPT and the Plus upgrade

The App Store product remains one app:

- `LogGPT` downloads conversation JSON without an upgrade.
- The permanent `LogGPT Plus` non-consumable unlocks a single JSON-plus-artifacts archive as `<stem>.zip`.

The upgrade uses Apple StoreKit entirely on-device. LogGPT has no user accounts, analytics, telemetry, or purchase server. The repo retains the standalone `LogGPT Plus` target as an optional future SKU, but it is not required for the current upgrade model.

The shared export contract with `extract-chat` is:

- `<stem>.json`
- `<stem>/artifact-manifest.json`
- `<stem>/artifacts/generated/`
- `<stem>/artifacts/uploaded/`
- `<stem>/artifacts/derived/`

The version-2 manifest records detected and declared MIME types, hashes, sizes, stable file IDs, and sanitized source URLs. Artifact capture is format-agnostic: images, vector graphics, audio, video, documents, tabular files, archives, and unknown binary data are preserved byte-for-byte. `extract-chat` consumes this package offline and prefers local artifact links in rendered Markdown/HTML.

Current status:

- The Xcode project contains distinct `LogGPT` and `LogGPT Plus` app/extension targets backed by shared Swift and JavaScript sources.
- The Basic and Plus products share extension sources; StoreKit entitlement or the standalone Plus bundle gates artifact capture.
- Partial artifact failures still produce a usable ZIP and are recorded in the artifact manifest.
- Basic users see one concise upgrade explanation on their first JSON download. It is dismissed by default, can be restored from Reset to Defaults, and never interrupts Plus exports.
- Entitlement-aware toolbar and page icons refresh without a ChatGPT page reload (on focus, hover, download, and a lightweight ten-second visible-page check).

## Safari Extension

There are two ways to get this extension:

1. Buy it on the App Store. *preferred* or if you install it manually, please consider [supporting](#support) my work.
1. Download the LogGPT repository and build it yourself.

Obviously the best way is to buy it on the App Store, which I would prefer as a lot of effort went into this very simple extension. But if you want to build it yourself, you can do that too.

### Why Use It?

- Summarize and analyze past chat sessions
- Archive and convert conversations into formats like Markdown and HTML
- Easily transfer conversations to a new ChatGPT instance for continuity

A version may be added to the Apple App Store, with a small fee to cover Apple Developer Program costs. The binaries provided are signed with an Apple Developer Certificate for added security.

### Using the Extension

1. Open a ChatGPT session in your browser.
2. The export/save button ![download icon](./LogGPT/LogGPT/Assets.xcassets/AppIcon.appiconset/Icon-128-download.png) will appear as the **left-most button in the conversation header bar** (next to the other action buttons, not floating or fixed in the viewport).
3. Click the export/save button to download the current conversation as a JSON file to your `Downloads` folder.

After purchasing `LogGPT Plus`, click the Safari toolbar extension icon to configure:

- `Generated Content`
- `Uploaded Content`
- `Select All` / `Select None`

With both categories off, the injected button downloads JSON only. Otherwise it downloads one ZIP containing the JSON, artifacts, hashes, provenance, failures, and user-skipped entries. Uploaded classification takes precedence when an item is referenced in both contexts.

- While the extension is active, the icon in the Menu Bar will be "on" and when inactive it will be greyed out.

  ![Screenshot of Safari Extension](./LogGPT/LogGPT/Assets.xcassets/AppIcon.appiconset/Icon-128-download.png)

### Uninstalling the Extension

1. Open **Safari** -> **Settings** -> **Extensions**.
2. Select the `LogGPT` extension and click **Uninstall**.
3. Follow the instructions for removing the extension from your system.

## Build It Yourself

You will need Xcode from the Mac App Store. Clone the repository and open the included project:

```bash
git clone https://github.com/unixwzrd/chatgpt-chatlog-export.git LogGPT
cd LogGPT
open LogGPT/LogGPT.xcodeproj
```

Select the `LogGPT` scheme and build it. The resulting Basic app embeds the Safari extension and exports conversation JSON.

### If You Build It Yourself

You will likely need to check the "Allow Unsigned Extensions" checkbox in Safari to run, unless you can sign it yourself.  I have uploaded a signed version, it is a package and would appreciate it if someone could test it out. So this step should no longer necessary and you will have to do is download the .pkg file and install it.

Again, I would appreciate it if you could buy one on the App Store or if you are feeling generous, buy me a coffee.

  ![Screenshot of Safari Extension menu item and downloaded JSON file](graphics/Screenshot%202024-11-06%20at%2012.46.30.png)

## Support

If you find this extension helpful, consider supporting my work on [Patreon](https://patreon.com/unixwzrd) or [Ko-fi](https://ko-fi.com/unixwzrd). My goal with this project and others is to bring awareness to issues like parental alienation and to advocate for a child's right to have both parents involved in their lives.

Visit [Distributed Thinking Systems LLC](https://unixwzrd.ai/) for information about my other projects.

## Changelog

### 2026-03-18  v1.2.0

- Added a target-ready `LogGPT Plus` export contract with premium manifests
- Refactored the content script so the base product remains JSON-only while the Plus SKU can prompt for optional media export
- Added a single ZIP containing JSON, categorized artifacts, and `artifact-manifest.json`
- Added generated/uploaded artifact controls in the toolbar popup
- Aligned export naming with `extract-chat` so JSON and media bundles share a deterministic stem
- Added separate base and Plus Xcode app/extension targets with shared sources

### 2025-06-22  v1.0.6

- **FIXED**: Button persistence issue when page refreshes or DOM changes
- **REFACTORED**: Separated button creation from event handler logic for better performance
- Moved download button handler to dedicated function to avoid recreation on each injection
- Simplified button injection function to focus solely on DOM manipulation
- Button now persists through ChatGPT's dynamic UI updates and page refreshes

## Credits

Thanks to [Deskuma](https://github.com/Deskuma) for the original codebase used in the Firefox and Chrome extensions, which inspired this project.
