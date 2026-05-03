/**
 * Corporate Branding Service
 *
 * Host-driven editing of an organization's branding fields (logo,
 * colors, welcome/invitation messages) AFTER the pool is created.
 * Mirrors the validation in `routes/corporate.ts` for the create
 * flow but is restricted to the host of THIS pool — platform admins
 * have a parallel admin-only endpoint and don't go through here.
 *
 * Every successful update writes an OrganizationBrandingAudit row in
 * the same transaction so we keep a forensic trail (compliance + the
 * occasional "who broke our brand colors at 3am" investigation).
 */

import { prisma } from "../db";
import { ServiceError, type AuditContext } from "./authService";

// ─── Types ───────────────────────────────────────────────────

/**
 * Update payload. Each field is `string | null | undefined`:
 *   - `undefined` → leave unchanged
 *   - `null`      → clear the field
 *   - `string`    → set the field to this value
 *
 * The route layer validates shape (hex regex, base64 magic bytes,
 * length caps) before calling us. Service trusts the structure.
 */
export type UpdateBrandingInput = {
  userId: string;
  poolId: string;
  payload: {
    logoBase64?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    welcomeMessage?: string | null;
    invitationMessage?: string | null;
  };
};

export type BrandingFields = {
  logoBase64: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  welcomeMessage: string | null;
  invitationMessage: string | null;
};

export type UpdateBrandingResult = {
  organizationId: string;
  fieldsChanged: string[];
  branding: BrandingFields;
};

// ─── Branding fields we track in the audit ───────────────────

const BRANDING_FIELD_KEYS = [
  "logoBase64",
  "primaryColor",
  "secondaryColor",
  "welcomeMessage",
  "invitationMessage",
] as const;
type BrandingFieldKey = (typeof BRANDING_FIELD_KEYS)[number];

// ─── Service ─────────────────────────────────────────────────

/**
 * Update branding for the organization that owns the given pool.
 *
 * Requires the caller to be a CORPORATE_HOST of the pool. Co-admins
 * (CO_ADMIN role) can also edit so a designated marketing person
 * can iterate without the founder's account.
 */
export async function updateBranding(
  input: UpdateBrandingInput,
  auditCtx: AuditContext,
): Promise<UpdateBrandingResult> {
  const { userId, poolId, payload } = input;

  // Auth: caller must be a privileged member of this pool. We allow
  // CORPORATE_HOST + CO_ADMIN so a designated co-admin can iterate
  // without the original creator's account. HOST is included for
  // forward compatibility with non-corporate pools that ever gain
  // branding (today: never).
  const member = await prisma.poolMember.findUnique({
    where: { poolId_userId: { poolId, userId } },
    select: { role: true },
  });
  if (
    !member ||
    (member.role !== "CORPORATE_HOST" &&
      member.role !== "HOST" &&
      member.role !== "CO_ADMIN")
  ) {
    throw new ServiceError("FORBIDDEN", 403, { reason: "HOST_ONLY" });
  }

  // The pool must belong to an organization. Standard (non-corporate)
  // pools have no org and therefore no branding to edit.
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { organizationId: true },
  });
  if (!pool) {
    throw new ServiceError("NOT_FOUND", 404, { reason: "POOL_NOT_FOUND" });
  }
  if (!pool.organizationId) {
    throw new ServiceError("CONFLICT", 409, {
      reason: "NOT_A_CORPORATE_POOL",
    });
  }

  const orgId = pool.organizationId;

  // ── Diff + write inside one transaction so the audit row and
  //    the org update succeed together. If anything throws we leave
  //    no record claiming a change happened.
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        logoBase64: true,
        primaryColor: true,
        secondaryColor: true,
        welcomeMessage: true,
        invitationMessage: true,
      },
    });

    // Only fields actually present in the payload are candidates for
    // change. `undefined` means "leave alone"; `null` means "clear".
    const updateData: Record<string, string | null> = {};
    const fieldsChanged: BrandingFieldKey[] = [];
    const beforeSnapshot: Record<string, string | null> = {};
    const afterSnapshot: Record<string, string | null> = {};

    for (const key of BRANDING_FIELD_KEYS) {
      const newValue = payload[key];
      if (newValue === undefined) continue; // not part of this update

      // Normalize empty strings to null so we don't accidentally
      // store "" — empty is "no value" everywhere else in the app.
      const normalized: string | null = newValue === "" ? null : newValue;
      const prevValue = before[key];

      if (normalized !== prevValue) {
        updateData[key] = normalized;
        fieldsChanged.push(key);
        beforeSnapshot[key] = prevValue;
        afterSnapshot[key] = normalized;
      }
    }

    // Nothing actually changed — no-op, no audit row, return current state.
    if (fieldsChanged.length === 0) {
      return {
        organizationId: orgId,
        fieldsChanged: [],
        branding: before as BrandingFields,
      };
    }

    const updated = await tx.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        logoBase64: true,
        primaryColor: true,
        secondaryColor: true,
        welcomeMessage: true,
        invitationMessage: true,
      },
    });

    await tx.organizationBrandingAudit.create({
      data: {
        organizationId: orgId,
        userId,
        fieldsChanged,
        beforeJson: beforeSnapshot,
        afterJson: afterSnapshot,
        ipAddress: auditCtx.ip,
        userAgent: auditCtx.userAgent,
      },
    });

    return {
      organizationId: orgId,
      fieldsChanged,
      branding: updated as BrandingFields,
    };
  });

  return result;
}
