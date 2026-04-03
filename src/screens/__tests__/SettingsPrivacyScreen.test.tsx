import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SettingsPrivacyScreen from '../SettingsPrivacyScreen';

const mockGetSettings = jest.fn<() => Promise<any>>();
const mockGetPrivacyPolicy = jest.fn<() => Promise<any>>();
const mockUpdateSettings = jest.fn<(payload: any) => Promise<any>>();
const mockSavePrivacyConsent = jest.fn<(payload: any) => Promise<any>>();
const mockDeleteMyData = jest.fn<() => Promise<any>>();
const mockSyncDetoxNotifications = jest.fn<() => Promise<void>>();
const mockRunLocalInterventionCheck = jest.fn<() => Promise<void>>();
const mockLogout = jest.fn<() => void>();

type AlertButtonLike = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

jest.mock('../../api/api', () => ({
  api: {
    getSettings: () => mockGetSettings(),
    getPrivacyPolicy: () => mockGetPrivacyPolicy(),
    updateSettings: (payload: any) => mockUpdateSettings(payload),
    savePrivacyConsent: (payload: any) => mockSavePrivacyConsent(payload),
    deleteMyData: () => mockDeleteMyData(),
  },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
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

jest.mock('../../services/notificationSyncService', () => ({
  syncDetoxNotifications: () => mockSyncDetoxNotifications(),
}));

jest.mock('../../services/interventionService', () => ({
  runLocalInterventionCheck: () => mockRunLocalInterventionCheck(),
}));

jest.mock('../../components/Screen', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../../components/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    __esModule: true,
    default: ({
      title,
      onPress,
      loading,
    }: {
      title: string;
      onPress: () => void;
      loading?: boolean;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{loading ? `${title}...` : title}</Text>
      </Pressable>
    ),
  };
});

const makeSettings = (overrides: Record<string, any> = {}) => ({
  notificationsEnabled: true,
  aiInterventionsEnabled: true,
  privacyModeEnabled: true,
  dailyLimitMinutes: 180,
  blockDistractingApps: false,
  focusAreas: ['Social Media', 'Productivity'],
  bedTime: '23:00',
  wakeTime: '07:00',
  achievementAlerts: true,
  limitWarnings: true,
  dataCollection: false,
  anonymizeData: true,
  allowAnalyticsForTraining: false,
  retentionDays: 30,
  consentGiven: false,
  consentVersion: 'v1.0',
  consentedAt: null,
  policyLastViewedAt: null,
  deletionRequestedAt: null,
  googleFitConnected: false,
  appleHealthConnected: false,
  theme: 'dark',
  appLimits: [],
  ...overrides,
});

const makePolicy = (overrides: Record<string, any> = {}) => ({
  policy: {
    version: 'v1.0',
    updatedAt: '2026-03-27',
    summary: ['Summary item'],
    sections: [],
    retentionOptions: [7, 30, 90, 180, 365],
    securityPractices: ['Security item'],
    currentPrivacySettings: {
      dataCollection: false,
      anonymizeData: true,
      allowAnalyticsForTraining: false,
      retentionDays: 30,
      consentGiven: false,
      consentVersion: 'v1.0',
      consentedAt: null,
      policyLastViewedAt: null,
      deletionRequestedAt: null,
    },
    ...overrides,
  },
});

describe('SettingsPrivacyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSettings.mockResolvedValue({
      settings: makeSettings(),
    });

    mockGetPrivacyPolicy.mockResolvedValue(makePolicy());

    mockUpdateSettings.mockResolvedValue({
      settings: makeSettings(),
    });

    mockSavePrivacyConsent.mockResolvedValue({
      message: 'Consent saved.',
      privacySettings: makePolicy().policy.currentPrivacySettings,
    });

    mockDeleteMyData.mockResolvedValue({
      message: 'Stored data deleted successfully.',
    });

    mockSyncDetoxNotifications.mockResolvedValue(undefined);
    mockRunLocalInterventionCheck.mockResolvedValue(undefined);

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_SETTINGS_001 mobile loads settings and privacy policy data correctly', async () => {
    mockGetSettings.mockResolvedValue({
      settings: makeSettings({
        focusAreas: ['Gaming', 'Deep Work'],
        theme: 'light',
      }),
    });

    mockGetPrivacyPolicy.mockResolvedValue(
      makePolicy({
        version: 'v2.0',
        updatedAt: '2026-04-01',
        currentPrivacySettings: {
          dataCollection: true,
          anonymizeData: false,
          allowAnalyticsForTraining: true,
          retentionDays: 90,
          consentGiven: true,
          consentVersion: 'v2.0',
          consentedAt: null,
          policyLastViewedAt: null,
          deletionRequestedAt: null,
        },
      })
    );

    const { getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
      expect(mockGetPrivacyPolicy).toHaveBeenCalledTimes(1);
    });

    expect(getByText('Policy version: v2.0 • Updated: 2026-04-01')).toBeTruthy();
    expect(getByText('Applied focus areas: Gaming, Deep Work')).toBeTruthy();
    expect(
      getByText('Consent active • Retention 90 days • Collection On • Anonymization Off • Training On')
    ).toBeTruthy();
  });

  it('TC_SETTINGS_002 mobile shows alert when settings load fails', async () => {
    mockGetSettings.mockRejectedValue(new Error('Failed to load settings and privacy information'));

    render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Settings error',
        'Failed to load settings and privacy information'
      );
    });
  });

  it('TC_SETTINGS_003 mobile save sanitizes daily limit, retention days, and time values', async () => {
    mockGetSettings.mockResolvedValue({
      settings: makeSettings({
        dailyLimitMinutes: 180,
        bedTime: '23:00',
        wakeTime: '07:00',
      }),
    });

    mockGetPrivacyPolicy.mockResolvedValue(
      makePolicy({
        currentPrivacySettings: {
          dataCollection: false,
          anonymizeData: true,
          allowAnalyticsForTraining: false,
          retentionDays: 999,
          consentGiven: false,
          consentVersion: 'v1.0',
          consentedAt: null,
          policyLastViewedAt: null,
          deletionRequestedAt: null,
        },
      })
    );

    const { getByDisplayValue, getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(getByDisplayValue('180'), '30');
    fireEvent.changeText(getByDisplayValue('23:00'), '25:99');
    fireEvent.changeText(getByDisplayValue('07:00'), '7:05');

    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyLimitMinutes: 60,
        bedTime: '23:59',
        wakeTime: '07:05',
        retentionDays: 30,
        consentGiven: false,
        dataCollection: false,
        allowAnalyticsForTraining: false,
      })
    );

    expect(mockSavePrivacyConsent).toHaveBeenCalledWith({
      consentGiven: false,
      dataCollection: false,
      anonymizeData: true,
      allowAnalyticsForTraining: false,
      retentionDays: 30,
    });
  });

  it('TC_SETTINGS_004 mobile save merges preset and custom focus areas and caps at 5', async () => {
    const { getByText, getByPlaceholderText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('Gaming'));
    fireEvent.press(getByText('Streaming'));
    fireEvent.changeText(
      getByPlaceholderText('Extra focus areas (comma separated)'),
      'Deep Work, Reading, Gaming'
    );

    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        focusAreas: [
          'Social Media',
          'Productivity',
          'Gaming',
          'Streaming',
          'Deep Work',
        ],
      })
    );
  });

  it('TC_SETTINGS_005 mobile consent toggle off forces collection and training off', async () => {
    mockGetSettings.mockResolvedValue({
      settings: makeSettings({
        dataCollection: true,
        allowAnalyticsForTraining: true,
      }),
    });

    mockGetPrivacyPolicy.mockResolvedValue(
      makePolicy({
        currentPrivacySettings: {
          dataCollection: true,
          anonymizeData: true,
          allowAnalyticsForTraining: true,
          retentionDays: 90,
          consentGiven: true,
          consentVersion: 'v1.0',
          consentedAt: null,
          policyLastViewedAt: null,
          deletionRequestedAt: null,
        },
      })
    );

    const { getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(
      getByText(/I have read the privacy policy and I give explicit consent/i)
    );

    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        consentGiven: false,
        dataCollection: false,
        allowAnalyticsForTraining: false,
      })
    );

    expect(mockSavePrivacyConsent).toHaveBeenCalledWith({
      consentGiven: false,
      dataCollection: false,
      anonymizeData: true,
      allowAnalyticsForTraining: false,
      retentionDays: 90,
    });
  });

  it('TC_SETTINGS_006 mobile theme selection is saved in update payload', async () => {
    const { getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('LIGHT'));
    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'light',
      })
    );
  });

  it('TC_SETTINGS_007 mobile successful save calls update, consent save, sync, intervention, and reload', async () => {
    const { getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
      expect(mockGetPrivacyPolicy).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
      expect(mockSavePrivacyConsent).toHaveBeenCalledTimes(1);
      expect(mockSyncDetoxNotifications).toHaveBeenCalledTimes(1);
      expect(mockRunLocalInterventionCheck).toHaveBeenCalledTimes(1);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Settings, privacy consent, retention, and reminders were saved successfully.'
    );

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
      expect(mockGetPrivacyPolicy).toHaveBeenCalledTimes(2);
    });
  });

  it('TC_SETTINGS_008 mobile delete-my-data confirm flow deletes data and reloads settings', async () => {
    const { getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('Delete My Stored Data'));

    expect(Alert.alert).toHaveBeenCalled();

    const alertCalls = (Alert.alert as unknown as jest.Mock).mock.calls as [
      string,
      string,
      AlertButtonLike[]
    ][];

    const deleteCall = alertCalls.find(
      call => call[0] === 'Delete my stored data'
    );

    expect(deleteCall).toBeTruthy();

    const buttons: AlertButtonLike[] = deleteCall?.[2] ?? [];

    const destructiveButton = buttons.find(
      item => item?.text === 'Delete My Data'
    );

    expect(destructiveButton).toBeTruthy();

    await act(async () => {
      await destructiveButton?.onPress?.();
    });

    expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Data deleted',
      'Stored data deleted successfully.'
    );

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
      expect(mockGetPrivacyPolicy).toHaveBeenCalledTimes(2);
    });
  });
});