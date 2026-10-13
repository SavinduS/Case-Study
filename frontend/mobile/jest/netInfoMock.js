// Controllable NetInfo mock. Production code reads connectivity through
// services/connectivity.ts; tests drive transitions with __emit().
let online = false;
const listeners = new Set();

function currentState() {
  return { isConnected: online, isInternetReachable: online };
}

const NetInfoMock = {
  fetch: async () => currentState(),
  addEventListener: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  __setOnline: (value) => {
    online = Boolean(value);
  },
  __emit: (value) => {
    online = Boolean(value);
    for (const listener of [...listeners]) listener(currentState());
  },
  __listenerCount: () => listeners.size,
  __reset: () => {
    online = false;
    listeners.clear();
  }
};

module.exports = NetInfoMock;
module.exports.default = NetInfoMock;
