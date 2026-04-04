import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert, AppState } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

type AppUsageItem = {
  packageName: string;
  appName: string;
  foregroundMs: number;
  minutesUsed: number;
  pickups: number;
  unlocks: number;
  category: string;
};

type AppLimitItem = {
  _id?: string;
  appName: string;
  appPackage: string;
  category: string;
  dailyLimitMinutes: number;
  createdAt?: string;
  updatedAt?: string;
};

type RefreshResponse = {
  apps: AppUsageItem[];
  appLimits: AppLimitItem[];
  summary: {
    totalMinutes: number;
    totalPickups: number;
    totalUnlocks: number;
    appCount: number;
  };
  triggeredWarnings: Array<{
    level: string;
    appName: string;
    appPackage: string;
    message: string;
  }>;
};

type AlertButtonShape = {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
};

const mockSaveAppLimit = jest.fn<(payload: AppLimitItem) => Promise<unknown>>();
const mockDeleteAppLimit = jest.fn<(appPackage: string) => Promise<unknown>>();
const mockRefreshUsageAndRunImmediateInterventionCheck =
  jest.fn<() => Promise<RefreshResponse>>();
const mockUsagePermissionGranted = jest.fn<() => Promise<boolean>>();
const mockOpenPermissionSettings = jest.fn<() => Promise<void>>();

jest.mock('../../components/Screen', () => {
  const ReactLocal = require('react');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement(ReactLocal.Fragment, null, children),
  };
});

jest.mock('../../api/api', () => ({
  api: {
    saveAppLimit: (payload: AppLimitItem) => mockSaveAppLimit(payload),
    deleteAppLimit: (appPackage: string) => mockDeleteAppLimit(appPackage),
  },
}));

jest.mock('../../services/usageIntervention.service', () => ({
  refreshUsageAndRunImmediateInterventionCheck: () =>
    mockRefreshUsageAndRunImmediateInterventionCheck(),
}));

jest.mock('../../native/usageTracker', () => ({
  usageTracker: {
    isPermissionGranted: () => mockUsagePermissionGranted(),
    openPermissionSettings: () => mockOpenPermissionSettings(),
  },
}));

describe('Module 8 - UsageMonitoringScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as any);

    mockUsagePermissionGranted.mockResolvedValue(true);

    mockRefreshUsageAndRunImmediateInterventionCheck.mockResolvedValue({
      apps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          foregroundMs: 3_000_000,
          minutesUsed: 50,
          pickups: 5,
          unlocks: 4,
          category: 'Social Media',
        },
      ],
      appLimits: [],
      summary: {
        totalMinutes: 50,
        totalPickups: 5,
        totalUnlocks: 4,
        appCount: 1,
      },
      triggeredWarnings: [],
    });

    mockSaveAppLimit.mockResolvedValue({ success: true });
    mockDeleteAppLimit.mockResolvedValue({ success: true });

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_LIMITS_016 saves custom app limit and shows success alert', async () => {
    const UsageMonitoringScreen = require('../UsageMonitoringScreen').default;

    const screen = render(<UsageMonitoringScreen />);

    await screen.findByText('Usage Monitoring');
    await screen.findByText('Set Limit');

    fireEvent.press(screen.getByText('Set Limit'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Enter limit in minutes'),
      '90',
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Save Limit'));
    });

    await waitFor(() => {
      expect(mockSaveAppLimit).toHaveBeenCalledWith({
        appName: 'Instagram',
        appPackage: 'com.instagram.android',
        category: 'Social Media',
        dailyLimitMinutes: 90,
      });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Limit saved',
      'Instagram now has a 90-minute daily limit.',
    );
  });

  it('TC_LIMITS_017 normalizes empty custom limit input to minimum 1 minute and saves successfully', async () => {
    const UsageMonitoringScreen = require('../UsageMonitoringScreen').default;

    const screen = render(<UsageMonitoringScreen />);

    await screen.findByText('Usage Monitoring');
    await screen.findByText('Set Limit');

    fireEvent.press(screen.getByText('Set Limit'));

    await act(async () => {
      fireEvent.press(screen.getByText('Save Limit'));
    });

    await waitFor(() => {
      expect(mockSaveAppLimit).toHaveBeenCalledWith({
        appName: 'Instagram',
        appPackage: 'com.instagram.android',
        category: 'Social Media',
        dailyLimitMinutes: 1,
      });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Limit saved',
      'Instagram now has a 1-minute daily limit.',
    );
  });

  it('TC_LIMITS_018 removes existing app limit after confirmation and shows success alert', async () => {
    mockRefreshUsageAndRunImmediateInterventionCheck.mockResolvedValueOnce({
      apps: [
        {
          packageName: 'com.instagram.android',
          appName: 'Instagram',
          foregroundMs: 3_000_000,
          minutesUsed: 70,
          pickups: 6,
          unlocks: 5,
          category: 'Social Media',
        },
      ],
      appLimits: [
        {
          _id: 'limit-1',
          appName: 'Instagram',
          appPackage: 'com.instagram.android',
          category: 'Social Media',
          dailyLimitMinutes: 60,
        },
      ],
      summary: {
        totalMinutes: 70,
        totalPickups: 6,
        totalUnlocks: 5,
        appCount: 1,
      },
      triggeredWarnings: [],
    });

    const UsageMonitoringScreen = require('../UsageMonitoringScreen').default;

    const screen = render(<UsageMonitoringScreen />);

    await screen.findByText('Usage Monitoring');
    await screen.findByText('Edit Limit');

    fireEvent.press(screen.getByText('Remove'));

    const alertMock = Alert.alert as jest.MockedFunction<typeof Alert.alert>;
    const removeCall = alertMock.mock.calls.find(
      call => call[0] === 'Remove app limit',
    );

    expect(removeCall).toBeTruthy();

    const buttons = (removeCall?.[2] ?? []) as AlertButtonShape[];
    const destructiveButton = buttons.find(item => item.text === 'Remove');

    expect(destructiveButton).toBeTruthy();
    expect(typeof destructiveButton?.onPress).toBe('function');

    await act(async () => {
      await destructiveButton?.onPress?.();
    });

    await waitFor(() => {
      expect(mockDeleteAppLimit).toHaveBeenCalledWith(
        'com.instagram.android',
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Limit removed',
      'Instagram no longer has a custom daily limit.',
    );
  });
});