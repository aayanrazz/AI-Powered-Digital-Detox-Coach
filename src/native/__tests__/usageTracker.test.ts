import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

type NativeUsageRow = {
  packageName: string;
  appName: string;
  foregroundMs: number | string;
  minutesUsed: number | string;
  lastTimeUsed?: number | string;
  pickups?: number | string;
  unlocks?: number | string;
  category?: string;
};

type MockUsageStatsModule = {
  isUsagePermissionGranted: jest.Mock<() => Promise<boolean>>;
  openUsageAccessSettings: jest.Mock<() => Promise<boolean | void>>;
  getTodayUsageStats: jest.Mock<() => Promise<NativeUsageRow[]>>;
};

type LoadOptions = {
  os?: 'android' | 'ios';
  usageStatsModule?: MockUsageStatsModule | undefined;
};

const createNativeModule = (
  overrides: Partial<MockUsageStatsModule> = {}
): MockUsageStatsModule => ({
  isUsagePermissionGranted: jest
    .fn<() => Promise<boolean>>()
    .mockResolvedValue(true),
  openUsageAccessSettings: jest
    .fn<() => Promise<boolean | void>>()
    .mockResolvedValue(true),
  getTodayUsageStats: jest
    .fn<() => Promise<NativeUsageRow[]>>()
    .mockResolvedValue([]),
  ...overrides,
});

function loadUsageTracker(options: LoadOptions = {}) {
  const os = options.os ?? 'android';
  const usageStatsModule = options.usageStatsModule;

  jest.resetModules();

  const openURL = jest
    .fn<(url: string) => Promise<void>>()
    .mockResolvedValue(undefined);

  jest.doMock('react-native', () => ({
    Platform: {
      OS: os,
      select: (config: Record<string, any>) => config?.[os],
    },
    NativeModules: {
      UsageStatsModule: usageStatsModule,
    },
    Linking: {
      openURL,
    },
  }));

  const module = require('../usageTracker');

  return {
    usageTracker: module.usageTracker,
    openURL,
    usageStatsModule,
  };
}

