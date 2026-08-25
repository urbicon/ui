import type { AuthLogger } from '../types.js';

/**
 * Shield every log call from a throwing consumer sink. Several call sites log
 * inside detached fire-and-forget blocks (forgot-password, change-email) where
 * a throwing `logger.error` would become an unhandled promise rejection, and
 * others log after a security-relevant write already succeeded — a broken
 * logging transport must never break the auth flow it observes.
 */
export function shieldLogger(logger: AuthLogger): AuthLogger {
  return {
    warn(message, ...context) {
      try {
        logger.warn(message, ...context);
      } catch {
        /* a broken sink must not break auth */
      }
    },
    error(message, ...context) {
      try {
        logger.error(message, ...context);
      } catch {
        /* a broken sink must not break auth */
      }
    }
  };
}
