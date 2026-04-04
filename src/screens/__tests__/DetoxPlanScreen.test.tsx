import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import DetoxPlanScreen from '../DetoxPlanScreen';

const mockGetActivePlan = jest.fn<() => Promise<any>>();
const mockGenerateDetoxPlan = jest.fn<() => Promise<any>>();
const mockCompletePlanTask = jest.fn<(planId: string, taskId: string) => Promise<any>>();

jest.mock('../../api/api', () => ({
  api: {
    getActivePlan: () => mockGetActivePlan(),
    generateDetoxPlan: () => mockGenerateDetoxPlan(),
    completePlanTask: (planId: string, taskId: string) => mockCompletePlanTask(planId, taskId),
  },
}));

jest.mock('../../hooks/useRefreshOnFocus', () => {
  const React = require('react');
  return {
    useRefreshOnFocus: (callback: () => void | Promise<void>) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock('../../components/Screen', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) => (
      <Pressable onPress={onPress}>
        <Text>{loading ? `${title}...` : title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../../components/ProgressBar', () => ({
  __esModule: true,
  default: ({ value }: { value: number }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>{`Progress:${value}`}</Text>;
  },
}));

const makePlan = (overrides: Record<string, any> = {}) => ({
  _id: 'plan-1',
  startDate: '2026-04-04T00:00:00.000Z',
  endDate: '2026-04-24T00:00:00.000Z',
  durationDays: 21,
  targetDailyLimitMinutes: 150,
  aiInsight: 'ML-assisted reduction plan',
  planSummary: 'A 21-day personalized detox plan.',
  active: true,
  totalDays: 2,
  completedDays: 0,
  pendingDays: 1,
  totalTasks: 4,
  completedTasks: 1,
  overallProgressPct: 25,
  currentDayNumber: 1,
  status: 'active' as const,
  days: [
    {
      dayNumber: 1,
      date: '2026-04-04T00:00:00.000Z',
      targetLimitMinutes: 180,
      status: 'in_progress' as const,
      totalTasks: 2,
      completedTasks: 1,
      progressPct: 50,
      tasks: [
        {
          _id: 'task-1',
          title: 'Mindful Start after 7:00 AM',
          type: 'wellness',
          status: 'completed' as const,
          targetTime: '7:00 AM',
          pointsReward: 20,
        },
        {
          _id: 'task-2',
          title: 'Stay under 180 minutes',
          type: 'limit',
          status: 'pending' as const,
          targetTime: '06:00 PM',
          pointsReward: 25,
        },
      ],
    },
    {
      dayNumber: 2,
      date: '2026-04-05T00:00:00.000Z',
      targetLimitMinutes: 170,
      status: 'pending' as const,
      totalTasks: 2,
      completedTasks: 0,
      progressPct: 0,
      tasks: [],
    },
  ],
  ...overrides,
});

describe('Module 11 - DetoxPlanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActivePlan.mockResolvedValue({ plan: makePlan() });
    mockGenerateDetoxPlan.mockResolvedValue({ plan: makePlan({ targetDailyLimitMinutes: 140 }) });
    mockCompletePlanTask.mockResolvedValue({
      plan: makePlan({
        completedDays: 1,
        completedTasks: 2,
        overallProgressPct: 50,
        days: [
          {
            dayNumber: 1,
            date: '2026-04-04T00:00:00.000Z',
            targetLimitMinutes: 180,
            status: 'completed',
            totalTasks: 2,
            completedTasks: 2,
            progressPct: 100,
            tasks: [
              {
                _id: 'task-1',
                title: 'Mindful Start after 7:00 AM',
                type: 'wellness',
                status: 'completed',
                targetTime: '7:00 AM',
                pointsReward: 20,
              },
              {
                _id: 'task-2',
                title: 'Stay under 180 minutes',
                type: 'limit',
                status: 'completed',
                targetTime: '06:00 PM',
                pointsReward: 25,
              },
            ],
          },
          {
            dayNumber: 2,
            date: '2026-04-05T00:00:00.000Z',
            targetLimitMinutes: 170,
            status: 'in_progress',
            totalTasks: 2,
            completedTasks: 0,
            progressPct: 0,
            tasks: [],
          },
        ],
      }),
      completion: {
        taskTitle: 'Stay under 180 minutes',
        taskType: 'limit',
        basePointsEarned: 25,
        dayBonusPoints: 40,
        planBonusPoints: 0,
        totalPointsEarned: 65,
        dayCompleted: true,
        planCompleted: false,
        completedDayNumber: 1,
      },
      newBadges: ['Sun'],
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_PLAN_009 loads and renders the active plan overview with current day tasks', async () => {
    const screen = render(<DetoxPlanScreen />);

    await waitFor(() => {
      expect(mockGetActivePlan).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Plan Overview')).toBeTruthy();
    expect(screen.getByText('Final target limit: 150 min/day')).toBeTruthy();
    expect(screen.getByText('AI insight: ML-assisted reduction plan')).toBeTruthy();
    expect(screen.getByText('Current Day Focus')).toBeTruthy();
    expect(screen.getByText('Day 1 • Target 180 min')).toBeTruthy();
    expect(screen.getByText('✅ Mindful Start after 7:00 AM')).toBeTruthy();
    expect(screen.getByText('⬜ Stay under 180 minutes')).toBeTruthy();
    expect(screen.getByText('Plan Timeline')).toBeTruthy();
    expect(screen.getByText('Day 2')).toBeTruthy();
  });

  it('TC_PLAN_010 generates a new detox plan and shows success alert', async () => {
    mockGetActivePlan.mockResolvedValueOnce({ plan: null });

    const screen = render(<DetoxPlanScreen />);

    await waitFor(() => {
      expect(screen.getByText('No active plan yet')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Generate Detox Plan'));
    });

    expect(mockGenerateDetoxPlan).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Your personalized detox plan has been generated.'
    );
    await waitFor(() => {
      expect(screen.getByText('Plan Overview')).toBeTruthy();
    });
  });

  it('TC_PLAN_011 completes a task and shows reward summary with day bonus and badges', async () => {
    const screen = render(<DetoxPlanScreen />);

    await waitFor(() => {
      expect(screen.getByText('⬜ Stay under 180 minutes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('⬜ Stay under 180 minutes'));
    });

    expect(mockCompletePlanTask).toHaveBeenCalledWith('plan-1', 'task-2');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Progress updated',
      expect.stringContaining('Task completed: Stay under 180 minutes')
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Progress updated',
      expect.stringContaining('Day completion bonus: +40')
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Progress updated',
      expect.stringContaining('New badges: Sun')
    );
    expect(mockGetActivePlan).toHaveBeenCalledTimes(2);
  });

  it('TC_PLAN_012 shows an alert when task completion fails', async () => {
    mockCompletePlanTask.mockRejectedValueOnce(new Error('Could not update task'));

    const screen = render(<DetoxPlanScreen />);

    await waitFor(() => {
      expect(screen.getByText('⬜ Stay under 180 minutes')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('⬜ Stay under 180 minutes'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Task update failed',
      'Could not update task'
    );
  });
});