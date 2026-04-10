import React from 'react';
import { render } from '@testing-library/react-native';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import RootNavigator from '../RootNavigator';

const mockUseAuth = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => React.createElement(View, null, children),
      Screen: ({ component: Component }: any) =>
        Component
          ? React.createElement(Component, {
              navigation: { navigate: jest.fn(), goBack: jest.fn() },
            })
          : null,
    }),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }: any) => React.createElement(View, null, children),
      Screen: ({ component: Component }: any) =>
        Component
          ? React.createElement(Component, {
              navigation: { navigate: jest.fn(), goBack: jest.fn() },
            })
          : null,
    }),
  };
});

jest.mock('../../screens/SplashScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSplashScreen() {
    return React.createElement(Text, null, 'Splash Screen');
  };
});

jest.mock('../../screens/LoginScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockLoginScreen() {
    return React.createElement(Text, null, 'Login Screen');
  };
});

jest.mock('../../screens/SignUpScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSignUpScreen() {
    return React.createElement(Text, null, 'Sign Up Screen');
  };
});

jest.mock('../../screens/ProfileSetupScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockProfileSetupScreen() {
    return React.createElement(Text, null, 'Profile Setup Screen');
  };
});

jest.mock('../../screens/HomeDashboardScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockHomeDashboardScreen() {
    return React.createElement(Text, null, 'Home Dashboard Screen');
  };
});

jest.mock('../../screens/UsageMonitoringScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockUsageMonitoringScreen() {
    return React.createElement(Text, null, 'Usage Monitoring Screen');
  };
});

jest.mock('../../screens/AnalyticsDashboardScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockAnalyticsDashboardScreen() {
    return React.createElement(Text, null, 'Analytics Dashboard Screen');
  };
});

jest.mock('../../screens/DetoxPlanScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockDetoxPlanScreen() {
    return React.createElement(Text, null, 'Detox Plan Screen');
  };
});

jest.mock('../../screens/NotificationsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockNotificationsScreen() {
    return React.createElement(Text, null, 'Notifications Screen');
  };
});

jest.mock('../../screens/RewardsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockRewardsScreen() {
    return React.createElement(Text, null, 'Rewards Screen');
  };
});

jest.mock('../../screens/SettingsPrivacyScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return function MockSettingsPrivacyScreen() {
    return React.createElement(Text, null, 'Settings Screen');
  };
});

describe('RootNavigator auth integration flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC_AUTH_UI_INT_001 shows login when there is no token', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      token: null,
      user: null,
    });

    const { getByText } = render(<RootNavigator />);

    expect(getByText('Login Screen')).toBeTruthy();
  });

  it('TC_AUTH_UI_INT_002 shows profile setup when user is logged in but not onboarded', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      token: 'valid-token',
      user: {
        _id: 'user-1',
        name: 'Integration Tester',
        email: 'integration.auth@example.com',
        isOnboarded: false,
      },
    });

    const { getByText } = render(<RootNavigator />);

    expect(getByText('Profile Setup Screen')).toBeTruthy();
  });

  it('TC_AUTH_UI_INT_003 shows dashboard when user is logged in and onboarded', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      token: 'valid-token',
      user: {
        _id: 'user-1',
        name: 'Integration Tester',
        email: 'integration.auth@example.com',
        isOnboarded: true,
      },
    });

    const { getByText } = render(<RootNavigator />);

    expect(getByText('Home Dashboard Screen')).toBeTruthy();
  });

  it('TC_AUTH_UI_INT_004 shows splash while auth state is loading', () => {
    mockUseAuth.mockReturnValue({
      loading: true,
      token: null,
      user: null,
    });

    const { getByText } = render(<RootNavigator />);

    expect(getByText('Splash Screen')).toBeTruthy();
  });
});