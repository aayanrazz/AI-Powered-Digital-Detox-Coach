import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { APP_CONFIG } from '../config/appConfig';
import type { AppLimit, UsageApp } from '../types';
import { usageTracker } from '../native/usageTracker';

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

type PrivacySyncState = {
  consentGiven: boolean;
  dataCollection: boolean;
  allowServerSync: boolean;
};

const INTERVENTION_CHANNEL_ID = 'detox-interventions';
const INTERVENTION_CHANNEL_NAME = 'Detox Interventions';
const COOLDOWN_MINUTES = 30;

const REQUEST_TIMEOUT_MS = 12000;
const HEADERS_CACHE_MS = 15000;
const SYNC_COOLDOWN_MS = 15000;
const PRIVACY_CACHE_MS = 15000;

let cachedHeaders: { value: Record<string, string>; at: number } | null = null;
let cachedPrivacyState: { value: PrivacySyncState; at: number } | null = null;
let inFlightRefreshPromise: Promise<UsageRefreshAndCheckResult> | null = null;
let notificationChannelPromise: Promise<string> | null = null;
let notificationPermissionPromise: Promise<unknown> | null = null;
let lastSyncSignature = '';
let lastSyncAt = 0;

function buildUrl(path: string) {
  const normalizedBase = APP_CONFIG.API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function getAuthHeaders() {
  const now = Date.now();

  if (cachedHeaders && now - cachedHeaders.at < HEADERS_CACHE_MS) {
    return cachedHeaders.value;
  }

  const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  cachedHeaders = {
    value: headers,
    at: now,
  };

  return headers;
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
    _id: item?._id,
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
    createdAt: item?.createdAt,
    updatedAt: item?.updatedAt,
  } as AppLimit;
}

function sanitizeUsageApp(app: UsageApp): UsageApp {
  const packageName = firstString(app?.packageName);
  const appName = firstString(app?.appName, packageName, 'Unknown App');

  return {
    packageName,
    appName,
    foregroundMs: Math.max(0, Math.round(Number(app?.foregroundMs || 0))),
    minutesUsed: Math.max(0, Math.round(Number(app?.minutesUsed || 0))),
    lastTimeUsed: firstNumber(app?.lastTimeUsed),
    pickups: Math.max(0, Math.round(Number(app?.pickups || 0))),
    unlocks: Math.max(0, Math.round(Number(app?.unlocks || 0))),
    category: firstString(app?.category, 'Other'),
  };
}

function mergeAppsByPackage(apps: UsageApp[]): UsageApp[] {
  const mergedMap = new Map<string, UsageApp>();

  for (const rawApp of apps) {
    const app = sanitizeUsageApp(rawApp);

    if (!app.packageName) {
      continue;
    }

    const existing = mergedMap.get(app.packageName);

    if (!existing) {
      mergedMap.set(app.packageName, app);
      continue;
    }

    mergedMap.set(app.packageName, {
      packageName: app.packageName,
      appName:
        existing.appName && existing.appName !== existing.packageName
          ? existing.appName
          : app.appName,
      foregroundMs:
        Math.max(0, Number(existing.foregroundMs || 0)) +
        Math.max(0, Number(app.foregroundMs || 0)),
      minutesUsed:
        Math.max(0, Number(existing.minutesUsed || 0)) +
        Math.max(0, Number(app.minutesUsed || 0)),
      lastTimeUsed: Math.max(
        Number(existing.lastTimeUsed || 0),
        Number(app.lastTimeUsed || 0),
      ),
      pickups:
        Math.max(0, Number(existing.pickups || 0)) +
        Math.max(0, Number(app.pickups || 0)),
      unlocks:
        Math.max(0, Number(existing.unlocks || 0)) +
        Math.max(0, Number(app.unlocks || 0)),
      category:
        existing.category && existing.category !== 'Other'
          ? existing.category
          : app.category || 'Other',
    });
  }

  return Array.from(mergedMap.values()).sort(
    (a, b) => b.minutesUsed - a.minutesUsed,
  );
}

function buildSummary(apps: UsageApp[]): UsageSummary {
  const mergedApps = mergeAppsByPackage(apps);

  return {
    totalMinutes: mergedApps.reduce(
      (sum, app) => sum + Math.max(0, Number(app.minutesUsed || 0)),
      0,
    ),
    totalPickups: mergedApps.reduce(
      (sum, app) => sum + Math.max(0, Number(app.pickups || 0)),
      0,
    ),
    totalUnlocks: mergedApps.reduce(
      (sum, app) => sum + Math.max(0, Number(app.unlocks || 0)),
      0,
    ),
    appCount: mergedApps.length,
  };
}

function buildUsageSignature(apps: UsageApp[]) {
  return mergeAppsByPackage(apps)
    .map(app =>
      [
        app.packageName,
        Math.round(Number(app.minutesUsed || 0)),
        Math.round(Number(app.pickups || 0)),
        Math.round(Number(app.unlocks || 0)),
      ].join(':'),
    )
    .sort()
    .join('|');
}

