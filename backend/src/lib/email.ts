// backend/src/lib/email.ts
// Re-export from the cycle-free module so existing call sites that import
// `escapeHtml` from this file keep working without modification.
export { escapeHtml } from "./htmlSafe";

import { Resend } from "resend";
import { prisma } from "../db";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, resolveUserLocale, type SupportedLocale } from "./constants";
import { BRAND } from "./brand";
import { generateUnsubscribeToken, buildUnsubscribeUrl } from "./unsubscribe";
import { appendUtm, emailUtm } from "./utm";
import {
  getPasswordResetTemplate,
  getVerificationTemplate,
  getWelcomeTemplate,
  getPoolInvitationTemplate,
  getDeadlineReminderTemplate,
  getResultPublishedTemplate,
  getPoolCompletedTemplate,
  getPoolFullTemplate,
  getCapacityWarningTemplate,
  getBlockedJoinAttemptTemplate,
  getNewMemberTemplate,
  getPasswordChangedTemplate,
  getMemberRemovedTemplate,
  getCorporateInquiryConfirmationTemplate,
  getCorporateCheckinTemplate,
  getCorporateActivationTemplate,
  getPredictionUpdateTemplate,
  getPaymentReceiptTemplate,
  getNewMemberDigestTemplate,
  getPendingApprovalDigestTemplate,
  getPhaseCompletionSummaryTemplate,
  PasswordResetEmailParams,
  VerificationEmailParams,
  WelcomeEmailParams,
  PoolInvitationEmailParams,
  DeadlineReminderEmailParams,
  ResultPublishedEmailParams,
  PoolCompletedEmailParams,
  PaymentReceiptEmailParams,
} from "./emailTemplates";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("⚠️  RESEND_API_KEY no configurada. Los emails NO se enviarán.");
}

const resend = apiKey ? new Resend(apiKey) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
if (!FROM_EMAIL && apiKey) {
  console.warn("⚠️  RESEND_FROM_EMAIL no configurada. Se requiere para enviar emails.");
}
const APP_NAME = process.env.APP_NAME || "Picks4All";
const SITE_DOMAIN = process.env.SITE_DOMAIN || "picks4all.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Default Reply-To for user-facing transactional emails. The FROM is
// `hola@picks4all.com` (a real, monitored mailbox), but a recipient
// who hits "Reply" on a welcome / pool-invite / deadline-reminder
// almost always wants help — route them to the support inbox so the
// team sees these alongside other support tickets. Specific email
// types (payment receipts, corporate, etc.) override this with their
// own Reply-To downstream.
//
// Resend Insights flagged the previous `noreply@` FROM because Gmail/
// Outlook penalise senders that signal "no two-way communication" and
// because users with a complaint resort to marking spam instead of
// replying — both hit deliverability. Switching to a real address
// (and a sane Reply-To) is the canonical fix.
const DEFAULT_REPLY_TO = `soporte@${process.env.EMAIL_DOMAIN || SITE_DOMAIN}`;

/** Returns the ready Resend client, or null with an error message */
function getReadyClient(): { client: Resend; from: string } | null {
  if (!resend) { console.error("❌ RESEND_API_KEY not configured"); return null; }
  if (!FROM_EMAIL) { console.error("❌ RESEND_FROM_EMAIL not configured"); return null; }
  return { client: resend, from: `${APP_NAME} <${FROM_EMAIL}>` };
}

/**
 * Send an email via Resend with automatic retry on transient failures.
 * Checks the suppression list before sending.
 * Returns the same shape as Resend's send() for drop-in compatibility.
 */
async function resilientSend(
  ready: { client: Resend; from: string },
  payload: Omit<Parameters<Resend["emails"]["send"]>[0], "from"> & {
    skipSuppressionCheck?: boolean;
    // Pass `null` to opt out of the default Reply-To injection (used by
    // internal admin notifications, where the team replying to itself
    // makes no sense). Any other value, including `undefined`, gets
    // the default Reply-To — keeping the contract that user-facing
    // emails always have a real reachable Reply-To.
    skipDefaultReplyTo?: boolean;
  },
): Promise<{ data: { id: string } | null; error: { message: string } | null }> {
  // Check suppression list (bounced/complained addresses)
  if (!payload.skipSuppressionCheck) {
    const recipients = Array.isArray(payload.to) ? payload.to : payload.to ? [payload.to] : [];
    for (const addr of recipients) {
      if (typeof addr === "string" && await isSuppressed(addr)) {
        console.log(`⏭️ Email to ${addr} skipped: address is on suppression list`);
        return { data: null, error: { message: `Address ${addr} is suppressed (bounced/complained)` } };
      }
    }
  }
  const { skipSuppressionCheck: _, skipDefaultReplyTo, replyTo, ...rest } = payload;

  // Apply the default Reply-To unless the caller explicitly opted out
  // (admin notifications) or provided their own (corporate / sales).
  const effectiveReplyTo =
    skipDefaultReplyTo ? undefined : replyTo ?? DEFAULT_REPLY_TO;

  const sendPayload = effectiveReplyTo
    ? { ...rest, replyTo: effectiveReplyTo }
    : rest;

  try {
    const result = await withRetry("email-send", async () => {
      const { data, error } = await ready.client.emails.send({ from: ready.from, ...sendPayload } as Parameters<Resend["emails"]["send"]>[0]);
      if (error) throw new Error(error.message);
      return data;
    });
    return { data: result as { id: string } | null, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// =========================================================================
// HELPERS: Locale + Unsubscribe headers
// =========================================================================

export async function getUserLocale(userId?: string): Promise<SupportedLocale> {
  if (!userId) return DEFAULT_LOCALE;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true, country: true },
  });
  return resolveUserLocale(user ?? {});
}

async function isSuppressed(email: string): Promise<boolean> {
  const entry = await prisma.emailSuppression.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  return !!entry;
}

function getUnsubscribeHeaders(userId: string): Record<string, string> {
  const backendUrl = process.env.BACKEND_URL || `https://api.${SITE_DOMAIN}`;
  const token = generateUnsubscribeToken(userId);
  const url = `${backendUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// =========================================================================
// HELPERS: Retry + Batch
// =========================================================================

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_MAX_ATTEMPTS) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`⚠️ [${label}] attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1_000;

export async function batchSendEmails<T>(
  items: T[],
  sendFn: (item: T) => Promise<unknown>,
): Promise<{
  sent: number;
  failed: number;
  /** The items whose send threw — paired with the rejection reason so
   *  the caller can log per-item context (userId, email, poolId, etc.)
   *  or enqueue them for retry. Previously callers only knew the failure
   *  count, hiding systemic issues like a bouncing domain or a transient
   *  Resend outage that affected a specific cohort. */
  failures: Array<{ item: T; error: unknown }>;
}> {
  let sent = 0;
  let failed = 0;
  const failures: Array<{ item: T; error: unknown }> = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(sendFn));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        failures.push({ item: batch[idx]!, error: r.reason });
      }
    });
    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return { sent, failed, failures };
}

// =========================================================================
// TIPOS Y CONSTANTES
// =========================================================================

