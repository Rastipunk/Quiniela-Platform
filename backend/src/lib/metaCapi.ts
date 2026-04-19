import crypto from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || "";
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || "";
const API_VERSION = "v21.0";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

interface CapiUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string;
  fbp?: string;
  externalId?: string;
}

interface CapiEventParams {
  eventName: string;
  eventId?: string;
  eventSourceUrl?: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
}

function buildUserData(data: CapiUserData): Record<string, string | undefined> {
  return {
    em: data.email ? sha256(data.email) : undefined,
    fn: data.firstName ? sha256(data.firstName) : undefined,
    ln: data.lastName ? sha256(data.lastName) : undefined,
    client_ip_address: data.clientIpAddress,
    client_user_agent: data.clientUserAgent,
    fbc: data.fbc,
    fbp: data.fbp,
    external_id: data.externalId ? sha256(data.externalId) : undefined,
  };
}

export async function sendCapiEvent(params: CapiEventParams): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const userData = buildUserData(params.userData);
  // Remove undefined keys
  const cleanUserData = Object.fromEntries(
    Object.entries(userData).filter(([, v]) => v !== undefined)
  );

  const eventData: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    user_data: cleanUserData,
  };

  if (params.eventId) eventData.event_id = params.eventId;
  if (params.eventSourceUrl) eventData.event_source_url = params.eventSourceUrl;
  if (params.customData) eventData.custom_data = params.customData;

  const body: Record<string, unknown> = {
    data: [eventData],
    access_token: ACCESS_TOKEN,
  };

  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[CAPI] ${params.eventName} failed (${res.status}):`, text);
    }
  } catch (err) {
    console.error(`[CAPI] ${params.eventName} error:`, err instanceof Error ? err.message : String(err));
  }
}
