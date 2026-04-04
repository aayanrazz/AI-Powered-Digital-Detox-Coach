import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import RewardsScreen from '../RewardsScreen';

const mockGetRewardsSummary = jest.fn();
const mockRedeemReward = jest.fn();

jest.mock('../../components/Screen', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../../components/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    __esModule: true,
    default: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../../components/ProgressBar', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    __esModule: true,
    default: ({ value }: { value: number }) => <Text>{`Progress:${value}`}</Text>,
  };
});

jest.mock('../../api/api', () => ({
  api: {
    getRewardsSummary: () => mockGetRewardsSummary(),
    redeemReward: (code: string) => mockRedeemReward(code),
  },
}));

jest.mock('../../hooks/useRefreshOnFocus', () => ({
  useRefreshOnFocus: (callback: () => void | Promise<void>) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

jest.mock('../../utils/helpers', () => ({
  formatDateTime: (value: string) => `formatted:${value}`,
}));

describe('Module 12 - RewardsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockGetRewardsSummary.mockResolvedValue({
      rewards: {
        points: 620,
        streak: 3,
        levelTitle: 'Balance Builder',
        levelNumber: 3,
        nextLevelTitle: 'Calm Keeper',
        pointsToNextLevel: 180,
        progressPct: 60,
        unlockedBadgesCount: 2,
        totalBadges: 5,
        badgeCompletionPct: 40,
        latestBadge: { key: 'sun', label: 'Sun', emoji: '☀️' },
        nextBadgeHint: { key: 'zen', label: 'Zen', hint: 'Reach a 7-day streak' },
        badges: [
          {
            key: 'lock',
            label: 'Lock',
            emoji: '🌱',
            description: 'Started journey',
            earnedAt: '2026-04-01T00:00:00.000Z',
          },
        ],
        rewards: [{ _id: 'DARK_THEME_PRO', name: 'Dark Theme Pro', cost: 500 }],
        recentActivity: [
          {
            _id: 'r1',
            title: 'Task complete',
            points: 25,
            createdAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        leaderboard: [{ name: 'Aayan', points: 620 }],
      },
    });

    mockRedeemReward.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_ENGAGE_015 loads rewards, badges, and leaderboard summary', async () => {
    const screen = render(<RewardsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Rewards & Gamification')).toBeTruthy();
    });

    expect(screen.getByText('Level 3 • Balance Builder')).toBeTruthy();
    expect(screen.getByText('Points: 620')).toBeTruthy();
    expect(screen.getByText('☀️ Latest badge: Sun')).toBeTruthy();
    expect(screen.getByText('Dark Theme Pro')).toBeTruthy();
    expect(screen.getByText('#1 Aayan')).toBeTruthy();
  });

  it('TC_ENGAGE_016 redeems a reward and shows success feedback', async () => {
    const screen = render(<RewardsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Redeem')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Redeem'));
    });

    expect(mockRedeemReward).toHaveBeenCalledWith('DARK_THEME_PRO');
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Reward redeemed successfully.');
    expect(mockGetRewardsSummary).toHaveBeenCalledTimes(2);
  });
});