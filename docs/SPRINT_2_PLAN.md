# Sprint 2 - Plan de Implementación Oficial
**Quiniela Platform - MVP Complete**

> **Sprint:** Sprint 2 (Features de Administración, Usuario, Picks Avanzados y Social)
> **Start Date:** 2026-01-05
> **Estimated Duration:** 30-35 días efectivos
> **Status:** 🟢 EN PROGRESO - Fase 1 (Foundation)
> **Version Target:** v0.2-beta
> **Last Updated:** 2026-01-05
> **Progress:** 2/13 features completados (15%)

---

## 📍 Estado Actual (2026-01-05 EOD)

**Completado hoy:**
- ✅ Co-Admin System - Implementación completa y testeada

**Fase actual:**
- 🟢 Fase 1: Foundation & State Management (2/3 completado)

**Próximo paso (2026-01-06):**
- ⏭️ **Join Approval Workflow** - Permitir al HOST aprobar/rechazar solicitudes de ingreso

**Nota:** Se decidió **saltar Rule Immutability** por ahora ya que no hay UI de configuración post-creación. Se retomará cuando sea necesario.

---

## 🎯 Objetivo del Sprint

Completar el MVP con features críticas de administración, personalización de usuario, tipos de picks avanzados, engagement social y hardening de seguridad.

---

## 📋 Orden de Implementación (OPTIMIZADO)

**IMPORTANTE:** Este orden fue diseñado para **minimizar retrocesos** y respetar **dependencias entre features**.

---

## 📅 FASE 1: FUNDACIONES (Día 1-5)
**Objetivo:** Establecer estados de pool y sistema de roles que otras features necesitan

### **1. Pool State Machine** ✅ [COMPLETADO 2026-01-04]
**Prioridad:** 🔴 CRÍTICA

**Estados:**
```
DRAFT → ACTIVE → COMPLETED → ARCHIVED
```

**Implementación:**
- ✅ Agregar campo `status` a Pool model (enum)
- ✅ Migración de datos existentes (todos → ACTIVE)
- ✅ Lógica de transiciones:
  - DRAFT → ACTIVE: Cuando primer PLAYER se une
  - ACTIVE → COMPLETED: Cuando todos los partidos tienen resultado
  - COMPLETED → ARCHIVED: Manual por HOST
- ✅ Validaciones por estado:
  - DRAFT: Solo HOST, puede editar reglas
  - ACTIVE: No editar reglas, aceptar picks
  - COMPLETED: No picks, no joins
  - ARCHIVED: Solo lectura
- ✅ UI: Badge de estado en PoolPage
- ✅ Service: `poolStateMachine.ts` con funciones de transición
- ✅ Audit log para transiciones

**Archivos creados/modificados:**
- ✅ `backend/prisma/schema.prisma`
- ✅ `backend/src/services/poolStateMachine.ts` (NUEVO)
- ✅ `backend/src/routes/pools.ts`
- ✅ `backend/src/routes/picks.ts`
- ✅ `backend/src/routes/results.ts`
- ✅ `frontend/src/pages/PoolPage.tsx`
- ✅ `frontend/src/pages/DashboardPage.tsx`
- ✅ `frontend/src/lib/api.ts`

**Testing:** ✅ Manual testing completado exitosamente

---

### **2. Rule Immutability + Warnings** [1 día]
**Prioridad:** 🔴 CRÍTICA

**Implementación:**
- [ ] Validación backend: Rechazar cambios si `memberCount > 1` o `status = ACTIVE`
- [ ] UI Warning modal ANTES de generar primer invite:
  ```
  ⚠️  ATENCIÓN

  Una vez que invites jugadores, NO podrás cambiar:
  - Reglas de scoring
  - Tipos de picks
  - Deadline policy
  - Timezone del pool

  ¿Estás seguro de que todo está configurado correctamente?

  [Revisar configuración]  [Confirmar y crear invite]
  ```
