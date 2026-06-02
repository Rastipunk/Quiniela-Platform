# Plan — Aplicar capacidad de una CC pagada por transferencia

> Objetivo: dar al admin un camino limpio y profesional para **aplicar
> la capacidad** de una Cuenta de Cobro pagada por transferencia
> bancaria a un pool, sin scripts manuales. Hoy ese puente no existe.
>
> Verificado contra el código real (branch `docs/repo-audit-2026-05`),
> sin suposiciones. **Plan — no se toca código hasta aprobación.**

---

## 1. El gap (con evidencia)

- La CC es un documento de cobro. Se paga de dos formas (modelo
  confirmado por el owner):
  - **(A) Con código + tarjeta** (MP/Polar): automático —
    `paymentService.initiateCheckout` redime la CC (`PENDING→REDEEMED`,
    `accountReceivableService.tryLockAccountReceivable:308`), cobra, y
    `markPaymentCompleted` expande el pool y deja la CC `PAID`.
  - **(B) Transferencia bancaria**: el cliente consigna, avisa, y el
    admin marca pagada y **aplica a un pool que el cliente indica**.
- El flujo (B) está roto a la mitad: `PATCH /admin/sales/account-
  receivables/:id/status → PAID` llama a `markAccountReceivablePaid`
  (`accountReceivableService.ts:283`), que **solo cambia el estado**.
  No recibe `poolId`, no crea `PoolPayment`, no expande capacidad.
- Resultado real observado: CC-2026-0002 quedó `PAID` con
  `poolPaymentId=null` y la capacidad nunca aplicada (lo resolvimos a
  mano el 2026-06-02). Volverá a pasar con cada cliente que pague por
  transferencia.

---

## 2. Decisiones de diseño (cerradas con el owner, 2026-06-02)

1. **Selección de pool:** buscador en la UI (por nombre de pool o email
   del host), no pegar IDs. Maneja el caso cuenta-cruzada (CC de un
   correo, pool de otro).
2. **Drift de precio:** el precio no va a cambiar → **no se construye
   lógica de drift/override**. El monto de la CC (lo que el cliente
   pagó) es la fuente de verdad; se aplica `cc.targetCapacity`.
3. **Aviso al cliente:** email de confirmación "tu pool fue ampliado a
   N" (sin connotación de cobro).
4. **Flujo:** un solo botón **"Registrar pago y aplicar"** —
   idempotente: si la CC no está `PAID` la marca, y aplica la capacidad
   en una sola operación.

---

## 3. Diseño

### 3.1 Backend — service (commit 1)

`backend/src/services/sales/accountReceivableService.ts`:

```
applyPaidAccountReceivableToPool({ ccId, poolId, adminUserId }): Promise<Result>
```

Validaciones (todas antes de escribir):
- CC existe; estado ∈ {PENDING, PAID} (no REDEEMED — esa está en
  checkout de tarjeta; no CANCELLED/EXPIRED).
- **Anti-doble:** `cc.poolPaymentId == null`. Si ya tiene → `409
  ALREADY_APPLIED`.
- Pool existe.
- `pool.maxParticipants < cc.targetCapacity` (si ya es ≥, `409
  NOTHING_TO_APPLY`).
- Resuelve el `userId` para el `PoolPayment` = el `CORPORATE_HOST`/
  `HOST` del pool (no el contacto de la CC — pueden diferir).

Operación **atómica** (`prisma.$transaction`), replicando el efecto del
flujo de tarjeta sin cobro:
1. Si `cc.status !== "PAID"` → set `PAID` + `paidAtUtc`.
2. `PoolPayment.create`: `status=COMPLETED`, `poolId`, `userId=host`,
   `fromCapacity=actual`, `toCapacity=cc.targetCapacity`,
   `poolType="corporate"`, `accountReceivableId=cc.id`,
   `polarOrderId="manual-cc-{consecutive}"`, `paidAtUtc`,
   montos (ver §5 — manejo COP/USD).
3. `Pool.update`: `maxParticipants=cc.targetCapacity` + reset
   `poolFullNotifiedAt`/`capacityWarningNotifiedAt`.
4. `AccountReceivable.update`: `poolPaymentId`, `redeemedAtUtc`,
   `redeemedByUserId=adminUserId`. Estado se queda `PAID`.
5. `AuditEvent`: `PAYMENT_COMPLETED` con `dataJson { appliedManually:
   true, method:"bank_transfer", cc, fromCapacity, toCapacity }`.

Post-tx (fire-and-forget, no bloquea): email de confirmación al
`clientContactEmail` de la CC (y/o al host). Falla de email NO revierte
la aplicación.

