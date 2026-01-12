import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

type Role = "ADMIN" | "PLAYER" | "HOST";

async function upsertUser(params: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  platformRole: Role;
}) {
  const passwordHash = await hashPassword(params.password);

  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      username: params.username,
      displayName: params.displayName,
      passwordHash,
      platformRole: params.platformRole,
      status: "ACTIVE",
    },
    update: {
      displayName: params.displayName,
      passwordHash, // importante: si corres seed de nuevo, "resetea" el password a este valor
      platformRole: params.platformRole,
      status: "ACTIVE",
    },
    select: { id: true, email: true, username: true, displayName: true, platformRole: true },
  });
}

async function main() {
  const adminEmail = process.env.TEST_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;

  const hostEmail = process.env.TEST_HOST_EMAIL;
  const hostPassword = process.env.TEST_HOST_PASSWORD;

  const playerEmail = process.env.TEST_PLAYER_EMAIL;
  const playerPassword = process.env.TEST_PLAYER_PASSWORD;

  if (!adminEmail || !adminPassword || !hostEmail || !hostPassword || !playerEmail || !playerPassword) {
    throw new Error(
      "Faltan variables TEST_* en backend/.env. Revisa TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_HOST_EMAIL, TEST_HOST_PASSWORD, TEST_PLAYER_EMAIL, TEST_PLAYER_PASSWORD."
    );
  }

  const admin = await upsertUser({
    email: adminEmail,
    username: "qa_admin",
    displayName: "QA Admin",
    password: adminPassword,
    platformRole: "ADMIN",
  });

  const host = await upsertUser({
    email: hostEmail,
    username: "qa_host",
    displayName: "QA Host",
    password: hostPassword,
    platformRole: "PLAYER", // el rol HOST real ocurre dentro del Pool (PoolMember.role)
  });

  const player = await upsertUser({
    email: playerEmail,
    username: "qa_player",
    displayName: "QA Player",
    password: playerPassword,
    platformRole: "PLAYER",
  });

  console.log("✅ Test accounts ready:");
  console.log({ admin, host, player });
}

main()
  .catch((err) => {
    console.error("❌ seedTestAccounts failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
