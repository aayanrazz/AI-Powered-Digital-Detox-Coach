import { Platform } from 'react-native';
import { api } from '../api/api';
import { usageTracker } from '../native/usageTracker';

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

export async function syncTodayUsageForDashboard(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    if (!usageTracker.supported) {
      return;
    }

    const granted = await usageTracker.isPermissionGranted();
    if (!granted) {
      return;
    }

    const apps = await usageTracker.getTodayUsage();
    if (!apps.length) {
      return;
    }

    const allowServerSync = await isServerUsageSyncAllowed();
    if (!allowServerSync) {
      return;
    }

    await api.ingestUsage({ apps });
  } catch {
    // Keep dashboard loading even if native usage sync fails.
  }
}