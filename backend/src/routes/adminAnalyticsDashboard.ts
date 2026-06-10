/**
 * Admin Analytics Dashboard
 *
 * Single platform-wide growth & health endpoint, admin-only.
 *
 * Each section's query bundle is wrapped in `safeRun` so a failure
 * in one corner of the dashboard (a busted SQL fragment, a model
 * field that drifted) doesn't take down the whole thing — the
 * payload still arrives with sensible defaults for the broken
 * sections, and the names of the failed sections come back in the
 * `errors` array for the UI to surface.
 *
 * GET /admin/analytics/dashboard
 *   Authorization: Bearer <admin JWT>
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { sendData, sendInternal } from "../lib/apiResponse";
import { prisma } from "../db";

export const adminAnalyticsDashboardRouter = Router();

// ─── Cache ──────────────────────────────────────────────────
// Stale-while-revalidate: a fresh cache (< CACHE_TTL_MS) is served
// as-is; a stale one is STILL served instantly while a background
// rebuild refreshes it. User latency is thus decoupled from build
// time — under WC-eve DB load a cold build measured 40 s, well past
// the frontend's 30 s request timeout, so blocking on the build means
// a guaranteed timeout for whoever loses the cache race.

const CACHE_TTL_MS = parseInt(process.env.ADMIN_DASHBOARD_CACHE_TTL_MS || "300000", 10); // 5 min fresh
let cache: { data: DashboardPayload; timestamp: number } | null = null;

// ─── Types ──────────────────────────────────────────────────

interface DashboardPayload {
  generatedAtUtc: string;
  cacheTtlSeconds: number;
  errors: { section: string; message: string }[];
  topLine: TopLineKPIs;
  /**
   * Subset of TopLineKPIs captured 7 days ago for the same field
   * definitions. Frontend computes Δ inline so a single payload covers
   * "where we are" + "how we moved this week". Fields that depend on
   * point-in-time state we don't snapshot (pendingApprovalMembers,
   * draftPools, etc.) are intentionally omitted.
   */
  topLineWeekAgo: TopLineWeekAgo;
  signupsByWeek: WeeklySignups[];
  poolsByWeek: WeeklyPools[];
  picksByWeek: WeeklyPicks[];
  revenueByWeek: WeeklyRevenue[];
  dailyActiveUsers: DailyActive[];
  usersByCountry: CountryRow[];
  poolsByStatus: { status: string; count: number }[];
  poolsByTournament: TournamentRow[];
  poolSizeDistribution: { range: string; count: number }[];
  /**
   * Per-locale user counts plus the "pending modal" bucket (User.locale
   * is null until the first-login locale prompt is submitted). Drives
   * the new locale-distribution panel that surfaces modal completion
   * rate as a side effect.
   */
  localeDistribution: LocaleRow[];
  funnel: ActivationFunnel;
  corporateFunnel: CorporateFunnel;
  topAcquisition: AcquisitionRow[];
  acquisitionFunnel: AcquisitionFunnelRow[];
  cohortActivation: CohortActivationRow[];
  organicReferrals: { totalReferred: number; topReferrers: TopReferrer[] };
  recentInquiries: InquiryRow[];
  topOrganizations: OrgRow[];
  poolHealth: PoolHealth;
  cohortRetention: CohortRow[];
  paymentBreakdown: PaymentBreakdown;
  operationalHealth: OperationalHealth;
  communicationsHealth: CommunicationsHealth;
  engagementSignals: EngagementSignals;
}

interface TopLineWeekAgo {
  totalUsers: number;
  verifiedUsers: number;
  googleSignups: number;
  activeUsers7d: number;
  totalPools: number;
  activePools: number;
  totalPicks: number;
  totalRevenueUsd: number;
  totalRevenueCop: number;
  totalCorporateInvites: number;
  activatedInvites: number;
}

interface LocaleRow {
  /** "es" | "en" | "pt" | "pending" (modal not completed) */
  locale: string;
  count: number;
  pct: number;
}

interface TopLineKPIs {
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
  totalRevenueUsd: number;
  totalRevenueCop: number;
  pendingApprovalMembers: number;
  totalMatchPicks: number;
  totalStructuralPicks: number;
  /** Estratega-mode group standing predictions (the most common Estratega
   *  pick type). Was missing pre-fix, biasing every "pick volume" KPI down. */
  totalGroupStandingsPicks: number;
  /** Sum of all three pick tables — the single number that reflects engagement. */
  totalPicks: number;
}

interface WeeklySignups {
  weekStart: string;
  total: number;
  verified: number;
  google: number;
  referred: number;
}
interface WeeklyPools {
  weekStart: string;
  total: number;
  personal: number;
  corporate: number;
}
interface WeeklyPicks {
  weekStart: string;
  matchPicks: number;
  structuralPicks: number;
  groupStandingsPicks: number;
}
interface WeeklyRevenue {
  weekStart: string;
  paidPaymentsCount: number;
  revenueUsdMinor: number;
  revenueCop: number;
}
interface DailyActive {
  day: string;
  uniqueActiveUsers: number;
  picksCount: number;
}
interface CountryRow {
  country: string;
  count: number;
  pct: number;
}
interface TournamentRow {
  name: string;
  templateKey: string | null;
  poolCount: number;
  avgMembers: number;
}
interface ActivationFunnel {
  signups: number;
  joinedPool: number;
  madePick: number;
  joinedRate: number;
  pickRateOfJoiners: number;
  pickRateOfSignups: number;
}
interface CorporateFunnel {
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
}
interface AcquisitionRow {
  source: string;
  medium: string;
  count: number;
}

/**
 * Per-channel activation funnel. Tells the manager not just "how many
 * users does each channel send us" but "how many of those actually
 * activated". A 1000-user channel with 5% activation may be worse than
 * a 200-user channel with 40% activation.
 */
interface AcquisitionFunnelRow {
  source: string;
  medium: string;
  signups: number;
  joinedPool: number;
  madePick: number;
  pickRate: number;
}

/**
 * Per-cohort onboarding velocity. cohortActivationW2 = the % of users
 * who signed up that week and made at least one pick within their first
 * 14 days. This is the single number to optimize the signup → first-pick
 * flow against.
 */
interface CohortActivationRow {
  cohortWeekStart: string;
  cohortSize: number;
  joinedWithin2w: number;
  pickedWithin2w: number;
  joinedRate: number;
  pickedRate: number;
  inProgress: boolean;
}
interface TopReferrer {
  userId: string;
  displayName: string;
  referralCount: number;
}
interface InquiryRow {
  createdAtUtc: string;
  companyName: string;
  contactEmail: string;
  country: string | null;
  currency: string | null;
  numberOfPools: number | null;
  slotsPerPool: number | null;
  responded: boolean;
  responseLagHours: number | null;
}
interface OrgRow {
  id: string;
  name: string;
  status: string;
  createdAtUtc: string;
  poolCount: number;
  invitesTotal: number;
  invitesActivated: number;
  activationRate: number;
}
interface PoolHealth {
  zombiePools: number;
  poolsWithNoMembers: number;
  emptyDraftsOlderThan30Days: number;
  fullPools: number;
}
interface CohortRow {
  cohortWeekStart: string;
  cohortSize: number;
  retainedW1: number;
  retainedW2: number;
  retainedW4: number;
  /**
   * Marker for retention buckets whose measurement window has not yet
   * closed for this cohort. e.g. a 5-day-old cohort cannot have a
   * legitimate W4 retention value (it has not lived through week 4).
   * The frontend renders these as "en curso" instead of "0%".
   */
  inProgressW1: boolean;
  inProgressW2: boolean;
  inProgressW4: boolean;
}
interface PaymentBreakdown {
  totalCheckoutsStarted: number;
  totalCheckoutsCompleted: number;
  totalCheckoutsFailed: number;
  conversionRate: number;
  byProvider: { provider: string; count: number; revenueLocalUnits: number }[];
  byTier: { fromCapacity: number; toCapacity: number; count: number }[];
  avgPaymentUsd: number;
  avgPaymentCop: number;
  /**
   * Per-status snapshot: lets the manager see where in the checkout
   * flow the leak is. The pre-fix dashboard only reported COMPLETED +
   * FAILED counts; abandoned checkouts (PENDING with no follow-up)
   * looked the same as users still mid-flow.
   */
  byStatus: { status: string; count: number }[];
  /**
   * PENDING checkouts older than 24h that never reached COMPLETED.
   * Single number: the size of the silent abandonment leak.
   */
  staleAbandonedCount: number;
  /**
   * Average minutes from PENDING (createdAtUtc) to COMPLETED
   * (paidAtUtc). High values flag slow conversion / friction.
   */
  avgTimeToPaymentMinutes: number | null;
}
interface OperationalHealth {
  emailSuppressions: number;
  failedAnalyticsEvents: number;
  recentFeedback: { id: string; type: string; message: string; createdAtUtc: string }[];
  auditEventsLast24h: number;
}

