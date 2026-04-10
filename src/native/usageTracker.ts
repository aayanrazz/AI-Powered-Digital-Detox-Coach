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

function capitalizeToken(token: string): string {
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function buildReadableAppNameFromPackage(packageName?: string): string {
  const normalized = normalizePackageName(packageName);

  if (!normalized) {
    return 'Unknown App';
  }

  const tokens = normalized
    .split('.')
    .flatMap((part) => part.split(/[_-]/g))
    .map((part) => part.trim())
    .filter(
      (part) => part.length > 0 && !IGNORED_PACKAGE_TOKENS.has(part)
    );

  const meaningfulTokens =
    tokens.length >= 2 ? tokens.slice(-2) : tokens;

  const readable = meaningfulTokens
    .map((token) => READABLE_TOKEN_MAP[token] || capitalizeToken(token))
    .join(' ')
    .trim();

  return readable || packageName || 'Unknown App';
}

function isProbablyPackageLabel(appName?: string, packageName?: string): boolean {
  const normalizedName = normalizePackageName(appName);
  const normalizedPackage = normalizePackageName(packageName);

  if (!normalizedName) return true;
  if (normalizedName === normalizedPackage) return true;

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

  if (!packageName) return true;
  if (BLOCKED_PACKAGE_EXACT.has(packageName)) return true;

  if (BLOCKED_PACKAGE_PREFIXES.some((prefix) => packageName.startsWith(prefix))) {
    return true;
  }

  if (BLOCKED_PACKAGE_FRAGMENTS.some((fragment) => packageName.includes(fragment))) {
    return true;
  }

  if (BLOCKED_NAME_FRAGMENTS.some((fragment) => appName.includes(fragment))) {
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

function normalizeUsageRows(data: any[]): UsageApp[] {
  if (!Array.isArray(data)) return [];

  const cleaned = data
    .map((item: any): UsageApp => {
      const packageName = String(item?.packageName || '').trim();
      const appName = normalizeAppName(item?.appName, packageName);

      return {
        packageName,
        appName,
        foregroundMs: toSafeNumber(item?.foregroundMs, 0),
        minutesUsed: toSafeNumber(item?.minutesUsed, 0),
        lastTimeUsed:
          item?.lastTimeUsed !== undefined && item?.lastTimeUsed !== null
            ? toSafeNumber(item.lastTimeUsed, 0)
            : undefined,
        pickups: toSafeNumber(item?.pickups, 0),
        unlocks: toSafeNumber(item?.unlocks, 0),
        category: normalizeCategory(item?.category),
      };
    })
    .filter((item: UsageApp) => !isIgnoredUsageApp(item))
    .filter(
      (item: UsageApp) =>
        !!String(item.packageName || '').trim() &&
        Number(item.minutesUsed || 0) > 0
    );

  const byPackage = new Map<string, UsageApp>();

  for (const item of cleaned) {
    const key = normalizePackageName(item.packageName);
    const existing = byPackage.get(key);

    if (!existing) {
      byPackage.set(key, item);
      continue;
    }

    if ((item.minutesUsed || 0) > (existing.minutesUsed || 0)) {
      byPackage.set(key, item);
    }
  }

  return Array.from(byPackage.values()).sort(
    (a: UsageApp, b: UsageApp) => b.minutesUsed - a.minutesUsed
  );
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

      const granted = await withTimeout<boolean>(
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
    permissionCache = null;

    if (Platform.OS !== 'android' || !UsageStatsModule) {
      return Linking.openSettings();
    }

    return withTimeout<boolean>(
      UsageStatsModule.openUsageAccessSettings(),
      REQUEST_TIMEOUT_MS,
      'Opening usage access settings timed out.'
    );
  },

  async getTodayUsage(force = false): Promise<UsageApp[]> {
    if (Platform.OS !== 'android' || !UsageStatsModule) return [];

    const now = Date.now();

    if (!force && usageCache && now - usageCache.checkedAt < USAGE_CACHE_MS) {
      return usageCache.value;
    }

    if (inFlightUsagePromise) {
      return inFlightUsagePromise;
    }

    inFlightUsagePromise = (async () => {
      const data = await withTimeout<any[]>(
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
  },

  clearCache() {
    permissionCache = null;
    usageCache = null;
    inFlightUsagePromise = null;
  },
};