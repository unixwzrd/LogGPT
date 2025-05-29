// ==UserScript==
// @name         LogGPT: Chat Log Export (Safari Only, Minimal)
// @version      1.0.5
// @author       unixwzrd
// @license      MIT
// ==/UserScript==

(function() {
    // --- Utility ---
    function clog(...args) { console.log('[LogGPT]', ...args); }

    // --- Only run on ChatGPT ---
    function isOnChatGPT() { return location.hostname.endsWith('chatgpt.com'); }

    // --- Extract thread ID from URL ---
    function getThreadId() {
        const match = location.pathname.match(/c\/([\w-]+)/);
        return match ? match[1] : null;
    }

    // --- Inject Save Button ---
    function injectSaveButton() {
        if (document.getElementById('loggpt-save-btn')) return;
        // Try known header container, fallback to any header
        const header = document.getElementById("conversation-header-actions")
                   || document.querySelector("header");
        if (!header) return;

        const btn = document.createElement('button');
        btn.id = 'loggpt-save-btn';
        btn.title = 'Save conversation as JSON';
        btn.style.cssText = `
            width:32px; height:32px; background:none; border:none; 
            padding:0; cursor:pointer; display:flex; align-items:center; justify-content:center;
        `;
        // Using inline SVG with data URL to avoid external file dependencies
        const img = document.createElement('img');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(getIconSVG());
        img.alt = 'Download';
        img.style.width = '24px';
        img.style.height = '24px';


        btn.appendChild(img);

        btn.addEventListener('click', async () => {
            const threadId = getThreadId();
            if (!threadId) return alert('No conversation detected.');
            try {
                const data = await getConversation(threadId);
                downloadJSON(threadId, data);
            } catch (e) {
                clog('Failed to download:', e);
                alert('Failed to download conversation.');
            }
        });

        header.insertBefore(btn, header.firstChild);
        clog('Save button injected');
    }

    // --- Remove Save Button ---
    function removeSaveButton() {
        const btn = document.getElementById('loggpt-save-btn');
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        clog('Save button removed');
    }

    // --- Download as JSON ---
    function downloadJSON(threadId, obj) {
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chatgpt_convo_${threadId}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 50);
        clog('Downloaded conversation', threadId);
    }

    // --- Fetch token and conversation ---
    async function getAccessToken() {
        // Try session endpoint (Safari still allows this)
        const resp = await fetch('https://chatgpt.com/api/auth/session', { credentials: 'include' });
        if (!resp.ok) throw new Error('Failed to get access token');
        const json = await resp.json();
        return json.accessToken;
    }
    async function getConversation(threadId) {
        const token = await getAccessToken();
        const resp = await fetch(`https://chatgpt.com/backend-api/conversation/${threadId}`, {
            credentials: "include",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        if (!resp.ok) throw new Error('Failed to fetch conversation');
        return await resp.json();
    }

    // --- React to navigation (SPA) ---
    let lastThread = null;
    function checkNav() {
        const threadId = getThreadId();
        if (threadId !== lastThread) {
            lastThread = threadId;
            removeSaveButton();
            if (isOnChatGPT() && threadId) injectSaveButton();
        }
    }

    // Patch history API to detect navigation changes
    const origPush = history.pushState;
    history.pushState = function() { origPush.apply(this, arguments); checkNav(); };
    const origReplace = history.replaceState;
    history.replaceState = function() { origReplace.apply(this, arguments); checkNav(); };
    window.addEventListener('popstate', checkNav);

    // --- Initial run ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { checkNav(); });
    } else {
        checkNav();
    }
})();