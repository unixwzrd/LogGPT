// ==UserScript==
// @name         LogGPT: Chat Log Export
// @version      1.3.0
// @author       unixwzrd
// @license      MIT
// ==/UserScript==

(function() {
    const LOG_PREFIX = "[LogGPT]";
    const extensionState = { available: true };
    const STORAGE_KEYS = {
        promptOnDownload: "loggpt.promptOnDownload",
        includeMediaByDefault: "loggpt.includeMediaByDefault",
        includeGenerated: "loggpt.includeGenerated",
        includeUploaded: "loggpt.includeUploaded",
        basicUpgradeNoticeDismissed: "loggpt.basicUpgradeNoticeDismissed",
    };
    const FILE_SERVICE_PREFIX = "file-service://";
    const SEDIMENT_PREFIX = "sediment://";
    const ESTUARY_FALLBACK_PREFIX = "https://chatgpt.com/backend-api/files/";
    let activeExportController = null;
    const MIME_EXTENSIONS = Object.freeze({
        "application/epub+zip": ".epub",
        "application/gzip": ".gz",
        "application/json": ".json",
        "application/msword": ".doc",
        "application/octet-stream": ".bin",
        "application/pdf": ".pdf",
        "application/rtf": ".rtf",
        "application/vnd.apple.keynote": ".key",
        "application/vnd.apple.numbers": ".numbers",
        "application/vnd.apple.pages": ".pages",
        "application/vnd.ms-excel": ".xls",
        "application/vnd.ms-powerpoint": ".ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/x-7z-compressed": ".7z",
        "application/x-rar-compressed": ".rar",
        "application/zip": ".zip",
        "audio/aac": ".aac",
        "audio/flac": ".flac",
        "audio/m4a": ".m4a",
        "audio/mp4": ".m4a",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "image/avif": ".avif",
        "image/gif": ".gif",
        "image/heic": ".heic",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/svg+xml": ".svg",
        "image/tiff": ".tiff",
        "image/webp": ".webp",
        "text/csv": ".csv",
        "text/html": ".html",
        "text/markdown": ".md",
        "text/plain": ".txt",
        "text/tab-separated-values": ".tsv",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
    });

    function clog(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function createAbortError() {
        const error = new Error("Export cancelled.");
        error.name = "AbortError";
        return error;
    }

    function throwIfAborted(signal) {
        if (signal?.aborted) {
            throw createAbortError();
        }
    }

    function isAbortError(error) {
        return error?.name === "AbortError";
    }

    function yieldToMainThread() {
        if (typeof globalThis.setTimeout === "function") {
            return new Promise(resolve => globalThis.setTimeout(resolve, 0));
        }
        return Promise.resolve();
    }

    function isOnChatGPT() {
        return location.hostname === "chatgpt.com" || location.hostname.endsWith(".chatgpt.com");
    }

    function getThreadId() {
        const match = location.pathname.match(/(?:^|\/)c\/([A-Za-z0-9_-]+)(?:\/|$)/);
        return match ? match[1] : null;
    }

    function isConversationPage() {
        return isOnChatGPT() && Boolean(getThreadId());
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
        try {
            if (typeof browser !== "undefined" && browser.runtime) return browser.runtime;
            if (typeof chrome !== "undefined" && chrome.runtime) return chrome.runtime;
        } catch (error) {
            extensionState.available = false;
            clog("Extension context is no longer available", error);
        }
        return null;
    }

    async function getPlusEntitlement() {
        const config = getProductConfig();
        if (config.isPlus) return { hasPlus: true, source: "plus-build", displayPrice: null };
        const runtime = getRuntime();
        if (!runtime?.sendMessage) {
            extensionState.available = false;
            return { hasPlus: false, source: "unavailable", displayPrice: null };
        }
        try {
            const response = await runtime.sendMessage({ type: "loggpt.getPlusEntitlement" });
            return {
                hasPlus: response?.hasPlus === true,
                source: response?.source || "basic",
                displayPrice: response?.displayPrice || null,
            };
        } catch (error) {
            if (/context.*invalid|extension.*unload|message port.*closed/i.test(String(error))) {
                extensionState.available = false;
            }
            clog("Unable to verify Plus entitlement; using Basic export", error);
            return { hasPlus: false, source: "unavailable", displayPrice: null };
        }
    }

    async function hasPlusEntitlement() {
        return (await getPlusEntitlement()).hasPlus;
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
            promptOnDownload: true,
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

    async function getBasicUpgradeNoticeDismissed() {
        const storage = getStorageArea();
        if (!storage) {
            return window.localStorage.getItem(STORAGE_KEYS.basicUpgradeNoticeDismissed) === "true";
        }
        const values = await storage.get(STORAGE_KEYS.basicUpgradeNoticeDismissed);
        return values[STORAGE_KEYS.basicUpgradeNoticeDismissed] === true;
    }

    async function setBasicUpgradeNoticeDismissed(dismissed) {
        const storage = getStorageArea();
        if (!storage) {
            window.localStorage.setItem(STORAGE_KEYS.basicUpgradeNoticeDismissed, String(dismissed));
            return;
        }
        await storage.set({ [STORAGE_KEYS.basicUpgradeNoticeDismissed]: dismissed });
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
        return [start, end, title || `chatgpt-convo-${threadId}`].filter(Boolean).join("-");
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

    async function getAccessToken(signal) {
        const response = await fetch("https://chatgpt.com/api/auth/session", { credentials: "include", signal });
        if (!response.ok) {
            throw new Error("Failed to get access token");
        }
        const payload = await response.json();
        return payload.accessToken;
    }

    async function getConversation(threadId, signal) {
        const token = await getAccessToken(signal);
        const response = await fetch(`https://chatgpt.com/backend-api/conversation/${threadId}`, {
            credentials: "include",
            signal,
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
        if (text.startsWith(SEDIMENT_PREFIX)) {
            return normalizeMediaIdentifier(text.slice(SEDIMENT_PREFIX.length));
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
            entry.detectedMimeType,
            entry.declaredMimeType,
            entry.mimeType,
            entry.sourceUrl,
        ].filter(Boolean);
        for (const value of sourceValues) {
            const text = String(value);
            const filenameMatch = text.match(/\.([a-z0-9]{1,10})(?:$|[?#])/i);
            if (filenameMatch) {
                return `.${filenameMatch[1].toLowerCase()}`;
            }
            const normalizedMime = text.toLowerCase().split(";", 1)[0].trim();
            if (MIME_EXTENSIONS[normalizedMime]) return MIME_EXTENSIONS[normalizedMime];
        }
        return "";
    }

    function contentDispositionFilename(value) {
        if (!value) return null;
        const encoded = String(value).match(/filename\*=UTF-8''([^;]+)/i);
        if (encoded) {
            try { return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, "")); } catch (_error) {}
        }
        const plain = String(value).match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
        return plain ? String(plain[1] || plain[2]).trim() : null;
    }

    function isTrustedArtifactUrl(value) {
        try {
            const hostname = new URL(value, globalThis.location?.origin || "https://chatgpt.com").hostname.toLowerCase();
            return hostname === "chatgpt.com"
                || hostname.endsWith(".chatgpt.com")
                || hostname === "openai.com"
                || hostname.endsWith(".openai.com")
                || hostname === "oaiusercontent.com"
                || hostname.endsWith(".oaiusercontent.com");
        } catch (_error) {
            return false;
        }
    }

    async function detectArtifactType(blob, declaredMimeType) {
        const bytes = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
        const ascii = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trimStart();
        const starts = (...values) => values.every((value, index) => bytes[index] === value);
        let signatureMimeType = null;
        if (starts(0x89, 0x50, 0x4e, 0x47)) signatureMimeType = "image/png";
        else if (starts(0xff, 0xd8, 0xff)) signatureMimeType = "image/jpeg";
        else if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) signatureMimeType = "image/gif";
        else if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") signatureMimeType = "image/webp";
        else if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE") signatureMimeType = "audio/wav";
        else if (ascii.startsWith("%PDF-")) signatureMimeType = "application/pdf";
        else if (starts(0x50, 0x4b, 0x03, 0x04)) signatureMimeType = "application/zip";
        else if (ascii.startsWith("ID3") || starts(0xff, 0xfb) || starts(0xff, 0xf3) || starts(0xff, 0xf2)) signatureMimeType = "audio/mpeg";
        else if (ascii.startsWith("OggS")) signatureMimeType = "audio/ogg";
        else if (bytes.length >= 12 && ascii.slice(4, 8) === "ftyp") signatureMimeType = "video/mp4";
        else if (/^<\?xml[\s\S]*?<svg\b|^<svg\b/i.test(ascii)) signatureMimeType = "image/svg+xml";

        const declared = String(declaredMimeType || "").toLowerCase().split(";", 1)[0].trim() || null;
        const declaredIsSpecific = declared && declared !== "application/octet-stream";
        const detectedMimeType = declaredIsSpecific && signatureMimeType === "application/zip"
            ? declared
            : (signatureMimeType || (declaredIsSpecific ? declared : null));
        return {
            detectedMimeType: detectedMimeType || "application/octet-stream",
            extension: MIME_EXTENSIONS[detectedMimeType || "application/octet-stream"] || ".bin",
        };
    }

    function bestDeclaredMimeType(...values) {
        const normalized = values
            .filter(Boolean)
            .map(value => String(value).toLowerCase().split(";", 1)[0].trim())
            .filter(Boolean);
        return normalized.find(value => value !== "application/octet-stream") || normalized[0] || null;
    }

    function usableMediaUrl(value) {
        if (typeof value !== "string") return null;
        const text = value.trim();
        if (!text || text === "null") return null;
        if (text.startsWith(FILE_SERVICE_PREFIX)) return null;
        if (/^https?:\/\//i.test(text)) return isTrustedArtifactUrl(text) ? text : null;
        if (text.startsWith("/backend-api/")) return text;
        return null;
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

    function sandboxArtifactLinks(value) {
        if (typeof value !== "string" || !value.includes("sandbox:")) return [];
        const links = [];
        const pattern = /\[([^\]]*)\]\(sandbox:([^)]+)\)/g;
        let match;
        while ((match = pattern.exec(value)) !== null) {
            let sandboxPath = match[2].trim();
            try { sandboxPath = decodeURIComponent(sandboxPath); } catch (_error) {}
            const supportedPath = sandboxPath.startsWith("/mnt/data/")
                || sandboxPath.startsWith("/workspace/scratch/");
            if (!supportedPath || sandboxPath.split("/").includes("..")) continue;
            links.push({
                sandboxPath,
                filename: sandboxPath.split("/").pop() || match[1] || "artifact",
            });
        }
        return links;
    }

    function scanConversationMedia(conversation) {
        const mapping = conversation?.mapping || {};
        const byId = new Map();
        const byUrl = new Map();

        function getOrCreateEntry(seed) {
            const key = seed.canonicalId || seed.sourceUrl || `${seed.turnId || "unknown"}:${seed.messageId || "unknown"}:${seed.originalFilename || "asset"}`;
            const existing = byId.get(key) || byUrl.get(seed.sourceUrl || "");
            if (existing) {
                const previousOrigin = existing.origin;
                Object.assign(existing, Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined && value !== null && value !== "")));
                if (previousOrigin === "uploaded" || seed.origin === "uploaded") {
                    existing.origin = "uploaded";
                } else if (previousOrigin === "generated" || seed.origin === "generated") {
                    existing.origin = "generated";
                }
                return existing;
            }
            const next = {
                canonicalId: seed.canonicalId || null,
                assetPointer: seed.assetPointer || null,
                sourceUrl: seed.sourceUrl || null,
                originalFilename: seed.originalFilename || null,
                mimeType: seed.mimeType || null,
                declaredMimeType: seed.declaredMimeType || seed.mimeType || null,
                detectedMimeType: seed.detectedMimeType || null,
                width: seed.width || null,
                height: seed.height || null,
                size: seed.size || null,
                duration: seed.duration || null,
                inlineText: seed.inlineText || null,
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
            const authorName = message?.author?.name || null;
            const contentType = message?.content?.content_type || null;
            const metadata = message?.metadata || {};
            const attachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];

            for (const attachment of attachments) {
                if (!attachment || typeof attachment !== "object") {
                    continue;
                }
                if (role === "tool" && authorName === "container.open_image") {
                    continue;
                }
                getOrCreateEntry({
                    canonicalId: normalizeMediaIdentifier(attachment.id || attachment.file_id),
                    assetPointer: attachment.asset_pointer || null,
                    sourceUrl: usableMediaUrl(attachment.url || attachment.download_url || attachment.content_url),
                    originalFilename: attachment.name || attachment.filename || null,
                    mimeType: attachment.mime_type || attachment.mimeType || null,
                    width: attachment.width || null,
                    height: attachment.height || null,
                    size: attachment.size || null,
                    duration: attachment.duration || attachment.duration_seconds || null,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType,
                    origin: role === "user" ? "uploaded" : "generated",
                });
            }

            for (const part of message.content?.parts || []) {
                if (!part || typeof part !== "object" || part.content_type !== "image_asset_pointer") {
                    continue;
                }
                const canonicalId = normalizeMediaIdentifier(part.asset_pointer || part.image_url || part.url);
                const sourceUrl = usableMediaUrl(part.image_url || part.url);
                if (!canonicalId && !sourceUrl) {
                    continue;
                }
                getOrCreateEntry({
                    canonicalId,
                    assetPointer: part.asset_pointer || null,
                    sourceUrl,
                    originalFilename: part.filename
                        || part.name
                        || (role === "user" ? null : metadata.image_gen_title || "generated-image"),
                    mimeType: part.mime_type || part.mimeType || null,
                    width: part.width || null,
                    height: part.height || null,
                    size: part.size_bytes || part.size || null,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType: part.content_type,
                    origin: role === "user" ? "uploaded" : "generated",
                });
            }

            for (const reference of metadata.content_references || []) {
                if (reference?.type !== "file" || !reference.id) continue;
                getOrCreateEntry({
                    canonicalId: normalizeMediaIdentifier(reference.id),
                    originalFilename: reference.name || null,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType,
                    origin: reference.source === "my_files" ? "uploaded" : "unclassified",
                });
            }

            const textValues = [];
            if (typeof message.content?.text === "string") textValues.push(message.content.text);
            for (const part of message.content?.parts || []) {
                if (typeof part === "string") textValues.push(part);
                else if (typeof part?.text === "string") textValues.push(part.text);
            }
            for (const textValue of textValues) {
                for (const link of sandboxArtifactLinks(textValue)) {
                    const conversationId = conversation?.conversation_id;
                    if (!conversationId) continue;
                    getOrCreateEntry({
                        sourceUrl: `/backend-api/conversation/${encodeURIComponent(conversationId)}/interpreter/download?message_id=${encodeURIComponent(message.id || "")}&sandbox_path=${encodeURIComponent(link.sandboxPath)}`,
                        originalFilename: link.filename,
                        turnId,
                        messageId: message.id || null,
                        role,
                        contentType,
                        origin: role === "user" ? "uploaded" : "generated",
                    });
                }
            }

            iterMediaCandidates(message, candidate => {
                const rawSourceUrl = candidate.url || candidate.content_url || candidate.download_url || candidate.image_url || candidate.thumbnail_url || null;
                const sourceUrl = usableMediaUrl(rawSourceUrl);
                const hasArtifactPointer = Boolean(
                    candidate.file_id
                    || candidate.asset_pointer
                    || candidate.audio_asset_pointer
                    || candidate.image_asset_pointer
                    || candidate.video_asset_pointer
                    || candidate.canvas_asset_pointer
                );
                const sourceLooksLikeArtifact = sourceUrl && /\/backend-api\/(?:estuary\/content|files\/file[-_])/i.test(sourceUrl);
                if (!hasArtifactPointer && !sourceLooksLikeArtifact) {
                    return;
                }
                const canonicalId = normalizeMediaIdentifier(
                    candidate.file_id ||
                    candidate.asset_pointer ||
                    candidate.audio_asset_pointer ||
                    rawSourceUrl
                );
                if (!canonicalId && !sourceUrl) {
                    return;
                }
                getOrCreateEntry({
                    canonicalId,
                    assetPointer: candidate.asset_pointer || candidate.audio_asset_pointer || null,
                    sourceUrl,
                    originalFilename: candidate.filename || candidate.name || candidate.title || null,
                    mimeType: candidate.mime_type || candidate.mimeType || null,
                    width: candidate.width || null,
                    height: candidate.height || null,
                    size: candidate.size || null,
                    duration: candidate.duration || candidate.duration_seconds || null,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType,
                    origin: role === "user"
                        ? "uploaded"
                        : (/dalle|imagegen|ada|execution_output|tool/i.test(`${contentType} ${JSON.stringify(candidate)}`) ? "generated" : "unclassified"),
                });
            });

            if (contentType === "tether_quote" && message.content?.text) {
                const rawSourceUrl = message.content.url || null;
                getOrCreateEntry({
                    canonicalId: normalizeMediaIdentifier(rawSourceUrl),
                    sourceUrl: usableMediaUrl(rawSourceUrl),
                    originalFilename: message.content.title || message.content.domain || null,
                    mimeType: "text/markdown",
                    inlineText: message.content.text,
                    turnId,
                    messageId: message.id || null,
                    role,
                    contentType,
                    origin: "unclassified",
                });
            }
        }

        return Array.from(byId.values()).map(entry => {
            const extension = inferExtension(entry);
            const cleanName = sanitizeFilename(entry.originalFilename || entry.canonicalId || "attachment");
            return {
                ...entry,
                savedFilename: cleanName.toLowerCase().endsWith(extension) ? cleanName : `${cleanName}${extension}`,
            };
        });
    }

    function getArtifactCounts(mediaEntries) {
        const uploaded = mediaEntries.filter(entry => entry.origin === "uploaded").length;
        return {
            total: mediaEntries.length,
            generated: mediaEntries.length - uploaded,
            uploaded,
        };
    }

    async function fetchMediaEntry(entry, token, signal) {
        throwIfAborted(signal);
        if (entry.inlineText) {
            const blob = new Blob([entry.inlineText], { type: entry.mimeType || "text/plain" });
            const cleanName = sanitizeFilename(entry.originalFilename || entry.canonicalId || "referenced-content");
            const extension = inferExtension(entry) || ".txt";
            return {
                ...entry,
                savedFilename: cleanName.toLowerCase().endsWith(extension) ? cleanName : `${cleanName}${extension}`,
                size: blob.size,
                downloadStatus: "downloaded",
                blob,
            };
        }

        const urls = [];
        if (entry.sourceUrl && isTrustedArtifactUrl(entry.sourceUrl)) {
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
                let response = await fetch(url, {
                    credentials: isChatGPTOrigin ? "include" : "omit",
                    headers: isChatGPTOrigin ? { Authorization: `Bearer ${token}` } : {},
                    signal,
                });
                if (!response.ok) {
                    lastError = `HTTP ${response.status} for ${sanitizedSourceUrl(url)}`;
                    continue;
                }
                let descriptor = null;
                const responseType = response.headers?.get?.("content-type") || "";
                if (responseType.includes("application/json")) {
                    try {
                        descriptor = await response.clone().json();
                    } catch (_error) {
                        descriptor = null;
                    }
                }
                if (descriptor?.download_url) {
                    const downloadUrl = descriptor.download_url;
                    const downloadHost = new URL(downloadUrl).hostname;
                    const downloadIsChatGPT = downloadHost === "chatgpt.com" || downloadHost.endsWith(".chatgpt.com");
                    response = await fetch(downloadUrl, {
                        credentials: downloadIsChatGPT ? "include" : "omit",
                        headers: downloadIsChatGPT ? { Authorization: `Bearer ${token}` } : {},
                        signal,
                    });
                    if (!response.ok) {
                        lastError = `HTTP ${response.status} for ${sanitizedSourceUrl(downloadUrl)}`;
                        continue;
                    }
                }
                const finalContentDisposition = response.headers?.get?.("content-disposition") || "";
                const finalContentType = response.headers?.get?.("content-type") || "";
                const blob = await response.blob();
                const declaredMimeType = bestDeclaredMimeType(
                    finalContentType,
                    blob.type,
                    descriptor?.mime_type,
                    entry.declaredMimeType,
                    entry.mimeType
                );
                const typeInfo = await detectArtifactType(blob, declaredMimeType);
                const responseName = contentDispositionFilename(finalContentDisposition);
                const descriptorName = descriptor?.file_name ? String(descriptor.file_name).split("/").pop() : null;
                const preferredName = responseName || descriptorName || entry.originalFilename || entry.canonicalId || "attachment";
                const extension = inferExtension({
                    originalFilename: preferredName,
                    detectedMimeType: typeInfo.detectedMimeType,
                    declaredMimeType,
                    sourceUrl: descriptor?.download_url || url,
                }) || typeInfo.extension || ".bin";
                const cleanName = sanitizeFilename(preferredName);
                return {
                    ...entry,
                    sourceUrl: descriptor?.download_url || entry.sourceUrl || url,
                    originalFilename: entry.originalFilename || descriptorName || responseName,
                    savedFilename: cleanName.toLowerCase().endsWith(extension) ? cleanName : `${cleanName}${extension}`,
                    mimeType: typeInfo.detectedMimeType,
                    declaredMimeType,
                    detectedMimeType: typeInfo.detectedMimeType,
                    size: blob.size,
                    width: entry.width || descriptor?.metadata?.ace?.image_width || descriptor?.width || null,
                    height: entry.height || descriptor?.metadata?.ace?.image_height || descriptor?.height || null,
                    duration: entry.duration || descriptor?.duration || descriptor?.metadata?.duration || null,
                    downloadStatus: "downloaded",
                    blob,
                };
            } catch (error) {
                if (isAbortError(error) || signal?.aborted) {
                    throw createAbortError();
                }
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

    async function crc32(data, signal) {
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
        const chunkSize = 1024 * 1024;
        for (let index = 0; index < data.length; index += 1) {
            crc = table[(crc ^ data[index]) & 0xFF] ^ (crc >>> 8);
            if (index > 0 && index % chunkSize === 0) {
                throwIfAborted(signal);
                await yieldToMainThread();
            }
        }
        throwIfAborted(signal);
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

    async function buildZipBlob(files, { signal, onProgress } = {}) {
        const locals = [];
        const centrals = [];
        let offset = 0;
        let centralSize = 0;

        for (let index = 0; index < files.length; index += 1) {
            throwIfAborted(signal);
            const file = files[index];
            const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
            const nameBytes = textToUint8Array(file.path);
            const { time, date } = dosDateParts(file.modifiedAt);
            const checksum = await crc32(data, signal);

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
            onProgress?.({ phase: "packaging", completed: index + 1, total: files.length, filename: file.path });
            await yieldToMainThread();
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

    async function buildArchiveZipBlob(stem, conversation, mediaEntries, token, preferences, { signal, onProgress } = {}) {
        const downloaded = [];
        const manifestItems = [];
        const usedNames = new Set();
        const selectedEntries = mediaEntries.filter(entry => entry.origin === "uploaded"
            ? preferences.includeUploaded
            : preferences.includeGenerated);
        let completed = 0;
        let successful = 0;
        let failed = 0;

        onProgress?.({ phase: "artifacts", completed, total: selectedEntries.length, successful, failed });

        for (const entry of mediaEntries) {
            throwIfAborted(signal);
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
            const result = await fetchMediaEntry(entry, token, signal);
            let savedFilename = sanitizeFilename(
                result.savedFilename
                || `${result.canonicalId || result.originalFilename || "attachment"}${inferExtension(result)}`
            );
            const extension = inferExtension(result) || (result.downloadStatus === "downloaded" ? ".bin" : "");
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
                throwIfAborted(signal);
                hash = await sha256Hex(bytes);
                throwIfAborted(signal);
            }
            manifestItems.push({
                canonical_id: result.canonicalId,
                asset_pointer: result.assetPointer,
                source_url: sanitizedSourceUrl(result.sourceUrl),
                original_filename: result.originalFilename,
                saved_filename: savedFilename,
                relative_path: relativePath,
                origin: category,
                declared_mime_type: result.declaredMimeType || null,
                detected_mime_type: result.detectedMimeType || result.mimeType || null,
                mime_type: result.detectedMimeType || result.mimeType || null,
                width: result.width,
                height: result.height,
                duration: result.duration,
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
            completed += 1;
            if (result.downloadStatus === "downloaded") successful += 1;
            else failed += 1;
            onProgress?.({
                phase: "artifacts",
                completed,
                total: selectedEntries.length,
                successful,
                failed,
                filename: savedFilename,
            });
            await yieldToMainThread();
        }

        const manifest = {
            product: getProductConfig().productName,
            source_file: `${stem}.json`,
            conversation_title: conversation?.title || null,
            conversation_id: conversation?.conversation_id || null,
            exported_at: new Date().toISOString(),
            format_version: 2,
            selection: {
                generated_content: preferences.includeGenerated,
                uploaded_content: preferences.includeUploaded,
            },
            category_descriptions: {
                generated: "Content created by ChatGPT or one of its tools.",
                uploaded: "Content attached to the conversation by the user.",
                derived: "Supporting text or representations embedded in the conversation record.",
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
        return buildZipBlob(zipFiles, { signal, onProgress });
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

    function createExportProgressDialog(controller) {
        removeExistingDialog();
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
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.style.cssText = [
            "width:min(440px,calc(100vw - 32px))",
            "background:#fff",
            "color:#111",
            "border-radius:16px",
            "padding:20px",
            "box-shadow:0 20px 80px rgba(0,0,0,0.25)",
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        ].join(";");
        panel.innerHTML = `
            <div id="loggpt-progress-title" style="font-size:18px;font-weight:700;margin-bottom:8px;">Collecting chat history information…</div>
            <div id="loggpt-progress-detail" aria-live="polite" style="font-size:14px;line-height:1.5;margin-bottom:14px;">Please wait while LogGPT prepares your download.</div>
            <div style="height:8px;background:#e5e5e5;border-radius:999px;overflow:hidden;margin-bottom:10px;">
                <div id="loggpt-progress-bar" style="height:100%;width:8%;background:#1677ff;border-radius:999px;transition:width 160ms ease;"></div>
            </div>
            <div id="loggpt-progress-summary" style="min-height:18px;font-size:12px;color:#555;overflow-wrap:anywhere;margin-bottom:16px;"></div>
            <div style="display:flex;justify-content:flex-end;">
                <button type="button" id="loggpt-progress-cancel" style="padding:8px 14px;border-radius:10px;border:1px solid #c8c8c8;background:#fff;cursor:pointer;">Cancel</button>
            </div>
        `;
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);

        const title = panel.querySelector("#loggpt-progress-title");
        const detail = panel.querySelector("#loggpt-progress-detail");
        const bar = panel.querySelector("#loggpt-progress-bar");
        const summary = panel.querySelector("#loggpt-progress-summary");
        const cancel = panel.querySelector("#loggpt-progress-cancel");
        cancel.addEventListener("click", () => {
            cancel.disabled = true;
            cancel.style.opacity = "0.6";
            title.textContent = "Cancelling export…";
            detail.textContent = "Stopping the current operation.";
            controller.abort();
        });

        return {
            close() {
                backdrop.remove();
            },
            setCancelable(cancelable) {
                cancel.disabled = !cancelable;
                cancel.style.opacity = cancelable ? "1" : "0.6";
            },
            update(status) {
                if (status.phase === "collecting") {
                    title.textContent = "Collecting chat history information…";
                    detail.textContent = "Please wait while LogGPT prepares your download.";
                    bar.style.width = "8%";
                    summary.textContent = "";
                    return;
                }
                const total = Math.max(0, status.total || 0);
                const completed = Math.min(total, Math.max(0, status.completed || 0));
                const percent = total ? Math.max(4, Math.round((completed / total) * 100)) : 100;
                bar.style.width = `${percent}%`;
                if (status.phase === "artifacts") {
                    title.textContent = "Collecting artifacts…";
                    detail.textContent = total
                        ? `${completed} of ${total} artifacts collected.`
                        : "No selected artifacts were found. Creating the archive with its conversation JSON and manifest.";
                    const resultSummary = status.failed
                        ? `${status.successful || 0} collected, ${status.failed} unavailable`
                        : (status.filename || "");
                    summary.textContent = resultSummary;
                    return;
                }
                if (status.phase === "packaging") {
                    title.textContent = "Creating ZIP archive…";
                    detail.textContent = `Adding file ${completed} of ${total}.`;
                    summary.textContent = status.filename || "";
                }
            },
        };
    }

    async function promptForDownloadOptions(preferences, artifactCounts = { total: 0, generated: 0, uploaded: 0 }) {
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
                "width:min(480px,calc(100vw - 32px))",
                "background:#fff",
                "color:#111",
                "border-radius:16px",
                "padding:20px",
                "box-shadow:0 20px 80px rgba(0,0,0,0.25)",
                "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            ].join(";");

            panel.innerHTML = `
                <div style="font-size:18px;font-weight:700;margin-bottom:8px;">LogGPT Plus Export</div>
                <div style="font-size:14px;line-height:1.5;margin-bottom:6px;">Download JSON by itself, or create a portable ZIP containing the JSON and selected artifacts.</div>
                <div style="font-size:13px;color:#555;margin-bottom:16px;">${artifactCounts.total} total artifacts: ${artifactCounts.generated} generated, ${artifactCounts.uploaded} uploaded.</div>
                <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;">
                    <input type="checkbox" id="loggpt-include-media" />
                    <span><strong>Download artifacts</strong><br><small>Creates a ZIP instead of a standalone JSON file.</small></span>
                </label>
                <div id="loggpt-artifact-types" style="margin:0 0 14px 28px;">
                    <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">
                        <input type="checkbox" id="loggpt-include-generated" />
                        <span>Generated Content (${artifactCounts.generated}) <small>(images, charts, and tool-created files)</small></span>
                    </label>
                    <label style="display:flex;gap:10px;align-items:flex-start;">
                        <input type="checkbox" id="loggpt-include-uploaded" />
                        <span>Uploaded Content (${artifactCounts.uploaded}) <small>(files attached by the user)</small></span>
                    </label>
                </div>
                <label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;">
                    <input type="checkbox" id="loggpt-dont-ask" />
                    <span>Don't ask me again <small>(use these choices for future downloads)</small></span>
                </label>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button type="button" id="loggpt-export-cancel" style="padding:8px 14px;border-radius:10px;border:1px solid #c8c8c8;background:#fff;cursor:pointer;">Cancel</button>
                    <button type="button" id="loggpt-export-ok" style="padding:8px 14px;border-radius:10px;border:0;background:#111;color:#fff;cursor:pointer;">OK</button>
                </div>
            `;

            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);

            const includeMediaCheckbox = panel.querySelector("#loggpt-include-media");
            const includeGeneratedCheckbox = panel.querySelector("#loggpt-include-generated");
            const includeUploadedCheckbox = panel.querySelector("#loggpt-include-uploaded");
            const dontAskCheckbox = panel.querySelector("#loggpt-dont-ask");

            includeMediaCheckbox.checked = preferences.includeMediaByDefault;
            includeGeneratedCheckbox.checked = preferences.includeGenerated;
            includeUploadedCheckbox.checked = preferences.includeUploaded;

            function updateArtifactTypes() {
                includeGeneratedCheckbox.disabled = !includeMediaCheckbox.checked;
                includeUploadedCheckbox.disabled = !includeMediaCheckbox.checked;
                panel.querySelector("#loggpt-artifact-types").style.opacity = includeMediaCheckbox.checked ? "1" : "0.55";
            }
            includeMediaCheckbox.addEventListener("change", updateArtifactTypes);
            updateArtifactTypes();

            panel.querySelector("#loggpt-export-cancel").addEventListener("click", () => {
                backdrop.remove();
                resolve({ cancelled: true, includeMedia: false, dontAskAgain: false });
            });
            panel.querySelector("#loggpt-export-ok").addEventListener("click", () => {
                const includeGenerated = includeMediaCheckbox.checked && includeGeneratedCheckbox.checked;
                const includeUploaded = includeMediaCheckbox.checked && includeUploadedCheckbox.checked;
                backdrop.remove();
                resolve({
                    cancelled: false,
                    includeMedia: includeGenerated || includeUploaded,
                    includeGenerated,
                    includeUploaded,
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

    async function resolveDownloadOptions(config, artifactCounts, beforePrompt) {
        if (!config.enableMediaExport) {
            return { cancelled: false, includeMedia: false, includeGenerated: false, includeUploaded: false };
        }

        const preferences = await getStoredPreferences();
        if (!preferences.promptOnDownload) {
            return {
                cancelled: false,
                includeMedia: preferences.includeMediaByDefault
                    && (preferences.includeGenerated || preferences.includeUploaded),
                includeGenerated: preferences.includeMediaByDefault && preferences.includeGenerated,
                includeUploaded: preferences.includeMediaByDefault && preferences.includeUploaded,
            };
        }

        beforePrompt?.();
        const decision = await promptForDownloadOptions(preferences, artifactCounts);
        if (decision.cancelled) {
            return decision;
        }
        if (decision.dontAskAgain) {
            await setStoredPreferences({
                promptOnDownload: false,
                includeMediaByDefault: decision.includeMedia,
                includeGenerated: decision.includeGenerated,
                includeUploaded: decision.includeUploaded,
            });
        }
        return decision;
    }

    async function showBasicUpgradeNotice(entitlement) {
        if (await getBasicUpgradeNoticeDismissed()) {
            return { openUpgrade: false };
        }
        removeExistingDialog();
        return new Promise(resolve => {
            const backdrop = document.createElement("div");
            backdrop.id = "loggpt-export-dialog-backdrop";
            backdrop.style.cssText = [
                "position:fixed", "inset:0", "background:rgba(0,0,0,0.45)",
                "display:flex", "align-items:center", "justify-content:center", "z-index:2147483647",
            ].join(";");
            const panel = document.createElement("div");
            panel.style.cssText = [
                "width:min(500px,calc(100vw - 32px))", "background:#fff", "color:#111",
                "border-radius:16px", "padding:22px", "box-shadow:0 20px 80px rgba(0,0,0,0.25)",
                "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", "font-size:15px",
            ].join(";");
            const price = entitlement?.displayPrice ? ` for ${entitlement.displayPrice}` : "";
            panel.innerHTML = `
                <div style="font-size:19px;font-weight:700;margin-bottom:8px;">Keep the complete conversation with LogGPT Plus</div>
                <div style="line-height:1.5;margin-bottom:12px;">
                    Your JSON download will continue normally. A one-time in-app purchase${price} can also archive generated images, charts, and uploaded files in a portable ZIP.
                </div>
                <div style="line-height:1.45;margin-bottom:14px;color:#444;">
                    To upgrade, open the LogGPT toolbar icon and choose <strong>Get LogGPT Plus</strong>, or use <strong>Safari Settings → Extensions → LogGPT → Settings</strong>.
                </div>
                <label style="display:flex;gap:9px;align-items:center;margin-bottom:18px;">
                    <input type="checkbox" id="loggpt-dismiss-basic-notice" checked />
                    <span>Don't show this again</span>
                </label>
                <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
                    <button type="button" id="loggpt-open-upgrade" style="padding:8px 14px;border-radius:10px;border:1px solid #aaa;background:#fff;cursor:pointer;">Open LogGPT</button>
                    <button type="button" id="loggpt-continue-basic" style="padding:8px 14px;border-radius:10px;border:0;background:#111;color:#fff;cursor:pointer;">Download JSON</button>
                </div>`;
            backdrop.appendChild(panel);
            document.body.appendChild(backdrop);

            const finish = async openUpgrade => {
                const dismissed = panel.querySelector("#loggpt-dismiss-basic-notice").checked;
                await setBasicUpgradeNoticeDismissed(dismissed);
                backdrop.remove();
                resolve({ openUpgrade });
            };
            panel.querySelector("#loggpt-open-upgrade").addEventListener("click", () => finish(true));
            panel.querySelector("#loggpt-continue-basic").addEventListener("click", () => finish(false));
        });
    }

    async function handleDownloadClick(event) {
        const button = event.currentTarget;
        const threadId = getThreadId();
        if (!threadId) {
            window.alert("No conversation detected.");
            return;
        }

        if (activeExportController) {
            return;
        }

        const config = getProductConfig();
        const controller = new AbortController();
        activeExportController = controller;
        let progressDialog = createExportProgressDialog(controller);
        setButtonBusy(button, true);
        try {
            const entitlement = await getPlusEntitlement();
            throwIfAborted(controller.signal);
            config.enableMediaExport = entitlement.hasPlus;
            updateDownloadButtonState(button, config.enableMediaExport);
            const { token, conversation } = await getConversation(threadId, controller.signal);
            const stem = buildExportStem(threadId, conversation);

            if (!config.enableMediaExport) {
                downloadJSON(stem, conversation);
                progressDialog.close();
                progressDialog = null;
                const basicNotice = await showBasicUpgradeNotice(entitlement);
                if (basicNotice.openUpgrade) {
                    getRuntime()?.sendMessage?.({ type: "loggpt.openContainingApp" }).catch(() => {});
                }
                return;
            }

            const mediaEntries = scanConversationMedia(conversation);
            const artifactCounts = getArtifactCounts(mediaEntries);
            const decision = await resolveDownloadOptions(config, artifactCounts, () => {
                progressDialog?.close();
                progressDialog = null;
            });
            if (decision.cancelled) {
                return;
            }
            if (!decision.includeMedia) {
                downloadJSON(stem, conversation);
                return;
            }

            if (!progressDialog) {
                progressDialog = createExportProgressDialog(controller);
            }
            const zipBlob = await buildArchiveZipBlob(
                stem,
                conversation,
                mediaEntries,
                token,
                decision,
                {
                    signal: controller.signal,
                    onProgress: status => progressDialog?.update(status),
                }
            );
            throwIfAborted(controller.signal);
            progressDialog.setCancelable(false);
            triggerDownload(zipBlob, `${stem}.zip`);
            clog("Downloaded conversation archive", stem, { mediaEntries: mediaEntries.length });
        } catch (error) {
            if (isAbortError(error) || controller.signal.aborted) {
                clog("Export cancelled");
                return;
            }
            clog("Download failed", error);
            window.alert("Failed to export the conversation. Check the browser console for details.");
        } finally {
            progressDialog?.close();
            if (activeExportController === controller) {
                activeExportController = null;
            }
            setButtonBusy(button, false);
        }
    }

    function updateDownloadButtonState(button, hasPlus) {
        if (!button) return;
        const config = getProductConfig();
        button.title = hasPlus
            ? "Download conversation JSON or JSON + artifacts"
            : "Download conversation as JSON";
        const img = button.querySelector("img");
        const runtime = getRuntime();
        if (!img) return;
        if (hasPlus && runtime?.getURL) {
            img.src = runtime.getURL(config.isPlus ? "icons/download-icon.png" : "icons/plus/download-icon.png");
        } else {
            img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(getIconSVG());
        }
    }

    async function refreshDownloadButtonState() {
        if (!isConversationPage() || !extensionState.available) {
            removeExistingDialog();
            document.getElementById("loggpt-download-btn")?.remove();
            return;
        }

        let button = document.getElementById("loggpt-download-btn");
        if (!button) {
            injectDownloadButton();
            button = document.getElementById("loggpt-download-btn");
        }
        if (!button) return;

        const entitlement = await getPlusEntitlement();
        updateDownloadButtonState(button, entitlement.hasPlus);
    }

    function createDownloadButton() {
        const button = document.createElement("button");
        button.id = "loggpt-download-btn";
        button.title = "Download conversation";
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
        hasPlusEntitlement().then(hasPlus => updateDownloadButtonState(button, hasPlus));
        button.addEventListener("mouseenter", () => refreshDownloadButtonState().catch(() => {}));
        button.addEventListener("click", handleDownloadClick);
        return button;
    }

    function injectDownloadButton() {
        if (!extensionState.available || !isConversationPage()) {
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

    function reconcileDownloadButton() {
        const button = document.getElementById("loggpt-download-btn");
        if (!extensionState.available || !isConversationPage()) {
            removeExistingDialog();
            button?.remove();
            return false;
        }
        return button ? true : injectDownloadButton();
    }

    if (globalThis.__LOGGPT_TEST_MODE__) {
        globalThis.__LOGGPT_TEST_API__ = {
            buildExportStem,
            scanConversationMedia,
            getArtifactCounts,
            buildArchiveZipBlob,
            sanitizedSourceUrl,
            hasPlusEntitlement,
            fetchMediaEntry,
            getThreadId,
            isConversationPage,
        };
        return;
    }

    if (window.ai_unixwzrd_LogGPT_instance || document.getElementById("loggpt-download-btn")) {
        clog("Already loaded and activated, returning.");
        return;
    }

    window.ai_unixwzrd_LogGPT_instance = true;

    window.addEventListener("focus", () => refreshDownloadButtonState().catch(() => {}));
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshDownloadButtonState().catch(() => {});
    });
    window.setInterval(() => {
        if (!document.hidden) refreshDownloadButtonState().catch(() => {});
    }, 10000);
    reconcileDownloadButton();

    const observer = new MutationObserver(() => {
        reconcileDownloadButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
