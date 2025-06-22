// ==UserScript==
// @name         LogGPT: Chat Log Export (Safari Only, Minimal)
// @version      1.0.6
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

    // --- Download button click handler ---
    async function handleDownloadClick() {
        const threadId = getThreadId();
        if (!threadId) return alert('No conversation detected.');
        try {
            const data = await getConversation(threadId);
            downloadJSON(threadId, data);
        } catch (e) {
            alert('Failed to download conversation.');
        }
    }

    // --- Create and inject download button ---
    function injectDownloadButton() {
        if (!isOnChatGPT()) return false;
        if (document.getElementById('loggpt-download-btn')) return true;
        
        // Try multiple possible header containers
        const header = document.getElementById("conversation-header-actions") ||
                      document.querySelector("[data-testid='conversation-header-actions']") ||
                      document.querySelector("header") ||
                      document.querySelector("[role='banner']");
        
        if (!header) return false;

        const btn = document.createElement('button');
        btn.id = 'loggpt-download-btn';
        btn.title = 'Download conversation as JSON';
        btn.style.cssText = `
            width:32px; height:32px; background:none; border:none; 
            padding:0; cursor:pointer; display:flex; align-items:center; justify-content:center;
            margin-right:8px; color:inherit;
        `;
        
        // Create icon
        const img = document.createElement('img');
        img.alt = 'Download';
        img.style.width = '24px';
        img.style.height = '24px';
        
        // Apply the download icon
        const svgContent = getIconSVG();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
        btn.appendChild(img);

        // Setup download handler
        btn.addEventListener('click', handleDownloadClick);

        header.insertBefore(btn, header.firstChild);
        return true;
    }

    // --- Main execution logic ---
    
    //  Check if we have already been activated and loaded and return if so.
    if (window.ai_unixwzrd_LogGPT_instance || 
        document.getElementById('loggpt-download-btn')) {
        clog('Already loaded and activated, returning.');
        return;
    }
    
    // Set flag so we aren't activated twice.
    window.ai_unixwzrd_LogGPT_instance = true;
    
    // Inject button and watch for changes
    injectDownloadButton();
    
    // Watch for chat content changes and re-inject if needed
    const observer = new MutationObserver(() => {
        if (!document.getElementById('loggpt-download-btn')) {
            injectDownloadButton();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();