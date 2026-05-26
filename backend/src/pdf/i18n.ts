/**
 * Trilingual dictionary for PDF body copy.
 *
 * Per §11.18, every Quote / AccountReceivable is rendered in one of
 * `es` / `en` / `pt`. The fixed sections (§2 intro, §3 bullets, §5
 * steps, table headers, footer) live here, indexed by locale.
 *
 * `{term}` is substituted at render time with the admin's chosen
 * value from saleTerms.ts. Sentences are written to AVOID adjective
 * coupling so the substitution works for both feminine ("polla") and
 * masculine ("pool" / "prode") terms without grammar breakage.
 *
 * Adding a key: add to all three locales in the same edit. The
 * `PdfDict` type below catches missing keys at compile time.
 */

import type { SaleLocale } from "../lib/saleTerms";

export interface PdfDict {
  // Document type titles
  quoteTitle: string;
  ccTitle: string;
  quoteTagline: string;

  // Cover & header common
  preparedFor: string;
  dateLabel: string;

  // Quote sections
  quoteSec1Title: string;       // 1. Datos del Cliente
  quoteSec1ColLeft: string;     // Campo
  quoteSec1ColRight: string;    // Información
  quoteSec1FieldName: string;   // Razón social
  quoteSec1FieldEmail: string;  // Correo electrónico
  quoteSec1FieldDate: string;   // Fecha

  quoteSec2Title: string;       // 2. ¿Qué es Picks4All?
  quoteSec2Body1: string;       // First paragraph with {term}
  quoteSec2Body2: string;       // Second paragraph

  quoteSec3Title: string;       // 3. ¿Qué incluye el Plan Empresarial?
  quoteSec3Bullets: ReadonlyArray<readonly [heading: string, body: string]>;

  quoteSec4Title: string;       // 4. Inversión
  quoteSec4Intro: string;       // Pago único por torneo...
  quoteSec4TournamentSuffix: string; // Torneo: {tournament}
  quoteSec4ColConcept: string;
  quoteSec4ColTotal: string;
  quoteSec4ColPerPerson: string;
  quoteSec4TotalLabel: string;  // TOTAL — {participants} PARTICIPANTES
  quoteSec4Disclaimer: string;

  quoteSec5Title: string;       // 5. ¿Cómo empezamos?
  quoteSec5Steps: ReadonlyArray<string>;

  ctaTitle: string;
  ctaBody: string;

  // CC blocks
  ccCityDate: (city: string, date: string) => string;
  ccBlockValueTo: string;       // Valor a pagar a
  ccBlockConcept: string;       // Por concepto de
  ccBlockAmount: string;        // La suma de
  ccBlockPayment: string;       // Forma de pago
  ccBlockClient: string;        // Datos del cliente
  ccPaymentMethod1Title: string; // Transferencia bancaria
  ccPaymentMethod2Title: string; // Pago en línea (tarjeta)
  ccPaymentMethod2Intro: string;
  ccPaymentDualNew: string;     // Si aún no creaste la pool:
  ccPaymentDualExisting: string; // Si ya tienes la pool creada:
  ccPaymentDualNewValue: string;
  ccPaymentDualExistingValue: string;
  ccPaymentCodeLabel: string;   // Código:
  ccValidity: (date: string) => string; // Vigencia: ...
  ccValidityLabel: string;
  ccRegimen: string;            // The DIAN phrase — ONLY rendered for es
  ccBankAccountTitleSuffix: string; // (sub-line under "A nombre de:")
  ccConsecLabel: string;        // No.

  // Footer
  pageLabel: string;            // "Pág." vs "Page" vs "Pág."
}

