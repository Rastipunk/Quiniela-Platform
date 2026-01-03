-- CreateEnum
CREATE TYPE "TournamentInstanceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "TournamentInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TournamentInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "dataJson" JSONB NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentInstance_templateId_idx" ON "TournamentInstance"("templateId");

-- CreateIndex
CREATE INDEX "TournamentInstance_templateVersionId_idx" ON "TournamentInstance"("templateVersionId");

-- AddForeignKey
ALTER TABLE "TournamentInstance" ADD CONSTRAINT "TournamentInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TournamentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInstance" ADD CONSTRAINT "TournamentInstance_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TournamentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
