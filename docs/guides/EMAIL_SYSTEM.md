# Sistema de Notificaciones por Email

> **Last Updated:** 2026-05-28

## Resumen

El sistema de notificaciones por email permite enviar comunicaciones automáticas a los usuarios de la plataforma. Implementa una arquitectura de dos niveles:

1. **Configuración de Plataforma (Admin)**: El administrador puede activar/desactivar tipos de email globalmente
2. **Preferencias de Usuario**: Los usuarios pueden opt-out de notificaciones individuales

## Tipos de Email

| Tipo | Descripción | Admin Toggle | User Opt-out |
|------|-------------|--------------|--------------|
| Password Reset | Recuperación de contraseña | No (siempre activo) | No |
| Password Changed | Notificación de cambio de contraseña | No (siempre activo) | No |
| Email Verification | Verificación de email al registrarse | No (siempre activo) | No |
| Welcome | Bienvenida a nuevos usuarios | Sí | Sí (master toggle) |
| Pool Invitation | Invitación a una quiniela | No (siempre activo) | Sí |
| Deadline Reminder | Recordatorio de pronósticos pendientes | Sí (OFF por defecto) | Sí |
| Result Published | Notificación de resultado publicado (solo modo MANUAL) | Sí | Sí |
| Pool Completed | Quiniela finalizada con ranking | Sí | Sí |
| Phase Completion Summary | Resumen de fase con posición y top 10 | No (siempre activo) | Sí (master toggle) |
| New Member Digest | Resumen diario de nuevos miembros (para hosts, 8AM COL) | No (siempre activo) | Sí (`emailNewMemberDigest`) |
| Result Override | Host modificó un resultado publicado por API | No (siempre activo) | No |
| Pool Full | Pool alcanzó capacidad máxima (notifica al host) | No (siempre activo) | No |
| Capacity Warning | Pool cerca de capacidad máxima (umbral configurable, default 95%) | No (siempre activo) | No |
| Blocked Join Attempt | Alguien intentó unirse a un pool lleno (throttled, default 24h por pool) | No (siempre activo) | No |
| Group Standings Override | Host modificó la clasificación de un grupo publicada por el Estratega | No (siempre activo) | No |
| Knockout Winner Override | Host modificó el ganador de un cruce eliminatorio publicado por el Estratega | No (siempre activo) | No |
| Pool Reverted To Draft | Pool revirtió ACTIVE → DRAFT (último jugador salió/fue removido) | No (siempre activo) | No |
| Member Removed | Notifica al miembro que fue removido/baneado | No (siempre activo) | No |
| Pending Approval Digest | Resumen de solicitudes pendientes de aprobación (para hosts) | No (siempre activo) | Sí (`emailNewMemberDigest`) |
| Prediction Update | Actualización de predicciones AI (suscripción) | No (siempre activo) | Sí (`predictionUpdates`) |
| Payment Receipt | Recibo de pago (Polar / Mercado Pago) | No (siempre activo) | No |
| Corporate Activation | Invitación de activación corporativa | No (siempre activo) | No |
| Corporate Inquiry Confirmation | Confirmación de solicitud empresarial | No (siempre activo) | No |
| Corporate Check-in | Seguimiento proactivo a clientes corporativos | No (siempre activo) | No |
| Admin Notification | Notificación interna al admin | No (siempre activo) | No |

## Arquitectura

### Backend

#### Servicio de Email
**Archivo**: `backend/src/lib/email.ts`

