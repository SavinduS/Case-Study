// In-memory AsyncStorage mock with failure injection for quota tests.
let store = {};
let failNextSetItem = null;

const AsyncStorageMock = {
  getItem: jest.fn(async (key) => (key in store ? store[key] : null)),
  setItem: jest.fn(async (key, value) => {
    if (failNextSetItem) {
      const err = failNextSetItem;
      failNextSetItem = null;
      throw err;
    }
    store[key] = String(value);
  }),
  removeItem: jest.fn(async (key) => {
    delete store[key];
  }),
  clear: jest.fn(async () => {
    store = {};
  }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, store[k] ?? null])),
  __reset: () => {
    store = {};
    failNextSetItem = null;
    AsyncStorageMock.getItem.mockClear();
    AsyncStorageMock.setItem.mockClear();
    AsyncStorageMock.removeItem.mockClear();
    AsyncStorageMock.clear.mockClear();
  },
  __setStore: (next) => {
    store = { ...next };
  },
  __getStore: () => ({ ...store }),
  __failNextSetItem: (err) => {
    failNextSetItem = err;
  }
};

module.exports = AsyncStorageMock;
module.exports.default = AsyncStorageMock;
