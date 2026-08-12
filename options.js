(function() {
  const STORAGE_KEYS = {
    promptOnDownload: "loggpt.promptOnDownload",
    includeMediaByDefault: "loggpt.includeMediaByDefault",
    includeGenerated: "loggpt.includeGenerated",
    includeUploaded: "loggpt.includeUploaded",
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
    if (!runtime?.sendMessage) return false;
    try {
      const response = await runtime.sendMessage({ type: "loggpt.getPlusEntitlement" });
      return response?.hasPlus === true;
    } catch (error) {
      console.error("[LogGPT Plus] Could not check entitlement", error);
      return false;
    }
  }

  async function readSettings() {
    const storage = getStorageArea();
    if (!storage) {
      return {
        promptOnDownload: false,
        includeMediaByDefault: localStorage.getItem(STORAGE_KEYS.includeMediaByDefault) !== "false",
        includeGenerated: localStorage.getItem(STORAGE_KEYS.includeGenerated) !== "false",
        includeUploaded: localStorage.getItem(STORAGE_KEYS.includeUploaded) !== "false",
      };
    }

    const values = await storage.get(Object.values(STORAGE_KEYS));
    return {
      promptOnDownload: false,
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
    const savedMessage = document.getElementById("saved-message");

    async function showEntitlement() {
      savedMessage.textContent = "Checking Plus access…";
      const hasPlus = await requestEntitlement();
      document.getElementById("product-heading").textContent = hasPlus ? "LogGPT Plus" : "LogGPT";
      document.getElementById("locked").hidden = hasPlus;
      document.getElementById("plus-settings").hidden = !hasPlus;
      savedMessage.textContent = "";
      return hasPlus;
    }

    document.getElementById("open-loggpt").addEventListener("click", async () => {
      const runtime = getRuntime();
      await runtime?.sendMessage?.({ type: "loggpt.openContainingApp" });
    });
    document.getElementById("refresh-entitlement").addEventListener("click", showEntitlement);

    if (!await showEntitlement()) return;

    const settings = await readSettings();
    generatedCheckbox.checked = settings.includeGenerated;
    uploadedCheckbox.checked = settings.includeUploaded;

    async function persist() {
      const nextSettings = {
        promptOnDownload: false,
        includeMediaByDefault: generatedCheckbox.checked || uploadedCheckbox.checked,
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

    generatedCheckbox.addEventListener("change", persist);
    uploadedCheckbox.addEventListener("change", persist);
    document.getElementById("select-all").addEventListener("click", () => {
      generatedCheckbox.checked = true;
      uploadedCheckbox.checked = true;
      persist();
    });
    document.getElementById("select-none").addEventListener("click", () => {
      generatedCheckbox.checked = false;
      uploadedCheckbox.checked = false;
      persist();
    });
  }

  initialize().catch(error => {
    console.error("[LogGPT Plus]", error);
  });
})();
