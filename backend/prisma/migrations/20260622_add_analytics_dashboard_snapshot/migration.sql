-- CreateTable
CREATE TABLE "AnalyticsDashboardSnapshot" (
    "id" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "generatedAtUtc" TIMESTAMP(3) NOT NULL,
    "buildDurationMs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDashboardSnapshot_pkey" PRIMARY KEY ("id")
);
