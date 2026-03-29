// background.js
// MV3 background service worker.
// It receives requests from content scripts and sends system notifications.

const LOG_PREFIX = "[AI Reply Notifier]";
const DEFAULT_NOTIFICATION_ICON_PATH = "icons/icon128.png";

chrome.runtime.onInstalled.addListener(() => {
  console.log(`${LOG_PREFIX} Extension installed.`);
});

chrome.runtime.onStartup.addListener(() => {
  console.log(`${LOG_PREFIX} Browser startup detected.`);
});

function createSystemNotification(payload, sendResponse) {
  const title = payload && payload.title ? payload.title : "AI 回复已完成";
  const message = payload && payload.message ? payload.message : "AI 已完成本轮回答。";
  // Convert extension-relative icon path to an absolute runtime URL for notifications API.
  const iconPath = payload && payload.iconPath ? payload.iconPath : DEFAULT_NOTIFICATION_ICON_PATH;
  const iconUrl = chrome.runtime.getURL(iconPath);
  const notificationId = `ai-reply-notifier-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl,
    title,
    message,
    priority: 0
  }, (createdId) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message
      });
      return;
    }

    sendResponse({
      ok: true,
      notificationId: createdId
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "AI_NOTIFIER_DEBUG") {
    const tabUrl = sender?.tab?.url || "unknown-tab";
    console.log(`${LOG_PREFIX} Debug message from content script:`, {
      tabUrl,
      payload: message.payload
    });
    return;
  }

  if (message.type === "AI_NOTIFIER_SHOW_NOTIFICATION") {
    createSystemNotification(message.payload, sendResponse);
    return true;
  }

  console.log(`${LOG_PREFIX} Unknown message type:`, message.type);
});
