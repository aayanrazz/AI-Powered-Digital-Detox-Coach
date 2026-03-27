import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/api';
import { SettingsData } from '../types';
import { displayLocalNotification } from './notificationService';

const STORAGE_KEYS = {
  COOLDOWNS: 'detox_local_intervention_cooldowns',
};

type TriggeredRule =
  | 'approaching_limit'
  | 'limit_reached'
  | 'high_pickups'
  | 'bedtime';

type CooldownMap = Record<string, number>;

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

function normalizeTime(value: string | undefined, fallback: string) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return fallback;

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cooldownKey(rule: TriggeredRule) {
  return `${todayKey()}:${rule}`;
}

async function getCooldownMap(): Promise<CooldownMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.COOLDOWNS);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function setCooldown(rule: TriggeredRule) {
  const map = await getCooldownMap();
  map[cooldownKey(rule)] = Date.now();
  await AsyncStorage.setItem(STORAGE_KEYS.COOLDOWNS, JSON.stringify(map));
}

async function canFire(rule: TriggeredRule, cooldownMs: number) {
  const map = await getCooldownMap();
  const lastTriggeredAt = Number(map[cooldownKey(rule)] || 0);

  if (!lastTriggeredAt) return true;

  return Date.now() - lastTriggeredAt >= cooldownMs;
}

function getAppsArray(usageResponse: any): any[] {
  if (Array.isArray(usageResponse?.apps)) return usageResponse.apps;
  if (Array.isArray(usageResponse?.usageByApp)) return usageResponse.usageByApp;
  if (Array.isArray(usageResponse?.topApps)) return usageResponse.topApps;
  if (Array.isArray(usageResponse?.summary?.apps)) return usageResponse.summary.apps;
  return [];
}

function getAppMinutes(app: any) {
  if (Number.isFinite(Number(app?.minutesUsed))) {
    return Number(app.minutesUsed);
  }

  if (Number.isFinite(Number(app?.durationMinutes))) {
    return Number(app.durationMinutes);
  }

  if (Number.isFinite(Number(app?.foregroundMs))) {
    return Math.round(Number(app.foregroundMs) / 60000);
  }

  return 0;
}

