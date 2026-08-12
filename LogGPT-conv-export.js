// ==UserScript==
// @name         LogGPT: Chat Log Export
// @version      1.2.0
// @author       unixwzrd
// @license      MIT
// ==/UserScript==

(function() {
    const LOG_PREFIX = "[LogGPT]";
    const STORAGE_KEYS = {
        promptOnDownload: "loggpt.promptOnDownload",
        includeMediaByDefault: "loggpt.includeMediaByDefault",
        includeGenerated: "loggpt.includeGenerated",
        includeUploaded: "loggpt.includeUploaded",
    };
    const FILE_SERVICE_PREFIX = "file-service://";
    const ESTUARY_FALLBACK_PREFIX = "https://chatgpt.com/backend-api/files/";

    function clog(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function isOnChatGPT() {
        return location.hostname.endsWith("chatgpt.com");
    }

    function getThreadId() {
        const match = location.pathname.match(/c\/([\w-]+)/);
        return match ? match[1] : null;
    }

    function getManifest() {
        try {
            if (typeof browser !== "undefined" && browser.runtime?.getManifest) {
                return browser.runtime.getManifest();
            }
            if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
                return chrome.runtime.getManifest();
            }
        } catch (error) {
            clog("Unable to inspect manifest", error);
        }
        return {};
    }

    function getProductConfig() {
        const manifest = getManifest();
        const name = String(manifest.name || "LogGPT");
        const isPlus = /\bplus\b/i.test(name);
        return {
            manifest,
            isPlus,
            productName: name,
            enableMediaExport: isPlus,
            settingsLabel: isPlus ? "LogGPT Plus" : "LogGPT",
        };
    }

    function getRuntime() {
        if (typeof browser !== "undefined" && browser.runtime) return browser.runtime;
        if (typeof chrome !== "undefined" && chrome.runtime) return chrome.runtime;
        return null;
    }

    async function hasPlusEntitlement() {
        const config = getProductConfig();
        if (config.isPlus) return true;
        const runtime = getRuntime();
        if (!runtime?.sendMessage) return false;
        try {
            const response = await runtime.sendMessage({ type: "loggpt.getPlusEntitlement" });
            return response?.hasPlus === true;
        } catch (error) {
            clog("Unable to verify Plus entitlement; using Basic export", error);
            return false;
        }
    }

    function getStorageArea() {
        try {
            if (typeof browser !== "undefined" && browser.storage?.local) {
                return browser.storage.local;
            }
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
                return chrome.storage.local;
            }
        } catch (error) {
            clog("Extension storage unavailable, falling back to localStorage", error);
        }
        return null;
    }

    async function getStoredPreferences() {
        const defaults = {
            promptOnDownload: false,
            includeMediaByDefault: true,
            includeGenerated: true,
            includeUploaded: true,
        };
        const storage = getStorageArea();
        if (!storage) {
            return {
                promptOnDownload: window.localStorage.getItem(STORAGE_KEYS.promptOnDownload) !== "false",
                includeMediaByDefault: window.localStorage.getItem(STORAGE_KEYS.includeMediaByDefault) !== "false",
                includeGenerated: window.localStorage.getItem(STORAGE_KEYS.includeGenerated) !== "false",
                includeUploaded: window.localStorage.getItem(STORAGE_KEYS.includeUploaded) !== "false",
            };
        }

        const values = await storage.get(Object.values(STORAGE_KEYS));
        return {
            promptOnDownload: values[STORAGE_KEYS.promptOnDownload] !== false,
            includeMediaByDefault: values[STORAGE_KEYS.includeMediaByDefault] !== false,
            includeGenerated: values[STORAGE_KEYS.includeGenerated] !== false,
            includeUploaded: values[STORAGE_KEYS.includeUploaded] !== false,
        };
    }

    async function setStoredPreferences(preferences) {
        const storage = getStorageArea();
        if (!storage) {
            window.localStorage.setItem(STORAGE_KEYS.promptOnDownload, String(preferences.promptOnDownload));
            window.localStorage.setItem(STORAGE_KEYS.includeMediaByDefault, String(preferences.includeMediaByDefault));
            window.localStorage.setItem(STORAGE_KEYS.includeGenerated, String(preferences.includeGenerated));
            window.localStorage.setItem(STORAGE_KEYS.includeUploaded, String(preferences.includeUploaded));
            return;
        }

        await storage.set({
            [STORAGE_KEYS.promptOnDownload]: preferences.promptOnDownload,
            [STORAGE_KEYS.includeMediaByDefault]: preferences.includeMediaByDefault,
            [STORAGE_KEYS.includeGenerated]: preferences.includeGenerated,
            [STORAGE_KEYS.includeUploaded]: preferences.includeUploaded,
        });
    }

    function sanitizeFilename(name) {
        return String(name || "")
            .replace(/[\/\\?%*:|"<>]/g, "-")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^-+|-+$/g, "")
            .slice(0, 180);
    }

    function buildExportStem(threadId, conversation) {
        const startTimestamp = Number(conversation?.create_time || 0);
        const endTimestamp = Number(conversation?.update_time || startTimestamp);
        const start = startTimestamp ? new Date(startTimestamp * 1000).toISOString().slice(0, 10) : "unknown-date";
        const end = endTimestamp ? new Date(endTimestamp * 1000).toISOString().slice(0, 10) : start;
        const title = sanitizeFilename(conversation?.title || `chatgpt-convo-${threadId}`).replace(/[-_]+/g, "-").toLowerCase();
        return `${start}--${end}--${title || `chatgpt-convo-${threadId}`}`;
    }

    function triggerDownload(blob, downloadName) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = downloadName;
        document.body.appendChild(anchor);
        anchor.click();
        window.setTimeout(() => {
            anchor.remove();
            URL.revokeObjectURL(url);
        }, 100);
    }

    function downloadJSON(stem, obj) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
        triggerDownload(blob, `${stem}.json`);
        clog("Downloaded conversation JSON", stem);
    }

    async function getAccessToken() {
        const response = await fetch("https://chatgpt.com/api/auth/session", { credentials: "include" });
        if (!response.ok) {
            throw new Error("Failed to get access token");
        }
        const payload = await response.json();
        return payload.accessToken;
    }

    async function getConversation(threadId) {
        const token = await getAccessToken();
        const response = await fetch(`https://chatgpt.com/backend-api/conversation/${threadId}`, {
            credentials: "include",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch conversation: ${response.status}`);
        }
        return { token, conversation: await response.json() };
    }

    function normalizeMediaIdentifier(value) {
        if (!value) {
            return null;
        }
        if (Array.isArray(value)) {
            for (const entry of value) {
                const normalized = normalizeMediaIdentifier(entry);
                if (normalized) {
                    return normalized;
                }
            }
            return null;
        }
        const text = String(value).trim();
        if (!text) {
            return null;
        }
        if (text.startsWith(FILE_SERVICE_PREFIX)) {
            return text.slice(FILE_SERVICE_PREFIX.length);
        }
        if (text.startsWith("http://") || text.startsWith("https://")) {
            try {
                const parsed = new URL(text);
                const queryId = parsed.searchParams.get("id");
                if (queryId) {
                    return queryId;
                }
            } catch (_error) {
                return null;
            }
        }
        if (text.startsWith("file-") || text.startsWith("file_")) {
            return text;
        }
        return null;
    }

    function inferExtension(entry) {
        const sourceValues = [
            entry.originalFilename,
            entry.mimeType,
            entry.sourceUrl,
        ].filter(Boolean);
        for (const value of sourceValues) {
            const text = String(value);
            const filenameMatch = text.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
            if (filenameMatch) {
                return `.${filenameMatch[1].toLowerCase()}`;
            }
            if (text.includes("image/png")) {
                return ".png";
            }
            if (text.includes("image/jpeg")) {
                return ".jpg";
            }
            if (text.includes("image/webp")) {
                return ".webp";
            }
            if (text.includes("audio/mpeg")) {
                return ".mp3";
            }
            if (text.includes("audio/wav")) {
                return ".wav";
            }
            if (text.includes("application/pdf")) {
                return ".pdf";
            }
        }
        return "";
    }

    function iterMediaCandidates(value, callback) {
        if (!value) {
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                iterMediaCandidates(item, callback);
            }
            return;
        }
        if (typeof value !== "object") {
            return;
        }

        callback(value);
        for (const child of Object.values(value)) {
            iterMediaCandidates(child, callback);
        }
    }

    function scanConversationMedia(conversation) {
        const mapping = conversation?.mapping || {};
        const byId = new Map();
        const byUrl = new Map();

        function getOrCreateEntry(seed) {
            const key = seed.canonicalId || seed.sourceUrl || `${seed.turnId || "unknown"}:${seed.messageId || "unknown"}:${seed.originalFilename || "asset"}`;
            const existing = byId.get(key) || byUrl.get(seed.sourceUrl || "");
            if (existing) {
                const wasUploaded = existing.origin === "uploaded";
                Object.assign(existing, Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined && value !== null && value !== "")));
                if (wasUploaded || seed.origin === "uploaded") {
                    existing.origin = "uploaded";
                }
                return existing;
            }
            const next = {
                canonicalId: seed.canonicalId || null,
                assetPointer: seed.assetPointer || null,
                sourceUrl: seed.sourceUrl || null,
                originalFilename: seed.originalFilename || null,
                mimeType: seed.mimeType || null,
                width: seed.width || null,
                height: seed.height || null,
                size: seed.size || null,
                turnId: seed.turnId || null,
                messageId: seed.messageId || null,
                role: seed.role || null,
                contentType: seed.contentType || null,
                origin: seed.origin || "unclassified",
                downloadStatus: "pending",
            };
            byId.set(key, next);
            if (next.sourceUrl) {
                byUrl.set(next.sourceUrl, next);
            }
            return next;
        }

        for (const [turnId, turn] of Object.entries(mapping)) {
            const message = turn?.message;
            if (!message) {
                continue;
            }
            const role = message?.author?.role || null;
            const contentType = message?.content?.content_type || null;
            const metadata = message?.metadata || {};
            const attachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];

            for (const attachment of attachments) {
                if (!attachment || typeof attachment !== "object") {
                    continue;
                }
                getOrCreateEntry({
                    canonicalId: normalizeMediaIdentifier(attachment.id || attachment.file_id),
                    assetPointer: attachment.asset_pointer || null,
                    sourceUrl: attachment.url || attachment.download_url || attachment.content_url || null,
                    originalFilename: attachment.name || attachment.filename || null,
                    mimeType: attachment.mime_type || attachment.mimeType || null,
                    width: attachment.width || null,
                    height: attachment.height || null,
                    size: attachment.size || null,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType,
                    origin: "uploaded",
                });
            }

            iterMediaCandidates(message, candidate => {
                const sourceUrl = candidate.url || candidate.content_url || candidate.download_url || candidate.image_url || candidate.thumbnail_url || null;
                const canonicalId = normalizeMediaIdentifier(
                    candidate.file_id ||
                    candidate.asset_pointer ||
                    candidate.audio_asset_pointer ||
                    sourceUrl
                );
                if (!canonicalId && !sourceUrl) {
                    return;
                }
                getOrCreateEntry({
                    canonicalId,
                    assetPointer: candidate.asset_pointer || candidate.audio_asset_pointer || null,
                    sourceUrl,
                    originalFilename: candidate.filename || candidate.name || null,
                    mimeType: candidate.mime_type || candidate.mimeType || null,
                    width: candidate.width || null,
                    height: candidate.height || null,
                    size: candidate.size || null,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType,
                    origin: role === "user"
                        ? "uploaded"
                        : (/dalle|imagegen|ada|execution_output|tool/i.test(`${contentType} ${JSON.stringify(candidate)}`) ? "generated" : "unclassified"),
                });
            });
        }

        return Array.from(byId.values()).map(entry => {
            const extension = inferExtension(entry);
            return {
                ...entry,
                savedFilename: `${sanitizeFilename(entry.canonicalId || entry.originalFilename || "attachment")}${extension}`,
            };
        });
    }

    async function fetchMediaEntry(entry, token) {
        const urls = [];
        if (entry.sourceUrl) {
            urls.push(entry.sourceUrl);
        }
        if (entry.canonicalId) {
            urls.push(`${ESTUARY_FALLBACK_PREFIX}${entry.canonicalId}/download`);
        }

        let lastError = "No media URL available";
        for (const url of urls) {
            try {
                const resolvedUrl = new URL(url, globalThis.location?.origin || "https://chatgpt.com");
                const isChatGPTOrigin = resolvedUrl.hostname === "chatgpt.com"
                    || resolvedUrl.hostname.endsWith(".chatgpt.com");
                const response = await fetch(url, {
                    credentials: isChatGPTOrigin ? "include" : "omit",
                    headers: isChatGPTOrigin ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!response.ok) {
                    lastError = `HTTP ${response.status} for ${sanitizedSourceUrl(url)}`;
                    continue;
                }
                const blob = await response.blob();
                return {
                    ...entry,
                    sourceUrl: entry.sourceUrl || url,
                    mimeType: entry.mimeType || blob.type || null,
                    size: entry.size || blob.size || null,
                    downloadStatus: "downloaded",
                    blob,
                };
            } catch (error) {
                lastError = String(error);
            }
        }

        return {
            ...entry,
            downloadStatus: "failed",
            failureReason: lastError,
            blob: null,
        };
    }

    function sanitizedSourceUrl(value) {
        if (!value) return null;
        try {
            const parsed = new URL(value);
            return `${parsed.origin}${parsed.pathname}`;
        } catch (_error) {
            return String(value).split("?")[0];
        }
    }

    async function sha256Hex(data) {
        const digest = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    }

    function textToUint8Array(text) {
        return new TextEncoder().encode(text);
    }

    function crc32(data) {
        const table = crc32.table || (crc32.table = (() => {
            const next = new Uint32Array(256);
            for (let index = 0; index < 256; index += 1) {
                let value = index;
                for (let shift = 0; shift < 8; shift += 1) {
                    value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
                }
                next[index] = value >>> 0;
            }
            return next;
        })());

        let crc = 0xFFFFFFFF;
        for (const byte of data) {
            crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function dosDateParts(date) {
        const value = date instanceof Date ? date : new Date();
        const year = Math.max(1980, value.getFullYear());
        const month = value.getMonth() + 1;
        const day = value.getDate();
        const hours = value.getHours();
        const minutes = value.getMinutes();
        const seconds = Math.floor(value.getSeconds() / 2);
        return {
            time: (hours << 11) | (minutes << 5) | seconds,
            date: ((year - 1980) << 9) | (month << 5) | day,
        };
    }

    function createHeader(length) {
        return new Uint8Array(length);
    }

    function setUint16(view, offset, value) {
        view.setUint16(offset, value, true);
    }

    function setUint32(view, offset, value) {
        view.setUint32(offset, value >>> 0, true);
    }

    async function buildZipBlob(files) {
        const locals = [];
        const centrals = [];
        let offset = 0;
        let centralSize = 0;

        for (const file of files) {
            const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
            const nameBytes = textToUint8Array(file.path);
            const { time, date } = dosDateParts(file.modifiedAt);
            const checksum = crc32(data);

            const local = createHeader(30 + nameBytes.length);
            const localView = new DataView(local.buffer);
            setUint32(localView, 0, 0x04034B50);
            setUint16(localView, 4, 20);
            setUint16(localView, 6, 0);
            setUint16(localView, 8, 0);
            setUint16(localView, 10, time);
            setUint16(localView, 12, date);
            setUint32(localView, 14, checksum);
            setUint32(localView, 18, data.length);
            setUint32(localView, 22, data.length);
            setUint16(localView, 26, nameBytes.length);
            setUint16(localView, 28, 0);
            local.set(nameBytes, 30);
            locals.push(local, data);

            const central = createHeader(46 + nameBytes.length);
            const centralView = new DataView(central.buffer);
            setUint32(centralView, 0, 0x02014B50);
            setUint16(centralView, 4, 20);
            setUint16(centralView, 6, 20);
            setUint16(centralView, 8, 0);
            setUint16(centralView, 10, 0);
            setUint16(centralView, 12, time);
            setUint16(centralView, 14, date);
            setUint32(centralView, 16, checksum);
            setUint32(centralView, 20, data.length);
            setUint32(centralView, 24, data.length);
            setUint16(centralView, 28, nameBytes.length);
            setUint16(centralView, 30, 0);
            setUint16(centralView, 32, 0);
            setUint16(centralView, 34, 0);
            setUint16(centralView, 36, 0);
            setUint32(centralView, 38, 0);
            setUint32(centralView, 42, offset);
            central.set(nameBytes, 46);
            centrals.push(central);

            offset += local.length + data.length;
            centralSize += central.length;
        }

        const end = createHeader(22);
        const endView = new DataView(end.buffer);
        setUint32(endView, 0, 0x06054B50);
        setUint16(endView, 4, 0);
        setUint16(endView, 6, 0);
        setUint16(endView, 8, files.length);
        setUint16(endView, 10, files.length);
        setUint32(endView, 12, centralSize);
        setUint32(endView, 16, offset);
        setUint16(endView, 20, 0);

        return new Blob([...locals, ...centrals, end], { type: "application/zip" });
    }

    async function buildArchiveZipBlob(stem, conversation, mediaEntries, token, preferences) {
        const downloaded = [];
        const manifestItems = [];
        const usedNames = new Set();

        for (const entry of mediaEntries) {
            const selected = entry.origin === "uploaded"
                ? preferences.includeUploaded
                : preferences.includeGenerated;
            if (!selected) {
                manifestItems.push({
                    canonical_id: entry.canonicalId,
                    origin: entry.origin,
                    download_status: "skipped_by_user",
                });
                continue;
            }
            const result = await fetchMediaEntry(entry, token);
            let savedFilename = sanitizeFilename(
                result.savedFilename
                || `${result.canonicalId || result.originalFilename || "attachment"}${inferExtension(result)}`
            );
            const extension = inferExtension(result);
            const baseName = extension && savedFilename.endsWith(extension) ? savedFilename.slice(0, -extension.length) : savedFilename;
            let suffix = 2;
            while (usedNames.has(`${result.origin}/${savedFilename}`)) {
                savedFilename = `${baseName}-${suffix}${extension}`;
                suffix += 1;
            }
            usedNames.add(`${result.origin}/${savedFilename}`);
            const category = ["generated", "uploaded"].includes(result.origin) ? result.origin : "derived";
            const relativePath = `${stem}/artifacts/${category}/${savedFilename}`;
            let bytes = null;
            let hash = null;
            if (result.downloadStatus === "downloaded" && result.blob) {
                bytes = new Uint8Array(await result.blob.arrayBuffer());
                hash = await sha256Hex(bytes);
            }
            manifestItems.push({
                canonical_id: result.canonicalId,
                asset_pointer: result.assetPointer,
                source_url: sanitizedSourceUrl(result.sourceUrl),
                original_filename: result.originalFilename,
                saved_filename: savedFilename,
                relative_path: relativePath,
                origin: category,
                mime_type: result.mimeType,
                width: result.width,
                height: result.height,
                size: result.size,
                turn_id: result.turnId,
                message_id: result.messageId,
                role: result.role,
                content_type: result.contentType,
                download_status: result.downloadStatus,
                failure_reason: result.failureReason || null,
                sha256: hash,
            });
            if (bytes) {
                downloaded.push({
                    path: relativePath,
                    data: bytes,
                    modifiedAt: new Date(),
                });
            }
        }

        const manifest = {
            product: getProductConfig().productName,
            source_file: `${stem}.json`,
            conversation_title: conversation?.title || null,
            conversation_id: conversation?.conversation_id || null,
            exported_at: new Date().toISOString(),
            format_version: 1,
            selection: {
                generated_content: preferences.includeGenerated,
                uploaded_content: preferences.includeUploaded,
            },
            item_count: manifestItems.length,
            artifacts: manifestItems,
        };

        const zipFiles = [
            {
                path: `${stem}.json`,
                data: textToUint8Array(JSON.stringify(conversation, null, 2)),
                modifiedAt: new Date(),
            },
            {
                path: `${stem}/artifact-manifest.json`,
                data: textToUint8Array(JSON.stringify(manifest, null, 2)),
                modifiedAt: new Date(),
            },
            ...downloaded,
        ];
        return buildZipBlob(zipFiles);
    }

    function setButtonBusy(button, busy) {
        if (!button) {
            return;
        }
        button.disabled = busy;
        button.style.opacity = busy ? "0.6" : "1";
        button.style.pointerEvents = busy ? "none" : "auto";
    }

    function removeExistingDialog() {
        document.getElementById("loggpt-export-dialog-backdrop")?.remove();
    }

    async function promptForDownloadOptions() {
        removeExistingDialog();
        return new Promise(resolve => {
            const backdrop = document.createElement("div");
            backdrop.id = "loggpt-export-dialog-backdrop";
            backdrop.style.cssText = [
                "position:fixed",
                "inset:0",
                "background:rgba(0,0,0,0.45)",
                "display:flex",
                "align-items:center",
                "justify-content:center",
                "z-index:2147483647",
            ].join(";");

            const panel = document.createElement("div");
            panel.style.cssText = [
                "width:min(420px,calc(100vw - 32px))",
                "background:#fff",
                "color:#111",
                "border-radius:16px",
                "padding:20px",
                "box-shadow:0 20px 80px rgba(0,0,0,0.25)",
                "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            ].join(";");

            panel.innerHTML = `
                <div style="font-size:18px;font-weight:700;margin-bottom:8px;">LogGPT Plus Export</div>
                <div style="font-size:14px;line-height:1.5;margin-bottom:16px;">Download the conversation JSON, and optionally bundle any media that can be fetched from the current authenticated ChatGPT session.</div>
                <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;">
                    <input type="checkbox" id="loggpt-include-media" />
                    <span>Also download media</span>
                </label>
                <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;">
                    <input type="checkbox" id="loggpt-dont-ask" />
                    <span>Don't ask me again</span>
                </label>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button type="button" id="loggpt-export-cancel" style="padding:8px 14px;border-radius:10px;border:1px solid #c8c8c8;background:#fff;cursor:pointer;">Cancel</button>
                    <button type="button" id="loggpt-export-ok" style="padding:8px 14px;border-radius:10px;border:0;background:#111;color:#fff;cursor:pointer;">OK</button>
                </div>
            `;

            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);

            const includeMediaCheckbox = panel.querySelector("#loggpt-include-media");
            const dontAskCheckbox = panel.querySelector("#loggpt-dont-ask");

            panel.querySelector("#loggpt-export-cancel").addEventListener("click", () => {
                backdrop.remove();
                resolve({ cancelled: true, includeMedia: false, dontAskAgain: false });
            });
            panel.querySelector("#loggpt-export-ok").addEventListener("click", () => {
                backdrop.remove();
                resolve({
                    cancelled: false,
                    includeMedia: includeMediaCheckbox.checked,
                    dontAskAgain: dontAskCheckbox.checked,
                });
            });
            backdrop.addEventListener("click", event => {
                if (event.target === backdrop) {
                    backdrop.remove();
                    resolve({ cancelled: true, includeMedia: false, dontAskAgain: false });
                }
            });
        });
    }

    async function resolveDownloadOptions(config) {
        if (!config.enableMediaExport) {
            return { cancelled: false, includeMedia: false, includeGenerated: false, includeUploaded: false };
        }

        const preferences = await getStoredPreferences();
        if (!preferences.promptOnDownload) {
            return {
                cancelled: false,
                includeMedia: preferences.includeGenerated || preferences.includeUploaded,
                includeGenerated: preferences.includeGenerated,
                includeUploaded: preferences.includeUploaded,
            };
        }

        const decision = await promptForDownloadOptions();
        if (decision.cancelled) {
            return decision;
        }
        if (decision.dontAskAgain) {
            await setStoredPreferences({
                promptOnDownload: false,
                includeMediaByDefault: decision.includeMedia,
                includeGenerated: decision.includeMedia,
                includeUploaded: decision.includeMedia,
            });
        }
        return {
            ...decision,
            includeGenerated: decision.includeMedia,
            includeUploaded: decision.includeMedia,
        };
    }

    async function handleDownloadClick(event) {
        const button = event.currentTarget;
        const threadId = getThreadId();
        if (!threadId) {
            window.alert("No conversation detected.");
            return;
        }

        const config = getProductConfig();
        setButtonBusy(button, true);
        try {
            config.enableMediaExport = await hasPlusEntitlement();
            const decision = await resolveDownloadOptions(config);
            if (decision.cancelled) {
                return;
            }

            const { token, conversation } = await getConversation(threadId);
            const stem = buildExportStem(threadId, conversation);

            if (!decision.includeMedia) {
                downloadJSON(stem, conversation);
                return;
            }

            const mediaEntries = scanConversationMedia(conversation);
            const zipBlob = await buildArchiveZipBlob(stem, conversation, mediaEntries, token, decision);
            triggerDownload(zipBlob, `${stem}.zip`);
            clog("Downloaded conversation archive", stem, { mediaEntries: mediaEntries.length });
        } catch (error) {
            clog("Download failed", error);
            window.alert("Failed to export the conversation. Check the browser console for details.");
        } finally {
            setButtonBusy(button, false);
        }
    }

    function createDownloadButton() {
        const config = getProductConfig();
        const button = document.createElement("button");
        button.id = "loggpt-download-btn";
        button.title = "Download conversation";
        hasPlusEntitlement().then(hasPlus => {
            button.title = hasPlus
                ? "Download conversation JSON or JSON + media"
                : "Download conversation as JSON";
        });
        button.style.cssText = [
            "width:32px",
            "height:32px",
            "background:none",
            "border:none",
            "padding:0",
            "cursor:pointer",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "margin-right:8px",
            "color:inherit",
        ].join(";");

        const img = document.createElement("img");
        img.alt = "Download";
        img.style.width = "24px";
        img.style.height = "24px";
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(getIconSVG());
        button.appendChild(img);
        button.addEventListener("click", handleDownloadClick);
        return button;
    }

    function injectDownloadButton() {
        if (!isOnChatGPT()) {
            return false;
        }
        if (document.getElementById("loggpt-download-btn")) {
            return true;
        }

        const header = document.getElementById("conversation-header-actions")
            || document.querySelector("[data-testid='conversation-header-actions']")
            || document.querySelector("header")
            || document.querySelector("[role='banner']");

        if (!header) {
            return false;
        }

        header.insertBefore(createDownloadButton(), header.firstChild);
        return true;
    }

    if (globalThis.__LOGGPT_TEST_MODE__) {
        globalThis.__LOGGPT_TEST_API__ = {
            buildExportStem,
            scanConversationMedia,
            buildArchiveZipBlob,
            sanitizedSourceUrl,
            hasPlusEntitlement,
        };
        return;
    }

    if (window.ai_unixwzrd_LogGPT_instance || document.getElementById("loggpt-download-btn")) {
        clog("Already loaded and activated, returning.");
        return;
    }

    window.ai_unixwzrd_LogGPT_instance = true;
    injectDownloadButton();

    const observer = new MutationObserver(() => {
        if (!document.getElementById("loggpt-download-btn")) {
            injectDownloadButton();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