- [ ] Badge visual: "🔒 Reglas bloqueadas" (cuando status = ACTIVE)
- [ ] Tooltip explicativo en cada configuración
- [ ] Endpoint: `PATCH /pools/:poolId/config` (validar estado)

**Razón para ir aquí:**
✅ Usa Pool State Machine (DRAFT permite cambios, ACTIVE no)

**Archivos afectados:**
- `backend/src/routes/pools.ts`
- `frontend/src/pages/PoolPage.tsx`

---

### **3. Co-Admin System** ✅ [COMPLETADO 2026-01-05]
**Prioridad:** 🔴 CRÍTICA

**Implementación:**

**Backend:**
- ✅ Actualizar `PoolMember.role` para incluir `CO_ADMIN`
- ✅ Endpoints:
  - `POST /pools/:poolId/members/:memberId/promote` - Promover a CO_ADMIN
  - `POST /pools/:poolId/members/:memberId/demote` - Degradar a PLAYER
- ✅ Validaciones:
  - Solo HOST puede promover/degradar co-admins
  - Solo miembros ACTIVE
  - Solo PLAYER → CO_ADMIN, CO_ADMIN → PLAYER
- ✅ Permisos de CO_ADMIN:
  - ✅ Publish/correct results
  - ✅ Create invites
  - ✅ Ver panel Admin
  - ✅ Usar controles de fase
  - ❌ Promover/degradar miembros
  - ❌ Delete/archive pool
  - ❌ Change pool core settings
- ✅ Helper function: `requirePoolHostOrCoAdmin()`
- ✅ Audit log: `MEMBER_PROMOTED_TO_CO_ADMIN`, `MEMBER_DEMOTED_FROM_CO_ADMIN`

**Frontend:**
- ✅ UI: Sección "👥 Gestión de Miembros" en Admin tab (solo HOST)
- ✅ Lista de miembros con badges visuales
- ✅ Botones "⬆️ Promover" y "⬇️ Degradar"
- ✅ Badges en Leaderboard: 👑 HOST, ⭐ CO-ADMIN, PLAYER
- ✅ Confirmaciones antes de cambios
- ✅ Mensajes de éxito/error

**Archivos creados/modificados:**
- ✅ `backend/prisma/schema.prisma` (CO_ADMIN en enum)
- ✅ `backend/src/types/express.d.ts` (NUEVO - tipos TypeScript)
- ✅ `backend/tsconfig.json` (typeRoots)
- ✅ `backend/src/routes/pools.ts` (endpoints + helper)
- ✅ `backend/src/routes/results.ts` (permisos actualizados)
- ✅ `frontend/src/pages/PoolPage.tsx` (UI completa)
- ✅ `frontend/src/lib/api.ts` (funciones promote/demote)

**Testing:** ✅ Manual testing completado exitosamente
- ✅ Promoción PLAYER → CO_ADMIN
- ✅ Degradación CO_ADMIN → PLAYER
- ✅ Permisos de CO_ADMIN validados
- ✅ Restricciones de HOST confirmadas
- ✅ Badges visuales funcionando
- ✅ Auditoría registrando eventos

---

## 📅 FASE 2: MEMBRESÍA Y MODERACIÓN (Día 6-9)
**Objetivo:** Manejar flujo de entrada y moderación de jugadores

### **4. Join Approval Workflow** [2 días]
**Prioridad:** 🔴 CRÍTICA

**Implementación:**

**Backend:**
- [ ] Agregar campo `requireApproval` a Pool (boolean, default: false)
- [ ] Nuevo estado en PoolMember: `PENDING_APPROVAL`
- [ ] Endpoints:
  - `GET /pools/:poolId/pending-members` - Lista de pending
  - `POST /pools/:poolId/members/:userId/approve` - Aprobar
  - `POST /pools/:poolId/members/:userId/reject` - Rechazar (con razón opcional)
