// notifier.js
// Notification decision layer with dedupe and cooldown.

(function registerNotifier(globalObj) {
  const DEFAULT_NOTIFICATION_COOLDOWN_MS = 10000;
  const DEFAULT_NOTIFICATION_ICON = "icons/icon128.png";
  const CHATGPT_NOTIFICATION_ICON = "icons/notify-chatgpt-128.png";
  const GEMINI_NOTIFICATION_ICON = "icons/notify-gemini-128.png";

  function showDebugNotification(message) {
    console.log(`[AI Reply Notifier][Debug Notification] ${message}`);
  }

  function toPlatformLabel(platform) {
    if (platform === "chatgpt") {
      return "ChatGPT";
    }

    if (platform === "gemini") {
      return "Gemini";
    }

    return "AI";
  }

  // Pick a platform-specific notification icon path, with a safe default fallback.
  function getNotificationIcon(platform, logger) {
    if (platform === "chatgpt") {
      if (typeof logger === "function") {
        logger("Using notification icon for platform: chatgpt");
      }

      return CHATGPT_NOTIFICATION_ICON;
    }

    if (platform === "gemini") {
      if (typeof logger === "function") {
        logger("Using notification icon for platform: gemini");
      }

      return GEMINI_NOTIFICATION_ICON;
    }

    if (typeof logger === "function") {
      logger("Falling back to default notification icon.");
    }

    return DEFAULT_NOTIFICATION_ICON;
  }

  function getNotifyReasonText(reasonKey) {
    const map = {
      page_hidden: "页面隐藏",
      window_focus_lost: "窗口失焦",
      long_inactivity: "长时间无操作",
      always_mode: "始终提醒模式",
      active_and_focused: "页面在前台且用户活跃",
      duplicate: "重复提醒已跳过",
      cooldown: "提醒冷却中",
      system_disabled: "系统通知已关闭"
    };

    return map[reasonKey] || "未触发";
  }

  function resolveNotifyDecision(settings, context) {
    const mode = settings.notifyMode || "background_only";
    const isPageHidden = Boolean(context.isPageHidden);
    const isWindowFocused = Boolean(context.isWindowFocused);
    const inactiveSeconds = Number(context.inactiveSeconds) || 0;
    const inactivityThresholdSec = Math.max(1, Number(settings.inactivityThresholdSec || 60));

    if (mode === "always") {
      return { shouldNotify: true, reasonKey: "always_mode" };
    }

    if (mode === "background_only") {
      if (isPageHidden) {
        return { shouldNotify: true, reasonKey: "page_hidden" };
      }

      if (!isWindowFocused) {
        return { shouldNotify: true, reasonKey: "window_focus_lost" };
      }

      return { shouldNotify: false, reasonKey: "active_and_focused" };
    }

    // mode === background_or_inactive
    if (isPageHidden) {
      return { shouldNotify: true, reasonKey: "page_hidden" };
    }

    if (!isWindowFocused) {
      return { shouldNotify: true, reasonKey: "window_focus_lost" };
    }

    if (inactiveSeconds >= inactivityThresholdSec) {
      return { shouldNotify: true, reasonKey: "long_inactivity" };
    }

    return { shouldNotify: false, reasonKey: "active_and_focused" };
  }

  function createNotifier(config) {
    const logger = config && typeof config.logger === "function"
      ? config.logger
      : function noop() {};
    const errorLogger = config && typeof config.errorLogger === "function"
      ? config.errorLogger
      : function defaultErrorLogger(message, error) {
          console.error(message, error);
        };

    let lastNotifiedFingerprint = "";
    let lastNotifiedAt = 0;

    function getState() {
      return {
        lastNotifiedFingerprint,
        lastNotifiedAt
      };
    }

    function sendNotificationToBackground(payload) {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({
            type: "AI_NOTIFIER_SHOW_NOTIFICATION",
            payload
          }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({
                ok: false,
                error: chrome.runtime.lastError.message
              });
              return;
            }

            resolve(response || { ok: false, error: "No response from background." });
          });
        } catch (error) {
          resolve({
            ok: false,
            error: String(error)
          });
        }
      });
    }

    async function notifyOnCompleted(args) {
      const platform = args && args.platform ? args.platform : "unknown";
      const settings = args && args.settings ? args.settings : {};
      const context = args && args.context ? args.context : {};
      const replyFingerprint = args && args.replyFingerprint ? args.replyFingerprint : "unknown";

      const now = Date.now();
      const nowDate = new Date(now);
      const cooldownMs = Math.max(
        0,
        Math.floor(Number(settings.notificationCooldownSec || 10) * 1000)
      ) || DEFAULT_NOTIFICATION_COOLDOWN_MS;

      const inactiveSeconds = Number(context.inactiveSeconds) || 0;
      logger(`User inactive for ${inactiveSeconds}s.`);

      if (!settings.enableSystemNotification) {
        logger("Skipped notification because system notifications are disabled.");
        return {
          sent: false,
          reason: "system_disabled",
          reasonText: getNotifyReasonText("system_disabled"),
          at: nowDate,
          fingerprint: replyFingerprint
        };
      }

      const decision = resolveNotifyDecision(settings, context);
      if (!decision.shouldNotify) {
        logger("Skipped notification because user is active and page is focused.");
        return {
          sent: false,
          reason: decision.reasonKey,
          reasonText: getNotifyReasonText(decision.reasonKey),
          at: nowDate,
          fingerprint: replyFingerprint
        };
      }

      if (replyFingerprint === lastNotifiedFingerprint) {
        logger("Skipped duplicate notification.");
        return {
          sent: false,
          reason: "duplicate",
          reasonText: getNotifyReasonText("duplicate"),
          at: nowDate,
          fingerprint: replyFingerprint
        };
      }

      if (lastNotifiedAt > 0 && (now - lastNotifiedAt) < cooldownMs) {
        logger("Notification cooldown active.");
        return {
          sent: false,
          reason: "cooldown",
          reasonText: getNotifyReasonText("cooldown"),
          at: nowDate,
          fingerprint: replyFingerprint
        };
      }

      const platformLabel = toPlatformLabel(platform);
      const iconPath = getNotificationIcon(platform, logger);
      const response = await sendNotificationToBackground({
        title: "AI 回复已完成",
        message: `${platformLabel} 已完成本轮回答。`,
        iconPath
      });

      if (!response || !response.ok) {
        errorLogger("Failed to send notification.", response && response.error ? response.error : "unknown");
        return {
          sent: false,
          reason: "notification_error",
          reasonText: "通知发送失败",
          at: nowDate,
          fingerprint: replyFingerprint
        };
      }

      lastNotifiedFingerprint = replyFingerprint;
      lastNotifiedAt = now;

      if (decision.reasonKey === "long_inactivity") {
        logger("Notification reason: long inactivity.");
      } else if (decision.reasonKey === "window_focus_lost") {
        logger("Notification reason: window focus lost.");
      } else if (decision.reasonKey === "page_hidden") {
        logger("Notification reason: page hidden.");
      } else {
        logger("Notification reason: always mode.");
      }

      logger("Notification sent.");

      return {
        sent: true,
        reason: decision.reasonKey,
        reasonText: getNotifyReasonText(decision.reasonKey),
        at: nowDate,
        fingerprint: replyFingerprint
      };
    }

    return {
      getState,
      notifyOnCompleted
    };
  }

  globalObj.AINotifierNotifier = {
    showDebugNotification,
    createNotifier,
    getNotifyReasonText,
    getNotificationIcon
  };
})(window);
