// detector.js
// Platform detector and response-change analyzer.

(function registerDetector(globalObj) {
  const FINGERPRINT_MIN_TEXT_LENGTH = 30;

  const PLATFORM = {
    CHATGPT: "chatgpt",
    GEMINI: "gemini",
    UNKNOWN: "unknown"
  };

  const PLATFORM_RULES = {
    chatgpt: {
      responseSelectors: [
        "main [data-message-author-role='assistant']",
        "main article",
        "main .markdown"
      ],
      loadingSelectors: [
        "button[aria-label*='Stop']",
        "button[data-testid*='stop']",
        "main [role='progressbar']"
      ],
      inputSelectors: [
        "form textarea",
        "main textarea",
        "main [contenteditable='true']"
      ],
      actionButtonSelectors: [
        "button[aria-label*='Send']",
        "button[aria-label*='发送']",
        "button[aria-label*='Stop']"
      ],
      rootSelectors: ["main", "#__next"]
    },
    gemini: {
      responseSelectors: [
        "main message-content",
        "main .model-response-text",
        "main [data-test-id*='response']",
        "main .markdown"
      ],
      loadingSelectors: [
        "button[aria-label*='Stop']",
        "button[aria-label*='停止']",
        "main [role='progressbar']",
        "main [class*='loading']"
      ],
      inputSelectors: [
        "main textarea",
        "main [contenteditable='true']"
      ],
      actionButtonSelectors: [
        "button[aria-label*='Send']",
        "button[aria-label*='发送']",
        "button[aria-label*='Run']",
        "button[aria-label*='提交']"
      ],
      rootSelectors: ["main", "bard-sidenav-container"]
    },
    unknown: {
      responseSelectors: ["main article", "main .markdown", "main"],
      loadingSelectors: ["main [role='progressbar']"],
      inputSelectors: ["textarea", "[contenteditable='true']"],
      actionButtonSelectors: ["button"],
      rootSelectors: ["main", "body"]
    }
  };

  function detectPlatform() {
    const host = window.location.hostname;

    if (host === "chatgpt.com") {
      return PLATFORM.CHATGPT;
    }

    if (host === "gemini.google.com") {
      return PLATFORM.GEMINI;
    }

    return PLATFORM.UNKNOWN;
  }

  function getPlatformRules(platform) {
    return PLATFORM_RULES[platform] || PLATFORM_RULES.unknown;
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function collectUniqueElements(selectors) {
    const elementSet = new Set();

    selectors.forEach((selector) => {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((node) => elementSet.add(node));
    });

    return Array.from(elementSet);
  }

  function pickRootElement(rules) {
    for (let index = 0; index < rules.rootSelectors.length; index += 1) {
      const selector = rules.rootSelectors[index];
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    }

    return document.body || document.documentElement;
  }

  function readInputTextLength(rules) {
    const inputNodes = collectUniqueElements(rules.inputSelectors);
    for (let index = 0; index < inputNodes.length; index += 1) {
      const node = inputNodes[index];

      if (typeof node.value === "string") {
        return normalizeText(node.value).length;
      }

      const contentEditableText = normalizeText(node.textContent || "");
      if (contentEditableText.length > 0) {
        return contentEditableText.length;
      }
    }

    return 0;
  }

  function readActionButtonState(rules) {
    const buttons = collectUniqueElements(rules.actionButtonSelectors);
    for (let index = 0; index < buttons.length; index += 1) {
      const button = buttons[index];
      if (button.tagName !== "BUTTON") {
        continue;
      }

      const ariaDisabled = button.getAttribute("aria-disabled");
      const isDisabled = Boolean(button.disabled) || ariaDisabled === "true";
      return {
        found: true,
        disabled: isDisabled
      };
    }

    return {
      found: false,
      disabled: false
    };
  }

  function createFingerprint(snapshot) {
    const head = snapshot.latestReplyHead.slice(0, 20);
    const tail = snapshot.latestReplyTail.slice(-20);
    return `n${snapshot.responseNodeCount}-l${snapshot.latestReplyTextLength}-h:${head}-t:${tail}`;
  }

  function buildSnapshot(platform) {
    const rules = getPlatformRules(platform);
    const root = pickRootElement(rules);

    const responseCandidates = collectUniqueElements(rules.responseSelectors)
      .map((node) => {
        const text = normalizeText(node.textContent || "");
        return {
          text,
          length: text.length
        };
      })
      .filter((item) => item.length > 0);

    const meaningfulResponses = responseCandidates.filter((item) => item.length >= 20);
    const selectedResponses = meaningfulResponses.length > 0 ? meaningfulResponses : responseCandidates;

    const rootText = normalizeText(root ? root.textContent || "" : "");

    const latestResponse = selectedResponses.length > 0
      ? selectedResponses[selectedResponses.length - 1]
      : {
          text: rootText,
          length: rootText.length
        };

    const loadingSignalCount = collectUniqueElements(rules.loadingSelectors).length;
    const actionButtonState = readActionButtonState(rules);

    const snapshot = {
      platform,
      timestamp: new Date(),
      responseNodeCount: selectedResponses.length,
      latestReplyTextLength: latestResponse.length,
      latestReplyPreview: latestResponse.text.slice(0, 80),
      latestReplyHead: latestResponse.text.slice(0, 80),
      latestReplyTail: latestResponse.text.slice(-80),
      mainTextLength: rootText.length,
      loadingSignalCount,
      inputTextLength: readInputTextLength(rules),
      actionButtonFound: actionButtonState.found,
      actionButtonDisabled: actionButtonState.disabled
    };

    snapshot.replyFingerprint = createFingerprint(snapshot);
    return snapshot;
  }

  function analyzeTransition(previousSnapshot, nextSnapshot) {
    if (!previousSnapshot) {
      return {
        hasMeaningfulAnswerChange: false,
        answerTextGrowthChars: 0,
        newResponseBlockAdded: false,
        replyFingerprintMeaningfulChanged: false,
        likelyUserSubmit: false,
        loadingActive: nextSnapshot.loadingSignalCount > 0,
        reasons: ["first_snapshot"]
      };
    }

    const loadingActive = nextSnapshot.loadingSignalCount > 0;

    const answerTextGrowthChars = Math.max(
      0,
      nextSnapshot.latestReplyTextLength - previousSnapshot.latestReplyTextLength
    );

    const newResponseBlockAdded = nextSnapshot.responseNodeCount > previousSnapshot.responseNodeCount;

    const rawFingerprintChanged = nextSnapshot.replyFingerprint !== previousSnapshot.replyFingerprint;
    const replyFingerprintMeaningfulChanged = (
      rawFingerprintChanged
      && nextSnapshot.latestReplyTextLength >= FINGERPRINT_MIN_TEXT_LENGTH
    );

    const likelyInputDropped = (
      previousSnapshot.inputTextLength > 0
      && nextSnapshot.inputTextLength < previousSnapshot.inputTextLength
    );

    const likelyActionBusy = (
      nextSnapshot.actionButtonFound
      && nextSnapshot.actionButtonDisabled
      && !previousSnapshot.actionButtonDisabled
    );

    const likelyUserSubmit = likelyInputDropped && likelyActionBusy;

    const hasMeaningfulAnswerChange = (
      answerTextGrowthChars > 0
      || newResponseBlockAdded
      || replyFingerprintMeaningfulChanged
    );

    const reasons = [];
    if (answerTextGrowthChars > 0) reasons.push("latest_reply_length_growth");
    if (newResponseBlockAdded) reasons.push("response_block_count_growth");
    if (replyFingerprintMeaningfulChanged) reasons.push("reply_fingerprint_changed");
    if (loadingActive) reasons.push("loading_signal_active");
    if (likelyUserSubmit) reasons.push("input_and_action_change");

    return {
      hasMeaningfulAnswerChange,
      answerTextGrowthChars,
      newResponseBlockAdded,
      replyFingerprintMeaningfulChanged,
      likelyUserSubmit,
      loadingActive,
      reasons
    };
  }

  function initDetector(platform, options) {
    const logger = options && typeof options.logger === "function"
      ? options.logger
      : function noop() {};

    logger(`Detector initialized for platform: ${platform}`);

    return {
      getSnapshot() {
        return buildSnapshot(platform);
      },
      analyzeTransition(previousSnapshot, nextSnapshot) {
        return analyzeTransition(previousSnapshot, nextSnapshot);
      }
    };
  }

  globalObj.AINotifierDetector = {
    PLATFORM,
    detectPlatform,
    initDetector
  };
})(window);
