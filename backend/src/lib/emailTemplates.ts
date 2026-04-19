/**
 * Email Templates - Sistema de plantillas HTML para notificaciones
 *
 * Todas las plantillas siguen un diseño profesional responsive con:
 * - Wrapper consistente con branding
 * - Soporte para clientes de email (Outlook, Gmail, Apple Mail)
 * - Preheader text para preview en inbox
 * - Colores y tipografía consistentes
 */

// =========================================================================
// CONFIGURACIÓN DE MARCA
// =========================================================================

import { BRAND as B } from "./brand";

const BRAND = {
  name: B.name,
  primaryColor: B.primary,
  primaryLight: B.primaryLight,
  secondaryColor: B.secondary,
  accent: B.accent,
  gradient: B.gradient,
  gradientAlt: B.gradientAlt,
  textColor: B.text,
  mutedColor: B.textMuted,
  backgroundColor: B.background,
  cardBackground: B.card,
  baseUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  supportEmail: `soporte@${process.env.EMAIL_DOMAIN || B.domain}`,
};

// Email domain — all contact addresses derive from this
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "picks4all.com";

// Emails de soporte por locale
export const SUPPORT_EMAILS: Record<string, string> = {
  es: `soporte@${EMAIL_DOMAIN}`,
  en: `support@${EMAIL_DOMAIN}`,
  pt: `suporte@${EMAIL_DOMAIN}`,
};

// Emails de privacidad por locale
export const PRIVACY_EMAILS: Record<string, string> = {
  es: `privacidad@${EMAIL_DOMAIN}`,
  en: `privacy@${EMAIL_DOMAIN}`,
  pt: `privacidade@${EMAIL_DOMAIN}`,
};

// Emails de empresas por locale
export const ENTERPRISE_EMAILS: Record<string, string> = {
  es: `empresas@${EMAIL_DOMAIN}`,
  en: `enterprise@${EMAIL_DOMAIN}`,
  pt: `empresas@${EMAIL_DOMAIN}`,
};

/** Obtener email de soporte según locale */
export function getSupportEmail(locale: string = "es"): string {
  return SUPPORT_EMAILS[locale] ?? SUPPORT_EMAILS.es!;
}

// =========================================================================
// WRAPPER BASE - Envuelve todo el contenido del email
// =========================================================================

export function getEmailWrapper(content: string, preheader?: string, locale: string = "es"): string {
  const preheaderHtml = preheader
    ? `<!--[if !mso]><!-->
    <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${preheader}
    </span>
    <!--<![endif]-->`
    : "";

  const footerI18n: Record<string, { tagline: string; terms: string; privacy: string; prefs: string }> = {
    es: { tagline: "Tu plataforma de pronósticos deportivos", terms: "Términos", privacy: "Privacidad", prefs: "Preferencias de email" },
    en: { tagline: "Your sports prediction platform", terms: "Terms", privacy: "Privacy", prefs: "Email preferences" },
    pt: { tagline: "Sua plataforma de palpites esportivos", terms: "Termos", privacy: "Privacidade", prefs: "Preferências de email" },
  };
  const ft = footerI18n[locale] ?? footerI18n.en!;
  const lp = locale === "es" ? "" : `/${locale}`;

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${BRAND.name}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .content { padding: 24px !important; }
      .button { width: 100% !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.backgroundColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${preheaderHtml}

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.backgroundColor};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:${BRAND.cardBackground};border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">

          <!-- Header con isotipo + logotipo -->
          <tr>
            <td align="center" style="padding:32px 40px 24px;border-bottom:1px solid #E5E7EB;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${BRAND.baseUrl}/brand/isotipo-degradado-180.png" alt="" width="56" height="56" style="display:block;border-radius:12px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <img src="${BRAND.baseUrl}/brand/logotipo-degradado-120.png" alt="${BRAND.name}" height="42" style="display:block;height:42px;width:auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td class="content" style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#F3F4F6;border-radius:0 0 12px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <p style="margin:0;font-size:14px;color:${BRAND.mutedColor};">
                      ${BRAND.name} - ${ft.tagline}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:12px;color:${BRAND.mutedColor};">
                      <a href="${BRAND.baseUrl}${lp}/terms" style="color:${BRAND.mutedColor};text-decoration:underline;">${ft.terms}</a>
                      &nbsp;|&nbsp;
                      <a href="${BRAND.baseUrl}${lp}/privacy" style="color:${BRAND.mutedColor};text-decoration:underline;">${ft.privacy}</a>
                      &nbsp;|&nbsp;
                      <a href="${BRAND.baseUrl}${lp}/profile" style="color:${BRAND.mutedColor};text-decoration:underline;">${ft.prefs}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// =========================================================================
// COMPONENTES REUTILIZABLES
// =========================================================================

function getButton(text: string, url: string, primary = true): string {
  const bgColor = primary ? BRAND.primaryColor : "transparent";
  const textColor = primary ? "#FFFFFF" : BRAND.primaryColor;
  const border = primary ? "none" : `2px solid ${BRAND.primaryColor}`;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px 0;">
      <tr>
        <td>
          <a href="${url}" class="button" style="display:inline-block;background-color:${bgColor};color:${textColor};font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;border:${border};">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function getHeading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${BRAND.textColor};">${text}</h2>`;
}

function getParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.textColor};">${text}</p>`;
}

