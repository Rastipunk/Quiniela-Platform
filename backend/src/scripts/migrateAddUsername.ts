// backend/src/scripts/migrateAddUsername.ts
// Script para migrar usuarios existentes agregando usernames
import "dotenv/config";
import { prisma } from "../db";

function generateUsernameFromEmail(email: string): string {
  // Extraer parte local del email y limpiar
  const localPart = email.split("@")[0];
  const clean = localPart?.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  return clean || "user";
}

async function main() {
  console.log("🔄 Migración: Agregando usernames a usuarios existentes\n");

  // 1. Obtener todos los usuarios sin username
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, email: true, displayName: true },
  });

  console.log(`📊 Usuarios a migrar: ${users.length}\n`);

  if (users.length === 0) {
    console.log("✅ No hay usuarios para migrar");
    return;
  }

  // 2. Generar usernames únicos
  const usernameMap = new Map<string, string>();
  const usedUsernames = new Set<string>();

  for (const user of users) {
    let baseUsername = generateUsernameFromEmail(user.email);
    let username = baseUsername;
    let counter = 1;

    // Asegurar que sea único
    while (usedUsernames.has(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    usedUsernames.add(username);
    usernameMap.set(user.id, username);
  }

  // 3. Actualizar cada usuario
  let updated = 0;
  for (const user of users) {
    const username = usernameMap.get(user.id);
    if (!username) continue;

    await prisma.user.update({
      where: { id: user.id },
      data: { username },
    });

    console.log(`✅ ${user.email} → @${username}`);
    updated++;
  }

  console.log(`\n✅ Migración completada: ${updated} usuarios actualizados`);
  console.log("\n⚠️  IMPORTANTE: Los usuarios deberán cambiar su username en su perfil");
}

main()
  .catch((e) => {
    console.error("❌ Error en migración:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
