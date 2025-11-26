/**
 * Task Configuration Module
 * 
 * Loads configuration from environment variables with defaults and validation.
 * Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4
 */

export interface TaskConfig {
  /** Default task timeout in milliseconds (default: 60000ms / 1 minute) */
  TASK_TIMEOUT_MS: number;
  /** Maximum allowed task timeout in milliseconds (default: 600000ms / 10 minutes) */
  MAX_TASK_TIMEOUT_MS: number;
  /** Minimum allowed task timeout in milliseconds (default: 5000ms / 5 seconds) */
  MIN_TASK_TIMEOUT_MS: number;
  /** Maximum queue length (default: 1000) */
  MAX_QUEUE_LENGTH: number;
  /** Task result TTL in milliseconds (default: 300000ms / 5 minutes) */
  TASK_RESULT_TTL_MS: number;
}

const DEFAULT_CONFIG: TaskConfig = {
  TASK_TIMEOUT_MS: 60000,
  MAX_TASK_TIMEOUT_MS: 600000,
  MIN_TASK_TIMEOUT_MS: 5000,
  MAX_QUEUE_LENGTH: 1000,
  TASK_RESULT_TTL_MS: 300000,
};

/**
 * Parse an integer from environment variable with validation
 */
function parseEnvInt(value: string | undefined, defaultValue: number, name: string): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  
  if (isNaN(parsed) || parsed < 0) {
    console.warn(`Invalid value for ${name}: "${value}". Using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Load task configuration from environment variables
 */
function loadConfig(): TaskConfig {
  return {
    TASK_TIMEOUT_MS: parseEnvInt(
      process.env.TASK_TIMEOUT_MS,
      DEFAULT_CONFIG.TASK_TIMEOUT_MS,
      'TASK_TIMEOUT_MS'
    ),
    MAX_TASK_TIMEOUT_MS: parseEnvInt(
      process.env.MAX_TASK_TIMEOUT_MS,
      DEFAULT_CONFIG.MAX_TASK_TIMEOUT_MS,
      'MAX_TASK_TIMEOUT_MS'
    ),
    MIN_TASK_TIMEOUT_MS: parseEnvInt(
      process.env.MIN_TASK_TIMEOUT_MS,
      DEFAULT_CONFIG.MIN_TASK_TIMEOUT_MS,
      'MIN_TASK_TIMEOUT_MS'
    ),
    MAX_QUEUE_LENGTH: parseEnvInt(
      process.env.MAX_QUEUE_LENGTH,
      DEFAULT_CONFIG.MAX_QUEUE_LENGTH,
      'MAX_QUEUE_LENGTH'
    ),
    TASK_RESULT_TTL_MS: parseEnvInt(
      process.env.TASK_RESULT_TTL_MS,
      DEFAULT_CONFIG.TASK_RESULT_TTL_MS,
      'TASK_RESULT_TTL_MS'
    ),
  };
}

/**
 * Normalize a timeout value to be within allowed bounds
 * 
 * - If timeout is undefined, returns default TASK_TIMEOUT_MS
 * - If timeout < MIN_TASK_TIMEOUT_MS, returns MIN_TASK_TIMEOUT_MS
 * - If timeout > MAX_TASK_TIMEOUT_MS, returns MAX_TASK_TIMEOUT_MS
 * - Otherwise returns the provided timeout
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export function normalizeTimeout(timeout: number | undefined, config: TaskConfig): number {
  if (timeout === undefined) {
    return config.TASK_TIMEOUT_MS;
  }

  if (timeout < config.MIN_TASK_TIMEOUT_MS) {
    return config.MIN_TASK_TIMEOUT_MS;
  }

  if (timeout > config.MAX_TASK_TIMEOUT_MS) {
    return config.MAX_TASK_TIMEOUT_MS;
  }

  return timeout;
}

// Export singleton config instance
export const taskConfig: TaskConfig = loadConfig();

// Export defaults for testing
export const DEFAULT_TASK_CONFIG = DEFAULT_CONFIG;
