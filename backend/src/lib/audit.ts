import { Prisma } from "@prisma/client";
import { prisma } from "../db";

// Comentario en español: registra eventos críticos para trazabilidad
export async function writeAuditEvent(params: {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  poolId?: string | null;
  dataJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      poolId: params.poolId ?? null,
      dataJson: params.dataJson !== undefined && params.dataJson !== null
        ? (params.dataJson as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}
