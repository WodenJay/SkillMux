import { readFileSync } from "node:fs";
import { Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dispatchTuiAction,
  type DispatchTuiActionInput,
  type DispatchTuiActionResult,
  type TuiAction
} from "./actions";
import { Dashboard, type DashboardModalInteraction } from "./components/Dashboard";
import type { DashboardModel } from "./dashboard-model";
import {
  loadDashboardState,
  type LoadDashboardStateOptions
} from "./load-dashboard-state";
import {
  consumePendingCommandIntent,
  consumeActionIntent,
  consumeAgentSelectionIntent,
  createInitialTuiState,
  updateTuiState,
  type TuiFormModal,
  type TuiState
} from "./state";
import { resolveTheme, ThemeProvider } from "./theme";

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

const addAgentFieldOrder = [
  "id",
  "root",
  "skills",
  "name",
  "platforms",
  "disabledByDefault"
] as const;

const editAgentFieldOrder = [
  "root",
  "skills",
  "name",
  "platforms",
  "enabledByDefault",
  "disabledByDefault"
] as const;

const importFieldOrder = ["sourcePath", "skillName"] as const;
const platformOptions = ["win32", "linux", "darwin"] as const;

function formFieldCount(modal: { kind: "add-agent" | "edit-agent" | "import" }): number {
  return modal.kind === "import" ? importFieldOrder.length : addAgentFieldOrder.length;
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) {
    return 0;
  }

  return ((index % count) + count) % count;
}

function nextText(value: string, input: string): string {
  return `${value}${input}`;
}

function trimLast(value: string): string {
  return value.slice(0, Math.max(value.length - 1, 0));
}

function togglePlatform(values: string[], platform: string): string[] {
  return values.includes(platform)
    ? values.filter((entry) => entry !== platform)
    : [...values, platform];
}

function commandFailureMessage(error: unknown): string {
  return `Action failed: ${errorReason(error)}`;
}

function restoreFailedFormModal(modal: TuiFormModal, message: string): TuiFormModal {
  switch (modal.kind) {
    case "add-agent":
      return {
        kind: "add-agent",
        form: {
          ...modal.form,
          error: message
        }
      };
    case "edit-agent":
      return {
        kind: "edit-agent",
        agentId: modal.agentId,
        form: {
          ...modal.form,
          error: message
        }
      };
    case "import":
      return {
        kind: "import",
        form: {
          ...modal.form,
          error: message
        }
      };
  }
}

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

function parseBridgedSize(value: string): { columns: number; rows: number } | null {
  try {
    const parsed = JSON.parse(value) as {
      columns?: unknown;
      rows?: unknown;
    };

    if (
      typeof parsed.columns === "number" &&
      typeof parsed.rows === "number" &&
      Number.isFinite(parsed.columns) &&
      Number.isFinite(parsed.rows)
    ) {
      return {
        columns: parsed.columns,
        rows: parsed.rows
      };
    }
  } catch {
    return null;
  }

  return null;
}

function liveTerminalSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24
  };
}

type AppViewportProps = {
  state: TuiState;
  terminalWidth?: number;
  terminalHeight?: number;
  modalInteraction: DashboardModalInteraction;
};

type BridgedDashboardViewportProps = AppViewportProps & {
  bridgePath: string | null;
};

