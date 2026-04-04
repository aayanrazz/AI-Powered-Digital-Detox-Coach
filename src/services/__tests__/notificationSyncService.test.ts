import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockStorage = new Map<string, string>();

const mockGetSettings = jest.fn<() => Promise<any>>();
const mockGetNotifications = jest.fn<() => Promise<any>>();
const mockDisplayLocalNotification = jest.fn(async (_payload?: any) => undefined);
const mockScheduleCoreDetoxReminders = jest.fn(async (_payload?: any) => undefined);
const mockCancelBackendNotification = jest.fn(async (_id?: string) => undefined);
const mockCancelAllDetoxNotifications = jest.fn(async () => undefined);
const mockClearPendingPress = jest.fn(async () => undefined);

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

jest.mock('../../api/api', () => ({
  api: {
    getSettings: () => mockGetSettings(),
    getNotifications: () => mockGetNotifications(),
  },
}));

jest.mock('../../utils/authSession', () => ({
  isAuthSessionError: (error: any) => error?.code === 'AUTH_EXPIRED',
}));

jest.mock('../notificationService', () => ({
  NOTIFICATION_CHANNELS: {
    INTERVENTIONS: 'detox_interventions',
    REMINDERS: 'detox_reminders',
    ACHIEVEMENTS: 'detox_achievements',
  },
  buildBackendDeviceNotificationId: (id: string) => `detox_backend_${id}`,
  cancelAllDetoxNotifications: () => mockCancelAllDetoxNotifications(),
  cancelBackendNotification: (id: string) => mockCancelBackendNotification(id),
  clearPendingNotificationPress: () => mockClearPendingPress(),
  displayLocalNotification: (payload: any) => mockDisplayLocalNotification(payload),
  scheduleCoreDetoxReminders: (payload: any) => mockScheduleCoreDetoxReminders(payload),
}));

describe('Module 12 - notificationSyncService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockStorage.clear();
  });

  it('TC_ENGAGE_019 syncDetoxNotifications delivers unread notifications, respects settings, and stores delivered ids', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        notificationsEnabled: true,
        aiInterventionsEnabled: true,
        achievementAlerts: true,
        limitWarnings: false,
        bedTime: '23:00',
        focusAreas: ['Study'],
        appLimits: [],
      },
    });

    mockGetNotifications.mockResolvedValue({
      notifications: [
        {
          _id: 'notif-1',
          title: 'Reward redeemed',
          message: 'Check rewards',
          type: 'achievement',
          read: false,
          ctaLabel: 'VIEW REWARDS',
          ctaAction: 'open_rewards',
        },
        {
          _id: 'notif-2',
          title: 'Limit warning',
          message: 'You are near your limit',
          type: 'limit_warning',
          read: false,
          ctaLabel: 'OPEN',
          ctaAction: 'open_home',
        },
      ],
    });

    const { syncDetoxNotifications } = require('../notificationSyncService');

    await syncDetoxNotifications();

    expect(mockScheduleCoreDetoxReminders).toHaveBeenCalledWith(
      expect.objectContaining({
        bedTime: '23:00',
        dailySummaryTime: '22:00',
      })
    );

    expect(mockDisplayLocalNotification).toHaveBeenCalledTimes(1);
    expect(mockDisplayLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'detox_backend_notif-1',
        backendNotificationId: 'notif-1',
        channelId: 'detox_achievements',
      })
    );
  });

  it('TC_ENGAGE_020 resetDetoxNotificationSync clears delivered ids, reminder signature, and pending notifications', async () => {
    mockStorage.set(
      'detox_delivered_backend_notification_ids',
      JSON.stringify(['notif-1', 'notif-2'])
    );
    mockStorage.set('detox_reminder_signature', 'sig-1');

    const { resetDetoxNotificationSync } = require('../notificationSyncService');

    await resetDetoxNotificationSync();

    expect(mockClearPendingPress).toHaveBeenCalledTimes(1);
    expect(mockCancelAllDetoxNotifications).toHaveBeenCalledTimes(1);
    expect(mockStorage.has('detox_delivered_backend_notification_ids')).toBe(false);
    expect(mockStorage.has('detox_reminder_signature')).toBe(false);
  });
});