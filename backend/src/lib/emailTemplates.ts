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

const BRAND = {
  name: "Picks4All",
  primaryColor: "#4F46E5", // Indigo-600
  secondaryColor: "#6366F1", // Indigo-500
  textColor: "#1F2937", // Gray-800
  mutedColor: "#6B7280", // Gray-500
  backgroundColor: "#F9FAFB", // Gray-50
  cardBackground: "#FFFFFF",
  baseUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  supportEmail: "soporte@picks4all.com",
};

// Emails de soporte por locale
export const SUPPORT_EMAILS: Record<string, string> = {
  es: "soporte@picks4all.com",
  en: "support@picks4all.com",
  pt: "suporte@picks4all.com",
};

// Emails de privacidad por locale
export const PRIVACY_EMAILS: Record<string, string> = {
  es: "privacidad@picks4all.com",
  en: "privacy@picks4all.com",
  pt: "privacidade@picks4all.com",
};

// Emails de empresas por locale
export const ENTERPRISE_EMAILS: Record<string, string> = {
  es: "empresas@picks4all.com",
  en: "enterprise@picks4all.com",
  pt: "empresas@picks4all.com",
};

/** Obtener email de soporte según locale */
export function getSupportEmail(locale: string = "es"): string {
  return SUPPORT_EMAILS[locale] ?? SUPPORT_EMAILS.es!;
}

// =========================================================================
// WRAPPER BASE - Envuelve todo el contenido del email
// =========================================================================

