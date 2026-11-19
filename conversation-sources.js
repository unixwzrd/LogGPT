// Source-specific capture adapters. Keep UI, ZIP creation and purchases outside this module.
(function () {
    "use strict";

    const DOT_FORMAT = "loggpt.dots";
    const DOT_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:~[a-f0-9]{32})?$/i;

    function checkAbort(signal) {
        if (signal?.aborted) {
            const error = new Error("Export cancelled.");
            error.name = "AbortError";
            throw error;
        }
    }

    function timestamp(value) {
        const time = Date.parse(value);
        if (!Number.isFinite(time)) throw new Error("Dots returned an invalid message timestamp.");
        return time / 1000;
    }

    function dotRole(message, members) {
        const member = members.find(item => item.account_user_id === message.account_user_id);
        if (member) return member.aeon_id ? "assistant" : "user";
        if (Array.isArray(message.raw_messages)) return "assistant";
        if (!message.account_user_id && message.role === "system") return "system";
        throw new Error("Dots returned a sender missing from room membership; export stopped to avoid misattribution.");
    }

    function dotAttachments(message, roomId) {
        return (message.content?.attachments || message.attachments || [])
            .filter(item => item.type === "file")
            .map(item => {
                const file = item.file || {};
                const id = item.file_id || file.file_id || file.id;
                if (typeof id !== "string" || !id) throw new Error("Dots returned a file without an identifier.");
                return {
                    id,
                    file_id: id,
                    name: file.name || id,
                    mime_type: file.mime_type || null,
                    asset_pointer: file.asset_pointer || null,
                    // Refresh expiring signed URLs through the room's file descriptor endpoint.
                    url: `/backend-api/messaging/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(id)}`,
                };
            });
    }

    function dotMediaConversation(conversation) {
        const mapping = Object.create(null);
        for (const message of conversation.messages) {
            if (message.deleted_at) continue;
            mapping[message.id] = {
                message: {
                    id: message.id,
                    author: { role: dotRole(message, conversation.room.members) },
                    content: { content_type: "text", parts: [] },
                    metadata: { attachments: dotAttachments(message, conversation.room.id) },
                },
            };
        }
        return { conversation_id: conversation.conversation_id, mapping };
    }

    async function loadDot(source, { requestJSON, signal, onProgress }) {
        const dot = await requestJSON(`/backend-api/tbo/${encodeURIComponent(source.id)}`);
        if (dot.id !== source.id || typeof dot.messaging_room_id !== "string" || !dot.messaging_room_id) {
            throw new Error("Dots returned unexpected conversation metadata.");
        }
        const base = `/backend-api/messaging/rooms/${encodeURIComponent(dot.messaging_room_id)}`;
        const room = await requestJSON(base);
        if (room.id !== dot.messaging_room_id || !Array.isArray(room.members)) {
            throw new Error("Dots returned unexpected room membership.");
        }
        const messages = new Map();
        const cursors = new Set();
        let before = null;
        let pages = 0;
        let complete = false;
        for (; pages < 1000;) {
            checkAbort(signal);
            const query = new URLSearchParams({ limit: "32" });
            if (before) query.set("before", before);
            const page = await requestJSON(`${base}/messages?${query}`);
            checkAbort(signal);
            pages += 1;
            if (!Array.isArray(page.items)) throw new Error("Dots returned an unexpected message page.");
            if (!page.items.length) {
                if (page.prev_cursor) throw new Error("Dots returned an empty page with more history; export stopped.");
                complete = true;
                break;
            }
            let added = 0;
            for (const message of page.items) {
                if (typeof message.id !== "string" || !message.id) throw new Error("Dots returned a message without an identifier.");
                timestamp(message.created_at);
                dotRole(message, room.members);
                if (!messages.has(message.id)) {
                    added += 1;
                    messages.set(message.id, message);
                }
            }
            const next = page.prev_cursor || page.items[0].id;
            if (!added || typeof next !== "string" || cursors.has(next)) {
                throw new Error("Dots history pagination stopped making progress; no partial export was saved.");
            }
            cursors.add(next);
            before = next;
            onProgress?.({ phase: "collecting", messageCount: messages.size, pages });
        }
        if (!complete) throw new Error("Dots history exceeded the export pagination limit; no partial export was saved.");
        checkAbort(signal);
        const ordered = [...messages.values()].sort((a, b) => timestamp(a.created_at) - timestamp(b.created_at));
        return {
            format: DOT_FORMAT,
            format_version: 1,
            title: dot.display_name || "Dot conversation",
            conversation_id: room.id,
            create_time: ordered.length ? timestamp(ordered[0].created_at) : timestamp(dot.created_at),
            update_time: ordered.length ? Math.max(...ordered.map(m => timestamp(m.updated_at || m.created_at))) : timestamp(dot.updated_at),
            source: {
                kind: "dots",
                scope: "main_timeline",
                exported_at: new Date().toISOString(),
                history_complete: true,
                history_pages: pages,
                excluded: ["linked_task_histories", "nested_reply_histories"],
            },
            dot: {
                id: dot.id,
                display_name: dot.display_name,
                active_root_thread_id: dot.active_root_thread_id || null,
            },
            room: { id: room.id, members: room.members },
            // Preserve source records, including original roles, replies, widgets and task references.
            messages: ordered,
        };
    }

    const adapters = [
        {
            kind: "dots",
            match(path) {
                const match = path.match(/^\/dots\/([^/]+)\/?$/);
                return match && DOT_ID.test(match[1]) ? match[1] : null;
            },
            load: loadDot,
        },
        {
            kind: "chatgpt",
            match: path => path.match(/(?:^|\/)c\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] || null,
            load: (source, { requestJSON }) => requestJSON(`/backend-api/conversation/${encodeURIComponent(source.id)}`),
        },
    ];

    globalThis.LogGPTSources = Object.freeze({
        origin(conversation) {
            if (conversation?.format === DOT_FORMAT) return "dot";
            if (!conversation?.mapping || typeof conversation.mapping !== "object" || conversation.format) return null;
            // Native markers observed in the paired ChatGPT/Work exports. Do not
            // infer origin from a title, model slug, account type, or current URL.
            if (conversation.conversation_origin === "tpp") return "work";
            if (conversation.conversation_origin === null) return "chat";
            return null;
        },
        resolve(location) {
            if (location.hostname !== "chatgpt.com" && !location.hostname.endsWith(".chatgpt.com")) return null;
            for (const adapter of adapters) {
                const id = adapter.match(location.pathname);
                if (id) return { kind: adapter.kind, id };
            }
            return null;
        },
        async load(source, options) {
            const adapter = adapters.find(item => item.kind === source.kind);
            if (!adapter) throw new Error("Unsupported conversation source.");
            return adapter.load(source, options);
        },
        mediaConversation: conversation => conversation.format === DOT_FORMAT ? dotMediaConversation(conversation) : conversation,
    });
})();
