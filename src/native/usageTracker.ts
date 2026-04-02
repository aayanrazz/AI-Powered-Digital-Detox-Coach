import { Linking, NativeModules, Platform } from 'react-native';
import { UsageApp } from '../types';

type UsageStatsModuleType = {
  isUsagePermissionGranted: () => Promise<boolean>;
  openUsageAccessSettings: () => Promise<boolean>;
  getTodayUsageStats: () => Promise<any[]>;
};

const UsageStatsModule = NativeModules.UsageStatsModule as
  | UsageStatsModuleType
  | undefined;

const PERMISSION_CACHE_MS = 10000;
const USAGE_CACHE_MS = 10000;
const REQUEST_TIMEOUT_MS = 12000;

const OWN_APP_PACKAGE = 'com.detoxcoachmobile';

const BLOCKED_PACKAGE_EXACT = new Set([
  'android',
  OWN_APP_PACKAGE,
  'com.google.android.apps.nexuslauncher',
  'com.android.launcher',
  'com.android.launcher3',
  'com.android.permissioncontroller',
  'com.google.android.permissioncontroller',
  'com.google.android.overlay.modules.permissioncontroller',
  'com.samsung.android.app.launcher',
  'com.sec.android.app.launcher',
  'com.miui.home',
  'com.oneplus.launcher',
  'com.oppo.launcher',
  'com.vivo.launcher',
  'com.realme.launcher',
  'com.huawei.android.launcher',
  'com.transsion.hilauncher',
]);

const BLOCKED_PACKAGE_PREFIXES = [
  'com.android.systemui',
  'com.android.permissioncontroller',
  'com.google.android.permissioncontroller',
  'com.google.android.overlay.modules.permissioncontroller',
];

const BLOCKED_NAME_FRAGMENTS = [
  'launcher',
  'pixel launcher',
  'system ui',
  'permission controller',
];

let permissionCache: { value: boolean; checkedAt: number } | null = null;
let usageCache: { value: UsageApp[]; checkedAt: number } | null = null;
let inFlightUsagePromise: Promise<UsageApp[]> | null = null;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizePackageName(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeAppName(value?: string, fallback?: string): string {
  return String(value || fallback || 'Unknown App').trim();
}

function isIgnoredUsageApp(item: {
  packageName?: string;
  appName?: string;
}): boolean {
  const packageName = normalizePackageName(item?.packageName);
  const appName = String(item?.appName || '').trim().toLowerCase();

  if (!packageName) return true;
  if (BLOCKED_PACKAGE_EXACT.has(packageName)) return true;

  if (
    BLOCKED_PACKAGE_PREFIXES.some((prefix) => packageName.startsWith(prefix))
  ) {
    return true;
  }

  if (BLOCKED_NAME_FRAGMENTS.some((fragment) => appName.includes(fragment))) {
    return true;
  }

  return false;
}

function normalizeCategory(value: string | undefined): string {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('social')) return 'Social Media';
  if (lower.includes('stream')) return 'Streaming';
  if (lower.includes('product')) return 'Productivity';
  if (lower.includes('game')) return 'Gaming';
  if (lower.includes('educat')) return 'Education';
  if (lower.includes('commun')) return 'Communication';

  return raw || 'Other';
}

function normalizeUsageRows(data: any[]): UsageApp[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item: any) => ({
      packageName: String(item?.packageName || '').trim(),
      appName: normalizeAppName(item?.appName, item?.packageName),
      foregroundMs: Number(item?.foregroundMs || 0),
      minutesUsed: Number(item?.minutesUsed || 0),
      lastTimeUsed: item?.lastTimeUsed ? Number(item.lastTimeUsed) : undefined,
      pickups: Number(item?.pickups || 0),
      unlocks: Number(item?.unlocks || 0),
      category: normalizeCategory(item?.category),
    }))
    .filter((item: UsageApp) => !isIgnoredUsageApp(item))
    .filter(
      (item: UsageApp) =>
        !!String(item.packageName || '').trim() &&
        Number(item.minutesUsed || 0) > 0
    )
    .sort((a: UsageApp, b: UsageApp) => b.minutesUsed - a.minutesUsed);
}

export const usageTracker = {
  supported: Platform.OS === 'android' && !!UsageStatsModule,

  async isPermissionGranted(force = false): Promise<boolean> {
    try {
      if (Platform.OS !== 'android' || !UsageStatsModule) return false;

      const now = Date.now();

      if (
        !force &&
        permissionCache &&
        now - permissionCache.checkedAt < PERMISSION_CACHE_MS
      ) {
        return permissionCache.value;
      }

      const granted = await withTimeout(
        UsageStatsModule.isUsagePermissionGranted(),
        REQUEST_TIMEOUT_MS,
        'Usage permission check timed out.'
      );

      permissionCache = {
        value: granted,
        checkedAt: now,
      };

      return granted;
    } catch {
      permissionCache = {
        value: false,
        checkedAt: Date.now(),
      };
      return false;
    }
  },

  async openPermissionSettings(): Promise<boolean | void> {
    try {
      permissionCache = null;

      if (Platform.OS !== 'android' || !UsageStatsModule) {
        await Linking.openSettings();
        return;
      }

      return await UsageStatsModule.openUsageAccessSettings();
    } catch (error) {
      throw error;
    }
  },

  async getTodayUsage(force = false): Promise<UsageApp[]> {
    try {
      if (Platform.OS !== 'android' || !UsageStatsModule) return [];

      const now = Date.now();

      if (!force && usageCache && now - usageCache.checkedAt < USAGE_CACHE_MS) {
        return usageCache.value;
      }

      if (inFlightUsagePromise) {
        return inFlightUsagePromise;
      }

      inFlightUsagePromise = (async () => {
        const data = await withTimeout(
          UsageStatsModule.getTodayUsageStats(),
          REQUEST_TIMEOUT_MS,
          'Reading Android usage took too long.'
        );

        const normalized = normalizeUsageRows(data);

        usageCache = {
          value: normalized,
          checkedAt: Date.now(),
        };

        return normalized;
      })();

      try {
        return await inFlightUsagePromise;
      } finally {
        inFlightUsagePromise = null;
      }
    } catch (error) {
      throw error;
    }
  },

  clearCache() {
    permissionCache = null;
    usageCache = null;
    inFlightUsagePromise = null;
  },
};