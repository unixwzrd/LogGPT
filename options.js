(function() {
  const STORAGE_KEYS = {
    promptOnDownload: "loggpt.promptOnDownload",
    includeMediaByDefault: "loggpt.includeMediaByDefault",
    includeGenerated: "loggpt.includeGenerated",
    includeUploaded: "loggpt.includeUploaded",
    basicUpgradeNoticeDismissed: "loggpt.basicUpgradeNoticeDismissed",
  };

  function getStorageArea() {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      return browser.storage.local;
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome.storage.local;
    }
    return null;
  }

  function getRuntime() {
    if (typeof browser !== "undefined" && browser.runtime) return browser.runtime;
    if (typeof chrome !== "undefined" && chrome.runtime) return chrome.runtime;
    return null;
  }

  async function requestEntitlement() {
    const runtime = getRuntime();
    if (!runtime?.sendMessage) return { hasPlus: false, displayPrice: null };
    try {
      const response = await runtime.sendMessage({ type: "loggpt.getPlusEntitlement" });
      return {
        hasPlus: response?.hasPlus === true,
        displayPrice: response?.displayPrice || null,
        source: response?.source || "basic",
      };
    } catch (error) {
      console.error("[LogGPT Plus] Could not check entitlement", error);
      return { hasPlus: false, displayPrice: null, source: "unavailable" };
    }
  }

  async function readSettings() {
    const storage = getStorageArea();
    if (!storage) {
      return {
        promptOnDownload: localStorage.getItem(STORAGE_KEYS.promptOnDownload) !== "false",
        includeMediaByDefault: localStorage.getItem(STORAGE_KEYS.includeMediaByDefault) !== "false",
        includeGenerated: localStorage.getItem(STORAGE_KEYS.includeGenerated) !== "false",
        includeUploaded: localStorage.getItem(STORAGE_KEYS.includeUploaded) !== "false",
      };
    }

    const values = await storage.get(Object.values(STORAGE_KEYS));
    return {
      promptOnDownload: values[STORAGE_KEYS.promptOnDownload] !== false,
      includeMediaByDefault: values[STORAGE_KEYS.includeMediaByDefault] !== false,
      includeGenerated: values[STORAGE_KEYS.includeGenerated] !== false,
      includeUploaded: values[STORAGE_KEYS.includeUploaded] !== false,
    };
  }

  async function writeSettings(settings) {
    const storage = getStorageArea();
    if (!storage) {
      localStorage.setItem(STORAGE_KEYS.promptOnDownload, String(settings.promptOnDownload));
      localStorage.setItem(STORAGE_KEYS.includeMediaByDefault, String(settings.includeMediaByDefault));
      localStorage.setItem(STORAGE_KEYS.includeGenerated, String(settings.includeGenerated));
      localStorage.setItem(STORAGE_KEYS.includeUploaded, String(settings.includeUploaded));
      return;
    }
    await storage.set({
      [STORAGE_KEYS.promptOnDownload]: settings.promptOnDownload,
      [STORAGE_KEYS.includeMediaByDefault]: settings.includeMediaByDefault,
      [STORAGE_KEYS.includeGenerated]: settings.includeGenerated,
      [STORAGE_KEYS.includeUploaded]: settings.includeUploaded,
    });
  }

  async function initialize() {
    const generatedCheckbox = document.getElementById("include-generated");
    const uploadedCheckbox = document.getElementById("include-uploaded");
    const downloadArtifactsCheckbox = document.getElementById("download-artifacts");
    const askEveryTimeCheckbox = document.getElementById("ask-every-time");
    const savedMessage = document.getElementById("saved-message");

    function updateArtifactControls() {
      generatedCheckbox.disabled = !downloadArtifactsCheckbox.checked;
      uploadedCheckbox.disabled = !downloadArtifactsCheckbox.checked;
    }

    async function loadSettings() {
      const settings = await readSettings();
      generatedCheckbox.checked = settings.includeGenerated;
      uploadedCheckbox.checked = settings.includeUploaded;
      downloadArtifactsCheckbox.checked = settings.includeMediaByDefault;
      askEveryTimeCheckbox.checked = settings.promptOnDownload;
      updateArtifactControls();
    }

    async function persist() {
      const nextSettings = {
        promptOnDownload: askEveryTimeCheckbox.checked,
        includeMediaByDefault: downloadArtifactsCheckbox.checked,
        includeGenerated: generatedCheckbox.checked,
        includeUploaded: uploadedCheckbox.checked,
      };
      await writeSettings(nextSettings);
      savedMessage.textContent = "Saved";
      window.setTimeout(() => {
        if (savedMessage.textContent === "Saved") {
          savedMessage.textContent = "";
        }
      }, 1200);
    }

    async function showEntitlement() {
      savedMessage.textContent = "Checking Plus access…";
      const entitlement = await requestEntitlement();
      const hasPlus = entitlement.hasPlus;
      document.getElementById("product-heading").textContent = hasPlus ? "LogGPT Plus" : "LogGPT";
      document.getElementById("locked").hidden = hasPlus;
      document.getElementById("plus-settings").hidden = !hasPlus;
      const upgradeButton = document.getElementById("open-loggpt");
      upgradeButton.textContent = entitlement.displayPrice
        ? `Upgrade to LogGPT Plus — ${entitlement.displayPrice}`
        : "Get LogGPT Plus…";
      if (hasPlus) {
        await loadSettings();
      }
      savedMessage.textContent = "";
      return hasPlus;
    }

    document.getElementById("open-loggpt").addEventListener("click", async () => {
      const runtime = getRuntime();
      const response = await runtime?.sendMessage?.({ type: "loggpt.openContainingApp" });
      if (response?.opened !== false) {
        window.close();
      }
    });
    document.getElementById("refresh-entitlement").addEventListener("click", showEntitlement);

    generatedCheckbox.addEventListener("change", persist);
    uploadedCheckbox.addEventListener("change", persist);
    askEveryTimeCheckbox.addEventListener("change", persist);
    downloadArtifactsCheckbox.addEventListener("change", () => {
      updateArtifactControls();
      persist();
    });
    document.getElementById("select-all").addEventListener("click", () => {
      downloadArtifactsCheckbox.checked = true;
      generatedCheckbox.checked = true;
      uploadedCheckbox.checked = true;
      updateArtifactControls();
      persist();
    });
    document.getElementById("reset-defaults").addEventListener("click", async () => {
      downloadArtifactsCheckbox.checked = true;
      generatedCheckbox.checked = true;
      uploadedCheckbox.checked = true;
      askEveryTimeCheckbox.checked = true;
      updateArtifactControls();
      await persist();
      const storage = getStorageArea();
      if (storage) {
        await storage.remove(STORAGE_KEYS.basicUpgradeNoticeDismissed);
      } else {
        localStorage.removeItem(STORAGE_KEYS.basicUpgradeNoticeDismissed);
      }
      savedMessage.textContent = "Defaults restored";
    });
    document.getElementById("select-none").addEventListener("click", () => {
      downloadArtifactsCheckbox.checked = false;
      generatedCheckbox.checked = false;
      uploadedCheckbox.checked = false;
      updateArtifactControls();
      persist();
    });

    await showEntitlement();
  }

  initialize().catch(error => {
    console.error("[LogGPT Plus]", error);
  });
})();
