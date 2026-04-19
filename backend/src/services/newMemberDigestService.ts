/**
 * New Member Digest Service
 *
 * Finds pools that had new members join in the last 24 hours and sends
 * a single daily digest email to each pool's HOST.
 */

import { prisma } from "../db";
import { sendNewMemberDigestEmail } from "../lib/email";
import { countryToLocale } from "../lib/constants";

export interface DigestResult {
  poolsProcessed: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
}

export async function processNewMemberDigest(): Promise<DigestResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentMembers = await prisma.poolMember.findMany({
    where: {
      joinedAtUtc: { gte: cutoff },
      status: "ACTIVE",
      role: "PLAYER",
    },
    select: {
      poolId: true,
      user: { select: { displayName: true } },
    },
  });

  if (recentMembers.length === 0) {
    return { poolsProcessed: 0, emailsSent: 0, emailsSkipped: 0, emailsFailed: 0 };
  }

  // Group by pool
  const byPool = new Map<string, { name: string }[]>();
  for (const member of recentMembers) {
    const list = byPool.get(member.poolId) ?? [];
    list.push({ name: member.user.displayName });
    byPool.set(member.poolId, list);
  }

  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  for (const [poolId, newMembers] of byPool) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { name: true, status: true, maxParticipants: true },
    });
    if (!pool || pool.status === "ARCHIVED") {
      emailsSkipped++;
      continue;
    }

    // Find the HOST(s) of the pool
    const hosts = await prisma.poolMember.findMany({
      where: {
        poolId,
        role: { in: ["HOST", "CORPORATE_HOST"] },
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            country: true,
            emailNotificationsEnabled: true,
            emailNewMemberDigest: true,
          },
        },
      },
    });

    for (const host of hosts) {
      if (!host.user.emailNotificationsEnabled || !host.user.emailNewMemberDigest) {
        emailsSkipped++;
        continue;
      }

      const totalMembers = await prisma.poolMember.count({
        where: { poolId, status: "ACTIVE" },
      });

      const result = await sendNewMemberDigestEmail({
        to: host.user.email,
        hostName: host.user.displayName,
        poolName: pool.name,
        poolId,
        newMembers,
        currentTotal: totalMembers,
        locale: countryToLocale(host.user.country),
      });

      if (result.success) emailsSent++;
      else emailsFailed++;
    }
  }

  return {
    poolsProcessed: byPool.size,
    emailsSent,
    emailsSkipped,
    emailsFailed,
  };
}
