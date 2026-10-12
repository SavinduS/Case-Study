const { DISPATCH_MAX_RETRIES } = require('../utils/collarAlertConstants');

/**
 * Delivery channel for the ranger dispatch notification (main flow step 8 and
 * exception flow 3).
 *
 * The physical ranger handsets and the gateway that reaches them are not part of
 * this deployment, so a real remote call cannot be proven here. Rather than
 * report a success that never happened, delivery is split into two adapters:
 *
 *   - HttpRangerGateway  used when RANGER_GATEWAY_URL is configured. It POSTs
 *     the dispatch to that URL and treats any non-2xx answer, a timeout or a
 *     transport error as a failed delivery. This is the production path.
 *   - MemoryRangerGateway the default when no gateway URL is configured. It is
 *     an explicitly labelled test adapter: it accepts the notification only for
 *     a team whose `gatewayReachable` flag is not false, and otherwise reports
 *     the unit as unreachable so the retry and "Failed Delivery" behaviour is
 *     exercisable end to end.
 *
 * Either way the returned boolean is what `alertService.sendDispatch` records
 * and what the officer is shown, so a dispatch request is never reported as a
 * delivered notification unless the channel actually accepted it.
 */

const GATEWAY_TIMEOUT_MS = 5000;

/** MOCK ADAPTER — used when no RANGER_GATEWAY_URL is configured. */
const memoryGateway = {
  name: 'memory',
  isMock: true,
  async deliver({ ranger }) {
    if (!ranger) return false;
    return ranger.gatewayReachable !== false;
  }
};

/** Real adapter — used when RANGER_GATEWAY_URL is configured. */
function httpGateway(url) {
  return {
    name: 'http',
    isMock: false,
    async deliver({ alert, ranger, attempt }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            alertId: alert.alertId,
            attempt,
            collarId: alert.collarId,
            species: alert.species,
            threatLevel: alert.threatLevel,
            position: alert.position,
            zoneName: alert.zoneName,
            gridRef: alert.gridRef,
            detectedAt: alert.detectedAt,
            rangerId: ranger?.rangerId ?? null,
            rangerName: ranger?.name ?? null,
            channel: ranger?.contactChannel ?? 'mobile-app'
          })
        });
        return response.ok;
      } catch {
        // Timeout, DNS failure, refused connection — all mean "not delivered".
        return false;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

let injected = null;

/**
 * The gateway in use. Tests replace it with `setGateway()`; production reads
 * RANGER_GATEWAY_TOKEN's sibling, RANGER_GATEWAY_URL, from the environment.
 */
function gateway() {
  if (injected) return injected;
  const url = process.env.RANGER_GATEWAY_URL;
  return url ? httpGateway(url) : memoryGateway;
}

/**
 * Sends one dispatch notification. Resolves to true only when the channel
 * accepted it; the caller decides how many times to retry.
 */
async function deliverDispatch(payload) {
  return gateway().deliver(payload);
}

/** Test seam: swap the gateway, or pass null to go back to the environment. */
function setGateway(next) {
  injected = next;
}

function describeGateway() {
  const active = gateway();
  return { name: active.name, isMock: Boolean(active.isMock), maxRetries: DISPATCH_MAX_RETRIES };
}

module.exports = { deliverDispatch, setGateway, describeGateway, memoryGateway };