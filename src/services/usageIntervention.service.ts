import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { NativeModules, Platform } from 'react-native';
import { APP_CONFIG } from '../config/appConfig';
import type { AppLimit, UsageApp } from '../types';

export type InterventionLevel = 'approaching_limit' | 'limit_reached';

export interface TriggeredWarning {
  appName: string;
  appPackage: string;
  usedMinutes: number;
  limitMinutes: number;
  percentageUsed: number;
  level: InterventionLevel;
  message: string;
}

export interface UsageSummary {
  totalMinutes: number;
  totalPickups: number;
  totalUnlocks: number;
  appCount: number;
}

export interface UsageRefreshAndCheckResult {
  apps: UsageApp[];
  appLimits: AppLimit[];
  summary: UsageSummary;
  triggeredWarnings: TriggeredWarning[];
}

const INTERVENTION_CHANNEL_ID = 'detox-interventions';
const INTERVENTION_CHANNEL_NAME = 'Detox Interventions';
const COOLDOWN_MINUTES = 30;

function buildUrl(path: string) {
  const normalizedBase = APP_CONFIG.API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function firstString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function firstNumber(...values: any[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function extractArray(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.apps)) {
    return payload.apps;
  }

  if (Array.isArray(payload?.data?.apps)) {
    return payload.data.apps;
  }

  if (Array.isArray(payload?.usage?.apps)) {
    return payload.usage.apps;
  }

  if (Array.isArray(payload?.sessions)) {
    return payload.sessions;
  }

  if (Array.isArray(payload?.data?.sessions)) {
    return payload.data.sessions;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function normalizeUsageItem(item: any): UsageApp {
  const packageName = firstString(
    item?.packageName,
    item?.appPackage,
    item?.package,
  );

  const appName = firstString(
    item?.appName,
    item?.name,
    item?.label,
    packageName,
    'Unknown App',
  );

  const minutesUsed = Math.max(
    0,
    Math.round(
      firstNumber(
        item?.minutesUsed,
        item?.durationMinutes,
        item?.foregroundMinutes,
        item?.totalMinutes,
        item?.foregroundMs ? Number(item.foregroundMs) / 60000 : undefined,
        item?.totalTimeInForeground
          ? Number(item.totalTimeInForeground) / 60000
          : undefined,
      ),
    ),
  );

  const foregroundMs = Math.max(
    0,
    Math.round(
      firstNumber(
        item?.foregroundMs,
        item?.totalTimeInForeground,
        minutesUsed * 60000,
      ),
    ),
  );

  return {
    packageName,
    appName,
    foregroundMs,
    minutesUsed,
    lastTimeUsed: firstNumber(item?.lastTimeUsed),
    pickups: Math.max(0, Math.round(firstNumber(item?.pickups))),
    unlocks: Math.max(0, Math.round(firstNumber(item?.unlocks))),
    category: firstString(item?.category, 'Other'),
  };
}

function normalizeAppLimit(item: any): AppLimit {
  return {
    user: item?.user,
    appName: firstString(item?.appName, item?.label, item?.name),
    appPackage: firstString(item?.appPackage, item?.packageName, item?.package),
    category: firstString(item?.category, 'Other'),
    dailyLimitMinutes: Math.max(
      0,
      Math.round(
        firstNumber(
          item?.dailyLimitMinutes,
          item?.limitMinutes,
          item?.minutes,
        ),
      ),
    ),
  } as AppLimit;
}

function buildSummary(apps: UsageApp[]): UsageSummary {
  return {
    totalMinutes: apps.reduce(
      (sum, app) => sum + Math.max(0, Number(app.minutesUsed || 0)),
      0,
    ),
    totalPickups: apps.reduce(
      (sum, app) => sum + Math.max(0, Number(app.pickups || 0)),
      0,
    ),
    totalUnlocks: apps.reduce(
      (sum, app) => sum + Math.max(0, Number(app.unlocks || 0)),
      0,
    ),
    appCount: apps.length,
  };
}

async function readLatestAndroidUsage(): Promise<UsageApp[]> {
  if (Platform.OS !== 'android') {
    return [];
  }

  const usageStatsModule = NativeModules?.UsageStatsModule;

  if (!usageStatsModule) {
    throw new Error(
      'UsageStatsModule is not linked. Please check your Android usage bridge setup.',
    );
  }

  const candidateMethods = [
    'getTodayUsageStats',
    'getTodayUsage',
    'fetchTodayUsage',
    'getUsageStats',
  ];

  let rawResult: any = null;

  for (const methodName of candidateMethods) {
    if (typeof usageStatsModule[methodName] === 'function') {
      rawResult = await usageStatsModule[methodName]();
      break;
    }
  }

  if (!rawResult) {
    throw new Error(
      'No supported usage method was found on UsageStatsModule.',
    );
  }

  return extractArray(rawResult)
    .map(normalizeUsageItem)
    .filter(item => item.packageName)
    .sort((a, b) => b.minutesUsed - a.minutesUsed);
}

async function syncUsageToBackend(apps: UsageApp[]) {
  if (!apps.length) {
    return;
  }

  const headers = await getAuthHeaders();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const payload = apps.map(app => ({
    appName: app.appName,
    appPackage: app.packageName,
    category: app.category || 'Other',
    durationMinutes: Math.max(0, Math.round(app.minutesUsed || 0)),
    pickups: Math.max(0, Math.round(app.pickups || 0)),
    unlocks: Math.max(0, Math.round(app.unlocks || 0)),
    platform: 'android',
    startTime: startOfDay.toISOString(),
    endTime: now.toISOString(),
  }));

  const response = await fetch(buildUrl('/usage/ingest'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessions: payload,
      apps: payload,
      usage: payload,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to sync usage to backend. ${errorText || response.status}`,
    );
  }
}

async function fetchTodayUsageFromBackend(): Promise<UsageApp[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(buildUrl('/usage/today'), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch today usage. ${errorText || response.status}`,
    );
  }

  const json = await response.json();

  return extractArray(json)
    .map(normalizeUsageItem)
    .filter(item => item.packageName)
    .sort((a, b) => b.minutesUsed - a.minutesUsed);
}

async function fetchAppLimitsFromBackend(): Promise<AppLimit[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(buildUrl('/settings'), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();

  const rawLimits =
    json?.appLimits ||
    json?.settings?.appLimits ||
    json?.data?.appLimits ||
    json?.limits ||
    json?.settings?.limits ||
    [];

  if (!Array.isArray(rawLimits)) {
    return [];
  }

  return rawLimits
    .map(normalizeAppLimit)
    .filter(
      item => item.appPackage && Number(item.dailyLimitMinutes || 0) > 0,
    );
}

function buildInterventionCandidates(
  apps: UsageApp[],
  appLimits: AppLimit[],
): TriggeredWarning[] {
  const appMap = new Map<string, UsageApp>();

  apps.forEach(app => {
    if (app.packageName) {
      appMap.set(app.packageName, app);
    }
  });

  const warnings: TriggeredWarning[] = [];

  for (const limit of appLimits) {
    const appPackage = firstString(limit.appPackage);
    const limitMinutes = Math.max(
      0,
      Math.round(firstNumber(limit.dailyLimitMinutes)),
    );

    if (!appPackage || !limitMinutes) {
      continue;
    }

    const usage = appMap.get(appPackage);

    if (!usage) {
      continue;
    }

    const usedMinutes = Math.max(
      0,
      Math.round(firstNumber(usage.minutesUsed)),
    );

    const percentageUsed = Math.round((usedMinutes / limitMinutes) * 100);

    if (usedMinutes >= limitMinutes) {
      warnings.push({
        appName: usage.appName || limit.appName || appPackage,
        appPackage,
        usedMinutes,
        limitMinutes,
        percentageUsed,
        level: 'limit_reached',
        message: `You have used ${
          usage.appName || limit.appName || 'this app'
        } for ${usedMinutes} minutes today, which is over your ${limitMinutes}-minute limit.`,
      });
      continue;
    }

    if (percentageUsed >= 80) {
      warnings.push({
        appName: usage.appName || limit.appName || appPackage,
        appPackage,
        usedMinutes,
        limitMinutes,
        percentageUsed,
        level: 'approaching_limit',
        message: `You are close to your limit for ${
          usage.appName || limit.appName || 'this app'
        }: ${usedMinutes}/${limitMinutes} minutes used today.`,
      });
    }
  }

  return warnings.sort((a, b) => {
    const aPriority = a.level === 'limit_reached' ? 2 : 1;
    const bPriority = b.level === 'limit_reached' ? 2 : 1;
    return bPriority - aPriority;
  });
}

function buildCooldownKey(
  appPackage: string,
  level: InterventionLevel,
): string {
  const day = new Date().toISOString().slice(0, 10);
  return `detox_intervention_${day}_${level}_${appPackage}`;
}

async function canSendWarning(
  appPackage: string,
  level: InterventionLevel,
): Promise<boolean> {
  const key = buildCooldownKey(appPackage, level);
  const lastSentRaw = await AsyncStorage.getItem(key);

  if (!lastSentRaw) {
    return true;
  }

  const lastSent = Number(lastSentRaw);

  if (!Number.isFinite(lastSent)) {
    return true;
  }

  const minutesSinceLastSent = (Date.now() - lastSent) / 60000;
  return minutesSinceLastSent >= COOLDOWN_MINUTES;
}

async function markWarningSent(
  appPackage: string,
  level: InterventionLevel,
) {
  const key = buildCooldownKey(appPackage, level);
  await AsyncStorage.setItem(key, String(Date.now()));
}

async function showLocalInterventionNotification(warning: TriggeredWarning) {
  await notifee.requestPermission();

  const channelId = await notifee.createChannel({
    id: INTERVENTION_CHANNEL_ID,
    name: INTERVENTION_CHANNEL_NAME,
    importance: AndroidImportance.HIGH,
  });

  const title =
    warning.level === 'limit_reached'
      ? `Limit reached: ${warning.appName}`
      : `Almost at limit: ${warning.appName}`;

  await notifee.displayNotification({
    title,
    body: warning.message,
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      pressAction: {
        id: 'default',
      },
    },
  });
}

async function triggerImmediateWarnings(
  candidates: TriggeredWarning[],
): Promise<TriggeredWarning[]> {
  const triggered: TriggeredWarning[] = [];

  for (const warning of candidates) {
    const allowed = await canSendWarning(warning.appPackage, warning.level);

    if (!allowed) {
      continue;
    }

    await showLocalInterventionNotification(warning);
    await markWarningSent(warning.appPackage, warning.level);
    triggered.push(warning);
  }

  return triggered;
}

export async function refreshUsageAndRunImmediateInterventionCheck(): Promise<UsageRefreshAndCheckResult> {
  const latestDeviceUsage = await readLatestAndroidUsage();

  await syncUsageToBackend(latestDeviceUsage);

  let appsFromBackend: UsageApp[] = [];
  try {
    appsFromBackend = await fetchTodayUsageFromBackend();
  } catch {
    appsFromBackend = latestDeviceUsage;
  }

  const appLimits = await fetchAppLimitsFromBackend();
  const summary = buildSummary(appsFromBackend);
  const candidates = buildInterventionCandidates(appsFromBackend, appLimits);
  const triggeredWarnings = await triggerImmediateWarnings(candidates);

  return {
    apps: appsFromBackend,
    appLimits,
    summary,
    triggeredWarnings,
  };
}