Funciones principales (`send*` exportadas):
- `sendPasswordResetEmail()` - Siempre activo
- `sendPasswordChangedEmail()` - Siempre activo
- `sendVerificationEmail()` - Siempre activo (disparado por `POST /users/me/locale-preference`)
- `sendWelcomeEmail()` - Verifica configuración de plataforma y usuario
- `sendPoolInvitationEmail()` - Siempre activo a nivel plataforma, verifica preferencia de usuario
- `sendDeadlineReminderEmail()` - Verifica configuración de plataforma y usuario
- `sendResultPublishedEmail()` - Verifica configuración de plataforma y usuario
- `sendPoolCompletedEmail()` - Verifica configuración de plataforma y usuario
- `sendPhaseCompletionSummaryEmail()` - Siempre activo, verifica master toggle de usuario
- `sendNewMemberDigestEmail()` - Para hosts, enviado por cron diario (8AM COL)
- `sendPendingApprovalDigestEmail()` - Resumen de solicitudes pendientes para hosts (reusa el opt-out `emailNewMemberDigest`)
- `sendNewMemberNotificationEmail()` - Legado, solo usado por endpoint de test admin
- `sendMemberRemovedEmail()` - Siempre activo
- `sendPoolRevertedToDraftEmail()` - Notifica cuando un pool revierte ACTIVE → DRAFT
- `sendCorporateActivationEmail()` - Envía invitación corporativa con token de activación (30 días)
- `sendCorporateInquiryConfirmationEmail()` - Confirma recepción de solicitud empresarial
- `sendCorporateCheckinEmail()` - Seguimiento proactivo a clientes corporativos (FROM/Reply-To `empresas@picks4all.com`)
- `sendAdminNotification()` - Notifica al admin de eventos importantes (ej. nuevo feedback)
- `sendResultOverrideNotification()` - Notifica a TODOS los miembros cuando el host modifica un resultado API-confirmed
- `sendGroupStandingsOverrideNotification()` - Notifica cuando el host modifica una clasificación de grupo del Estratega
- `sendKnockoutWinnerOverrideNotification()` - Notifica cuando el host modifica el ganador de un cruce eliminatorio del Estratega
- `sendPoolFullNotificationEmail()` - Notifica al host cuando su pool alcanza capacidad máxima
- `sendCapacityWarningEmail()` - Notifica al host cuando el pool se acerca a su capacidad máxima
- `sendBlockedJoinAttemptEmail()` - Notifica al host cuando alguien intenta unirse a un pool lleno (throttled)
- `sendPredictionUpdateEmail()` - Envía actualización de predicciones AI a suscriptores
- `sendPaymentReceiptEmail()` - Recibo de pago (Polar / MP), Reply-To `ventas@picks4all.com`

Cada función configurable:
1. Verifica si el email está habilitado a nivel de plataforma
2. Verifica las preferencias del usuario
3. Envía el email si ambas condiciones se cumplen
4. Retorna `{ success, skipped?, reason?, error? }`

#### Templates de Email
**Archivo**: `backend/src/lib/emailTemplates.ts`

Templates HTML profesionales con:
- Diseño responsive (mobile-first)
- Branding consistente
- Botones de acción (CTAs)
- Footer con links de configuración

#### XSS escape (defensa al render)

Todas las interpolaciones de variables controladas por usuario (`companyName`, `poolName`, `displayName`, `inviterName`, `memberName`, `attemptedEmail`, etc., incluyendo entradas iteradas como `top10[].displayName` o `newMembers[].name`) pasan por `escapeHtml()` ANTES de entrar al string HTML del template.

- **Helper:** `backend/src/lib/htmlSafe.ts` (módulo aislado para evitar dependencia circular con `email.ts`).
- **Convención:** el patrón es `const safeX = escapeHtml(x)` al inicio de la función del template, y todos los lugares de interpolación usan `${safeX}` en vez de `${x}`. Cualquier nuevo template debe seguir esta convención.
- **Cobertura:** `backend/src/lib/emailTemplates.xss.test.ts` renderiza los templates con un payload `<script>alert(...)</script>` en cada variable host/user-controlled y asserta que el script raw no sobrevive en el HTML rendered. La cobertura NO es total: el saludo `contactName` en las variantes EN/PT de la confirmación de cotización corporativa y los nombres del Top-10 (`entry.name`) en el resumen de fase tienen interpolación sin escapar conocida, y varios casos de test usan shapes de parámetros desalineados con la interfaz actual (`getMemberRemovedTemplate` con `type: "REMOVED"` en vez de `"kicked"|"banned"`; `getPhaseCompletionSummaryTemplate` con `top10: [{displayName, points}]` en vez de `{rank, name, points}`; `getPaymentReceiptTemplate` con `paidAt: Date` + `userId` en vez de `paidAt: string`). Estos gaps están pendientes de re-alineación; no asumas cobertura completa.
- **Por qué al render y no a la persistencia:** el contexto de renderizado es lo que define qué necesita escape. Lo que es seguro en `<p>` puede no serlo en `<img alt="...">`. Escapar al render hace explícita la frontera. Excepción: `welcomeMessage`/`invitationMessage` también se escapan al persistir como defensa adicional (defence in depth).

