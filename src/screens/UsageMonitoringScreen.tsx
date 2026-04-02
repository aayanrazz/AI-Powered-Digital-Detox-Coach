import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {api} from '../api/api';
import type {AppLimit, UsageApp} from '../types';
import {
  refreshUsageAndRunImmediateInterventionCheck,
  type TriggeredWarning,
  type UsageSummary,
} from '../services/usageIntervention.service';
import {usageTracker} from '../native/usageTracker';

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

function mergeAppsForUi(apps: UsageApp[]) {
  const map = new Map<string, UsageApp>();

  apps.forEach(rawApp => {
    if (!rawApp?.packageName) {
      return;
    }

    const existing = map.get(rawApp.packageName);

    if (!existing) {
      map.set(rawApp.packageName, {
        ...rawApp,
        appName: rawApp.appName || rawApp.packageName,
        category: rawApp.category || 'Other',
      });
      return;
    }

    map.set(rawApp.packageName, {
      ...existing,
      appName:
        existing.appName && existing.appName !== existing.packageName
          ? existing.appName
          : rawApp.appName || existing.appName || rawApp.packageName,
      foregroundMs:
        Math.max(0, Number(existing.foregroundMs || 0)) +
        Math.max(0, Number(rawApp.foregroundMs || 0)),
      minutesUsed:
        Math.max(0, Number(existing.minutesUsed || 0)) +
        Math.max(0, Number(rawApp.minutesUsed || 0)),
      lastTimeUsed: Math.max(
        Number(existing.lastTimeUsed || 0),
        Number(rawApp.lastTimeUsed || 0),
      ),
      pickups:
        Math.max(0, Number(existing.pickups || 0)) +
        Math.max(0, Number(rawApp.pickups || 0)),
      unlocks:
        Math.max(0, Number(existing.unlocks || 0)) +
        Math.max(0, Number(rawApp.unlocks || 0)),
      category:
        existing.category && existing.category !== 'Other'
          ? existing.category
          : rawApp.category || existing.category || 'Other',
    });
  });

  return Array.from(map.values()).sort((a, b) => b.minutesUsed - a.minutesUsed);
}

const QUICK_LIMIT_OPTIONS = [30, 60, 90, 120, 180];
const REFRESH_COOLDOWN_MS = 15000;
const PERMISSION_CACHE_MS = 10000;
const REFRESH_TIMEOUT_MS = 15000;

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

