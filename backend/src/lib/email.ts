// backend/src/lib/email.ts
import { Resend } from "resend";
import { prisma } from "../db";
import {
  getWelcomeTemplate,
  getPoolInvitationTemplate,
  getDeadlineReminderTemplate,
  getResultPublishedTemplate,
  getPoolCompletedTemplate,
  WelcomeEmailParams,
  PoolInvitationEmailParams,
  DeadlineReminderEmailParams,
  ResultPublishedEmailParams,
  PoolCompletedEmailParams,
} from "./emailTemplates";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("⚠️  RESEND_API_KEY no configurada. Los emails NO se enviarán.");
}

const resend = apiKey ? new Resend(apiKey) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "Quiniela Platform";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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
  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${params.resetToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
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
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
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
                            <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                              Restablecer mi contraseña
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Alternative Link -->
                      <p style="margin: 30px 0 10px; color: #718096; font-size: 14px;">
                        O copia y pega este enlace en tu navegador:
                      </p>
                      <p style="margin: 0 0 30px; padding: 12px; background-color: #f7fafc; border-radius: 6px; word-break: break-all; color: #667eea; font-size: 13px; font-family: monospace;">
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
  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${params.verificationToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
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
                    <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
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
                      <p style="margin: 0 0 30px; padding: 12px; background-color: #f7fafc; border-radius: 6px; word-break: break-all; color: #667eea; font-size: 13px; font-family: monospace;">
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

  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

  const templateParams: WelcomeEmailParams = {
    displayName: params.displayName,
  };

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: `¡Bienvenido a ${APP_NAME}!`,
      html: getWelcomeTemplate(templateParams),
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

  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

  const templateParams: PoolInvitationEmailParams = {
    inviterName: params.inviterName,
    poolName: params.poolName,
    inviteCode: params.inviteCode,
    poolDescription: params.poolDescription,
  };

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: `${params.inviterName} te invitó a "${params.poolName}"`,
      html: getPoolInvitationTemplate(templateParams),
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

  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

  const templateParams: DeadlineReminderEmailParams = {
    displayName: params.displayName,
    poolName: params.poolName,
    matchesCount: params.matchesCount,
    deadlineTime: params.deadlineTime,
    poolId: params.poolId,
  };

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: `⏰ ${params.matchesCount} partido${params.matchesCount > 1 ? "s" : ""} sin pronóstico en "${params.poolName}"`,
      html: getDeadlineReminderTemplate(templateParams),
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

  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

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
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: `📊 Resultado: ${params.matchDescription} (${params.result}) - ${params.pointsEarned} pts`,
      html: getResultPublishedTemplate(templateParams),
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

  if (!resend) {
    console.error("❌ No se puede enviar email: RESEND_API_KEY no configurada");
    return { success: false, error: "Email service not configured" };
  }

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
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: params.to,
      subject: `${subjectEmoji} "${params.poolName}" terminó - Posición #${params.finalRank}`,
      html: getPoolCompletedTemplate(templateParams),
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
