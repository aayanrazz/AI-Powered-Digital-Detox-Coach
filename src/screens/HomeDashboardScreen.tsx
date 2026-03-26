import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import MetricCard from '../components/MetricCard';
import ProgressBar from '../components/ProgressBar';
import { api } from '../api/api';
import { DashboardData } from '../types';
import { useAuth } from '../context/AuthContext';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

export default function HomeDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.getDashboard();
      setDashboard(res.dashboard);
    } catch (error: any) {
      Alert.alert('Dashboard error', error.message || 'Failed to load dashboard');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

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
      <Text style={styles.greeting}>
        Hello, {dashboard?.welcomeName || user?.name || 'User'} 👋
      </Text>
      <Text style={styles.subtitle}>
        Here is your digital wellness snapshot for today
      </Text>

      <View style={styles.row}>
        <MetricCard label="Focus Score" value={dashboard?.focusScore ?? 0} />
        <View style={styles.gap} />
        <MetricCard
          label="Today Usage"
          value={`${dashboard?.todayUsageMinutes ?? 0} min`}
        />
      </View>

      <View style={styles.row}>
        <MetricCard
          label="Streak"
          value={`${dashboard?.streak ?? user?.streakCount ?? 0} days`}
        />
        <View style={styles.gap} />
        <MetricCard label="Points" value={dashboard?.points ?? user?.points ?? 0} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Level Progress</Text>
        <Text style={styles.levelText}>
          Level {dashboard?.currentLevelNumber ?? 1} •{' '}
          {dashboard?.currentLevelTitle || 'Mindful Seed'}
        </Text>

        <ProgressBar value={dashboard?.progressPct ?? 0} />

        <Text style={styles.panelSmall}>
          {dashboard?.pointsToNextLevel ?? 0} points to next level
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Badges & Achievements</Text>
        <Text style={styles.panelText}>
          Unlocked badges: {dashboard?.badgesCount ?? 0}
        </Text>

        {!!dashboard?.latestBadgeLabel && (
          <Text style={styles.badgeHighlight}>
            {dashboard?.latestBadgeEmoji || '🏅'} Latest badge: {dashboard?.latestBadgeLabel}
          </Text>
        )}

        <Text style={styles.panelSmall}>
          {dashboard?.nextBadgeHintText || 'Keep progressing to unlock more badges.'}
        </Text>

        <Pressable
          style={styles.action}
          onPress={() => navigation.navigate('Rewards')}
        >
          <Text style={styles.actionText}>Open Rewards & Badges</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Daily Goal</Text>
        <Text style={styles.panelText}>
          Limit target: {dashboard?.dailyGoal ?? 0} minutes
        </Text>
        <Text style={styles.panelSmall}>
          Risk level: {dashboard?.riskLevel || 'low'}
        </Text>
        <Text style={styles.panelSmall}>
          Unread alerts: {dashboard?.unreadNotifications ?? 0}
        </Text>
      </View>

      {!!dashboard?.overLimitAppsCount && dashboard.overLimitAppsCount > 0 && (
        <View style={[styles.panel, styles.interventionPanel]}>
          <Text style={styles.panelTitle}>Android Focus Shield</Text>
          <Text style={styles.panelText}>
            {dashboard?.interventionMessage ||
              'One or more distracting apps are over their daily limit.'}
          </Text>

          {!!dashboard?.topExceededAppName && (
            <Text style={styles.panelSmall}>
              Top exceeded app: {dashboard.topExceededAppName} • +{dashboard.topExceededMinutes ?? 0} min
            </Text>
          )}

          <Text style={styles.panelSmall}>
            Over-limit apps: {dashboard.overLimitAppsCount}
          </Text>

          <Pressable
            style={styles.action}
            onPress={() => navigation.navigate('MainTabs', { screen: 'UsageTab' })}
          >
            <Text style={styles.actionText}>Review Usage Limits</Text>
          </Pressable>

          <Pressable
            style={styles.action}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.actionText}>Open Settings</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Today’s Challenge</Text>
        <Text style={styles.panelText}>
          {dashboard?.dailyChallenge || 'Take a short mindful break away from your phone.'}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>AI Recommendations</Text>
        {(dashboard?.aiRecommendations || []).length ? (
          dashboard?.aiRecommendations?.map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.tip}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={styles.panelText}>
            No recommendations yet. Sync usage data to generate AI insights.
          </Text>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>

        <Pressable
          style={styles.action}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.actionText}>Open Notifications</Text>
        </Pressable>

        <Pressable
          style={styles.action}
          onPress={() => navigation.navigate('Rewards')}
        >
          <Text style={styles.actionText}>Rewards & Gamification</Text>
        </Pressable>

        <Pressable
          style={styles.action}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.actionText}>Settings & Privacy</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  gap: {
    width: 12,
  },
  panel: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 12,
  },
  interventionPanel: {
    borderColor: '#F59E0B',
    backgroundColor: '#1F2937',
  },
  panelTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  panelText: {
    color: '#CBD5E1',
    marginBottom: 12,
    lineHeight: 20,
  },
  panelSmall: {
    color: '#94A3B8',
    marginTop: 8,
  },
  levelText: {
    color: '#A5B4FC',
    fontWeight: '800',
    marginBottom: 10,
  },
  badgeHighlight: {
    color: '#FDE68A',
    fontWeight: '700',
    marginTop: 4,
  },
  tip: {
    color: '#CBD5E1',
    marginBottom: 8,
  },
  action: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  actionText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
});