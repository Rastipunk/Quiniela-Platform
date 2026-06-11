# Incidente rate-limit 2026-06-10/11 — registro de hallazgos

> **Estado:** DIAGNÓSTICO CERRADO 2026-06-11 ~04:45Z — causa raíz probada
> empíricamente (§5). Plan de acción en §8, pendiente de "go" del owner.
> Regla de la investigación (owner): cero suposiciones — cada afirmación
> tiene fuente verificable.

## 0. CAUSA RAÍZ (probada)

`req.ip` NO es la IP del cliente: es la IP del **nodo edge de Railway**
(red DataCamp/CDN77). `server.ts:51` configura `trust proxy = 1`, pero la
cadena real de proxies tiene **2 saltos** — verificado inyectando una
petición propia y leyendo el log del backend:

```
x-forwarded-for = 179.33.235.90, 89.222.103.194
                  ↑ IP real del cliente   ↑ edge Railway (CDNEXT-ATL)
```

Con `trust proxy = 1` Express toma la entrada DERECHA → todos los usuarios
ruteados por un mismo nodo edge comparten UN solo bucket de rate-limit.
Producción lo confirma a escala: **37 IPs distintas para 1,950 usuarios**
en 24h de `AuditEvent` (la IP top tiene 967 usuarios). El límite de
auth (10/15min default) y el de pool-join (10/15min, NUNCA subido) eran
en la práctica límites GLOBALES por nodo para toda la plataforma.

---

## 1. El problema reportado

- Feedback de `gqcasa@gmail.com` el **2026-06-11T02:55Z (21:55 hora Colombia)**:
  "No puedo unirme a mi grupo, intenté con el link y con código y me dice
  que realicé muchos intentos".
- Screenshots adjuntos/relacionados (horas de status bar distintas — 11:09 y
  8:01 — los pantallazos **abarcan varios momentos del día**, no se puede
  asumir que todos son post-mitigación):
  1. Formulario de **registro** (usuario nuevo `angomez-connser`, teléfono en
     **4G con VPN activa**): error `TOO_MANY_LOGIN_ATTEMPTS`.
  2. Formulario de **login** (`caterineochoarodriguez@yahoo.com`):
     `TOO_MANY_LOGIN_ATTEMPTS`.
  3. Página `/invite?code=…`: "Invitación no encontrada".
  4. "Mis Pools" (móvil, 8:01): `RATE_LIMIT_EXCEEDED`.
- Contexto: en la mañana del 06-10 hubo un incidente igual atribuido a "IP
  corporativa" y se mitigó **subiendo límites vía variables de entorno en
  Railway** (sin commit). En la noche volvió a ocurrir.

## 2. Hechos confirmados (con fuente)

