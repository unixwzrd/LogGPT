# Changelog

## 2026/11/18 v1.3.5

- Download artifact bundles as ZIP-based `.lgpt` files with MIME type `application/vnd.loggpt.archive`, ready for Extract Chat's registered Finder document type, LogGPT Plus file for Extract Chat. Standalone JSON downloads remain `.json`; the contained JSON, artifact bytes, manifest and archive layout are unchanged.
- Give the Dots download button a direct slot in the marked header action strip rather than nesting it inside a label-dependent menu. Retain bounded repair after header replacement and the earlier menu-label fallback.
- Add Download current conversation to the toolbar popup for Basic and Plus. Route it to the active tab's existing content script, sharing export options, entitlement checks, progress and cancellation without requiring an injected page button. Report busy, unsupported and stale-page states instead of silently doing nothing; no extra permissions or script reinjection are requested.
- Restore the Dots download button after the title-bar menu changed from `Chat actions` to `Your dot actions`. Support both labels within the visible conversation header, without matching sidebar menus or hidden retained headers.
- Add regression coverage for the updated Dots menu label and retain the existing Dots capture, ChatGPT/Work export, options and entitlement checks. A replacement real Dots archive is still required for Extract Chat acceptance.
- Refine the toolbar popup width and spacing so the Plus settings and reset explanation fit within the browser's popup height limit without shrinking text or hiding controls.
- Advance app and extension versions to 1.3.5, build 16, for App Store submission.

## 2026/11/17 v1.3.4

- Postfix JSON and ZIP export names with `-dot`, `-work`, or `-chat` based on recognized native source markers, including matching JSON and artifact directory names inside ZIPs. Missing or unknown ChatGPT origin markers retain the existing filename rather than guessing from the title or model name.
- Always append the detected origin after the complete title, even if the title already ends in the same word (for example, `-work-work`).
- Add Dots main-timeline JSON exports and optional Plus artifact ZIPs, with the download control immediately before the Dot's conversation actions menu.
- Capture paginated room history with progress, cancellation, sender attribution from room membership, and guards against incomplete or repeating pagination.
- Preserve native Dots records in a versioned `loggpt.dots` envelope. Linked task histories and nested reply histories are explicitly excluded.
- Separate source-specific capture from the shared export UI and ZIP pipeline; retain the existing ChatGPT and ChatGPT Work JSON payloads.
- Validate all extension manifest variants and their script dependencies to catch invalid JSON and loading-order errors before packaging.
- Advance the app and extension versions to 1.3.4, build 15, for App Store submission.

## 2026/11/16 v1.3.3

- Protect checkboxes in the Plus export dialog and Basic upgrade notice from host-page CSS resets so native controls remain visible and usable.

## 2026/10/03 v1.3.2

- Fixed a button-reconciliation race condition that could freeze Safari and Web Inspector when switching ChatGPT conversations.
- Restored download button injection during conversation navigation without requiring a page reload.
- Ignored hidden conversation headers and prevented the download button from selecting itself as its insertion anchor.
- Coalesced page mutation handling to one reconciliation per animation frame and added a bounded navigation check for view changes without DOM mutations.
- Added regression coverage for transitional and retained conversation headers and coalesced reconciliation.

## 2026/10/01 v1.3.1

- Restored the injected download button after ChatGPT changed its conversation title-bar structure.
- Positioned the button directly before Share in the current ChatGPT action group while retaining compatibility with earlier layouts.
- Improved button reconciliation when ChatGPT replaces the visible title bar during in-page navigation.

## 2026/09/14 v1.3.0

- Added ChatGPT Work artifact discovery for generated image pointers and generated files linked from Work sandbox storage.

## 2026/09/13 v1.2.1

- Added immediate feedback while LogGPT collects conversation information.
- Added total, generated, and uploaded artifact counts to the Plus export choices.
- Added artifact collection and ZIP creation progress, including the current filename and unavailable artifact count.
- Added cancellation for conversation retrieval, artifact collection, and ZIP creation without producing partial downloads.
- Kept progress visible when saved Plus preferences skip the artifact selection dialog.
- Prevented duplicate exports while a download is already being prepared.

## 2026/08/18 v1.2.0

- Added an optional one-time LogGPT Plus upgrade through Apple StoreKit.
- Added portable ZIP archives containing conversation JSON, generated content, uploaded content, and an artifact manifest.
- Added artifact download preferences, generated/uploaded content controls, per-download choices, and Reset to Defaults.
- Added partial-success archives that preserve successful downloads and report unavailable artifacts instead of discarding the export.
- Improved artifact discovery, filename handling, Basic/Plus status messaging, extension settings navigation, and icon updates.
- Preserved the privacy-first design with no accounts, analytics, telemetry, or purchase server.

## 2025/06/22  v1.0.6

- **FIXED**: Button persistence issue when page refreshes or DOM changes
- **REFACTORED**: Separated button creation from event handler logic for better performance
- Moved download button handler to dedicated function to avoid recreation on each injection
- Simplified button injection function to focus solely on DOM manipulation
- Button now persists through ChatGPT's dynamic UI updates and page refreshes

## 2025/05/15  v1.0.5

- Changed to new icons
- Changed spacing on the ChatGPT UI Download button, was covering "Canvas" button.
- Button icon now dynamically positions itself to the left of the standard OpenAI Web UI interface elements like Canvas, Share, "Stacked Dots" for archive/delete, and User Settings.
- Icon/button will change position based on the OpenAI Web UI elements.

## 2025/03/19  v1.0.4

- Changed to new icons
- Changed the name of the extension because Apple didn't like it.
- Changed references in the source code to the new name.
- Added UTF-8 support as default
- Change to the Safari API handled.
- Updated documentation.

## 2025-03-10 v1.0.2

- Prepared more screenshots for AppStore submission
- Updated documentation
- Minor changes in configuration
- Submitted and rejected by Apple AppStore

## 2025-01-06 V1.0.1

- Made screenshots for uploading tto the Apple AppStore
- Tidied up settings
- Waited until March to be able to submit as paper work being processed.

## 2024-11-04 v1.0.0

- Ported and added code to support Safari

2024/20/28  v0.3.2

- Created Xcode

2024/10/12  v0.3.1

- With the release of Canvas, the icons have been moved to the top to avoid overlapping. Please check the position of the icons, which has been changed from the bottom to the top.

2024-05-07  v0.3.0

- upgrade: Correspondence by changing the domain name. `chat.openai.com` to `chatgpt.com`

2023-04-23  v0.2.1

- fix: WebUI update. Fixed due to specification change. add: icons.

2023-04-06  v0.2.0

- FireFox/Google Chrome support ver.

2023-04-06  v0.1.1

- typo fix.

2023-04-06  v0.1.0

- 1st Release. FireFox support only ver.