- [ ] Modificar `POST /pools/join`:
  - Si `requireApproval = true` → crear con status PENDING_APPROVAL
  - Si `requireApproval = false` → crear con status ACTIVE (como ahora)
- [ ] Validaciones:
  - Solo status ACTIVE/DRAFT acepta joins
  - Solo HOST/CO_ADMIN puede aprobar/rechazar
- [ ] Notificación: Incrementar contador de pending requests
- [ ] Audit log: `JOIN_APPROVED`, `JOIN_REJECTED`

**Frontend:**
- [ ] Checkbox en pool creation: "Require approval for new members"
- [ ] Nueva sección "Pending Requests (3)" en Admin tab
- [ ] Lista con:
  - Avatar/nombre del usuario
  - Fecha de solicitud
  - Botones: [Aprobar] [Rechazar]
- [ ] Modal para rechazo (razón opcional)
- [ ] Badge en navbar: "🔔 3 solicitudes pendientes"
- [ ] Empty state: "No hay solicitudes pendientes"

**Archivos afectados:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/pools.ts`
- `frontend/src/pages/PoolPage.tsx`
- `frontend/src/pages/DashboardPage.tsx` (badge)

---

### **5. Player Expulsion System** [2 días]
**Prioridad:** 🔴 CRÍTICA

**Implementación:**

**Backend:**
- [ ] Agregar campos a PoolMember:
  - `bannedAt` (DateTime?)
  - `bannedBy` (String? - userId)
  - `banReason` (String?)
  - `banExpiresAt` (DateTime? - para temporary bans)
- [ ] Endpoints:
  - `POST /pools/:poolId/members/:userId/ban` - Expulsar
  - `POST /pools/:poolId/members/:userId/unban` - Reactivar
- [ ] Validaciones:
  - Solo HOST/CO_ADMIN puede expulsar
  - No puede expulsar a HOST
  - CO_ADMIN no puede expulsar a otro CO_ADMIN
  - `reason` es requerido
- [ ] Tipos de ban:
  - **Permanent:** `banExpiresAt = null`
  - **Temporary:** `banExpiresAt = Date + X días`
- [ ] Cron job (futuro): Desbanear automáticamente cuando expire
- [ ] Validar en todas las acciones: Si user está banned → 403
- [ ] Audit log: `PLAYER_BANNED`, `PLAYER_UNBANNED`

**Frontend:**
- [ ] Botón "Expel Player" en member list (solo HOST/CO_ADMIN)
- [ ] Modal de expulsión:
  ```
  Expulsar a Juan Carlos

  Tipo de expulsión:
  ○ Permanente (no puede volver a unirse)
  ○ Temporal
     Duración: [___] días

  Razón (requerida):
  [_________________________]

  [Cancelar]  [Expulsar]
  ```
- [ ] Badge "BANNED" en member list
- [ ] Mostrar razón en tooltip
- [ ] Botón "Unban" (solo HOST)

**Archivos afectados:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/pools.ts`
- `frontend/src/pages/PoolPage.tsx`

---

## 📅 FASE 3: PERSONALIZACIÓN DE USUARIO (Día 10-14)
**Objetivo:** Profile completo y configuración de timezone

### **6. User Profile Page (Completo)** [3 días]
**Prioridad:** 🔴 CRÍTICA

**Implementación:**

**Backend:**
- [ ] Agregar campos a User:
  - `firstName` (String?)
  - `lastName` (String?)
  - `age` (Int? - validar 13-120)
  - `gender` (Enum: MALE, FEMALE, NON_BINARY, PREFER_NOT_TO_SAY, null)
  - `bio` (String? - max 500 chars)
  - `profilePictureUrl` (String?)
  - `profileCompleteness` (Int - calculado 0-100)
- [ ] Setup Cloudinary:
  - Cuenta gratuita
  - Upload preset para profile pictures
  - Transformaciones: 400x400, crop fill, face detection
