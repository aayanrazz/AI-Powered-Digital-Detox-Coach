import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/api';
import { NotificationItem } from '../types';
import { formatDateTime } from '../utils/helpers';
import { runNotificationAction } from '../utils/notificationActions';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  dismissDeliveredBackendNotification,
  dismissDeliveredBackendNotifications,
} from '../services/notificationSyncService';

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (error: any) {
      Alert.alert(
        'Notification error',
        error.message || 'Failed to load notifications'
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(load);

  const markRead = async (id?: string) => {
    if (!id) return;

    try {
      await api.markNotificationRead(id);
      await dismissDeliveredBackendNotification(id);
      await load();
    } catch (error: any) {
      Alert.alert('Update failed', error.message || 'Could not mark as read');
    }
  };

  const markAll = async () => {
    try {
      const unreadIds = notifications
        .filter((item) => item._id && !item.read)
        .map((item) => String(item._id));

      await api.markAllNotificationsRead();
      await dismissDeliveredBackendNotifications(unreadIds);
      await load();
    } catch (error: any) {
      Alert.alert('Update failed', error.message || 'Could not mark all as read');
    }
  };

  const handleCtaPress = async (item: NotificationItem) => {
    try {
      if (item._id && !item.read) {
        await api.markNotificationRead(item._id);
        await dismissDeliveredBackendNotification(item._id);
      }

      await runNotificationAction(navigation, item);
      await load();
    } catch (error: any) {
      Alert.alert('Action failed', error.message || 'Could not open this action');
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
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>
        Smart interventions, reminders, and progress alerts
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Unread Alerts</Text>
        <Text style={styles.summaryCount}>{unreadCount}</Text>
        <Text style={styles.summaryText}>
          These reminders are generated from your usage, onboarding preferences,
          plan progress, and rewards.
        </Text>
      </View>

      <PrimaryButton
        title="Mark All As Read"
        onPress={markAll}
        variant="secondary"
      />

      {notifications.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>No notifications yet.</Text>
        </View>
      ) : (
        notifications.map((item) => (
          <Pressable
            key={item._id || item.title}
            style={[styles.card, item.read && styles.cardRead]}
            onPress={() => markRead(item._id)}
          >
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={[styles.badge, item.read && styles.badgeRead]}>
                {item.read ? 'READ' : 'NEW'}
              </Text>
            </View>

            <Text style={styles.cardText}>{item.message}</Text>

            <Text style={styles.meta}>
              {item.type || 'info'} • {formatDateTime(item.createdAt)}
            </Text>

            {!!item.ctaLabel && (
              <Pressable
                style={styles.ctaBtn}
                onPress={() => handleCtaPress(item)}
              >
                <Text style={styles.ctaText}>{item.ctaLabel}</Text>
              </Pressable>
            )}
          </Pressable>
        ))
      )}
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
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 12,
  },
  summaryTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  summaryCount: {
    color: '#A5B4FC',
    fontWeight: '800',
    fontSize: 30,
    marginTop: 10,
  },
  summaryText: {
    color: '#CBD5E1',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 12,
  },
  cardRead: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
    paddingRight: 10,
  },
  cardText: {
    color: '#CBD5E1',
    marginTop: 8,
  },
  meta: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 12,
  },
  badge: {
    backgroundColor: '#4F46E5',
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeRead: {
    backgroundColor: '#334155',
  },
  ctaBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ctaText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12,
  },
});