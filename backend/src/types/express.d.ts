import { PlatformRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        platformRole: PlatformRole;
      };
    }
  }
}

export {};
