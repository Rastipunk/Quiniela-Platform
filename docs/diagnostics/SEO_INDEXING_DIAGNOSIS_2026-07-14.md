# Diagnóstico de indexación SEO — Picks4All

> **Fecha:** 2026-07-14 · **Tipo:** Diagnóstico de solo lectura — **cero cambios aplicados**
> **Síntoma reportado:** Google Search Console muestra **1 sola página indexada** pese a múltiples intentos de mejora.
> **Método:** verificación en producción en vivo (lo que un crawler realmente recibe) cruzada contra el código de `main`, con re-verificación de toda anomalía. Ninguna afirmación de este documento es una suposición; cada una tiene la evidencia citada.

---

## 1. Resumen ejecutivo

**La superficie técnica de indexación está, HOY, esencialmente sana.** Las 56 URLs públicas (sitemap + todos los alternates de idioma) responden 200 con canonical autorreferencial correcto, sin `noindex`, con contenido SSR completo, hreflang consistente (vía header HTTP `Link` + sitemap) y tiempos de respuesta de ~0.3 s. No existe hoy ningún bloqueador clásico (robots, noindex, canonical colapsado, redirects para bots, cloaking, soft-404).

**La causa más probable del estado actual es histórica, no presente:** el dominio sufrió **dos incidentes consecutivos de crawl-health documentados** —(a) el deindex de abril por `Set-Cookie`/`no-store` en todas las páginas públicas y (b) el colapso de rendimiento de junio (respuestas de 2–55 s durante ~2 semanas en pleno Mundial)— que desplomaron la confianza/frecuencia de rastreo de Google. La plataforma solo lleva **estable y rápida desde el 23 de junio** (~3 semanas). La recuperación de indexación tras incidentes así se mide en semanas-meses de estabilidad continua, lo que explica el patrón "muchos cambios sin resultado visible": cada intento de recuperación coincidió con (o fue seguido por) un nuevo incidente.

**Además hay una discrepancia que debe resolverse en GSC:** una búsqueda externa `site:picks4all.com` devuelve **al menos 5 páginas indexadas** (4 de ellas EN), lo que contradice "1 indexada". O el property/reporte de GSC que se está mirando no es el correcto, o el índice difiere del que reporta la herramienta de búsqueda usada (motor no garantizado). La sección 6 trae el checklist exacto para resolverlo.

---

## 2. Qué se verificó y resultó SANO (evidencia en vivo)

| # | Verificación | Resultado | Evidencia |
|---|---|---|---|
| 1 | `robots.txt` | ✅ Permite todo lo público, bloquea solo privado (`/dashboard/`, `/pools/`, `/admin/`, `/profile/`, `/pago/`, `/invite`), declara sitemap | Fetch en vivo, 200 `text/plain` |
| 2 | `sitemap.xml` | ✅ 200 `application/xml`, 22 `<url>` + 51 alternates `xhtml:link` es/en/pt | Fetch en vivo |
| 3 | **Sweep de 56 URLs** (todas las `<loc>` + todos los alternates) | ✅ **Todas 200, canonical autorreferencial, cero `noindex`** | Script de barrido; la única "anomalía" (`/en/how-it-works` sin canonical) se re-verificó **4 veces** y el canonical está presente y estable → artefacto transitorio del fetch, no defecto |
| 4 | Estabilidad de la home ante crawlers | ✅ 200 con bytes idénticos para: sin headers, `Accept-Language` es/en/pt, Googlebot UA, Googlebot+AL — **sin redirects, sin cloaking** | Matriz de 6 requests |
| 5 | Redirects de locale para bots | ✅ Los redirects por cookie/Accept-Language del `proxy.ts` aplican SOLO a rutas de app (`/dashboard`, `/login`…), **nunca a páginas públicas SEO**; bots sin cookie no son redirigidos | Código `proxy.ts` (COOKIE_REDIRECT_PREFIXES + `inScope`) + matriz en vivo |
| 6 | `Set-Cookie` en páginas públicas (el asesino de abril) | ✅ **Ausente** — headers verificados en `/`, `/faq`, `/mundial-2026`, `/en/world-cup-2026` | Headers en vivo |
| 7 | hreflang | ✅ Presente vía **header HTTP `Link`** en cada página (es/en/pt + `x-default`) y vía sitemap; en páginas regionales single-locale el proxy filtra correctamente los alternates inexistentes (verificado en vivo: `/polla-futbolera` → solo `es` + `x-default`) | Headers en vivo + `proxy.ts` |
| 8 | Meta robots | ✅ Ausente en públicas (= index,follow); `/login` correctamente `noindex, nofollow` (y deliberadamente NO bloqueado en robots.txt para que el noindex sea legible — decisión documentada en `robots.ts`) | HTML en vivo |
| 9 | Dominio canónico | ✅ `www` → 301 no-www; `http` → 301 `https`; trailing slash → 308 | Curl en vivo |
| 10 | 404 reales | ✅ URL inexistente → HTTP 404 (no soft-404) | Curl en vivo |
| 11 | SSR / contenido renderizado | ✅ HTML de 298–389 KB con contenido real, 1×`<h1>`, JSON-LD, `<html lang>` correcto por locale, títulos únicos y localizados | Extracción de head en 10 páginas |
| 12 | Velocidad HOY para Googlebot | ✅ TTFB ~0.31–0.37 s en `/`, `/faq`, `/mundial-2026` | Curl con UA Googlebot |
| 13 | `SITE_URL` efectivo | ✅ Canonicals y sitemap generan `https://picks4all.com` (valor correcto en producción) | HTML/sitemap en vivo |