#### API de Configuración Admin
**Archivo**: `backend/src/routes/adminSettings.ts`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/admin/settings/email` | GET | Obtiene configuración actual |
| `/admin/settings/email` | PUT | Actualiza toggles de email |
| `/admin/settings/email/test` | POST | Envía email de prueba |
| `/admin/settings/email/reminders/run` | POST | Ejecuta recordatorios de deadline |
| `/admin/settings/email/reminders/stats` | GET | Estadísticas de recordatorios |

Requiere: `requireAuth` + `requireAdmin`

> El mismo router expone también `GET/PUT /admin/settings/scores` (configuración de scoring), fuera del alcance de este documento.

#### API de Preferencias de Usuario
**Archivo**: `backend/src/routes/me.ts`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/me/email-preferences` | GET | Obtiene preferencias + `platformEnabled` |
| `/me/email-preferences` | PUT | Actualiza preferencias del usuario |

### Frontend

#### Panel de Admin
**Archivo**: `frontend-next/src/components/AdminEmailSettingsContent.tsx` (la UI de toggles)
**Wrapper**: `frontend-next/src/app/[locale]/(authenticated)/admin/settings/email/page.tsx` (solo metadata, renderiza `<AdminEmailSettingsContent />`)
**Ruta**: `/admin/settings/email`

Características:
- 4 toggle switches: Welcome, Deadline Reminder, Result Published, Pool Completed
- Descripción de cada tipo
- Metadata (última actualización, por quién)
- Solo visible para usuarios con `platformRole === "ADMIN"`

#### Preferencias de Usuario
**Archivo**: `frontend-next/src/components/EmailPreferencesSection.tsx`
**Ubicación**: Página de perfil (`/profile`)

Características:
- Master toggle "Recibir notificaciones"
- Toggles individuales por tipo
- **Los tipos deshabilitados por admin NO aparecen**
- Mensaje informativo si hay opciones desactivadas por admin

#### Navegación
**Archivo**: `frontend-next/src/components/NavBar.tsx`

- Link "⚙️ Panel Admin" visible solo para `platformRole === "ADMIN"`
- Disponible en menú desktop y mobile

### Base de Datos

#### PlatformSettings (Singleton)
```prisma
model PlatformSettings {
  id                          String   @id @default("singleton")
  emailWelcomeEnabled         Boolean  @default(true)
  emailPoolInvitationEnabled  Boolean  @default(true)  // Legacy — no longer used (always active)
  emailDeadlineReminderEnabled Boolean @default(false)  // Desactivado por defecto
  emailResultPublishedEnabled  Boolean @default(true)
  emailPoolCompletedEnabled    Boolean @default(true)
  updatedAt                   DateTime @updatedAt
  updatedById                 String?
}
```

#### DeadlineReminderLog (Tracking de recordatorios)
```prisma
model DeadlineReminderLog {
  id                  String   @id @default(uuid())
  poolId              String
  userId              String
  matchId             String   // Partido específico
  sentAt              DateTime @default(now())
  sentToEmail         String
  success             Boolean  @default(true)
  error               String?
  hoursBeforeDeadline Int

  @@unique([poolId, userId, matchId]) // Evita duplicados
}
```

#### User (campos de preferencias)
```prisma
model User {
  // ... otros campos ...
  emailNotificationsEnabled   Boolean @default(true)  // Master toggle
  emailPoolInvitations        Boolean @default(true)
  emailDeadlineReminders      Boolean @default(true)
  emailResultNotifications    Boolean @default(true)
  emailPoolCompletions        Boolean @default(true)
  emailNewMemberDigest        Boolean @default(true)  // Digest diario de nuevos miembros (para hosts)
  predictionUpdates           Boolean @default(false) // Suscripción a predicciones AI
}
```

## Flujo de Decisión (Emails Configurables)

