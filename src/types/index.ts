export type ThemeMode = 'dark' | 'light' | 'system';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface BadgeItem {
  key: string;
  label: string;
  earnedAt?: string;
}

export interface BadgeDisplayItem {
  key: string;
  label: string;
  emoji?: string;
  description?: string;
  earnedAt?: string | null;
}

export interface NextBadgeHint {
  key: string;
  label: string;
  emoji?: string;
  description?: string;
  hint?: string;
}

export interface User {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  avatarUrl?: string;
  age?: number;
  occupation?: string;
  goal?: string;
  points?: number;
  streakCount?: number;
  longestStreak?: number;
  detoxScore?: number;
  badges?: BadgeItem[];
  isOnboarded?: boolean;
  currentLevelNumber?: number;
  currentLevelTitle?: string;
  createdAt?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface UsageApp {
  packageName: string;
  appName: string;
  foregroundMs: number;
  minutesUsed: number;
  lastTimeUsed?: number;
  pickups?: number;
  unlocks?: number;
  category?: string;
}

export interface AppLimit {
  _id?: string;
  user?: string;
  appName: string;
  appPackage: string;
  category?: string;
  dailyLimitMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export type AppLimitItem = AppLimit;

export interface AppLimitStatusItem {
  appName: string;
  appPackage: string;
  category?: string;
  usedMinutes: number;
  dailyLimitMinutes: number;
  exceededMinutes: number;
  remainingMinutes: number;
  isExceeded: boolean;
}

export interface DashboardData {
  welcomeName?: string;
  focusScore?: number;
  todayUsageMinutes?: number;
  streak?: number;
  points?: number;
  riskLevel?: string;
  unreadNotifications?: number;
  dailyGoal?: number;
  dailyChallenge?: string;
  aiRecommendations?: string[];

  overLimitAppsCount?: number;
  topExceededAppName?: string;
  topExceededMinutes?: number;
  interventionMessage?: string;

  currentLevelNumber?: number;
  currentLevelTitle?: string;
  progressPct?: number;
  pointsToNextLevel?: number;

