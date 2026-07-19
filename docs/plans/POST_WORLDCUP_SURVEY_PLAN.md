# Plan — Encuesta post-Mundial (opinión de plataforma, variante Host)

> **Estado:** PLAN v3 — decisiones del owner incorporadas (2026-07-19). Pendiente GO final.
> **Objetivo:** modal de encuesta activo desde 1 min después del fin del Mundial y
> durante 5 días. **Todas las escalas son 1–10.** Opinión abierta y consentimiento
> de compartir para todos; bloque de 5 dimensiones para Hosts.

---

## 1. Veredicto del análisis: ¿tenemos todo para montarlo desde aquí?

**Sí.** Inventario verificado en código:

| Necesidad | ¿Existe? | Evidencia |
|---|---|---|
| Esqueleto de modal bloqueante app-wide (overlay, header degradado, body scrolleable, footer fijo, cierre no-atrapante) | ✅ | `WhatsNewModal.tsx` |
| Punto de montaje global autenticado | ✅ | `AuthenticatedLayoutClient.tsx` (1 línea) |
| Rollout staged sin redeploy | ✅ | `lib/featureFlags.ts` (`emailInAllowlist`, lectura runtime) |
| Migraciones aditivas de bajo riesgo | ✅ | Patrón probado (`AnalyticsDashboardSnapshot`) |
| Rate limiting para el POST | ✅ | `middleware/rateLimit.ts` |
| i18n es/en/pt | ✅ | `messages/{es,en,pt}/common.json` |
| Detección de Host | ⚠️ construir (trivial) | `EXISTS PoolMember WHERE userId AND role IN (HOST, CORPORATE_HOST)` — **CO_ADMIN excluido (decidido)** |
| Persistencia de respuestas | ⚠️ construir | Feedback actual es solo-email → modelo `SurveyResponse` nuevo |
| Señal "el Mundial terminó" | ✅ decidido | Env vars (§3) |

---

## 2. Qué verá cada caso (v3 — todas las escalas 1–10)

### Pantalla 1 — IGUAL para Jugador y Host (3 preguntas obligatorias, 1–10)

| # | Pregunta | Escala |
|---|---|---|
| 1 | **¿Cómo calificas tu experiencia en Picks4All?** | 1–10 |
| 2 | **¿Qué tan probable es que recomiendes Picks4All a un amigo?** | 1–10 |
| 3 | **¿Qué tan probable es que uses Picks4All en otros torneos** (ligas, Champions, Copa América…)? | 1–10 |

- Encabezado según variante:
  - Jugador: *"⚽ ¡Gracias por vivir el Mundial con Picks4All! Tu opinión nos ayuda a construir la plataforma que todos quisiéramos tener."*
  - Host: *"🧡 ¡Gracias por hostear en Picks4All! Los hosts son el corazón de la plataforma. Tu opinión vale doble."*
- **Enviar** se habilita al responder las 3 · ✕ / "Ahora no" cierran (solo esa sesión).
- Los 3 puntajes se **persisten al primer Enviar** (no se pierden si abandona la pantalla 2).

### Pantalla 2 — Jugador (expansión, opcional)

- **Opinión abierta** (textarea): "¿Quieres contarnos algo más?"
- ☐ **Consentimiento:** "Autorizo a Picks4All a compartir mi opinión como parte de los logros de la plataforma" (desmarcado por defecto)
- **Enviar** / **Omitir** → gracias

### Pantalla 2 — Host (expansión, opcional)

**Las 5 dimensiones definidas por el owner, ahora 1–10 cada una:**
1. Facilidad de **crear** tu pool
2. Facilidad de **invitar** jugadores
3. **Resultados en vivo**
4. **Claridad de las reglas**
5. **Soporte** recibido

… más lo común:
- **Opinión abierta** (textarea): "¿Qué te faltó o qué mejorarías?"
- ☐ **Consentimiento** de compartir (mismo texto)
- **Enviar** / **Omitir** → gracias

> El consentimiento aplica a **todos**; se registra `isCorporateHost` para poder priorizar testimonios corporativos.

### Reglas de aparición (DECIDIDO, sin cambios de v2)

- Ventana: `SURVEY_OPENS_AT` (fin de la final + 1 min) durante **5 días**.
- Aparece **en cada apertura de la app** mientras no respondan; el cierre vale solo para esa sesión (memoria, sin localStorage).
- Responder → nunca más (DB `userId @unique`, cross-device).
- Sesión abierta durante la final: check de reloj cada 60 s → aparece sin recargar.
- Fail-closed si el fetch de estado falla.

---

## 3. Trigger (DECIDIDO)

