import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

type CompleteProfilePayload = {
  name: string;
  age: number;
  occupation: string;
  goal: string;
  dailyLimitMinutes: number;
  focusAreas?: string[];
  bedTime?: string;
  wakeTime?: string;
  notificationSettings?: {
    gentleNudges?: boolean;
    dailySummaries?: boolean;
    achievementAlerts?: boolean;
    limitWarnings?: boolean;
  };
};

const mockGetSettings = jest.fn<() => Promise<any>>();
const mockCompleteProfileSetup =
  jest.fn<(payload: CompleteProfilePayload) => Promise<any>>();
const mockRefreshUser = jest.fn<() => Promise<void>>();
const mockSyncDetoxNotifications = jest.fn<() => Promise<void>>();
const mockRunLocalInterventionCheck = jest.fn<() => Promise<void>>();

let mockAuthState: {
  refreshUser: typeof mockRefreshUser;
  user: any;
};

jest.mock('../../api/api', () => ({
  api: {
    getSettings: mockGetSettings,
    completeProfileSetup: mockCompleteProfileSetup,
  },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../../services/notificationSyncService', () => ({
  syncDetoxNotifications: mockSyncDetoxNotifications,
}));

jest.mock('../../services/interventionService', () => ({
  runLocalInterventionCheck: mockRunLocalInterventionCheck,
}));

jest.mock('../../components/Screen', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    __esModule: true,
    default: ({
      title,
      onPress,
    }: {
      title: string;
      onPress: () => void;
      loading?: boolean;
      variant?: 'primary' | 'secondary';
    }) =>
      React.createElement(
        Pressable,
        { onPress },
        React.createElement(Text, null, title)
      ),
  };
});

function renderScreen() {
  const ProfileSetupScreen = require('../ProfileSetupScreen').default;
  return render(<ProfileSetupScreen />);
}

describe('ProfileSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthState = {
      refreshUser: mockRefreshUser,
      user: {
        name: 'Seed User',
        age: 22,
        occupation: 'Student',
        goal: 'Reduce social media distraction',
      },
    };

    mockGetSettings.mockResolvedValue({
      settings: {
        dailyLimitMinutes: 180,
        focusAreas: ['Social Media', 'Productivity'],
        bedTime: '23:00',
        wakeTime: '07:00',
        aiInterventionsEnabled: true,
        notificationsEnabled: true,
        achievementAlerts: true,
        limitWarnings: true,
      },
    });

    mockCompleteProfileSetup.mockResolvedValue({
      success: true,
      message: 'Profile setup completed.',
    });

    mockRefreshUser.mockResolvedValue(undefined);
    mockSyncDetoxNotifications.mockResolvedValue(undefined);
    mockRunLocalInterventionCheck.mockResolvedValue(undefined);

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_PROFILE_001 loads profile defaults from settings API', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        dailyLimitMinutes: 120,
        focusAreas: ['Study', 'Custom Focus'],
        bedTime: '22:30',
        wakeTime: '06:45',
        aiInterventionsEnabled: false,
        notificationsEnabled: false,
        achievementAlerts: false,
        limitWarnings: false,
      },
    });

    const { getByDisplayValue, getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    expect(getByDisplayValue('120')).toBeTruthy();
    expect(getByDisplayValue('Custom Focus')).toBeTruthy();
    expect(getByDisplayValue('22:30')).toBeTruthy();
    expect(getByDisplayValue('06:45')).toBeTruthy();
    expect(getByText('Selected: Study, Custom Focus')).toBeTruthy();
  });

  it('TC_PROFILE_002 keeps built-in defaults when settings API fails', async () => {
    mockGetSettings.mockRejectedValue(new Error('Settings load failed.'));

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    expect(getByText('Daily goal: 180 min')).toBeTruthy();
    expect(getByText('Focus areas: Social Media, Productivity')).toBeTruthy();
    expect(getByText('Sleep schedule: 23:00 → 07:00')).toBeTruthy();
  });

  it('TC_PROFILE_003 blocks empty display name', async () => {
    mockAuthState.user = {
      ...mockAuthState.user,
      name: '',
    };

    const { getByPlaceholderText, getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(getByPlaceholderText('Display name'), '   ');
    fireEvent.press(getByText('Save Profile'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Validation',
      'Please enter your display name.'
    );
    expect(mockCompleteProfileSetup).not.toHaveBeenCalled();
  });

  it('TC_PROFILE_004 blocks empty detox goal', async () => {
    const { getByPlaceholderText, getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(getByPlaceholderText('Main detox goal'), '   ');
    fireEvent.press(getByText('Save Profile'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Validation',
      'Please enter your main detox goal.'
    );
    expect(mockCompleteProfileSetup).not.toHaveBeenCalled();
  });

  it('TC_PROFILE_005 blocks save when no focus area is selected', async () => {
    const { getAllByText, getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getAllByText('Social Media')[0]);
    fireEvent.press(getAllByText('Productivity')[0]);
    fireEvent.press(getByText('Save Profile'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Validation',
      'Select at least one focus area.'
    );
    expect(mockCompleteProfileSetup).not.toHaveBeenCalled();
  });

  it('TC_PROFILE_006 save sends normalized payload', async () => {
    const { getByPlaceholderText, getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(getByPlaceholderText('Display name'), '  Aayan  ');
    fireEvent.changeText(getByPlaceholderText('Age'), '21');
    fireEvent.changeText(getByPlaceholderText('Occupation'), '  Student  ');
    fireEvent.changeText(getByPlaceholderText('Main detox goal'), '  Focus better  ');
    fireEvent.changeText(getByPlaceholderText('Daily limit minutes'), '30');
    fireEvent.changeText(
      getByPlaceholderText('Extra focus areas (comma separated)'),
      'Study, Gaming, Study, Reading, Coding'
    );
    fireEvent.changeText(getByPlaceholderText('23:00'), '25:99');
    fireEvent.changeText(getByPlaceholderText('07:00'), '7:05');

    fireEvent.press(getByText('Save Profile'));

    await waitFor(() => {
      expect(mockCompleteProfileSetup).toHaveBeenCalledTimes(1);
    });

    expect(mockCompleteProfileSetup).toHaveBeenCalledWith({
      name: 'Aayan',
      age: 21,
      occupation: 'Student',
      goal: 'Focus better',
      dailyLimitMinutes: 60,
      focusAreas: [
        'Social Media',
        'Productivity',
        'Study',
        'Gaming',
        'Reading',
      ],
      bedTime: '23:59',
      wakeTime: '07:05',
      notificationSettings: {
        gentleNudges: true,
        dailySummaries: true,
        achievementAlerts: true,
        limitWarnings: true,
      },
    });
  });

  it('TC_PROFILE_007 successful save runs refresh, sync, intervention and shows success alert', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('Save Profile'));

    await waitFor(() => {
      expect(mockCompleteProfileSetup).toHaveBeenCalledTimes(1);
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(mockSyncDetoxNotifications).toHaveBeenCalledTimes(1);
    expect(mockRunLocalInterventionCheck).toHaveBeenCalledTimes(1);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Profile setup completed. Your plan, dashboard, real device reminders, and local intervention checks now use your selected goals, focus areas, sleep schedule, and notification preferences.'
    );
  });
});