```
¿Email habilitado a nivel de plataforma?
  └─ No → Skip (reason: "disabled_by_platform")
  └─ Sí → ¿Usuario tiene master toggle activo?
           └─ No → Skip (reason: "user_master_disabled")
           └─ Sí → ¿Usuario tiene este tipo activo?
                    └─ No → Skip (reason: "user_preference_disabled")
                    └─ Sí → ENVIAR EMAIL
```

## Flujo de Verificación y Welcome Email (ADR-063)

Los emails de **verificación** y **bienvenida** NO se envían al registrarse. Ambos se difieren al handoff de preferencia de idioma en el primer login (`POST /users/me/locale-preference`), para que salgan en el idioma elegido por el usuario. `sendWelcomeEmail` y `sendVerificationEmail` NUNCA se llaman inline desde los handlers de signup ni de activación corporativa.

```
1. Usuario se registra (email/password o Google OAuth)
   └─ Google OAuth: emailVerified = true (auto-verificado por el proveedor)
   └─ Email/password: emailVerified = false, se genera token de verificación (24h)
   └─ Email de verificación + Welcome DIFERIDOS (no se envían aquí)
   └─ Usuario puede usar la app

2. Primer login → LocalePreferenceModal → POST /users/me/locale-preference
   └─ Persiste User.locale + localePromptCompletedAt
   └─ Dispara (fire-and-forget) el email de verificación pendiente en el locale elegido
   └─ Dispara el Welcome email en el locale elegido
   └─ User.welcomeEmailSentAt se marca dentro de la misma tx (idempotencia)

3. Fallback 24h — backend/src/jobs/welcomeEmailFallbackJob.ts
   └─ Cron `15 * * * *` (cada hora al minuto :15), advisory lock 82636505n
   └─ Captura usuarios con welcomeEmailSentAt = null y createdAtUtc > 24h
   └─ Resuelve locale: org.invitationLocale (corporativo) o resolveUserLocale (signup)
   └─ Envía el Welcome e idempotentemente marca welcomeEmailSentAt

4. Usuario hace clic en link de verificación
   └─ GET /verify-email?token=xxx
   └─ Si token válido → emailVerified = true → redirect a dashboard

5. Usuario puede reenviar verificación
   └─ POST /auth/resend-verification (requiere auth)
   └─ Genera nuevo token y envía nuevo email
```

### Campos en User Model
```prisma
emailVerified                   Boolean   @default(false)
emailVerificationToken          String?   @unique
emailVerificationTokenExpiresAt DateTime?
welcomeEmailSentAt              DateTime? // Idempotencia del Welcome email diferido (ADR-063)
locale                          String?   // Elección explícita del usuario en el modal de primer login
```

## Infraestructura de Email

### Envío — Resend (Transaccional)

