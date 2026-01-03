-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateTable
CREATE TABLE "TournamentTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "currentPublishedVersionId" TEXT,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "dataJson" JSONB NOT NULL,
    "publishedAtUtc" TIMESTAMP(3),
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTemplate_key_key" ON "TournamentTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTemplate_currentPublishedVersionId_key" ON "TournamentTemplate"("currentPublishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTemplateVersion_templateId_versionNumber_key" ON "TournamentTemplateVersion"("templateId", "versionNumber");

-- AddForeignKey
ALTER TABLE "TournamentTemplate" ADD CONSTRAINT "TournamentTemplate_currentPublishedVersionId_fkey" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "TournamentTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTemplateVersion" ADD CONSTRAINT "TournamentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TournamentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
