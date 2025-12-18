/**
 * Simple logging utility
 * In production, consider using a proper logging library
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

function formatLog(entry: LogEntry): string {
  const metadataStr = entry.metadata
    ? ` ${JSON.stringify(entry.metadata)}`
    : '';
  return `[${entry.timestamp}] ${entry.level}: ${entry.message}${metadataStr}`;
}

export const logger = {
  debug(message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    console.log(formatLog(entry));
  },

  info(message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: LogLevel.INFO,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    console.log(formatLog(entry));
  },

  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: LogLevel.WARN,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    console.warn(formatLog(entry));
  },

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
      },
    };
    console.error(formatLog(entry));
  },
};

