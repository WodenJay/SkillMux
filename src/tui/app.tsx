import { Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dispatchTuiAction,
  type DispatchTuiActionInput,
  type DispatchTuiActionResult,
  type TuiAction
} from "./actions";
import { Dashboard } from "./components/Dashboard";
import type { DashboardModel } from "./dashboard-model";
import {
  loadDashboardState,
  type LoadDashboardStateOptions
} from "./load-dashboard-state";
import {
  consumeActionIntent,
  consumeAgentSelectionIntent,
  createInitialTuiState,
  updateTuiState,
  type TuiState
} from "./state";

export type AppServices = {
  loadDashboardState: (
    options: LoadDashboardStateOptions
  ) => Promise<DashboardModel>;
  dispatchTuiAction: (
    input: DispatchTuiActionInput
  ) => Promise<DispatchTuiActionResult>;
};

export type AppProps = {
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  terminalWidth?: number;
  terminalHeight?: number;
  services?: Partial<AppServices>;
};

const defaultServices: AppServices = {
  loadDashboardState,
  dispatchTuiAction
};

function errorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split(/\r?\n/u)[0]?.trim();

  return firstLine === undefined || firstLine.length === 0
    ? "Unknown error"
    : firstLine;
}

function loadOptions(
  props: Pick<AppProps, "homeDir" | "skillmuxHome" | "platform">,
  selectedAgentId?: string,
  selectedSkillId?: string
): LoadDashboardStateOptions {
  return {
    homeDir: props.homeDir,
    skillmuxHome: props.skillmuxHome,
    platform: props.platform,
    selectedAgentId,
    selectedSkillId
  };
}

function replaceStateModel(
  previous: TuiState,
  model: DashboardModel,
  statusMessage: string | null
): TuiState {
  const next = createInitialTuiState(model);

  return {
    ...next,
    focus: previous.focus,
    search: previous.search,
    statusMessage,
    modal: null,
    busy: false
  };
}

function isTextInput(input: string): boolean {
  return input.length > 0 && !/[\u0000-\u001F\u007F]/u.test(input);
}