| # | Hecho | Fuente |
|---|---|---|
| F1 | `app.set("trust proxy", 1)` — Express confía en exactamente 1 salto de proxy para `req.ip` | `backend/src/server.ts:51` |
| F2 | El tráfico del API **NO pasa por el proxy de Cloudflare**: `api.picks4all.com` → CNAME `a1q8fzl4.up.railway.app` → `69.46.46.16` (no es rango anycast CF); headers de respuesta: `Server: railway-hikari`, `x-railway-edge`, **sin** `cf-ray`. `picks4all.com` → `69.46.46.51`, tampoco CF | `nslookup` + `GET https://api.picks4all.com/health` 2026-06-11 04:07Z |
| F2b | **Efecto colateral de F2 a verificar aparte:** el código lee `cf-ipcountry` / `cf-connecting-ip` (routing de pagos CO→MercadoPago y país de perfil). Sin proxy CF esos headers no llegan | `backend/src/routes/payments.ts:112,176,181`, `userProfile.ts:227` |
| F3 | Mapeo mensaje→limiter→endpoint→default: `TOO_MANY_LOGIN_ATTEMPTS` = `authLimiter` en `/auth/login` y `/auth/register` (default **10 req / 15 min por IP**, env `RATE_LIMIT_AUTH_MAX`/`RATE_LIMIT_AUTH_WINDOW_MS`); `RATE_LIMIT_EXCEEDED` = `apiLimiter` global (default **100 req/min por IP**, env `RATE_LIMIT_API_MAX`); `TOO_MANY_JOIN_ATTEMPTS` = `poolJoinLimiter` en `POST /pools/join` (default **10 / 15 min por IP**, env `RATE_LIMIT_POOL_JOIN_MAX`) | `middleware/rateLimit.ts:30-78`, `server.ts:86,260-261`, `routes/poolInvites.ts:244` |
| F4 | Los screenshots 1-2 (registro/login) corresponden a `authLimiter`; el 4 (Mis Pools) a `apiLimiter`. El reporte "ni link ni código" es consistente con `poolJoinLimiter` y/o `authLimiter` | F3 + screenshots |
| F5 | Un usuario **nuevo** bloqueado en el registro ⇒ su bucket de `authLimiter` fue agotado por **otros** ⇒ el bucket se comparte (mecanismo de compartición: por determinar — NAT/CGNAT/VPN reales o keying defectuoso) | Screenshot 1 + F3 |
| F6 | **La mitigación de la mañana no dejó rastro en el repo**: no existe ningún commit entre `9481d63` (16:04) y `4ce673d` (18:51); la subida de límites fue solo env en Railway (`RATE_LIMIT_API_MAX` 100→2000 y "AUTH/INVITE raised earlier today", según el mensaje de `bc85a22`). Qué variables exactas, con qué valores, en qué servicio y si el servicio redesplegó: **no verificable desde el repo** | `git log` + mensaje de `bc85a22` |
| F7 | `bc85a22` (20:51 local) **no cambió ningún límite**: es fix de UX del frontend — distingue 429/5xx de "código inválido" y agrega botón reintentar en `/invite`. No previene ningún 429 | `git show bc85a22` |
| F8 | La página `/invite` es `"use client"`: el fetch a `/invite-preview/:code` sale del **navegador del usuario** (no del servidor Next) ⇒ no hay proxy intermedio que unifique IPs en esa ruta. Ídem todas las llamadas del cliente (`NEXT_PUBLIC_API_URL` directo) | `frontend-next/src/app/[locale]/invite/page.tsx:1,80`, `lib/api/client.ts:5-14` |
| F9 | `express-rate-limit ^8.2.1`, store **en memoria** (contadores por réplica; con >1 réplica los límites serían MÁS laxos, no más estrictos) | `backend/package.json` |
| F10 | `POST /pools/join` está **autenticado** (`req.auth!.userId` disponible) pero `poolJoinLimiter` se keyea por IP — userId disponible y no usado | `routes/poolInvites.ts` |
| F11 | El feedback llegó a las 02:55Z, ~1h después del deploy de `bc85a22` (push 01:51Z + build). El problema persiste **después** de la mitigación de la mañana y del fix de UX | timestamps git + email |

## 3. Hipótesis abiertas (NO confirmadas — no actuar aún)

- **H1 — La mitigación env no quedó aplicada** (nombre de variable con typo,
  servicio equivocado, faltó redeploy, o no cubrió `RATE_LIMIT_AUTH_MAX` /
  `RATE_LIMIT_POOL_JOIN_MAX`). Verificable con el dashboard/CLI de Railway.
- **H2 — Keying roto**: con `trust proxy = 1` (F1), si la cadena real de
  proxies tuviera ≠1 salto, `req.ip` sería una IP intermedia compartida por
  muchos/todos los usuarios. F2 sugiere 1 salto (solo Railway), pero la
  prueba definitiva es la distribución de `AuditEvent.ip` en producción.
- **H3 — Agrupación IPv6 /56**: `express-rate-limit` v8 agrupa por defecto
  los clientes IPv6 en subredes /56 (`ipv6Subnet: 56`); los carriers
  móviles colombianos son IPv6-first y una /56 puede abarcar cientos de
  abonados. Verificable: proporción de IPv6 en `AuditEvent.ip` + si usuarios
  distintos comparten /56. (Pendiente además confirmar el default exacto de
  la versión instalada contra su doc.)
