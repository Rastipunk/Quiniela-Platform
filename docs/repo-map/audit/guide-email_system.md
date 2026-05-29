## Audit: docs/guides/EMAIL_SYSTEM.md

**Overall verdict:** UPDATE (severity: major). The doc is broadly accurate on the platform/user toggle architecture, the `EMAIL_CONFIG_MAP`, the PlatformSettings/DeadlineReminderLog/User schemas, the EmailSuppression webhook flow, and the support-mailbox-by-locale map. However it has several material drifts: the deadline reminder is now a real daily cron (doc still calls it manual-only), the email verification + welcome flow is now deferred to the locale-preference handoff (doc describes the old "send right after verify" flow), the test endpoint accepts 7 types not 5, and the senders/templates list omits ~8 emails that actually ship (capacity warning, blocked join, group-standings override, knockout-winner override, pending-approval digest, pool-reverted-to-draft, corporate check-in, plus the dual-gateway payment receipt nuance). Reply-To / FROM behavior is also undocumented and the doc's stated FROM (`noreply@`) contradicts the code.

---

### Section: "Flujo de Verificación de Email" + "Integración Actual → Welcome Email"
**Type:** incorrect / obsolete
**What's wrong:** The doc (lines 197-217 and line 316) says the verification email is sent at registration and the Welcome email is sent "después de verificar email". In the real code BOTH are deferred to the first-login locale-preference handoff. `authService.ts:191-198` explicitly: "Verification email is intentionally deferred until the user completes the first-login locale-preference modal — see userProfile.ts POST /me/locale-preference". `authService.ts:483-485` (and :545, :791): "Welcome email is deferred to POST /users/me/locale-preference (or the 24h fallback job)". There is a dedicated `backend/src/jobs/welcomeEmailFallbackJob.ts` cron that ships the welcome 24h later (idempotent via `User.welcomeEmailSentAt`) for users who never complete the modal. This is ADR-063 (welcome email handoff). The doc's step "Se envía email de verificación / Usuario puede usar la app" and "Welcome email enviado directamente" for Google OAuth are both stale.
**Fix:** Rewrite the verification/welcome flow to: register → email deferred → user completes LocalePreferenceModal (POST /me/locale-preference) which fires verification + welcome in the chosen locale → 24h fallback job (`welcomeEmailFallbackJob.ts`, idempotent on `welcomeEmailSentAt`) catches abandoners. Reference `backend/prisma/schema.prisma` `User.welcomeEmailSentAt` and `User.locale`.

---

### Section: "Deadline Reminder (Desactivado por defecto)" / "Ejecución manual"
**Type:** incorrect / missing
**What's wrong:** The doc says deadline reminders only run via `POST /admin/settings/email/reminders/run` ("Ejecución manual"). A real cron job exists: `backend/src/jobs/deadlineReminderJob.ts` runs daily at 7:00 AM Colombia (`0 12 * * *` UTC, env `DEADLINE_REMINDER_CRON`) calling `processDeadlineReminders(48, false)`. Two drifts: (1) the doc never mentions the cron job at all; (2) the manual endpoint defaults `hoursBeforeDeadline` to 24, but the CRON uses a 48-hour window (matches MEMORY note "Window changed from 24h to 48h"). The platform-level `emailDeadlineReminderEnabled` default is still `false`, so the cron is gated off until an admin enables it — that part is correct.
**Fix:** Add the cron job (`deadlineReminderJob.ts`, `0 12 * * *`, 48h window) to the "Deadline Reminder" subsection and the cron table. Clarify the manual endpoint uses 24h default while the cron uses 48h.

---

### Section: "Testing → Enviar email de prueba (Admin)" — valid types
**Type:** incorrect
**What's wrong:** The doc (line 392) lists valid test types as `welcome, poolInvitation, deadlineReminder, resultPublished, poolCompleted` (5). The real `testEmailSchema` in `adminSettings.ts:204-212` accepts 7: it also includes `newMemberDigest` and `phaseCompletionSummary`.
**Fix:** Add `newMemberDigest` and `phaseCompletionSummary` to the valid-types list.

---

### Section: "Servicio de Email" — senders list / "Tipos de Email" table
**Type:** missing
**What's wrong:** Several shipped senders in `backend/src/lib/email.ts` are absent from both the type table and the function list: `sendCapacityWarningEmail` (the doc DOES mention "Capacity Warning" in the table but not the function), `sendBlockedJoinAttemptEmail` (table-only, no function), `sendGroupStandingsOverrideNotification`, `sendKnockoutWinnerOverrideNotification` (group/knockout override emails — totally absent), `sendPendingApprovalDigestEmail` (pending-approval digest reusing `emailNewMemberDigest` opt-out — absent), `sendPoolRevertedToDraftEmail` (absent), `sendCorporateCheckinEmail` (proactive corporate outreach, always from/reply-to `empresas@picks4all.com` — absent). Also `sendPasswordChangedEmail`, `sendCapacityWarningEmail` and `sendBlockedJoinAttemptEmail` exist as functions but the function-list in §"Servicio de Email" omits them.
**Fix:** Sync the sender list and the Tipos de Email table with the ~22 `send*` functions actually exported from `email.ts`. Add rows for Group Standings Override, Knockout Winner Override, Pending Approval Digest, Pool Reverted to Draft, and Corporate Check-in.

---

