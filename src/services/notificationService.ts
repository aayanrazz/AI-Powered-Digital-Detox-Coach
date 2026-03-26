import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  Event,
  EventType,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from '../api/api';
import { navigationRef } from '../navigation/navigationService';
import { NotificationCtaAction } from '../types';
import { executeNotificationAction } from '../utils/notificationActions';

const STORAGE_KEYS = {
  PENDING_PRESS: 'detox_pending_notification_press',
};

export const NOTIFICATION_CHANNELS = {
  INTERVENTIONS: 'detox_interventions',
  REMINDERS: 'detox_reminders',
  ACHIEVEMENTS: 'detox_achievements',
};

export const SCHEDULED_NOTIFICATION_IDS = {
  DAILY_SUMMARY: 'detox_daily_summary',
  BEDTIME_REMINDER: 'detox_bedtime_reminder',
};

type PendingActionPayload = {
  ctaAction?: NotificationCtaAction;
  title?: string;
  message?: string;
};

type PressPayload = PendingActionPayload & {
  backendNotificationId?: string;
  deviceNotificationId?: string;
};

type LocalNotificationInput = {
  id?: string;
  title: string;
  body: string;
  channelId?: string;
  ctaAction?: NotificationCtaAction;
  ctaLabel?: string;
  backendNotificationId?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

function normalizeTime(value: string, fallback: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return fallback;

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function buildNextTimestamp(time: string) {
  const normalized = normalizeTime(time, '21:00');
  const [hours, minutes] = normalized.split(':').map(Number);

  const now = new Date();
  const next = new Date();

  next.setHours(hours, minutes, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

function toStringData(
  data?: Record<string, string | number | boolean | null | undefined>
) {
  const result: Record<string, string> = {};

  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  });

  return result;
}

function resolveChannelId(channelId?: string, action?: NotificationCtaAction) {
  if (channelId) return channelId;

  if (action === 'open_rewards') {
    return NOTIFICATION_CHANNELS.ACHIEVEMENTS;
  }

  return NOTIFICATION_CHANNELS.INTERVENTIONS;
}

function toPressPayload(notification: any): PressPayload {
  const data = notification?.data || {};

  return {
    ctaAction: (data.ctaAction as NotificationCtaAction) || undefined,
    title: String(notification?.title ?? data.title ?? ''),
    message: String(notification?.body ?? data.body ?? ''),
    backendNotificationId:
      typeof data.backendNotificationId === 'string' && data.backendNotificationId
        ? data.backendNotificationId
        : undefined,
    deviceNotificationId: notification?.id ? String(notification.id) : undefined,
  };
}

function toPendingActionPayload(payload: PressPayload): PendingActionPayload {
  return {
    ctaAction: payload.ctaAction,
    title: payload.title,
    message: payload.message,
  };
}

async function savePendingPress(payload: PendingActionPayload) {
  await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PRESS, JSON.stringify(payload));
}

async function getPendingPress(): Promise<PendingActionPayload | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PRESS);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingActionPayload;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_PRESS);
    return null;
  }
}

export async function clearPendingNotificationPress() {
  await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_PRESS);
}

export function buildBackendDeviceNotificationId(backendNotificationId: string) {
  return `detox_backend_${backendNotificationId}`;
}

export async function cancelDisplayedNotification(notificationId?: string) {
  if (!notificationId) return;

  try {
    await notifee.cancelNotification(notificationId);
  } catch {
    // ignore cancel errors
  }
}

export async function cancelBackendNotification(backendNotificationId?: string) {
  if (!backendNotificationId) return;

  await cancelDisplayedNotification(
    buildBackendDeviceNotificationId(backendNotificationId)
  );
}

export async function cancelManyBackendNotifications(
  backendNotificationIds: string[]
) {
  for (const notificationId of backendNotificationIds) {
    await cancelBackendNotification(notificationId);
  }
}

export async function cancelAllDetoxNotifications() {
  try {
    await notifee.cancelAllNotifications();
  } catch {
    // ignore cancel errors
  }
}

