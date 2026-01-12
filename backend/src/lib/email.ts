// backend/src/lib/email.ts
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("⚠️  RESEND_API_KEY no configurada. Los emails NO se enviarán.");
}

const resend = apiKey ? new Resend(apiKey) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_NAME = "Quiniela Platform";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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
