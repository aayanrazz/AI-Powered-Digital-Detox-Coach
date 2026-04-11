import { Linking, NativeModules, Platform } from 'react-native';
import { UsageApp } from '../types';

type UsageStatsModuleType = {
  isUsagePermissionGranted: () => Promise<boolean>;
  openUsageAccessSettings: () => Promise<boolean>;
  getTodayUsageStats: () => Promise<unknown[]>;
};

type CacheEntry<T> = {
  value: T;
  checkedAt: number;
};

const UsageStatsModule = NativeModules.UsageStatsModule as
  | UsageStatsModuleType
  | undefined;

const PERMISSION_CACHE_MS = __DEV__ ? 15000 : 8000;
const USAGE_CACHE_MS = __DEV__ ? 30000 : 12000;
const FAILURE_CACHE_MS = __DEV__ ? 12000 : 6000;
const REQUEST_TIMEOUT_MS = __DEV__ ? 5000 : 7000;

const OWN_APP_PACKAGES = new Set([
  'com.detoxcoachmobile',
  'com.detoxcoach',
]);

const BLOCKED_PACKAGE_EXACT = new Set([
  'android',
  ...Array.from(OWN_APP_PACKAGES),
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
  'com.google.android.settings.intelligence',
  'com.google.android.documentsui',
  'com.android.documentsui',
  'com.android.packageinstaller',
  'com.google.android.packageinstaller',
]);

const BLOCKED_PACKAGE_PREFIXES = [
  'com.android.systemui',
  'com.android.permissioncontroller',
  'com.google.android.permissioncontroller',
  'com.google.android.overlay.modules.permissioncontroller',
  'com.android.providers.',
  'com.google.android.overlay.modules.',
];

const BLOCKED_PACKAGE_FRAGMENTS = [
  'settings.intelligence',
  'documentsui',
  'packageinstaller',
  'permissioncontroller',
];

const BLOCKED_NAME_FRAGMENTS = [
  'launcher',
  'pixel launcher',
  'system ui',
  'permission controller',
  'settings intelligence',
  'document ui',
  'documentsui',
  'package installer',
];

const READABLE_TOKEN_MAP: Record<string, string> = {
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  gmail: 'Gmail',
  instagram: 'Instagram',
  facebook: 'Facebook',
  messenger: 'Messenger',
  tiktok: 'TikTok',
  spotify: 'Spotify',
  netflix: 'Netflix',
  chrome: 'Chrome',
  telegram: 'Telegram',
  snapchat: 'Snapchat',
};

const IGNORED_PACKAGE_TOKENS = new Set([
  'com',
  'org',
  'net',
  'android',
  'google',
  'apps',
  'app',
  'mobile',
]);

let permissionCache: CacheEntry<boolean> | null = null;
let usageCache: CacheEntry<UsageApp[]> | null = null;
let inFlightUsagePromise: Promise<UsageApp[]> | null = null;
let lastNativeFailureAt = 0;

