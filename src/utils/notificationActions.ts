import { Alert } from 'react-native';
import { NotificationCtaAction, NotificationItem } from '../types';

type AppNavigation = {
  navigate: (...args: any[]) => void;
};

export async function executeNotificationAction(
  navigation: AppNavigation,
  action?: NotificationCtaAction,
  title?: string,
  message?: string
) {
  switch (action) {
    case 'open_rewards':
      navigation.navigate('Rewards');
      return;

    case 'open_detox_plan':
      navigation.navigate('MainTabs', { screen: 'PlanTab' });
      return;

    case 'open_usage_tab':
      navigation.navigate('MainTabs', { screen: 'UsageTab' });
      return;

    case 'open_analytics_tab':
      navigation.navigate('MainTabs', { screen: 'AnalyticsTab' });
      return;

    case 'open_profile_setup':
      navigation.navigate('ProfileSetup');
      return;

    case 'open_settings':
    case 'wind_down':
      navigation.navigate('Settings');
      return;

    case 'open_notifications':
      navigation.navigate('Notifications');
      return;

    case 'open_home':
      navigation.navigate('MainTabs', { screen: 'HomeTab' });
      return;

    case 'start_break':
      Alert.alert(
        'Break started',
        'Take a 5 minute break away from your phone and come back mindfully.'
      );
      return;

    case 'show_message':
    default:
      Alert.alert(
        title || 'Notification',
        message || 'No action available.'
      );
      return;
  }
}

export async function runNotificationAction(
  navigation: AppNavigation,
  item: NotificationItem
) {
  return executeNotificationAction(
    navigation,
    item.ctaAction,
    item.title,
    item.message
  );
}