// Controllable expo-location mock.
let permissionResult = { status: 'granted' };
let nextFix = { coords: { longitude: 36.821456, latitude: -1.292345, accuracy: 8 } };
let nextFixError = null;

const LocationMock = {
  Accuracy: { Balanced: 3, High: 4, Low: 1 },
  requestForegroundPermissionsAsync: jest.fn(async () => permissionResult),
  getCurrentPositionAsync: jest.fn(async () => {
    if (nextFixError) {
      const e = nextFixError;
      throw e;
    }
    return nextFix;
  }),
  __setPermission: (status) => {
    permissionResult = { status };
  },
  __setFix: (fix) => {
    nextFix = fix;
    nextFixError = null;
  },
  __setFixError: (err) => {
    nextFixError = err;
  },
  __reset: () => {
    permissionResult = { status: 'granted' };
    nextFix = { coords: { longitude: 36.821456, latitude: -1.292345, accuracy: 8 } };
    nextFixError = null;
    LocationMock.requestForegroundPermissionsAsync.mockReset();
    LocationMock.requestForegroundPermissionsAsync.mockImplementation(async () => permissionResult);
    LocationMock.getCurrentPositionAsync.mockReset();
    LocationMock.getCurrentPositionAsync.mockImplementation(async () => {
      if (nextFixError) {
        const e = nextFixError;
        throw e;
      }
      return nextFix;
    });
  }
};

module.exports = LocationMock;
module.exports.default = LocationMock;
