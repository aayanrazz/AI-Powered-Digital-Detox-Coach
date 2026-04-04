import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type UsageTrackerRow = {
  packageName: string;
  appName: string;
  minutesUsed: number;
  foregroundMs: number;
  pickups: number;
  unlocks: number;
  category: string;
};

type MockJsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
};

const mockStorage = new Map<string, string>();

const mockDisplayNotification = jest.fn<(payload: unknown) => Promise<void>>();
const mockCreateChannel = jest.fn<() => Promise<string>>();
const mockRequestPermission = jest.fn<() => Promise<void>>();
const mockUsageTrackerGetTodayUsage =
  jest.fn<() => Promise<UsageTrackerRow[]>>();
const mockFetch = jest.fn<
  (
    input: unknown,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) => Promise<MockJsonResponse>
>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage.get(key) ?? null)
    ),
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

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: () => mockRequestPermission(),
    createChannel: () => mockCreateChannel(),
    displayNotification: (payload: unknown) =>
      mockDisplayNotification(payload),
  },
  AndroidImportance: {
    HIGH: 'high',
  },
}));

jest.mock('../../native/usageTracker', () => ({
  usageTracker: {
    getTodayUsage: () => mockUsageTrackerGetTodayUsage(),
  },
}));

const buildResponse = (body: any): MockJsonResponse => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => '',
});

describe('Module 8 - usageIntervention.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockStorage.set('detox_token', 'token-123');

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-04T10:00:00.000Z'));

    mockCreateChannel.mockResolvedValue('detox-interventions');
    mockRequestPermission.mockResolvedValue(undefined);

    mockFetch.mockImplementation(async (url: unknown) => {
      const value = String(url);

      if (value.includes('/privacy/policy')) {
        return buildResponse({
          policy: {
            currentPrivacySettings: {
              consentGiven: true,
              dataCollection: true,
            },
          },
        });
      }

      if (value.includes('/settings')) {
        return buildResponse({
          appLimits: [
            {
              _id: 'limit-1',
              appName: 'Instagram',
              appPackage: 'com.instagram.android',
              category: 'Social Media',
              dailyLimitMinutes: 60,
            },
            {
              _id: 'limit-2',
              appName: 'YouTube',
              appPackage: 'com.google.android.youtube',
              category: 'Streaming',
              dailyLimitMinutes: 100,
            },
          ],
        });
      }

      if (value.includes('/usage/ingest')) {
        return buildResponse({ success: true });
      }

      if (value.includes('/usage/today')) {
        return buildResponse({ apps: [] });
      }

      throw new Error(`Unhandled fetch URL: ${value}`);
    });

    (globalThis as any).fetch = mockFetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('TC_LIMITS_009 refreshUsageAndRunImmediateInterventionCheck builds approaching and reached warnings from app limits', async () => {
    mockUsageTrackerGetTodayUsage.mockResolvedValue([
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 25,
        foregroundMs: 1_500_000,
        pickups: 4,
        unlocks: 3,
        category: 'Social Media',
      },
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 40,
        foregroundMs: 2_400_000,
        pickups: 5,
        unlocks: 4,
        category: 'Social Media',
      },
      {
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
        minutesUsed: 80,
        foregroundMs: 4_800_000,
        pickups: 2,
        unlocks: 2,
        category: 'Streaming',
      },
    ]);

    const { refreshUsageAndRunImmediateInterventionCheck } = require('../usageIntervention.service');

    const result = await refreshUsageAndRunImmediateInterventionCheck();

    expect(result.summary).toEqual({
      totalMinutes: 145,
      totalPickups: 11,
      totalUnlocks: 9,
      appCount: 2,
    });

    expect(result.triggeredWarnings).toEqual([
      expect.objectContaining({
        appName: 'Instagram',
        appPackage: 'com.instagram.android',
        usedMinutes: 65,
        limitMinutes: 60,
        level: 'limit_reached',
      }),
      expect.objectContaining({
        appName: 'YouTube',
        appPackage: 'com.google.android.youtube',
        usedMinutes: 80,
        limitMinutes: 100,
        level: 'approaching_limit',
      }),
    ]);

    expect(mockDisplayNotification).toHaveBeenCalledTimes(2);
  });

  it('TC_LIMITS_010 refreshUsageAndRunImmediateInterventionCheck syncs merged device usage to backend', async () => {
    mockUsageTrackerGetTodayUsage.mockResolvedValue([
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 20,
        foregroundMs: 1_200_000,
        pickups: 2,
        unlocks: 1,
        category: 'Social Media',
      },
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 10,
        foregroundMs: 600_000,
        pickups: 1,
        unlocks: 1,
        category: 'Social Media',
      },
    ]);

    const { refreshUsageAndRunImmediateInterventionCheck } = require('../usageIntervention.service');

    await refreshUsageAndRunImmediateInterventionCheck();

    const ingestCall = mockFetch.mock.calls.find((call) =>
      String(call[0]).includes('/usage/ingest')
    );

    expect(ingestCall).toBeDefined();

    const [, ingestOptions] = ingestCall as [
      unknown,
      { method?: string; headers?: Record<string, string>; body?: string }
    ];

    expect(ingestOptions.body).toBeDefined();

    expect(JSON.parse(ingestOptions.body ?? '{}')).toEqual(
      expect.objectContaining({
        sessions: [
          expect.objectContaining({
            appName: 'Instagram',
            appPackage: 'com.instagram.android',
            durationMinutes: 30,
            pickups: 3,
            unlocks: 2,
          }),
        ],
      })
    );
  });

  it('TC_LIMITS_011 refreshUsageAndRunImmediateInterventionCheck cooldown blocks duplicate warning inside 30 minutes', async () => {
    mockUsageTrackerGetTodayUsage.mockResolvedValue([
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 70,
        foregroundMs: 4_200_000,
        pickups: 6,
        unlocks: 3,
        category: 'Social Media',
      },
    ]);

    const { refreshUsageAndRunImmediateInterventionCheck } = require('../usageIntervention.service');

    const first = await refreshUsageAndRunImmediateInterventionCheck();
    const second = await refreshUsageAndRunImmediateInterventionCheck();

    expect(first.triggeredWarnings).toHaveLength(1);
    expect(second.triggeredWarnings).toEqual([]);
    expect(mockDisplayNotification).toHaveBeenCalledTimes(1);
  });
});