import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

// Comentario en español: crea un usuario ADMIN para desarrollo (idempotente)
async function main() {
  const email = "admin@example.com";
  const username = "platform_admin";
  const displayName = "Platform Admin";
  const password = "Admin123!";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Comentario en español: si ya existe, asegura rol ADMIN y status ACTIVE
    await prisma.user.update({
      where: { email },
      data: { platformRole: "ADMIN", status: "ACTIVE", displayName },
    });
    console.log("✅ Admin already existed; role/status ensured.");
    console.log("   email:", email);
    console.log("   username:", existing.username);
    console.log("   password:", password);
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash,
      platformRole: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("✅ Admin created:");
  console.log("   email:", email);
  console.log("   username:", username);
  console.log("   password:", password);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