- [ ] Endpoints:
  - `GET /users/me/profile` - Ver perfil propio
  - `PATCH /users/me/profile` - Editar perfil
  - `POST /users/me/profile-picture` - Upload foto (usando Cloudinary)
- [ ] Calcular `profileCompleteness`:
  ```javascript
  const fields = [email, username, displayName, firstName, lastName,
                  age, gender, bio, profilePictureUrl, timezone];
  const filled = fields.filter(f => f !== null).length;
  const completeness = Math.round((filled / fields.length) * 100);
  ```
- [ ] Validaciones:
  - Max file size: 5MB
  - Formatos: JPG, PNG, WEBP
  - Bio max 500 chars
  - Age 13-120

**Frontend:**
- [ ] Nueva ruta: `/profile`
- [ ] Componente `ProfilePage`:
  - Avatar grande (foto o iniciales)
  - Botón "Cambiar foto" → Cloudinary Upload Widget
  - Form con todos los campos (opcional)
  - Barra de progreso: "Completa tu perfil: 60%"
  - Botones: [Cancelar] [Guardar cambios]
- [ ] Componente `ProfilePictureUpload`:
  - Cloudinary Widget con crop
  - Preview antes de guardar
  - Fallback: Avatar con iniciales
- [ ] Link en navbar: "Mi Perfil" (con avatar pequeño)
- [ ] Mostrar foto en member lists, leaderboard, chat

**Cloudinary Setup:**
```env
# backend/.env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# frontend/.env
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=profile-pictures
```

**Archivos afectados:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/users.ts` (nuevo)
- `backend/src/lib/cloudinary.ts` (nuevo)
- `frontend/src/pages/ProfilePage.tsx` (nuevo)
- `frontend/src/components/ProfilePictureUpload.tsx` (nuevo)
- `frontend/src/App.tsx` (nueva ruta)

---

### **7. User Timezone Configuration** [1-2 días]
**Prioridad:** 🔴 CRÍTICA

**Implementación:**

**Backend:**
- [ ] Campo `timezone` en User ya existe desde Sprint 1 ✅
- [ ] Endpoint: `PATCH /users/me/timezone`
- [ ] Validación: IANA timezone válido
- [ ] Auto-detect en registro (via browser API)

**Frontend:**
- [ ] Selector de timezone en ProfilePage
- [ ] Auto-detect en registro:
  ```javascript
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  ```
- [ ] Dropdown con timezones comunes + búsqueda
- [ ] Preview: "Hora actual: 10:30 AM"
- [ ] Aplicar timezone a todas las fechas:
  ```javascript
  function formatDate(isoString, userTimezone) {
    return new Date(isoString).toLocaleString('es-ES', {
      timeZone: userTimezone,
      // ... formato
    });
  }
  ```
- [ ] Fallback: Si user no tiene timezone, usar del pool

**Archivos afectados:**
- `backend/src/routes/users.ts`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/lib/dateUtils.ts` (nuevo helper)
- `frontend/src/pages/PoolPage.tsx` (usar nuevo helper)

---

## 📅 FASE 4: SESSION MANAGEMENT (Día 15-17)
**Objetivo:** Mejorar UX de sesiones con "Remember Me"

### **8. Session Management (Remember Me)** [2-3 días]
**Prioridad:** 🟡 IMPORTANTE

**Implementación:**

**Backend:**
- [ ] Modificar `POST /auth/login` para aceptar `rememberMe: boolean`
- [ ] Modificar JWT expiry:
  ```javascript
  const expiresIn = rememberMe ? '30d' : '4h';
  const token = signToken({ userId, platformRole }, expiresIn);
  ```
- [ ] Endpoint: `POST /auth/extend-session` (refresh token por 4h más)
- [ ] Audit log: `SESSION_EXTENDED`

**Frontend:**
- [ ] Checkbox en LoginPage: "Mantener sesión iniciada"
- [ ] Disclaimer: "⚠️ Solo usa esta opción en dispositivos privados"
- [ ] Guardar `rememberMe` en localStorage
- [ ] Countdown en navbar (solo si NO rememberMe):
  ```
  ⏱️ 2h 15m
  ```
