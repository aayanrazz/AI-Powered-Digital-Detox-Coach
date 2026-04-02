import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/api';
import { PrivacyPolicyData, SettingsData, ThemeMode } from '../types';
import { useAuth } from '../context/AuthContext';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { syncDetoxNotifications } from '../services/notificationSyncService';
import { runLocalInterventionCheck } from '../services/interventionService';

const FOCUS_OPTIONS = [
  'Social Media',
  'Productivity',
  'Gaming',
  'Streaming',
  'Study',
  'Sleep',
] as const;

type RetentionOption = 7 | 30 | 90 | 180 | 365;

function parseFocusAreas(input: string) {
  return input
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeTime(value: string | undefined, fallback: string) {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return fallback;

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not set';
  }

  return parsed.toLocaleString();
}

function sanitizeRetentionDays(value: number | undefined): RetentionOption {
  const allowed: RetentionOption[] = [7, 30, 90, 180, 365];
  const parsed = Number(value);

  if (allowed.includes(parsed as RetentionOption)) {
    return parsed as RetentionOption;
  }

  return 30;
}

function createDefaultSettings(): SettingsData {
  return {
    notificationsEnabled: true,
    aiInterventionsEnabled: true,
    privacyModeEnabled: true,
    dailyLimitMinutes: 180,
    blockDistractingApps: false,
    focusAreas: ['Social Media', 'Productivity'],
    bedTime: '23:00',
    wakeTime: '07:00',
    achievementAlerts: true,
    limitWarnings: true,
    dataCollection: false,
    anonymizeData: true,
    allowAnalyticsForTraining: false,
    retentionDays: 30,
    consentGiven: false,
    consentVersion: 'v1.0',
    consentedAt: null,
    policyLastViewedAt: null,
    deletionRequestedAt: null,
    googleFitConnected: false,
    appleHealthConnected: false,
    theme: 'dark',
    appLimits: [],
  };
}

function createDefaultPolicy(): PrivacyPolicyData {
  return {
    version: 'v1.0',
    updatedAt: '2026-03-27',
    summary: [],
    sections: [],
    retentionOptions: [7, 30, 90, 180, 365],
    securityPractices: [],
    currentPrivacySettings: {
      dataCollection: false,
      anonymizeData: true,
      allowAnalyticsForTraining: false,
      retentionDays: 30,
      consentGiven: false,
      consentVersion: 'v1.0',
      consentedAt: null,
      policyLastViewedAt: null,
      deletionRequestedAt: null,
    },
  };
}

