/**
 * Admin Analytics Dashboard
 *
 * Single platform-wide growth & health endpoint, admin-only. Returns
 * a comprehensive snapshot of users, pools, corporate funnel, revenue,
 * engagement, retention, and operational health in one JSON payload.
 *
 * Cached in memory for 60s — the dashboard polls every 30s but the
 * data underneath rarely changes meaningfully sub-minute. Pass
 * `?refresh=true` to bypass the cache (the UI's manual "Refresh
 * ahora" button).
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

const CACHE_TTL_MS = 60_000;
let cache: { data: DashboardPayload; timestamp: number } | null = null;

// ─── Types ──────────────────────────────────────────────────

interface DashboardPayload {
  generatedAtUtc: string;
  cacheTtlSeconds: number;
  topLine: TopLineKPIs;
  signupsByWeek: WeeklySignups[];
  poolsByWeek: WeeklyPools[];
  picksByWeek: WeeklyPicks[];
  revenueByWeek: WeeklyRevenue[];
  dailyActiveUsers: DailyActive[];
  usersByCountry: CountryRow[];
  poolsByStatus: { status: string; count: number }[];
  poolsByTournament: TournamentRow[];
  poolSizeDistribution: { range: string; count: number }[];
  funnel: ActivationFunnel;
  corporateFunnel: CorporateFunnel;
  topAcquisition: AcquisitionRow[];
  organicReferrals: { totalReferred: number; topReferrers: TopReferrer[] };
  recentInquiries: InquiryRow[];
  topOrganizations: OrgRow[];
  poolHealth: PoolHealth;
  cohortRetention: CohortRow[];
  paymentBreakdown: PaymentBreakdown;
  operationalHealth: OperationalHealth;
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
}
interface WeeklyRevenue {
  weekStart: string;
  paidPaymentsCount: number;
  revenueUsdMinor: number; // cents
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
}
interface OperationalHealth {
  emailSuppressions: number;
  failedAnalyticsEvents: number;
  recentFeedback: { id: string; type: string; message: string; createdAtUtc: string }[];
  auditEventsLast24h: number;
}

// ─── Helpers ────────────────────────────────────────────────

function startOfWeekUtc(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // shift so Mon=0
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNWeeks(n: number): Date[] {
  const now = new Date();
  const currentWeek = startOfWeekUtc(now);
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(currentWeek);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d);
  }
  return out;
}

// ─── Builder ────────────────────────────────────────────────

async function buildDashboardData(): Promise<DashboardPayload> {
  const now = new Date();
  const day7Ago = new Date(now.getTime() - 7 * 86_400_000);
  const day30Ago = new Date(now.getTime() - 30 * 86_400_000);
  const week12StartFloor = lastNWeeks(12)[0]!;

  // ── Top-line counts (parallel) ──────────────────────────
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
    activeMemberCount,
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
    prisma.poolMember.count({ where: { status: "ACTIVE" } }),
    prisma.poolMember.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "Prediction"
      WHERE "createdAtUtc" >= ${day7Ago}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "Prediction"
      WHERE "createdAtUtc" >= ${day30Ago}
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
  const personalPools = totalPools - corporatePoolCount;
  const draftPools = poolStatusCounts.find((g) => g.status === "DRAFT")?._count._all ?? 0;
  const activePools = poolStatusCounts.find((g) => g.status === "ACTIVE")?._count._all ?? 0;
  const completedPools = poolStatusCounts.find((g) => g.status === "COMPLETED")?._count._all ?? 0;
  const archivedPools = poolStatusCounts.find((g) => g.status === "ARCHIVED")?._count._all ?? 0;
  const totalCorporateInvites = inviteStatusCounts.reduce((s, g) => s + g._count._all, 0);
  const activatedInvites = inviteStatusCounts.find((g) => g.status === "ACTIVATED")?._count._all ?? 0;

  const topLine: TopLineKPIs = {
    totalUsers,
    verifiedUsers,
    googleSignups,
    marketingOptIns,
    predictionSubscribers,
    activeUsers7d: Number(activeUsers7dRows[0]?.count ?? 0),
    activeUsers30d: Number(activeUsers30dRows[0]?.count ?? 0),
    totalPools,
    draftPools,
    activePools,
    completedPools,
    archivedPools,
    personalPools,
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
  };

  // ── Time series — last 12 weeks (raw SQL for date_trunc) ──
  const [signupsRaw, poolsRaw, picksRaw, revenueRaw, dailyActiveRaw] = await Promise.all([
    prisma.$queryRaw<
      { week_start: Date; total: bigint; verified: bigint; google: bigint; referred: bigint }[]
    >`
      SELECT date_trunc('week', "createdAtUtc") AS week_start,
             COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE "emailVerified") ::bigint AS verified,
             COUNT(*) FILTER (WHERE "googleId" IS NOT NULL) ::bigint AS google,
             COUNT(*) FILTER (WHERE "referredByUserId" IS NOT NULL) ::bigint AS referred
      FROM "User"
      WHERE "createdAtUtc" >= ${week12StartFloor}
      GROUP BY week_start
      ORDER BY week_start
    `,
    prisma.$queryRaw<
      { week_start: Date; total: bigint; personal: bigint; corporate: bigint }[]
    >`
      SELECT date_trunc('week', "createdAtUtc") AS week_start,
             COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE "organizationId" IS NULL) ::bigint AS personal,
             COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) ::bigint AS corporate
      FROM "Pool"
      WHERE "createdAtUtc" >= ${week12StartFloor}
      GROUP BY week_start
      ORDER BY week_start
    `,
    prisma.$queryRaw<
      { week_start: Date; match_picks: bigint; structural_picks: bigint }[]
    >`
      WITH match_p AS (
        SELECT date_trunc('week', "createdAtUtc") AS week_start, COUNT(*)::bigint AS c
        FROM "Prediction"
        WHERE "createdAtUtc" >= ${week12StartFloor}
        GROUP BY week_start
      ),
      struct_p AS (
        SELECT date_trunc('week', "createdAtUtc") AS week_start, COUNT(*)::bigint AS c
        FROM "StructuralPrediction"
        WHERE "createdAtUtc" >= ${week12StartFloor}
        GROUP BY week_start
      )
      SELECT COALESCE(m.week_start, s.week_start) AS week_start,
             COALESCE(m.c, 0) AS match_picks,
             COALESCE(s.c, 0) AS structural_picks
      FROM match_p m
      FULL OUTER JOIN struct_p s ON m.week_start = s.week_start
      ORDER BY week_start
    `,
    prisma.$queryRaw<
      { week_start: Date; paid_count: bigint; revenue_usd_minor: bigint; revenue_cop: bigint }[]
    >`
      SELECT date_trunc('week', COALESCE("paidAtUtc", "createdAtUtc")) AS week_start,
             COUNT(*)::bigint AS paid_count,
             COALESCE(SUM("amountUsd"), 0)::bigint AS revenue_usd_minor,
             COALESCE(SUM("amountCop"), 0)::bigint AS revenue_cop
      FROM "PoolPayment"
      WHERE status = 'COMPLETED' AND COALESCE("paidAtUtc", "createdAtUtc") >= ${week12StartFloor}
      GROUP BY week_start
      ORDER BY week_start
    `,
    prisma.$queryRaw<
      { day: Date; unique_users: bigint; picks_count: bigint }[]
    >`
      SELECT date_trunc('day', "createdAtUtc") AS day,
             COUNT(DISTINCT "userId")::bigint AS unique_users,
             COUNT(*)::bigint AS picks_count
      FROM "Prediction"
      WHERE "createdAtUtc" >= ${day30Ago}
      GROUP BY day
      ORDER BY day
    `,
  ]);

  const signupsByWeek: WeeklySignups[] = signupsRaw.map((r) => ({
    weekStart: isoDate(r.week_start),
    total: Number(r.total),
    verified: Number(r.verified),
    google: Number(r.google),
    referred: Number(r.referred),
  }));
  const poolsByWeek: WeeklyPools[] = poolsRaw.map((r) => ({
    weekStart: isoDate(r.week_start),
    total: Number(r.total),
    personal: Number(r.personal),
    corporate: Number(r.corporate),
  }));
  const picksByWeek: WeeklyPicks[] = picksRaw.map((r) => ({
    weekStart: isoDate(r.week_start),
    matchPicks: Number(r.match_picks),
    structuralPicks: Number(r.structural_picks),
  }));
  const revenueByWeek: WeeklyRevenue[] = revenueRaw.map((r) => ({
    weekStart: isoDate(r.week_start),
    paidPaymentsCount: Number(r.paid_count),
    revenueUsdMinor: Number(r.revenue_usd_minor),
    revenueCop: Number(r.revenue_cop),
  }));
  const dailyActiveUsers: DailyActive[] = dailyActiveRaw.map((r) => ({
    day: isoDate(r.day),
    uniqueActiveUsers: Number(r.unique_users),
    picksCount: Number(r.picks_count),
  }));

  // ── Geo + tournament breakdown ──────────────────────────
  const [usersByCountryRaw, poolsByTournamentRaw, poolSizesRaw] = await Promise.all([
    prisma.$queryRaw<{ country: string | null; count: bigint }[]>`
      SELECT country, COUNT(*)::bigint AS count
      FROM "User"
      GROUP BY country
      ORDER BY COUNT(*) DESC
    `,
    prisma.$queryRaw<
      { name: string; template_key: string | null; pool_count: bigint; avg_members: number }[]
    >`
      SELECT ti.name,
             ti."templateKey" AS template_key,
             COUNT(p.id)::bigint AS pool_count,
             COALESCE(AVG(member_counts.member_count), 0)::float AS avg_members
      FROM "Pool" p
      JOIN "TournamentInstance" ti ON ti.id = p."tournamentInstanceId"
      LEFT JOIN (
        SELECT "poolId", COUNT(*)::int AS member_count
        FROM "PoolMember"
        WHERE status = 'ACTIVE'
        GROUP BY "poolId"
      ) member_counts ON member_counts."poolId" = p.id
      GROUP BY ti.name, ti."templateKey"
      ORDER BY pool_count DESC
    `,
    prisma.$queryRaw<{ size_bucket: string; count: bigint }[]>`
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
        WHEN '0' THEN 0
        WHEN '1-5' THEN 1
        WHEN '6-10' THEN 2
        WHEN '11-20' THEN 3
        WHEN '21-50' THEN 4
        WHEN '51-100' THEN 5
        WHEN '100+' THEN 6
      END
    `,
  ]);

  const totalUsersWithCountry = usersByCountryRaw.reduce((s, r) => s + Number(r.count), 0);
  const usersByCountry: CountryRow[] = usersByCountryRaw.slice(0, 20).map((r) => ({
    country: r.country ?? "(unknown)",
    count: Number(r.count),
    pct: totalUsersWithCountry > 0 ? Number(r.count) / totalUsersWithCountry : 0,
  }));

  const poolsByStatus = poolStatusCounts.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));
  const poolsByTournament: TournamentRow[] = poolsByTournamentRaw.map((r) => ({
    name: r.name,
    templateKey: r.template_key,
    poolCount: Number(r.pool_count),
    avgMembers: Number(r.avg_members),
  }));
  const poolSizeDistribution = poolSizesRaw.map((r) => ({
    range: r.size_bucket,
    count: Number(r.count),
  }));

  // ── Funnel: signup → joined pool → made pick ────────────
  const [usersWithPoolCount, usersWithPickCount] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "PoolMember"
      WHERE status IN ('ACTIVE', 'LEFT')
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "Prediction"
    `,
  ]);
  const joinedPool = Number(usersWithPoolCount[0]?.count ?? 0);
  const madePick = Number(usersWithPickCount[0]?.count ?? 0);
  const funnel: ActivationFunnel = {
    signups: totalUsers,
    joinedPool,
    madePick,
    joinedRate: totalUsers > 0 ? joinedPool / totalUsers : 0,
    pickRateOfJoiners: joinedPool > 0 ? madePick / joinedPool : 0,
    pickRateOfSignups: totalUsers > 0 ? madePick / totalUsers : 0,
  };

  // ── Corporate funnel ────────────────────────────────────
  const [
    totalInquiries,
    respondedInquiriesCount,
    organizationsActiveCount,
    invitesSentNotExpiredCount,
    invitesExpiredCount,
    invitesFailedCount,
  ] = await Promise.all([
    prisma.organizationInquiry.count(),
    prisma.organizationInquiry.count({ where: { responded: true } }),
    prisma.organization.count({ where: { status: { not: "INQUIRY" } } }),
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
    prisma.corporateInvite.count({ where: { status: "FAILED" } }),
  ]);

  const corporateFunnel: CorporateFunnel = {
    inquiries: totalInquiries,
    respondedInquiries: respondedInquiriesCount,
    organizationsActive: organizationsActiveCount,
    corporatePools: corporatePoolCount,
    invitesTotal: totalCorporateInvites,
    invitesSent: invitesSentNotExpiredCount,
    invitesActivated: activatedInvites,
    invitesExpired: invitesExpiredCount,
    invitesFailed: invitesFailedCount,
    responseRate: totalInquiries > 0 ? respondedInquiriesCount / totalInquiries : 0,
    activationRate: totalCorporateInvites > 0 ? activatedInvites / totalCorporateInvites : 0,
  };

  // ── Acquisition + referrals ─────────────────────────────
  const [acquisitionRaw, referralStats, topReferrersRaw, recentInquiriesRaw] = await Promise.all([
    prisma.$queryRaw<{ source: string | null; medium: string | null; count: bigint }[]>`
      SELECT "acquisitionSource" AS source,
             "acquisitionMedium" AS medium,
             COUNT(*)::bigint AS count
      FROM "User"
      WHERE "acquisitionSource" IS NOT NULL OR "acquisitionMedium" IS NOT NULL
      GROUP BY source, medium
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `,
    prisma.user.count({ where: { referredByUserId: { not: null } } }),
    prisma.$queryRaw<
      { user_id: string; display_name: string; referral_count: bigint }[]
    >`
      SELECT u.id AS user_id,
             u."displayName" AS display_name,
             COUNT(*)::bigint AS referral_count
      FROM "User" u
      WHERE u.id IN (SELECT "referredByUserId" FROM "User" WHERE "referredByUserId" IS NOT NULL)
      AND u.id IN (
        SELECT "referredByUserId" FROM "User"
        WHERE "referredByUserId" IS NOT NULL
        GROUP BY "referredByUserId"
        ORDER BY COUNT(*) DESC
        LIMIT 10
      )
      GROUP BY u.id, u."displayName", u.id
      ORDER BY (SELECT COUNT(*) FROM "User" r WHERE r."referredByUserId" = u.id) DESC
      LIMIT 10
    `,
    prisma.organizationInquiry.findMany({
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
    }),
  ]);

  const topAcquisition: AcquisitionRow[] = acquisitionRaw.map((r) => ({
    source: r.source ?? "(none)",
    medium: r.medium ?? "(none)",
    count: Number(r.count),
  }));

  const topReferrers: TopReferrer[] = topReferrersRaw.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    referralCount: Number(r.referral_count),
  }));

  const recentInquiries: InquiryRow[] = recentInquiriesRaw.map((i) => ({
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

  // ── Top organizations ───────────────────────────────────
  const topOrgsRaw = await prisma.$queryRaw<
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
  const topOrganizations: OrgRow[] = topOrgsRaw.map((o) => {
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

  // ── Pool health checks ──────────────────────────────────
  const [zombiePools, poolsWithNoMembers, oldEmptyDrafts, fullPools] = await Promise.all([
    // ACTIVE pools with no picks
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Pool" p
      WHERE p.status = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM "Prediction" pr WHERE pr."poolId" = p.id)
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Pool" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "PoolMember" pm
        WHERE pm."poolId" = p.id AND pm.status = 'ACTIVE' AND pm.role != 'HOST' AND pm.role != 'CORPORATE_HOST'
      )
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Pool" p
      WHERE p.status = 'DRAFT'
      AND p."createdAtUtc" < ${new Date(now.getTime() - 30 * 86_400_000)}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "Pool" p
      WHERE p."maxParticipants" IS NOT NULL
      AND (
        SELECT COUNT(*) FROM "PoolMember" pm
        WHERE pm."poolId" = p.id AND pm.status IN ('ACTIVE', 'PENDING_APPROVAL')
      ) >= p."maxParticipants"
    `,
  ]);
  const poolHealth: PoolHealth = {
    zombiePools: Number(zombiePools[0]?.count ?? 0),
    poolsWithNoMembers: Number(poolsWithNoMembers[0]?.count ?? 0),
    emptyDraftsOlderThan30Days: Number(oldEmptyDrafts[0]?.count ?? 0),
    fullPools: Number(fullPools[0]?.count ?? 0),
  };

  // ── Cohort retention (last 8 weeks of cohorts × W1/W2/W4) ─
  const cohortRaw = await prisma.$queryRaw<
    {
      cohort_week: Date;
      cohort_size: bigint;
      retained_w1: bigint;
      retained_w2: bigint;
      retained_w4: bigint;
    }[]
  >`
    WITH cohorts AS (
      SELECT id AS user_id,
             date_trunc('week', "createdAtUtc") AS cohort_week
      FROM "User"
      WHERE "createdAtUtc" >= ${new Date(now.getTime() - 8 * 7 * 86_400_000)}
    )
    SELECT c.cohort_week,
           COUNT(DISTINCT c.user_id)::bigint AS cohort_size,
           COUNT(DISTINCT c.user_id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM "Prediction" p
               WHERE p."userId" = c.user_id
               AND p."createdAtUtc" >= c.cohort_week + INTERVAL '7 days'
               AND p."createdAtUtc" < c.cohort_week + INTERVAL '14 days'
             )
           )::bigint AS retained_w1,
           COUNT(DISTINCT c.user_id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM "Prediction" p
               WHERE p."userId" = c.user_id
               AND p."createdAtUtc" >= c.cohort_week + INTERVAL '14 days'
               AND p."createdAtUtc" < c.cohort_week + INTERVAL '21 days'
             )
           )::bigint AS retained_w2,
           COUNT(DISTINCT c.user_id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM "Prediction" p
               WHERE p."userId" = c.user_id
               AND p."createdAtUtc" >= c.cohort_week + INTERVAL '28 days'
               AND p."createdAtUtc" < c.cohort_week + INTERVAL '35 days'
             )
           )::bigint AS retained_w4
    FROM cohorts c
    GROUP BY c.cohort_week
    ORDER BY c.cohort_week
  `;
  const cohortRetention: CohortRow[] = cohortRaw.map((r) => ({
    cohortWeekStart: isoDate(r.cohort_week),
    cohortSize: Number(r.cohort_size),
    retainedW1: Number(r.retained_w1),
    retainedW2: Number(r.retained_w2),
    retainedW4: Number(r.retained_w4),
  }));

  // ── Payment breakdown ───────────────────────────────────
  const [paymentStatusCounts, paymentByProviderRaw, paymentByTierRaw, paymentAvgRaw] =
    await Promise.all([
      prisma.poolPayment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.$queryRaw<{ provider: string; count: bigint; revenue: bigint }[]>`
        SELECT
          CASE WHEN "polarOrderId" IS NOT NULL THEN 'polar'
               WHEN "mpPreferenceId" IS NOT NULL THEN 'mercadopago'
               ELSE 'unknown'
          END AS provider,
          COUNT(*)::bigint AS count,
          CASE
            WHEN "currency" = 'cop' THEN COALESCE(SUM("amountCop"), 0)
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
        GROUP BY from_capacity, to_capacity
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.$queryRaw<{ avg_usd: number | null; avg_cop: number | null }[]>`
        SELECT AVG("amountUsd")::float AS avg_usd,
               AVG("amountCop")::float AS avg_cop
        FROM "PoolPayment"
        WHERE status = 'COMPLETED'
      `,
    ]);

  const paymentTotals = paymentStatusCounts.reduce(
    (acc, g) => ({
      total: acc.total + g._count._all,
      completed: acc.completed + (g.status === "COMPLETED" ? g._count._all : 0),
      failed: acc.failed + (g.status === "FAILED" ? g._count._all : 0),
    }),
    { total: 0, completed: 0, failed: 0 },
  );

  const paymentBreakdown: PaymentBreakdown = {
    totalCheckoutsStarted: paymentTotals.total,
    totalCheckoutsCompleted: paymentTotals.completed,
    totalCheckoutsFailed: paymentTotals.failed,
    conversionRate: paymentTotals.total > 0 ? paymentTotals.completed / paymentTotals.total : 0,
    byProvider: paymentByProviderRaw.map((r) => ({
      provider: r.provider,
      count: Number(r.count),
      revenueLocalUnits: Number(r.revenue),
    })),
    byTier: paymentByTierRaw.map((r) => ({
      fromCapacity: Number(r.from_capacity),
      toCapacity: Number(r.to_capacity),
      count: Number(r.count),
    })),
    avgPaymentUsd: Number(paymentAvgRaw[0]?.avg_usd ?? 0),
    avgPaymentCop: Number(paymentAvgRaw[0]?.avg_cop ?? 0),
  };

  // ── Operational health ──────────────────────────────────
  const [emailSuppressions, failedAnalytics, recentFeedback, auditLast24h] = await Promise.all([
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
  const operationalHealth: OperationalHealth = {
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

  return {
    generatedAtUtc: now.toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    topLine,
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
    topAcquisition,
    organicReferrals: { totalReferred: referralStats, topReferrers },
    recentInquiries,
    topOrganizations,
    poolHealth,
    cohortRetention,
    paymentBreakdown,
    operationalHealth,
  };
}

// ─── Route ──────────────────────────────────────────────────

adminAnalyticsDashboardRouter.get(
  "/dashboard",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const force = req.query.refresh === "true";
    const now = Date.now();
    if (!force && cache && now - cache.timestamp < CACHE_TTL_MS) {
      return sendData(res, { ...cache.data, cached: true });
    }
    try {
      const data = await buildDashboardData();
      cache = { data, timestamp: now };
      return sendData(res, { ...data, cached: false });
    } catch (err) {
      console.error("[admin analytics dashboard] failed:", err);
      return sendInternal(res, "INTERNAL_ERROR", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
