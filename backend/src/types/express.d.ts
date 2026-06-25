import { PlatformRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        platformRole: PlatformRole;
        /** Current session row id (ADR-081). Set when the access token carries
         *  one; used by logout / session-management endpoints. Absent on
         *  legacy tokens issued before persistent sessions shipped. */
        sessionId?: string;
      };
    }
  }
}

export {};
