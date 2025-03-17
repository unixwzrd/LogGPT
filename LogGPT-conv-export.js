// Language: JavaScript
// LogGPT: Chat Log Export
//
// Author: <https://github.com/unixwzrd>
// Version: 1.0.2 Renamed the application and changed the oicons.
// License: MIT

// Const variable
const DOMAIN_LOGGPT = "chatgpt.com";

const DEBUG = false;
const gptSession = { data: null };
if (DEBUG) document.body.style.border = "5px solid red";

// logging
function clog(msg) {
  if (DEBUG) if (msg.startsWith("[debug]")) console.log(msg);
}

// Detect Browser
const BRW_FIREFOX = "Firefox";
const BRW_GCHROME = "Chrome";
const BRW_SAFARI = "Safari";
const BRW_UNKNOWN = "unknown";

function detectBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.indexOf("firefox") !== -1) {
    return BRW_FIREFOX;
  } else if (userAgent.indexOf("chrome") !== -1 || userAgent.indexOf("chromium") !== -1) {
    return BRW_GCHROME;
  } else if (userAgent.indexOf("safari") !== -1 && userAgent.indexOf("chrome") === -1) {
    return BRW_SAFARI;
  } else {
    return BRW_UNKNOWN;
  }
}
const DETECT_BROWSER = detectBrowser();

// Encryption and decryption

// Shuffle String
function shuffleString(str) {
  const chars = str.split(""); // Split a string into an array character by character
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // random integer from 0 to i
    [chars[i], chars[j]] = [chars[j], chars[i]]; // replace split string
  }
  return chars.join(""); // return array to string
}

// Create a temporary encryption key
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

// Encryption
function encryptToken(token, key) {
  let encrypted = "";
  for (let i = 0; i < token.length; i++) {
    let charCode = token.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  return encrypted;
}

// Decryption
function decryptToken(token, key) {
  let decrypted = "";
  for (let i = 0; i < token.length; i++) {
    let charCode = token.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

// Get ThreadId (ChatId)
function getThreadId() {
  const url = window.location.href;
  const match = url.match(/c\/([\w-]+)/);
  return match ? match[1] : null;
}

// Get AccessToken
async function getAccessToken() {
  if (DETECT_BROWSER === BRW_FIREFOX) return await getAccessTokenFireFox();
  if (DETECT_BROWSER === BRW_GCHROME) return await getAccessTokenGChrome();
  if (DETECT_BROWSER === BRW_SAFARI) return await getAccessTokenSafari();
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
    // Encrypt the accessToken
    data.accessToken = encryptToken(data.accessToken, KEY_TOKEN);
    // cache
    gptSession.data = data;
    clog(`[debug] accessToken: ${gptSession.data != null}`);
    if (gptSession.data != null) {
      // cache OK
      if (DEBUG) document.body.style.border = "5px solid green";
    }
  } else {
    // Do not refetch if cached
  }
  // decrypt and return
  return decryptToken(gptSession.data.accessToken, KEY_TOKEN);
}

// Get AccessToken: FireFox
async function getAccessTokenFireFox() {
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

    const data = await response.json();
    clog(`[debug] getAccessToken() response: ${data != null}`);
    // Encrypt the accessToken
    data.accessToken = encryptToken(data.accessToken, KEY_TOKEN);
    // cache
    gptSession.data = data;
    clog(`[debug] accessToken: ${gptSession.data != null}`);
    if (gptSession.data != null) {
      // cache OK
      if (DEBUG) document.body.style.border = "5px solid green";
    }
  } else {
    // Do not refetch if cached
  }
  // decrypt and return
  return decryptToken(gptSession.data.accessToken, KEY_TOKEN);
}

// Get AccessToken: Google Chrome
async function getAccessTokenGChrome() {
  clog(`[debug] gptSession.data: ${gptSession.data == null}`);
  if (gptSession.data == null) {
    const threadId = getThreadId();
    const response = await fetch(`https://${DOMAIN_LOGGPT}/api/auth/session`, {
      headers: {
        accept: "*/*",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      referrer: `https://${DOMAIN_LOGGPT}/c/${threadId}`,
      referrerPolicy: "same-origin",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
    });

    const data = await response.json();
    clog(`[debug] getAccessToken() response: ${data != null}`);
    // Encrypt the accessToken
    data.accessToken = encryptToken(data.accessToken, KEY_TOKEN);
    // cache
    gptSession.data = data;
    clog(`[debug] accessToken: ${gptSession.data != null}`);
    if (gptSession.data != null) {
      // cache OK
      if (DEBUG) document.body.style.border = "5px solid green";
    }
  } else {
    // Do not refetch if cached
  }
  // decrypt and return
  return decryptToken(gptSession.data.accessToken, KEY_TOKEN);
}

// Export conversation (download)
function downloadThreadId(threadId, jsonText) {
  const prefix = "LogGPT-clog";
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${prefix}-${threadId}.json`;
  a.click();
}

// Download Icon Resource
function getIconURL() {
  const iconSVG = "icons/download-icon.min.svg";
  let url = null;
  if (typeof browser !== "undefined") {
    // Firefox
    url = browser.runtime.getURL(iconSVG);
  } else if (typeof chrome !== "undefined") {
    // Chrome
    url = chrome.runtime.getURL(iconSVG);
  } else if (typeof safari !== "undefined") {
    // Safari
    url = safari.extension.baseURI + iconSVG;
  } else {
    // Other browsers that don't support
    url = "";
  }
  return url;
}

// Display to confirm that the extended function is working
if (DEBUG) document.body.style.border = "5px solid yellow";

// Create a save button (export button)
const saveButton = document.createElement("button");
const iconURL = getIconURL();
clog(`[debug] iconURL: ${iconURL}`);

const iconImage = document.createElement("img");
iconImage.src = iconURL;
iconImage.alt = "Download";
saveButton.appendChild(iconImage);

// Image icon position
saveButton.style.position = "fixed";
saveButton.style.top = "0.8em";
saveButton.style.right = "15em";
saveButton.style.zIndex = "9999";

// Insert a save button into your page
let currentThreadId = -1;
setInterval(() => {
  // Monitor the thread ID and delete it if it cannot be obtained
  const threadId = getThreadId();
  if (currentThreadId != threadId) {
    currentThreadId = threadId;
    if (threadId != null) document.body.appendChild(saveButton);
    else if (saveButton.parentNode) {
      saveButton.parentNode.removeChild(saveButton);
    }
  }
}, 1000);

async function getConversation(threadId) {
  if (DETECT_BROWSER === BRW_FIREFOX) return await getConversationFireFox(threadId);
  if (DETECT_BROWSER === BRW_GCHROME) return await getConversationGChrome(threadId);
  if (DETECT_BROWSER === BRW_SAFARI) return await getConversationSafari(threadId);
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

// Handle when the download button is clicked
saveButton.addEventListener("click", async () => {
  clog("[debug] click -> export download");

  // Get conversation data
  const threadId = getThreadId();
  const data = await getConversation(threadId);
  // Format and download acquired conversation data
  downloadThreadId(threadId, JSON.stringify(data, null, 2));
});
