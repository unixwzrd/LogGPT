# Update: macOS 15.1 Changes to Safari Web Extension Distribution

After nearly two weeks of work trying to make this utility accessible to everyone, I’ve encountered an unfortunate limitation in macOS 15.1. Due to recent security policies, Safari Web Extensions can now only be distributed via the App Store. This change prevents developers like myself from self-distributing Web Extensions outside of the App Store, even with an Apple Developer Program certificate.

## The Project So Far

This project is a utility designed to make exporting ChatGPT conversation history in JSON format simple and efficient. It’s a straightforward tool that I hoped to share freely for anyone to use and improve upon, while also showcasing my work to potential employers or clients.

I do have another machine which is Intel and running macOS 13, if I get a chance I may try building there, but I doubt the Xcode project will work with the older version of macOS.

### The Catch

Since the App Store is currently the only distribution path Apple allows for Safari Web Extensions, I can't directly provide a pre-built, signed binary here. However, I’ve included the full Xcode project files, so anyone interested can build and run it on their own system. If a workaround becomes available for distribution or if Apple makes changes, I’ll update this repository.

## Next Steps and How You Can Help

- **Build It Yourself:** If you’re a developer, you can try building the extension locally from the provided project files. [The Xcode project file is here.](https://github.com/unixwzrd/chatgpt-chatlog-export/tree/main/ChatGPT%20Export%20JSON%20Chatlogs) Clone the repository and try
  ```bash
  git clone https://github.com/unixwzrd/chatgpt-chatlog-export.git chatgpt-jason
  cd chatgpt-jason
  xcodebuild build -project ChatGPT-Export-Chatlog-JSON.xcodeproj
  ```
- **Share Ideas:** If you know of a way to distribute this utility effectively within Apple’s latest guidelines, please leave a comment in the Discussions.
  
Thanks for your patience, and let’s work together to keep this project moving forward!

# ChatGPT: Chat Log Export Downloader

### Export and preserve your ChatGPT conversation logs easily

This extension allows users to download complete conversation logs from OpenAI’s ChatGPT in JSON format, capturing session details for use in documentation, analysis, and content creation.

---

### Table of Contents

- [Update: macOS 15.1 Changes to Safari Web Extension Distribution](#update-macos-151-changes-to-safari-web-extension-distribution)
  - [The Project So Far](#the-project-so-far)
    - [The Catch](#the-catch)
  - [Next Steps and How You Can Help](#next-steps-and-how-you-can-help)
- [ChatGPT: Chat Log Export Downloader](#chatgpt-chat-log-export-downloader)
    - [Export and preserve your ChatGPT conversation logs easily](#export-and-preserve-your-chatgpt-conversation-logs-easily)
    - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Browser Versions and Installation](#browser-versions-and-installation)
    - [Safari Extensions](#safari-extensions)
    - [Chrome Extensions](#chrome-extensions)
    - [Firefox Add-ons](#firefox-add-ons)
  - [Using the Extension](#using-the-extension)
  - [Support](#support)
  - [Credits](#credits)

---

## Features

- Full conversation export to JSON format
- Supports cross-browser compatibility for Safari, Chrome, and Firefox
- Preserves chat logs for documentation, import, and analysis
- Prioritizes user privacy: **no tracking or data collection**

---

## Browser Versions and Installation

This extension is available for multiple browsers. Follow the installation instructions below for your browser of choice.

### Safari Extensions

The repository includes a precompiled, ready-to-install version. The Xcode project is also available for those who want to build it from source.

**Why Use It?**

- Summarize and analyze past chat sessions
- Archive and convert conversations into formats like Markdown and HTML
- Easily transfer conversations to a new ChatGPT instance for continuity

A version may be added to the Apple App Store, with a small fee to cover Apple Developer Program costs. The binaries provided are signed with an Apple Developer Certificate for added security.

**Installation for Safari:**

1. Download `ChatGPT-Export-Chatlog-JSON.app.zip`.
2. Extract the folder and run the `ChatGPT-Export-Chatlog-JSON.app`.
3. Enable the extension in **Safari** -> **Settings** -> **Extensions**.
4. The extension icon should appear in the Safari toolbar, and it's ready to use.

**Usage for Safari:**

1. Open a ChatGPT session and click the extension icon ![download icon](./icons/download-icon.svg) in the toolbar.
2. The session will download in JSON format to your `Downloads` folder.

**Uninstallation for Safari:**

1. Open **Safari** -> **Settings** -> **Extensions**.
2. Select the `ChatGPT - Export Chatlog JSON` extension and click **Uninstall**.
3. Move the downloaded folder to the Trash.

---

### Chrome Extensions

This extension is available on the [Chrome Web Store](https://chrome.google.com/webstore/detail/chatgpt-chat-log-export/). Source code for Chrome is included in the repository for those who wish to build it directly.

---

### Firefox Add-ons

Download the Firefox version from the [Firefox Add-ons store](https://addons.mozilla.org/ja/firefox/addon/chatgpt-chat-log-export/). Source code for Firefox is also included in the repository.

---

## Using the Extension

While in an active ChatGPT session, click the extension icon (![download icon](./icons/download-icon.svg)) to export the conversation in JSON format. This unprocessed JSON file will contain chat text, timestamps, and other metadata—ideal for analysis, transformation, or archiving.

---

## Support

If you find this extension helpful, consider supporting my work on [Patreon](https://patreon.com/unixwzrd) or [Ko-fi](https://ko-fi.com/unixwzrd). My goal with this project and others is to bring awareness to issues like parental alienation and to advocate for a child’s right to have both parents involved in their lives.

Visit [Distributed Thinking Systems LLC](https://unixwzrd.ai/) for information about my other projects.

---

## Credits

Thanks to [Deskuma](https://github.com/Deskuma) for the original codebase used in the Firefox and Chrome extensions, which inspired this project.