function getTotalMinutes(usageResponse: any) {
  const directCandidates = [
    usageResponse?.totalMinutes,
    usageResponse?.summary?.totalMinutes,
    usageResponse?.analytics?.totalMinutes,
    usageResponse?.usage?.totalMinutes,
    usageResponse?.today?.totalMinutes,
  ];

  for (const value of directCandidates) {
    if (Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return getAppsArray(usageResponse).reduce((sum, app) => {
    return sum + getAppMinutes(app);
  }, 0);
}

function getPickups(usageResponse: any) {
  const directCandidates = [
    usageResponse?.pickups,
    usageResponse?.summary?.pickups,
    usageResponse?.analytics?.pickups,
    usageResponse?.today?.pickups,
    usageResponse?.totalPickups,
  ];

  for (const value of directCandidates) {
    if (Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return getAppsArray(usageResponse).reduce((sum, app) => {
    const pickups = Number(app?.pickups || 0);
    return sum + (Number.isFinite(pickups) ? pickups : 0);
  }, 0);
}

function getTopAppName(usageResponse: any) {
  const apps = [...getAppsArray(usageResponse)];

  if (!apps.length) return 'your phone';

  apps.sort((a, b) => getAppMinutes(b) - getAppMinutes(a));

  const top = apps[0];
  return (
    top?.appName ||
    top?.name ||
    top?.packageName ||
    top?.appPackage ||
    'your phone'
  );
}

function isWithinBedtimeWindow(bedTime?: string) {
  const normalized = normalizeTime(bedTime, '23:00');
  const bedMinutes = parseTimeToMinutes(normalized);
  const nowMinutes = getNowMinutes();

  const windowStart = (bedMinutes - 60 + 1440) % 1440;
  const windowEnd = (bedMinutes + 45) % 1440;

  if (windowStart <= windowEnd) {
    return nowMinutes >= windowStart && nowMinutes <= windowEnd;
  }

  return nowMinutes >= windowStart || nowMinutes <= windowEnd;
}

async function getSettingsFromApi(): Promise<SettingsData> {
  try {
    if (typeof (api as any).getSettings !== 'function') {
      return createDefaultSettings();
    }

    const response = await (api as any).getSettings();

    return {
      ...createDefaultSettings(),
      ...(response?.settings || {}),
      focusAreas: Array.isArray(response?.settings?.focusAreas)
        ? response.settings.focusAreas
        : ['Social Media', 'Productivity'],
      appLimits: Array.isArray(response?.settings?.appLimits)
        ? response.settings.appLimits
        : [],
    };
  } catch {
    return createDefaultSettings();
  }
}

async function getTodayUsageFromApi() {
  try {
    if (typeof (api as any).getTodayUsage !== 'function') {
      return null;
    }

    return await (api as any).getTodayUsage();
  } catch {
    return null;
  }
}

export async function clearLocalInterventionCooldowns() {
  await AsyncStorage.removeItem(STORAGE_KEYS.COOLDOWNS);
}

export async function runLocalInterventionCheck(options?: {
  settings?: SettingsData;
  usageResponse?: any;
}): Promise<TriggeredRule[]> {
  const settings: SettingsData = {
    ...createDefaultSettings(),
    ...(options?.settings || (await getSettingsFromApi())),
    focusAreas: Array.isArray(options?.settings?.focusAreas)
      ? options!.settings!.focusAreas
      : options?.settings
      ? ['Social Media', 'Productivity']
      : undefined,
    appLimits: Array.isArray(options?.settings?.appLimits)
      ? options!.settings!.appLimits
      : options?.settings
      ? []
      : undefined,
  };

  const safeSettings: SettingsData = {
    ...createDefaultSettings(),
    ...settings,
    focusAreas: Array.isArray(settings.focusAreas)
      ? settings.focusAreas
      : ['Social Media', 'Productivity'],
    appLimits: Array.isArray(settings.appLimits) ? settings.appLimits : [],
  };

  const usageResponse =
    options?.usageResponse !== undefined
      ? options.usageResponse
      : await getTodayUsageFromApi();

  if (!usageResponse) {
    return [];
  }

  const totalMinutes = Math.max(0, Math.round(getTotalMinutes(usageResponse)));
  const pickups = Math.max(0, Math.round(getPickups(usageResponse)));
  const topAppName = getTopAppName(usageResponse);
  const dailyLimitMinutes = Math.max(
    60,
    Math.min(1440, Number(safeSettings.dailyLimitMinutes || 180))
  );

  const triggered: TriggeredRule[] = [];

  if (
    safeSettings.limitWarnings !== false &&
    totalMinutes >= dailyLimitMinutes &&
    (await canFire('limit_reached', 60 * 60 * 1000))
  ) {
    await displayLocalNotification({
      id: `local_limit_reached_${todayKey()}`,
      title: 'Daily limit reached',
      body: `You have used ${totalMinutes} minutes today. Take a short break and review your detox progress.`,
      ctaAction: 'open_usage_tab',
      ctaLabel: 'Open Usage',
      data: {
        rule: 'limit_reached',
        totalMinutes,
        dailyLimitMinutes,
      },
    });

    await setCooldown('limit_reached');
    triggered.push('limit_reached');
  } else if (
    safeSettings.limitWarnings !== false &&
    totalMinutes >= Math.round(dailyLimitMinutes * 0.75) &&
    (await canFire('approaching_limit', 45 * 60 * 1000))
  ) {
    await displayLocalNotification({
      id: `local_approaching_limit_${todayKey()}`,
      title: 'Approaching your daily limit',
      body: `You are at ${totalMinutes}/${dailyLimitMinutes} minutes today. Slow down now to stay on track.`,
      ctaAction: 'open_usage_tab',
      ctaLabel: 'Review Usage',
      data: {
        rule: 'approaching_limit',
        totalMinutes,
        dailyLimitMinutes,
      },
    });

    await setCooldown('approaching_limit');
    triggered.push('approaching_limit');
  }

  if (
    safeSettings.aiInterventionsEnabled !== false &&
    pickups >= 40 &&
    totalMinutes >= 60 &&
    (await canFire('high_pickups', 90 * 60 * 1000))
  ) {
    await displayLocalNotification({
      id: `local_high_pickups_${todayKey()}`,
      title: 'Frequent phone checking detected',
      body: `You have already checked your phone many times today. ${topAppName} seems to be pulling your attention.`,
      ctaAction: 'open_home',
      ctaLabel: 'Open Dashboard',
      data: {
        rule: 'high_pickups',
        pickups,
        totalMinutes,
        topAppName,
      },
    });

    await setCooldown('high_pickups');
    triggered.push('high_pickups');
  }

  if (
    safeSettings.aiInterventionsEnabled !== false &&
    totalMinutes >= 30 &&
    isWithinBedtimeWindow(safeSettings.bedTime) &&
    (await canFire('bedtime', 3 * 60 * 60 * 1000))
  ) {
    await displayLocalNotification({
      id: `local_bedtime_${todayKey()}`,
      title: 'Night-time detox reminder',
      body: 'It is close to bedtime. Put the phone away and start winding down.',
      ctaAction: 'wind_down',
      ctaLabel: 'Open Settings',
      data: {
        rule: 'bedtime',
        bedTime: safeSettings.bedTime || '23:00',
      },
    });

    await setCooldown('bedtime');
    triggered.push('bedtime');
  }

  return triggered;
}