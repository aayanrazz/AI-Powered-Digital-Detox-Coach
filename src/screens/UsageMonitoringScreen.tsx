import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import { api } from '../api/api';
import type { AppLimit, UsageApp } from '../types';
import {
  refreshUsageAndRunImmediateInterventionCheck,
  type TriggeredWarning,
  type UsageSummary,
} from '../services/usageIntervention.service';
import { usageTracker } from '../native/usageTracker';

function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));

  if (safeMinutes < 60) {
    return `${safeMinutes} min`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

function getProgressPercent(usedMinutes: number, limitMinutes?: number) {
  if (!limitMinutes || limitMinutes <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((usedMinutes / limitMinutes) * 100));
}

function normalizeLimitInput(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function toValidLimitMinutes(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(1, Math.min(1440, Math.round(parsed)));
}

const QUICK_LIMIT_OPTIONS = [30, 60, 90, 120, 180];

export default function UsageMonitoringScreen() {
  const [apps, setApps] = useState<UsageApp[]>([]);
  const [appLimits, setAppLimits] = useState<AppLimit[]>([]);
  const [summary, setSummary] = useState<UsageSummary>({
    totalMinutes: 0,
    totalPickups: 0,
    totalUnlocks: 0,
    appCount: 0,
  });
  const [triggeredWarnings, setTriggeredWarnings] = useState<TriggeredWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [error, setError] = useState('');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [openingPermissionSettings, setOpeningPermissionSettings] = useState(false);
  const [expandedEditorPackage, setExpandedEditorPackage] = useState('');
  const [limitInputValue, setLimitInputValue] = useState('');
  const [savingLimitPackage, setSavingLimitPackage] = useState('');

  const appLimitMap = useMemo(() => {
    const map = new Map<string, AppLimit>();

    appLimits.forEach((limit) => {
      if (limit.appPackage) {
        map.set(limit.appPackage, limit);
      }
    });

    return map;
  }, [appLimits]);

  const checkUsagePermission = useCallback(async () => {
    try {
      const granted = await usageTracker.isPermissionGranted();
      setPermissionGranted(granted);
      return granted;
    } catch {
      setPermissionGranted(false);
      return false;
    }
  }, []);

  const resetUsageState = useCallback(() => {
    setApps([]);
    setAppLimits([]);
    setSummary({
      totalMinutes: 0,
      totalPickups: 0,
      totalUnlocks: 0,
      appCount: 0,
    });
    setTriggeredWarnings([]);
    setLastUpdatedAt('');
  }, []);

  const applyRefreshResult = useCallback((result: {
    apps: UsageApp[];
    appLimits: AppLimit[];
    summary: UsageSummary;
    triggeredWarnings: TriggeredWarning[];
  }) => {
    setApps(result.apps);
    setAppLimits(result.appLimits);
    setSummary(result.summary);
    setTriggeredWarnings(result.triggeredWarnings);
    setLastUpdatedAt(new Date().toLocaleTimeString());
  }, []);

  const refreshUsageState = useCallback(
    async (showPopup: boolean) => {
      const result = await refreshUsageAndRunImmediateInterventionCheck();
      applyRefreshResult(result);

      if (showPopup && result.triggeredWarnings.length > 0) {
        const firstWarning = result.triggeredWarnings[0];

        Alert.alert(
          firstWarning.level === 'limit_reached'
            ? 'Immediate Intervention Triggered'
            : 'Usage Warning Triggered',
          firstWarning.message
        );
      }

      return result;
    },
    [applyRefreshResult]
  );

  const runRefresh = useCallback(
    async (showPopup: boolean) => {
      setError('');

      const granted = await checkUsagePermission();

      if (!granted) {
        resetUsageState();
        const message =
          'Usage access permission is not granted. Please tap "Grant Access" and enable usage access in Android settings.';
        setError(message);

        if (showPopup) {
          Alert.alert('Permission Required', message);
        }

        return;
      }

      try {
        await refreshUsageState(showPopup);
      } catch (err: any) {
        const message =
          err?.message || 'Failed to refresh usage and run intervention checks.';
        setError(message);

        if (showPopup) {
          Alert.alert('Refresh Failed', message);
        }
      }
    },
    [checkUsagePermission, refreshUsageState, resetUsageState]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await runRefresh(false);
    setLoading(false);
  }, [runRefresh]);

  const handlePullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await runRefresh(true);
    setRefreshing(false);
  }, [runRefresh]);

  const handleOpenPermissionSettings = useCallback(async () => {
    try {
      setOpeningPermissionSettings(true);
      await usageTracker.openPermissionSettings();
    } catch {
      Alert.alert(
        'Unable to open settings',
        'Please open Android Settings manually and enable Usage Access for this app.'
      );
    } finally {
      setOpeningPermissionSettings(false);
    }
  }, []);

  const openLimitEditor = useCallback(
    (app: UsageApp) => {
      const currentLimit = appLimitMap.get(app.packageName)?.dailyLimitMinutes;
      setExpandedEditorPackage((prev) =>
        prev === app.packageName ? '' : app.packageName
      );
      setLimitInputValue(currentLimit ? String(currentLimit) : '');
    },
    [appLimitMap]
  );

  const saveLimitForApp = useCallback(
    async (app: UsageApp, dailyLimitMinutes: number) => {
      const safeMinutes = Math.max(1, Math.min(1440, Math.round(dailyLimitMinutes)));

      try {
        setSavingLimitPackage(app.packageName);
        setError('');

        await api.saveAppLimit({
          appName: app.appName,
          appPackage: app.packageName,
          category: app.category || 'Other',
          dailyLimitMinutes: safeMinutes,
        });

        const result = await refreshUsageState(true);
        const updatedLimit = result.appLimits.find(
          (item) => item.appPackage === app.packageName
        );

        setExpandedEditorPackage('');
        setLimitInputValue(updatedLimit ? String(updatedLimit.dailyLimitMinutes) : '');

        Alert.alert(
          'Limit saved',
          `${app.appName} now has a ${safeMinutes}-minute daily limit. Immediate feedback is active after every refresh.`
        );
      } catch (err: any) {
        Alert.alert(
          'Save failed',
          err?.message || 'Unable to save this app limit right now.'
        );
      } finally {
        setSavingLimitPackage('');
      }
    },
    [refreshUsageState]
  );

  const handleSaveCustomLimit = useCallback(
    async (app: UsageApp) => {
      const safeMinutes = toValidLimitMinutes(limitInputValue);

      if (!safeMinutes) {
        Alert.alert('Invalid limit', 'Please enter a valid limit between 1 and 1440 minutes.');
        return;
      }

      await saveLimitForApp(app, safeMinutes);
    },
    [limitInputValue, saveLimitForApp]
  );

  const handleQuickLimit = useCallback(
    async (app: UsageApp, minutes: number) => {
      setLimitInputValue(String(minutes));
      await saveLimitForApp(app, minutes);
    },
    [saveLimitForApp]
  );

  const handleRemoveLimit = useCallback(
    async (app: UsageApp) => {
      Alert.alert(
        'Remove app limit',
        `Do you want to remove the daily limit for ${app.appName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                setSavingLimitPackage(app.packageName);
                setError('');
                await api.deleteAppLimit(app.packageName);
                await refreshUsageState(false);
                setExpandedEditorPackage('');
                setLimitInputValue('');
                Alert.alert(
                  'Limit removed',
                  `${app.appName} no longer has a custom daily limit.`
                );
              } catch (err: any) {
                Alert.alert(
                  'Remove failed',
                  err?.message || 'Unable to remove this app limit right now.'
                );
              } finally {
                setSavingLimitPackage('');
              }
            },
          },
        ]
      );
    },
    [refreshUsageState]
  );

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextState => {
      if (nextState === 'active') {
        const granted = await checkUsagePermission();

        if (granted) {
          await runRefresh(false);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkUsagePermission, runRefresh]);

  const sortedApps = useMemo(() => {
    return [...apps].sort((a, b) => b.minutesUsed - a.minutesUsed);
  }, [apps]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullToRefresh}
          tintColor="#ffffff"
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Usage Monitoring</Text>
          <Text style={styles.subtitle}>
            Refresh usage to trigger real-time intervention checks instantly.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handlePullToRefresh}
          disabled={refreshing || loading}
          activeOpacity={0.85}
        >
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#A78BFA" />
          <Text style={styles.loaderText}>
            Loading latest usage and intervention status...
          </Text>
        </View>
      ) : (
        <>
          {permissionGranted === false && (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Usage access required</Text>
              <Text style={styles.permissionText}>
                Android does not grant this automatically. Please open Usage
                Access settings and allow this app to read app usage.
              </Text>

              <TouchableOpacity
                style={styles.permissionButton}
                onPress={handleOpenPermissionSettings}
                disabled={openingPermissionSettings}
                activeOpacity={0.85}
              >
                <Text style={styles.permissionButtonText}>
                  {openingPermissionSettings ? 'Opening...' : 'Grant Access'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!!error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Refresh error</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.summaryCardLeft]}>
              <Text style={styles.summaryLabel}>Total Screen Time</Text>
              <Text style={styles.summaryValue}>
                {formatMinutes(summary.totalMinutes)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Pickups</Text>
              <Text style={styles.summaryValue}>{summary.totalPickups}</Text>
            </View>

            <View style={[styles.summaryCard, styles.summaryCardLeft]}>
              <Text style={styles.summaryLabel}>Unlocks</Text>
              <Text style={styles.summaryValue}>{summary.totalUnlocks}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Tracked Apps</Text>
              <Text style={styles.summaryValue}>{summary.appCount}</Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Live intervention status</Text>
            <Text style={styles.statusText}>
              Latest refresh: {lastUpdatedAt || 'Not refreshed yet'}
            </Text>
            <Text style={styles.statusHint}>
              Every refresh now checks app limits immediately and sends Android
              warnings when needed.
            </Text>
          </View>

          {triggeredWarnings.length > 0 && (
            <View style={styles.warningSection}>
              <Text style={styles.sectionTitle}>Triggered right now</Text>

              {triggeredWarnings.map((warning) => (
                <View
                  key={`${warning.level}_${warning.appPackage}`}
                  style={[
                    styles.warningCard,
                    warning.level === 'limit_reached'
                      ? styles.warningCardDanger
                      : styles.warningCardSoft,
                  ]}
                >
                  <Text
                    style={[
                      styles.warningTitle,
                      warning.level === 'limit_reached'
                        ? styles.warningTitleDanger
                        : styles.warningTitleWarning,
                    ]}
                  >
                    {warning.level === 'limit_reached'
                      ? 'Limit reached'
                      : 'Approaching limit'}
                  </Text>

                  <Text style={styles.warningAppName}>{warning.appName}</Text>
                  <Text style={styles.warningText}>{warning.message}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.appsSection}>
            <Text style={styles.sectionTitle}>Today&apos;s app usage</Text>

            {sortedApps.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No usage data found yet for today.
                </Text>
              </View>
            ) : (
              sortedApps.map((app) => {
                const limit = appLimitMap.get(app.packageName);
                const limitMinutes = limit?.dailyLimitMinutes || 0;
                const progress = getProgressPercent(app.minutesUsed, limitMinutes);
                const isNearLimit = limitMinutes > 0 && progress >= 80;
                const isOverLimit =
                  limitMinutes > 0 && app.minutesUsed >= limitMinutes;
                const isEditorOpen = expandedEditorPackage === app.packageName;
                const isSavingThisApp = savingLimitPackage === app.packageName;

                return (
                  <View key={app.packageName} style={styles.appCard}>
                    <View style={styles.appTopRow}>
                      <View style={styles.appTitleWrap}>
                        <Text style={styles.appName}>{app.appName}</Text>
                        <Text style={styles.appPackage}>{app.packageName}</Text>
                      </View>

                      <Text style={styles.appMinutes}>
                        {formatMinutes(app.minutesUsed)}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>Pickups: {app.pickups || 0}</Text>
                      <Text style={styles.metaText}>Unlocks: {app.unlocks || 0}</Text>
                      <Text style={styles.metaText}>{app.category || 'Other'}</Text>
                    </View>

                    {limitMinutes > 0 ? (
                      <>
                        <View style={styles.limitRow}>
                          <Text style={styles.limitText}>
                            Limit: {formatMinutes(limitMinutes)}
                          </Text>

                          <Text
                            style={[
                              styles.limitStatus,
                              isOverLimit
                                ? styles.limitStatusDanger
                                : isNearLimit
                                ? styles.limitStatusWarning
                                : styles.limitStatusSafe,
                            ]}
                          >
                            {isOverLimit
                              ? 'Over limit'
                              : isNearLimit
                              ? 'Near limit'
                              : 'Within limit'}
                          </Text>
                        </View>

                        <View style={styles.progressBarBackground}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${progress}%` },
                              isOverLimit
                                ? styles.progressBarDanger
                                : isNearLimit
                                ? styles.progressBarWarning
                                : styles.progressBarSafe,
                            ]}
                          />
                        </View>

                        <Text style={styles.progressText}>
                          {app.minutesUsed}/{limitMinutes} minutes used ({progress}%)
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.noLimitText}>
                        No daily limit configured for this app yet.
                      </Text>
                    )}

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.secondaryActionButton}
                        onPress={() => openLimitEditor(app)}
                        disabled={isSavingThisApp}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.secondaryActionButtonText}>
                          {limitMinutes > 0 ? 'Edit Limit' : 'Set Limit'}
                        </Text>
                      </TouchableOpacity>

                      {limitMinutes > 0 && (
                        <TouchableOpacity
                          style={styles.secondaryDangerButton}
                          onPress={() => handleRemoveLimit(app)}
                          disabled={isSavingThisApp}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.secondaryDangerButtonText}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isEditorOpen && (
                      <View style={styles.editorCard}>
                        <Text style={styles.editorTitle}>
                          Set daily limit for {app.appName}
                        </Text>
                        <Text style={styles.editorHint}>
                          Keep it simple. Save a daily minute limit and the app will
                          refresh feedback immediately.
                        </Text>

                        <View style={styles.quickLimitRow}>
                          {QUICK_LIMIT_OPTIONS.map((minutes) => (
                            <TouchableOpacity
                              key={`${app.packageName}_${minutes}`}
                              style={styles.quickLimitChip}
                              onPress={() => handleQuickLimit(app, minutes)}
                              disabled={isSavingThisApp}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.quickLimitChipText}>
                                {minutes}m
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TextInput
                          style={styles.limitInput}
                          value={limitInputValue}
                          onChangeText={(value) =>
                            setLimitInputValue(normalizeLimitInput(value))
                          }
                          keyboardType="numeric"
                          placeholder="Enter limit in minutes"
                          placeholderTextColor="#64748B"
                        />

                        <View style={styles.editorButtonRow}>
                          <TouchableOpacity
                            style={styles.primaryEditorButton}
                            onPress={() => handleSaveCustomLimit(app)}
                            disabled={isSavingThisApp}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.primaryEditorButtonText}>
                              {isSavingThisApp ? 'Saving...' : 'Save Limit'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cancelEditorButton}
                            onPress={() => {
                              setExpandedEditorPackage('');
                              setLimitInputValue('');
                            }}
                            disabled={isSavingThisApp}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.cancelEditorButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loaderContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
  },
  permissionCard: {
    backgroundColor: '#172554',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2563EB',
    marginBottom: 14,
  },
  permissionTitle: {
    color: '#BFDBFE',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  permissionText: {
    color: '#DBEAFE',
    lineHeight: 20,
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  errorCard: {
    backgroundColor: '#3F1D24',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    marginBottom: 14,
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorText: {
    color: '#FECACA',
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  summaryCardLeft: {
    marginRight: '4%',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  statusCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusText: {
    color: '#CBD5E1',
    marginBottom: 6,
  },
  statusHint: {
    color: '#94A3B8',
    lineHeight: 20,
  },
  warningSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  warningCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  warningCardDanger: {
    backgroundColor: '#3F1D24',
    borderColor: '#7F1D1D',
  },
  warningCardSoft: {
    backgroundColor: '#3A2A12',
    borderColor: '#92400E',
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  warningTitleDanger: {
    color: '#FCA5A5',
  },
  warningTitleWarning: {
    color: '#FCD34D',
  },
  warningAppName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  warningText: {
    color: '#CBD5E1',
    lineHeight: 20,
  },
  appsSection: {
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  appCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  appTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  appTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  appPackage: {
    color: '#64748B',
    fontSize: 12,
  },
  appMinutes: {
    color: '#A78BFA',
    fontSize: 16,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 12,
    marginRight: 12,
    marginBottom: 4,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  limitText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  limitStatus: {
    fontSize: 12,
    fontWeight: '800',
  },
  limitStatusDanger: {
    color: '#FCA5A5',
  },
  limitStatusWarning: {
    color: '#FCD34D',
  },
  limitStatusSafe: {
    color: '#86EFAC',
  },
  progressBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressBarDanger: {
    backgroundColor: '#EF4444',
  },
  progressBarWarning: {
    backgroundColor: '#F59E0B',
  },
  progressBarSafe: {
    backgroundColor: '#22C55E',
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  noLimitText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  secondaryActionButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  secondaryActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryDangerButton: {
    backgroundColor: '#3F1D24',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  secondaryDangerButtonText: {
    color: '#FCA5A5',
    fontWeight: '800',
    fontSize: 13,
  },
  editorCard: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  editorTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  editorHint: {
    color: '#94A3B8',
    lineHeight: 19,
    marginBottom: 12,
  },
  quickLimitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  quickLimitChip: {
    backgroundColor: '#1E293B',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  quickLimitChipText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12,
  },
  limitInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  editorButtonRow: {
    flexDirection: 'row',
  },
  primaryEditorButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  primaryEditorButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cancelEditorButton: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  cancelEditorButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
});