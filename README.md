# ChatGPT: Chat Log Export Downloader

It appears the security policy changes with Apple and I have managed to get teh app submitted to the App Store. There are also no time restrictions on having to reset the Allow Unsigned extensions anymore, though I could be wrong, in fact it seems to install and stay installed and function now without having to allow for unsigned extensions. I have not been able to try this out, but am adding a signed binary compile using my valid Apple Developer Certificate to the repo.

## Table of Contents

- [ChatGPT: Chat Log Export Downloader](#chatgpt-chat-log-export-downloader)
  - [Table of Contents](#table-of-contents)
  - [Project Update](#project-update)
  - [Build It Yourself](#build-it-yourself)
    - [If You Build It Yourself](#if-you-build-it-yourself)
- [ChatGPT: Chat Log Export Downloader](#chatgpt-chat-log-export-downloader-1)
    - [Export and preserve your ChatGPT conversation logs easily](#export-and-preserve-your-chatgpt-conversation-logs-easily)
  - [Features](#features)
  - [Browser Versions and Installation](#browser-versions-and-installation)
    - [Safari Extensions](#safari-extensions)
    - [Chrome Extensions](#chrome-extensions)
    - [Firefox Add-ons](#firefox-add-ons)
  - [Using the Extension](#using-the-extension)
  - [Support](#support)
  - [Credits](#credits)
  
## Project Update

This project is a utility designed to make exporting ChatGPT conversation history in JSON format simple and efficient. It’s a straightforward tool that I hoped to share freely for anyone to use and improve upon, while also showcasing my work to potential employers or clients.

The downloadable package is here: [ChatGPT Export JSON Chatlogs.pkg](https://github.com/unixwzrd/chatgpt-chatlog-export/releases/tag/local-build-1.0.1)

II have just built it and uploaded it to the Apple App store and would prefer you purchase a copy there as it will help me offset the Apple Developer Tax.

## Build It Yourself

[The Xcode project file is here.](https://github.com/unixwzrd/chatgpt-chatlog-export/tree/main/ChatGPT%20Export%20JSON%20Chatlogs) Clone the repository and try
  ```bash
  git clone https://github.com/unixwzrd/chatgpt-chatlog-export.git chatgpt-jason
  cd chatgpt-jason
  xcodebuild build -project 'ChatGPT-Export-Chatlog-JSON.xcodeproj'
  ```
### If You Build It Yourself

  You will likely need to check the "Allow Unsigned Extensions" checkbox in Safari to run, unless you can sign it yourself.  I have uploaded a signed version, it is a package and would appreciate it if someone could test it out. SO this step should no longer ne necessary and you will have to do is download teh .pkg file and install it.

  Again, I would appreciate it if you could buy one on the App Store or if you are feeling generous, buy me a coffee.

  ![Screenshot of Safari Extension menu item and downloaded JSON file](graphics/Screenshot%202024-11-06%20at%2012.46.30.png)

# ChatGPT: Chat Log Export Downloader

### Export and preserve your ChatGPT conversation logs easily

This extension allows users to download complete conversation logs from OpenAI’s ChatGPT in JSON format, capturing session details for use in documentation, analysis, and content creation.

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

1. Open a ChatGPT session and click the extension icon ![download icon](./icons/download-icon.svg) browser window of your ChatGPT session. It will only be visible in ChatGPT. The Tool bar ICon wil show up when teh extension is loaded, but is not active at this time.
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