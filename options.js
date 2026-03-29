// options.js
// Options page logic (Chinese UI), persisted to chrome.storage.local.

(function initOptionsPage() {
  const settingsApi = window.AINotifierSettings;
  if (!settingsApi) {
    return;
  }

  const form = document.getElementById("settings-form");
  const resetBtn = document.getElementById("reset-btn");
  const statusText = document.getElementById("status-text");

  const fieldMap = {
    enableChatGPT: document.getElementById("enableChatGPT"),
    enableGemini: document.getElementById("enableGemini"),
    enableSystemNotification: document.getElementById("enableSystemNotification"),
    notifyMode: document.getElementById("notifyMode"),
    inactivityThresholdSec: document.getElementById("inactivityThresholdSec"),
    notificationCooldownSec: document.getElementById("notificationCooldownSec"),
    showDebugPanel: document.getElementById("showDebugPanel"),
    enableDebugLogs: document.getElementById("enableDebugLogs")
  };

  function setStatus(message, isError) {
    statusText.textContent = message;
    statusText.style.color = isError ? "#b91c1c" : "#2563eb";
  }

  function fillForm(settings) {
    fieldMap.enableChatGPT.checked = settings.enableChatGPT;
    fieldMap.enableGemini.checked = settings.enableGemini;
    fieldMap.enableSystemNotification.checked = settings.enableSystemNotification;
    fieldMap.notifyMode.value = settings.notifyMode;
    fieldMap.inactivityThresholdSec.value = String(settings.inactivityThresholdSec);
    fieldMap.notificationCooldownSec.value = String(settings.notificationCooldownSec);
    fieldMap.showDebugPanel.checked = settings.showDebugPanel;
    fieldMap.enableDebugLogs.checked = settings.enableDebugLogs;
  }

  function readForm() {
    const inactivityThresholdSec = Math.max(
      1,
      Math.floor(Number(fieldMap.inactivityThresholdSec.value || 60))
    );

    const cooldown = Math.max(
      1,
      Math.floor(Number(fieldMap.notificationCooldownSec.value || 10))
    );

    return {
      enableChatGPT: fieldMap.enableChatGPT.checked,
      enableGemini: fieldMap.enableGemini.checked,
      enableSystemNotification: fieldMap.enableSystemNotification.checked,
      notifyMode: fieldMap.notifyMode.value,
      inactivityThresholdSec,
      notificationCooldownSec: cooldown,
      showDebugPanel: fieldMap.showDebugPanel.checked,
      enableDebugLogs: fieldMap.enableDebugLogs.checked
    };
  }

  async function loadAndRender() {
    const settings = await settingsApi.loadSettings();
    fillForm(settings);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const nextSettings = settingsApi.normalizeSettings(readForm());
      const saved = await settingsApi.saveSettings(nextSettings);
      fillForm(saved);
      setStatus("设置已保存。", false);
    } catch (error) {
      setStatus(`保存失败：${error.message || error}`, true);
    }
  });

  resetBtn.addEventListener("click", async () => {
    try {
      const defaults = await settingsApi.resetSettings();
      fillForm(defaults);
      setStatus("已恢复默认设置。", false);
    } catch (error) {
      setStatus(`恢复默认失败：${error.message || error}`, true);
    }
  });

  loadAndRender().catch((error) => {
    setStatus(`读取设置失败：${error.message || error}`, true);
  });
})();
