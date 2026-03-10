# Sistema de Notificaciones por Email

## Resumen

El sistema de notificaciones por email permite enviar comunicaciones automáticas a los usuarios de la plataforma. Implementa una arquitectura de dos niveles:

1. **Configuración de Plataforma (Admin)**: El administrador puede activar/desactivar tipos de email globalmente
2. **Preferencias de Usuario**: Los usuarios pueden opt-out de notificaciones individuales

## Tipos de Email

| Tipo | Descripción | Admin Toggle | User Opt-out |
|------|-------------|--------------|--------------|
| Password Reset | Recuperación de contraseña | No (siempre activo) | No |
| Email Verification | Verificación de email al registrarse | No (siempre activo) | No |
| Welcome | Bienvenida a nuevos usuarios | Sí | Sí |
| Pool Invitation | Invitación a una quiniela | Sí | Sí |
| Deadline Reminder | Recordatorio de pronósticos pendientes | Sí (OFF por defecto) | Sí |
| Result Published | Notificación de resultado publicado | Sí | Sí |
| Pool Completed | Quiniela finalizada con ranking | Sí | Sí |

## Arquitectura

### Backend

#### Servicio de Email
**Archivo**: `backend/src/lib/email.ts`

Funciones principales:
- `sendPasswordResetEmail()` - Siempre activo
- `sendWelcomeEmail()` - Verifica configuración de plataforma y usuario
- `sendPoolInvitationEmail()` - Verifica configuración de plataforma y usuario
- `sendDeadlineReminderEmail()` - Verifica configuración de plataforma y usuario
- `sendResultPublishedEmail()` - Verifica configuración de plataforma y usuario
- `sendPoolCompletedEmail()` - Verifica configuración de plataforma y usuario
- `sendCorporateActivationEmail()` - Envía invitación corporativa con token de activación (30 días)
- `sendCorporateInquiryConfirmationEmail()` - Confirma recepción de solicitud empresarial
- `sendAdminNotification()` - Notifica al admin de eventos importantes (ej. nuevo feedback)

Cada función:
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

#### API de Preferencias de Usuario
**Archivo**: `backend/src/routes/me.ts`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/me/email-preferences` | GET | Obtiene preferencias + `platformEnabled` |
| `/me/email-preferences` | PUT | Actualiza preferencias del usuario |

### Frontend

#### Panel de Admin
**Archivo**: `frontend-next/src/app/[locale]/(authenticated)/admin/settings/email/page.tsx`
**Ruta**: `/admin/settings/email`

Características:
- Toggle switches para cada tipo de email
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
  emailPoolInvitationEnabled  Boolean  @default(true)
  emailDeadlineReminderEnabled Boolean @default(false) // Desactivado por defecto
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

## Flujo de Verificación de Email

```
1. Usuario se registra con email/password
   └─ Se genera token de verificación (24 horas de validez)
   └─ Se envía email de verificación
   └─ Usuario puede usar la app (emailVerified = false)

2. Usuario registra con Google OAuth
   └─ Email se marca como verificado automáticamente
   └─ Se envía Welcome email directamente

3. Usuario hace clic en link de verificación
   └─ GET /verify-email?token=xxx
   └─ Si token válido → emailVerified = true
   └─ Redirect a dashboard

4. Usuario puede reenviar verificación
   └─ POST /auth/resend-verification (requiere auth)
   └─ Genera nuevo token y envía nuevo email
```

### Campos en User Model
```prisma
emailVerified                   Boolean   @default(false)
emailVerificationToken          String?   @unique
emailVerificationTokenExpiresAt DateTime?
```

## Proveedor de Email

- **Servicio**: Resend (https://resend.com)
- **Free tier**: 3,000 emails/mes
- **Dashboard**: https://resend.com/emails
- **Variable de entorno**: `RESEND_API_KEY`

## Integración Actual

### Implementado ✅

#### Sistema Base
- Panel de configuración admin (`/admin/settings/email`)
- Preferencias de usuario en perfil (`/profile`)
- Endpoint de test para admin

#### Emails Transaccionales (siempre activos)
- **Password Reset**: En `auth.ts` - POST `/auth/forgot-password`
- **Email Verification**: En `auth.ts` - Enviado al registrarse, verificación en `/verify-email?token=xxx`
  - Endpoint para reenviar: POST `/auth/resend-verification`
  - UI de banner en perfil si no está verificado

#### Emails de Notificación (configurables)
- **Welcome Email**: En `auth.ts` - Enviado después de verificar email (Google: auto-verificado)
- **Pool Invitation**: En `pools.ts` - POST `/pools/:poolId/send-invite-email`
  - El host puede enviar invitaciones por email a direcciones específicas
- **Result Published**: En `results.ts` - PUT `/pools/:poolId/results/:matchId`
  - Notifica a todos los miembros cuando se publica un resultado
- **Pool Completed**: En `poolStateMachine.ts` - Transición ACTIVE → COMPLETED
  - Notifica a todos los miembros con su ranking final y puntos

#### Deadline Reminder (Desactivado por defecto)
- **Servicio**: `backend/src/services/deadlineReminderService.ts`
- **Funcionalidad**: Encuentra usuarios sin pronósticos para partidos próximos y envía recordatorios
- **Ejecución manual**: `POST /admin/settings/email/reminders/run`
  - Parámetros: `hoursBeforeDeadline` (default: 24), `dryRun` (default: false)
- **Tracking**: Tabla `DeadlineReminderLog` evita duplicados
- **Por defecto desactivado**: El admin debe habilitarlo manualmente en el panel

#### Emails Corporativos
- **Corporate Activation**: En `corporate.ts` - Envía invitación con token de activación a empleados
  - Token de 48 bytes, expira en 30 días
  - Template: `getCorporateActivationTemplate` en `emailTemplates.ts`
- **Corporate Inquiry Confirmation**: En `corporate.ts` - Confirma al solicitante que se recibió su formulario empresarial

#### Notificaciones Admin
- **Admin Notification**: `sendAdminNotification()` en `email.ts`
  - Se usa en `feedback.ts` para notificar al admin cuando se recibe nuevo feedback de usuarios
  - Envía a la dirección configurada en `SUPPORT_EMAIL`

### Pendiente de Integrar 🔄
- **Cron Job**: Automatizar ejecución periódica de recordatorios (si se requiere)

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

Tipos válidos: `welcome`, `poolInvitation`, `deadlineReminder`, `resultPublished`, `poolCompleted`

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
