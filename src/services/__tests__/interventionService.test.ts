import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type AppUsageRow = {
  appName: string;
  packageName: string;
  minutesUsed: number;
  pickups?: number;
};

type UsageResponse = {
  totalMinutes: number;
  pickups: number;
  apps: AppUsageRow[];
};

type SettingsResponse = {
  dailyLimitMinutes: number;
  limitWarnings: boolean;
  aiInterventionsEnabled: boolean;
  bedTime: string;
  focusAreas: string[];
  appLimits: Array<{
    appName: string;
    appPackage: string;
    dailyLimitMinutes: number;
  }>;
};

const mockStorage = new Map<string, string>();

const mockGetSettings = jest.fn<() => Promise<SettingsResponse>>();
const mockGetTodayUsage = jest.fn<() => Promise<UsageResponse>>();
const mockDisplayLocalNotification = jest.fn<(payload: unknown) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock('../../api/api', () => ({
  api: {
    getSettings: () => mockGetSettings(),
    getTodayUsage: () => mockGetTodayUsage(),
  },
}));

jest.mock('../notificationService', () => ({
  displayLocalNotification: (payload: unknown) =>
    mockDisplayLocalNotification(payload),
}));

describe('Module 8 - interventionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-04T22:30:00.000Z'));
    mockStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('TC_LIMITS_012 runLocalInterventionCheck fires approaching_limit rule at 75 percent usage', async () => {
    const { runLocalInterventionCheck } = require('../interventionService');

    const triggered = await runLocalInterventionCheck({
      settings: {
        dailyLimitMinutes: 100,
        limitWarnings: true,
        aiInterventionsEnabled: false,
        bedTime: '23:00',
        focusAreas: ['Social Media'],
        appLimits: [],
      },
      usageResponse: {
        apps: [
          {
            appName: 'Instagram',
            packageName: 'com.instagram.android',
            minutesUsed: 75,
            pickups: 10,
          },
        ],
        totalMinutes: 75,
        pickups: 10,
      },
    });

    expect(triggered).toEqual(['approaching_limit']);
    expect(mockDisplayLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Approaching your daily limit',
        data: expect.objectContaining({
          rule: 'approaching_limit',
          totalMinutes: 75,
          dailyLimitMinutes: 100,
        }),
      })
    );
  });

  it('TC_LIMITS_013 runLocalInterventionCheck fires limit_reached rule at or above daily limit', async () => {
    const { runLocalInterventionCheck } = require('../interventionService');

    const triggered = await runLocalInterventionCheck({
      settings: {
        dailyLimitMinutes: 90,
        limitWarnings: true,
        aiInterventionsEnabled: false,
        bedTime: '23:00',
        focusAreas: ['Social Media'],
        appLimits: [],
      },
      usageResponse: {
        totalMinutes: 95,
        pickups: 12,
        apps: [
          {
            appName: 'YouTube',
            packageName: 'com.google.android.youtube',
            minutesUsed: 95,
          },
        ],
      },
    });

    expect(triggered).toEqual(['limit_reached']);
    expect(mockDisplayLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Daily limit reached',
        data: expect.objectContaining({
          rule: 'limit_reached',
          totalMinutes: 95,
          dailyLimitMinutes: 90,
        }),
      })
    );
  });

  it('TC_LIMITS_014 runLocalInterventionCheck respects cooldown and avoids duplicate rule firing', async () => {
    const { runLocalInterventionCheck } = require('../interventionService');

    const payload = {
      settings: {
        dailyLimitMinutes: 100,
        limitWarnings: true,
        aiInterventionsEnabled: false,
        bedTime: '23:00',
        focusAreas: ['Social Media'],
        appLimits: [],
      },
      usageResponse: {
        totalMinutes: 80,
        pickups: 8,
        apps: [
          {
            appName: 'Instagram',
            packageName: 'com.instagram.android',
            minutesUsed: 80,
          },
        ],
      },
    };

    const first = await runLocalInterventionCheck(payload);
    const second = await runLocalInterventionCheck(payload);

    expect(first).toEqual(['approaching_limit']);
    expect(second).toEqual([]);
    expect(mockDisplayLocalNotification).toHaveBeenCalledTimes(1);
  });

  it('TC_LIMITS_015 runLocalInterventionCheck skips limit rules when limit warnings are disabled', async () => {
    const { runLocalInterventionCheck } = require('../interventionService');

    const triggered = await runLocalInterventionCheck({
      settings: {
        dailyLimitMinutes: 100,
        limitWarnings: false,
        aiInterventionsEnabled: false,
        bedTime: '23:00',
        focusAreas: ['Social Media'],
        appLimits: [],
      },
      usageResponse: {
        totalMinutes: 120,
        pickups: 10,
        apps: [
          {
            appName: 'Instagram',
            packageName: 'com.instagram.android',
            minutesUsed: 120,
          },
        ],
      },
    });

    expect(triggered).toEqual([]);
    expect(mockDisplayLocalNotification).not.toHaveBeenCalled();
  });
});