  badgesCount?: number;
  latestBadgeLabel?: string;
  latestBadgeEmoji?: string;
  nextBadgeHintText?: string;
}

export interface AnalyticsCategory {
  category: string;
  minutes: number;
  sharePct?: number;
}

export interface AnalyticsTrendPoint {
  label: string;
  shortLabel?: string;
  minutes: number;
}

export interface AnalyticsComparison {
  usageChangePct: number;
  pickupChangePct: number;
  unlockChangePct: number;
  direction: 'improving' | 'worsening' | 'steady';
  summary: string;
}

export interface AnalyticsData {
  focusScore?: number;
  totalUsageMinutes?: number;
  averageDailyMinutes?: number;
  pickupCount?: number;
  unlockCount?: number;
  lateNightMinutes?: number;
  peakHour?: number;
  peakHourLabel?: string;
  trendLabel?: string;
  trendPoints?: AnalyticsTrendPoint[];
  weeklyTrend?: string;
  recommendations?: string[];
  riskLevel?: string;
  categoryBreakdown?: AnalyticsCategory[];
  comparison?: AnalyticsComparison;
  totalActiveDays?: number;
  bestDayLabel?: string;
  worstDayLabel?: string;
}

export interface DetoxTask {
  _id?: string;
  title: string;
  type?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  targetTime?: string;
  completedAt?: string | null;
  pointsReward?: number;
}

export interface DetoxPlanDay {
  dayNumber: number;
  date: string;
  targetLimitMinutes: number;
  status?: 'pending' | 'in_progress' | 'completed';
  tasks: DetoxTask[];
  totalTasks?: number;
  completedTasks?: number;
  progressPct?: number;
}

export interface DetoxPlan {
  _id?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  targetDailyLimitMinutes?: number;
  aiInsight?: string;
  planSummary?: string;
  active?: boolean;
  days: DetoxPlanDay[];
  totalDays?: number;
  completedDays?: number;
  pendingDays?: number;
  totalTasks?: number;
  completedTasks?: number;
  overallProgressPct?: number;
  currentDayNumber?: number | null;
  status?: 'active' | 'completed';
}

export interface PlanTaskCompletion {
  taskTitle: string;
  taskType?: string;
  basePointsEarned: number;
  dayBonusPoints: number;
  planBonusPoints: number;
  totalPointsEarned: number;
  dayCompleted: boolean;
  planCompleted: boolean;
  completedDayNumber?: number | null;
}

export type NotificationCtaAction =
  | 'open_rewards'
  | 'open_detox_plan'
  | 'open_usage_tab'
  | 'open_analytics_tab'
  | 'open_profile_setup'
  | 'open_settings'
  | 'wind_down'
  | 'open_notifications'
  | 'open_home'
  | 'start_break'
  | 'show_message';

export interface NotificationItem {
  _id?: string;
  title: string;
  message: string;
  type?: string;
  read?: boolean;
  createdAt?: string;
  ctaLabel?: string;
  ctaAction?: NotificationCtaAction;
}

export interface RewardItem {
  _id?: string;
  name: string;
  cost: number;
}

export interface RewardActivityItem {
  _id?: string;
  type?: 'earn' | 'redeem';
  points?: number;
  title: string;
  description?: string;
  createdAt?: string;
}

export interface LeaderboardItem {
  name?: string;
  points?: number;
  streakCount?: number;
}

export interface RewardsSummary {
  points?: number;
  streak?: number;
  badges?: BadgeDisplayItem[];
  rewards?: RewardItem[];
  levelTitle?: string;
  levelNumber?: number;
  nextLevelTitle?: string;
  pointsToNextLevel?: number;
  progressPct?: number;
  recentActivity?: RewardActivityItem[];
  leaderboard?: LeaderboardItem[];
  unlockedBadgesCount?: number;
  totalBadges?: number;
  badgeCompletionPct?: number;
  latestBadge?: BadgeDisplayItem | null;
  nextBadgeHint?: NextBadgeHint | null;
}

export interface PrivacySettingsData {
  dataCollection?: boolean;
  anonymizeData?: boolean;
  allowAnalyticsForTraining?: boolean;
  retentionDays?: number;
  consentGiven?: boolean;
  consentVersion?: string;
  consentedAt?: string | null;
  policyLastViewedAt?: string | null;
  deletionRequestedAt?: string | null;
}

export interface PrivacyPolicySection {
  title: string;
  items: string[];
}

export interface PrivacyPolicyData {
  version: string;
  updatedAt: string;
  summary: string[];
  sections: PrivacyPolicySection[];
  retentionOptions: number[];
  securityPractices: string[];
  currentPrivacySettings: PrivacySettingsData;
}

export interface UsageSyncPrivacyState {
  settingsFound?: boolean;
  consentGiven?: boolean;
  dataCollection?: boolean;
  anonymizeData?: boolean;
  allowAnalyticsForTraining?: boolean;
  retentionDays?: number;
  allowServerSync?: boolean;
}

export interface IngestUsageAnalysis {
  score?: number;
  riskLevel?: string;
  predictionSource?: string;
  mlConfidence?: number;
  fallbackUsed?: boolean;
  totalScreenMinutes?: number;
  overLimitMinutes?: number;
}

export interface IngestUsageNotificationMeta {
  dominantNotificationType?: string;
  predictionSource?: string;
  fallbackUsed?: boolean;
  confidence?: number;
  safeguardApplied?: boolean;
  sendLimitWarning?: boolean;
  sendSleepNudge?: boolean;
  classProbabilities?: Record<string, number>;
  errorMessage?: string;
  createdNotifications?: Array<{
    id?: string;
    title?: string;
    kind?: string;
    skippedDuplicate?: boolean;
  }>;
}

export interface IngestUsageResult {
  success: boolean;
  message: string;
  syncedCount: number;
  skippedDueToPrivacy?: boolean;
  dayKey?: string | null;
  privacy?: UsageSyncPrivacyState;
  analysis?: IngestUsageAnalysis;
  notificationMeta?: IngestUsageNotificationMeta;
  appLimitSummary?: {
    monitoredApps: AppLimitStatusItem[];
    exceededApps: AppLimitStatusItem[];
    exceededCount: number;
  };
}

export interface SettingsData {
  notificationsEnabled?: boolean;
  aiInterventionsEnabled?: boolean;
  privacyModeEnabled?: boolean;
  dailyLimitMinutes?: number;
  blockDistractingApps?: boolean;

  focusAreas?: string[];
  bedTime?: string;
  wakeTime?: string;

  achievementAlerts?: boolean;
  limitWarnings?: boolean;

  dataCollection?: boolean;
  anonymizeData?: boolean;
  allowAnalyticsForTraining?: boolean;
  retentionDays?: number;
  consentGiven?: boolean;
  consentVersion?: string;
  consentedAt?: string | null;
  policyLastViewedAt?: string | null;
  deletionRequestedAt?: string | null;

  googleFitConnected?: boolean;
  appleHealthConnected?: boolean;

  theme?: ThemeMode;
  appLimits?: AppLimit[];
}