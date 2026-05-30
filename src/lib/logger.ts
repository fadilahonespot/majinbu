type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

class Logger {
  private log(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const message = `${prefix} ${entry.message}${contextStr}`;

    switch (entry.level) {
      case "error":
        console.error(message);
        break;
      case "warn":
        console.warn(message);
        break;
      case "debug":
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: "info",
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: "warn",
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log({
      level: "error",
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "development") {
      this.log({
        level: "debug",
        message,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const logger = new Logger();