---

## 3. Hallazgos (ordenados por probabilidad de impacto)

### F1 — Historial de crawl-health: dos incidentes consecutivos (causa raíz más probable)

Cronología reconstruida de fuentes internas (comentarios en código, ADRs) y mediciones de esta misma sesión:

| Fecha | Evento | Fuente |
|---|---|---|
| ~15 abr 2026 | **Deindex**: la cookie `pool-region` se escribía en **cada** respuesta → Next degradaba todas las públicas a `Cache-Control: private, no-cache, no-store` → GSC: **"40+ URLs en Crawled – currently not indexed"** | Comentario en `proxy.ts` (Step 2) y en `sitemap.ts` ("post-Apr-15 deindex period") |
| 8 may 2026 | Fix desplegado (detección de región movida a cliente; sin Set-Cookie; links internos alineados al canonical) + bump de `lastModified` del sitemap | `sitemap.ts` |
| ~11–23 jun 2026 | **Colapso de rendimiento** en pleno arranque del Mundial: `GET /pools/:id/overview` (43 % del tráfico) tardaba 2–55 s y bloqueaba el event loop → toda la plataforma lenta, logins fallando. Googlebot rastreando en ESA ventana recibió las mismas latencias | Medido en esta sesión (logs HTTP del proxy de Railway); corregido en ADR-078 (23 jun) y ADR-079 (23 jun) |
| 23 jun → hoy | Plataforma rápida y estable (overview p50 46 ms, máx <220 ms; 0 5xx) | Medido post-fix |

**Interpretación (mecanismo conocido de Google, aplicado a hechos verificados):** señales tipo `no-store` masivo hacen que Google despriorice la indexación; latencias de decenas de segundos hacen que reduzca drásticamente la frecuencia de rastreo. Dos golpes seguidos, con la ventana de recuperación de mayo pisada por el incidente de junio, dejan el *crawl demand* del dominio en mínimos. A hoy solo hay ~3 semanas de señales limpias continuas — poco tiempo para que se refleje en GSC.

### F2 — Discrepancia "1 página indexada" vs búsqueda externa (verificar en GSC)

`site:picks4all.com` en búsqueda externa devuelve **≥5 resultados**: `/en`, `/en/world-cup-2026`, `/en/world-cup-2026/predictions`, `/en/world-cup-2026/groups`, `/que-es-una-quiniela`. (Advertencia de rigor: la herramienta de búsqueda usada no garantiza que el motor sea Google; trátese como señal, no como prueba.) Si Google realmente tiene ≥5 páginas, el "1 indexada" de GSC podría ser un problema de **property** (p. ej. property URL-prefix de `www` o `http`, que tras los 301 mostraría casi nada) o de lectura del reporte. Sección 6 = cómo confirmarlo en 10 minutos.

