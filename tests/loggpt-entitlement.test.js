"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadBackground(name, nativeResponse) {
  let listener;
  const context = {
    console,
    browser: {
      action: { setIcon: async () => {} },
      runtime: {
        getManifest: () => ({ name }),
        getURL: path => `extension://${path}`,
        sendNativeMessage: async (_application, message) => {
          assert.equal(message.command, "getPlusEntitlement");
          return nativeResponse;
        },
        onMessage: { addListener(value) { listener = value; } },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("background.js", "utf8"), context);
  return listener;
}

(async () => {
  const basicLocked = loadBackground("LogGPT", { hasPlus: false, source: "development-basic-override", displayPrice: "$2.99" });
  assert.deepEqual(
    await basicLocked({ type: "loggpt.getPlusEntitlement" }),
    { hasPlus: false, source: "development-basic-override", displayPrice: "$2.99" }
  );

  const basicUnlocked = loadBackground("LogGPT", { hasPlus: true, source: "verified-cache", displayPrice: "$2.99" });
  assert.equal((await basicUnlocked({ type: "loggpt.getPlusEntitlement" })).hasPlus, true);

  const plusBuild = loadBackground("LogGPT Plus", { hasPlus: false });
  assert.deepEqual(
    await plusBuild({ type: "loggpt.getPlusEntitlement" }),
    { hasPlus: true, source: "plus-build" }
  );

  console.log("LogGPT entitlement tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
