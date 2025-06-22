# LogGPT

It appears the security policy changes with Apple and I have managed to get the app submitted to the App Store. There are also no time restrictions on having to reset the Allow Unsigned extensions anymore, though I could be wrong, in fact it seems to install and stay installed and function now without having to allow for unsigned extensions. I have not been able to try this out, but am adding a signed binary compile using my valid Apple Developer Certificate to the repo.

<p align="center">
  <img src="./LogGPT/LogGPT%20Extension/icons/Icon-512.png" alt="LogGPT Icon" />
</p>

## Table of Contents

- [LogGPT](#loggpt)
  - [Table of Contents](#table-of-contents)
  - [Project Update](#project-update)
  - [Export and preserve your ChatGPT conversation logs easily](#export-and-preserve-your-chatgpt-conversation-logs-easily)
  - [Features](#features)
  - [Safari Extension](#safari-extension)
    - [Why Use It?](#why-use-it)
    - [Using the Extension](#using-the-extension)
    - [Uninstalling the Extension](#uninstalling-the-extension)
  - [Build It Yourself](#build-it-yourself)
    - [If You Build It Yourself](#if-you-build-it-yourself)
  - [Support](#support)
  - [Changelog](#changelog)
    - [2025-06-19 v1.0.6](#2025-06-19-v106)
    - [2025-04-29 v1.0.5](#2025-04-29-v105)
  - [Credits](#credits)
  
## Project Update

This project is a utility designed to make exporting ChatGPT conversation history in JSON format simple and efficient. It's a straightforward tool that I hoped to share freely for anyone to use and improve upon, while also showcasing my work to potential employers or clients. The extension has been submitted to Apple for review and after being rejected last week because it looked too much like ChatGPT and a few other reasons, I have changed the Application Icons and a few other things to help it pass the App Store review process.

**Recent UI Update:**

- The export/save button is now visually integrated as the left-most button in the ChatGPT conversation header bar (not fixed-positioned).
- The button size is now 48x32px, with a 32x32px icon for improved consistency and usability.
- The button will always appear with the other action buttons and adapts to dynamic page changes.
- **NEW in v1.0.6**: Fixed download icon persistence - the proper download icon now appears consistently across page refreshes and navigation.

## Export and preserve your ChatGPT conversation logs easily

This extension allows users to download complete conversation logs from OpenAI's ChatGPT in JSON format, capturing session details for use in documentation, analysis, and content creation.

## Features

- Full conversation export to JSON format
- Save/export button is now seamlessly integrated into the ChatGPT conversation header bar as the left-most action button
- Button size is 48x32px with a 32x32px icon, matching the style of other header actions
- Robust injection logic ensures the button remains visible even if the page content changes dynamically
- **NEW**: Consistent download icon display across all page states and navigation
- Supports browser compatibility for Safari
- Preserves chat logs for documentation, import, and analysis
- Prioritizes user privacy: **no tracking or data collection**

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
2. The export/save button ![download icon](./icons/download-icon.svg) will appear as the **left-most button in the conversation header bar** (next to the other action buttons, not floating or fixed in the viewport).
3. Click the export/save button to download the current conversation as a JSON file to your `Downloads` folder.

- While the extension is active, the icon in the Menu Bar will be "on" and when inactive it will be greyed out.

  ![Screenshot of Safari Extension](./graphics/Screenshot%202025-03-17%20at%2008.00.57.png)

### Uninstalling the Extension

1. Open **Safari** -> **Settings** -> **Extensions**.
2. Select the `LogGPT` extension and click **Uninstall**.
3. Follow the instructions for removing the extension from your system.

## Build It Yourself

You will need a copy of Xcode, you can get it and this extension on the App Store.

[The Xcode project file is here.](https://github.com/unixwzrd/chatgpt-chatlog-export/tree/main/LogGPT)) Clone the repository and try

  ```bash
  git clone https://github.com/unixwzrd/chatgpt-chatlog-export.git chatgpt-jason
  cd chatgpt-jason
  xcodebuild build -project 'LogGPT.xcodeproj'
  ```

### If You Build It Yourself

You will likely need to check the "Allow Unsigned Extensions" checkbox in Safari to run, unless you can sign it yourself.  I have uploaded a signed version, it is a package and would appreciate it if someone could test it out. So this step should no longer necessary and you will have to do is download the .pkg file and install it.

Again, I would appreciate it if you could buy one on the App Store or if you are feeling generous, buy me a coffee.

  ![Screenshot of Safari Extension menu item and downloaded JSON file](graphics/Screenshot%202024-11-06%20at%2012.46.30.png)

## Support

If you find this extension helpful, consider supporting my work on [Patreon](https://patreon.com/unixwzrd) or [Ko-fi](https://ko-fi.com/unixwzrd). My goal with this project and others is to bring awareness to issues like parental alienation and to advocate for a child's right to have both parents involved in their lives.

Visit [Distributed Thinking Systems LLC](https://unixwzrd.ai/) for information about my other projects.

## Changelog

### 2025-06-19 v1.0.6

- **FIXED**: Multiple instance prevention when extension is reactivated
- Improved instance detection using multiple indicators (button, interval, global flag)
- Added cleanup of duplicate buttons and intervals to prevent conflicts
- Enhanced graceful shutdown to properly remove all event listeners
- Fixed race conditions during extension deactivation/reactivation cycles
- Added robust initialization that clears any leftover state
- Extension now properly handles Safari's script injection context resets
- **FIXED**: Download icon persistence across page refreshes and navigation
- Fixed issue where download button showed black down arrow instead of proper icon
- Improved icon application logic to always use correct download icon from icon.js
- Button now consistently shows proper download icon on page refresh, tab changes, and DOM updates
- Resolved compatibility issue with OpenAI's dynamic page loading changes

### 2025-04-29 v1.0.5

- **MAJOR UPDATE**: Complete redesign to comply with Apple App Store requirements
- Changed application icons and branding to avoid confusion with ChatGPT
- Updated UI spacing and positioning to prevent overlap with Canvas button
- Button icon now dynamically positions itself to the left of standard OpenAI Web UI elements
- Improved integration with ChatGPT's interface elements (Canvas, Share, Archive/Delete, User Settings)
- Enhanced compatibility with Apple's App Store review guidelines

## Credits

Thanks to [Deskuma](https://github.com/Deskuma) for the original codebase used in the Firefox and Chrome extensions, which inspired this project.