function getHighlightBox(content: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="background-color:#EEF2FF;border-left:4px solid ${BRAND.primaryColor};padding:20px;border-radius:0 8px 8px 0;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}

function getStatBox(label: string, value: string, emoji?: string): string {
  return `
    <td align="center" style="padding:16px;background-color:#F9FAFB;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:14px;color:${BRAND.mutedColor};">${label}</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">
        ${emoji ? `${emoji} ` : ""}${value}
      </p>
    </td>
  `;
}

// =========================================================================
// TEMPLATE: PASSWORD RESET
// =========================================================================

export interface PasswordResetEmailParams {
  username: string;
  resetUrl: string;
  locale?: string;
}

export function getPasswordResetTemplate({ username, resetUrl, locale = "es" }: PasswordResetEmailParams): string {
  const i18n: Record<string, {
    heading: string; greeting: string; intro: string; cta: string;
    altLabel: string; expiry: string; ignore: string; preheader: string;
  }> = {
    es: {
      heading: "Recupera tu contraseña",
      greeting: `Hola, @${username}`,
      intro: "Recibimos una solicitud para restablecer tu contraseña. Si fuiste tú, haz clic en el botón de abajo para crear una nueva contraseña:",
      cta: "Restablecer mi contraseña",
      altLabel: "O copia y pega este enlace en tu navegador:",
      expiry: "<strong>⏱️ Importante:</strong> Este enlace expira en <strong>1 hora</strong> por razones de seguridad.",
      ignore: "Si no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña permanecerá sin cambios.",
      preheader: "Restablece tu contraseña de forma segura.",
    },
    en: {
      heading: "Reset your password",
      greeting: `Hi, @${username}`,
      intro: "We received a request to reset your password. If this was you, click the button below to create a new password:",
      cta: "Reset my password",
      altLabel: "Or copy and paste this link in your browser:",
      expiry: "<strong>⏱️ Important:</strong> This link expires in <strong>1 hour</strong> for security reasons.",
      ignore: "If you didn't request this change, you can safely ignore this email. Your password will remain unchanged.",
      preheader: "Reset your password securely.",
    },
    pt: {
      heading: "Recupere sua senha",
      greeting: `Olá, @${username}`,
      intro: "Recebemos uma solicitação para redefinir sua senha. Se foi você, clique no botão abaixo para criar uma nova senha:",
      cta: "Redefinir minha senha",
      altLabel: "Ou copie e cole este link no seu navegador:",
      expiry: "<strong>⏱️ Importante:</strong> Este link expira em <strong>1 hora</strong> por razões de segurança.",
      ignore: "Se você não solicitou essa alteração, pode ignorar este e-mail com segurança. Sua senha permanecerá inalterada.",
      preheader: "Redefina sua senha com segurança.",
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    <h3 style="margin:0 0 20px;color:#1a1a1a;font-size:20px;font-weight:600;">${t.greeting}</h3>
    ${getParagraph(t.intro)}
    ${getButton(t.cta, resetUrl)}
    <p style="margin:30px 0 10px;color:${BRAND.mutedColor};font-size:14px;">${t.altLabel}</p>
    <p style="margin:0 0 30px;padding:12px;background-color:#f7fafc;border-radius:6px;word-break:break-all;color:${BRAND.primaryLight};font-size:13px;font-family:monospace;">${resetUrl}</p>
    ${getHighlightBox(`<p style="margin:0;font-size:14px;line-height:1.5;color:#742a2a;">${t.expiry}</p>`)}
    <p style="margin:30px 0 0;color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">${t.ignore}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: EMAIL VERIFICATION
// =========================================================================

export interface VerificationEmailParams {
  displayName: string;
  verificationUrl: string;
  locale?: string;
}

export function getVerificationTemplate({ displayName, verificationUrl, locale = "es" }: VerificationEmailParams): string {
  const i18n: Record<string, {
    heading: string; greeting: string; intro: string; cta: string;
    altLabel: string; expiry: string; ignore: string; preheader: string;
  }> = {
    es: {
      heading: "Verifica tu email",
      greeting: `¡Hola, ${displayName}!`,
      intro: "Gracias por registrarte. Para completar tu registro y acceder a todas las funciones, necesitamos verificar tu dirección de email.",
      cta: "✓ Verificar mi email",
      altLabel: "O copia y pega este enlace en tu navegador:",
      expiry: "<strong>⏱️ Importante:</strong> Este enlace expira en <strong>24 horas</strong>. Si no verificas tu email, algunas funciones estarán limitadas.",
      ignore: "Si no creaste esta cuenta, puedes ignorar este correo de forma segura.",
      preheader: "Verifica tu email para completar tu registro.",
    },
    en: {
      heading: "Verify your email",
      greeting: `Hi, ${displayName}!`,
      intro: "Thanks for signing up. To complete your registration and access all features, we need to verify your email address.",
      cta: "✓ Verify my email",
      altLabel: "Or copy and paste this link in your browser:",
      expiry: "<strong>⏱️ Important:</strong> This link expires in <strong>24 hours</strong>. If you don't verify your email, some features will be limited.",
      ignore: "If you didn't create this account, you can safely ignore this email.",
      preheader: "Verify your email to complete your registration.",
    },
    pt: {
      heading: "Verifique seu email",
      greeting: `Olá, ${displayName}!`,
      intro: "Obrigado por se registrar. Para concluir seu cadastro e acessar todas as funcionalidades, precisamos verificar seu endereço de email.",
      cta: "✓ Verificar meu email",
      altLabel: "Ou copie e cole este link no seu navegador:",
      expiry: "<strong>⏱️ Importante:</strong> Este link expira em <strong>24 horas</strong>. Se você não verificar seu email, algumas funcionalidades estarão limitadas.",
      ignore: "Se você não criou esta conta, pode ignorar este e-mail com segurança.",
      preheader: "Verifique seu email para concluir seu cadastro.",
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    <h3 style="margin:0 0 20px;color:#1a1a1a;font-size:20px;font-weight:600;">${t.greeting}</h3>
    ${getParagraph(t.intro)}
    ${getButton(t.cta, verificationUrl)}
    <p style="margin:30px 0 10px;color:${BRAND.mutedColor};font-size:14px;">${t.altLabel}</p>
    <p style="margin:0 0 30px;padding:12px;background-color:#f7fafc;border-radius:6px;word-break:break-all;color:${BRAND.primaryLight};font-size:13px;font-family:monospace;">${verificationUrl}</p>
    ${getHighlightBox(`<p style="margin:0;font-size:14px;line-height:1.5;color:#2c5282;">${t.expiry}</p>`)}
    <p style="margin:30px 0 0;color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">${t.ignore}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: WELCOME EMAIL
// =========================================================================

export interface WelcomeEmailParams {
  displayName: string;
  locale?: string;
}

export function getWelcomeTemplate({ displayName, locale = "es" }: WelcomeEmailParams): string {
  const i18n: Record<string, {
    heading: string; intro: string; canDo: string;
    li1: string; li2: string; li3: string; li4: string;
    cta: string; tip: string; footer: string; preheader: string;
  }> = {
    es: {
      heading: `¡Bienvenido, ${displayName}!`,
      intro: `Gracias por unirte a ${BRAND.name}. Estamos emocionados de tenerte con nosotros.`,
      canDo: "Con tu nueva cuenta puedes:",
      li1: "Crear tus propias quinielas y competir con amigos",
      li2: "Unirte a quinielas existentes con un código de invitación",
      li3: "Hacer pronósticos y seguir tu posición en el leaderboard",
      li4: "Ganar puntos y presumir tu conocimiento deportivo",
      cta: "Ir a mi Dashboard",
      tip: "¿Primera vez? Te recomendamos explorar las quinielas públicas o crear tu propia quiniela privada para jugar con amigos.",
      footer: "Si tienes alguna pregunta, no dudes en contactarnos.",
      preheader: `¡Bienvenido a ${BRAND.name}! Tu cuenta está lista para hacer pronósticos.`,
    },
    en: {
      heading: `Welcome, ${displayName}!`,
      intro: `Thanks for joining ${BRAND.name}. We're excited to have you with us.`,
      canDo: "With your new account you can:",
      li1: "Create your own pools and compete with friends",
      li2: "Join existing pools with an invite code",
      li3: "Make predictions and track your leaderboard position",
      li4: "Earn points and show off your sports knowledge",
      cta: "Go to my Dashboard",
      tip: "First time? We recommend exploring public pools or creating your own private pool to play with friends.",
      footer: "If you have any questions, feel free to reach out.",
      preheader: `Welcome to ${BRAND.name}! Your account is ready to make predictions.`,
    },
    pt: {
      heading: `Bem-vindo, ${displayName}!`,
      intro: `Obrigado por se juntar ao ${BRAND.name}. Estamos felizes em ter você conosco.`,
      canDo: "Com sua nova conta você pode:",
      li1: "Criar seus próprios bolões e competir com amigos",
      li2: "Entrar em bolões existentes com um código de convite",
      li3: "Fazer palpites e acompanhar sua posição no ranking",
      li4: "Ganhar pontos e mostrar seu conhecimento esportivo",
      cta: "Ir ao meu Dashboard",
      tip: "Primeira vez? Recomendamos explorar os bolões públicos ou criar seu próprio bolão privado para jogar com amigos.",
      footer: "Se tiver alguma dúvida, não hesite em nos contatar.",
      preheader: `Bem-vindo ao ${BRAND.name}! Sua conta está pronta para fazer palpites.`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;
  const lp = locale === "es" ? "" : `/${locale}`;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.intro)}
    ${getParagraph(t.canDo)}
    <ul style="margin:0 0 24px;padding-left:24px;color:${BRAND.textColor};">
      <li style="margin-bottom:8px;">${t.li1}</li>
      <li style="margin-bottom:8px;">${t.li2}</li>
      <li style="margin-bottom:8px;">${t.li3}</li>
      <li style="margin-bottom:8px;">${t.li4}</li>
    </ul>
    ${getButton(t.cta, `${BRAND.baseUrl}${lp}/dashboard`)}
    ${getParagraph(t.tip)}
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">${t.footer}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: POOL INVITATION
// =========================================================================

export interface PoolInvitationEmailParams {
  inviterName: string;
  poolName: string;
  inviteCode: string;
  poolDescription?: string;
  locale?: string;
}

export function getPoolInvitationTemplate({
  inviterName, poolName, inviteCode, poolDescription, locale = "es",
}: PoolInvitationEmailParams): string {
  const joinUrl = `${BRAND.baseUrl}/join/${inviteCode}`;

  const i18n: Record<string, {
    heading: string; intro: string; compete: string; cta: string;
    codeAlt: string; safety: string; preheader: string;
  }> = {
    es: {
      heading: "¡Te han invitado a una quiniela!",
      intro: `<strong>${inviterName}</strong> te ha invitado a unirte a la quiniela:`,
      compete: "Haz tus pronósticos y compite por el primer lugar del leaderboard.",
      cta: "Unirme a la Quiniela",
      codeAlt: `O usa este código de invitación: <strong style="color:${BRAND.primaryColor};">${inviteCode}</strong>`,
      safety: `Si no conoces a ${inviterName} o no esperabas esta invitación, puedes ignorar este email.`,
      preheader: `${inviterName} te invitó a la quiniela "${poolName}". ¡Únete y compite!`,
    },
    en: {
      heading: "You've been invited to a pool!",
      intro: `<strong>${inviterName}</strong> has invited you to join the pool:`,
      compete: "Make your predictions and compete for the top of the leaderboard.",
      cta: "Join the Pool",
      codeAlt: `Or use this invite code: <strong style="color:${BRAND.primaryColor};">${inviteCode}</strong>`,
      safety: `If you don't know ${inviterName} or weren't expecting this invitation, you can ignore this email.`,
      preheader: `${inviterName} invited you to the pool "${poolName}". Join and compete!`,
    },
    pt: {
      heading: "Você foi convidado para um bolão!",
      intro: `<strong>${inviterName}</strong> convidou você para participar do bolão:`,
      compete: "Faça seus palpites e dispute o primeiro lugar no ranking.",
      cta: "Entrar no Bolão",
      codeAlt: `Ou use este código de convite: <strong style="color:${BRAND.primaryColor};">${inviteCode}</strong>`,
      safety: `Se você não conhece ${inviterName} ou não esperava este convite, pode ignorar este email.`,
      preheader: `${inviterName} convidou você para o bolão "${poolName}". Entre e jogue!`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.intro)}
    ${getHighlightBox(`
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND.primaryColor};">${poolName}</p>
      ${poolDescription ? `<p style="margin:0;font-size:14px;color:${BRAND.mutedColor};">${poolDescription}</p>` : ""}
    `)}
    ${getParagraph(t.compete)}
    ${getButton(t.cta, joinUrl)}
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">${t.codeAlt}</p>
    <p style="margin:16px 0 0;font-size:12px;color:${BRAND.mutedColor};">${t.safety}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: DEADLINE REMINDER
// =========================================================================

export interface DeadlineReminderEmailParams {
  displayName: string;
  poolName: string;
  matchesCount: number;
  deadlineTime: string;
  poolId: string;
  locale?: string;
}

export function getDeadlineReminderTemplate({
  displayName, poolName, matchesCount, deadlineTime, poolId, locale = "es",
}: DeadlineReminderEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;
  const plural = matchesCount > 1;

  const i18n: Record<string, {
    heading: string; greeting: string; pending: string;
    warning: string; cta: string; optout: string; preheader: string;
  }> = {
    es: {
      heading: "¡No olvides hacer tus pronósticos!",
      greeting: `Hola ${displayName},`,
      pending: `Tienes <strong>${matchesCount} partido${plural ? "s" : ""}</strong> sin pronóstico en la quiniela <strong>${poolName}</strong>.`,
      warning: "Después del deadline no podrás modificar tus pronósticos para estos partidos.",
      cta: "Hacer mis Pronósticos",
      optout: "Puedes desactivar estos recordatorios desde tu perfil en Preferencias de Email.",
      preheader: `Tienes ${matchesCount} partido${plural ? "s" : ""} pendiente${plural ? "s" : ""} en "${poolName}". Deadline: ${deadlineTime}`,
    },
    en: {
      heading: "Don't forget to make your predictions!",
      greeting: `Hi ${displayName},`,
      pending: `You have <strong>${matchesCount} match${plural ? "es" : ""}</strong> without a prediction in the pool <strong>${poolName}</strong>.`,
      warning: "After the deadline, you won't be able to modify your predictions for these matches.",
      cta: "Make my Predictions",
      optout: "You can disable these reminders from your profile in Email Preferences.",
      preheader: `You have ${matchesCount} pending match${plural ? "es" : ""} in "${poolName}". Deadline: ${deadlineTime}`,
    },
    pt: {
      heading: "Não esqueça de fazer seus palpites!",
      greeting: `Olá ${displayName},`,
      pending: `Você tem <strong>${matchesCount} partida${plural ? "s" : ""}</strong> sem palpite no bolão <strong>${poolName}</strong>.`,
      warning: "Após o prazo, você não poderá modificar seus palpites para essas partidas.",
      cta: "Fazer meus Palpites",
      optout: "Você pode desativar esses lembretes no seu perfil em Preferências de Email.",
      preheader: `Você tem ${matchesCount} partida${plural ? "s" : ""} pendente${plural ? "s" : ""} em "${poolName}". Prazo: ${deadlineTime}`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.pending)}
    ${getHighlightBox(`
      <p style="margin:0;font-size:16px;color:${BRAND.textColor};">
        <strong>Deadline:</strong> ${deadlineTime}
      </p>
    `)}
    ${getParagraph(t.warning)}
    ${getButton(t.cta, poolUrl)}
    <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mutedColor};">${t.optout}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: RESULT PUBLISHED
// =========================================================================

export interface ResultPublishedEmailParams {
  displayName: string;
  poolName: string;
  matchDescription: string;
  result: string;
  pointsEarned: number;
  currentRank: number;
  totalParticipants: number;
  poolId: string;
  locale?: string;
}

export function getResultPublishedTemplate({
  displayName, poolName, matchDescription, result,
  pointsEarned, currentRank, totalParticipants, poolId, locale = "es",
}: ResultPublishedEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;
  const pointsEmoji = pointsEarned > 0 ? "🎉" : "😅";
  const rankEmoji = currentRank <= 3 ? "🏆" : "📊";

  const i18n: Record<string, {
    heading: string; greeting: string; intro: string;
    points: string; rank: string; cta: string; optout: string; preheader: string;
  }> = {
    es: {
      heading: "¡Resultado publicado!",
      greeting: `Hola ${displayName},`,
      intro: `Se ha publicado el resultado de un partido en <strong>${poolName}</strong>:`,
      points: "Puntos ganados",
      rank: "Tu posición",
      cta: "Ver Leaderboard",
      optout: "Puedes desactivar estas notificaciones desde tu perfil en Preferencias de Email.",
      preheader: `${matchDescription}: ${result}. Ganaste ${pointsEarned} puntos. Posición actual: #${currentRank}`,
    },
    en: {
      heading: "Result published!",
      greeting: `Hi ${displayName},`,
      intro: `A match result has been published in <strong>${poolName}</strong>:`,
      points: "Points earned",
      rank: "Your position",
      cta: "View Leaderboard",
      optout: "You can disable these notifications from your profile in Email Preferences.",
      preheader: `${matchDescription}: ${result}. You earned ${pointsEarned} points. Current position: #${currentRank}`,
    },
    pt: {
      heading: "Resultado publicado!",
      greeting: `Olá ${displayName},`,
      intro: `O resultado de uma partida foi publicado em <strong>${poolName}</strong>:`,
      points: "Pontos ganhos",
      rank: "Sua posição",
      cta: "Ver Ranking",
      optout: "Você pode desativar estas notificações no seu perfil em Preferências de Email.",
      preheader: `${matchDescription}: ${result}. Você ganhou ${pointsEarned} pontos. Posição atual: #${currentRank}`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.intro)}
    ${getHighlightBox(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND.textColor};">${matchDescription}</p>
      <p style="margin:0;font-size:32px;font-weight:700;color:${BRAND.primaryColor};">${result}</p>
    `)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        ${getStatBox(t.points, `${pointsEarned}`, pointsEmoji)}
        <td width="16"></td>
        ${getStatBox(t.rank, `${currentRank}/${totalParticipants}`, rankEmoji)}
      </tr>
    </table>
    ${getButton(t.cta, poolUrl)}
    <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mutedColor};">${t.optout}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: POOL COMPLETED
// =========================================================================

export interface PoolCompletedEmailParams {
  displayName: string;
  poolName: string;
  finalRank: number;
  totalPoints: number;
  totalParticipants: number;
  exactScores: number;
  poolId: string;
  locale?: string;
}

export function getPoolCompletedTemplate({
  displayName, poolName, finalRank, totalPoints,
  totalParticipants, exactScores, poolId, locale = "es",
}: PoolCompletedEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;
  const lp = locale === "es" ? "" : `/${locale}`;

  const congrats: Record<string, Record<string, { msg: string; emoji: string }>> = {
    es: { "1": { msg: "¡Felicidades, campeón! Dominaste esta quiniela de principio a fin.", emoji: "🏆" }, "2": { msg: "¡Increíble segundo lugar! Estuviste muy cerca de la cima.", emoji: "🥈" }, "3": { msg: "¡Excelente tercer lugar! Subiste al podio.", emoji: "🥉" }, top: { msg: "¡Gran desempeño! Terminaste en el top 25%.", emoji: "⭐" }, other: { msg: "¡Gracias por participar! Cada quiniela es una nueva oportunidad.", emoji: "🎮" } },
    en: { "1": { msg: "Congratulations, champion! You dominated this pool from start to finish.", emoji: "🏆" }, "2": { msg: "Incredible second place! You were so close to the top.", emoji: "🥈" }, "3": { msg: "Excellent third place! You made it to the podium.", emoji: "🥉" }, top: { msg: "Great performance! You finished in the top 25%.", emoji: "⭐" }, other: { msg: "Thanks for playing! Every pool is a new opportunity.", emoji: "🎮" } },
    pt: { "1": { msg: "Parabéns, campeão! Você dominou este bolão do início ao fim.", emoji: "🏆" }, "2": { msg: "Incrível segundo lugar! Você chegou muito perto do topo.", emoji: "🥈" }, "3": { msg: "Excelente terceiro lugar! Você subiu ao pódio.", emoji: "🥉" }, top: { msg: "Ótimo desempenho! Você terminou no top 25%.", emoji: "⭐" }, other: { msg: "Obrigado por participar! Cada bolão é uma nova oportunidade.", emoji: "🎮" } },
  };

  const loc = congrats[locale] ?? congrats.en!;
  const rank = finalRank <= 3 ? String(finalRank) : finalRank <= Math.ceil(totalParticipants * 0.25) ? "top" : "other";
  const { msg: congratsMessage, emoji } = loc[rank]!;

  const i18n: Record<string, {
    heading: string; greeting: string; ended: string;
    rankLabel: string; pointsLabel: string; exactLabel: string;
    ctaResults: string; rematch: string; ctaExplore: string; preheader: string;
  }> = {
    es: {
      heading: `${emoji} ¡Quiniela finalizada!`, greeting: `Hola ${displayName},`,
      ended: `La quiniela <strong>${poolName}</strong> ha terminado.`,
      rankLabel: "Posición final", pointsLabel: "Puntos totales", exactLabel: "Marcadores exactos",
      ctaResults: "Ver Resultados Finales",
      rematch: "¿Listo para la revancha? Crea tu propia quiniela o únete a una nueva.",
      ctaExplore: "Explorar Quinielas",
      preheader: `"${poolName}" terminó. Posición final: #${finalRank} de ${totalParticipants} con ${totalPoints} puntos.`,
    },
    en: {
      heading: `${emoji} Pool completed!`, greeting: `Hi ${displayName},`,
      ended: `The pool <strong>${poolName}</strong> has ended.`,
      rankLabel: "Final position", pointsLabel: "Total points", exactLabel: "Exact scores",
      ctaResults: "View Final Results",
      rematch: "Ready for a rematch? Create your own pool or join a new one.",
      ctaExplore: "Explore Pools",
      preheader: `"${poolName}" ended. Final position: #${finalRank} of ${totalParticipants} with ${totalPoints} points.`,
    },
    pt: {
      heading: `${emoji} Bolão finalizado!`, greeting: `Olá ${displayName},`,
      ended: `O bolão <strong>${poolName}</strong> terminou.`,
      rankLabel: "Posição final", pointsLabel: "Pontos totais", exactLabel: "Placares exatos",
      ctaResults: "Ver Resultados Finais",
      rematch: "Pronto para a revanche? Crie seu próprio bolão ou entre em um novo.",
      ctaExplore: "Explorar Bolões",
      preheader: `"${poolName}" terminou. Posição final: #${finalRank} de ${totalParticipants} com ${totalPoints} pontos.`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.ended)}
    ${getParagraph(congratsMessage)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        ${getStatBox(t.rankLabel, `#${finalRank}`, finalRank <= 3 ? "🏆" : undefined)}
        <td width="12"></td>
        ${getStatBox(t.pointsLabel, `${totalPoints}`, "📊")}
        <td width="12"></td>
        ${getStatBox(t.exactLabel, `${exactScores}`, "🎯")}
      </tr>
    </table>
    ${getButton(t.ctaResults, poolUrl)}
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">${t.rematch}</p>
    ${getButton(t.ctaExplore, `${BRAND.baseUrl}${lp}/dashboard`, false)}
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: CORPORATE INQUIRY CONFIRMATION
// =========================================================================

export interface CorporateInquiryConfirmationParams {
  contactName: string;
  companyName: string;
  locale?: string;
}

export function getCorporateInquiryConfirmationTemplate({
  contactName,
  companyName,
  locale = "es",
}: CorporateInquiryConfirmationParams): string {
  const enterpriseEmail = ENTERPRISE_EMAILS[locale] ?? ENTERPRISE_EMAILS.es!;
  const enterpriseUrl = `${BRAND.baseUrl}/${locale === "en" ? "en/enterprise" : locale === "pt" ? "pt/empresas" : "empresas"}`;

  const i18n: Record<string, { heading: string; greeting: string; body: string; summary: string; cta: string; ctaLabel: string; footer: string; preheader: string }> = {
    es: {
      heading: "Hemos recibido tu solicitud",
      greeting: `Hola ${contactName},`,
      body: `Gracias por tu interés en ${BRAND.name} para <strong>${companyName}</strong>. Hemos recibido tu solicitud y nuestro equipo se pondrá en contacto contigo pronto para discutir cómo podemos ayudarte a organizar quinielas corporativas.`,
      summary: `Empresa: <strong>${companyName}</strong>`,
      cta: enterpriseUrl,
      ctaLabel: "Ver Plan Empresarial",
      footer: `Si tienes preguntas mientras tanto, escríbenos a <a href="mailto:${enterpriseEmail}" style="color:${BRAND.primaryColor};">${enterpriseEmail}</a>.`,
      preheader: `Recibimos tu solicitud corporativa para ${companyName}. Te contactaremos pronto.`,
    },
    en: {
      heading: "We've received your request",
      greeting: `Hi ${contactName},`,
      body: `Thank you for your interest in ${BRAND.name} for <strong>${companyName}</strong>. We've received your request and our team will get in touch soon to discuss how we can help you organize corporate pools.`,
      summary: `Company: <strong>${companyName}</strong>`,
      cta: enterpriseUrl,
      ctaLabel: "View Enterprise Plan",
      footer: `If you have questions in the meantime, reach us at <a href="mailto:${enterpriseEmail}" style="color:${BRAND.primaryColor};">${enterpriseEmail}</a>.`,
      preheader: `We received your corporate request for ${companyName}. We'll be in touch soon.`,
    },
    pt: {
      heading: "Recebemos sua solicitação",
      greeting: `Olá ${contactName},`,
      body: `Obrigado pelo seu interesse no ${BRAND.name} para <strong>${companyName}</strong>. Recebemos sua solicitação e nossa equipe entrará em contato em breve para discutir como podemos ajudá-lo a organizar bolões corporativos.`,
      summary: `Empresa: <strong>${companyName}</strong>`,
      cta: enterpriseUrl,
      ctaLabel: "Ver Plano Empresarial",
      footer: `Se tiver dúvidas, entre em contato pelo <a href="mailto:${enterpriseEmail}" style="color:${BRAND.primaryColor};">${enterpriseEmail}</a>.`,
      preheader: `Recebemos sua solicitação corporativa para ${companyName}. Entraremos em contato em breve.`,
    },
  };

  const t = i18n[locale] ?? i18n.es!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    ${getHighlightBox(`<p style="margin:0;font-size:16px;color:${BRAND.textColor};">${t.summary}</p>`)}
    ${getButton(t.ctaLabel, t.cta)}
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">${t.footer}</p>
  `;

  return getEmailWrapper(content, t.preheader);
}

// =========================================================================
// TEMPLATE: CORPORATE ACTIVATION EMAIL
// =========================================================================

export interface CorporateActivationEmailParams {
  employeeName?: string;
  companyName: string;
  poolName: string;
  activationUrl: string;
  locale?: string;
  logoCid?: string | null;
  invitationMessage?: string | null;
}

export function getCorporateActivationTemplate({
  employeeName,
  companyName,
  poolName,
  activationUrl,
  locale = "es",
  logoCid,
  invitationMessage,
}: CorporateActivationEmailParams): string {
  const supportEmail = SUPPORT_EMAILS[locale] ?? SUPPORT_EMAILS.es!;

  const i18n: Record<string, {
    heroSubtitle: string;
    greeting: string;
    body: string;
    poolLabel: string;
    ctaLabel: string;
    instructions: string;
    expiry: string;
    footer: string;
    preheader: string;
  }> = {
    es: {
      heroSubtitle: "te reta a jugar",
      greeting: employeeName ? `Hey ${employeeName}!` : "Hey!",
      body: `Tu equipo en <strong>${companyName}</strong> ya está armando su quiniela y necesitan que te sumes. Demuestra que eres el/la que más sabe de fútbol.`,
      poolLabel: poolName,
      ctaLabel: "Entrar a jugar →",
      instructions: "Solo necesitas crear usuario y clave. Toma 30 segundos.",
      expiry: "Tienes 30 días para activar tu cuenta.",
      footer: `¿Dudas? Escríbenos a <a href="mailto:${supportEmail}" style="color:${BRAND.primaryColor};">${supportEmail}</a>.`,
      preheader: `${companyName} te reta! Únete a la quiniela "${poolName}" y demuestra lo que sabes.`,
    },
    en: {
      heroSubtitle: "challenges you to play",
      greeting: employeeName ? `Hey ${employeeName}!` : "Hey!",
      body: `Your crew at <strong>${companyName}</strong> is setting up a sports pool and they need you in. Show everyone who really knows football.`,
      poolLabel: poolName,
      ctaLabel: "Get in the game →",
      instructions: "Just create a username and password. Takes 30 seconds.",
      expiry: "You have 30 days to activate your account.",
      footer: `Questions? Hit us up at <a href="mailto:${supportEmail}" style="color:${BRAND.primaryColor};">${supportEmail}</a>.`,
      preheader: `${companyName} challenges you! Join the pool "${poolName}" and prove what you know.`,
    },
    pt: {
      heroSubtitle: "te desafia a jogar",
      greeting: employeeName ? `E aí ${employeeName}!` : "E aí!",
      body: `A galera da <strong>${companyName}</strong> já está montando o bolão e precisa de você. Mostra quem realmente entende de futebol.`,
      poolLabel: poolName,
      ctaLabel: "Entrar no jogo →",
      instructions: "Só criar usuário e senha. Leva 30 segundos.",
      expiry: "Você tem 30 dias para ativar sua conta.",
      footer: `Dúvidas? Manda pra gente em <a href="mailto:${supportEmail}" style="color:${BRAND.primaryColor};">${supportEmail}</a>.`,
      preheader: `${companyName} te desafia! Entre no bolão "${poolName}" e mostre o que você sabe.`,
    },
  };

  const t = i18n[locale] ?? i18n.es!;

  // Logo: CID inline image (works in Gmail!) or letter-initial fallback
  const initial = companyName.charAt(0).toUpperCase();
  const logoHtml = logoCid
    ? `<img src="cid:${logoCid}" alt="${companyName}" style="max-height:200px;max-width:400px;border-radius:16px;" />`
    : `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
          <td style="width:120px;height:120px;border-radius:20px;background-color:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);text-align:center;vertical-align:middle;font-size:52px;font-weight:800;color:#ffffff;line-height:120px;">
            ${initial}
          </td>
        </tr>
      </table>`;

  // Invitation message block
  const invitationHtml = invitationMessage
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;">
        <tr>
          <td style="background-color:#F5F3FF;border-radius:12px;padding:20px 24px;">
            <p style="margin:0;font-size:15px;line-height:1.6;color:#4c1d95;font-style:italic;">&ldquo;${invitationMessage}&rdquo;</p>
            <p style="margin:10px 0 0;font-size:13px;color:#7c3aed;text-align:right;font-weight:600;">— ${companyName}</p>
          </td>
        </tr>
      </table>`
    : "";

  // Custom corporate email
  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${companyName} - ${BRAND.name}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 24px 20px !important; }
      .hero-title { font-size: 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0edf6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!--[if !mso]><!-->
  <span style="display:none;font-size:1px;color:#f0edf6;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${t.preheader}
  </span>
  <!--<![endif]-->

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0edf6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0">

          <!-- Hero banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 100%);border-radius:16px 16px 0 0;padding:44px 40px 40px;text-align:center;">
              <!-- Company logo or initial -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:18px;">
                <tr>
                  <td style="text-align:center;vertical-align:middle;">
                    ${logoHtml}
                  </td>
                </tr>
              </table>
              <h1 class="hero-title" style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                ${companyName}
              </h1>
              <p style="margin:10px 0 0;font-size:16px;color:rgba(255,255,255,0.8);font-weight:600;">
                ${t.heroSubtitle}
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td class="content" style="background-color:#ffffff;padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:17px;line-height:1.6;color:${BRAND.textColor};font-weight:600;">
                ${t.greeting}
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${BRAND.textColor};">
                ${t.body}
              </p>

              ${invitationHtml}

              <!-- Pool name -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#EEF2FF;border-radius:12px;padding:16px 20px;text-align:center;">
                    <p style="margin:0;font-size:20px;line-height:1;">&#9917;&#127942;</p>
                    <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#1e1b4b;">${t.poolLabel}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px 0 24px;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);box-shadow:0 4px 14px rgba(99,102,241,0.3);">
                    <a href="${activationUrl}" style="display:inline-block;padding:18px 52px;font-size:18px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.5px;">
                      ${t.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.mutedColor};text-align:center;">
                ${t.instructions}
              </p>
              <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;">
                ${t.expiry}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f7fc;border-radius:0 0 16px 16px;padding:24px 40px;">
              <p style="margin:0 0 12px;font-size:13px;color:${BRAND.mutedColor};text-align:center;">
                ${t.footer}
              </p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                <a href="${BRAND.baseUrl}/terms" style="color:#9CA3AF;text-decoration:underline;">Términos</a>
                &nbsp;·&nbsp;
                <a href="${BRAND.baseUrl}/privacy" style="color:#9CA3AF;text-decoration:underline;">Privacidad</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#c4b5fd;text-align:center;font-weight:500;">
                ${BRAND.name}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// =========================================================================
// TEMPLATE: PREDICTION UPDATE EMAIL
// =========================================================================

export interface PredictionUpdateEmailParams {
  displayName: string;
  locale: string;
  changes: Array<{ type: string; description: string }>;
  predictionUrl: string;
  unsubscribeUrl: string;
}

export function getPredictionUpdateTemplate(params: PredictionUpdateEmailParams): { subject: string; html: string } {
  const { displayName, locale, changes, predictionUrl, unsubscribeUrl } = params;

  type Locale = "es" | "en" | "pt";
  const loc = (["es", "en", "pt"].includes(locale) ? locale : "es") as Locale;

  const subjects: Record<Locale, string> = {
    es: "La predicción del Mundial 2026 se ha actualizado",
    en: "The World Cup 2026 prediction has been updated",
    pt: "A previsão da Copa do Mundo 2026 foi atualizada",
  };

  const headings: Record<Locale, string> = {
    es: "Predicción actualizada",
    en: "Prediction updated",
    pt: "Previsão atualizada",
  };

  const greetings: Record<Locale, string> = {
    es: `Hola ${displayName},`,
    en: `Hi ${displayName},`,
    pt: `Olá ${displayName},`,
  };

  const intros: Record<Locale, string> = {
    es: "Nuestra predicción AI del Mundial 2026 ha sido actualizada con los siguientes cambios:",
    en: "Our AI prediction for the World Cup 2026 has been updated with the following changes:",
    pt: "Nossa previsão de IA para a Copa do Mundo 2026 foi atualizada com as seguintes mudanças:",
  };

  const ctas: Record<Locale, string> = {
    es: "Ver predicción completa",
    en: "View full prediction",
    pt: "Ver previsão completa",
  };

  const unsubTexts: Record<Locale, string> = {
    es: "No quiero recibir más estas actualizaciones",
    en: "I don't want to receive these updates anymore",
    pt: "Não quero mais receber essas atualizações",
  };

  const footerTexts: Record<Locale, string> = {
    es: "Recibes este email porque te suscribiste a actualizaciones de predicciones.",
    en: "You are receiving this email because you subscribed to prediction updates.",
    pt: "Você está recebendo este email porque se inscreveu para atualizações de previsões.",
  };

  // Build changes list HTML
  const changesHtml = changes.map((c) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">
        <span style="display:inline-block;background-color:${BRAND.primaryLight}22;color:${BRAND.primaryColor};font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;margin-right:8px;">${c.type}</span>
        <span style="color:${BRAND.textColor};font-size:14px;">${c.description}</span>
      </td>
    </tr>
  `).join("");

  const content = `
    ${getHeading(headings[loc])}

    ${getParagraph(greetings[loc])}

    ${getParagraph(intros[loc])}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 24px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      ${changesHtml}
    </table>

    ${getButton(ctas[loc], predictionUrl)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;">
      <tr>
        <td align="center">
          <a href="${unsubscribeUrl}" style="font-size:13px;color:${BRAND.mutedColor};text-decoration:underline;">
            ${unsubTexts[loc]}
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:8px;">
          <p style="margin:0;font-size:12px;color:${BRAND.mutedColor};">
            ${footerTexts[loc]}
          </p>
        </td>
      </tr>
    </table>
  `;

  const preheaders: Record<Locale, string> = {
    es: "Hay cambios en la predicción AI del Mundial 2026. Revísalos ahora.",
    en: "There are changes to the World Cup 2026 AI prediction. Check them out.",
    pt: "Há mudanças na previsão de IA da Copa do Mundo 2026. Confira agora.",
  };

  return {
    subject: subjects[loc],
    html: getEmailWrapper(content, preheaders[loc]),
  };
}

// =========================================================================
// PAYMENT RECEIPT EMAIL
// =========================================================================

export interface PaymentReceiptEmailParams {
  displayName: string;
  poolName: string;
  poolId: string;
  transactionId: string;
  amount: string;
  currency: string;
  fromCapacity: number;
  toCapacity: number;
  paidAt: string;
  locale: string;
}

export function getPaymentReceiptTemplate(params: PaymentReceiptEmailParams): string {
  const loc = params.locale || "en";

  const i18n: Record<string, {
    heading: string; intro: string; details: string; pool: string;
    transaction: string; amount: string; upgrade: string; date: string;
    participants: string; cta: string; preheader: string; footer: string;
  }> = {
    es: {
      heading: "Comprobante de pago",
      intro: `Hola ${params.displayName}, tu pago fue procesado exitosamente.`,
      details: "Detalles de la transacción",
      pool: "Pool",
      transaction: "ID Transacción",
      amount: "Monto",
      upgrade: "Ampliación",
      date: "Fecha",
      participants: "participantes",
      cta: "Ir a mi pool",
      preheader: `Pago confirmado — ${params.poolName}`,
      footer: "Conserva este correo como comprobante de tu transacción.",
    },
    en: {
      heading: "Payment receipt",
      intro: `Hi ${params.displayName}, your payment was processed successfully.`,
      details: "Transaction details",
      pool: "Pool",
      transaction: "Transaction ID",
      amount: "Amount",
      upgrade: "Upgrade",
      date: "Date",
      participants: "participants",
      cta: "Go to my pool",
      preheader: `Payment confirmed — ${params.poolName}`,
      footer: "Keep this email as proof of your transaction.",
    },
    pt: {
      heading: "Comprovante de pagamento",
      intro: `Olá ${params.displayName}, seu pagamento foi processado com sucesso.`,
      details: "Detalhes da transação",
      pool: "Bolão",
      transaction: "ID Transação",
      amount: "Valor",
      upgrade: "Ampliação",
      date: "Data",
      participants: "participantes",
      cta: "Ir ao meu bolão",
      preheader: `Pagamento confirmado — ${params.poolName}`,
      footer: "Guarde este e-mail como comprovante da sua transação.",
    },
  };

  const t = i18n[loc] ?? i18n.en!;
  const poolUrl = `${BRAND.baseUrl}/pools/${params.poolId}`;

  const content = `
    ${getHeading(`✅ ${t.heading}`)}
    ${getParagraph(t.intro)}

    ${getHighlightBox(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding:8px 0;color:${BRAND.mutedColor};font-size:14px;">${t.pool}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:${BRAND.textColor};font-size:14px;">${params.poolName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:${BRAND.mutedColor};font-size:14px;">${t.transaction}</td>
          <td style="padding:8px 0;text-align:right;font-family:monospace;color:${BRAND.textColor};font-size:13px;">${params.transactionId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:${BRAND.mutedColor};font-size:14px;">${t.amount}</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:${BRAND.primaryColor};font-size:16px;">${params.amount} ${params.currency}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:${BRAND.mutedColor};font-size:14px;">${t.upgrade}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:${BRAND.textColor};font-size:14px;">${params.fromCapacity} → ${params.toCapacity} ${t.participants}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:${BRAND.mutedColor};font-size:14px;">${t.date}</td>
          <td style="padding:8px 0;text-align:right;color:${BRAND.textColor};font-size:14px;">${params.paidAt}</td>
        </tr>
      </table>
    `)}

    ${getButton(t.cta, poolUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:${BRAND.mutedColor};text-align:center;">
      ${t.footer}
    </p>
  `;

  return getEmailWrapper(content, t.preheader);
}

// =========================================================================
// TEMPLATE: POOL FULL NOTIFICATION
// =========================================================================

export interface PoolFullEmailParams {
  hostName: string;
  poolName: string;
  poolId: string;
  maxParticipants: number;
  locale?: string;
}

export function getPoolFullTemplate({ hostName, poolName, poolId, maxParticipants, locale = "es" }: PoolFullEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;

  const i18n: Record<string, {
    heading: string; greeting: string; body: string;
    capacity: string; cta: string; tip: string; preheader: string;
  }> = {
    es: {
      heading: "🎉 ¡Tu pool está lleno!",
      greeting: `Hola ${hostName},`,
      body: `Tu pool <strong>${poolName}</strong> ha alcanzado la capacidad máxima de <strong>${maxParticipants} participantes</strong>.`,
      capacity: `${maxParticipants}/${maxParticipants}`,
      cta: "Administrar Pool",
      tip: "Si necesitas más espacio, puedes ampliar la capacidad desde la configuración del pool.",
      preheader: `"${poolName}" alcanzó ${maxParticipants} participantes. ¡Pool completo!`,
    },
    en: {
      heading: "🎉 Your pool is full!",
      greeting: `Hi ${hostName},`,
      body: `Your pool <strong>${poolName}</strong> has reached the maximum capacity of <strong>${maxParticipants} participants</strong>.`,
      capacity: `${maxParticipants}/${maxParticipants}`,
      cta: "Manage Pool",
      tip: "If you need more room, you can upgrade the pool capacity from the pool settings.",
      preheader: `"${poolName}" reached ${maxParticipants} participants. Pool full!`,
    },
    pt: {
      heading: "🎉 Seu bolão está lotado!",
      greeting: `Olá ${hostName},`,
      body: `Seu bolão <strong>${poolName}</strong> atingiu a capacidade máxima de <strong>${maxParticipants} participantes</strong>.`,
      capacity: `${maxParticipants}/${maxParticipants}`,
      cta: "Gerenciar Bolão",
      tip: "Se precisar de mais espaço, você pode ampliar a capacidade nas configurações do bolão.",
      preheader: `"${poolName}" atingiu ${maxParticipants} participantes. Bolão completo!`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    ${getHighlightBox(`
      <p style="margin:0;font-size:32px;font-weight:700;color:${BRAND.primaryColor};text-align:center;">
        ${t.capacity}
      </p>
    `)}
    ${getButton(t.cta, poolUrl)}
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">${t.tip}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: NEW MEMBER JOINED NOTIFICATION
// =========================================================================

export interface NewMemberEmailParams {
  hostName: string;
  memberName: string;
  poolName: string;
  poolId: string;
  currentCount: number;
  maxParticipants?: number;
  locale?: string;
}

export function getNewMemberTemplate({
  hostName, memberName, poolName, poolId, currentCount, maxParticipants, locale = "es",
}: NewMemberEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;
  const capacityStr = maxParticipants ? `${currentCount}/${maxParticipants}` : `${currentCount}`;

  const i18n: Record<string, {
    heading: string; greeting: string; body: string;
    membersLabel: string; cta: string; preheader: string;
  }> = {
    es: {
      heading: "👋 Nuevo miembro en tu pool",
      greeting: `Hola ${hostName},`,
      body: `<strong>${memberName}</strong> se ha unido a tu pool <strong>${poolName}</strong>.`,
      membersLabel: "Participantes",
      cta: "Ver Pool",
      preheader: `${memberName} se unió a "${poolName}".`,
    },
    en: {
      heading: "👋 New member in your pool",
      greeting: `Hi ${hostName},`,
      body: `<strong>${memberName}</strong> has joined your pool <strong>${poolName}</strong>.`,
      membersLabel: "Participants",
      cta: "View Pool",
      preheader: `${memberName} joined "${poolName}".`,
    },
    pt: {
      heading: "👋 Novo membro no seu bolão",
      greeting: `Olá ${hostName},`,
      body: `<strong>${memberName}</strong> entrou no seu bolão <strong>${poolName}</strong>.`,
      membersLabel: "Participantes",
      cta: "Ver Bolão",
      preheader: `${memberName} entrou em "${poolName}".`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    ${getHighlightBox(`
      <p style="margin:0;font-size:14px;color:${BRAND.mutedColor};">${t.membersLabel}</p>
      <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">${capacityStr}</p>
    `)}
    ${getButton(t.cta, poolUrl)}
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: PASSWORD CHANGED NOTIFICATION
// =========================================================================

export interface PasswordChangedEmailParams {
  displayName: string;
  locale?: string;
}

export function getPasswordChangedTemplate({ displayName, locale = "es" }: PasswordChangedEmailParams): string {
  const supportEmail = SUPPORT_EMAILS[locale] ?? SUPPORT_EMAILS.es!;

  const i18n: Record<string, {
    heading: string; greeting: string; body: string;
    warning: string; preheader: string;
  }> = {
    es: {
      heading: "🔒 Tu contraseña fue cambiada",
      greeting: `Hola ${displayName},`,
      body: "Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.",
      warning: "Si no realizaste este cambio, contacta a nuestro equipo de soporte inmediatamente.",
      preheader: "Tu contraseña ha sido restablecida exitosamente.",
    },
    en: {
      heading: "🔒 Your password was changed",
      greeting: `Hi ${displayName},`,
      body: "Your password has been reset successfully. You can now log in with your new password.",
      warning: "If you didn't make this change, contact our support team immediately.",
      preheader: "Your password has been reset successfully.",
    },
    pt: {
      heading: "🔒 Sua senha foi alterada",
      greeting: `Olá ${displayName},`,
      body: "Sua senha foi redefinida com sucesso. Agora você pode fazer login com sua nova senha.",
      warning: "Se você não fez essa alteração, entre em contato com nossa equipe de suporte imediatamente.",
      preheader: "Sua senha foi redefinida com sucesso.",
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    ${getHighlightBox(`<p style="margin:0;font-size:14px;line-height:1.5;color:#991b1b;"><strong>⚠️</strong> ${t.warning} <a href="mailto:${supportEmail}" style="color:${BRAND.primaryColor};">${supportEmail}</a></p>`)}
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: MEMBER REMOVED NOTIFICATION
// =========================================================================

export interface MemberRemovedEmailParams {
  displayName: string;
  poolName: string;
  reason?: string;
  type: "kicked" | "banned";
  locale?: string;
}

export function getMemberRemovedTemplate({ displayName, poolName, reason, type, locale = "es" }: MemberRemovedEmailParams): string {
  const isBan = type === "banned";

  const i18n: Record<string, {
    heading: string; greeting: string; body: string;
    reasonLabel: string; note: string; preheader: string;
  }> = {
    es: {
      heading: isBan ? "⛔ Has sido expulsado de un pool" : "Has sido removido de un pool",
      greeting: `Hola ${displayName},`,
      body: isBan
        ? `Has sido permanentemente expulsado del pool <strong>${poolName}</strong> por el organizador.`
        : `Has sido removido del pool <strong>${poolName}</strong> por el organizador.`,
      reasonLabel: "Motivo",
      note: isBan
        ? "Esta acción es permanente y no podrás volver a unirte a este pool."
        : "Puedes volver a unirte si recibes una nueva invitación.",
      preheader: isBan
        ? `Has sido expulsado del pool "${poolName}".`
        : `Has sido removido del pool "${poolName}".`,
    },
    en: {
      heading: isBan ? "⛔ You've been banned from a pool" : "You've been removed from a pool",
      greeting: `Hi ${displayName},`,
      body: isBan
        ? `You have been permanently banned from the pool <strong>${poolName}</strong> by the organizer.`
        : `You have been removed from the pool <strong>${poolName}</strong> by the organizer.`,
      reasonLabel: "Reason",
      note: isBan
        ? "This action is permanent and you won't be able to rejoin this pool."
        : "You can rejoin if you receive a new invitation.",
      preheader: isBan
        ? `You've been banned from the pool "${poolName}".`
        : `You've been removed from the pool "${poolName}".`,
    },
    pt: {
      heading: isBan ? "⛔ Você foi banido de um bolão" : "Você foi removido de um bolão",
      greeting: `Olá ${displayName},`,
      body: isBan
        ? `Você foi permanentemente banido do bolão <strong>${poolName}</strong> pelo organizador.`
        : `Você foi removido do bolão <strong>${poolName}</strong> pelo organizador.`,
      reasonLabel: "Motivo",
      note: isBan
        ? "Esta ação é permanente e você não poderá voltar a este bolão."
        : "Você pode voltar se receber um novo convite.",
      preheader: isBan
        ? `Você foi banido do bolão "${poolName}".`
        : `Você foi removido do bolão "${poolName}".`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const reasonHtml = reason
    ? getHighlightBox(`
        <p style="margin:0 0 4px;font-size:13px;color:${BRAND.mutedColor};">${t.reasonLabel}:</p>
        <p style="margin:0;font-size:15px;color:${BRAND.textColor};font-style:italic;">"${reason}"</p>
      `)
    : "";

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    ${reasonHtml}
    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">${t.note}</p>
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: NEW MEMBER DIGEST (daily summary for hosts)
// =========================================================================

export interface NewMemberDigestEmailParams {
  hostName: string;
  poolName: string;
  poolId: string;
  newMembers: { name: string }[];
  currentTotal: number;
  locale?: string;
}

export function getNewMemberDigestTemplate({
  hostName, poolName, poolId, newMembers, currentTotal, locale = "es",
}: NewMemberDigestEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;
  const count = newMembers.length;

  const i18n: Record<string, {
    heading: string; greeting: string; body: string;
    membersLabel: string; newLabel: string; cta: string; preheader: string;
  }> = {
    es: {
      heading: `👥 ${count} ${count === 1 ? "nuevo miembro" : "nuevos miembros"} en tu pool`,
      greeting: `Hola ${hostName},`,
      body: `${count === 1 ? "Una persona se unió" : `${count} personas se unieron`} a tu pool <strong>${poolName}</strong> en las últimas 24 horas.`,
      membersLabel: "Total participantes",
      newLabel: count === 1 ? "Nuevo miembro" : "Nuevos miembros",
      cta: "Ver Pool",
      preheader: `${count} ${count === 1 ? "nuevo miembro" : "nuevos miembros"} en "${poolName}".`,
    },
    en: {
      heading: `👥 ${count} new ${count === 1 ? "member" : "members"} in your pool`,
      greeting: `Hi ${hostName},`,
      body: `${count} ${count === 1 ? "person" : "people"} joined your pool <strong>${poolName}</strong> in the last 24 hours.`,
      membersLabel: "Total participants",
      newLabel: `New ${count === 1 ? "member" : "members"}`,
      cta: "View Pool",
      preheader: `${count} new ${count === 1 ? "member" : "members"} in "${poolName}".`,
    },
    pt: {
      heading: `👥 ${count} ${count === 1 ? "novo membro" : "novos membros"} no seu bolão`,
      greeting: `Olá ${hostName},`,
      body: `${count} ${count === 1 ? "pessoa entrou" : "pessoas entraram"} no seu bolão <strong>${poolName}</strong> nas últimas 24 horas.`,
      membersLabel: "Total participantes",
      newLabel: count === 1 ? "Novo membro" : "Novos membros",
      cta: "Ver Bolão",
      preheader: `${count} ${count === 1 ? "novo membro" : "novos membros"} em "${poolName}".`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const memberListHtml = newMembers.map((m) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:15px;color:${BRAND.textColor};">👤 ${m.name}</td></tr>`
  ).join("");

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 12px;background-color:#F9FAFB;font-size:13px;font-weight:600;color:${BRAND.mutedColor};text-transform:uppercase;letter-spacing:0.05em;">${t.newLabel}</td></tr>
      ${memberListHtml}
    </table>
    ${getHighlightBox(`
      <p style="margin:0;font-size:14px;color:${BRAND.mutedColor};">${t.membersLabel}</p>
      <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">${currentTotal}</p>
    `)}
    ${getButton(t.cta, poolUrl)}
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// TEMPLATE: PHASE COMPLETION SUMMARY
// =========================================================================

export interface PhaseCompletionSummaryEmailParams {
  displayName: string;
  poolName: string;
  poolId: string;
  phaseName: string;
  userRank: number;
  userPoints: number;
  totalParticipants: number;
  top10: { rank: number; name: string; points: number }[];
  locale?: string;
}

export function getPhaseCompletionSummaryTemplate({
  displayName, poolName, poolId, phaseName, userRank, userPoints,
  totalParticipants, top10, locale = "es",
}: PhaseCompletionSummaryEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;

  const i18n: Record<string, {
    heading: string; greeting: string; body: string;
    rankLabel: string; pointsLabel: string; ofLabel: string;
    leaderboardTitle: string; rankCol: string; playerCol: string; ptsCol: string;
    cta: string; preheader: string;
  }> = {
    es: {
      heading: `📊 Fase completada: ${phaseName}`,
      greeting: `Hola ${displayName},`,
      body: `La fase <strong>${phaseName}</strong> de la pool <strong>${poolName}</strong> ha terminado.`,
      rankLabel: "Tu posición", pointsLabel: "Tus puntos", ofLabel: `de ${totalParticipants}`,
      leaderboardTitle: "Top 10",
      rankCol: "#", playerCol: "Jugador", ptsCol: "Pts",
      cta: "Ver Leaderboard Completo",
      preheader: `${phaseName} completada en "${poolName}". Tu posición: #${userRank} con ${userPoints} pts.`,
    },
    en: {
      heading: `📊 Phase completed: ${phaseName}`,
      greeting: `Hi ${displayName},`,
      body: `The <strong>${phaseName}</strong> phase of pool <strong>${poolName}</strong> has ended.`,
      rankLabel: "Your position", pointsLabel: "Your points", ofLabel: `of ${totalParticipants}`,
      leaderboardTitle: "Top 10",
      rankCol: "#", playerCol: "Player", ptsCol: "Pts",
      cta: "View Full Leaderboard",
      preheader: `${phaseName} completed in "${poolName}". Your position: #${userRank} with ${userPoints} pts.`,
    },
    pt: {
      heading: `📊 Fase concluída: ${phaseName}`,
      greeting: `Olá ${displayName},`,
      body: `A fase <strong>${phaseName}</strong> do bolão <strong>${poolName}</strong> terminou.`,
      rankLabel: "Sua posição", pointsLabel: "Seus pontos", ofLabel: `de ${totalParticipants}`,
      leaderboardTitle: "Top 10",
      rankCol: "#", playerCol: "Jogador", ptsCol: "Pts",
      cta: "Ver Leaderboard Completo",
      preheader: `${phaseName} concluída em "${poolName}". Sua posição: #${userRank} com ${userPoints} pts.`,
    },
  };
  const t = i18n[locale] ?? i18n.en!;

  const top10Rows = top10.map((entry) => {
    const isUser = entry.name === displayName;
    const bgColor = isUser ? "#EEF2FF" : "transparent";
    const fontWeight = isUser ? "700" : "400";
    const medal = entry.rank === 1 ? "🥇 " : entry.rank === 2 ? "🥈 " : entry.rank === 3 ? "🥉 " : "";
    return `<tr style="background-color:${bgColor};">
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:${fontWeight};color:${BRAND.textColor};">${medal}${entry.rank}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:${fontWeight};color:${BRAND.textColor};">${entry.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:${fontWeight};color:${BRAND.primaryColor};text-align:right;">${entry.points}</td>
    </tr>`;
  }).join("");

  const content = `
    ${getHeading(t.heading)}
    ${getParagraph(t.greeting)}
    ${getParagraph(t.body)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        ${getStatBox(t.rankLabel, `#${userRank}`, userRank <= 3 ? "🏆" : undefined)}
        <td width="12"></td>
        ${getStatBox(t.pointsLabel, `${userPoints}`, "📊")}
      </tr>
    </table>
    <p style="margin:0 0 4px;font-size:11px;text-align:center;color:${BRAND.mutedColor};">${t.ofLabel}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <tr style="background-color:#F9FAFB;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:${BRAND.mutedColor};text-transform:uppercase;letter-spacing:0.05em;">${t.rankCol}</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:${BRAND.mutedColor};text-transform:uppercase;letter-spacing:0.05em;">${t.playerCol}</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:${BRAND.mutedColor};text-transform:uppercase;letter-spacing:0.05em;text-align:right;">${t.ptsCol}</td>
      </tr>
      ${top10Rows}
    </table>
    ${getButton(t.cta, poolUrl)}
  `;

  return getEmailWrapper(content, t.preheader, locale);
}

// =========================================================================
// EXPORT DE CONSTANTES PARA USO EXTERNO
// =========================================================================

export { BRAND };
