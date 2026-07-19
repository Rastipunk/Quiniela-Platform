# Plan — Encuesta post-Mundial (opinión de plataforma, variante Host)

> **Estado:** PLAN — pendiente de aprobación. Cero código hasta el OK.
> **Objetivo:** modal de encuesta para sesiones activas ≥1 min después del fin del
> Mundial: opinión general (1-10) + probabilidad de recomendar (NPS 0-10), con
> expansión opcional al enviar, y **variante enriquecida para Hosts**.

---

## 1. Veredicto del análisis: ¿tenemos todo para montarlo desde aquí?

**Sí.** Inventario verificado en código:

| Necesidad | ¿Existe? | Evidencia |
|---|---|---|
| Esqueleto de modal bloqueante app-wide (overlay, header degradado, body scrolleable, footer fijo, cierre no-atrapante) | ✅ | `WhatsNewModal.tsx` — patrón completo, incluidas las lecciones de mobile (botón siempre alcanzable) |
| Punto de montaje global autenticado | ✅ | `AuthenticatedLayoutClient.tsx` (1 línea junto a `WhatsNewModal` y `LocalePreferenceGate`) |
| Rollout staged sin redeploy | ✅ | `lib/featureFlags.ts` — helper compartido `emailInAllowlist` ("" off / email / "*"), leído en runtime |
| Migraciones aditivas de bajo riesgo | ✅ | Patrón probado (`AnalyticsDashboardSnapshot`, jun-23) |
| Rate limiting para el POST | ✅ | `middleware/rateLimit.ts` (apiLimiter y patrón para uno dedicado) |
| i18n es/en/pt | ✅ | `messages/{es,en,pt}/common.json` |
| Detección de Host | ⚠️ construir (trivial) | No expuesto hoy; query `EXISTS PoolMember WHERE userId AND role IN (HOST, CO_ADMIN, CORPORATE_HOST)` |
| Persistencia de respuestas | ⚠️ construir | El feedback actual (`routes/feedback.ts`) es **solo email a soporte@** — inviable para volumen de encuesta. Se crea modelo propio |
| Señal "el Mundial terminó" | ⚠️ decidir | No hay señal automática fiable; se propone timestamp por env var (ver §3) |

**Conclusión:** 1 migración aditiva + 2-3 endpoints + 1 componente + i18n. Nada compartido se modifica salvo **una línea** de montaje en el layout.

---

## 2. Qué verá cada caso (lo que apruebas)

### Caso A — Jugador (no host)

**Pantalla 1 (obligatoria, 2 preguntas):**
> **⚽ ¡Gracias por vivir el Mundial con Picks4All!**
> Tu opinión nos ayuda a construir la plataforma que todos quisiéramos tener.
- "**¿Cómo calificas tu experiencia en Picks4All?**" → fila de botones **1–10**
- "**¿Qué tan probable es que recomiendes Picks4All a un amigo?**" → **0–10** (NPS estándar)
- Botón **Enviar** (habilitado al responder ambas) · "Ahora no" / ✕ para cerrar

**Pantalla 2 (expansión, opcional — aparece tras Enviar):**
- "¿Quieres contarnos algo más?" → textarea libre
- **Enviar comentario** / **Omitir** → pantalla de gracias

Los dos puntajes se guardan **al primer Enviar** (si abandona la pantalla 2, no perdemos los scores).

### Caso B — Host (HOST / CO_ADMIN / CORPORATE_HOST en ≥1 pool)

**Pantalla 1: idéntica** (mismas 2 escalas — comparabilidad player vs host) pero con encabezado propio:
> **🧡 ¡Gracias por hostear en Picks4All!**
> Los hosts son el corazón de la plataforma. Tu opinión vale doble.

**Pantalla 2 (expansión enriquecida, todo opcional):**
- 3 mini-calificaciones **1–5**: 
  1. "Crear y configurar tu pool"
  2. "Resultados automáticos y marcadores en vivo"
  3. "Invitar y gestionar a tus jugadores"
- "**¿Volverías a hostear un torneo?**" → Sí / Tal vez / No
- Textarea: "¿Qué te faltó o qué mejorarías como host?"
- **Enviar** / **Omitir** → gracias

### Reglas comunes de aparición
- Aparece si: ventana abierta (§3) **y** allowlist lo incluye **y** no ha respondido (server-side) **y** no está en snooze local.
- **"Ahora no"** → snooze 24 h (localStorage, con try/catch anti-atasco); máximo **3 apariciones** en total; tras la 3ª, nunca más.
- **Responder** → nunca más en ningún dispositivo (registro en DB por `userId @unique`).
- **Caso "viendo la final con la app abierta"**: el modal hace fetch de elegibilidad al montar y un check de reloj cada 60 s — si la ventana se abre en mitad de la sesión (fin del partido + 1 min), el modal aparece sin recargar. Cumple literalmente "sesión activa más de 1 minuto después de que se acabe".
- Fail-closed: si el fetch de estado falla, el modal simplemente no aparece (cero impacto).

---

## 3. Trigger "fin del Mundial": decisión propuesta

**Propuesta: env vars manuales** (`SURVEY_OPENS_AT` ISO-UTC, `SURVEY_CLOSES_AT`, `SURVEY_ALLOWLIST`).
- Al terminar la final, seteamos `SURVEY_OPENS_AT` = fin real + 1 min (o lo dejamos pre-configurado a la hora estimada y lo ajustamos). Sin redeploy (lectura runtime).
- `SURVEY_CLOSES_AT` propone **+2 semanas** (una encuesta eterna deja de tener valor).
- **Alternativa considerada y descartada:** derivarlo automáticamente del `API_CONFIRMED` de la final — acopla la encuesta al pipeline de resultados (riesgo si la final requiere override) y no permite control fino. La env var es reversible, controlable y de riesgo cero.

