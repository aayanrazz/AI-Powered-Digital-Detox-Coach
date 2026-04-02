import { http } from './http';
import {
  AnalyticsData,
  AppLimitItem,
  AppLimitStatusItem,
  BadgeDisplayItem,
  DashboardData,
  DetoxPlan,
  DetoxPlanDay,
  DetoxTask,
  LoginPayload,
  NextBadgeHint,
  NotificationItem,
  PlanTaskCompletion,
  RegisterPayload,
  RewardsSummary,
  SettingsData,
  UsageApp,
  User,
} from '../types';

type RiskLevel = 'low' | 'medium' | 'high';
type AnalyticsRange = 'day' | 'week' | 'month';
type DatasetFormat = 'json' | 'csv';

type DatasetSessionRow = {
  recordId: string;
  dayToken: string;
  relativeDayIndex: number;
  weekday: string;
  hourBucket: number;
  appToken: string;
  category: string;
  durationMinutes: number;
  pickups: number;
  unlocks: number;
  isLateNight: number;
  platform: string;
  source: string;
  riskLevel: string;
  behaviorLabel: string;
  isAddictiveBehaviorEpisode: number;
};

type DatasetEpisodeLabel = {
  episodeId: string;
  dayToken: string;
  relativeDayIndex: number;
  weekday: string;
  totalScreenMinutes: number;
  socialMinutes: number;
  productivityMinutes: number;
  lateNightMinutes: number;
  pickups: number;
  unlocks: number;
  dailyLimitMinutes: number;
  overLimitMinutes: number;
  detoxScore: number;
  riskLevel: string;
  behaviorLabel: string;
  isAddictiveBehaviorEpisode: number;
  reasons: string;
};

type PrivacyPolicySection = {
  title: string;
  items: string[];
};

type PrivacySettingsPayload = {
  dataCollection: boolean;
  anonymizeData: boolean;
  allowAnalyticsForTraining: boolean;
  retentionDays: number;
  consentGiven: boolean;
  consentVersion: string;
  consentedAt: string | null;
  policyLastViewedAt: string | null;
  deletionRequestedAt: string | null;
};

type PrivacyPolicyPayload = {
  version: string;
  updatedAt: string;
  summary: string[];
  sections: PrivacyPolicySection[];
  retentionOptions: number[];
  securityPractices: string[];
  currentPrivacySettings: PrivacySettingsPayload;
};

type UsageIngestSyncMeta = {
  sessionsReceived?: number;
  sessionsNormalized?: number;
  dayKey?: string | null;
  skippedDueToPrivacy?: boolean;
  privacy?: {
    settingsFound?: boolean;
    consentGiven?: boolean;
    dataCollection?: boolean;
    anonymizeData?: boolean;
    allowAnalyticsForTraining?: boolean;
    retentionDays?: number;
    allowServerSync?: boolean;
  };
};

type UsageIngestApiResponse = {
  success: boolean;
  message: string;
  syncedCount?: number;
  syncMeta?: UsageIngestSyncMeta;
  analysis?: any;
  notificationMeta?: any;
  topApps?: any[];
  appLimitSummary?: {
    monitoredApps?: any[];
    exceededApps?: any[];
    exceededCount?: number;
    topExceededApp?: any;
  };
};

const deriveRiskLevel = (score?: number | null): RiskLevel => {
  if (score === undefined || score === null) return 'low';
  if (score < 45) return 'high';
  if (score < 70) return 'medium';
  return 'low';
};

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const mapLimitStatusFromBackend = (
  items: any[] = []
): AppLimitStatusItem[] =>
  items.map((item) => ({
    appName: item.appName,
    appPackage: item.appPackage,
    category: item.category,
    usedMinutes: Number(item.usedMinutes ?? 0),
    dailyLimitMinutes: Number(item.dailyLimitMinutes ?? 0),
    exceededMinutes: Number(item.exceededMinutes ?? 0),
    remainingMinutes: Number(item.remainingMinutes ?? 0),
    isExceeded: Boolean(item.isExceeded),
  }));

