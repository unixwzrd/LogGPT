function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "LogGPT’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-off')[0].innerText = "LogGPT’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('state-unknown')[0].innerText = "You can turn on LogGPT’s extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

function updatePlusPurchase(status) {
    const purchaseButton = document.getElementById("purchase-plus");
    const restoreButton = document.getElementById("restore-purchases");
    const statusText = document.getElementById("plus-status");
    const heading = document.getElementById("plus-heading");
    const eyebrow = document.getElementById("plus-eyebrow");
    const sourceText = document.getElementById("plus-source");
    const debugControls = document.getElementById("debug-plus-controls");
    if (!purchaseButton || !restoreButton || !statusText) return;

    statusText.innerText = status.message || "";
    purchaseButton.disabled = Boolean(status.isLoading || status.hasPlus || !status.displayPrice);
    restoreButton.disabled = Boolean(status.isLoading);
    purchaseButton.hidden = Boolean(status.hasPlus);
    restoreButton.hidden = Boolean(status.hasPlus);
    heading.innerText = status.hasPlus ? "LogGPT Plus is active" : "Get LogGPT Plus";
    eyebrow.innerText = status.hasPlus ? "PLUS UNLOCKED" : "ONE-TIME UPGRADE";
    sourceText.innerText = status.entitlementSource ? `Status: ${status.entitlementSource}` : "";
    debugControls.hidden = !status.showDebugControls;
    if (status.displayPrice) {
        purchaseButton.innerText = `Upgrade to Plus — ${status.displayPrice}`;
    }
}

function sendAction(action) {
    webkit.messageHandlers.controller.postMessage({ action });
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
document.getElementById("purchase-plus").addEventListener("click", () => sendAction("purchase-plus"));
document.getElementById("restore-purchases").addEventListener("click", () => sendAction("restore-purchases"));
document.getElementById("reset-plus-development-cache").addEventListener("click", () => sendAction("reset-plus-development-cache"));
