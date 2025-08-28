# Logging System

This application uses a centralized logging system to manage all console output.

## Quick Start

### 🚫 Disable All Logging
```typescript
// In src/utils/loggerConfig.ts
LOGGING_CONFIG.ENABLED = false;
```

### 🔇 Enable Only Errors
```typescript
// In src/utils/loggerConfig.ts
LOGGING_CONFIG.ENABLED = true;
LOGGING_CONFIG.LEVEL = LogLevel.ERROR;
```

### 🔍 Enable All Debug Messages
```typescript
// In src/utils/loggerConfig.ts  
LOGGING_CONFIG.ENABLED = true;
LOGGING_CONFIG.LEVEL = LogLevel.DEBUG;
```

## Configuration Options

### Global Settings (loggerConfig.ts)
- `ENABLED`: Master switch - set to `false` to disable ALL logging
- `LEVEL`: Control which messages show (DEBUG, INFO, WARN, ERROR, NONE)
- `SHOW_TIMESTAMPS`: Include timestamps in messages
- `SHOW_COMPONENTS`: Include component names in messages

### Component-Specific Settings
Disable logging for specific components:
```typescript
COMPONENTS: {
  ModelViewer: false,  // Disable all ModelViewer logs
  VideoViewer: true,   // Keep VideoViewer logs
  // ... etc
}
```

## Usage in Components

### Replace console.log calls:
```typescript
// Old way
console.log('Something happened');
console.error('An error occurred');

// New way
import { logger } from '../utils/logger';

logger.info('Something happened', 'ComponentName');
logger.error('An error occurred', 'ComponentName');
```

### Available methods:
- `logger.debug()` - Development/debugging info
- `logger.info()` - General information  
- `logger.warn()` - Warnings
- `logger.error()` - Errors
- `logger.group()` - Group related messages
- `logger.table()` - Tabular data

## Browser Console Access

In development, access the logger via browser console:
```javascript
// Disable all logging
window.logger.disable();

// Enable quiet mode (warnings/errors only)
window.logger.quietMode();

// Enable verbose mode (all messages)
window.logger.verboseMode();
```

## Implementation Status

✅ **Completed Files:**
- App.tsx
- MenuBar/menubar.tsx  
- BlogViewer/BlogModal.tsx
- BlogViewer/hashnodeAPI.ts
- LinkSpreadsheet/githubAPI.ts
- ContactForm/ContactForm.tsx
- PDFViewer/PDFGrid.tsx
- ModelViewer/ModelViewer.tsx (critical errors only)

⚠️ **Files with remaining console calls:**
- VideoViewer/* (extensive YouTube API logging)
- CodeViewer/* (editor event logging)  
- ModelViewer/ModelViewer.tsx (debug logging)

Note: Files not yet updated will continue using console.* directly until replaced.