/**
 * Global logger configuration
 * Modify these settings to control logging behavior across the entire application
 */

import { logger, LogLevel } from './logger';

// =============================================================================
// GLOBAL CONFIGURATION - CHANGE THESE VALUES TO CONTROL LOGGING
// =============================================================================

export const LOGGING_CONFIG = {
  // Set to false to disable ALL logging throughout the application
  ENABLED: true,
  
  // Set logging level (DEBUG = show all, WARN = only warnings/errors, ERROR = only errors, NONE = nothing)
  LEVEL: LogLevel.DEBUG,
  
  // Show timestamps in log messages
  SHOW_TIMESTAMPS: true,
  
  // Show component names in log messages
  SHOW_COMPONENTS: true,
  
  // Component-specific overrides (set to false to disable logging for specific components)
  COMPONENTS: {
    App: true,
    MenuBar: true,
    BlogViewer: true,
    BlogModal: true,
    HashnodeAPI: true,
    LinkSpreadsheet: true,
    GitHubAPI: true,
    VideoViewer: true,
    YouTubeAPI: true,
    ModelViewer: true,
    ContactForm: true,
    CodeViewer: true,
    PDFGrid: true
  }
};

// =============================================================================
// QUICK SETTINGS - UNCOMMENT ONE OF THESE FOR COMMON CONFIGURATIONS
// =============================================================================

// Production mode - only errors
// LOGGING_CONFIG.ENABLED = true;
// LOGGING_CONFIG.LEVEL = LogLevel.ERROR;

// Development mode - all messages
// LOGGING_CONFIG.ENABLED = true;
// LOGGING_CONFIG.LEVEL = LogLevel.DEBUG;

// Quiet mode - warnings and errors only
// LOGGING_CONFIG.ENABLED = true;
// LOGGING_CONFIG.LEVEL = LogLevel.WARN;

// Silent mode - no logging at all
// LOGGING_CONFIG.ENABLED = false;

// =============================================================================
// INITIALIZATION - DO NOT MODIFY BELOW THIS LINE
// =============================================================================

// Apply configuration to logger
export const initializeLogger = () => {
  logger.configure({
    enabled: LOGGING_CONFIG.ENABLED,
    level: LOGGING_CONFIG.LEVEL,
    showTimestamps: LOGGING_CONFIG.SHOW_TIMESTAMPS,
    showComponent: LOGGING_CONFIG.SHOW_COMPONENTS
  });
  
  // Log configuration status
  if (LOGGING_CONFIG.ENABLED) {
    logger.info(`🔧 Logger initialized - Level: ${LogLevel[LOGGING_CONFIG.LEVEL]}, Timestamps: ${LOGGING_CONFIG.SHOW_TIMESTAMPS}`, 'Logger');
  }
};

// Component-specific logger wrapper
export const getComponentLogger = (component: string) => {
  const isComponentEnabled = LOGGING_CONFIG.COMPONENTS[component as keyof typeof LOGGING_CONFIG.COMPONENTS];
  
  if (!isComponentEnabled) {
    // Return silent logger for disabled components
    return {
      debug: () => {},
      info: () => {},
      log: () => {},
      warn: () => {},
      error: () => {},
      group: () => {},
      groupEnd: () => {},
      table: () => {},
      time: () => {},
      timeEnd: () => {}
    };
  }
  
  // Return logger methods bound to component
  return {
    debug: (message: any) => logger.debug(message, component),
    info: (message: any) => logger.info(message, component),
    log: (message: any) => logger.log(message, component),
    warn: (message: any) => logger.warn(message, component),
    error: (message: any) => logger.error(message, component),
    group: (label: string) => logger.group(label, component),
    groupEnd: () => logger.groupEnd(),
    table: (data: any) => logger.table(data, component),
    time: (label: string) => logger.time(label),
    timeEnd: (label: string) => logger.timeEnd(label)
  };
};

// Initialize logger immediately
initializeLogger();