export default function SettingsPrivacyScreen() {
  const { logout } = useAuth();

  const [settings, setSettings] = useState<SettingsData>(createDefaultSettings());
  const [policy, setPolicy] = useState<PrivacyPolicyData>(createDefaultPolicy());
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([
    'Social Media',
    'Productivity',
  ]);
  const [customFocusAreas, setCustomFocusAreas] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [allowAnalyticsForTraining, setAllowAnalyticsForTraining] = useState(false);
  const [retentionDays, setRetentionDays] = useState<RetentionOption>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);

      const [settingsRes, policyRes] = await Promise.all([
        api.getSettings(),
        api.getPrivacyPolicy(),
      ]);

      const nextPolicy = policyRes?.policy || createDefaultPolicy();
      const currentPrivacy = nextPolicy.currentPrivacySettings || {};

      const mergedSettings: SettingsData = {
        ...createDefaultSettings(),
        ...settingsRes?.settings,
        dataCollection:
          currentPrivacy.dataCollection ??
          settingsRes?.settings?.dataCollection ??
          false,
        anonymizeData:
          currentPrivacy.anonymizeData ??
          settingsRes?.settings?.anonymizeData ??
          true,
        privacyModeEnabled:
          currentPrivacy.anonymizeData ??
          settingsRes?.settings?.privacyModeEnabled ??
          true,
        allowAnalyticsForTraining:
          currentPrivacy.allowAnalyticsForTraining ??
          settingsRes?.settings?.allowAnalyticsForTraining ??
          false,
        retentionDays:
          currentPrivacy.retentionDays ??
          settingsRes?.settings?.retentionDays ??
          30,
        consentGiven:
          currentPrivacy.consentGiven ??
          settingsRes?.settings?.consentGiven ??
          false,
        consentVersion:
          currentPrivacy.consentVersion ??
          settingsRes?.settings?.consentVersion ??
          nextPolicy.version,
        consentedAt:
          currentPrivacy.consentedAt ??
          settingsRes?.settings?.consentedAt ??
          null,
        policyLastViewedAt:
          currentPrivacy.policyLastViewedAt ??
          settingsRes?.settings?.policyLastViewedAt ??
          null,
        deletionRequestedAt:
          currentPrivacy.deletionRequestedAt ??
          settingsRes?.settings?.deletionRequestedAt ??
          null,
        focusAreas:
          Array.isArray(settingsRes?.settings?.focusAreas) &&
          settingsRes.settings.focusAreas.length
            ? settingsRes.settings.focusAreas
            : ['Social Media', 'Productivity'],
        appLimits: Array.isArray(settingsRes?.settings?.appLimits)
          ? settingsRes.settings.appLimits
          : [],
      };

      setSettings(mergedSettings);
      setPolicy(nextPolicy);

      const focusAreas = mergedSettings.focusAreas || [];
      setSelectedFocusAreas(
        focusAreas.filter(item => FOCUS_OPTIONS.includes(item as (typeof FOCUS_OPTIONS)[number]))
      );
      setCustomFocusAreas(
        focusAreas.filter(item => !FOCUS_OPTIONS.includes(item as (typeof FOCUS_OPTIONS)[number])).join(', ')
      );

      setConsentGiven(Boolean(currentPrivacy.consentGiven));
      setAllowAnalyticsForTraining(Boolean(currentPrivacy.allowAnalyticsForTraining));
      setRetentionDays(sanitizeRetentionDays(currentPrivacy.retentionDays));
    } catch (error: any) {
      Alert.alert(
        'Settings error',
        error?.message || 'Failed to load settings and privacy information'
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  const finalFocusAreas = useMemo(() => {
    const custom = parseFocusAreas(customFocusAreas);
    const merged = Array.from(
      new Set([...(selectedFocusAreas || []), ...custom])
    ).slice(0, 5);

    return merged.length ? merged : ['Social Media'];
  }, [selectedFocusAreas, customFocusAreas]);

  const privacySummaryText = useMemo(() => {
    if (!consentGiven) {
      return 'Consent not given. Server-side usage sync, data collection, and anonymized training use stay disabled.';
    }

    return `Consent active • Retention ${retentionDays} days • Collection ${
      settings.dataCollection ? 'On' : 'Off'
    } • Anonymization ${settings.anonymizeData ? 'On' : 'Off'} • Training ${
      allowAnalyticsForTraining ? 'On' : 'Off'
    }`;
  }, [
    allowAnalyticsForTraining,
    consentGiven,
    retentionDays,
    settings.anonymizeData,
    settings.dataCollection,
  ]);

  const toggleFocusArea = (item: string) => {
    setSelectedFocusAreas(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  };

  const toggleConsent = () => {
    setConsentGiven(prev => {
      const next = !prev;

      if (!next) {
        setSettings(current => ({
          ...current,
          dataCollection: false,
        }));
        setAllowAnalyticsForTraining(false);
      }

      return next;
    });
  };

  const save = async () => {
    try {
      setSaving(true);

      const safeDailyLimit = Math.max(
        60,
        Math.min(1440, Number(settings.dailyLimitMinutes || 180))
      );

      const normalizedConsent = Boolean(consentGiven);
      const normalizedDataCollection = normalizedConsent
        ? Boolean(settings.dataCollection)
        : false;
      const normalizedAnonymizeData = Boolean(settings.anonymizeData);
      const normalizedTraining = normalizedConsent
        ? Boolean(allowAnalyticsForTraining)
        : false;
      const normalizedRetentionDays = sanitizeRetentionDays(retentionDays);

      const payload: SettingsData = {
        ...settings,
        dailyLimitMinutes: safeDailyLimit,
        focusAreas: finalFocusAreas,
        bedTime: normalizeTime(settings.bedTime, '23:00'),
        wakeTime: normalizeTime(settings.wakeTime, '07:00'),
        dataCollection: normalizedDataCollection,
        anonymizeData: normalizedAnonymizeData,
        privacyModeEnabled: normalizedAnonymizeData,
        allowAnalyticsForTraining: normalizedTraining,
        retentionDays: normalizedRetentionDays,
        consentGiven: normalizedConsent,
        consentVersion: policy.version || 'v1.0',
        appLimits: Array.isArray(settings.appLimits) ? settings.appLimits : [],
      };

      await api.updateSettings(payload);

      await api.savePrivacyConsent({
        consentGiven: normalizedConsent,
        dataCollection: normalizedDataCollection,
        anonymizeData: normalizedAnonymizeData,
        allowAnalyticsForTraining: normalizedTraining,
        retentionDays: normalizedRetentionDays,
      });

      await syncDetoxNotifications();
      await runLocalInterventionCheck();

      Alert.alert(
        'Success',
        'Settings, privacy consent, retention, and reminders were saved successfully.'
      );

      await load();
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMyData = useCallback(() => {
    Alert.alert(
      'Delete my stored data',
      'This will remove stored usage sessions, app limits, and notifications from the backend. Your account will still remain active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Data',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const res = await api.deleteMyData();
              Alert.alert('Data deleted', res.message);
              await load();
            } catch (error: any) {
              Alert.alert(
                'Delete failed',
                error?.message || 'Could not delete your stored data'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [load]);

  const retentionOptions = useMemo(() => {
    const fromPolicy = Array.isArray(policy.retentionOptions)
      ? policy.retentionOptions
      : [7, 30, 90, 180, 365];

    const normalized = fromPolicy.filter(
      item => item === 7 || item === 30 || item === 90 || item === 180 || item === 365
    ) as RetentionOption[];

    return normalized.length ? normalized : [7, 30, 90, 180, 365];
  }, [policy.retentionOptions]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={load}
          tintColor="#ffffff"
        />
      }
    >
      <Text style={styles.title}>Settings & Privacy</Text>
      <Text style={styles.subtitle}>
        Fine-tune the preferences that shape your detox plan, analytics, consent,
        and privacy controls
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>

        <RowSwitch
          label="Daily summaries"
          value={!!settings.notificationsEnabled}
          onValueChange={value =>
            setSettings(prev => ({ ...prev, notificationsEnabled: value }))
          }
        />
        <RowSwitch
          label="AI interventions"
          value={!!settings.aiInterventionsEnabled}
          onValueChange={value =>
            setSettings(prev => ({ ...prev, aiInterventionsEnabled: value }))
          }
        />
        <RowSwitch
          label="Achievement alerts"
          value={!!settings.achievementAlerts}
          onValueChange={value =>
            setSettings(prev => ({ ...prev, achievementAlerts: value }))
          }
        />
        <RowSwitch
          label="Limit warnings"
          value={!!settings.limitWarnings}
          onValueChange={value =>
            setSettings(prev => ({ ...prev, limitWarnings: value }))
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Privacy & Consent</Text>

        <Text style={styles.meta}>
          Policy version: {policy.version} • Updated: {policy.updatedAt}
        </Text>
        <Text style={styles.meta}>
          Last consented at: {formatDateTime(policy.currentPrivacySettings?.consentedAt)}
        </Text>
        <Text style={styles.meta}>
          Last policy view: {formatDateTime(policy.currentPrivacySettings?.policyLastViewedAt)}
        </Text>
        <Text style={styles.meta}>
          Last data deletion request: {formatDateTime(policy.currentPrivacySettings?.deletionRequestedAt)}
        </Text>

        <Pressable style={styles.consentRow} onPress={toggleConsent}>
          <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
            {consentGiven ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.consentText}>
            I have read the privacy policy and I give explicit consent for the
            selected privacy settings.
          </Text>
        </Pressable>

        <RowSwitch
          label="Allow data collection"
          value={!!settings.dataCollection}
          disabled={!consentGiven}
          onValueChange={value =>
            setSettings(prev => ({ ...prev, dataCollection: value }))
          }
        />
        <RowSwitch
          label="Anonymize data"
          value={!!settings.anonymizeData}
          onValueChange={value =>
            setSettings(prev => ({
              ...prev,
              anonymizeData: value,
              privacyModeEnabled: value,
            }))
          }
        />
        <RowSwitch
          label="Allow anonymized dataset training"
          value={!!allowAnalyticsForTraining}
          disabled={!consentGiven}
          onValueChange={value => setAllowAnalyticsForTraining(value)}
        />

        <Text style={styles.label}>Retention Period</Text>
        <View style={styles.chipRow}>
          {retentionOptions.map(item => {
            const active = retentionDays === item;

            return (
              <Pressable
                key={String(item)}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRetentionDays(item)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item} days
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.helper}>{privacySummaryText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Privacy Policy Summary</Text>
        {(policy.summary || []).length ? (
          (policy.summary || []).map((item, index) => (
            <Text key={`summary-${index}`} style={styles.bullet}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={styles.helper}>
            Privacy summary will appear here when available from the backend policy.
          </Text>
        )}
      </View>

      {(policy.sections || []).map((section, index) => (
        <View key={`${section.title}-${index}`} style={styles.card}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item, itemIndex) => (
            <Text key={`${section.title}-${itemIndex}`} style={styles.bullet}>
              • {item}
            </Text>
          ))}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Security Practices</Text>
        {(policy.securityPractices || []).length ? (
          (policy.securityPractices || []).map((item, index) => (
            <Text key={`security-${index}`} style={styles.bullet}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={styles.helper}>
            Security practice details will appear here when provided by the backend.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Behavior Preferences</Text>

        <Text style={styles.label}>Daily Limit (minutes)</Text>
        <TextInput
          style={styles.input}
          value={String(settings.dailyLimitMinutes ?? 180)}
          onChangeText={value =>
            setSettings(prev => ({
              ...prev,
              dailyLimitMinutes: Number(value || 0),
            }))
          }
          keyboardType="numeric"
          placeholder="180"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Focus Areas</Text>
        <View style={styles.chipRow}>
          {FOCUS_OPTIONS.map(item => {
            const active = selectedFocusAreas.includes(item);

            return (
              <Pressable
                key={item}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleFocusArea(item)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={[styles.input, { marginTop: 12 }]}
          value={customFocusAreas}
          onChangeText={setCustomFocusAreas}
          placeholder="Extra focus areas (comma separated)"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.helper}>
          Applied focus areas: {finalFocusAreas.join(', ')}
        </Text>

        <Text style={styles.label}>Bed Time</Text>
        <TextInput
          style={styles.input}
          value={settings.bedTime || '23:00'}
          onChangeText={value =>
            setSettings(prev => ({ ...prev, bedTime: value }))
          }
          placeholder="23:00"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Wake Time</Text>
        <TextInput
          style={styles.input}
          value={settings.wakeTime || '07:00'}
          onChangeText={value =>
            setSettings(prev => ({ ...prev, wakeTime: value }))
          }
          placeholder="07:00"
          placeholderTextColor="#64748B"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.themeRow}>
          {(['dark', 'light', 'system'] as ThemeMode[]).map(item => (
            <Pressable
              key={item}
              style={[
                styles.themeChip,
                settings.theme === item && styles.themeChipActive,
              ]}
              onPress={() =>
                setSettings(prev => ({
                  ...prev,
                  theme: item,
                }))
              }
            >
              <Text
                style={[
                  styles.themeText,
                  settings.theme === item && styles.themeTextActive,
                ]}
              >
                {item.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preview</Text>
        <Text style={styles.previewText}>
          Dashboard goal: {settings.dailyLimitMinutes ?? 180} minutes
        </Text>
        <Text style={styles.previewText}>
          Coaching focus: {finalFocusAreas.join(', ')}
        </Text>
        <Text style={styles.previewText}>
          Sleep routine: {settings.bedTime || '23:00'} → {settings.wakeTime || '07:00'}
        </Text>
        <Text style={styles.previewText}>
          Nudges: {settings.aiInterventionsEnabled ? 'On' : 'Off'} • Summaries:{' '}
          {settings.notificationsEnabled ? 'On' : 'Off'}
        </Text>
        <Text style={styles.previewText}>
          Consent: {consentGiven ? 'Given' : 'Not Given'} • Retention: {retentionDays} days
        </Text>
        <Text style={styles.previewText}>
          Data collection: {settings.dataCollection ? 'On' : 'Off'} • Training:{' '}
          {allowAnalyticsForTraining ? 'On' : 'Off'}
        </Text>
      </View>

      <PrimaryButton title="Save Settings" onPress={save} loading={saving} />
      <View style={styles.buttonGap} />
      <PrimaryButton
        title="Delete My Stored Data"
        onPress={handleDeleteMyData}
        loading={deleting}
        variant="secondary"
      />
      <View style={styles.buttonGap} />
      <PrimaryButton title="Logout" onPress={logout} variant="secondary" />
    </Screen>
  );
}

function RowSwitch({
  label,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowText, disabled && styles.rowTextDisabled]}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
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
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 10,
  },
  meta: {
    color: '#94A3B8',
    marginBottom: 6,
  },
  bullet: {
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 6,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  consentText: {
    flex: 1,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowText: {
    color: '#E2E8F0',
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  rowTextDisabled: {
    color: '#64748B',
  },
  label: {
    color: '#E2E8F0',
    marginBottom: 10,
    fontWeight: '700',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 14,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  chipText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
  },
  helper: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 10,
    marginBottom: 8,
  },
  themeChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  themeText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 12,
  },
  themeTextActive: {
    color: '#fff',
  },
  previewText: {
    color: '#CBD5E1',
    marginBottom: 6,
    lineHeight: 20,
  },
  buttonGap: {
    height: 10,
  },
});