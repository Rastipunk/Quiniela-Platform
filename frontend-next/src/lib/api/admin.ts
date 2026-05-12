// Admin API — platform settings, feedback management
import { requestJson } from "./client";
import { getToken } from "../auth";

// Admin email settings
export type PlatformEmailSettings = {
  emailWelcomeEnabled: boolean;
  emailDeadlineReminderEnabled: boolean;
  emailResultPublishedEnabled: boolean;
  emailPoolCompletedEnabled: boolean;
};

export type AdminEmailSettingsResponse = {
  settings: PlatformEmailSettings;
  metadata: {
    updatedAt: string;
    updatedBy: { displayName: string; email: string } | null;
  };
};

export async function getAdminEmailSettings(token: string): Promise<AdminEmailSettingsResponse> {
  return requestJson("/admin/settings/email", { method: "GET" });
}

export async function updateAdminEmailSettings(
  token: string,
  settings: Partial<PlatformEmailSettings>
): Promise<{
  message: string;
  settings: PlatformEmailSettings;
  changes: Record<string, { from: boolean; to: boolean }>;
}> {
  return requestJson("/admin/settings/email", { method: "PUT", body: JSON.stringify(settings) });
}

// Feedback
export type BetaFeedbackItem = {
  id: string;
  type: "BUG" | "SUGGESTION";
  message: string;
  imageBase64: string | null;
  wantsContact: boolean;
  contactName: string | null;
  phoneNumber: string | null;
  userId: string | null;
  userEmail: string | null;
  currentUrl: string | null;
  userAgent: string | null;
  createdAtUtc: string;
};

export type AdminFeedbackResponse = {
  feedbacks: BetaFeedbackItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getAdminFeedback(
  token: string,
  params?: { type?: string; wantsContact?: string; page?: number; limit?: number }
): Promise<AdminFeedbackResponse> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.wantsContact) q.set("wantsContact", params.wantsContact);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return requestJson<AdminFeedbackResponse>(`/feedback/admin${qs}`, { method: "GET" });
}

export async function submitFeedback(
  type: "BUG" | "SUGGESTION",
  message: string,
  imageBase64?: string,
  wantsContact?: boolean,
  contactName?: string,
  phoneNumber?: string
): Promise<{ success: boolean; message: string; id: string }> {
  const token = typeof window !== "undefined" ? getToken() : null;
  return requestJson<{ success: boolean; message: string; id: string }>(
    "/feedback",
    {
      method: "POST",
      body: JSON.stringify({
        type,
        message,
        imageBase64,
        wantsContact: wantsContact ?? false,
        contactName,
        phoneNumber,
        currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    },
  );
}

// ─── Analytics dashboard ────────────────────────────────────

export interface AnalyticsTopLineKPIs {
  totalUsers: number;
  verifiedUsers: number;
  googleSignups: number;
  marketingOptIns: number;
  predictionSubscribers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalPools: number;
  draftPools: number;
  activePools: number;
  completedPools: number;
  archivedPools: number;
  personalPools: number;
  corporatePools: number;
  totalOrganizations: number;
  pendingInquiries: number;
  totalCorporateInvites: number;
  activatedInvites: number;
  inviteActivationRate: number;
  totalRevenueUsd: number; // cents
  totalRevenueCop: number; // pesos
  pendingApprovalMembers: number;
  totalMatchPicks: number;
  totalStructuralPicks: number;
  /** Estratega group-ordering picks. Reported separately from
   *  totalStructuralPicks (knockout winners) because hosts' UX
   *  treats them as distinct. */
  totalGroupStandingsPicks: number;
  /** Sum of all three pick tables — the single engagement signal. */
  totalPicks: number;
}

export interface AnalyticsDashboardResponse {
  generatedAtUtc: string;
  cacheTtlSeconds: number;
  cached: boolean;
  topLine: AnalyticsTopLineKPIs;
  signupsByWeek: { weekStart: string; total: number; verified: number; google: number; referred: number }[];
  poolsByWeek: { weekStart: string; total: number; personal: number; corporate: number }[];
  picksByWeek: { weekStart: string; matchPicks: number; structuralPicks: number; groupStandingsPicks: number }[];
  revenueByWeek: { weekStart: string; paidPaymentsCount: number; revenueUsdMinor: number; revenueCop: number }[];
  dailyActiveUsers: { day: string; uniqueActiveUsers: number; picksCount: number }[];
  usersByCountry: { country: string; count: number; pct: number }[];
  poolsByStatus: { status: string; count: number }[];
  poolsByTournament: { name: string; templateKey: string | null; poolCount: number; avgMembers: number }[];
  poolSizeDistribution: { range: string; count: number }[];
  funnel: {
    signups: number;
    joinedPool: number;
    madePick: number;
    joinedRate: number;
    pickRateOfJoiners: number;
    pickRateOfSignups: number;
  };
  corporateFunnel: {
    inquiries: number;
    respondedInquiries: number;
    organizationsActive: number;
    corporatePools: number;
    invitesTotal: number;
    invitesSent: number;
    invitesActivated: number;
    invitesExpired: number;
    invitesFailed: number;
    responseRate: number;
    activationRate: number;
  };
  topAcquisition: { source: string; medium: string; count: number }[];
  organicReferrals: {
    totalReferred: number;
    topReferrers: { userId: string; displayName: string; referralCount: number }[];
  };
  recentInquiries: {
    createdAtUtc: string;
    companyName: string;
    contactEmail: string;
    country: string | null;
    currency: string | null;
    numberOfPools: number | null;
    slotsPerPool: number | null;
    responded: boolean;
    responseLagHours: number | null;
  }[];
  topOrganizations: {
    id: string;
    name: string;
    status: string;
    createdAtUtc: string;
    poolCount: number;
    invitesTotal: number;
    invitesActivated: number;
    activationRate: number;
  }[];
  poolHealth: {
    zombiePools: number;
    poolsWithNoMembers: number;
    emptyDraftsOlderThan30Days: number;
    fullPools: number;
  };
  cohortRetention: {
    cohortWeekStart: string;
    cohortSize: number;
    retainedW1: number;
    retainedW2: number;
    retainedW4: number;
  }[];
  paymentBreakdown: {
    totalCheckoutsStarted: number;
    totalCheckoutsCompleted: number;
    totalCheckoutsFailed: number;
    conversionRate: number;
    byProvider: { provider: string; count: number; revenueLocalUnits: number }[];
    byTier: { fromCapacity: number; toCapacity: number; count: number }[];
    avgPaymentUsd: number;
    avgPaymentCop: number;
  };
  operationalHealth: {
    emailSuppressions: number;
    failedAnalyticsEvents: number;
    recentFeedback: { id: string; type: string; message: string; createdAtUtc: string }[];
    auditEventsLast24h: number;
  };
  errors: { section: string; message: string }[];
}

export async function getAdminAnalyticsDashboard(
  forceRefresh = false,
): Promise<AnalyticsDashboardResponse> {
  const path = `/admin/analytics/dashboard${forceRefresh ? "?refresh=true" : ""}`;
  return requestJson<AnalyticsDashboardResponse>(path, { method: "GET" });
}
