import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type LoadOptions = {
  os?: 'android' | 'ios';
  usageTrackerSupported?: boolean;
  permissionGranted?: boolean;
  usageRows?: any[];
  policyResponse?: any;
  policyError?: Error | null;
  ingestError?: Error | null;
  permissionError?: Error | null;
  usageError?: Error | null;
};

function loadDashboardUsageSync(options: LoadOptions = {}) {
  const os = options.os ?? 'android';

  const mockGetPrivacyPolicy = jest.fn();
  const mockIngestUsage = jest.fn();
  const mockIsPermissionGranted = jest.fn();
  const mockGetTodayUsage = jest.fn();

  jest.resetModules();

  jest.doMock('react-native', () => ({
    Platform: {
      OS: os,
      select: (config: Record<string, any>) => config?.[os],
    },
  }));

  if (options.policyError) {
    mockGetPrivacyPolicy.mockImplementation(async () => {
      throw options.policyError;
    });
  } else {
    mockGetPrivacyPolicy.mockImplementation(async () => {
      return (
        options.policyResponse ?? {
          policy: {
            currentPrivacySettings: {
              consentGiven: true,
              dataCollection: true,
            },
          },
        }
      );
    });
  }

  if (options.ingestError) {
    mockIngestUsage.mockImplementation(async () => {
      throw options.ingestError;
    });
  } else {
    mockIngestUsage.mockImplementation(async () => {
      return { success: true };
    });
  }

  if (options.permissionError) {
    mockIsPermissionGranted.mockImplementation(async () => {
      throw options.permissionError;
    });
  } else {
    mockIsPermissionGranted.mockImplementation(async () => {
      return options.permissionGranted ?? true;
    });
  }

  if (options.usageError) {
    mockGetTodayUsage.mockImplementation(async () => {
      throw options.usageError;
    });
  } else {
    mockGetTodayUsage.mockImplementation(async () => {
      return options.usageRows ?? [];
    });
  }

  jest.doMock('../../api/api', () => ({
    api: {
      getPrivacyPolicy: () => mockGetPrivacyPolicy(),
      ingestUsage: (payload: { apps: any[] }) => mockIngestUsage(payload),
    },
  }));

  jest.doMock('../../native/usageTracker', () => ({
    usageTracker: {
      supported: options.usageTrackerSupported ?? true,
      isPermissionGranted: () => mockIsPermissionGranted(),
      getTodayUsage: () => mockGetTodayUsage(),
    },
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('../dashboardUsageSync.service');

  return {
    syncTodayUsageForDashboard:
      module.syncTodayUsageForDashboard as () => Promise<void>,
    mocks: {
      mockGetPrivacyPolicy,
      mockIngestUsage,
      mockIsPermissionGranted,
      mockGetTodayUsage,
    },
  };
}

describe('Module 6 - dashboardUsageSync.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC_USAGESYNC_015 syncTodayUsageForDashboard skips sync on non-Android platforms', async () => {
    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      os: 'ios',
      usageRows: [{ packageName: 'com.instagram.android', minutesUsed: 20 }],
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockIsPermissionGranted).not.toHaveBeenCalled();
    expect(mocks.mockGetPrivacyPolicy).not.toHaveBeenCalled();
    expect(mocks.mockIngestUsage).not.toHaveBeenCalled();
  });

  it('TC_USAGESYNC_016 syncTodayUsageForDashboard skips sync when native usage tracker is unavailable', async () => {
    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      usageTrackerSupported: false,
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockIsPermissionGranted).not.toHaveBeenCalled();
    expect(mocks.mockGetPrivacyPolicy).not.toHaveBeenCalled();
    expect(mocks.mockIngestUsage).not.toHaveBeenCalled();
  });

  it('TC_USAGESYNC_017 syncTodayUsageForDashboard skips sync when usage access permission is denied', async () => {
    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      permissionGranted: false,
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockIsPermissionGranted).toHaveBeenCalledTimes(1);
    expect(mocks.mockGetTodayUsage).not.toHaveBeenCalled();
    expect(mocks.mockGetPrivacyPolicy).not.toHaveBeenCalled();
    expect(mocks.mockIngestUsage).not.toHaveBeenCalled();
  });

  it('TC_USAGESYNC_018 syncTodayUsageForDashboard skips sync when there is no usage data', async () => {
    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      usageRows: [],
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockIsPermissionGranted).toHaveBeenCalledTimes(1);
    expect(mocks.mockGetTodayUsage).toHaveBeenCalledTimes(1);
    expect(mocks.mockGetPrivacyPolicy).not.toHaveBeenCalled();
    expect(mocks.mockIngestUsage).not.toHaveBeenCalled();
  });

  it('TC_USAGESYNC_019 syncTodayUsageForDashboard skips server sync when privacy policy disallows collection', async () => {
    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      usageRows: [{ packageName: 'com.instagram.android', minutesUsed: 20 }],
      policyResponse: {
        policy: {
          currentPrivacySettings: {
            consentGiven: true,
            dataCollection: false,
          },
        },
      },
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockGetTodayUsage).toHaveBeenCalledTimes(1);
    expect(mocks.mockGetPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(mocks.mockIngestUsage).not.toHaveBeenCalled();
  });

  it('TC_USAGESYNC_020 syncTodayUsageForDashboard ingests usage when Android permission and privacy checks pass', async () => {
    const usageRows = [
      {
        packageName: 'com.instagram.android',
        appName: 'Instagram',
        minutesUsed: 25,
      },
    ];

    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      usageRows,
      policyResponse: {
        policy: {
          currentPrivacySettings: {
            consentGiven: true,
            dataCollection: true,
          },
        },
      },
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockIsPermissionGranted).toHaveBeenCalledTimes(1);
    expect(mocks.mockGetTodayUsage).toHaveBeenCalledTimes(1);
    expect(mocks.mockGetPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(mocks.mockIngestUsage).toHaveBeenCalledWith({
      apps: usageRows,
    });
  });

  it('TC_USAGESYNC_021 syncTodayUsageForDashboard swallows native or API errors to keep dashboard loading stable', async () => {
    const { syncTodayUsageForDashboard, mocks } = loadDashboardUsageSync({
      usageRows: [{ packageName: 'com.instagram.android', minutesUsed: 20 }],
      ingestError: new Error('Network failed'),
    });

    await expect(syncTodayUsageForDashboard()).resolves.toBeUndefined();

    expect(mocks.mockGetPrivacyPolicy).toHaveBeenCalledTimes(1);
    expect(mocks.mockIngestUsage).toHaveBeenCalledTimes(1);
  });
});