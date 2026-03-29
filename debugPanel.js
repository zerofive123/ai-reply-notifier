// debugPanel.js
// Debug panel UI module. All user-facing labels are Chinese.

(function registerDebugPanel(globalObj) {
  const PANEL_ID = "ai-reply-notifier-panel";

  function toLocalTimeString(value) {
    if (!value) {
      return "--";
    }

    if (value instanceof Date) {
      return value.toLocaleTimeString();
    }

    return String(value);
  }

  function platformToText(platform) {
    if (platform === "chatgpt") {
      return "ChatGPT";
    }

    if (platform === "gemini") {
      return "Gemini";
    }

    return "未知";
  }

  function stateToText(state) {
    const map = {
      idle: "空闲",
      observing: "监测中",
      generating: "生成中",
      completed: "已完成"
    };

    return map[state] || "未知";
  }

  function notifyModeToText(mode) {
    const map = {
      background_only: "仅后台提醒",
      background_or_inactive: "后台或无操作时提醒",
      always: "始终提醒"
    };

    return map[mode] || "未知";
  }

  function boolToText(value) {
    return value ? "是" : "否";
  }

  function ensurePanelElement() {
    const existingPanel = document.getElementById(PANEL_ID);
    if (existingPanel) {
      return existingPanel;
    }

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "ai-reply-notifier-panel";

    panel.innerHTML = [
      '<div class="ain-header">AI 回复提醒</div>',
      '<div class="ain-row"><span class="ain-label">插件状态</span><span class="ain-value" data-ain-plugin-status>运行中</span></div>',
      '<div class="ain-row"><span class="ain-label">当前平台</span><span class="ain-value" data-ain-platform>未知</span></div>',
      '<div class="ain-row"><span class="ain-label">当前状态</span><span class="ain-value" data-ain-state>空闲</span></div>',
      '<div class="ain-row"><span class="ain-label">页面是否隐藏</span><span class="ain-value" data-ain-page-hidden>否</span></div>',
      '<div class="ain-row"><span class="ain-label">窗口是否聚焦</span><span class="ain-value" data-ain-window-focused>是</span></div>',
      '<div class="ain-row"><span class="ain-label">最近活动时间</span><span class="ain-value" data-ain-last-active-time>--</span></div>',
      '<div class="ain-row"><span class="ain-label">当前无操作时长</span><span class="ain-value" data-ain-inactive-seconds>0 秒</span></div>',
      '<div class="ain-row"><span class="ain-label">当前提醒模式</span><span class="ain-value" data-ain-notify-mode>仅后台提醒</span></div>',
      '<div class="ain-row"><span class="ain-label">回复长度</span><span class="ain-value" data-ain-reply-length>0</span></div>',
      '<div class="ain-row"><span class="ain-label">是否已发送提醒</span><span class="ain-value" data-ain-notify-sent>--</span></div>',
      '<div class="ain-row"><span class="ain-label">最近提醒时间</span><span class="ain-value" data-ain-notify-time>--</span></div>',
      '<div class="ain-row"><span class="ain-label">提醒指纹</span><span class="ain-value ain-value-wrap ain-value-fp" data-ain-notify-fp>--</span></div>',
      '<div class="ain-row"><span class="ain-label">本次提醒触发原因</span><span class="ain-value" data-ain-notify-reason>--</span></div>',
      '<div class="ain-row"><span class="ain-label">当前配置</span><span class="ain-value ain-value-wrap" data-ain-config>--</span></div>',
      '<div class="ain-row"><span class="ain-label">最近状态变化</span><span class="ain-value" data-ain-last-state-change>--</span></div>',
      '<div class="ain-row"><span class="ain-label">最近页面变化</span><span class="ain-value" data-ain-last-change>--</span></div>'
    ].join("");

    document.body.appendChild(panel);
    return panel;
  }

  function createDebugPanel(config) {
    const panel = ensurePanelElement();
    const pluginStatusEl = panel.querySelector("[data-ain-plugin-status]");
    const platformEl = panel.querySelector("[data-ain-platform]");
    const stateEl = panel.querySelector("[data-ain-state]");
    const pageHiddenEl = panel.querySelector("[data-ain-page-hidden]");
    const windowFocusedEl = panel.querySelector("[data-ain-window-focused]");
    const lastActiveTimeEl = panel.querySelector("[data-ain-last-active-time]");
    const inactiveSecondsEl = panel.querySelector("[data-ain-inactive-seconds]");
    const notifyModeEl = panel.querySelector("[data-ain-notify-mode]");
    const replyLengthEl = panel.querySelector("[data-ain-reply-length]");
    const notifySentEl = panel.querySelector("[data-ain-notify-sent]");
    const notifyTimeEl = panel.querySelector("[data-ain-notify-time]");
    const notifyFpEl = panel.querySelector("[data-ain-notify-fp]");
    const notifyReasonEl = panel.querySelector("[data-ain-notify-reason]");
    const configEl = panel.querySelector("[data-ain-config]");
    const lastStateChangeEl = panel.querySelector("[data-ain-last-state-change]");
    const lastChangeEl = panel.querySelector("[data-ain-last-change]");

    function setVisible(visible) {
      panel.style.display = visible ? "block" : "none";
    }

    function setPluginStatus(statusText) {
      pluginStatusEl.textContent = statusText || "运行中";
    }

    function setPlatform(platform) {
      platformEl.textContent = platformToText(platform);
    }

    function setState(state) {
      stateEl.textContent = stateToText(state);
    }

    function setPageHidden(hidden) {
      pageHiddenEl.textContent = boolToText(Boolean(hidden));
    }

    function setWindowFocused(focused) {
      windowFocusedEl.textContent = boolToText(Boolean(focused));
    }

    function setLastActiveTime(timeValue) {
      lastActiveTimeEl.textContent = toLocalTimeString(timeValue);
    }

    function setInactiveSeconds(value) {
      inactiveSecondsEl.textContent = `${Number(value) || 0} 秒`;
    }

    function setNotifyMode(mode) {
      notifyModeEl.textContent = notifyModeToText(mode);
    }

    function setReplyLength(lengthValue) {
      replyLengthEl.textContent = String(Number(lengthValue) || 0);
    }

    function setLastNotificationSent(sent) {
      if (sent === null || sent === undefined) {
        notifySentEl.textContent = "--";
        return;
      }

      notifySentEl.textContent = sent ? "已发送" : "未发送";
    }

    function setLastNotificationTime(timeValue) {
      notifyTimeEl.textContent = toLocalTimeString(timeValue);
    }

    function setLastNotificationFingerprint(fingerprint) {
      notifyFpEl.textContent = fingerprint || "--";
      notifyFpEl.title = fingerprint || "--";
    }

    function setLastNotificationReason(reasonText) {
      notifyReasonEl.textContent = reasonText || "--";
    }

    function setConfigSummary(summaryText) {
      configEl.textContent = summaryText || "--";
      configEl.title = summaryText || "--";
    }

    function setLastStateChangeTime(timeValue) {
      lastStateChangeEl.textContent = toLocalTimeString(timeValue);
    }

    function setLastMutationTime(timeValue) {
      lastChangeEl.textContent = toLocalTimeString(timeValue);
    }

    setVisible(config && typeof config.visible === "boolean" ? config.visible : true);
    setPluginStatus(config && config.pluginStatus ? config.pluginStatus : "运行中");
    setPlatform(config && config.platform ? config.platform : "unknown");
    setState(config && config.state ? config.state : "idle");
    setPageHidden(config && typeof config.pageHidden === "boolean" ? config.pageHidden : false);
    setWindowFocused(config && typeof config.windowFocused === "boolean" ? config.windowFocused : true);
    setLastActiveTime(config && config.lastActiveTime ? config.lastActiveTime : null);
    setInactiveSeconds(config && Number.isFinite(config.inactiveSeconds) ? config.inactiveSeconds : 0);
    setNotifyMode(config && config.notifyMode ? config.notifyMode : "background_only");
    setReplyLength(config && config.replyLength ? config.replyLength : 0);
    setLastNotificationSent(config && typeof config.lastNotificationSent === "boolean"
      ? config.lastNotificationSent
      : null);
    setLastNotificationTime(config && config.lastNotificationTime ? config.lastNotificationTime : null);
    setLastNotificationFingerprint(config && config.lastNotificationFingerprint
      ? config.lastNotificationFingerprint
      : "--");
    setLastNotificationReason(config && config.lastNotificationReason ? config.lastNotificationReason : "--");
    setConfigSummary(config && config.configSummary ? config.configSummary : "--");
    setLastStateChangeTime(config && config.lastStateChangeTime ? config.lastStateChangeTime : null);
    setLastMutationTime(config && config.lastMutationTime ? config.lastMutationTime : null);

    return {
      setVisible,
      setPluginStatus,
      setPlatform,
      setState,
      setPageHidden,
      setWindowFocused,
      setLastActiveTime,
      setInactiveSeconds,
      setNotifyMode,
      setReplyLength,
      setLastNotificationSent,
      setLastNotificationTime,
      setLastNotificationFingerprint,
      setLastNotificationReason,
      setConfigSummary,
      setLastStateChangeTime,
      setLastMutationTime
    };
  }

  globalObj.AINotifierDebugPanel = {
    createDebugPanel
  };
})(window);
