## Audit: docs/guides/PREDICTION_UPDATES.md

**Overall verdict: update (minor)** — The doc is structurally accurate and largely matches the shipped code (endpoint path, page constants, translation keys, batch behavior, response shape). A handful of concrete inaccuracies need correcting: a hardcoded JWT secret that no longer matches the code (and is a leak risk), the wrong JWT signing recipe, and an incorrect claim that the email template "translates" the change-type badge.

---

### Step 3 — JWT secret hardcoded (incorrect / security)

- **Type:** incorrect
- **What's wrong:** The token-generation snippet (lines 100-108) hardcodes the secret string `'quiniela_jwt_secret_prod_2026'`. The real code reads the secret exclusively from `process.env.JWT_SECRET` (`backend/src/lib/jwt.ts:11,20`) and throws if it is missing. A literal production secret should never live in a doc; if it ever was the real value it must be rotated.
- **Fix:** Replace the literal with `process.env.JWT_SECRET` and instruct the operator to run the snippet on the backend host (Railway) where that env var is set, e.g. `jwt.sign({ ... }, process.env.JWT_SECRET, { ... })`. Remove the plaintext secret entirely.

### Step 3 — JWT payload + expiry don't match signToken (incorrect)

- **Type:** incorrect
- **What's wrong:** The snippet signs `{ userId: '<ADMIN_USER_ID>' }` with `expiresIn: '1h'` and no algorithm. The real `signToken` (`backend/src/lib/jwt.ts:10-16`) signs `{ userId, platformRole }` with `expiresIn: "4h"` and `algorithm: "HS256"`, and `verifyToken` enforces `algorithms: ["HS256"]`. The manual snippet still works for authorization because `requireAuth` re-derives `platformRole` from the DB (`backend/src/middleware/requireAuth.ts:46`), but the doc should match the real signing contract.
- **Fix:** Update the snippet to include `platformRole: 'ADMIN'` in the payload and `algorithm: 'HS256'`. Note the production tokens are 4h, and that the user referenced must actually have `platformRole = ADMIN` in the DB (`requireAdmin` rejects anything else — `backend/src/middleware/requireAdmin.ts:9`).

### Change descriptions per locale — "template handles translation" is false (incorrect)

- **Type:** incorrect
- **What's wrong:** Lines 156 and 158 claim "The email template handles the translation based on the `type` field badge" and that "the type badge (CHAMPION, ELIMINATED, etc.) provides context". In reality `getPredictionUpdateTemplate` (`backend/src/lib/emailTemplates.ts:1271-1279`) renders the raw `c.type` string verbatim inside the badge and `c.description` verbatim — there is no type→label translation map. Only the surrounding chrome (subject, heading, intro, CTA, unsubscribe text, footer) is localized per `es/en/pt`. So an EN/PT user sees the badge text exactly as sent (e.g. literal "CHAMPION") and the Spanish description as-is.
- **Fix:** Reword to: the email chrome is localized, but the `type` badge and `description` are rendered exactly as provided in the request body with no translation. If localized badges are desired, that is not implemented.

### Change types table — presented as an enforced enum but the schema is free-form (incorrect/minor)

- **Type:** incorrect
- **What's wrong:** The "Change types to track" table (lines 36-44) reads like a fixed enum. The backend Zod schema (`backend/src/routes/admin.ts:173-178`, `predictionUpdateSchema`) only validates `type: z.string().min(1).max(100)` and `description: z.string().min(1).max(500)`, with the `changes` array bounded `.min(1).max(50)`. Any string is accepted; the seven listed types are a documentation convention, not validated values.
- **Fix:** Note that `type` is a free-form string (max 100 chars) and `description` is free-form (max 500 chars); the listed types are recommended conventions only. Mention the array must contain 1-50 changes.

### Step 3 Response — sample is shape-accurate but omits the `message` field (minor)