async function syncPressedBackendNotification(payload: PressPayload) {
  if (payload.backendNotificationId) {
    try {
      await api.markNotificationRead(payload.backendNotificationId);
    } catch {
      // ignore mark-read sync failure
    }

    await cancelBackendNotification(payload.backendNotificationId);
    return;
  }

  if (payload.deviceNotificationId) {
    await cancelDisplayedNotification(payload.deviceNotificationId);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'Allow DetoxCoach notifications',
        message:
          'DetoxCoach uses notifications for reminders, interventions, bedtime nudges, and detox progress alerts.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      }
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
}

export async function createNotificationChannels() {
  await notifee.createChannel({
    id: NOTIFICATION_CHANNELS.INTERVENTIONS,
    name: 'Detox Interventions',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });

  await notifee.createChannel({
    id: NOTIFICATION_CHANNELS.REMINDERS,
    name: 'Detox Reminders',
    importance: AndroidImportance.DEFAULT,
    vibration: true,
  });

  await notifee.createChannel({
    id: NOTIFICATION_CHANNELS.ACHIEVEMENTS,
    name: 'Rewards & Achievements',
    importance: AndroidImportance.DEFAULT,
    vibration: true,
  });
}

export async function initializeNotifications() {
  await createNotificationChannels();
  await requestNotificationPermission();
}

export async function displayLocalNotification(input: LocalNotificationInput) {
  const permitted = await requestNotificationPermission();

  if (!permitted) {
    return;
  }

  await createNotificationChannels();

  await notifee.displayNotification({
    id: input.id,
    title: input.title,
    body: input.body,
    data: {
      title: input.title,
      body: input.body,
      ctaAction: input.ctaAction || '',
      ctaLabel: input.ctaLabel || '',
      backendNotificationId: input.backendNotificationId || '',
      ...toStringData(input.data),
    },
    android: {
      channelId: resolveChannelId(input.channelId, input.ctaAction),
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      pressAction: {
        id: input.ctaAction || 'open_app',
      },
      showTimestamp: true,
      timestamp: Date.now(),
    },
  });
}

export async function cancelScheduledCoreNotifications() {
  await notifee.cancelNotification(SCHEDULED_NOTIFICATION_IDS.DAILY_SUMMARY);
  await notifee.cancelNotification(SCHEDULED_NOTIFICATION_IDS.BEDTIME_REMINDER);
}

export async function scheduleDailySummaryReminder(time: string = '20:00') {
  await createNotificationChannels();

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: buildNextTimestamp(time),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  await notifee.createTriggerNotification(
    {
      id: SCHEDULED_NOTIFICATION_IDS.DAILY_SUMMARY,
      title: 'Daily digital wellness check-in',
      body: 'Open DetoxCoach and review today’s screen-time progress.',
      data: {
        title: 'Daily digital wellness check-in',
        body: 'Open DetoxCoach and review today’s screen-time progress.',
        ctaAction: 'open_home',
      },
      android: {
        channelId: NOTIFICATION_CHANNELS.REMINDERS,
        importance: AndroidImportance.DEFAULT,
        pressAction: {
          id: 'open_home',
        },
      },
    },
    trigger
  );
}

export async function scheduleBedtimeReminder(bedTime: string = '23:00') {
  await createNotificationChannels();

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: buildNextTimestamp(bedTime),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: {
      allowWhileIdle: true,
    },
  };

  await notifee.createTriggerNotification(
    {
      id: SCHEDULED_NOTIFICATION_IDS.BEDTIME_REMINDER,
      title: 'Wind down time',
      body: 'It is close to bedtime. Put the phone away and start your detox routine.',
      data: {
        title: 'Wind down time',
        body: 'It is close to bedtime. Put the phone away and start your detox routine.',
        ctaAction: 'wind_down',
      },
      android: {
        channelId: NOTIFICATION_CHANNELS.REMINDERS,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'wind_down',
        },
      },
    },
    trigger
  );
}

export async function scheduleCoreDetoxReminders(options?: {
  notificationsEnabled?: boolean;
  aiInterventionsEnabled?: boolean;
  bedTime?: string;
  dailySummaryTime?: string;
}) {
  const notificationsEnabled = options?.notificationsEnabled !== false;
  const aiInterventionsEnabled = options?.aiInterventionsEnabled !== false;
  const bedTime = options?.bedTime || '23:00';
  const dailySummaryTime = options?.dailySummaryTime || '20:00';

  await cancelScheduledCoreNotifications();

  if (!notificationsEnabled && !aiInterventionsEnabled) {
    return;
  }

  if (notificationsEnabled) {
    await scheduleDailySummaryReminder(dailySummaryTime);
  }

  if (aiInterventionsEnabled) {
    await scheduleBedtimeReminder(bedTime);
  }
}

async function executePendingAction(payload: PendingActionPayload) {
  if (!navigationRef.isReady()) {
    await savePendingPress(payload);
    return;
  }

  await executeNotificationAction(
    navigationRef as any,
    payload.ctaAction,
    payload.title,
    payload.message
  );
}

async function executeStoredOrImmediateAction(payload: PressPayload) {
  await syncPressedBackendNotification(payload);
  await executePendingAction(toPendingActionPayload(payload));
}

export async function flushPendingNotificationPress() {
  const pending = await getPendingPress();

  if (!pending) {
    return;
  }

  await clearPendingNotificationPress();
  await executePendingAction(pending);
}

export async function consumeInitialNotificationPress() {
  const initial = await notifee.getInitialNotification();

  if (!initial?.notification) {
    return;
  }

  const payload = toPressPayload(initial.notification);
  await executeStoredOrImmediateAction(payload);
}

export function registerForegroundNotificationEvents() {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) {
      return;
    }

    const payload = toPressPayload(detail.notification);
    await executeStoredOrImmediateAction(payload);
  });
}

export async function handleBackgroundNotificationEvent(event: Event) {
  if (event.type !== EventType.PRESS && event.type !== EventType.ACTION_PRESS) {
    return;
  }

  const payload = toPressPayload(event.detail.notification);
  await syncPressedBackendNotification(payload);
  await savePendingPress(toPendingActionPayload(payload));
}