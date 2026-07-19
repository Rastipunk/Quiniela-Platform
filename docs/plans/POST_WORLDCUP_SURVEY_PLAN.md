# Plan — Encuesta post-Mundial (opinión de plataforma, variante Host)

> **Estado:** PLAN v2 — decisiones del owner incorporadas (2026-07-19). Pendiente GO final.
> **Objetivo:** modal de encuesta activo desde 1 min después del fin del Mundial y
> durante 5 días: opinión general (1-10) + probabilidad de recomendar (NPS 0-10),
> opinión abierta y consentimiento de compartir (todos), y bloque enriquecido para Hosts.

---

## 1. Veredicto del análisis: ¿tenemos todo para montarlo desde aquí?

**Sí.** Inventario verificado en código:

| Necesidad | ¿Existe? | Evidencia |
|---|---|---|
| Esqueleto de modal bloqueante app-wide (overlay, header degradado, body scrolleable, footer fijo, cierre no-atrapante) | ✅ | `WhatsNewModal.tsx` — patrón completo, incluidas las lecciones de mobile |
| Punto de montaje global autenticado | ✅ | `AuthenticatedLayoutClient.tsx` (1 línea junto a `WhatsNewModal`) |
| Rollout staged sin redeploy | ✅ | `lib/featureFlags.ts` — helper compartido `emailInAllowlist`, lectura runtime |
| Migraciones aditivas de bajo riesgo | ✅ | Patrón probado (`AnalyticsDashboardSnapshot`) |
| Rate limiting para el POST | ✅ | `middleware/rateLimit.ts` |
| i18n es/en/pt | ✅ | `messages/{es,en,pt}/common.json` |
| Detección de Host | ⚠️ construir (trivial) | Query `EXISTS PoolMember WHERE userId AND role IN (HOST, CORPORATE_HOST)` — **CO_ADMIN excluido por decisión del owner** |
| Persistencia de respuestas | ⚠️ construir | El feedback actual es solo-email → se crea modelo `SurveyResponse` |
| Señal "el Mundial terminó" | ✅ decidido | Env vars manuales (§3) |

**Conclusión:** 1 migración aditiva + 3 endpoints + 1 componente + i18n. Solo **una línea** de código compartido se toca (el mount).

---

## 2. Qué verá cada caso (DECIDIDO por el owner)

### Caso A — Jugador (sin rol HOST/CORPORATE_HOST en ningún pool)

**Pantalla 1 (2 preguntas obligatorias):**
> **⚽ ¡Gracias por vivir el Mundial con Picks4All!**
> Tu opinión nos ayuda a construir la plataforma que todos quisiéramos tener.
- "**¿Cómo calificas tu experiencia en Picks4All?**" → botones **1–10**
- "**¿Qué tan probable es que recomiendes Picks4All a un amigo?**" → **0–10** (NPS)
- **Enviar** (se habilita al responder ambas) · ✕ / "Ahora no" cierran

**Pantalla 2 (expansión, opcional):**
- **Opinión abierta** (textarea): "¿Quieres contarnos algo más?"
- ☐ **Consentimiento:** "Autorizo a Picks4All a compartir mi opinión como parte de los logros de la plataforma" (desmarcado por defecto)
- **Enviar** / **Omitir** → gracias

### Caso B — Host (rol HOST o CORPORATE_HOST en ≥1 pool; CO_ADMIN NO cuenta)

**Pantalla 1: idéntica a la del jugador** (mismas 2 escalas, comparabilidad) con encabezado propio:
> **🧡 ¡Gracias por hostear en Picks4All!**
> Los hosts son el corazón de la plataforma. Tu opinión vale doble.

**Pantalla 2 (expansión, opcional) — las 5 dimensiones definidas por el owner, 1–5 c/u:**
1. **Facilidad de crear** tu pool
2. **Facilidad de invitar** jugadores
3. **Resultados en vivo**
4. **Claridad de las reglas**
5. **Soporte** recibido

… más lo común a todos:
- **Opinión abierta** (textarea): "¿Qué te faltó o qué mejorarías?"
- ☐ **Consentimiento** de compartir (mismo texto que jugadores)
- **Enviar** / **Omitir** → gracias

> Nota: el consentimiento aplica a **todos** (decisión final del owner — inicialmente se pidió solo corporate, luego se extendió a todos). Se registra igualmente si el host es corporativo (`isCorporateHost`) para poder priorizar esos testimonios.

### Reglas de aparición (DECIDIDO)

- **Ventana:** desde `SURVEY_OPENS_AT` (fin de la final + 1 min) durante **5 días**.
- **Frecuencia:** aparece **en CADA apertura de la app** mientras no hayan respondido. El cierre (✕ / "Ahora no") vale **solo para esa sesión** (estado en memoria, sin localStorage) — al volver a abrir, reaparece. Sin límite de apariciones dentro de los 5 días (decisión deliberada del owner, prioriza volumen de respuestas).
- **Responder → nunca más** (registro en DB por `userId @unique`, cross-device).
- **Caso "viendo la final con la app abierta":** fetch de elegibilidad al montar + check de reloj cada 60 s → si la ventana se abre en mitad de la sesión, el modal aparece sin recargar.
- **Fail-closed:** si el fetch de estado falla, no aparece (cero impacto).

---

## 3. Trigger "fin del Mundial" (DECIDIDO)