/**
 * Communications health — focused on the channels we use to reach
 * users and the signal we get back from them. Mostly trend-oriented
 * because absolute counters are already in operationalHealth.
 */
/**
 * Engagement signals — who's actively using the platform, which
 * hosts run the busiest pools, and which tournaments capture the most
 * activity. These rows surface "what's working" so the team can
 * support / replicate it.
 */
interface TopPlayerRow {
  userId: string;
  displayName: string;
  pickCount: number;
  poolCount: number;
}

interface TopHostRow {
  userId: string;
  displayName: string;
  poolsCreated: number;
  activePools: number;
  totalActiveMembers: number;
}

interface TournamentEngagementRow {
  tournamentName: string;
  templateKey: string | null;
  poolCount: number;
  totalActiveMembers: number;
  totalPicks: number;
  uniquePickers: number;
}

interface EngagementSignals {
  /** Top 10 by total picks made in the last 30 days (any table). */
  topPlayers30d: TopPlayerRow[];
  /** Top 10 hosts by total active members across their pools. */
  topHosts: TopHostRow[];
  /** Per-tournament engagement, sorted by total picks. */
  tournamentEngagement: TournamentEngagementRow[];
}

interface CommunicationsHealth {
  /** Daily completions of the first-login locale-preference modal,
   *  last 30 days. Captures the modal's pickup velocity. */
  localePromptCompletionsDaily: { day: string; count: number }[];
  /** % of users who have submitted the modal (over all users). */
  localePromptCompletionRate: number;
  /** Weekly new EmailSuppression rows (last 12 weeks). A spike is the
   *  earliest visible signal of a deliverability incident. */
  emailSuppressionsByWeek: { weekStart: string; count: number }[];
  /** Weekly BetaFeedback split by type — flags quality regression. */
  feedbackByWeek: { weekStart: string; bug: number; feature: number; other: number }[];
}

// ─── Section runner ─────────────────────────────────────────

type SectionError = { section: string; message: string };

/**
 * Builds a per-call section runner. The error collector is scoped to a
 * single buildDashboardData() invocation — a module-level array would
 * interleave (and reset) errors across concurrent builds.
 */
