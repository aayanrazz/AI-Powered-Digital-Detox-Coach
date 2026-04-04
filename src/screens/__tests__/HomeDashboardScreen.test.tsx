import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockGetDashboard = jest.fn();
const mockSyncTodayUsageForDashboard = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../components/Screen', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({
      children,
      refreshControl,
    }: {
      children: React.ReactNode;
      refreshControl?: React.ReactNode;
    }) =>
      ReactLocal.createElement(
        View,
        { testID: 'screen-root' },
        refreshControl,
        children
      ),
  };
});

jest.mock('../../components/MetricCard', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: ({
      label,
      value,
    }: {
      label: string;
      value: string | number;
    }) => ReactLocal.createElement(Text, null, `${label}: ${value}`),
  };
});

jest.mock('../../components/ProgressBar', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: ({ value }: { value: number }) =>
      ReactLocal.createElement(Text, null, `Progress: ${value}`),
  };
});

jest.mock('../../api/api', () => ({
  api: {
    getDashboard: () => mockGetDashboard(),
  },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      name: 'Aayan',
      streakCount: 4,
      points: 220,
    },
  }),
}));

jest.mock('../../hooks/useRefreshOnFocus', () => {
  const ReactLocal = require('react');

  return {
    useRefreshOnFocus: (callback: () => Promise<void> | void) => {
      ReactLocal.useEffect(() => {
        Promise.resolve(callback()).catch(() => {});
      }, [callback]);
    },
  };
});

jest.mock('../../services/dashboardUsageSync.service', () => ({
  syncTodayUsageForDashboard: () => mockSyncTodayUsageForDashboard(),
}));

describe('Module 9 - HomeDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockSyncTodayUsageForDashboard.mockResolvedValue(undefined);

    mockGetDashboard.mockResolvedValue({
      dashboard: {
        welcomeName: 'Aayan',
        focusScore: 82,
        todayUsageMinutes: 145,
        streak: 6,
        points: 340,
        riskLevel: 'low',
        unreadNotifications: 3,
        dailyGoal: 180,
        dailyChallenge: 'Avoid social scrolling until midday',
        aiRecommendations: [
          'Take a 10-minute offline break.',
          'Keep notifications muted.',
        ],
        overLimitAppsCount: 2,
        topExceededAppName: 'Instagram',
        topExceededMinutes: 25,
        interventionMessage: 'Instagram is over limit today.',
        currentLevelNumber: 4,
        currentLevelTitle: 'Focused Builder',
        progressPct: 72,
        pointsToNextLevel: 80,
        badgesCount: 3,
        latestBadgeLabel: 'Focus Guard',
        latestBadgeEmoji: '🛡️',
        nextBadgeHintText:
          'Complete one more challenge to unlock Deep Work.',
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('TC_DASH_012 loads dashboard after syncing usage and renders mapped insight fields', async () => {
    const HomeDashboardScreen = require('../HomeDashboardScreen').default;

    const screen = render(
      <HomeDashboardScreen navigation={{ navigate: mockNavigate }} />
    );

    await waitFor(() => {
      expect(mockSyncTodayUsageForDashboard).toHaveBeenCalledTimes(1);
      expect(mockGetDashboard).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Hello, Aayan 👋')).toBeTruthy();
    expect(screen.getByText('Focus Score: 82')).toBeTruthy();
    expect(screen.getByText('Today Usage: 145 min')).toBeTruthy();
    expect(screen.getByText('Streak: 6 days')).toBeTruthy();
    expect(screen.getByText('Points: 340')).toBeTruthy();
    expect(screen.getByText('Level 4 • Focused Builder')).toBeTruthy();
    expect(screen.getByText('Progress: 72')).toBeTruthy();
    expect(screen.getByText('80 points to next level')).toBeTruthy();
    expect(screen.getByText('Unlocked badges: 3')).toBeTruthy();
    expect(screen.getByText('🛡️ Latest badge: Focus Guard')).toBeTruthy();
    expect(
      screen.getByText('Complete one more challenge to unlock Deep Work.')
    ).toBeTruthy();
    expect(screen.getByText('Limit target: 180 minutes')).toBeTruthy();
    expect(screen.getByText('Risk level: low')).toBeTruthy();
    expect(screen.getByText('Unread alerts: 3')).toBeTruthy();
    expect(
      screen.getByText('Avoid social scrolling until midday')
    ).toBeTruthy();
    expect(
      screen.getByText('• Take a 10-minute offline break.')
    ).toBeTruthy();
    expect(screen.getByText('• Keep notifications muted.')).toBeTruthy();
  });

  test('TC_DASH_013 shows intervention panel and routes usage/settings actions when apps exceed limits', async () => {
    const HomeDashboardScreen = require('../HomeDashboardScreen').default;

    const screen = render(
      <HomeDashboardScreen navigation={{ navigate: mockNavigate }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Android Focus Shield')).toBeTruthy();
    });

    expect(screen.getByText('Instagram is over limit today.')).toBeTruthy();
    expect(
      screen.getByText('Top exceeded app: Instagram • +25 min')
    ).toBeTruthy();
    expect(screen.getByText('Over-limit apps: 2')).toBeTruthy();

    fireEvent.press(screen.getByText('Review Usage Limits'));
    fireEvent.press(screen.getByText('Open Settings'));

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'UsageTab',
    });
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  test('TC_DASH_014 hides intervention panel when no apps are over limit and falls back to auth user when welcome name missing', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      dashboard: {
        welcomeName: '',
        focusScore: 70,
        todayUsageMinutes: 90,
        streak: 4,
        points: 220,
        riskLevel: 'medium',
        unreadNotifications: 1,
        dailyGoal: 150,
        dailyChallenge: 'Stay focused for your next study block',
        aiRecommendations: [],
        overLimitAppsCount: 0,
        currentLevelNumber: 2,
        currentLevelTitle: 'Mindful Seed',
        progressPct: 40,
        pointsToNextLevel: 60,
        badgesCount: 1,
        latestBadgeLabel: '',
        latestBadgeEmoji: '',
        nextBadgeHintText: 'Keep progressing to unlock more badges.',
      },
    });

    const HomeDashboardScreen = require('../HomeDashboardScreen').default;

    const screen = render(
      <HomeDashboardScreen navigation={{ navigate: mockNavigate }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Hello, Aayan 👋')).toBeTruthy();
    });

    expect(screen.queryByText('Android Focus Shield')).toBeNull();
    expect(
      screen.getByText(
        'No recommendations yet. Sync usage data to generate AI insights.'
      )
    ).toBeTruthy();
  });

  test('TC_DASH_015 shows dashboard alert when load fails', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('Server down'));

    const HomeDashboardScreen = require('../HomeDashboardScreen').default;

    render(<HomeDashboardScreen navigation={{ navigate: mockNavigate }} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Dashboard error',
        'Server down'
      );
    });
  });

  test('TC_DASH_016 refresh control triggers reload flow', async () => {
    const HomeDashboardScreen = require('../HomeDashboardScreen').default;

    const screen = render(
      <HomeDashboardScreen navigation={{ navigate: mockNavigate }} />
    );

    await waitFor(() => {
      expect(mockSyncTodayUsageForDashboard).toHaveBeenCalledTimes(1);
      expect(mockGetDashboard).toHaveBeenCalledTimes(1);
    });

    const refreshControl = screen.UNSAFE_getByType(RefreshControl);

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(mockSyncTodayUsageForDashboard).toHaveBeenCalledTimes(2);
      expect(mockGetDashboard).toHaveBeenCalledTimes(2);
    });
  });
});