export type EmailType =
  | "welcome"
  | "deadlineReminder"
  | "resultPublished"
  | "poolCompleted";

export interface EmailResult {
  success: boolean;
  error?: string;
  skipped?: boolean; // true si el email fue omitido por configuración
  reason?: string; // razón del skip
}

// Mapeo de tipos de email a campos en PlatformSettings y User
const EMAIL_CONFIG_MAP: Record<
  EmailType,
  { platformField: string; userField: string }
> = {
  welcome: {
    platformField: "emailWelcomeEnabled",
    userField: "emailNotificationsEnabled", // Solo master toggle para welcome
  },
  deadlineReminder: {
    platformField: "emailDeadlineReminderEnabled",
    userField: "emailDeadlineReminders",
  },
  resultPublished: {
    platformField: "emailResultPublishedEnabled",
    userField: "emailResultNotifications",
  },
  poolCompleted: {
    platformField: "emailPoolCompletedEnabled",
    userField: "emailPoolCompletions",
  },
};

// =========================================================================
// HELPER: Verificar si un email está habilitado
// =========================================================================

/**
 * Verifica si un tipo de email está habilitado tanto a nivel de plataforma
 * como a nivel de usuario.
 *
 * @param type - Tipo de email a verificar
 * @param userId - ID del usuario (opcional, si no se pasa solo verifica plataforma)
 * @returns Objeto con enabled (boolean) y reason (si está deshabilitado)
 */
export async function isEmailEnabled(
  type: EmailType,
  userId?: string
): Promise<{ enabled: boolean; reason?: string }> {
  const config = EMAIL_CONFIG_MAP[type];

  // 1. Verificar configuración de plataforma
  const platformSettings = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });

  // Si no existe la configuración, crear con valores por defecto
  if (!platformSettings) {
    await prisma.platformSettings.create({
      data: { id: "singleton" },
    });
  }

  const platformEnabled =
    platformSettings?.[config.platformField as keyof typeof platformSettings] ??
    true;

  if (!platformEnabled) {
    return {
      enabled: false,
      reason: `Email type "${type}" is disabled at platform level`,
    };
  }

  // 2. Si hay userId, verificar preferencias del usuario
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailNotificationsEnabled: true,
        emailPoolInvitations: true,
        emailDeadlineReminders: true,
        emailResultNotifications: true,
        emailPoolCompletions: true,
      },
    });

    if (!user) {
      return { enabled: false, reason: "User not found" };
    }

    // Master toggle
    if (!user.emailNotificationsEnabled) {
      return {
        enabled: false,
        reason: "User has disabled all email notifications",
      };
    }

    // Toggle específico (excepto welcome que solo usa master)
    if (type !== "welcome") {
      const userEnabled =
        user[config.userField as keyof typeof user] ?? false;
      if (!userEnabled) {
        return {
          enabled: false,
          reason: `User has disabled "${type}" notifications`,
        };
      }
    }
  }

  return { enabled: true };
}

/**
 * Envía un email de reset de password (transaccional — siempre se envía)
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  username: string;
  resetToken: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const resetUrl = appendUtm(`${FRONTEND_URL}/reset-password?token=${params.resetToken}`, emailUtm("password_reset"));

  const subjects: Record<string, string> = {
    es: `Recupera tu contraseña — ${APP_NAME}`,
    en: `Reset your password — ${APP_NAME}`,
    pt: `Recupere sua senha — ${APP_NAME}`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPasswordResetTemplate({ username: params.username, resetUrl, locale: loc }),
    });

    if (error) {
      console.error("❌ Error al enviar email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Password reset email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// EMAIL VERIFICATION
// =========================================================================

/**
 * Envía un email de verificación de cuenta (transaccional — siempre se envía)
 */
