/**
 * HTTP Server Entry Point for SunPower ERP
 */

import { app } from './app.js';
import { config } from './config/index.js';
import { closePool } from './database/pool.js';

const server = app.listen(config.PORT, () => {
  console.log(`[SunPower ERP Server]: Running in ${config.NODE_ENV} mode on http://localhost:${config.PORT}`);
});

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`[SunPower ERP Server]: Received ${signal}, closing server and connection pools...`);
  server.close(async () => {
    try {
      await closePool();
      console.log('[SunPower ERP Server]: Database connections closed. Process terminating gracefully.');
      process.exit(0);
    } catch (err) {
      console.error('[SunPower ERP Server]: Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after 10s timeout
  setTimeout(() => {
    console.error('[SunPower ERP Server]: Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
