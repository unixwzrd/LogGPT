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
    throw new Error(`Unexpected fetch: ${url}`);
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("LogGPT-conv-export.js", "utf8"), context);
const api = context.__LOGGPT_TEST_API__;

assert.equal(
  api.buildExportStem("thread", { title: "A / Test", create_time: 1700000000, update_time: 1700086400 }),
  "2023-11-14--2023-11-15--a-test"
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
    uploadedReferencedByTool: { message: {
      id: "message-reference", author: { role: "tool" }, content: { content_type: "execution_output" },
      metadata: { file_id: "file-upload" },
    } },
  },
};
const entries = api.scanConversationMedia(conversation);
assert(entries.some(entry => entry.canonicalId === "file-upload" && entry.origin === "uploaded"));
assert(entries.some(entry => entry.canonicalId === "file-chart" && entry.origin === "generated"));
assert(!entries.some(entry => entry.sourceUrl === "https://example.test/not-an-artifact.pdf"));

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

api.buildArchiveZipBlob("archive", conversation, entries, "token", { includeGenerated: true, includeUploaded: true })
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
    assert(!files.get("archive/artifact-manifest.json").toString("utf8").includes("sig=secret"));
    const manifest = JSON.parse(files.get("archive/artifact-manifest.json").toString("utf8"));
    assert.equal(manifest.format_version, 2);
    assert(manifest.artifacts.some(item => item.saved_filename === "narration.mp3" && item.detected_mime_type === "audio/mpeg"));
    assert(!fetchCalls.some(call => call.url.startsWith("https://example.test/")));
    console.log("LogGPT exporter tests passed");
  })
  .catch(error => { console.error(error); process.exitCode = 1; });
