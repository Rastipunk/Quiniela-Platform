/**
 * Creates a test player and joins them to the Champions League pool.
 * This transitions the pool from DRAFT to ACTIVE.
 *
 * Usage: npx tsx src/scripts/joinTestPlayer.ts
 */
import "dotenv/config";
import { prisma } from "../db";
import { hashPassword } from "../lib/password";

const TEST_PLAYER = {
  email: "test.player@picks4all.com",
  username: "test_player_1",
  displayName: "Jugador Test",
  password: "Test1234!",
};

async function main() {
  // 1. Create/upsert test player
  const passwordHash = await hashPassword(TEST_PLAYER.password);
  const user = await prisma.user.upsert({
    where: { email: TEST_PLAYER.email },
    create: {
      email: TEST_PLAYER.email,
      username: TEST_PLAYER.username,
      displayName: TEST_PLAYER.displayName,
      passwordHash,
      platformRole: "PLAYER",
      status: "ACTIVE",
    },
    update: {
      displayName: TEST_PLAYER.displayName,
      passwordHash,
      status: "ACTIVE",
    },
  });
  console.log(`✅ Usuario: ${user.email} (${user.id})`);

  // 2. Find the Champions League pool
  const pool = await prisma.pool.findFirst({
    where: {
      tournamentInstanceId: "ucl-2025-instance",
    },
    include: {
      members: { select: { userId: true, role: true, status: true } },
    },
    orderBy: { createdAtUtc: "desc" },
  });

  if (!pool) {
    console.error("❌ No se encontró pool de Champions League (ucl-2025-instance)");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`🏆 Pool encontrada: "${pool.name}" (${pool.id}) - Status: ${pool.status}`);
  console.log(`   Miembros actuales: ${pool.members.length}`);

  // 3. Check if already a member
  const alreadyMember = pool.members.find((m) => m.userId === user.id);
  if (alreadyMember) {
    console.log(`⚠️ Usuario ya es miembro (${alreadyMember.role}, ${alreadyMember.status})`);
    await prisma.$disconnect();
    return;
  }

  // 4. Join as PLAYER
  await prisma.poolMember.create({
    data: {
      poolId: pool.id,
      userId: user.id,
      role: "PLAYER",
      status: "ACTIVE",
    },
  });
  console.log(`✅ Jugador unido a la pool como PLAYER`);

  // 5. Transition pool to ACTIVE if DRAFT
  if (pool.status === "DRAFT") {
    await prisma.pool.update({
      where: { id: pool.id },
      data: { status: "ACTIVE" },
    });
    console.log(`🔓 Pool transicionada de DRAFT → ACTIVE`);
  }

  console.log(`\n📋 Credenciales del jugador test:`);
  console.log(`   Email: ${TEST_PLAYER.email}`);
  console.log(`   Password: ${TEST_PLAYER.password}`);

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
