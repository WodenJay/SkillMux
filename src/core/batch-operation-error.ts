export type BatchOperationName = "enable" | "disable" | "adopt" | "remove";

export type BatchOperationErrorOptions = {
  operation: BatchOperationName;
  failedItem: string;
  failedAction: string;
  completedAction: string;
  completedItems: string[];
  cause: unknown;
};

function getCauseMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
}

function buildBatchOperationMessage(options: BatchOperationErrorOptions): string {
  const completedSuffix = options.completedItems.length > 0
    ? ` after ${options.completedAction}: ${options.completedItems.join(", ")}`
    : "";

  return `Failed to ${options.failedAction}${completedSuffix}: ${getCauseMessage(options.cause)}`;
}

export class BatchOperationError extends Error {
  readonly operation: BatchOperationName;
  readonly failedItem: string;
  readonly completedItems: string[];
  override readonly cause: unknown;

  constructor(options: BatchOperationErrorOptions) {
    super(buildBatchOperationMessage(options), { cause: options.cause });
    this.name = "BatchOperationError";
    this.operation = options.operation;
    this.failedItem = options.failedItem;
    this.completedItems = [...options.completedItems];
    this.cause = options.cause;
  }
}
