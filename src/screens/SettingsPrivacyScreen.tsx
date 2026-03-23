import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
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

function parseFocusAreas(input: string) {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SettingsPrivacyScreen() {
  const { logout } = useAuth();

  const [settings, setSettings] = useState<SettingsData>({
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
  });

  const [focusAreasText, setFocusAreasText] = useState(
    'Social Media, Productivity'
  );
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.getSettings();
      if (res.settings) {
        setSettings(res.settings);
        setFocusAreasText((res.settings.focusAreas || []).join(', '));
      }
    } catch (error: any) {
      Alert.alert('Settings error', error.message || 'Failed to load settings');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      setLoading(true);

      await api.updateSettings({
        ...settings,
        focusAreas: parseFocusAreas(focusAreasText),
      });

      Alert.alert('Success', 'Settings saved');
    } catch (error: any) {
      Alert.alert('Save failed', error.message || 'Could not save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Settings & Privacy</Text>
      <Text style={styles.subtitle}>
        Control notifications, privacy, sleep targets, theme, and daily limits
      </Text>

      <View style={styles.card}>
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
        <TextInput
          style={styles.input}
          value={focusAreasText}
          onChangeText={setFocusAreasText}
          placeholder="Social Media, Productivity"
          placeholderTextColor="#64748B"
        />

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
        <Text style={styles.label}>Theme</Text>
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

      <PrimaryButton title="Save Settings" onPress={save} loading={loading} />
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
});