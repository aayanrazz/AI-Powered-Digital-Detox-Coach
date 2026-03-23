import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import MetricCard from '../components/MetricCard';
import { api } from '../api/api';
import { AnalyticsData } from '../types';
import { formatMinutes } from '../utils/helpers';

type RangeType = 'day' | 'week' | 'month';

export default function AnalyticsDashboardScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<RangeType>('week');
  const [loading, setLoading] = useState(false);

  const load = async (nextRange: RangeType) => {
    try {
      setLoading(true);
      const res = await api.getAnalyticsSummary(nextRange);
      setAnalytics(res.analytics);
      setRange(nextRange);
    } catch (error: any) {
      Alert.alert('Analytics error', error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('week');
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>Analytics Dashboard</Text>
      <Text style={styles.subtitle}>
        Behavior trends and AI-based digital wellness insights
      </Text>

      <View style={styles.rangeRow}>
        {(['day', 'week', 'month'] as RangeType[]).map((item) => (
          <Pressable
            key={item}
            style={[styles.rangeChip, range === item && styles.rangeChipActive]}
            onPress={() => load(item)}
          >
            <Text
              style={[styles.rangeText, range === item && styles.rangeTextActive]}
            >
              {item.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <MetricCard label="Focus Score" value={analytics?.focusScore ?? 0} />
        <View style={{ width: 12 }} />
        <MetricCard
          label="Total Usage"
          value={formatMinutes(analytics?.totalUsageMinutes)}
        />
      </View>

      <View style={styles.row}>
        <MetricCard label="Pickups" value={analytics?.pickupCount ?? 0} />
        <View style={{ width: 12 }} />
        <MetricCard
          label="Late Night"
          value={formatMinutes(analytics?.lateNightMinutes)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Risk Level</Text>
        <Text style={styles.cardText}>{analytics?.riskLevel || 'low'}</Text>
        <Text style={styles.meta}>Peak hour: {analytics?.peakHour ?? 0}:00</Text>
        <Text style={styles.meta}>
          {analytics?.weeklyTrend || 'Your recent usage trend is being analyzed.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category Breakdown</Text>
        {(analytics?.categoryBreakdown || []).map((item, idx) => (
          <View key={`${item.category}-${idx}`} style={styles.listItem}>
            <Text style={styles.listTitle}>{item.category}</Text>
            <Text style={styles.listMeta}>{formatMinutes(item.minutes)}</Text>
          </View>
        ))}
        {!analytics?.categoryBreakdown?.length && (
          <Text style={styles.cardText}>
            {loading ? 'Loading analytics…' : 'No analytics data yet. Sync usage first.'}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI Recommendations</Text>
        {(analytics?.recommendations || []).map((tip, idx) => (
          <Text key={idx} style={styles.tip}>
            • {tip}
          </Text>
        ))}
        {!analytics?.recommendations?.length && (
          <Text style={styles.cardText}>No recommendations yet.</Text>
        )}
      </View>
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
  rangeRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 10,
  },
  rangeChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  rangeText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 12,
  },
  rangeTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
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
    fontSize: 17,
    marginBottom: 10,
  },
  cardText: {
    color: '#CBD5E1',
  },
  meta: {
    color: '#94A3B8',
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  listTitle: {
    color: '#E2E8F0',
  },
  listMeta: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  tip: {
    color: '#CBD5E1',
    marginBottom: 8,
  },
});