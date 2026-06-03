import { Logtail } from "@logtail/node";
import { after } from "next/server";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const betterStackSourceToken = process.env.BETTER_STACK_SOURCE_TOKEN?.trim();

const logtail = betterStackSourceToken
  ? new Logtail(betterStackSourceToken, {
      batchInterval: 250,
      batchSize: 1,
      captureStackContext: false,
      ignoreExceptions: true,
      sendLogsToBetterStack: true,
      sendLogsToConsoleOutput: false,
      throwExceptions: false,
    })
  : null;

function normalizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: normalizeValue(value.cause, depth + 1, seen),
    };
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (depth >= 6) {
    return "[max-depth]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeValue(entryValue, depth + 1, seen)]),
    );
  }

  return String(value);
}

function normalizeContext(context: LogContext): LogContext {
  const seen = new WeakSet<object>();

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, normalizeValue(value, 0, seen)]),
  );
}

function writeConsole(level: LogLevel, message: string, context: LogContext) {
  const consoleMethod = level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warn" : "error";

  if (Object.keys(context).length > 0) {
    globalThis.console[consoleMethod](message, context);
    return;
  }

  globalThis.console[consoleMethod](message);
}

function sendToBetterStack(level: LogLevel, message: string, context: LogContext) {
  if (!logtail) {
    return;
  }

  const send =
    level === "debug"
      ? logtail.debug.bind(logtail)
      : level === "info"
        ? logtail.info.bind(logtail)
        : level === "warn"
          ? logtail.warn.bind(logtail)
          : logtail.error.bind(logtail);

  void send(message, context).catch((error: unknown) => {
    globalThis.console.error("[logger] Failed to send log to Better Stack", {
      error: normalizeValue(error, 0, new WeakSet<object>()),
    });
  });
}

function emit(level: LogLevel, component: string, baseContext: LogContext, message: string, context: LogContext = {}) {
  const mergedContext = normalizeContext({
    component,
    ...baseContext,
    ...context,
  });

  writeConsole(level, message, mergedContext);
  sendToBetterStack(level, message, mergedContext);
}

export function getLogger(component: string, baseContext: LogContext = {}) {
  return {
    debug(message: string, context?: LogContext) {
      emit("debug", component, baseContext, message, context);
    },
    info(message: string, context?: LogContext) {
      emit("info", component, baseContext, message, context);
    },
    warn(message: string, context?: LogContext) {
      emit("warn", component, baseContext, message, context);
    },
    error(message: string, context?: LogContext) {
      emit("error", component, baseContext, message, context);
    },
    child(context: LogContext) {
      return getLogger(component, {
        ...baseContext,
        ...context,
      });
    },
    enabled: Boolean(logtail),
    flush() {
      return logtail?.flush() ?? Promise.resolve();
    },
  };
}

export function scheduleLogFlush(customLogger = logger) {
  after(async () => {
    await customLogger.flush();
  });
}

export const logger = getLogger("app");
