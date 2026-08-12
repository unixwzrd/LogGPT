(function() {
  const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

  function manifestIncludesPlus() {
    return /\bplus\b/i.test(String(extensionAPI.runtime.getManifest().name || ""));
  }

  async function sendNative(message) {
    if (!extensionAPI.runtime.sendNativeMessage) {
      throw new Error("Native messaging is unavailable");
    }
    return extensionAPI.runtime.sendNativeMessage("application.id", message);
  }

  extensionAPI.runtime.onMessage.addListener(message => {
    if (message?.type === "loggpt.getPlusEntitlement") {
      if (manifestIncludesPlus()) {
        return Promise.resolve({ hasPlus: true, source: "plus-build" });
      }
      return sendNative({ command: "getPlusEntitlement" })
        .then(response => ({
          hasPlus: response?.hasPlus === true,
          source: response?.source || "verified-cache",
        }))
        .catch(error => ({
          hasPlus: false,
          source: "unavailable",
          error: String(error),
        }));
    }

    if (message?.type === "loggpt.openContainingApp") {
      return sendNative({ command: "openContainingApp" })
        .catch(error => ({ opened: false, error: String(error) }));
    }

    return undefined;
  });
})();
