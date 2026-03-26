import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import { api } from '../api/api';
import { RewardsSummary } from '../types';
import { formatDateTime } from '../utils/helpers';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

export default function RewardsScreen() {
  const [data, setData] = useState<RewardsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.getRewardsSummary();
      setData(res.rewards);
    } catch (error: any) {
      Alert.alert('Rewards error', error.message || 'Failed to load rewards');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  const redeem = async (rewardId?: string) => {
    if (!rewardId) return;

    try {
      setRedeemingId(rewardId);
      await api.redeemReward(rewardId);
      Alert.alert('Success', 'Reward redeemed successfully.');
      await load();
    } catch (error: any) {
      Alert.alert('Redeem failed', error.message || 'Could not redeem reward');
    } finally {
      setRedeemingId(null);
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
      <Text style={styles.title}>Rewards & Gamification</Text>
      <Text style={styles.subtitle}>
        Earn points, build streaks, unlock badges, and level up
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Level Progress</Text>
        <Text style={styles.levelText}>
          Level {data?.levelNumber ?? 1} • {data?.levelTitle || 'Mindful Seed'}
        </Text>
        <Text style={styles.cardText}>Points: {data?.points ?? 0}</Text>
        <Text style={styles.cardText}>Streak: {data?.streak ?? 0} days</Text>
        <Text style={styles.cardText}>
          Next level: {data?.nextLevelTitle || 'Max level reached'}
        </Text>

        <View style={{ marginTop: 12 }}>
          <ProgressBar value={data?.progressPct ?? 0} />
          <Text style={styles.meta}>
            {data?.pointsToNextLevel ?? 0} points to next level
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Badge Progress</Text>
        <Text style={styles.cardText}>
          Unlocked: {data?.unlockedBadgesCount ?? 0} / {data?.totalBadges ?? 0}
        </Text>

        <View style={{ marginTop: 12 }}>
          <ProgressBar value={data?.badgeCompletionPct ?? 0} />
          <Text style={styles.meta}>
            {data?.badgeCompletionPct ?? 0}% badge completion
          </Text>
        </View>

        {!!data?.latestBadge?.label && (
          <Text style={styles.latestBadge}>
            {data?.latestBadge?.emoji || '🏅'} Latest badge: {data?.latestBadge?.label}
          </Text>
        )}

        {!!data?.nextBadgeHint?.hint && (
          <Text style={styles.meta}>{data.nextBadgeHint.hint}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Unlocked Badges</Text>
        {(data?.badges || []).length ? (
          data?.badges?.map((badge) => (
            <View key={badge.key} style={styles.badgeCard}>
              <Text style={styles.badgeEmoji}>{badge.emoji || '🏅'}</Text>

              <View style={{ flex: 1 }}>
                <Text style={styles.badgeTitle}>{badge.label}</Text>
                <Text style={styles.badgeText}>
                  {badge.description || 'Achievement unlocked.'}
                </Text>
                {!!badge.earnedAt && (
                  <Text style={styles.badgeMeta}>
                    Earned: {formatDateTime(badge.earnedAt)}
                  </Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>No badges unlocked yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rewards Store</Text>
        {(data?.rewards || []).map((item) => (
          <View key={item._id || item.name} style={styles.reward}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardName}>{item.name}</Text>
              <Text style={styles.rewardMeta}>Cost: {item.cost} points</Text>
            </View>
            <View style={{ width: 130 }}>
              <PrimaryButton
                title={redeemingId === item._id ? 'Redeeming...' : 'Redeem'}
                onPress={() => redeem(item._id)}
                loading={redeemingId === item._id}
              />
            </View>
          </View>
        ))}
        {!data?.rewards?.length && (
          <Text style={styles.cardText}>No rewards configured yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Reward Activity</Text>
        {(data?.recentActivity || []).length ? (
          data?.recentActivity?.map((item) => (
            <View key={item._id || item.title} style={styles.activityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityMeta}>
                  {item.description || item.type || 'activity'}
                </Text>
                <Text style={styles.activityMeta}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
              <Text
                style={[
                  styles.pointsDelta,
                  (item.points || 0) < 0 ? styles.pointsMinus : styles.pointsPlus,
                ]}
              >
                {(item.points || 0) > 0 ? '+' : ''}
                {item.points || 0}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>No reward activity yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Leaderboard</Text>
        {(data?.leaderboard || []).length ? (
          data?.leaderboard?.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.leaderRow}>
              <Text style={styles.leaderName}>
                #{index + 1} {item.name || 'User'}
              </Text>
              <Text style={styles.leaderPoints}>{item.points || 0} pts</Text>
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>Leaderboard data is not available yet.</Text>
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
  levelText: {
    color: '#A5B4FC',
    fontWeight: '800',
    marginBottom: 8,
  },
  cardText: {
    color: '#CBD5E1',
    marginBottom: 6,
  },
  meta: {
    color: '#94A3B8',
    marginTop: 8,
  },
  latestBadge: {
    color: '#FDE68A',
    marginTop: 12,
    fontWeight: '700',
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  badgeEmoji: {
    fontSize: 26,
    marginRight: 12,
    lineHeight: 32,
  },
  badgeTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  badgeText: {
    color: '#CBD5E1',
    marginTop: 6,
  },
  badgeMeta: {
    color: '#94A3B8',
    marginTop: 6,
    fontSize: 12,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  rewardName: {
    color: '#fff',
    fontWeight: '700',
  },
  rewardMeta: {
    color: '#94A3B8',
    marginTop: 6,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  activityTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  activityMeta: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 12,
  },
  pointsDelta: {
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 10,
  },
  pointsPlus: {
    color: '#22C55E',
  },
  pointsMinus: {
    color: '#F87171',
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  leaderName: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  leaderPoints: {
    color: '#A5B4FC',
    fontWeight: '800',
  },
});