Dato curioso a vigilar: 4 de 5 resultados son EN pese a que el sitio es ES-first — consistente con F3.

### F3 — Descubrimiento débil de las versiones EN/PT (debilidad real, no bloqueador)

- El HTML de la home contiene **17 enlaces internos**, de los cuales **solo 1 apunta a una URL con prefijo de idioma** (`/en/football-pool`, en el footer). No existe ningún `<a>` crawleable hacia `/en` ni `/pt` (el selector de idioma es JS puro).
- El sitemap enumera como `<loc>` **21 URLs ES + 1 EN y 0 PT**; las versiones EN/PT existen solo como `xhtml:link` alternates.
- Consecuencia: EN/PT dependen exclusivamente del header `Link` y de los alternates del sitemap para ser descubiertas; sin PageRank interno fluyendo hacia ellas.

### F4 — Menores / higiene (ninguno explica por sí solo el síntoma)

1. **`lastModified` del sitemap congelado en 2026-05-08** (dos meses) mientras se declara `changeFrequency: weekly` — señal de frescura contradictoria; además la nota del propio archivo dice que se bumpea "vía redeploy", y no se ha vuelto a bumpear tras los fixes de junio.
2. **`Cache-Control: s-maxage=31536000`** en el HTML de páginas públicas (default SSG de Next). Sin CDN intermedio es mayormente inerte, pero es una señal de "no cambia en un año" que los crawlers modernos pueden usar como hint de recrawl.
3. **`/es/*` → 307** (temporal) hacia la versión sin prefijo (comportamiento de next-intl). Google lo maneja, pero 308/301 sería la señal permanente correcta.
4. **hreflang no está en el `<head>` HTML** (solo header HTTP + sitemap). Válido para Google (un método basta), pero: (a) el estándar interno de CLAUDE.md exige hreflang por página — se cumple solo vía header; (b) `x-default` está en el header pero **no** en el sitemap (consistencia menor).
5. **Observabilidad:** los logs HTTP del servicio Frontend-Next en Railway devuelven **0 líneas** (ni siquiera tráfico humano) — no hay visibilidad server-side de qué recibe Googlebot. La única fuente disponible es GSC → Crawl Stats.

---

## 4. Qué se DESCARTÓ explícitamente (con evidencia)

- ❌ Bloqueo por robots.txt — permite todo lo público.
- ❌ `noindex` accidental — barrido de 56 URLs sin un solo caso (y `/login` lo tiene a propósito).
- ❌ Canonical colapsado hacia la home (bug clásico de Next.js con `alternates` en layout) — todos los canonicals son autorreferenciales; el helper centralizado `buildPageMetadata` (`lib/seo.ts`) los construye por página.
- ❌ Redirects/cloaking para Googlebot — bytes idénticos con y sin UA de bot, con y sin Accept-Language.
- ❌ Cookie-wall / Set-Cookie en públicas — eliminado desde mayo; verificado ausente hoy.
- ❌ Páginas vacías client-side — SSR completo con H1 y contenido.
- ❌ Soft-404 — 404 reales.
- ❌ hreflang roto en páginas regionales single-locale — el filtro del proxy funciona (verificado en vivo).
- ❌ Lentitud actual — TTFB ~0.3 s hoy (el problema de junio quedó corregido el 23-jun, ADR-078/079).

---

## 5. Conclusión

No hay, a fecha de hoy, ningún defecto técnico activo que explique "1 página indexada". La explicación con mayor soporte factual es la **deuda de reputación de rastreo** acumulada por los incidentes de abril y junio (F1), agravada por el **descubrimiento débil de EN/PT** (F3) y con una **duda abierta sobre el property/reporte de GSC** (F2) que puede estar exagerando el síntoma. La recomendación central es: **resolver F2 en GSC, no tocar nada estructural, mantener la estabilidad actual y dar 2–4 semanas más de señales limpias**, aplicando solo las mejoras menores de la sección 7 cuando se decida intervenir.