- **Servicio**: Resend (https://resend.com)
- **Dominio verificado**: picks4all.com (ADR-037, verificado 2026-03-01)
- **From**: `${APP_NAME} <${RESEND_FROM_EMAIL}>` (env-driven; la dirección de producción es `hola@picks4all.com`, un buzón real y monitoreado). Se abandonó `noreply@` porque Resend Insights penaliza remitentes que señalan "sin comunicación bidireccional" y degrada la entregabilidad.
- **Reply-To por defecto**: `soporte@${EMAIL_DOMAIN || SITE_DOMAIN}` — inyectado automáticamente en todos los emails transaccionales de usuario por `resilientSend()`.
- **Reply-To por tipo**: los recibos de pago usan `ventas@…` y los correos corporativos (`sendCorporateCheckinEmail`) usan `empresas@picks4all.com`. Las notificaciones internas al admin optan por NO recibir Reply-To (`skipDefaultReplyTo: true`), ya que el equipo no se responde a sí mismo.
- **Free tier**: 3,000 emails/mes
- **Dashboard**: https://resend.com/emails
- **Variable de entorno**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **SPF**: Configurado con `include:send.resend.com` en DNS de Cloudflare
- **DKIM**: Clave DKIM agregada como registro DNS en Cloudflare

### Suppression — Resend webhooks → `EmailSuppression` (ADR-055)

Resend posts to `POST /webhooks/resend` on `email.bounced` and `email.complained` events. Each event inserts (idempotent on `email`) a row in the `EmailSuppression` table with `reason`, the originating Resend event id, and the raw payload for forensics.

`sendEmail()` checks this table BEFORE calling Resend and short-circuits with `{ skipped: true, reason: "suppressed" }` for any address on the list. This saves API quota on rollouts (a 200-employee corporate invite where 5–10% of addresses already bounced never makes those network calls again) and surfaces a useful "did X get the invite?" answer via `operationalHealth.emailSuppressions` on the admin analytics dashboard.

**To un-suppress** an address (legitimately fixed mailbox), delete the row directly. There is no self-service un-suppression flow yet.

### Recepción — Cloudflare Email Routing (ADR-034)

**Configuración activa desde 2026-03-01:**

| Dirección | Idioma | Propósito |
|-----------|--------|-----------|
| soporte@picks4all.com | ES | Soporte general |
| support@picks4all.com | EN | Soporte general |
| suporte@picks4all.com | PT | Soporte general |
| privacidad@picks4all.com | ES | Solicitudes de privacidad |
| privacy@picks4all.com | EN | Solicitudes de privacidad |
| privacidade@picks4all.com | PT | Solicitudes de privacidad |
| empresas@picks4all.com | ES | Consultas corporativas |
| enterprise@picks4all.com | EN | Consultas corporativas |
| facturacion@picks4all.com | ES | Facturación |
| billing@picks4all.com | EN | Facturación |
| hola@picks4all.com | ES | Contacto general |
| hello@picks4all.com | EN | Contacto general |
| info@picks4all.com | — | Información general |
| admin@picks4all.com | — | Administración |
| noreply@picks4all.com | — | No-reply (envío) |
| legal@picks4all.com | — | Asuntos legales |

- **Catch-all**: Activo, redirige a correo principal del equipo
- **Total**: 16 direcciones configuradas + catch-all

### Emails por Idioma (Backend)

Las direcciones de soporte se configuran por locale en `emailTemplates.ts`:

```typescript
// ES (default)
supportEmail: "soporte@picks4all.com"
privacyEmail: "privacidad@picks4all.com"
enterpriseEmail: "empresas@picks4all.com"

// EN
supportEmail: "support@picks4all.com"
privacyEmail: "privacy@picks4all.com"
enterpriseEmail: "enterprise@picks4all.com"

// PT
supportEmail: "suporte@picks4all.com"
privacyEmail: "privacidade@picks4all.com"
```

## Integración Actual

### Implementado ✅

#### Sistema Base
- Panel de configuración admin (`/admin/settings/email`)
- Preferencias de usuario en perfil (`/profile`)
- Endpoint de test para admin

#### Emails Transaccionales (siempre activos)
- **Password Reset**: En `auth.ts` - POST `/auth/forgot-password`
- **Password Changed**: En `authService.ts` - Notifica al usuario cuando se cambia su contraseña
- **Email Verification**: Diferido al handoff de idioma — disparado por `POST /users/me/locale-preference`, no al registrarse (ADR-063). Verificación en `/verify-email?token=xxx`
  - Endpoint para reenviar: POST `/auth/resend-verification`
  - UI de banner en perfil si no está verificado
- **Pool Invitation**: En `pools.ts` - POST `/pools/:poolId/send-invite-email`
  - Siempre activo a nivel plataforma, usuario puede desactivarlo en preferencias
- **Result Override**: En `resultService.ts` - Notifica a TODOS los miembros cuando el host modifica un resultado API-confirmed
- **Pool Full**: En `poolInvites.ts` - Notifica al host cuando su pool alcanza capacidad máxima
- **Member Removed**: En `poolAdmin.ts` - Notifica al miembro que fue removido/baneado
- **Payment Receipt**: En `paymentService.ts` - Recibo de pago

#### Emails de Notificación (configurables por admin)
- **Welcome Email**: Diferido al handoff de idioma — disparado por `POST /users/me/locale-preference` (`userProfile.ts`), con fallback a las 24h vía `welcomeEmailFallbackJob.ts`. NUNCA se envía inline desde signup/activación (ADR-063). Idempotente vía `User.welcomeEmailSentAt`.
- **Result Published**: En `results.ts` - PUT `/pools/:poolId/results/:matchId`
  - Solo se envía en modo MANUAL, Smart Sync no dispara este email
- **Pool Completed**: En `poolStateMachine.ts` - Transición ACTIVE → COMPLETED
  - Notifica a todos los miembros con su ranking final y puntos

#### Phase Completion Summary (siempre activo)
- **Trigger**: `advancementTrigger.ts` - Se engancha en `executeAdvancement()` fire-and-forget
- **Funcionalidad**: Al completar una fase, envía a cada miembro su posición + top 10
- **Template**: `getPhaseCompletionSummaryTemplate()` con i18n ES/EN/PT
- **Excepción**: No se envía en la fase final (`nextPhaseId === null`), Pool Completed cubre ese caso

#### New Member Digest (siempre activo, cron diario)
- **Job**: `backend/src/jobs/newMemberDigestJob.ts` - Cron `0 13 * * *` (8AM COL / 13:00 UTC)
- **Servicio**: `backend/src/services/newMemberDigestService.ts`
- **Funcionalidad**: Agrupa nuevos miembros (últimas 24h) por pool y envía UN digest al HOST
- **User toggle**: `emailNewMemberDigest` (default: true)
- **No envía** si nadie se unió en las últimas 24 horas

#### Deadline Reminder (Desactivado por defecto)
- **Servicio**: `backend/src/services/deadlineReminderService.ts`
- **Funcionalidad**: Encuentra usuarios sin pronósticos para partidos próximos y envía recordatorios
- **Cron**: `backend/src/jobs/deadlineReminderJob.ts` — `0 12 * * *` (env `DEADLINE_REMINDER_CRON`, 7:00 AM Colombia / 12:00 UTC). Llama `processDeadlineReminders(48, false)`, es decir ventana de **48 horas**.
- **Ejecución manual**: `POST /admin/settings/email/reminders/run`
  - Parámetros: `hoursBeforeDeadline` (default: **24**), `dryRun` (default: false)
- **Tracking**: Tabla `DeadlineReminderLog` evita duplicados
- **Por defecto desactivado**: La plataforma trae `emailDeadlineReminderEnabled = false`; el cron corre pero no envía hasta que el admin lo habilite en el panel

#### Emails de Suscripción
- **Prediction Update**: En `adminPredictionUpdate.ts` - Envía actualización de predicciones AI a suscriptores
  - User toggle: `predictionUpdates` (default: false, opt-in)

#### Emails Corporativos
- **Corporate Activation**: En `corporate.ts` - Envía invitación con token de activación a empleados
  - Token de 32 bytes (`crypto.randomBytes(CRYPTO_BYTES.TOKEN)`) → 64 caracteres hex, expira en 30 días
  - Rotable per-employee via `POST /corporate/pools/:poolId/employees/:inviteId/resend` (ver ADR-050)
  - Template: `getCorporateActivationTemplate` en `emailTemplates.ts`
- **Corporate Inquiry Confirmation**: En `corporate.ts` - Confirma al solicitante que se recibió su formulario empresarial

#### Notificaciones Internas (operator-facing)
- **`sendAdminNotification(category, subject, body)`** en `email.ts`
  - Cada llamada declara una **categoría** (`AdminCategory`) que determina la bandeja destino.
  - Las direcciones se resuelven vía env vars con fallback a `ADMIN_NOTIFICATION_EMAIL`.
  - Cada categoría tiene su propio emoji y label en el asunto, así puedes
    escanear la bandeja sin abrir nada.

| Categoría | Bandeja | Emoji | Label | Disparado por |
|-----------|---------|-------|-------|----------------|
| `feedback` | `support` (`SUPPORT_NOTIFICATION_EMAIL`) | 💬 | Feedback | `feedback.ts` (BUG/SUGGESTION del formulario beta) |
| `corporate_inquiry` | `enterprise` (`ENTERPRISE_NOTIFICATION_EMAIL`) | 📩 | Cotización corporativa | `corporateService.ts` (formulario `/empresas`) |
| `corporate_pool_created` | `enterprise` (`ENTERPRISE_NOTIFICATION_EMAIL`) | 🏢 | Pool corporativa creada | `corporateService.ts` (wizard de pool corporativa) |
| `payment_completed` | `sales` + `admin` | 💰 | Pago confirmado | `paymentService.ts` (webhook Polar / MP) |
| `payment_reconciler_rescued` | `admin` (`ADMIN_NOTIFICATION_EMAIL`) | 🛟 | Reconciler: revisión manual | Reconciler de pagos detecta una discrepancia que requiere revisión humana |
| `cc_pricing_drift` | `sales` + `admin` | ⚠️ | CC: drift de precio | Snapshot de la cuenta de cobro discrepa de `pricing.ts` al redimir (ADR-061) |
| `system_event` | `admin` (`ADMIN_NOTIFICATION_EMAIL`) | ℹ️ | Evento del sistema | Avances de fase, sync resuelto, fixtures actualizados |
| `error` | `admin` (`ADMIN_NOTIFICATION_EMAIL`) | 🚨 | Error | Jobs caídos, sync fallido, fixtures rechazados |

Cada nombre lógico de bandeja (`admin`, `support`, `enterprise`, `sales`) se resuelve a su env var correspondiente (`ADMIN_/SUPPORT_/ENTERPRISE_/SALES_NOTIFICATION_EMAIL`), con fallback a `ADMIN_NOTIFICATION_EMAIL` cuando la var no está configurada.

> **Routing en Gmail:** las cuatro direcciones (`soporte@`, `empresas@`,
> `ventas@`, `admin@`) son aliases en Cloudflare Email Routing que
> reenvían a la misma bandeja personal. Los filtros de Gmail
> (`to:soporte@picks4all.com → label:Picks4All/Soporte`, etc.)
> distribuyen automáticamente cada categoría a su carpeta.

## Auditoría

Todos los cambios de configuración se registran en `AuditLog`:
- `PLATFORM_EMAIL_SETTINGS_UPDATED` - Cambios de admin
- `TEST_EMAIL_SENT` - Emails de prueba enviados

## Testing

### Enviar email de prueba (Admin)
```bash
curl -X POST http://localhost:3000/admin/settings/email/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "welcome", "to": "test@example.com"}'
```

Tipos válidos: `welcome`, `poolInvitation`, `deadlineReminder`, `resultPublished`, `poolCompleted`, `newMemberDigest`, `phaseCompletionSummary`

### Verificar configuración
```bash
curl http://localhost:3000/admin/settings/email \
  -H "Authorization: Bearer <token>"
```

### Ejecutar recordatorios de deadline manualmente (Admin)
```bash
# Modo real - envía emails
curl -X POST http://localhost:3000/admin/settings/email/reminders/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"hoursBeforeDeadline": 24}'

# Modo dry run - solo simula
curl -X POST http://localhost:3000/admin/settings/email/reminders/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"hoursBeforeDeadline": 24, "dryRun": true}'
```

### Ver estadísticas de recordatorios
```bash
curl "http://localhost:3000/admin/settings/email/reminders/stats?days=7" \
  -H "Authorization: Bearer <token>"
```

## Tests Automatizados

El sistema de emails cuenta con tests unitarios completos:

**Ejecutar tests:**
```bash
cd backend && npm test
```

**Archivos de tests:**
- `backend/src/lib/email.test.ts` - Tests de `isEmailEnabled` y configuración
- `backend/src/services/deadlineReminderService.test.ts` - Tests del servicio de recordatorios

**Cobertura:**
- ✅ Verificación de configuración de plataforma
- ✅ Verificación de preferencias de usuario
- ✅ Prioridad plataforma sobre usuario
- ✅ Deadline reminder desactivado por defecto
- ✅ Evitar duplicados de recordatorios
- ✅ Modo dry run
- ✅ Manejo de errores de envío

## Consideraciones de Seguridad

1. Password Reset NUNCA se puede desactivar
2. Solo ADMIN puede modificar PlatformSettings
3. Usuarios solo pueden modificar sus propias preferencias
4. Audit log de todos los cambios de configuración
5. Rate limiting en Resend (2 req/seg)
