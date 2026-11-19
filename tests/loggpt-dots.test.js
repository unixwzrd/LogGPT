"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// Validate every packaged variant, not just the manifest selected by the root symlink.
const releaseVersion = fs.readFileSync("VERSION.mk", "utf8").match(/^VERSION\s*=\s*v([\d.]+)\s*$/m)?.[1];
assert(releaseVersion, "VERSION.mk must declare the release version");
for (const path of ["manifest-v2.json", "manifest-v2-plus.json", "manifest-v3.json", "manifest-v3-plus.json", "LogGPT/LogGPT Plus Extension/Resources/manifest.json"]) {
    const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
    assert.equal(manifest.version, releaseVersion, `${path}: release version mismatch`);
    const scripts = manifest.content_scripts.flatMap(script => script.js || []);
    assert(scripts.includes("icon.js"), `${path}: missing icon script`);
    assert(scripts.includes("conversation-sources.js"), `${path}: missing source adapters`);
    assert(scripts.indexOf("conversation-sources.js") < scripts.indexOf("LogGPT-conv-export.js"), `${path}: source adapters must load before exporter`);
    for (const script of scripts) assert(fs.existsSync(script), `${path}: missing script ${script}`);
}

const context = { URLSearchParams, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("conversation-sources.js", "utf8"), context);
const sources = context.LogGPTSources;
const dotId = "11111111-1111-4111-8111-111111111111~22222222222222222222222222222222";
const source = sources.resolve({ hostname: "chatgpt.com", pathname: `/dots/${dotId}` });
const dot = { id: dotId, messaging_room_id: "room-1", display_name: "Fixture Dot", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-11-16T12:00:00Z" };
const room = { id: "room-1", members: [{ account_user_id: "human" }, { account_user_id: "agent", aeon_id: dotId }] };
const message = (id, sender, day) => ({
    id, account_user_id: sender, role: "user", created_at: `2026-11-${day}T12:00:00Z`,
    content: { text: `Fixture ${id}`, attachments: [] },
});
const oldest = message("m1", "human", "01");
const middle = message("m2", "agent", "02");
const newest = message("m3", "agent", "03");
oldest.content.attachments.push({ type: "file", file_id: "CalpicoFile_test", file: { name: "input.png", mime_type: "image/png", asset_pointer: "sediment://file_other" } });

function requests(pages, onRequest = () => {}) {
    let count = 0;
    return async path => {
        onRequest(path);
        if (path.startsWith("/backend-api/tbo/")) return dot;
        if (path === "/backend-api/messaging/rooms/room-1") return room;
        const url = new URL(path, "https://chatgpt.com");
        assert.equal(url.pathname, "/backend-api/messaging/rooms/room-1/messages");
        assert.equal(url.searchParams.get("limit"), "32");
        const page = pages[count++];
        assert(page, "Unexpected extra page request");
        if (count === 2) assert.equal(url.searchParams.get("before"), pages[0].prev_cursor || pages[0].items[0].id);
        return page;
    };
}

(async () => {
    assert.equal(source.kind, "dots");
    assert.equal(sources.origin({ format: "loggpt.dots" }), "dot");
    assert.equal(sources.origin({ mapping: {}, conversation_origin: "tpp", title: "Ordinary chat" }), "work");
    assert.equal(sources.origin({ mapping: {}, conversation_origin: null, title: "Work test", default_model_slug: "gpt-5.6-sol-wm" }), "chat");
    assert.equal(sources.origin({ mapping: {}, conversation_origin: "unrecognized", title: "Dot work chat" }), null);
    assert.equal(sources.origin({ mapping: {}, title: "Work test" }), null);
    for (const pathname of ["/dots/new", "/dots/start", "/dots/settings", `/dots/${dotId}/settings`, "/dots/thread/11111111-1111-4111-8111-111111111111"]) {
        assert.equal(sources.resolve({ hostname: "chatgpt.com", pathname }), null);
    }
    assert.equal(sources.resolve({ hostname: "other.example", pathname: `/dots/${dotId}` }), null);
    const progress = [];
    const exported = await sources.load(source, {
        requestJSON: requests([{ items: [middle, newest], prev_cursor: null }, { items: [oldest, middle] }, { items: [] }]),
        onProgress: event => progress.push(event),
    });
    assert.equal(exported.format, "loggpt.dots");
    assert.equal(exported.format_version, 1);
    assert.equal(exported.source.history_complete, true);
    assert.equal(exported.source.history_pages, 3);
    assert.equal(exported.messages.length, 3);
    assert.equal(exported.messages[0].id, "m1");
    assert.equal(exported.messages[2].role, "user", "Native role must remain untouched");
    assert.equal(progress.at(-1).messageCount, 3);
    const media = sources.mediaConversation(exported);
    assert.equal(media.mapping.m1.message.author.role, "user");
    assert.equal(media.mapping.m2.message.author.role, "assistant");
    assert.equal(media.mapping.m1.message.metadata.attachments[0].file_id, "CalpicoFile_test");
    assert(media.mapping.m1.message.metadata.attachments[0].url.endsWith("/files/CalpicoFile_test"));
    assert.equal(exported.messages[0].content.attachments[0].file_id, "CalpicoFile_test");

    await assert.rejects(sources.load(source, {
        requestJSON: requests([{ items: [newest] }, { items: [newest] }]),
    }), /progress/);
    await assert.rejects(sources.load(source, {
        requestJSON: requests([{ items: [message("unknown", "stranger", "01")] }]),
    }), /sender/);
    await assert.rejects(sources.load(source, {
        requestJSON: requests([{ items: [], prev_cursor: "older" }]),
    }), /empty page/);
    await assert.rejects(sources.load(source, {
        requestJSON: requests([{ items: [{ ...oldest, created_at: "not-a-date" }] }]),
    }), /timestamp/);
    const controller = new AbortController();
    await assert.rejects(sources.load(source, {
        requestJSON: requests([{ items: [newest] }]),
        signal: controller.signal,
        onProgress: () => controller.abort(),
    }), error => error.name === "AbortError");
    const chatSource = sources.resolve({ hostname: "chatgpt.com", pathname: "/g/custom/c/ordinary-chat" });
    const ordinary = { mapping: {}, title: "Raw ChatGPT Work fixture", extra: { untouched: true } };
    assert.strictEqual(await sources.load(chatSource, {
        requestJSON: async path => {
            assert.equal(path, "/backend-api/conversation/ordinary-chat");
            return ordinary;
        },
    }), ordinary);
    assert.strictEqual(sources.mediaConversation(ordinary), ordinary);
    console.log("LogGPT Dots source tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
