import { http } from './http';
import {
  AnalyticsData,
  AppLimitItem,
  DashboardData,
  DetoxPlan,
  LoginPayload,
  NotificationItem,
  RegisterPayload,
  RewardsSummary,
  SettingsData,
  UsageApp,
  User,
} from '../types';

type RiskLevel = 'low' | 'medium' | 'high';

const deriveRiskLevel = (score?: number | null): RiskLevel => {
  if (score === undefined || score === null) return 'low';
  if (score < 45) return 'high';
  if (score < 70) return 'medium';
  return 'low';
};

const guessCategory = (app: UsageApp): string => {
  const haystack = `${app.appName ?? ''} ${app.packageName ?? ''}`.toLowerCase();

  if (
    haystack.includes('instagram') ||
    haystack.includes('facebook') ||
    haystack.includes('tiktok') ||
    haystack.includes('snapchat') ||
    haystack.includes('twitter') ||
    haystack.includes('reddit')
  ) {
    return 'Social Media';
  }

  if (
    haystack.includes('youtube') ||
    haystack.includes('netflix') ||
    haystack.includes('spotify')
  ) {
    return 'Streaming';
  }

  if (
    haystack.includes('classroom') ||
    haystack.includes('docs') ||
    haystack.includes('drive') ||
    haystack.includes('notion') ||
    haystack.includes('slack') ||
    haystack.includes('teams') ||
    haystack.includes('zoom')
  ) {
    return 'Productivity';
  }

  if (
    haystack.includes('game') ||
    haystack.includes('pubg') ||
    haystack.includes('freefire') ||
    haystack.includes('clash')
  ) {
    return 'Gaming';
  }

  return 'Other';
};

const normalizeFocusAreas = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

const mapAppLimitsFromBackend = (appLimits: any[] = []): AppLimitItem[] =>
  appLimits.map((item) => ({
    _id: item._id,
    appName: item.appName,
    appPackage: item.appPackage,
    category: item.category,
    dailyLimitMinutes: Number(item.dailyLimitMinutes ?? 0),
  }));

const mapSettingsFromBackend = (
  settings: any,
  appLimits: any[] = []
): SettingsData => ({
  notificationsEnabled: settings?.notificationSettings?.dailySummaries ?? true,
  aiInterventionsEnabled: settings?.notificationSettings?.gentleNudges ?? true,
  privacyModeEnabled: settings?.privacySettings?.anonymizeData ?? false,
  dailyLimitMinutes: settings?.dailyLimitMinutes ?? 180,
  blockDistractingApps: false,

  focusAreas: normalizeFocusAreas(settings?.focusAreas),
  bedTime: settings?.sleepSchedule?.bedTime ?? '23:00',
  wakeTime: settings?.sleepSchedule?.wakeTime ?? '07:00',

  achievementAlerts: settings?.notificationSettings?.achievementAlerts ?? true,
  limitWarnings: settings?.notificationSettings?.limitWarnings ?? true,

  dataCollection: settings?.privacySettings?.dataCollection ?? true,
  anonymizeData: settings?.privacySettings?.anonymizeData ?? true,

  googleFitConnected: settings?.integrations?.googleFitConnected ?? false,
  appleHealthConnected: settings?.integrations?.appleHealthConnected ?? false,

  theme: settings?.theme ?? 'dark',
  appLimits: mapAppLimitsFromBackend(appLimits),
});

const mapSettingsToBackend = (payload: SettingsData) => ({
  dailyLimitMinutes: payload.dailyLimitMinutes,
  focusAreas: payload.focusAreas,
  sleepSchedule: {
    bedTime: payload.bedTime,
    wakeTime: payload.wakeTime,
  },
  notificationSettings: {
    dailySummaries: payload.notificationsEnabled,
    gentleNudges: payload.aiInterventionsEnabled,
    achievementAlerts: payload.achievementAlerts,
    limitWarnings: payload.limitWarnings,
  },
  privacySettings: {
    anonymizeData:
      payload.anonymizeData !== undefined
        ? payload.anonymizeData
        : payload.privacyModeEnabled,
    dataCollection: payload.dataCollection,
  },
  integrations: {
    googleFitConnected: payload.googleFitConnected,
    appleHealthConnected: payload.appleHealthConnected,
  },
  theme: payload.theme,
});

