import { Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const services = useMemo(
    () => ({ ...defaultServices, ...serviceOverrides }),
    [serviceOverrides]
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
    (action: TuiAction, model: DashboardModel) => {
      setState((current) =>
        current === null
          ? current
          : updateTuiState(
              updateTuiState(current, { type: "set-busy", busy: true }),
              {
                type: "set-status",
                message: action === "scan" ? "scanning..." : "working..."
              }
            )
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
          setState((current) =>
            current === null
              ? current
              : replaceStateModel(current, result.model, result.statusMessage)
          );
        })
        .catch((error: unknown) => {
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
        });
    },
    [homeDir, platform, services, skillmuxHome]
  );

  const reloadAgent = useCallback(
    (agentId: string) => {
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
          setState((current) =>
            current === null ? current : replaceStateModel(current, model, null)
          );
        })
        .catch((error: unknown) => {
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
    [homeDir, platform, services, skillmuxHome]
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
    if ((key.ctrl && input === "c") || input === "q") {
      exit();
      return;
    }

    if (state === null) {
      return;
    }

    if (state.modal !== null) {
      if (key.escape) {
        setState(updateTuiState(state, { type: "close" }));
        return;
      }

      if (
        input.toLocaleLowerCase() === "y" &&
        state.modal.kind === "confirm-adopt"
      ) {
        runAction("adopt", updateTuiState(state, { type: "close" }).model);
        return;
      }

      if (
        input.toLocaleLowerCase() === "y" &&
        state.modal.kind === "confirm-remove"
      ) {
        runAction("remove", updateTuiState(state, { type: "close" }).model);
        return;
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

    if (key.tab) {
      setState(
        updateTuiState(state, {
          type: key.shift ? "focus-previous" : "focus-next"
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
