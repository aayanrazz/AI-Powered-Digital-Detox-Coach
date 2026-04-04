import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SettingsPrivacyScreen from '../SettingsPrivacyScreen';

const mockGetSettings = jest.fn<() => Promise<any>>();
const mockGetPrivacyPolicy = jest.fn<() => Promise<any>>();
const mockSavePrivacyConsent = jest.fn<(payload: any) => Promise<any>>();
const mockUpdateSettings = jest.fn<(payload: any) => Promise<any>>();
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
    savePrivacyConsent: (payload: any) => mockSavePrivacyConsent(payload),
    updateSettings: (payload: any) => mockUpdateSettings(payload),
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
    summary: ['Privacy summary item'],
    sections: [],
    retentionOptions: [7, 30, 90, 180, 365],
    securityPractices: ['Encryption at rest'],
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

describe('SettingsPrivacyScreen privacy, consent, and data-control', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSettings.mockResolvedValue({
      settings: makeSettings(),
    });

    mockGetPrivacyPolicy.mockResolvedValue(makePolicy());

    mockSavePrivacyConsent.mockResolvedValue({
      success: true,
      message: 'Privacy consent saved successfully.',
      privacySettings: makePolicy().policy.currentPrivacySettings,
    });

    mockUpdateSettings.mockResolvedValue({
      success: true,
      settings: makeSettings(),
    });

    mockDeleteMyData.mockResolvedValue({
      success: true,
      message: 'Stored data deleted successfully.',
    });

    mockSyncDetoxNotifications.mockResolvedValue(undefined);
    mockRunLocalInterventionCheck.mockResolvedValue(undefined);

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('TC_PRIVACY_001 mobile loads privacy policy and current privacy settings correctly', async () => {
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
    expect(
      getByText('Consent active • Retention 90 days • Collection On • Anonymization Off • Training On')
    ).toBeTruthy();
  });

  it('TC_PRIVACY_002 mobile saves explicit consent and privacy flags correctly', async () => {
    mockGetSettings.mockResolvedValue({
      settings: makeSettings({
        dataCollection: true,
        anonymizeData: true,
        allowAnalyticsForTraining: true,
        retentionDays: 90,
        consentGiven: true,
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

    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockSavePrivacyConsent).toHaveBeenCalledTimes(1);
    });

    expect(mockSavePrivacyConsent).toHaveBeenCalledWith({
      consentGiven: true,
      dataCollection: true,
      anonymizeData: true,
      allowAnalyticsForTraining: true,
      retentionDays: 90,
    });
  });

  it('TC_PRIVACY_003 mobile turning consent off forces collection and training off', async () => {
    mockGetSettings.mockResolvedValue({
      settings: makeSettings({
        dataCollection: true,
        allowAnalyticsForTraining: true,
        retentionDays: 90,
        consentGiven: true,
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
      expect(mockSavePrivacyConsent).toHaveBeenCalledTimes(1);
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });

    expect(mockSavePrivacyConsent).toHaveBeenCalledWith({
      consentGiven: false,
      dataCollection: false,
      anonymizeData: true,
      allowAnalyticsForTraining: false,
      retentionDays: 90,
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        consentGiven: false,
        dataCollection: false,
        allowAnalyticsForTraining: false,
      })
    );
  });

  it('TC_PRIVACY_004 mobile save sanitizes invalid retention days', async () => {
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

    const { getByText } = render(<SettingsPrivacyScreen />);

    await waitFor(() => {
      expect(mockGetPrivacyPolicy).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByText('Save Settings'));

    await waitFor(() => {
      expect(mockSavePrivacyConsent).toHaveBeenCalledTimes(1);
    });

    expect(mockSavePrivacyConsent).toHaveBeenCalledWith({
      consentGiven: false,
      dataCollection: false,
      anonymizeData: true,
      allowAnalyticsForTraining: false,
      retentionDays: 30,
    });
  });

  it('TC_PRIVACY_005 mobile delete-my-data confirm flow deletes stored data and reloads privacy state', async () => {
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