const ES_BULLETS = [
  ["Polla a tu medida", "Configuras tu polla en minutos: eliges el torneo, el nombre de la polla, el mensaje de bienvenida y las reglas que mejor se adapten a tu equipo."],
  ["Invitación masiva y sin complicaciones", "Invita a cientos de colaboradores con un solo enlace o a través de una carga masiva. Cada persona se registra en segundos y queda lista para jugar, sin pasos técnicos ni trámites."],
  ["Resultados confiables y en tiempo real", "Los puntajes se actualizan automáticamente a medida que avanzan los partidos. El ranking se mantiene siempre al día y las reglas se aplican de forma transparente para todos los participantes."],
  ["Puntuación flexible", "Define cómo quieres premiar los aciertos: acertar el resultado exacto, el ganador, los goles, los partidos eliminatorios, el campeón y más. Tú decides cómo se gana en tu polla."],
  ["Experiencia profesional", "Diseño moderno, responsivo y cuidado al detalle, tanto en computador como en celular. Tus colaboradores verán una experiencia pulida, que representa bien el estándar de tu marca."],
  ["Control total para el administrador", "Desde un panel dedicado puedes ver en tiempo real quién participa, cómo va el ranking, enviar recordatorios, editar reglas, ajustar grupos y acompañar el torneo de principio a fin."],
  ["Notificaciones inteligentes", "Avisos automáticos cuando se acerca el cierre de pronósticos, cuando hay resultados nuevos o cuando cambia el liderato del ranking. Así mantenemos viva la conversación dentro del equipo."],
  ["Privacidad y cumplimiento normativo", "Tratamos los datos de tus colaboradores bajo estándares de seguridad y privacidad. No hay apuestas, no hay pagos entre usuarios, no se piden datos financieros y la experiencia es 100% legal en todos los países donde operamos."],
] as const;

const EN_BULLETS = [
  ["Custom-fit pool", "Configure your pool in minutes: pick the tournament, the pool name, the welcome message, and the rules that best suit your team."],
  ["Effortless mass invitations", "Invite hundreds of employees with a single link or bulk upload. Each person signs up in seconds and is ready to play — no technical steps, no paperwork."],
  ["Reliable real-time results", "Scores update automatically as matches progress. The ranking stays current at all times and the rules apply transparently to all participants."],
  ["Flexible scoring", "Decide how correct picks are rewarded: exact score, winner, goals, knockout matches, champion, and more. You set the rules."],
  ["Professional experience", "Modern, responsive, and detail-oriented design — on desktop and mobile alike. Your team will see a polished experience that reflects your brand's standard."],
  ["Full admin control", "From a dedicated panel see who's playing in real time, how the ranking is going, send reminders, edit rules, adjust groups, and run the tournament end-to-end."],
  ["Smart notifications", "Automatic reminders when prediction deadlines approach, when new results come in, or when ranking leaders change. Keeps the conversation alive."],
  ["Privacy and compliance", "We handle your employees' data under privacy and security standards. No betting, no payments between users, no financial data collected — 100% legal in every country we operate in."],
] as const;

const PT_BULLETS = [
  ["Bolão sob medida", "Configure seu bolão em minutos: escolha o torneio, o nome do bolão, a mensagem de boas-vindas e as regras que melhor se adaptam à sua equipe."],
  ["Convite em massa sem complicações", "Convide centenas de colaboradores com um único link ou via upload em lote. Cada pessoa se cadastra em segundos e está pronta para jogar, sem etapas técnicas ou burocracia."],
  ["Resultados confiáveis em tempo real", "Os placares são atualizados automaticamente conforme os jogos avançam. O ranking se mantém em dia e as regras se aplicam de forma transparente para todos os participantes."],
  ["Pontuação flexível", "Defina como premiar os acertos: placar exato, vencedor, gols, jogos eliminatórios, campeão e mais. Você decide como se ganha."],
  ["Experiência profissional", "Design moderno, responsivo e cuidadoso no detalhe, no computador e no celular. Seus colaboradores verão uma experiência polida, que representa bem o padrão da sua marca."],
  ["Controle total do administrador", "Em um painel dedicado, veja em tempo real quem participa, como vai o ranking, envie lembretes, edite regras, ajuste grupos e acompanhe o torneio de ponta a ponta."],
  ["Notificações inteligentes", "Avisos automáticos quando se aproxima o prazo dos palpites, quando há novos resultados ou quando muda o líder do ranking. Mantém a conversa viva."],
  ["Privacidade e conformidade", "Tratamos os dados dos seus colaboradores sob padrões de segurança e privacidade. Sem apostas, sem pagamentos entre usuários, sem dados financeiros — 100% legal em todos os países onde operamos."],
] as const;