---

## 6. Checklist para resolver en GSC (10 minutos, sin cambios en el sitio)

1. **Property**: confirmar cuál está abierto. Ideal: *Domain property* `picks4all.com`. Si es URL-prefix `https://www.picks4all.com/` o `http://…`, el conteo de indexadas será ~0-1 **por diseño** (todo 301-redirige fuera de ese prefijo) → ese sería el misterio resuelto.
2. **Indexación de páginas** (Pages): anotar el conteo por bucket — `Crawled – currently not indexed`, `Discovered – currently not indexed`, `Duplicate without user-selected canonical`, `Page with redirect`, `Not found (404)`. Cada bucket implica una causa distinta; este dato decide el siguiente paso.
3. **Inspección de URL** en 4 URLs: `/`, `/mundial-2026`, `/en/world-cup-2026`, `/que-es-una-quiniela` → mirar *Last crawl* (¿posterior al 23-jun?), veredicto, y *Google-selected canonical* (¿coincide con el declarado?).
4. **Ajustes → Estadísticas de rastreo (Crawl Stats)**: gráfico de solicitudes/día y de tiempo medio de respuesta, abril→julio. Debe verse el cráter de junio y si la curva ya se recupera. Este gráfico confirma o refuta F1 con datos de Google.
5. **Sitemaps**: fecha de "última lectura" y "páginas descubiertas" del sitemap enviado.
6. **Acciones manuales** y **Problemas de seguridad**: confirmar vacíos (descarta penalización).

## 7. Mejoras recomendadas (NO aplicadas — requieren aprobación; ninguna es urgente)

Ordenadas por relación beneficio/riesgo, todas de bajo riesgo pero **ninguna se hizo** en este diagnóstico:

1. Enumerar las versiones EN/PT como `<url>` propias en el sitemap (hoy: 21 ES + 1 EN).
2. Enlaces `<a>` crawleables a los 3 idiomas en el footer de cada página pública (hoy el selector es JS-only).
3. Bumpear `lastModified` del sitemap (está en 2026-05-08) y mantenerlo honesto en adelante.
4. Añadir hreflang también al `<head>` HTML vía `alternates.languages` del metadata API (hoy solo header+sitemap) y añadir `x-default` al sitemap.
5. Cambiar los redirects `/es/*` de 307 → 308.
6. Revisar el `s-maxage=31536000` del HTML público (bajar a horas/días).
7. Tras 2–4 semanas de estabilidad: *Request indexing* manual de las ~10 URLs clave desde GSC.

> ⚠️ Cualquier cambio de los anteriores debe hacerse de a uno, con verificación en vivo posterior (este dominio ya sufrió regresiones de i18n/cookies por cambios de SEO). Este documento no modificó ni una línea de código, configuración ni variable de entorno.

---

## Apéndice — Inventario de evidencia

- Matriz home × (AL es/en/pt, Googlebot, sin headers): 6/6 → 200, 332 856 bytes idénticos, sin redirect.
- Headers verificados: `link` (hreflang+x-default), `vary` (solo RSC/Accept-Encoding), sin `x-robots-tag`, sin `set-cookie`, `cache-control: s-maxage=31536000`, `x-middleware-rewrite` presente (inofensivo).
- Sweep: 56/56 URLs → 200 + canonical self + sin noindex (1 falso positivo transitorio, re-verificado ×4).
- `site:picks4all.com` (motor externo): `/en`, `/en/world-cup-2026`, `/en/world-cup-2026/predictions`, `/en/world-cup-2026/groups`, `/que-es-una-quiniela`.
- Código auditado: `i18n/routing.ts` (localeDetection:false, localeCookie:false), `proxy.ts` completo (303 líneas), `app/robots.ts`, `app/sitemap.ts`, `lib/seo.ts` (buildPageMetadata), `lib/siteConfig.ts`.
- Historia interna: comentarios en `proxy.ts`/`sitemap.ts`/`routing.ts`, ADR-064, `docs/archive/LOCALE_RESOLUTION_AUDIT.md`.
