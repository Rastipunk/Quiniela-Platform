/**
 * Script para migrar pools existentes de DRAFT a ACTIVE
 *
 * Contexto: Pools creados antes de Pool State Machine deben estar en ACTIVE
 * ya que tienen miembros y están funcionando.
 */

import "dotenv/config";
import { prisma } from "../db";

async function main() {
  console.log('🔄 Migrando pools existentes a estado ACTIVE...\n');

  // Contar pools actuales
  const totalPools = await prisma.pool.count();
  console.log(`📊 Total de pools: ${totalPools}`);

  // Contar pools por estado
  const draftPools = await prisma.pool.count({ where: { status: 'DRAFT' } });
  const activePools = await prisma.pool.count({ where: { status: 'ACTIVE' } });

  console.log(`   - DRAFT: ${draftPools}`);
  console.log(`   - ACTIVE: ${activePools}\n`);

  if (draftPools === 0) {
    console.log('✅ No hay pools en DRAFT. Todos ya están en ACTIVE.');
    return;
  }

  // Actualizar pools con miembros a ACTIVE
  const result = await prisma.pool.updateMany({
    where: {
      status: 'DRAFT',
      members: {
        some: {} // Tiene al menos 1 miembro
      }
    },
    data: {
      status: 'ACTIVE'
    }
  });

  console.log(`✅ Actualizados ${result.count} pools a ACTIVE\n`);

  // Verificar estado final
  const finalDraft = await prisma.pool.count({ where: { status: 'DRAFT' } });
  const finalActive = await prisma.pool.count({ where: { status: 'ACTIVE' } });

  console.log('📊 Estado final:');
  console.log(`   - DRAFT: ${finalDraft}`);
  console.log(`   - ACTIVE: ${finalActive}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
