# AI Prediction Update Process

> **Last updated:** 2026-05-04
>
> This guide documents the complete process for updating the World Cup 2026 AI predictions and notifying subscribers.

---

## Overview

The AI Predictor system works in three steps:

1. **Analyze** — After each matchday, analyze results and regenerate predictions
2. **Update content** — Modify translation files with new predictions, commit, push
3. **Notify subscribers** — Call the admin endpoint to email all subscribers with changes

---

## Step 1: Analyze and Regenerate Predictions

After a matchday completes, Claude should:

1. Check actual results from the API-Football data
2. Re-evaluate group standings based on real results
3. Update knockout bracket predictions based on which teams actually advanced
4. Identify what changed vs. the previous prediction

### What to analyze:

- **Group stage** (Jun 11 – Jun 27): After each matchday (MD1, MD2, MD3), recalculate predicted group winners/runners-up based on actual points
- **R32** (Jun 28-30): Once groups are final, replace predicted R32 matchups with actual ones
- **R16 onward** (Jul 1+): After each knockout round, update the bracket with actual winners

### Change types to track:

The `type` and `description` fields are both **free-form strings** — the backend Zod schema (`predictionUpdateSchema` in `backend/src/routes/admin.ts`) only enforces `type: string (1–100 chars)` and `description: string (1–500 chars)`, and the `changes` array must contain **1–50 entries**. There is no enforced enum. The types below are recommended documentation conventions, not validated values.

| Type | When to use |
|------|-------------|
| `CHAMPION` | Predicted champion changes |
| `FINALIST` | A team newly predicted to reach the final |
| `SEMIFINALIST` | A team newly predicted to reach semis |
| `ELIMINATED` | A previously predicted deep-run team is eliminated |
| `GROUP_CHANGE` | A group winner/runner-up prediction changes |
| `UPSET` | A major upset that reshuffles the bracket |
| `CONFIRMED` | A prediction was confirmed by actual results |

---

## Step 2: Update Translation Files

### Files to modify:

```
frontend-next/src/messages/es/worldCup.json  → predictions section
frontend-next/src/messages/en/worldCup.json  → predictions section
frontend-next/src/messages/pt/worldCup.json  → predictions section
```

### Data to update in the page component:

```
frontend-next/src/app/[locale]/mundial-2026/predicciones/page.tsx
```

Update these constants at the top of the file:
- `GROUP_PREDICTIONS` — predicted finish order per group
- `R32_MATCHES` — R32 matchups and predicted winners
- `R16_MATCHES` — R16 matchups and predicted winners
- `QF_MATCHES` — QF matchups and predicted winners
- `SF_MATCHES` — SF matchups and predicted winners
- `FINAL_MATCH` — final matchup and predicted winner

### Translation keys to update:

- `predictions.groups.analysisA` through `predictions.groups.analysisL` — per-group analysis text
- `predictions.champion.team` — predicted champion name
- `predictions.champion.reasoning` — why this team wins
- `predictions.analysis.p1` through `predictions.analysis.p4` — detailed analysis paragraphs
- `predictions.knockout.finalTeamA` / `predictions.knockout.finalTeamB` — finalists
- `predictions.bestThirds.*` — best third-placed teams that advance (also surfaced on the page)

### JSON-LD dateModified:

Update the `dateModified` field in the Article JSON-LD to the current date.

### Commit and push:

```bash
git add -A
git commit -m "feat(predictions): update WC2026 AI prediction after [matchday/round]"
git push origin main
```

---

## Step 3: Notify Subscribers

### Generate JWT admin token:

Run this on the backend host (Railway), where `JWT_SECRET` is set in the environment. The signing recipe must match `signToken` in `backend/src/lib/jwt.ts` exactly — `HS256` algorithm, a `{ userId, platformRole }` payload, and the secret read from `process.env.JWT_SECRET` (production tokens use `expiresIn: "4h"`):

```bash
cd quiniela-platform/backend
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: '<ADMIN_USER_ID>', platformRole: 'ADMIN' },
  process.env.JWT_SECRET,
  { expiresIn: '4h', algorithm: 'HS256' }
);
console.log(token);
"
```

