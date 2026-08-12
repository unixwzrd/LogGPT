(function() {
  const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

  function manifestIncludesPlus() {
    return /\bplus\b/i.test(String(extensionAPI.runtime.getManifest().name || ""));
  }

  async function setPlusToolbarIcon(hasPlus) {
    const action = extensionAPI.action || extensionAPI.browserAction;
    if (!action?.setIcon) return;
    const prefix = hasPlus && !manifestIncludesPlus() ? "icons/plus/" : "icons/";
    await action.setIcon({
      path: {
        16: `${prefix}Icon-16.png`,
        32: `${prefix}Icon-32.png`,
        48: `${prefix}Icon-48.png`,
        96: `${prefix}Icon-96.png`,
        128: `${prefix}Icon-128.png`,
      },
    });
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
        setPlusToolbarIcon(true).catch(() => {});
        return Promise.resolve({ hasPlus: true, source: "plus-build" });
      }
      return sendNative({ command: "getPlusEntitlement" })
        .then(response => {
          const hasPlus = response?.hasPlus === true;
          setPlusToolbarIcon(hasPlus).catch(() => {});
          return {
            hasPlus,
            source: response?.source || (hasPlus ? "verified-cache" : "basic"),
            displayPrice: response?.displayPrice || null,
          };
        })
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

  if (manifestIncludesPlus()) {
    setPlusToolbarIcon(true).catch(() => {});
  } else {
    sendNative({ command: "getPlusEntitlement" })
      .then(response => setPlusToolbarIcon(response?.hasPlus === true))
      .catch(() => setPlusToolbarIcon(false));
  }
})();
