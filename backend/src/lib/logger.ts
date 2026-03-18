/**
 * Structured logger — JSON in production, human-readable in development.
 * Drop-in replacement for console.log/error/warn.
 *
 * Usage:
 *   import { logger } from "../lib/logger";
 *   logger.info("User registered", { userId, email });
 *   logger.error("Email failed", { error: err.message, to });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProd = process.env.NODE_ENV === "production";
const minLevel: LogLevel = isProd ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatDev(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const prefix = { debug: "[DEBUG]", info: "[INFO]", warn: "[WARN]", error: "[ERROR]" }[level];
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  return `${prefix} ${message}${dataStr}`;
}

function formatProd(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  return JSON.stringify({
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...data,
  });
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const output = isProd ? formatProd(level, message, data) : formatDev(level, message, data);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