const mapBadgeFromBackend = (item: any): BadgeDisplayItem => ({
  key: item?.key ?? '',
  label: item?.label ?? '',
  emoji: item?.emoji ?? '🏅',
  description: item?.description ?? 'Achievement unlocked.',
  earnedAt: item?.earnedAt ?? null,
});

const mapNextBadgeHintFromBackend = (item: any): NextBadgeHint | null => {
  if (!item) {
    return null;
  }

  return {
    key: item?.key ?? '',
    label: item?.label ?? '',
    emoji: item?.emoji ?? '🏅',
    description: item?.description ?? '',
    hint: item?.hint ?? '',
  };
};

const mapDetoxTaskFromBackend = (item: any): DetoxTask => ({
  _id: item?._id,
  title: item?.title ?? '',
  type: item?.type ?? 'habit',
  status: item?.status ?? 'pending',
  targetTime: item?.targetTime ?? '',
  completedAt: item?.completedAt ?? null,
  pointsReward: Number(item?.pointsReward ?? 0),
});

const mapDetoxPlanDayFromBackend = (item: any): DetoxPlanDay => ({
  dayNumber: Number(item?.dayNumber ?? 0),
  date: item?.date,
  targetLimitMinutes: Number(item?.targetLimitMinutes ?? 0),
  status: item?.status ?? 'pending',
  tasks: Array.isArray(item?.tasks)
    ? item.tasks.map((task: any) => mapDetoxTaskFromBackend(task))
    : [],
  totalTasks: Number(item?.totalTasks ?? item?.tasks?.length ?? 0),
  completedTasks: Number(item?.completedTasks ?? 0),
  progressPct: Number(item?.progressPct ?? 0),
});

const mapDetoxPlanFromBackend = (item: any): DetoxPlan | null => {
  if (!item) return null;

  const days = Array.isArray(item?.days)
    ? item.days.map((day: any) => mapDetoxPlanDayFromBackend(day))
    : [];

  return {
    _id: item?._id,
    startDate: item?.startDate,
    endDate: item?.endDate,
    durationDays: Number(item?.durationDays ?? 0),
    targetDailyLimitMinutes: Number(item?.targetDailyLimitMinutes ?? 0),
    aiInsight: item?.aiInsight ?? '',
    planSummary: item?.planSummary ?? '',
    active: Boolean(item?.active),
    days,
    totalDays: Number(item?.totalDays ?? days.length),
    completedDays: Number(item?.completedDays ?? 0),
    pendingDays: Number(item?.pendingDays ?? 0),
    totalTasks: Number(item?.totalTasks ?? 0),
    completedTasks: Number(item?.completedTasks ?? 0),
    overallProgressPct: Number(item?.overallProgressPct ?? 0),
    currentDayNumber:
      item?.currentDayNumber === null || item?.currentDayNumber === undefined
        ? null
        : Number(item.currentDayNumber),
    status: item?.status ?? 'active',
  };
};

const mapPlanTaskCompletionFromBackend = (
  item: any
): PlanTaskCompletion | undefined => {
  if (!item) return undefined;

  return {
    taskTitle: item?.taskTitle ?? '',
    taskType: item?.taskType ?? 'habit',
    basePointsEarned: Number(item?.basePointsEarned ?? 0),
    dayBonusPoints: Number(item?.dayBonusPoints ?? 0),
    planBonusPoints: Number(item?.planBonusPoints ?? 0),
    totalPointsEarned: Number(item?.totalPointsEarned ?? 0),
    dayCompleted: Boolean(item?.dayCompleted),
    planCompleted: Boolean(item?.planCompleted),
    completedDayNumber:
      item?.completedDayNumber === null || item?.completedDayNumber === undefined
        ? null
        : Number(item?.completedDayNumber),
  };
};

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

