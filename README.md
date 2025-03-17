# LogGPT

It appears the security policy changes with Apple and I have managed to get teh app submitted to the App Store. There are also no time restrictions on having to reset the Allow Unsigned extensions anymore, though I could be wrong, in fact it seems to install and stay installed and function now without having to allow for unsigned extensions. I have not been able to try this out, but am adding a signed binary compile using my valid Apple Developer Certificate to the repo.

![LogGPT Icon](./icons/LogGPT.png)

## Table of Contents

- [LogGPT](#loggpt)
  - [Table of Contents](#table-of-contents)
  - [Project Update](#project-update)
  - [Export and preserve your ChatGPT conversation logs easily](#export-and-preserve-your-chatgpt-conversation-logs-easily)
  - [Features](#features)
  - [Safari Extension](#safari-extension)
    - [Why Use It?](#why-use-it)
  - [Manual Installation for Safari](#manual-installation-for-safari)
    - [Using the Extension](#using-the-extension)
    - [Uninstalling the Extension](#uninstalling-the-extension)
  - [Build It Yourself](#build-it-yourself)
    - [If You Build It Yourself](#if-you-build-it-yourself)
  - [Support](#support)
  - [Credits](#credits)
  
## Project Update

This project is a utility designed to make exporting ChatGPT conversation history in JSON format simple and efficient. It’s a straightforward tool that I hoped to share freely for anyone to use and improve upon, while also showcasing my work to potential employers or clients. The extension has been submitted to Apple fro review and after being rejected last week because it looked too much like ChatGPT and a ew other reasons, I have changed the Application Icons and a few other things to make help it pass teh App Store review process.


## Export and preserve your ChatGPT conversation logs easily

This extension allows users to download complete conversation logs from OpenAI’s ChatGPT in JSON format, capturing session details for use in documentation, analysis, and content creation.

## Features

- Full conversation export to JSON format
- Supports cross-browser compatibility for Safari, Chrome, and Firefox
- Preserves chat logs for documentation, import, and analysis
- Prioritizes user privacy: **no tracking or data collection**

## Safari Extension

There are three way to get this extension:

1. Buy it on the App Store. *preferred* or if you install it manually, please consider [supporting](#support) my work.
1. Download the LogGPT.pkg.zip file and install it manually.
1. Download the LogGPT repository and build it yourself.

Obviously the best way is to buy it on the App Store, which I would prefer as a lot of effort went into this very simple extension. But if you want to build it yourself, you can do that too.

### Why Use It?

- Summarize and analyze past chat sessions
- Archive and convert conversations into formats like Markdown and HTML
- Easily transfer conversations to a new ChatGPT instance for continuity

A version may be added to the Apple App Store, with a small fee to cover Apple Developer Program costs. The binaries provided are signed with an Apple Developer Certificate for added security.

## Manual Installation for Safari

The downloadable package is here: [LogGPT.pkg](https://github.com/unixwzrd/chatgpt-chatlog-export/releases/tag/local-build-1.0.1)

1. Download `LogGPT.pkg.zip`
2. Extract the folder and run the `LogGPT.pkg`
3. Enable the extension in **Safari** -> **Settings** -> **Extensions**.
4. The extension icon should appear in the Safari toolbar, and it's ready to use.

### Using the Extension

1. Open a ChatGPT session and click the extension icon ![download icon](./icons/download-icon.svg) browser window of your ChatGPT session. It will only be visible in ChatGPT. The Tool bar ICon wil show up when teh extension is loaded, but is not active at this time.
1. Simply press the icon in the upper right of your CharGPT session in Safari.
  The session will download in JSON format to your `Downloads` folder.

- While the extension is active, the icon in the Menu Bar will be "on" and when inactive it will be greyed out.

  ![Screenshot of Safari Extension](./graphics/Screenshot%202025-03-17%20at%2008.00.57.png)

### Uninstalling the Extension

1. Open **Safari** -> **Settings** -> **Extensions**.
2. Select the `LogGPT` extension and click **Uninstall**.
3. Follow the instructions for removing the extension from your system.

## Build It Yourself

You will need a copy of Xcode, you can get it and this extension on the App Store.

[The Xcode project file is here.](https://github.com/unixwzrd/chatgpt-chatlog-export/tree/main/ChatGPT%20Export%20JSON%20Chatlogs) Clone the repository and try
  ```bash
  git clone https://github.com/unixwzrd/chatgpt-chatlog-export.git chatgpt-jason
  cd chatgpt-jason
  xcodebuild build -project 'LogGPT.xcodeproj'
  ```
### If You Build It Yourself

You will likely need to check the "Allow Unsigned Extensions" checkbox in Safari to run, unless you can sign it yourself.  I have uploaded a signed version, it is a package and would appreciate it if someone could test it out. SO this step should no longer ne necessary and you will have to do is download teh .pkg file and install it.

Again, I would appreciate it if you could buy one on the App Store or if you are feeling generous, buy me a coffee.

  ![Screenshot of Safari Extension menu item and downloaded JSON file](graphics/Screenshot%202024-11-06%20at%2012.46.30.png)

## Support

If you find this extension helpful, consider supporting my work on [Patreon](https://patreon.com/unixwzrd) or [Ko-fi](https://ko-fi.com/unixwzrd). My goal with this project and others is to bring awareness to issues like parental alienation and to advocate for a child’s right to have both parents involved in their lives.

Visit [Distributed Thinking Systems LLC](https://unixwzrd.ai/) for information about my other projects.

## Credits

Thanks to [Deskuma](https://github.com/Deskuma) for the original codebase used in the Firefox and Chrome extensions, which inspired this project.