Idempotencia: la validación `poolPaymentId == null` hace que un segundo
intento devuelva `409 ALREADY_APPLIED` limpio.

### 3.2 Backend — endpoints (commit 2)

- `POST /admin/sales/account-receivables/:id/apply` body `{ poolId }`
  (requireAuth + requireAdmin). Llama al service. Devuelve el estado
  actualizado de la CC + el pool.
- `GET /admin/sales/pools/search?q=...` (admin) — para el buscador.
  Busca pools por nombre (ILIKE) o por email del host
  (`PoolMember` HOST/CORPORATE_HOST → `User.email`). Devuelve
  `[{ id, name, status, maxParticipants, hostEmail, organizationId }]`,
  cap 20 resultados. **No existe hoy — se crea.**

### 3.3 Email (commit 3)

- `getPoolCapacityAppliedTemplate` en `emailTemplates.ts` (es/en/pt),
  escapando los campos host-controlados (regla ADR-047).
- `sendPoolCapacityAppliedEmail` en `email.ts` (patrón de
  `sendPaymentReceiptEmail:1579`). Categoría apropiada, locale del
  usuario.

### 3.4 Frontend (commit 4)

`AdminCcDetailContent.tsx`:
- Botón **"Registrar pago y aplicar a un pool"** visible cuando
  `cc.poolPaymentId == null` y estado ∈ {PENDING, PAID}.
- Abre un modal: buscador (llama `GET .../pools/search`), seleccionas el
  pool, muestra resumen (pool, `maxParticipants` actual →
  `cc.targetCapacity`, monto de la CC), botón confirmar.
- Confirmar → `POST .../apply { poolId }` → refresca la CC.
- `lib/api/sales.ts`: funciones `applyAccountReceivable`, `searchPools`.
- i18n: keys nuevas en `es/en/pt` (modal, botón, estados, errores) —
  recordar que `defaultMessage` no es fallback.

### 3.5 Docs (commit 5)

- `docs/DECISION_LOG.md`: ADR-067 (camino admin de aplicación de CC
  pagada por transferencia; por qué se mantiene `PAID` + `poolPaymentId`
  como señal de "aplicada"; sin drift por decisión de negocio).
- `docs/BUSINESS_RULES.md`: sección sales — las dos vías de pago de una
  CC y el invariante anti-doble (`poolPaymentId` único por aplicación).
- MEMORY: actualizar `project_native_intelligence_cc.md` (resuelto + el
  nuevo camino) y `project_sales_management.md`.

---

## 4. Invariantes respetados (ADR-061)

- Capacidad siempre vía un `PoolPayment` con traza (no `UPDATE` suelto).
- `poolPaymentId` en la CC = candado anti-doble aplicación.
- Soft-revoke intacto (no se borra nada).
- El monto es el de la CC (server-derived al emitirla); no se recotiza.

---

## 5. Detalle a resolver en implementación (señalado, no asumido)

- **Montos COP/USD en el PoolPayment:** `PoolPayment.amountUsd` es USD
  cents (requerido). Para una CC en COP (`amountUsdCents=null`,
  `amountCop` presente), se derivará `amountUsd` con
  `calculateUpgradePrice("corporate", from, target)` y se guardará
  `amountCop` de la CC. Para CC en USD, al revés. Se decide en commit 1
  con el helper de pricing existente, sin inventar valores.
- **Email a quién:** `clientContactEmail` de la CC vs email del host del
  pool (pueden diferir, caso Caterine). Propuesta: enviar al
  `clientContactEmail` (quien pagó) y, si difiere, también al host.
  Confirmable en commit 3.

---

## 6. Commits

| # | Alcance | Gate |
|---|---|---|
| 1 | Service `applyPaidAccountReceivableToPool` + helper pricing + tests unit | `tsc` + vitest |
| 2 | Endpoints `POST .../apply` + `GET .../pools/search` + tests | `tsc` + vitest |
| 3 | Email plantilla + sender (es/en/pt) | `tsc` |
| 4 | UI: modal buscador + botón + api client + i18n | `tsc` + build |
| 5 | Docs (ADR-067 + BUSINESS_RULES + MEMORY) | — |

Cada commit compila y pasa gate de forma independiente. Todo en una
rama; no se mergea sin tu revisión.

---

## 7. Fuera de alcance (explícito)

- No se toca el flujo de tarjeta (A) — funciona.
- No se construye lógica de drift de precio (decisión de negocio).
- No se migran las CC viejas; CC-2026-0002 ya quedó aplicada a mano.
- No se limpian los pools DRAFT duplicados de Caterine (lo dejaste fuera).

---

## Versión
- v1 — 2026-06-02 — decisiones cerradas, pendiente "Go" para implementar.
