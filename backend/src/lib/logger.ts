import { pino } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured application logger. In development, output is prettified;
 * in production and test, raw JSON lines are emitted for log aggregation.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
      }
    : {}),
  base: { service: 'reframely-backend' },
});