export default function UsageMonitoringScreen() {
  const [apps, setApps] = useState<UsageApp[]>([]);
  const [appLimits, setAppLimits] = useState<AppLimit[]>([]);
  const [summary, setSummary] = useState<UsageSummary>({
    totalMinutes: 0,
    totalPickups: 0,
    totalUnlocks: 0,
    appCount: 0,
  });
  const [triggeredWarnings, setTriggeredWarnings] = useState<
    TriggeredWarning[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [error, setError] = useState('');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );
  const [openingPermissionSettings, setOpeningPermissionSettings] =
    useState(false);
  const [expandedEditorPackage, setExpandedEditorPackage] = useState('');
  const [limitInputValue, setLimitInputValue] = useState('');
  const [savingLimitPackage, setSavingLimitPackage] = useState('');

  const isMountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);
  const inFlightRefreshRef = useRef<Promise<unknown> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const permissionCacheRef = useRef<{
    value: boolean | null;
    checkedAt: number;
  }>({
    value: null,
    checkedAt: 0,
  });

  const appLimitMap = useMemo(() => {
    const map = new Map<string, AppLimit>();

    appLimits.forEach(limit => {
      if (limit.appPackage) {
        map.set(limit.appPackage, limit);
      }
    });

    return map;
  }, [appLimits]);

  const checkUsagePermission = useCallback(async (force = false) => {
    const now = Date.now();

    if (
      !force &&
      permissionCacheRef.current.value !== null &&
      now - permissionCacheRef.current.checkedAt < PERMISSION_CACHE_MS
    ) {
      return permissionCacheRef.current.value;
    }

    try {
      const granted = await usageTracker.isPermissionGranted();

      permissionCacheRef.current = {
        value: granted,
        checkedAt: now,
      };

      if (isMountedRef.current) {
        setPermissionGranted(granted);
      }

      return granted;
    } catch {
      permissionCacheRef.current = {
        value: false,
        checkedAt: now,
      };

      if (isMountedRef.current) {
        setPermissionGranted(false);
      }

      return false;
    }
  }, []);

  const resetUsageState = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

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

  const applyRefreshResult = useCallback(
    (result: {
      apps: UsageApp[];
      appLimits: AppLimit[];
      summary: UsageSummary;
      triggeredWarnings: TriggeredWarning[];
    }) => {
      if (!isMountedRef.current) {
        return;
      }

      setApps(mergeAppsForUi(result.apps));
      setAppLimits(result.appLimits);
      setSummary(result.summary);
      setTriggeredWarnings(result.triggeredWarnings);
      setLastUpdatedAt(new Date().toLocaleTimeString());
    },
    [],
  );

  const refreshUsageState = useCallback(
    async (showPopup: boolean) => {
      const result = await withTimeout(
        refreshUsageAndRunImmediateInterventionCheck(),
        REFRESH_TIMEOUT_MS,
        'Refreshing usage took too long. Please try again.',
      );

      applyRefreshResult(result);

      if (showPopup && result.triggeredWarnings.length > 0) {
        const firstWarning = result.triggeredWarnings[0];

        Alert.alert(
          firstWarning.level === 'limit_reached'
            ? 'Immediate Intervention Triggered'
            : 'Usage Warning Triggered',
          firstWarning.message,
        );
      }

      return result;
    },
    [applyRefreshResult],
  );

  const performRefresh = useCallback(
    async ({
      showPopup = false,
      forcePermissionCheck = false,
      showLoader = false,
    }: {
      showPopup?: boolean;
      forcePermissionCheck?: boolean;
      showLoader?: boolean;
    } = {}) => {
      if (inFlightRefreshRef.current) {
        return inFlightRefreshRef.current;
      }

      const task = (async () => {
        if (showLoader && !hasLoadedOnceRef.current && isMountedRef.current) {
          setLoading(true);
        }

        if (showPopup && isMountedRef.current) {
          setRefreshing(true);
        }

        if (isMountedRef.current) {
          setError('');
        }

        const granted = await checkUsagePermission(forcePermissionCheck);

        if (!granted) {
          resetUsageState();

          const message =
            'Usage access permission is not granted. Please tap "Grant Access" and enable usage access in Android settings.';

          if (isMountedRef.current) {
            setError(message);
            setLoading(false);
            setRefreshing(false);
          }

          if (showPopup) {
            Alert.alert('Permission Required', message);
          }

          return null;
        }

        try {
          const result = await refreshUsageState(showPopup);
          hasLoadedOnceRef.current = true;
          lastRefreshAtRef.current = Date.now();
          return result;
        } catch (err: any) {
          const message =
            err?.message || 'Failed to refresh usage and run intervention checks.';

          if (isMountedRef.current) {
            setError(message);
          }

          if (showPopup) {
            Alert.alert('Refresh Failed', message);
          }

          return null;
        } finally {
          if (isMountedRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      })();

      inFlightRefreshRef.current = task.finally(() => {
        inFlightRefreshRef.current = null;
      });

      return inFlightRefreshRef.current;
    },
    [checkUsagePermission, refreshUsageState, resetUsageState],
  );

  const loadInitial = useCallback(async () => {
    await performRefresh({
      showPopup: false,
      forcePermissionCheck: false,
      showLoader: true,
    });
  }, [performRefresh]);

  const handlePullToRefresh = useCallback(async () => {
    await performRefresh({
      showPopup: true,
      forcePermissionCheck: true,
      showLoader: false,
    });
  }, [performRefresh]);

  const handleOpenPermissionSettings = useCallback(async () => {
    try {
      setOpeningPermissionSettings(true);
      await usageTracker.openPermissionSettings();
    } catch {
      Alert.alert(
        'Unable to open settings',
        'Please open Android Settings manually and enable Usage Access for this app.',
      );
    } finally {
      setOpeningPermissionSettings(false);
    }
  }, []);

  const openLimitEditor = useCallback(
    (app: UsageApp) => {
      const currentLimit = appLimitMap.get(app.packageName)?.dailyLimitMinutes;

      setExpandedEditorPackage(prev =>
        prev === app.packageName ? '' : app.packageName,
      );
      setLimitInputValue(currentLimit ? String(currentLimit) : '');
    },
    [appLimitMap],
  );

  const saveLimitForApp = useCallback(
    async (app: UsageApp, dailyLimitMinutes: number) => {
      const safeMinutes = Math.max(
        1,
        Math.min(1440, Math.round(dailyLimitMinutes)),
      );

      try {
        setSavingLimitPackage(app.packageName);
        setError('');

        await api.saveAppLimit({
          appName: app.appName,
          appPackage: app.packageName,
          category: app.category || 'Other',
          dailyLimitMinutes: safeMinutes,
        });

        const optimisticLimit: AppLimit = {
          _id: `local-${app.packageName}`,
          appName: app.appName,
          appPackage: app.packageName,
          category: app.category || 'Other',
          dailyLimitMinutes: safeMinutes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setAppLimits(prev => {
          const filtered = prev.filter(
            item => item.appPackage !== app.packageName,
          );
          return [optimisticLimit, ...filtered];
        });

        setExpandedEditorPackage('');
        setLimitInputValue(String(safeMinutes));

        performRefresh({
          showPopup: false,
          forcePermissionCheck: false,
          showLoader: false,
        }).catch(() => {});

        Alert.alert(
          'Limit saved',
          `${app.appName} now has a ${safeMinutes}-minute daily limit.`,
        );
      } catch (err: any) {
        Alert.alert(
          'Save failed',
          err?.message || 'Unable to save this app limit right now.',
        );
      } finally {
        setSavingLimitPackage('');
      }
    },
    [performRefresh],
  );

  const handleSaveCustomLimit = useCallback(
    async (app: UsageApp) => {
      const safeMinutes = toValidLimitMinutes(limitInputValue);

      if (!safeMinutes) {
        Alert.alert(
          'Invalid limit',
          'Please enter a valid limit between 1 and 1440 minutes.',
        );
        return;
      }

      await saveLimitForApp(app, safeMinutes);
    },
    [limitInputValue, saveLimitForApp],
  );

  const handleQuickLimit = useCallback(
    async (app: UsageApp, minutes: number) => {
      setLimitInputValue(String(minutes));
      await saveLimitForApp(app, minutes);
    },
    [saveLimitForApp],
  );

  const handleRemoveLimit = useCallback(
    async (app: UsageApp) => {
      Alert.alert(
        'Remove app limit',
        `Do you want to remove the daily limit for ${app.appName}?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                setSavingLimitPackage(app.packageName);
                setError('');

                await api.deleteAppLimit(app.packageName);

                setAppLimits(prev =>
                  prev.filter(item => item.appPackage !== app.packageName),
                );

                setExpandedEditorPackage('');
                setLimitInputValue('');

                performRefresh({
                  showPopup: false,
                  forcePermissionCheck: false,
                  showLoader: false,
                }).catch(() => {});

                Alert.alert(
                  'Limit removed',
                  `${app.appName} no longer has a custom daily limit.`,
                );
              } catch (err: any) {
                Alert.alert(
                  'Remove failed',
                  err?.message || 'Unable to remove this app limit right now.',
                );
              } finally {
                setSavingLimitPackage('');
              }
            },
          },
        ],
      );
    },
    [performRefresh],
  );

  useEffect(() => {
    isMountedRef.current = true;
    loadInitial();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadInitial]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        return;
      }

      if (inFlightRefreshRef.current) {
        return;
      }

      const now = Date.now();
      const isStale = now - lastRefreshAtRef.current > REFRESH_COOLDOWN_MS;

      if (isStale) {
        performRefresh({
          showPopup: false,
          forcePermissionCheck: false,
          showLoader: false,
        }).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [performRefresh]);

  const sortedApps = useMemo(() => {
    return mergeAppsForUi(apps);
  }, [apps]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullToRefresh}
          tintColor="#ffffff"
        />
      }>
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
          activeOpacity={0.85}>
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && apps.length === 0 ? (
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
                activeOpacity={0.85}>
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

              {triggeredWarnings.map((warning, index) => (
                <View
                  key={`${warning.level}_${warning.appPackage}_${index}`}
                  style={[
                    styles.warningCard,
                    warning.level === 'limit_reached'
                      ? styles.warningCardDanger
                      : styles.warningCardSoft,
                  ]}>
                  <Text
                    style={[
                      styles.warningTitle,
                      warning.level === 'limit_reached'
                        ? styles.warningTitleDanger
                        : styles.warningTitleWarning,
                    ]}>
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
              sortedApps.map((app, index) => {
                const limit = appLimitMap.get(app.packageName);
                const limitMinutes = limit?.dailyLimitMinutes || 0;
                const progress = getProgressPercent(
                  app.minutesUsed,
                  limitMinutes,
                );
                const isNearLimit = limitMinutes > 0 && progress >= 80;
                const isOverLimit =
                  limitMinutes > 0 && app.minutesUsed >= limitMinutes;
                const isEditorOpen = expandedEditorPackage === app.packageName;
                const isSavingThisApp = savingLimitPackage === app.packageName;

                return (
                  <View
                    key={`${app.packageName}_${index}`}
                    style={styles.appCard}>
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
                      <Text style={styles.metaText}>
                        Pickups: {app.pickups || 0}
                      </Text>
                      <Text style={styles.metaText}>
                        Unlocks: {app.unlocks || 0}
                      </Text>
                      <Text style={styles.metaText}>
                        {app.category || 'Other'}
                      </Text>
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
                            ]}>
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
                              {width: `${progress}%`},
                              isOverLimit
                                ? styles.progressBarDanger
                                : isNearLimit
                                ? styles.progressBarWarning
                                : styles.progressBarSafe,
                            ]}
                          />
                        </View>

                        <Text style={styles.progressText}>
                          {app.minutesUsed}/{limitMinutes} minutes used (
                          {progress}%)
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
                        activeOpacity={0.85}>
                        <Text style={styles.secondaryActionButtonText}>
                          {limitMinutes > 0 ? 'Edit Limit' : 'Set Limit'}
                        </Text>
                      </TouchableOpacity>

                      {limitMinutes > 0 && (
                        <TouchableOpacity
                          style={styles.secondaryDangerButton}
                          onPress={() => handleRemoveLimit(app)}
                          disabled={isSavingThisApp}
                          activeOpacity={0.85}>
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
                          Keep it simple. Save a daily minute limit and the app
                          will refresh feedback immediately.
                        </Text>

                        <View style={styles.quickLimitRow}>
                          {QUICK_LIMIT_OPTIONS.map(minutes => (
                            <TouchableOpacity
                              key={`${app.packageName}_${minutes}`}
                              style={styles.quickLimitChip}
                              onPress={() => handleQuickLimit(app, minutes)}
                              disabled={isSavingThisApp}
                              activeOpacity={0.85}>
                              <Text style={styles.quickLimitChipText}>
                                {minutes}m
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TextInput
                          style={styles.limitInput}
                          value={limitInputValue}
                          onChangeText={value =>
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
                            activeOpacity={0.85}>
                            <Text style={styles.primaryEditorButtonText}>
                              {isSavingThisApp ? 'Saving...' : 'Save Limit'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.ghostEditorButton}
                            onPress={() => {
                              setExpandedEditorPackage('');
                              setLimitInputValue('');
                            }}
                            disabled={isSavingThisApp}
                            activeOpacity={0.85}>
                            <Text style={styles.ghostEditorButtonText}>
                              Cancel
                            </Text>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#94A3B8',
  },
  refreshButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loaderContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#CBD5E1',
    fontSize: 14,
  },
  permissionCard: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  permissionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  permissionText: {
    color: '#CBD5E1',
    lineHeight: 22,
    marginBottom: 14,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#3F1D2E',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorText: {
    color: '#FECACA',
    lineHeight: 22,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#141633',
    borderColor: '#2A315D',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: '1%',
  },
  summaryCardLeft: {},
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  statusCard: {
    backgroundColor: '#141633',
    borderColor: '#2A315D',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  statusTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusText: {
    color: '#CBD5E1',
    marginBottom: 8,
  },
  statusHint: {
    color: '#94A3B8',
    lineHeight: 22,
  },
  warningSection: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  warningCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  warningCardDanger: {
    backgroundColor: '#3F1D2E',
    borderColor: '#7F1D1D',
    borderWidth: 1,
  },
  warningCardSoft: {
    backgroundColor: '#2A203E',
    borderColor: '#6D28D9',
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  warningTitleDanger: {
    color: '#FCA5A5',
  },
  warningTitleWarning: {
    color: '#C4B5FD',
  },
  warningAppName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningText: {
    color: '#E2E8F0',
    lineHeight: 22,
  },
  appsSection: {
    marginBottom: 24,
  },
  emptyCard: {
    backgroundColor: '#141633',
    borderColor: '#2A315D',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  emptyText: {
    color: '#CBD5E1',
  },
  appCard: {
    backgroundColor: '#141633',
    borderColor: '#2A315D',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  appTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  appTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  appName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  appPackage: {
    color: '#64748B',
    fontSize: 13,
  },
  appMinutes: {
    color: '#C4B5FD',
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
    marginRight: 14,
    marginBottom: 6,
    fontSize: 13,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  limitText: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  limitStatus: {
    fontWeight: '800',
  },
  limitStatusSafe: {
    color: '#22C55E',
  },
  limitStatusWarning: {
    color: '#F59E0B',
  },
  limitStatusDanger: {
    color: '#F87171',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: 10,
    borderRadius: 999,
  },
  progressBarSafe: {
    backgroundColor: '#22C55E',
  },
  progressBarWarning: {
    backgroundColor: '#F59E0B',
  },
  progressBarDanger: {
    backgroundColor: '#EF4444',
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 12,
  },
  noLimitText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  secondaryActionButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    marginRight: 10,
  },
  secondaryActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryDangerButton: {
    backgroundColor: '#2B1620',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  secondaryDangerButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
  },
  editorCard: {
    marginTop: 16,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  editorTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  editorHint: {
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 12,
  },
  quickLimitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  quickLimitChip: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  quickLimitChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  limitInput: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 14,
    color: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  editorButtonRow: {
    flexDirection: 'row',
  },
  primaryEditorButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginRight: 10,
  },
  primaryEditorButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  ghostEditorButton: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  ghostEditorButtonText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
});