export async function sendVerificationEmail(params: {
  to: string;
  displayName: string;
  verificationToken: string;
  locale?: string;
}): Promise<EmailResult> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const verificationUrl = appendUtm(`${FRONTEND_URL}/verify-email?token=${params.verificationToken}`, emailUtm("email_verification"));

  const subjects: Record<string, string> = {
    es: `Verifica tu email — ${APP_NAME}`,
    en: `Verify your email — ${APP_NAME}`,
    pt: `Verifique seu email — ${APP_NAME}`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getVerificationTemplate({ displayName: params.displayName, verificationUrl, locale: loc }),
    });

    if (error) {
      console.error("❌ Error al enviar verification email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Verification email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar verification email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// WELCOME EMAIL
// =========================================================================

/**
 * Envía un email de bienvenida a un nuevo usuario
 */
export async function sendWelcomeEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  locale?: string;
}): Promise<EmailResult> {
  // Verificar si está habilitado
  const { enabled, reason } = await isEmailEnabled("welcome", params.userId);
  if (!enabled) {
    console.log(`⏭️ Welcome email skipped: ${reason}`);
    return { success: true, skipped: true, reason };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `¡Bienvenido a ${APP_NAME}!`,
    en: `Welcome to ${APP_NAME}!`,
    pt: `Bem-vindo ao ${APP_NAME}!`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getWelcomeTemplate({ displayName: params.displayName, locale: loc }),
      headers: getUnsubscribeHeaders(params.userId),
    });

    if (error) {
      console.error("❌ Error al enviar welcome email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Welcome email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar welcome email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// POOL INVITATION EMAIL
// =========================================================================

/**
 * Envía un email de invitación a una pool
 */
export async function sendPoolInvitationEmail(params: {
  to: string;
  userId?: string;
  inviterName: string;
  poolName: string;
  inviteCode: string;
  poolDescription?: string;
  locale?: string;
}): Promise<EmailResult> {
  // Check user preference only (always active at platform level)
  if (params.userId) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { emailNotificationsEnabled: true, emailPoolInvitations: true },
    });
    if (user && (!user.emailNotificationsEnabled || !user.emailPoolInvitations)) {
      const reason = !user.emailNotificationsEnabled
        ? "User has disabled all email notifications"
        : "User has disabled pool invitation notifications";
      console.log(`⏭️ Pool invitation email skipped: ${reason}`);
      return { success: true, skipped: true, reason };
    }
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `${params.inviterName} te invitó a "${params.poolName}"`,
    en: `${params.inviterName} invited you to "${params.poolName}"`,
    pt: `${params.inviterName} convidou você para "${params.poolName}"`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPoolInvitationTemplate({
        inviterName: params.inviterName,
        poolName: params.poolName,
        inviteCode: params.inviteCode,
        poolDescription: params.poolDescription,
        locale: loc,
      }),
      ...(params.userId ? { headers: getUnsubscribeHeaders(params.userId) } : {}),
    });

    if (error) {
      console.error("❌ Error al enviar pool invitation email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Pool invitation email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar pool invitation email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// DEADLINE REMINDER EMAIL
// =========================================================================

/**
 * Envía un recordatorio de deadline para hacer picks
 */
export async function sendDeadlineReminderEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  poolName: string;
  matchesCount: number;
  deadlineTime: string;
  poolId: string;
  locale?: string;
}): Promise<EmailResult> {
  const { enabled, reason } = await isEmailEnabled(
    "deadlineReminder",
    params.userId
  );
  if (!enabled) {
    console.log(`⏭️ Deadline reminder email skipped: ${reason}`);
    return { success: true, skipped: true, reason };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const n = params.matchesCount;
  const subjects: Record<string, string> = {
    es: `⏰ ${n} partido${n > 1 ? "s" : ""} sin pronóstico en "${params.poolName}"`,
    en: `⏰ ${n} match${n > 1 ? "es" : ""} without predictions in "${params.poolName}"`,
    pt: `⏰ ${n} partida${n > 1 ? "s" : ""} sem palpite em "${params.poolName}"`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getDeadlineReminderTemplate({
        displayName: params.displayName,
        poolName: params.poolName,
        matchesCount: params.matchesCount,
        deadlineTime: params.deadlineTime,
        poolId: params.poolId,
        locale: loc,
      }),
      headers: getUnsubscribeHeaders(params.userId),
    });

    if (error) {
      console.error("❌ Error al enviar deadline reminder email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Deadline reminder email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar deadline reminder email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// RESULT PUBLISHED EMAIL
// =========================================================================

/**
 * Envía notificación de resultado publicado
 */
export async function sendResultPublishedEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  poolName: string;
  matchDescription: string;
  result: string;
  pointsEarned: number;
  currentRank: number;
  totalParticipants: number;
  poolId: string;
  locale?: string;
}): Promise<EmailResult> {
  const { enabled, reason } = await isEmailEnabled(
    "resultPublished",
    params.userId
  );
  if (!enabled) {
    console.log(`⏭️ Result published email skipped: ${reason}`);
    return { success: true, skipped: true, reason };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `📊 Resultado: ${params.matchDescription} (${params.result}) — ${params.pointsEarned} pts`,
    en: `📊 Result: ${params.matchDescription} (${params.result}) — ${params.pointsEarned} pts`,
    pt: `📊 Resultado: ${params.matchDescription} (${params.result}) — ${params.pointsEarned} pts`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getResultPublishedTemplate({
        displayName: params.displayName,
        poolName: params.poolName,
        matchDescription: params.matchDescription,
        result: params.result,
        pointsEarned: params.pointsEarned,
        currentRank: params.currentRank,
        totalParticipants: params.totalParticipants,
        poolId: params.poolId,
        locale: loc,
      }),
      headers: getUnsubscribeHeaders(params.userId),
    });

    if (error) {
      console.error("❌ Error al enviar result published email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Result published email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar result published email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// POOL COMPLETED EMAIL
// =========================================================================

/**
 * Envía notificación de pool completada con resultados finales
 */
export async function sendPoolCompletedEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  poolName: string;
  finalRank: number;
  totalPoints: number;
  totalParticipants: number;
  exactScores: number;
  poolId: string;
  locale?: string;
}): Promise<EmailResult> {
  const { enabled, reason } = await isEmailEnabled(
    "poolCompleted",
    params.userId
  );
  if (!enabled) {
    console.log(`⏭️ Pool completed email skipped: ${reason}`);
    return { success: true, skipped: true, reason };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  let subjectEmoji = "🏁";
  if (params.finalRank === 1) subjectEmoji = "🏆";
  else if (params.finalRank === 2) subjectEmoji = "🥈";
  else if (params.finalRank === 3) subjectEmoji = "🥉";

  const subjects: Record<string, string> = {
    es: `${subjectEmoji} "${params.poolName}" terminó — Posición #${params.finalRank}`,
    en: `${subjectEmoji} "${params.poolName}" finished — Position #${params.finalRank}`,
    pt: `${subjectEmoji} "${params.poolName}" terminou — Posição #${params.finalRank}`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPoolCompletedTemplate({
        displayName: params.displayName,
        poolName: params.poolName,
        finalRank: params.finalRank,
        totalPoints: params.totalPoints,
        totalParticipants: params.totalParticipants,
        exactScores: params.exactScores,
        poolId: params.poolId,
        locale: loc,
      }),
      headers: getUnsubscribeHeaders(params.userId),
    });

    if (error) {
      console.error("❌ Error al enviar pool completed email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Pool completed email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar pool completed email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// HELPER: Obtener configuración actual de emails de plataforma
// =========================================================================

/**
 * Obtiene la configuración actual de emails de la plataforma
 * Crea la configuración con valores por defecto si no existe
 */
export async function getPlatformEmailSettings() {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: "singleton" },
    });
  }

  return {
    welcomeEnabled: settings.emailWelcomeEnabled,
    deadlineReminderEnabled: settings.emailDeadlineReminderEnabled,
    resultPublishedEnabled: settings.emailResultPublishedEnabled,
    poolCompletedEnabled: settings.emailPoolCompletedEnabled,
    updatedAt: settings.updatedAt,
    updatedById: settings.updatedById,
  };
}

// =========================================================================
// CORPORATE INQUIRY CONFIRMATION EMAIL
// =========================================================================

/**
 * Envía confirmación al contacto de una empresa que envió una solicitud.
 * Transaccional (no sujeta a PlatformSettings/User prefs).
 */
