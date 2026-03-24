import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { usageTracker } from '../native/usageTracker';
import { UsageApp } from '../types';
import { api } from '../api/api';
import { formatMinutes } from '../utils/helpers';

export default function UsageMonitoringScreen() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [apps, setApps] = useState<UsageApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingPackage, setSavingPackage] = useState<string | null>(null);

  const checkPermission = async () => {
    const granted = await usageTracker.isPermissionGranted();
    setPermissionGranted(granted);
  };

  useEffect(() => {
    checkPermission();
  }, []);

  const loadUsage = async () => {
    try {
      setLoading(true);
      const result = await usageTracker.getTodayUsage();
      setApps(result.sort((a, b) => b.minutesUsed - a.minutesUsed));
    } catch (error: any) {
      Alert.alert('Usage error', error.message || 'Could not read device usage');
    } finally {
      setLoading(false);
    }
  };

  const syncToServer = async () => {
    try {
      if (!apps.length) {
        Alert.alert('No data', 'Load usage data first');
        return;
      }

      setSyncing(true);
      await api.ingestUsage({ apps });
      Alert.alert('Success', 'Usage synced to backend successfully');
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

      Alert.alert('Limit saved', `${minutes} minute limit saved for ${app.appName}`);
    } catch (error: any) {
      Alert.alert('Limit failed', error.message || 'Could not save app limit');
    } finally {
      setSavingPackage(null);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Usage Monitoring</Text>
      <Text style={styles.subtitle}>
        Track daily app usage, sync it to backend AI, and save quick limits
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage Access Permission</Text>
        <Text style={styles.cardText}>
          {permissionGranted ? 'Granted ' : 'Not granted ❌'}
        </Text>

        {!permissionGranted && (
          <PrimaryButton
            title="Grant Usage Access"
            onPress={() => usageTracker.openPermissionSettings()}
          />
        )}

        <PrimaryButton
          title="Refresh Permission"
          onPress={checkPermission}
          variant="secondary"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Usage Collection</Text>
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
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.appName}>{item.appName || item.packageName}</Text>
              <Text style={styles.packageName}>{item.packageName}</Text>
              <Text style={styles.meta}>
                Category: {item.category || 'Other'}
              </Text>
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
        )}
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#CBD5E1',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  appName: {
    color: '#fff',
    fontWeight: '700',
  },
  packageName: {
    color: '#64748B',
    marginTop: 4,
    fontSize: 12,
  },
  meta: {
    color: '#94A3B8',
    marginTop: 6,
    fontSize: 12,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  minutes: {
    color: '#A5B4FC',
    fontWeight: '800',
    marginBottom: 10,
  },
  limitRow: {
    alignItems: 'flex-end',
  },
  limitBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  limitBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12,
  },
  empty: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 18,
  },
});