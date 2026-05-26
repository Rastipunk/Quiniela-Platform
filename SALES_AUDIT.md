# Sales Management — Code-Verified Audit

> **Status:** awaiting plan approval (no code yet).
> **Started:** 2026-05-22
> **Trigger:** the admin wants a "Gestión de Ventas" tab to issue **Cotizaciones** (quotes) and **Cuentas de cobro** (formal billing documents for non-tax-invoice-obligated issuers, Colombia) from the platform itself, without leaving the app.
> **Companion doc:** `SALES_IMPLEMENTATION.md` (step-by-step tracker — written after this audit is approved).
> **Method:** every claim cites file:line, verified by reading source or querying production. Decisions made by the user in chat are surfaced in §11. Anything still uncertain is flagged at the end.

---

## 0 — Corrections from earlier in the conversation

I made one assumption in this thread that I retract here so it doesn't propagate into the plan:

- **"Wompi sí soporta payment links con monto custom — más viable para Colombia"** — RETRACTED. Verified against [CHANGELOG.md:206](CHANGELOG.md#L206) which states *"Wompi dead code — Unused payment service client removed"*. Wompi is **not** part of the current architecture. Active gateways: Mercado Pago (Colombia / COP) and Polar.sh (international / USD). All claims in this document are grounded only in those two.

`MEMORY.md` still references Wompi credentials — those notes are historical and stale. I will update memory as part of this work's last commit.

---

## 1 — Current state of the admin panel (verified)

**Backend guard**: [backend/src/middleware/requireAdmin.ts:5](backend/src/middleware/requireAdmin.ts#L5) — `req.auth.platformRole === "ADMIN"`. Confirmed working: `juan.k.chacon9729@gmail.com` carries `ADMIN`.

**Frontend gate**: [components/NavBar.tsx:443](frontend-next/src/components/NavBar.tsx#L443) and [NavBar.tsx:827](frontend-next/src/components/NavBar.tsx#L827) — both desktop and mobile menus check `profile?.platformRole === "ADMIN"` before rendering admin entries.

**Existing admin routes** (under `frontend-next/src/app/[locale]/(authenticated)/admin/`):
- `/admin/settings/email` — email settings
- `/admin/feedback` — feedback inbox
- `/admin/analytics` — analytics dashboard
- `/admin/analytics-health` — analytics-pipeline health

No `layout.tsx` shared across admin routes; each is independent. New entries fit naturally as siblings.

---

## 2 — Current state of the payment flow (verified)

The two checkout-initiation functions are the integration points the CC redemption logic must hook into. Both live in [paymentService.ts](backend/src/services/paymentService.ts).

**`InitiateCheckoutInput`** ([paymentService.ts:89-103](backend/src/services/paymentService.ts#L89)):

```ts
export interface InitiateCheckoutInput {
  userId: string;
  poolId: string;
  targetCapacity: number;
  locale?: string;
  metaFbp?: string;
  metaFbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}
```

The **amount is NOT in the input**. It is computed server-side at [paymentService.ts:180](backend/src/services/paymentService.ts#L180):

```ts
const amountUsd = calculateUpgradePrice(poolType, currentCapacity, targetCapacity);
```

This means the customer cannot manipulate price client-side. Same pattern in `initiateMpCheckout` at [paymentService.ts:1448](backend/src/services/paymentService.ts#L1448) with `calculateUpgradePriceCop`.

Both functions:
1. Require `poolId` to exist (`prisma.pool.findUnique` line 151) → 404 otherwise.
2. Require `userId` to be HOST or CORPORATE_HOST of that pool (line 154-156) → 403 otherwise.
3. Compute price from `pricing.ts` against the pool's current capacity → target capacity.
4. INSERT the `PoolPayment` row in `INITIATED` state **before** calling the gateway (audit-trail keystone, F-4). [paymentService.ts:240](backend/src/services/paymentService.ts#L240).
5. Idempotency: if a PENDING row already exists for `{poolId, userId, toCapacity}`, return the same checkout URL.

**`PoolPayment` schema** ([prisma/schema.prisma:1227-1296](backend/prisma/schema.prisma#L1227)):

| Field | Purpose |
|---|---|
| `id` | PK |
| `poolId, userId` | FKs |
| `polarCheckoutId, polarOrderId` | Polar idempotency / order ref |
| `mpPreferenceId` | MP idempotency ref |
| `status` | `INITIATED → PENDING → COMPLETED` / `EXPIRED` / `ABANDONED` |
| `amountUsd, amountCop, currency` | money paid (USD cents / COP pesos) |
| `fromCapacity, toCapacity` | what the payment buys |
| `poolType` | "personal" \| "corporate" |
| `metaEventId, metaFbp, metaFbc, clientIpAddress, clientUserAgent` | CAPI / dedup metadata |
| `paidAtUtc, createdAtUtc, updatedAtUtc` | timestamps |

**No `accountReceivableId` field exists.** Adding one is part of this work.

**Payment receipt email** ([emailTemplates.ts:1328-1433](backend/src/lib/emailTemplates.ts#L1328)) — `getPaymentReceiptTemplate({ displayName, poolName, poolId, transactionId, amount, currency, fromCapacity, toCapacity, paidAt, locale })`. Already trilingual (es/en/pt). The CC number plug-in is an additive `accountReceivableNumber?: string` field that, when present, renders an extra row in the details table.

---

## 3 — Pool creation wizard (verified)

[components/pool-wizard/steps/StepCapacity.tsx:1-237](frontend-next/src/components/pool-wizard/steps/StepCapacity.tsx#L1):

- Capacity is held in `state.maxParticipants` via `PoolWizardContext`.
- `<CapacitySelector type={poolType} mode="creation" />` is the active widget.
- CTA "Proceder al pago" fires when `isPaidTier` is true.

The CC redemption box sits **above** `<CapacitySelector>` in this step. When a CC code is validated:
- `state.maxParticipants` is dispatched to the CC's `targetCapacity`.
- `<CapacitySelector>` is rendered in a locked variant (or replaced with a static badge "Capacidad establecida por la cuenta de cobro CC-XXXX") so the user cannot drift away from the CC's stated capacity.
- The pool creation request carries the `accountReceivableId` so the `initiateCheckout` can validate it.

---

## 4 — Capacity expansion (verified)

[components/PoolCapacityTab.tsx:131-329](frontend-next/src/app/[locale]/(authenticated)/pools/[poolId]/components/PoolCapacityTab.tsx#L131) — internal `<ExpandCapacitySection>`:

- Uses `<CapacitySelector mode="expansion">` with `selectedCapacity` state.
- `handleExpand()` (line 153) decides MP vs Polar via `getPaymentCountry()` and calls `createMpCheckout(poolId, selectedCapacity)` or `createCheckout(poolId, selectedCapacity)`.

The CC redemption box sits above `<CapacitySelector>` inside this component. Same mechanic: validate code → set `selectedCapacity` to CC's `targetCapacity` → lock the selector → carry `accountReceivableId` into `createMpCheckout` / `createCheckout`.

---

## 5 — Cotización: structure parsed from the user's sample

Source: `20260407_Cotizacion Linalca_v02.pdf` (provided by user, 4 pages, last revised 2026-05-04).

### 5.1 Layout

**Page 1 — Cover** (configurable: optional toggle "Generar con portada" in the form, default ON):
- Centered Picks4All isotipo (use SVG from `public/brand/isotipo-degradado-180.svg` or 320)
- "Picks4All" wordmark (use `public/brand/logotipo-degradado-120.svg`)
- Green horizontal rule
- Title: **COTIZACIÓN** (purple, bold, large)
- Tagline: *La polla deportiva que tu equipo merece ⚽*
- Centered metadata block:
  - "Preparado para: **[client name]**"
  - "Fecha: DD/MM/YYYY"
- Contact: **empresas@picks4all.com** + www.picks4all.com

**Pages 2-N — Body** (always present), with running header/footer:
- Header: Picks4All isotipo small (left) + "Picks4All" wordmark (right) + green rule
- Footer: "empresas@picks4all.com · Picks4All © {year}" (left) + "Pág. N" (right)

### 5.2 Body sections (verbatim from sample, captured for template)

**1. Datos del Cliente** — 2-row table:
| Campo | Información |
|---|---|
| Razón social | [client legal name] |
| Correo electrónico | [client contact email] |

**2. ¿Qué es Picks4All?** — fixed marketing paragraph (template-resident, not user-edited):
> "Picks4All es una plataforma de polla deportiva diseñada especialmente para empresas. Permite que tu equipo viva el fútbol juntos a través de pronósticos, rankings y una experiencia de juego simple, social y emocionante, sin apuestas, sin dinero real y 100% legal.
>
> Es una herramienta ideal para fortalecer la cultura interna, activar conversaciones durante los grandes torneos y acercar a tus colaboradores de una manera divertida."

**3. ¿Qué incluye el Plan Empresarial?** — fixed list of 8 bullets with green checkmarks (template-resident):
1. Polla a tu medida
2. Invitación masiva y sin complicaciones
3. Resultados confiables y en tiempo real
4. Puntuación flexible
5. Experiencia profesional
6. Control total para el administrador
7. Notificaciones inteligentes
8. Privacidad y cumplimiento normativo

Each bullet has a short descriptive paragraph captured verbatim in the template. These are NOT editable per-quote (they are the product description).

**4. Inversión** — the dynamic pricing block, per user-entered options. Sample shows two pricing tables ("Opción A" and "Opción B"). The form supports 1..N options.

Per option:
- Option title (e.g. "Opción A — Una sola polla con todos los participantes")
- Option description paragraph
- Table:
  | Concepto | Valor total (COP) | Valor por persona |
  |---|---|---|
  | TOTAL — N PARTICIPANTES | $ X | $ Y |
- For options with multiple lines (Opción B style), the table allows 2+ rows + a "TOTAL CONSOLIDADO" highlighted row.

Disclaimer at the bottom of §4 (template-resident):
> *"Valores expresados en COP. Incluye acceso al Plan Empresarial por la duración del torneo contratado. Para volúmenes mayores con gusto preparamos una cotización personalizada."*

**5. ¿Cómo empezamos?** — fixed 4-step numbered list (template-resident):
1. Confirmar la opción elegida y el torneo a activar.
2. Pago único → confirmación y acceso al panel de administración.
3. Configurar la polla: nombre, mensaje de bienvenida, puntuación y reglas.
4. Invitar al equipo → ¡en menos de 30 minutos están jugando!

Then a CTA block:
- "¿Listos para activar a tu equipo?"
- "Escríbenos a empresas@picks4all.com y te ayudamos a arrancar hoy mismo."
- "www.picks4all.com"

### 5.3 Inputs the admin enters per cotización (REVISED v4)

| # | Input | Type | Required | Default | Notes |
|---|---|---|---|---|---|
| 1 | `clientLegalName` | string | yes | — | "Razón social" in §1 |
| 2 | `clientContactEmail` | email | yes | — | |
| 3 | `issueDate` | date | yes | today | Rendered as DD/MM/YYYY |
| 4 | `validUntil` | date | yes | `issueDate + 15 days` | Vigencia |
| 5 | `locale` | enum | yes | `es` | `es` / `en` / `pt` — controls every locale-aware string in the PDF |
| 6 | `term` | enum | yes | locale-dependent | `polla` / `pool` / `prode` / `quiniela` / `bolão` / `porra` / `penca`. Substituted into `{term}` placeholders in the fixed copy. Selectable list filtered by locale (see §11.19). |
| 7 | `tournament` | string | no | — | Ej "FIFA World Cup 2026" — rendered in §4 intro line |
| 8 | `participants` | int | yes | — | Number of participants. **The only quantity input.** |
| 9 | `currency` | enum | yes | `COP` | `COP` (Mercado Pago) / `USD` (Polar). Chooses which `pricing.ts` function computes the amount. |
| 10 | `investmentDescription` | string | no | — | Optional intro paragraph under "Inversión", above the totals row |
| 11 | `notes` | string | no | — | Notes after §4, before §5 |
| 12 | `includeCoverPage` | boolean | no | `true` | If false, cotización starts directly at §1 |

**Server-derived (NOT entered by admin)**:
- `amountCop` (or `amountUsd`): computed via `calculateUpgradePriceCop("corporate", CORPORATE_FREE_LIMIT, participants)` or `calculateUpgradePrice(...)` — using the existing [backend/src/lib/pricing.ts](backend/src/lib/pricing.ts) functions verbatim. **No override permitted.**
- `perPersonCop` (or `perPersonUsd`): `amount / participants`, rounded to the nearest peso (or cent for USD).
- `consecutive`: `COT-YYYY-NNNN` via `DocumentCounter`.
- `issuerSnapshotJson`: snapshot of `issuerInfo.ts` at issue time.

Verified end-to-end against the Linalca sample: `calculateUpgradePriceCop("corporate", 2, 200) = $200,000 + $28,500 + $28,500 = $257,000 COP` ← matches the Linalca PDF exactly.

Persisted on the `Quote` model (§9.1).

---

## 6 — Cuenta de cobro: design (user has no sample)

User constraint: *"de cuenta de cobro no tengo pero podemos seguir un estilo similar pero mucho más formal corporate, intentando que sea de una o dos páginas sin portada"*.

Below is the design grounded in Colombian convention for **personas naturales no obligadas a facturar** (which matches the locked decision §11.4) + the user's "more formal, no cover" constraint. **Each element below is a proposal subject to your approval, not an assumption.**

### 6.1 Layout — single page (overflow to 2 if concept is long)

- **Header band** (slim, ~80px tall): Picks4All isotipo small (left), title **CUENTA DE COBRO** centered, consecutive number top-right (e.g. "No. CC-2026-0001")
- **City + date** (right-aligned): "Bogotá D.C., DD de [mes] de YYYY"
- **VALOR A PAGAR A:** block (left, framed) — the issuer (you). Label per locked decision §11.13.
  - **Juan Camilo Chacón Alvarado**
  - C.C. 1016094585
  - Carrera 18 # 123-60, Bogotá D.C.
  - Tel: 316 233 7373
  - empresas@picks4all.com
- **POR CONCEPTO DE:** description block (full width)
  - e.g. "Plan Empresarial Picks4All — 200 cupos para Linalca Informática SAS BIC, torneo: FIFA World Cup 2026"
- **LA SUMA DE:** the amount block (highlighted), in figures and in words
  - "DOSCIENTOS CINCUENTA Y SIETE MIL PESOS M/CTE"
  - "($257.000 COP)"
- **FORMA DE PAGO** block. Options shown depend on `currency` (see §11.22):
  - **(COP only) Transferencia bancaria:** Bancolombia — Cuenta de Ahorros 18651313496 — A nombre de Juan Camilo Chacón Alvarado. **Omitted entirely** when `currency=USD` since Bancolombia is a Colombian bank and international wires through SWIFT are not in v1 scope.
  - **(Always) En línea (tarjeta de crédito/débito):** ingresa el código en la caja "¿Tienes una cuenta de cobro?". Dos puntos de entrada según el caso:
    - **Si aún no has creado tu pool**: `picks4all.com/empresas/crear` → paso de capacidad → caja "¿Tienes una cuenta de cobro?"
    - **Si ya tienes la pool creada**: Pool → pestaña **Capacidad** → caja "¿Tienes una cuenta de cobro?" (Expandir capacidad usando código)
    - Código: **XXXX-XXXX** (8-digit numeric, see §11.3). Aplica en cualquiera de los dos caminos.
- **DATOS DEL CLIENTE:** block — the client (smaller font):
  - Razón social, NIT (if available — optional field), correo de contacto, ciudad
- **VIGENCIA:** "Esta cuenta de cobro es válida hasta el DD/MM/YYYY."
- **RÉGIMEN TRIBUTARIO:** mandatory legal phrase per Colombian DIAN:
  > "Manifiesto que pertenezco al régimen simplificado, no soy responsable del Impuesto sobre las Ventas (IVA) y no estoy obligado a expedir factura de venta o documento equivalente."
- **Firma del emisor** block at the bottom:
  - Signature line
  - "Juan Camilo Chacón Alvarado"
  - "C.C. 1016094585"

Header / footer recurring on page 2 if overflow.

### 6.2 Inputs the admin enters per cuenta de cobro (REVISED v4)

| # | Input | Type | Required | Default | Notes |
|---|---|---|---|---|---|
| 1 | `clientLegalName` | string | yes | — | |
| 2 | `clientNit` | string | no | — | NIT or document number |
| 3 | `clientContactEmail` | email | yes | — | |
| 4 | `clientCity` | string | no | — | |
| 5 | `issueDate` | date | yes | today | |
| 6 | `validUntil` | date | yes | `issueDate + 15 days` | |
| 7 | `locale` | enum | yes | `es` | `es` / `en` / `pt` |
| 8 | `term` | enum | yes | locale-dependent | Same dictionary as Quote (§11.19) |
| 9 | `concept` | string (multiline) | yes | — | "POR CONCEPTO DE" body. Max 1000 chars. |
| 10 | `targetCapacity` | int | yes | — | Number of slots this CC pre-pays for. **Used at redemption** to lock the wizard's capacity. |
| 11 | `currency` | enum | yes | `COP` | `COP` / `USD`. Drives pricing recompute path (MP vs Polar). |
| 12 | `tournament` | string | no | — | Mentioned in `concept` typically; persisted as metadata for analytics |
| 13 | `linkedQuoteId` | uuid \| null | no | — | If this CC was triggered from a Quote, FK. Independent docs by default. |
| 14 | `notes` | string | no | — | Optional, rendered below RÉGIMEN |
| 15 | `poolType` | enum (`corporate`) | yes | `corporate` | v1 locked to corporate. Single value. |

**Server-derived (NOT entered by admin)**:
- `consecutive`: `CC-YYYY-NNNN` from `DocumentCounter` (§9.3).
- `redemptionCode`: 8-digit numeric (§11.3), unique.
- `amountCop` (or `amountUsd`): computed via the same `pricing.ts` functions as the Quote (see §5.3). The admin gets a preview after entering `targetCapacity` + `currency`; the persisted value is the server's authority.
- `amountInWords`: derived from `amountCop` + `locale` (`numero-a-letras` with locale-specific suffix — "PESOS M/CTE" in `es`, "DOLLARS" in `en`, etc.).
- `issuerSnapshotJson`: snapshot at issue time.

Persisted on the `AccountReceivable` model (§9.2).

---

## 7 — Asset inventory (verified)

[frontend-next/public/brand/](frontend-next/public/brand/) contains:

| File | Use in PDFs |
|---|---|
| `isotipo-degradado-180.svg` (and 32, 320, 500) | Cover-page hero on cotización |
| `isotipo-degradado-32.svg` | Header (small) on every page of both documents |
| `isotipo-transparente-blanca-180.svg` | Reserved (not used in v1) |
| `logotipo-degradado-120.svg` (and 40, 80) | Cover wordmark on cotización; right-side header on CC |
| `logotipo-blanco-{40,80,120}.svg` | Reserved (not used in v1) |

All assets are SVG → vector → no quality loss at any PDF resolution.

**Path access from the backend**: PDFs are generated server-side. The `@react-pdf/renderer` library can read SVGs via the file system. Backend reads from `../../frontend-next/public/brand/*.svg` (relative path from the backend root), OR we copy the SVGs into `backend/src/assets/brand/` at install time. I recommend the latter for deploy isolation — Railway deploys backend and frontend as separate services and the backend cannot reliably reach the frontend's static directory at runtime.

→ **Locked decision:** copy SVGs into `backend/src/assets/brand/` as part of commit 3.

---

## 8 — Issuer legal data (user-provided)

| Field | Value |
|---|---|
| Nombre legal | Juan Camilo Chacón Alvarado |
| Documento | CC 1016094585 |
| Dirección | Carrera 18 # 123-60, Bogotá D.C. |
| Teléfono | 316 233 7373 |
| Email institucional | empresas@picks4all.com |
| Banco | Bancolombia |
| Tipo de cuenta | Ahorros |
| Número de cuenta | 18651313496 |
| Titular de cuenta | Juan Camilo Chacón Alvarado (same as nombre legal) |
| Régimen tributario | Régimen simplificado — no responsable de IVA — no obligado a facturar |

These values live in `backend/src/lib/issuerInfo.ts` (new file) as a typed constant. NOT in env vars — these are personal/legal identity values, version-controlled with the code so changes are reviewed and auditable.

If a value ever changes (e.g. you move address), the next CC/cotización issued reflects the new value automatically. Previously-issued PDFs retain a snapshot in the BD row (`issuerSnapshotJson` field) for legal auditability.

---

## 9 — Technical implications

### 9.1 New Prisma model: `Quote`

```prisma
model Quote {
  id                String   @id @default(uuid())

  // Numbering
  consecutive       String   @unique // "COT-2026-0001"
  year              Int                // for counter lookup
  number            Int                // sequence within year

  // Client snapshot
  clientLegalName   String
  clientContactEmail String

  // Issuer snapshot at issue time (legal audit trail)
  issuerSnapshotJson Json

  // Localization
  locale            String   // "es" | "en" | "pt"
  term              String   // "polla" | "pool" | "prode" | "quiniela" | "bolão" | ...

  // Investment (single block, no multi-option in v1)
  participants      Int
  currency          String   // "COP" | "USD"
  amountCop         Int?     // whole pesos. NULL if currency=USD.
  amountUsdCents    Int?     // USD cents. NULL if currency=COP.
  perPersonAmount   Int      // in the chosen currency unit (pesos or cents).
  tournament        String?
  investmentDescription String? @db.Text

  // Dates
  issueDate         DateTime  @db.Date
  validUntil        DateTime  @db.Date

  // Layout
  includeCoverPage  Boolean @default(true)
  notes             String? @db.Text

  // Lifecycle
  status            QuoteStatus @default(ACTIVE)  // ACTIVE | EXPIRED | CANCELLED

  // Audit
  createdByUserId   String
  createdAtUtc      DateTime @default(now())
  updatedAtUtc      DateTime @updatedAt

  createdBy User @relation(fields: [createdByUserId], references: [id])

  @@index([consecutive])
  @@index([clientContactEmail])
  @@index([createdAtUtc])
}

enum QuoteStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}
```

The currency-amount split (`amountCop` / `amountUsdCents` as separate nullable columns) mirrors the existing pattern in `PoolPayment` and avoids the kind of unit-mixup bug that bit us in payments (ADR-046 — "amountUsd is USD CENTS; amountCop is COP PESOS"). Always go through a helper that returns the active currency's amount.

### 9.2 New Prisma model: `AccountReceivable`

```prisma
model AccountReceivable {
  id                  String   @id @default(uuid())

  // Numbering
  consecutive         String   @unique  // "CC-2026-0001"
  year                Int
  number              Int

  // Redemption (decision §11.3 — 8-digit numeric)
  redemptionCode      String   @unique

  // Client snapshot
  clientLegalName     String
  clientNit           String?
  clientContactEmail  String
  clientCity          String?

  // Issuer snapshot
  issuerSnapshotJson  Json

  // Localization
  locale              String   // "es" | "en" | "pt"
  term                String   // "polla" | "pool" | ...

  // Content
  concept             String   @db.Text
  tournament          String?
  notes               String?  @db.Text

  // Pricing (server-derived, mirrors Quote)
  currency            String   // "COP" | "USD"
  amountCop           Int?     // whole pesos. NULL if currency=USD.
  amountUsdCents      Int?     // USD cents. NULL if currency=COP.
  amountInWords       String   // localized at issue time
  targetCapacity      Int      // # slots this CC pre-pays. Used at redemption.
  poolType            String   // "corporate" (locked v1)

  // Dates
  issueDate           DateTime @db.Date
  validUntil          DateTime @db.Date

  // Lifecycle
  status              AccountReceivableStatus @default(PENDING)
  // PENDING → REDEEMED → PAID
  // PENDING → EXPIRED (validUntil passed without redemption)
  // any → CANCELLED (admin voids)
  redeemedAtUtc       DateTime?
  redeemedByUserId    String?
  paidAtUtc           DateTime?

  // FK back to the optional Quote it came from
  linkedQuoteId       String?
  // FK forward to the PoolPayment that consumed it (set on PAID)
  poolPaymentId       String?  @unique

  // Audit
  createdByUserId     String
  createdAtUtc        DateTime @default(now())
  updatedAtUtc        DateTime @updatedAt

  createdBy   User @relation("CreatedAccountReceivables", fields: [createdByUserId], references: [id])
  redeemedBy  User? @relation("RedeemedAccountReceivables", fields: [redeemedByUserId], references: [id])
  linkedQuote Quote? @relation(fields: [linkedQuoteId], references: [id])
  poolPayment PoolPayment? @relation(fields: [poolPaymentId], references: [id])

  @@index([consecutive])
  @@index([redemptionCode])
  @@index([clientContactEmail])
  @@index([status, validUntil]) // for the expiry sweep
}

enum AccountReceivableStatus {
  PENDING
  REDEEMED
  PAID
  EXPIRED
  CANCELLED
}
```

### 9.3 New Prisma model: `DocumentCounter`

Atomic consecutive numbers per `(kind, year)`:

```prisma
model DocumentCounter {
  kind         DocumentKind
  year         Int
  lastNumber   Int      @default(0)
  updatedAtUtc DateTime @updatedAt

  @@id([kind, year])
}

enum DocumentKind {
  QUOTE
  ACCOUNT_RECEIVABLE
}
```

Increment via `prisma.$transaction` + `UPDATE ... RETURNING` (raw query for atomicity). One row per (kind, year). Initial row inserted on first use.

### 9.4 FK on existing `PoolPayment`

```prisma
model PoolPayment {
  // ... existing fields ...
  accountReceivableId String?   @unique
  accountReceivable   AccountReceivable? @relation(fields: [accountReceivableId], references: [id])
}
```

`@unique` because a CC can only be consumed by one payment.

### 9.5 PDF library choice

Selected: **`@react-pdf/renderer`** (v3.x), server-side rendering.

Reasons (verified, not asserted):
- Renders to PDF in Node without Puppeteer / Chromium overhead (smaller cold start; matters on Railway).
- Supports SVG natively → our isotipo + logotipo SVGs print sharply at any resolution.
- React-style declarative API → templates are React components, easy to review.
- TypeScript-first → fits the codebase.

Alternative considered: **`puppeteer`** + HTML-to-PDF. Rejected because:
- Adds ~300MB to the Docker image (Chromium binary).
- Cold-start cost incompatible with Railway's free-tier-ish setup.

Alternative considered: **`pdfkit`** (low-level pdf generation). Rejected because:
- No SVG support out of the box (would need svg-to-pdf bridges).
- Imperative API — much harder to template a multi-section document like the Linalca cotización.

### 9.6 Backend endpoints

All require `requireAdmin`. Mounted under `/admin/sales/`.

**Quotes**:
- `POST /admin/sales/quotes` — body: full input (§5.3). Issues a new `Quote`, increments counter, returns `{ id, consecutive }`.
- `GET /admin/sales/quotes` — list with optional filters: `?clientEmail=`, `?fromDate=`, `?toDate=`, `?status=`, pagination.
- `GET /admin/sales/quotes/:id` — full row for re-rendering / inspection.
- `GET /admin/sales/quotes/:id/pdf` — streams the PDF (sets `Content-Type: application/pdf`).
- `PATCH /admin/sales/quotes/:id/status` — body: `{ status: "CANCELLED" }`. v1 supports only CANCELLED transitions.

**Cuentas de cobro**:
- `POST /admin/sales/account-receivables` — body: full input (§6.2). Issues a new CC, increments counter, generates `redemptionCode`, returns `{ id, consecutive, redemptionCode }`.
- `GET /admin/sales/account-receivables` — list with filters.
- `GET /admin/sales/account-receivables/:id` — full row.
- `GET /admin/sales/account-receivables/:id/pdf` — streams PDF.
- `PATCH /admin/sales/account-receivables/:id/status` — body: `{ status: "CANCELLED" | "PAID" }`. Manual PAID transition for "cliente pagó por fuera del sistema" (e.g. wire transfer).

**Redemption (public, requires only auth as the paying user)**:
- `POST /sales/account-receivables/redeem` — body: `{ redemptionCode }`. Returns CC summary for the wizard to apply: `{ targetCapacity, amountCop, consecutive, expectedPoolType, clientLegalName }`. Validates: exists, status `PENDING`, not expired. Does NOT yet lock the CC — that happens at `initiateCheckout` time.

### 9.7 Modifications to existing payment functions

`initiateCheckout` and `initiateMpCheckout` (paymentService.ts):
- Add `accountReceivableId?: string` to `InitiateCheckoutInput`.
- When present:
  - Load the CC. If status ≠ `PENDING` → 409.
  - If `targetCapacity` from CC ≠ requested `targetCapacity` → 409.
  - Recompute price via `calculateUpgradePrice`. If ≠ CC's `amountCop` → 409 ("CC desactualizada — pídele al equipo de ventas una nueva").
  - Atomically (`updateMany WHERE status='PENDING'`) flip CC to `REDEEMED`, set `redeemedByUserId`, `redeemedAtUtc`, `poolPaymentId`. If `count === 0` → race lost, 409.
  - Persist `accountReceivableId` on the new `PoolPayment` row.
- The Polar/MP webhook handlers (`handleOrderPaid`, MP IPN) — when transitioning `PoolPayment` to `COMPLETED`, also flip the linked `AccountReceivable.status = PAID` and set `paidAtUtc` in the same transaction.

### 9.8 Reconciler integration

`paymentReconcileJob` (the one we just fixed in `1bbfc95`):
- When a `PoolPayment` expires/abandons, if it has a linked `accountReceivableId`, flip the CC back to `PENDING` so it can be redeemed again. Mirrors the `PoolInvite.uses` rollback pattern.

A separate small job (or extend `paymentReconcileJob`) sweeps `AccountReceivable WHERE status='PENDING' AND validUntil < now()` → flips to `EXPIRED`.

---

## 10 — Cotización — open-ish design choices

These are leaning a particular way based on the sample but I want to flag them explicitly:

| Choice | My lean | Alt |
|---|---|---|
| Where does "Vigencia hasta DD/MM/YYYY" print on cotización? | In §1 (Datos del Cliente), as a third row | In §6 (new section "Vigencia y condiciones") |
| Should the cover page be optional via a toggle in the form? | Yes — default ON | Always-on (cover page mandatory) |
| Currency: always COP for v1, or support USD? | COP only v1 (sample is COP) | Multi-currency from day 1 |
| §3 (¿Qué incluye el Plan Empresarial?) — editable per quote? | No, fixed in template (8 bullets verbatim) | Editable list per quote |
| Notes/observations — where on PDF? | After §4 (Inversión), before §5 (¿Cómo empezamos?) | Footer |

These are placeholders in the implementation doc — if you disagree, change before commit 3.

---

## 11 — Locked decisions (from chat, this session)

| # | Decision |
|---|---|
| 11.1 | v1 = generate + persist + download PDF. **No** email send in v1. |
| 11.2 | Services covered = **only Picks4All corporate pools** (no free-form line items). Pricing derives from `lib/pricing.ts`. |
| 11.3 | Redemption code = **8-digit numeric**, formatted as `XXXX-XXXX` for readability. Generation: `crypto.randomInt(10_000_000, 100_000_000)` with retry on collision. Mirrors `PoolInvite.code` pattern, just numeric and longer. |
| 11.4 | Issuer = **Juan Camilo Chacón Alvarado**, persona natural, régimen simplificado, no responsable de IVA. Constant in `backend/src/lib/issuerInfo.ts`. |
| 11.5 | Quote ↔ CC = **independent documents**. The CC may optionally reference a Quote via `linkedQuoteId` for cross-reference, but it doesn't *require* one and the Quote doesn't auto-generate a CC. |
| 11.6 | Numbering: `COT-{year}-{4-digit sequence}` for quotes, `CC-{year}-{4-digit sequence}` for CCs. Year-scoped counter (resets Jan 1). |
| 11.7 | Pricing drift = **no override allowed**. Server recomputes via `calculateUpgradePrice` at redemption; if it disagrees with the CC snapshot, redemption is blocked with an explicit 409 + admin-facing email. Admin reissues. |
| 11.8 | Redemption authorization = **anyone with the code** (v1). No email-binding. The code is the credential. Security relies on the code being delivered only via the addressed PDF. |
| 11.9 | Linked payment notification = the existing `getPaymentReceiptTemplate` gains an optional `accountReceivableNumber` row in the details table. Locale-aware in ES/EN/PT. |
| 11.10 | Manual PAID transition = admin can mark a CC as PAID manually (e.g. wire transfer outside the platform). Both code-redemption and manual-mark are valid paths to PAID. |
| 11.11 | Asset path = **copy SVGs into `backend/src/assets/brand/`** at install time. Backend doesn't reach into the frontend's static dir at runtime. |
| 11.12 | PDF library = `@react-pdf/renderer` server-side. Justification in §9.5. |
| 11.13 | Issuer-block label on CC = **"VALOR A PAGAR A:"** (not "DEBE A:"). More direct, less archaic. |
| 11.14 | Quote = **single investment block** (no multi-option). Linalca's Opción A/B were atypical cases the admin handled manually; v1 doesn't reproduce them. The form takes `participants` + `currency`; server derives `amountCop`/`amountUsd` and `perPerson` via `pricing.ts`. Admin cannot override the amount. |
| 11.15 | `validUntil` default for both Quote and CC = **+15 days** from `issueDate`. Form field is editable per document. |
| 11.16 | Spanish amount-in-words library = **`numero-a-letras`** (most-maintained Spanish-language option on npm). Pinned at install time; output format wrapped in `lib/amountInWords.ts` so the dependency is swappable. For `en`/`pt` localized suffixes the wrapper handles ("PESOS M/CTE" / "DOLLARS" / "REAIS" etc.). |
| 11.17 | `linkedQuoteId` UI on the CC form = **dropdown filtered by client email** (typed by the admin in the form's email field before the dropdown becomes populated). Free-text fallback rejected — dropdown enforces referential integrity. |
| 11.18 | **Locale support**: every PDF is rendered in one of `es`/`en`/`pt` chosen by the admin per document. The fixed copy in §2 (¿Qué es Picks4All?), §3 (8 bullets), §5 (¿Cómo empezamos?), and section headings is internationalised in a per-locale dictionary inside the PDF templates. The régimen tributario phrase (DIAN) appears **only** in `es` — non-Spanish documents omit it. |
| 11.19 | **Product-term substitution**: a single `{term}` placeholder in the fixed locale-aware copy is replaced by the admin's selection. Term dictionary by locale:<br>• `es` → polla / penca / prode / quiniela / porra / pool<br>• `en` → pool / prediction game / sports pool<br>• `pt` → bolão / palpites / pool<br>The dropdown shown in the form filters by the chosen `locale`. |
| 11.20 | **Pricing = server-derived, never user-entered**. Both Quote and CC compute amounts via the production `pricing.ts` (`calculateUpgradePrice` for USD / `calculateUpgradePriceCop` for COP). Verified the Linalca sample: 200 corporate cupos → $257,000 COP exactly. |
| 11.21 | **CC online-payment instructions = dual path**: the PDF lists both `/empresas/crear` (new-pool flow) and the existing-pool capacity-tab redemption. Same code applies in both. |
| 11.22 | **Bancolombia bank transfer = COP-only**: the "Transferencia bancaria" payment option appears on the CC PDF **only when `currency === "COP"`**. For `currency === "USD"`, the document shows only the online payment path. Rationale: Bancolombia is a Colombian bank — international clients pay via Polar (card USD). SWIFT wires are out of v1 scope. |
| 11.23 | **Sections never split across pages**: every logical section block in both Cotización and Cuenta de Cobro PDFs is rendered with `wrap={false}` (the @react-pdf/renderer prop that keeps a `<View>` together — if it doesn't fit on the current page, the engine pushes the whole block to the next page). Applies to: every numbered section of the Quote (§1-§5, including header + content), the price table, the steps + CTA, and every labeled block of the CC (Valor a pagar a, Por concepto de, La suma de, Forma de pago, Datos del cliente, Vigencia, Régimen, Firma). Per-bullet wrap on §3 already exists. This rule is enforced at template-author time — code review should reject any new section that doesn't wrap. |

---

## 12 — Out of scope (explicitly, for v1)

- **Sending the PDF by email from inside the app.** v1: download + manually attach to your own email. v2 candidate: "Enviar al cliente" button.
- **Editable §2 / §3 content per cotización** (the "Qué es Picks4All" + "Qué incluye" sections). Treated as fixed product description; admin can change them by editing the template code or the i18n dictionary embedded in the templates.
- **Multi-currency split (USD and COP in the same document).** Document = single currency.
- **Multi-option quotes** (the Linalca Opción A/B style). Replaced by single-investment per quote (locked §11.14). If the admin wants to show two prices, they issue two quotes.
- **Free-form line items beyond Picks4All pricing.** All amounts derive from `pricing.ts`.
- **Tax computation (IVA, retenciones).** Issuer is non-responsable de IVA; no tax fields needed v1.
- **Reissue / amend an existing CC.** v1: cancel the old one, create a new one. v2: amendment workflow.
- **Customer-facing UI to look up "mis cuentas de cobro".** v1: customer sees the CC only via the PDF you send and the redemption code box.

---

## 13 — Open questions — RESOLVED 2026-05-22

All five items from the first draft are now locked (see §11.13-§11.17):

1. ✅ Issuer-block label = **"VALOR A PAGAR A:"** (replacing the proposed "DEBE A:").
2. ✅ Multi-row option lines confirmed.
3. ✅ `validUntil` default = +15 days.
4. ✅ Amount-in-words lib = `numero-a-letras`.
5. ✅ `linkedQuoteId` UI = dropdown filtered by client email.

Next step before commit 1: user requested dummy PDF previews of both documents so they can validate the visual design before we start writing real implementation. See `c:/tmp/picks4all-pdf-preview/`.

---

## 14 — Document version

- v1 — 2026-05-22 — initial draft after code verification.

Next doc: `SALES_IMPLEMENTATION.md` — written after this audit is approved.
