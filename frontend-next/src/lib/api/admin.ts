// Admin API — platform settings, feedback management
import { requestJson } from "./client";
import { getToken } from "../auth";

// Admin email settings
export type PlatformEmailSettings = {
  emailWelcomeEnabled: boolean;
  emailDeadlineReminderEnabled: boolean;
  emailResultPublishedEnabled: boolean;
  emailPoolCompletedEnabled: boolean;
};

export type AdminEmailSettingsResponse = {
  settings: PlatformEmailSettings;
  metadata: {
    updatedAt: string;
    updatedBy: { displayName: string; email: string } | null;
  };
};

export async function getAdminEmailSettings(token: string): Promise<AdminEmailSettingsResponse> {
  return requestJson("/admin/settings/email", { method: "GET" });
}

export async function updateAdminEmailSettings(
  token: string,
  settings: Partial<PlatformEmailSettings>
): Promise<{
  message: string;
  settings: PlatformEmailSettings;
  changes: Record<string, { from: boolean; to: boolean }>;
}> {
  return requestJson("/admin/settings/email", { method: "PUT", body: JSON.stringify(settings) });
}

// Feedback
export type BetaFeedbackItem = {
  id: string;
  type: "BUG" | "SUGGESTION";
  message: string;
  imageBase64: string | null;
  wantsContact: boolean;
  contactName: string | null;
  phoneNumber: string | null;
  userId: string | null;
  userEmail: string | null;
  currentUrl: string | null;
  userAgent: string | null;
  createdAtUtc: string;
};

export type AdminFeedbackResponse = {
  feedbacks: BetaFeedbackItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getAdminFeedback(
  token: string,
  params?: { type?: string; wantsContact?: string; page?: number; limit?: number }
): Promise<AdminFeedbackResponse> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.wantsContact) q.set("wantsContact", params.wantsContact);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return requestJson<AdminFeedbackResponse>(`/feedback/admin${qs}`, { method: "GET" });
}

export async function submitFeedback(
  type: "BUG" | "SUGGESTION",
  message: string,
  imageBase64?: string,
  wantsContact?: boolean,
  contactName?: string,
  phoneNumber?: string
): Promise<{ success: boolean; message: string; id: string }> {
  const token = typeof window !== "undefined" ? getToken() : null;
  return requestJson<{ success: boolean; message: string; id: string }>(
    "/feedback",
    {
      method: "POST",
      body: JSON.stringify({
        type,
        message,
        imageBase64,
        wantsContact: wantsContact ?? false,
        contactName,
        phoneNumber,
        currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    },
  );
}
