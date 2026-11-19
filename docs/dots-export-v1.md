# Dots export contract, version 1

Dots uses a messaging-room protocol, not the ordinary ChatGPT conversation endpoint. `conversation-sources.js` selects a source adapter by URL; conversation retrieval, media discovery, progress, cancellation, and ZIP creation share the existing export pipeline.

The download control owns a direct slot at the beginning of the marked header action strip within the visible `app-shell-header-context-menu-surface`, avoiding dependency on a replaceable menu subtree or its label. If the strip marker is absent, the current menu label `Your dot actions` and earlier `Chat actions` remain supported. Discovery stays scoped to that surface because sidebar rows also use `Chat actions`. Hidden/retained headers are skipped; no arbitrary sidebar or page button is used as a substitute. Coalesced mutation handling and the bounded navigation check restore the control after header replacement, without reinsertion on every observer pass.

The extension toolbar popup also exposes Download current conversation in Basic and Plus. It sends a one-shot message to the active tab's top-frame content script and closes only after that script accepts the request. The existing exporter starts without needing a header button; entitlement, preferences, progress, cancellation and the single-export lock remain shared. Unsupported routes, busy exports and missing/stale content scripts leave a visible message in the popup. This fallback tolerates broken DOM placement, not a disabled extension or revoked site access; reload after updating/enabling the extension. It does not inject additional scripts or request broader permissions.

Local validation on November 18: all four Node suites pass. An isolated browser harness checked a renamed menu, button removal, full header replacement, single-button repair, and toolbar-to-content messaging with the header completely absent. The request opened the existing export progress dialog; a second request reported busy, cancellation removed the dialog, and an unsupported route left a visible popup message. This used mocked extension APIs/network data, not a fresh live Dots export. Debug builds of both LogGPT and LogGPT Plus passed, their embedded scripts matched the working sources, and both app signatures verified. A fresh user-exported Dots ZIP and live Safari checks after running/reloading the updated extension remain required for end-to-end acceptance. No version change, commit, publication or submission is implied.

## Scope and provenance

The `loggpt.dots` envelope contains `format_version: 1`, title and timestamps, a room-based `conversation_id`, Dot identity, room membership, and the original message records in chronological order. `source.scope` is `main_timeline`; `source.history_complete` means pagination reached the end of that timeline, not that every linked task or nested reply history was retrieved. `source.excluded` explicitly lists those exclusions. Widget and task references remain in the native records; embedded widget content is not separately downloaded as an artifact in this version.

Native message `role` is not reliable evidence of human versus Dot authorship. Media classification and Extract Chat rendering use `account_user_id` against room membership, where `aeon_id` identifies the Dot. Unknown senders stop capture rather than silently misattribute messages. Native records are not rewritten.

The loader requests 32 messages per page, following `prev_cursor` or the first message ID when that cursor is absent. It deduplicates overlapping pages and requires an empty terminal page. Repeated cursors, non-progress, invalid records, request failures, and the pagination safety limit stop the export without producing a misleading partial archive.

## Artifacts

Dots export filenames end in `-dot` before `.json` or `.lgpt`, for example `2026-10-01-2026-11-16-mia-fourier-dot.lgpt`. Artifact bundles use MIME type `application/vnd.loggpt.archive` but remain standard ZIP containers; legacy `.zip` exports still work in Extract Chat. Its custom document type is `ai.unixwzrd.loggpt.archive`, described as LogGPT Plus file for Extract Chat. The contained JSON, artifact directory, and manifest references use the same stem. The suffix is selected from the captured envelope, not the current page URL. Paired ChatGPT/Work samples show a native `conversation_origin` of null for ChatGPT (`-chat`) and `"tpp"` for Work (`-work`). These recognized values drive naming; missing or unknown markers leave the old filename unchanged. Titles and model names are not classifiers. Ordinary ChatGPT/Work JSON is not rewritten to add an origin marker. Consumers should detect source formats from the JSON rather than relying on filenames.

The detected origin is always appended after the complete sanitized title, even when the title already ends in the same word. For example, a Work conversation titled “Artifact test for ChatGPT Work” ends in `-chatgpt-work-work`; titles ending in “Dot” or “Chat” likewise produce `-dot-dot` or `-chat-chat`. The final postfix is source metadata, not part of the title.

Direct file attachments are classified by sender and use the room's file-descriptor endpoint to refresh expiring download URLs. The existing artifact manifest and ZIP layout are unchanged. Deleted messages do not contribute artifact downloads. Dots JSON remains useful without Plus; artifact retrieval is still gated by the existing Plus entitlement.

## Extending formats

LogGPT source adapters provide URL matching and capture, returning either the unchanged ChatGPT payload or a versioned source envelope. A temporary media projection lets a new source reuse artifact discovery without adding a fabricated ChatGPT tree to the saved JSON.

Extract Chat has a separate source-adapter registry, with format detection, validation, normalization, and diagnostics before its common rendering and chunking pipeline. It derives a chronological mapping for Dots and labels that mapping as derived, not a native branch tree. A future Hermes adapter should be based on representative native fixtures; Hermes support is not implemented by this change.

## Follow-up work

- [ ] Review more resilient in-page button anchoring across ChatGPT, Work, and Dots, including stable structural anchors and an extension-owned container where useful. Keep the button at the beginning of the header action group, retain the toolbar download fallback, and cover header replacement/navigation with DOM regression fixtures. This is deferred hardening, not a change to the current placement.