const mapUsageAppsToSessions = (apps: UsageApp[]) => {
  const now = Date.now();

  return apps.map((app, index) => {
    const minutes = Number(
      app.minutesUsed ?? Math.round((app.foregroundMs ?? 0) / 60000) ?? 0
    );
    const safeMinutes = Math.max(0, minutes);

    const endTime = new Date(now - index * 1000).toISOString();
    const startTime = new Date(
      now - index * 1000 - safeMinutes * 60_000
    ).toISOString();

    return {
      appName: app.appName || app.packageName,
      appPackage: app.packageName,
      category: app.category || guessCategory(app),
      durationMinutes: safeMinutes,
      pickups: Number(app.pickups ?? 0),
      unlocks: Number(app.unlocks ?? 0),
      startTime,
      endTime,
      platform: 'android',
      source: 'native_bridge',
    };
  });
};

export const api = {
  health: () => http('/health', { auth: false }),

  register: (payload: RegisterPayload) =>
    http<{ message?: string; user?: User; token?: string }>('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    }),

  login: (payload: LoginPayload) =>
    http<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    }),

  getMe: () => http<{ user: User; settings?: any }>('/auth/me'),

  async getDashboard(): Promise<{ dashboard: DashboardData }> {
    const res = await http<{ dashboard: any }>('/dashboard');
    const dashboard = res.dashboard || {};

    return {
      dashboard: {
        welcomeName: dashboard.userName ?? '',
        focusScore: Number(dashboard.digitalWellnessScore ?? 0),
        todayUsageMinutes: Number(dashboard.todayScreenTime ?? 0),
        streak: Number(dashboard.streak ?? 0),
        points: Number(dashboard.points ?? 0),
        riskLevel: deriveRiskLevel(dashboard.digitalWellnessScore),
        unreadNotifications: Number(dashboard.unreadNotifications ?? 0),
        dailyGoal: Number(dashboard.dailyGoal ?? 0),
        dailyChallenge: dashboard.dailyChallenge ?? '',
        aiRecommendations: Array.isArray(dashboard.aiRecommendations)
          ? dashboard.aiRecommendations
          : [],
      },
    };
  },

  async getSettings(): Promise<{ settings: SettingsData; user?: User }> {
    const res = await http<{ settings: any; user?: User; appLimits?: any[] }>(
      '/settings'
    );

    return {
      settings: mapSettingsFromBackend(res.settings, res.appLimits || []),
      user: res.user,
    };
  },

  async updateSettings(
    payload: SettingsData
  ): Promise<{ settings: SettingsData; user?: User }> {
    const res = await http<{ settings: any; user?: User; appLimits?: any[] }>(
      '/settings',
      {
        method: 'PUT',
        body: mapSettingsToBackend(payload),
      }
    );

    return {
      settings: mapSettingsFromBackend(res.settings, res.appLimits || []),
      user: res.user,
    };
  },

  completeProfileSetup: (payload: {
    name: string;
    age: number;
    occupation: string;
    goal: string;
    dailyLimitMinutes: number;
    focusAreas?: string[];
    bedTime?: string;
    wakeTime?: string;
    notificationSettings?: {
      gentleNudges?: boolean;
      dailySummaries?: boolean;
      achievementAlerts?: boolean;
      limitWarnings?: boolean;
    };
  }) =>
    http<{ user: User }>('/profile/setup', {
      method: 'PUT',
      body: payload,
    }),

  saveAppLimit: (payload: {
    appName: string;
    appPackage: string;
    category?: string;
    dailyLimitMinutes: number;
  }) =>
    http('/settings/app-limits', {
      method: 'POST',
      body: payload,
    }),

  ingestUsage: (payload: { apps: UsageApp[] }) =>
    http('/usage/ingest', {
      method: 'POST',
      body: { sessions: mapUsageAppsToSessions(payload.apps) },
    }),

  async getTodayUsage(): Promise<{
    apps: UsageApp[];
    totalMinutes: number;
  }> {
    const res = await http<{ sessions: any[]; aiInsight?: any }>('/usage/today');

    return {
      apps:
        res.sessions?.map((session) => ({
          packageName: session.appPackage,
          appName: session.appName,
          foregroundMs: Number(session.durationMinutes ?? 0) * 60_000,
          minutesUsed: Number(session.durationMinutes ?? 0),
          lastTimeUsed: session.endTime
            ? new Date(session.endTime).getTime()
            : undefined,
          pickups: Number(session.pickups ?? 0),
          unlocks: Number(session.unlocks ?? 0),
          category: session.category || 'Other',
        })) || [],
      totalMinutes:
        res.sessions?.reduce(
          (sum, item) => sum + Number(item.durationMinutes ?? 0),
          0
        ) || 0,
    };
  },

  async getAnalyticsSummary(
    range: 'day' | 'week' | 'month' = 'week'
  ): Promise<{ analytics: AnalyticsData }> {
    const res = await http<{ analytics: any; insights?: string[] }>(
      `/analytics/summary?range=${range}`
    );

    const analytics = res.analytics || {};
    const insights = Array.isArray(res.insights) ? res.insights : [];

    return {
      analytics: {
        focusScore: Number(analytics.score ?? 0),
        totalUsageMinutes: Number(analytics.totalScreenMinutes ?? 0),
        pickupCount: Number(analytics.pickups ?? 0),
        unlockCount: Number(analytics.unlocks ?? 0),
        lateNightMinutes: Number(analytics.lateNightMinutes ?? 0),
        peakHour: analytics.peakHour ?? '',
        weeklyTrend:
          insights[0] || 'Your recent usage trend is being analyzed.',
        recommendations: insights,
        riskLevel: deriveRiskLevel(analytics.score),
        categoryBreakdown: Array.isArray(analytics.categoryBreakdown)
          ? analytics.categoryBreakdown
          : [],
      },
    };
  },

  generateDetoxPlan: () =>
    http<{ plan: DetoxPlan }>('/detox-plans/generate', {
      method: 'POST',
    }),

  getActivePlan: () => http<{ plan: DetoxPlan | null }>('/detox-plans/active'),

  completePlanTask: (planId: string, taskId: string) =>
    http<{
      plan: DetoxPlan;
      user?: User & {
        progressPct?: number;
        pointsToNextLevel?: number;
      };
      newBadges?: string[];
    }>(`/detox-plans/${planId}/tasks/${taskId}/complete`, {
      method: 'PATCH',
    }),

  async getNotifications(): Promise<{
    notifications: NotificationItem[];
    unreadCount: number;
  }> {
    const res = await http<{ notifications: any[]; unreadCount?: number }>(
      '/notifications'
    );

    return {
      unreadCount: Number(res.unreadCount ?? 0),
      notifications:
        res.notifications?.map((item) => ({
          _id: item._id,
          title: item.title,
          message: item.body,
          type: item.type,
          read: item.isRead,
          createdAt: item.createdAt,
          ctaLabel: item.cta?.label,
          ctaAction: item.cta?.action,
        })) || [],
    };
  },

  markNotificationRead: (notificationId: string) =>
    http(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),

  markAllNotificationsRead: () =>
    http('/notifications/mark-all-read', {
      method: 'PATCH',
    }),

  async getRewardsSummary(): Promise<{ rewards: RewardsSummary }> {
    const res = await http<any>('/rewards');

    return {
      rewards: {
        points: Number(res.user?.points ?? 0),
        streak: Number(res.user?.streakCount ?? 0),
        badges: (res.user?.badges || []).map((badge: any) => badge.label),
        rewards: (res.redeemables || []).map((item: any) => ({
          _id: item.code,
          name: item.title,
          cost: Number(item.points ?? 0),
        })),
        levelTitle: res.level?.title,
        levelNumber: res.level?.number,
        nextLevelTitle: res.nextLevel?.title,
        pointsToNextLevel: Number(res.levelProgress?.pointsToNextLevel ?? 0),
        progressPct: Number(res.levelProgress?.progressPct ?? 0),
        recentActivity: (res.recentRewards || []).map((item: any) => ({
          _id: item._id,
          type: item.type,
          points: Number(item.points ?? 0),
          title: item.title,
          description: item.description,
          createdAt: item.createdAt,
        })),
        leaderboard: (res.leaderboard || []).map((item: any) => ({
          name: item.name,
          points: Number(item.points ?? 0),
          streakCount: Number(item.streakCount ?? 0),
        })),
      },
    };
  },

  redeemReward: (rewardCode: string) =>
    http('/rewards/redeem', {
      method: 'POST',
      body: { code: rewardCode },
    }),
};