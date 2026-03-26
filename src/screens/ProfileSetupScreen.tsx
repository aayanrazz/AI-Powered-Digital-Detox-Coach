import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
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

function normalizeTime(value: string, fallback: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return fallback;

  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function ProfileSetupScreen() {
  const { refreshUser, user } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '20');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [goal, setGoal] = useState(
    user?.goal || 'Reduce social media distraction'
  );
  const [dailyLimitMinutes, setDailyLimitMinutes] = useState('180');
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([
    'Social Media',
    'Productivity',
  ]);
  const [customFocusAreas, setCustomFocusAreas] = useState('');
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [gentleNudges, setGentleNudges] = useState(true);
  const [dailySummaries, setDailySummaries] = useState(true);
  const [achievementAlerts, setAchievementAlerts] = useState(true);
  const [limitWarnings, setLimitWarnings] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const res = await api.getSettings();

        if (res?.settings) {
          setDailyLimitMinutes(String(res.settings.dailyLimitMinutes ?? 180));
          setSelectedFocusAreas(
            (res.settings.focusAreas && res.settings.focusAreas.length
              ? res.settings.focusAreas
              : ['Social Media', 'Productivity']
            ).filter((item) => FOCUS_OPTIONS.includes(item))
          );
          setCustomFocusAreas(
            (res.settings.focusAreas || [])
              .filter((item) => !FOCUS_OPTIONS.includes(item))
              .join(', ')
          );
          setBedTime(res.settings.bedTime || '23:00');
          setWakeTime(res.settings.wakeTime || '07:00');
          setGentleNudges(res.settings.aiInterventionsEnabled ?? true);
          setDailySummaries(res.settings.notificationsEnabled ?? true);
          setAchievementAlerts(res.settings.achievementAlerts ?? true);
          setLimitWarnings(res.settings.limitWarnings ?? true);
        }
      } catch {
        // keep defaults
      }
    };

    loadDefaults();
  }, []);

  const finalFocusAreas = useMemo(() => {
    const custom = parseFocusAreas(customFocusAreas);
    return Array.from(new Set([...selectedFocusAreas, ...custom])).slice(0, 5);
  }, [selectedFocusAreas, customFocusAreas]);

  const toggleFocusArea = (item: string) => {
    setSelectedFocusAreas((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const onSave = async () => {
    try {
      const normalizedDailyLimit = Math.max(
        60,
        Math.min(1440, Number(dailyLimitMinutes || 180))
      );

      if (!name.trim()) {
        Alert.alert('Validation', 'Please enter your display name.');
        return;
      }

      if (!goal.trim()) {
        Alert.alert('Validation', 'Please enter your main detox goal.');
        return;
      }

      if (!finalFocusAreas.length) {
        Alert.alert('Validation', 'Select at least one focus area.');
        return;
      }

      setLoading(true);

      await api.completeProfileSetup({
        name: name.trim(),
        age: Number(age),
        occupation: occupation.trim(),
        goal: goal.trim(),
        dailyLimitMinutes: normalizedDailyLimit,
        focusAreas: finalFocusAreas,
        bedTime: normalizeTime(bedTime, '23:00'),
        wakeTime: normalizeTime(wakeTime, '07:00'),
        notificationSettings: {
          gentleNudges,
          dailySummaries,
          achievementAlerts,
          limitWarnings,
        },
      });

      await refreshUser();
      await syncDetoxNotifications();

      Alert.alert(
        'Success',
        'Profile setup completed. Your plan, dashboard, and real device reminders now use your selected goals, focus areas, sleep schedule, and notification preferences.'
      );
    } catch (error: any) {
      Alert.alert('Profile setup failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Complete Profile Setup</Text>
      <Text style={styles.subtitle}>
        Personalize your detox coach so plans and dashboard advice match your real routine
      </Text>

      <TextInput
        placeholder="Display name"
        placeholderTextColor="#64748B"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Age"
        placeholderTextColor="#64748B"
        style={styles.input}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Occupation"
        placeholderTextColor="#64748B"
        style={styles.input}
        value={occupation}
        onChangeText={setOccupation}
      />

      <TextInput
        placeholder="Main detox goal"
        placeholderTextColor="#64748B"
        style={styles.input}
        value={goal}
        onChangeText={setGoal}
      />

      <TextInput
        placeholder="Daily limit minutes"
        placeholderTextColor="#64748B"
        style={styles.input}
        value={dailyLimitMinutes}
        onChangeText={setDailyLimitMinutes}
        keyboardType="numeric"
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Focus Areas</Text>
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
          placeholder="Extra focus areas (comma separated)"
          placeholderTextColor="#64748B"
          style={[styles.input, { marginTop: 12, marginBottom: 0 }]}
          value={customFocusAreas}
          onChangeText={setCustomFocusAreas}
        />

        <Text style={styles.helper}>
          Selected: {finalFocusAreas.length ? finalFocusAreas.join(', ') : 'None'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Bed time</Text>
          <TextInput
            placeholder="23:00"
            placeholderTextColor="#64748B"
            style={styles.input}
            value={bedTime}
            onChangeText={setBedTime}
          />
        </View>

        <View style={{ width: 12 }} />

        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Wake time</Text>
          <TextInput
            placeholder="07:00"
            placeholderTextColor="#64748B"
            style={styles.input}
            value={wakeTime}
            onChangeText={setWakeTime}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notification Preferences</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Gentle nudges</Text>
          <Switch value={gentleNudges} onValueChange={setGentleNudges} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Daily summaries</Text>
          <Switch value={dailySummaries} onValueChange={setDailySummaries} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Achievement alerts</Text>
          <Switch value={achievementAlerts} onValueChange={setAchievementAlerts} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Limit warnings</Text>
          <Switch value={limitWarnings} onValueChange={setLimitWarnings} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preview</Text>
        <Text style={styles.cardText}>Daily goal: {dailyLimitMinutes || '180'} min</Text>
        <Text style={styles.cardText}>Focus areas: {finalFocusAreas.join(', ')}</Text>
        <Text style={styles.cardText}>Sleep schedule: {bedTime} → {wakeTime}</Text>
        <Text style={styles.cardText}>
          Dashboard and detox plans will be generated from these values.
        </Text>
      </View>

      <PrimaryButton title="Save Profile" onPress={onSave} loading={loading} />
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
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 14,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
  },
  timeBox: {
    flex: 1,
  },
  timeLabel: {
    color: '#E2E8F0',
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 8,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 10,
  },
  cardText: {
    color: '#CBD5E1',
    marginBottom: 6,
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
    marginTop: 10,
    fontSize: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchText: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
});