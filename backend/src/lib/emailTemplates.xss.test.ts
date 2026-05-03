import { describe, it, expect } from "vitest";
import {
  getCorporateInquiryConfirmationTemplate,
  getCorporateActivationTemplate,
  getPoolFullTemplate,
  getCapacityWarningTemplate,
  getBlockedJoinAttemptTemplate,
  getNewMemberTemplate,
  getPoolInvitationTemplate,
  getDeadlineReminderTemplate,
  getResultPublishedTemplate,
  getPoolCompletedTemplate,
  getMemberRemovedTemplate,
  getNewMemberDigestTemplate,
  getPhaseCompletionSummaryTemplate,
  getVerificationTemplate,
  getWelcomeTemplate,
  getPasswordChangedTemplate,
  getPaymentReceiptTemplate,
} from "./emailTemplates";

const XSS = `<script>alert('xss')</script>`;
const NESTED_XSS = `<img src=x onerror="alert(1)">`;

// Each row defines: name, the rendered HTML, and which raw payload(s) to look
// for. A passing row means none of those payloads survive untransformed in the
// output — they were all neutralised by escapeHtml at the template level.
function expectNoRawXss(name: string, html: string, payloads: string[] = [XSS, NESTED_XSS]) {
  for (const payload of payloads) {
    if (html.includes(payload)) {
      throw new Error(`${name}: raw XSS payload "${payload}" leaked into rendered HTML`);
    }
  }
}

describe("email templates — XSS defence (every host/user-controlled var is escaped)", () => {
  it("inquiry confirmation escapes contactName + companyName (PUBLIC endpoint)", () => {
    const html = getCorporateInquiryConfirmationTemplate({
      contactName: XSS, companyName: XSS, locale: "es",
    });
    expectNoRawXss("inquiry confirmation", html);
    expect(html).toContain("&lt;script&gt;");
  });

  it("corporate activation escapes companyName + poolName + employeeName", () => {
    const html = getCorporateActivationTemplate({
      employeeName: XSS, companyName: XSS, poolName: XSS,
      activationUrl: "https://picks4all.com/activar?token=test",
      locale: "es",
    });
    expectNoRawXss("corporate activation", html);
  });

  it("corporate activation handles ALL three locales without leak", () => {
    for (const locale of ["es", "en", "pt"]) {
      const html = getCorporateActivationTemplate({
        employeeName: XSS, companyName: XSS, poolName: XSS,
        activationUrl: "https://x.com", locale,
      });
      expectNoRawXss(`corporate activation (${locale})`, html);
    }
  });

  it("pool full notification escapes hostName + poolName", () => {
    const html = getPoolFullTemplate({
      hostName: XSS, poolName: XSS, poolId: "abc", maxParticipants: 100, locale: "es",
    });
    expectNoRawXss("pool full", html);
  });

  it("capacity warning escapes hostName + poolName", () => {
    const html = getCapacityWarningTemplate({
      hostName: XSS, poolName: XSS, poolId: "abc",
      currentMembers: 95, maxParticipants: 100, locale: "es",
    });
    expectNoRawXss("capacity warning", html);
  });

  it("blocked join attempt escapes hostName + poolName + attemptedEmail", () => {
    const html = getBlockedJoinAttemptTemplate({
      hostName: XSS, poolName: XSS, poolId: "abc",
      attemptedEmail: XSS, maxParticipants: 100, locale: "es",
    });
    expectNoRawXss("blocked join attempt", html);
  });

  it("new member notification escapes hostName + memberName + poolName", () => {
    const html = getNewMemberTemplate({
      hostName: XSS, memberName: XSS, poolName: XSS, poolId: "abc",
      currentCount: 5, locale: "es",
    });
    expectNoRawXss("new member", html);
  });

  it("pool invitation escapes inviterName + poolName + poolDescription", () => {
    const html = getPoolInvitationTemplate({
      inviterName: XSS, poolName: XSS, inviteCode: "ABC123",
      poolDescription: XSS, locale: "es",
    });
    expectNoRawXss("pool invitation", html);
  });

  it("deadline reminder escapes displayName + poolName", () => {
    const html = getDeadlineReminderTemplate({
      displayName: XSS, poolName: XSS, matchesCount: 3,
      deadlineTime: "2026-01-01T00:00:00Z", poolId: "a", locale: "es",
    });
    expectNoRawXss("deadline reminder", html);
  });

  it("result published escapes displayName + poolName + matchDescription + result", () => {
    const html = getResultPublishedTemplate({
      displayName: XSS, poolName: XSS, matchDescription: XSS, result: XSS,
      pointsEarned: 5, currentRank: 3, totalParticipants: 10,
      poolId: "a", locale: "es",
    });
    expectNoRawXss("result published", html);
  });

  it("pool completed escapes displayName + poolName", () => {
    const html = getPoolCompletedTemplate({
      displayName: XSS, poolName: XSS, finalRank: 1, totalPoints: 50,
      totalParticipants: 10, exactScores: 3, poolId: "a", locale: "es",
    });
    expectNoRawXss("pool completed", html);
  });

  it("member removed escapes displayName + poolName + reason", () => {
    const html = getMemberRemovedTemplate({
      displayName: XSS, poolName: XSS, reason: XSS, type: "REMOVED", locale: "es",
    });
    expectNoRawXss("member removed", html);
  });

  it("new member digest escapes hostName + poolName + per-member name in iteration", () => {
    const html = getNewMemberDigestTemplate({
      hostName: XSS, poolName: XSS, poolId: "a",
      newMembers: [{ name: XSS }, { name: NESTED_XSS }],
      currentTotal: 10, locale: "es",
    });
    expectNoRawXss("new member digest", html);
  });

  it("phase completion summary escapes displayName + poolName + phaseName + per-row top10 displayName", () => {
    const html = getPhaseCompletionSummaryTemplate({
      displayName: XSS, poolName: XSS, poolId: "a", phaseName: XSS,
      userRank: 3, userPoints: 50, totalParticipants: 10,
      top10: [{ displayName: XSS, points: 100 }, { displayName: NESTED_XSS, points: 90 }],
      locale: "es",
    });
    expectNoRawXss("phase completion summary", html);
  });

  it("verification email escapes displayName", () => {
    const html = getVerificationTemplate({
      displayName: XSS, verificationUrl: "https://x.com", locale: "es",
    });
    expectNoRawXss("verification", html);
  });

  it("welcome email escapes displayName", () => {
    const html = getWelcomeTemplate({ displayName: XSS, locale: "es" });
    expectNoRawXss("welcome", html);
  });

  it("password changed email escapes displayName", () => {
    const html = getPasswordChangedTemplate({ displayName: XSS, locale: "es" });
    expectNoRawXss("password changed", html);
  });

  it("payment receipt escapes displayName + poolName", () => {
    const html = getPaymentReceiptTemplate({
      displayName: XSS, poolName: XSS, poolId: "a",
      transactionId: "tx-1", amount: "100.00", currency: "USD",
      fromCapacity: 20, toCapacity: 50, paidAt: new Date(),
      userId: "u-1", locale: "es",
    });
    expectNoRawXss("payment receipt", html);
  });
});
