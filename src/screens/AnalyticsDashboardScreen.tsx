import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  Share,
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

type AnalyticsReportPreview = {
  generatedAt: string;
  range: RangeType;
  analytics: AnalyticsData;
  insights: string[];
};

const getDirectionText = (direction?: string) => {
  if (direction === 'improving') return 'Improving';
  if (direction === 'worsening') return 'Worsening';
  return 'Stable';
};

const getRangeLabel = (range: RangeType) => {
  if (range === 'day') return 'Daily';
  if (range === 'month') return 'Monthly';
  return 'Weekly';
};

const buildReportText = (report: AnalyticsReportPreview) => {
  const lines: string[] = [];

  lines.push('AI-Powered Digital Detox Coach');
  lines.push(`${getRangeLabel(report.range)} Analytics Report`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push(`Focus Score: ${report.analytics.focusScore ?? 0}`);
  lines.push(
    `Total Usage: ${formatMinutes(report.analytics.totalUsageMinutes ?? 0)}`
  );
  lines.push(
    `Average Per Day: ${formatMinutes(report.analytics.averageDailyMinutes ?? 0)}`
  );
  lines.push(`Pickups: ${report.analytics.pickupCount ?? 0}`);
  lines.push(`Unlocks: ${report.analytics.unlockCount ?? 0}`);
  lines.push(
    `Late Night Usage: ${formatMinutes(report.analytics.lateNightMinutes ?? 0)}`
  );
  lines.push(`Peak Hour: ${report.analytics.peakHourLabel || '00:00'}`);
  lines.push(`Risk Level: ${report.analytics.riskLevel || 'low'}`);
  lines.push('');
  lines.push('Trend Overview:');
  lines.push(
    report.analytics.comparison?.summary ||
      report.analytics.weeklyTrend ||
      'Your recent usage trend is being analyzed.'
  );

  if ((report.analytics.categoryBreakdown || []).length) {
    lines.push('');
    lines.push('Category Breakdown:');
    report.analytics.categoryBreakdown?.forEach((item) => {
      lines.push(
        `- ${item.category}: ${formatMinutes(item.minutes)} (${item.sharePct ?? 0}%)`
      );
    });
  }

  if ((report.insights || []).length) {
    lines.push('');
    lines.push('AI Recommendations:');
    report.insights.forEach((tip, index) => {
      lines.push(`${index + 1}. ${tip}`);
    });
  }

  return lines.join('\n');
};

export default function AnalyticsDashboardScreen() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<RangeType>('week');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportPreview, setReportPreview] =
    useState<AnalyticsReportPreview | null>(null);

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

        if (activeRange !== range) {
          setRange(activeRange);
        }
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

  const handleExportReport = useCallback(async () => {
    try {
      setExporting(true);

      const res = await api.exportAnalyticsReport(range);
      const preview: AnalyticsReportPreview = {
        generatedAt: res.generatedAt,
        range: res.report.range,
        analytics: res.report.analytics,
        insights: res.report.insights,
      };

      setReportPreview(preview);

      await Share.share({
        title: `${getRangeLabel(preview.range)} Analytics Report`,
        message: buildReportText(preview),
      });
    } catch (error: any) {
      Alert.alert(
        'Export failed',
        error.message || 'Failed to export analytics report.'
      );
    } finally {
      setExporting(false);
    }
  }, [range]);

  const handleShareLatestReport = useCallback(async () => {
    if (!reportPreview) {
      Alert.alert('No report yet', 'Please export a report first.');
      return;
    }

    try {
      await Share.share({
        title: `${getRangeLabel(reportPreview.range)} Analytics Report`,
        message: buildReportText(reportPreview),
      });
    } catch (error: any) {
      Alert.alert('Share failed', error.message || 'Failed to share report.');
    }
  }, [reportPreview]);

  useRefreshOnFocus(load);

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

      <View style={styles.buttonRow}>
        <View style={styles.buttonHalfLeft}>
          <PrimaryButton
            title="Refresh Analytics"
            onPress={() => load()}
            loading={loading}
            variant="secondary"
          />
        </View>

        <View style={styles.buttonHalfRight}>
          <PrimaryButton
            title="Export Report"
            onPress={handleExportReport}
            loading={exporting}
          />
        </View>
      </View>

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Analytics Report Export</Text>
        <Text style={styles.cardText}>
          Tap Export Report to generate a simple shareable report from your current
          analytics range.
        </Text>
        <Text style={styles.meta}>Selected range: {getRangeLabel(range)}</Text>

        {reportPreview ? (
          <>
            <View style={styles.reportDivider} />
            <Text style={styles.reportHeading}>Latest Report Preview</Text>
            <Text style={styles.meta}>
              Generated: {new Date(reportPreview.generatedAt).toLocaleString()}
            </Text>
            <Text style={styles.meta}>
              Total usage: {formatMinutes(reportPreview.analytics.totalUsageMinutes ?? 0)}
            </Text>
            <Text style={styles.meta}>
              Average per day: {formatMinutes(reportPreview.analytics.averageDailyMinutes ?? 0)}
            </Text>
            <Text style={styles.meta}>
              Focus score: {reportPreview.analytics.focusScore ?? 0}
            </Text>
            <Text style={styles.meta}>
              Risk level: {reportPreview.analytics.riskLevel || 'low'}
            </Text>
            <Text style={styles.reportSummary}>
              {reportPreview.analytics.comparison?.summary ||
                reportPreview.analytics.weeklyTrend ||
                'Your recent usage trend is being analyzed.'}
            </Text>

            {(reportPreview.insights || []).length ? (
              <View style={styles.reportTipsWrap}>
                {reportPreview.insights.map((tip, idx) => (
                  <Text key={`${tip}-${idx}`} style={styles.tip}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}

            <PrimaryButton
              title="Share Latest Report Again"
              onPress={handleShareLatestReport}
              variant="secondary"
            />
          </>
        ) : (
          <Text style={styles.emptyReportText}>
            No exported report yet. Generate one to preview and share it.
          </Text>
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
    marginBottom: 20,
  },
  rangeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  buttonHalfLeft: {
    flex: 1,
    marginRight: 6,
  },
  buttonHalfRight: {
    flex: 1,
    marginLeft: 6,
  },
  rangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 10,
  },
  rangeChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#6366F1',
  },
  rangeText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  rangeTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    marginTop: 12,
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
    marginTop: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
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
    width: 52,
    fontWeight: '700',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  trendValue: {
    color: '#CBD5E1',
    minWidth: 52,
    textAlign: 'right',
    fontWeight: '700',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  listTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  listMeta: {
    color: '#94A3B8',
    marginTop: 4,
  },
  listValue: {
    color: '#A5B4FC',
    fontWeight: '800',
  },
  tip: {
    color: '#CBD5E1',
    marginBottom: 8,
  },
  reportDivider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 14,
  },
  reportHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  reportSummary: {
    color: '#CBD5E1',
    lineHeight: 20,
    marginTop: 10,
  },
  reportTipsWrap: {
    marginTop: 12,
  },
  emptyReportText: {
    color: '#64748B',
    marginTop: 12,
  },
});