export function getEmailWrapper(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<!--[if !mso]><!-->
    <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${preheader}
    </span>
    <!--<![endif]-->`
    : "";

  return `
<!DOCTYPE html>
<html lang="es">
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

          <!-- Header con logo/marca -->
          <tr>
            <td align="center" style="padding:32px 40px 24px;border-bottom:1px solid #E5E7EB;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:${BRAND.primaryColor};letter-spacing:-0.5px;">
                ${BRAND.name}
              </h1>
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
                      ${BRAND.name} - Tu plataforma de quinielas
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:12px;color:${BRAND.mutedColor};">
                      <a href="${BRAND.baseUrl}/terms" style="color:${BRAND.mutedColor};text-decoration:underline;">Términos</a>
                      &nbsp;|&nbsp;
                      <a href="${BRAND.baseUrl}/privacy" style="color:${BRAND.mutedColor};text-decoration:underline;">Privacidad</a>
                      &nbsp;|&nbsp;
                      <a href="${BRAND.baseUrl}/profile" style="color:${BRAND.mutedColor};text-decoration:underline;">Preferencias de email</a>
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
// TEMPLATE: WELCOME EMAIL
// =========================================================================

export interface WelcomeEmailParams {
  displayName: string;
}

export function getWelcomeTemplate({ displayName }: WelcomeEmailParams): string {
  const content = `
    ${getHeading(`¡Bienvenido, ${displayName}!`)}

    ${getParagraph(`Gracias por unirte a ${BRAND.name}. Estamos emocionados de tenerte con nosotros.`)}

    ${getParagraph("Con tu nueva cuenta puedes:")}

    <ul style="margin:0 0 24px;padding-left:24px;color:${BRAND.textColor};">
      <li style="margin-bottom:8px;">Crear tus propias quinielas y competir con amigos</li>
      <li style="margin-bottom:8px;">Unirte a quinielas existentes con un código de invitación</li>
      <li style="margin-bottom:8px;">Hacer pronósticos y seguir tu posición en el leaderboard</li>
      <li style="margin-bottom:8px;">Ganar puntos y presumir tu conocimiento deportivo</li>
    </ul>

    ${getButton("Ir a mi Dashboard", `${BRAND.baseUrl}/dashboard`)}

    ${getParagraph("¿Primera vez? Te recomendamos explorar las quinielas públicas o crear tu propia quiniela privada para jugar con amigos.")}

    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">
      Si tienes alguna pregunta, no dudes en contactarnos.
    </p>
  `;

  return getEmailWrapper(
    content,
    `¡Bienvenido a ${BRAND.name}! Tu cuenta está lista para hacer pronósticos.`
  );
}

// =========================================================================
// TEMPLATE: POOL INVITATION
// =========================================================================

export interface PoolInvitationEmailParams {
  inviterName: string;
  poolName: string;
  inviteCode: string;
  poolDescription?: string;
}

export function getPoolInvitationTemplate({
  inviterName,
  poolName,
  inviteCode,
  poolDescription,
}: PoolInvitationEmailParams): string {
  const joinUrl = `${BRAND.baseUrl}/join/${inviteCode}`;

  const content = `
    ${getHeading("¡Te han invitado a una quiniela!")}

    ${getParagraph(`<strong>${inviterName}</strong> te ha invitado a unirte a la quiniela:`)}

    ${getHighlightBox(`
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${BRAND.primaryColor};">${poolName}</p>
      ${poolDescription ? `<p style="margin:0;font-size:14px;color:${BRAND.mutedColor};">${poolDescription}</p>` : ""}
    `)}

    ${getParagraph("Haz tus pronósticos y compite por el primer lugar del leaderboard.")}

    ${getButton("Unirme a la Quiniela", joinUrl)}

    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">
      O usa este código de invitación: <strong style="color:${BRAND.primaryColor};">${inviteCode}</strong>
    </p>

    <p style="margin:16px 0 0;font-size:12px;color:${BRAND.mutedColor};">
      Si no conoces a ${inviterName} o no esperabas esta invitación, puedes ignorar este email.
    </p>
  `;

  return getEmailWrapper(
    content,
    `${inviterName} te invitó a la quiniela "${poolName}". ¡Únete y compite!`
  );
}

// =========================================================================
// TEMPLATE: DEADLINE REMINDER
// =========================================================================

export interface DeadlineReminderEmailParams {
  displayName: string;
  poolName: string;
  matchesCount: number;
  deadlineTime: string; // Formato legible: "Hoy a las 3:00 PM"
  poolId: string;
}

export function getDeadlineReminderTemplate({
  displayName,
  poolName,
  matchesCount,
  deadlineTime,
  poolId,
}: DeadlineReminderEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;

  const content = `
    ${getHeading("¡No olvides hacer tus pronósticos!")}

    ${getParagraph(`Hola ${displayName},`)}

    ${getParagraph(`Tienes <strong>${matchesCount} partido${matchesCount > 1 ? "s" : ""}</strong> sin pronóstico en la quiniela <strong>${poolName}</strong>.`)}

    ${getHighlightBox(`
      <p style="margin:0;font-size:16px;color:${BRAND.textColor};">
        <strong>Deadline:</strong> ${deadlineTime}
      </p>
    `)}

    ${getParagraph("Después del deadline no podrás modificar tus pronósticos para estos partidos.")}

    ${getButton("Hacer mis Pronósticos", poolUrl)}

    <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mutedColor};">
      Puedes desactivar estos recordatorios desde tu perfil en Preferencias de Email.
    </p>
  `;

  return getEmailWrapper(
    content,
    `Tienes ${matchesCount} partido${matchesCount > 1 ? "s" : ""} pendiente${matchesCount > 1 ? "s" : ""} en "${poolName}". Deadline: ${deadlineTime}`
  );
}

// =========================================================================
// TEMPLATE: RESULT PUBLISHED
// =========================================================================

export interface ResultPublishedEmailParams {
  displayName: string;
  poolName: string;
  matchDescription: string; // "México vs Argentina"
  result: string; // "2 - 1"
  pointsEarned: number;
  currentRank: number;
  totalParticipants: number;
  poolId: string;
}

export function getResultPublishedTemplate({
  displayName,
  poolName,
  matchDescription,
  result,
  pointsEarned,
  currentRank,
  totalParticipants,
  poolId,
}: ResultPublishedEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;

  const pointsEmoji = pointsEarned > 0 ? "🎉" : "😅";
  const rankEmoji = currentRank <= 3 ? "🏆" : "📊";

  const content = `
    ${getHeading("¡Resultado publicado!")}

    ${getParagraph(`Hola ${displayName},`)}

    ${getParagraph(`Se ha publicado el resultado de un partido en <strong>${poolName}</strong>:`)}

    ${getHighlightBox(`
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND.textColor};">${matchDescription}</p>
      <p style="margin:0;font-size:32px;font-weight:700;color:${BRAND.primaryColor};">${result}</p>
    `)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        ${getStatBox("Puntos ganados", `${pointsEarned}`, pointsEmoji)}
        <td width="16"></td>
        ${getStatBox("Tu posición", `${currentRank}/${totalParticipants}`, rankEmoji)}
      </tr>
    </table>

    ${getButton("Ver Leaderboard", poolUrl)}

    <p style="margin:24px 0 0;font-size:12px;color:${BRAND.mutedColor};">
      Puedes desactivar estas notificaciones desde tu perfil en Preferencias de Email.
    </p>
  `;

  return getEmailWrapper(
    content,
    `${matchDescription}: ${result}. Ganaste ${pointsEarned} puntos. Posición actual: #${currentRank}`
  );
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
}