export async function sendCorporateInquiryConfirmationEmail(params: {
  to: string;
  contactName: string;
  companyName: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const locale = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `Recibimos tu solicitud — ${APP_NAME}`,
    en: `We received your request — ${APP_NAME}`,
    pt: `Recebemos sua solicitação — ${APP_NAME}`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[locale] ?? subjects.es!,
      html: getCorporateInquiryConfirmationTemplate({
        contactName: params.contactName,
        companyName: params.companyName,
        locale,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar corporate confirmation email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Corporate confirmation email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar corporate confirmation email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// CORPORATE CHECK-IN EMAIL (proactive outreach to corporate hosts)
// =========================================================================

/**
 * Sends a friendly check-in email to a corporate host inviting them to
 * reply with any questions. Always sent from + reply-to the
 * `empresas@picks4all.com` mailbox (the only enterprise address that
 * exists — translated locale variants like `enterprise@` are NOT real
 * mailboxes), so any reply lands where the team can answer regardless
 * of the recipient's language.
 */
export async function sendCorporateCheckinEmail(params: {
  to: string;
  contactName: string;
  companyName: string;
  poolName: string;
  poolUrl: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const locale = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `¿Cómo podemos ayudarte con ${params.poolName}? — ${APP_NAME}`,
    en: `How can we help with ${params.poolName}? — ${APP_NAME}`,
    pt: `Como podemos ajudar com ${params.poolName}? — ${APP_NAME}`,
  };
  // Single canonical enterprise mailbox — no locale variants.
  const ENTERPRISE_MAILBOX = "empresas@picks4all.com";
  const fromI18n: Record<string, string> = {
    es: `${APP_NAME} Empresas <${ENTERPRISE_MAILBOX}>`,
    en: `${APP_NAME} for Business <${ENTERPRISE_MAILBOX}>`,
    pt: `${APP_NAME} Empresas <${ENTERPRISE_MAILBOX}>`,
  };
  const corporateReady = { client: ready.client, from: fromI18n[locale] ?? fromI18n.es! };

  try {
    const { data, error } = await resilientSend(corporateReady, {
      to: params.to,
      subject: subjects[locale] ?? subjects.es!,
      replyTo: ENTERPRISE_MAILBOX,
      html: getCorporateCheckinTemplate({
        contactName: params.contactName,
        companyName: params.companyName,
        poolName: params.poolName,
        poolUrl: params.poolUrl,
        locale,
      }),
    });

    if (error) {
      console.error("❌ Error sending corporate check-in email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Corporate check-in email sent:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Exception sending corporate check-in email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// CORPORATE ACTIVATION EMAIL
// =========================================================================

/**
 * Envía email de activación a un empleado invitado a una pool corporativa.
 * Transaccional (no sujeto a PlatformSettings/User prefs — el usuario aún no existe).
 */
export async function sendCorporateActivationEmail(params: {
  to: string;
  employeeName?: string;
  companyName: string;
  poolName: string;
  activationToken: string;
  locale?: string;
  logoBase64?: string | null;
  invitationMessage?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const locale = params.locale || DEFAULT_LOCALE;
  const activationUrl = appendUtm(`${FRONTEND_URL}/activar-cuenta?token=${params.activationToken}`, emailUtm("corporate_activation"));

  const subjects: Record<string, string> = {
    es: `${params.companyName} te invitó a jugar — ${APP_NAME}`,
    en: `${params.companyName} invited you to play — ${APP_NAME}`,
    pt: `${params.companyName} convidou você para jogar — ${APP_NAME}`,
  };

  // Parse logo data URI into CID inline attachment (base64 data URIs are blocked by Gmail)
  let logoAttachment: { filename: string; content: Buffer; contentType: string; contentId: string } | null = null;
  let logoCid: string | null = null;

  if (params.logoBase64) {
    const match = params.logoBase64.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
    if (match) {
      logoCid = "company-logo";
      const mimeType = match[1]!;
      const ext = match[2]!;
      const base64Data = match[3]!;
      logoAttachment = {
        filename: `logo.${ext === "jpg" ? "jpeg" : ext}`,
        content: Buffer.from(base64Data, "base64"),
        contentType: mimeType,
        contentId: logoCid,
      };
    }
  }

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[locale] ?? subjects.es!,
      html: getCorporateActivationTemplate({
        employeeName: params.employeeName,
        companyName: params.companyName,
        poolName: params.poolName,
        activationUrl,
        locale,
        logoCid,
        invitationMessage: params.invitationMessage,
        primaryColor: params.primaryColor,
        secondaryColor: params.secondaryColor,
      }),
      ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
    });

    if (error) {
      console.error("❌ Error al enviar corporate activation email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Corporate activation email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar corporate activation email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// INTERNAL NOTIFICATIONS — routed by category to a dedicated mailbox
// =========================================================================

/**
 * Categories of internal (operator-facing) notifications. Each category
 * routes to a specific Gmail inbox so the team can scan a single label
 * for everything of one kind. See CATEGORY_ROUTING below for the
 * inbox assignments.
 */
export type AdminCategory =
  | "feedback"                   // Beta feedback / bug reports from users
  | "corporate_inquiry"          // Lead form submission from /empresas
  | "corporate_pool_created"     // A corporate pool was created via the wizard
  | "payment_completed"          // A payment was confirmed (Polar / MP)
  | "payment_reconciler_rescued" // Reconciler found a discrepancy needing human review (F-14)
  | "cc_pricing_drift"           // CC snapshot disagrees with live pricing.ts (SALES_AUDIT.md §11.7)
  | "system_event"               // Successful system event (phase advanced, sync OK)
  | "error";                     // Real technical error (job failed, sync rejected)

interface CategoryRoute {
  // Names of inboxes this notification copies to. Each name is resolved
  // to an email address via NOTIFICATION_INBOX_ENV at send time. When
  // a category lists multiple inboxes (like payment_completed), the
  // notification is sent to all of them in a single Resend call.
  inboxes: ReadonlyArray<"admin" | "support" | "enterprise" | "sales">;
  // Visual prefix on the subject line. Lets you scan the inbox without
  // opening anything.
  emoji: string;
  // Short label included next to the emoji in the subject and in the
  // email body header.
  label: string;
}

const CATEGORY_ROUTING: Record<AdminCategory, CategoryRoute> = {
  feedback:               { inboxes: ["support"],            emoji: "💬", label: "Feedback" },
  corporate_inquiry:      { inboxes: ["enterprise"],         emoji: "📩", label: "Cotización corporativa" },
  corporate_pool_created: { inboxes: ["enterprise"],         emoji: "🏢", label: "Pool corporativa creada" },
  payment_completed:      { inboxes: ["sales", "admin"],     emoji: "💰", label: "Pago confirmado" },
  payment_reconciler_rescued: { inboxes: ["admin"],          emoji: "🛟", label: "Reconciler: revisión manual" },
  cc_pricing_drift:       { inboxes: ["sales", "admin"],     emoji: "⚠️", label: "CC: drift de precio" },
  system_event:           { inboxes: ["admin"],              emoji: "ℹ️", label: "Evento del sistema" },
  error:                  { inboxes: ["admin"],              emoji: "🚨", label: "Error" },
};

// Maps a logical inbox name to the env var that holds its destination
// address. Each falls back to ADMIN_NOTIFICATION_EMAIL so an unset
// var never silently drops a notification.
const NOTIFICATION_INBOX_ENV: Record<CategoryRoute["inboxes"][number], string | undefined> = {
  admin:      process.env.ADMIN_NOTIFICATION_EMAIL,
  support:    process.env.SUPPORT_NOTIFICATION_EMAIL,
  enterprise: process.env.ENTERPRISE_NOTIFICATION_EMAIL,
  sales:      process.env.SALES_NOTIFICATION_EMAIL,
};

function resolveInboxAddresses(inboxes: CategoryRoute["inboxes"]): string[] {
  const fallback = NOTIFICATION_INBOX_ENV.admin;
  const resolved = new Set<string>();
  for (const inbox of inboxes) {
    const address = NOTIFICATION_INBOX_ENV[inbox] ?? fallback;
    if (address) resolved.add(address);
  }
  return Array.from(resolved);
}

/**
 * Sends an internal notification to one or more team mailboxes based
 * on its category. The category drives both the destination inbox(es)
 * and the visual style (emoji + label) of the email.
 */
export async function sendAdminNotification(params: {
  subject: string;
  body: string;
  category: AdminCategory;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const route = CATEGORY_ROUTING[params.category];
  const recipients = resolveInboxAddresses(route.inboxes);
  if (recipients.length === 0) {
    console.warn(
      `⚠️  No notification inbox resolved for category "${params.category}" ` +
        `(neither category-specific env nor ADMIN_NOTIFICATION_EMAIL set). Skipping.`,
    );
    return { success: false, error: "No notification inbox configured" };
  }

  const headerLabel = `${route.emoji} ${route.label}`;
  const subjectLabel = `[${route.emoji}] ${route.label}`;

  try {
    const { data, error } = await resilientSend(
      { ...ready, from: ready.from.replace(APP_NAME, `${APP_NAME} Notify`) },
      {
        to: recipients,
        subject: `${subjectLabel} — ${params.subject}`,
        // Internal notification — recipient is the team's own inbox.
        // Replying to oneself is meaningless; opt out of the user-
        // facing default Reply-To injection so the operator's reply
        // goes nowhere unexpected.
        skipDefaultReplyTo: true,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1F2937;border-bottom:2px solid ${BRAND.primary};padding-bottom:8px;">${headerLabel}</h2>
            <div style="color:#374151;font-size:15px;line-height:1.6;">
              ${params.body}
            </div>
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
            <p style="color:#9CA3AF;font-size:12px;">
              ${APP_NAME} internal notification &middot; ${new Date().toISOString()}
            </p>
          </div>
        `,
      },
    );

    if (error) {
      console.error(`❌ Error sending notification (${params.category}):`, error);
      return { success: false, error: error.message };
    }

    console.log(
      `✅ Notification sent [${params.category} → ${recipients.join(", ")}]:`,
      data?.id,
    );
    return { success: true };
  } catch (err) {
    console.error(`❌ Exception sending notification (${params.category}):`, err);
    return { success: false, error: String(err) };
  }
}

/**
 * Envía notificación al host cuando su pool alcanza la capacidad máxima.
 */
export async function sendPoolFullNotificationEmail(params: {
  to: string;
  hostName: string;
  poolName: string;
  poolId: string;
  maxParticipants: number;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `Tu pool "${params.poolName}" está lleno`,
    en: `Your pool "${params.poolName}" is full`,
    pt: `Seu bolão "${params.poolName}" está lotado`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPoolFullTemplate({
        hostName: params.hostName,
        poolName: params.poolName,
        poolId: params.poolId,
        maxParticipants: params.maxParticipants,
        locale: loc,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar email pool full:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Pool full notification enviada a ${params.to}:`, data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar email pool full:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Notifica al host que su pool se acerca a la capacidad máxima (umbral configurable, default 95%).
 */
export async function sendCapacityWarningEmail(params: {
  to: string;
  hostName: string;
  poolName: string;
  poolId: string;
  currentMembers: number;
  maxParticipants: number;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `Tu pool "${params.poolName}" está casi lleno (${params.currentMembers}/${params.maxParticipants})`,
    en: `Your pool "${params.poolName}" is almost full (${params.currentMembers}/${params.maxParticipants})`,
    pt: `Seu bolão "${params.poolName}" está quase lotado (${params.currentMembers}/${params.maxParticipants})`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getCapacityWarningTemplate({
        hostName: params.hostName,
        poolName: params.poolName,
        poolId: params.poolId,
        currentMembers: params.currentMembers,
        maxParticipants: params.maxParticipants,
        locale: loc,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar email capacity warning:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Capacity warning enviada a ${params.to}:`, data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar email capacity warning:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Notifica al host que alguien intentó unirse a un pool que ya está lleno.
 * Throttle: la frecuencia se controla en el caller (un email por pool por ventana
 * configurable) para evitar spam si muchos intentan unirse simultáneamente.
 */
export async function sendBlockedJoinAttemptEmail(params: {
  to: string;
  hostName: string;
  poolName: string;
  poolId: string;
  attemptedEmail: string;
  maxParticipants: number;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `Alguien intentó unirse a "${params.poolName}" pero está lleno`,
    en: `Someone tried to join "${params.poolName}" but it's full`,
    pt: `Alguém tentou entrar em "${params.poolName}" mas está lotado`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getBlockedJoinAttemptTemplate({
        hostName: params.hostName,
        poolName: params.poolName,
        poolId: params.poolId,
        attemptedEmail: params.attemptedEmail,
        maxParticipants: params.maxParticipants,
        locale: loc,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar email blocked join attempt:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Blocked join attempt notification enviada a ${params.to}:`, data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar email blocked join attempt:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// RESULT OVERRIDE NOTIFICATION
// =========================================================================

/**
 * Notifica a TODOS los miembros de la pool que el host modificó un resultado.
 * Incluye: partido, resultado original, resultado nuevo, razón del cambio.
 */
export async function sendResultOverrideNotification(params: {
  to: string;
  userId: string;
  memberName: string;
  poolName: string;
  poolId: string;
  matchDescription: string;
  previousResult: string;
  newResult: string;
  reason: string;
  hostName: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;

  const subjects: Record<string, string> = {
    es: `⚠️ Resultado modificado en "${params.poolName}"`,
    en: `⚠️ Result modified in "${params.poolName}"`,
    pt: `⚠️ Resultado modificado em "${params.poolName}"`,
  };

  const headings: Record<string, string> = {
    es: "Resultado modificado por el organizador",
    en: "Result modified by the organizer",
    pt: "Resultado modificado pelo organizador",
  };

  const messages: Record<string, string> = {
    es: `El organizador <strong>${params.hostName}</strong> ha modificado el resultado del partido <strong>${params.matchDescription}</strong> en la pool <strong>"${params.poolName}"</strong>.`,
    en: `The organizer <strong>${params.hostName}</strong> has modified the result for <strong>${params.matchDescription}</strong> in the pool <strong>"${params.poolName}"</strong>.`,
    pt: `O organizador <strong>${params.hostName}</strong> modificou o resultado da partida <strong>${params.matchDescription}</strong> no bolão <strong>"${params.poolName}"</strong>.`,
  };

  const reasonLabels: Record<string, string> = {
    es: "Razón del cambio",
    en: "Reason for change",
    pt: "Motivo da alteração",
  };

  const ctas: Record<string, string> = {
    es: "Ver pool",
    en: "View pool",
    pt: "Ver bolão",
  };

  const poolUrl = appendUtm(`${FRONTEND_URL}/pools/${params.poolId}`, emailUtm("result_override"));

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.es!,
      headers: getUnsubscribeHeaders(params.userId),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="padding:20px;background:${BRAND.gradient};border-radius:12px 12px 0 0;text-align:center;">
            <span style="font-size:40px;">⚠️</span>
          </div>
          <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#DC2626;margin:0 0 16px;font-size:18px;">${headings[loc] ?? headings.es}</h2>
            <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 16px;">${messages[loc] ?? messages.es}</p>

            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="color:#991b1b;font-weight:600;">❌ ${params.previousResult}</span>
                <span style="color:#166534;font-weight:600;">✅ ${params.newResult}</span>
              </div>
              <div style="color:#991b1b;font-size:13px;font-weight:600;margin-bottom:4px;">${reasonLabels[loc] ?? reasonLabels.es}:</div>
              <div style="color:#374151;font-size:14px;font-style:italic;">"${params.reason}"</div>
            </div>

            <p style="color:${BRAND.textMuted};font-size:13px;line-height:1.5;margin:0 0 20px;">
              ${loc === "es" ? "Los puntos del leaderboard se recalcularán automáticamente." :
                loc === "en" ? "Leaderboard points will be recalculated automatically." :
                "Os pontos do ranking serão recalculados automaticamente."}
            </p>

            <div style="text-align:center;">
              <a href="${poolUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
                ${ctas[loc] ?? ctas.es}
              </a>
            </div>
          </div>
          <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:16px;">
            ${APP_NAME} &middot; ${SITE_DOMAIN}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Error override notification:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("❌ Exception override notification:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// GROUP STANDINGS OVERRIDE NOTIFICATION
// =========================================================================

export async function sendGroupStandingsOverrideNotification(params: {
  to: string;
  userId: string;
  memberName: string;
  poolName: string;
  poolId: string;
  groupId: string;
  previousStandings: string[];
  newStandings: string[];
  reason: string;
  hostName: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;

  // Group display name per locale. `groupId` is the raw identifier (e.g. "A").
  const groupLabels: Record<string, string> = {
    es: `Grupo ${params.groupId}`,
    en: `Group ${params.groupId}`,
    pt: `Grupo ${params.groupId}`,
  };
  const groupName = groupLabels[loc] ?? groupLabels.es!;

  const subjects: Record<string, string> = {
    es: `⚠️ Tabla del ${groupName} modificada en "${params.poolName}"`,
    en: `⚠️ ${groupName} standings modified in "${params.poolName}"`,
    pt: `⚠️ Classificação do ${groupName} modificada em "${params.poolName}"`,
  };

  const headings: Record<string, string> = {
    es: "Tabla de posiciones modificada por el organizador",
    en: "Standings modified by the organizer",
    pt: "Classificação modificada pelo organizador",
  };

  const messages: Record<string, string> = {
    es: `El organizador <strong>${params.hostName}</strong> ha modificado la tabla de posiciones del <strong>${groupName}</strong> en la pool <strong>"${params.poolName}"</strong>.`,
    en: `The organizer <strong>${params.hostName}</strong> has modified the standings for <strong>${groupName}</strong> in the pool <strong>"${params.poolName}"</strong>.`,
    pt: `O organizador <strong>${params.hostName}</strong> modificou a classificação do <strong>${groupName}</strong> no bolão <strong>"${params.poolName}"</strong>.`,
  };

  const reasonLabels: Record<string, string> = {
    es: "Razón del cambio",
    en: "Reason for change",
    pt: "Motivo da alteração",
  };

  const beforeLabels: Record<string, string> = { es: "Antes", en: "Before", pt: "Antes" };
  const afterLabels: Record<string, string> = { es: "Después", en: "After", pt: "Depois" };

  const ctas: Record<string, string> = {
    es: "Ver pool",
    en: "View pool",
    pt: "Ver bolão",
  };

  const poolUrl = appendUtm(`${FRONTEND_URL}/pools/${params.poolId}`, emailUtm("group_standings_override"));

  function renderList(teams: string[], color: string): string {
    return teams
      .map((name, i) => `<div style="font-size:13px;color:${color};padding:2px 0;">${i + 1}. ${name}</div>`)
      .join("");
  }

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.es!,
      headers: getUnsubscribeHeaders(params.userId),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="padding:20px;background:${BRAND.gradient};border-radius:12px 12px 0 0;text-align:center;">
            <span style="font-size:40px;">⚠️</span>
          </div>
          <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#DC2626;margin:0 0 16px;font-size:18px;">${headings[loc] ?? headings.es}</h2>
            <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 16px;">${messages[loc] ?? messages.es}</p>

            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border-collapse:collapse;">
              <tr>
                <td style="width:50%;vertical-align:top;padding-right:8px;">
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">
                    <div style="color:#991b1b;font-size:12px;font-weight:700;margin-bottom:6px;text-transform:uppercase;">${beforeLabels[loc] ?? beforeLabels.es}</div>
                    ${renderList(params.previousStandings, "#991b1b")}
                  </div>
                </td>
                <td style="width:50%;vertical-align:top;padding-left:8px;">
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;">
                    <div style="color:#166534;font-size:12px;font-weight:700;margin-bottom:6px;text-transform:uppercase;">${afterLabels[loc] ?? afterLabels.es}</div>
                    ${renderList(params.newStandings, "#166534")}
                  </div>
                </td>
              </tr>
            </table>

            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 16px;">
              <div style="color:#991b1b;font-size:13px;font-weight:600;margin-bottom:4px;">${reasonLabels[loc] ?? reasonLabels.es}:</div>
              <div style="color:#374151;font-size:14px;font-style:italic;">"${params.reason}"</div>
            </div>

            <p style="color:${BRAND.textMuted};font-size:13px;line-height:1.5;margin:0 0 20px;">
              ${loc === "es" ? "Los puntos del leaderboard se recalcularán automáticamente." :
                loc === "en" ? "Leaderboard points will be recalculated automatically." :
                "Os pontos do ranking serão recalculados automaticamente."}
            </p>

            <div style="text-align:center;">
              <a href="${poolUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
                ${ctas[loc] ?? ctas.es}
              </a>
            </div>
          </div>
          <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:16px;">
            ${APP_NAME} &middot; ${SITE_DOMAIN}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Error group standings override notification:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("❌ Exception group standings override notification:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// PREDICTION UPDATE EMAIL
// =========================================================================

/**
 * Sends a prediction update notification email to a subscribed user.
 * Not subject to standard email preference checks — uses its own predictionUpdates field.
 */
export async function sendPredictionUpdateEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  locale: string;
  changes: Array<{ type: string; description: string }>;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const predictionUrl = appendUtm(`${FRONTEND_URL}/predicciones`, emailUtm("prediction_update"));
  const unsubscribeUrl = appendUtm(`${FRONTEND_URL}/profile`, emailUtm("prediction_update", "unsubscribe"));

  const { subject, html } = getPredictionUpdateTemplate({
    displayName: params.displayName,
    locale: loc,
    changes: params.changes,
    predictionUrl,
    unsubscribeUrl,
  });

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: `🔮 ${subject} — ${APP_NAME}`,
      html,
      headers: getUnsubscribeHeaders(params.userId),
    });

    if (error) {
      console.error("❌ Error al enviar prediction update email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Prediction update email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar prediction update email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// PAYMENT RECEIPT EMAIL
// =========================================================================

export async function sendPaymentReceiptEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  poolName: string;
  poolId: string;
  transactionId: string;
  amount: string;
  currency: string;
  fromCapacity: number;
  toCapacity: number;
  paidAt: Date;
  locale: string;
  /** Set when the payment fulfilled an AccountReceivable. Adds an
   *  extra row in the receipt table referencing the CC consecutive
   *  (e.g. "CC-2026-0001"). See SALES_AUDIT.md §11.9. */
  accountReceivableNumber?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `Comprobante de pago — ${APP_NAME}`,
    en: `Payment receipt — ${APP_NAME}`,
    pt: `Comprovante de pagamento — ${APP_NAME}`,
  };

  const templateParams: PaymentReceiptEmailParams = {
    displayName: params.displayName,
    poolName: params.poolName,
    poolId: params.poolId,
    transactionId: params.transactionId,
    amount: params.amount,
    currency: params.currency,
    fromCapacity: params.fromCapacity,
    toCapacity: params.toCapacity,
    paidAt: params.paidAt.toLocaleDateString(loc === "pt" ? "pt-BR" : loc === "es" ? "es-CO" : "en-US", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
    locale: loc,
    accountReceivableNumber: params.accountReceivableNumber,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      // Receipts are billing artefacts — questions about them belong
      // with the sales/billing inbox, not generic support.
      replyTo: `ventas@${process.env.EMAIL_DOMAIN || SITE_DOMAIN}`,
      html: getPaymentReceiptTemplate(templateParams),
    });

    if (error) {
      console.error("❌ Error al enviar payment receipt email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Payment receipt email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar payment receipt email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// NEW MEMBER NOTIFICATION (to host)
// =========================================================================

export async function sendNewMemberNotificationEmail(params: {
  to: string;
  hostName: string;
  memberName: string;
  poolName: string;
  poolId: string;
  currentCount: number;
  maxParticipants?: number;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `👋 ${params.memberName} se unió a "${params.poolName}"`,
    en: `👋 ${params.memberName} joined "${params.poolName}"`,
    pt: `👋 ${params.memberName} entrou em "${params.poolName}"`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getNewMemberTemplate({
        hostName: params.hostName,
        memberName: params.memberName,
        poolName: params.poolName,
        poolId: params.poolId,
        currentCount: params.currentCount,
        maxParticipants: params.maxParticipants,
        locale: loc,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar new member notification:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ New member notification enviada:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar new member notification:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// PASSWORD CHANGED NOTIFICATION
// =========================================================================

export async function sendPasswordChangedEmail(params: {
  to: string;
  displayName: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `🔒 Contraseña cambiada — ${APP_NAME}`,
    en: `🔒 Password changed — ${APP_NAME}`,
    pt: `🔒 Senha alterada — ${APP_NAME}`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPasswordChangedTemplate({ displayName: params.displayName, locale: loc }),
    });

    if (error) {
      console.error("❌ Error al enviar password changed email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Password changed email enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar password changed email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// MEMBER REMOVED NOTIFICATION (kicked/banned)
// =========================================================================

export async function sendMemberRemovedEmail(params: {
  to: string;
  displayName: string;
  poolName: string;
  reason?: string;
  type: "kicked" | "banned";
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const isBan = params.type === "banned";
  const subjects: Record<string, string> = {
    es: isBan ? `⛔ Expulsado de "${params.poolName}"` : `Removido de "${params.poolName}"`,
    en: isBan ? `⛔ Banned from "${params.poolName}"` : `Removed from "${params.poolName}"`,
    pt: isBan ? `⛔ Banido de "${params.poolName}"` : `Removido de "${params.poolName}"`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getMemberRemovedTemplate({
        displayName: params.displayName,
        poolName: params.poolName,
        reason: params.reason,
        type: params.type,
        locale: loc,
      }),
    });

    if (error) {
      console.error(`❌ Error al enviar member ${params.type} email:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Member ${params.type} email enviado:`, data?.id);
    return { success: true };
  } catch (err) {
    console.error(`❌ Excepción al enviar member ${params.type} email:`, err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// NEW MEMBER DIGEST (daily summary for hosts)
// =========================================================================

export async function sendNewMemberDigestEmail(params: {
  to: string;
  hostName: string;
  poolName: string;
  poolId: string;
  newMembers: { name: string }[];
  currentTotal: number;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const count = params.newMembers.length;
  const subjects: Record<string, string> = {
    es: `👥 ${count} ${count === 1 ? "nuevo miembro" : "nuevos miembros"} en "${params.poolName}"`,
    en: `👥 ${count} new ${count === 1 ? "member" : "members"} in "${params.poolName}"`,
    pt: `👥 ${count} ${count === 1 ? "novo membro" : "novos membros"} em "${params.poolName}"`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getNewMemberDigestTemplate({
        hostName: params.hostName,
        poolName: params.poolName,
        poolId: params.poolId,
        newMembers: params.newMembers,
        currentTotal: params.currentTotal,
        locale: loc,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar new member digest:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ New member digest enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar new member digest:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// KNOCKOUT WINNER OVERRIDE NOTIFICATION
// =========================================================================
// Sent when the host changes who advanced in a knockout match (e.g. "ya
// se había publicado que Argentina avanzaba, pero realmente fue Francia").
// Mirrors the group-standings override email — mandatory reason, listed
// in both ES/EN/PT, sent to every active member.

export async function sendKnockoutWinnerOverrideNotification(params: {
  to: string;
  userId: string;
  memberName: string;
  poolName: string;
  poolId: string;
  matchDescription: string; // "Argentina vs Francia"
  previousWinnerName: string;
  newWinnerName: string;
  reason: string;
  hostName: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;

  const subjects: Record<string, string> = {
    es: `⚠️ Cambio de avance en "${params.poolName}"`,
    en: `⚠️ Advancement changed in "${params.poolName}"`,
    pt: `⚠️ Mudança de avanço em "${params.poolName}"`,
  };

  const headings: Record<string, string> = {
    es: "Equipo que avanza modificado por el organizador",
    en: "Advancing team changed by the organizer",
    pt: "Time que avança modificado pelo organizador",
  };

  const messages: Record<string, string> = {
    es: `El organizador <strong>${params.hostName}</strong> modificó quién avanza en el partido <strong>${params.matchDescription}</strong> de la pool <strong>"${params.poolName}"</strong>.`,
    en: `The organizer <strong>${params.hostName}</strong> changed who advances from <strong>${params.matchDescription}</strong> in the pool <strong>"${params.poolName}"</strong>.`,
    pt: `O organizador <strong>${params.hostName}</strong> modificou quem avança no jogo <strong>${params.matchDescription}</strong> no bolão <strong>"${params.poolName}"</strong>.`,
  };

  const reasonLabels: Record<string, string> = {
    es: "Razón del cambio",
    en: "Reason for change",
    pt: "Motivo da alteração",
  };

  const beforeLabels: Record<string, string> = { es: "Antes", en: "Before", pt: "Antes" };
  const afterLabels: Record<string, string> = { es: "Ahora", en: "Now", pt: "Agora" };

  const ctas: Record<string, string> = {
    es: "Ver pool",
    en: "View pool",
    pt: "Ver bolão",
  };

  const poolUrl = appendUtm(`${FRONTEND_URL}/pools/${params.poolId}`, emailUtm("knockout_winner_override"));

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.es!,
      headers: getUnsubscribeHeaders(params.userId),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="padding:20px;background:${BRAND.gradient};border-radius:12px 12px 0 0;text-align:center;">
            <span style="font-size:40px;">⚠️</span>
          </div>
          <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:#DC2626;margin:0 0 16px;font-size:18px;">${headings[loc] ?? headings.es}</h2>
            <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 16px;">${messages[loc] ?? messages.es}</p>

            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="color:#991b1b;font-weight:600;">❌ ${beforeLabels[loc]}: ${params.previousWinnerName}</span>
                <span style="color:#166534;font-weight:600;">✅ ${afterLabels[loc]}: ${params.newWinnerName}</span>
              </div>
              <div style="color:#991b1b;font-size:13px;font-weight:600;margin-bottom:4px;">${reasonLabels[loc] ?? reasonLabels.es}:</div>
              <div style="color:#374151;font-size:14px;font-style:italic;">"${params.reason}"</div>
            </div>

            <p style="color:${BRAND.textMuted};font-size:13px;line-height:1.5;margin:0 0 20px;">
              ${loc === "es" ? "Los puntos del leaderboard se recalcularán automáticamente." :
                loc === "en" ? "Leaderboard points will be recalculated automatically." :
                "Os pontos do ranking serão recalculados automaticamente."}
            </p>

            <div style="text-align:center;">
              <a href="${poolUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
                ${ctas[loc] ?? ctas.es}
              </a>
            </div>
          </div>
          <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:16px;">
            ${APP_NAME} &middot; ${SITE_DOMAIN}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Error knockout winner override notification:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("❌ Exception knockout winner override notification:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// POOL REVERTED TO DRAFT NOTIFICATION (host-only)
// =========================================================================
// Sent to the pool creator when the last non-host member is removed and
// the pool auto-reverts ACTIVE → DRAFT. Lets the host know the scoring
// rules editor is now unlocked and links them to the admin panel.

export async function sendPoolRevertedToDraftEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  poolName: string;
  poolId: string;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `📝 Tu pool "${params.poolName}" volvió a borrador`,
    en: `📝 Your pool "${params.poolName}" reverted to draft`,
    pt: `📝 Seu bolão "${params.poolName}" voltou para rascunho`,
  };

  const headings: Record<string, string> = {
    es: "Pool en borrador",
    en: "Pool back to draft",
    pt: "Bolão em rascunho",
  };

  const messages: Record<string, string> = {
    es: `Tu pool <strong>"${params.poolName}"</strong> volvió al estado de borrador porque no quedan miembros activos distintos a ti. Aprovecha para ajustar las reglas de puntaje si lo deseas y vuelve a invitar a los participantes.`,
    en: `Your pool <strong>"${params.poolName}"</strong> reverted to draft because there are no active members left besides you. You can now adjust the scoring rules if you wish and invite players again.`,
    pt: `Seu bolão <strong>"${params.poolName}"</strong> voltou para o rascunho porque não restam membros ativos além de você. Aproveite para ajustar as regras de pontuação se quiser e convide os participantes novamente.`,
  };

  const ctas: Record<string, string> = {
    es: "Administrar pool",
    en: "Manage pool",
    pt: "Administrar bolão",
  };

  const noteAboutData: Record<string, string> = {
    es: "Los marcadores publicados se conservan, pero las predicciones de los jugadores que se fueron fueron eliminadas.",
    en: "Match results are preserved, but predictions from players who left have been removed.",
    pt: "Os resultados publicados são preservados, mas as previsões dos jogadores que saíram foram removidas.",
  };

  const poolUrl = appendUtm(`${FRONTEND_URL}/pools/${params.poolId}`, emailUtm("pool_reverted_to_draft"));

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.es!,
      headers: getUnsubscribeHeaders(params.userId),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="padding:20px;background:${BRAND.gradient};border-radius:12px 12px 0 0;text-align:center;">
            <span style="font-size:40px;">📝</span>
          </div>
          <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <h2 style="color:${BRAND.text};margin:0 0 16px;font-size:18px;">${headings[loc] ?? headings.es}</h2>
            <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 16px;">${messages[loc] ?? messages.es}</p>
            <p style="color:${BRAND.textMuted};font-size:13px;line-height:1.5;margin:0 0 20px;">${noteAboutData[loc] ?? noteAboutData.es}</p>
            <div style="text-align:center;">
              <a href="${poolUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
                ${ctas[loc] ?? ctas.es}
              </a>
            </div>
          </div>
          <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-top:16px;">
            ${APP_NAME} &middot; ${SITE_DOMAIN}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Error pool reverted to draft email:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("❌ Exception pool reverted to draft email:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// PENDING APPROVAL DIGEST (daily reminder for hosts with pending requests)
// =========================================================================
// Sent daily at the digest cron tick. Throttled at the service layer:
// 7 consecutive days while the pending set stays the same → then silent
// until a new request arrives or one is resolved.
//
// Respects User.emailNotificationsEnabled and User.emailNewMemberDigest
// (we deliberately reuse the same opt-out as the new-member digest so the
// host has a single switch to silence "daily summary" emails about their
// pool).

export async function sendPendingApprovalDigestEmail(params: {
  to: string;
  hostName: string;
  poolName: string;
  poolId: string;
  pendingMembers: { name: string }[];
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const count = params.pendingMembers.length;
  const subjects: Record<string, string> = {
    es: `🔔 ${count} ${count === 1 ? "solicitud" : "solicitudes"} esperando tu aprobación en "${params.poolName}"`,
    en: `🔔 ${count} ${count === 1 ? "request" : "requests"} waiting for your approval in "${params.poolName}"`,
    pt: `🔔 ${count} ${count === 1 ? "solicitação" : "solicitações"} aguardando aprovação em "${params.poolName}"`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPendingApprovalDigestTemplate({
        hostName: params.hostName,
        poolName: params.poolName,
        poolId: params.poolId,
        pendingMembers: params.pendingMembers,
        locale: loc,
      }),
    });

    if (error) {
      console.error("❌ Error al enviar pending approval digest:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Pending approval digest enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar pending approval digest:", err);
    return { success: false, error: String(err) };
  }
}

// =========================================================================
// PHASE COMPLETION SUMMARY
// =========================================================================

export async function sendPhaseCompletionSummaryEmail(params: {
  to: string;
  userId: string;
  displayName: string;
  poolName: string;
  poolId: string;
  phaseName: string;
  userRank: number;
  userPoints: number;
  totalParticipants: number;
  top10: { rank: number; name: string; points: number }[];
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Only check master toggle — phase summary is always active at platform level
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { emailNotificationsEnabled: true },
  });
  if (user && !user.emailNotificationsEnabled) {
    return { success: true };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || DEFAULT_LOCALE;
  const subjects: Record<string, string> = {
    es: `📊 Fase completada: ${params.phaseName} — Tu posición: #${params.userRank}`,
    en: `📊 Phase completed: ${params.phaseName} — Your position: #${params.userRank}`,
    pt: `📊 Fase concluída: ${params.phaseName} — Sua posição: #${params.userRank}`,
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
      html: getPhaseCompletionSummaryTemplate({
        displayName: params.displayName,
        poolName: params.poolName,
        poolId: params.poolId,
        phaseName: params.phaseName,
        userRank: params.userRank,
        userPoints: params.userPoints,
        totalParticipants: params.totalParticipants,
        top10: params.top10,
        locale: loc,
      }),
      headers: getUnsubscribeHeaders(params.userId),
    });

    if (error) {
      console.error("❌ Error al enviar phase completion summary:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Phase completion summary enviado:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar phase completion summary:", err);
    return { success: false, error: String(err) };
  }
}
