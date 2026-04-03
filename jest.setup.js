jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};

  const AsyncStorage = {
    setItem: jest.fn(async (key, value) => {
      store[key] = value;
    }),

    getItem: jest.fn(async key => {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    }),

    removeItem: jest.fn(async key => {
      delete store[key];
    }),

    clear: jest.fn(async () => {
      store = {};
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
    }),

    multiRemove: jest.fn(async keys => {
      keys.forEach(key => {
        delete store[key];
      });
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
    SafeAreaView: ({ children }) => React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});