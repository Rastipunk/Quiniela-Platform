import { PrismaClient } from "@prisma/client";

// Comentario en español: una sola instancia de Prisma para toda la app
export const prisma = new PrismaClient();
