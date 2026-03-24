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

export const usageTracker = {
  supported: Platform.OS === 'android' && !!UsageStatsModule,

  async isPermissionGranted(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android' || !UsageStatsModule) return false;
      return await UsageStatsModule.isUsagePermissionGranted();
    } catch {
      return false;
    }
  },

  async openPermissionSettings(): Promise<boolean | void> {
    try {
      if (Platform.OS !== 'android' || !UsageStatsModule) {
        await Linking.openSettings();
        return;
      }

      return await UsageStatsModule.openUsageAccessSettings();
    } catch (error) {
      throw error;
    }
  },

  async getTodayUsage(): Promise<UsageApp[]> {
    try {
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
    } catch (error) {
      throw error;
    }
  },
};