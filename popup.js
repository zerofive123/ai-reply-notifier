// popup.js
// Popup page logic. All user-facing text is Chinese.

(function initPopupPage() {
  const settingsApi = window.AINotifierSettings;
  if (!settingsApi) {
    return;
  }

  const openOptionsBtn = document.getElementById("open-options-btn");
  const popupStatus = document.getElementById("popup-status");

  const statusElements = {
    chatgpt: document.getElementById("chatgpt-status"),
    gemini: document.getElementById("gemini-status"),
    systemNotification: document.getElementById("system-notification-status"),
    notifyMode: document.getElementById("notify-mode-status"),
    inactivity: document.getElementById("inactivity-status"),
    cooldown: document.getElementById("cooldown-status"),
    panel: document.getElementById("panel-status"),
    logs: document.getElementById("logs-status")
  };

  function boolToText(value) {
    return value ? "开启" : "关闭";
  }

  function notifyModeToText(mode) {
    const map = {
      background_only: "仅后台提醒",
      background_or_inactive: "后台或无操作时提醒",
      always: "始终提醒"
    };

    return map[mode] || "未知";
  }

  function renderSettings(settings) {
    statusElements.chatgpt.textContent = boolToText(settings.enableChatGPT);
    statusElements.gemini.textContent = boolToText(settings.enableGemini);
    statusElements.systemNotification.textContent = boolToText(settings.enableSystemNotification);
    statusElements.notifyMode.textContent = notifyModeToText(settings.notifyMode);
    statusElements.inactivity.textContent = `${settings.inactivityThresholdSec} 秒`;
    statusElements.cooldown.textContent = `${settings.notificationCooldownSec} 秒`;
    statusElements.panel.textContent = boolToText(settings.showDebugPanel);
    statusElements.logs.textContent = boolToText(settings.enableDebugLogs);
  }

  async function loadSettings() {
    const settings = await settingsApi.loadSettings();
    renderSettings(settings);
  }

  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        popupStatus.textContent = `打开设置页失败：${chrome.runtime.lastError.message}`;
        return;
      }

      popupStatus.textContent = "已打开设置页面。";
    });
  });

  loadSettings().catch((error) => {
    popupStatus.textContent = `读取设置失败：${error.message || error}`;
  });
})();
