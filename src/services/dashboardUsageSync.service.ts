import { Platform } from 'react-native';
import { api } from '../api/api';
import { usageTracker } from '../native/usageTracker';

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

    await api.ingestUsage({ apps });
  } catch {
    // Keep dashboard loading even if native usage sync fails.
  }
}