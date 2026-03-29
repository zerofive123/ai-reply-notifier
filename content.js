// content.js
// Content-script entry: state detection + settings-aware notification flow.

(function startContentScript() {
  const LOG_PREFIX = "[AI Reply Notifier]";
  const COMPLETION_IDLE_MS = 2000;
  const COMPLETION_COOLDOWN_MS = 5000;
  const PANEL_ACTIVITY_REFRESH_MS = 1000;

  // Guard against accidental duplicate initialization.
  if (window.__AI_REPLY_NOTIFIER_INITIALIZED__) {
    return;
  }
  window.__AI_REPLY_NOTIFIER_INITIALIZED__ = true;

  function isPlatformEnabled(platform, settings) {
    if (platform === "chatgpt") {
      return settings.enableChatGPT;
    }

    if (platform === "gemini") {
      return settings.enableGemini;
    }

    return false;
  }

  function notifyModeToText(mode) {
    const map = {
      background_only: "仅后台提醒",
      background_or_inactive: "后台或无操作时提醒",
      always: "始终提醒"
    };

    return map[mode] || "未知";
  }

  function buildConfigSummary(settings) {
    return [
      `ChatGPT提醒：${settings.enableChatGPT ? "开" : "关"}`,
      `Gemini提醒：${settings.enableGemini ? "开" : "关"}`,
      `系统通知：${settings.enableSystemNotification ? "开" : "关"}`,
      `提醒模式：${notifyModeToText(settings.notifyMode)}`,
      `无操作判定：${settings.inactivityThresholdSec} 秒`,
      `冷却时间：${settings.notificationCooldownSec} 秒`,
      `调试日志：${settings.enableDebugLogs ? "开" : "关"}`
    ].join("；");
  }

  async function init() {
    const settingsApi = window.AINotifierSettings;
    const detectorApi = window.AINotifierDetector;
    const notifierApi = window.AINotifierNotifier;
    const stateApi = window.AINotifierState;
    const observerApi = window.AINotifierObserver;
    const panelApi = window.AINotifierDebugPanel;
    const activityApi = window.AINotifierActivityTracker;

    if (!settingsApi || !detectorApi || !notifierApi || !stateApi || !observerApi || !panelApi || !activityApi) {
      console.error(`${LOG_PREFIX} Required modules not found.`);
      return;
    }

    let settings = await settingsApi.loadSettings();

    function logDebug(message, extra) {
      if (!settings.enableDebugLogs) {
        return;
      }

      if (extra !== undefined) {
        console.log(`${LOG_PREFIX} ${message}`, extra);
        return;
      }

      console.log(`${LOG_PREFIX} ${message}`);
    }

    function logError(message, extra) {
      if (extra !== undefined) {
        console.error(`${LOG_PREFIX} ${message}`, extra);
        return;
      }

      console.error(`${LOG_PREFIX} ${message}`);
    }

    logDebug("Content script loaded.");

    const platform = detectorApi.detectPlatform();
    logDebug(`Current platform: ${platform}`);

    const platformDetector = detectorApi.initDetector(platform, { logger: logDebug });
    const notifier = notifierApi.createNotifier({ logger: logDebug, errorLogger: logError });
    const stateMachine = stateApi.createStateMachine({ logger: logDebug, errorLogger: logError });

    let previousSnapshot = platformDetector.getSnapshot();
    let latestMeaningfulChangeAt = 0;
    let lastCompletedAt = 0;
    let completionTimer = null;
    let activityTimer = null;

    const activityTracker = activityApi.createActivityTracker({
      logger: logDebug,
      onActivity: () => {
        refreshActivityPanel();
      },
      onFocusChange: () => {
        refreshActivityPanel();
      }
    });

    const initialActivity = activityTracker.getSnapshot();

    const panel = panelApi.createDebugPanel({
      visible: settings.showDebugPanel,
      pluginStatus: "运行中",
      platform,
      state: stateMachine.getState(),
      pageHidden: initialActivity.isPageHidden,
      windowFocused: initialActivity.isWindowFocused,
      lastActiveTime: initialActivity.lastActiveDate,
      inactiveSeconds: initialActivity.inactiveSeconds,
      notifyMode: settings.notifyMode,
      replyLength: previousSnapshot.latestReplyTextLength,
      lastNotificationSent: null,
      lastNotificationTime: null,
      lastNotificationFingerprint: null,
      lastNotificationReason: "--",
      configSummary: buildConfigSummary(settings),
      lastStateChangeTime: null,
      lastMutationTime: null
    });

    function refreshActivityPanel() {
      const snapshot = activityTracker.getSnapshot();
      panel.setPageHidden(snapshot.isPageHidden);
      panel.setWindowFocused(snapshot.isWindowFocused);
      panel.setLastActiveTime(snapshot.lastActiveDate);
      panel.setInactiveSeconds(snapshot.inactiveSeconds);
    }

    function applySettings(nextSettings) {
      settings = settingsApi.normalizeSettings(nextSettings);

      panel.setVisible(settings.showDebugPanel);
      panel.setNotifyMode(settings.notifyMode);
      panel.setConfigSummary(buildConfigSummary(settings));
      panel.setPluginStatus(
        isPlatformEnabled(platform, settings)
          ? "运行中"
          : "本平台提醒已关闭"
      );
    }

    function updatePanelFromSnapshot(snapshot) {
      panel.setReplyLength(snapshot.latestReplyTextLength);
    }

    function updatePanelNotification(result) {
      panel.setLastNotificationSent(result.sent);
      panel.setLastNotificationTime(result.at);
      panel.setLastNotificationFingerprint(result.fingerprint || "--");
      panel.setLastNotificationReason(result.reasonText || "--");
    }

    function transitionState(nextState, meta) {
      const before = stateMachine.getState();
      const after = stateMachine.setState(nextState, meta);

      if (after !== before) {
        panel.setLastStateChangeTime(new Date());
      }

      return after;
    }

    function scheduleCompletionCheck() {
      if (completionTimer) {
        clearTimeout(completionTimer);
      }

      const expectedMeaningfulAt = latestMeaningfulChangeAt;

      completionTimer = setTimeout(() => {
        if (expectedMeaningfulAt !== latestMeaningfulChangeAt) {
          return;
        }

        const now = Date.now();
        const idleFor = now - latestMeaningfulChangeAt;

        if (stateMachine.getState() === "generating" && idleFor >= COMPLETION_IDLE_MS) {
          transitionState("completed", { reason: "no_meaningful_answer_change_for_2s" });
          lastCompletedAt = Date.now();
        }
      }, COMPLETION_IDLE_MS);
    }

    function isInCompletionCooldown(nowMs) {
      if (lastCompletedAt === 0) {
        return false;
      }

      return (nowMs - lastCompletedAt) < COMPLETION_COOLDOWN_MS;
    }

    async function handleCompletedNotification() {
      const completionSnapshot = platformDetector.getSnapshot();
      updatePanelFromSnapshot(completionSnapshot);
      previousSnapshot = completionSnapshot;

      if (!isPlatformEnabled(platform, settings)) {
        logDebug("Skipped notification because current platform is disabled by settings.");
        updatePanelNotification({
          sent: false,
          reason: "platform_disabled",
          reasonText: "当前平台提醒已关闭",
          at: new Date(),
          fingerprint: completionSnapshot.replyFingerprint
        });
        return;
      }

      const activitySnapshot = activityTracker.getSnapshot();

      const result = await notifier.notifyOnCompleted({
        platform,
        settings,
        context: {
          isPageHidden: activitySnapshot.isPageHidden,
          isWindowFocused: activitySnapshot.isWindowFocused,
          inactiveSeconds: activitySnapshot.inactiveSeconds
        },
        replyFingerprint: completionSnapshot.replyFingerprint
      });

      updatePanelNotification(result);
    }

    stateMachine.subscribe((stateSnapshot) => {
      panel.setState(stateSnapshot.currentState);

      if (stateSnapshot.previousState === "generating" && stateSnapshot.currentState === "completed") {
        handleCompletedNotification().catch((error) => {
          logError("Completion notification flow failed:", error);
        });
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      const changedSettingItem = changes[settingsApi.STORAGE_KEY];
      if (!changedSettingItem) {
        return;
      }

      const nextSettings = settingsApi.normalizeSettings(changedSettingItem.newValue);
      applySettings(nextSettings);
      logDebug("Settings updated from storage.");
    });

    transitionState("observing", { event: "CONTENT_READY" });
    updatePanelFromSnapshot(previousSnapshot);

    applySettings(settings);

    activityTracker.start();
    refreshActivityPanel();
    activityTimer = setInterval(refreshActivityPanel, PANEL_ACTIVITY_REFRESH_MS);

    const pageObserver = observerApi.createPageObserver({
      platform,
      debounceMs: 500,
      logger: logDebug,
      errorLogger: logError,
      onMutationDetected: (details) => {
        panel.setLastMutationTime(details.detectedAt);

        const currentSnapshot = platformDetector.getSnapshot();
        const transition = platformDetector.analyzeTransition(previousSnapshot, currentSnapshot);
        const currentState = stateMachine.getState();
        const now = Date.now();

        updatePanelFromSnapshot(currentSnapshot);

        if (transition.answerTextGrowthChars > 0) {
          logDebug(`Answer text growth detected: +${transition.answerTextGrowthChars} chars`);
        }

        if (transition.newResponseBlockAdded) {
          logDebug("New answer block detected.");
        }

        if (transition.replyFingerprintMeaningfulChanged && transition.answerTextGrowthChars === 0) {
          logDebug("Answer fingerprint changed without length growth.");
        }

        if (!transition.hasMeaningfulAnswerChange) {
          if (currentState === "completed" && isInCompletionCooldown(now)) {
            logDebug("Suppressed generating transition due to completion cooldown.");
          } else {
            logDebug("Ignored mutation: no meaningful answer content change.");
          }

          previousSnapshot = currentSnapshot;
          return;
        }

        latestMeaningfulChangeAt = now;

        if (currentState === "completed" && isInCompletionCooldown(now)) {
          logDebug("Meaningful answer activity detected during cooldown. Allowing transition.");
        }

        transitionState("generating", { reasons: transition.reasons });
        scheduleCompletionCheck();

        previousSnapshot = currentSnapshot;
      },
      onMutationSettled: (details) => {
        panel.setLastMutationTime(details.settledAt);

        const settledSnapshot = platformDetector.getSnapshot();
        updatePanelFromSnapshot(settledSnapshot);
        previousSnapshot = settledSnapshot;
      }
    });

    pageObserver.start();

    window.addEventListener("pagehide", () => {
      pageObserver.stop();
      activityTracker.stop();

      if (completionTimer) {
        clearTimeout(completionTimer);
        completionTimer = null;
      }

      if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = null;
      }
    }, { once: true });

    if (settings.enableDebugLogs) {
      chrome.runtime.sendMessage({
        type: "AI_NOTIFIER_DEBUG",
        payload: {
          event: "CONTENT_INIT",
          platform,
          url: window.location.href,
          state: stateMachine.getState()
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((error) => {
        console.error(`${LOG_PREFIX} Failed to initialize content script.`, error);
      });
    }, { once: true });
  } else {
    init().catch((error) => {
      console.error(`${LOG_PREFIX} Failed to initialize content script.`, error);
    });
  }
})();
