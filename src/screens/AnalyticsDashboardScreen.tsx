import React, { useCallback, useMemo, useState } from 'react';
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
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/api';
import { AnalyticsData } from '../types';
import { formatMinutes } from '../utils/helpers';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

type RangeType = 'day' | 'week' | 'month';

const getDirectionText = (direction?: string) => {
  if (direction === 'improving') return 'Improving';
  if (direction === 'worsening') return 'Worsening';
  return 'Stable';
};

export default function AnalyticsDashboardScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<RangeType>('week');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (nextRange?: RangeType) => {
      const activeRange = nextRange || range;

      try {
        if (nextRange) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const res = await api.getAnalyticsSummary(activeRange);
        setAnalytics(res.analytics);
        setRange(activeRange);
      } catch (error: any) {
        Alert.alert(
          'Analytics error',
          error.message || 'Failed to load analytics'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range]
  );

  useRefreshOnFocus(() => load());

  const maxTrendMinutes = useMemo(() => {
    const points = analytics?.trendPoints || [];
    const max = Math.max(0, ...points.map((item) => Number(item.minutes || 0)));
    return max || 1;
  }, [analytics?.trendPoints]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load()}
          tintColor="#ffffff"
        />
      }
    >
      <Text style={styles.title}>Analytics Dashboard</Text>
      <Text style={styles.subtitle}>
        Daily, weekly, and monthly digital wellness trends
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

      <PrimaryButton
        title="Refresh Analytics"
        onPress={() => load()}
        loading={loading}
        variant="secondary"
      />

      <View style={styles.row}>
        <MetricCard label="Focus Score" value={analytics?.focusScore ?? 0} />
        <View style={styles.gap} />
        <MetricCard
          label="Total Usage"
          value={formatMinutes(analytics?.totalUsageMinutes)}
        />
      </View>

      <View style={styles.row}>
        <MetricCard
          label="Average / Day"
          value={formatMinutes(analytics?.averageDailyMinutes)}
        />
        <View style={styles.gap} />
        <MetricCard label="Pickups" value={analytics?.pickupCount ?? 0} />
      </View>

      <View style={styles.row}>
        <MetricCard
          label="Late Night"
          value={formatMinutes(analytics?.lateNightMinutes)}
        />
        <View style={styles.gap} />
        <MetricCard
          label="Peak Hour"
          value={analytics?.peakHourLabel || '00:00'}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trend Overview</Text>

        <Text style={styles.bigText}>
          {getDirectionText(analytics?.comparison?.direction)}
        </Text>

        <Text style={styles.cardText}>
          {analytics?.comparison?.summary ||
            analytics?.weeklyTrend ||
            'Your recent usage trend is being analyzed.'}
        </Text>

        <Text style={styles.meta}>
          Usage change: {analytics?.comparison?.usageChangePct ?? 0}%
        </Text>
        <Text style={styles.meta}>
          Pickup change: {analytics?.comparison?.pickupChangePct ?? 0}%
        </Text>
        <Text style={styles.meta}>
          Unlock change: {analytics?.comparison?.unlockChangePct ?? 0}%
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{analytics?.trendLabel || 'Trend'}</Text>

        {(analytics?.trendPoints || []).length ? (
          analytics?.trendPoints?.map((item, index) => {
            const widthPct = Math.max(
              item.minutes > 0 ? 8 : 2,
              Math.round((item.minutes / maxTrendMinutes) * 100)
            );

            return (
              <View key={`${item.label}-${index}`} style={styles.trendRow}>
                <Text style={styles.trendLabel}>
                  {item.shortLabel || item.label}
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${widthPct}%` }]} />
                </View>

                <Text style={styles.trendValue}>
                  {formatMinutes(item.minutes)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.cardText}>
            {loading || refreshing
              ? 'Loading trend data…'
              : 'No trend data yet. Sync usage first.'}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usage Highlights</Text>
        <Text style={styles.meta}>
          Risk level: {analytics?.riskLevel || 'low'}
        </Text>
        <Text style={styles.meta}>
          Active periods: {analytics?.totalActiveDays ?? 0}
        </Text>
        <Text style={styles.meta}>
          Best day / period: {analytics?.bestDayLabel || 'Not enough data'}
        </Text>
        <Text style={styles.meta}>
          Lowest usage day / period: {analytics?.worstDayLabel || 'Not enough data'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category Breakdown</Text>

        {(analytics?.categoryBreakdown || []).length ? (
          analytics?.categoryBreakdown?.map((item, idx) => (
            <View key={`${item.category}-${idx}`} style={styles.listItem}>
              <View>
                <Text style={styles.listTitle}>{item.category}</Text>
                <Text style={styles.listMeta}>
                  {item.sharePct ?? 0}% of usage
                </Text>
              </View>

              <Text style={styles.listValue}>{formatMinutes(item.minutes)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>
            {loading || refreshing
              ? 'Loading categories…'
              : 'No category analytics yet.'}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI Recommendations</Text>

        {(analytics?.recommendations || []).length ? (
          analytics?.recommendations?.map((tip, idx) => (
            <Text key={idx} style={styles.tip}>
              • {tip}
            </Text>
          ))
        ) : (
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
    marginTop: 12,
    marginBottom: 0,
  },
  gap: {
    width: 12,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
    marginTop: 12,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  cardText: {
    color: '#CBD5E1',
    lineHeight: 20,
  },
  bigText: {
    color: '#A5B4FC',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  meta: {
    color: '#94A3B8',
    marginTop: 8,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendLabel: {
    color: '#E2E8F0',
    width: 58,
    fontWeight: '700',
    fontSize: 12,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4F46E5',
  },
  trendValue: {
    color: '#CBD5E1',
    width: 70,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
  },
  listItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  listMeta: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 12,
  },
  listValue: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  tip: {
    color: '#CBD5E1',
    marginBottom: 8,
    lineHeight: 20,
  },
});