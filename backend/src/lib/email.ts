// backend/src/lib/email.ts
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

import { Resend } from "resend";
import { prisma } from "../db";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, countryToLocale, type SupportedLocale } from "./constants";
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
  getCorporateActivationTemplate,
  getPredictionUpdateTemplate,
  getPaymentReceiptTemplate,
  getNewMemberDigestTemplate,
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
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;

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
  payload: Omit<Parameters<Resend["emails"]["send"]>[0], "from"> & { skipSuppressionCheck?: boolean },
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
  const { skipSuppressionCheck: _, ...sendPayload } = payload;

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
  if (!userId) return "en";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true },
  });
  return countryToLocale(user?.country);
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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
// ADMIN NOTIFICATIONS
// =========================================================================

/**
 * Envía una notificación interna al admin.
 * Usado para: feedback/bugs, corporate inquiries, errores críticos.
 */
export async function sendAdminNotification(params: {
  subject: string;
  body: string;
  type: "feedback" | "corporate_inquiry" | "error";
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };
  if (!ADMIN_EMAIL) {
    console.warn("⚠️  ADMIN_NOTIFICATION_EMAIL no configurada. Notificación omitida.");
    return { success: false, error: "ADMIN_NOTIFICATION_EMAIL not configured" };
  }

  const typeLabels: Record<string, string> = {
    feedback: "💬 Feedback",
    corporate_inquiry: "🏢 Corporate Inquiry",
    error: "🚨 Error",
  };

  const label = typeLabels[params.type] || params.type;

  try {
    const { data, error } = await resilientSend(
      { ...ready, from: ready.from.replace(APP_NAME, `${APP_NAME} Admin`) },
      {
        to: ADMIN_EMAIL!,
        subject: `[${label}] ${params.subject}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1F2937;border-bottom:2px solid ${BRAND.primary};padding-bottom:8px;">${label}</h2>
            <div style="color:#374151;font-size:15px;line-height:1.6;">
              ${params.body}
            </div>
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
            <p style="color:#9CA3AF;font-size:12px;">
              ${APP_NAME} Admin Notification &middot; ${new Date().toISOString()}
            </p>
          </div>
        `,
      },
    );

    if (error) {
      console.error("❌ Error al enviar notificación admin:", error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Admin notification enviada (${params.type}):`, data?.id);
    return { success: true };
  } catch (err) {
    console.error("❌ Excepción al enviar notificación admin:", err);
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const loc = params.locale || "en";
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
  };

  try {
    const { data, error } = await resilientSend(ready, {
      to: params.to,
      subject: subjects[loc] ?? subjects.en!,
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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

  const loc = params.locale || "en";
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