- [ ] Modal de warning (30 min antes de expirar):
  ```
  ⏰ Tu sesión expirará pronto

  Tu sesión expirará en 30 minutos.

  [Cerrar sesión]  [Extender por 4h más]
  ```
- [ ] Botón "Extender" llama a `/auth/extend-session`
- [ ] Calcular tiempo restante:
  ```javascript
  const decoded = jwt_decode(token);
  const expiresAt = decoded.exp * 1000;
  const remaining = expiresAt - Date.now();
  ```

**Archivos afectados:**
- `backend/src/routes/auth.ts`
- `backend/src/lib/jwt.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/components/Navbar.tsx` (nuevo countdown)
- `frontend/src/lib/auth.ts`

---

## 📅 FASE 5: ADVANCED PICK TYPES (Día 18-23)
**Objetivo:** Sistema flexible de tipos de picks

### **9. Advanced Pick Types System** [5-6 días]
**Prioridad:** 🟠 COMPLEJO

**Implementación:**

**Catálogo de Pick Types (11 tipos):**

1. ✅ EXACT_SCORE (ya existe)
2. ✅ MATCH_OUTCOME (ya existe)
3. 🆕 GOAL_DIFFERENCE
4. 🆕 TOTAL_GOALS
5. 🆕 BOTH_TEAMS_SCORE
6. 🆕 FIRST_GOAL
7. 🆕 DOUBLE_CHANCE
8. 🆕 PARTIAL_SCORE_HOME
9. 🆕 PARTIAL_SCORE_AWAY
10. 🆕 **GROUP_STANDINGS** (especial)
11. 🆕 **KNOCKOUT_WINNER** (especial)

**Backend:**
- [ ] Crear tabla `PickTypeDefinition`:
  ```prisma
  model PickTypeDefinition {
    key         String  @id // "EXACT_SCORE", "GROUP_STANDINGS", etc.
    name        String  // "Marcador exacto"
    description String  // Explicación detallada
    category    String  // "BASIC", "ADVANCED", "SPECIAL"
    inputType   String  // "SCORE", "OUTCOME", "NUMBER", "RANKING"
    applicableTo String // "MATCH", "GROUP", "PHASE"
  }
  ```
- [ ] Seedear catálogo con 11 tipos
- [ ] Agregar campo `pickTypesConfig` a Pool (JSON):
  ```json
  {
    "group_stage": [
      {
        "typeKey": "GROUP_STANDINGS",
        "enabled": true,
        "points": 0,
        "config": {
          "pointsPerCorrectPosition": 5,
          "pointsPerCorrectQualifier": 2,
          "pointsForPerfectGroup": 20
        }
      }
    ],
    "knockout": [
      {
        "typeKey": "KNOCKOUT_WINNER",
        "enabled": true,
        "points": 3,
        "config": { "scaling": true }
      }
    ]
  }
  ```
- [ ] Endpoint: `PATCH /pools/:poolId/pick-types` (configurar)
- [ ] Validación: No cambiar si pool status = ACTIVE
- [ ] Modificar scoring logic para manejar todos los tipos

**Frontend:**
- [ ] UI de configuración (pool creation):
  ```
  ┌─────────────────────────────────────────┐
  │ Configurar Tipos de Picks               │
  ├─────────────────────────────────────────┤
  │ Fase de Grupos:                         │
  │ ┌─────────────────────────────────────┐ │
  │ │ ☑ Clasificación de Grupos           │ │
  │ │   💡 Los jugadores ordenan equipos  │ │
  │ │       por posición final            │ │
  │ │   Posición exacta: [5] pts          │ │
  │ │   Clasificado: [2] pts              │ │
  │ │   Grupo perfecto: [20] pts          │ │
  │ └─────────────────────────────────────┘ │
  │                                          │
  │ Eliminatorias:                          │
  │ ┌─────────────────────────────────────┐ │
  │ │ ☑ Quién avanza                      │ │
  │ │   💡 Solo predice ganador (simple)  │ │
  │ │   Ronda 32: [3] pts                 │ │
  │ │   Octavos: [5] pts                  │ │
  │ │   Final: [20] pts                   │ │
  │ └─────────────────────────────────────┘ │
  │                                          │
  │ [Ver todos los tipos disponibles (11)]  │
  └─────────────────────────────────────────┘
  ```
