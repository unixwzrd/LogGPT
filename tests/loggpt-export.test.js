"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { webcrypto } = require("crypto");
const { TextDecoder } = require("util");

const fetchCalls = [];
const context = {
  __LOGGPT_TEST_MODE__: true,
  console,
  Blob,
  TextEncoder,
  TextDecoder,
  URL,
  crypto: webcrypto,
  location: { hostname: "chatgpt.com", pathname: "/c/thread" },
  window: { localStorage: { getItem() { return null; }, setItem() {} } },
  document: {},
  fetch: async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    const response = (body, type, disposition = null) => ({
      ok: true,
      headers: { get: name => ({ "content-type": type, "content-disposition": disposition }[String(name).toLowerCase()] || null) },
      blob: async () => new Blob([body], { type }),
    });
    if (String(url).includes("/files/file-chart/download")) {
      const descriptor = {
        download_url: "https://chatgpt.com/backend-api/estuary/content?id=file-chart&sig=test",
        file_name: "chart-output",
      };
      return {
        ok: true,
        headers: { get: () => "application/json" },
        clone() { return { json: async () => descriptor }; },
        blob: async () => new Blob([JSON.stringify(descriptor)], { type: "application/json" }),
      };
    }
    if (String(url).includes("estuary/content?id=file-chart")) {
      return response(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1]), "application/octet-stream", 'attachment; filename="final-chart.png"');
    }
    if (String(url).includes("file-vector")) return response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "image/svg+xml");
    if (String(url).includes("file-audio")) return response(Uint8Array.from([0x49, 0x44, 0x33, 1]), "application/octet-stream");
    if (String(url).includes("file-table")) return response("name\tvalue\na\t1\n", "text/tab-separated-values", 'attachment; filename="results.tsv"');
    if (String(url).includes("file-unknown")) return response(Uint8Array.from([1, 2, 3, 4]), "application/octet-stream");
    if (String(url).includes("file-upload")) return response(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
    if (String(url).includes("file-work-generated")) return response(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1]), "image/png");
    if (String(url).includes("file-work-upload")) return response(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 2]), "image/png");
    if (String(url).includes("interpreter/download") && String(url).includes("loggpt-artifact-test-chart.png")) {
      assert(String(url).includes("sandbox_path=%2Fworkspace%2Fscratch%2Ffixture%2Floggpt-artifact-test-chart.png"));
      return response(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 3]), "image/png", 'attachment; filename="loggpt-artifact-test-chart.png"');
    }
    if (String(url).includes("interpreter/download") && String(url).includes("loggpt-artifact-test-data.csv")) {
      return response("name,value\na,1\n", "text/csv", 'attachment; filename="loggpt-artifact-test-data.csv"');
    }
    if (String(url).includes("interpreter/download") && String(url).includes("loggpt-artifact-test-diagram.svg")) {
      return response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', "image/svg+xml", 'attachment; filename="loggpt-artifact-test-diagram.svg"');
    }
    if (String(url).includes("interpreter/download") && String(url).includes("loggpt-artifact-test-notes.md")) {
      return response("# Artifact notes\n", "text/markdown", 'attachment; filename="loggpt-artifact-test-notes.md"');
    }
    if (String(url).includes("interpreter/download") && String(url).includes("report.pdf")) {
      assert(String(url).includes("message_id=message-sandbox"));
      assert(String(url).includes("sandbox_path=%2Fmnt%2Fdata%2Freport.pdf"));
      return response("%PDF-1.7\nartifact", "application/octet-stream", 'attachment; filename="report.pdf"');
    }
    if (String(url).includes("file-library-upload")) return response("%PDF-1.7\nupload", "application/pdf");
    if (String(url).includes("file-preview")) return response(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
    throw new Error(`Unexpected fetch: ${url}`);
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("LogGPT-conv-export.js", "utf8"), context);
const api = context.__LOGGPT_TEST_API__;

assert.equal(api.getThreadId(), "thread");
assert.equal(api.isConversationPage(), true);
context.location.pathname = "/g/g-custom/c/conversation-123";
assert.equal(api.getThreadId(), "conversation-123");
assert.equal(api.isConversationPage(), true);
context.location.pathname = "/codex/cloud/settings/analytics";
assert.equal(api.getThreadId(), null);
assert.equal(api.isConversationPage(), false);
context.location.pathname = "/";
assert.equal(api.isConversationPage(), false);
context.location.pathname = "/c/thread";

assert.equal(
  api.buildExportStem("thread", { title: "A / Test", create_time: 1700000000, update_time: 1700086400 }),
  "2023-11-14-2023-11-15-a-test"
);
assert.equal(
  api.buildExportStem("thread", {
    title: "James Talarico Context",
    create_time: Date.parse("2026-05-28T00:00:00Z") / 1000,
    update_time: Date.parse("2026-08-12T00:00:00Z") / 1000,
  }),
  "2026-05-28-2026-08-12-james-talarico-context"
);
assert.equal(api.sanitizedSourceUrl("https://example.test/a.png?sig=secret"), "https://example.test/a.png");