### Section: "Infraestructura de Email → Envío — Resend" (FROM / Reply-To)
**Type:** incorrect / missing
**What's wrong:** The doc states "From: noreply@picks4all.com". The code deliberately moved away from `noreply@`: `email.ts:60-74` documents that the FROM is now a real monitored mailbox and `DEFAULT_REPLY_TO = soporte@${EMAIL_DOMAIN|SITE_DOMAIN}` is injected on all user-facing emails (the comment cites Resend Insights penalising `noreply@`). The actual FROM is `${APP_NAME} <${RESEND_FROM_EMAIL}>` (env-driven). Per-type Reply-To overrides exist (payment receipts → `ventas@`, corporate → `empresas@`). The doc documents none of this Reply-To routing.
**Fix:** Replace the "From: noreply@" line with the env-driven FROM + the default `soporte@` Reply-To, and note the per-type Reply-To overrides (sales/corporate) and that admin notifications opt out via `skipDefaultReplyTo`.

---

### Section: "Notificaciones Internas → AdminCategory table"
**Type:** incorrect / missing
**What's wrong:** The doc's category table is missing two real categories from the `AdminCategory` union in `email.ts:1006-1014`: `payment_reconciler_rescued` (🛟 "Reconciler: revisión manual", inbox `admin`) and `cc_pricing_drift` (⚠️ "CC: drift de precio", inboxes `sales`+`admin`). Also the doc's label for `corporate_inquiry` is "📩" routed to ENTERPRISE — code label is "Cotización corporativa" (the routing/emoji match). The doc attributes `payment_completed` trigger to "webhook Polar" only, but the union/comment cover "Polar / MP" (dual gateway).
**Fix:** Add the `payment_reconciler_rescued` and `cc_pricing_drift` rows; update `payment_completed` trigger to "Polar / MP webhook".

---

### Section: "Templates de Email → XSS escape" — count + test param shapes
**Type:** incorrect
**What's wrong:** The doc (line 86) says the XSS test renders "CADA uno de los 17 templates". The repo-map (part-03) flags that `emailTemplates.xss.test.ts` uses stale param shapes for several templates (`getMemberRemovedTemplate` passed `type: "REMOVED"` vs accepted `"kicked"|"banned"`; `getPhaseCompletionSummaryTemplate` passed `top10: [{displayName, points}]` vs interface `{rank, name, points}`; `getPaymentReceiptTemplate` passed `paidAt: Date` + stray `userId` vs `paidAt: string`). part-03 also flags two real unescaped-interpolation gaps (EN/PT greeting `contactName` in inquiry confirmation; Top-10 `entry.name` in phase summary) — so the doc's blanket claim that "el script raw no sobrevive" is not fully guaranteed by the current tests.
**Fix:** Soften the "17 templates, fully covered" claim; note the known escaping gaps (corporate inquiry EN/PT greeting, phase-summary Top-10 names) and the stale test param shapes flagged in repo-map part-03 that need re-alignment.

---

### Section: "Emails Corporativos → Corporate Activation" token
**Type:** ok (verify against MEMORY)
**What's wrong:** Doc says "Token de 32 bytes (crypto.randomBytes(CRYPTO_BYTES.TOKEN)) → 64 caracteres hex". Verified correct: `constants.ts:18-19` `CRYPTO_BYTES.TOKEN = 32`, `corporateService.ts:374` `crypto.randomBytes(CRYPTO_BYTES.TOKEN).toString("hex")`, 30-day expiry (`TOKEN_EXPIRY_MS.CORPORATE_INVITE = 30 * MS.DAY`). (Note: MEMORY.md says "48 bytes" — MEMORY is stale, the DOC is right here.) The resend endpoint `POST /corporate/pools/:poolId/employees/:inviteId/resend` exists (`corporate.ts:328`). Mark OK.

---

### Section: PlatformSettings / DeadlineReminderLog / User schema blocks
**Type:** ok
**What's wrong:** Verified against `backend/prisma/schema.prisma`: `PlatformSettings` (lines 828-848) has the five email toggles with matching defaults (`emailDeadlineReminderEnabled @default(false)`, rest true); `emailPoolInvitationEnabled` exists and is legacy/unused — doc's "Legacy — no longer used" comment is accurate. `DeadlineReminderLog` (859-879) matches incl. `@@unique([poolId, userId, matchId])`. `User` email-pref fields (91-105) all match incl. `predictionUpdates @default(false)`. `EmailSuppression` (485-495) matches the ADR-055 description. Mark OK.

---

### Section: "API de Configuración Admin" + "API de Preferencias de Usuario" endpoints
**Type:** ok (minor omission)
**What's wrong:** The five admin endpoints (`GET/PUT /email`, `POST /email/test`, `POST /email/reminders/run`, `GET /email/reminders/stats`) all match `adminSettings.ts`. `GET/PUT /me/email-preferences` match `me.ts:170,237` and the GET returns `platformEnabled` as documented. Minor: the doc omits the sibling `GET/PUT /admin/settings/scores` endpoints in the same router (out of scope for an email doc, but worth a one-line "see also").
**Fix:** Optional — note that the same router also exposes `/admin/settings/scores`.

---

### Section: Frontend "Panel de Admin" component path
**Type:** incorrect (minor)
**What's wrong:** The doc references the admin page at `frontend-next/src/app/[locale]/(authenticated)/admin/settings/email/page.tsx` and describes it as having the toggles directly. The real `page.tsx` is a thin wrapper that renders `<AdminEmailSettingsContent />` from `frontend-next/src/components/AdminEmailSettingsContent.tsx` — the actual toggle UI lives in that component.
**Fix:** Point the "Panel de Admin" reference at `components/AdminEmailSettingsContent.tsx` (the page is just a metadata wrapper).