- **Type:** incorrect
- **What's wrong:** The documented response (lines 130-135) shows `{ "ok": true, "emailsQueued": 47 }`. The endpoint returns `sendOk(res, { message: "Prediction update emails queued.", emailsQueued: totalSubscribers })` (`backend/src/routes/admin.ts:261-264`), so the payload also carries a `message` string. There is also an early-return path when there are zero subscribers that returns `{ message, emailsSent: 0 }` (note the different key `emailsSent`, line 208).
- **Fix:** Add the `message` field to the sample and document the zero-subscriber response (`emailsSent: 0`).

### Step 3 — subscriber query criteria not documented (missing)

- **Type:** missing
- **What's wrong:** The doc never states who actually receives the email. The route selects users where `predictionUpdates: true` AND `status: "ACTIVE"` AND `emailNotificationsEnabled: true` (`backend/src/routes/admin.ts:193-205`), and sends in the user's resolved locale via `resolveUserLocale(user)`. So a user who globally disabled email notifications is excluded even if subscribed to prediction updates.
- **Fix:** Add a short note: emails go to ACTIVE users with `predictionUpdates = true` and `emailNotificationsEnabled = true`, each in their resolved locale.

### Step 3 "Unsubscribe link" — links to /profile, not a tokenized unsubscribe (minor)

- **Type:** incorrect
- **What's wrong:** Line 143 lists "Unsubscribe link" among email contents. The template's unsubscribe link points to `${FRONTEND_URL}/profile` (`backend/src/lib/email.ts:1544`), i.e. the profile page where the user toggles the preference — not a tokenized one-click unsubscribe (a tokenized unsubscribe link is still a pending task per project memory). A List-Unsubscribe header is set via `getUnsubscribeHeaders(userId)` (`backend/src/lib/email.ts:1559`).
- **Fix:** Clarify the in-body link goes to `/profile` for managing the preference, and that RFC List-Unsubscribe headers are included. Don't imply a tokenized in-email unsubscribe.

### Batch behavior — accurate (ok)

- **Type:** ok
- **What's wrong:** Nothing. Lines 144-148 correctly describe batches of 10 (`PREDICTION_EMAIL_BATCH_SIZE = 10`) with a 1-second delay (`PREDICTION_EMAIL_BATCH_DELAY_MS = 1_000`), fire-and-forget return, and an audit event (`writeAuditEvent` with `action: "prediction_update_mass_send"`, `entityType: "PredictionUpdate"`, recording `subscriberCount`). All confirmed at `backend/src/routes/admin.ts:180-258`.

### Step 2 — page constants and translation keys (mostly ok)

- **Type:** ok
- **What's wrong:** Largely accurate. `GROUP_PREDICTIONS`, `R32_MATCHES`, `R16_MATCHES`, `QF_MATCHES`, `SF_MATCHES`, `FINAL_MATCH` all exist as top-level constants in `frontend-next/src/app/[locale]/mundial-2026/predicciones/page.tsx` (lines 21-89), and `predictions.*` translation keys (champion.team, champion.reasoning, knockout.finalTeamA/finalTeamB, etc.) are used. The JSON-LD `dateModified` exists (hardcoded `"2026-04-04"` at page.tsx:345 — confirms the doc's instruction to bump it on each update). Note: the doc lists `predictions.analysis.p1`-`p4` and `predictions.groups.analysis[A-L]`; these specific keys should be spot-checked against the worldCup.json files before relying on them, as the page also surfaces `predictions.bestThirds.*` not mentioned in the doc.

### Email CTA path — code links to /predicciones which has no route (note, not a doc defect)

- **Type:** ok
- **What's wrong:** Not a doc error, but worth flagging for the code: the email CTA builds `${FRONTEND_URL}/predicciones` (`backend/src/lib/email.ts:1543`), yet the actual page lives at `/mundial-2026/predicciones` and no `/predicciones` redirect exists in `next.config.ts` or `proxy.ts`. The doc correctly refers to the page by its real path; the mismatch is in the backend email builder, not the doc.
