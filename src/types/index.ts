export type ThemeMode = 'dark' | 'light' | 'system';

export interface BadgeItem {
  key: string;
  label: string;
  earnedAt?: string;
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
}

export interface AnalyticsCategory {
  category: string;
  minutes: number;
}

export interface AnalyticsData {
  focusScore?: number;
  totalUsageMinutes?: number;
  pickupCount?: number;
  unlockCount?: number;
  lateNightMinutes?: number;
  peakHour?: number;
  weeklyTrend?: string;
  recommendations?: string[];
  riskLevel?: string;
  categoryBreakdown?: AnalyticsCategory[];
}

export interface DetoxTask {
  _id?: string;
  title: string;
  type?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  targetTime?: string;
  completedAt?: string | null;
}

export interface DetoxPlanDay {
  dayNumber: number;
  date: string;
  targetLimitMinutes: number;
  status?: 'pending' | 'in_progress' | 'completed';
  tasks: DetoxTask[];
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
}

export interface NotificationItem {
  _id?: string;
  title: string;
  message: string;
  type?: string;
  read?: boolean;
  createdAt?: string;
  ctaLabel?: string;
  ctaAction?: string;
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
  badges?: string[];
  rewards?: RewardItem[];
  levelTitle?: string;
  levelNumber?: number;
  nextLevelTitle?: string;
  pointsToNextLevel?: number;
  progressPct?: number;
  recentActivity?: RewardActivityItem[];
  leaderboard?: LeaderboardItem[];
}

export interface AppLimitItem {
  _id?: string;
  appName: string;
  appPackage: string;
  category?: string;
  dailyLimitMinutes: number;
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

  googleFitConnected?: boolean;
  appleHealthConnected?: boolean;

  theme?: ThemeMode;
  appLimits?: AppLimitItem[];
}