- **H4 — IPs compartidas reales** (CGNAT móvil, NAT corporativo, VPN — el
  screenshot 1 muestra VPN activa): incluso con keying perfecto,
  `authLimiter` default 10/15min es incompatible con cualquier población
  detrás de una IP compartida. Verificable: cuántos usuarios distintos por
  IP en `AuditEvent`.
- Las hipótesis no son excluyentes; pueden coexistir (p. ej. H1 + H4).

## 4. Evidencia recolectada (P1-P3 resueltas el 2026-06-11 04:20-04:45Z)

- **E1 — BD producción, `AuditEvent.ip` (24h):** 37 IPs distintas / 1,950
  usuarios / 31,562 eventos. Top: `89.222.103.193` (967 usuarios),
  `89.222.103.194` (946), en pares `.193/.194`, `.65/.66`, `.1/.2` —
  topología de nodos edge. **req.ip ≠ IP del cliente, demostrado a escala.**
- **E2 — RDAP:** `89.222.103.193` → `CDNEXT-ATL` (DATACAMP-MNT),
  `152.233.43.33` → `CDN77-WAR`, `84.17.44.225` → `CDN77_LAX`. DataCamp/
  CDN77 = proveedor de red del edge de Railway (coincide con el header
  `x-hikari-trace: atl1` observado en F2).
- **E3 — Test de inyección (prueba definitiva):** petición propia a
  `GET /payments/country` desde IP `179.33.235.90`; el backend loggeó
  `x-forwarded-for=179.33.235.90, 89.222.103.194` → cadena de 2 saltos;
  con `trust proxy=1` Express resuelve `req.ip = 89.222.103.194` (edge).
- **E4 — Variables reales en Railway (servicio Backend):**
  `RATE_LIMIT_API_MAX=2000`, `RATE_LIMIT_AUTH_MAX=2000`,
  `RATE_LIMIT_INVITE_CHECK_MAX=2000`, `RATE_LIMIT_INVITE_ACTIVATE_MAX=5000`.
  **`RATE_LIMIT_POOL_JOIN_MAX` NO EXISTE** → pool-join sigue en 10/15min
  por nodo edge para toda la plataforma. `RATE_LIMIT_AUTH_WINDOW_MS`
  tampoco existe (ventana 15min default).
- **E5 — Monitor de salud (`PlatformHealthAlert`):** `rate_limit_hits`
  WARN 82, 55 y 114 respuestas 429/60s a las 00:55, 01:00 y 01:20-01:25Z
  del 06-11 (19:55-20:25 hora CO) — la noche del reporte del usuario.
- **E6 — Colateral confirmado (issue separado):** `cf-ipcountry` llega
  `undefined` (sin proxy CF) → `GET /payments/country` devolvió `US` para
  una IP colombiana real. El routing de pasarela CO→MercadoPago basado en
  ese header debe revisarse aparte.

## 5. Evaluación de los arreglos previos (factual)

1. **Mitigación de la mañana (env-only):** atacó el síntoma (tamaño del
   bucket), no el mecanismo de compartición del bucket. Sin rastro
   verificable de qué se aplicó (F6). Si no cubrió `AUTH`/`POOL_JOIN`, los
   screenshots de la noche son exactamente lo esperado.
2. **`bc85a22`:** honestidad de UX en `/invite` (correcto y necesario), pero
   por diseño no reduce ningún 429 (F7).
3. **El diagnóstico "IP corporativa" de la mañana queda incompleto como
   explicación general:** los afectados de la noche son usuarios en 4G/VPN
   y hogareños (F5, screenshots), no oficinas. El patrón común demostrable
   es "bucket por IP compartido", cuyo mecanismo exacto está pendiente de
   P1-P3.

## 6. Resolución de hipótesis