const conversation = {
  title: "Archive",
  conversation_id: "conversation-1",
  mapping: {
    uploaded: { message: {
      id: "message-uploaded", author: { role: "user" }, content: { content_type: "multimodal_text" },
      metadata: { attachments: [{ id: "file-upload", name: "input.png", url: "https://chatgpt.com/backend-api/estuary/content?id=file-upload&sig=secret" }] },
    } },
    moreGenerated: { message: {
      id: "message-more", author: { role: "tool" }, content: { content_type: "execution_output" },
      metadata: {
        artifacts: [
          { file_id: "file-vector", title: "diagram", mime_type: "image/svg+xml" },
          { audio_asset_pointer: "file-service://file-audio", title: "narration" },
          { file_id: "file-table", title: "results" },
          { file_id: "file-unknown", title: "mystery" },
        ],
      },
    } },
    externalCitation: { message: {
      id: "message-external", author: { role: "assistant" }, content: { content_type: "text" },
      metadata: { citation: { url: "https://example.test/not-an-artifact.pdf" } },
    } },
    generated: { message: {
      id: "message-generated", author: { role: "tool" }, content: { content_type: "execution_output" },
      metadata: { ada_visualizations: [{ type: "chart", file_id: "file-chart", title: "Chart" }] },
    } },
    sandboxArtifact: { message: {
      id: "message-sandbox", author: { role: "assistant" },
      content: { content_type: "text", parts: ["[Report](sandbox:/mnt/data/report.pdf)"] },
      metadata: { content_references: [{ type: "file", source: "my_files", id: "file-library-upload", name: "source.pdf" }] },
    } },
    toolPreview: { message: {
      id: "message-preview", author: { role: "tool", name: "container.open_image" }, content: { content_type: "execution_output" },
      metadata: { attachments: [{ id: "file-preview", name: "/mnt/data/render/page-1.png", mime_type: "image/png" }] },
    } },
    trustedSearchResult: { message: {
      id: "message-search", author: { role: "assistant" }, content: { content_type: "text" },
      metadata: { search_result: { url: "https://images.openai.com/static/search-result.png", title: "Not an artifact" } },
    } },
    uploadedReferencedByTool: { message: {
      id: "message-reference", author: { role: "tool" }, content: { content_type: "execution_output" },
      metadata: { file_id: "file-upload" },
    } },
  },
};
const entries = api.scanConversationMedia(conversation);
assert(entries.some(entry => entry.canonicalId === "file-upload" && entry.origin === "uploaded"));
assert(entries.some(entry => entry.canonicalId === "file-chart" && entry.origin === "generated"));
assert(entries.some(entry => entry.originalFilename === "report.pdf" && entry.origin === "generated" && entry.sourceUrl.includes("/interpreter/download?message_id=message-sandbox&sandbox_path=")));
assert(entries.some(entry => entry.canonicalId === "file-library-upload" && entry.origin === "uploaded"));
assert(!entries.some(entry => entry.canonicalId === "file-preview"));
assert(!entries.some(entry => entry.sourceUrl === "https://example.test/not-an-artifact.pdf"));
assert(!entries.some(entry => entry.sourceUrl === "https://images.openai.com/static/search-result.png"));
const artifactCounts = api.getArtifactCounts(entries);
assert.equal(artifactCounts.total, entries.length);
assert.equal(artifactCounts.generated + artifactCounts.uploaded, artifactCounts.total);
assert.equal(artifactCounts.uploaded, entries.filter(entry => entry.origin === "uploaded").length);

const workConversation = {
  title: "ChatGPT Work archive",
  conversation_id: "work-conversation",
  mapping: {
    generatedImage: { message: {
      id: "message-work-image",
      author: { role: "tool", name: "work-image-tool" },
      content: { content_type: "multimodal_text", parts: [{
        content_type: "image_asset_pointer",
        asset_pointer: "sediment://file-work-generated",
        size_bytes: 2115045,
        width: 1254,
        height: 1254,
      }] },
      metadata: { image_gen_title: "Friendly Robot Organizes a Digital Archive" },
    } },
    generatedFiles: { message: {
      id: "message-work-files",
      author: { role: "assistant" },
      content: { content_type: "text", parts: [
        "[Chart](sandbox:/workspace/scratch/fixture/loggpt-artifact-test-chart.png)\n"
          + "[Data](sandbox:/workspace/scratch/fixture/loggpt-artifact-test-data.csv)\n"
          + "[Diagram](sandbox:/workspace/scratch/fixture/loggpt-artifact-test-diagram.svg)\n"
          + "[Notes](sandbox:/workspace/scratch/fixture/loggpt-artifact-test-notes.md)",
      ] },
      metadata: {},
    } },
    uploadedImages: { message: {
      id: "message-work-uploaded",
      author: { role: "user" },
      content: { content_type: "multimodal_text", parts: [
        { content_type: "image_asset_pointer", asset_pointer: "sediment://file-work-upload-1", width: 441, height: 207 },
        { content_type: "image_asset_pointer", asset_pointer: "sediment://file-work-upload-2", width: 493, height: 409 },
      ] },
      metadata: { attachments: [
        { id: "file-work-upload-1", library_file_id: "libfile-work-upload-1", name: "uploaded-one.png", mime_type: "image/png" },
        { id: "file-work-upload-2", library_file_id: "libfile-work-upload-2", name: "uploaded-two.png", mime_type: "image/png" },
      ] },
    } },
  },
};
const workEntries = api.scanConversationMedia(workConversation);
const workCounts = api.getArtifactCounts(workEntries);
assert.deepEqual({ ...workCounts }, { total: 7, generated: 5, uploaded: 2 });
assert(workEntries.some(entry => entry.canonicalId === "file-work-generated" && entry.origin === "generated"));
assert(workEntries.some(entry => entry.canonicalId === "file-work-generated" && entry.originalFilename === "Friendly Robot Organizes a Digital Archive"));
assert(workEntries.some(entry => entry.sourceUrl?.includes("sandbox_path=%2Fworkspace%2Fscratch%2Ffixture%2Floggpt-artifact-test-chart.png")));
assert.equal(workEntries.filter(entry => entry.canonicalId === "file-work-upload-1").length, 1);

