import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import NotificationsScreen from '../NotificationsScreen';

const mockGetNotifications = jest.fn();
const mockMarkNotificationRead = jest.fn();
const mockMarkAllNotificationsRead = jest.fn();
const mockRunNotificationAction = jest.fn();
const mockDismissOne = jest.fn();
const mockDismissMany = jest.fn();

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

jest.mock('../../api/api', () => ({
  api: {
    getNotifications: () => mockGetNotifications(),
    markNotificationRead: (id: string) => mockMarkNotificationRead(id),
    markAllNotificationsRead: () => mockMarkAllNotificationsRead(),
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

jest.mock('../../utils/notificationActions', () => ({
  runNotificationAction: (navigation: any, item: any) =>
    mockRunNotificationAction(navigation, item),
}));

jest.mock('../../services/notificationSyncService', () => ({
  dismissDeliveredBackendNotification: (id: string) => mockDismissOne(id),
  dismissDeliveredBackendNotifications: (ids: string[]) => mockDismissMany(ids),
}));

describe('Module 12 - NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetNotifications.mockResolvedValue({
      unreadCount: 2,
      notifications: [
        {
          _id: 'notif-1',
          title: 'Usage warning',
          message: 'You are near your daily limit',
          type: 'limit_warning',
          read: false,
          createdAt: '2026-04-04T10:00:00.000Z',
          ctaLabel: 'OPEN',
          ctaAction: 'open_home',
        },
        {
          _id: 'notif-2',
          title: 'Reward redeemed',
          message: 'Check rewards',
          type: 'achievement',
          read: true,
          createdAt: '2026-04-03T10:00:00.000Z',
        },
      ],
    });
    mockMarkNotificationRead.mockResolvedValue({ success: true });
    mockMarkAllNotificationsRead.mockResolvedValue({ success: true });
    mockRunNotificationAction.mockResolvedValue(undefined);
    mockDismissOne.mockResolvedValue(undefined);
    mockDismissMany.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_ENGAGE_013 loads notifications and can mark all unread items as read', async () => {
    const screen = render(
      <NotificationsScreen navigation={{ navigate: jest.fn() }} />
    );

    await waitFor(() => {
      expect(screen.getByText('Unread Alerts')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Mark All As Read'));
    });

    expect(mockMarkAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(mockDismissMany).toHaveBeenCalledWith(['notif-1']);
    expect(mockGetNotifications).toHaveBeenCalledTimes(2);
  });

  it('TC_ENGAGE_014 marks one notification read and executes CTA action flow', async () => {
    const navigation = { navigate: jest.fn() };
    const screen = render(<NotificationsScreen navigation={navigation} />);

    await waitFor(() => {
      expect(screen.getByText('Usage warning')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('OPEN'));
    });

    expect(mockMarkNotificationRead).toHaveBeenCalledWith('notif-1');
    expect(mockDismissOne).toHaveBeenCalledWith('notif-1');
    expect(mockRunNotificationAction).toHaveBeenCalledWith(
      navigation,
      expect.objectContaining({
        _id: 'notif-1',
        ctaAction: 'open_home',
      })
    );
  });
});