async function getPrivacySyncState(): Promise<PrivacySyncState> {
  const now = Date.now();

  if (cachedPrivacyState && now - cachedPrivacyState.at < PRIVACY_CACHE_MS) {
    return cachedPrivacyState.value;
  }

  const headers = await getAuthHeaders();

  const response = await withTimeout(
    fetch(buildUrl('/privacy/policy'), {
      method: 'GET',
      headers,
    }),
    REQUEST_TIMEOUT_MS,
    'Fetching privacy settings timed out.',
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch privacy settings. ${response.status}`);
  }

  const json = await response.json();
  const currentPrivacySettings = json?.policy?.currentPrivacySettings || {};

  const value: PrivacySyncState = {
    consentGiven: Boolean(currentPrivacySettings?.consentGiven),
    dataCollection: Boolean(currentPrivacySettings?.dataCollection),
    allowServerSync:
      Boolean(currentPrivacySettings?.consentGiven) &&
      Boolean(currentPrivacySettings?.dataCollection),
  };

  cachedPrivacyState = {
    value,
    at: now,
  };

  return value;
}

async function isServerUsageSyncAllowed(): Promise<boolean> {
  try {
    const privacy = await getPrivacySyncState();
    return privacy.allowServerSync;
  } catch {
    return false;
  }
}

async function syncUsageToBackend(apps: UsageApp[]) {
  const mergedApps = mergeAppsByPackage(apps);

  if (!mergedApps.length) {
    return;
  }

  const allowServerSync = await isServerUsageSyncAllowed();
  if (!allowServerSync) {
    return;
  }

  const signature = buildUsageSignature(mergedApps);
  const nowMs = Date.now();

  if (
    signature &&
    signature === lastSyncSignature &&
    nowMs - lastSyncAt < SYNC_COOLDOWN_MS
  ) {
    return;
  }

  const headers = await getAuthHeaders();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const payload = mergedApps.map(app => ({
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

  const response = await withTimeout(
    fetch(buildUrl('/usage/ingest'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessions: payload,
        apps: payload,
        usage: payload,
      }),
    }),
    REQUEST_TIMEOUT_MS,
    'Usage sync timed out.',
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to sync usage to backend. ${errorText || response.status}`,
    );
  }

  lastSyncSignature = signature;
  lastSyncAt = nowMs;
}

async function fetchTodayUsageFromBackend(): Promise<UsageApp[]> {
  const headers = await getAuthHeaders();

  const response = await withTimeout(
    fetch(buildUrl('/usage/today'), {
      method: 'GET',
      headers,
    }),
    REQUEST_TIMEOUT_MS,
    'Fetching today usage timed out.',
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch today usage. ${errorText || response.status}`,
    );
  }

  const json = await response.json();

  const normalizedApps = extractArray(json)
    .map(normalizeUsageItem)
    .filter(item => item.packageName);

  return mergeAppsByPackage(normalizedApps);
}

async function fetchAppLimitsFromBackend(): Promise<AppLimit[]> {
  const headers = await getAuthHeaders();

  const response = await withTimeout(
    fetch(buildUrl('/settings'), {
      method: 'GET',
      headers,
    }),
    REQUEST_TIMEOUT_MS,
    'Fetching app limits timed out.',
  );

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

  mergeAppsByPackage(apps).forEach(app => {
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

function buildCooldownKey(appPackage: string, level: InterventionLevel): string {
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

async function ensureNotificationReady() {
  if (!notificationPermissionPromise) {
    notificationPermissionPromise = notifee.requestPermission();
  }

  await notificationPermissionPromise;

  if (!notificationChannelPromise) {
    notificationChannelPromise = notifee.createChannel({
      id: INTERVENTION_CHANNEL_ID,
      name: INTERVENTION_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
    });
  }

  return notificationChannelPromise;
}

async function showLocalInterventionNotification(warning: TriggeredWarning) {
  const channelId = await ensureNotificationReady();

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
  if (!candidates.length) {
    return [];
  }

  const triggered: TriggeredWarning[] = [];

  for (const warning of candidates) {
    const allowed = await canSendWarning(warning.appPackage, warning.level);

    if (!allowed) {
      continue;
    }

    try {
      await showLocalInterventionNotification(warning);
      await markWarningSent(warning.appPackage, warning.level);
      triggered.push(warning);
    } catch {
      continue;
    }
  }

  return triggered;
}

export async function refreshUsageAndRunImmediateInterventionCheck(): Promise<UsageRefreshAndCheckResult> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    let latestDeviceUsage: UsageApp[] = [];

    try {
      const rawDeviceUsage = await withTimeout(
        usageTracker.getTodayUsage(),
        REQUEST_TIMEOUT_MS,
        'Reading Android usage took too long.',
      );

      latestDeviceUsage = mergeAppsByPackage(
        extractArray(rawDeviceUsage)
          .map(normalizeUsageItem)
          .filter(item => item.packageName),
      );
    } catch {
      latestDeviceUsage = [];
    }

    const appLimitsPromise = fetchAppLimitsFromBackend().catch(() => []);

    const syncPromise = latestDeviceUsage.length
      ? syncUsageToBackend(latestDeviceUsage).catch(() => undefined)
      : Promise.resolve();

    let appsForUi = latestDeviceUsage;

    if (!appsForUi.length) {
      try {
        appsForUi = await fetchTodayUsageFromBackend();
      } catch {
        appsForUi = [];
      }
    }

    await syncPromise;
    const appLimits = await appLimitsPromise;

    const mergedAppsForUi = mergeAppsByPackage(appsForUi);
    const summary = buildSummary(mergedAppsForUi);
    const candidates = buildInterventionCandidates(mergedAppsForUi, appLimits);
    const triggeredWarnings = await triggerImmediateWarnings(candidates);

    return {
      apps: mergedAppsForUi,
      appLimits,
      summary,
      triggeredWarnings,
    };
  })();

  try {
    return await inFlightRefreshPromise;
  } finally {
    inFlightRefreshPromise = null;
  }
}