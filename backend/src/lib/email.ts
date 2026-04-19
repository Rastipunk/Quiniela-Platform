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
import {
  getWelcomeTemplate,
  getPoolInvitationTemplate,
  getDeadlineReminderTemplate,
  getResultPublishedTemplate,
  getPoolCompletedTemplate,
  getCorporateInquiryConfirmationTemplate,
  getCorporateActivationTemplate,
  getPredictionUpdateTemplate,
  getPaymentReceiptTemplate,
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
// TIPOS Y CONSTANTES
// =========================================================================

export type EmailType =
  | "welcome"
  | "poolInvitation"
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
  poolInvitation: {
    platformField: "emailPoolInvitationEnabled",
    userField: "emailPoolInvitations",
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
        user[config.userField as keyof typeof user] ?? true;
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
 * Envía un email de reset de password
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  username: string;
  resetToken: string;
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${params.resetToken}`;

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: "Recupera tu contraseña",
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recupera tu contraseña</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 40px 0;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: ${BRAND.gradient}; border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                        ${APP_NAME}
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                        Hola, @${params.username}
                      </h2>
                      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, haz clic en el botón de abajo para crear una nueva contraseña:
                      </p>

                      <!-- Button -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background: ${BRAND.gradient}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px ${BRAND.primaryLight}66; transition: transform 0.2s;">
                              Restablecer mi contraseña
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Alternative Link -->
                      <p style="margin: 30px 0 10px; color: #718096; font-size: 14px;">
                        O copia y pega este enlace en tu navegador:
                      </p>
                      <p style="margin: 0 0 30px; padding: 12px; background-color: #f7fafc; border-radius: 6px; word-break: break-all; color: ${BRAND.primaryLight}; font-size: 13px; font-family: monospace;">
                        ${resetUrl}
                      </p>

                      <!-- Warning Box -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #fff5f5; border-left: 4px solid #f56565; border-radius: 6px;">
                        <tr>
                          <td style="padding: 16px;">
                            <p style="margin: 0; color: #742a2a; font-size: 14px; line-height: 1.5;">
                              <strong>⏱️ Importante:</strong> Este enlace expira en <strong>1 hora</strong> por razones de seguridad.
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                        Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña permanecerá sin cambios.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0 0 8px; color: #4a5568; font-size: 14px; font-weight: 600;">
                        Saludos,
                      </p>
                      <p style="margin: 0; color: #718096; font-size: 14px;">
                        El equipo de ${APP_NAME}
                      </p>
                      <p style="margin: 20px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #a0aec0; font-size: 12px; line-height: 1.5;">
                        Este es un correo automático, por favor no respondas a este mensaje.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Error al enviar email:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Email enviado:", data?.id);
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
 * Envía un email de verificación de cuenta
 * Este email SIEMPRE se envía (no está sujeto a configuración de plataforma)
 */
export async function sendVerificationEmail(params: {
  to: string;
  displayName: string;
  verificationToken: string;
}): Promise<EmailResult> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${params.verificationToken}`;

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: `Verifica tu email - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifica tu email</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 40px 0;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center; background: ${BRAND.gradient}; border-radius: 12px 12px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                        ${APP_NAME}
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                        ¡Hola, ${params.displayName}!
                      </h2>
                      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Gracias por registrarte. Para completar tu registro y acceder a todas las funciones,
                        necesitamos verificar tu dirección de email.
                      </p>

                      <!-- Button -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${verificationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                              ✓ Verificar mi email
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Alternative Link -->
                      <p style="margin: 30px 0 10px; color: #718096; font-size: 14px;">
                        O copia y pega este enlace en tu navegador:
                      </p>
                      <p style="margin: 0 0 30px; padding: 12px; background-color: #f7fafc; border-radius: 6px; word-break: break-all; color: ${BRAND.primaryLight}; font-size: 13px; font-family: monospace;">
                        ${verificationUrl}
                      </p>

                      <!-- Info Box -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0; background-color: #ebf8ff; border-left: 4px solid #3182ce; border-radius: 6px;">
                        <tr>
                          <td style="padding: 16px;">
                            <p style="margin: 0; color: #2c5282; font-size: 14px; line-height: 1.5;">
                              <strong>⏱️ Importante:</strong> Este enlace expira en <strong>24 horas</strong>.
                              Si no verificas tu email, algunas funciones estarán limitadas.
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                        Si no creaste esta cuenta, puedes ignorar este correo de forma segura.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0 0 8px; color: #4a5568; font-size: 14px; font-weight: 600;">
                        Saludos,
                      </p>
                      <p style="margin: 0; color: #718096; font-size: 14px;">
                        El equipo de ${APP_NAME}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
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
}): Promise<EmailResult> {
  // Verificar si está habilitado
  const { enabled, reason } = await isEmailEnabled("welcome", params.userId);
  if (!enabled) {
    console.log(`⏭️ Welcome email skipped: ${reason}`);
    return { success: true, skipped: true, reason };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const templateParams: WelcomeEmailParams = {
    displayName: params.displayName,
  };

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: `¡Bienvenido a ${APP_NAME}!`,
      html: getWelcomeTemplate(templateParams),
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
  userId?: string; // Puede no existir si el usuario no está registrado
  inviterName: string;
  poolName: string;
  inviteCode: string;
  poolDescription?: string;
}): Promise<EmailResult> {
  // Verificar si está habilitado (a nivel plataforma y usuario si existe)
  const { enabled, reason } = await isEmailEnabled(
    "poolInvitation",
    params.userId
  );
  if (!enabled) {
    console.log(`⏭️ Pool invitation email skipped: ${reason}`);
    return { success: true, skipped: true, reason };
  }

  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const templateParams: PoolInvitationEmailParams = {
    inviterName: params.inviterName,
    poolName: params.poolName,
    inviteCode: params.inviteCode,
    poolDescription: params.poolDescription,
  };

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: `${params.inviterName} te invitó a "${params.poolName}"`,
      html: getPoolInvitationTemplate(templateParams),
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

  const templateParams: DeadlineReminderEmailParams = {
    displayName: params.displayName,
    poolName: params.poolName,
    matchesCount: params.matchesCount,
    deadlineTime: params.deadlineTime,
    poolId: params.poolId,
  };

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: `⏰ ${params.matchesCount} partido${params.matchesCount > 1 ? "s" : ""} sin pronóstico en "${params.poolName}"`,
      html: getDeadlineReminderTemplate(templateParams),
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

  const templateParams: ResultPublishedEmailParams = {
    displayName: params.displayName,
    poolName: params.poolName,
    matchDescription: params.matchDescription,
    result: params.result,
    pointsEarned: params.pointsEarned,
    currentRank: params.currentRank,
    totalParticipants: params.totalParticipants,
    poolId: params.poolId,
  };

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: `📊 Resultado: ${params.matchDescription} (${params.result}) - ${params.pointsEarned} pts`,
      html: getResultPublishedTemplate(templateParams),
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

  const templateParams: PoolCompletedEmailParams = {
    displayName: params.displayName,
    poolName: params.poolName,
    finalRank: params.finalRank,
    totalPoints: params.totalPoints,
    totalParticipants: params.totalParticipants,
    exactScores: params.exactScores,
    poolId: params.poolId,
  };

  // Mensaje personalizado según posición
  let subjectEmoji = "🏁";
  if (params.finalRank === 1) subjectEmoji = "🏆";
  else if (params.finalRank === 2) subjectEmoji = "🥈";
  else if (params.finalRank === 3) subjectEmoji = "🥉";

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: `${subjectEmoji} "${params.poolName}" terminó - Posición #${params.finalRank}`,
      html: getPoolCompletedTemplate(templateParams),
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
    poolInvitationEnabled: settings.emailPoolInvitationEnabled,
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
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
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
}): Promise<{ success: boolean; error?: string }> {
  const ready = getReadyClient();
  if (!ready) return { success: false, error: "Email service not configured" };

  const locale = params.locale || DEFAULT_LOCALE;
  const activationUrl = `${FRONTEND_URL}/activar-cuenta?token=${params.activationToken}`;

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
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
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
    const { data, error } = await ready.client.emails.send({
      from: ready.from.replace(APP_NAME, `${APP_NAME} Admin`),
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
    });

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

  type Locale = "es" | "en" | "pt";
  type Loc = typeof SUPPORTED_LOCALES[number];
  const loc: Loc = (SUPPORTED_LOCALES as readonly string[]).includes(params.locale || "") ? params.locale as Loc : DEFAULT_LOCALE;
  const subjects: Record<Locale, string> = {
    es: `Tu pool "${params.poolName}" está lleno`,
    en: `Your pool "${params.poolName}" is full`,
    pt: `Seu bolão "${params.poolName}" está lotado`,
  };
  const headings: Record<Locale, string> = {
    es: "Tu pool alcanzó su capacidad máxima",
    en: "Your pool has reached maximum capacity",
    pt: "Seu bolão atingiu a capacidade máxima",
  };
  const messages: Record<Locale, string> = {
    es: `Tu pool <strong>"${params.poolName}"</strong> ha alcanzado su capacidad máxima de <strong>${params.maxParticipants} jugadores</strong>. Para recibir más participantes, necesitas ampliar la capacidad de tu pool.`,
    en: `Your pool <strong>"${params.poolName}"</strong> has reached its maximum capacity of <strong>${params.maxParticipants} players</strong>. To accept more participants, you need to expand your pool's capacity.`,
    pt: `Seu bolão <strong>"${params.poolName}"</strong> atingiu a capacidade máxima de <strong>${params.maxParticipants} jogadores</strong>. Para receber mais participantes, você precisa ampliar a capacidade do seu bolão.`,
  };
  const ctas: Record<Locale, string> = {
    es: "Ir a mi pool",
    en: "Go to my pool",
    pt: "Ir ao meu bolão",
  };

  const poolUrl = `${FRONTEND_URL}/pools/${params.poolId}`;

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
      to: params.to,
      subject: subjects[loc],
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#DC2626;margin-bottom:16px;">
            &#128680; ${headings[loc]}
          </h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            ${messages[loc]}
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${poolUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
              ${ctas[loc]}
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
          <p style="color:#9CA3AF;font-size:12px;text-align:center;">
            ${APP_NAME} &middot; ${SITE_DOMAIN}
          </p>
        </div>
      `,
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

  const poolUrl = `${FRONTEND_URL}/pools/${params.poolId}`;

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
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
  const predictionUrl = `${FRONTEND_URL}/predicciones`;
  const unsubscribeUrl = `${FRONTEND_URL}/profile`;

  const { subject, html } = getPredictionUpdateTemplate({
    displayName: params.displayName,
    locale: loc,
    changes: params.changes,
    predictionUrl,
    unsubscribeUrl,
  });

  try {
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
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
    const { data, error } = await ready.client.emails.send({
      from: ready.from,
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