export function App({
  homeDir,
  skillmuxHome,
  platform,
  terminalWidth,
  terminalHeight,
  services: serviceOverrides
}: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<TuiState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const latestRequest = useRef(0);
  const activeActionRequest = useRef<number | null>(null);
  const services = useMemo(
    () => ({ ...defaultServices, ...serviceOverrides }),
    [serviceOverrides]
  );

  const beginRequest = useCallback((): number => {
    requestSequence.current += 1;
    latestRequest.current = requestSequence.current;

    return requestSequence.current;
  }, []);

  const isLatestRequest = useCallback((requestId: number): boolean => {
    return latestRequest.current === requestId;
  }, []);

  const startBusyState = useCallback(
    (baseState: TuiState, action: TuiAction): TuiState =>
      updateTuiState(
        updateTuiState(baseState, { type: "set-busy", busy: true }),
        {
          type: "set-status",
          message: action === "scan" ? "scanning..." : "working..."
        }
      ),
    []
  );

  useEffect(() => {
    let cancelled = false;

    services
      .loadDashboardState(loadOptions({ homeDir, skillmuxHome, platform }))
      .then((model) => {
        if (!cancelled) {
          setState(createInitialTuiState(model));
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(`Failed to load dashboard: ${errorReason(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [homeDir, platform, services, skillmuxHome]);

  const runAction = useCallback(
    (action: TuiAction, model: DashboardModel, baseState?: TuiState) => {
      if (activeActionRequest.current !== null) {
        return;
      }

      const requestId = beginRequest();
      activeActionRequest.current = requestId;
      setState((current) =>
        current === null
          ? current
          : startBusyState(baseState ?? current, action)
      );

      services
        .dispatchTuiAction({
          action,
          model,
          homeDir,
          skillmuxHome,
          platform
        })
        .then((result) => {
          if (!isLatestRequest(requestId)) {
            return;
          }

          setState((current) =>
            current === null
              ? current
              : replaceStateModel(current, result.model, result.statusMessage)
          );
        })
        .catch((error: unknown) => {
          if (!isLatestRequest(requestId)) {
            return;
          }

          setState((current) =>
            current === null
              ? current
              : updateTuiState(
                  updateTuiState(current, { type: "set-busy", busy: false }),
                  {
                    type: "set-status",
                    message: `Action failed: ${errorReason(error)}`
                  }
                )
          );
        })
        .finally(() => {
          if (activeActionRequest.current === requestId) {
            activeActionRequest.current = null;
          }
        });
    },
    [
      beginRequest,
      homeDir,
      isLatestRequest,
      platform,
      services,
      skillmuxHome,
      startBusyState
    ]
  );

  const reloadAgent = useCallback(
    (agentId: string) => {
      const requestId = beginRequest();
      setState((current) =>
        current === null
          ? current
          : updateTuiState(
              updateTuiState(current, { type: "set-busy", busy: true }),
              { type: "set-status", message: "loading agent..." }
            )
      );

      services
        .loadDashboardState(loadOptions({ homeDir, skillmuxHome, platform }, agentId))
        .then((model) => {
          if (!isLatestRequest(requestId)) {
            return;
          }

          setState((current) =>
            current === null ? current : replaceStateModel(current, model, null)
          );
        })
        .catch((error: unknown) => {
          if (!isLatestRequest(requestId)) {
            return;
          }

          setState((current) =>
            current === null
              ? current
              : updateTuiState(
                  updateTuiState(current, { type: "set-busy", busy: false }),
                  {
                    type: "set-status",
                    message: `Load failed: ${errorReason(error)}`
                  }
                )
          );
        });
    },
    [beginRequest, homeDir, isLatestRequest, platform, services, skillmuxHome]
  );

  useEffect(() => {
    if (state?.pendingAction === null || state?.pendingAction === undefined) {
      return;
    }

    const consumed = consumeActionIntent(state);
    setState(consumed.state);

    if (consumed.action !== null) {
      runAction(consumed.action, consumed.state.model);
    }
  }, [runAction, state]);

  useEffect(() => {
    if (state?.pendingAgentId === null || state?.pendingAgentId === undefined) {
      return;
    }

    const consumed = consumeAgentSelectionIntent(state);
    setState(consumed.state);

    if (consumed.agentId !== null) {
      reloadAgent(consumed.agentId);
    }
  }, [reloadAgent, state]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (state === null) {
      if (input === "q") {
        exit();
      }

      return;
    }

    if (state.search !== null) {
      if (key.escape || key.return) {
        setState(updateTuiState(state, { type: "close" }));
        return;
      }

      if (key.backspace || key.delete) {
        setState(
          updateTuiState(state, {
            type: "search-query-changed",
            query: state.search.query.slice(0, -1)
          })
        );
        return;
      }

      if (!key.ctrl && !key.meta && isTextInput(input)) {
        setState(
          updateTuiState(state, {
            type: "search-query-changed",
            query: `${state.search.query}${input}`
          })
        );
      }

      return;
    }

    if (state.modal !== null) {
      if (key.escape) {
        setState(updateTuiState(state, { type: "close" }));
        return;
      }

      if (input === "q") {
        exit();
        return;
      }

      if (activeActionRequest.current !== null) {
        return;
      }

      if (
        input.toLocaleLowerCase() === "y" &&
        state.modal.kind === "confirm-adopt"
      ) {
        const closedState = updateTuiState(state, { type: "close" });
        runAction("adopt", closedState.model, closedState);
        return;
      }

      if (
        input.toLocaleLowerCase() === "y" &&
        state.modal.kind === "confirm-remove"
      ) {
        const closedState = updateTuiState(state, { type: "close" });
        runAction("remove", closedState.model, closedState);
        return;
      }

      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (activeActionRequest.current !== null) {
      return;
    }

    if (key.rightArrow) {
      setState(
        updateTuiState(state, {
          type: "focus-next"
        })
      );
      return;
    }

    if (key.leftArrow) {
      setState(
        updateTuiState(state, {
          type: "focus-previous"
        })
      );
      return;
    }

    if (key.downArrow || input === "j") {
      setState(updateTuiState(state, { type: "next-row" }));
      return;
    }

    if (key.upArrow || input === "k") {
      setState(updateTuiState(state, { type: "previous-row" }));
      return;
    }

    if (input === "g") {
      setState(updateTuiState(state, { type: "first-row" }));
      return;
    }

    if (input === "G") {
      setState(updateTuiState(state, { type: "last-row" }));
      return;
    }

    if (input === "/") {
      setState(updateTuiState(state, { type: "open-search" }));
      return;
    }

    if (input === "?") {
      setState(updateTuiState(state, { type: "open-help" }));
      return;
    }

    if (key.escape) {
      setState(updateTuiState(state, { type: "close" }));
      return;
    }

    if (input === " ") {
      setState(updateTuiState(state, { type: "request-toggle" }));
      return;
    }

    if (input === "a") {
      setState(updateTuiState(state, { type: "request-adopt" }));
      return;
    }

    if (input === "r") {
      setState(updateTuiState(state, { type: "request-remove" }));
      return;
    }

    if (input === "s") {
      setState(updateTuiState(state, { type: "request-scan" }));
    }
  });

  if (loadError !== null) {
    return <Text color="red">{loadError}</Text>;
  }

  if (state === null) {
    return <Text>loading dashboard...</Text>;
  }

  return (
    <Dashboard
      state={state}
      width={terminalWidth ?? process.stdout.columns ?? 80}
      height={terminalHeight ?? process.stdout.rows ?? 24}
    />
  );
}
