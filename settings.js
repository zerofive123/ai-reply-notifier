// settings.js
// Shared settings module used by content script, options page, and popup page.

(function registerSettings(globalObj) {
  const STORAGE_KEY = "ai_reply_notifier_settings";

  const NOTIFY_MODES = {
    BACKGROUND_ONLY: "background_only",
    BACKGROUND_OR_INACTIVE: "background_or_inactive",
    ALWAYS: "always"
  };

  const DEFAULT_SETTINGS = {
    enableChatGPT: true,
    enableGemini: true,
    enableSystemNotification: true,
    notifyMode: NOTIFY_MODES.BACKGROUND_ONLY,
    inactivityThresholdSec: 60,
    notificationCooldownSec: 10,
    showDebugPanel: true,
    enableDebugLogs: true
  };

  function toSafeNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return parsed;
  }

  function normalizeNotifyMode(input) {
    const rawMode = String(input && input.notifyMode ? input.notifyMode : "").trim();

    if (rawMode === NOTIFY_MODES.BACKGROUND_ONLY
      || rawMode === NOTIFY_MODES.BACKGROUND_OR_INACTIVE
      || rawMode === NOTIFY_MODES.ALWAYS) {
      return rawMode;
    }

    // Backward compatibility with old boolean setting.
    if (typeof input?.notifyWhenHiddenOnly === "boolean") {
      return input.notifyWhenHiddenOnly
        ? NOTIFY_MODES.BACKGROUND_ONLY
        : NOTIFY_MODES.ALWAYS;
    }

    return DEFAULT_SETTINGS.notifyMode;
  }

  function normalizeSettings(rawValue) {
    const input = rawValue && typeof rawValue === "object" ? rawValue : {};

    const notificationCooldownSec = Math.max(
      1,
      Math.floor(toSafeNumber(input.notificationCooldownSec, DEFAULT_SETTINGS.notificationCooldownSec))
    );

    const inactivityThresholdSec = Math.max(
      1,
      Math.floor(toSafeNumber(input.inactivityThresholdSec, DEFAULT_SETTINGS.inactivityThresholdSec))
    );

    return {
      enableChatGPT: input.enableChatGPT !== undefined ? Boolean(input.enableChatGPT) : DEFAULT_SETTINGS.enableChatGPT,
      enableGemini: input.enableGemini !== undefined ? Boolean(input.enableGemini) : DEFAULT_SETTINGS.enableGemini,
      enableSystemNotification: input.enableSystemNotification !== undefined
        ? Boolean(input.enableSystemNotification)
        : DEFAULT_SETTINGS.enableSystemNotification,
      notifyMode: normalizeNotifyMode(input),
      inactivityThresholdSec,
      notificationCooldownSec,
      showDebugPanel: input.showDebugPanel !== undefined ? Boolean(input.showDebugPanel) : DEFAULT_SETTINGS.showDebugPanel,
      enableDebugLogs: input.enableDebugLogs !== undefined ? Boolean(input.enableDebugLogs) : DEFAULT_SETTINGS.enableDebugLogs
    };
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          resolve({ ...DEFAULT_SETTINGS });
          return;
        }

        resolve(normalizeSettings(result[STORAGE_KEY]));
      });
    });
  }

  function saveSettings(partialSettings) {
    return new Promise((resolve, reject) => {
      loadSettings().then((currentSettings) => {
        const merged = normalizeSettings({
          ...currentSettings,
          ...(partialSettings || {})
        });

        chrome.storage.local.set({ [STORAGE_KEY]: merged }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve(merged);
        });
      });
    });
  }

  function resetSettings() {
    return new Promise((resolve, reject) => {
      const normalizedDefaults = normalizeSettings(DEFAULT_SETTINGS);
      chrome.storage.local.set({ [STORAGE_KEY]: normalizedDefaults }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(normalizedDefaults);
      });
    });
  }

  globalObj.AINotifierSettings = {
    STORAGE_KEY,
    NOTIFY_MODES,
    DEFAULT_SETTINGS,
    normalizeSettings,
    loadSettings,
    saveSettings,
    resetSettings
  };
})(window);