describe('usageTracker Android device usage collection module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('TC_USAGE_001 usageTracker reports supported on Android when native bridge exists', () => {
    const nativeModule = createNativeModule();

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    expect(usageTracker.supported).toBe(true);
  });

  it('TC_USAGE_002 usageTracker reports unsupported when platform is not Android or bridge is missing', () => {
    const androidWithoutBridge = loadUsageTracker({
      os: 'android',
      usageStatsModule: undefined,
    });

    expect(androidWithoutBridge.usageTracker.supported).toBe(false);

    const iosWithBridge = loadUsageTracker({
      os: 'ios',
      usageStatsModule: createNativeModule(),
    });

    expect(iosWithBridge.usageTracker.supported).toBe(false);
  });

  it('TC_USAGE_003 permission check returns native result and uses short cache', async () => {
    const nativeModule = createNativeModule({
      isUsagePermissionGranted: jest
        .fn<() => Promise<boolean>>()
        .mockResolvedValue(true),
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    await expect(usageTracker.isPermissionGranted()).resolves.toBe(true);

    nowSpy.mockReturnValue(5000);

    await expect(usageTracker.isPermissionGranted()).resolves.toBe(true);

    expect(nativeModule.isUsagePermissionGranted).toHaveBeenCalledTimes(1);
  });

  it('TC_USAGE_004 permission check force refresh bypasses cache', async () => {
    const nativeModule = createNativeModule({
      isUsagePermissionGranted: jest
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    await expect(usageTracker.isPermissionGranted()).resolves.toBe(true);

    nowSpy.mockReturnValue(2000);

    await expect(usageTracker.isPermissionGranted(true)).resolves.toBe(false);

    expect(nativeModule.isUsagePermissionGranted).toHaveBeenCalledTimes(2);
  });

  it('TC_USAGE_005 open permission settings delegates to native bridge', async () => {
    const nativeModule = createNativeModule({
      openUsageAccessSettings: jest
        .fn<() => Promise<boolean | void>>()
        .mockResolvedValue(true),
    });

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    await expect(usageTracker.openPermissionSettings()).resolves.toBe(true);

    expect(nativeModule.openUsageAccessSettings).toHaveBeenCalledTimes(1);
  });

  it('TC_USAGE_006 getTodayUsage filters blocked system apps and invalid rows', async () => {
    const nativeModule = createNativeModule({
      getTodayUsageStats: jest.fn<() => Promise<NativeUsageRow[]>>().mockResolvedValue([
        {
          packageName: 'com.google.android.apps.nexuslauncher',
          appName: 'Pixel Launcher',
          foregroundMs: 600000,
          minutesUsed: 10,
          category: 'Other',
        },
        {
          packageName: 'com.android.systemui.quickpanel',
          appName: 'System UI',
          foregroundMs: 300000,
          minutesUsed: 5,
          category: 'Other',
        },
        {
          packageName: 'com.example.permission',
          appName: 'Permission Controller',
          foregroundMs: 300000,
          minutesUsed: 5,
          category: 'Other',
        },
        {
          packageName: '',
          appName: 'Broken App',
          foregroundMs: 300000,
          minutesUsed: 5,
          category: 'Other',
        },
        {
          packageName: 'com.real.app',
          appName: 'Real App',
          foregroundMs: 0,
          minutesUsed: 0,
          category: 'Other',
        },
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          foregroundMs: 1200000,
          minutesUsed: 20,
          category: 'social networking',
        },
      ]),
    });

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    const apps = await usageTracker.getTodayUsage(true);

    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual(
      expect.objectContaining({
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 20,
      })
    );
  });

  it('TC_USAGE_007 getTodayUsage normalizes numeric fields, category, and sorting', async () => {
    const nativeModule = createNativeModule({
      getTodayUsageStats: jest.fn<() => Promise<NativeUsageRow[]>>().mockResolvedValue([
        {
          packageName: 'com.netflix.mediaclient',
          appName: 'Netflix',
          foregroundMs: '900000',
          minutesUsed: '15',
          lastTimeUsed: '1712345678901',
          pickups: '2',
          unlocks: '3',
          category: 'streaming video',
        },
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          foregroundMs: '1200000',
          minutesUsed: '20',
          lastTimeUsed: '1712345678999',
          pickups: '5',
          unlocks: '7',
          category: 'social networking',
        },
      ]),
    });

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    const apps = await usageTracker.getTodayUsage(true);

    expect(apps).toHaveLength(2);

    expect(apps[0]).toEqual({
      packageName: 'com.instagram.android',
      appName: 'Instagram',
      foregroundMs: 1200000,
      minutesUsed: 20,
      lastTimeUsed: 1712345678999,
      pickups: 5,
      unlocks: 7,
      category: 'Social Media',
    });

    expect(apps[1]).toEqual({
      packageName: 'com.netflix.mediaclient',
      appName: 'Netflix',
      foregroundMs: 900000,
      minutesUsed: 15,
      lastTimeUsed: 1712345678901,
      pickups: 2,
      unlocks: 3,
      category: 'Streaming',
    });
  });

  it('TC_USAGE_008 getTodayUsage uses recent usage cache', async () => {
    const nativeModule = createNativeModule({
      getTodayUsageStats: jest.fn<() => Promise<NativeUsageRow[]>>().mockResolvedValue([
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          foregroundMs: 1200000,
          minutesUsed: 20,
          category: 'social networking',
        },
      ]),
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    const first = await usageTracker.getTodayUsage();
    nowSpy.mockReturnValue(5000);
    const second = await usageTracker.getTodayUsage();

    expect(nativeModule.getTodayUsageStats).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('TC_USAGE_009 getTodayUsage bypasses cache when force refresh is requested', async () => {
    const nativeModule = createNativeModule({
      getTodayUsageStats: jest
        .fn<() => Promise<NativeUsageRow[]>>()
        .mockResolvedValueOnce([
          {
            packageName: 'com.instagram.android',
            appName: 'Instagram',
            foregroundMs: 1200000,
            minutesUsed: 20,
            category: 'social networking',
          },
        ])
        .mockResolvedValueOnce([
          {
            packageName: 'com.netflix.mediaclient',
            appName: 'Netflix',
            foregroundMs: 900000,
            minutesUsed: 15,
            category: 'streaming video',
          },
        ]),
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    const first = await usageTracker.getTodayUsage();
    nowSpy.mockReturnValue(2000);
    const second = await usageTracker.getTodayUsage(true);

    expect(nativeModule.getTodayUsageStats).toHaveBeenCalledTimes(2);
    expect(first[0].packageName).toBe('com.instagram.android');
    expect(second[0].packageName).toBe('com.netflix.mediaclient');
  });

  it('TC_USAGE_010 getTodayUsage rejects on timeout when native bridge hangs', async () => {
    jest.useFakeTimers();

    const nativeModule = createNativeModule({
      getTodayUsageStats: jest.fn<() => Promise<NativeUsageRow[]>>(
        () =>
          new Promise<NativeUsageRow[]>(() => {
            // intentionally never resolves
          })
      ),
      openUsageAccessSettings: jest
        .fn<() => Promise<boolean | void>>()
        .mockResolvedValue(true),
    });

    const { usageTracker } = loadUsageTracker({
      os: 'android',
      usageStatsModule: nativeModule,
    });

    const request = usageTracker.getTodayUsage(true);
    const rejectionAssertion = expect(request).rejects.toThrow(
      'Reading Android usage took too long.'
    );

    await jest.advanceTimersByTimeAsync(12001);
    await rejectionAssertion;

    expect(nativeModule.getTodayUsageStats).toHaveBeenCalledTimes(1);
  });
});