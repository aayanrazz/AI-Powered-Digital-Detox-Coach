import { Platform } from 'react-native';

const androidEmulatorBaseUrl = 'http://10.0.2.2:5000/api';
const iosSimulatorBaseUrl = 'http://localhost:5000/api';

export const APP_CONFIG = {
  API_BASE_URL:
    Platform.OS === 'android'
      ? androidEmulatorBaseUrl
      : iosSimulatorBaseUrl,

  API_TIMEOUT_MS: 60000,

  STORAGE_KEYS: {
    TOKEN: 'detox_token',
    USER: 'detox_user',
  },
};