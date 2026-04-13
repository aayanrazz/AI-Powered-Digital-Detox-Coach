import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};

  const AsyncStorage = {
    setItem: jest.fn(async (key, value) => {
      store[key] = value;
      return null;
    }),

    getItem: jest.fn(async key => {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    }),

    removeItem: jest.fn(async key => {
      delete store[key];
      return null;
    }),

    clear: jest.fn(async () => {
      store = {};
      return null;
    }),

    getAllKeys: jest.fn(async () => {
      return Object.keys(store);
    }),

    multiGet: jest.fn(async keys => {
      return keys.map(key => [
        key,
        Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
      ]);
    }),

    multiSet: jest.fn(async entries => {
      entries.forEach(([key, value]) => {
        store[key] = value;
      });
      return null;
    }),

    multiRemove: jest.fn(async keys => {
      keys.forEach(key => {
        delete store[key];
      });
      return null;
    }),

    mergeItem: jest.fn(async (key, value) => {
      const existingValue = Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;

      try {
        const oldObject = existingValue ? JSON.parse(existingValue) : {};
        const newObject = value ? JSON.parse(value) : {};
        store[key] = JSON.stringify({ ...oldObject, ...newObject });
      } catch {
        store[key] = value;
      }

      return null;
    }),
  };

  return {
    __esModule: true,
    default: AsyncStorage,
    useAsyncStorage: jest.fn(key => ({
      getItem: () => AsyncStorage.getItem(key),
      setItem: value => AsyncStorage.setItem(key, value),
      mergeItem: value => AsyncStorage.mergeItem(key, value),
      removeItem: () => AsyncStorage.removeItem(key),
    })),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({
      x: 0,
      y: 0,
      width: 360,
      height: 800,
    }),
  };
});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    createChannel: jest.fn(async () => 'default'),
    displayNotification: jest.fn(async () => null),
    cancelAllNotifications: jest.fn(async () => null),
    getInitialNotification: jest.fn(async () => null),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
    AuthorizationStatus: {
      DENIED: 0,
      AUTHORIZED: 1,
      PROVISIONAL: 2,
    },
    EventType: {
      DISMISSED: 0,
      PRESS: 1,
      ACTION_PRESS: 2,
    },
  },
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(async () => true),
  canOpenURL: jest.fn(async () => true),
  openSettings: jest.fn(async () => true),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  getInitialURL: jest.fn(async () => null),
}));

beforeEach(() => {
  jest.clearAllMocks();
});