- [ ] Tooltip explicativo para cada tipo (con emoji 💡)
- [ ] Preview de cómo se verá para los jugadores
- [ ] Validación: Al menos 1 tipo activo por fase

**Archivos afectados:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/pools.ts`
- `backend/src/lib/scoring.ts` (refactor grande)
- `backend/src/scripts/seedPickTypes.ts` (nuevo)
- `frontend/src/pages/CreatePoolPage.tsx` (nuevo)
- `frontend/src/components/PickTypeConfigurator.tsx` (nuevo)

**NOTA:** Esta es la feature más compleja del Sprint 2. Requiere diseño cuidadoso.

---

## 📅 FASE 6: SOCIAL ENGAGEMENT (Día 24-30)
**Objetivo:** Chat para aumentar engagement

### **10. Chat del Pool** [5-7 días]
**Prioridad:** 🟢 ENGAGEMENT

**Implementación:**

**Backend:**
- [ ] Crear tabla `PoolMessage`:
  ```prisma
  model PoolMessage {
    id        String      @id @default(uuid())
    poolId    String
    userId    String
    content   String      @db.Text // Max 500 chars
    type      MessageType @default(USER) // USER | SYSTEM
    metadata  Json?       // Para system messages
    replyToId String?
    editedAt  DateTime?
    deletedAt DateTime?   // Soft delete
    deletedBy String?
    createdAt DateTime    @default(now())
  }

  enum MessageType {
    USER
    SYSTEM
  }
  ```
- [ ] Endpoints:
  - `GET /pools/:poolId/messages?limit=50&after=messageId`
  - `POST /pools/:poolId/messages`
  - `PUT /pools/:poolId/messages/:messageId` (edit, 5 min window)
  - `DELETE /pools/:poolId/messages/:messageId` (soft delete)
- [ ] Validaciones:
  - Solo miembros ACTIVE pueden ver/enviar
  - Max 500 caracteres
  - Edit solo autor, dentro de 5 min
  - Delete: autor o HOST/CO_ADMIN
- [ ] System messages auto-generados:
  - User joined pool
  - Result published
  - Phase advanced
  - Errata corrected
  - Deadline approaching
- [ ] Audit log: `MESSAGE_DELETED` (si admin lo borra)

**Frontend:**
- [ ] Nueva tab "💬 Chat (3)" en PoolPage
- [ ] Componentes:
  - `ChatTab` (container)
  - `MessageList` (scroll area)
  - `Message` (individual message)
  - `MessageInput` (input + send button)
- [ ] Polling cada 3 segundos cuando tab está visible
- [ ] Features:
  - Auto-scroll al último mensaje
  - Badge con contador de nuevos
  - Avatares (foto o iniciales)
  - Timestamps relativos ("Hace 5 min")
  - Botones inline: [Editar] [Borrar] (solo propios)
  - System messages en color diferente
  - Enter para enviar, Shift+Enter para nueva línea
  - Contador: "250/500 caracteres"
- [ ] Empty state: "Sé el primero en comentar 💬"

**Archivos afectados:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/pools.ts` (nuevos endpoints)
- `frontend/src/pages/PoolPage.tsx` (nueva tab)
- `frontend/src/components/ChatTab.tsx` (nuevo)
- `frontend/src/components/Message.tsx` (nuevo)

---

## 📅 FASE 7: SECURITY & POLISH (Día 31-35)
**Objetivo:** Hardening de seguridad y polish final