function readSizeFile(path: string): { columns: number; rows: number } | null {
  try {
    return parseBridgedSize(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function useBridgedTerminalSize(path: string | null): { columns: number; rows: number } | null {
  const [size, setSize] = useState<{ columns: number; rows: number } | null>(() =>
    path === null ? null : readSizeFile(path)
  );

  useEffect(() => {
    if (path === null) {
      setSize(null);
      return;
    }

    let cancelled = false;

    const refresh = () => {
      if (cancelled) {
        return;
      }

      const nextSize = readSizeFile(path);
      setSize((current) =>
        nextSize === null
          ? current
          : current !== null &&
              current.columns === nextSize.columns &&
              current.rows === nextSize.rows
            ? current
            : nextSize
      );
    };

    refresh();
    const timer = setInterval(refresh, 50);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path]);

  return size;
}

function LiveDashboardViewport({
  state,
  terminalWidth,
  terminalHeight,
  modalInteraction
}: AppViewportProps) {
  return (
    <Dashboard
      state={state}
      width={terminalWidth ?? liveTerminalSize().columns}
      height={terminalHeight ?? liveTerminalSize().rows}
      modalInteraction={modalInteraction}
    />
  );
}

function BridgedDashboardViewport({
  state,
  terminalWidth,
  terminalHeight,
  bridgePath,
  modalInteraction
}: BridgedDashboardViewportProps) {
  const bridgedTerminalSize = useBridgedTerminalSize(bridgePath ?? null);
  const fallbackSize = liveTerminalSize();

  return (
    <Dashboard
      state={state}
      width={terminalWidth ?? bridgedTerminalSize?.columns ?? fallbackSize.columns}
      height={terminalHeight ?? bridgedTerminalSize?.rows ?? fallbackSize.rows}
      modalInteraction={modalInteraction}
    />
  );
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
  const stableModel = useRef<DashboardModel | null>(null);
  const [modalInteraction, setModalInteraction] = useState<DashboardModalInteraction>({
    fieldIndex: 0,
    platformIndex: 0,
    doctorScrollOffset: 0
  });
  const services = useMemo(
    () => ({ ...defaultServices, ...serviceOverrides }),
    [serviceOverrides]
  );
  const sizeBridgePath = process.env.SKILLMUX_TUI_PTY_SIZE_FILE?.trim() ?? null;
  const sizeBridgeEnabled = sizeBridgePath !== null && sizeBridgePath.length > 0;
  const modalKind = state?.modal?.kind ?? null;

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
          stableModel.current = model;
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

  useEffect(() => {
    setModalInteraction({
      fieldIndex: 0,
      platformIndex: 0,
      doctorScrollOffset: 0
    });
  }, [modalKind]);

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

          stableModel.current = result.model;
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

          stableModel.current = model;
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
              : stableModel.current === null
                ? updateTuiState(
                    updateTuiState(current, { type: "set-busy", busy: false }),
                    {
                      type: "set-status",
                      message: `Load failed: ${errorReason(error)}`
                    }
                  )
                : replaceStateModel(
                    current,
                    stableModel.current,
                    `Load failed: ${errorReason(error)}`
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

  useEffect(() => {
    if (state?.pendingCommand === null || state?.pendingCommand === undefined) {
      return;
    }

    const consumed = consumePendingCommandIntent(state);
    setState(consumed.state);

    if (consumed.command === null) {
      return;
    }

    if (consumed.command.kind === "doctor") {
      const requestId = beginRequest();

      services
        .dispatchTuiAction({
          action: consumed.command,
          model: consumed.state.model,
          homeDir,
          skillmuxHome,
          platform
        })
        .then((result) => {
          if (!isLatestRequest(requestId)) {
            return;
          }

          if (result.commandSucceeded === false) {
            const failureMessage = result.statusMessage;

            setState((current) =>
              current === null
                ? current
                : updateTuiState(
                    updateTuiState(current, {
                      type: "doctor-result-failed",
                      errorMessage: failureMessage
                    }),
                    { type: "set-status", message: failureMessage }
                  )
            );
            return;
          }

          const doctorReport = result.doctor;

          if (doctorReport === undefined) {
            throw new Error("Doctor report missing");
          }

          stableModel.current = result.model;
          setState((current) =>
            current === null
              ? current
              : updateTuiState(
                  updateTuiState(current, {
                    type: "doctor-result-loaded",
                    report: doctorReport
                  }),
                  { type: "set-status", message: result.statusMessage }
                )
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
                  updateTuiState(current, {
                    type: "doctor-result-failed",
                    errorMessage: `Doctor failed: ${errorReason(error)}`
                  }),
                  { type: "set-status", message: `Doctor failed: ${errorReason(error)}` }
                )
          );
        });

      return;
    }

    if (activeActionRequest.current !== null) {
      return;
    }

    const requestId = beginRequest();
    activeActionRequest.current = requestId;
    const busyState: TuiState = {
      ...consumed.state,
      modal: null,
      busy: true,
      statusMessage: "working..."
    };
    setState(busyState);

    services
      .dispatchTuiAction({
        action: consumed.command,
        model: busyState.model,
        homeDir,
        skillmuxHome,
        platform
      })
      .then((result) => {
        if (!isLatestRequest(requestId)) {
          return;
        }

        if (result.commandSucceeded === false) {
          const failureMessage = result.statusMessage;

          if (consumed.command?.kind === "doctor") {
            setState({
              ...consumed.state,
              busy: false,
              statusMessage: failureMessage,
              modal: {
                kind: "doctor",
                status: "error",
                errorMessage: failureMessage
              }
            });
            return;
          }

          if (
            consumed.state.modal !== null &&
            "form" in consumed.state.modal
          ) {
            setState({
              ...consumed.state,
              busy: false,
              statusMessage: failureMessage,
              modal: restoreFailedFormModal(consumed.state.modal, failureMessage)
            });
            return;
          }

          setState({
            ...consumed.state,
            busy: false,
            statusMessage: failureMessage
          });
          return;
        }

        stableModel.current = result.model;
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

        const failedModal = consumed.state.modal;
        const failureMessage = commandFailureMessage(error);

        if (
          failedModal === null ||
          failedModal.kind !== "add-agent" &&
            failedModal.kind !== "edit-agent" &&
            failedModal.kind !== "import"
        ) {
          setState({
            ...consumed.state,
            busy: false,
            statusMessage: failureMessage
          });
          return;
        }

        setState({
          ...consumed.state,
          busy: false,
          statusMessage: failureMessage,
          modal: restoreFailedFormModal(failedModal, failureMessage)
        });
      })
      .finally(() => {
        if (activeActionRequest.current === requestId) {
          activeActionRequest.current = null;
        }
      });
  }, [
    beginRequest,
    homeDir,
    isLatestRequest,
    platform,
    services,
    skillmuxHome,
    state
  ]);

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
      if (key.escape || input === "\u001B") {
        setState(updateTuiState(state, { type: "close" }));
        return;
      }

      if (key.return) {
        setState(updateTuiState(state, { type: "submit-search" }));
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
      if (input === "q") {
        if (
          state.modal.kind === "confirm-discard-dirty-form" ||
          ("form" in state.modal && state.modal.form.dirty)
        ) {
          setState(updateTuiState(state, { type: "close" }));
          return;
        }

        exit();
        return;
      }

      if (activeActionRequest.current !== null) {
        return;
      }

      if (state.modal.kind === "help") {
        if (key.escape || input === "\u001B") {
          setState(updateTuiState(state, { type: "close" }));
        }

        return;
      }

      if (state.modal.kind === "confirm-discard-dirty-form") {
        if (input.toLocaleLowerCase() === "y") {
          setState(updateTuiState(state, { type: "confirm-discard-dirty-form" }));
          return;
        }

        if (key.escape || input === "\u001B" || input.toLocaleLowerCase() === "n") {
          setState(updateTuiState(state, { type: "close" }));
        }

        return;
      }

      if (
        state.modal.kind === "confirm-adopt" ||
        state.modal.kind === "confirm-adopt-all" ||
        state.modal.kind === "confirm-remove" ||
        state.modal.kind === "confirm-remove-agent"
      ) {
        if (input.toLocaleLowerCase() === "y") {
          const closedState = updateTuiState(state, { type: "close" });

          if (state.modal.kind === "confirm-adopt") {
            runAction("adopt", closedState.model, closedState);
          } else if (state.modal.kind === "confirm-adopt-all") {
            runAction("adopt-all", closedState.model, closedState);
          } else if (state.modal.kind === "confirm-remove") {
            runAction("remove", closedState.model, closedState);
          } else {
            setState(updateTuiState(state, { type: "submit-remove-agent" }));
          }
          return;
        }

        if (key.escape || input === "\u001B" || input.toLocaleLowerCase() === "n") {
          setState(updateTuiState(state, { type: "close" }));
        }

        return;
      }

      if (state.modal.kind === "doctor") {
        if (key.escape || input === "\u001B") {
          setState(updateTuiState(state, { type: "close" }));
          return;
        }

        if (key.downArrow || key.rightArrow || input === "j") {
          setModalInteraction((current) => ({
            ...current,
            doctorScrollOffset: current.doctorScrollOffset + 1
          }));
          return;
        }

        if (key.upArrow || key.leftArrow || input === "k") {
          setModalInteraction((current) => ({
            ...current,
            doctorScrollOffset: Math.max(current.doctorScrollOffset - 1, 0)
          }));
          return;
        }

        return;
      }

      if (
        state.modal.kind === "add-agent" ||
        state.modal.kind === "edit-agent" ||
        state.modal.kind === "import"
      ) {
        const fieldOrder =
          state.modal.kind === "add-agent"
            ? addAgentFieldOrder
            : state.modal.kind === "edit-agent"
              ? editAgentFieldOrder
              : importFieldOrder;
        const submitFieldIndex = fieldOrder.length;
        const currentFieldIndex = clampIndex(
          modalInteraction.fieldIndex,
          fieldOrder.length + 1
        );
        const currentField = fieldOrder[currentFieldIndex];
        const moveField = (direction: 1 | -1) => {
          setModalInteraction((current) => ({
            ...current,
            fieldIndex: clampIndex(
              current.fieldIndex + direction,
              fieldOrder.length + 1
            ),
            platformIndex: 0
          }));
        };
        const updateAddAgent = (
          field: (typeof addAgentFieldOrder)[number],
          value: string | boolean | string[]
        ) => {
          setState(
            updateTuiState(state, {
              type: "add-agent-form-field-changed",
              field,
              value
            })
          );
        };
        const updateEditAgent = (
          field: (typeof editAgentFieldOrder)[number],
          value: string | boolean | string[]
        ) => {
          setState(
            updateTuiState(state, {
              type: "edit-agent-form-field-changed",
              field,
              value
            })
          );
        };
        const updateImport = (
          field: (typeof importFieldOrder)[number],
          value: string
        ) => {
          setState(
            updateTuiState(state, {
              type: "import-form-field-changed",
              field,
              value
            })
          );
        };

        if (key.escape || input === "\u001B") {
          setState(updateTuiState(state, { type: "close" }));
          return;
        }

        if (key.return && currentFieldIndex === submitFieldIndex) {
          if (state.modal.kind === "add-agent") {
            setState(updateTuiState(state, { type: "submit-add-agent-form" }));
          } else if (state.modal.kind === "edit-agent") {
            setState(updateTuiState(state, { type: "submit-edit-agent-form" }));
          } else {
            setState(updateTuiState(state, { type: "submit-import-form" }));
          }

          return;
        }

        if (key.downArrow) {
          moveField(1);
          return;
        }

        if (key.upArrow) {
          moveField(-1);
          return;
        }

        if (currentField === undefined) {
          return;
        }

        if (currentField === "platforms") {
          const platform = platformOptions[modalInteraction.platformIndex] ?? platformOptions[0];

          if (key.leftArrow) {
            setModalInteraction((current) => ({
              ...current,
              platformIndex: clampIndex(current.platformIndex - 1, platformOptions.length)
            }));
            return;
          }

          if (key.rightArrow) {
            setModalInteraction((current) => ({
              ...current,
              platformIndex: clampIndex(current.platformIndex + 1, platformOptions.length)
            }));
            return;
          }

          if (input === " ") {
            if (state.modal.kind === "add-agent") {
              updateAddAgent(
                "platforms",
                togglePlatform(state.modal.form.values.platforms, platform)
              );
            } else if (state.modal.kind === "edit-agent") {
              updateEditAgent(
                "platforms",
                togglePlatform(state.modal.form.values.platforms, platform)
              );
            }
            return;
          }
        }

        if (currentField === "disabledByDefault" && state.modal.kind === "add-agent") {
          if (input === " ") {
            updateAddAgent("disabledByDefault", !state.modal.form.values.disabledByDefault);
            return;
          }
        }

        if (state.modal.kind === "edit-agent") {
          if (currentField === "enabledByDefault") {
            if (input === " ") {
              updateEditAgent("enabledByDefault", !state.modal.form.values.enabledByDefault);
              return;
            }
          }

          if (currentField === "disabledByDefault") {
            if (input === " ") {
              updateEditAgent(
                "disabledByDefault",
                !state.modal.form.values.disabledByDefault
              );
              return;
            }
          }
        }

        if (isTextInput(input)) {
          if (state.modal.kind === "add-agent") {
            if (currentField === "id") {
              updateAddAgent("id", nextText(state.modal.form.values.id, input));
              return;
            }

            if (currentField === "root") {
              updateAddAgent("root", nextText(state.modal.form.values.root, input));
              return;
            }

            if (currentField === "skills") {
              updateAddAgent("skills", nextText(state.modal.form.values.skills, input));
              return;
            }

            if (currentField === "name") {
              updateAddAgent("name", nextText(state.modal.form.values.name, input));
              return;
            }
          } else if (state.modal.kind === "edit-agent") {
            if (currentField === "root") {
              updateEditAgent("root", nextText(state.modal.form.values.root, input));
              return;
            }

            if (currentField === "skills") {
              updateEditAgent("skills", nextText(state.modal.form.values.skills, input));
              return;
            }

            if (currentField === "name") {
              updateEditAgent("name", nextText(state.modal.form.values.name, input));
              return;
            }
          } else if (state.modal.kind === "import") {
            if (currentField === "sourcePath") {
              updateImport("sourcePath", nextText(state.modal.form.values.sourcePath, input));
              return;
            }

            if (currentField === "skillName") {
              updateImport("skillName", nextText(state.modal.form.values.skillName, input));
              return;
            }
          }
        }

        if (key.backspace || key.delete) {
          if (state.modal.kind === "add-agent") {
            if (currentField === "id") {
              updateAddAgent("id", trimLast(state.modal.form.values.id));
              return;
            }

            if (currentField === "root") {
              updateAddAgent("root", trimLast(state.modal.form.values.root));
              return;
            }

            if (currentField === "skills") {
              updateAddAgent("skills", trimLast(state.modal.form.values.skills));
              return;
            }

            if (currentField === "name") {
              updateAddAgent("name", trimLast(state.modal.form.values.name));
              return;
            }
          } else if (state.modal.kind === "edit-agent") {
            if (currentField === "root") {
              updateEditAgent("root", trimLast(state.modal.form.values.root));
              return;
            }

            if (currentField === "skills") {
              updateEditAgent("skills", trimLast(state.modal.form.values.skills));
              return;
            }

            if (currentField === "name") {
              updateEditAgent("name", trimLast(state.modal.form.values.name));
              return;
            }
          } else if (state.modal.kind === "import") {
            if (currentField === "sourcePath") {
              updateImport("sourcePath", trimLast(state.modal.form.values.sourcePath));
              return;
            }

            if (currentField === "skillName") {
              updateImport("skillName", trimLast(state.modal.form.values.skillName));
              return;
            }
          }
        }

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

    if (input === "n") {
      setState(updateTuiState(state, { type: "open-add-agent" }));
      return;
    }

    if (input === "e") {
      setState(updateTuiState(state, { type: "open-edit-agent" }));
      return;
    }

    if (input === "X" || (key.shift && input === "x")) {
      setState(updateTuiState(state, { type: "open-remove-agent" }));
      return;
    }

    if (input === "i") {
      setState(updateTuiState(state, { type: "open-import" }));
      return;
    }

    if (input === "d") {
      setState(updateTuiState(state, { type: "open-doctor" }));
      return;
    }

    if (key.escape || input === "\u001B") {
      setState(updateTuiState(state, { type: "close" }));
      return;
    }

    if (input === " ") {
      setState(updateTuiState(state, { type: "request-toggle" }));
      return;
    }

    if (input === "A" || (key.shift && input === "a")) {
      setState(updateTuiState(state, { type: "request-adopt-all" }));
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

  const theme = useMemo(() => resolveTheme(), []);

  if (loadError !== null) {
    return <Text color="red">{loadError}</Text>;
  }

  if (state === null) {
    return <Text>loading dashboard...</Text>;
  }

  return (
    <ThemeProvider value={theme}>
      {sizeBridgeEnabled ? (
        <BridgedDashboardViewport
          state={state}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          bridgePath={sizeBridgePath}
          modalInteraction={modalInteraction}
        />
      ) : (
        <LiveDashboardViewport
          state={state}
          terminalWidth={terminalWidth}
          terminalHeight={terminalHeight}
          modalInteraction={modalInteraction}
        />
      )}
    </ThemeProvider>
  );
}
