import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { usageTracker } from '../native/usageTracker';
import { AppLimitStatusItem, UsageApp } from '../types';
import { api } from '../api/api';
import { formatMinutes } from '../utils/helpers';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

export default function UsageMonitoringScreen({ navigation }: any) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [apps, setApps] = useState<UsageApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingPackage, setSavingPackage] = useState<string | null>(null);
  const [limitStatuses, setLimitStatuses] = useState<AppLimitStatusItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [serverTotalMinutes, setServerTotalMinutes] = useState(0);
  const [lastSyncMessage, setLastSyncMessage] = useState('');

  const limitMap = useMemo(
    () =>
      limitStatuses.reduce<Record<string, AppLimitStatusItem>>((acc, item) => {
        acc[item.appPackage] = item;
        return acc;
      }, {}),
    [limitStatuses]
  );

  const checkPermission = useCallback(async () => {
    try {
      const granted = await usageTracker.isPermissionGranted();
      setPermissionGranted(granted);
    } catch {
      setPermissionGranted(false);
    }
  }, []);

  const loadServerUsage = useCallback(async () => {
    try {
      const res = await api.getTodayUsage();
      setServerTotalMinutes(res.totalMinutes || 0);

      if (!apps.length && (res.apps || []).length) {
        setApps(res.apps.sort((a, b) => b.minutesUsed - a.minutesUsed));
      }
    } catch {
      // keep local state
    }
  }, [apps.length]);

  const refreshAll = useCallback(async () => {
    try {
      setRefreshing(true);
      await checkPermission();
      await loadServerUsage();
    } finally {
      setRefreshing(false);
    }
  }, [checkPermission, loadServerUsage]);

  useRefreshOnFocus(refreshAll);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkPermission();
        void loadServerUsage();
      }
    });

    return () => sub.remove();
  }, [checkPermission, loadServerUsage]);

  const openUsageAccess = async () => {
    try {
      await usageTracker.openPermissionSettings();

      setTimeout(() => {
        void checkPermission();
      }, 800);
    } catch (error: any) {
      Alert.alert(
        'Permission error',
        error.message || 'Could not open Android usage access settings'
      );
    }
  };

  const loadUsage = async () => {
    try {
      setLoading(true);

      const granted = await usageTracker.isPermissionGranted();
      setPermissionGranted(granted);

      if (!granted) {
        Alert.alert(
          'Usage access required',
          'Grant Android usage access first, then tap Read Today Usage again.'
        );
        return;
      }

      const result = await usageTracker.getTodayUsage();
      const sorted = result.sort((a, b) => b.minutesUsed - a.minutesUsed);
      setApps(sorted);

      if (!sorted.length) {
        Alert.alert(
          'No usage found',
          'Open a few apps on your phone or emulator, come back here, then tap Read Today Usage again.'
        );
      }
    } catch (error: any) {
      Alert.alert('Usage error', error.message || 'Could not read device usage');
    } finally {
      setLoading(false);
    }
  };

  const syncToServer = async () => {
    try {
      if (!apps.length) {
        Alert.alert('No data', 'Load usage data first.');
        return;
      }

      setSyncing(true);
      const res = await api.ingestUsage({ apps });

      const monitoredApps = res.appLimitSummary?.monitoredApps || [];
      const exceededApps = res.appLimitSummary?.exceededApps || [];
      const exceededCount = res.appLimitSummary?.exceededCount || 0;

      setLimitStatuses(monitoredApps);
      setLastSyncMessage(
        `${res.syncedCount} app records synced successfully to backend.`
      );

      await loadServerUsage();

      if (exceededCount > 0) {
        const top = exceededApps[0];

        Alert.alert(
          'Usage synced',
          `${res.syncedCount} app records synced.\n\n${exceededCount} app(s) passed their daily limit.${
            top
              ? `\n\nTop over-limit app: ${top.appName}\nExceeded by: ${top.exceededMinutes} minutes`
              : ''
          }`,
          [
            {
              text: 'Open Notifications',
              onPress: () => navigation.navigate('Notifications'),
            },
            {
              text: 'Stay Here',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          'Usage synced',
          `${res.syncedCount} app records synced successfully. No app limits were exceeded.`
        );
      }
    } catch (error: any) {
      Alert.alert('Sync failed', error.message || 'Could not sync usage data');
    } finally {
      setSyncing(false);
    }
  };

  const saveQuickLimit = async (app: UsageApp, minutes: number) => {
    try {
      setSavingPackage(app.packageName);

      await api.saveAppLimit({
        appName: app.appName || app.packageName,
        appPackage: app.packageName,
        category: app.category,
        dailyLimitMinutes: minutes,
      });

      const usedMinutes = Number(app.minutesUsed ?? 0);
      const exceededMinutes = Math.max(0, usedMinutes - minutes);
      const remainingMinutes = Math.max(0, minutes - usedMinutes);

      setLimitStatuses((prev) => {
        const next = prev.filter((item) => item.appPackage !== app.packageName);

        next.push({
          appName: app.appName || app.packageName,
          appPackage: app.packageName,
          category: app.category || 'Other',
          usedMinutes,
          dailyLimitMinutes: minutes,
          exceededMinutes,
          remainingMinutes,
          isExceeded: exceededMinutes > 0,
        });

        return next.sort((a, b) => b.usedMinutes - a.usedMinutes);
      });

      Alert.alert('Limit saved', `${minutes} minute limit saved for ${app.appName}`);
    } catch (error: any) {
      Alert.alert('Limit failed', error.message || 'Could not save app limit');
    } finally {
      setSavingPackage(null);
    }
  };

  const deviceTotalMinutes = apps.reduce(
    (sum, item) => sum + Number(item.minutesUsed || 0),
    0
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshAll}
          tintColor="#ffffff"
        />
      }
    >
      <Text style={styles.title}>Usage Monitoring</Text>
      <Text style={styles.subtitle}>
        Read Android usage stats, sync them to backend, and review app-limit behavior
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage Access Permission</Text>
        <Text style={styles.cardText}>
          {permissionGranted ? 'Granted ✅' : 'Not granted ❌'}
        </Text>

        {!permissionGranted && (
          <PrimaryButton title="Grant Usage Access" onPress={openUsageAccess} />
        )}

        <PrimaryButton
          title="Refresh Permission"
          onPress={checkPermission}
          variant="secondary"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage Sync Status</Text>
        <Text style={styles.cardText}>
          Device usage loaded: {formatMinutes(deviceTotalMinutes)}
        </Text>
        <Text style={styles.cardText}>
          Backend synced total: {formatMinutes(serverTotalMinutes)}
        </Text>

        {!!lastSyncMessage && (
          <Text style={styles.syncNote}>{lastSyncMessage}</Text>
        )}

        <PrimaryButton title="Read Today Usage" onPress={loadUsage} loading={loading} />
        <PrimaryButton
          title="Sync To Backend"
          onPress={syncToServer}
          loading={syncing}
          variant="secondary"
        />
      </View>

      <Text style={styles.sectionTitle}>Most Used Apps</Text>

      <FlatList
        data={apps}
        keyExtractor={(item, index) => `${item.packageName}-${index}`}
        renderItem={({ item }) => {
          const limitStatus = limitMap[item.packageName];

          return (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.appName}>{item.appName || item.packageName}</Text>
                <Text style={styles.packageName}>{item.packageName}</Text>
                <Text style={styles.meta}>
                  Category: {item.category || 'Other'}
                </Text>

                {limitStatus ? (
                  <>
                    <Text style={styles.limitMeta}>
                      Limit: {limitStatus.dailyLimitMinutes} min • Used:{' '}
                      {limitStatus.usedMinutes} min
                    </Text>

                    <Text
                      style={[
                        styles.limitStatus,
                        limitStatus.isExceeded ? styles.overLimit : styles.withinLimit,
                      ]}
                    >
                      {limitStatus.isExceeded
                        ? `Over limit by ${limitStatus.exceededMinutes} min`
                        : `${limitStatus.remainingMinutes} min remaining`}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.limitHint}>
                    Save a limit and sync to get intervention feedback
                  </Text>
                )}
              </View>

              <View style={styles.rightCol}>
                <Text style={styles.minutes}>{formatMinutes(item.minutesUsed)}</Text>

                <View style={styles.limitRow}>
                  <Pressable
                    style={styles.limitBtn}
                    onPress={() => saveQuickLimit(item, 30)}
                    disabled={savingPackage === item.packageName}
                  >
                    <Text style={styles.limitBtnText}>30m limit</Text>
                  </Pressable>

                  <Pressable
                    style={styles.limitBtn}
                    onPress={() => saveQuickLimit(item, 60)}
                    disabled={savingPackage === item.packageName}
                  >
                    <Text style={styles.limitBtnText}>60m limit</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No usage loaded yet</Text>}
        scrollEnabled={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  cardText: {
    color: '#CBD5E1',
    lineHeight: 20,
  },
  syncNote: {
    color: '#A5B4FC',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  item: {
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  packageName: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  meta: {
    color: '#94A3B8',
    marginTop: 6,
    fontSize: 12,
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  minutes: {
    color: '#A5B4FC',
    fontWeight: '800',
    fontSize: 16,
  },
  limitRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  limitBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  limitBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12,
  },
  limitMeta: {
    color: '#CBD5E1',
    marginTop: 8,
    fontSize: 12,
  },
  limitStatus: {
    marginTop: 6,
    fontWeight: '700',
  },
  overLimit: {
    color: '#FCA5A5',
  },
  withinLimit: {
    color: '#86EFAC',
  },
  limitHint: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 12,
  },
  empty: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 24,
  },
});