function isAndroidUsageSupported(): boolean {
  return Platform.OS === 'android' && !!UsageStatsModule;
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

function normalizePackageName(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

function capitalizeToken(token: string): string {
  if (!token) {
    return '';
  }

  return token.charAt(0).toUpperCase() + token.slice(1);
}

function buildReadableAppNameFromPackage(packageName?: string): string {
  const normalized = normalizePackageName(packageName);

  if (!normalized) {
    return 'Unknown App';
  }

  const tokens = normalized
    .split('.')
    .flatMap(part => part.split(/[_-]/g))
    .map(part => part.trim())
    .filter(part => part.length > 0 && !IGNORED_PACKAGE_TOKENS.has(part));

  const meaningfulTokens = tokens.length >= 2 ? tokens.slice(-2) : tokens;

  const readable = meaningfulTokens
    .map(token => READABLE_TOKEN_MAP[token] || capitalizeToken(token))
    .join(' ')
    .trim();

  return readable || packageName || 'Unknown App';
}

function isProbablyPackageLabel(appName?: string, packageName?: string): boolean {
  const normalizedName = normalizePackageName(appName);
  const normalizedPackage = normalizePackageName(packageName);

  if (!normalizedName) {
    return true;
  }

  if (normalizedName === normalizedPackage) {
    return true;
  }

  return /^[a-z0-9_.]+$/.test(normalizedName) && normalizedName.includes('.');
}

function normalizeAppName(value?: string, fallbackPackage?: string): string {
  const raw = String(value || '').trim();

  if (!raw) {
    return buildReadableAppNameFromPackage(fallbackPackage);
  }

  if (isProbablyPackageLabel(raw, fallbackPackage)) {
    return buildReadableAppNameFromPackage(fallbackPackage);
  }

  return raw;
}

function isIgnoredUsageApp(item: {
  packageName?: string;
  appName?: string;
}): boolean {
  const packageName = normalizePackageName(item?.packageName);
  const appName = String(item?.appName || '').trim().toLowerCase();

  if (!packageName) {
    return true;
  }

  if (BLOCKED_PACKAGE_EXACT.has(packageName)) {
    return true;
  }

  if (BLOCKED_PACKAGE_PREFIXES.some(prefix => packageName.startsWith(prefix))) {
    return true;
  }

  if (BLOCKED_PACKAGE_FRAGMENTS.some(fragment => packageName.includes(fragment))) {
    return true;
  }

  if (BLOCKED_NAME_FRAGMENTS.some(fragment => appName.includes(fragment))) {
    return true;
  }

  return false;
}

function normalizeCategory(value?: string): string {
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

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toUsageApp(item: any): UsageApp {
  const packageName = String(item?.packageName || '').trim();

  return {
    packageName,
    appName: normalizeAppName(item?.appName, packageName),
    foregroundMs: Math.max(0, toSafeNumber(item?.foregroundMs, 0)),
    minutesUsed: Math.max(0, toSafeNumber(item?.minutesUsed, 0)),
    lastTimeUsed:
      item?.lastTimeUsed !== undefined && item?.lastTimeUsed !== null
        ? Math.max(0, toSafeNumber(item?.lastTimeUsed, 0))
        : undefined,
    pickups: Math.max(0, toSafeNumber(item?.pickups, 0)),
    unlocks: Math.max(0, toSafeNumber(item?.unlocks, 0)),
    category: normalizeCategory(item?.category),
  };
}

function pickPreferredText(primary?: string, secondary?: string): string {
  const a = String(primary || '').trim();
  const b = String(secondary || '').trim();

  if (!a) return b;
  if (!b) return a;

  return a.length >= b.length ? a : b;
}

function mergeUsageRows(existing: UsageApp, incoming: UsageApp): UsageApp {
  return {
    packageName: existing.packageName || incoming.packageName,
    appName: pickPreferredText(existing.appName, incoming.appName),
    foregroundMs: Math.max(existing.foregroundMs || 0, incoming.foregroundMs || 0),
    minutesUsed: Math.max(existing.minutesUsed || 0, incoming.minutesUsed || 0),
    lastTimeUsed: Math.max(existing.lastTimeUsed || 0, incoming.lastTimeUsed || 0),
    pickups: Math.max(existing.pickups || 0, incoming.pickups || 0),
    unlocks: Math.max(existing.unlocks || 0, incoming.unlocks || 0),
    category:
      existing.category && existing.category !== 'Other'
        ? existing.category
        : incoming.category,
  };
}

function normalizeUsageRows(data: unknown[]): UsageApp[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const cleaned = data
    .map(item => toUsageApp(item))
    .filter(item => !isIgnoredUsageApp(item))
    .filter(
      item =>
        !!String(item.packageName || '').trim() &&
        Number(item.minutesUsed || 0) > 0,
    );

  const byPackage = new Map<string, UsageApp>();

  for (const item of cleaned) {
    const key = normalizePackageName(item.packageName);
    const existing = byPackage.get(key);

    if (!existing) {
      byPackage.set(key, item);
      continue;
    }

    byPackage.set(key, mergeUsageRows(existing, item));
  }

  return Array.from(byPackage.values()).sort(
    (a, b) => (b.minutesUsed || 0) - (a.minutesUsed || 0),
  );
}

export const usageTracker = {
  supported: isAndroidUsageSupported(),

  async isPermissionGranted(force = false): Promise<boolean> {
    try {
      if (!isAndroidUsageSupported() || !UsageStatsModule) {
        return false;
      }

      const now = Date.now();

      if (
        !force &&
        permissionCache &&
        now - permissionCache.checkedAt < PERMISSION_CACHE_MS
      ) {
        return permissionCache.value;
      }

      const granted = await withTimeout<boolean>(
        UsageStatsModule.isUsagePermissionGranted(),
        REQUEST_TIMEOUT_MS,
        'Usage permission check timed out.',
      );

      permissionCache = {
        value: granted,
        checkedAt: Date.now(),
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
    permissionCache = null;

    try {
      if (!isAndroidUsageSupported() || !UsageStatsModule) {
        return Linking.openSettings();
      }

      return await withTimeout<boolean>(
        UsageStatsModule.openUsageAccessSettings(),
        REQUEST_TIMEOUT_MS,
        'Opening usage access settings timed out.',
      );
    } catch {
      return false;
    }
  },

  async getTodayUsage(force = false): Promise<UsageApp[]> {
    if (!isAndroidUsageSupported() || !UsageStatsModule) {
      return [];
    }

    const now = Date.now();

    if (!force && usageCache && now - usageCache.checkedAt < USAGE_CACHE_MS) {
      return usageCache.value;
    }

    if (
      !force &&
      lastNativeFailureAt > 0 &&
      now - lastNativeFailureAt < FAILURE_CACHE_MS
    ) {
      return usageCache?.value ?? [];
    }

    if (inFlightUsagePromise) {
      return inFlightUsagePromise;
    }

    inFlightUsagePromise = (async () => {
      try {
        const data = await withTimeout<unknown[]>(
          UsageStatsModule.getTodayUsageStats(),
          REQUEST_TIMEOUT_MS,
          'Reading Android usage took too long.',
        );

        const normalized = normalizeUsageRows(data);

        usageCache = {
          value: normalized,
          checkedAt: Date.now(),
        };

        lastNativeFailureAt = 0;

        return normalized;
      } catch {
        lastNativeFailureAt = Date.now();

        const fallback = usageCache?.value ?? [];

        usageCache = {
          value: fallback,
          checkedAt: Date.now(),
        };

        return fallback;
      }
    })();

    try {
      return await inFlightUsagePromise;
    } finally {
      inFlightUsagePromise = null;
    }
  },

  clearCache(): void {
    permissionCache = null;
    usageCache = null;
    inFlightUsagePromise = null;
    lastNativeFailureAt = 0;
  },
};