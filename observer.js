// observer.js
// MutationObserver wrapper with debounce.

(function registerObserver(globalObj) {
  const DEFAULT_DEBOUNCE_MS = 500;

  function pickObservationRoot(platform, logger) {
    const selectorsByPlatform = {
      chatgpt: ["main", "#__next"],
      gemini: ["main", "mat-sidenav-content", "bard-sidenav-container"]
    };

    const selectors = selectorsByPlatform[platform] || ["main"];

    for (let index = 0; index < selectors.length; index += 1) {
      const selector = selectors[index];
      const element = document.querySelector(selector);
      if (element) {
        logger(`Observation root selected: ${selector}`);
        return element;
      }
    }

    logger("Observation root fallback: document.body");
    return document.body || document.documentElement;
  }

  function createPageObserver(config) {
    const platform = (config && config.platform) || "unknown";
    const debounceMs = (config && Number.isFinite(config.debounceMs))
      ? config.debounceMs
      : DEFAULT_DEBOUNCE_MS;
    const onMutationDetected = config && typeof config.onMutationDetected === "function"
      ? config.onMutationDetected
      : function noop() {};
    const onMutationSettled = config && typeof config.onMutationSettled === "function"
      ? config.onMutationSettled
      : function noop() {};
    const logger = config && typeof config.logger === "function"
      ? config.logger
      : function noop() {};
    const errorLogger = config && typeof config.errorLogger === "function"
      ? config.errorLogger
      : function defaultErrorLogger(message, error) {
          console.error(message, error);
        };

    let observer = null;
    let debounceTimer = null;
    let pendingMutationCount = 0;

    function flushMutationBatch() {
      logger("Recomputing page state...");

      onMutationSettled({
        platform,
        settledAt: new Date(),
        pendingMutationCount
      });

      pendingMutationCount = 0;
    }

    function onMutations(mutations) {
      if (!mutations || mutations.length === 0) {
        return;
      }

      pendingMutationCount += mutations.length;

      logger("DOM mutation detected.");

      onMutationDetected({
        platform,
        detectedAt: new Date(),
        batchMutationCount: mutations.length,
        totalPendingMutations: pendingMutationCount
      });

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(flushMutationBatch, debounceMs);
    }

    function start() {
      const target = pickObservationRoot(platform, logger);
      if (!target) {
        errorLogger("Unable to start observer: no DOM target found.");
        return;
      }

      observer = new MutationObserver(onMutations);
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true
      });

      logger("MutationObserver started.");
    }

    function stop() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (observer) {
        observer.disconnect();
        observer = null;
      }

      logger("MutationObserver stopped.");
    }

    return {
      start,
      stop
    };
  }

  globalObj.AINotifierObserver = {
    createPageObserver
  };
})(window);
