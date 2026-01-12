/**
 * Script para listar pools existentes
 */

import "dotenv/config";
import { prisma } from "../db";

async function main() {
  console.log('📋 Listando pools...\n');

  const pools = await prisma.pool.findMany({
    include: {
      members: true,
      _count: {
        select: { members: true }
      }
    },
    orderBy: { createdAtUtc: 'desc' }
  });

  if (pools.length === 0) {
    console.log('No hay pools en la base de datos');
    return;
  }

  console.log(`Total de pools: ${pools.length}\n`);

  pools.forEach((pool, idx) => {
    console.log(`${idx + 1}. ${pool.name}`);
    console.log(`   ID: ${pool.id}`);
    console.log(`   Estado: ${pool.status}`);
    console.log(`   Miembros: ${pool._count.members}`);
    console.log(`   Creado: ${pool.createdAtUtc.toISOString()}`);
    console.log('');
  });

  // Mostrar el más reciente
  if (pools.length > 0) {
    const latest = pools[0];
    console.log('📌 Pool más reciente (probablemente el de testing):');
    console.log(`   ${latest.name}`);
    console.log(`   ID: ${latest.id}`);
    console.log(`   Estado: ${latest.status}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