export function getPoolCompletedTemplate({
  displayName,
  poolName,
  finalRank,
  totalPoints,
  totalParticipants,
  exactScores,
  poolId,
}: PoolCompletedEmailParams): string {
  const poolUrl = `${BRAND.baseUrl}/pools/${poolId}`;

  // Mensajes personalizados según posición
  let congratsMessage: string;
  let emoji: string;

  if (finalRank === 1) {
    congratsMessage = "¡Felicidades, campeón! Dominaste esta quiniela de principio a fin.";
    emoji = "🏆";
  } else if (finalRank === 2) {
    congratsMessage = "¡Increíble segundo lugar! Estuviste muy cerca de la cima.";
    emoji = "🥈";
  } else if (finalRank === 3) {
    congratsMessage = "¡Excelente tercer lugar! Subiste al podio.";
    emoji = "🥉";
  } else if (finalRank <= Math.ceil(totalParticipants * 0.25)) {
    congratsMessage = "¡Gran desempeño! Terminaste en el top 25%.";
    emoji = "⭐";
  } else {
    congratsMessage = "¡Gracias por participar! Cada quiniela es una nueva oportunidad.";
    emoji = "🎮";
  }

  const content = `
    ${getHeading(`${emoji} ¡Quiniela finalizada!`)}

    ${getParagraph(`Hola ${displayName},`)}

    ${getParagraph(`La quiniela <strong>${poolName}</strong> ha terminado.`)}

    ${getParagraph(congratsMessage)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr>
        ${getStatBox("Posición final", `#${finalRank}`, finalRank <= 3 ? "🏆" : undefined)}
        <td width="12"></td>
        ${getStatBox("Puntos totales", `${totalPoints}`, "📊")}
        <td width="12"></td>
        ${getStatBox("Marcadores exactos", `${exactScores}`, "🎯")}
      </tr>
    </table>

    ${getButton("Ver Resultados Finales", poolUrl)}

    <p style="margin:24px 0 0;font-size:14px;color:${BRAND.mutedColor};">
      ¿Listo para la revancha? Crea tu propia quiniela o únete a una nueva.
    </p>

    ${getButton("Explorar Quinielas", `${BRAND.baseUrl}/dashboard`, false)}
  `;

  return getEmailWrapper(
    content,
    `"${poolName}" terminó. Posición final: #${finalRank} de ${totalParticipants} con ${totalPoints} puntos.`
  );
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
// EXPORT DE CONSTANTES PARA USO EXTERNO
// =========================================================================

export { BRAND };
