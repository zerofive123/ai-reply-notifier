// state.js
// Tiny state machine used by content script.

(function registerStateMachine(globalObj) {
  const STATES = {
    IDLE: "idle",
    OBSERVING: "observing",
    GENERATING: "generating",
    COMPLETED: "completed"
  };

  function createStateMachine(options) {
    const logger = options && typeof options.logger === "function"
      ? options.logger
      : function noop() {};
    const errorLogger = options && typeof options.errorLogger === "function"
      ? options.errorLogger
      : function defaultErrorLogger(message, error) {
          console.error(message, error);
        };

    let currentState = STATES.IDLE;
    const listeners = new Set();

    function getState() {
      return currentState;
    }

    function isValidState(nextState) {
      return Object.values(STATES).includes(nextState);
    }

    function setState(nextState, meta) {
      if (!isValidState(nextState)) {
        logger(`Ignored invalid state: ${nextState}`);
        return currentState;
      }

      if (nextState === currentState) {
        return currentState;
      }

      const previousState = currentState;
      currentState = nextState;

      logger(`State changed: ${previousState} -> ${currentState}`);

      listeners.forEach((listener) => {
        try {
          listener({
            previousState,
            currentState,
            meta: meta || null
          });
        } catch (error) {
          errorLogger("State listener failed:", error);
        }
      });

      return currentState;
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return function unsubscribeNoop() {};
      }

      listeners.add(listener);

      // Send current state immediately so UI can render initial values.
      listener({
        previousState: null,
        currentState,
        meta: { event: "INIT" }
      });

      return function unsubscribe() {
        listeners.delete(listener);
      };
    }

    return {
      STATES,
      getState,
      setState,
      subscribe
    };
  }

  globalObj.AINotifierState = {
    STATES,
    createStateMachine
  };
})(window);
