-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL,
    "isCorporateHost" BOOLEAN NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "recommendScore" INTEGER NOT NULL,
    "otherTournamentsScore" INTEGER NOT NULL,
    "comment" TEXT,
    "shareConsent" BOOLEAN NOT NULL DEFAULT false,
    "hostCreateScore" INTEGER,
    "hostInviteScore" INTEGER,
    "hostLiveResultsScore" INTEGER,
    "hostRulesScore" INTEGER,
    "hostSupportScore" INTEGER,
    "locale" TEXT,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_userId_key" ON "SurveyResponse"("userId");

-- CreateIndex
CREATE INDEX "SurveyResponse_isHost_idx" ON "SurveyResponse"("isHost");

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
