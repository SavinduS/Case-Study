import { DISPATCH_MAX_RETRIES } from '../domain/constants.js';

/**
 * SystemNotificationService stand-in.
 *
 * Sends the dispatch notification to the ranger mobile unit. Mirrors
 * exception flow 3: retries automatically up to three times, then reports
 * "failed delivery" so the officer can fall back to radio.
 */
export default class NotificationService {
  constructor({ maxRetries = DISPATCH_MAX_RETRIES, shouldFail = () => false, delayMs = 0 } = {}) {
    this.maxRetries = maxRetries;
    this.shouldFail = shouldFail;
    this.delayMs = delayMs;
    this.sent = [];
  }

  /** Deliveries recorded in this session, used by the audit trail view. */
  deliveryLog() {
    return [...this.sent];
  }

  /**
   * @returns {Promise<{ delivered: boolean, attempts: number, error?: string }>}
   */
  async sendDispatch(alert, ranger) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      if (this.delayMs > 0) await wait(this.delayMs);
      if (!this.shouldFail({ alert, ranger, attempt })) {
        this.sent.push({ alertId: alert.alertId, rangerId: ranger?.rangerId ?? null, attempt });
        return { delivered: true, attempts: attempt };
      }
      lastError = 'Ranger mobile unit unreachable';
    }

    return { delivered: false, attempts: this.maxRetries, error: lastError };
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}