function makeSafeRun(errors: SectionError[]) {
  return async function safeRun<T>(section: string, fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[admin analytics] section "${section}" failed:`, err);
      errors.push({ section, message });
      return fallback;
    }
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Defaults ───────────────────────────────────────────────

const DEFAULT_TOP_LINE: TopLineKPIs = {
  totalUsers: 0,
  verifiedUsers: 0,
  googleSignups: 0,
  marketingOptIns: 0,
  predictionSubscribers: 0,
  activeUsers7d: 0,
  activeUsers30d: 0,
  totalPools: 0,
  draftPools: 0,
  activePools: 0,
  completedPools: 0,
  archivedPools: 0,
  personalPools: 0,
  corporatePools: 0,
  totalOrganizations: 0,
  pendingInquiries: 0,
  totalCorporateInvites: 0,
  activatedInvites: 0,
  inviteActivationRate: 0,
  totalRevenueUsd: 0,
  totalRevenueCop: 0,
  pendingApprovalMembers: 0,
  totalMatchPicks: 0,
  totalStructuralPicks: 0,
  totalGroupStandingsPicks: 0,
  totalPicks: 0,
};

const DEFAULT_FUNNEL: ActivationFunnel = {
  signups: 0,
  joinedPool: 0,
  madePick: 0,
  joinedRate: 0,
  pickRateOfJoiners: 0,
  pickRateOfSignups: 0,
};

const DEFAULT_CORPORATE_FUNNEL: CorporateFunnel = {
  inquiries: 0,
  respondedInquiries: 0,
  organizationsActive: 0,
  corporatePools: 0,
  invitesTotal: 0,
  invitesSent: 0,
  invitesActivated: 0,
  invitesExpired: 0,
  invitesFailed: 0,
  responseRate: 0,
  activationRate: 0,
};

const DEFAULT_POOL_HEALTH: PoolHealth = {
  zombiePools: 0,
  poolsWithNoMembers: 0,
  emptyDraftsOlderThan30Days: 0,
  fullPools: 0,
};

const DEFAULT_PAYMENT: PaymentBreakdown = {
  totalCheckoutsStarted: 0,
  totalCheckoutsCompleted: 0,
  totalCheckoutsFailed: 0,
  conversionRate: 0,
  byProvider: [],
  byTier: [],
  avgPaymentUsd: 0,
  avgPaymentCop: 0,
  byStatus: [],
  staleAbandonedCount: 0,
  avgTimeToPaymentMinutes: null,
};

const DEFAULT_OPERATIONAL: OperationalHealth = {
  emailSuppressions: 0,
  failedAnalyticsEvents: 0,
  recentFeedback: [],
  auditEventsLast24h: 0,
};

const DEFAULT_ENGAGEMENT: EngagementSignals = {
  topPlayers30d: [],
  topHosts: [],
  tournamentEngagement: [],
};

const DEFAULT_COMMUNICATIONS: CommunicationsHealth = {
  localePromptCompletionsDaily: [],
  localePromptCompletionRate: 0,
  emailSuppressionsByWeek: [],
  feedbackByWeek: [],
};

const DEFAULT_WEEK_AGO: TopLineWeekAgo = {
  totalUsers: 0,
  verifiedUsers: 0,
  googleSignups: 0,
  activeUsers7d: 0,
  totalPools: 0,
  activePools: 0,
  totalPicks: 0,
  totalRevenueUsd: 0,
  totalRevenueCop: 0,
  totalCorporateInvites: 0,
  activatedInvites: 0,
};

// ─── Builder ────────────────────────────────────────────────

async function buildDashboardData(): Promise<DashboardPayload> {
  const errors: SectionError[] = [];
  const safeRun = makeSafeRun(errors);
  const now = new Date();
  const day7Ago = new Date(now.getTime() - 7 * 86_400_000);
  const day30Ago = new Date(now.getTime() - 30 * 86_400_000);
  const day90Ago = new Date(now.getTime() - 90 * 86_400_000);

  // ── Top-line KPIs ───────────────────────────────────────
  const topLinePromise = safeRun<TopLineKPIs>("topLine", DEFAULT_TOP_LINE, async () => {
    const [
      totalUsers,
      verifiedUsers,
      googleSignups,
      marketingOptIns,
      predictionSubscribers,
      poolStatusCounts,
      corporatePoolCount,
      organizationCount,
      pendingInquiriesCount,
      inviteStatusCounts,
      totalMatchPicks,
      totalStructuralPicks,
      totalGroupStandingsPicks,
      pendingApprovalCount,
      activeUsers7dRows,
      activeUsers30dRows,
      revenueAggUsd,
      revenueAggCop,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { googleId: { not: null } } }),
      prisma.user.count({ where: { marketingConsent: true } }),
      prisma.user.count({ where: { predictionUpdates: true } }),
      prisma.pool.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.pool.count({ where: { organizationId: { not: null } } }),
      prisma.organization.count(),
      prisma.organizationInquiry.count({ where: { responded: false } }),
      prisma.corporateInvite.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.prediction.count(),
      prisma.structuralPrediction.count(),
      prisma.groupStandingsPrediction.count(),
      prisma.poolMember.count({ where: { status: "PENDING_APPROVAL" } }),
      // Active users = anyone who made ANY pick in the window. Pre-fix
      // this only counted "Prediction" (match picks), ignoring Estratega
      // users entirely — biasing both KPIs ~37% low at audit time.
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT u)::bigint AS count FROM (
          SELECT "userId" AS u FROM "Prediction" WHERE "createdAtUtc" >= ${day7Ago}
          UNION
          SELECT "userId" FROM "StructuralPrediction" WHERE "createdAtUtc" >= ${day7Ago}
          UNION
          SELECT "userId" FROM "GroupStandingsPrediction" WHERE "createdAtUtc" >= ${day7Ago}
        ) all_picks
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT u)::bigint AS count FROM (
          SELECT "userId" AS u FROM "Prediction" WHERE "createdAtUtc" >= ${day30Ago}
          UNION
          SELECT "userId" FROM "StructuralPrediction" WHERE "createdAtUtc" >= ${day30Ago}
          UNION
          SELECT "userId" FROM "GroupStandingsPrediction" WHERE "createdAtUtc" >= ${day30Ago}
        ) all_picks
      `,
      prisma.poolPayment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amountUsd: true },
      }),
      prisma.poolPayment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amountCop: true },
      }),
    ]);

    const totalPools = poolStatusCounts.reduce((s, g) => s + g._count._all, 0);
    const totalCorporateInvites = inviteStatusCounts.reduce((s, g) => s + g._count._all, 0);
    const activatedInvites = inviteStatusCounts.find((g) => g.status === "ACTIVATED")?._count._all ?? 0;

    return {
      totalUsers,
      verifiedUsers,
      googleSignups,
      marketingOptIns,
      predictionSubscribers,
      activeUsers7d: Number(activeUsers7dRows[0]?.count ?? 0),
      activeUsers30d: Number(activeUsers30dRows[0]?.count ?? 0),
      totalPools,
      draftPools: poolStatusCounts.find((g) => g.status === "DRAFT")?._count._all ?? 0,
      activePools: poolStatusCounts.find((g) => g.status === "ACTIVE")?._count._all ?? 0,
      completedPools: poolStatusCounts.find((g) => g.status === "COMPLETED")?._count._all ?? 0,
      archivedPools: poolStatusCounts.find((g) => g.status === "ARCHIVED")?._count._all ?? 0,
      personalPools: totalPools - corporatePoolCount,
      corporatePools: corporatePoolCount,
      totalOrganizations: organizationCount,
      pendingInquiries: pendingInquiriesCount,
      totalCorporateInvites,
      activatedInvites,
      inviteActivationRate: totalCorporateInvites > 0 ? activatedInvites / totalCorporateInvites : 0,
      totalRevenueUsd: revenueAggUsd._sum.amountUsd ?? 0,
      totalRevenueCop: revenueAggCop._sum.amountCop ?? 0,
      pendingApprovalMembers: pendingApprovalCount,
      totalMatchPicks,
      totalStructuralPicks,
      totalGroupStandingsPicks,
      totalPicks: totalMatchPicks + totalStructuralPicks + totalGroupStandingsPicks,
    };
  });

  // ── Top-line snapshot 7 days ago (for Δ vs current) ────
  // Each query mirrors a top-line metric but with the time clock rolled
  // back one week. Frontend computes the delta inline. Only cumulative /
  // windowed metrics are included — point-in-time fields like
  // pendingApprovalMembers don't have a meaningful "last week" value
  // without per-day snapshots, so they're left out on purpose.
  const topLineWeekAgoPromise = safeRun<TopLineWeekAgo>("topLineWeekAgo", DEFAULT_WEEK_AGO, async () => {
    const day14Ago = new Date(now.getTime() - 14 * 86_400_000);
    const [
      totalUsersBefore,
      verifiedUsersBefore,
      googleSignupsBefore,
      activeUsers7dBefore,
      poolsBefore,
      activePoolsBefore,
      matchPicksBefore,
      structuralPicksBefore,
      groupStandingsPicksBefore,
      revenueUsdBefore,
      revenueCopBefore,
      corporateInvitesBefore,
      activatedInvitesBefore,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAtUtc: { lt: day7Ago } } }),
      prisma.user.count({ where: { emailVerified: true, createdAtUtc: { lt: day7Ago } } }),
      prisma.user.count({ where: { googleId: { not: null }, createdAtUtc: { lt: day7Ago } } }),
      // "Active in the 7-day window ending one week ago" = picks in [day14Ago, day7Ago)
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT u)::bigint AS count FROM (
          SELECT "userId" AS u FROM "Prediction"
            WHERE "createdAtUtc" >= ${day14Ago} AND "createdAtUtc" < ${day7Ago}
          UNION
          SELECT "userId" FROM "StructuralPrediction"
            WHERE "createdAtUtc" >= ${day14Ago} AND "createdAtUtc" < ${day7Ago}
          UNION
          SELECT "userId" FROM "GroupStandingsPrediction"
            WHERE "createdAtUtc" >= ${day14Ago} AND "createdAtUtc" < ${day7Ago}
        ) ap
      `,
      prisma.pool.count({ where: { createdAtUtc: { lt: day7Ago } } }),
      prisma.pool.count({ where: { status: "ACTIVE", createdAtUtc: { lt: day7Ago } } }),
      prisma.prediction.count({ where: { createdAtUtc: { lt: day7Ago } } }),
      prisma.structuralPrediction.count({ where: { createdAtUtc: { lt: day7Ago } } }),
      prisma.groupStandingsPrediction.count({ where: { createdAtUtc: { lt: day7Ago } } }),
      prisma.poolPayment.aggregate({
        where: { status: "COMPLETED", paidAtUtc: { lt: day7Ago } },
        _sum: { amountUsd: true },
      }),
      prisma.poolPayment.aggregate({
        where: { status: "COMPLETED", paidAtUtc: { lt: day7Ago } },
        _sum: { amountCop: true },
      }),
      prisma.corporateInvite.count({ where: { createdAtUtc: { lt: day7Ago } } }),
      prisma.corporateInvite.count({ where: { activatedAt: { lt: day7Ago }, status: "ACTIVATED" } }),
    ]);
    return {
      totalUsers: totalUsersBefore,
      verifiedUsers: verifiedUsersBefore,
      googleSignups: googleSignupsBefore,
      activeUsers7d: Number(activeUsers7dBefore[0]?.count ?? 0),
      totalPools: poolsBefore,
      activePools: activePoolsBefore,
      totalPicks: matchPicksBefore + structuralPicksBefore + groupStandingsPicksBefore,
      totalRevenueUsd: revenueUsdBefore._sum.amountUsd ?? 0,
      totalRevenueCop: revenueCopBefore._sum.amountCop ?? 0,
      totalCorporateInvites: corporateInvitesBefore,
      activatedInvites: activatedInvitesBefore,
    };
  });

  // ── Locale distribution ─────────────────────────────────
  // Tracks both the chosen-language split AND the modal completion
  // rate (the count of `pending` is the population that still owes a
  // response to the first-login locale prompt).
  const localeDistributionPromise = safeRun<LocaleRow[]>("localeDistribution", [], async () => {
    const rows = await prisma.$queryRaw<{ locale: string | null; count: bigint }[]>`
      SELECT locale, COUNT(*)::bigint AS count
      FROM "User"
      GROUP BY locale
      ORDER BY count DESC
    `;
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    return rows.map((r) => ({
      locale: r.locale ?? "pending",
      count: Number(r.count),
      pct: total > 0 ? Number(r.count) / total : 0,
    }));
  });

  // ── Time series — last 12 weeks ────────────────────────
  const signupsByWeekPromise = safeRun<WeeklySignups[]>("signupsByWeek", [], async () => {
    const rows = await prisma.$queryRaw<
      { week_start: Date; total: bigint; verified: bigint; google: bigint; referred: bigint }[]
    >`
      SELECT date_trunc('week', "createdAtUtc") AS week_start,
             COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE "emailVerified")::bigint AS verified,
             COUNT(*) FILTER (WHERE "googleId" IS NOT NULL)::bigint AS google,
             COUNT(*) FILTER (WHERE "referredByUserId" IS NOT NULL)::bigint AS referred
      FROM "User"
      WHERE "createdAtUtc" >= ${day90Ago}
      GROUP BY week_start
      ORDER BY week_start
    `;
    return rows.map((r) => ({
      weekStart: isoDate(r.week_start),
      total: Number(r.total),
      verified: Number(r.verified),
      google: Number(r.google),
      referred: Number(r.referred),
    }));
  });

  const poolsByWeekPromise = safeRun<WeeklyPools[]>("poolsByWeek", [], async () => {
    const rows = await prisma.$queryRaw<
      { week_start: Date; total: bigint; personal: bigint; corporate: bigint }[]
    >`
      SELECT date_trunc('week', "createdAtUtc") AS week_start,
             COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE "organizationId" IS NULL)::bigint AS personal,
             COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL)::bigint AS corporate
      FROM "Pool"
      WHERE "createdAtUtc" >= ${day90Ago}
      GROUP BY week_start
      ORDER BY week_start
    `;
    return rows.map((r) => ({
      weekStart: isoDate(r.week_start),
      total: Number(r.total),
      personal: Number(r.personal),
      corporate: Number(r.corporate),
    }));
  });

  const picksByWeekPromise = safeRun<WeeklyPicks[]>("picksByWeek", [], async () => {
    // Three pick tables share the same time-axis. We collect a row per
    // week from each table, full-outer-join into a single timeline so
    // gaps in any single series don't drop the week. Pre-fix this only
    // tracked Prediction + StructuralPrediction — Estratega's main pick
    // type (GroupStandingsPrediction) was completely invisible on the
    // chart, which is misleading once Estratega pools grow.
    const rows = await prisma.$queryRaw<
      { week_start: Date; match_picks: bigint; structural_picks: bigint; group_standings_picks: bigint }[]
    >`
      WITH match_p AS (
        SELECT date_trunc('week', "createdAtUtc") AS week_start, COUNT(*)::bigint AS c
        FROM "Prediction"
        WHERE "createdAtUtc" >= ${day90Ago}
        GROUP BY week_start
      ),
      struct_p AS (
        SELECT date_trunc('week', "createdAtUtc") AS week_start, COUNT(*)::bigint AS c
        FROM "StructuralPrediction"
        WHERE "createdAtUtc" >= ${day90Ago}
        GROUP BY week_start
      ),
      group_p AS (
        SELECT date_trunc('week', "createdAtUtc") AS week_start, COUNT(*)::bigint AS c
        FROM "GroupStandingsPrediction"
        WHERE "createdAtUtc" >= ${day90Ago}
        GROUP BY week_start
      ),
      weeks AS (
        SELECT week_start FROM match_p
        UNION SELECT week_start FROM struct_p
        UNION SELECT week_start FROM group_p
      )
      SELECT w.week_start,
             COALESCE(m.c, 0) AS match_picks,
             COALESCE(s.c, 0) AS structural_picks,
             COALESCE(g.c, 0) AS group_standings_picks
      FROM weeks w
      LEFT JOIN match_p  m ON m.week_start = w.week_start
      LEFT JOIN struct_p s ON s.week_start = w.week_start
      LEFT JOIN group_p  g ON g.week_start = w.week_start
      ORDER BY w.week_start
    `;
    return rows.map((r) => ({
      weekStart: isoDate(r.week_start),
      matchPicks: Number(r.match_picks),
      structuralPicks: Number(r.structural_picks),
      groupStandingsPicks: Number(r.group_standings_picks),
    }));
  });

  const revenueByWeekPromise = safeRun<WeeklyRevenue[]>("revenueByWeek", [], async () => {
    const rows = await prisma.$queryRaw<
      { week_start: Date; paid_count: bigint; revenue_usd_minor: bigint; revenue_cop: bigint }[]
    >`
      SELECT date_trunc('week', COALESCE("paidAtUtc", "createdAtUtc")) AS week_start,
             COUNT(*)::bigint AS paid_count,
             COALESCE(SUM("amountUsd"), 0)::bigint AS revenue_usd_minor,
             COALESCE(SUM("amountCop"), 0)::bigint AS revenue_cop
      FROM "PoolPayment"
      WHERE status = 'COMPLETED'
      AND COALESCE("paidAtUtc", "createdAtUtc") >= ${day90Ago}
      GROUP BY week_start
      ORDER BY week_start
    `;
    return rows.map((r) => ({
      weekStart: isoDate(r.week_start),
      paidPaymentsCount: Number(r.paid_count),
      revenueUsdMinor: Number(r.revenue_usd_minor),
      revenueCop: Number(r.revenue_cop),
    }));
  });

  const dailyActiveUsersPromise = safeRun<DailyActive[]>("dailyActiveUsers", [], async () => {
    // Unified across all three pick tables — see picksByWeek note.
    const rows = await prisma.$queryRaw<
      { day: Date; unique_users: bigint; picks_count: bigint }[]
    >`
      WITH all_picks AS (
        SELECT "userId", "createdAtUtc" FROM "Prediction"
          WHERE "createdAtUtc" >= ${day30Ago}
        UNION ALL
        SELECT "userId", "createdAtUtc" FROM "StructuralPrediction"
          WHERE "createdAtUtc" >= ${day30Ago}
        UNION ALL
        SELECT "userId", "createdAtUtc" FROM "GroupStandingsPrediction"
          WHERE "createdAtUtc" >= ${day30Ago}
      )
      SELECT date_trunc('day', "createdAtUtc") AS day,
             COUNT(DISTINCT "userId")::bigint AS unique_users,
             COUNT(*)::bigint AS picks_count
      FROM all_picks
      GROUP BY day
      ORDER BY day
    `;
    return rows.map((r) => ({
      day: isoDate(r.day),
      uniqueActiveUsers: Number(r.unique_users),
      picksCount: Number(r.picks_count),
    }));
  });

  // ── Geo + tournaments ──────────────────────────────────
  const usersByCountryPromise = safeRun<CountryRow[]>("usersByCountry", [], async () => {
    const rows = await prisma.$queryRaw<{ country: string | null; count: bigint }[]>`
      SELECT country, COUNT(*)::bigint AS count
      FROM "User"
      GROUP BY country
      ORDER BY COUNT(*) DESC
    `;
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    return rows.slice(0, 20).map((r) => ({
      country: r.country ?? "(unknown)",
      count: Number(r.count),
      pct: total > 0 ? Number(r.count) / total : 0,
    }));
  });

  const poolsByStatusPromise = safeRun<{ status: string; count: number }[]>(
    "poolsByStatus",
    [],
    async () => {
      const rows = await prisma.pool.groupBy({ by: ["status"], _count: { _all: true } });
      return rows.map((r) => ({ status: r.status, count: r._count._all }));
    },
  );

  const poolsByTournamentPromise = safeRun<TournamentRow[]>("poolsByTournament", [], async () => {
    const rows = await prisma.$queryRaw<
      { name: string; template_key: string | null; pool_count: bigint; avg_members: number }[]
    >`
      SELECT ti.name,
             tt."key" AS template_key,
             COUNT(p.id)::bigint AS pool_count,
             COALESCE(AVG(member_counts.member_count), 0)::float AS avg_members
      FROM "Pool" p
      JOIN "TournamentInstance" ti ON ti.id = p."tournamentInstanceId"
      JOIN "TournamentTemplate" tt ON tt.id = ti."templateId"
      LEFT JOIN (
        SELECT "poolId", COUNT(*)::int AS member_count
        FROM "PoolMember" WHERE status = 'ACTIVE' GROUP BY "poolId"
      ) member_counts ON member_counts."poolId" = p.id
      GROUP BY ti.name, tt."key"
      ORDER BY pool_count DESC
    `;
    return rows.map((r) => ({
      name: r.name,
      templateKey: r.template_key,
      poolCount: Number(r.pool_count),
      avgMembers: Number(r.avg_members),
    }));
  });

  const poolSizeDistributionPromise = safeRun<{ range: string; count: number }[]>(
    "poolSizeDistribution",
    [],
    async () => {
      const rows = await prisma.$queryRaw<{ size_bucket: string; count: bigint }[]>`
        SELECT size_bucket, COUNT(*)::bigint AS count
        FROM (
          SELECT
            CASE
              WHEN active_members BETWEEN 1 AND 5 THEN '1-5'
              WHEN active_members BETWEEN 6 AND 10 THEN '6-10'
              WHEN active_members BETWEEN 11 AND 20 THEN '11-20'
              WHEN active_members BETWEEN 21 AND 50 THEN '21-50'
              WHEN active_members BETWEEN 51 AND 100 THEN '51-100'
              WHEN active_members > 100 THEN '100+'
              ELSE '0'
            END AS size_bucket
          FROM (
            SELECT p.id,
                   COALESCE((SELECT COUNT(*) FROM "PoolMember" pm
                             WHERE pm."poolId" = p.id AND pm.status = 'ACTIVE'), 0) AS active_members
            FROM "Pool" p
          ) sized
        ) bucketed
        GROUP BY size_bucket
        ORDER BY CASE size_bucket
          WHEN '0' THEN 0 WHEN '1-5' THEN 1 WHEN '6-10' THEN 2
          WHEN '11-20' THEN 3 WHEN '21-50' THEN 4 WHEN '51-100' THEN 5
          WHEN '100+' THEN 6
        END
      `;
      return rows.map((r) => ({ range: r.size_bucket, count: Number(r.count) }));
    },
  );

  // ── Activation funnel ──────────────────────────────────
  const funnelPromise = safeRun<ActivationFunnel>("funnel", DEFAULT_FUNNEL, async () => {
    const [usersJoined, usersPicked, totalUsers] = await Promise.all([
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT "userId")::bigint AS count
        FROM "PoolMember" WHERE status IN ('ACTIVE', 'LEFT')
      `,
      // "Made pick" = ANY pick across all three tables. Pre-fix this
      // only counted Prediction (match picks), so any Estratega-only
      // user counted as "joined but never engaged" — wrong.
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT u)::bigint AS count FROM (
          SELECT "userId" AS u FROM "Prediction"
          UNION
          SELECT "userId" FROM "StructuralPrediction"
          UNION
          SELECT "userId" FROM "GroupStandingsPrediction"
        ) all_picks
      `,
      prisma.user.count(),
    ]);
    const joinedPool = Number(usersJoined[0]?.count ?? 0);
    const madePick = Number(usersPicked[0]?.count ?? 0);
    return {
      signups: totalUsers,
      joinedPool,
      madePick,
      joinedRate: totalUsers > 0 ? joinedPool / totalUsers : 0,
      pickRateOfJoiners: joinedPool > 0 ? madePick / joinedPool : 0,
      pickRateOfSignups: totalUsers > 0 ? madePick / totalUsers : 0,
    };
  });

  // ── Corporate funnel ───────────────────────────────────
  const corporateFunnelPromise = safeRun<CorporateFunnel>(
    "corporateFunnel",
    DEFAULT_CORPORATE_FUNNEL,
    async () => {
      const [
        totalInquiries,
        respondedInquiriesCount,
        organizationsActiveCount,
        corporatePoolCount,
        invitesByStatus,
        invitesSentNotExpired,
        invitesExpired,
      ] = await Promise.all([
        prisma.organizationInquiry.count(),
        prisma.organizationInquiry.count({ where: { responded: true } }),
        prisma.organization.count({ where: { status: { not: "INQUIRY" } } }),
        prisma.pool.count({ where: { organizationId: { not: null } } }),
        prisma.corporateInvite.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.corporateInvite.count({
          where: {
            status: "SENT",
            activationTokenExpiresAt: { gte: now },
            activatedUserId: null,
          },
        }),
        prisma.corporateInvite.count({
          where: {
            status: "SENT",
            activationTokenExpiresAt: { lt: now },
            activatedUserId: null,
          },
        }),
      ]);
      const total = invitesByStatus.reduce((s, g) => s + g._count._all, 0);
      const activated = invitesByStatus.find((g) => g.status === "ACTIVATED")?._count._all ?? 0;
      const failed = invitesByStatus.find((g) => g.status === "FAILED")?._count._all ?? 0;
      return {
        inquiries: totalInquiries,
        respondedInquiries: respondedInquiriesCount,
        organizationsActive: organizationsActiveCount,
        corporatePools: corporatePoolCount,
        invitesTotal: total,
        invitesSent: invitesSentNotExpired,
        invitesActivated: activated,
        invitesExpired,
        invitesFailed: failed,
        responseRate: totalInquiries > 0 ? respondedInquiriesCount / totalInquiries : 0,
        activationRate: total > 0 ? activated / total : 0,
      };
    },
  );

  // ── Acquisition funnel (channel → activation) ───────────
  // For each top source/medium combo, cross-reference with PoolMember
  // and the unified pick tables. The pickRate tells the manager which
  // channels actually convert, not just which deliver volume.
  const acquisitionFunnelPromise = safeRun<AcquisitionFunnelRow[]>("acquisitionFunnel", [], async () => {
    const rows = await prisma.$queryRaw<
      {
        source: string | null;
        medium: string | null;
        signups: bigint;
        joined: bigint;
        picked: bigint;
      }[]
    >`
      WITH top_sources AS (
        SELECT "acquisitionSource", "acquisitionMedium", COUNT(*) AS n
        FROM "User"
        WHERE "acquisitionSource" IS NOT NULL OR "acquisitionMedium" IS NOT NULL
        GROUP BY "acquisitionSource", "acquisitionMedium"
        ORDER BY n DESC
        LIMIT 10
      ),
      all_picks AS (
        SELECT DISTINCT "userId" AS u FROM "Prediction"
        UNION
        SELECT DISTINCT "userId" FROM "StructuralPrediction"
        UNION
        SELECT DISTINCT "userId" FROM "GroupStandingsPrediction"
      ),
      joined_users AS (
        SELECT DISTINCT "userId" AS u FROM "PoolMember" WHERE status IN ('ACTIVE', 'LEFT')
      )
      SELECT
        t."acquisitionSource" AS source,
        t."acquisitionMedium" AS medium,
        COUNT(DISTINCT u.id)::bigint AS signups,
        COUNT(DISTINCT j.u)::bigint AS joined,
        COUNT(DISTINCT ap.u)::bigint AS picked
      FROM top_sources t
      LEFT JOIN "User" u
        ON COALESCE(u."acquisitionSource", '') = COALESCE(t."acquisitionSource", '')
       AND COALESCE(u."acquisitionMedium", '') = COALESCE(t."acquisitionMedium", '')
      LEFT JOIN joined_users j ON j.u = u.id
      LEFT JOIN all_picks ap ON ap.u = u.id
      GROUP BY t."acquisitionSource", t."acquisitionMedium", t.n
      ORDER BY t.n DESC
    `;
    return rows.map((r) => {
      const signups = Number(r.signups);
      const picked = Number(r.picked);
      return {
        source: r.source ?? "(none)",
        medium: r.medium ?? "(none)",
        signups,
        joinedPool: Number(r.joined),
        madePick: picked,
        pickRate: signups > 0 ? picked / signups : 0,
      };
    });
  });

  // ── Cohort activation (signup → first pick within 14 days) ─
  // The activation funnel from §funnel is lifetime-only; this version
  // is what tells you whether THIS WEEK's signups are activating. Last
  // 8 cohorts. `inProgress` flags cohorts <14d old (their 2-week window
  // hasn't closed yet).
  const cohortActivationPromise = safeRun<CohortActivationRow[]>("cohortActivation", [], async () => {
    const since = new Date(now.getTime() - 8 * 7 * 86_400_000);
    const rows = await prisma.$queryRaw<
      {
        cohort_week: Date;
        cohort_size: bigint;
        joined: bigint;
        picked: bigint;
      }[]
    >`
      WITH all_picks AS (
        SELECT "userId", "createdAtUtc" FROM "Prediction"
        UNION ALL
        SELECT "userId", "createdAtUtc" FROM "StructuralPrediction"
        UNION ALL
        SELECT "userId", "createdAtUtc" FROM "GroupStandingsPrediction"
      ),
      cohorts AS (
        SELECT id AS user_id,
               "createdAtUtc" AS signup_at,
               date_trunc('week', "createdAtUtc") AS cohort_week
        FROM "User"
        WHERE "createdAtUtc" >= ${since}
      )
      SELECT c.cohort_week,
             COUNT(DISTINCT c.user_id)::bigint AS cohort_size,
             COUNT(DISTINCT c.user_id) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM "PoolMember" pm
                 WHERE pm."userId" = c.user_id
                 AND pm."joinedAtUtc" >= c.signup_at
                 AND pm."joinedAtUtc" < c.signup_at + INTERVAL '14 days'
                 AND pm.status IN ('ACTIVE', 'LEFT')
               )
             )::bigint AS joined,
             COUNT(DISTINCT c.user_id) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM all_picks p
                 WHERE p."userId" = c.user_id
                 AND p."createdAtUtc" >= c.signup_at
                 AND p."createdAtUtc" < c.signup_at + INTERVAL '14 days'
               )
             )::bigint AS picked
      FROM cohorts c
      GROUP BY c.cohort_week
      ORDER BY c.cohort_week
    `;
    return rows.map((r) => {
      const cohortStart = r.cohort_week.getTime();
      const cohortAgeMs = now.getTime() - cohortStart;
      const cohortSize = Number(r.cohort_size);
      const joined = Number(r.joined);
      const picked = Number(r.picked);
      return {
        cohortWeekStart: isoDate(r.cohort_week),
        cohortSize,
        joinedWithin2w: joined,
        pickedWithin2w: picked,
        joinedRate: cohortSize > 0 ? joined / cohortSize : 0,
        pickedRate: cohortSize > 0 ? picked / cohortSize : 0,
        // The 14-day window is "from each user's signup", so when the
        // COHORT_WEEK is <7d old, the latest signups in it haven't had
        // their full 14 days; we mark the whole cohort as in-progress
        // until the cohort_week is at least 14d in the past (so even the
        // user who signed up at the END of the week has lived 14 days).
        inProgress: cohortAgeMs < 14 * 86_400_000,
      };
    });
  });

  // ── Acquisition + referrals ────────────────────────────
  const topAcquisitionPromise = safeRun<AcquisitionRow[]>("topAcquisition", [], async () => {
    const rows = await prisma.$queryRaw<
      { source: string | null; medium: string | null; count: bigint }[]
    >`
      SELECT "acquisitionSource" AS source,
             "acquisitionMedium" AS medium,
             COUNT(*)::bigint AS count
      FROM "User"
      WHERE "acquisitionSource" IS NOT NULL OR "acquisitionMedium" IS NOT NULL
      GROUP BY source, medium
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;
    return rows.map((r) => ({
      source: r.source ?? "(none)",
      medium: r.medium ?? "(none)",
      count: Number(r.count),
    }));
  });

  const organicReferralsPromise = safeRun<{ totalReferred: number; topReferrers: TopReferrer[] }>(
    "organicReferrals",
    { totalReferred: 0, topReferrers: [] },
    async () => {
      const [totalReferred, topRefRows] = await Promise.all([
        prisma.user.count({ where: { referredByUserId: { not: null } } }),
        // Cleaner query: inner join to count referrals per referrer
        prisma.$queryRaw<
          { user_id: string; display_name: string; referral_count: bigint }[]
        >`
          SELECT
            referrer.id AS user_id,
            referrer."displayName" AS display_name,
            COUNT(referred.id)::bigint AS referral_count
          FROM "User" referrer
          INNER JOIN "User" referred ON referred."referredByUserId" = referrer.id
          GROUP BY referrer.id, referrer."displayName"
          ORDER BY referral_count DESC
          LIMIT 10
        `,
      ]);
      return {
        totalReferred,
        topReferrers: topRefRows.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name,
          referralCount: Number(r.referral_count),
        })),
      };
    },
  );

  // ── Recent inquiries ───────────────────────────────────
  const recentInquiriesPromise = safeRun<InquiryRow[]>("recentInquiries", [], async () => {
    const rows = await prisma.organizationInquiry.findMany({
      orderBy: { createdAtUtc: "desc" },
      take: 15,
      select: {
        createdAtUtc: true,
        companyName: true,
        contactEmail: true,
        country: true,
        currency: true,
        numberOfPools: true,
        slotsPerPool: true,
        responded: true,
        respondedAt: true,
      },
    });
    return rows.map((i) => ({
      createdAtUtc: i.createdAtUtc.toISOString(),
      companyName: i.companyName,
      contactEmail: i.contactEmail,
      country: i.country,
      currency: i.currency,
      numberOfPools: i.numberOfPools,
      slotsPerPool: i.slotsPerPool,
      responded: i.responded,
      responseLagHours:
        i.responded && i.respondedAt
          ? (i.respondedAt.getTime() - i.createdAtUtc.getTime()) / 3_600_000
          : null,
    }));
  });

  // ── Top organizations ──────────────────────────────────
  const topOrganizationsPromise = safeRun<OrgRow[]>("topOrganizations", [], async () => {
    const rows = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        status: string;
        created_at: Date;
        pool_count: bigint;
        invites_total: bigint;
        invites_activated: bigint;
      }[]
    >`
      SELECT o.id,
             o.name,
             o.status,
             o."createdAtUtc" AS created_at,
             COALESCE(COUNT(DISTINCT p.id), 0)::bigint AS pool_count,
             COALESCE(COUNT(ci.id), 0)::bigint AS invites_total,
             COALESCE(COUNT(*) FILTER (WHERE ci.status = 'ACTIVATED'), 0)::bigint AS invites_activated
      FROM "Organization" o
      LEFT JOIN "Pool" p ON p."organizationId" = o.id
      LEFT JOIN "CorporateInvite" ci ON ci."poolId" = p.id
      GROUP BY o.id, o.name, o.status, o."createdAtUtc"
      ORDER BY pool_count DESC, invites_total DESC
      LIMIT 15
    `;
    return rows.map((o) => {
      const total = Number(o.invites_total);
      const activated = Number(o.invites_activated);
      return {
        id: o.id,
        name: o.name,
        status: o.status,
        createdAtUtc: o.created_at.toISOString(),
        poolCount: Number(o.pool_count),
        invitesTotal: total,
        invitesActivated: activated,
        activationRate: total > 0 ? activated / total : 0,
      };
    });
  });

  // ── Pool health checks ─────────────────────────────────
  const poolHealthPromise = safeRun<PoolHealth>("poolHealth", DEFAULT_POOL_HEALTH, async () => {
    const [zombiePools, poolsWithNoMembers, oldEmptyDrafts, fullPools] = await Promise.all([
      // Zombie = ACTIVE pool with zero picks across ALL pick tables.
      // Pre-fix this checked only Prediction; an Estratega pool whose
      // members all made structural picks looked like a zombie.
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Pool" p
        WHERE p.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM "Prediction" pr WHERE pr."poolId" = p.id)
        AND NOT EXISTS (SELECT 1 FROM "StructuralPrediction" sp WHERE sp."poolId" = p.id)
        AND NOT EXISTS (SELECT 1 FROM "GroupStandingsPrediction" gp WHERE gp."poolId" = p.id)
      `,
      // Orphan = ACTIVE pool with zero non-host members. After the
      // poolStateMachine guard + rescue migration this should stay at
      // 0; if it ever climbs the auto-revert wired in
      // poolStateMachine.transitionToActive failed somehow. Pre-fix
      // this included DRAFT/ARCHIVED pools too, hitting 76 pure-noise
      // even when the meaningful number was 0.
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Pool" p
        WHERE p.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM "PoolMember" pm
          WHERE pm."poolId" = p.id AND pm.status = 'ACTIVE'
          AND pm.role NOT IN ('HOST', 'CORPORATE_HOST')
        )
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Pool" p
        WHERE p.status = 'DRAFT' AND p."createdAtUtc" < ${new Date(now.getTime() - 30 * 86_400_000)}
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "Pool" p
        WHERE p."maxParticipants" IS NOT NULL
        AND (
          SELECT COUNT(*) FROM "PoolMember" pm
          WHERE pm."poolId" = p.id AND pm.status IN ('ACTIVE', 'PENDING_APPROVAL')
        ) >= p."maxParticipants"
      `,
    ]);
    return {
      zombiePools: Number(zombiePools[0]?.count ?? 0),
      poolsWithNoMembers: Number(poolsWithNoMembers[0]?.count ?? 0),
      emptyDraftsOlderThan30Days: Number(oldEmptyDrafts[0]?.count ?? 0),
      fullPools: Number(fullPools[0]?.count ?? 0),
    };
  });

  // ── Cohort retention (last 8 weeks) ────────────────────
  const cohortRetentionPromise = safeRun<CohortRow[]>("cohortRetention", [], async () => {
    const since = new Date(now.getTime() - 8 * 7 * 86_400_000);
    // Single `all_picks` CTE unifies the three pick tables so retention
    // counts Estratega activity the same as score-based picks. Without
    // this, an Estratega-heavy cohort (all picks land in Group/Structural
    // tables) shows fake 0% retention.
    const rows = await prisma.$queryRaw<
      {
        cohort_week: Date;
        cohort_size: bigint;
        retained_w1: bigint;
        retained_w2: bigint;
        retained_w4: bigint;
      }[]
    >`
      WITH all_picks AS (
        SELECT "userId", "createdAtUtc" FROM "Prediction"
        UNION ALL
        SELECT "userId", "createdAtUtc" FROM "StructuralPrediction"
        UNION ALL
        SELECT "userId", "createdAtUtc" FROM "GroupStandingsPrediction"
      ),
      cohorts AS (
        SELECT id AS user_id,
               date_trunc('week', "createdAtUtc") AS cohort_week
        FROM "User"
        WHERE "createdAtUtc" >= ${since}
      )
      SELECT c.cohort_week,
             COUNT(DISTINCT c.user_id)::bigint AS cohort_size,
             COUNT(DISTINCT c.user_id) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM all_picks p
                 WHERE p."userId" = c.user_id
                 AND p."createdAtUtc" >= c.cohort_week + INTERVAL '7 days'
                 AND p."createdAtUtc" < c.cohort_week + INTERVAL '14 days'
               )
             )::bigint AS retained_w1,
             COUNT(DISTINCT c.user_id) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM all_picks p
                 WHERE p."userId" = c.user_id
                 AND p."createdAtUtc" >= c.cohort_week + INTERVAL '14 days'
                 AND p."createdAtUtc" < c.cohort_week + INTERVAL '21 days'
               )
             )::bigint AS retained_w2,
             COUNT(DISTINCT c.user_id) FILTER (
               WHERE EXISTS (
                 SELECT 1 FROM all_picks p
                 WHERE p."userId" = c.user_id
                 AND p."createdAtUtc" >= c.cohort_week + INTERVAL '28 days'
                 AND p."createdAtUtc" < c.cohort_week + INTERVAL '35 days'
               )
             )::bigint AS retained_w4
      FROM cohorts c
      GROUP BY c.cohort_week
      ORDER BY c.cohort_week
    `;
    // For each retention bucket we mark "in progress" when the cohort's
    // age is shorter than the bucket's start. A cohort created 5 days
    // ago cannot have a W1 retention (W1 starts day 7); rendering "0%"
    // would be misleading vs. "no data yet". The frontend renders the
    // in-progress cells as "en curso" / "—".
    return rows.map((r) => {
      const cohortStart = r.cohort_week.getTime();
      const cohortAgeMs = now.getTime() - cohortStart;
      const D = 86_400_000;
      return {
        cohortWeekStart: isoDate(r.cohort_week),
        cohortSize: Number(r.cohort_size),
        retainedW1: Number(r.retained_w1),
        retainedW2: Number(r.retained_w2),
        retainedW4: Number(r.retained_w4),
        // W1 measures (cohort_week + 7d, cohort_week + 14d). Closed once
        // cohortAge >= 14d. Same logic for W2 (closed at 21d) and W4
        // (closed at 35d). Strict `<` so a cohort exactly at 14d shows
        // its (just-closed) W1 number, not "en curso".
        inProgressW1: cohortAgeMs < 14 * D,
        inProgressW2: cohortAgeMs < 21 * D,
        inProgressW4: cohortAgeMs < 35 * D,
      };
    });
  });

  // ── Payment breakdown ──────────────────────────────────
  const paymentBreakdownPromise = safeRun<PaymentBreakdown>(
    "paymentBreakdown",
    DEFAULT_PAYMENT,
    async () => {
      const day1Ago = new Date(now.getTime() - 86_400_000);
      const [statusCounts, byProviderRaw, byTierRaw, avgRaw, staleRaw, timeToPaymentRaw] = await Promise.all([
        prisma.poolPayment.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.$queryRaw<
          { provider: string; currency: string; count: bigint; revenue: bigint }[]
        >`
          SELECT
            CASE
              WHEN "polarOrderId" IS NOT NULL THEN 'polar'
              WHEN "mpPreferenceId" IS NOT NULL THEN 'mercadopago'
              -- Sales-flow CC redemptions create the PoolPayment directly
              -- (no gateway ids) — without this arm they showed as 'unknown'.
              WHEN "accountReceivableId" IS NOT NULL THEN 'sales_cc'
              ELSE 'unknown'
            END AS provider,
            currency,
            COUNT(*)::bigint AS count,
            CASE
              WHEN currency = 'cop' THEN COALESCE(SUM("amountCop"), 0)
              ELSE COALESCE(SUM("amountUsd"), 0)
            END::bigint AS revenue
          FROM "PoolPayment"
          WHERE status = 'COMPLETED'
          GROUP BY provider, currency
          ORDER BY count DESC
        `,
        prisma.$queryRaw<
          { from_capacity: number; to_capacity: number; count: bigint }[]
        >`
          SELECT "fromCapacity" AS from_capacity,
                 "toCapacity" AS to_capacity,
                 COUNT(*)::bigint AS count
          FROM "PoolPayment"
          WHERE status = 'COMPLETED'
          GROUP BY "fromCapacity", "toCapacity"
          ORDER BY count DESC
          LIMIT 10
        `,
        prisma.$queryRaw<{ avg_usd: number | null; avg_cop: number | null }[]>`
          SELECT AVG("amountUsd")::float AS avg_usd,
                 AVG("amountCop")::float AS avg_cop
          FROM "PoolPayment" WHERE status = 'COMPLETED'
        `,
        // Stale = PENDING for >24h with no follow-up. The user opened a
        // checkout, didn't pay, didn't get a webhook. Real money lost to
        // friction; deserves its own KPI.
        prisma.poolPayment.count({
          where: { status: "PENDING", "createdAtUtc": { lt: day1Ago } },
        }),
        // Avg minutes from createdAtUtc → paidAtUtc for completed payments.
        // High values flag slow / confusing checkout flow.
        prisma.$queryRaw<{ avg_minutes: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM ("paidAtUtc" - "createdAtUtc")) / 60)::float AS avg_minutes
          FROM "PoolPayment"
          WHERE status = 'COMPLETED' AND "paidAtUtc" IS NOT NULL
        `,
      ]);

      const totals = statusCounts.reduce(
        (acc, g) => ({
          total: acc.total + g._count._all,
          completed: acc.completed + (g.status === "COMPLETED" ? g._count._all : 0),
          failed: acc.failed + (g.status === "FAILED" ? g._count._all : 0),
        }),
        { total: 0, completed: 0, failed: 0 },
      );

      return {
        totalCheckoutsStarted: totals.total,
        totalCheckoutsCompleted: totals.completed,
        totalCheckoutsFailed: totals.failed,
        conversionRate: totals.total > 0 ? totals.completed / totals.total : 0,
        byProvider: byProviderRaw.map((r) => ({
          provider: `${r.provider} (${r.currency})`,
          count: Number(r.count),
          revenueLocalUnits: Number(r.revenue),
        })),
        byTier: byTierRaw.map((r) => ({
          fromCapacity: Number(r.from_capacity),
          toCapacity: Number(r.to_capacity),
          count: Number(r.count),
        })),
        avgPaymentUsd: Number(avgRaw[0]?.avg_usd ?? 0),
        avgPaymentCop: Number(avgRaw[0]?.avg_cop ?? 0),
        byStatus: statusCounts.map((g) => ({ status: g.status, count: g._count._all })),
        staleAbandonedCount: staleRaw,
        avgTimeToPaymentMinutes: timeToPaymentRaw[0]?.avg_minutes !== null && timeToPaymentRaw[0]?.avg_minutes !== undefined
          ? Number(timeToPaymentRaw[0].avg_minutes)
          : null,
      };
    },
  );

  // ── Operational health ─────────────────────────────────
  const operationalHealthPromise = safeRun<OperationalHealth>(
    "operationalHealth",
    DEFAULT_OPERATIONAL,
    async () => {
      const [emailSuppressions, failedAnalytics, recentFeedback, auditLast24h] =
        await Promise.all([
          prisma.emailSuppression.count(),
          prisma.failedAnalyticsEvent.count(),
          prisma.betaFeedback.findMany({
            orderBy: { createdAtUtc: "desc" },
            take: 10,
            select: {
              id: true,
              type: true,
              message: true,
              createdAtUtc: true,
            },
          }),
          prisma.auditEvent.count({
            where: { createdAtUtc: { gte: new Date(now.getTime() - 86_400_000) } },
          }),
        ]);
      return {
        emailSuppressions,
        failedAnalyticsEvents: failedAnalytics,
        recentFeedback: recentFeedback.map((f) => ({
          id: f.id,
          type: f.type,
          message: f.message ?? "",
          createdAtUtc: f.createdAtUtc.toISOString(),
        })),
        auditEventsLast24h: auditLast24h,
      };
    },
  );

  // ── Communications health ──────────────────────────────
  const communicationsHealthPromise = safeRun<CommunicationsHealth>(
    "communicationsHealth",
    DEFAULT_COMMUNICATIONS,
    async () => {
      const [modalCompletionsDaily, modalCompletedTotal, totalUsersAll, suppressionsWeekly, feedbackWeekly] =
        await Promise.all([
          // Each "LOCALE_PREFERENCE_SET" audit event = one modal completion.
          prisma.$queryRaw<{ day: Date; c: bigint }[]>`
            SELECT date_trunc('day', "createdAtUtc") AS day,
                   COUNT(*)::bigint AS c
            FROM "AuditEvent"
            WHERE action = 'LOCALE_PREFERENCE_SET'
            AND "createdAtUtc" >= ${day30Ago}
            GROUP BY day
            ORDER BY day
          `,
          prisma.user.count({ where: { localePromptCompletedAt: { not: null } } }),
          prisma.user.count(),
          prisma.$queryRaw<{ week_start: Date; c: bigint }[]>`
            SELECT date_trunc('week', "createdAt") AS week_start,
                   COUNT(*)::bigint AS c
            FROM "EmailSuppression"
            WHERE "createdAt" >= ${day90Ago}
            GROUP BY week_start
            ORDER BY week_start
          `,
          prisma.$queryRaw<{ week_start: Date; type: string; c: bigint }[]>`
            SELECT date_trunc('week', "createdAtUtc") AS week_start,
                   type::text AS type,
                   COUNT(*)::bigint AS c
            FROM "BetaFeedback"
            WHERE "createdAtUtc" >= ${day90Ago}
            GROUP BY week_start, type
            ORDER BY week_start
          `,
        ]);

      // Pivot feedback rows into one row per week with BUG/FEATURE/OTHER columns.
      const feedbackMap = new Map<string, { bug: number; feature: number; other: number }>();
      for (const r of feedbackWeekly) {
        const wk = isoDate(r.week_start);
        const cur = feedbackMap.get(wk) ?? { bug: 0, feature: 0, other: 0 };
        const n = Number(r.c);
        if (r.type === "BUG") cur.bug += n;
        else if (r.type === "FEATURE") cur.feature += n;
        else cur.other += n;
        feedbackMap.set(wk, cur);
      }

      return {
        localePromptCompletionsDaily: modalCompletionsDaily.map((r) => ({
          day: isoDate(r.day),
          count: Number(r.c),
        })),
        localePromptCompletionRate: totalUsersAll > 0 ? modalCompletedTotal / totalUsersAll : 0,
        emailSuppressionsByWeek: suppressionsWeekly.map((r) => ({
          weekStart: isoDate(r.week_start),
          count: Number(r.c),
        })),
        feedbackByWeek: Array.from(feedbackMap.entries())
          .map(([weekStart, counts]) => ({ weekStart, ...counts }))
          .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      };
    },
  );

  // ── Engagement signals (top players, hosts, tournaments) ─
  const engagementSignalsPromise = safeRun<EngagementSignals>(
    "engagementSignals",
    DEFAULT_ENGAGEMENT,
    async () => {
      const [topPlayers, topHosts, tournamentEng] = await Promise.all([
        // Top players by total picks (any table) in last 30d. poolCount =
        // how many distinct pools they're picking in — a "spreads across
        // multiple pools" engagement signal.
        prisma.$queryRaw<
          { user_id: string; display_name: string; pick_count: bigint; pool_count: bigint }[]
        >`
          WITH all_picks AS (
            SELECT "userId", "poolId" FROM "Prediction" WHERE "createdAtUtc" >= ${day30Ago}
            UNION ALL
            SELECT "userId", "poolId" FROM "StructuralPrediction" WHERE "createdAtUtc" >= ${day30Ago}
            UNION ALL
            SELECT "userId", "poolId" FROM "GroupStandingsPrediction" WHERE "createdAtUtc" >= ${day30Ago}
          )
          SELECT u.id AS user_id,
                 u."displayName" AS display_name,
                 COUNT(*)::bigint AS pick_count,
                 COUNT(DISTINCT ap."poolId")::bigint AS pool_count
          FROM all_picks ap
          JOIN "User" u ON u.id = ap."userId"
          GROUP BY u.id, u."displayName"
          ORDER BY pick_count DESC
          LIMIT 10
        `,
        // Top hosts by total active members across all the pools they
        // created. Captures "who's organising the busiest groups".
        prisma.$queryRaw<
          {
            user_id: string;
            display_name: string;
            pools_created: bigint;
            active_pools: bigint;
            total_members: bigint;
          }[]
        >`
          SELECT u.id AS user_id,
                 u."displayName" AS display_name,
                 COUNT(DISTINCT p.id)::bigint AS pools_created,
                 COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'ACTIVE')::bigint AS active_pools,
                 COALESCE(SUM(mc.c), 0)::bigint AS total_members
          FROM "User" u
          INNER JOIN "Pool" p ON p."createdByUserId" = u.id
          LEFT JOIN (
            SELECT "poolId", COUNT(*)::int AS c
            FROM "PoolMember" WHERE status = 'ACTIVE'
            GROUP BY "poolId"
          ) mc ON mc."poolId" = p.id
          GROUP BY u.id, u."displayName"
          ORDER BY total_members DESC, pools_created DESC
          LIMIT 10
        `,
        // Tournament engagement: pools/members/picks per tournament
        // instance. Lets the team see which tournaments are alive
        // (e.g. WC2026 vs old UCL) and prioritise tooling work.
        prisma.$queryRaw<
          {
            tournament_name: string;
            template_key: string | null;
            pool_count: bigint;
            total_active_members: bigint;
            total_picks: bigint;
            unique_pickers: bigint;
          }[]
        >`
          WITH all_picks AS (
            SELECT "userId", "poolId" FROM "Prediction"
            UNION ALL
            SELECT "userId", "poolId" FROM "StructuralPrediction"
            UNION ALL
            SELECT "userId", "poolId" FROM "GroupStandingsPrediction"
          ),
          -- Members aggregated to the instance level BEFORE joining the
          -- picks. Joining a per-pool member count onto the pool×picks
          -- row set multiplies it by each pool's pick count (fan-out),
          -- inflating total_active_members by orders of magnitude.
          members_per_instance AS (
            SELECT p."tournamentInstanceId" AS instance_id,
                   COUNT(*)::bigint AS total_members
            FROM "PoolMember" pm
            JOIN "Pool" p ON p.id = pm."poolId"
            WHERE pm.status = 'ACTIVE'
            GROUP BY p."tournamentInstanceId"
          )
          SELECT ti.name AS tournament_name,
                 tt."key" AS template_key,
                 COUNT(DISTINCT p.id)::bigint AS pool_count,
                 COALESCE(MAX(mpi.total_members), 0)::bigint AS total_active_members,
                 COUNT(ap.*)::bigint AS total_picks,
                 COUNT(DISTINCT ap."userId")::bigint AS unique_pickers
          FROM "TournamentInstance" ti
          JOIN "TournamentTemplate" tt ON tt.id = ti."templateId"
          LEFT JOIN members_per_instance mpi ON mpi.instance_id = ti.id
          LEFT JOIN "Pool" p ON p."tournamentInstanceId" = ti.id
          LEFT JOIN all_picks ap ON ap."poolId" = p.id
          GROUP BY ti.id, ti.name, tt."key"
          ORDER BY total_picks DESC NULLS LAST
          LIMIT 15
        `,
      ]);
      return {
        topPlayers30d: topPlayers.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name,
          pickCount: Number(r.pick_count),
          poolCount: Number(r.pool_count),
        })),
        topHosts: topHosts.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name,
          poolsCreated: Number(r.pools_created),
          activePools: Number(r.active_pools),
          totalActiveMembers: Number(r.total_members),
        })),
        tournamentEngagement: tournamentEng.map((r) => ({
          tournamentName: r.tournament_name,
          templateKey: r.template_key,
          poolCount: Number(r.pool_count),
          totalActiveMembers: Number(r.total_active_members),
          totalPicks: Number(r.total_picks),
          uniquePickers: Number(r.unique_pickers),
        })),
      };
    },
  );

  // Await every section at once. Sections are mutually independent, so
  // running them concurrently makes the wall time ≈ the slowest section
  // instead of the sum of all 26 (which is what pushed cold loads past
  // the frontend's 30 s request timeout). Queries beyond the Prisma
  // connection-pool size simply queue.
  const [
    topLine,
    topLineWeekAgo,
    localeDistribution,
    signupsByWeek,
    poolsByWeek,
    picksByWeek,
    revenueByWeek,
    dailyActiveUsers,
    usersByCountry,
    poolsByStatus,
    poolsByTournament,
    poolSizeDistribution,
    funnel,
    corporateFunnel,
    acquisitionFunnel,
    cohortActivation,
    topAcquisition,
    organicReferrals,
    recentInquiries,
    topOrganizations,
    poolHealth,
    cohortRetention,
    paymentBreakdown,
    operationalHealth,
    communicationsHealth,
    engagementSignals,
  ] = await Promise.all([
    topLinePromise,
    topLineWeekAgoPromise,
    localeDistributionPromise,
    signupsByWeekPromise,
    poolsByWeekPromise,
    picksByWeekPromise,
    revenueByWeekPromise,
    dailyActiveUsersPromise,
    usersByCountryPromise,
    poolsByStatusPromise,
    poolsByTournamentPromise,
    poolSizeDistributionPromise,
    funnelPromise,
    corporateFunnelPromise,
    acquisitionFunnelPromise,
    cohortActivationPromise,
    topAcquisitionPromise,
    organicReferralsPromise,
    recentInquiriesPromise,
    topOrganizationsPromise,
    poolHealthPromise,
    cohortRetentionPromise,
    paymentBreakdownPromise,
    operationalHealthPromise,
    communicationsHealthPromise,
    engagementSignalsPromise,
  ]);

  return {
    generatedAtUtc: now.toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    errors: [...errors],
    topLine,
    topLineWeekAgo,
    signupsByWeek,
    poolsByWeek,
    picksByWeek,
    revenueByWeek,
    dailyActiveUsers,
    usersByCountry,
    poolsByStatus,
    poolsByTournament,
    poolSizeDistribution,
    localeDistribution,
    funnel,
    corporateFunnel,
    topAcquisition,
    acquisitionFunnel,
    cohortActivation,
    organicReferrals,
    recentInquiries,
    topOrganizations,
    poolHealth,
    cohortRetention,
    paymentBreakdown,
    operationalHealth,
    communicationsHealth,
    engagementSignals,
  };
}

// ─── Route ──────────────────────────────────────────────────

// Coalesce concurrent builds: whoever needs a (re)build awaits the
// single in-flight promise instead of firing a second full pass.
let inFlightBuild: Promise<DashboardPayload> | null = null;

function startBuild(): Promise<DashboardPayload> {
  if (!inFlightBuild) {
    const startedAt = Date.now();
    inFlightBuild = buildDashboardData()
      .then((data) => {
        cache = { data, timestamp: Date.now() };
        console.log(
          `[admin analytics] dashboard built in ${Date.now() - startedAt}ms` +
            (data.errors.length > 0 ? ` (${data.errors.length} section errors)` : ""),
        );
        return data;
      })
      .finally(() => {
        inFlightBuild = null;
      });
  }
  return inFlightBuild;
}

/**
 * Pre-warm the dashboard cache on boot (called from server.ts).
 * Without it the first admin to load Analítica after every deploy
 * pays the full cold-build cost — the exact scenario that produced
 * the 30 s timeouts on WC eve. Fire-and-forget: a pre-warm failure
 * must never block server startup.
 */
export function prewarmAdminDashboardCache(): void {
  startBuild().catch((err) => {
    console.error(
      "[admin analytics] prewarm failed:",
      err instanceof Error ? err.message : String(err),
    );
  });
}

adminAnalyticsDashboardRouter.get(
  "/dashboard",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const force = req.query.refresh === "true";
    const now = Date.now();

    if (cache && !force) {
      const isFresh = now - cache.timestamp < CACHE_TTL_MS;
      if (!isFresh) {
        // Stale: serve it anyway, refresh in the background. The admin
        // sees data instantly; the next load gets the fresh build.
        startBuild().catch(() => {
          /* already logged inside startBuild */
        });
      }
      return sendData(res, { ...cache.data, cached: true, stale: !isFresh });
    }

    // No cache at all (first hit after boot before prewarm finishes) or
    // an explicit ?refresh=true: block on the build.
    try {
      const data = await startBuild();
      return sendData(res, { ...data, cached: false });
    } catch (err) {
      console.error("[admin analytics dashboard] FAILED:", err);
      return sendInternal(res, "INTERNAL_ERROR", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