`SURVEY_OPENS_AT` (ISO UTC), `SURVEY_CLOSES_AT` (= opens + 5 días), `SURVEY_ALLOWLIST` ("" off / email / "*"). Runtime, sin redeploy. Kill-switch: allowlist `""`.

---

## 4. Diseño técnico

### Modelo `SurveyResponse` (migración aditiva)

```prisma
model SurveyResponse {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  isHost          Boolean            // rol HOST o CORPORATE_HOST en ≥1 pool
  isCorporateHost Boolean
  overallScore    Int                // 1-10
  recommendScore  Int                // 1-10 (probabilidad de recomendar)
  otherTournamentsScore Int          // 1-10 (usaría la app en otros torneos)
  comment         String?
  shareConsent    Boolean  @default(false)
  // Bloque host (null para jugadores) — 1-10 cada uno:
  hostCreateScore      Int?
  hostInviteScore      Int?
  hostLiveResultsScore Int?
  hostRulesScore       Int?
  hostSupportScore     Int?
  locale        String?
  createdAtUtc  DateTime @default(now())
  updatedAtUtc  DateTime @updatedAt
}
```

### Endpoints
- **`GET /survey/status`** (auth): `{ open, opensAtUtc, alreadySubmitted, isHost }`.
- **`POST /survey`** (auth + rate-limit + Zod): los **3 scores** de pantalla 1 + snapshot `isHost`/`isCorporateHost`. Crea la fila; scores inmutables.
- **`POST /survey/details`** (auth + Zod, dentro de ventana): `comment`, `shareConsent`, bloque host (5 scores 1-10). Idempotente.
- **`GET /admin/survey/summary`** (requireAdmin, JSON): n, promedios de los 3 scores, **métrica de recomendación** (con escala 1-10: promotores 9-10, pasivos 7-8, detractores ≤6), promedio "otros torneos" (proxy de retención), split jugador/host/corporate, promedios de las 5 dimensiones host, % consentimiento + comentarios compartibles (banco de testimonios).
- **Flags:** `isSurveyOpenFor(email)` en `featureFlags.ts`.
- Sin emails por respuesta.
- Tests: ventana/allowlist, Zod (rangos 1-10), unicidad, isHost (CO_ADMIN → false), corporate flag, idempotencia.

### Frontend
- **`PostWorldCupSurveyModal.tsx`** (nuevo, esqueleto WhatsNew): pantalla-1 (3 escalas) → pantalla-2 (variante) → gracias; dismiss en memoria.
- Fila de botones 1–10 responsive: en 360px se parte en dos filas de 5 (touch 44px) — verificado en QA mobile.
- **`lib/api/survey.ts`** + montaje 1 línea + i18n `survey.*` es/en/pt.

### Qué NO se toca
Ningún flujo existente. Deploy con allowlist vacía = inerte.

---

## 5. Rollout

1. Deploy `SURVEY_ALLOWLIST=""` → invisible.
2. Allowlist = owner → preview (variante Host la ves tú; Jugador con cuenta de prueba).
3. GO → `*` + ventana real (+5 días).
4. Kill-switch: `""`.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper algo existente | 1 línea compartida; resto nuevo; migración aditiva; flag off |
| Modal que atrapa | Cierre siempre funcional, footer fijo, ✕ 44px |
| 3 escalas + reaparición diaria = fricción | Decisión del owner (ventana 5 días); responder toma ~10 segundos |
| Doble respuesta / spam | `userId @unique` + rate limit + Zod |
| Perder scores | Persisten al primer Enviar |
| Validez del consentimiento | Desmarcado por defecto, texto explícito, timestamp |

## 7. Decisiones

| Tema | Estado |
|---|---|
| Escalas | **Todas 1–10** (v3) |
| Pantalla 1 | 3 preguntas para todos: experiencia + recomendar + otros torneos (v3) |
| CO_ADMIN como host | ❌ NO (decidido) |
| Frecuencia | Cada apertura × 5 días (decidido) |
| Dimensiones host | Crear · Invitar · Resultados en vivo · Claridad de reglas · Soporte — 1–10 (v3) |
| Consentimiento | TODOS, desmarcado por defecto (decidido) |
| Opinión abierta | TODOS (decidido) |
| Resumen admin | Incluido |
| Copy | Ajustable en preview |

## 8. Archivos a tocar

**Backend:** `prisma/schema.prisma` + migración · `lib/featureFlags.ts` · `routes/survey.ts` (nuevo) · `server.ts` (mount) · `routes/admin.ts` (summary) · tests · ADR · DEPLOYMENT.md (3 env vars).
**Frontend:** `components/PostWorldCupSurveyModal.tsx` (nuevo) · `lib/api/survey.ts` (nuevo) · `AuthenticatedLayoutClient.tsx` (+1 línea) · `messages/{es,en,pt}/common.json`.