function storedZipEntries(bytes) {
  const result = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString("utf8");
    result.set(name, bytes.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return result;
}

const progressEvents = [];
const exportController = new AbortController();
api.buildArchiveZipBlob(
  "archive",
  conversation,
  entries,
  "token",
  { includeGenerated: true, includeUploaded: true },
  { signal: exportController.signal, onProgress: event => progressEvents.push(event) }
)
  .then(async blob => {
    const bytes = Buffer.from(await blob.arrayBuffer());
    const files = storedZipEntries(bytes);
    assert(files.has("archive.json"));
    assert(files.has("archive/artifact-manifest.json"));
    assert([...files.keys()].some(name => name.endsWith("final-chart.png")), `${[...files.keys()].join("\n")}\n${fetchCalls.map(call => call.url).join("\n")}`);
    assert([...files.keys()].some(name => name.endsWith("diagram.svg")));
    assert([...files.keys()].some(name => name.endsWith("narration.mp3")));
    assert([...files.keys()].some(name => name.endsWith("results.tsv")));
    assert([...files.keys()].some(name => name.endsWith("mystery.bin")));
    assert(fetchCalls.some(call => call.url.includes("/estuary/content?id=file-chart")));
    assert([...files.keys()].some(name => name.includes("archive/artifacts/uploaded/input.png")));
    assert([...files.keys()].some(name => name.endsWith("archive/artifacts/generated/report.pdf")));
    assert([...files.keys()].some(name => name.endsWith("archive/artifacts/uploaded/source.pdf")));
    assert(!files.get("archive/artifact-manifest.json").toString("utf8").includes("sig=secret"));
    const manifest = JSON.parse(files.get("archive/artifact-manifest.json").toString("utf8"));
    assert.equal(manifest.format_version, 2);
    assert(manifest.artifacts.some(item => item.saved_filename === "narration.mp3" && item.detected_mime_type === "audio/mpeg"));
    assert(!fetchCalls.some(call => call.url.startsWith("https://example.test/")));
    assert(progressEvents.some(event => event.phase === "artifacts" && event.completed === entries.length && event.total === entries.length));
    assert(progressEvents.some(event => event.phase === "packaging" && event.completed === event.total));
    assert(fetchCalls.filter(call => call.url.includes("backend-api")).every(call => call.options.signal === exportController.signal));

    const cancelledController = new AbortController();
    const cancelledProgress = [];
    await assert.rejects(
      api.buildArchiveZipBlob(
        "cancelled",
        conversation,
        entries,
        "token",
        { includeGenerated: true, includeUploaded: true },
        {
          signal: cancelledController.signal,
          onProgress(event) {
            cancelledProgress.push(event);
            if (event.phase === "artifacts" && event.completed === 1) cancelledController.abort();
          },
        }
      ),
      error => error?.name === "AbortError"
    );
    assert(cancelledProgress.some(event => event.phase === "artifacts" && event.completed === 1));
    assert(!cancelledProgress.some(event => event.phase === "packaging"));

    const workBlob = await api.buildArchiveZipBlob(
      "work-archive",
      workConversation,
      workEntries,
      "token",
      { includeGenerated: true, includeUploaded: true }
    );
    const workFiles = storedZipEntries(Buffer.from(await workBlob.arrayBuffer()));
    const workManifest = JSON.parse(workFiles.get("work-archive/artifact-manifest.json").toString("utf8"));
    assert.equal(workManifest.item_count, 7);
    assert(workManifest.artifacts.every(item => item.download_status === "downloaded"));
    assert([...workFiles.keys()].some(name => name.endsWith("Friendly_Robot_Organizes_a_Digital_Archive.png")));
    assert([...workFiles.keys()].some(name => name.endsWith("loggpt-artifact-test-chart.png")));
    assert([...workFiles.keys()].some(name => name.endsWith("uploaded-one.png")));
    console.log("LogGPT exporter tests passed");
  })
  .catch(error => { console.error(error); process.exitCode = 1; });