---

## 4. Diseño técnico

### Backend
- **Modelo `SurveyResponse`** (migración aditiva, columnas tipadas para análisis SQL):
  `id`, `userId @unique`, `isHost Bool`, `overallScore Int (1-10)`, `npsScore Int (0-10)`, `comment String?`, `hostEaseScore Int? (1-5)`, `hostResultsScore Int?`, `hostPlayersScore Int?`, `wouldHostAgain String? (YES|MAYBE|NO)`, `hostComment String?`, `locale String?`, `createdAtUtc`, `updatedAtUtc`.
- **`GET /survey/status`** (auth): `{ open, opensAtUtc, alreadySubmitted, isHost }`. `open` = ventana + allowlist. `isHost` = EXISTS con roles admin de pool.
- **`POST /survey`** (auth + rate-limit + Zod): guarda los 2 scores + `isHost` snapshot. Primera escritura crea; los scores **no se editan** después (integridad del dato).
- **`POST /survey/details`** (auth + Zod): añade comment / bloque host a la fila propia (solo dentro de la ventana). Idempotente.
- **`GET /admin/survey/summary`** (requireAdmin): n, promedio general, **NPS calculado** (%promotores − %detractores), split host vs jugador, distribución de "volverías a hostear", últimos 20 comentarios. JSON (sin UI en v1).
- **Flags** en `featureFlags.ts`: `isSurveyOpenFor(email)` reutilizando `emailInAllowlist` + ventana temporal.
- **Sin emails por respuesta** (serían miles); el resumen admin es la vía de lectura.
- Tests: ventana/allowlist, Zod fuera de rango, unicidad por usuario, cálculo isHost, idempotencia de details.

### Frontend
- **`PostWorldCupSurveyModal.tsx`** (nuevo, calcado del esqueleto WhatsNew): overlay bloqueante z-300, dismissible siempre (✕ 44px), body scrolleable, footer fijo; estados pantalla-1 → pantalla-2 → gracias; variante host por `isHost` del status.
- **`lib/api/survey.ts`**: `getSurveyStatus`, `submitSurvey`, `submitSurveyDetails`.
- **Montaje:** 1 línea en `AuthenticatedLayoutClient` (no toca `WhatsNewModal` — que además ya expiró el 24-jun, sin riesgo de colisión).
- **i18n:** bloque `survey.*` completo en es/en/pt (`common.json`).
- Botones de escala con `TOUCH_TARGET.minimum`; sin overflow en 360px.

### Qué NO se toca
Ningún flujo existente: ni resultados, ni emails, ni leaderboard, ni WhatsNew, ni feedback actual. Deploy con allowlist vacía = **totalmente inerte**.

---

## 5. Rollout (staged, como siempre)

1. Deploy con `SURVEY_ALLOWLIST=""` → invisible para todos.
2. `SURVEY_ALLOWLIST=juan.k.chacon9729@gmail.com` + `SURVEY_OPENS_AT` en el pasado → **solo tú lo ves** (verás la variante Host porque hosteas; la variante Jugador se revisa con una cuenta de prueba — existe `seed:test-accounts`).
3. Apruebas visual/copy → `SURVEY_ALLOWLIST=*` + `SURVEY_OPENS_AT` real (fin de la final + 1 min) + `SURVEY_CLOSES_AT` (+2 semanas).
4. Kill-switch: volver a `""` lo apaga al instante.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper algo existente | Solo 1 línea en código compartido (mount); resto archivos nuevos; migración aditiva; flag off por defecto |
| Modal que atrapa (historial de dispositivos con storage bloqueado) | Patrón robusto ya probado: cerrar SIEMPRE funciona (estado primero, localStorage en try/catch); footer fijo |
| Fatiga/molestia | Máx 3 apariciones, snooze 24h, 2 preguntas obligatorias nada más |
| Doble respuesta / spam | `userId @unique` + rate limit + Zod |
| Perder scores si abandonan la expansión | Scores se persisten en el primer Enviar |
| Choque con WhatsNewModal | WhatsNew expiró 2026-06-24; igualmente son componentes independientes |

## 7. Preguntas abiertas (necesito tu decisión)

1. **¿CO_ADMIN cuenta como Host?** Propongo **sí** (gestionan pools). Alternativa: solo HOST/CORPORATE_HOST.
2. **Política de cierre:** snooze 24h + máx 3 apariciones — ¿de acuerdo, u otra?
3. **Ventana:** cierre a las 2 semanas — ¿ok?
4. **Resumen admin JSON en v1** — ¿lo incluyo, o solo DB y lo lees por SQL?
5. **Copy exacto** de títulos/preguntas: el de §2 es mi propuesta — ¿ajustas algo?

## 8. Archivos a tocar

**Backend:** `prisma/schema.prisma` + migración nueva · `lib/featureFlags.ts` (añadir gate) · `routes/survey.ts` (nuevo) · `server.ts` (montar router) · `routes/admin.ts` (summary) · tests nuevos · `docs/DECISION_LOG.md` (ADR) · `docs/guides/DEPLOYMENT.md` (3 env vars).
**Frontend:** `components/PostWorldCupSurveyModal.tsx` (nuevo) · `lib/api/survey.ts` (nuevo) · `AuthenticatedLayoutClient.tsx` (+1 línea) · `messages/{es,en,pt}/common.json`.