export const PDF_DICT: Record<SaleLocale, PdfDict> = {
  es: {
    quoteTitle: "COTIZACIÓN",
    ccTitle: "CUENTA DE COBRO",
    quoteTagline: "La {term} deportiva que tu equipo merece ⚽",
    preparedFor: "Preparado para:",
    dateLabel: "Fecha:",
    quoteSec1Title: "Datos del Cliente",
    quoteSec1ColLeft: "Campo",
    quoteSec1ColRight: "Información",
    quoteSec1FieldName: "Razón social",
    quoteSec1FieldEmail: "Correo electrónico",
    quoteSec1FieldDate: "Fecha",
    quoteSec2Title: "¿Qué es Picks4All?",
    quoteSec2Body1: "Picks4All es una plataforma de {term} para empresas. Permite que tu equipo viva el fútbol juntos a través de pronósticos, rankings y una experiencia de juego simple, social y emocionante, sin apuestas, sin dinero real y 100% legal.",
    quoteSec2Body2: "Es una herramienta ideal para fortalecer la cultura interna, activar conversaciones durante los grandes torneos y acercar a tus colaboradores de una manera divertida.",
    quoteSec3Title: "¿Qué incluye el Plan Empresarial?",
    quoteSec3Bullets: ES_BULLETS,
    quoteSec4Title: "Inversión",
    quoteSec4Intro: "Pago único por torneo, sin suscripciones ni compromisos recurrentes",
    quoteSec4TournamentSuffix: ". Torneo: {tournament}",
    quoteSec4ColConcept: "Concepto",
    quoteSec4ColTotal: "Valor total",
    quoteSec4ColPerPerson: "Valor por persona",
    quoteSec4TotalLabel: "TOTAL — {participants} PARTICIPANTES",
    quoteSec4Disclaimer: "Incluye acceso al Plan Empresarial por la duración del torneo contratado. Para volúmenes mayores con gusto preparamos una cotización personalizada.",
    quoteSec5Title: "¿Cómo empezamos?",
    quoteSec5Steps: [
      "Confirmar la opción elegida y el torneo a activar.",
      "Pago único → confirmación y acceso al panel de administración.",
      "Configurar la {term}: nombre, mensaje de bienvenida, puntuación y reglas.",
      "Invitar al equipo → ¡en menos de 30 minutos están jugando!",
    ],
    ctaTitle: "¿Listos para activar a tu equipo?",
    ctaBody: "Escríbenos a empresas@picks4all.com y te ayudamos a arrancar hoy mismo.",
    ccCityDate: (city, date) => `${city}, ${date}`,
    ccBlockValueTo: "Valor a pagar a:",
    ccBlockConcept: "Por concepto de:",
    ccBlockAmount: "La suma de:",
    ccBlockPayment: "Forma de pago:",
    ccBlockClient: "Datos del cliente:",
    ccPaymentMethod1Title: "Transferencia bancaria",
    ccPaymentMethod2Title: "Pago en línea (tarjeta)",
    ccPaymentMethod2Intro: "Ingresa este código en la caja “¿Tienes una cuenta de cobro?”:",
    ccPaymentDualNew: "Si aún no creaste la pool:",
    ccPaymentDualExisting: "Si ya tienes la pool creada:",
    ccPaymentDualNewValue: "picks4all.com/empresas/crear",
    ccPaymentDualExistingValue: "Pool → pestaña Capacidad",
    ccPaymentCodeLabel: "Código:",
    ccValidity: (date) => `Esta cuenta de cobro es válida hasta el ${date}.`,
    ccValidityLabel: "Vigencia:",
    ccRegimen: "Manifiesto que pertenezco al régimen simplificado, no soy responsable del Impuesto sobre las Ventas (IVA) y no estoy obligado a expedir factura de venta o documento equivalente.",
    ccBankAccountTitleSuffix: "A nombre de:",
    ccConsecLabel: "No.",
    pageLabel: "Pág.",
  },

  en: {
    quoteTitle: "QUOTE",
    ccTitle: "ACCOUNT RECEIVABLE",
    quoteTagline: "The {term} your team deserves ⚽",
    preparedFor: "Prepared for:",
    dateLabel: "Date:",
    quoteSec1Title: "Client Details",
    quoteSec1ColLeft: "Field",
    quoteSec1ColRight: "Information",
    quoteSec1FieldName: "Company name",
    quoteSec1FieldEmail: "Contact email",
    quoteSec1FieldDate: "Date",
    quoteSec2Title: "What is Picks4All?",
    quoteSec2Body1: "Picks4All is a corporate {term} platform. It lets your team live football together through predictions, rankings, and a simple, social, and exciting gameplay experience — no betting, no real money, 100% legal.",
    quoteSec2Body2: "It's an ideal tool to strengthen internal culture, spark conversations during the great tournaments, and bring your team closer in a fun way.",
    quoteSec3Title: "What's included in the Corporate Plan?",
    quoteSec3Bullets: EN_BULLETS,
    quoteSec4Title: "Investment",
    quoteSec4Intro: "One-time payment per tournament — no subscriptions, no recurring commitments",
    quoteSec4TournamentSuffix: ". Tournament: {tournament}",
    quoteSec4ColConcept: "Concept",
    quoteSec4ColTotal: "Total",
    quoteSec4ColPerPerson: "Per participant",
    quoteSec4TotalLabel: "TOTAL — {participants} PARTICIPANTS",
    quoteSec4Disclaimer: "Includes access to the Corporate Plan for the duration of the contracted tournament. For larger volumes we gladly prepare a custom quote.",
    quoteSec5Title: "How do we start?",
    quoteSec5Steps: [
      "Confirm the chosen option and the tournament to activate.",
      "One-time payment → confirmation and access to the admin panel.",
      "Configure the {term}: name, welcome message, scoring, and rules.",
      "Invite the team → they're playing in under 30 minutes!",
    ],
    ctaTitle: "Ready to activate your team?",
    ctaBody: "Write to us at empresas@picks4all.com and we'll help you get started today.",
    ccCityDate: (city, date) => `${city}, ${date}`,
    ccBlockValueTo: "To be paid to:",
    ccBlockConcept: "For:",
    ccBlockAmount: "The sum of:",
    ccBlockPayment: "Payment method:",
    ccBlockClient: "Client details:",
    ccPaymentMethod1Title: "Bank transfer",
    ccPaymentMethod2Title: "Online payment (card)",
    ccPaymentMethod2Intro: "Enter this code in the “Do you have an account receivable?” box:",
    ccPaymentDualNew: "If you haven't created the pool yet:",
    ccPaymentDualExisting: "If your pool already exists:",
    ccPaymentDualNewValue: "picks4all.com/empresas/crear",
    ccPaymentDualExistingValue: "Pool → Capacity tab",
    ccPaymentCodeLabel: "Code:",
    ccValidity: (date) => `This account receivable is valid until ${date}.`,
    ccValidityLabel: "Validity:",
    // The Colombian-specific DIAN phrase is intentionally omitted in
    // non-Spanish documents (locked decision §11.18). The string is
    // present here as a safety net but never rendered when locale !== es.
    ccRegimen: "",
    ccBankAccountTitleSuffix: "Account holder:",
    ccConsecLabel: "No.",
    pageLabel: "Page",
  },

  pt: {
    quoteTitle: "PROPOSTA",
    ccTitle: "CONTA DE COBRANÇA",
    quoteTagline: "O {term} que sua equipe merece ⚽",
    preparedFor: "Preparado para:",
    dateLabel: "Data:",
    quoteSec1Title: "Dados do Cliente",
    quoteSec1ColLeft: "Campo",
    quoteSec1ColRight: "Informação",
    quoteSec1FieldName: "Razão social",
    quoteSec1FieldEmail: "E-mail de contato",
    quoteSec1FieldDate: "Data",
    quoteSec2Title: "O que é o Picks4All?",
    quoteSec2Body1: "Picks4All é uma plataforma de {term} para empresas. Permite que sua equipe viva o futebol junta através de palpites, rankings e uma experiência de jogo simples, social e emocionante, sem apostas, sem dinheiro real e 100% legal.",
    quoteSec2Body2: "É uma ferramenta ideal para fortalecer a cultura interna, ativar conversas durante os grandes torneios e aproximar seus colaboradores de uma maneira divertida.",
    quoteSec3Title: "O que inclui o Plano Empresarial?",
    quoteSec3Bullets: PT_BULLETS,
    quoteSec4Title: "Investimento",
    quoteSec4Intro: "Pagamento único por torneio, sem assinaturas nem compromissos recorrentes",
    quoteSec4TournamentSuffix: ". Torneio: {tournament}",
    quoteSec4ColConcept: "Conceito",
    quoteSec4ColTotal: "Valor total",
    quoteSec4ColPerPerson: "Por participante",
    quoteSec4TotalLabel: "TOTAL — {participants} PARTICIPANTES",
    quoteSec4Disclaimer: "Inclui acesso ao Plano Empresarial pela duração do torneio contratado. Para volumes maiores preparamos uma proposta personalizada.",
    quoteSec5Title: "Como começamos?",
    quoteSec5Steps: [
      "Confirmar a opção escolhida e o torneio a ativar.",
      "Pagamento único → confirmação e acesso ao painel de administração.",
      "Configurar o {term}: nome, mensagem de boas-vindas, pontuação e regras.",
      "Convide a equipe → em menos de 30 minutos estão jogando!",
    ],
    ctaTitle: "Prontos para ativar sua equipe?",
    ctaBody: "Escreva-nos para empresas@picks4all.com e ajudamos você a começar hoje mesmo.",
    ccCityDate: (city, date) => `${city}, ${date}`,
    ccBlockValueTo: "A pagar a:",
    ccBlockConcept: "A título de:",
    ccBlockAmount: "A soma de:",
    ccBlockPayment: "Forma de pagamento:",
    ccBlockClient: "Dados do cliente:",
    ccPaymentMethod1Title: "Transferência bancária",
    ccPaymentMethod2Title: "Pagamento online (cartão)",
    ccPaymentMethod2Intro: "Insira este código na caixa “Tem uma conta de cobrança?”:",
    ccPaymentDualNew: "Se ainda não criou a pool:",
    ccPaymentDualExisting: "Se sua pool já existe:",
    ccPaymentDualNewValue: "picks4all.com/empresas/crear",
    ccPaymentDualExistingValue: "Pool → aba Capacidade",
    ccPaymentCodeLabel: "Código:",
    ccValidity: (date) => `Esta conta de cobrança é válida até ${date}.`,
    ccValidityLabel: "Validade:",
    ccRegimen: "",
    ccBankAccountTitleSuffix: "Titular:",
    ccConsecLabel: "No.",
    pageLabel: "Pág.",
  },
};

/** Replace `{term}` and any other named placeholder in a string. */
export function substitute(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}
