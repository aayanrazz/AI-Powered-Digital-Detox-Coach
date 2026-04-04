import React from 'react';
import { Alert, RefreshControl, Share } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockGetAnalyticsSummary = jest.fn();
const mockExportAnalyticsReport = jest.fn();
const mockExportAnonymizedDataset = jest.fn();

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
        { testID: 'analytics-screen-root' },
        refreshControl,
        children
      ),
  };
});

jest.mock('../../components/MetricCard', () => {
  const ReactLocal = require('react');
  const { Text, View } = require('react-native');

  return {
    __esModule: true,
    default: ({
      label,
      value,
    }: {
      label: string;
      value: string | number;
    }) =>
      ReactLocal.createElement(
        View,
        null,
        ReactLocal.createElement(Text, null, label),
        ReactLocal.createElement(Text, null, String(value))
      ),
  };
});

jest.mock('../../components/PrimaryButton', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    __esModule: true,
    default: ({
      title,
      onPress,
    }: {
      title: string;
      onPress: () => void | Promise<void>;
    }) =>
      ReactLocal.createElement(
        Pressable,
        { onPress, accessibilityRole: 'button' },
        ReactLocal.createElement(Text, null, title)
      ),
  };
});

jest.mock('../../api/api', () => ({
  api: {
    getAnalyticsSummary: (range: string) => mockGetAnalyticsSummary(range),
    exportAnalyticsReport: (range: string) => mockExportAnalyticsReport(range),
    exportAnonymizedDataset: (range: string, format: string) =>
      mockExportAnonymizedDataset(range, format),
  },
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

describe('Module 10 - AnalyticsDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as any);

    mockGetAnalyticsSummary.mockResolvedValue({
      analytics: {
        focusScore: 81,
        totalUsageMinutes: 185,
        averageDailyMinutes: 62,
        pickupCount: 14,
        lateNightMinutes: 25,
        peakHourLabel: '22:00',
        comparison: {
          direction: 'improving',
          summary:
            'Average daily screen time is down 18% compared with the previous period.',
          usageChangePct: -18,
          pickupChangePct: -12,
          unlockChangePct: -10,
        },
        weeklyTrend: 'Improving',
        trendLabel: 'Daily Usage',
        trendPoints: [
          { label: 'Tue, Apr 1', shortLabel: '4/1', minutes: 40 },
          { label: 'Wed, Apr 2', shortLabel: '4/2', minutes: 55 },
        ],
        riskLevel: 'low',
        totalActiveDays: 2,
        bestDayLabel: 'Wed, Apr 2',
        worstDayLabel: 'Tue, Apr 1',
        categoryBreakdown: [
          { category: 'Social Media', minutes: 95, sharePct: 51 },
          { category: 'Productivity', minutes: 60, sharePct: 32 },
        ],
        recommendations: [
          'Take a 10-minute offline break.',
          'Keep notifications muted.',
        ],
      },
    });

    mockExportAnalyticsReport.mockResolvedValue({
      generatedAt: '2026-04-04T10:30:00.000Z',
      report: {
        range: 'week',
        analytics: {
          focusScore: 81,
          totalUsageMinutes: 185,
          averageDailyMinutes: 62,
          pickupCount: 14,
          unlockCount: 12,
          lateNightMinutes: 25,
          peakHourLabel: '22:00',
          riskLevel: 'low',
          comparison: {
            summary:
              'Average daily screen time is down 18% compared with the previous period.',
          },
          weeklyTrend: 'Improving',
          categoryBreakdown: [
            { category: 'Social Media', minutes: 95, sharePct: 51 },
          ],
        },
        insights: ['Take a 10-minute offline break.'],
      },
    });

    mockExportAnonymizedDataset.mockResolvedValue({
      generatedAt: '2026-04-04T10:45:00.000Z',
      dataset: {
        range: 'week',
        format: 'json',
        summary: {
          sessionCount: 3,
          episodeCount: 2,
          dailyLimitMinutes: 180,
          includesAppNames: false,
          includesPersonalIdentity: false,
          exportNotes: ['App names are replaced with anonymized tokens.'],
        },
        sessionRows: [{ recordId: 'REC_1', dayToken: 'D1' }],
        episodeLabels: [{ episodeId: 'EP_1', dayToken: 'D1' }],
        sessionRowsCsv: 'recordId,dayToken\n"REC_1","D1"',
        episodeLabelsCsv: 'episodeId,dayToken\n"EP_1","D1"',
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('TC_ANALYTICS_013 loads analytics summary after focus refresh and renders dashboard sections', async () => {
    const AnalyticsDashboardScreen =
      require('../AnalyticsDashboardScreen').default;

    const screen = render(<AnalyticsDashboardScreen />);

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalledWith('week');
    });

    expect(screen.getByText('Analytics Dashboard')).toBeTruthy();
    expect(
      screen.getByText('Daily, weekly, and monthly digital wellness trends')
    ).toBeTruthy();
    expect(screen.getByText('Focus Score')).toBeTruthy();
    expect(screen.getByText('81')).toBeTruthy();
    expect(screen.getByText('Total Usage')).toBeTruthy();
    expect(screen.getByText('3h 5m')).toBeTruthy();
    expect(screen.getByText('Average / Day')).toBeTruthy();
    expect(screen.getByText('1h 2m')).toBeTruthy();
    expect(screen.getByText('Trend Overview')).toBeTruthy();
    expect(screen.getByText('Improving')).toBeTruthy();
    expect(screen.getByText('Usage change: -18%')).toBeTruthy();
    expect(screen.getByText('Pickup change: -12%')).toBeTruthy();
    expect(screen.getByText('Unlock change: -10%')).toBeTruthy();
    expect(screen.getByText('Social Media')).toBeTruthy();
    expect(screen.getByText('51% of usage')).toBeTruthy();
    expect(
      screen.getByText('• Take a 10-minute offline break.')
    ).toBeTruthy();
    expect(screen.getByText('• Keep notifications muted.')).toBeTruthy();
  });

  test('TC_ANALYTICS_014 changes range and refreshes analytics when month chip is pressed', async () => {
    const AnalyticsDashboardScreen =
      require('../AnalyticsDashboardScreen').default;

    const screen = render(<AnalyticsDashboardScreen />);

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalledWith('week');
    });

    fireEvent.press(screen.getByText('MONTH'));

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalledWith('month');
    });
  });

  test('TC_ANALYTICS_015 exports analytics report and shares formatted report text', async () => {
    const AnalyticsDashboardScreen =
      require('../AnalyticsDashboardScreen').default;

    const screen = render(<AnalyticsDashboardScreen />);

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalled();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Export Report'));
    });

    expect(mockExportAnalyticsReport).toHaveBeenCalledWith('week');
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Weekly Analytics Report',
        message: expect.stringContaining('AI-Powered Digital Detox Coach'),
      })
    );
    expect(screen.getByText('Latest Report Preview')).toBeTruthy();
    expect(screen.getByText('Share Latest Report Again')).toBeTruthy();
  });

  test('TC_ANALYTICS_016 exports JSON and CSV anonymized datasets and shares correct payloads', async () => {
    mockExportAnonymizedDataset
      .mockResolvedValueOnce({
        generatedAt: '2026-04-04T10:45:00.000Z',
        dataset: {
          range: 'week',
          format: 'json',
          summary: {
            sessionCount: 3,
            episodeCount: 2,
            dailyLimitMinutes: 180,
            includesAppNames: false,
            includesPersonalIdentity: false,
            exportNotes: ['App names are replaced with anonymized tokens.'],
          },
          sessionRows: [{ recordId: 'REC_1', dayToken: 'D1' }],
          episodeLabels: [{ episodeId: 'EP_1', dayToken: 'D1' }],
          sessionRowsCsv: 'recordId,dayToken\n"REC_1","D1"',
          episodeLabelsCsv: 'episodeId,dayToken\n"EP_1","D1"',
        },
      })
      .mockResolvedValueOnce({
        generatedAt: '2026-04-04T10:50:00.000Z',
        dataset: {
          range: 'week',
          format: 'csv',
          summary: {
            sessionCount: 4,
            episodeCount: 2,
            dailyLimitMinutes: 180,
            includesAppNames: false,
            includesPersonalIdentity: false,
            exportNotes: ['App names are replaced with anonymized tokens.'],
          },
          sessionRows: [{ recordId: 'REC_2', dayToken: 'D2' }],
          episodeLabels: [{ episodeId: 'EP_2', dayToken: 'D2' }],
          sessionRowsCsv: 'recordId,dayToken\n"REC_2","D2"',
          episodeLabelsCsv: 'episodeId,dayToken\n"EP_2","D2"',
        },
      });

    const AnalyticsDashboardScreen =
      require('../AnalyticsDashboardScreen').default;

    const screen = render(<AnalyticsDashboardScreen />);

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalled();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Export JSON Dataset'));
    });

    expect(mockExportAnonymizedDataset).toHaveBeenNthCalledWith(
      1,
      'week',
      'json'
    );
    expect(Share.share).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: 'Weekly Anonymized Dataset',
        message: expect.stringContaining('"format": "json"'),
      })
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Export CSV Dataset'));
    });

    expect(mockExportAnonymizedDataset).toHaveBeenNthCalledWith(
      2,
      'week',
      'csv'
    );
    expect(Share.share).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: 'Weekly Anonymized Dataset',
        message: expect.stringContaining('ANONYMIZED_USAGE_SESSIONS'),
      })
    );
    expect(screen.getByText('Latest Dataset Preview')).toBeTruthy();
  });

  test('TC_ANALYTICS_017 shares latest report and latest dataset preview again after export', async () => {
    const AnalyticsDashboardScreen =
      require('../AnalyticsDashboardScreen').default;

    const screen = render(<AnalyticsDashboardScreen />);

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalled();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Export Report'));
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Export JSON Dataset'));
    });

    (Share.share as jest.Mock).mockClear();

    await act(async () => {
      fireEvent.press(screen.getByText('Share Latest Report Again'));
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Share Latest Dataset Again'));
    });

    expect(Share.share).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: 'Weekly Analytics Report' })
    );
    expect(Share.share).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'Weekly Anonymized Dataset' })
    );
  });

  test('TC_ANALYTICS_018 shows alert when analytics load or export fails and refresh control reloads data', async () => {
    mockGetAnalyticsSummary
      .mockRejectedValueOnce(new Error('Summary failed'))
      .mockResolvedValueOnce({
        analytics: {
          focusScore: 66,
          totalUsageMinutes: 90,
          averageDailyMinutes: 30,
          pickupCount: 10,
          lateNightMinutes: 5,
          peakHourLabel: '20:00',
          comparison: {
            direction: 'steady',
            summary: 'Your usage is stable compared with the previous period.',
            usageChangePct: 0,
            pickupChangePct: 0,
            unlockChangePct: 0,
          },
          weeklyTrend: 'Stable',
          trendLabel: 'Daily Usage',
          trendPoints: [{ label: 'Fri, Apr 4', shortLabel: '4/4', minutes: 90 }],
          riskLevel: 'medium',
          totalActiveDays: 1,
          bestDayLabel: 'Fri, Apr 4',
          worstDayLabel: 'Fri, Apr 4',
          categoryBreakdown: [],
          recommendations: [],
        },
      });
    mockExportAnalyticsReport.mockRejectedValueOnce(new Error('Report failed'));

    const AnalyticsDashboardScreen =
      require('../AnalyticsDashboardScreen').default;

    const screen = render(<AnalyticsDashboardScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Analytics error',
        'Summary failed'
      );
    });

    const refreshControl = screen.UNSAFE_getByType(RefreshControl);

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(mockGetAnalyticsSummary).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Export Report'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Export failed',
        'Report failed'
      );
    });
  });
});