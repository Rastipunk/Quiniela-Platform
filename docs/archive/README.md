# docs/archive

Historical work products from past feature cycles. Each pair
(`*_AUDIT.md` + `*_IMPLEMENTATION.md`) was the forensic audit and the
per-commit tracker for one cycle. Their **live content has been
consolidated** into the canonical docs:

- Decisions → `docs/DECISION_LOG.md` (ADRs)
- Rules/invariants → `docs/BUSINESS_RULES.md` + `CLAUDE.md`
- Schema → `docs/DATA_MODEL.md`
- Endpoints → `docs/API_SPEC.md`

They are kept here as the detailed record of *how* each cycle was
reasoned and executed — not as living documentation. Do not treat them
as current; the canonical `docs/` always wins on any disagreement.

| File | Cycle | Canonical home of its conclusions |
|---|---|---|
| `PAYMENTS_PARITY_*` | Polar/MP completion parity | ADR-065, BUSINESS_RULES §18 |
| `PAYMENT_ATTEMPT_TELEMETRY_*` | MP Brick lifecycle beacons | ADR-066, BUSINESS_RULES §19 |
| `SALES_*` | Quote + Cuenta de Cobro stack | ADR-061, sales sections |
| `LOCALE_RESOLUTION_*` | URL/cookie/Accept-Language chain | ADR-064, BUSINESS_RULES §17 |
| `EMAIL_LOCALE_HANDOFF_*` | Deferred welcome email | ADR-063 |
| `CORPORATE_LOCALE_*` | Organization.invitationLocale | ADR-062 |
| `CORPORATE_INVITES_*` | Corporate invite flow | corporate sections |
| `POLAR_AUDIT.md` | Initial Polar observability audit | ADR-046/060 |
| `I18N_AUDIT.md` | i18n completeness sweep | i18n rules in CLAUDE.md |
| `WC2026_*` | World Cup 2026 instance/migration notes | operational, point-in-time |

Archived 2026-05-28 during the full repo audit & documentation
consolidation (see `../../REPO_AUDIT_TRACKER.md`).
