import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockStorage = new Map<string, string>();

const mockCreateChannel = jest.fn(async () => 'ok');
const mockDisplayNotification = jest.fn(async () => undefined);
const mockCreateTriggerNotification = jest.fn(async () => undefined);
const mockCancelNotification = jest.fn(async () => undefined);
const mockCancelAllNotifications = jest.fn(async () => undefined);
const mockGetInitialNotification = jest.fn(async () => null);
const mockOnForegroundEvent = jest.fn(() => jest.fn());

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: mockCreateChannel,
    displayNotification: mockDisplayNotification,
    createTriggerNotification: mockCreateTriggerNotification,
    cancelNotification: mockCancelNotification,
    cancelAllNotifications: mockCancelAllNotifications,
    getInitialNotification: mockGetInitialNotification,
    onForegroundEvent: mockOnForegroundEvent,
  },
  AndroidImportance: {
    HIGH: 'high',
    DEFAULT: 'default',
  },
  AndroidVisibility: {
    PUBLIC: 'public',
  },
  RepeatFrequency: {
    DAILY: 'daily',
  },
  TriggerType: {
    TIMESTAMP: 'timestamp',
  },
  EventType: {
    PRESS: 1,
    ACTION_PRESS: 2,
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 33 },
  PermissionsAndroid: {
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
    request: jest.fn(async () => 'granted' as const),
  },
}));

jest.mock('../../api/api', () => ({
  api: {
    markNotificationRead: jest.fn(async () => ({ success: true })),
  },
}));

jest.mock('../../config/appConfig', () => ({
  APP_CONFIG: {
    STORAGE_KEYS: {
      TOKEN: 'token',
    },
  },
}));

jest.mock('../../navigation/navigationService', () => ({
  navigationRef: {
    isReady: () => true,
  },
}));

jest.mock('../../utils/notificationActions', () => ({
  executeNotificationAction: jest.fn(async () => undefined),
}));

describe('Module 12 - notificationService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockStorage.clear();
  });

  it('TC_ENGAGE_017 maps local notification display payload to correct channel and press action', async () => {
    const { displayLocalNotification } = require('../notificationService');

    await displayLocalNotification({
      id: 'notif-1',
      title: 'Reward unlocked',
      body: 'Open rewards',
      ctaAction: 'open_rewards',
      ctaLabel: 'VIEW REWARDS',
      backendNotificationId: 'backend-1',
      data: {
        score: 25,
        urgent: true,
      },
    });

    expect(mockCreateChannel).toHaveBeenCalled();

    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'notif-1',
        title: 'Reward unlocked',
        body: 'Open rewards',
        data: expect.objectContaining({
          ctaAction: 'open_rewards',
          ctaLabel: 'VIEW REWARDS',
          backendNotificationId: 'backend-1',
          score: '25',
          urgent: 'true',
        }),
        android: expect.objectContaining({
          channelId: 'detox_achievements',
          pressAction: { id: 'open_rewards' },
        }),
      })
    );
  });

  it('TC_ENGAGE_018 schedules summary and bedtime reminders based on enabled settings', async () => {
    const { scheduleCoreDetoxReminders } = require('../notificationService');

    await scheduleCoreDetoxReminders({
      notificationsEnabled: true,
      aiInterventionsEnabled: true,
      bedTime: '22:45',
      dailySummaryTime: '21:00',
    });

    expect(mockCancelNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateTriggerNotification).toHaveBeenCalledTimes(2);

    const firstCall = mockCreateTriggerNotification.mock.calls[0] as unknown as any[];
    const secondCall = mockCreateTriggerNotification.mock.calls[1] as unknown as any[];

    expect(firstCall[0]).toEqual(
      expect.objectContaining({
        id: 'detox_daily_summary',
        title: 'Daily digital wellness check-in',
      })
    );

    expect(secondCall[0]).toEqual(
      expect.objectContaining({
        id: 'detox_bedtime_reminder',
        title: 'Wind down time',
      })
    );
  });
});