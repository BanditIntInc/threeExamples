/**
 * Centralized logging system for the application
 * Provides a single place to control all console output
 */

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  showTimestamps: boolean;
  showComponent: boolean;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

class Logger {
  private config: LoggerConfig = {
    enabled: true, // Set to false to disable all logging
    level: LogLevel.DEBUG, // Only show messages at this level or higher
    showTimestamps: true,
    showComponent: true
  };

  /**
   * Update logger configuration
   */
  configure(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Enable or disable all logging
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Check if a message should be logged based on current config
   */
  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && level >= this.config.level;
  }

  /**
   * Format log message with optional metadata
   */
  private formatMessage(message: any, component?: string, level?: LogLevel): string {
    let formatted = '';
    
    if (this.config.showTimestamps) {
      const isoString = new Date().toISOString();
      const timePart = isoString.split('T')[1];
      const timestamp = timePart ? timePart.split('.')[0] : '00:00:00';
      formatted += `[${timestamp}] `;
    }

    if (this.config.showComponent && component) {
      formatted += `[${component}] `;
    }

    if (level !== undefined) {
      const levelName = LogLevel[level];
      formatted += `${levelName}: `;
    }

    formatted += typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
    
    return formatted;
  }

  /**
   * Debug level logging
   */
  debug(message: any, component?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(message, component, LogLevel.DEBUG));
    }
  }

  /**
   * Info level logging (replaces most console.log usage)
   */
  info(message: any, component?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(message, component, LogLevel.INFO));
    }
  }

  /**
   * Log method (for direct console.log replacement)
   */
  log(message: any, component?: string): void {
    this.info(message, component);
  }

  /**
   * Warning level logging
   */
  warn(message: any, component?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(message, component, LogLevel.WARN));
    }
  }

  /**
   * Error level logging
   */
  error(message: any, component?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(message, component, LogLevel.ERROR));
    }
  }

  /**
   * Group logging (for complex operations)
   */
  group(label: string, component?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.group(this.formatMessage(label, component));
    }
  }

  /**
   * End group logging
   */
  groupEnd(): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.groupEnd();
    }
  }

  /**
   * Table logging for structured data
   */
  table(data: any, component?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      if (component) {
        this.info(`Table data from ${component}:`);
      }
      console.table(data);
    }
  }

  /**
   * Performance timing
   */
  time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(label);
    }
  }

  /**
   * Disable all logging (shorthand)
   */
  disable(): void {
    this.setEnabled(false);
  }

  /**
   * Enable all logging (shorthand)
   */
  enable(): void {
    this.setEnabled(true);
  }

  /**
   * Quiet mode - only show warnings and errors
   */
  quietMode(): void {
    this.setLevel(LogLevel.WARN);
  }

  /**
   * Verbose mode - show all messages
   */
  verboseMode(): void {
    this.setLevel(LogLevel.DEBUG);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience methods for easy importing
export const { log, info, debug, warn, error, group, groupEnd, table, time, timeEnd } = logger;

// Export configuration methods
export const { configure, setEnabled, setLevel, disable, enable, quietMode, verboseMode } = logger;

// Development helper - expose logger to window in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).logger = logger;
}