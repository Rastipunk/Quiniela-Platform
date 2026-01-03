import type { PlatformRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      // Comentario en español: info del usuario autenticado (si aplica)
      auth?: {
        userId: string;
        platformRole: PlatformRole;
      };
    }
  }
}

export {};