const mapAnalyticsFromBackend = (
  analytics: any,
  range: AnalyticsRange,
  insights: string[] = []
): AnalyticsData => ({
  focusScore: Number(analytics?.score ?? 0),
  totalUsageMinutes: Number(analytics?.totalScreenMinutes ?? 0),
  averageDailyMinutes: Number(analytics?.averageDailyMinutes ?? 0),
  pickupCount: Number(analytics?.pickups ?? 0),
  unlockCount: Number(analytics?.unlocks ?? 0),
  lateNightMinutes: Number(analytics?.lateNightMinutes ?? 0),
  peakHour: Number(analytics?.peakHour ?? 0),
  peakHourLabel:
    analytics?.peakHourLabel ??
    `${String(Number(analytics?.peakHour ?? 0)).padStart(2, '0')}:00`,
  trendLabel:
    analytics?.trendLabel ?? (range === 'day' ? 'Hourly Usage' : 'Daily Usage'),
  trendPoints: Array.isArray(analytics?.trendPoints)
    ? analytics.trendPoints.map((item: any) => ({
        label: item.label,
        shortLabel: item.shortLabel,
        minutes: Number(item.minutes ?? 0),
      }))
    : [],
  weeklyTrend:
    analytics?.comparison?.summary ||
    insights[0] ||
    'Your recent usage trend is being analyzed.',
  recommendations: insights,
  riskLevel: analytics?.riskLevel ?? deriveRiskLevel(analytics?.score),
  categoryBreakdown: Array.isArray(analytics?.categoryBreakdown)
    ? analytics.categoryBreakdown.map((item: any) => ({
        category: item.category,
        minutes: Number(item.minutes ?? 0),
        sharePct: Number(item.sharePct ?? 0),
      }))
    : [],
  comparison: analytics?.comparison
    ? {
        usageChangePct: Number(analytics.comparison.usageChangePct ?? 0),
        pickupChangePct: Number(analytics.comparison.pickupChangePct ?? 0),
        unlockChangePct: Number(analytics.comparison.unlockChangePct ?? 0),
        direction: analytics.comparison.direction ?? 'steady',
        summary: analytics.comparison.summary ?? '',
      }
    : undefined,
  totalActiveDays: Number(analytics?.totalActiveDays ?? 0),
  bestDayLabel: analytics?.bestDayLabel ?? '',
  worstDayLabel: analytics?.worstDayLabel ?? '',
});

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
        riskLevel:
          dashboard.riskLevel ?? deriveRiskLevel(dashboard.digitalWellnessScore),
        unreadNotifications: Number(dashboard.unreadNotifications ?? 0),
        dailyGoal: Number(dashboard.dailyGoal ?? 0),
        dailyChallenge: dashboard.dailyChallenge ?? '',
        aiRecommendations: Array.isArray(dashboard.aiRecommendations)
          ? dashboard.aiRecommendations
          : [],

        overLimitAppsCount: Number(dashboard.overLimitAppsCount ?? 0),
        topExceededAppName: dashboard.topExceededAppName ?? '',
        topExceededMinutes: Number(dashboard.topExceededMinutes ?? 0),
        interventionMessage: dashboard.interventionMessage ?? '',

        currentLevelNumber: Number(dashboard.currentLevelNumber ?? 1),
        currentLevelTitle: dashboard.currentLevelTitle ?? 'Mindful Seed',
        progressPct: Number(dashboard.progressPct ?? 0),
        pointsToNextLevel: Number(dashboard.pointsToNextLevel ?? 0),

        badgesCount: Number(dashboard.badgesCount ?? 0),
        latestBadgeLabel: dashboard.latestBadgeLabel ?? '',
        latestBadgeEmoji: dashboard.latestBadgeEmoji ?? '',
        nextBadgeHintText: dashboard.nextBadgeHintText ?? '',
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

  async getPrivacyPolicy(): Promise<{ policy: PrivacyPolicyPayload }> {
    const res = await http<{ policy: PrivacyPolicyPayload }>('/privacy/policy');
    return res;
  },

  async savePrivacyConsent(payload: {
    consentGiven: boolean;
    dataCollection: boolean;
    anonymizeData: boolean;
    allowAnalyticsForTraining: boolean;
    retentionDays: number;
  }): Promise<{
    message: string;
    privacySettings: PrivacySettingsPayload;
  }> {
    return http<{
      message: string;
      privacySettings: PrivacySettingsPayload;
    }>('/privacy/consent', {
      method: 'PUT',
      body: payload,
    });
  },

  async deleteMyData(): Promise<{
    message: string;
    deleted: {
      usageSessions: boolean;
      appLimits: boolean;
      notifications: boolean;
    };
    privacySettings: PrivacySettingsPayload;
  }> {
    return http<{
      message: string;
      deleted: {
        usageSessions: boolean;
        appLimits: boolean;
        notifications: boolean;
      };
      privacySettings: PrivacySettingsPayload;
    }>('/privacy/delete-my-data', {
      method: 'DELETE',
    });
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

  deleteAppLimit: (appPackage: string) =>
    http(`/settings/app-limits/${encodeURIComponent(appPackage)}`, {
      method: 'DELETE',
    }),

  ingestUsage: async (payload: { apps: UsageApp[] }) => {
    const res = await http<UsageIngestApiResponse>('/usage/ingest', {
      method: 'POST',
      body: { sessions: mapUsageAppsToSessions(payload.apps) },
    });

    const skippedDueToPrivacy = Boolean(res.syncMeta?.skippedDueToPrivacy);
    const syncedCount = skippedDueToPrivacy
      ? 0
      : toSafeNumber(
          res.syncMeta?.sessionsNormalized ?? res.syncedCount,
          0
        );

    return {
      success: Boolean(res.success),
      message: res.message ?? '',
      syncedCount,
      skippedDueToPrivacy,
      dayKey: res.syncMeta?.dayKey ?? null,
      privacy: res.syncMeta?.privacy,
      analysis: res.analysis,
      notificationMeta: res.notificationMeta,
      appLimitSummary: {
        monitoredApps: mapLimitStatusFromBackend(
          res.appLimitSummary?.monitoredApps || []
        ),
        exceededApps: mapLimitStatusFromBackend(
          res.appLimitSummary?.exceededApps || []
        ),
        exceededCount: Number(res.appLimitSummary?.exceededCount ?? 0),
      },
    };
  },

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
    range: AnalyticsRange = 'week'
  ): Promise<{ analytics: AnalyticsData }> {
    const res = await http<{ analytics: any; insights?: string[] }>(
      `/analytics/summary?range=${range}`
    );

    const insights = Array.isArray(res.insights) ? res.insights : [];

    return {
      analytics: mapAnalyticsFromBackend(res.analytics || {}, range, insights),
    };
  },

  async exportAnalyticsReport(
    range: AnalyticsRange = 'month'
  ): Promise<{
    generatedAt: string;
    report: {
      range: AnalyticsRange;
      analytics: AnalyticsData;
      insights: string[];
    };
  }> {
    const res = await http<{
      generatedAt?: string;
      report?: {
        range?: AnalyticsRange;
        analytics?: any;
        insights?: string[];
      };
    }>(`/analytics/export?range=${range}`);

    const reportRange = (res.report?.range || range) as AnalyticsRange;
    const insights = Array.isArray(res.report?.insights)
      ? res.report?.insights
      : [];

    return {
      generatedAt: res.generatedAt
        ? new Date(res.generatedAt).toISOString()
        : new Date().toISOString(),
      report: {
        range: reportRange,
        analytics: mapAnalyticsFromBackend(
          res.report?.analytics || {},
          reportRange,
          insights
        ),
        insights,
      },
    };
  },

  async exportAnonymizedDataset(
    range: AnalyticsRange = 'month',
    format: DatasetFormat = 'json'
  ): Promise<{
    generatedAt: string;
    dataset: {
      range: AnalyticsRange;
      format: DatasetFormat;
      summary: {
        sessionCount: number;
        episodeCount: number;
        dailyLimitMinutes: number;
        includesAppNames: boolean;
        includesPersonalIdentity: boolean;
        exportNotes: string[];
      };
      sessionRows: DatasetSessionRow[];
      episodeLabels: DatasetEpisodeLabel[];
      sessionRowsCsv: string;
      episodeLabelsCsv: string;
    };
  }> {
    const res = await http<{
      generatedAt?: string;
      dataset?: {
        range?: AnalyticsRange;
        format?: DatasetFormat;
        summary?: {
          sessionCount?: number;
          episodeCount?: number;
          dailyLimitMinutes?: number;
          includesAppNames?: boolean;
          includesPersonalIdentity?: boolean;
          exportNotes?: string[];
        };
        sessionRows?: DatasetSessionRow[];
        episodeLabels?: DatasetEpisodeLabel[];
        sessionRowsCsv?: string;
        episodeLabelsCsv?: string;
      };
    }>(`/analytics/export-dataset?range=${range}&format=${format}`);

    return {
      generatedAt: res.generatedAt
        ? new Date(res.generatedAt).toISOString()
        : new Date().toISOString(),
      dataset: {
        range: (res.dataset?.range || range) as AnalyticsRange,
        format: (res.dataset?.format || format) as DatasetFormat,
        summary: {
          sessionCount: Number(res.dataset?.summary?.sessionCount ?? 0),
          episodeCount: Number(res.dataset?.summary?.episodeCount ?? 0),
          dailyLimitMinutes: Number(res.dataset?.summary?.dailyLimitMinutes ?? 0),
          includesAppNames: Boolean(res.dataset?.summary?.includesAppNames),
          includesPersonalIdentity: Boolean(
            res.dataset?.summary?.includesPersonalIdentity
          ),
          exportNotes: Array.isArray(res.dataset?.summary?.exportNotes)
            ? res.dataset?.summary?.exportNotes
            : [],
        },
        sessionRows: Array.isArray(res.dataset?.sessionRows)
          ? res.dataset?.sessionRows
          : [],
        episodeLabels: Array.isArray(res.dataset?.episodeLabels)
          ? res.dataset?.episodeLabels
          : [],
        sessionRowsCsv: res.dataset?.sessionRowsCsv ?? '',
        episodeLabelsCsv: res.dataset?.episodeLabelsCsv ?? '',
      },
    };
  },

  generateDetoxPlan: async () => {
    const res = await http<{ plan: any }>('/detox-plans/generate', {
      method: 'POST',
    });

    return {
      plan: mapDetoxPlanFromBackend(res.plan),
    };
  },

  getActivePlan: async () => {
    const res = await http<{ plan: any | null }>('/detox-plans/active');

    return {
      plan: mapDetoxPlanFromBackend(res.plan),
    };
  },

  completePlanTask: async (planId: string, taskId: string) => {
    const res = await http<{
      plan: any;
      user?: User & {
        progressPct?: number;
        pointsToNextLevel?: number;
      };
      newBadges?: string[];
      completion?: any;
    }>(`/detox-plans/${planId}/tasks/${taskId}/complete`, {
      method: 'PATCH',
    });

    return {
      plan: mapDetoxPlanFromBackend(res.plan),
      user: res.user,
      newBadges: Array.isArray(res.newBadges) ? res.newBadges : [],
      completion: mapPlanTaskCompletionFromBackend(res.completion),
    };
  },

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
        badges: Array.isArray(res.badges)
          ? res.badges.map((item: any) => mapBadgeFromBackend(item))
          : [],
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
        unlockedBadgesCount: Number(res.badgeStats?.unlockedCount ?? 0),
        totalBadges: Number(res.badgeStats?.totalBadges ?? 0),
        badgeCompletionPct: Number(res.badgeStats?.completionPct ?? 0),
        latestBadge: res.latestBadge ? mapBadgeFromBackend(res.latestBadge) : null,
        nextBadgeHint: mapNextBadgeHintFromBackend(res.nextBadgeHint),
      },
    };
  },

  redeemReward: (rewardCode: string) =>
    http('/rewards/redeem', {
      method: 'POST',
      body: { code: rewardCode },
    }),
};