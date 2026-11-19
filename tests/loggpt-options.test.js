"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class FakeElement {
  constructor() {
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
    this.listeners = {};
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  async trigger(type) {
    return this.listeners[type]?.();
  }
}

(async () => {
  const ids = [
    "include-generated", "include-uploaded", "download-artifacts", "ask-every-time",
    "saved-message", "product-heading", "locked", "plus-settings", "open-loggpt",
    "refresh-entitlement", "select-all", "select-none", "reset-defaults",
    "download-current-conversation", "download-status",
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
  let hasPlus = false;
  let closeCount = 0;
  let activeTabs = [{ id: 7 }];
  let exportResponse = { started: true };
  let disconnected = false;
  const exportRequests = [];
  const stored = {
    "loggpt.promptOnDownload": true,
    "loggpt.includeMediaByDefault": true,
    "loggpt.includeGenerated": true,
    "loggpt.includeUploaded": true,
  };
  const context = {
    console,
    document: { getElementById: id => elements[id] },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { close: () => { closeCount += 1; }, setTimeout: () => {} },
    browser: {
      tabs: {
        async query(query) {
          assert.equal(query.active, true);
          assert.equal(query.currentWindow, true);
          return activeTabs;
        },
        async sendMessage(tabId, message, options) {
          assert.equal(tabId, 7);
          assert.equal(message.type, "loggpt.downloadCurrentConversation");
          assert.equal(options.frameId, 0);
          exportRequests.push(message);
          if (disconnected) throw new Error("Receiving end does not exist");
          return exportResponse;
        },
      },
      storage: {
        local: {
          async get() { return { ...stored }; },
          async set(values) { Object.assign(stored, values); },
          async remove(key) { delete stored[key]; },
        },
      },
      runtime: {
        async sendMessage(message) {
          if (message.type === "loggpt.openContainingApp") return { opened: true };
          return { hasPlus, displayPrice: "$2.99", source: hasPlus ? "verified-cache" : "basic" };
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("options.js", "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(elements["plus-settings"].hidden, true);
  // Basic and Plus share the fallback; the page still applies entitlement rules.
  const previousSettings = JSON.stringify(stored);
  await elements["download-current-conversation"].trigger("click");
  assert.equal(closeCount, 1);
  assert.equal(exportRequests.length, 1);
  assert.equal(JSON.stringify(stored), previousSettings);
  exportResponse = { started: false, error: "An export is already running." };
  await elements["download-current-conversation"].trigger("click");
  assert.equal(closeCount, 1);
  assert.equal(elements["download-status"].textContent, exportResponse.error);
  disconnected = true;
  await elements["download-current-conversation"].trigger("click");
  assert.match(elements["download-status"].textContent, /reload/);
  assert.equal(elements["download-current-conversation"].disabled, false);
  disconnected = false;
  activeTabs = [];
  await elements["download-current-conversation"].trigger("click");
  assert.match(elements["download-status"].textContent, /Open a ChatGPT/);
  assert.equal(closeCount, 1);
  activeTabs = [{ id: 7 }];
  exportResponse = undefined;
  await elements["download-current-conversation"].trigger("click");
  assert.match(elements["download-status"].textContent, /Reload/);
  const availableTabs = context.browser.tabs;
  delete context.browser.tabs;
  await elements["download-current-conversation"].trigger("click");
  assert.match(elements["download-status"].textContent, /cannot contact/);
  context.browser.tabs = availableTabs;
  exportResponse = { started: true };
  hasPlus = true;
  await elements["refresh-entitlement"].trigger("click");
  assert.equal(elements["plus-settings"].hidden, false);
  assert.equal(elements["download-artifacts"].checked, true);

  elements["download-artifacts"].checked = false;
  elements["include-generated"].checked = false;
  elements["include-uploaded"].checked = false;
  await elements["select-all"].trigger("click");
  assert.equal(elements["download-artifacts"].checked, true);
  assert.equal(elements["include-generated"].checked, true);
  assert.equal(elements["include-uploaded"].checked, true);

  await elements["open-loggpt"].trigger("click");
  assert.equal(closeCount, 2);
  console.log("LogGPT options tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
