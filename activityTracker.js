// activityTracker.js
// Tracks user activity and focus/visibility state for notification decisions.

(function registerActivityTracker(globalObj) {
  const DEFAULT_MOVE_THROTTLE_MS = 1200;

  function createActivityTracker(config) {
    const logger = config && typeof config.logger === "function"
      ? config.logger
      : function noop() {};
    const onActivity = config && typeof config.onActivity === "function"
      ? config.onActivity
      : function noop() {};
    const onFocusChange = config && typeof config.onFocusChange === "function"
      ? config.onFocusChange
      : function noop() {};

    let lastActiveAt = Date.now();
    let isWindowFocused = document.hasFocus();
    let isPageHidden = document.hidden;

    let moveLastMarkedAt = 0;
    let scrollLastMarkedAt = 0;
    let started = false;

    function markActive(source, force) {
      const now = Date.now();

      if (!force) {
        if (source === "mousemove" && (now - moveLastMarkedAt) < DEFAULT_MOVE_THROTTLE_MS) {
          return;
        }

        if (source === "scroll" && (now - scrollLastMarkedAt) < DEFAULT_MOVE_THROTTLE_MS) {
          return;
        }
      }

      if (source === "mousemove") {
        moveLastMarkedAt = now;
      }

      if (source === "scroll") {
        scrollLastMarkedAt = now;
      }

      lastActiveAt = now;
      onActivity({
        source,
        at: new Date(now)
      });
    }

    function handleMouseMove() {
      markActive("mousemove", false);
    }

    function handleMouseDown() {
      markActive("mousedown", true);
    }

    function handleClick() {
      markActive("click", true);
    }

    function handleKeyDown() {
      markActive("keydown", true);
    }

    function handleScroll() {
      markActive("scroll", false);
    }

    function handleTouchStart() {
      markActive("touchstart", true);
    }

    function handleWindowFocus() {
      if (!isWindowFocused) {
        isWindowFocused = true;
        logger("Window focus restored.");
        onFocusChange({
          isWindowFocused,
          isPageHidden,
          at: new Date()
        });
      }
    }

    function handleWindowBlur() {
      if (isWindowFocused) {
        isWindowFocused = false;
        logger("Window focus lost.");
        onFocusChange({
          isWindowFocused,
          isPageHidden,
          at: new Date()
        });
      }
    }

    function handleVisibilityChange() {
      const nextHidden = document.hidden;
      if (nextHidden === isPageHidden) {
        return;
      }

      isPageHidden = nextHidden;
      onFocusChange({
        isWindowFocused,
        isPageHidden,
        at: new Date()
      });
    }

    function getSnapshot() {
      const now = Date.now();
      const inactiveSeconds = Math.max(0, Math.floor((now - lastActiveAt) / 1000));

      return {
        lastActiveAt,
        lastActiveDate: new Date(lastActiveAt),
        inactiveSeconds,
        isWindowFocused,
        isPageHidden
      };
    }

    function start() {
      if (started) {
        return;
      }

      started = true;

      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      window.addEventListener("mousedown", handleMouseDown, { passive: true });
      window.addEventListener("click", handleClick, { passive: true });
      window.addEventListener("keydown", handleKeyDown, { passive: true });
      window.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("touchstart", handleTouchStart, { passive: true });
      window.addEventListener("focus", handleWindowFocus);
      window.addEventListener("blur", handleWindowBlur);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    function stop() {
      if (!started) {
        return;
      }

      started = false;

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }

    return {
      start,
      stop,
      getSnapshot,
      markActive
    };
  }

  globalObj.AINotifierActivityTracker = {
    createActivityTracker
  };
})(window);
