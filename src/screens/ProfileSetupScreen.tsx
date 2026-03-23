import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';

function parseFocusAreas(input: string) {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
  const [focusAreasText, setFocusAreasText] = useState(
    'Social Media, Productivity'
  );
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [gentleNudges, setGentleNudges] = useState(true);
  const [dailySummaries, setDailySummaries] = useState(true);
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    try {
      setLoading(true);

      await api.completeProfileSetup({
        name: name.trim(),
        age: Number(age),
        occupation: occupation.trim(),
        goal: goal.trim(),
        dailyLimitMinutes: Number(dailyLimitMinutes),
        focusAreas: parseFocusAreas(focusAreasText),
        bedTime: bedTime.trim(),
        wakeTime: wakeTime.trim(),
        notificationSettings: {
          gentleNudges,
          dailySummaries,
          achievementAlerts: true,
          limitWarnings: true,
        },
      });

      await refreshUser();
      Alert.alert('Success', 'Profile setup completed successfully.');
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
        Personalize your detox coach experience
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

      <TextInput
        placeholder="Focus areas (comma separated)"
        placeholderTextColor="#64748B"
        style={styles.input}
        value={focusAreasText}
        onChangeText={setFocusAreasText}
      />

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
        <Text style={styles.cardTitle}>Notification preferences</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Gentle nudges</Text>
          <Switch value={gentleNudges} onValueChange={setGentleNudges} />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Daily summaries</Text>
          <Switch value={dailySummaries} onValueChange={setDailySummaries} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Example goals</Text>
        <Text style={styles.cardText}>• Reduce Instagram / TikTok time</Text>
        <Text style={styles.cardText}>
          • Improve deep focus during study hours
        </Text>
        <Text style={styles.cardText}>
          • Sleep earlier with lower evening usage
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
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#CBD5E1',
    marginBottom: 6,
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