Admin user ID: `59db1874-b8c2-40d1-9132-5480690ca96c` (Juan Camilo). The referenced user must actually have `platformRole = ADMIN` in the database — `requireAdmin` re-derives the role from the DB and rejects anything else (the `platformRole` claim in the token is not trusted on its own).

### Call the admin endpoint:

```bash
curl -X POST https://api.picks4all.com/admin/prediction-update \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      { "type": "CHAMPION", "description": "Argentina mantiene el favoritismo tras ganar su grupo" },
      { "type": "ELIMINATED", "description": "Colombia eliminada en cuartos de final por Brasil" },
      { "type": "UPSET", "description": "México avanza a cuartos — primera vez desde 1986" }
    ]
  }'
```

### Response:

When there is at least one subscriber, the endpoint returns immediately and queues the send:

```json
{
  "message": "Prediction update emails queued.",
  "emailsQueued": 47
}
```

When there are no subscribers, nothing is queued and the response uses a different key (`emailsSent`):

```json
{
  "message": "No subscribers found.",
  "emailsSent": 0
}
```

### Who receives the email:

The route selects users where `predictionUpdates = true` AND `status = "ACTIVE"` AND `emailNotificationsEnabled = true`. A user who has globally disabled email notifications is excluded even if subscribed to prediction updates. Each email is sent in the user's resolved locale (`resolveUserLocale(user)`).

### What the email contains:

- Subject: "La predicción del Mundial 2026 se ha actualizado" (localized chrome)
- Table of changes, each row showing the raw `type` badge and the `description` text
- CTA button linking to the predictions page
- An in-body "manage preference" link to `/profile` (where the user toggles the subscription) — this is **not** a tokenized one-click unsubscribe. RFC `List-Unsubscribe` / `List-Unsubscribe-Post` headers are also set via `getUnsubscribeHeaders(userId)`.

### Batch behavior:

- Emails are sent in batches of 10 (`PREDICTION_EMAIL_BATCH_SIZE`) with a 1-second delay between batches (`PREDICTION_EMAIL_BATCH_DELAY_MS`)
- The endpoint returns immediately — emails are fire-and-forget
- An audit event (`action: "prediction_update_mass_send"`, `entityType: "PredictionUpdate"`) is logged with the subscriber count and changes count

---

## Change descriptions per locale

When calling the admin endpoint, provide descriptions in all three locales. The system sends the email in the user's preferred locale.

**Important:** Only the email *chrome* (subject, heading, greeting, intro paragraph, CTA, footer / unsubscribe text) is localized per `es/en/pt`. The `type` badge and the `description` are rendered **verbatim** by `getPredictionUpdateTemplate` — there is no `type → label` translation map. An EN/PT user sees the badge string exactly as sent (e.g. literal `CHAMPION`) and the description in whatever language it was provided.

In practice, send the `description` in the DEFAULT locale (Spanish), since the majority of users are Spanish-speaking (71% Colombia). For EN/PT users, the type badge provides context even though the description stays in Spanish. Localized per-change badges/descriptions are not implemented.

---

## Suggested Update Schedule

| Tournament Phase | Dates | Update Frequency |
|-----------------|-------|------------------|
| Group Stage MD1 | Jun 11-18 | After all MD1 matches complete |
| Group Stage MD2 | Jun 18-24 | After all MD2 matches complete |
| Group Stage MD3 | Jun 24-28 | After groups are final |
| Round of 32 | Jun 28-30 | After R32 completes |
| Round of 16 | Jul 1-2 | After R16 completes |
| Quarter-finals | Jul 4-5 | After QF completes |
| Semi-finals | Jul 8-9 | After SF completes |
| Final | Jul 13/19 | Final update — actual champion |

That's approximately **8 email updates** over the course of the tournament.

---

## Quick Reference: Full Update Process

```
1. User says: "Update the prediction after [matchday/round]"

2. Claude:
   a. Checks actual results (API-Football or user-provided)
   b. Recalculates predictions
   c. Updates GROUP_PREDICTIONS, R32/R16/QF/SF/FINAL_MATCH in page.tsx
   d. Updates analysis text in worldCup.json (ES/EN/PT)
   e. Updates dateModified in JSON-LD
   f. Commits and pushes

3. Claude generates the admin curl command with changes array

4. User (or Claude) executes the curl command to notify subscribers
```
