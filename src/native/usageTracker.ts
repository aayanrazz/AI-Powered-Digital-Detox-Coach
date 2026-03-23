import { Linking, NativeModules, Platform } from 'react-native';
import { UsageApp } from '../types';

const { UsageStatsModule } = NativeModules;

export const usageTracker = {
  supported: Platform.OS === 'android' && !!UsageStatsModule,

  async isPermissionGranted(): Promise<boolean> {
    if (Platform.OS !== 'android' || !UsageStatsModule) return false;
    return UsageStatsModule.isUsagePermissionGranted();
  },

  async openPermissionSettings() {
    if (Platform.OS !== 'android' || !UsageStatsModule) {
      Linking.openSettings();
      return;
    }

    return UsageStatsModule.openUsageAccessSettings();
  },

  async getTodayUsage(): Promise<UsageApp[]> {
    if (Platform.OS !== 'android' || !UsageStatsModule) return [];

    const data = await UsageStatsModule.getTodayUsageStats();

    if (!Array.isArray(data)) return [];

    return data
      .map((item: any) => ({
        packageName: String(item.packageName || ''),
        appName: String(item.appName || item.packageName || 'Unknown App'),
        foregroundMs: Number(item.foregroundMs || 0),
        minutesUsed: Number(item.minutesUsed || 0),
        lastTimeUsed: item.lastTimeUsed ? Number(item.lastTimeUsed) : undefined,
        pickups: Number(item.pickups || 0),
        unlocks: Number(item.unlocks || 0),
        category: String(item.category || 'Other'),
      }))
      .filter((item: UsageApp) => !!item.packageName && item.minutesUsed > 0)
      .sort((a: UsageApp, b: UsageApp) => b.minutesUsed - a.minutesUsed);
  },
};