Env vars runtime (sin redeploy): `SURVEY_OPENS_AT` (ISO UTC = fin real + 1 min), `SURVEY_CLOSES_AT` (= opens + **5 días**), `SURVEY_ALLOWLIST` ("" off / email / "*"). Kill-switch: allowlist a `""`.

---

## 4. Diseño técnico

### Modelo `SurveyResponse` (migración aditiva, columnas tipadas)

```prisma
model SurveyResponse {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  isHost          Boolean            // rol HOST o CORPORATE_HOST en ≥1 pool
  isCorporateHost Boolean            // rol CORPORATE_HOST en ≥1 pool
  overallScore    Int                // 1-10
  npsScore        Int                // 0-10
  comment         String?            // opinión abierta (todos)
  shareConsent    Boolean  @default(false) // autoriza compartir como logro
  // Bloque host (null para jugadores) — 1-5 cada uno:
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
- **`GET /survey/status`** (auth): `{ open, opensAtUtc, alreadySubmitted, isHost }`. `open` = ventana + allowlist. `isHost` = EXISTS PoolMember rol HOST/CORPORATE_HOST.
- **`POST /survey`** (auth + rate-limit + Zod): guarda `overallScore` + `npsScore` + snapshot `isHost`/`isCorporateHost`. Primera escritura crea; scores inmutables después.
- **`POST /survey/details`** (auth + Zod, solo dentro de ventana): añade `comment`, `shareConsent` y el bloque host (5 scores) a la fila propia. Idempotente.
- **`GET /admin/survey/summary`** (requireAdmin, JSON): n, promedio general, NPS calculado, split host/jugador/corporate, promedios de las 5 dimensiones host, % de consentimiento, últimos 20 comentarios (marcando cuáles tienen `shareConsent=true` — la lista de testimonios utilizables).
- **Flags:** `isSurveyOpenFor(email)` en `featureFlags.ts` (ventana + allowlist compartida).
- **Sin emails por respuesta.**
- Tests: ventana/allowlist, Zod (rangos 1-10/0-10/1-5), unicidad, cálculo isHost (CO_ADMIN debe dar false), corporate flag, idempotencia de details.

### Frontend
- **`PostWorldCupSurveyModal.tsx`** (nuevo, esqueleto WhatsNew): pantalla-1 → pantalla-2 → gracias; variante host por `isHost`; dismiss en memoria (sin localStorage — reaparece en la próxima apertura, por diseño).
- **`lib/api/survey.ts`**: `getSurveyStatus`, `submitSurvey`, `submitSurveyDetails`.
- **Montaje:** 1 línea en `AuthenticatedLayoutClient`.
- **i18n:** bloque `survey.*` en es/en/pt.
- Escalas con `TOUCH_TARGET.minimum`; sin overflow a 360px; checkbox de consentimiento con texto completo visible.

### Qué NO se toca
Ningún flujo existente. Deploy con allowlist vacía = inerte.

---

## 5. Rollout

1. Deploy `SURVEY_ALLOWLIST=""` → invisible.
2. `SURVEY_ALLOWLIST=juan.k.chacon9729@gmail.com` + ventana abierta → tú ves la variante **Host** (hosteas); la variante Jugador se revisa con cuenta de prueba (`seed:test-accounts`).
3. GO → `SURVEY_ALLOWLIST=*` + `SURVEY_OPENS_AT` real + `SURVEY_CLOSES_AT` (+5 días).
4. Kill-switch: allowlist `""`.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper algo existente | 1 línea en código compartido; resto archivos nuevos; migración aditiva; flag off default |
| Modal que atrapa | Cierre siempre funcional (estado primero), footer fijo, body scrolleable, ✕ 44px |
| Fatiga por reaparición en cada apertura | Decisión deliberada del owner (ventana corta de 5 días); el cierre por sesión evita re-pops dentro de la misma visita |
| Doble respuesta / spam | `userId @unique` + rate limit + Zod |
| Perder scores si abandonan la expansión | Scores persisten en el primer Enviar |
| Validez del consentimiento | Checkbox desmarcado por defecto, texto explícito, almacenado con timestamp |

## 7. Decisiones cerradas / abiertas

| Tema | Estado |
|---|---|
| CO_ADMIN como host | ❌ NO cuenta (decidido) |
| Frecuencia | Cada apertura × 5 días hasta responder (decidido) |
| Dimensiones host | Crear · Invitar · Resultados en vivo · Claridad de reglas · Soporte (decidido) |
| Consentimiento de compartir | Para TODOS, desmarcado por defecto (decidido) |
| Opinión abierta | Para TODOS (decidido) |
| Resumen admin JSON v1 | Incluido (propuesto, sin objeción) |
| Copy exacto | Propuesta en §2 — ajustable en el preview visual |

## 8. Archivos a tocar

**Backend:** `prisma/schema.prisma` + migración · `lib/featureFlags.ts` · `routes/survey.ts` (nuevo) · `server.ts` (mount) · `routes/admin.ts` (summary) · tests · `docs/DECISION_LOG.md` (ADR) · `docs/guides/DEPLOYMENT.md` (3 env vars).
**Frontend:** `components/PostWorldCupSurveyModal.tsx` (nuevo) · `lib/api/survey.ts` (nuevo) · `AuthenticatedLayoutClient.tsx` (+1 línea) · `messages/{es,en,pt}/common.json`.