| Hipótesis | Veredicto | Evidencia |
|---|---|---|
| H1 — env no aplicada | **Parcial**: AUTH/API/INVITE sí se aplicaron (2000-5000); **`POOL_JOIN` nunca se configuró** (10/15min default) | E4 |
| H2 — keying roto (trust proxy) | **CONFIRMADA — causa raíz.** Cadena real de 2 saltos, `trust proxy=1` resuelve req.ip = nodo edge | E1, E2, E3 |
| H3 — agrupación IPv6 /56 | Irrelevante HOY (req.ip nunca es IPv6 del cliente); **pasa a ser relevante después del fix** — incluir `ipv6Subnet: 64` | E1 |
| H4 — IPs compartidas reales (CGNAT/NAT/VPN) | Sigue siendo real como condición de fondo POST-fix: los límites por IP deben dimensionarse para CGNAT | screenshots + naturaleza del tráfico CO |

**Por qué "se volvió a dañar" tras la mitigación de la mañana:** subir
límites agrandó buckets que seguían siendo COMPARTIDOS por nodo edge.
`AUTH_MAX=2000/15min` por nodo aguantó hasta que el tráfico de víspera del
Mundial lo superó, y `POOL_JOIN` (10/15min por nodo, nunca subido) bloqueaba
los "unirme con link/código" de toda la plataforma con solo 10 joins cada
15 minutos por nodo — exactamente lo que reportó `gqcasa@gmail.com`.

## 7. Bitácora

- 2026-06-11 ~04:00-04:20Z — F1-F11 verificados (código local, git, DNS,
  headers HTTP). Probe de BD falló por credencial inválida. Railway CLI sin
  sesión. Se solicita P1-P3 al owner.
- 2026-06-11 ~04:25Z — Owner autoriza: `railway login` interactivo OK;
  `DATABASE_URL` tomada de `backend/.env.production.local` (sin exponerla).
- 2026-06-11 ~04:30-04:45Z — E1-E6 recolectadas. H2 confirmada como causa
  raíz vía test de inyección (E3). Diagnóstico cerrado.

## 8. Plan de acción (pendiente de "go")

### Fase 0 — Mitigación inmediata (solo env, sin deploy de código, ~2 min)
1. `RATE_LIMIT_POOL_JOIN_MAX=5000` en Backend — desbloquea YA los joins
   (la queja activa), mientras llega el fix real. Railway redespliega solo.

### Fase 1 — Fix de causa raíz (código, 1 línea + retuning)
2. `app.set("trust proxy", 2)` en `server.ts:51` — con la cadena
   [cliente, edge] verificada en E3, Express pasa a resolver
   `req.ip = IP real del cliente`. Nota anti-spoofing: la entrada confiable
   es la que APPENDEA el edge (2ª desde la derecha); un XFF falsificado por
   el cliente queda más a la izquierda y no se alcanza — `2` es seguro.
3. `ipv6Subnet: 64` explícito en los limiters (v8 defaultea /56; con IPs
   reales de clientes, los carriers CO IPv6-first agruparían vecinos).
4. **Re-tunear los límites a escala por-cliente** (los valores de E4
   quedaron calibrados para buckets por-nodo y son brute-force-friendly
   con IPs reales): AUTH de vuelta a un valor sano pero CGNAT-aware
   (propuesta: 30/15min), POOL_JOIN explícito (propuesta: 30/15min),
   API_MAX por cliente (propuesta: 300/min). Todo vía env, reversible.
5. Verificación post-deploy (mismo método que el diagnóstico):
   repetir el test de inyección y confirmar en `AuditEvent` que las filas
   nuevas registran IPs de cliente diversas; vigilar `rate_limit_hits`.

### Fase 2 — Endurecimiento estructural (commit aparte)
6. `poolJoinLimiter` keyed por `userId` (el endpoint es autenticado — F10);
   `apiLimiter` por userId cuando hay sesión, IP solo para anónimos;
   authLimiter por combinación email+IP (anti-brute-force sin castigo
   colectivo). Patrón ya existente en el repo: `inviteSendLimiter`.
7. Issue separado (no mezclar): detección de país de pagos devuelve `US`
   sin Cloudflare (E6) — auditar el flujo real CO→MercadoPago.
8. Forense: `AuditEvent.ip` histórico está contaminado con IPs de edge
   (toda ventana previa al fix) — anotarlo para cualquier análisis futuro.
