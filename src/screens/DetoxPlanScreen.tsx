import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import PrimaryButton from '../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import { api } from '../api/api';
import { DetoxPlan } from '../types';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

function formatShortDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

function dayStatusLabel(status?: string) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In Progress';
  return 'Pending';
}

function taskStatusIcon(status?: string) {
  if (status === 'completed') return '✅';
  if (status === 'in_progress') return '🟣';
  return '⬜';
}

export default function DetoxPlanScreen() {
  const [plan, setPlan] = useState<DetoxPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await api.getActivePlan();
      setPlan(res.plan);
    } catch {
      setPlan(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(loadPlan);

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
    if (!plan?.days?.length) return null;

    return (
      plan.days.find((day) => day.dayNumber === plan.currentDayNumber) ||
      plan.days.find((day) => day.status === 'in_progress') ||
      plan.days.find((day) => day.status !== 'completed') ||
      plan.days[0]
    );
  }, [plan]);

  const completeTask = async (taskId?: string) => {
    if (!plan?._id || !taskId) return;

    try {
      setCompletingTaskId(taskId);

      const res = await api.completePlanTask(plan._id, taskId);
      setPlan(res.plan);

      const completion = res.completion;
      const badgeText =
        (res.newBadges || []).length > 0
          ? `\n\nNew badges: ${(res.newBadges || []).join(', ')}`
          : '';

      if (completion) {
        const parts = [
          `Task completed: ${completion.taskTitle}`,
          `+${completion.basePointsEarned} points`,
        ];

        if (completion.dayBonusPoints > 0) {
          parts.push(`Day completion bonus: +${completion.dayBonusPoints}`);
        }

        if (completion.planBonusPoints > 0) {
          parts.push(`Plan completion bonus: +${completion.planBonusPoints}`);
        }

        parts.push(`Total earned now: +${completion.totalPointsEarned}`);

        if (completion.dayCompleted && completion.completedDayNumber) {
          parts.push(`Day ${completion.completedDayNumber} completed`);
        }

        if (completion.planCompleted) {
          parts.push('Full detox plan completed');
        }

        Alert.alert('Progress updated', `${parts.join('\n')}${badgeText}`);
      } else if (badgeText) {
        Alert.alert('Badge unlocked', badgeText.trim());
      }

      await loadPlan();
    } catch (error: any) {
      Alert.alert('Task update failed', error.message || 'Could not update task');
    } finally {
      setCompletingTaskId(null);
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadPlan}
          tintColor="#ffffff"
        />
      }
    >
      <Text style={styles.title}>AI Detox Plan</Text>
      <Text style={styles.subtitle}>
        Personalized recovery tasks, completed-day tracking, and reward progress
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

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{plan.completedDays ?? 0}</Text>
                <Text style={styles.summaryLabel}>Days Done</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{plan.completedTasks ?? 0}</Text>
                <Text style={styles.summaryLabel}>Tasks Done</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryValue}>{plan.totalDays ?? 0}</Text>
                <Text style={styles.summaryLabel}>Total Days</Text>
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <ProgressBar value={plan.overallProgressPct ?? 0} />
              <Text style={styles.progressText}>
                {plan.completedTasks ?? 0}/{plan.totalTasks ?? 0} tasks completed •{' '}
                {plan.completedDays ?? 0}/{plan.totalDays ?? 0} days finished
              </Text>
            </View>

            <Text style={styles.planState}>
              Plan status: {plan.status === 'completed' ? 'Completed ✅' : 'Active 🟣'}
            </Text>
          </View>

          {!!currentDay && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current Day Focus</Text>
              <Text style={styles.cardText}>
                Day {currentDay.dayNumber} • Target {currentDay.targetLimitMinutes ?? 0} min
              </Text>
              <Text style={styles.meta}>
                Status: {dayStatusLabel(currentDay.status)}
              </Text>

              <View style={{ marginTop: 12 }}>
                <ProgressBar value={currentDay.progressPct ?? 0} />
                <Text style={styles.progressText}>
                  {currentDay.completedTasks ?? 0}/{currentDay.totalTasks ?? 0} tasks completed today
                </Text>
              </View>

              {(currentDay.tasks || []).map((task, index) => {
                const completed = task.status === 'completed';

                return (
                  <Pressable
                    key={task._id || `${task.title}-${index}`}
                    style={[styles.task, completed && styles.taskDone]}
                    onPress={() => completeTask(task._id)}
                    disabled={completed || completingTaskId === task._id}
                  >
                    <Text style={styles.taskTitle}>
                      {taskStatusIcon(task.status)} {task.title}
                    </Text>

                    {!!task.targetTime && (
                      <Text style={styles.taskText}>Target time: {task.targetTime}</Text>
                    )}

                    {!!task.type && (
                      <Text style={styles.taskText}>Type: {task.type}</Text>
                    )}

                    <Text style={styles.taskReward}>
                      Reward: +{task.pointsReward ?? 0} points
                    </Text>

                    {!completed && (
                      <Text style={styles.tapHint}>
                        {completingTaskId === task._id
                          ? 'Updating...'
                          : 'Tap to mark completed'}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plan Timeline</Text>

            {(plan.days || []).map((day) => (
              <View
                key={`day-${day.dayNumber}`}
                style={[
                  styles.timelineRow,
                  day.status === 'in_progress' && styles.timelineRowActive,
                  day.status === 'completed' && styles.timelineRowDone,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>Day {day.dayNumber}</Text>
                  <Text style={styles.timelineMeta}>
                    {formatShortDate(day.date)} • Target {day.targetLimitMinutes} min
                  </Text>
                  <Text style={styles.timelineMeta}>
                    {day.completedTasks ?? 0}/{day.totalTasks ?? 0} tasks completed
                  </Text>
                </View>

                <View style={styles.timelineRight}>
                  <Text style={styles.timelineStatus}>{dayStatusLabel(day.status)}</Text>
                  <Text style={styles.timelinePct}>{day.progressPct ?? 0}%</Text>
                </View>
              </View>
            ))}
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
  summaryRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 8,
  },
  summaryValue: {
    color: '#A5B4FC',
    fontWeight: '800',
    fontSize: 20,
  },
  summaryLabel: {
    color: '#94A3B8',
    marginTop: 6,
    fontSize: 12,
  },
  progressText: {
    color: '#CBD5E1',
    marginTop: 8,
  },
  planState: {
    color: '#FDE68A',
    marginTop: 12,
    fontWeight: '700',
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
  taskReward: {
    color: '#86EFAC',
    marginTop: 8,
    fontWeight: '700',
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  timelineRowActive: {
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  timelineRowDone: {
    backgroundColor: 'rgba(34,197,94,0.06)',
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
  timelineRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  timelineStatus: {
    color: '#A5B4FC',
    fontWeight: '700',
    fontSize: 12,
  },
  timelinePct: {
    color: '#CBD5E1',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
});