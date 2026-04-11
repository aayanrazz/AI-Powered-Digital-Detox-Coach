import { Platform } from 'react-native';
import { api } from '../api/api';
import { usageTracker } from '../native/usageTracker';

const DASHBOARD_SYNC_COOLDOWN_MS = __DEV__ ? 60000 : 30000;

let lastDashboardSyncAt = 0;
let inFlightSync: Promise<void> | null = null;

async function isServerUsageSyncAllowed(): Promise<boolean> {
  try {
    const res = await api.getPrivacyPolicy();
    const privacy = res?.policy?.currentPrivacySettings;

    return Boolean(privacy?.consentGiven) && Boolean(privacy?.dataCollection);
  } catch {
    // Privacy-safe fallback:
    // if privacy status cannot be confirmed, do not send usage to server.
    return false;
  }
}

export async function syncTodayUsageForDashboard(
  force = false
): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  if (!usageTracker.supported) {
    return;
  }

  const now = Date.now();

  if (!force && now - lastDashboardSyncAt < DASHBOARD_SYNC_COOLDOWN_MS) {
    return;
  }

  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = (async () => {
    try {
      const granted = await usageTracker.isPermissionGranted();
      if (!granted) {
        return;
      }

      const apps = await usageTracker.getTodayUsage();
      if (!Array.isArray(apps) || apps.length === 0) {
        return;
      }

      const allowServerSync = await isServerUsageSyncAllowed();
      if (!allowServerSync) {
        return;
      }

      await api.ingestUsage({ apps });
      lastDashboardSyncAt = Date.now();
    } catch {
      // Keep dashboard loading even if native usage sync fails.
    }
  })();

  try {
    await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

export function resetDashboardUsageSyncState(): void {
  lastDashboardSyncAt = 0;
  inFlightSync = null;
}