### **11. Rate Limiting + Login Attempts** [2 días]
**Prioridad:** 🔴 SUPER CRÍTICA (Seguridad)

**Implementación:**

**Backend:**
- [ ] Instalar `express-rate-limit`
- [ ] Crear tabla `LoginAttempt`:
  ```prisma
  model LoginAttempt {
    id        String   @id @default(uuid())
    email     String
    ip        String
    success   Boolean
    createdAt DateTime @default(now())

    @@index([email, createdAt])
    @@index([ip, createdAt])
  }
  ```
- [ ] Middleware rate limiting:
  ```javascript
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 5, // 5 intentos
    message: "Demasiados intentos. Inténtalo en 15 minutos."
  });
  ```
- [ ] Lógica de intentos:
  - Guardar cada intento en DB
  - Contar intentos fallidos (últimos 15 min)
  - Al 4to intento: enviar email automático de password reset
  - Al 5to intento: bloquear IP por 15 min
- [ ] Aplicar a endpoints:
  - `POST /auth/login` (5 intentos / 15 min)
  - `POST /auth/register` (10 intentos / hora)
  - `POST /auth/forgot-password` (3 intentos / hora)
  - `POST /auth/reset-password` (5 intentos / hora)
- [ ] Limpiar intentos viejos (cron job diario)

**Frontend:**
- [ ] Mostrar contador: "Intentos restantes: 2/4"
- [ ] Mensaje explicativo:
  ```
  ⚠️ Después de 4 intentos fallidos, recibirás un
  email automático para recuperar tu contraseña.
  ```
- [ ] Auto-redirect a forgot-password después del 4to intento
- [ ] Mostrar mensaje cuando IP está bloqueada:
  ```
  🔒 Demasiados intentos fallidos

  Por seguridad, tu acceso ha sido bloqueado
  temporalmente. Inténtalo de nuevo en 15 minutos.

  ¿Olvidaste tu contraseña?
  [Recuperar contraseña]
  ```

**Archivos afectados:**
- `backend/package.json` (nueva dep)
- `backend/prisma/schema.prisma`
- `backend/src/middleware/rateLimiter.ts` (nuevo)
- `backend/src/routes/auth.ts`
- `frontend/src/pages/LoginPage.tsx`

---

### **12. Mobile UX Improvements** [2 días]
**Prioridad:** 🟢 POLISH

**Implementación:**

**Táctica:**
- [ ] Touch gestures (swipe para cambiar tabs)
- [ ] Bottom navigation bar (en móvil)
- [ ] Sticky headers al hacer scroll
- [ ] Pull-to-refresh en listas
- [ ] Tap targets mínimo 44x44px
- [ ] Teclado numérico para inputs de goles
- [ ] Scroll to top button
- [ ] Mejoras en spacing/padding para mobile
- [ ] Menú hamburger para navegación
- [ ] Modals full-screen en mobile

**Testing:**
- [ ] Chrome DevTools (responsive mode)
- [ ] Test en iPhone (Safari)
- [ ] Test en Android (Chrome)

**Archivos afectados:**
- `frontend/src/index.css` (media queries)
- `frontend/src/pages/PoolPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/Navbar.tsx`

---

### **13. Email Confirmation** [1 día]
**Prioridad:** 🟡 IMPORTANTE (ÚLTIMO - Consume Resend)

**Implementación:**

**Backend:**
- [ ] Agregar campos a User:
  - `emailVerified` (Boolean, default: false)
  - `emailVerificationToken` (String?)
  - `emailVerificationExpiresAt` (DateTime?)
- [ ] En registro:
  - Generar token (crypto.randomBytes(32))
  - Enviar email con link de confirmación
  - Expiry: 24 horas
