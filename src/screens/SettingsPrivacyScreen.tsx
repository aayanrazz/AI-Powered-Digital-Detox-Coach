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
import { SettingsData, ThemeMode } from '../types';
import { useAuth } from '../context/AuthContext';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { syncDetoxNotifications } from '../services/notificationSyncService';

const FOCUS_OPTIONS = [
  'Social Media',
  'Productivity',
  'Gaming',
  'Streaming',
  'Study',
  'Sleep',
];

function parseFocusAreas(input: string) {
  return input
    .split(',')
    .map((item) => item.trim())
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

function createDefaultSettings(): SettingsData {
  return {
    notificationsEnabled: true,
    aiInterventionsEnabled: true,
    privacyModeEnabled: false,
    dailyLimitMinutes: 180,
    blockDistractingApps: false,
    focusAreas: ['Social Media', 'Productivity'],
    bedTime: '23:00',
    wakeTime: '07:00',
    achievementAlerts: true,
    limitWarnings: true,
    dataCollection: true,
    anonymizeData: true,
    googleFitConnected: false,
    appleHealthConnected: false,
    theme: 'dark',
    appLimits: [],
  };
}

export default function SettingsPrivacyScreen() {
  const { logout } = useAuth();

  const [settings, setSettings] = useState<SettingsData>(createDefaultSettings());
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([
    'Social Media',
    'Productivity',
  ]);
  const [customFocusAreas, setCustomFocusAreas] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.getSettings();

      if (res?.settings) {
        const mergedSettings: SettingsData = {
          ...createDefaultSettings(),
          ...res.settings,
          focusAreas:
            Array.isArray(res.settings.focusAreas) && res.settings.focusAreas.length
              ? res.settings.focusAreas
              : ['Social Media', 'Productivity'],
          appLimits: Array.isArray(res.settings.appLimits)
            ? res.settings.appLimits
            : [],
        };

        setSettings(mergedSettings);

        const focusAreas = mergedSettings.focusAreas || [];
        setSelectedFocusAreas(
          focusAreas.filter((item) => FOCUS_OPTIONS.includes(item))
        );
        setCustomFocusAreas(
          focusAreas.filter((item) => !FOCUS_OPTIONS.includes(item)).join(', ')
        );
      }
    } catch (error: any) {
      Alert.alert('Settings error', error.message || 'Failed to load settings');
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

  const toggleFocusArea = (item: string) => {
    setSelectedFocusAreas((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const save = async () => {
    try {
      setSaving(true);

      const payload: SettingsData = {
        ...settings,
        dailyLimitMinutes: Math.max(
          60,
          Math.min(1440, Number(settings.dailyLimitMinutes || 180))
        ),
        focusAreas: finalFocusAreas,
        bedTime: normalizeTime(settings.bedTime, '23:00'),
        wakeTime: normalizeTime(settings.wakeTime, '07:00'),
        appLimits: Array.isArray(settings.appLimits) ? settings.appLimits : [],
      };

      await api.updateSettings(payload);
      await syncDetoxNotifications();

      Alert.alert(
        'Success',
        'Settings saved. Real device reminders and detox alerts have been refreshed.'
      );

      await load();
    } catch (error: any) {
      Alert.alert('Save failed', error.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

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
        Fine-tune the preferences that shape your detox plan and dashboard coaching
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notification Preferences</Text>

        <RowSwitch
          label="Daily summaries"
          value={!!settings.notificationsEnabled}
          onValueChange={(value) =>
            setSettings((prev) => ({ ...prev, notificationsEnabled: value }))
          }
        />
        <RowSwitch
          label="AI interventions"
          value={!!settings.aiInterventionsEnabled}
          onValueChange={(value) =>
            setSettings((prev) => ({ ...prev, aiInterventionsEnabled: value }))
          }
        />
        <RowSwitch
          label="Achievement alerts"
          value={!!settings.achievementAlerts}
          onValueChange={(value) =>
            setSettings((prev) => ({ ...prev, achievementAlerts: value }))
          }
        />
        <RowSwitch
          label="Limit warnings"
          value={!!settings.limitWarnings}
          onValueChange={(value) =>
            setSettings((prev) => ({ ...prev, limitWarnings: value }))
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Privacy</Text>

        <RowSwitch
          label="Anonymize data"
          value={!!settings.anonymizeData}
          onValueChange={(value) =>
            setSettings((prev) => ({
              ...prev,
              anonymizeData: value,
              privacyModeEnabled: value,
            }))
          }
        />
        <RowSwitch
          label="Allow data collection"
          value={!!settings.dataCollection}
          onValueChange={(value) =>
            setSettings((prev) => ({ ...prev, dataCollection: value }))
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Behavior Preferences</Text>

        <Text style={styles.label}>Daily Limit (minutes)</Text>
        <TextInput
          style={styles.input}
          value={String(settings.dailyLimitMinutes ?? 180)}
          onChangeText={(value) =>
            setSettings((prev) => ({
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
          {FOCUS_OPTIONS.map((item) => {
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
          onChangeText={(value) =>
            setSettings((prev) => ({ ...prev, bedTime: value }))
          }
          placeholder="23:00"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>Wake Time</Text>
        <TextInput
          style={styles.input}
          value={settings.wakeTime || '07:00'}
          onChangeText={(value) =>
            setSettings((prev) => ({ ...prev, wakeTime: value }))
          }
          placeholder="07:00"
          placeholderTextColor="#64748B"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.themeRow}>
          {(['dark', 'light', 'system'] as ThemeMode[]).map((item) => (
            <Pressable
              key={item}
              style={[
                styles.themeChip,
                settings.theme === item && styles.themeChipActive,
              ]}
              onPress={() =>
                setSettings((prev) => ({
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
      </View>

      <PrimaryButton title="Save Settings" onPress={save} loading={saving} />
      <PrimaryButton title="Logout" onPress={logout} variant="secondary" />
    </Screen>
  );
}

function RowSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowText: {
    color: '#E2E8F0',
    fontWeight: '600',
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
  },
  themeRow: {
    flexDirection: 'row',
  },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 10,
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
  },
});