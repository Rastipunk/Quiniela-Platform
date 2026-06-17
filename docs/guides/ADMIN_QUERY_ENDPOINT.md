# Admin Ad-Hoc Query Endpoint

Read-only SQL over HTTPS for operational diagnostics ("what pool does
user X have", "did these emails register", "are picks being saved").
Lets an operator (or an agent acting for one) run arbitrary **SELECT**
queries against production without opening a database port.

> **Read-only by design.** Writes are NOT supported here. Any change to
> production data (email change, capacity bump, account activation) stays
> a reviewed SQL statement run by a human in the Railway console.

---

## Security model — defense in depth

| Layer | Mechanism | Guarantee |
|-------|-----------|-----------|
| 1 | **Postgres role `picks4all_readonly`** with SELECT-only grants | The DB physically cannot mutate through this client. This is the real boundary. |
| 2 | Statement validation (`adminQueryService.validateQuery`) | Single statement, must be `SELECT`/`WITH`, DML/DDL keywords refused. |
| 3 | Sensitive-identifier rejection | Queries referencing `passwordHash`, `resetToken`, `emailVerificationToken`, `activationToken` are refused (defeats the `SELECT passwordHash AS x` alias bypass). |
| 4 | Output redaction | Any result key matching a secret name → `"[REDACTED]"`. |
| 5 | Row cap (`ADMIN_QUERY_MAX_ROWS`, default 1000) + role `statement_timeout` (10 s) | Bounds output size and runtime. |
| 6 | Audit | Every call writes an `AuditEvent` (`ADMIN_QUERY_EXECUTED`) with the SQL, row count and outcome. |
| 7 | Auth | Dedicated static token (`ADMIN_QUERY_TOKEN`) via `X-Admin-Query-Token`, constant-time compared. |

---

## One-time setup (run in Railway → Postgres → Data → Query)

The role-creation SQL is **not** a committed migration — it carries a
password and must never reach git. Run it once in the Railway console as
the default superuser. Choose a strong password.

```sql
-- 1. Create the read-only role. Replace <STRONG_PASSWORD>.
CREATE ROLE picks4all_readonly WITH LOGIN PASSWORD '<STRONG_PASSWORD>';

-- 2. Allow it to connect + see the schema.
GRANT CONNECT ON DATABASE railway TO picks4all_readonly;
GRANT USAGE ON SCHEMA public TO picks4all_readonly;

-- 3. SELECT on every existing table — and future ones.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO picks4all_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO picks4all_readonly;

-- 4. Hard runtime cap so a heavy query can't hog a connection.
ALTER ROLE picks4all_readonly SET statement_timeout = '10s';

-- 5. Belt-and-suspenders: ensure it can NEVER write, even if a future
--    GRANT is run by mistake.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public FROM picks4all_readonly;
```

Then set two Railway env vars on the **Backend** service:

| Var | Value |
|-----|-------|
| `DATABASE_READONLY_URL` | Same as `DATABASE_URL` but with `picks4all_readonly` + its password. Internal host is fine: `postgresql://picks4all_readonly:<PW>@postgres.railway.internal:5432/railway` |
| `ADMIN_QUERY_TOKEN` | A long random string (e.g. `openssl rand -hex 32`). |

The backend redeploys and the endpoint goes live. Until both vars are
set the endpoint returns `503 NOT_CONFIGURED` (it never crashes boot).

---

## Usage

```bash
curl -s https://api.picks4all.com/admin/query \
  -H "Content-Type: application/json" \
  -H "X-Admin-Query-Token: $ADMIN_QUERY_TOKEN" \
  -d '{"sql":"SELECT status, COUNT(*) FROM \"Pool\" GROUP BY status"}'
```

Response:

```json
{
  "rows": [{ "status": "ACTIVE", "count": 128 }],
  "rowCount": 1,
  "truncated": false,
  "maxRows": 1000
}
```

Errors return `400` with `{ "error": "<CODE>", "message": "..." }` —
e.g. `FORBIDDEN_KEYWORD`, `SENSITIVE_COLUMN`, `MULTIPLE_STATEMENTS`,
`QUERY_FAILED` (the DB's own message, e.g. a syntax error). Bad token →
`401`. Endpoint not configured → `503`.

---

## Rotation & revocation

- **Rotate the token:** change `ADMIN_QUERY_TOKEN` in Railway → redeploy.
- **Kill the endpoint instantly:** unset either env var → it returns 503.
- **Rotate the DB password:** `ALTER ROLE picks4all_readonly WITH PASSWORD '<NEW>';` then update `DATABASE_READONLY_URL`.

---

## What it deliberately does NOT do

- **No writes** — use a reviewed statement in the Railway console.
- **No secrets** — password hashes and tokens are blocked + redacted.
- **No multi-statement / transactions** — one SELECT per call.
