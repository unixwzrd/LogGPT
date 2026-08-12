"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { webcrypto } = require("crypto");

const fetchCalls = [];
const context = {
  __LOGGPT_TEST_MODE__: true,
  console,
  Blob,
  TextEncoder,
  URL,
  crypto: webcrypto,
  location: { hostname: "chatgpt.com", pathname: "/c/thread" },
  window: { localStorage: { getItem() { return null; }, setItem() {} } },
  document: {},
  fetch: async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return { ok: true, blob: async () => new Blob(["artifact"], { type: "image/png" }) };
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
      metadata: { attachments: [{ id: "file-upload", name: "input.png", url: "https://example.test/input.png?sig=secret" }] },
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
    assert([...files.keys()].some(name => name.includes("archive/artifacts/generated/file-chart")));
    assert([...files.keys()].some(name => name.includes("archive/artifacts/uploaded/file-upload")));
    assert(!files.get("archive/artifact-manifest.json").toString("utf8").includes("sig=secret"));
    const externalCall = fetchCalls.find(call => call.url.startsWith("https://example.test/"));
    assert(externalCall);
    assert.equal(externalCall.options.credentials, "omit");
    assert.equal(externalCall.options.headers.Authorization, undefined);
    console.log("LogGPT exporter tests passed");
  })
  .catch(error => { console.error(error); process.exitCode = 1; });
