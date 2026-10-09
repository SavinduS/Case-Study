jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, ...rest }) => React.createElement(View, rest, children),
    useSafeAreaInsets: () => insets
  };
});

// The node/undici FormData coerces object parts to "[object Object]" and RN
// no longer exports FormData; the app uses Expo's winter-fetch FormData, which
// keeps { name, type, bytes() } parts intact.
class ExpoStyleFormData {
  constructor() {
    this._parts = [];
  }
  append(key, value) {
    this._parts.push([key, value]);
  }
}
global.FormData = ExpoStyleFormData;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-constants', () => ({
  expoConfig: { hostUri: '192.168.50.10:8081' }
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { longitude: 81.42, latitude: 6.62, accuracy: 12.4 }
  }))
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] }))
}));

jest.mock('expo-file-system', () => ({
  File: class File {
    constructor(uri) {
      this.uri = uri;
    }
    async bytes() {
      return new Uint8Array([1, 2, 3, 4]);
    }
  }
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const { forwardRef, useImperativeHandle } = React;
  const WebView = forwardRef((props, ref) => {
    useImperativeHandle(ref, () => ({ postMessage: jest.fn() }));
    return React.createElement(View, { ...props, testID: props.testID ?? 'webview' });
  });
  return { WebView };
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(async () => ({ isConnected: true }))
}));
