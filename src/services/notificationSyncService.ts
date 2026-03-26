import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/api';
import { NotificationItem, SettingsData } from '../types';
import {
  NOTIFICATION_CHANNELS,
  buildBackendDeviceNotificationId,
  cancelAllDetoxNotifications,
  cancelBackendNotification,
  clearPendingNotificationPress,
  displayLocalNotification,
  scheduleCoreDetoxReminders,
} from './notificationService';

const STORAGE_KEYS = {
  DELIVERED_BACKEND_IDS: 'detox_delivered_backend_notification_ids',
  REMINDER_SIGNATURE: 'detox_reminder_signature',
};

function normalizeTime(value: string | undefined, fallback: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return fallback;

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function deriveDailySummaryTimeFromBedTime(bedTime?: string) {
  const normalized = normalizeTime(bedTime, '23:00');
  const [hours, minutes] = normalized.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const summaryMinutes = (totalMinutes - 60 + 24 * 60) % (24 * 60);
  const summaryHours = Math.floor(summaryMinutes / 60);
  const remainingMinutes = summaryMinutes % 60;

  return `${String(summaryHours).padStart(2, '0')}:${String(
    remainingMinutes
  ).padStart(2, '0')}`;
}

function createDefaultSettings(): SettingsData {
  return {
    notificationsEnabled: true,
    aiInterventionsEnabled: true,
    privacyModeEnabled: false,
    dailyLimitMinutes: 180,
    blockDistractingApps: false,
    focusAreas: ['Social Media', 'Productivity'],
    bedTime: '23:00',
    wakeTime: '07:00',
    achievementAlerts: true,
    limitWarnings: true,
    dataCollection: true,
    anonymizeData: true,
    googleFitConnected: false,
    appleHealthConnected: false,
    theme: 'dark',
    appLimits: [],
  };
}

async function getDeliveredBackendIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.DELIVERED_BACKEND_IDS);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function setDeliveredBackendIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  await AsyncStorage.setItem(
    STORAGE_KEYS.DELIVERED_BACKEND_IDS,
    JSON.stringify(uniqueIds)
  );
}

function shouldDeliverNotification(
  item: NotificationItem,
  settings: SettingsData
): boolean {
  switch (item.type) {
    case 'achievement':
      return settings.achievementAlerts !== false;

    case 'limit_warning':
      return settings.limitWarnings !== false;

    case 'summary':
      return settings.notificationsEnabled !== false;

    case 'sleep':
      return settings.aiInterventionsEnabled !== false;

    case 'system':
    default:
      return (
        settings.notificationsEnabled !== false ||
        settings.aiInterventionsEnabled !== false
      );
  }
}

function resolveChannelForNotification(item: NotificationItem) {
  switch (item.type) {
    case 'achievement':
      return NOTIFICATION_CHANNELS.ACHIEVEMENTS;

    case 'summary':
    case 'sleep':
      return NOTIFICATION_CHANNELS.REMINDERS;

    case 'limit_warning':
    case 'system':
    default:
      return NOTIFICATION_CHANNELS.INTERVENTIONS;
  }
}

export async function applyNotificationSchedulesFromSettings(
  settings: SettingsData
) {
  const safeSettings: SettingsData = {
    ...createDefaultSettings(),
    ...settings,
    focusAreas:
      Array.isArray(settings?.focusAreas) && settings.focusAreas.length
        ? settings.focusAreas
        : ['Social Media', 'Productivity'],
    appLimits: Array.isArray(settings?.appLimits) ? settings.appLimits : [],
  };

  const bedTime = normalizeTime(safeSettings.bedTime, '23:00');
  const dailySummaryTime = deriveDailySummaryTimeFromBedTime(bedTime);

  const signature = JSON.stringify({
    notificationsEnabled: safeSettings.notificationsEnabled !== false,
    aiInterventionsEnabled: safeSettings.aiInterventionsEnabled !== false,
    bedTime,
    dailySummaryTime,
  });

  const previousSignature = await AsyncStorage.getItem(
    STORAGE_KEYS.REMINDER_SIGNATURE
  );

  if (previousSignature === signature) {
    return;
  }

  await scheduleCoreDetoxReminders({
    notificationsEnabled: safeSettings.notificationsEnabled,
    aiInterventionsEnabled: safeSettings.aiInterventionsEnabled,
    bedTime,
    dailySummaryTime,
  });

  await AsyncStorage.setItem(STORAGE_KEYS.REMINDER_SIGNATURE, signature);
}

export async function syncDetoxNotifications() {
  const [settingsResponse, notificationsResponse] = await Promise.all([
    api.getSettings(),
    api.getNotifications(),
  ]);

  const settings: SettingsData = {
    ...createDefaultSettings(),
    ...(settingsResponse?.settings || {}),
    focusAreas:
      Array.isArray(settingsResponse?.settings?.focusAreas) &&
      settingsResponse.settings.focusAreas.length
        ? settingsResponse.settings.focusAreas
        : ['Social Media', 'Productivity'],
    appLimits: Array.isArray(settingsResponse?.settings?.appLimits)
      ? settingsResponse.settings.appLimits
      : [],
  };

  const notifications: NotificationItem[] = Array.isArray(
    notificationsResponse?.notifications
  )
    ? notificationsResponse.notifications
    : [];

  await applyNotificationSchedulesFromSettings(settings);

  const deliveredIds = new Set(await getDeliveredBackendIds());
  const unreadIds = new Set(
    notifications
      .filter((item) => item?._id && !item.read)
      .map((item) => String(item._id))
  );

  for (const deliveredId of Array.from(deliveredIds)) {
    if (!unreadIds.has(deliveredId)) {
      await cancelBackendNotification(deliveredId);
      deliveredIds.delete(deliveredId);
    }
  }

  for (const item of notifications) {
    if (!item?._id || item.read) {
      continue;
    }

    if (deliveredIds.has(item._id)) {
      continue;
    }

    if (!shouldDeliverNotification(item, settings)) {
      continue;
    }

    await displayLocalNotification({
      id: buildBackendDeviceNotificationId(item._id),
      backendNotificationId: item._id,
      title: item.title,
      body: item.message,
      ctaAction: item.ctaAction,
      ctaLabel: item.ctaLabel,
      channelId: resolveChannelForNotification(item),
      data: {
        notificationType: item.type || 'system',
      },
    });

    deliveredIds.add(item._id);
  }

  await setDeliveredBackendIds(Array.from(deliveredIds));
}

export async function dismissDeliveredBackendNotification(
  backendNotificationId?: string
) {
  if (!backendNotificationId) return;

  await cancelBackendNotification(backendNotificationId);

  const deliveredIds = new Set(await getDeliveredBackendIds());
  deliveredIds.delete(backendNotificationId);
  await setDeliveredBackendIds(Array.from(deliveredIds));
}

export async function dismissDeliveredBackendNotifications(
  backendNotificationIds: string[]
) {
  const validIds = backendNotificationIds.filter(Boolean);

  for (const notificationId of validIds) {
    await cancelBackendNotification(notificationId);
  }

  const deliveredIds = new Set(await getDeliveredBackendIds());

  for (const notificationId of validIds) {
    deliveredIds.delete(notificationId);
  }

  await setDeliveredBackendIds(Array.from(deliveredIds));
}

export async function resetDetoxNotificationSync() {
  await clearPendingNotificationPress();
  await cancelAllDetoxNotifications();

  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.DELIVERED_BACKEND_IDS),
    AsyncStorage.removeItem(STORAGE_KEYS.REMINDER_SIGNATURE),
  ]);
}