- [ ] Endpoint: `POST /auth/confirm-email`
- [ ] Endpoint: `POST /auth/resend-confirmation` (rate limit: 1/hora)
- [ ] Validación: No puede crear pools si `emailVerified = false`
- [ ] Email template:
  ```html
  <h1>Confirma tu email</h1>
  <p>Haz clic en el botón para confirmar tu cuenta:</p>
  <a href="http://localhost:5173/confirm-email?token=...">
    Confirmar Email
  </a>
  <p>Este enlace expira en 24 horas.</p>
  ```

**Frontend:**
- [ ] Nueva ruta: `/confirm-email?token=xxx`
- [ ] Banner en dashboard (si no confirmado):
  ```
  ⚠️ Confirma tu email para crear pools
  [Reenviar email de confirmación]
  ```
- [ ] Success page: "✅ Email confirmado. Ahora puedes crear pools."
- [ ] Error page: "❌ Link inválido o expirado. [Reenviar]"

**Archivos afectados:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/auth.ts`
- `backend/src/lib/email.ts`
- `frontend/src/pages/ConfirmEmailPage.tsx` (nuevo)
- `frontend/src/pages/DashboardPage.tsx` (banner)
- `frontend/src/App.tsx` (nueva ruta)

---

## ✅ Definition of Done - Sprint 2

- [ ] Todas las 13 features implementadas y testeadas
- [ ] Database migrations ejecutadas en dev
- [ ] Todos los endpoints documentados en API_SPEC.md
- [ ] Business rules documentadas en BUSINESS_RULES.md
- [ ] ADRs escritos para decisiones arquitectónicas importantes
- [ ] Testing manual completo de cada feature
- [ ] Integración E2E testeada (flujo completo)
- [ ] UX polish (loading states, error handling, empty states)
- [ ] Mobile responsive verificado
- [ ] Documentación SoT actualizada
- [ ] SPRINT_2_CLOSURE.md creado
- [ ] Git commit con mensaje descriptivo
- [ ] MVP ready for beta testing

---

## 🚨 Reglas Importantes Durante el Sprint

### **1. Orden de Implementación**
- ✅ SEGUIR EL ORDEN estrictamente (evita retrocesos)
- ✅ Completar una feature antes de empezar la siguiente
- ✅ Marcar checkbox al terminar cada tarea

### **2. Documentación**
- ✅ Actualizar API_SPEC.md al crear nuevos endpoints
- ✅ Documentar business rules en BUSINESS_RULES.md
- ✅ Escribir ADR para decisiones arquitectónicas importantes

### **3. Testing**
- ✅ Testing manual después de cada feature
- ✅ Verificar que no rompiste features anteriores
- ✅ Probar en mobile (Chrome DevTools)

### **4. Git**
- ✅ Commits pequeños y descriptivos
- ✅ No commitear `.env` files
- ✅ Limpiar código antes de commit (no console.logs)

### **5. Comunicación**
- ✅ Avisar si una feature toma más tiempo del estimado
- ✅ Preguntar si hay ambigüedad en requerimientos
- ✅ Proponer mejoras si identificas algo

---

## 📊 Métricas de Progreso

**Actualizar al final de cada fase:**

```
FASE 1: [____] 0/3 features (0%)
FASE 2: [____] 0/2 features (0%)
FASE 3: [____] 0/2 features (0%)
FASE 4: [____] 0/1 feature  (0%)
FASE 5: [____] 0/1 feature  (0%)
FASE 6: [____] 0/1 feature  (0%)
FASE 7: [____] 0/3 features (0%)

TOTAL: 0/13 features completadas (0%)
```

---

## 🎯 Próximo Paso

**Comenzar con:** Pool State Machine (FASE 1, Feature #1)

**Tiempo estimado:** 2 días

**Archivos a modificar:**
- `backend/prisma/schema.prisma`
- `backend/src/routes/pools.ts`
- `frontend/src/pages/PoolPage.tsx`

---

**Documento creado:** 2026-01-05
**Creado por:** Claude (Sonnet 4.5)
**Aprobado por:** Juan (Product Owner)
**Status:** 🟢 LISTO PARA EMPEZAR
