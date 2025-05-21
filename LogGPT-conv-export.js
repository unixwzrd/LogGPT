// ==UserScript==
// @name         LogGPT: Chat Log Export (Safari Only)
// @version      1.0.7
// @author       unixwzrd
// @license      MIT
// ==/UserScript==

const DOMAIN_LOGGPT = "chatgpt.com";
const DEBUG = false;

let isActive = false;
let loggptExportInterval = null;
let currentThreadId = null;
const gptSession = { data: null };

// Logging helper
function clog(msg) { if (DEBUG) console.log(msg); }

// --- UI Injection and Removal ---
function injectSaveButton() {
    if (!isOnChatGPT() || document.getElementById('loggpt-save-btn')) return;
    const headerActions = document.getElementById("conversation-header-actions");
    if (!headerActions) return;

    const iconURL = getIconURL();
    if (!iconURL) return;

    const saveButton = document.createElement("button");
    saveButton.id = 'loggpt-save-btn';
    Object.assign(saveButton.style, {
        width: "48px", height: "32px", background: "none", border: "none",
        padding: "0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
    });
    const iconImage = document.createElement("img");
    iconImage.src = iconURL;
    iconImage.alt = "Download";
    iconImage.style.width = "32px";
    iconImage.style.height = "32px";
    saveButton.appendChild(iconImage);

    saveButton.addEventListener("click", async () => {
        const threadId = getThreadId();
        const data = await getConversation(threadId);
        downloadThreadId(threadId, JSON.stringify(data, null, 2));
    });

    headerActions.insertBefore(saveButton, headerActions.firstChild);
    clog('[debug] Save button injected.');
}

function removeSaveButton() {
    const existing = document.getElementById('loggpt-save-btn');
    if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
        clog('[debug] Save button removed.');
    }
}

// --- Activation/Deactivation ---

function activateExtension() {
    if (isActive) return; // Already active
    isActive = true;
    clog('[debug] Extension activated.');
    startInjectionInterval();
}

function deactivateExtension() {
    if (!isActive) return; // Already inactive
    isActive = false;
    cleanupExtension();
    clog('[debug] Extension deactivated.');
}

function cleanupExtension() {
    stopInjectionInterval();
    removeSaveButton();
    currentThreadId = null;
}

// --- Interval Logic ---

function startInjectionInterval() {
    if (loggptExportInterval) return; // Only one interval ever
    loggptExportInterval = setInterval(() => {
        if (!isActive) return;
        const threadId = getThreadId();
        const headerActions = document.getElementById("conversation-header-actions");
        if (!headerActions) return;
        if (currentThreadId !== threadId) {
            removeSaveButton();
            currentThreadId = threadId;
        }
        if (currentThreadId && !document.getElementById('loggpt-save-btn')) {
            injectSaveButton();
        }
    }, 1000);
    clog('[debug] Injection interval started.');
}

function stopInjectionInterval() {
    if (loggptExportInterval) {
        clearInterval(loggptExportInterval);
        loggptExportInterval = null;
        clog('[debug] Injection interval stopped.');
    }
}

// --- Util Functions ---

function getThreadId() {
    const url = window.location.href;
    const match = url.match(/c\/([\w-]+)/);
    return match ? match[1] : null;
}

function isOnChatGPT() {
    return window.location.hostname.endsWith(DOMAIN_LOGGPT);
}

function getIconURL() {
    // Safari-only, no browser.runtime.* or cross-browser checks
    if (typeof safari !== "undefined" && safari.extension && safari.extension.baseURI)
        return safari.extension.baseURI + "icons/download-icon.svg";
    return "";
}

// --- Download logic ---

function downloadThreadId(threadId, jsonText) {
    const prefix = "LogGPT-clog";
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-${threadId}.json`;
    a.click();
}

// --- Safari Messaging Only (NO Chrome/Firefox/WebExtension) ---

if (typeof safari !== "undefined" && safari.self && safari.self.addEventListener) {
    safari.self.addEventListener("message", event => {
        if (event.name === "activate") activateExtension();
        else if (event.name === "deactivate" || event.name === "kill") deactivateExtension();
    }, false);
}

// --- On page load: Start only if extension is active (Safari auto-injects content script) ---

if (isOnChatGPT()) {
    activateExtension();
    // Remove everything on window unload (tab close, reload, navigation away)
    window.addEventListener('unload', () => { deactivateExtension(); });
}

// --- Conversation Fetch/Token logic unchanged ---

function shuffleString(str) {
    const chars = str.split("");
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}

function generateRandomString(length) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    const charset = shuffleString(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    );
    clog(`[debug] charset: ${charset}`);
    return Array.from(array, (x) => charset[x % charset.length]).join("");
}
const KEY_TOKEN = generateRandomString(32);
clog(`[debug] KEY_TOKEN: ${KEY_TOKEN}`);

function encryptToken(token, key) {
    let encrypted = "";
    for (let i = 0; i < token.length; i++) {
        let charCode = token.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        encrypted += String.fromCharCode(charCode);
    }
    return encrypted;
}

function decryptToken(token, key) {
    let decrypted = "";
    for (let i = 0; i < token.length; i++) {
        let charCode = token.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
}

async function getAccessToken() {
    return await getAccessTokenSafari();
}

async function getAccessTokenSafari() {
    clog(`[debug] gptSession.data: ${gptSession.data == null}`);
    if (gptSession.data == null) {
        const threadId = getThreadId();
        const response = await fetch(`https://${DOMAIN_LOGGPT}/api/auth/session`, {
            credentials: "include",
            headers: {
                "User-Agent": window.navigator.userAgent,
                Accept: "*/*",
                "Accept-Language": navigator.language,
                "Alt-Used": `${DOMAIN_LOGGPT}`,
                Pragma: "no-cache",
                "Cache-Control": "no-cache",
            },
            referrer: `https://${DOMAIN_LOGGPT}/c/${threadId}`,
            method: "GET",
            mode: "cors",
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        clog(`[debug] getAccessToken() response: ${data != null}`);
        data.accessToken = encryptToken(data.accessToken, KEY_TOKEN);
        gptSession.data = data;
        clog(`[debug] accessToken: ${gptSession.data != null}`);
        if (gptSession.data != null) {
            if (DEBUG) document.body.style.border = "5px solid green";
        }
    }
    return decryptToken(gptSession.data.accessToken, KEY_TOKEN);
}

async function getConversation(threadId) {
    return await getConversationSafari(threadId);
}

async function getConversationSafari(threadId) {
    const token = await getAccessToken();
    clog(`[debug] threadId: ${threadId}`);
    clog(`[debug] token: ${token != null}`);
    const response = await fetch(
        `https://${DOMAIN_LOGGPT}/backend-api/conversation/${threadId}`,
        {
            credentials: "include",
            headers: {
                "User-Agent": window.navigator.userAgent,
                Accept: "*/*",
                "Accept-Language": navigator.language,
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "Alt-Used": `${DOMAIN_LOGGPT}`,
                Pragma: "no-cache",
                "Cache-Control": "no-cache",
            },
            referrer: `https://${DOMAIN_LOGGPT}/chat/${threadId}`,
            method: "GET",
            mode: "cors",
        }
    );
    const data = await response.json();
    return data;
}