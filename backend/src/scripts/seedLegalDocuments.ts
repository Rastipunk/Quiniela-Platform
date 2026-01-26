/**
 * Seed script para documentos legales iniciales
 *
 * Ejecutar con:
 *   npx ts-node src/scripts/seedLegalDocuments.ts
 *
 * O añadir a package.json:
 *   "seed:legal": "ts-node src/scripts/seedLegalDocuments.ts"
 */

import { PrismaClient, LegalDocumentType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const LEGAL_DOCS_DIR = path.join(__dirname, "../data/legal");

interface LegalDocumentSeed {
  type: LegalDocumentType;
  version: string;
  title: string;
  filename: string;
  changeSummary?: string;
  locale: string;
}

const DOCUMENTS_TO_SEED: LegalDocumentSeed[] = [
  {
    type: "TERMS_OF_SERVICE",
    version: "2026-01-25",
    title: "Términos de Servicio",
    filename: "terms-of-service-v2026-01-25.md",
    changeSummary: "Versión inicial de los Términos de Servicio.",
    locale: "es",
  },
  {
    type: "PRIVACY_POLICY",
    version: "2026-01-25",
    title: "Política de Privacidad",
    filename: "privacy-policy-v2026-01-25.md",
    changeSummary: "Versión inicial de la Política de Privacidad.",
    locale: "es",
  },
];

async function main() {
  console.log("🔧 Iniciando seed de documentos legales...\n");

  for (const doc of DOCUMENTS_TO_SEED) {
    const filePath = path.join(LEGAL_DOCS_DIR, doc.filename);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Archivo no encontrado: ${filePath}`);
      continue;
    }

    // Leer contenido del archivo
    const content = fs.readFileSync(filePath, "utf-8");

    // Verificar si ya existe
    const existing = await prisma.legalDocument.findUnique({
      where: {
        type_version_locale: {
          type: doc.type,
          version: doc.version,
          locale: doc.locale,
        },
      },
    });

    if (existing) {
      console.log(`⚠️  ${doc.type} v${doc.version} (${doc.locale}) ya existe, actualizando contenido...`);

      await prisma.legalDocument.update({
        where: { id: existing.id },
        data: {
          title: doc.title,
          content,
          changeSummary: doc.changeSummary,
          isActive: true,
          publishedAt: new Date(),
          effectiveAt: new Date(),
        },
      });

      console.log(`   ✓ Actualizado: ${doc.title}`);
    } else {
      // Desactivar versiones anteriores del mismo tipo y locale
      await prisma.legalDocument.updateMany({
        where: {
          type: doc.type,
          locale: doc.locale,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Crear nuevo documento
      const created = await prisma.legalDocument.create({
        data: {
          type: doc.type,
          version: doc.version,
          title: doc.title,
          content,
          changeSummary: doc.changeSummary,
          locale: doc.locale,
          isActive: true,
          publishedAt: new Date(),
          effectiveAt: new Date(),
        },
      });

      console.log(`✅ Creado: ${doc.title} (${created.id})`);
    }
  }

  // Mostrar resumen
  console.log("\n📊 Resumen de documentos legales:");
  const allDocs = await prisma.legalDocument.findMany({
    orderBy: [{ type: "asc" }, { version: "desc" }],
  });

  for (const doc of allDocs) {
    const status = doc.isActive ? "🟢 ACTIVO" : "⚪ inactivo";
    console.log(`   ${status} ${doc.type} v${doc.version} (${doc.locale})`);
  }

  console.log("\n✅ Seed de documentos legales completado!");
}

main()
  .catch((e) => {
    console.error("Error durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
