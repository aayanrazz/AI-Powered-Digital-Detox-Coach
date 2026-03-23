import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import { api } from '../api/api';
import { DetoxPlan } from '../types';
import { progressPercent } from '../utils/helpers';

function formatShortDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

export default function DetoxPlanScreen() {
  const [plan, setPlan] = useState<DetoxPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPlan = async () => {
    try {
      const res = await api.getActivePlan();
      setPlan(res.plan);
    } catch {
      setPlan(null);
    }
  };

  useEffect(() => {
    loadPlan();
  }, []);

  const generatePlan = async () => {
    try {
      setLoading(true);
      const res = await api.generateDetoxPlan();
      setPlan(res.plan);
      Alert.alert('Success', 'Your personalized detox plan has been generated.');
    } catch (error: any) {
      Alert.alert('Plan generation failed', error.message || 'Could not generate plan');
    } finally {
      setLoading(false);
    }
  };

  const currentDay = useMemo(() => {
    return plan?.days?.find((day) => day.status !== 'completed') || plan?.days?.[0] || null;
  }, [plan]);

  const totalDays = plan?.days?.length || 0;
  const completedDays =
    plan?.days?.filter((day) => day.status === 'completed').length || 0;
  const totalTasks =
    plan?.days?.reduce((sum, day) => sum + (day.tasks?.length || 0), 0) || 0;
  const completedTasks =
    plan?.days?.reduce(
      (sum, day) =>
        sum + (day.tasks?.filter((task) => task.status === 'completed').length || 0),
      0
    ) || 0;

  const currentTasks = currentDay?.tasks || [];
  const currentDone = currentTasks.filter((task) => task.status === 'completed').length;
  const currentTotal = currentTasks.length;

  const completeTask = async (taskId?: string) => {
    if (!plan?._id || !taskId) return;

    try {
      const res = await api.completePlanTask(plan._id, taskId);
      setPlan(res.plan);

      if ((res.newBadges || []).length) {
        Alert.alert(
          'Badge unlocked',
          `You unlocked: ${(res.newBadges || []).join(', ')}`
        );
      }
    } catch (error: any) {
      Alert.alert('Task update failed', error.message || 'Could not update task');
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>AI Detox Plan</Text>
      <Text style={styles.subtitle}>
        Personalized recovery tasks, usage limits, and healthy routines
      </Text>

      {!plan ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No active plan yet</Text>
          <Text style={styles.cardText}>
            Generate a smart detox plan based on your recent usage pattern and profile.
          </Text>
          <PrimaryButton title="Generate Detox Plan" onPress={generatePlan} loading={loading} />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan Overview</Text>
            <Text style={styles.cardText}>
              {plan.planSummary || 'Reduce distractions and improve focus.'}
            </Text>
            <Text style={styles.meta}>Start: {formatShortDate(plan.startDate)}</Text>
            <Text style={styles.meta}>End: {formatShortDate(plan.endDate)}</Text>
            <Text style={styles.meta}>
              Final target limit: {plan.targetDailyLimitMinutes ?? 0} min/day
            </Text>
            <Text style={styles.meta}>
              AI insight: {plan.aiInsight || 'No AI insight yet.'}
            </Text>

            <View style={{ marginTop: 14 }}>
              <ProgressBar value={progressPercent(completedTasks, totalTasks)} />
              <Text style={styles.progressText}>
                {completedTasks}/{totalTasks} tasks completed • {completedDays}/{totalDays} days finished
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current Day</Text>
            <Text style={styles.cardText}>
              Day {currentDay?.dayNumber ?? 1} • Target {currentDay?.targetLimitMinutes ?? 0} min
            </Text>

            <View style={{ marginTop: 12 }}>
              <ProgressBar value={progressPercent(currentDone, currentTotal)} />
              <Text style={styles.progressText}>
                {currentDone}/{currentTotal} tasks completed today
              </Text>
            </View>

            {currentTasks.map((task, index) => {
              const completed = task.status === 'completed';

              return (
                <Pressable
                  key={task._id || `${task.title}-${index}`}
                  style={[styles.task, completed && styles.taskDone]}
                  onPress={() => completeTask(task._id)}
                >
                  <Text style={styles.taskTitle}>
                    {completed ? '✅' : task.status === 'in_progress' ? '🟣' : '⬜'} {task.title}
                  </Text>

                  {!!task.targetTime && (
                    <Text style={styles.taskText}>Target time: {task.targetTime}</Text>
                  )}

                  {!!task.type && (
                    <Text style={styles.taskText}>Type: {task.type}</Text>
                  )}

                  {!completed && (
                    <Text style={styles.tapHint}>Tap to mark completed</Text>
                  )}
                </Pressable>
              );
            })}

            {!currentTasks.length && (
              <Text style={styles.cardText}>No tasks available yet.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan Timeline</Text>
            {plan.days.slice(0, 7).map((day) => (
              <View key={`day-${day.dayNumber}`} style={styles.timelineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>Day {day.dayNumber}</Text>
                  <Text style={styles.timelineMeta}>
                    {formatShortDate(day.date)} • Target {day.targetLimitMinutes} min
                  </Text>
                </View>
                <Text style={styles.timelineStatus}>
                  {day.status === 'completed'
                    ? 'Completed'
                    : day.status === 'in_progress'
                    ? 'In Progress'
                    : 'Pending'}
                </Text>
              </View>
            ))}
            {plan.days.length > 7 && (
              <Text style={styles.meta}>Showing first 7 days of the full 21-day plan.</Text>
            )}
          </View>

          <PrimaryButton
            title="Regenerate Plan"
            onPress={generatePlan}
            loading={loading}
            variant="secondary"
          />
        </>
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
    fontSize: 18,
    marginBottom: 8,
  },
  cardText: {
    color: '#CBD5E1',
  },
  meta: {
    color: '#94A3B8',
    marginTop: 8,
  },
  progressText: {
    color: '#CBD5E1',
    marginTop: 8,
  },
  task: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  taskDone: {
    opacity: 0.7,
  },
  taskTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  taskText: {
    color: '#CBD5E1',
    marginTop: 6,
  },
  tapHint: {
    color: '#A5B4FC',
    marginTop: 8,
    fontWeight: '700',
    fontSize: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  timelineTitle: {
    color: '#fff',
    fontWeight: '700',
  },
  timelineMeta: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 12,
  },
  timelineStatus: {
    color: '#A5B4FC',
    fontWeight: '700',
    fontSize: 12,
  },
});