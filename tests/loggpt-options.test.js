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
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
  let hasPlus = false;
  let closeCount = 0;
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
  assert.equal(closeCount, 1);
  console.log("LogGPT options tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
